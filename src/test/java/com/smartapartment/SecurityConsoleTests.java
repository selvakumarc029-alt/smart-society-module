package com.smartapartment;

import com.fasterxml.jackson.databind.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:security-console-tests;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop","SEED_DEMO_ACCOUNTS=false","app.jwt.secret=security_console_test_secret_at_least_32_bytes_long"})
@AutoConfigureMockMvc
class SecurityConsoleTests {
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper json;
 @Autowired AppUserRepository users;
 @Autowired GateRepository gates;
 @Autowired VisitorRepository visitors;
 @Autowired ResidentRepository residents;
 @Autowired ApartmentRepository apartments;
 @Autowired SecurityConsolePassRepository passes;
 @Autowired SecurityConsoleEventRepository events;
 @Autowired SecurityGateAssignmentRepository assignments;
 String tenant,email; Gate one,two; Resident resident; MockHttpSession session; String token;

 @BeforeEach void setup() throws Exception {
  tenant="console-"+UUID.randomUUID(); email=tenant+"@test.local";
  AppUser guard=new AppUser();guard.setTenantId(tenant);guard.setEmail(email);guard.setFullName("Test Guard");guard.setPasswordHash("unused");guard.setRole(UserRole.SECURITY_STAFF);users.save(guard);
  AppUser occupant=new AppUser();occupant.setTenantId(tenant);occupant.setEmail("resident-"+email);occupant.setFullName("Test Resident");occupant.setPasswordHash("unused");occupant.setRole(UserRole.RESIDENT);users.save(occupant);
  Apartment flat=new Apartment();flat.setTenantId(tenant);flat.setUnitNo("A-101");apartments.save(flat);
  resident=new Resident();resident.setTenantId(tenant);resident.setApartment(flat);resident.setUser(occupant);residents.save(resident);
  one=gate("Gate 1");two=gate("Gate 2");session=new MockHttpSession();select(one);
 }
 Gate gate(String number){Gate g=new Gate();g.setTenantId(tenant);g.setGateNumber(number);g.setGateName("Entrance "+number);g.setGateType("BOTH");return gates.save(g);}
 Visitor visitor(Gate gate){Visitor v=new Visitor();v.setTenantId(tenant);v.setResident(resident);v.setVisitorName("Test Visitor");v.setVisitorPhone("9876543210");v.setVehicleNumber("KA01AB1234");v.setPurpose("Guest visit");v.setExpectedAt(LocalDateTime.now().minusMinutes(5));v.setApprovalStatus("APPROVED");v.setStatus("EXPECTED");v.setEntryGate(gate);v.setGateNumber(gate.getGateNumber());v.setPassNumber("TEST-"+UUID.randomUUID().toString().substring(0,12));return visitors.save(v);}
 ResultActions call(String path,Object body)throws Exception{return mvc.perform(post("/api/society/security-console"+path).with(user(email).roles("SECURITY_STAFF")).session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));}
 JsonNode result(ResultActions action)throws Exception{return json.readTree(action.andReturn().getResponse().getContentAsString());}
 void select(Gate gate)throws Exception{token=result(call("/session",Map.of("gateId",gate.getId())).andExpect(status().isOk())).get("token").asText();}
 ResultActions action(Visitor v,String action)throws Exception{return call("/action",Map.of("visitorId",v.getId(),"action",action,"token",token));}

 @Test void residentDecisionControlsSecurityEntry()throws Exception{
  Visitor approved=visitor(one);approved.setApprovalStatus("PENDING");approved.setStatus("PENDING_APPROVAL");visitors.save(approved);
  action(approved,"ENTRY").andExpect(status().isConflict());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/society/gate-entries/"+approved.getId()+"/approve")
   .with(user(resident.getUser().getEmail()).roles("RESIDENT"))).andExpect(status().isOk());
  action(approved,"ENTRY").andExpect(status().isOk());
  Visitor rejected=visitor(one);rejected.setApprovalStatus("PENDING");rejected.setStatus("PENDING_APPROVAL");visitors.save(rejected);
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/society/gate-entries/"+rejected.getId()+"/reject")
   .with(user(resident.getUser().getEmail()).roles("RESIDENT"))).andExpect(status().isOk());
  action(rejected,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("PASS_REJECTED")));
  assertNull(visitors.findById(rejected.getId()).orElseThrow().getCheckInAt());
 }
 @Test void wrongGateIsDeniedAndAuditSurvives()throws Exception{
  Visitor v=visitor(one);select(two);
  action(v,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("GATE_MISMATCH_ERROR: Re-route to Gate 1"));
  assertNull(visitors.findById(v.getId()).orElseThrow().getCheckInAt());
  assertEquals("DENIED",events.findTop200ByTenantIdOrderByIdDesc(tenant).getFirst().getEventType());
 }
 @Test void duplicateEntryBlockedAndDifferentGateExitClosesJourney()throws Exception{
  Visitor v=visitor(one);action(v,"ENTRY").andExpect(status().isOk());select(two);
  action(v,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("ANTI_PASSBACK")));
  action(v,"EXIT").andExpect(status().isOk()).andExpect(jsonPath("$.entryGate").value("Gate 1")).andExpect(jsonPath("$.exitGate").value("Gate 2"));
  action(v,"EXIT").andExpect(status().isConflict());select(one);action(v,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("PASS_CONSUMED")));
 }
 @Test void lockdownBlocksEntryButAllowsExitAndGuardCannotRelease()throws Exception{
  Visitor inside=visitor(one);action(inside,"ENTRY").andExpect(status().isOk());Visitor waiting=visitor(one);
  call("/lockdown",Map.of("enabled",true,"reason","Test emergency","token",token)).andExpect(status().isOk());
  action(waiting,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("LOCKDOWN")));
  action(inside,"EXIT").andExpect(status().isOk());call("/lockdown",Map.of("enabled",false,"reason","Test release","token",token)).andExpect(status().isBadRequest());
 }
 @Test void pendingApprovalAndWatchlistCannotBeBypassed()throws Exception{
  Visitor v=visitor(one);v.setApprovalStatus("PENDING");v=visitors.save(v);action(v,"ENTRY").andExpect(status().isConflict());
  call("/action",Map.of("visitorId",v.getId(),"action","OVERRIDE","reason","RESIDENT_ESCORT","token",token)).andExpect(status().isBadRequest());
  call("/watchlist",Map.of("type","VEHICLE","value","KA 01 AB 1234","reason","Test restriction","token",token)).andExpect(status().isOk());
  v.setApprovalStatus("APPROVED");visitors.save(v);action(v,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("FLAG DETECTED")));
 }
 @Test void tenantAndTerminalBindingsAreEnforced()throws Exception{
  Visitor v=visitor(one);call("/action",Map.of("visitorId",v.getId(),"action","ENTRY","token","forged-token")).andExpect(status().isBadRequest());
  Gate foreign=new Gate();foreign.setTenantId("other-tenant");foreign.setGateName("Other");foreign.setGateNumber("Other Gate");gates.save(foreign);
  call("/session",Map.of("gateId",foreign.getId())).andExpect(status().isBadRequest());
  String old=token;select(two);call("/action",Map.of("visitorId",v.getId(),"action","ENTRY","token",old)).andExpect(status().isBadRequest());
 }
 @Test void expiredPassAndSignedQrValidation()throws Exception{
  JsonNode issued=result(call("/passes",Map.of("name","QR Visitor","phone","1234567890","purpose","Visit","category","GUEST","residentId",resident.getId(),"gateId",one.getId(),"hours",4,"token",token)).andExpect(status().isOk()));
  String qr=issued.get("dynamic_qr_token").asText();String pin=issued.get("passcode_pin").asText();assertTrue(pin.matches("[0-9]{6}"));assertTrue(issued.get("qr_image").asText().startsWith("data:image/png;base64,"));
  Visitor v=visitors.findById(issued.get("visitor").get("id").asLong()).orElseThrow();v.setApprovalStatus("APPROVED");visitors.save(v);
  call("/verify",Map.of("query",qr,"mode","QR","direction","ENTRY","token",token)).andExpect(status().isOk());
  call("/verify",Map.of("query",qr+"bad","mode","QR","direction","ENTRY","token",token)).andExpect(status().isConflict());
  call("/verify",Map.of("query",pin,"mode","PIN","direction","ENTRY","token",token)).andExpect(status().isOk());
  SecurityConsolePass pass=passes.findById(issued.get("pass_id").asLong()).orElseThrow();pass.setValidUntil(LocalDateTime.now().minusSeconds(1));passes.save(pass);
  action(v,"ENTRY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("PASS_EXPIRED")));
 }
 @Test void inactiveAssignmentCannotStartDesk()throws Exception{
  SecurityGateAssignment a=new SecurityGateAssignment();a.setTenantId(tenant);a.setSecurityGuard(users.findByEmail(email).orElseThrow());a.setGate(one);a.setStatus("INACTIVE");assignments.save(a);
  call("/session",Map.of("gateId",one.getId())).andExpect(status().isBadRequest());
 }
 @Test void snapshotAndIncidentAreTenantScoped()throws Exception{
  call("/incidents",Map.of("severity","HIGH","details","Test incident with factual detail","token",token)).andExpect(status().isOk());
  mvc.perform(get("/api/society/security-console/snapshot").with(user(email).roles("SECURITY_STAFF")).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.gates.length()").value(2)).andExpect(jsonPath("$.events[0].details").value("Test incident with factual detail"));
  mvc.perform(get("/api/society/security-console/snapshot").with(user(email).roles("RESIDENT"))).andExpect(status().isForbidden());
 }
 @Test void securityStaffCannotBypassPolicyUsingLegacyRoutes()throws Exception{
  Visitor v=visitor(one);
  mvc.perform(patch("/api/society/gate-entries/"+v.getId()+"/entry").with(user(email).roles("SECURITY_STAFF")).contentType(MediaType.APPLICATION_JSON).content("{\"gateId\":"+one.getId()+"}")).andExpect(status().isForbidden());
  mvc.perform(post("/api/society/visitors/scan").with(user(email).roles("SECURITY_STAFF")).contentType(MediaType.APPLICATION_JSON).content("{\"qrCode\":\"legacy\"}")).andExpect(status().isForbidden());
 }
}
