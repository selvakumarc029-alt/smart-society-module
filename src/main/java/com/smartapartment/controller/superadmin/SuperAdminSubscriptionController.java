package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.SubscriptionBillingRule;
import com.smartapartment.entity.SubscriptionPlan;
import com.smartapartment.entity.Tenant;
import com.smartapartment.repository.SubscriptionBillingRuleRepository;
import com.smartapartment.repository.SubscriptionPlanRepository;
import com.smartapartment.repository.TenantRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/superadmin/subscriptions")
public class SuperAdminSubscriptionController {
    private final SubscriptionBillingRuleRepository rules;
    private final TenantRepository tenants;
    private final SubscriptionPlanRepository plans;

    public SuperAdminSubscriptionController(SubscriptionBillingRuleRepository rules, TenantRepository tenants,
                                            SubscriptionPlanRepository plans) {
        this.rules = rules;
        this.tenants = tenants;
        this.plans = plans;
    }

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getSubscriptionData() {
        Map<Long, SubscriptionPlan> planById = plans.findAll().stream()
                .collect(Collectors.toMap(SubscriptionPlan::getId, Function.identity(), (first, ignored) -> first));
        List<Map<String, Object>> payments = tenants.findAllByOrderByCreatedAtDesc().stream()
                .filter(this::isRealTenant)
                .filter(tenant -> tenant.getSubscriptionPlanId() != null && planById.containsKey(tenant.getSubscriptionPlanId()))
                .map(tenant -> subscriptionPayment(tenant, planById.get(tenant.getSubscriptionPlanId())))
                .toList();
        long paidSocieties = payments.stream().filter(item -> Boolean.TRUE.equals(item.get("paid")) && ((BigDecimal) item.get("billingAmount")).signum() > 0).count();
        long pendingSocieties = payments.stream().filter(item -> !Boolean.TRUE.equals(item.get("paid")) && ((BigDecimal) item.get("billingAmount")).signum() > 0).count();
        BigDecimal collectedCharges = payments.stream()
                .filter(item -> Boolean.TRUE.equals(item.get("paid")))
                .map(item -> (BigDecimal) item.get("chargedAmount"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingCharges = payments.stream()
                .filter(item -> !Boolean.TRUE.equals(item.get("paid")))
                .map(item -> (BigDecimal) item.get("billingAmount"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("subscribedSocieties", payments.size());
        summary.put("paidSocieties", paidSocieties);
        summary.put("pendingSocieties", pendingSocieties);
        summary.put("collectedCharges", collectedCharges);
        summary.put("pendingCharges", pendingCharges);

        return ResponseEntity.ok(Map.of(
            "mapping", payments,
            "payments", payments,
            "paymentSummary", summary,
            "admins", List.of(),
            "rules", rules.findAllByOrderByCreatedAtAsc().stream().map(this::billingRuleView).toList()
        ));
    }

    private Map<String, Object> billingRuleView(SubscriptionBillingRule rule) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", rule.getId()); item.put("rule", rule.getRuleName()); item.put("plan", rule.getPlanName());
        item.put("amount", "Rs. " + rule.getAmount()); item.put("cycle", rule.getBillingCycle());
        item.put("grace", rule.getGraceDays() + " days"); item.put("status", rule.getStatus());
        item.put("effectiveFrom", rule.getEffectiveFrom() == null ? "" : rule.getEffectiveFrom().toString());
        item.put("invoicePrefix", clean(rule.getInvoicePrefix())); item.put("taxRate", rule.getTaxRate());
        item.put("lateFee", rule.getLateFee()); item.put("autoRenew", Boolean.TRUE.equals(rule.getAutoRenew()));
        item.put("proratedBilling", Boolean.TRUE.equals(rule.getProratedBilling())); item.put("notes", clean(rule.getNotes()));
        return item;
    }

    private Map<String, Object> subscriptionPayment(Tenant tenant, SubscriptionPlan plan) {
        BigDecimal amount = plan.getMonthlyPrice() == null ? BigDecimal.ZERO : plan.getMonthlyPrice();
        String storedStatus = tenant.getSubscriptionStatus() == null ? "PENDING" : tenant.getSubscriptionStatus().trim().toUpperCase();
        boolean paid = amount.signum() == 0 || List.of("ACTIVE", "PAID", "CURRENT").contains(storedStatus);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("tenantId", tenant.getId());
        item.put("society", tenant.getSocietyName());
        item.put("location", List.of(clean(tenant.getCity()), clean(tenant.getState())).stream().filter(value -> !value.isBlank()).collect(Collectors.joining(", ")));
        item.put("plan", plan.getName());
        item.put("billingCycle", clean(plan.getBillingCycle()).isBlank() ? "MONTHLY" : plan.getBillingCycle());
        item.put("billingAmount", amount);
        item.put("chargedAmount", paid ? amount : BigDecimal.ZERO);
        item.put("paid", paid);
        item.put("paymentStatus", amount.signum() == 0 ? "FREE" : paid ? "PAID" : "PENDING");
        item.put("subscriptionStartedOn", tenant.getSubscriptionStartedOn() == null ? "" : tenant.getSubscriptionStartedOn().toString());
        item.put("nextRenewalOn", tenant.getSubscriptionRenewsOn() == null ? "" : tenant.getSubscriptionRenewsOn().toString());
        return item;
    }

    private boolean isRealTenant(Tenant tenant) {
        return tenant != null && !"green-heights".equalsIgnoreCase(tenant.getCode())
                && !"green-heights".equalsIgnoreCase(tenant.getTenantId());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    @PutMapping("/rules/{id}") @Transactional
    public SubscriptionBillingRule updateBillingRule(@PathVariable Long id, @Valid @RequestBody RuleRequest request) {
        SubscriptionBillingRule rule = rules.findById(id).orElseThrow(() -> new IllegalArgumentException("Billing rule was not found"));
        rule.setRuleName(request.ruleName()); rule.setPlanName(request.planName()); rule.setAmount(request.amount()); rule.setBillingCycle(request.billingCycle()); rule.setGraceDays(request.graceDays()); rule.setStatus(request.status());
        rule.setEffectiveFrom(request.effectiveFrom()); rule.setInvoicePrefix(request.invoicePrefix()); rule.setTaxRate(request.taxRate());
        rule.setLateFee(request.lateFee()); rule.setAutoRenew(request.autoRenew()); rule.setProratedBilling(request.proratedBilling()); rule.setNotes(request.notes());
        return rules.save(rule);
    }

    public record RuleRequest(@NotBlank String ruleName, @NotBlank String planName,
                              @NotNull @PositiveOrZero BigDecimal amount, @NotBlank String billingCycle,
                              @NotNull @PositiveOrZero Integer graceDays, @NotBlank String status,
                              LocalDate effectiveFrom, String invoicePrefix,
                              @PositiveOrZero BigDecimal taxRate, @PositiveOrZero BigDecimal lateFee,
                              boolean autoRenew, boolean proratedBilling, String notes) {}
}
