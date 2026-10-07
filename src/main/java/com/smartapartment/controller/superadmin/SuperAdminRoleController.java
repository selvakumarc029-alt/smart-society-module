package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.entity.RoleAccessPolicy;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.RoleAccessPolicyRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin/roles")
@SuppressWarnings("null")
public class SuperAdminRoleController {
    private final AppUserRepository users;
    private final RoleAccessPolicyRepository policies;

    public SuperAdminRoleController(AppUserRepository users, RoleAccessPolicyRepository policies) {
        this.users = users;
        this.policies = policies;
    }

    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        seedPolicies();
        return ResponseEntity.ok(policies.findAllByOrderByRoleNameAsc().stream()
                .map(this::policyResponse)
                .toList());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updatePolicy(@PathVariable Long id, @RequestBody RolePolicyRequest request) {
        RoleAccessPolicy policy = policies.findById(id).orElseThrow(() -> new IllegalArgumentException("Role policy was not found"));
        String summary = clean(request.permissions());
        if (summary.isBlank()) throw new IllegalArgumentException("Permissions summary is required");
        int timeout = request.sessionTimeoutMinutes() == null ? 30 : request.sessionTimeoutMinutes();
        int sessions = request.maxConcurrentSessions() == null ? 2 : request.maxConcurrentSessions();
        double approvalLimit = request.approvalLimit() == null ? 0D : request.approvalLimit();
        if (timeout < 5 || timeout > 1440) throw new IllegalArgumentException("Session timeout must be between 5 and 1440 minutes");
        if (sessions < 1 || sessions > 20) throw new IllegalArgumentException("Concurrent sessions must be between 1 and 20");
        if (approvalLimit < 0) throw new IllegalArgumentException("Approval limit cannot be negative");

        policy.setPermissions(summary);
        policy.setModulePermissions(clean(request.modulePermissions()));
        policy.setAllowedActions(clean(request.allowedActions()));
        policy.setDataScope(normalizeScope(request.dataScope()));
        policy.setApprovalLimit(approvalLimit);
        policy.setSessionTimeoutMinutes(timeout);
        policy.setMaxConcurrentSessions(sessions);
        policy.setMfaRequired(request.mfaRequired());
        policy.setSensitiveActionReauth(request.sensitiveActionReauth());
        policy.setIpRestrictionEnabled(request.ipRestrictionEnabled());
        policy.setAuditLoggingEnabled(request.auditLoggingEnabled());
        policy.setExportAllowed(request.exportAllowed());
        policy.setPolicyNotes(clean(request.policyNotes()));
        policy.setActive(request.active());
        RoleAccessPolicy saved = policies.save(policy);
        return ResponseEntity.ok(policyResponse(saved));
    }

    @PostMapping("/provision")
    public ResponseEntity<String> assignCustomRole(@RequestParam Long userId, @RequestParam String roleName) {
        AppUser user = findUser(userId);
        UserRole role;
        try {
            role = UserRole.valueOf(roleName.trim().toUpperCase().replace('-', '_').replace(' ', '_'));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported role: " + roleName);
        }
        user.setRole(role);
        user.setAccountLocked(false);
        user.setAccessRevokedAt(null);
        users.save(user);
        return ResponseEntity.ok("Role assigned successfully");
    }

    @PostMapping("/revoke")
    public ResponseEntity<String> revokeAccess(@RequestParam Long userId) {
        AppUser user = findUser(userId);
        user.setAccountLocked(true);
        user.setAccessRevokedAt(LocalDateTime.now());
        users.save(user);
        return ResponseEntity.ok("Access revoked for user");
    }

    @PostMapping("/authorize-mobile")
    public ResponseEntity<String> authorizeMobileApp(@RequestParam Long userId, @RequestParam boolean authorized) {
        AppUser user = findUser(userId);
        user.setMobileAppAuthorized(authorized);
        users.save(user);
        return ResponseEntity.ok("Mobile app access updated");
    }

    private AppUser findUser(Long userId) {
        return users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User was not found"));
    }

    private String permissionsFor(UserRole role) {
        if (role == null) return "Own resident services";
        if (role == UserRole.SUPER_ADMIN) return "Platform-wide access";
        if (role == UserRole.SOCIETY_ADMIN) return "Full society administration";
        if (role == UserRole.ACCOUNTANT) return "Finance and billing";
        if (role == UserRole.SECURITY_STAFF) return "Gate, visitor and security operations";
        if (role == UserRole.MAINTENANCE_STAFF) return "Assigned maintenance operations";
        if (role == UserRole.FACILITY_MANAGER) return "Facilities and maintenance management";
        return "Own resident services";
    }

    private Map<String, Object> policyResponse(RoleAccessPolicy policy) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", policy.getId());
        response.put("role", policy.getRoleName());
        response.put("permissions", policy.getPermissions());
        response.put("modulePermissions", clean(policy.getModulePermissions()));
        response.put("allowedActions", clean(policy.getAllowedActions()));
        response.put("dataScope", policy.getDataScope() == null ? "ASSIGNED_SOCIETY" : policy.getDataScope());
        response.put("approvalLimit", policy.getApprovalLimit() == null ? 0D : policy.getApprovalLimit());
        response.put("sessionTimeoutMinutes", policy.getSessionTimeoutMinutes() == null ? 30 : policy.getSessionTimeoutMinutes());
        response.put("maxConcurrentSessions", policy.getMaxConcurrentSessions() == null ? 2 : policy.getMaxConcurrentSessions());
        response.put("mfaRequired", Boolean.TRUE.equals(policy.getMfaRequired()));
        response.put("sensitiveActionReauth", policy.getSensitiveActionReauth() == null || policy.getSensitiveActionReauth());
        response.put("ipRestrictionEnabled", Boolean.TRUE.equals(policy.getIpRestrictionEnabled()));
        response.put("auditLoggingEnabled", policy.getAuditLoggingEnabled() == null || policy.getAuditLoggingEnabled());
        response.put("exportAllowed", Boolean.TRUE.equals(policy.getExportAllowed()));
        response.put("policyNotes", clean(policy.getPolicyNotes()));
        response.put("active", policy.isActive());
        response.put("status", policy.isActive() ? "Active" : "Disabled");
        return response;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeScope(String value) {
        String scope = clean(value).toUpperCase();
        return switch (scope) {
            case "OWN_RECORDS", "ASSIGNED_SOCIETY", "ALL_SOCIETIES", "PLATFORM_WIDE" -> scope;
            default -> "ASSIGNED_SOCIETY";
        };
    }

    private void seedPolicies() {
        Arrays.stream(UserRole.values()).forEach(role -> policies.findByRoleName(role.name()).orElseGet(() -> {
            RoleAccessPolicy policy = new RoleAccessPolicy(); policy.setRoleName(role.name()); policy.setPermissions(permissionsFor(role)); policy.setActive(true); return policies.save(policy);
        }));
    }

    public record RolePolicyRequest(String permissions, String modulePermissions, String allowedActions,
            String dataScope, Double approvalLimit, Integer sessionTimeoutMinutes, Integer maxConcurrentSessions,
            boolean mfaRequired, boolean sensitiveActionReauth, boolean ipRestrictionEnabled,
            boolean auditLoggingEnabled, boolean exportAllowed, String policyNotes, boolean active) {}
}
