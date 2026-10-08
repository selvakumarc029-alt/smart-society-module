package com.smartapartment;

import com.smartapartment.controller.SocietyServiceTicketController;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CommonMaintenanceService;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import java.lang.reflect.Proxy;

class SocietyServiceTicketControllerTest {
    AppUser worker;
    CommonMaintenanceTicket ticket;
    int saves;
    List<CommonMaintenanceTicket> listed;
    AppUserRepository users = (AppUserRepository) Proxy.newProxyInstance(AppUserRepository.class.getClassLoader(), new Class<?>[]{AppUserRepository.class},
            (proxy, method, args) -> method.getName().equals("findByEmail") ? Optional.of(worker) : null);
    CommonMaintenanceTicketRepository tickets = (CommonMaintenanceTicketRepository) Proxy.newProxyInstance(CommonMaintenanceTicketRepository.class.getClassLoader(), new Class<?>[]{CommonMaintenanceTicketRepository.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "findById" -> Optional.of(ticket);
                case "findAll" -> listed;
                case "save" -> { saves++; yield args[0]; }
                default -> null;
            });
    CommonMaintenanceService service = new CommonMaintenanceService(tickets);
    SocietyServiceTicketController controller = new SocietyServiceTicketController(users, tickets, service);
    @BeforeEach void setup() {
        worker = new AppUser(); worker.setId(7L); worker.setTenantId("society-a");
        worker.setRole(UserRole.MAINTENANCE_STAFF); worker.setEmail("worker@example.com");

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(worker.getEmail(), "", List.of()));
        ticket = new CommonMaintenanceTicket(); ticket.setId(11L); ticket.setVersion(3L);
        ticket.setSourcePlatform("smartsociety"); ticket.setTenantId("society-a"); ticket.setVendorId(7L);
        ticket.setRequesterId(9L); ticket.setTicketStatus("REQUESTED"); ticket.setVendorNotes("Keep these notes");

    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private void rejected(int status, String value, Long version) {
        assertEquals(status, assertThrows(ResponseStatusException.class, () -> controller.update(11L,
                new SocietyServiceTicketController.WorkerStatusRequest(value, version))).getStatusCode().value());
        assertEquals(0, saves);
    }
    @Test void savedWorkerStatusIsOnTheResidentTicketAndPreservesAssignmentAndNotes() {
        controller.update(11L, new SocietyServiceTicketController.WorkerStatusRequest("IN_PROGRESS", 3L));
        assertEquals("IN_PROGRESS", ticket.getTicketStatus()); assertNotNull(ticket.getWorkStartedAt());
        controller.update(11L, new SocietyServiceTicketController.WorkerStatusRequest("RESOLVED", 3L));
        assertEquals("Completed", ticket.getWorkProgress()); assertNotNull(ticket.getResolvedAt());
        assertEquals(9L, ticket.getRequesterId()); assertEquals(7L, ticket.getVendorId());
        assertEquals("Keep these notes", ticket.getVendorNotes());
    }
    @Test void superAdminCannotUseWorkerStatusEndpoint() { worker.setRole(UserRole.SUPER_ADMIN); rejected(403,"RESOLVED",3L); }
    @Test void differentWorkerCannotUpdate() { ticket.setVendorId(8L); rejected(404,"RESOLVED",3L); }
    @Test void differentSocietyCannotUpdate() { ticket.setTenantId("society-b"); rejected(404,"RESOLVED",3L); }
    @Test void propertyDirectCannotBeUpdated() { ticket.setSourcePlatform("propertydirect"); rejected(404,"RESOLVED",3L); }
    @Test void stalePageCannotOverwriteNewerChange() { rejected(409,"RESOLVED",2L); }
    @Test void unsupportedStatusCannotBeSaved() { rejected(400,"INVOICED",3L); }
    @Test void cancelledTicketCannotBeReopened() { ticket.setTicketStatus("CANCELLED"); rejected(409,"PENDING",3L); }
    @Test void listOnlyShowsThisWorkersSocietyTickets() {
        var other = new CommonMaintenanceTicket(); other.setVendorId(7L); other.setSourcePlatform("propertydirect"); other.setTenantId("society-a");
        listed = List.of(ticket,other);
        assertEquals(List.of(ticket),controller.assignedTickets());
    }
}
