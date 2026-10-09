package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.Tenant;
import com.smartapartment.repository.TenantRepository;
import com.smartapartment.repository.SubscriptionPlanRepository;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/superadmin/subscription-lifecycle")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SubscriptionLifecycleController {
    private final TenantRepository tenants;
    private final SubscriptionPlanRepository plans;
    public SubscriptionLifecycleController(TenantRepository tenants, SubscriptionPlanRepository plans) {
        this.tenants = tenants; this.plans = plans;
    }
    public static String expiryState(LocalDate end, LocalDate today) {
        if (end == null) return "NOT_SCHEDULED";
        long days = ChronoUnit.DAYS.between(today, end);
        return days < 0 ? "EXPIRED" : days <= 7 ? "EXPIRING" : "CURRENT";
    }
    @GetMapping @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return tenants.findAllByOrderByCreatedAtDesc().stream().map(this::view).toList();
    }
    private Map<String, Object> view(Tenant tenant) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", tenant.getId()); item.put("society", tenant.getSocietyName());
        item.put("plan", tenant.getSubscriptionPlanId() == null ? "No plan assigned" : plans.findById(tenant.getSubscriptionPlanId()).map(p -> p.getName()).orElse("Plan unavailable"));
        item.put("startDate", tenant.getSubscriptionStartedOn());
        item.put("endDate", tenant.getSubscriptionRenewsOn());
        item.put("expiryState", expiryState(tenant.getSubscriptionRenewsOn(), LocalDate.now()));
        item.put("daysRemaining", tenant.getSubscriptionRenewsOn() == null ? null : ChronoUnit.DAYS.between(LocalDate.now(), tenant.getSubscriptionRenewsOn()));
        item.put("adminAccessSuspended", Boolean.TRUE.equals(tenant.getAdminAccessSuspended()));
        return item;
    }
    public record AccessRequest(boolean suspended) {}
    @PutMapping("/{id}/admin-access") @Transactional
    public Map<String, Object> access(@PathVariable("id") Long id, @RequestBody AccessRequest request) {
        Tenant tenant = tenants.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Society was not found"));
        tenant.setAdminAccessSuspended(request.suspended());
        tenants.save(tenant);
        return view(tenant);
    }
}
