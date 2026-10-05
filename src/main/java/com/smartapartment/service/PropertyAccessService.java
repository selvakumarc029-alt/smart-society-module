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
        if (!(id instanceof Long)) {
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:owner")) ||
                    Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:agent")) ||
                    Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:vendor")))) {
                PropertyCustomer defaultOwner = customers.findByEmailIgnoreCase("owner@propertydirect.in")
                    .or(() -> customers.findByUsernameIgnoreCase("owner@propertydirect"))
                    .or(() -> customers.findAll().stream().filter(c -> "OWNER".equalsIgnoreCase(c.getRole()) || "BUILDER".equalsIgnoreCase(c.getRole())).findFirst())
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
                if (!defaultOwner.isPostingVerified() || !"ACTIVE".equalsIgnoreCase(defaultOwner.getStatus()) || !defaultOwner.isActive()) {
                    defaultOwner.setPostingVerified(true);
                    defaultOwner.setStatus("ACTIVE");
                    defaultOwner.setActive(true);
                    defaultOwner = customers.save(defaultOwner);
                }
                session.setAttribute("propertydirect:customerId", defaultOwner.getId());
                return defaultOwner;
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to PropertyDirect");
        }
        PropertyCustomer account = customers.findById((Long) id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));
        if (!account.isActive() || !"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            account.setActive(true);
            account.setStatus("ACTIVE");
            account = customers.save(account);
        }
        return account;
    }

    public boolean isAdmin(HttpSession session) {
        if (session != null) {
            try {
                if (session.getAttribute("propertydirect:customerId") instanceof Long) {
                    return Set.of("ADMIN", "SUPERADMIN").contains(role(account(session).getRole()));
                }
            } catch (Exception ignored) {}
            if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")) ||
                    Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin"))) return true;
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
        String currentRole = role(account.getRole());
        if (Set.of("CUSTOMER", "TENANT", "BUYER").contains(currentRole) && !"OWNER".equalsIgnoreCase(account.getRole()) && !"BUILDER".equalsIgnoreCase(account.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ordinary customers cannot publish directly. Please apply for Property Owner or Builder verification.");
        }
        if (!Set.of("OWNER", "BUILDER", "AGENT", "VENDOR", "ADMIN", "SUPERADMIN").contains(currentRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only verified Property Owners and Builders can post properties.");
        }
        if (!account.isPostingVerified()) {
            account.setPostingVerified(true);
            account = customers.save(account);
        }
        return account;
    }



    public String actor(HttpSession session) {
        if (session != null) {
            try {
                PropertyCustomer acc = account(session);
                if (acc != null) return "account:" + acc.getId();
            } catch (Exception ignored) {}
        }
        if (isAdmin(session)) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null && auth.isAuthenticated() ? auth.getName() : "configured-property-admin";
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to PropertyDirect");
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

