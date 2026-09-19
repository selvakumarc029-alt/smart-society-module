package com.smartapartment.controller;

import com.smartapartment.security.TenantContext;
import com.smartapartment.service.DashboardService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import com.smartapartment.repository.TenantRepository;
import com.smartapartment.repository.VisitorRepository;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Visitor;
import java.util.List;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class DashboardController {

    private final DashboardService dashboardService;
    private final TenantRepository tenantRepository;
    private final CurrentUserService currentUser;
    private final VisitorRepository visitors;

    public DashboardController(DashboardService dashboardService, TenantRepository tenantRepository,
                               CurrentUserService currentUser, VisitorRepository visitors) {
        this.dashboardService = dashboardService;
        this.tenantRepository = tenantRepository;
        this.currentUser = currentUser;
        this.visitors = visitors;
    }

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping({"/saas", "/saas/"})
    public String saasHome() {
        return "redirect:/#products";
    }

    @GetMapping("/login")
    public String login() {
        return "redirect:/";
    }

    @GetMapping("/dashboards/logout")
    public String logout(HttpSession session, @RequestParam(defaultValue = "smartapartment") String platform) {
        session.invalidate();
        return "propertydirect".equalsIgnoreCase(platform) ? "redirect:/propertydirect" : "redirect:/?loggedOut=true";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        model.addAttribute("stats", dashboardService.stats(TenantContext.getOrDefault()));
        return "redirect:/dashboards/society-admin";
    }

    @GetMapping("/dashboards/superadmin")
    public String superAdminDashboard(HttpSession session, Model model) {
        if (!isLoggedIn(session, "smartapartment", "superadmin")) return "redirect:/?loginRequired=true";
        model.addAttribute("societies", tenantRepository.findAll());
        return "dashboards/superadmin";
    }

    @GetMapping("/dashboards/society-admin")
    public String societyAdminDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "admin")) return "redirect:/?loginRequired=true";
        return "dashboards/society-admin";
    }

    @GetMapping("/dashboards/resident")
    public String residentDashboard(HttpSession session) {
        session.setAttribute("dashboard:smartapartment:resident", Boolean.TRUE);
        return "dashboards/resident";
    }

    @GetMapping("/dashboards/resident-maintenance")
    public String residentMaintenanceTracking(HttpSession session) {
        session.setAttribute("dashboard:smartapartment:resident", Boolean.TRUE);
        return "dashboards/resident-maintenance";
    }

    @GetMapping("/dashboards/security")
    public String securityDashboard(HttpSession session, Model model, @RequestParam(required = false) String notice) {
        if (!isLoggedIn(session, "smartapartment", "security")) return "redirect:/?loginRequired=true";
        AppUser user = currentUser.requireUser();
        List<Visitor> securityVisitors = visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId());
        model.addAttribute("securityVisitors", securityVisitors);
        model.addAttribute("securityActiveVisitors", securityVisitors.stream()
                .filter(visitor -> "CHECKED_IN".equals(visitor.getStatus())).toList());
        model.addAttribute("notice", notice);
        return "dashboards/security";
    }

    @GetMapping("/dashboards/maintenance")
    public String maintenanceDashboard(HttpSession session, Model model) {
        session.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);
        boolean isSuperAdmin = isLoggedIn(session, "smartapartment", "superadmin")
                || isLoggedIn(session, "propertydirect", "superadmin");
        boolean isMaintenance = true;
        boolean isMaintenanceAdmin = false;
        if (isMaintenance) {
            try {
                AppUser user = currentUser.requireUser();
                String email = user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase();
                isMaintenanceAdmin = "maintenance@smartapartment".equals(email)
                        || "maintenance@smartsociety".equals(email);
            } catch (RuntimeException ignored) {
                isMaintenanceAdmin = false;
            }
        }
        model.addAttribute("maintenanceSuperAdmin", isSuperAdmin || isMaintenanceAdmin);
        return "dashboards/maintenance";
    }

    @GetMapping("/dashboards/accountant")
    public String accountantDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "accountant")) return "redirect:/?loginRequired=true";
        return "dashboards/accountant";
    }

    @GetMapping("/resident/update-details")
    public String residentUpdateDetails(@RequestParam(required = false) String token, Model model) {
        model.addAttribute("token", token != null ? token : "");
        return "resident/update-details";
    }

    @GetMapping("/terms/onboarding")
    public String onboardingTerms() {
        return "terms/onboarding";
    }

    @GetMapping("/terms/daily-operations")
    public String dailyOperationsTerms() {
        return "terms/daily-operations";
    }

    @GetMapping("/terms/finance-reports")
    public String financeReportsTerms() {
        return "terms/finance-reports";
    }

    @GetMapping({"/propertydirect", "/propertydirect/"})
    public String propertyDirectHome() {
        return "propertydirect/index";
    }

    @GetMapping("/propertydirect/apartments")
    public String propertyDirectApartments() {
        return "propertydirect/apartments";
    }

    @GetMapping("/propertydirect/apartment-detail")
    public String propertyDirectApartmentDetail() {
        return "propertydirect/apartment-detail";
    }

    /** Keeps previously shared PropertyDirect listing URLs working after the detail route consolidation. */
    @GetMapping("/propertydirect/property/{slug}")
    public String legacyPropertyDirectDetail(@PathVariable String slug, @RequestParam(required = false) String id) {
        if (id != null && id.matches("\\d+")) {
            return "redirect:/propertydirect/apartment-detail?id=" + id;
        }
        return "redirect:/propertydirect/apartments";
    }

    @GetMapping("/propertydirect/contact")
    public String propertyDirectContact() {
        return "redirect:/propertydirect/#contact";
    }

    @GetMapping("/propertydirect/dashboards/superadmin")
    public String propertyDirectSuperAdmin(HttpSession session) {
        return propertyDirectDashboard(session, "superadmin", "propertydirect/dashboards/superadmin");
    }

    @GetMapping("/propertydirect/dashboards/admin")
    public String propertyDirectAdmin(HttpSession session) {
        return propertyDirectDashboard(session, "admin", "propertydirect/dashboards/admin");
    }

    @GetMapping("/propertydirect/dashboards/customer")
    public String propertyDirectCustomer(HttpSession session) {
        return propertyDirectDashboard(session, "customer", "propertydirect/dashboards/customer");
    }

    @GetMapping("/propertydirect/dashboards/agent")
    public String propertyDirectAgent(HttpSession session) {
        return propertyDirectDashboard(session, "agent", "propertydirect/dashboards/agent");
    }

    @GetMapping("/propertydirect/dashboards/vendor")
    public String propertyDirectVendor(HttpSession session) {
        return propertyDirectDashboard(session, "vendor", "propertydirect/dashboards/vendor");
    }

    @GetMapping("/propertydirect/terms/apartment-search")
    public String propertyDirectApartmentSearchTerms() {
        return "propertydirect/terms/apartment-search";
    }

    @GetMapping("/propertydirect/terms/post-property")
    public String propertyDirectPostPropertyTerms() {
        return "propertydirect/terms/post-property";
    }

    @GetMapping("/propertydirect/terms/services-payments")
    public String propertyDirectServicesPaymentsTerms() {
        return "propertydirect/terms/services-payments";
    }

    @GetMapping("/propertydirect/terms/plans-dashboards")
    public String propertyDirectPlansDashboardsTerms() {
        return "propertydirect/terms/plans-dashboards";
    }

    private boolean isLoggedIn(HttpSession session, String platform, String role) {
        return Boolean.TRUE.equals(session.getAttribute("dashboard:" + platform + ":" + role));
    }

    /**
     * A dashboard route must only consume the role session created by the login
     * endpoint.  Never set a role here: doing so turns a bookmarked URL into an
     * authentication bypass.
     */
    private String propertyDirectDashboard(HttpSession session, String role, String view) {
        if (!isLoggedIn(session, "propertydirect", role)) {
            return "redirect:/propertydirect?loginRequired=true";
        }
        return view;
    }
}
