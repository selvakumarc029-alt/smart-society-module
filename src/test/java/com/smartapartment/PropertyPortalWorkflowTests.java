package com.smartapartment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.PropertyCustomer;
import com.smartapartment.repository.PropertyCustomerRepository;
import com.smartapartment.service.MailService;
import java.time.LocalDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:propertyportal;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop",
        "SEED_DEMO_ACCOUNTS=false", "app.property-media-directory=./target/property-portal-test-media"})
@AutoConfigureMockMvc
class PropertyPortalWorkflowTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PropertyCustomerRepository customers;
    @Autowired PasswordEncoder passwords;
    @MockBean MailService mail;
    private final String password="Workflow-test-123";

    @Test void registrationAppearsToAdminAndLoginUsesStoredRoleAndClearsPreviousIdentity() throws Exception {
        MockHttpSession admin=account("ADMIN");
        MockHttpSession customer=register();
        long customerId=getJson("/api/property/portal/me",customer).get("id").asLong();
        JsonNode accounts=getJson("/api/property/portal/accounts",admin);
        assertTrue(java.util.stream.StreamSupport.stream(accounts.spliterator(),false).anyMatch(a->a.get("id").asLong()==customerId));
        assertFalse(accounts.toString().contains("passwordHash"));
        customer.setAttribute("dashboard:propertydirect:superadmin",true);
        customer.setAttribute("dashboard:smartapartment:admin",true);
        PropertyCustomer stored=customers.findById(customerId).orElseThrow();
        mvc.perform(post("/api/auth/dashboard-login").session(customer).contentType("application/json")
                .content(json.writeValueAsString(Map.of("platform","propertydirect","username",stored.getEmail(),"password",password,"role","builder"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("customer"));
        assertNull(customer.getAttribute("dashboard:propertydirect:superadmin"));
        assertNull(customer.getAttribute("dashboard:smartapartment:admin"));
        mvc.perform(get("/api/property/portal/accounts").session(customer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/property/portal/me")).andExpect(status().isUnauthorized());
    }

    @Test void builderVerificationProjectUnitPublicationAndCustomerActionsPersistEndToEnd() throws Exception {
        MockHttpSession admin=account("ADMIN"),builder=register(),buyer=register(),other=register();
        long application=submitApplication(builder,"BUILDER");
        mvc.perform(multipart("/api/property/portal/listings").file(propertyPart(null,"DRAFT")).session(builder)).andExpect(status().isForbidden());
        patchJson("/api/property/portal/applications/"+application,Map.of("decision","APPROVED","note","Company registration and ownership checked"),admin,200);
        assertEquals("BUILDER",getJson("/api/property/portal/me",builder).get("role").asText());
        long project=postJson("/api/property/portal/projects",Map.of("name","Verified Homes","city","Chennai","registrationNumber","PROJECT-123","constructionStatus","Ready to Move"),builder,200).get("id").asLong();
        MvcResult created=mvc.perform(multipart("/api/property/portal/listings").file(propertyPart(project,"SUBMIT")).file(photo()).session(builder))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING_APPROVAL")).andReturn();
        long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/property/listings/"+id)).andExpect(status().isNotFound());
        patchJson("/api/property/portal/listings/"+id+"/status",Map.of("decision","APPROVED","note","Photos and details verified"),admin,200);
        mvc.perform(get("/api/property/listings/"+id)).andExpect(status().isOk());
        postJson("/api/property/saved/"+id,Map.of(),buyer,200);
        assertTrue(getJson("/api/property/saved",buyer).toString().contains("Verified apartment"));
        long enquiry=postJson("/api/property/enquiries",Map.of("listingId",id,"name","Buyer","email","buyer@example.com","phone","9876543210","type","PURCHASE","message","Please share available visit slots"),buyer,200).get("id").asLong();
        assertTrue(getJson("/api/property/portal/enquiries",builder).toString().contains("Please share available visit slots"));
        assertEquals(0,getJson("/api/property/portal/enquiries",other).size());
        patchJson("/api/property/portal/enquiries/"+enquiry+"/reply",Map.of("reply","Saturday morning is available"),builder,200);
        assertTrue(getJson("/api/property/portal/enquiries",buyer).toString().contains("Saturday morning is available"));
        long visit=postJson("/api/property/visits",Map.of("listingId",id,"scheduledAt",LocalDateTime.now().plusDays(2).toString(),"notes","Two attendees"),buyer,200).get("id").asLong();
        patchJson("/api/property/portal/visits/"+visit,Map.of("status","CONFIRMED"),other,403);
        patchJson("/api/property/portal/visits/"+visit,Map.of("status","CONFIRMED"),builder,200);
        patchJson("/api/property/portal/visits/"+visit,Map.of("status","COMPLETED"),builder,400);
        patchJson("/api/property/portal/visits/"+visit,Map.of("status","CANCELLED"),buyer,200);
        patchJson("/api/property/portal/visits/"+visit,Map.of("status","CONFIRMED"),builder,400);
        mvc.perform(multipart("/api/property/portal/listings").file(propertyPart(project,"SUBMIT")).file(photo()).session(builder)).andExpect(status().isBadRequest());
        patchJson("/api/property/portal/listings/"+id+"/status",Map.of("decision","SOLD"),builder,200);
        mvc.perform(get("/api/property/listings/"+id)).andExpect(status().isNotFound());
        assertTrue(getJson("/api/property/portal/audit",admin).size()>0);
    }

    @Test void suspendedAccountCannotContinueUsingExistingSessionOrPublish() throws Exception {
        MockHttpSession admin=account("ADMIN"),owner=register();
        long app=submitApplication(owner,"OWNER");
        patchJson("/api/property/portal/applications/"+app,Map.of("decision","APPROVED","note","Ownership checked"),admin,200);
        long ownerId=getJson("/api/property/portal/me",owner).get("id").asLong();
        patchJson("/api/property/portal/accounts/"+ownerId,Map.of("status","SUSPENDED","note","Owner requested access suspension"),admin,200);
        mvc.perform(get("/api/property/portal/me").session(owner)).andExpect(status().isForbidden());
        mvc.perform(get("/api/property/saved").session(owner)).andExpect(status().isForbidden());
    }

    @Test void draftAndOwnershipBoundariesAreEnforced() throws Exception {
        MockHttpSession admin=account("ADMIN"),owner=register(),other=register();
        for(MockHttpSession s:List.of(owner,other)) patchJson("/api/property/portal/applications/"+submitApplication(s,"OWNER"),Map.of("decision","APPROVED","note","Ownership checked"),admin,200);
        MvcResult result=mvc.perform(multipart("/api/property/portal/listings").file(propertyPart(null,"DRAFT")).session(owner)).andExpect(status().isOk()).andReturn();
        long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        patchJson("/api/property/portal/listings/"+id+"/status",Map.of("decision","SUBMIT"),other,403);
        patchJson("/api/property/portal/listings/"+id+"/status",Map.of("decision","SUBMIT"),owner,400);
        mvc.perform(multipart("/api/property/portal/listings/"+id+"/photos").file(photo()).session(owner)).andExpect(status().isOk());
        patchJson("/api/property/portal/listings/"+id+"/status",Map.of("decision","SUBMIT"),owner,200);
        mvc.perform(multipart("/api/property/portal/listings/"+id+"/photos").file(new MockMultipartFile("photos","bad.svg","image/svg+xml","<svg/>".getBytes())).session(owner)).andExpect(status().isBadRequest());
    }

    private MockHttpSession register() throws Exception {
        String email=UUID.randomUUID()+"@customer.test";
        MockHttpSession session=new MockHttpSession();
        postJson("/api/auth/propertydirect/register-customer",Map.of("name","Test Customer","email",email,"username",email,"password",password,"phone","9876543210"),session,200);
        return session;
    }
    private MockHttpSession account(String role) throws Exception {
        PropertyCustomer c=new PropertyCustomer();c.setTenantId("propertydirect");c.setName("Test Administrator");c.setEmail(UUID.randomUUID()+"@admin.test");c.setUsername(c.getEmail());c.setPhone("9876543210");c.setPasswordHash(passwords.encode(password));c.setRole(role);customers.save(c);
        MockHttpSession session=new MockHttpSession();
        postJson("/api/auth/dashboard-login",Map.of("platform","propertydirect","username",c.getEmail(),"password",password),session,200);return session;
    }
    private long submitApplication(MockHttpSession s,String role) throws Exception {
        return postJson("/api/property/portal/applications",Map.of("role",role,"companyName","Verified Homes Ltd","registrationNumber","COMPANY-123","verificationDetails","Ownership and company registration details for administrator verification"),s,200).get("id").asLong();
    }
    private MockMultipartFile propertyPart(Long project,String intent) throws Exception {
        Map<String,Object> listing=new LinkedHashMap<>(Map.of("title","Verified apartment","society","Verified Homes","locality","Anna Nagar","city","Chennai","pincode","600040","type","BUY","propertyType","Apartment","price",8000000,"bhk","3 BHK","areaSqft",1500));
        listing.put("bathrooms",2);listing.put("description","Actual approved property details");
        Map<String,Object> body=new LinkedHashMap<>();body.put("listing",listing);body.put("intent",intent);body.put("projectId",project);body.put("tower","A");body.put("unitNumber","101");
        return new MockMultipartFile("property","","text/plain",json.writeValueAsBytes(body));
    }
    private MockMultipartFile photo() {return new MockMultipartFile("photos","photo.png","image/png",Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="));}
    private JsonNode getJson(String path,MockHttpSession session) throws Exception {return json.readTree(mvc.perform(get(path).session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
    private JsonNode postJson(String path,Object body,MockHttpSession session,int statusCode) throws Exception {return json.readTree(mvc.perform(post(path).session(session).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().is(statusCode)).andReturn().getResponse().getContentAsString());}
    private void patchJson(String path,Object body,MockHttpSession session,int statusCode) throws Exception {mvc.perform(patch(path).session(session).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().is(statusCode));}
}
