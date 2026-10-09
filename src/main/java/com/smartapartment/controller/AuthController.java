package com.smartapartment.controller;



import com.smartapartment.dto.AuthResponse;

import com.smartapartment.dto.LoginRequest;

import com.smartapartment.dto.RegisterTenantRequest;

import com.smartapartment.entity.AppUser;

import com.smartapartment.entity.UserRole;

import com.smartapartment.entity.PropertyCustomer;

import com.smartapartment.entity.Tenant;

import com.smartapartment.entity.Apartment;

import com.smartapartment.entity.Resident;

import com.smartapartment.repository.ApartmentRepository;

import com.smartapartment.repository.ResidentRepository;

import com.smartapartment.repository.AppUserRepository;

import com.smartapartment.repository.TenantRepository;

import com.smartapartment.repository.PropertyCustomerRepository;

import com.smartapartment.entity.PropertySellerApplication;

import com.smartapartment.repository.PropertySellerApplicationRepository;

import com.smartapartment.service.AuthService;

import com.smartapartment.service.PropertyAccessService;

import com.smartapartment.security.JwtService;

import jakarta.servlet.http.HttpSession;

import jakarta.validation.Valid;

import java.time.LocalDateTime;

import java.util.concurrent.ConcurrentHashMap;

import java.util.HashMap;

import java.util.Locale;

import java.util.Map;

import org.springframework.core.env.Environment;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import org.springframework.security.core.authority.SimpleGrantedAuthority;

import org.springframework.security.core.context.SecurityContext;

import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.web.bind.annotation.PostMapping;

import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.RestController;



@RestController

@RequestMapping("/api/auth")

public class AuthController {



    private final AuthService authService;

    private final Map<String, DashboardCredential> dashboardCredentials;

    private final PropertyCustomerRepository propertyDirectCustomers;

    private final PropertySellerApplicationRepository sellerApplications;

    private final PasswordEncoder passwordEncoder;

    private final JwtService jwtService;

    private final AppUserRepository userRepository;

    private final TenantRepository tenantRepository;

    private final ResidentRepository residentRepository;

    private final ApartmentRepository apartmentRepository;

    private final com.smartapartment.service.MailService mailService;

    private final boolean exposeOtpPreview;



    public AuthController(AuthService authService, Environment environment, PropertyCustomerRepository propertyDirectCustomers, PropertySellerApplicationRepository sellerApplications, PasswordEncoder passwordEncoder, JwtService jwtService, AppUserRepository userRepository, TenantRepository tenantRepository, ResidentRepository residentRepository, ApartmentRepository apartmentRepository, com.smartapartment.service.MailService mailService, @Value("${app.mail.expose-otp-preview:true}") boolean exposeOtpPreview) {

        this.authService = authService;

        this.dashboardCredentials = DashboardCredential.load(environment);

        this.propertyDirectCustomers = propertyDirectCustomers;

        this.sellerApplications = sellerApplications;

        this.passwordEncoder = passwordEncoder;

        this.jwtService = jwtService;

        this.userRepository = userRepository;

        this.tenantRepository = tenantRepository;

        this.residentRepository = residentRepository;

        this.apartmentRepository = apartmentRepository;

        this.mailService = mailService;

        this.exposeOtpPreview = exposeOtpPreview;

    }



    @PostMapping("/register-tenant")

    public Map<String,String> registerTenant(@Valid @RequestBody RegisterTenantRequest request) {

        authService.registerTenant(request);

        return Map.of("message", "Society registered and awaiting platform approval");

    }



    @PostMapping("/register-resident")

    public ResponseEntity<?> registerResident(@RequestBody ResidentSelfRegisterRequest request) {

        if (request == null || safe(request.email()).isBlank() || safe(request.password()).isBlank()) {

            return ResponseEntity.badRequest().body(Map.of("message", "Email and password are required"));

        }

        String email = safe(request.email()).toLowerCase(Locale.ROOT);

        if (email.endsWith("@smartsociety")) {

            email = email.replace("@smartsociety", "@smartapartment");

        }



        if (userRepository.existsByEmailIgnoreCase(email)) {

            return ResponseEntity.status(409).body(Map.of("message", "User already exists. Contact your admin."));

        }



        String password = safe(request.password());

        if (password.length() < 6) {

            return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 6 characters"));

        }



        // Find or ensure active approved tenant

        Tenant tenant = tenantRepository.findAll().stream()

                .filter(Tenant::isApproved)

                .findFirst()

                .orElseGet(() -> {

                    Tenant newTenant = new Tenant();

                    newTenant.setTenantId("green-heights");

                    newTenant.setCode("green-heights");

                    newTenant.setSocietyName("Green Heights Apartment");

                    newTenant.setContactEmail("admin@greenheights.com");

                    newTenant.setApproved(true);

                    return tenantRepository.save(newTenant);

                });



        String tenantId = tenant.getCode() != null ? tenant.getCode() : "green-heights";



        // Find existing AppUser or create new

        AppUser user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {

            user = new AppUser();

            user.setTenantId(tenantId);

            user.setFullName(safe(request.name()).isBlank() ? "Resident User" : safe(request.name()));

            user.setEmail(email);

            user.setPhone(safe(request.phone()));

            user.setPasswordHash(passwordEncoder.encode(password));

            user.setRole(UserRole.RESIDENT);

            user.setStatus("ACTIVE");

            user = userRepository.save(user);

        } else {

            user.setTenantId(tenantId);

            user.setRole(UserRole.RESIDENT);

            user.setPasswordHash(passwordEncoder.encode(password));

            if (!safe(request.name()).isBlank()) user.setFullName(safe(request.name()));

            if (!safe(request.phone()).isBlank()) user.setPhone(safe(request.phone()));

            user.setStatus("ACTIVE");

            user = userRepository.save(user);

        }



        // Save or update Resident and Apartment records in database for society admin view

        final AppUser finalUser = user;

        String unitNo = safe(request.unitNo()).isBlank() ? "Unit" : safe(request.unitNo());

        Apartment apartment = apartmentRepository.findFirstByTenantIdAndUnitNoOrderByIdAsc(tenantId, unitNo)

                .orElseGet(() -> {

                    Apartment a = new Apartment();

                    a.setTenantId(tenantId);

                    a.setUnitNo(unitNo);

                    a.setOwnerName(finalUser.getFullName());

                    a.setOwnerPhone(finalUser.getPhone());

                    a.setOccupancyStatus("OCCUPIED");

                    return apartmentRepository.save(a);

                });



        Resident resident = residentRepository.findFirstByUserOrderByIdAsc(finalUser)

                .orElseGet(() -> {

                    Resident r = new Resident();

                    r.setTenantId(tenantId);

                    r.setUser(finalUser);

                    return r;

                });

        resident.setApartment(apartment);

        resident.setResidentType(safe(request.type()).isBlank() ? "TENANT" : safe(request.type()).toUpperCase(Locale.ROOT));

        if (request.vehicleNo != null && !request.vehicleNo.isBlank()) {

            resident.setVehicleNumber(safe(request.vehicleNo()));

        }

        residentRepository.save(resident);



        return ResponseEntity.ok(Map.of(

                "message", "Resident account registered successfully",

                "email", email,

                "role", "resident",

                "redirect", "/dashboards/resident"

        ));

    }



    public record ResidentSelfRegisterRequest(

            String name,

            String email,

            String phone,

            String password,

            String unitNo,

            String type,

            String token,

            String vehicleNo

    ) {}



    @PostMapping("/login")

    public AuthResponse login(@Valid @RequestBody LoginRequest request) {

        try {

            return authService.login(request);

        } catch (IllegalArgumentException smartApartmentFailure) {

            PropertyCustomer user = propertyDirectCustomers.findByEmailIgnoreCase(safe(request.email()))

                    .orElseThrow(() -> smartApartmentFailure);

            if (!user.isActive() || !"ACTIVE".equalsIgnoreCase(user.getStatus())

                    || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {

                throw smartApartmentFailure;

            }

            return new AuthResponse(jwtService.generatePropertyDirectToken(user), user.getRole(), "propertydirect", user.getName());

        }

    }



    @PostMapping("/register")

    public ResponseEntity<?> registerPropertyDirect(@Valid @RequestBody PropertyDirectRegisterRequest request) {

        String email = safe(request.email()).toLowerCase();

        if (propertyDirectCustomers.existsByUsernameIgnoreCaseOrEmailIgnoreCase(email, email)) {

            return ResponseEntity.status(409).body(Map.of("message", "User already exists. Contact your admin."));

        }

        PropertyCustomer user = new PropertyCustomer();

        user.setTenantId("propertydirect");

        user.setName(safe(request.name()));

        user.setEmail(email);

        user.setUsername(email);

        user.setPhone(safe(request.phone()));

        user.setPasswordHash(passwordEncoder.encode(request.password()));

        user.setRole("CUSTOMER");

        user.setActive(true);

        user.setStatus("ACTIVE");

        user = propertyDirectCustomers.save(user);

        return ResponseEntity.status(201).body(Map.of(

                "id", user.getId(),

                "name", user.getName(),

                "email", user.getEmail(),

                "role", user.getRole(),

                "token", jwtService.generatePropertyDirectToken(user)

        ));

    }



    @PostMapping("/dashboard-login")

    public ResponseEntity<Map<String, String>> dashboardLogin(@RequestBody DashboardLoginRequest request, HttpSession session) {

        String platform = safe(request.platform()).toLowerCase();

        if ("smartapartment".equals(platform) || "smartsociety".equals(platform)) {

            try {

                AppUser user = authService.authenticate(request.username(), request.password());

                String dashboardRole = dashboardRole(user.getRole());

                boolean isSuperAdmin = (user.getRole() == UserRole.SUPER_ADMIN);

                boolean requestedMaintenance = "maintenance".equalsIgnoreCase(safe(request.role()));

                PropertyAccessService.clearIdentity(session);

                var authentication = new UsernamePasswordAuthenticationToken(

                        user.getEmail(), null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));

                SecurityContext context = SecurityContextHolder.createEmptyContext();

                context.setAuthentication(authentication);

                SecurityContextHolder.setContext(context);

                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

                session.setAttribute("dashboard:smartapartment:" + dashboardRole, Boolean.TRUE);

                if (isSuperAdmin) {

                    session.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);

                    session.setAttribute("dashboard:smartapartment:admin", Boolean.TRUE);

                    session.setAttribute("dashboard:propertydirect:superadmin", Boolean.TRUE);

                }



                String redirectTarget;
                if (isSuperAdmin && requestedMaintenance) {
                    redirectTarget = "/dashboards/maintenance";
                } else if (user.getRole() == UserRole.MAINTENANCE_STAFF) {
                    String email = user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase();
                    boolean isLead = "maintenance@smartapartment".equals(email)
                            || "maintenance@smartsociety".equals(email)
                            || (user.getDesignation() != null && user.getDesignation().toLowerCase().contains("lead"))
                            || (user.getDesignation() != null && user.getDesignation().toLowerCase().contains("manager"));
                    redirectTarget = isLead ? "/dashboards/maintenance" : "/dashboards/maintenance-worker";
                } else {
                    redirectTarget = dashboardRedirect(user.getRole());
                }

                String effectiveRole = (isSuperAdmin && requestedMaintenance) ? "maintenance" : dashboardRole;



                return ResponseEntity.ok(Map.of(

                        "message", "Login successful",

                        "redirect", redirectTarget,

                        "role", effectiveRole,

                        "name", user.getFullName()

                ));

            } catch (IllegalArgumentException exception) {

                String normalizedUser = safe(request.username()).trim().toLowerCase();
                boolean isPropertyDirectUser = normalizedUser.contains("propertydirect")
                        || normalizedUser.contains("owner")
                        || normalizedUser.contains("agent")
                        || normalizedUser.contains("vendor")
                        || propertyDirectCustomers.findByUsernameIgnoreCase(normalizedUser).isPresent()
                        || propertyDirectCustomers.findByEmailIgnoreCase(normalizedUser).isPresent()
                        || findCredential("propertydirect", normalizedUser, request.password()) != null;
                if (isPropertyDirectUser) {
                    platform = "propertydirect";
                } else {
                    return ResponseEntity.status(401).body(Map.of("message", exception.getMessage()));
                }

            }

        }



        if (!"propertydirect".equals(platform)) return ResponseEntity.badRequest().body(Map.of("message", "Unknown platform"));

        String normalizedUsername = safe(request.username()).trim().toLowerCase();

        PropertyCustomer existingAccount = propertyDirectCustomers.findByUsernameIgnoreCase(normalizedUsername)

                .or(() -> propertyDirectCustomers.findByEmailIgnoreCase(normalizedUsername)).orElse(null);

        if (existingAccount != null) {

            if (!existingAccount.isActive() || !"ACTIVE".equalsIgnoreCase(existingAccount.getStatus()) ||

                    !passwordEncoder.matches(safe(request.password()), existingAccount.getPasswordHash()))

                return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials or inactive account"));

            if ("owner@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "owner@propertydirect".equalsIgnoreCase(existingAccount.getEmail())
                    || (existingAccount.getUsername() != null && existingAccount.getUsername().toLowerCase().contains("owner"))
                    || "owner".equalsIgnoreCase(safe(request.role()))) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount.setName("Property Owner");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            } else if ("agent@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "vendor@propertydirect".equalsIgnoreCase(existingAccount.getUsername())) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            }

            String accountRole = PropertyAccessService.signIn(session, existingAccount);
            String roleLower = accountRole != null ? accountRole.toLowerCase(Locale.ROOT) : "customer";
            String dashRedirect;
            if ("agent".equals(roleLower) || "vendor".equals(roleLower) || "owner".equals(roleLower)) {
                dashRedirect = "/propertydirect/dashboards/owner";
                roleLower = "owner";
            } else {
                dashRedirect = "/propertydirect/dashboards/" + roleLower;
            }
            return ResponseEntity.ok(Map.of("message", "Login successful", "role", roleLower,
                    "name", existingAccount.getName(), "redirect", dashRedirect));

        }

        String reqRole = safe(request.role()).toLowerCase();



        DashboardCredential credential = reqRole.isBlank()

                ? findCredential(request.platform(), normalizedUsername, request.password())

                : dashboardCredentials.get(DashboardCredential.key(request.platform(), reqRole));



        if (credential == null

                || !credential.username().equalsIgnoreCase(normalizedUsername)

                || !credential.password().equals(request.password())) {

            

            // Try database authentication as a fallback

            try {

                AppUser user = authService.authenticate(normalizedUsername, request.password());

                String dashboardRole = dashboardRole(user.getRole());

                PropertyAccessService.clearIdentity(session);

                var authentication = new UsernamePasswordAuthenticationToken(

                        user.getEmail(), null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));

                SecurityContext context = SecurityContextHolder.createEmptyContext();

                context.setAuthentication(authentication);

                SecurityContextHolder.setContext(context);

                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

                session.setAttribute("dashboard:smartapartment:" + dashboardRole, Boolean.TRUE);

                if (user.getRole() == UserRole.SUPER_ADMIN) {

                    session.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);

                    session.setAttribute("dashboard:propertydirect:superadmin", Boolean.TRUE);

                }



                return ResponseEntity.ok(Map.of(

                        "message", "Login successful",

                        "redirect", dashboardRedirect(user.getRole()),

                        "role", dashboardRole,

                        "name", user.getFullName()

                ));

            } catch (Exception ignored) {

            }



            PropertyCustomer customer = findPropertyDirectCustomer(request);

            if (customer != null) {

                String propertyRole = PropertyAccessService.signIn(session, customer);

                String dashRedirect = "/propertydirect/dashboards/" + propertyRole.toLowerCase(Locale.ROOT);

                return ResponseEntity.ok(Map.of(

                        "message", "Login successful",

                        "redirect", dashRedirect,

                        "role", propertyRole,

                        "name", customer.getName()

                ));

            }

            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));

        }



        PropertyAccessService.clearIdentity(session);

        session.setAttribute("dashboard:" + credential.platform() + ":" + credential.role(), Boolean.TRUE);

        // Verified Smart Society dashboard credentials must also authenticate
        // protected APIs; the dashboard flag alone is not a security context.
        if (("smartapartment".equalsIgnoreCase(credential.platform()) || "smartsociety".equalsIgnoreCase(credential.platform()))
                && "superadmin".equalsIgnoreCase(credential.role())) {
            var societyAuthentication = new UsernamePasswordAuthenticationToken(credential.username(), null,
                    java.util.List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
            SecurityContext societyContext = SecurityContextHolder.createEmptyContext();
            societyContext.setAuthentication(societyAuthentication);
            SecurityContextHolder.setContext(societyContext);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, societyContext);
        }

        if ("superadmin".equalsIgnoreCase(credential.role())) {

            session.setAttribute("dashboard:smartapartment:superadmin", Boolean.TRUE);

            session.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);

        }

        if ("propertydirect".equalsIgnoreCase(credential.platform())

                && ("admin".equalsIgnoreCase(credential.role())

                    || "vendor".equalsIgnoreCase(credential.role())

                    || "agent".equalsIgnoreCase(credential.role())

                    || "owner".equalsIgnoreCase(credential.role())

                    || "customer".equalsIgnoreCase(credential.role()))) {

            String username = safe(credential.username()).toLowerCase();

            final DashboardCredential activeCred = credential;

            PropertyCustomer owner = propertyDirectCustomers.findByUsernameIgnoreCase(username).orElseGet(() -> {

                PropertyCustomer customer = new PropertyCustomer();

                customer.setTenantId("propertydirect");

                customer.setName("agent".equalsIgnoreCase(activeCred.role()) ? "Selva Kumar"
                        : "vendor".equalsIgnoreCase(activeCred.role()) ? "Selva Kumar"
                        : "owner".equalsIgnoreCase(activeCred.role()) ? "Selva Kumar"
                        : "customer".equalsIgnoreCase(activeCred.role()) ? "PropertyDirect Customer"
                        : "Property Direct Admin");
                customer.setPhone("8778293269");
                customer.setEmail(username.contains("@") ? (username.contains(".") ? username : username + ".in") : username + "@propertydirect.in");

                customer.setUsername(username);

                customer.setPasswordHash(passwordEncoder.encode(activeCred.password()));

                customer.setRole("agent".equalsIgnoreCase(activeCred.role()) ? "OWNER"

                        : "vendor".equalsIgnoreCase(activeCred.role()) ? "OWNER"

                        : "owner".equalsIgnoreCase(activeCred.role()) ? "OWNER"

                        : "customer".equalsIgnoreCase(activeCred.role()) ? "CUSTOMER"

                        : "ADMIN");

                customer.setActive(true);

                customer.setStatus("ACTIVE");

                return propertyDirectCustomers.save(customer);

            });

            if ("owner".equalsIgnoreCase(activeCred.role())
                    || "agent".equalsIgnoreCase(activeCred.role())
                    || "vendor".equalsIgnoreCase(activeCred.role())
                    || username.contains("owner")) {
                if (!"OWNER".equalsIgnoreCase(owner.getRole())) {
                    owner.setRole("OWNER");
                    owner.setName("Property Owner");
                    owner = propertyDirectCustomers.save(owner);
                }
            }

            PropertyAccessService.signIn(session, owner);

        }

        String redirectTarget = credential.redirect();
        if ("agent".equalsIgnoreCase(credential.role()) || "vendor".equalsIgnoreCase(credential.role()) || "owner".equalsIgnoreCase(credential.role())) {
            redirectTarget = "/propertydirect/dashboards/owner";
        } else if (redirectTarget == null || redirectTarget.isBlank()) {
            redirectTarget = "/propertydirect/dashboards/" + credential.role().toLowerCase(Locale.ROOT);
        }
        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "redirect", redirectTarget,
                "role", PropertyAccessService.role(credential.role()).toLowerCase(Locale.ROOT)
        ));

    }



    @PostMapping("/propertydirect/register-customer")

    public ResponseEntity<Map<String, String>> registerPropertyDirectCustomer(@RequestBody PropertyDirectCustomerRegisterRequest request, HttpSession session) {

        String validationError = validatePropertyDirectRegistration(request);

        if (validationError != null) {

            return ResponseEntity.badRequest().body(Map.of("message", validationError));

        }



        String name = safe(request.name());

        String phone = safe(request.phone());

        String email = safe(request.email()).toLowerCase(Locale.ROOT);

        String username = safe(request.username()).isBlank()

                ? email

                : safe(request.username()).toLowerCase(Locale.ROOT);

        String password = safe(request.password());



        if (propertyDirectCustomers.existsByUsernameIgnoreCaseOrEmailIgnoreCase(username, email)) {

            return ResponseEntity.status(409).body(Map.of("message", "User already exists. Contact your admin."));

        }



        String rawRole = safe(request.role()).trim().toUpperCase(Locale.ROOT);

        String role = "CUSTOMER";

        if ("BUILDER".equals(rawRole)) {

            role = "BUILDER";

        } else if ("OWNER".equals(rawRole) || "PROPERTY_OWNER".equals(rawRole)) {

            role = "OWNER";

        }



        PropertyCustomer customer = new PropertyCustomer();

        customer.setTenantId("propertydirect"); customer.setName(name); customer.setPhone(phone);

        customer.setEmail(email); customer.setUsername(username); customer.setPasswordHash(passwordEncoder.encode(password));

        customer.setRole(role);

        customer.setActive(true);

        customer.setStatus("ACTIVE");

        customer.setPostingVerified(false);

        propertyDirectCustomers.save(customer);



        if ("BUILDER".equals(role) || "OWNER".equals(role)) {

            PropertySellerApplication app = new PropertySellerApplication();

            app.setTenantId("propertydirect");

            app.setCustomerId(customer.getId());

            app.setRequestedRole(role);

            app.setCompanyName(safe(request.companyName()));

            app.setRegistrationNumber(safe(request.registrationNumber()));

            app.setVerificationDetails(safe(request.verificationDetails()).isBlank() ? ("Initial " + role + " registration") : safe(request.verificationDetails()));

            app.setDecision("PENDING");

            sellerApplications.save(app);

        }



        PropertyAccessService.signIn(session, customer);

        return ResponseEntity.ok(Map.of(

                "message", "BUILDER".equals(role) ? "Builder account registered. Verification details submitted for admin approval." : "Account created successfully",

                "redirect", "/propertydirect/dashboards/customer",

                "role", role.toLowerCase(Locale.ROOT),

                "name", name

        ));

    }



    private String validatePropertyDirectRegistration(PropertyDirectCustomerRegisterRequest request) {

        if (request == null) return "Please fill name, phone, email, username and password";

        String name = safe(request.name());

        String phone = safe(request.phone());

        String email = safe(request.email()).toLowerCase(Locale.ROOT);

        String username = safe(request.username()).isBlank()

                ? email

                : safe(request.username()).toLowerCase(Locale.ROOT);

        String password = safe(request.password());



        if (name.isBlank() || phone.isBlank() || email.isBlank() || password.isBlank()) {

            return "Please fill name, phone, email, username and password";

        }

        if (password.length() < 8 || password.length() > 72) {

            return "Password must be between 8 and 72 characters";

        }

        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") || !phone.matches("^[0-9+() -]{7,20}$"))

            return "Enter a valid email address and phone number";

        if (username.contains("admin") || username.contains("superadmin")) {

            return "Customer username cannot use admin words";

        }

        return null;

    }



    private PropertyCustomer findPropertyDirectCustomer(DashboardLoginRequest request) {

        if (!"propertydirect".equalsIgnoreCase(safe(request.platform()))) return null;

        String role = safe(request.role()).toLowerCase();



        String loginIdentifier = safe(request.username()).trim().toLowerCase(Locale.ROOT);

        String password = safe(request.password());

        if (loginIdentifier.isBlank() || password.isBlank()) return null;



        PropertyCustomer customer = propertyDirectCustomers.findByUsernameIgnoreCase(loginIdentifier)

                .or(() -> propertyDirectCustomers.findByEmailIgnoreCase(loginIdentifier))

                .orElse(null);

        if (customer == null || !customer.isActive() || !"ACTIVE".equalsIgnoreCase(customer.getStatus())) return null;

        if (!passwordEncoder.matches(password, customer.getPasswordHash())) return null;



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



    private String dashboardRole(UserRole role) {

        if (role == null) return "resident";

        if (role == UserRole.SUPER_ADMIN) return "superadmin";

        if (role == UserRole.SOCIETY_ADMIN || role == UserRole.FACILITY_MANAGER) return "admin";

        if (role == UserRole.ACCOUNTANT) return "accountant";

        if (role == UserRole.SECURITY_STAFF) return "security";

        if (role == UserRole.MAINTENANCE_STAFF) return "maintenance";

        return "resident";

    }



    private String dashboardRedirect(UserRole role) {

        if (role == null) return "/dashboards/resident";

        if (role == UserRole.SUPER_ADMIN) return "/dashboards/superadmin";

        if (role == UserRole.SOCIETY_ADMIN || role == UserRole.FACILITY_MANAGER) return "/dashboards/society-admin";

        if (role == UserRole.ACCOUNTANT) return "/dashboards/accountant";

        if (role == UserRole.SECURITY_STAFF) return "/dashboards/security";

        if (role == UserRole.MAINTENANCE_STAFF) return "/dashboards/maintenance";

        return "/dashboards/resident";

    }



    public record DashboardLoginRequest(String platform, String role, String username, String password) {

    }



    public record PropertyDirectCustomerRegisterRequest(

            String name, String phone, String email, String username, String password,

            String role, String companyName, String registrationNumber, String verificationDetails) {

    }



    public record PropertyDirectRegisterRequest(

            @jakarta.validation.constraints.NotBlank String name,

            @jakarta.validation.constraints.Email @jakarta.validation.constraints.NotBlank String email,

            String phone,

            @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(min = 8, max = 100) String password) {

    }



    private record DashboardCredential(String platform, String role, String username, String password, String redirect) {

        private static final DashboardRoute[] ROUTES = {

                new DashboardRoute("propertydirect", "superadmin", "/propertydirect/dashboards/superadmin"),

                new DashboardRoute("propertydirect", "admin", "/propertydirect/dashboards/admin"),

                

                new DashboardRoute("propertydirect", "agent", "/propertydirect/dashboards/owner"),

                new DashboardRoute("propertydirect", "vendor", "/propertydirect/dashboards/owner"),

                new DashboardRoute("propertydirect", "customer", "/propertydirect/dashboards/customer"),

                new DashboardRoute("propertydirect", "owner", "/propertydirect/dashboards/owner")

        };



        private static Map<String, DashboardCredential> load(Environment environment) {

            Map<String, DashboardCredential> credentials = new HashMap<>();

            boolean allowDemo = Boolean.parseBoolean(environment.getProperty("SEED_DEMO_ACCOUNTS", "true"));

            for (DashboardRoute route : ROUTES) {

                String prefix = "DASHBOARD_LOGIN_" + route.platform().toUpperCase() + "_" + route.role().toUpperCase();

                DefaultCredential defaultCredential = DefaultCredential.forRoute(route.platform(), route.role(), allowDemo);

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

        private static DefaultCredential forRoute(String platform, String role, boolean allowDemo) {

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "superadmin".equalsIgnoreCase(role)) {

                return new DefaultCredential("superadmin@propertydirect", "superadmin123");

            }

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "admin".equalsIgnoreCase(role)) {

                return new DefaultCredential("admin@propertydirect", "admin123");

            }

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "agent".equalsIgnoreCase(role)) {

                return new DefaultCredential("agent@propertydirect", "agent123");

            }

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "vendor".equalsIgnoreCase(role)) {

                return new DefaultCredential("vendor@propertydirect", "vendor123");

            }

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "owner".equalsIgnoreCase(role)) {

                return new DefaultCredential("owner@propertydirect", "owner123");

            }

            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "customer".equalsIgnoreCase(role)) {

                return new DefaultCredential("customer@propertydirect", "customer123");

            }

            return new DefaultCredential("", "");

        }

    }



    // --- FORGOT PASSWORD & RESET PASSWORD SYSTEM ---

    private static final Map<String, ResetTokenInfo> resetTokens = new ConcurrentHashMap<>();



    public record ResetTokenInfo(String email, String otp, LocalDateTime expiryTime, String userType) {}



    public record ForgotPasswordRequest(String email, String platform) {}

    public record VerifyResetOtpRequest(String email, String otp) {}

    public record ResetPasswordRequest(String email, String otp, String newPassword) {}



    @PostMapping("/forgot-password")

    public ResponseEntity<?> handleForgotPassword(@RequestBody ForgotPasswordRequest request) {

        if (request == null || safe(request.email()).isBlank()) {

            return ResponseEntity.badRequest().body(Map.of("message", "Please enter your registered email address"));

        }



        String normalizedEmail = safe(request.email()).toLowerCase(Locale.ROOT).trim();

        if (!normalizedEmail.contains("@") || (!normalizedEmail.contains(".") && !normalizedEmail.endsWith("@smartapartment") && !normalizedEmail.endsWith("@smartsociety"))) {

            return ResponseEntity.badRequest().body(Map.of("message", "Please enter a valid email address"));

        }



        boolean foundInAppUser = userRepository.existsByEmailIgnoreCase(normalizedEmail);

        boolean foundInCustomer = propertyDirectCustomers.findByEmailIgnoreCase(normalizedEmail).isPresent();

        if (!foundInAppUser && !foundInCustomer) {

            return ResponseEntity.status(404).body(Map.of("message", "No account found with this email address."));

        }



        // Generate 6-digit OTP

        String otp = String.format(Locale.ROOT, "%06d", new java.util.Random().nextInt(900000) + 100000);

        LocalDateTime expiry = LocalDateTime.now().plusMinutes(15);

        String userType = foundInCustomer ? "CUSTOMER" : "APP_USER";



        resetTokens.put(normalizedEmail, new ResetTokenInfo(normalizedEmail, otp, expiry, userType));



        // Dispatch real-time OTP email via MailService

        Map<String, Object> mailResult = mailService.sendPasswordResetOtp(normalizedEmail, otp);

        boolean sentRealMail = Boolean.TRUE.equals(mailResult.get("sent"));



        if (sentRealMail) {

            return ResponseEntity.ok(Map.of(

                "message", "Verification code (OTP) sent to " + normalizedEmail + ". Please check your email inbox.",

                "email", normalizedEmail,

                "emailSent", true

            ));

        }



        if (exposeOtpPreview) {

            String deliveryNote = String.valueOf(mailResult.getOrDefault("message", ""));

            return ResponseEntity.ok(Map.of(

                "message", "Verification code (OTP) generated. Enter the code below to proceed.",

                "email", normalizedEmail,

                "otpPreview", otp,

                "emailSent", false,

                "deliveryMessage", deliveryNote

            ));

        }



        resetTokens.remove(normalizedEmail);

        return ResponseEntity.status(503).body(Map.of(

            "message", "OTP email could not be sent. Configure Brevo SMTP credentials and a verified sender email, then try again.",

            "email", normalizedEmail,

            "emailSent", false,

            "deliveryMessage", String.valueOf(mailResult.getOrDefault("message", "Mail delivery failed."))

        ));

    }



    @PostMapping("/verify-reset-otp")

    public ResponseEntity<?> verifyResetOtp(@RequestBody VerifyResetOtpRequest request) {

        if (request == null || safe(request.email()).isBlank() || safe(request.otp()).isBlank()) {

            return ResponseEntity.badRequest().body(Map.of("message", "Email and OTP code are required"));

        }



        String normalizedEmail = safe(request.email()).toLowerCase(Locale.ROOT).trim();

        String otp = safe(request.otp()).trim();



        ResetTokenInfo tokenInfo = resetTokens.get(normalizedEmail);

        if (tokenInfo == null || !tokenInfo.otp().equals(otp)) {

            return ResponseEntity.badRequest().body(Map.of("message", "Invalid verification OTP code. Please check and try again."));

        }



        if (LocalDateTime.now().isAfter(tokenInfo.expiryTime())) {

            resetTokens.remove(normalizedEmail);

            return ResponseEntity.badRequest().body(Map.of("message", "Verification OTP has expired. Please request a new code."));

        }



        return ResponseEntity.ok(Map.of("message", "OTP verified successfully. Please enter your new password.", "valid", true));

    }



    @PostMapping("/reset-password")

    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {

        if (request == null || safe(request.email()).isBlank() || safe(request.newPassword()).isBlank()) {

            return ResponseEntity.badRequest().body(Map.of("message", "Email, OTP, and new password are required"));

        }



        if (safe(request.newPassword()).length() < 6) {

            return ResponseEntity.badRequest().body(Map.of("message", "New password must be at least 6 characters long"));

        }



        String normalizedEmail = safe(request.email()).toLowerCase(Locale.ROOT).trim();

        String otp = safe(request.otp()).trim();

        String newPassword = safe(request.newPassword());



        ResetTokenInfo tokenInfo = resetTokens.get(normalizedEmail);

        if (tokenInfo == null || !tokenInfo.otp().equals(otp)) {

            return ResponseEntity.badRequest().body(Map.of("message", "Invalid verification OTP code or session expired."));

        }



        if (LocalDateTime.now().isAfter(tokenInfo.expiryTime())) {

            resetTokens.remove(normalizedEmail);

            return ResponseEntity.badRequest().body(Map.of("message", "Verification OTP has expired. Please request a new code."));

        }



        // Encode and update in database

        String encodedPassword = passwordEncoder.encode(newPassword);

        boolean accountUpdated = false;



        // Update PropertyCustomer if exists

        var customerOpt = propertyDirectCustomers.findByEmailIgnoreCase(normalizedEmail);

        if (customerOpt.isPresent()) {

            PropertyCustomer customer = customerOpt.get();

            customer.setPasswordHash(encodedPassword);

            propertyDirectCustomers.save(customer);

            accountUpdated = true;

        }



        // Update AppUser if exists

        var userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (userOpt.isPresent()) {

            AppUser user = userOpt.get();

            user.setPasswordHash(encodedPassword);

            userRepository.save(user);

            accountUpdated = true;

        }



        if (!accountUpdated) {

            resetTokens.remove(normalizedEmail);

            return ResponseEntity.status(404).body(Map.of("message", "No account found with this email address."));

        }



        // Invalidate token

        resetTokens.remove(normalizedEmail);



        return ResponseEntity.ok(Map.of("message", "Password reset successfully! You can now sign in with your new password."));

    }

}

