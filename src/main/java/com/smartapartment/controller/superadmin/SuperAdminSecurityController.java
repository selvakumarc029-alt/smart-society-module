package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import com.smartapartment.entity.ApiIntegration;
import com.smartapartment.entity.SystemConfiguration;
import com.smartapartment.repository.ApiIntegrationRepository;
import com.smartapartment.repository.SystemConfigurationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin/security")
public class SuperAdminSecurityController {

    private final ApiIntegrationRepository integrations;
    private final SystemConfigurationRepository configurations;

    public SuperAdminSecurityController(ApiIntegrationRepository integrations, SystemConfigurationRepository configurations) {
        this.integrations = integrations;
        this.configurations = configurations;
    }

    @GetMapping("/config")
    public ResponseEntity<List<SystemConfiguration>> getGlobalConfigs() {
        seedConfigurations(); return ResponseEntity.ok(configurations.findAllByOrderByConfigKeyAsc());
    }

    @PostMapping("/config")
    public ResponseEntity<SystemConfiguration> updateConfig(@RequestBody SystemConfiguration config) {
        return ResponseEntity.ok(configurations.save(config));
    }

    @PutMapping("/config")
    public ResponseEntity<List<SystemConfiguration>> saveGlobalConfigs(@RequestBody java.util.Map<String, String> values) {
        seedConfigurations();
        configurations.findAllByOrderByConfigKeyAsc().forEach(config -> { if (values.containsKey(config.getConfigKey())) config.setConfigValue(values.get(config.getConfigKey())); });
        return ResponseEntity.ok(configurations.saveAll(configurations.findAllByOrderByConfigKeyAsc()));
    }

    private void seedConfigurations() {
        if (configurations.count() > 0) return;
        java.util.Map<String,String> defaults = java.util.Map.of("supportEmail","support@smartapartment.local","approvalRule","AUTO_APPROVE_PAID","maintenanceMode","Disabled","smtpHost","smtp.mailgun.org","sessionLimit","5","retentionPolicy","36");
        defaults.forEach((key,value) -> { SystemConfiguration config=new SystemConfiguration(); config.setConfigKey(key); config.setConfigValue(value); config.setConfigType("GLOBAL_PLATFORM"); config.setActive(true); configurations.save(config); });
    }

    @PostMapping("/mfa-policy")
    public ResponseEntity<String> updateMfaPolicy(@RequestParam boolean requireMfaForAdmins) {
        // Stubbed: Implement MFA policy update
        return ResponseEntity.ok("MFA policy updated");
    }

    @GetMapping("/integrations")
    public ResponseEntity<List<ApiIntegration>> getIntegrations() {
        seedIntegrations();
        return ResponseEntity.ok(integrations.findAllByOrderByCreatedAtAsc());
    }

    @PostMapping("/integrations")
    public ResponseEntity<ApiIntegration> addIntegration(@RequestBody ApiIntegration integration) {
        integration.setId(null);
        return ResponseEntity.ok(integrations.save(integration));
    }

    @PutMapping("/integrations/{id}")
    public ResponseEntity<ApiIntegration> updateIntegration(@PathVariable Long id, @RequestBody ApiIntegration request) {
        ApiIntegration integration = integrations.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Integration was not found"));
        integration.setServiceName(request.getServiceName());
        integration.setDescription(request.getDescription());
        integration.setWebhookUrl(request.getWebhookUrl());
        integration.setApiKey(request.getApiKey());
        integration.setActive(request.isActive());
        return ResponseEntity.ok(integrations.save(integration));
    }

    private void seedIntegrations() {
        if (integrations.count() > 0) return;
        ApiIntegration sms = new ApiIntegration();
        sms.setServiceName("Twilio SMS"); sms.setDescription("Primary SMS gateway"); sms.setActive(true);
        ApiIntegration email = new ApiIntegration();
        email.setServiceName("SendGrid Email"); email.setDescription("Transactional emails"); email.setActive(true);
        integrations.saveAll(List.of(sms, email));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<Object>> getSystemAuditLogs() {
        // Fetch detailed system logs
        return ResponseEntity.ok(List.of());
    }
}
