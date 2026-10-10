package com.smartapartment;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.EmergencyMaintenanceService;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class MaintenanceActorBoundaryTests {
 AppUserRepository users=mock(AppUserRepository.class);
 MaintenancePartnerRepository partners=mock(MaintenancePartnerRepository.class);
 EmergencyMaintenanceService service=new EmergencyMaintenanceService(mock(EmergencyMaintenanceBookingRepository.class),mock(MaintenanceHubRepository.class),partners,users,mock(PropertyCustomerRepository.class),mock(NotificationRepository.class),mock(AuditLogRepository.class));
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void dashboardFlagsCannotImpersonateAnySocietyAccount(){
  var session=new MockHttpSession();session.setAttribute("dashboard:smartapartment:resident",true);session.setAttribute("dashboard:smartapartment:superadmin",true);
  assertEquals(401,assertThrows(ResponseStatusException.class,()->service.actor(session,"smartsociety")).getStatusCode().value());
  verifyNoInteractions(users);
 }
 @Test void actualWorkerCannotGainAdminAccessFromAnotherTabsFlags(){
  AppUser worker=new AppUser();worker.setId(7L);worker.setEmail("worker@test.local");worker.setRole(UserRole.MAINTENANCE_STAFF);worker.setTenantId("society-a");worker.setFullName("Worker");
  when(users.findByEmail(worker.getEmail())).thenReturn(Optional.of(worker));
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(worker.getEmail(),null,List.of()));
  var session=new MockHttpSession();session.setAttribute("dashboard:smartapartment:maintenance",true);session.setAttribute("dashboard:propertydirect:admin",true);
  var actor=service.actor(session,"propertydirect");assertEquals("smartsociety",actor.platform());assertFalse(actor.admin());assertTrue(actor.worker());assertEquals(7L,actor.id());assertFalse(service.canAccessTenant(actor,"society-b"));
 }
 @Test void retryDoesNotOverwriteAnActiveOfferOrAssignAnotherPartner(){
  var booking=new EmergencyMaintenanceBooking();booking.setId(11L);booking.setJobStatus("OFFERED");booking.setPartnerId(20L);booking.setDeclinedPartnerIds(",");booking.setOfferSequence(1);
  service.dispatch(booking);assertEquals("OFFERED",booking.getJobStatus());assertEquals(20L,booking.getPartnerId());assertEquals(1,booking.getOfferSequence());
 }
 @Test void leadMayOperateOwnTechnicianAssignmentsOnlyWhenPartnerProfileExists(){
  AppUser lead=new AppUser();lead.setId(9L);lead.setEmail("lead@test.local");lead.setRole(UserRole.MAINTENANCE_STAFF);lead.setTenantId("society-a");lead.setDesignation("Maintenance supervisor");
  when(users.findByEmail(lead.getEmail())).thenReturn(Optional.of(lead));
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(lead.getEmail(),null,List.of()));
  var managerOnly=service.actor(new MockHttpSession(),"smartsociety");assertTrue(managerOnly.admin());assertFalse(managerOnly.worker());
  MaintenancePartner partner=new MaintenancePartner();partner.setId(90L);partner.setUserId(9L);when(partners.findByUserId(9L)).thenReturn(Optional.of(partner));
  var linked=service.actor(new MockHttpSession(),"smartsociety");assertTrue(linked.admin());assertTrue(linked.worker());assertFalse(service.canAccessTenant(linked,"other-society"));
 }
 @Test void societyAdminCannotReadAnotherSocietysMaintenance(){
  var actor=new EmergencyMaintenanceService.Actor(1L,"smartsociety","society-a","Admin",true,false);
  assertTrue(service.canAccessTenant(actor,"society-a"));assertFalse(service.canAccessTenant(actor,"society-b"));
 }
}
