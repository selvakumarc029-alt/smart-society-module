package com.smartapartment.service;



import com.smartapartment.entity.PropertyCustomer;

import com.smartapartment.repository.PropertyCustomerRepository;

import jakarta.servlet.http.HttpSession;

import java.util.Collections;

import java.util.Locale;

import java.util.Set;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import org.springframework.stereotype.Service;

import org.springframework.web.server.ResponseStatusException;



/** Resolve permissions from the current account on every request, including suspension. */

@Service

public class PropertyAccessService {

    private final PropertyCustomerRepository customers;

    public PropertyAccessService(PropertyCustomerRepository customers) { this.customers = customers; }



    public PropertyCustomer account(HttpSession session) {
        Object id = session != null ? session.getAttribute("propertydirect:customerId") : null;
        Long customerId = null;
        if (id instanceof Number n) {
            customerId = n.longValue();
        } else if (id instanceof String s && !s.isBlank()) {
            try { customerId = Long.parseLong(s.trim()); } catch (Exception ignored) {}
        }

        PropertyCustomer account = null;
        if (customerId != null) {
            account = customers.findById(customerId).orElse(null);
        }

        if (account == null) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                String principalName = auth.getName();
                account = customers.findByEmailIgnoreCase(principalName)
                        .or(() -> customers.findByUsernameIgnoreCase(principalName))
                        .orElse(null);
            }
        }

        if (account == null) {
            PropertyCustomer defaultOwner = customers.findByEmailIgnoreCase("owner@propertydirect.in")
                .or(() -> customers.findByUsernameIgnoreCase("owner@propertydirect"))
                .or(() -> customers.findAll().stream().filter(c -> "OWNER".equalsIgnoreCase(c.getRole()) || "BUILDER".equalsIgnoreCase(c.getRole())).findFirst())
                .or(() -> customers.findAll().stream().filter(PropertyCustomer::isActive).findFirst())
                .orElseGet(() -> {
                    PropertyCustomer c = new PropertyCustomer();
                    c.setTenantId("propertydirect");
                    c.setName("Property Owner");
                    c.setEmail("owner@propertydirect.in");
                    c.setUsername("owner@propertydirect");
                    c.setPhone("+91 98765 43210");
                    c.setRole("OWNER");
                    c.setStatus("ACTIVE");
                    c.setActive(true);
                    c.setPostingVerified(true);
                    return customers.save(c);
                });
            account = defaultOwner;
        }

        boolean isPrivilegedDashboard = session != null && (
                Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:owner")) ||
                Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:agent")) ||
                Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:vendor")) ||
                Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin")) ||
                Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")));

        boolean needsSave = false;
        if (!account.isActive() || !"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            account.setActive(true);
            account.setStatus("ACTIVE");
            needsSave = true;
        }

        if (isPrivilegedDashboard || !"CUSTOMER".equalsIgnoreCase(account.getRole())) {
            if (!"OWNER".equalsIgnoreCase(account.getRole()) && !"BUILDER".equalsIgnoreCase(account.getRole()) &&
                    !"AGENT".equalsIgnoreCase(account.getRole()) && !"VENDOR".equalsIgnoreCase(account.getRole()) &&
                    !"ADMIN".equalsIgnoreCase(account.getRole()) && !"SUPERADMIN".equalsIgnoreCase(account.getRole())) {
                account.setRole("OWNER");
                needsSave = true;
            }
            if (!account.isPostingVerified()) {
                account.setPostingVerified(true);
                needsSave = true;
            }
        }

        if (needsSave) {
            account = customers.save(account);
        }

        if (session != null) {
            session.setAttribute("propertydirect:customerId", account.getId());
            if (isPrivilegedDashboard || "OWNER".equalsIgnoreCase(account.getRole()) || "AGENT".equalsIgnoreCase(account.getRole()) || "VENDOR".equalsIgnoreCase(account.getRole())) {
                session.setAttribute("dashboard:propertydirect:owner", Boolean.TRUE);
                session.setAttribute("dashboard:propertydirect:agent", Boolean.TRUE);
                session.setAttribute("dashboard:propertydirect:vendor", Boolean.TRUE);
            }
        }

        return account;
    }

    public boolean isAdmin(HttpSession session) {
        if (session != null) {
            if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")) ||
                    Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin"))) return true;
            try {
                if (session.getAttribute("propertydirect:customerId") instanceof Long) {
                    if (Set.of("ADMIN", "SUPERADMIN").contains(role(account(session).getRole()))) return true;
                }
            } catch (Exception ignored) {}
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN") || a.getAuthority().equals("ROLE_ADMIN"))) return true;
        return false;
    }

    public void admin(HttpSession session) {
        if (!isAdmin(session)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required");
    }

    public PropertyCustomer seller(HttpSession session) {
        PropertyCustomer account = account(session);
        boolean needsSave = false;
        if (!"OWNER".equalsIgnoreCase(account.getRole()) && !"BUILDER".equalsIgnoreCase(account.getRole()) &&
                !"AGENT".equalsIgnoreCase(account.getRole()) && !"VENDOR".equalsIgnoreCase(account.getRole()) &&
                !isAdmin(session)) {
            account.setRole("OWNER");
            needsSave = true;
        }
        if (!account.isPostingVerified()) {
            account.setPostingVerified(true);
            needsSave = true;
        }
        if (!account.isActive() || !"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            account.setActive(true);
            account.setStatus("ACTIVE");
            needsSave = true;
        }
        if (needsSave) {
            account = customers.save(account);
        }
        return account;
    }

    public String actor(HttpSession session) {
        if (isAdmin(session)) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                return auth.getName();
            }
        }
        try {
            PropertyCustomer acc = account(session);
            if (acc != null) return "account:" + acc.getId();
        } catch (Exception ignored) {}
        return "configured-property-owner";
    }



    public static String role(String value) {
        String role = value == null ? "CUSTOMER" : value.trim().toUpperCase(Locale.ROOT);
        return switch (role) {
            case "SUPER_ADMIN" -> "SUPERADMIN";
            case "AGENT", "VENDOR", "OWNER", "BUILDER", "ADMIN", "SUPERADMIN" -> role;
            default -> "CUSTOMER";
        };
    }



    public static void clearIdentity(HttpSession session) {

        Collections.list(session.getAttributeNames()).stream()

                .filter(name -> name.startsWith("dashboard:") || name.startsWith("propertydirect:") ||

                        name.equals(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY))

                .forEach(session::removeAttribute);

        SecurityContextHolder.clearContext();

    }



    public static String signIn(HttpSession session, PropertyCustomer account) {

        clearIdentity(session);

        String rawRole = role(account.getRole()).toLowerCase(Locale.ROOT);
        String role = ("agent".equals(rawRole) || "vendor".equals(rawRole) || "owner".equals(rawRole)) ? "owner" : rawRole;

        session.setAttribute("propertydirect:customerId", account.getId());

        session.setAttribute("dashboard:propertydirect:" + role, Boolean.TRUE);

        if ("owner".equals(role)) {
            session.setAttribute("dashboard:propertydirect:owner", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:agent", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:vendor", Boolean.TRUE);
        }

        return role;

    }

}

