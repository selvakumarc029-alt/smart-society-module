package com.smartapartment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class WorkerAttendanceIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private WorkerAttendanceRepository attendanceRepository;

    @Autowired
    private WorkerAvailabilityRepository availabilityRepository;

    @Autowired
    private MaintenanceRequestRepository requestRepository;

    private AppUser workerUser;
    private AppUser managerUser;
    private MockHttpSession workerSession;
    private MockHttpSession managerSession;

    @BeforeEach
    void setUp() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        String workerEmail = "worker_" + unique + "@smartsociety.test";
        String managerEmail = "manager_" + unique + "@smartsociety.test";

        workerUser = new AppUser();
        workerUser.setEmail(workerEmail);
        workerUser.setFullName("Rahul Plumber");
        workerUser.setDesignation("Plumber");
        workerUser.setWorkShift("General Shift");
        workerUser.setEmployeeId("EMP-" + unique);
        workerUser.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
        String tenantId = "society-" + unique;
        workerUser.setRole(UserRole.MAINTENANCE_STAFF);
        workerUser.setTenantId(tenantId);
        workerUser = userRepository.save(workerUser);

        managerUser = new AppUser();
        managerUser.setEmail(managerEmail);
        managerUser.setFullName("Suresh Manager");
        managerUser.setDesignation("Maintenance Supervisor");
        managerUser.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
        managerUser.setRole(UserRole.MAINTENANCE_STAFF);
        managerUser.setTenantId(tenantId);
        managerUser = userRepository.save(managerUser);

        workerSession = new MockHttpSession();
        workerSession.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);

        managerSession = new MockHttpSession();
        managerSession.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);
    }

    @Test
    void testClockInClockOutLifecycle() throws Exception {
        // 1. Clock In
        mvc.perform(post("/api/workers/attendance/clock-in")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shiftId\": \"MORNING\", \"notes\": \"Started on time\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value(workerUser.getId()))
                .andExpect(jsonPath("$.attendanceStatus", anyOf(is("PRESENT"), is("LATE"))))
                .andExpect(jsonPath("$.clockIn").isNotEmpty())
                .andExpect(jsonPath("$.clockOut").isEmpty());

        // Check availability is now AVAILABLE
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));

        // 2. Clock Out
        mvc.perform(post("/api/workers/attendance/clock-out")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\": \"Shift complete\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clockOut").isNotEmpty())
                .andExpect(jsonPath("$.totalWorkingMinutes").isNumber());

        // Check availability is now OFFLINE
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OFFLINE"));
    }

    @Test
    void testBreakLifecycle() throws Exception {
        // Clock in first
        mvc.perform(post("/api/workers/attendance/clock-in")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // Start Break
        mvc.perform(post("/api/workers/attendance/break-start")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\": \"Lunch break\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.breakStart").isNotEmpty())
                .andExpect(jsonPath("$.breakEnd").isEmpty());

        // Availability must be ON_BREAK
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ON_BREAK"));

        // End Break
        mvc.perform(post("/api/workers/attendance/break-end")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.breakEnd").isNotEmpty());

        // Availability must return to AVAILABLE
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    void testDashboardSummaryAndWorkingHours() throws Exception {
        // Clock in
        mvc.perform(post("/api/workers/attendance/clock-in")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // Get summary
        mvc.perform(get("/api/workers/dashboard-summary")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendance").isNotEmpty())
                .andExpect(jsonPath("$.availability.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.workingHours").isNotEmpty())
                .andExpect(jsonPath("$.workingHours.todayFormatted").isNotEmpty())
                .andExpect(jsonPath("$.workingHours.weeklyFormatted").isNotEmpty())
                .andExpect(jsonPath("$.workingHours.monthlyFormatted").isNotEmpty());
    }

    @Test
    void testAutoAssignmentAndAvailabilitySynchronization() throws Exception {
        // Create a maintenance request in "Plumbing"
        MaintenanceRequest req = new MaintenanceRequest();
        req.setRequestNumber("MR-2026-TEST01");
        req.setTenantId(workerUser.getTenantId());
        req.setCategory("Plumbing");
        req.setServiceType("Leakage");
        req.setTitle("Bathroom Pipe Burst");
        req.setDescription("Water leakage under floor");
        req.setPriority("HIGH");
        req.setRequestStatus("REQUESTED");
        req.setApartmentUnit("B-204");
        req.setResidentId(1L);
        req.setPreferredDate(LocalDate.now());
        req = requestRepository.save(req);

        // Before clock-in: worker is OFFLINE -> auto-assign should fail (404)
        mvc.perform(post("/api/workers/auto-assign/" + req.getId())
                        .with(user(managerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(managerSession))
                .andExpect(status().isNotFound());

        // Now worker clocks in
        mvc.perform(post("/api/workers/attendance/clock-in")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"shiftId\": \"GENERAL\"}"))
                .andExpect(status().isOk());

        // Auto-assign should now succeed!
        mvc.perform(post("/api/workers/auto-assign/" + req.getId())
                        .with(user(managerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(managerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignedWorkerName").value(workerUser.getFullName()));

        // Worker availability must now be BUSY with currentTaskId = req.getId()
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BUSY"))
                .andExpect(jsonPath("$.currentTaskId").value(req.getId()));

        // When request is updated to COMPLETED by staff -> Worker availability becomes AVAILABLE
        mvc.perform(put("/api/maintenance/requests/" + req.getId())
                        .with(user(managerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(managerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Worker availability must have returned to AVAILABLE
        mvc.perform(get("/api/workers/" + workerUser.getId() + "/availability")
                        .with(user(workerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.currentTaskId").isEmpty());
    }

    @Test
    void testManagerAttendanceRoster() throws Exception {
        mvc.perform(get("/api/workers/attendance")
                        .with(user(managerUser.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(managerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[?(@.workerId == " + workerUser.getId() + ")].workerName").value(hasItem(workerUser.getFullName())))
                .andExpect(jsonPath("$[?(@.workerId == " + workerUser.getId() + ")].department").value(hasItem("Plumber")));
    }
}
