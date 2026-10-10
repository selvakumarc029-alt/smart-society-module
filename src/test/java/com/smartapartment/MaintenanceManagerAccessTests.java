package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MaintenanceManagerAccessTests {
    private final MaintenanceRequestRepository requests = mock(MaintenanceRequestRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final MaintenanceManagerService service = new MaintenanceManagerService(requests,
            mock(MaintenanceStatusHistoryRepository.class), mock(WorkerAvailabilityRepository.class),
            mock(WorkerAttendanceRepository.class), users, mock(NotificationRepository.class),
            mock(MaintenanceTrackingService.class), mock(AutoAssignmentService.class));

    private AppUser account(String designation) {
        AppUser user = new AppUser();
        user.setEmail("person@example.test"); user.setRole(UserRole.MAINTENANCE_STAFF);
        user.setDesignation(designation); user.setTenantId("society-a");
        return user;
    }

    @Test void maintenanceLeadCanLoadSummaryAndQueueOnlyForTheirSociety() {
        when(requests.findByTenantIdOrderByCreatedAtDesc("society-a")).thenReturn(List.of());
        when(users.findAll()).thenReturn(List.of());
        assertEquals(0, service.getDashboardSummary(account("Maintenance Lead")).totalRequests());
        assertTrue(service.getQueue(account("Maintenance Manager"), null).isEmpty());
        verify(requests, times(2)).findByTenantIdOrderByCreatedAtDesc("society-a");
        verify(requests, never()).findAllByOrderByCreatedAtDesc();
    }

    @Test void ordinaryWorkerAndResidentCannotLoadManagerBoard() {
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.getDashboardSummary(account("Plumber"))).getStatusCode().value());
        AppUser resident = account("Maintenance Lead"); resident.setRole(UserRole.RESIDENT);
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.getDashboardSummary(resident)).getStatusCode().value());
        verifyNoInteractions(requests);
    }

    @Test void defaultMaintenanceLeadMatchesDashboardLoginRules() {
        AppUser lead = account(null); lead.setEmail("maintenance@smartsociety");
        when(requests.findByTenantIdOrderByCreatedAtDesc("society-a")).thenReturn(List.of());
        when(users.findAll()).thenReturn(List.of());
        assertNotNull(service.getDashboardSummary(lead));
    }
}
