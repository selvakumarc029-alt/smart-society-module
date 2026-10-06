package com.smartapartment.controller;


import com.smartapartment.entity.SubscriptionPlan;
import com.smartapartment.entity.Tenant;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.SubscriptionPlanRepository;
import com.smartapartment.repository.TenantRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
@SuppressWarnings("null")
public class PlatformApiController {

    private final TenantRepository tenants;
    private final SubscriptionPlanRepository plans;
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public PlatformApiController(TenantRepository tenants, SubscriptionPlanRepository plans,
                                 AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.tenants = tenants;
        this.plans = plans;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        List<Tenant> realTenants = tenants.findAllByOrderByCreatedAtDesc().stream().filter(this::isRealTenant).toList();
        long realUsers = users.findAll().stream().filter(user -> !"green-heights".equalsIgnoreCase(user.getTenantId())).count();
        long pending = realTenants.stream().filter(tenant -> !tenant.isApproved()).count();
        return Map.of(
                "tenants", realTenants.size(),
                "users", realUsers,
                "plans", plans.count(),
                "pendingTenants", pending,
                "activeSocieties", realTenants.stream().filter(Tenant::isApproved).count(),
                "monthlyRevenue", 0,
                "trialAccounts", pending,
                "openTickets", 0
        );
    }

    @GetMapping("/tenants")
    public List<Tenant> tenants() {
        return tenants.findAllByOrderByCreatedAtDesc().stream().filter(this::isRealTenant).toList();
    }

    @PostMapping("/tenants")
    @Transactional
    public Tenant createTenant(@Valid @RequestBody TenantRequest request) {
        requireText(request.adminName(), "Administrator name is required");
        requireText(request.adminEmail(), "Administrator email is required");
        requireText(request.adminPhone(), "Administrator phone number is required");
        requireText(request.adminPassword(), "Administrator password is required");
        if (request.adminPassword().length() < 8) {
            throw new IllegalArgumentException("Administrator password must contain at least 8 characters");
        }
        if (!request.adminPassword().matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,72}$")) {
            throw new IllegalArgumentException("Administrator password must include uppercase, lowercase, number and symbol");
        }
        String adminEmail = request.adminEmail().trim().toLowerCase(java.util.Locale.ROOT);
        if (users.findByEmail(adminEmail).isPresent()) {
            throw new IllegalArgumentException("An account with this administrator email already exists");
        }
        Tenant tenant = new Tenant();
        String tenantCode = nextTenantCode(request.societyName());
        tenant.setCode(tenantCode);
        tenant.setTenantId(tenantCode);
        updateTenantFields(tenant, request);
        tenant.setApproved(Boolean.TRUE.equals(request.approved()));
        Tenant savedTenant = tenants.save(tenant);

        AppUser administrator = new AppUser();
        administrator.setTenantId(tenantCode);
        administrator.setFullName(request.adminName().trim());
        administrator.setEmail(adminEmail);
        administrator.setPhone(request.adminPhone().trim());
        administrator.setDesignation(text(request.adminDesignation(), "Primary Society Administrator"));
        administrator.setRole(UserRole.SOCIETY_ADMIN);
        administrator.setPasswordHash(passwordEncoder.encode(request.adminPassword()));
        administrator.setAccountLocked(false);
        users.save(administrator);
        return savedTenant;
    }

    @PutMapping("/tenants/{id}")
    @Transactional
    public Tenant updateTenant(@PathVariable Long id, @Valid @RequestBody TenantRequest request) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        updateTenantFields(tenant, request);
        updateTenantAdministrator(tenant, request);
        return tenants.save(tenant);
    }

    @PatchMapping("/tenants/{id}/approval")
    @Transactional
    public Tenant approval(@PathVariable Long id, @RequestParam boolean approved) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        tenant.setApproved(approved);
        return tenants.save(tenant);
    }

    @GetMapping("/plans")
    @Transactional
    public List<SubscriptionPlan> plans() {
        ensureDefaultPlans();
        return plans.findAll().stream()
                .filter(plan -> "platform".equalsIgnoreCase(plan.getTenantId()))
                .filter(plan -> plan.getPlanCode() != null && !plan.getPlanCode().isBlank())
                .sorted(java.util.Comparator.comparing(SubscriptionPlan::getId))
                .toList();
    }

    private synchronized void ensureDefaultPlans() {
        boolean hasGold = plans.findAll().stream().anyMatch(p -> "GOLD".equalsIgnoreCase(p.getPlanCode()));
        boolean hasPlatinum = plans.findAll().stream().anyMatch(p -> "PLATINUM".equalsIgnoreCase(p.getPlanCode()));
        boolean hasDiamond = plans.findAll().stream().anyMatch(p -> "DIAMOND".equalsIgnoreCase(p.getPlanCode()));

        if (!hasGold) {
            SubscriptionPlan gold = new SubscriptionPlan();
            gold.setTenantId("platform");
            gold.setName("Gold Plan");
            gold.setPlanCode("GOLD");
            gold.setDescription("Essential apartment society management for small to mid-sized gated communities.");
            gold.setMonthlyPrice(new BigDecimal("2999"));
            gold.setMaxApartments(150);
            gold.setMaxResidents(500);
            gold.setMaxAdmins(2);
            gold.setMaxSecurityStaff(5);
            gold.setMaxMaintenanceStaff(5);
            gold.setStorageGb(10);
            gold.setAuditHistoryDays(90);
            gold.setSupportLevel("STANDARD");
            gold.setBillingCycle("MONTHLY");
            gold.setActive(true);
            gold.setFeatured(false);
            gold.setVisitorManagement(true);
            gold.setComplaintManagement(true);
            gold.setAnnouncementManagement(true);
            gold.setBillingManagement(true);
            gold.setAmenityBooking(false);
            gold.setExpenseManagement(false);
            gold.setAnalytics(false);
            gold.setPaymentGateway(true);
            gold.setApiAccess(false);
            gold.setPrioritySupport(false);
            plans.save(gold);
        }

        if (!hasPlatinum) {
            SubscriptionPlan plat = new SubscriptionPlan();
            plat.setTenantId("platform");
            plat.setName("Platinum Plan");
            plat.setPlanCode("PLATINUM");
            plat.setDescription("Advanced automation and amenities management for growing residential complexes.");
            plat.setMonthlyPrice(new BigDecimal("5999"));
            plat.setMaxApartments(400);
            plat.setMaxResidents(1500);
            plat.setMaxAdmins(5);
            plat.setMaxSecurityStaff(15);
            plat.setMaxMaintenanceStaff(15);
            plat.setStorageGb(30);
            plat.setAuditHistoryDays(180);
            plat.setSupportLevel("PRIORITY");
            plat.setBillingCycle("MONTHLY");
            plat.setActive(true);
            plat.setFeatured(true);
            plat.setVisitorManagement(true);
            plat.setComplaintManagement(true);
            plat.setAnnouncementManagement(true);
            plat.setBillingManagement(true);
            plat.setAmenityBooking(true);
            plat.setExpenseManagement(true);
            plat.setAnalytics(true);
            plat.setPaymentGateway(true);
            plat.setApiAccess(false);
            plat.setPrioritySupport(true);
            plans.save(plat);
        }

        if (!hasDiamond) {
            SubscriptionPlan dia = new SubscriptionPlan();
            dia.setTenantId("platform");
            dia.setName("Diamond Plan");
            dia.setPlanCode("DIAMOND");
            dia.setDescription("Enterprise society operating system with full API access, unlimited scale, and dedicated SLA.");
            dia.setMonthlyPrice(new BigDecimal("9999"));
            dia.setMaxApartments(1000);
            dia.setMaxResidents(4000);
            dia.setMaxAdmins(15);
            dia.setMaxSecurityStaff(50);
            dia.setMaxMaintenanceStaff(50);
            dia.setStorageGb(100);
            dia.setAuditHistoryDays(365);
            dia.setSupportLevel("24_7_DEDICATED");
            dia.setBillingCycle("MONTHLY");
            dia.setActive(true);
            dia.setFeatured(false);
            dia.setVisitorManagement(true);
            dia.setComplaintManagement(true);
            dia.setAnnouncementManagement(true);
            dia.setBillingManagement(true);
            dia.setAmenityBooking(true);
            dia.setExpenseManagement(true);
            dia.setAnalytics(true);
            dia.setPaymentGateway(true);
            dia.setApiAccess(true);
            dia.setPrioritySupport(true);
            plans.save(dia);
        }
    }

    @PostMapping("/plans")
    @Transactional
    public SubscriptionPlan createPlan(@Valid @RequestBody PlanRequest request) {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setTenantId("platform");
        updatePlanFields(plan, request);
        return plans.save(plan);
    }

    @PutMapping("/plans/{id}")
    @Transactional
    public SubscriptionPlan updatePlan(@PathVariable Long id, @Valid @RequestBody PlanRequest request) {
        SubscriptionPlan plan = plans.findById(id).orElseGet(() -> {
            SubscriptionPlan newPlan = new SubscriptionPlan();
            newPlan.setTenantId("platform");
            return newPlan;
        });
        updatePlanFields(plan, request);
        return plans.save(plan);
    }

    @PutMapping("/tenants/{id}/plan")
    @Transactional
    public Tenant updateTenantPlan(@PathVariable Long id, @RequestParam Long planId) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        SubscriptionPlan plan = plans.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Plan was not found"));
        if (Boolean.FALSE.equals(plan.getActive())) throw new IllegalArgumentException("Only an active catalogue plan can be assigned");
        tenant.setSubscriptionPlanId(plan.getId());
        tenant.setSubscriptionStartedOn(java.time.LocalDate.now());
        tenant.setSubscriptionRenewsOn(java.time.LocalDate.now().plusMonths(1));
        tenant.setSubscriptionStatus("ACTIVE");
        return tenants.save(tenant);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return users.findAll().stream()
                .filter(user -> !"green-heights".equalsIgnoreCase(user.getTenantId()))
                .map(this::platformUserView)
                .toList();
    }

    private Map<String, Object> platformUserView(AppUser user) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", user.getId());
        view.put("name", user.getFullName());
        view.put("email", user.getEmail());
        view.put("phone", user.getPhone());
        view.put("designation", user.getDesignation());
        view.put("employeeId", user.getEmployeeId());
        view.put("joiningDate", user.getJoiningDate());
        view.put("workShift", user.getWorkShift());
        view.put("address", user.getAddress());
        view.put("emergencyContactName", user.getEmergencyContactName());
        view.put("emergencyContactPhone", user.getEmergencyContactPhone());
        view.put("profileNotes", user.getProfileNotes());
        view.put("mfaEnabled", user.isMfaEnabled());
        view.put("mobileAppAuthorized", user.isMobileAppAuthorized());
        view.put("role", user.getRole());
        view.put("tenantId", user.getTenantId());
        view.put("locked", user.isAccountLocked());
        return view;
    }

    private boolean isRealTenant(Tenant tenant) {
        return tenant != null && !"green-heights".equalsIgnoreCase(tenant.getCode())
                && !"green-heights".equalsIgnoreCase(tenant.getTenantId());
    }

    @PutMapping("/users/{id}")
    @Transactional
    public Map<String, Object> updateUser(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        AppUser user = users.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User was not found"));
        user.setFullName(request.fullName().trim());
        user.setRole(request.role());
        user.setAccountLocked(request.locked());
        if (request.email() != null && !request.email().isBlank()) {
            String email = request.email().trim().toLowerCase(java.util.Locale.ROOT);
            if (users.findByEmail(email).filter(existing -> !existing.getId().equals(user.getId())).isPresent()) {
                throw new IllegalArgumentException("Another account already uses this email address");
            }
            user.setEmail(email);
        }
        user.setPhone(text(request.phone(), user.getPhone()));
        user.setDesignation(text(request.designation(), user.getDesignation()));
        user.setEmployeeId(text(request.employeeId(), user.getEmployeeId()));
        user.setJoiningDate(request.joiningDate() == null ? user.getJoiningDate() : request.joiningDate());
        user.setWorkShift(text(request.workShift(), user.getWorkShift()));
        user.setAddress(text(request.address(), user.getAddress()));
        user.setEmergencyContactName(text(request.emergencyContactName(), user.getEmergencyContactName()));
        user.setEmergencyContactPhone(text(request.emergencyContactPhone(), user.getEmergencyContactPhone()));
        user.setProfileNotes(text(request.profileNotes(), user.getProfileNotes()));
        user.setMfaEnabled(request.mfaEnabled());
        user.setMobileAppAuthorized(request.mobileAppAuthorized());
        AppUser saved = users.save(user);
        return Map.of("id", saved.getId(), "name", saved.getFullName(), "role", saved.getRole(),
                "locked", saved.isAccountLocked());
    }

    private void updatePlanFields(SubscriptionPlan plan, PlanRequest request) {
        plan.setName(request.name());
        plan.setPlanCode(text(request.planCode(), plan.getPlanCode()));
        plan.setDescription(text(request.description(), plan.getDescription()));
        plan.setMonthlyPrice(request.monthlyPrice());
        plan.setMaxApartments(request.maxApartments());
        plan.setMaxResidents(request.maxResidents());
        plan.setMaxAdmins(number(request.maxAdmins(), plan.getMaxAdmins(), 1));
        plan.setMaxSecurityStaff(number(request.maxSecurityStaff(), plan.getMaxSecurityStaff(), 1));
        plan.setMaxMaintenanceStaff(number(request.maxMaintenanceStaff(), plan.getMaxMaintenanceStaff(), 1));
        plan.setStorageGb(number(request.storageGb(), plan.getStorageGb(), 5));
        plan.setAuditHistoryDays(number(request.auditHistoryDays(), plan.getAuditHistoryDays(), 30));
        plan.setTrialDays(number(request.trialDays(), plan.getTrialDays(), 0));
        plan.setGraceDays(number(request.graceDays(), plan.getGraceDays(), 0));
        plan.setBillingCycle(text(request.billingCycle(), plan.getBillingCycle() == null ? "MONTHLY" : plan.getBillingCycle()));
        plan.setSupportLevel(text(request.supportLevel(), plan.getSupportLevel() == null ? "STANDARD" : plan.getSupportLevel()));
        plan.setActive(request.active() == null ? (plan.getActive() == null ? Boolean.TRUE : plan.getActive()) : request.active());
        plan.setFeatured(request.featured() == null ? Boolean.TRUE.equals(plan.getFeatured()) : request.featured());
        plan.setVisitorManagement(request.visitorManagement());
        plan.setAmenityBooking(request.amenityBooking());
        plan.setAnalytics(request.analytics());
        plan.setBillingManagement(Boolean.TRUE.equals(request.billingManagement()));
        plan.setComplaintManagement(Boolean.TRUE.equals(request.complaintManagement()));
        plan.setAnnouncementManagement(Boolean.TRUE.equals(request.announcementManagement()));
        plan.setExpenseManagement(Boolean.TRUE.equals(request.expenseManagement()));
        plan.setPaymentGateway(Boolean.TRUE.equals(request.paymentGateway()));
        plan.setApiAccess(Boolean.TRUE.equals(request.apiAccess()));
        plan.setPrioritySupport(Boolean.TRUE.equals(request.prioritySupport()));
    }

    private static String text(String requested, String fallback) {
        return requested == null ? (fallback == null ? "" : fallback) : requested.trim();
    }

    private static int number(Integer requested, Integer existing, int fallback) {
        return requested == null ? (existing == null ? fallback : existing) : Math.max(0, requested);
    }

    private static void requireText(String value, String message) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(message);
    }

    private void updateTenantFields(Tenant tenant, TenantRequest request) {
        tenant.setSocietyName(request.societyName().trim());
        tenant.setCity(request.city().trim());
        tenant.setContactEmail(text(request.contactEmail() == null ? request.adminEmail() : request.contactEmail(), tenant.getContactEmail()));
        tenant.setContactName(text(request.contactName() == null ? request.adminName() : request.contactName(), tenant.getContactName()));
        tenant.setPhone(text(request.phone() == null ? request.adminPhone() : request.phone(), tenant.getPhone()));
        tenant.setWebsite(text(request.website(), tenant.getWebsite()));
        tenant.setAddress(text(request.address(), tenant.getAddress()));
        tenant.setState(text(request.state(), tenant.getState()));
        tenant.setCountry(text(request.country(), tenant.getCountry()));
        tenant.setPostalCode(text(request.postalCode(), tenant.getPostalCode()));
        tenant.setSocietyType(text(request.societyType(), tenant.getSocietyType()));
        tenant.setRegistrationNumber(text(request.registrationNumber(), tenant.getRegistrationNumber()));
        tenant.setOnboardingNotes(text(request.onboardingNotes(), tenant.getOnboardingNotes()));
        if (request.totalUnits() != null) tenant.setTotalUnits(Math.max(0, request.totalUnits()));
        if (request.totalWings() != null) tenant.setTotalWings(Math.max(0, request.totalWings()));
        if (request.approved() != null) tenant.setApproved(request.approved());
        if (request.subscriptionPlanId() != null) {
            SubscriptionPlan plan = plans.findById(request.subscriptionPlanId())
                    .orElseThrow(() -> new IllegalArgumentException("Subscription plan was not found"));
            if (Boolean.FALSE.equals(plan.getActive())) throw new IllegalArgumentException("Select an active catalogue plan");
            tenant.setSubscriptionPlanId(plan.getId());
            tenant.setSubscriptionStartedOn(java.time.LocalDate.now());
            tenant.setSubscriptionRenewsOn(java.time.LocalDate.now().plusMonths(1));
            tenant.setSubscriptionStatus("ACTIVE");
        }
    }

    private void updateTenantAdministrator(Tenant tenant, TenantRequest request) {
        AppUser administrator = users.findByTenantId(tenant.getTenantId()).stream()
                .filter(user -> user.getRole() == UserRole.SOCIETY_ADMIN || user.getRole() == UserRole.FACILITY_MANAGER)
                .findFirst()
                .orElse(null);
        if (administrator == null) return;

        if (request.adminName() != null && !request.adminName().isBlank()) {
            administrator.setFullName(request.adminName().trim());
        }
        if (request.adminDesignation() != null && !request.adminDesignation().isBlank()) {
            administrator.setDesignation(request.adminDesignation().trim());
        }
        if (request.adminPhone() != null && !request.adminPhone().isBlank()) {
            administrator.setPhone(request.adminPhone().trim());
        }
        if (request.adminEmail() != null && !request.adminEmail().isBlank()) {
            String email = request.adminEmail().trim().toLowerCase(java.util.Locale.ROOT);
            if (users.findByEmail(email).filter(existing -> !existing.getId().equals(administrator.getId())).isPresent()) {
                throw new IllegalArgumentException("An account with this administrator email already exists");
            }
            administrator.setEmail(email);
        }
        if (request.adminPassword() != null && !request.adminPassword().isBlank()) {
            if (!request.adminPassword().matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,72}$")) {
                throw new IllegalArgumentException("Administrator password must include uppercase, lowercase, number and symbol");
            }
            administrator.setPasswordHash(passwordEncoder.encode(request.adminPassword()));
        }
        users.save(administrator);
    }

    private String nextTenantCode(String societyName) {
        String base = societyName.toUpperCase().replaceAll("[^A-Z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "SOCIETY";
        base = base.length() > 24 ? base.substring(0, 24) : base;
        String code = base;
        int suffix = 2;
        while (tenants.findByCode(code).isPresent()) {
            code = base + "-" + suffix++;
        }
        return code;
    }

    public record PlanRequest(
            @NotBlank String name,
            @NotNull @PositiveOrZero BigDecimal monthlyPrice,
            @Positive int maxApartments,
            @Positive int maxResidents,
            boolean visitorManagement,
            boolean amenityBooking,
            boolean analytics,
            String planCode,
            String description,
            Integer maxAdmins,
            Integer maxSecurityStaff,
            Integer maxMaintenanceStaff,
            Integer storageGb,
            Integer auditHistoryDays,
            Integer trialDays,
            Integer graceDays,
            String billingCycle,
            String supportLevel,
            Boolean active,
            Boolean featured,
            Boolean billingManagement,
            Boolean complaintManagement,
            Boolean announcementManagement,
            Boolean expenseManagement,
            Boolean paymentGateway,
            Boolean apiAccess,
            Boolean prioritySupport
    ) {}

    public record TenantRequest(
            @NotBlank String societyName,
            @NotBlank String city,
            @Email String contactEmail,
            String contactName,
            @Pattern(regexp = "^[0-9]{10}$", message = "Phone number must contain exactly 10 digits") String phone,
            String website,
            String address,
            String state,
            String country,
            String postalCode,
            String societyType,
            String registrationNumber,
            @PositiveOrZero Integer totalUnits,
            @PositiveOrZero Integer totalWings,
            String onboardingNotes,
            Long subscriptionPlanId,
            Boolean approved,
            String adminName,
            String adminDesignation,
            @Email String adminEmail,
            @Pattern(regexp = "^[0-9]{10}$", message = "Administrator phone number must contain exactly 10 digits") String adminPhone,
            @Size(min = 8, max = 72) String adminPassword
    ) {}

    public record UserRequest(@NotBlank String fullName, @Email String email, String phone, String designation,
                              String employeeId, java.time.LocalDate joiningDate, String workShift, String address,
                              String emergencyContactName, String emergencyContactPhone, String profileNotes,
                              @NotNull UserRole role, boolean locked, boolean mfaEnabled,
                              boolean mobileAppAuthorized) {}
}
