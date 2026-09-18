package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.EmergencyMaintenanceService;
import com.smartapartment.service.EmergencyMaintenanceService.Actor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class MaintenanceAutoAssignWorkflowTests {

    @Autowired private EmergencyMaintenanceService emergencyService;
    @Autowired private CommonMaintenanceTicketRepository ticketRepo;
    @Autowired private MaintenancePartnerRepository partnerRepo;
    @Autowired private AppUserRepository userRepo;
    @Autowired private StaffAttendanceRepository attendanceRepo;
    @Autowired private ComplaintRepository complaintRepo;

    private Actor adminActor;
    private Actor residentActor;
    private AppUser plumberUser;
    private AppUser electricUser;

    @BeforeEach
    void setup() {
        ticketRepo.findAll().stream()
                .filter(t -> "test-auto-tenant".equals(t.getTenantId()))
                .forEach(ticketRepo::delete);

        adminActor = new Actor(0L, "smartsociety", "test-auto-tenant", "Team Head Admin", true, false);
        residentActor = new Actor(99L, "smartsociety", "test-auto-tenant", "John Resident", false, false);

        plumberUser = userRepo.findByEmail("test_plumber@auto.local").orElseGet(() -> {
            AppUser u = new AppUser();
            u.setEmail("test_plumber@auto.local");
            u.setFullName("Ravi Plumber");
            u.setRole(UserRole.MAINTENANCE_STAFF);
            u.setDesignation("Plumber");
            u.setTenantId("test-auto-tenant");
            u.setPasswordHash("$2a$10$dummyhash");
            u.setAccountLocked(false);
            return userRepo.save(u);
        });

        electricUser = userRepo.findByEmail("test_electric@auto.local").orElseGet(() -> {
            AppUser u = new AppUser();
            u.setEmail("test_electric@auto.local");
            u.setFullName("Kiran Electrician");
            u.setRole(UserRole.MAINTENANCE_STAFF);
            u.setDesignation("Electrician");
            u.setTenantId("test-auto-tenant");
            u.setPasswordHash("$2a$10$dummyhash");
            u.setAccountLocked(false);
            return userRepo.save(u);
        });

        // Ensure clean partner entries
        partnerRepo.findByUserId(plumberUser.getId()).orElseGet(() -> {
            MaintenancePartner p = new MaintenancePartner();
            p.setUserId(plumberUser.getId());
            p.setName(plumberUser.getFullName());
            p.setTrade("Plumbing");
            p.setOnDuty(true);
            p.setWorkState("IDLE");
            p.setAvailability("IDLE");
            return partnerRepo.save(p);
        });

        partnerRepo.findByUserId(electricUser.getId()).orElseGet(() -> {
            MaintenancePartner p = new MaintenancePartner();
            p.setUserId(electricUser.getId());
            p.setName(electricUser.getFullName());
            p.setTrade("Electrical");
            p.setOnDuty(true);
            p.setWorkState("IDLE");
            p.setAvailability("IDLE");
            return partnerRepo.save(p);
        });

        // Mark both present today
        emergencyService.toggleWorkerAttendance(plumberUser.getId(), "checkin", "test-auto-tenant");
        emergencyService.toggleWorkerAttendance(electricUser.getId(), "checkin", "test-auto-tenant");
    }

    @Test
    @DisplayName("1. When Maintenance Team Head is Available, request remains in REQUESTED pool for manual review")
    void testTeamHeadAvailableManualPool() {
        emergencyService.setAdminDutyStatus("test-auto-tenant", "AVAILABLE");
        assertFalse(emergencyService.isMaintenanceAdminBusy("test-auto-tenant"));

        CommonMaintenanceTicket t = emergencyService.createAndRouteTicket(residentActor, "Fix Kitchen Tap",
                "Water dripping slowly", "Flat 401", "Chennai", "Plumbing", "MEDIUM", "9876543210");

        assertNotNull(t.getId());
        assertEquals("REQUESTED", t.getTicketStatus());
        assertNull(t.getVendorId());
    }

    @Test
    @DisplayName("2. When Maintenance Team Head is Busy, request is automatically assigned to available specialist")
    void testTeamHeadBusyAutoAssignsSpecialist() {
        emergencyService.setAdminDutyStatus("test-auto-tenant", "BUSY");
        assertTrue(emergencyService.isMaintenanceAdminBusy("test-auto-tenant"));

        CommonMaintenanceTicket t = emergencyService.createAndRouteTicket(residentActor, "Leaking Pipe Under Sink",
                "Heavy leak", "Flat 402", "Chennai", "Plumbing", "HIGH", "9876543210");

        assertNotNull(t.getId());
        assertEquals("ASSIGNED", t.getTicketStatus());
        assertNotNull(t.getVendorId());
        assertEquals(plumberUser.getId(), t.getVendorId());
        assertTrue(t.getVendorNotes().contains("Auto-assigned"));
    }

    @Test
    @DisplayName("3. Multi-Factor Attendance Check: Absent or checked-out worker is skipped")
    void testAttendanceFilterSkipsCheckedOutWorker() {
        emergencyService.setAdminDutyStatus("test-auto-tenant", "BUSY");

        // Check out plumber
        emergencyService.toggleWorkerAttendance(plumberUser.getId(), "checkout", "test-auto-tenant");
        assertFalse(emergencyService.isWorkerPresentToday(plumberUser.getId(), "test-auto-tenant"));
        assertTrue(emergencyService.isWorkerPresentToday(electricUser.getId(), "test-auto-tenant"));

        // Route plumbing request: plumber is checked out, so fallback eligible worker (electrician/general staff) is selected
        Optional<AppUser> selected = emergencyService.findFreeMaintenanceWorker("test-auto-tenant", "Plumbing");
        assertTrue(selected.isPresent());
        assertNotEquals(plumberUser.getId(), selected.get().getId(), "Checked-out worker must not be chosen");

        // Re-check-in plumber
        emergencyService.toggleWorkerAttendance(plumberUser.getId(), "checkin", "test-auto-tenant");
        assertTrue(emergencyService.isWorkerPresentToday(plumberUser.getId(), "test-auto-tenant"));
    }

    @Test
    @DisplayName("4. Multi-Factor Workload Check: Free worker (0 tasks) is prioritized over busy worker")
    void testWorkloadPrioritizesFreeWorker() {
        emergencyService.setAdminDutyStatus("test-auto-tenant", "BUSY");

        // Give plumber an active ticket so load = 1
        CommonMaintenanceTicket busyTicket = new CommonMaintenanceTicket();
        busyTicket.setTenantId("test-auto-tenant");
        busyTicket.setSourcePlatform("smartsociety");
        busyTicket.setTitle("Active Plumbing Task");
        busyTicket.setServiceType("Plumbing");
        busyTicket.setVendorId(plumberUser.getId());
        busyTicket.setTicketStatus("IN_PROGRESS");
        busyTicket.setTargetEntityType("GENERAL");
        ticketRepo.save(busyTicket);

        // Electrician has 0 tasks (Free Now)
        assertEquals(1, emergencyService.getWorkerActiveWorkload(plumberUser.getId(), null));
        assertEquals(0, emergencyService.getWorkerActiveWorkload(electricUser.getId(), null));
        assertTrue(emergencyService.isWorkerFreeNow(electricUser.getId(), null));

        // For a general electrical request, free electrician is chosen
        Optional<AppUser> freeWorker = emergencyService.findFreeMaintenanceWorker("test-auto-tenant", "Electrical");
        assertTrue(freeWorker.isPresent());
        assertEquals(electricUser.getId(), freeWorker.get().getId());
    }

    @Test
    @DisplayName("5. 10-Minute SLA Rule: Unassigned queued tickets pending >= 10m are auto-escalated and assigned")
    void testTenMinuteSlaAutoAssignsQueuedTickets() {
        emergencyService.setAdminDutyStatus("test-auto-tenant", "AVAILABLE");

        // Create an unassigned ticket created 12 minutes ago
        CommonMaintenanceTicket oldTicket = new CommonMaintenanceTicket();
        oldTicket.setTenantId("test-auto-tenant");
        oldTicket.setSourcePlatform("smartsociety");
        oldTicket.setTitle("Emergency Circuit Breaker Tripped");
        oldTicket.setServiceType("Electrical");
        oldTicket.setTicketStatus("REQUESTED");
        oldTicket.setTargetEntityType("GENERAL");
        oldTicket.setCreatedAt(LocalDateTime.now().minusMinutes(12));
        CommonMaintenanceTicket saved = ticketRepo.save(oldTicket);

        // Run auto-assignment queue processor
        List<CommonMaintenanceTicket> assigned = emergencyService.processMaintenanceQueueAndAutoAssign("test-auto-tenant");

        assertFalse(assigned.isEmpty());
        CommonMaintenanceTicket reloaded = ticketRepo.findById(saved.getId()).orElseThrow();
        assertEquals("ASSIGNED", reloaded.getTicketStatus());
        assertNotNull(reloaded.getVendorId());
        assertTrue(reloaded.getVendorNotes().contains("10-minute SLA") || reloaded.getVendorNotes().contains("Auto-assigned"));
    }

    @Test
    @DisplayName("6. Workers Status API returns attendance, active workload, and free-now state")
    void testWorkersStatusList() {
        List<Map<String, Object>> statusList = emergencyService.getWorkersStatusList("test-auto-tenant");
        assertNotNull(statusList);
        assertFalse(statusList.isEmpty());

        Map<String, Object> plumberStatus = statusList.stream()
                .filter(m -> plumberUser.getId().equals(m.get("id")))
                .findFirst().orElseThrow();

        assertTrue(plumberStatus.containsKey("presentToday"));
        assertTrue(plumberStatus.containsKey("activeWorkload"));
        assertTrue(plumberStatus.containsKey("isFreeNow"));
        assertEquals("Plumber", plumberStatus.get("designation"));
    }
}
