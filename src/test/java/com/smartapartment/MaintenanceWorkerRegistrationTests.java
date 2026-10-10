package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:worker_registration;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop", "SEED_DEMO_ACCOUNTS=false"})
@AutoConfigureMockMvc
class MaintenanceWorkerRegistrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AppUserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired PasswordEncoder encoder;
    @Autowired WorkerAvailabilityRepository availability;
    @Autowired com.smartapartment.security.JwtService jwt;
    @Autowired ResidentRepository residents;
    @Autowired ComplaintRepository complaintRecords;
    @Autowired GateRepository gates;
    @Autowired ChatConversationRepository conversations;
    @Autowired ChatMessageRepository messages;
    @Autowired AuditLogRepository auditLogs;
    @Autowired @org.springframework.beans.factory.annotation.Qualifier("seedData")
    org.springframework.boot.CommandLineRunner seedData;

    @Test void emptyWorkspaceDoesNotSeedFabricatedChatActivity() {
        assertEquals(0,conversations.count());
        assertEquals(0,messages.count());
    }

    @Test void chatPersistsActualSenderAndRejectsOtherResidentsAndSocieties() throws Exception {
        String society="chat-"+UUID.randomUUID();
        AppUser owner=new AppUser();owner.setEmail(society+"@test.local");owner.setTenantId(society);owner.setFullName("Real resident");owner.setRole(UserRole.RESIDENT);owner.setPasswordHash("unused");owner=users.save(owner);
        AppUser other=new AppUser();other.setEmail("other-"+society+"@test.local");other.setTenantId(society);other.setFullName("Other resident");other.setRole(UserRole.RESIDENT);other.setPasswordHash("unused");users.save(other);
        AppUser outsider=new AppUser();outsider.setEmail("outside-"+society+"@test.local");outsider.setTenantId("other-society");outsider.setFullName("Other society administrator");outsider.setRole(UserRole.SOCIETY_ADMIN);outsider.setPasswordHash("unused");users.save(outsider);
        var actor=user(owner.getEmail()).roles("RESIDENT");
        String body="{\"ticketNumber\":\""+society+"\",\"channelType\":\"CUSTOMER_MAINTENANCE\",\"senderRole\":\"ADMIN\",\"senderName\":\"Fake admin\",\"senderEmail\":\"fake@test.local\",\"message\":\"Please check the repair\"}";
        String result=mvc.perform(post("/api/chat/send").with(actor).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.senderRole").value("CUSTOMER")).andExpect(jsonPath("$.senderName").value("Real resident")).andReturn().getResponse().getContentAsString();
        long conversationId=json.readTree(result).path("conversationId").asLong();
        try {
            mvc.perform(get("/api/chat/messages").param("conversationId",String.valueOf(conversationId)).with(actor)).andExpect(status().isOk()).andExpect(jsonPath("$[0].message").value("Please check the repair"));
            mvc.perform(get("/api/chat/messages").param("conversationId",String.valueOf(conversationId)).with(user(other.getEmail()).roles("RESIDENT"))).andExpect(status().isForbidden());
            mvc.perform(get("/api/chat/messages").param("conversationId",String.valueOf(conversationId)).with(user(outsider.getEmail()).roles("SOCIETY_ADMIN"))).andExpect(status().isForbidden());
            mvc.perform(get("/api/chat/threads").with(user(outsider.getEmail()).roles("SOCIETY_ADMIN"))).andExpect(jsonPath("$.length()").value(0));
            mvc.perform(post("/api/chat/send").with(user(other.getEmail()).roles("RESIDENT")).contentType("application/json").content(body)).andExpect(status().isForbidden());
            mvc.perform(post("/api/chat/send").with(actor).contentType("application/json").content(body.replace("CUSTOMER_MAINTENANCE","MAINTENANCE_ADMIN"))).andExpect(status().isForbidden());
        } finally { messages.deleteAll(messages.findByConversationIdOrderByCreatedAtAsc(conversationId));conversations.deleteById(conversationId); }
    }

    @Test void readingGatesNeverCreatesDemoGatesAndOptionsUseSavedConfiguration() throws Exception {
        String society="gates-"+UUID.randomUUID();
        AppUser admin=new AppUser();admin.setEmail(society+"@test.local");admin.setTenantId(society);
        admin.setFullName("Gate administrator");admin.setRole(UserRole.SOCIETY_ADMIN);admin.setPasswordHash("unused");users.save(admin);
        var actor=user(admin.getEmail()).roles("SOCIETY_ADMIN");
        mvc.perform(get("/api/society/gates").with(actor)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertTrue(gates.findByTenantIdOrderByGateNumberAsc(society).isEmpty());
        mvc.perform(get("/api/society/security/gates").with(actor)).andExpect(jsonPath("$.length()").value(0));
        Gate gate=new Gate();gate.setTenantId(society);gate.setGateNumber("North");gate.setGateName("North entrance");gate.setGateType("BOTH");gate.setStatus("ACTIVE");gates.save(gate);
        mvc.perform(get("/api/society/security/gates").with(actor)).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].value").value("North"));
        gate.setStatus("INACTIVE");gates.save(gate);
        mvc.perform(get("/api/society/security/gates").with(actor)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void restartingPreservesExistingSuperadminCredentialsAndLock() throws Exception {
        String email="superadmin@smartapartment";
        AppUser account=new AppUser();account.setEmail(email);account.setTenantId("platform");
        account.setFullName("Platform administrator");account.setRole(UserRole.SUPER_ADMIN);
        String hash=encoder.encode("ChangedPassword!2026");account.setPasswordHash(hash);
        account.setStatus("INACTIVE");account.setAccountLocked(true);account=users.save(account);
        try {
            seedData.run();
            AppUser reloaded=users.findById(account.getId()).orElseThrow();
            assertEquals(hash,reloaded.getPasswordHash());
            assertTrue(reloaded.isAccountLocked());
            assertEquals("INACTIVE",reloaded.getStatus());
            assertTrue(users.findByEmail("superadmin@smartsociety").isEmpty());
        } finally { users.deleteById(account.getId()); }
    }
    @Test void residentRosterSupportsProfilesAwaitingApartmentAssignment() throws Exception {
        String society="unassigned-flat-"+UUID.randomUUID();
        AppUser owner=new AppUser();owner.setTenantId(society);owner.setEmail(society+"@test.local");owner.setFullName("New resident");owner.setRole(UserRole.RESIDENT);owner.setPasswordHash("unused");owner=users.save(owner);
        Resident profile=new Resident();profile.setTenantId(society);profile.setUser(owner);profile.setResidentType("TENANT");residents.save(profile);
        AppUser admin=new AppUser();admin.setTenantId(society);admin.setEmail("admin-"+society+"@test.local");admin.setFullName("Administrator");admin.setRole(UserRole.SOCIETY_ADMIN);admin.setPasswordHash("unused");users.save(admin);
        mvc.perform(get("/api/society/residents").with(user(admin.getEmail()).roles("SOCIETY_ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("New resident")).andExpect(jsonPath("$[0].unitNo").value(""));
    }
    @Test void accountProfilePersistsWithoutAllowingWorkerSelfPromotion() throws Exception {
        String society="profile-"+UUID.randomUUID();AppUser worker=new AppUser();worker.setTenantId(society);worker.setEmail(society+"@test.local");worker.setFullName("Worker");worker.setDesignation("Plumber");worker.setRole(UserRole.MAINTENANCE_STAFF);worker.setPasswordHash("unused");worker=users.save(worker);
        var actor=user(worker.getEmail()).roles("MAINTENANCE_STAFF");
        mvc.perform(put("/api/society/me").with(actor).contentType("application/json").content("{\"name\":\"Updated worker\",\"phone\":\"9876543210\",\"designation\":\"Plumber\",\"address\":\"Tower B\",\"profileNotes\":\"Certified technician\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/society/me").with(actor)).andExpect(jsonPath("$.name").value("Updated worker")).andExpect(jsonPath("$.address").value("Tower B")).andExpect(jsonPath("$.profileNotes").value("Certified technician"));
        mvc.perform(put("/api/society/me").with(actor).contentType("application/json").content("{\"name\":\"Worker\",\"designation\":\"Maintenance Manager\"}")).andExpect(status().isForbidden());
        assertEquals("Plumber",users.findById(worker.getId()).orElseThrow().getDesignation());
    }
    @Test void platformSettingsPersistAndRejectOrdinaryAccounts() throws Exception {
        mvc.perform(put("/api/superadmin/security/config").with(user("worker@test.local").roles("MAINTENANCE_STAFF")).contentType("application/json").content("{\"supportEmail\":\"audit@test.local\"}")).andExpect(status().isForbidden());
        var admin=user("platform@test.local").roles("SUPER_ADMIN");
        mvc.perform(put("/api/superadmin/security/config").with(admin).contentType("application/json").content("{\"supportEmail\":\"audit@test.local\",\"sessionLimit\":\"8\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/superadmin/security/config").with(admin)).andExpect(jsonPath("$[?(@.configKey == 'supportEmail')].configValue").value(org.hamcrest.Matchers.hasItem("audit@test.local"))).andExpect(jsonPath("$[?(@.configKey == 'sessionLimit')].configValue").value(org.hamcrest.Matchers.hasItem("8")));
        mvc.perform(get("/api/superadmin/security/integrations").with(admin)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/superadmin/security/mfa-policy").param("requireMfaForAdmins","true").with(admin)).andExpect(status().isNotImplemented());
        AuditLog event=new AuditLog();event.setTenantId("platform");event.setModule("AUDIT_TEST");event.setAction("SETTINGS_REVIEWED");event.setDetails("Stored platform event");event=auditLogs.save(event);
        mvc.perform(get("/api/superadmin/security/audit-logs").with(admin)).andExpect(jsonPath("$[?(@.id == "+event.getId()+")].details").value(org.hamcrest.Matchers.hasItem("Stored platform event")));
    }
    @Test void workerComplaintUpdatesArePersistedAndVisibleOnlyToTheOwningResident() throws Exception {
        String society="complaint-"+UUID.randomUUID();
        AppUser owner=new AppUser();owner.setTenantId(society);owner.setEmail(society+"@example.test");owner.setFullName("Complaint owner");owner.setRole(UserRole.RESIDENT);owner.setPasswordHash("unused");owner=users.save(owner);
        Resident profile=new Resident();profile.setUser(owner);profile.setTenantId(society);profile.setResidentType("TENANT");profile=residents.save(profile);
        AppUser worker=new AppUser();worker.setTenantId(society);worker.setEmail(society+"-worker@example.test");worker.setFullName("Repair worker");worker.setRole(UserRole.MAINTENANCE_STAFF);worker.setPasswordHash("unused");worker=users.save(worker);
        Complaint ticket=new Complaint();ticket.setTenantId(society);ticket.setResident(profile);ticket.setTitle("AC repair");ticket.setCategory("AC Repair");ticket.setStatus("OPEN");ticket=complaintRecords.save(ticket);
        long id=ticket.getId();
        var staff=user(worker.getEmail()).roles("MAINTENANCE_STAFF");
        mvc.perform(get("/api/society/complaints").with(staff)).andExpect(jsonPath("$[?(@.id == "+id+")]").isEmpty());
        mvc.perform(patch("/api/society/complaints/"+id).with(staff).contentType("application/json").content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isForbidden());
        ticket.setAssignedTo("MAINTENANCE");ticket.setStatus("ASSIGNED");complaintRecords.save(ticket);
        mvc.perform(get("/api/society/complaints").with(staff)).andExpect(jsonPath("$[?(@.id == "+id+")]").isNotEmpty());
        mvc.perform(patch("/api/society/complaints/"+id).with(staff).contentType("application/json").content("{\"status\":\"IN_PROGRESS\",\"resolutionNotes\":\"Inspecting cooling unit\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/society/complaints").with(user(owner.getEmail()).roles("RESIDENT")))
                .andExpect(jsonPath("$[?(@.id == "+id+")].status").value(org.hamcrest.Matchers.hasItem("IN_PROGRESS")))
                .andExpect(jsonPath("$[?(@.id == "+id+")].resolutionNotes").value(org.hamcrest.Matchers.hasItem("Inspecting cooling unit")));
        mvc.perform(patch("/api/society/complaints/"+id).with(user(owner.getEmail()).roles("RESIDENT")).contentType("application/json").content("{\"status\":\"RESOLVED\"}")).andExpect(status().isForbidden());
        mvc.perform(patch("/api/society/complaints/"+id).with(staff).contentType("application/json").content("{\"status\":\"RESOLVED\",\"resolutionNotes\":\"Cooling restored\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/society/complaints").with(user(owner.getEmail()).roles("RESIDENT"))).andExpect(jsonPath("$[?(@.id == "+id+")].resolutionNotes").value(org.hamcrest.Matchers.hasItem("Cooling restored")));
    }
    @Test void maintenanceRequestsRequireActualAccountsAndPersistOnlyWithinTheirSociety() throws Exception {
        mvc.perform(get("/api/maintenance/requests")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/superadmin/analytics/data").with(user("resident@example.test").roles("RESIDENT"))).andExpect(status().isForbidden());
        String tenant="request-"+UUID.randomUUID();
        AppUser owner=new AppUser();owner.setTenantId(tenant);owner.setEmail(tenant+"@example.test");owner.setFullName("Request owner");owner.setRole(UserRole.RESIDENT);owner.setPasswordHash("unused");owner=users.save(owner);
        Resident profile=new Resident();profile.setUser(owner);profile.setTenantId(tenant);profile.setResidentType("TENANT");residents.save(profile);
        var actor=user(owner.getEmail()).roles("RESIDENT");
        String body="{\"category\":\"Plumbing\",\"serviceType\":\"Tap repair\",\"title\":\"Leaking tap\",\"description\":\"Tap will not close\",\"priority\":\"MEDIUM\"}";
        String saved=mvc.perform(post("/api/maintenance/requests").with(actor).contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(saved).path("id").asLong();
        mvc.perform(get("/api/maintenance/requests/"+id).with(actor)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Leaking tap"));
        mvc.perform(put("/api/maintenance/requests/"+id).with(actor).contentType("application/json").content("{\"title\":\"Kitchen tap leaking\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/maintenance/requests/"+id).with(actor)).andExpect(jsonPath("$.title").value("Kitchen tap leaking"));
        mvc.perform(put("/api/maintenance/requests/"+id).with(actor).contentType("application/json").content("{\"status\":\"COMPLETED\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/maintenance/requests").with(actor).contentType("application/json").content(body.replace("Plumbing","RocketScience"))).andExpect(status().isBadRequest());
        AppUser outsider=new AppUser();outsider.setTenantId("society-1");outsider.setEmail("other-"+UUID.randomUUID()+"@example.test");outsider.setFullName("Other admin");outsider.setRole(UserRole.SOCIETY_ADMIN);outsider.setPasswordHash("unused");users.save(outsider);
        mvc.perform(get("/api/maintenance/requests/"+id).with(user(outsider.getEmail()).roles("SOCIETY_ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/maintenance/requests").with(user(outsider.getEmail()).roles("SOCIETY_ADMIN"))).andExpect(jsonPath("$[?(@.id == "+id+")]").isEmpty());
        AppUser admin=new AppUser();admin.setTenantId(tenant);admin.setEmail("admin-"+UUID.randomUUID()+"@example.test");admin.setFullName("Own administrator");admin.setRole(UserRole.SOCIETY_ADMIN);admin.setPasswordHash("unused");users.save(admin);
        var manager=user(admin.getEmail()).roles("SOCIETY_ADMIN");
        mvc.perform(put("/api/maintenance/requests/"+id).with(manager).contentType("application/json").content("{\"status\":\"MADE_UP\"}")).andExpect(status().isBadRequest());
        mvc.perform(put("/api/maintenance/requests/"+id).with(manager).contentType("application/json").content("{\"assignedWorkerId\":"+outsider.getId()+"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/maintenance/requests/"+id+"/cancel").with(actor)).andExpect(status().isOk());
        mvc.perform(get("/api/maintenance/requests/"+id).with(actor)).andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(put("/api/maintenance/requests/"+id).with(manager).contentType("application/json").content("{\"status\":\"COMPLETED\"}")).andExpect(status().isConflict());
    }
    @Test void superadminCatalogueTokenSurvivesAnotherTabsResidentSession() throws Exception {
        AppUser admin=new AppUser();admin.setTenantId("platform");admin.setEmail("root-"+UUID.randomUUID()+"@example.test");admin.setFullName("Root");admin.setRole(UserRole.SUPER_ADMIN);admin.setPasswordHash("unused");users.save(admin);
        String token=jwt.generateToken(admin);
        mvc.perform(get("/api/admin/home-services/packages").with(user("resident@example.test").roles("RESIDENT"))
                .header("Authorization","Bearer "+token)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/home-services/packages").with(user("resident@example.test").roles("RESIDENT")))
                .andExpect(status().isForbidden());
    }
    @Test void workerDropdownSupportsManagerRolesAndStaysWithinSociety() throws Exception {
        String society="dropdown-"+UUID.randomUUID();
        AppUser manager=new AppUser();manager.setTenantId(society);manager.setEmail(society+"@example.test");manager.setFullName("Manager");manager.setRole(UserRole.FACILITY_MANAGER);manager.setPasswordHash("unused");users.save(manager);
        for(String tenant:List.of(society,society+"-other")) {
            AppUser worker=new AppUser();worker.setTenantId(tenant);worker.setEmail(tenant+"-worker@example.test");worker.setFullName("Worker");worker.setRole(UserRole.MAINTENANCE_STAFF);worker.setPasswordHash("unused");worker=users.save(worker);
            WorkerAvailability state=new WorkerAvailability();state.setTenantId(tenant);state.setWorkerId(worker.getId());state.setStatus("AVAILABLE");availability.save(state);
        }
        for(String role:List.of("FACILITY_MANAGER","SUPER_ADMIN","SOCIETY_ADMIN","MAINTENANCE_STAFF")) {
            mvc.perform(get("/api/society/available-workers").with(user(manager.getEmail()).roles(role)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].email").value(society+"-worker@example.test"));
        }
        mvc.perform(get("/api/society/available-workers").with(user(manager.getEmail()).roles("RESIDENT")))
                .andExpect(status().isForbidden());
    }
    @Test void createdWorkerCanSignInToSeparateDashboard() throws Exception {
        String society="worker-test-"+UUID.randomUUID();
        Tenant tenant=new Tenant();tenant.setTenantId(society);tenant.setCode(society);tenant.setSocietyName("Worker Test Society");tenant.setApproved(true);tenants.save(tenant);
        AppUser manager=new AppUser();manager.setTenantId(society);manager.setEmail("manager-"+society+"@example.com");manager.setFullName("Maintenance Manager");manager.setRole(UserRole.MAINTENANCE_STAFF);manager.setPasswordHash(encoder.encode("Manager123!"));users.save(manager);
        String email="worker-"+society+"@example.com",password="Worker123!";
        mvc.perform(post("/api/society/team-users").with(user(manager.getEmail()).roles("MAINTENANCE_STAFF"))
                .contentType("application/json").content(json.writeValueAsString(Map.of("name","New Technician","email",email,"role","MAINTENANCE_STAFF","designation","Plumber","workShift","MORNING","temporaryPassword",password))))
                .andExpect(status().isOk());
        AppUser worker=users.findByEmail(email).orElseThrow();assertEquals(society,worker.getTenantId());assertNotEquals(password,worker.getPasswordHash());assertTrue(encoder.matches(password,worker.getPasswordHash()));
        mvc.perform(post("/api/auth/dashboard-login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("platform","smartapartment","role","maintenance","username",email,"password",password))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.redirect").value("/dashboards/maintenance-worker"));
        mvc.perform(post("/api/auth/dashboard-login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("platform","smartapartment","role","maintenance","username",email,"password","WrongPassword!"))))
                .andExpect(status().isUnauthorized());
    }
}
