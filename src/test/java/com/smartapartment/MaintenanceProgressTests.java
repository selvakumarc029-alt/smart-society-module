package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:maintenance-progress;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop","SEED_DEMO_ACCOUNTS=false","app.jwt.secret=maintenance_progress_test_secret_at_least_32_bytes"})
@AutoConfigureMockMvc
class MaintenanceProgressTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PropertyCustomerRepository customers;
    @Autowired AppUserRepository users;
    @Autowired CommonMaintenanceTicketRepository tickets;

    MockHttpSession customer() {
        var c = new PropertyCustomer(); c.setTenantId("propertydirect"); c.setName("Customer");
        c.setEmail(UUID.randomUUID()+"@test.local"); c.setUsername(UUID.randomUUID().toString()); c.setPasswordHash("unused");
        customers.save(c); var s = new MockHttpSession(); s.setAttribute("propertydirect:customerId", c.getId()); return s;
    }
    MockHttpSession admin() {
        AppUser account=new AppUser();account.setTenantId("platform");account.setEmail(UUID.randomUUID()+"@test.local");account.setFullName("Audit admin");account.setRole(UserRole.SUPER_ADMIN);account.setPasswordHash("unused");users.save(account);
        var context=org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(account.getEmail(),null,java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
        var session=new MockHttpSession();session.setAttribute(org.springframework.security.web.context.HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,context);return session;
    }
    @Test void customerBookingIsVisibleToMaintenanceAndOnlyItsOwnerWithPersistedProgress() throws Exception {
        var owner = customer(); var stranger = customer(); var staff = admin();
        String body = """
            {"sourcePlatform":"propertydirect","requesterId":999999,"serviceType":"Plumbing","title":"Leaking tap","serviceAddress":"A-101"}
            """;
        var created = mvc.perform(post("/api/maintenance").session(owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ticketStatus").value("REQUESTED"))
            .andExpect(jsonPath("$.requesterId").value(((Number)owner.getAttribute("propertydirect:customerId")).intValue())).andReturn();
        long id = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/maintenance/dispatch/tickets").session(staff)).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == "+id+")]").isNotEmpty());
        mvc.perform(get("/api/maintenance").session(stranger)).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == "+id+")]").isEmpty());
        mvc.perform(patch("/api/maintenance/"+id+"/status").session(owner).contentType(MediaType.APPLICATION_JSON).content("{\"ticketStatus\":\"RESOLVED\"}" )).andExpect(status().isForbidden());
        mvc.perform(patch("/api/maintenance/dispatch/tickets/"+id).session(staff).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ASSIGNED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.workProgress").value("Started"));
        mvc.perform(patch("/api/maintenance/dispatch/tickets/"+id).session(staff).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\",\"estimatedMinutes\":60,\"notes\":\"Replacing washer\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.workProgress").value("Processing")).andExpect(jsonPath("$.estimatedCompletionAt").isNotEmpty());
        assertNotNull(tickets.findById(id).orElseThrow().getWorkStartedAt());
        mvc.perform(get("/api/maintenance").session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == "+id+")].vendorNotes").value(org.hamcrest.Matchers.hasItem("Replacing washer")));
        mvc.perform(patch("/api/maintenance/dispatch/tickets/"+id).session(staff).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"RESOLVED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.workProgress").value("Completed")).andExpect(jsonPath("$.resolvedAt").isNotEmpty());
        mvc.perform(get("/api/maintenance").session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == "+id+")].workProgress").value(org.hamcrest.Matchers.hasItem("Completed")));
        mvc.perform(patch("/api/maintenance/dispatch/tickets/"+id).session(staff).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}" )).andExpect(status().isConflict());
    }
    @Test void anonymousRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/maintenance")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/maintenance").contentType(MediaType.APPLICATION_JSON).content("{\"sourcePlatform\":\"smartsociety\",\"title\":\"Tap\",\"serviceType\":\"Plumbing\"}" )).andExpect(status().isUnauthorized());
    }
    @Test void residentIdentityComesFromSignedInAccount() throws Exception {
        var resident = new AppUser(); resident.setTenantId("test-society"); resident.setEmail(UUID.randomUUID()+"@test.local");
        resident.setFullName("Resident"); resident.setRole(UserRole.RESIDENT); resident.setPasswordHash("unused"); users.save(resident);
        mvc.perform(post("/api/maintenance").with(user(resident.getEmail()).roles("RESIDENT")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"sourcePlatform\":\"smartsociety\",\"requesterId\":999999,\"title\":\"Door repair\",\"serviceType\":\"Carpentry\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.requesterId").value(resident.getId().intValue())).andExpect(jsonPath("$.tenantId").value("test-society"));
    }
}
