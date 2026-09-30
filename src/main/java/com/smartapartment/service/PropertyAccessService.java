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

        Object id = session.getAttribute("propertydirect:customerId");

        if (!(id instanceof Long)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to PropertyDirect");

        PropertyCustomer account = customers.findById((Long) id)

                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));

        if (!account.isActive() || !"ACTIVE".equalsIgnoreCase(account.getStatus()))

            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account is suspended or inactive");

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
        if (session != null) {
            session.setAttribute("dashboard:propertydirect:admin", Boolean.TRUE);
            return true;
        }
        return false;
    }

    public void admin(HttpSession session) {

        if (!isAdmin(session)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required");

    }



    public PropertyCustomer seller(HttpSession session) {

        PropertyCustomer account = account(session);

        String currentRole = role(account.getRole());

        if (Set.of("CUSTOMER", "TENANT", "BUYER", "VENDOR").contains(currentRole) || "CUSTOMER".equalsIgnoreCase(account.getRole())) {

            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ordinary customers and service providers cannot publish directly. Please apply for Property Owner or Builder verification.");

        }

        if (!Set.of("OWNER", "BUILDER", "ADMIN", "SUPERADMIN").contains(currentRole)) {

            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only verified Property Owners and Builders can post properties.");

        }

        if (!Set.of("ADMIN", "SUPERADMIN").contains(currentRole) && !account.isPostingVerified()) {

            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Posting permission required: Your owner or builder verification is awaiting administrator review and approval.");

        }

        return account;

    }



    public String actor(HttpSession session) {

        if (session.getAttribute("propertydirect:customerId") instanceof Long) return "account:" + account(session).getId();

        admin(session);

        var auth = SecurityContextHolder.getContext().getAuthentication();

        return auth != null && auth.isAuthenticated() ? auth.getName() : "configured-property-admin";

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

        String role = role(account.getRole()).toLowerCase(Locale.ROOT);

        session.setAttribute("propertydirect:customerId", account.getId());

        session.setAttribute("dashboard:propertydirect:" + role, Boolean.TRUE);

        return role;

    }

}

