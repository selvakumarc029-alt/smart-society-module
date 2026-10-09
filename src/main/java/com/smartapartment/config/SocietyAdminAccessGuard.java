package com.smartapartment.config;

import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class SocietyAdminAccessGuard implements WebMvcConfigurer, HandlerInterceptor {
    private final AppUserRepository users;
    private final TenantRepository tenants;
    public SocietyAdminAccessGuard(AppUserRepository users, TenantRepository tenants) { this.users = users; this.tenants = tenants; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**", "/dashboards/**", "/admin/**", "/dashboard")
            .excludePathPatterns("/api/property/**", "/api/properties/**", "/api/admin/properties/**", "/api/auth/**", "/dashboards/logout");
    }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return true;
        var user = users.findByEmail(authentication.getName()).orElse(null);
        if (user == null || user.getRole() != UserRole.SOCIETY_ADMIN || "propertydirect".equalsIgnoreCase(user.getTenantId())) return true;
        boolean suspended = tenants.findByCode(user.getTenantId()).map(t -> Boolean.TRUE.equals(t.getAdminAccessSuspended())).orElse(false);
        if (!suspended) return true;
        response.setStatus(403);
        if (request.getRequestURI().startsWith("/api/")) {
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Society admin access has been suspended by the superadmin. Contact platform support.\",\"code\":\"ADMIN_ACCESS_SUSPENDED\"}");
        } else {
            response.setContentType("text/html;charset=UTF-8");
            response.getWriter().write("<!doctype html><html lang='en'><title>Admin access suspended</title><body style='font:18px system-ui;padding:48px'><h1>Admin access suspended</h1><p>The superadmin has suspended this society's admin access. Contact platform support to restore access.</p><a href='/dashboards/logout'>Sign out</a></body></html>");
        }
        return false;
    }
}
