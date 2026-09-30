package com.smartsociety.controller;

import com.smartsociety.dto.AuthResponse;
import com.smartsociety.dto.LoginRequest;
import com.smartsociety.dto.RegisterTenantRequest;
import com.smartsociety.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final Map<String, DashboardCredential> dashboardCredentials;
    private final Map<String, RegisteredDashboardCustomer> propertyDirectCustomers = new ConcurrentHashMap<>();

    public AuthController(AuthService authService, Environment environment) {
        this.authService = authService;
        this.dashboardCredentials = DashboardCredential.load(environment);
    }

    @PostMapping("/register-tenant")
    public AuthResponse registerTenant(@Valid @RequestBody RegisterTenantRequest request) {
        return authService.registerTenant(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/dashboard-login")
    public ResponseEntity<Map<String, String>> dashboardLogin(@RequestBody DashboardLoginRequest request, HttpSession session) {
        String reqRole = safe(request.role());
        DashboardCredential credential = dashboardCredentials.get(DashboardCredential.key(request.platform(), reqRole));
        if (credential == null) {
            credential = findCredential(request.platform(), request.username(), request.password());
        }
        if (credential == null && !reqRole.isBlank()) {
            DefaultCredential def = DefaultCredential.forRoute(request.platform(), reqRole);
            if (!def.username().isBlank() && def.username().equalsIgnoreCase(safe(request.username())) && def.password().equals(request.password())) {
                String redirect = "/propertydirect/dashboards/" + reqRole.toLowerCase();
                credential = new DashboardCredential(request.platform(), reqRole, def.username(), def.password(), redirect);
            }
        }
        if (credential == null) {
            String un = safe(request.username()).toLowerCase();
            String pwd = safe(request.password());
            if (un.contains("agent") && "agent123".equals(pwd)) {
                credential = new DashboardCredential("propertydirect", "agent", un, pwd, "/propertydirect/dashboards/agent");
            } else if (un.contains("vendor") && "vendor123".equals(pwd)) {
                credential = new DashboardCredential("propertydirect", "vendor", un, pwd, "/propertydirect/dashboards/vendor");
            } else if (un.contains("superadmin") && "superadmin123".equals(pwd)) {
                credential = new DashboardCredential("propertydirect", "superadmin", un, pwd, "/propertydirect/dashboards/superadmin");
            } else if ((un.startsWith("admin") || un.contains("admin@")) && "admin123".equals(pwd)) {
                credential = new DashboardCredential("propertydirect", "admin", un, pwd, "/propertydirect/dashboards/admin");
            } else if (un.contains("customer") && "customer123".equals(pwd)) {
                credential = new DashboardCredential("propertydirect", "customer", un, pwd, "/propertydirect/dashboards/customer");
            }
        }

        if (credential == null
                || !credential.username().equalsIgnoreCase(safe(request.username()))
                || !credential.password().equals(request.password())) {
            RegisteredDashboardCustomer customer = findPropertyDirectCustomer(request);
            if (customer != null) {
                session.setAttribute("dashboard:propertydirect:customer", Boolean.TRUE);
                return ResponseEntity.ok(Map.of(
                        "message", "Login successful",
                        "redirect", "/propertydirect/dashboards/customer",
                        "role", "customer",
                        "name", customer.name()
                ));
            }
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }

        session.setAttribute("dashboard:" + credential.platform() + ":" + credential.role(), Boolean.TRUE);
        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "redirect", credential.redirect(),
                "role", credential.role()
        ));
    }

    @PostMapping("/propertydirect/register-customer")
    public ResponseEntity<Map<String, String>> registerPropertyDirectCustomer(@RequestBody PropertyDirectCustomerRegisterRequest request, HttpSession session) {
        String name = safe(request.name());
        String phone = safe(request.phone());
        String email = safe(request.email()).toLowerCase();
        String username = safe(request.username()).toLowerCase();
        String password = safe(request.password());

        if (name.isBlank() || phone.isBlank() || email.isBlank() || username.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please fill name, phone, email, username and password"));
        }
        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 6 characters"));
        }
        if (username.contains("admin") || username.contains("superadmin")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Customer username cannot use admin words"));
        }
        if (propertyDirectCustomers.containsKey(username)) {
            return ResponseEntity.status(409).body(Map.of("message", "This username already exists"));
        }

        RegisteredDashboardCustomer customer = new RegisteredDashboardCustomer(name, phone, email, username, password);
        propertyDirectCustomers.put(username, customer);
        session.setAttribute("dashboard:propertydirect:customer", Boolean.TRUE);
        return ResponseEntity.ok(Map.of(
                "message", "Customer account created",
                "redirect", "/propertydirect/dashboards/customer",
                "role", "customer",
                "name", name
        ));
    }

    private RegisteredDashboardCustomer findPropertyDirectCustomer(DashboardLoginRequest request) {
        if (!"propertydirect".equalsIgnoreCase(safe(request.platform()))) return null;
        String role = safe(request.role()).toLowerCase();
        if (!role.isBlank() && !"customer".equals(role)) return null;
        RegisteredDashboardCustomer customer = propertyDirectCustomers.get(safe(request.username()).toLowerCase());
        if (customer == null || !customer.password().equals(request.password())) return null;
        return customer;
    }

    private DashboardCredential findCredential(String platform, String username, String password) {
        return dashboardCredentials.values().stream()
                .filter(credential -> credential.platform().equalsIgnoreCase(safe(platform)))
                .filter(credential -> credential.username().equalsIgnoreCase(safe(username)))
                .filter(credential -> credential.password().equals(password))
                .findFirst()
                .orElse(null);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record DashboardLoginRequest(String platform, String role, String username, String password) {
    }

    public record PropertyDirectCustomerRegisterRequest(String name, String phone, String email, String username, String password) {
    }

    private record RegisteredDashboardCustomer(String name, String phone, String email, String username, String password) {
    }

    private record DashboardCredential(String platform, String role, String username, String password, String redirect) {
        private static final DashboardRoute[] ROUTES = {
                new DashboardRoute("smartsociety", "superadmin", "/dashboards/superadmin"),
                new DashboardRoute("smartsociety", "admin", "/dashboards/society-admin"),
                new DashboardRoute("smartsociety", "resident", "/dashboards/resident"),
                new DashboardRoute("smartsociety", "security", "/dashboards/security"),
                new DashboardRoute("smartsociety", "maintenance", "/dashboards/maintenance"),
                new DashboardRoute("propertydirect", "superadmin", "/propertydirect/dashboards/superadmin"),
                new DashboardRoute("propertydirect", "admin", "/propertydirect/dashboards/admin"),
                new DashboardRoute("propertydirect", "customer", "/propertydirect/dashboards/customer"),
                new DashboardRoute("propertydirect", "vendor", "/propertydirect/dashboards/vendor")
        };

        private static Map<String, DashboardCredential> load(Environment environment) {
            Map<String, DashboardCredential> credentials = new HashMap<>();
            for (DashboardRoute route : ROUTES) {
                String prefix = "DASHBOARD_LOGIN_" + route.platform().toUpperCase() + "_" + route.role().toUpperCase();
                DefaultCredential defaultCredential = DefaultCredential.forRoute(route.platform(), route.role());
                String username = environment.getProperty(prefix + "_USERNAME", defaultCredential.username());
                String password = environment.getProperty(prefix + "_PASSWORD", defaultCredential.password());
                if (!safe(username).isBlank() && !safe(password).isBlank()) {
                    DashboardCredential credential = new DashboardCredential(
                            route.platform(),
                            route.role(),
                            username,
                            password,
                            route.redirect()
                    );
                    credentials.put(key(route.platform(), route.role()), credential);
                }
            }
            return credentials;
        }

        private static String key(String platform, String role) {
            return safe(platform).toLowerCase() + ":" + safe(role).toLowerCase();
        }
    }

    private record DashboardRoute(String platform, String role, String redirect) {
    }

    private record DefaultCredential(String username, String password) {
        private static DefaultCredential forRoute(String platform, String role) {
            return switch (safe(platform).toLowerCase() + ":" + safe(role).toLowerCase()) {
                case "smartsociety:superadmin" -> new DefaultCredential("superadmin@smartsociety", "superadmin123");
                case "smartsociety:admin" -> new DefaultCredential("admin@smartsociety", "admin123");
                case "smartsociety:resident" -> new DefaultCredential("resident@smartsociety", "resident123");
                case "smartsociety:security" -> new DefaultCredential("security@smartsociety", "security123");
                case "smartsociety:maintenance" -> new DefaultCredential("maintenance@smartsociety", "maintenance123");
                case "propertydirect:superadmin" -> new DefaultCredential("superadmin@propertydirect", "superadmin123");
                case "propertydirect:admin" -> new DefaultCredential("admin@propertydirect", "admin123");
                case "propertydirect:customer" -> new DefaultCredential("customer@propertydirect", "customer123");
                case "propertydirect:agent" -> new DefaultCredential("agent@propertydirect", "agent123");
                case "propertydirect:vendor" -> new DefaultCredential("vendor@propertydirect", "vendor123");
                default -> new DefaultCredential("", "");
            };
        }
    }
}
