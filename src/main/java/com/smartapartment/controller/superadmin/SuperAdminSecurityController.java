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
@PreAuthorize("hasRole('SUPER_ADMIN')")
@org.springframework.transaction.annotation.Transactional
public class SuperAdminSecurityController {

    private final ApiIntegrationRepository integrations;
    private final SystemConfigurationRepository configurations;
    private final com.smartapartment.repository.AuditLogRepository auditLogs;

    public SuperAdminSecurityController(ApiIntegrationRepository integrations, SystemConfigurationRepository configurations,
                                        com.smartapartment.repository.AuditLogRepository auditLogs) {
        this.integrations = integrations;
        this.configurations = configurations;
        this.auditLogs = auditLogs;
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
        List<SystemConfiguration> saved = configurations.findAllByOrderByConfigKeyAsc();
        saved.forEach(config -> { if (values.containsKey(config.getConfigKey())) config.setConfigValue(values.get(config.getConfigKey())); });
        return ResponseEntity.ok(configurations.saveAll(saved));
    }

    private void seedConfigurations() {
        if (configurations.count() > 0) return;
        java.util.Map<String,String> defaults = java.util.Map.of("supportEmail","support@smartapartment.local","approvalRule","AUTO_APPROVE_PAID","maintenanceMode","Disabled","smtpHost","smtp.mailgun.org","sessionLimit","5","retentionPolicy","36");
        defaults.forEach((key,value) -> { SystemConfiguration config=new SystemConfiguration(); config.setConfigKey(key); config.setConfigValue(value); config.setConfigType("GLOBAL_PLATFORM"); config.setActive(true); configurations.save(config); });
    }

    @PostMapping("/mfa-policy")
    public ResponseEntity<String> updateMfaPolicy(@RequestParam boolean requireMfaForAdmins) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_IMPLEMENTED)
                .body("MFA enforcement is not configured. No policy change was applied.");
    }

    @GetMapping("/integrations")
    public ResponseEntity<List<ApiIntegration>> getIntegrations() {
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

    @GetMapping("/audit-logs")
    public ResponseEntity<List<com.smartapartment.entity.AuditLog>> getSystemAuditLogs() {
        return ResponseEntity.ok(auditLogs.findAll(org.springframework.data.domain.PageRequest.of(0,100,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt"))).getContent());
    }
}
