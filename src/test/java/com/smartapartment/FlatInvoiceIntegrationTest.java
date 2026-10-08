package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:flat_invoice_test;DB_CLOSE_DELAY=-1", "spring.jpa.hibernate.ddl-auto=create-drop", "SEED_DEMO_ACCOUNTS=false"})
@org.springframework.test.context.TestExecutionListeners(listeners = {org.springframework.test.context.support.DependencyInjectionTestExecutionListener.class, org.springframework.security.test.context.support.WithSecurityContextTestExecutionListener.class}, mergeMode = org.springframework.test.context.TestExecutionListeners.MergeMode.REPLACE_DEFAULTS)
@AutoConfigureMockMvc
class FlatInvoiceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ApartmentRepository apartments;
    @Autowired ResidentRepository residents;
    @Autowired AppUserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired MaintenanceBillRepository bills;
    String tenant, admin, first, roommate, neighbour, outside;
    Apartment chosen, other, external;
    @BeforeEach void setup() {
        tenant="invoice-"+UUID.randomUUID();
        society(tenant);society(tenant+"-other");
        chosen=flat(tenant,"A-101","1BHK");other=flat(tenant,"A-102","2BHK");external=flat(tenant+"-other","A-101","1BHK");
        admin=account("admin",UserRole.SOCIETY_ADMIN,null,tenant);
        first=account("resident",UserRole.RESIDENT,chosen,tenant);
        roommate=account("roommate",UserRole.RESIDENT,chosen,tenant);
        neighbour=account("neighbour",UserRole.RESIDENT,other,tenant);
        outside=account("outsider",UserRole.RESIDENT,external,tenant+"-other");
    }
    void society(String id){var t=new Tenant();t.setTenantId(id);t.setCode(id);t.setSocietyName(id);t.setApproved(true);tenants.save(t);}
    Apartment flat(String tenant,String number,String type){var a=new Apartment();a.setTenantId(tenant);a.setUnitNo(number);a.setUnitType(type);a.setMonthlyMaintenance(new BigDecimal("1800"));return apartments.save(a);}
    String account(String label,UserRole role,Apartment flat,String id){var u=new AppUser();u.setTenantId(id);u.setEmail(label+"-"+tenant+"@test.local");u.setFullName(label);u.setPasswordHash("unused");u.setRole(role);u=users.save(u);if(flat!=null){var r=new Resident();r.setTenantId(id);r.setUser(u);r.setApartment(flat);residents.save(r);}return u.getEmail();}
    Map<String,Object> payload(){var p=new LinkedHashMap<String,Object>();p.put("month","2026-10");p.put("invoiceDate","2026-10-01");p.put("periodStart","2026-10-01");p.put("periodEnd","2026-10-31");p.put("dueDate","2026-10-20");p.put("defaultAreaSqFt",1000);p.put("baseRatePerSqFt",0);p.put("otherCharges",1800);p.put("commonPowerFee",100);p.put("cgstRate",0);p.put("sgstRate",0);p.put("apartmentId",chosen.getId());p.put("unitType","1 BHK");return p;}
    org.springframework.test.web.servlet.ResultActions generate(Map<String,Object> p,String email,String role)throws Exception{return mvc.perform(post("/api/billing/generate-for-flat").with(user(email).roles(role)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p)));}
    @Test void createsOnlyChosenFlatAndBothRoommatesSeeItButOtherFlatsAndSocietiesCannot()throws Exception{
        generate(payload(),admin,"SOCIETY_ADMIN").andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        var saved=bills.findByTenantIdOrderByDueDateDesc(tenant);assertEquals(1,saved.size());assertEquals(chosen.getId(),saved.getFirst().getApartment().getId());assertEquals(0,new BigDecimal("1900.00").compareTo(saved.getFirst().getTotalAmount()));
        for(String email:List.of(first,roommate))mvc.perform(get("/api/society/bills").with(user(email).roles("RESIDENT"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].unitNo").value("A-101"));
        for(String email:List.of(neighbour,outside))mvc.perform(get("/api/society/bills").with(user(email).roles("RESIDENT"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void rejectsForeignFlatEvenWhenNumberAndBhkMatch()throws Exception{var p=payload();p.put("apartmentId",external.getId());generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isBadRequest());assertTrue(bills.findByTenantIdOrderByDueDateDesc(tenant).isEmpty());}
    @Test void rejectsWrongBhkAndMissingFlatInsteadOfGeneratingBatch()throws Exception{var p=payload();p.put("unitType","2BHK");generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isBadRequest());p=payload();p.remove("apartmentId");generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isBadRequest());assertTrue(bills.findByTenantIdOrderByDueDateDesc(tenant).isEmpty());}
    @Test void duplicateInvoiceIsRejectedWithoutOverwritingOriginal()throws Exception{generate(payload(),admin,"SOCIETY_ADMIN").andExpect(status().isOk());var p=payload();p.put("otherCharges",9999);generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isConflict());assertEquals(1,bills.findByTenantIdOrderByDueDateDesc(tenant).size());assertEquals(0,new BigDecimal("1900.00").compareTo(bills.findByTenantIdOrderByDueDateDesc(tenant).getFirst().getTotalAmount()));}
    @Test void residentCannotGenerateInvoices()throws Exception{generate(payload(),first,"RESIDENT").andExpect(status().isForbidden());}
    @Test void explicitBatchStillWorksForAllSocietyFlats()throws Exception{var p=payload();p.remove("apartmentId");p.remove("unitType");mvc.perform(post("/api/billing/generate-detailed").with(user(admin).roles("SOCIETY_ADMIN")).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(p))).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));}
    @Test void rejectsInvalidDueDateAndZeroFee()throws Exception{var p=payload();p.put("dueDate","2026-09-01");generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isBadRequest());p=payload();p.put("otherCharges",0);generate(p,admin,"SOCIETY_ADMIN").andExpect(status().isBadRequest());}
    @Test void onlySuperadminCanAccessPricingEditor()throws Exception {
        mvc.perform(get("/api/admin/home-services/packages").with(user(admin).roles("SOCIETY_ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/home-services/packages/1/price").with(user(admin).roles("SOCIETY_ADMIN")).contentType(MediaType.APPLICATION_JSON).content("{\"price\":999}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/home-services/packages").with(user("platform@test.local").roles("SUPER_ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/home-services/packages").with(user(first).roles("RESIDENT"))).andExpect(status().isOk());
    }
}
