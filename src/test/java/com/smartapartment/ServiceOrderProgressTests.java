package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.EmergencyMaintenanceService;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class ServiceOrderProgressTests {
    final EmergencyMaintenanceBookingRepository bookings = mock(EmergencyMaintenanceBookingRepository.class);
    final MaintenancePartnerRepository partners = mock(MaintenancePartnerRepository.class);
    final AppUserRepository users = mock(AppUserRepository.class);
    final NotificationRepository notifications = mock(NotificationRepository.class);
    final EmergencyMaintenanceService service = new EmergencyMaintenanceService(bookings, mock(MaintenanceHubRepository.class), partners, users, mock(PropertyCustomerRepository.class), notifications, mock(AuditLogRepository.class), mock(CommonMaintenanceTicketRepository.class));
    EmergencyMaintenanceBooking booking() {
        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking(); b.setId(1L); b.setPartnerId(2L); b.setRequesterId(3L); b.setJobStatus("ACCEPTED"); b.setOrderReference("TEST-1"); b.setSourcePlatform("smartsociety");
        MaintenancePartner p = new MaintenancePartner(); p.setId(2L); p.setUserId(4L); p.setOnDuty(true); p.setWorkState("IDLE"); p.setTrade("Plumbing"); p.setAvailability("IDLE");
        when(partners.findById(2L)).thenReturn(Optional.of(p)); when(bookings.lockById(1L)).thenReturn(Optional.of(b)); when(bookings.findById(1L)).thenReturn(Optional.of(b)); return b;
    }
    @Test void onlyAssignedWorkerMayUpdate() {
        booking();
        for (var actor : List.of(new EmergencyMaintenanceService.Actor(3L,"smartsociety","t","Resident",false,false), new EmergencyMaintenanceService.Actor(9L,"smartsociety","t","Other worker",false,true), new EmergencyMaintenanceService.Actor(4L,"smartsociety","t","Admin",true,false))) {
            assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.transition(actor,1L,"EN_ROUTE")).getStatusCode().value());
        }
    }
    @Test void onTheWayRequiresAcceptanceAndNotifiesRequester() {
        var b=booking(); var worker=new EmergencyMaintenanceService.Actor(4L,"smartsociety","t","Worker",false,true);
        b.setJobStatus("OFFERED"); assertThrows(ResponseStatusException.class,()->service.transition(worker,1L,"EN_ROUTE"));
        b.setJobStatus("ACCEPTED"); service.transition(worker,1L,"EN_ROUTE"); assertEquals("EN_ROUTE",b.getJobStatus());
        verify(notifications).save(argThat(n->Objects.equals(n.getUserId(),3L) && "SERVICE_PROGRESS".equals(n.getType())));
        service.transition(worker,1L,"REACHED"); assertEquals("REACHED_LOCATION",b.getJobStatus());
    }
    @Test void unavailableOrLockedWorkerIsNotAssigned() {
        booking(); MaintenanceHub h=new MaintenanceHub();h.setId(10L);
        var p=partners.findById(2L).orElseThrow();when(partners.findByHubId(10L)).thenReturn(List.of(p));
        AppUser u=new AppUser();u.setId(4L);u.setWorkShift("ALL_DAY");when(users.findById(4L)).thenReturn(Optional.of(u));
        var b=bookings.findById(1L).orElseThrow();b.setCategory("Plumbing");b.setDeclinedPartnerIds(",");
        assertEquals(1,service.findEligiblePartners(b,h).size());
        int hour = java.time.LocalTime.now().getHour();
        u.setWorkShift(hour >= 6 && hour < 14 ? "NIGHT" : "MORNING");
        assertTrue(service.findEligiblePartners(b,h).isEmpty());
        u.setWorkShift("ALL_DAY");
        u.setAccountLocked(true);assertTrue(service.findEligiblePartners(b,h).isEmpty());
        u.setAccountLocked(false);p.setOnDuty(false);assertTrue(service.findEligiblePartners(b,h).isEmpty());
    }
    @Test void completedOrderCannotRestartAndReviewCannotPrecedeCompletion() {
        var b=booking();var worker=new EmergencyMaintenanceService.Actor(4L,"smartsociety","t","Worker",false,true);
        b.setJobStatus("COMPLETED");assertThrows(ResponseStatusException.class,()->service.transition(worker,1L,"EN_ROUTE"));
        b.setJobStatus("IN_PROGRESS");assertThrows(ResponseStatusException.class,()->service.review(new EmergencyMaintenanceService.Actor(3L,"smartsociety",null,"Resident",false,false),1L,5,"Good"));
    }
    @Test void futureAppointmentRemainsQueued() {
        var b=booking(); b.setPreferredDate(java.time.LocalDate.now().plusDays(1));
        service.dispatch(b); assertEquals("UNASSIGNED",b.getJobStatus()); verify(partners,never()).findByHubId(anyLong());
    }
    public static void main(String[] args) {
        new ServiceOrderProgressTests().onlyAssignedWorkerMayUpdate();
        new ServiceOrderProgressTests().onTheWayRequiresAcceptanceAndNotifiesRequester();
        new ServiceOrderProgressTests().unavailableOrLockedWorkerIsNotAssigned();
        new ServiceOrderProgressTests().completedOrderCannotRestartAndReviewCannotPrecedeCompletion();
        new ServiceOrderProgressTests().futureAppointmentRemainsQueued();
        System.out.println("5 service progress tests passed");
    }
}
