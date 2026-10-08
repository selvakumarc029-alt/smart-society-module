package com.smartapartment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.Vendor;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:crud_validation;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop", "SEED_DEMO_ACCOUNTS=false"})
@AutoConfigureMockMvc
class SocietyRecordCrudIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired VendorRepository vendors;
    @Autowired ApartmentRepository apartments;
    @Autowired AppUserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;
    @org.junit.jupiter.api.BeforeEach void seedTestAccounts(){
        if(tenants.findByCode("green-heights").isEmpty()){
            var tenant=new com.smartapartment.entity.Tenant();tenant.setTenantId("green-heights");tenant.setCode("green-heights");tenant.setSocietyName("CRUD Test Society");tenant.setApproved(true);tenants.save(tenant);
        }
        var roles=Map.of("admin",com.smartapartment.entity.UserRole.SOCIETY_ADMIN,"resident",com.smartapartment.entity.UserRole.RESIDENT,"accountant",com.smartapartment.entity.UserRole.ACCOUNTANT);
        roles.forEach((name,role)->{if(users.findByEmail(name+"@smartapartment").isEmpty()){
            var user=new com.smartapartment.entity.AppUser();user.setTenantId("green-heights");user.setFullName("Test "+name);user.setEmail(name+"@smartapartment");user.setPasswordHash(encoder.encode(name+"123"));user.setRole(role);user.setStatus("ACTIVE");users.save(user);
        }});
    }
    private String unique(){return UUID.randomUUID().toString().substring(0,8);}
    private MockHttpSession login(String role,String username) throws Exception {
        return (MockHttpSession)mvc.perform(post("/api/auth/dashboard-login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("platform","smartapartment","role",role,"username",username+"@smartapartment","password",username+"123"))))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
    private MockHttpSession admin()throws Exception{return login("admin","admin");}
    private JsonNode create(String resource,Map<String,Object> data,MockHttpSession session)throws Exception{
        return json.readTree(mvc.perform(post("/api/society/records/"+resource).session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(data)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private JsonNode record(String resource,long id,MockHttpSession session)throws Exception{
        JsonNode list=json.readTree(mvc.perform(get("/api/society/records/"+resource).session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for(JsonNode node:list)if(node.path("id").asLong()==id)return node;
        throw new AssertionError("Saved record missing from list");
    }
    private Map<String,Object> vendor(){return new LinkedHashMap<>(Map.of("name","Vendor "+unique(),"category","Electrical","phone","9876543210","email","vendor@example.com"));}
    private Map<String,Object> flat(String unit){return Map.of("unitNo",unit,"ownerName","Test owner","occupancy","VACANT","block","CRUD Test","floor",0,"unitType","2BHK");}

    @Test void vendorCreateReadUpdateDeletePersistsAndRejectsStaleWrites()throws Exception{
        var session=admin();var data=vendor();long id=create("vendors",data,session).path("id").asLong();
        var before=record("vendors",id,session);data.put("name","Updated vendor "+unique());
        mvc.perform(patch("/api/society/records/vendors/"+id).session(session).header("If-Match",before.path("version").asText()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(data)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value(data.get("name")));
        assertEquals(data.get("name"),vendors.findById(id).orElseThrow().getName());
        mvc.perform(patch("/api/society/records/vendors/"+id).session(session).header("If-Match",before.path("version").asText()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(data))).andExpect(status().isConflict());
        mvc.perform(delete("/api/society/records/vendors/"+id).session(session)).andExpect(status().is(428));
        var current=record("vendors",id,session);
        mvc.perform(patch("/api/society/records/vendors/"+id).session(session).header("If-Match",current.path("version").asText()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Partial edit\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("Electrical"));
        current=record("vendors",id,session);
        mvc.perform(delete("/api/society/records/vendors/"+id).session(session).header("If-Match",current.path("version").asText())).andExpect(status().isOk());
        assertFalse(vendors.existsById(id));
        mvc.perform(delete("/api/society/records/vendors/"+id).session(session).header("If-Match",current.path("version").asText())).andExpect(status().isNotFound());
    }
    @Test void tenantIsolationAndRolesApplyToValidRequests()throws Exception{
        Vendor other=new Vendor();other.setTenantId("other-society");other.setName("Private vendor");other.setServiceCategory("Cleaning");other.setPhone("1234567890");other=vendors.save(other);
        var session=admin();var list=json.readTree(mvc.perform(get("/api/society/records/vendors").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long id=other.getId();for(JsonNode row:list)assertNotEquals(id,row.path("id").asLong());
        mvc.perform(patch("/api/society/records/vendors/"+id).session(session).header("If-Match","0").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(vendor()))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/society/records/vendors/"+id).session(session).header("If-Match","0")).andExpect(status().isNotFound());
        var resident=login("resident","resident");
        mvc.perform(post("/api/society/records/vendors").session(resident).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(vendor()))).andExpect(status().isForbidden());
        var accountant=login("accountant","accountant");
        mvc.perform(get("/api/society/records/apartments").session(accountant)).andExpect(status().isForbidden());
        create("vendors",vendor(),accountant);assertTrue(vendors.existsById(id));
    }
    @Test void duplicateFlatsAndReferencedDeletesFailWithoutLosingData()throws Exception{
        var session=admin();String unit="CRUD-"+unique();long id=create("apartments",flat(unit),session).path("id").asLong();
        mvc.perform(post("/api/society/records/apartments").session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(flat(" "+unit.toLowerCase(Locale.ROOT)+" ")))).andExpect(status().isConflict());
        var resident=new LinkedHashMap<String,Object>(Map.of("name","CRUD Resident","email",unique()+"@example.com","unitNo",unit,"residentType","TENANT","temporaryPassword","testpassword123"));
        long residentId=create("residents",resident,session).path("id").asLong();var before=record("apartments",id,session);
        var residentSession=(MockHttpSession)mvc.perform(post("/api/auth/dashboard-login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("platform","smartapartment","role","resident","username",resident.get("email"),"password","testpassword123"))))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        mvc.perform(delete("/api/society/records/apartments/"+id).session(session).header("If-Match",before.path("version").asText())).andExpect(status().isConflict());
        assertTrue(apartments.existsById(id));var account=record("residents",residentId,session);
        assertFalse(account.has("passwordHash"));assertFalse(account.has("mfaSecret"));
        mvc.perform(delete("/api/society/records/residents/"+residentId).session(session).header("If-Match",account.path("version").asText())).andExpect(status().isOk());
        assertEquals("INACTIVE",record("residents",residentId,session).path("status").asText());
        assertTrue(users.findByEmail(resident.get("email").toString()).orElseThrow().isAccountLocked());
        mvc.perform(get("/api/society/me").session(residentSession)).andExpect(status().isUnauthorized());
    }
    @Test void invalidValuesNeverCreateRowsAndOtherMasterRecordsHaveCompleteLifecycles()throws Exception{
        var session=admin();long count=vendors.count();var invalid=vendor();invalid.put("name"," ");
        mvc.perform(post("/api/society/records/vendors").session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());assertEquals(count,vendors.count());
        String unit="P-"+unique();create("apartments",flat(unit),session);
        var data=new LinkedHashMap<String,Map<String,Object>>();
        data.put("amenities",Map.of("name","Hall "+unique(),"capacity",25,"bookingFee",0,"approvalRequired",true));
        data.put("parking",Map.of("slot","S-"+unique(),"unitNo",unit,"vehicleNumber","TEST123","vehicleType","CAR"));
        data.put("events",Map.of("title","Meeting","venue","Hall","startsAt","2030-02-01T10:00:00","endsAt","2030-02-01T11:00:00"));
        data.put("documents",Map.of("name","Rules","category","POLICY","contentType","application/pdf","storageUrl","/documents/rules.pdf"));
        for(var entry:data.entrySet()){
            long id=create(entry.getKey(),entry.getValue(),session).path("id").asLong();var current=record(entry.getKey(),id,session);
            mvc.perform(patch("/api/society/records/"+entry.getKey()+"/"+id).session(session).header("If-Match",current.path("version").asText()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(entry.getValue()))).andExpect(status().isOk());
            current=record(entry.getKey(),id,session);
            mvc.perform(delete("/api/society/records/"+entry.getKey()+"/"+id).session(session).header("If-Match",current.path("version").asText())).andExpect(status().isOk());
        }
        mvc.perform(post("/api/society/records/documents").session(session).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Bad link\",\"category\":\"POLICY\",\"contentType\":\"text/html\",\"storageUrl\":\"javascript:alert(1)\"}")).andExpect(status().isBadRequest());
    }
    @Test void expenseApprovalCannotRewritePaidHistory()throws Exception{
        var session=admin();var create=mvc.perform(post("/api/society/finance/expenses").session(session).contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"Maintenance\",\"vendor\":\"Test\",\"amount\":100,\"date\":\"2026-10-08\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();long id=json.readTree(create).path("id").asLong();
        mvc.perform(patch("/api/society/finance/expenses/"+id+"/approve").session(session)).andExpect(status().isOk());
        mvc.perform(patch("/api/society/finance/expenses/"+id+"/pay").session(session).param("mode","invalid")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/society/finance/expenses/"+id+"/pay").session(session).param("mode","BANK_TRANSFER").param("reference","CRUD-TEST")).andExpect(status().isOk());
        mvc.perform(patch("/api/society/finance/expenses/"+id+"/approve").session(session)).andExpect(status().isConflict());
        mvc.perform(patch("/api/society/finance/expenses/"+id+"/reject").session(session)).andExpect(status().isConflict());
        mvc.perform(delete("/api/society/finance/expenses/"+id).session(session)).andExpect(status().isBadRequest());
    }
}
