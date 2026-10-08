package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:flat_invoice_test;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop", "SEED_DEMO_ACCOUNTS=false"})
@org.springframework.test.context.TestExecutionListeners(listeners={org.springframework.test.context.support.DependencyInjectionTestExecutionListener.class,org.springframework.security.test.context.support.WithSecurityContextTestExecutionListener.class},mergeMode=org.springframework.test.context.TestExecutionListeners.MergeMode.REPLACE_DEFAULTS)
@AutoConfigureMockMvc
class AdminInsightsIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @Autowired ApartmentRepository apartments; @Autowired BlockRepository blocks;
    @Autowired ResidentRepository residents; @Autowired AppUserRepository users;
    @Autowired TenantRepository tenants; @Autowired MaintenanceBillRepository bills;
    @Autowired PaymentRepository payments; @Autowired NotificationRepository notifications;
    @Autowired WorkerAttendanceRepository attendance; @Autowired SocietyWorkerBreakRepository breaks;
    @Autowired SecurityAccessLogRepository securityLogs;
    String tenant,admin,first,roommate,neighbour; Apartment flat,empty,foreign;
    @BeforeEach void seed(){
        tenant="insights-"+UUID.randomUUID();for(String id:List.of(tenant,tenant+"-other")){var t=new Tenant();t.setTenantId(id);t.setCode(id);t.setSocietyName(id);t.setApproved(true);tenants.save(t);}
        var b=new Block();b.setTenantId(tenant);b.setName("Block A");b=blocks.save(b);
        flat=flat(tenant,"A-101",b);empty=flat(tenant,"A-102",b);foreign=flat(tenant+"-other","A-101",null);
        admin=account("admin",UserRole.SOCIETY_ADMIN,null);first=account("first",UserRole.RESIDENT,flat);roommate=account("roommate",UserRole.RESIDENT,flat);neighbour=account("neighbour",UserRole.RESIDENT,empty);
    }
    Apartment flat(String t,String number,Block b){var a=new Apartment();a.setTenantId(t);a.setUnitNo(number);a.setUnitType("1BHK");a.setBlock(b);a.setMonthlyMaintenance(new BigDecimal("1800"));return apartments.save(a);}
    String account(String prefix,UserRole role,Apartment apartment){var u=new AppUser();u.setTenantId(tenant);u.setEmail(prefix+"-"+tenant+"@test.local");u.setFullName(prefix);u.setPasswordHash("unused");u.setRole(role);u=users.save(u);if(apartment!=null){var r=new Resident();r.setTenantId(tenant);r.setUser(u);r.setApartment(apartment);r.setResidentType("TENANT");residents.save(r);}return u.getEmail();}
    MaintenanceBill bill(){var b=new MaintenanceBill();b.setTenantId(tenant);b.setApartment(flat);b.setBillMonth("2026-10");b.setTotalAmount(new BigDecimal("300"));b.setPaymentStatus("UNPAID");b.setDueDate(LocalDate.now().minusDays(2));return bills.save(b);}
    @Test void blockCountsCountFlatsOnceAndExcludeOtherSocieties()throws Exception{
        var r=residents.findByTenantIdOrderByIdAsc(tenant).stream().filter(x->x.getUser().getEmail().equals(neighbour)).findFirst().orElseThrow();r.getUser().setAccountLocked(true);users.save(r.getUser());
        mvc.perform(get("/api/society/admin-insights/occupancy").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.totalTenants").value(2)).andExpect(jsonPath("$.blocks[0].filled").value(1)).andExpect(jsonPath("$.blocks[0].available").value(1)).andExpect(jsonPath("$.flats.length()").value(2));
    }
    @Test void partialPaymentsAndNoticesStayWithinTheChosenFlatAndDeduplicate()throws Exception{
        var b=bill();var p=new Payment();p.setTenantId(tenant);p.setBill(b);p.setAmount(new BigDecimal("100"));p.setPaymentStatus("SUCCESS");payments.save(p);
        mvc.perform(get("/api/society/admin-insights/billing").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(jsonPath("$.pending").value(200)).andExpect(jsonPath("$.overdue").value(200));
        mvc.perform(post("/api/society/admin-insights/dues/"+flat.getId()+"/notice").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.sent").value(2));
        for(String email:List.of(first,roommate)){var u=users.findByEmail(email).orElseThrow();assertEquals(1,notifications.findByTenantIdAndUserIdOrderByCreatedAtDesc(tenant,u.getId()).size());}
        assertTrue(notifications.findByTenantIdAndUserIdOrderByCreatedAtDesc(tenant,users.findByEmail(neighbour).orElseThrow().getId()).isEmpty());
        mvc.perform(post("/api/society/admin-insights/dues/"+flat.getId()+"/notice").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(jsonPath("$.sent").value(0));
        mvc.perform(post("/api/society/admin-insights/dues/"+foreign.getId()+"/notice").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isNotFound());
        b.setPaymentStatus("PAID");bills.save(b);mvc.perform(post("/api/society/admin-insights/dues/"+flat.getId()+"/notice").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isConflict());
    }
    @Test void onlySocietyAdminCanReadOrModifyInsights()throws Exception{
        for(String path:List.of("occupancy","maintenance","security","billing"))mvc.perform(get("/api/society/admin-insights/"+path).with(user(first).roles("RESIDENT"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/society/admin-insights/dues/"+flat.getId()+"/notice").with(user(first).roles("RESIDENT"))).andExpect(status().isForbidden());
    }
    @Test void rentHistoryIsSeparateAndRejectsStaleAndForeignUpdates()throws Exception{
        var request=new LinkedHashMap<String,Object>();request.put("currentRent",9000);request.put("newRent",10000);request.put("effectiveDate",LocalDate.now().plusDays(10).toString());request.put("landlordName","Landlord");
        String url="/api/society/admin-insights/rents/"+flat.getId();
        mvc.perform(post(url).with(user(admin).roles("SOCIETY_ADMIN")).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isOk());
        assertEquals(0,new BigDecimal("1800").compareTo(apartments.findById(flat.getId()).orElseThrow().getMonthlyMaintenance()));assertTrue(bills.findByTenantIdOrderByDueDateDesc(tenant).isEmpty());
        mvc.perform(get("/api/society/admin-insights/billing").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(jsonPath("$.rents[0].monthlyRent").value(10000));
        mvc.perform(post(url).with(user(admin).roles("SOCIETY_ADMIN")).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isConflict());
        mvc.perform(post("/api/society/admin-insights/rents/"+foreign.getId()).with(user(admin).roles("SOCIETY_ADMIN")).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isNotFound());
    }
    @Test void maintenanceReportSumsMultipleBreaksAndRejectsOversizedDateRange()throws Exception{
        String email=account("worker",UserRole.MAINTENANCE_STAFF,null);var worker=users.findByEmail(email).orElseThrow();var a=new WorkerAttendance();a.setTenantId(tenant);a.setWorkerId(worker.getId());a.setDate(LocalDate.now());a.setClockIn(LocalDate.now().atTime(9,0));a.setClockOut(LocalDate.now().atTime(17,0));a.setAttendanceStatus("CLOCKED_OUT");a=attendance.save(a);
        for(int minute:List.of(15,30)){var b=new SocietyWorkerBreak();b.setTenantId(tenant);b.setAttendanceId(a.getId());b.setWorkerId(worker.getId());b.setStartedAt(LocalDate.now().atTime(12,0));b.setEndedAt(b.getStartedAt().plusMinutes(minute));breaks.save(b);}
        mvc.perform(get("/api/society/admin-insights/maintenance").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.attendance[0].breakMinutes").value(45)).andExpect(jsonPath("$.attendance[0].workingMinutes").value(435));
        mvc.perform(get("/api/society/admin-insights/maintenance").param("start","2026-01-01").param("end","2026-03-01").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isBadRequest());
    }
    @Test void securityAccessRecordsOneLoginPerSessionAndExplicitLogout()throws Exception{
        String email=account("guard",UserRole.SECURITY_STAFF,null);var session=new MockHttpSession();session.setAttribute("dashboard:smartapartment:security",true);
        mvc.perform(get("/dashboards/security").session(session).with(user(email).roles("SECURITY_STAFF"))).andExpect(status().isOk());
        mvc.perform(get("/dashboards/security").session(session).with(user(email).roles("SECURITY_STAFF"))).andExpect(status().isOk());
        var logs=securityLogs.findByTenantIdAndLoginAtBetweenOrderByLoginAtDesc(tenant,LocalDate.now().atStartOfDay(),LocalDate.now().atTime(LocalTime.MAX));assertEquals(1,logs.size());assertNull(logs.getFirst().getLogoutAt());
        mvc.perform(get("/dashboards/logout").session(session).with(user(email).roles("SECURITY_STAFF"))).andExpect(status().is3xxRedirection());
        assertEquals("SIGNED_OUT",securityLogs.findById(logs.getFirst().getId()).orElseThrow().getEndReason());
    }
    @Test void societyWorkerActionsSaveIndividualBreaksAndPreventResettingAttendance()throws Exception{
        String email=account("worker",UserRole.MAINTENANCE_STAFF,null);
        mvc.perform(post("/api/society/workforce/attendance/clock-in").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isOk());
        mvc.perform(post("/api/society/workforce/attendance/clock-in").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isConflict());
        for(int i=0;i<2;i++){mvc.perform(post("/api/society/workforce/attendance/break-start").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isOk());mvc.perform(post("/api/society/workforce/attendance/break-end").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isOk());}
        var worker=users.findByEmail(email).orElseThrow();var a=attendance.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(worker.getId(),LocalDate.now()).orElseThrow();assertEquals(2,breaks.findByTenantIdAndAttendanceIdOrderByStartedAtAsc(tenant,a.getId()).size());
        mvc.perform(post("/api/society/workforce/attendance/clock-out").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isOk());
        mvc.perform(post("/api/society/workforce/attendance/break-start").with(user(email).roles("MAINTENANCE_STAFF"))).andExpect(status().isConflict());
    }
}
