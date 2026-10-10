package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import java.nio.file.*;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Opt-in, disposable browser audit server. Never uses the live database. */
@EnabledIfSystemProperty(named="smartsociety.browser.audit", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.DEFINED_PORT, properties={
    "server.port=8081", "spring.datasource.url=jdbc:h2:mem:browser_audit;DB_CLOSE_DELAY=-1",
    "spring.jpa.hibernate.ddl-auto=create-drop", "SEED_DEMO_ACCOUNTS=false",
    "spring.mail.host=", "app.mail.brevo-api-key=", "spring.http.client.factory=simple"})
class SmartSocietyBrowserAuditHarness {
    @org.springframework.boot.test.context.TestConfiguration
    static class WindowsAuditServer {
        @org.springframework.context.annotation.Bean
        org.springframework.boot.web.server.WebServerFactoryCustomizer<org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory> auditConnector() {
            return factory -> factory.setProtocol("org.apache.coyote.http11.Http11Nio2Protocol");
        }
    }
    @Autowired AppUserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired ResidentRepository residents;
    @Autowired PasswordEncoder passwords;

    @Test void keepDisposableAuditServerAvailable() throws Exception {
        Tenant tenant=new Tenant(); tenant.setTenantId("browser-audit"); tenant.setCode("browser-audit");
        tenant.setSocietyName("Disposable audit society"); tenant.setApproved(true); tenants.save(tenant);
        for (UserRole role:UserRole.values()) {
            String label=role.name().toLowerCase();
            AppUser account=new AppUser(); account.setTenantId("browser-audit");
            account.setEmail(label+"@audit.local"); account.setFullName("Audit "+label);
            account.setRole(role); account.setPasswordHash(passwords.encode("AuditOnly!2026"));
            account.setDesignation(role==UserRole.MAINTENANCE_STAFF ? "Plumber" : label);
            account=users.save(account);
            if(role==UserRole.RESIDENT) {
                Resident resident=new Resident();resident.setTenantId("browser-audit");
                resident.setUser(account);resident.setResidentType("TENANT");residents.save(resident);
            }
        }
        AppUser manager=new AppUser();manager.setTenantId("browser-audit");manager.setEmail("manager@audit.local");
        manager.setFullName("Audit maintenance manager");manager.setRole(UserRole.MAINTENANCE_STAFF);
        manager.setDesignation("Maintenance Manager");manager.setPasswordHash(passwords.encode("AuditOnly!2026"));users.save(manager);
        Files.writeString(Path.of("target/browser-audit-ready"),"Disposable SmartSociety audit server ready on port 8081");
        Instant deadline=Instant.now().plus(Duration.ofMinutes(30));
        while(Instant.now().isBefore(deadline) && !Files.exists(Path.of("target/stop-browser-audit"))) Thread.sleep(500);
    }
}
