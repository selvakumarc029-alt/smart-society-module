package com.smartapartment;

import com.smartapartment.config.SocietyAdminAccessGuard;
import com.smartapartment.controller.superadmin.SubscriptionLifecycleController;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import static org.junit.jupiter.api.Assertions.*;

public class SubscriptionLifecycleTest {
    @Test void expiryBoundaries() {
        LocalDate today = LocalDate.of(2026, 10, 9);
        assertEquals("NOT_SCHEDULED", SubscriptionLifecycleController.expiryState(null, today));
        assertEquals("EXPIRED", SubscriptionLifecycleController.expiryState(today.minusDays(1), today));
        assertEquals("EXPIRING", SubscriptionLifecycleController.expiryState(today, today));
        assertEquals("EXPIRING", SubscriptionLifecycleController.expiryState(today.plusDays(7), today));
        assertEquals("CURRENT", SubscriptionLifecycleController.expiryState(today.plusDays(8), today));
    }
    @Test void suspensionBlocksExistingSessionsAndRestorePreservesPlan() throws Exception {
        Tenant tenant = new Tenant(); tenant.setId(1L); tenant.setCode("test-society"); tenant.setSocietyName("Test society"); tenant.setSubscriptionStatus("ACTIVE");
        AppUser user = new AppUser(); user.setEmail("admin@test.local"); user.setTenantId("test-society"); user.setRole(UserRole.SOCIETY_ADMIN);
        TenantRepository tenants = (TenantRepository) Proxy.newProxyInstance(TenantRepository.class.getClassLoader(), new Class<?>[]{TenantRepository.class}, (p, method, args) -> switch (method.getName()) {
            case "findById", "findByCode" -> Optional.of(tenant);
            case "findAllByOrderByCreatedAtDesc" -> List.of(tenant);
            case "save" -> args[0]; default -> null;
        });
        AppUserRepository users = (AppUserRepository) Proxy.newProxyInstance(AppUserRepository.class.getClassLoader(), new Class<?>[]{AppUserRepository.class}, (p, method, args) -> Optional.of(user));
        SubscriptionLifecycleController controller = new SubscriptionLifecycleController(tenants, null);
        assertEquals("hasRole('SUPER_ADMIN')", SubscriptionLifecycleController.class.getAnnotation(PreAuthorize.class).value());
        var proxyFactory = new org.springframework.aop.framework.ProxyFactory(controller);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvisor(org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        var secured = (SubscriptionLifecycleController) proxyFactory.getProxy();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "", List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_SOCIETY_ADMIN"))));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> secured.access(1L, new SubscriptionLifecycleController.AccessRequest(true)));
        assertFalse(Boolean.TRUE.equals(tenant.getAdminAccessSuspended()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("superadmin@test.local", "", List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
        assertNotNull(secured.list());
        SocietyAdminAccessGuard guard = new SocietyAdminAccessGuard(users, tenants);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "", List.of()));
        try {
            controller.access(1L, new SubscriptionLifecycleController.AccessRequest(true));
            MockHttpServletResponse response = new MockHttpServletResponse();
            assertFalse(guard.preHandle(new MockHttpServletRequest("GET", "/api/society/overview"), response, new Object()));
            assertEquals(403, response.getStatus()); assertTrue(response.getContentAsString().contains("ADMIN_ACCESS_SUSPENDED"));
            user.setRole(UserRole.SUPER_ADMIN);
            assertTrue(guard.preHandle(new MockHttpServletRequest("GET", "/api/superadmin/subscription-lifecycle"), new MockHttpServletResponse(), new Object()));
            user.setRole(UserRole.RESIDENT);
            assertTrue(guard.preHandle(new MockHttpServletRequest("GET", "/api/society/overview"), new MockHttpServletResponse(), new Object()));
            user.setRole(UserRole.SOCIETY_ADMIN); user.setTenantId("propertydirect");
            assertTrue(guard.preHandle(new MockHttpServletRequest("GET", "/dashboard"), new MockHttpServletResponse(), new Object()));
            user.setTenantId("test-society");
            controller.access(1L, new SubscriptionLifecycleController.AccessRequest(false));
            assertTrue(guard.preHandle(new MockHttpServletRequest("GET", "/api/society/overview"), new MockHttpServletResponse(), new Object()));
            assertEquals("ACTIVE", tenant.getSubscriptionStatus());
        } finally { SecurityContextHolder.clearContext(); }
    }
    public static void main(String[] args) throws Exception {
        SubscriptionLifecycleTest test = new SubscriptionLifecycleTest(); test.expiryBoundaries(); test.suspensionBlocksExistingSessionsAndRestorePreservesPlan();
        System.out.println("Subscription lifecycle tests passed: expiry boundaries, existing-session suspension, restore, role isolation, superadmin authorization.");
    }
}
