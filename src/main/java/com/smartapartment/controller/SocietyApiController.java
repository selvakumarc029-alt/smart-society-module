package com.smartapartment.controller;

import com.smartapartment.dto.DashboardStats;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.DashboardService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.ByteArrayOutputStream;

@RestController
@RequestMapping("/api/society")
public class SocietyApiController {

    private final CurrentUserService currentUser;
    private final DashboardService dashboards;
    private final ApartmentRepository apartments;
    private final ResidentRepository residents;
    private final ComplaintRepository complaints;
    private final VisitorRepository visitors;
    private final AnnouncementRepository announcements;
    private final MaintenanceBillRepository bills;
    private final AmenityRepository amenities;
    private final BookingRepository bookings;
    private final BlockRepository blocks;
    private final AppUserRepository users;
    private final SecurityGuardAssignmentRepository securityGuardAssignments;
    private final GateRepository gates;
    private final TenantRepository tenants;
    private final SubscriptionPlanRepository subscriptionPlans;
    private final PasswordEncoder passwordEncoder;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.service.EmergencyMaintenanceService emergencyService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.CommonMaintenanceTicketRepository ticketRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.EmergencyMaintenanceBookingRepository emergencyBookings;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.MaintenancePartnerRepository maintenancePartners;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.MaintenanceHubRepository maintenanceHubs;

    public SocietyApiController(CurrentUserService currentUser, DashboardService dashboards,
                                ApartmentRepository apartments, ResidentRepository residents,
                                ComplaintRepository complaints, VisitorRepository visitors,
                                AnnouncementRepository announcements, MaintenanceBillRepository bills,
                                AmenityRepository amenities, BookingRepository bookings, BlockRepository blocks,
                                AppUserRepository users, SecurityGuardAssignmentRepository securityGuardAssignments, GateRepository gates, TenantRepository tenants,
                                SubscriptionPlanRepository subscriptionPlans, PasswordEncoder passwordEncoder) {
        this.currentUser = currentUser;
        this.dashboards = dashboards;
        this.apartments = apartments;
        this.residents = residents;
        this.complaints = complaints;
        this.visitors = visitors;
        this.announcements = announcements;
        this.bills = bills;
        this.amenities = amenities;
        this.bookings = bookings;
        this.blocks = blocks;
        this.users = users;
        this.securityGuardAssignments = securityGuardAssignments;
        this.gates = gates;
        this.tenants = tenants;
        this.subscriptionPlans = subscriptionPlans;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        AppUser user = currentUser.requireUser();
        return profileView(user);
    }

    @PutMapping("/me")
    public Map<String, Object> updateMe(@RequestBody ProfileRequest request) {
        AppUser user = currentUser.requireUser();
        String name = clean(request.name()).trim();
        String phone = clean(request.phone()).trim();
        String designation = clean(request.designation()).trim();
        if (name.isBlank()) throw new IllegalArgumentException("Full name is required");
        if (name.length() > 120 || phone.length() > 30 || designation.length() > 100) {
            throw new IllegalArgumentException("One or more profile values are too long");
        }
        user.setFullName(name);
        user.setPhone(phone.isBlank() ? null : phone);
        user.setDesignation(designation.isBlank() ? null : designation);
        return profileView(users.save(user));
    }

    @PutMapping("/me/password")
    public Map<String, String> updateMyPassword(@RequestBody PasswordChangeRequest request) {
        AppUser user = currentUser.requireUser();
        if (request.currentPassword() == null || !passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        String next = request.newPassword() == null ? "" : request.newPassword();
        if (next.length() < 8 || !next.matches(".*\\d.*") || !next.matches(".*[^A-Za-z0-9].*")) {
            throw new IllegalArgumentException("New password must be at least 8 characters and include a number and symbol");
        }
        if (passwordEncoder.matches(next, user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }
        user.setPasswordHash(passwordEncoder.encode(next));
        users.save(user);
        return Map.of("message", "Password updated successfully");
    }

    private Map<String, Object> profileView(AppUser user) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getFullName());
        profile.put("email", user.getEmail());
        profile.put("phone", user.getPhone() == null ? "" : user.getPhone());
        profile.put("designation", user.getDesignation() == null ? "" : user.getDesignation());
        profile.put("role", user.getRole().name());
        profile.put("tenantId", user.getTenantId() == null ? "Platform" : user.getTenantId());
        profile.put("accountLocked", user.isAccountLocked());
        profile.put("mfaEnabled", user.isMfaEnabled());
        profile.put("createdAt", user.getCreatedAt());
        profile.put("updatedAt", user.getUpdatedAt());
        return profile;
    }

    public record ProfileRequest(String name, String phone, String designation) {}
    public record PasswordChangeRequest(String currentPassword, String newPassword) {}

    @GetMapping("/overview")
    public DashboardStats overview() {
        return dashboards.stats(currentUser.requireTenantId());
    }

    @GetMapping("/subscription")
    public Map<String, Object> subscription() {
        String tenantId = currentUser.requireTenantId();
        Tenant tenant = tenants.findByCode(tenantId)
                .orElseThrow(() -> new IllegalStateException("Society subscription profile was not found"));
        SubscriptionPlan plan = tenant.getSubscriptionPlanId() == null ? null
                : subscriptionPlans.findById(tenant.getSubscriptionPlanId()).orElse(null);

        String planName = plan == null ? "No plan assigned" : plan.getName();
        String status = tenant.getSubscriptionStatus() == null ? "INACTIVE" : tenant.getSubscriptionStatus();
        int usedFlats = Math.toIntExact(apartments.countByTenantId(tenantId));
        int maxFlats = plan == null || plan.getMaxApartments() == null ? Math.max(usedFlats, tenant.getTotalUnits() == null ? 0 : tenant.getTotalUnits()) : plan.getMaxApartments();
        BigDecimal amount = plan == null || plan.getMonthlyPrice() == null ? BigDecimal.ZERO : plan.getMonthlyPrice();
        LocalDate startedOn = tenant.getSubscriptionStartedOn();
        LocalDate renewsOn = tenant.getSubscriptionRenewsOn();

        List<Map<String, Object>> invoices = new ArrayList<>();
        if (plan != null && startedOn != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            LocalDate invoiceDate = (renewsOn == null ? LocalDate.now().plusMonths(1) : renewsOn).minusMonths(1);
            for (int index = 0; index < 3 && !invoiceDate.isBefore(startedOn); index++) {
                LocalDate cycleEnd = invoiceDate.plusMonths(1).minusDays(1);
                Map<String, Object> invoice = new LinkedHashMap<>();
                invoice.put("number", "INV-SAAS-" + invoiceDate.toString().replace("-", ""));
                invoice.put("plan", planName);
                invoice.put("cycleStart", invoiceDate);
                invoice.put("cycleEnd", cycleEnd);
                invoice.put("amount", amount);
                invoice.put("status", "PAID");
                invoice.put("invoiceDate", invoiceDate);
                invoices.add(invoice);
                invoiceDate = invoiceDate.minusMonths(1);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("societyName", tenant.getSocietyName());
        response.put("planName", planName);
        response.put("status", status);
        response.put("billingCycle", plan == null || plan.getBillingCycle() == null ? "Not configured" : plan.getBillingCycle());
        response.put("amount", amount);
        response.put("usedFlats", usedFlats);
        response.put("maxFlats", maxFlats);
        response.put("remainingFlats", Math.max(0, maxFlats - usedFlats));
        response.put("startedOn", startedOn);
        response.put("renewsOn", renewsOn);
        response.put("invoices", invoices);
        return response;
    }

    @GetMapping("/apartments")
    public List<Map<String, Object>> apartments() {
        return apartments.findByTenantId(currentUser.requireTenantId()).stream().map(this::apartmentView).toList();
    }

    @PostMapping("/apartments") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> apartment(@Valid @RequestBody ApartmentRequest request){String tenant=currentUser.requireTenantId();if(apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(tenant,request.unitNo()).isPresent())throw new IllegalArgumentException("Apartment already exists");Block block=blocks.findFirstByTenantIdAndNameOrderByIdAsc(tenant,request.block()).orElseGet(()->{Block b=new Block();b.setTenantId(tenant);b.setName(request.block());b.setTotalFloors(Math.max(1,request.floor()));return blocks.save(b);});Apartment a=new Apartment();a.setTenantId(tenant);applyApartmentRequest(a,block,request);return apartmentView(apartments.save(a));}

    @PatchMapping("/apartments/{id}") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> updateApartment(@PathVariable Long id, @Valid @RequestBody ApartmentRequest request){String tenant=currentUser.requireTenantId();Apartment a=apartments.findById(id).filter(item->tenant.equals(item.getTenantId())).orElseThrow(()->new IllegalArgumentException("Apartment was not found"));Block block=blocks.findFirstByTenantIdAndNameOrderByIdAsc(tenant,request.block()).orElseGet(()->{Block b=new Block();b.setTenantId(tenant);b.setName(request.block());b.setTotalFloors(Math.max(1,request.floor()));return blocks.save(b);});applyApartmentRequest(a,block,request);return apartmentView(apartments.save(a));}

    private void applyApartmentRequest(Apartment a, Block block, ApartmentRequest request) {
        a.setBlock(block); a.setUnitNo(request.unitNo().trim()); a.setFloorNo(request.floor());
        a.setUnitType(request.unitType()); a.setOccupancyStatus(request.occupancy()); a.setOwnerName(request.ownerName().trim());
        a.setOwnerPhone(request.ownerPhone()); a.setOwnerEmail(request.ownerEmail());
        a.setBuiltUpAreaSqFt(request.builtUpAreaSqFt()); a.setParkingSlot(request.parkingSlot());
        a.setMonthlyMaintenance(request.monthlyMaintenance()); a.setPossessionDate(request.possessionDate()); a.setNotes(request.notes());
    }

    @PostMapping("/residents") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> resident(@Valid @RequestBody ResidentRequest request){String tenant=currentUser.requireTenantId();String email=request.email().trim().toLowerCase(Locale.ROOT);if(users.findByEmail(email).isPresent())throw new IllegalArgumentException("Email already exists");Apartment apartment=apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(tenant,request.unitNo()).orElseThrow(()->new IllegalArgumentException("Apartment was not found"));AppUser user=new AppUser();user.setTenantId(tenant);user.setFullName(request.name().trim());user.setEmail(email);user.setPhone(request.phone());user.setAddress(request.address());user.setEmergencyContactName(request.emergencyContactName());user.setEmergencyContactPhone(request.emergencyContactPhone());user.setProfileNotes(request.notes());user.setRole(UserRole.RESIDENT);user.setPasswordHash(passwordEncoder.encode(request.temporaryPassword()));user=users.save(user);Resident resident=new Resident();resident.setTenantId(tenant);resident.setUser(user);resident.setApartment(apartment);resident.setResidentType(request.residentType().toUpperCase(Locale.ROOT));resident.setMoveInDate(request.moveInDate());resident.setVehicleNumber(request.vehicleNumber());return residentView(residents.save(resident));}

    @GetMapping("/team-users")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SUPER_ADMIN','MAINTENANCE_STAFF')")
    public List<Map<String,Object>> teamUsers(){
        AppUser current = currentUser.requireUser();
        String tenant = currentUser.requireTenantId();
        List<AppUser> userList;
        if (tenant == null || "platform".equalsIgnoreCase(tenant)) {
            userList = users.findAll();
        } else {
            userList = users.findByTenantId(tenant);
        }
        if (current.getRole() == UserRole.MAINTENANCE_STAFF) {
            return userList.stream().filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF).map(this::teamUserView).toList();
        }
        return userList.stream().filter(u->List.of(UserRole.SECURITY_STAFF,UserRole.MAINTENANCE_STAFF,UserRole.ACCOUNTANT).contains(u.getRole())).map(this::teamUserView).toList();
    }

    @PostMapping("/team-users")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SUPER_ADMIN','MAINTENANCE_STAFF')")
    @Transactional
    public Map<String,Object> teamUser(@Valid @RequestBody TeamUserRequest request){
        AppUser current = currentUser.requireUser();
        String tenant = currentUser.requireTenantId();
        if (tenant == null || "platform".equalsIgnoreCase(tenant)) {
            tenant = tenants.findAll().stream()
                    .filter(Tenant::isApproved)
                    .map(Tenant::getCode)
                    .findFirst()
                    .orElse("green-heights");
        }
        UserRole role;
        try {
            role = UserRole.valueOf(request.role().toUpperCase(Locale.ROOT));
        } catch(Exception e) {
            throw new IllegalArgumentException("Invalid society team role");
        }
        if (current.getRole() == UserRole.MAINTENANCE_STAFF && role != UserRole.MAINTENANCE_STAFF) {
            throw new IllegalArgumentException("Maintenance staff can only create maintenance worker accounts");
        }
        if (!List.of(UserRole.SECURITY_STAFF,UserRole.MAINTENANCE_STAFF,UserRole.ACCOUNTANT).contains(role)) {
            throw new IllegalArgumentException("Only security, maintenance and accountant accounts can be created here");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }
        AppUser user = new AppUser();
        user.setTenantId(tenant);
        user.setFullName(request.name().trim());
        user.setEmail(email);
        user.setPhone(request.phone());
        user.setDesignation(request.designation());
        user.setEmployeeId(request.employeeId());
        user.setJoiningDate(request.joiningDate());
        user.setWorkShift(request.workShift());
        user.setAddress(request.address());
        user.setEmergencyContactName(request.emergencyContactName());
        user.setEmergencyContactPhone(request.emergencyContactPhone());
        user.setProfileNotes(request.notes());
        user.setRole(role);
        user.setStatus("ACTIVE");
        user.setPasswordHash(passwordEncoder.encode(request.temporaryPassword()));
        return teamUserView(users.save(user));
    }

    @GetMapping("/residents")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT','SECURITY_STAFF','MAINTENANCE_STAFF')")
    public List<Map<String, Object>> residents() {
        return residents.findByTenantIdOrderByIdAsc(currentUser.requireTenantId()).stream().map(this::residentView).toList();
    }

    @GetMapping("/security/resident-options")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<Map<String, Object>> securityResidentOptions() {
        AppUser user = currentUser.requireUser();
        Set<String> allowedUnits = allowedSecurityUnits(user);
        return residents.findByTenantIdOrderByIdAsc(user.getTenantId()).stream()
                .filter(resident -> allowedUnits.isEmpty() || allowedUnits.contains(resident.getApartment().getUnitNo().toUpperCase(Locale.ROOT)))
                .map(resident -> {
                    Apartment apartment = resident.getApartment();
                    return map("residentId", resident.getId(), "residentName", resident.getUser().getFullName(),
                            "phone", clean(resident.getUser().getPhone()), "unitNo", apartment.getUnitNo(),
                            "block", apartment.getBlock() == null ? "" : apartment.getBlock().getName(),
                            "label", apartment.getUnitNo() + " · " + resident.getUser().getFullName());
                }).toList();
    }

    @GetMapping("/security/assignments")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<Map<String, Object>> securityAssignments() {
        AppUser user = currentUser.requireUser();
        return securityGuardAssignments.findByTenantIdOrderByCreatedAtDesc(user.getTenantId()).stream()
                .filter(assignment -> user.getRole() == UserRole.SOCIETY_ADMIN || assignment.getSecurityGuard().getId().equals(user.getId()))
                .map(this::securityAssignmentView).toList();
    }

    @GetMapping("/security/gates")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<Map<String, Object>> securityGates() {
        return List.of(
                map("value", "Gate 1", "label", "Gate 1 · Main Entrance"),
                map("value", "Gate 2", "label", "Gate 2 · Resident Entry"),
                map("value", "Gate 3", "label", "Gate 3 · Visitor Entry"),
                map("value", "Gate 4", "label", "Gate 4 · North / Emergency Access"),
                map("value", "Service Gate", "label", "Service Gate · Vendors & Deliveries"),
                map("value", "Basement Gate", "label", "Basement Gate · Parking Access")
        );
    }

    @PostMapping("/security/assignments")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> createSecurityAssignment(@Valid @RequestBody SecurityAssignmentRequest request) {
        String tenant = currentUser.requireTenantId();
        AppUser guard = users.findById(request.securityGuardId())
                .filter(user -> tenant.equals(user.getTenantId()) && user.getRole() == UserRole.SECURITY_STAFF)
                .orElseThrow(() -> new IllegalArgumentException("Security guard was not found"));
        String type = request.assignmentType().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("FLAT", "BLOCK", "COMMON_AREA").contains(type)) throw new IllegalArgumentException("Assignment type must be FLAT, BLOCK, or COMMON_AREA");
        SecurityGuardAssignment assignment = new SecurityGuardAssignment();
        assignment.setTenantId(tenant);
        assignment.setSecurityGuard(guard);
        assignment.setAssignmentType(type);
        assignment.setAssignmentValue(request.assignmentValue().trim());
        assignment.setShiftName(clean(request.shiftName()));
        assignment.setNotes(clean(request.notes()));
        return securityAssignmentView(securityGuardAssignments.save(assignment));
    }

    @GetMapping("/complaints")
    public List<Map<String, Object>> complaints() {
        AppUser user = currentUser.requireUser();
        return complaints.findByTenantIdOrderByCreatedAtDesc(user.getTenantId()).stream()
                .filter(item -> user.getRole() != UserRole.RESIDENT ||
                        (item.getResident() != null && item.getResident().getUser().getId().equals(user.getId())))
                .filter(item -> user.getRole() != UserRole.MAINTENANCE_STAFF || "MAINTENANCE".equalsIgnoreCase(clean(item.getAssignedTo())))
                .filter(item -> user.getRole() != UserRole.SECURITY_STAFF || "SECURITY".equalsIgnoreCase(clean(item.getAssignedTo())))
                .map(this::complaintView).toList();
    }

    private LocalDateTime parseIncidentAt(Object raw) {
        if (raw == null) return LocalDateTime.now();
        if (raw instanceof LocalDateTime ldt) return ldt;
        String str = String.valueOf(raw).trim();
        if (str.isEmpty() || "null".equalsIgnoreCase(str)) return LocalDateTime.now();
        try {
            return LocalDateTime.parse(str);
        } catch (Exception e1) {
            try {
                return LocalDateTime.parse(str, java.time.format.DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e2) {
                try {
                    return LocalDateTime.parse(str, java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy hh:mm a", Locale.ENGLISH));
                } catch (Exception e3) {
                    try {
                        return LocalDateTime.parse(str, java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm", Locale.ENGLISH));
                    } catch (Exception e4) {
                        return LocalDateTime.now();
                    }
                }
            }
        }
    }

    @PostMapping("/complaints")
    @Transactional
    public Map<String, Object> createComplaint(@RequestBody ComplaintRequest request) {
        AppUser user = currentUser.requireUser();
        Resident resident = residentFor(user, request != null ? request.residentId() : null);

        String cat = (request != null && request.category() != null && !request.category().isBlank())
                ? request.category().trim() : "Plumbing";
        String desc = (request != null && request.description() != null && !request.description().isBlank())
                ? request.description().trim() : "Maintenance assistance required";
        String loc = (request != null && request.locationDetails() != null && !request.locationDetails().isBlank())
                ? request.locationDetails().trim()
                : (resident != null && resident.getApartment() != null ? resident.getApartment().getUnitNo() : "205");

        if ("Other".equalsIgnoreCase(cat) || cat.isBlank()) {
            String lower = (desc + " " + (request != null && request.title() != null ? request.title() : "")).toLowerCase(Locale.ROOT);
            if (lower.contains("leak") || lower.contains("water") || lower.contains("pipe") || lower.contains("tap") || lower.contains("drain") || lower.contains("sink") || lower.contains("flush")) {
                cat = "Plumbing";
            } else if (lower.contains("electric") || lower.contains("power") || lower.contains("light") || lower.contains("switch") || lower.contains("plug") || lower.contains("fuse") || lower.contains("wire")) {
                cat = "Electrical";
            } else if (lower.contains("wood") || lower.contains("door") || lower.contains("lock") || lower.contains("handle") || lower.contains("carpent")) {
                cat = "Carpentry";
            }
        }

        String title = (request != null && request.title() != null && !request.title().isBlank())
                ? request.title().trim()
                : (cat + ": " + (desc.length() > 30 ? desc.substring(0, 30) + "…" : desc) + " (Flat " + loc + ")");

        String priority = (request != null && request.priority() != null && !request.priority().isBlank())
                ? request.priority().trim().toUpperCase(Locale.ROOT)
                : "NORMAL";

        Complaint complaint = new Complaint();
        complaint.setTenantId(user.getTenantId());
        complaint.setResident(resident);
        complaint.setCategory(cat);
        complaint.setSubcategory(clean(request != null && request.subcategory() != null && !request.subcategory().isBlank() ? request.subcategory() : "General"));
        complaint.setPriority(priority);
        complaint.setTitle(title);
        complaint.setDescription(desc);
        complaint.setLocationDetails(loc);
        complaint.setIncidentAt(parseIncidentAt(request != null ? request.incidentAt() : null));
        complaint.setPreferredContactMethod(clean(request != null && request.preferredContactMethod() != null && !request.preferredContactMethod().isBlank() ? request.preferredContactMethod() : "PHONE"));
        complaint.setReporterPhone(clean(request != null && request.reporterPhone() != null && !request.reporterPhone().isBlank() ? request.reporterPhone() : (user.getPhone() != null ? user.getPhone() : "8778293269")));
        complaint.setAccessPermission(request != null && request.accessPermission());
        complaint.setAttachmentReference(clean(request != null ? request.attachmentReference() : ""));
        complaint.setStatus("OPEN");
        complaint.setDueAt(LocalDateTime.now().plusHours(slaHours(complaint.getPriority())));

        boolean isMaintenance = isMaintenanceCategory(complaint.getCategory());
        boolean adminBusy = isMaintenance && emergencyService != null && emergencyService.isMaintenanceAdminBusy(user.getTenantId());

        com.smartapartment.entity.MaintenancePartner matchedPartner = null;
        AppUser matchedWorker = null;

        if (adminBusy) {
            if (emergencyService != null) {
                matchedWorker = emergencyService.findFreeMaintenanceWorker(user.getTenantId(), complaint.getCategory()).orElse(null);
            }
            if (matchedWorker != null && maintenancePartners != null) {
                matchedPartner = maintenancePartners.findByUserId(matchedWorker.getId()).orElse(null);
            }
            if (matchedPartner == null && maintenancePartners != null) {
                final String finalCat = cat;
                matchedPartner = maintenancePartners.findAll().stream()
                        .filter(com.smartapartment.entity.MaintenancePartner::isOnDuty)
                        .filter(p -> "IDLE".equalsIgnoreCase(p.getAvailability()) || "AVAILABLE".equalsIgnoreCase(p.getAvailability()))
                        .filter(p -> emergencyService == null || emergencyService.isTradeMatch(p, finalCat))
                        .findFirst()
                        .orElse(null);
            }

            String assigneeName = matchedWorker != null ? matchedWorker.getFullName()
                    : (matchedPartner != null ? matchedPartner.getPartnerName() : null);

            if (assigneeName != null) {
                complaint.setAssignedTo(assigneeName);
                complaint.setStatus("IN_PROGRESS");
                complaint.setResolutionNotes("⚡ Auto-assigned to worker " + assigneeName + " (" + cat + ") [Attendance: Present | Workload Match] because Maintenance Team Head is busy.");
                if (matchedPartner != null) {
                    matchedPartner.setAvailability("BUSY");
                    matchedPartner.setWorkState("BUSY");
                    maintenancePartners.save(matchedPartner);
                }
            } else {
                complaint.setAssignedTo("");
                complaint.setStatus("OPEN");
                complaint.setResolutionNotes("Maintenance Team Head is busy; ticket queued for auto-assignment within 10-minute SLA window.");
            }
        } else {
            complaint.setAssignedTo(clean(request != null ? request.assignedTo() : ""));
            complaint.setStatus("OPEN");
        }

        Complaint saved = complaints.save(complaint);

        // Emergency Maintenance Booking for Dispatch Pipeline & Real-Time SSE
        if (emergencyBookings != null && isMaintenance) {
            try {
                EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
                b.setTenantId(user.getTenantId());
                b.setSourcePlatform("smartsociety");
                b.setRequesterId(user.getId());
                b.setRequesterName(user.getFullName());
                b.setRequesterPhone(saved.getReporterPhone());
                b.setServiceAddress("Flat " + loc + ", " + (user.getTenantId() != null ? user.getTenantId() : "Smart Society"));
                b.setCity("Chennai");
                b.setArea("Whitefield");
                b.setCategory(saved.getCategory());
                b.setDescription(saved.getTitle() + " - " + saved.getDescription());
                b.setLatitude(12.9716);
                b.setLongitude(77.5946);
                b.setUnitNumber(loc);

                if (maintenanceHubs != null) {
                    maintenanceHubs.findAll().stream().filter(com.smartapartment.entity.MaintenanceHub::isActive).findFirst()
                            .ifPresentOrElse(h -> b.setHubId(h.getId()), () -> {
                                maintenanceHubs.findAll().stream().findFirst().ifPresent(h -> b.setHubId(h.getId()));
                            });
                }

                if (adminBusy && (matchedPartner != null || matchedWorker != null)) {
                    Long pId = matchedPartner != null ? matchedPartner.getId() : (matchedWorker != null ? matchedWorker.getId() : null);
                    String name = matchedWorker != null ? matchedWorker.getFullName() : (matchedPartner != null ? matchedPartner.getPartnerName() : "Assigned Worker");
                    b.setPartnerId(pId);
                    b.setJobStatus("ASSIGNED");
                    b.setAssignmentType("Auto");
                    b.setAssignedAt(LocalDateTime.now());
                    b.setAcceptedAt(LocalDateTime.now());
                    b.setArrivalDueAt(LocalDateTime.now().plusMinutes(30));
                    b.setDispatchReason("⚡ Auto-assigned to " + name + " because Maintenance Team Head is busy (Multi-Factor Match)");
                } else {
                    b.setJobStatus("UNASSIGNED");
                    b.setDispatchReason(adminBusy ? "Queued for auto-assignment within 10-minute SLA window" : "New resident complaint awaiting Maintenance Team Head assignment");
                }

                EmergencyMaintenanceBooking savedBooking = emergencyBookings.save(b);
                savedBooking.setOrderReference("EM-" + String.format(Locale.ROOT, "%04d", savedBooking.getId()));
                savedBooking = emergencyBookings.save(savedBooking);

                if (emergencyService != null) {
                    if (adminBusy && (matchedPartner != null || matchedWorker != null)) {
                        String name = matchedWorker != null ? matchedWorker.getFullName() : matchedPartner.getPartnerName();
                        emergencyService.broadcastEvent(savedBooking.getId(), "ASSIGNED", "AUTO_ASSIGNED",
                                matchedPartner != null ? matchedPartner.getId() : matchedWorker.getId(),
                                "⚡ Auto-assigned to " + name + " (" + saved.getCategory() + ") [Maintenance Team Head Busy]");
                    } else {
                        emergencyService.broadcastEvent(savedBooking.getId(), "UNASSIGNED", "CREATED", null,
                                "🔔 New complaint from Flat " + loc + " (" + saved.getCategory() + ") - Awaiting Maintenance Assignment");
                    }
                }
            } catch (Exception ex) {
                System.err.println("Warning: failed to create emergency dispatch booking: " + ex.getMessage());
            }
        }

        if (ticketRepository != null && isMaintenance) {
            try {
                CommonMaintenanceTicket t = new CommonMaintenanceTicket();
                t.setTenantId(user.getTenantId());
                t.setSourcePlatform("smartsociety");
                t.setRequesterId(user.getId());
                t.setRequesterName(user.getFullName());
                t.setRequesterPhone(saved.getReporterPhone());
                t.setTargetEntityType("COMPLAINT");
                t.setTargetEntityId(saved.getId());
                t.setTitle(saved.getTitle());
                t.setDescription(saved.getDescription());
                t.setServiceAddress(saved.getLocationDetails() != null && !saved.getLocationDetails().isBlank() 
                        ? saved.getLocationDetails() 
                        : (resident != null && resident.getApartment() != null ? "Flat " + resident.getApartment().getUnitNo() : "Flat " + loc));
                t.setCity("Chennai");
                t.setServiceType(saved.getCategory());
                t.setServiceCategory(saved.getCategory());
                t.setPriority(saved.getPriority());
                t.setDueAt(saved.getDueAt());
                if (!saved.getAssignedTo().isBlank()) {
                    t.setTicketStatus("ASSIGNED");
                    t.setVendorId(matchedWorker != null ? matchedWorker.getId() : (matchedPartner != null ? matchedPartner.getUserId() : null));
                    t.setVendorName(saved.getAssignedTo());
                    t.setVendorEmail(matchedWorker != null ? matchedWorker.getEmail() : null);
                    t.setVendorPhone(matchedWorker != null ? matchedWorker.getPhone() : (matchedPartner != null ? matchedPartner.getPhone() : null));
                    t.setVendorNotes(saved.getResolutionNotes());
                    t.setAssignedAt(LocalDateTime.now());
                } else {
                    t.setTicketStatus("REQUESTED");
                    t.setVendorNotes(adminBusy 
                            ? "Maintenance Team Head is busy; queued for auto-assignment within 10-minute SLA window."
                            : "Awaiting Maintenance Team Head assignment.");
                }
                ticketRepository.save(t);
            } catch (Exception ignored) {}
        }

        return complaintView(saved);
    }

    private boolean isMaintenanceCategory(String category) {
        if (category == null || category.isBlank()) return false;
        String cat = category.toUpperCase(Locale.ROOT);
        return cat.contains("MAINTENANCE") || cat.contains("PLUMB") || cat.contains("ELECT")
                || cat.contains("CARPENT") || cat.contains("AC") || cat.contains("HVAC")
                || cat.contains("LIFT") || cat.contains("CIVIL") || cat.contains("REPAIR");
    }

    @PatchMapping("/complaints/{id}")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','MAINTENANCE_STAFF')")
    @Transactional
    public Map<String, Object> updateComplaint(@PathVariable Long id, @Valid @RequestBody ComplaintUpdate request) {
        AppUser actor = currentUser.requireUser();
        Complaint complaint = complaints.findByIdAndTenantId(id, actor.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Complaint was not found"));
        if (actor.getRole() != UserRole.SOCIETY_ADMIN) {
            if (!clean(request.assignedTo()).isBlank() && !clean(request.assignedTo()).equalsIgnoreCase(clean(complaint.getAssignedTo()))) {
                throw new IllegalArgumentException("Only the Society Admin can assign a complaint");
            }
            if (!Set.of("IN_PROGRESS", "RESOLVED").contains(request.status().trim().toUpperCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Only the Society Admin can change this complaint status");
            }
        }
        complaint.setStatus(request.status().trim().toUpperCase(Locale.ROOT));
        if (actor.getRole() == UserRole.SOCIETY_ADMIN) complaint.setAssignedTo(clean(request.assignedTo()));
        complaint.setResolutionNotes(clean(request.resolutionNotes()));
        complaint.setSparePartsUsed(clean(request.sparePartsUsed()));
        complaint.setRepairCost(request.repairCost());
        if ("CLOSED".equals(complaint.getStatus()) || "RESOLVED".equals(complaint.getStatus())) complaint.setClosedAt(LocalDateTime.now());
        return complaintView(complaints.save(complaint));
    }

    @PatchMapping("/complaints/{id}/assignment")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> assignComplaint(@PathVariable Long id, @Valid @RequestBody ComplaintAssignment request) {
        Complaint complaint = complaints.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Complaint was not found"));
        String team = request.team().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("MAINTENANCE", "SECURITY").contains(team)) {
            throw new IllegalArgumentException("Choose either the Maintenance or Security team");
        }
        complaint.setAssignedTo(team);
        complaint.setStatus("ASSIGNED");
        complaint.setResolutionNotes(clean(request.assignmentNote()));
        return complaintView(complaints.save(complaint));
    }

    @GetMapping("/visitors")
    public List<Map<String, Object>> visitors() {
        AppUser user = currentUser.requireUser();
        Set<String> allowedUnits = allowedSecurityUnits(user);
        return visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream()
                .filter(item -> user.getRole() != UserRole.RESIDENT ||
                        (item.getResident() != null && item.getResident().getUser().getId().equals(user.getId())))
                .filter(item -> user.getRole() != UserRole.SECURITY_STAFF || allowedUnits.isEmpty()
                        || allowedUnits.contains(item.getResident().getApartment().getUnitNo().toUpperCase(Locale.ROOT)))
                .map(this::visitorView).toList();
    }

    @PostMapping("/visitors")
    @Transactional
    public Map<String, Object> createVisitor(@Valid @RequestBody VisitorRequest request) {
        AppUser user = currentUser.requireUser();
        Visitor visitor = new Visitor();
        visitor.setTenantId(user.getTenantId());
        Resident destinationResident = residentFor(user, request.residentId(), request.unitNo());
        ensureSecurityCanAccess(user, destinationResident);
        visitor.setResident(destinationResident);
        visitor.setVisitorName(request.name().trim());
        visitor.setVisitorPhone(request.phone().trim());
        visitor.setVisitorEmail(clean(request.email()));
        visitor.setPurpose(request.purpose().trim());
        visitor.setVehicleNumber(clean(request.vehicleNumber()));
        visitor.setPhotoReference(clean(request.photoReference()));
        visitor.setEntryType(clean(request.entryType()).isBlank() ? "GUEST" : request.entryType().toUpperCase(Locale.ROOT));
        visitor.setVisitorCategory(visitor.getEntryType());
        String requestedGate = clean(request.gateNumber()).isBlank() ? "Gate 1" : clean(request.gateNumber()).trim();
        visitor.setGateNumber(requestedGate);
        resolveGateByNumber(user.getTenantId(), requestedGate).ifPresent(visitor::setEntryGate);
        if (user.getRole() == UserRole.SECURITY_STAFF) visitor.setEntrySecurity(user);
        visitor.setIdProofType(clean(request.idProofType()));
        visitor.setIdProofNumber(clean(request.idProofNumber()));
        visitor.setPersonsCount(request.personsCount() == null ? 1 : request.personsCount());
        visitor.setSpecialInstructions(clean(request.specialInstructions()));
        visitor.setExpectedAt(request.expectedAt());
        boolean preApproved = user.getRole() == UserRole.RESIDENT || user.getRole() == UserRole.SOCIETY_ADMIN;
        visitor.setApprovalStatus(preApproved ? "APPROVED" : "PENDING");
        visitor.setQrCode(UUID.randomUUID().toString());
        visitor.setStatus(preApproved ? "EXPECTED" : "PENDING_APPROVAL");
        visitor = visitors.save(visitor);
        if (clean(visitor.getPassNumber()).isBlank()) {
            visitor.setPassNumber("PASS-" + LocalDate.now().getYear() + "-" + String.format("%06d", visitor.getId()));
            visitor = visitors.save(visitor);
        }
        return visitorView(visitor);
    }

    /**
     * Native HTML-form fallback for the gate desk.  The security dashboard must
     * remain usable when a browser or extension prevents page JavaScript from
     * loading, so this endpoint deliberately returns the user to the register.
     */
    @PostMapping(value = "/visitors/form", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @PreAuthorize("hasRole('SECURITY_STAFF')")
    @Transactional
    public ResponseEntity<Void> createVisitorFromGateForm(@RequestParam String name,
                                                           @RequestParam String phone,
                                                           @RequestParam String unitNo,
                                                           @RequestParam String purpose,
                                                           @RequestParam(required = false) String gateNumber,
                                                           @RequestParam(required = false) String vehicleNumber) {
        AppUser user = currentUser.requireUser();
        String cleanName = clean(name).trim();
        String cleanPhone = clean(phone).trim();
        String cleanUnit = clean(unitNo).trim();
        String cleanPurpose = clean(purpose).trim();
        if (cleanName.isBlank() || cleanPhone.isBlank() || cleanUnit.isBlank() || cleanPurpose.isBlank()) {
            throw new IllegalArgumentException("Name, phone, flat and purpose are required");
        }
        if (!cleanPhone.matches("\\d{7,15}")) {
            throw new IllegalArgumentException("Phone number must contain 7 to 15 digits only");
        }
        if (!cleanUnit.matches("[A-Za-z0-9\\-\\s]{1,30}")) {
            throw new IllegalArgumentException("Choose a valid target flat");
        }
        Visitor visitor = new Visitor();
        visitor.setTenantId(user.getTenantId());
        Resident destinationResident = residentFor(user, null, cleanUnit);
        ensureSecurityCanAccess(user, destinationResident);
        visitor.setResident(destinationResident);
        visitor.setVisitorName(cleanName);
        visitor.setVisitorPhone(cleanPhone);
        visitor.setPurpose(cleanPurpose);
        visitor.setVehicleNumber(clean(vehicleNumber));
        visitor.setEntryType("WALK_IN");
        visitor.setVisitorCategory("GUEST");
        String requestedGate = clean(gateNumber).isBlank() ? "Gate 1" : clean(gateNumber).trim();
        visitor.setGateNumber(requestedGate);
        resolveGateByNumber(user.getTenantId(), requestedGate).ifPresent(visitor::setEntryGate);
        visitor.setEntrySecurity(user);
        visitor.setExpectedAt(LocalDateTime.now());
        visitor.setApprovalStatus("PENDING");
        visitor.setQrCode(UUID.randomUUID().toString());
        visitor.setStatus("PENDING_APPROVAL");
        visitor = visitors.save(visitor);
        visitor.setPassNumber("PASS-" + LocalDate.now().getYear() + "-" + String.format("%06d", visitor.getId()));
        visitors.save(visitor);
        return redirectToSecurity("entries");
    }

    @PatchMapping("/visitors/{id}/{action}")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> visitorAction(@PathVariable Long id, @PathVariable String action, @RequestParam(required = false) String gateNumber) {
        Visitor visitor = visitors.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Visitor was not found"));
        ensureSecurityCanAccess(currentUser.requireUser(), visitor.getResident());
        if ("checkin".equalsIgnoreCase(action)) {
            if (!"APPROVED".equalsIgnoreCase(visitor.getApprovalStatus())) throw new IllegalArgumentException("Resident approval is required before entry");
            if (visitor.getCheckInAt() != null) throw new IllegalArgumentException("Visitor is already checked in");
            Gate selectedGate = resolveGateByNumber(currentUser.requireTenantId(), clean(gateNumber).isBlank() ? visitor.getGateNumber() : gateNumber).orElse(visitor.getEntryGate());
            if (selectedGate != null) visitor.setEntryGate(selectedGate);
            visitor.setEntrySecurity(currentUser.requireUser());
            visitor.setCheckInAt(LocalDateTime.now());
            visitor.setStatus("CHECKED_IN");
        } else if ("checkout".equalsIgnoreCase(action)) {
            if (visitor.getCheckInAt() == null) throw new IllegalArgumentException("Visitor must check in first");
            if (visitor.getCheckOutAt() != null) throw new IllegalArgumentException("Visitor is already checked out");
            Gate selectedGate = resolveGateByNumber(currentUser.requireTenantId(), clean(gateNumber).isBlank() ? visitor.getGateNumber() : gateNumber).orElse(visitor.getEntryGate());
            visitor.setExitGate(selectedGate);
            visitor.setExitSecurity(currentUser.requireUser());
            LocalDateTime exitAt = LocalDateTime.now();
            visitor.setExitTime(exitAt);
            visitor.setCheckOutAt(exitAt);
            visitor.setStatus("CHECKED_OUT");
        } else {
            throw new IllegalArgumentException("Unsupported visitor action");
        }
        return visitorView(visitors.save(visitor));
    }

    /** Native HTML-form fallback for the static gate register rows. */
    @PostMapping(value = "/visitors/action-by-name", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @PreAuthorize("hasRole('SECURITY_STAFF')")
    @Transactional
    public ResponseEntity<Void> visitorActionByName(@RequestParam String visitorName,
                                                     @RequestParam String action,
                                                     @RequestParam(required = false, defaultValue = "entries") String section) {
        String requestedAction = clean(action).trim().toLowerCase(Locale.ROOT);
        if (!Set.of("checkin", "checkout").contains(requestedAction)) {
            throw new IllegalArgumentException("Unsupported visitor action");
        }
        List<Visitor> tenantVisitors = visitors.findByTenantIdOrderByExpectedAtDesc(currentUser.requireTenantId());
        Visitor visitor = tenantVisitors.stream()
                .filter(item -> clean(item.getVisitorName()).equalsIgnoreCase(clean(visitorName).trim()))
                .filter(item -> allowedSecurityUnits(currentUser.requireUser()).isEmpty()
                        || allowedSecurityUnits(currentUser.requireUser()).contains(item.getResident().getApartment().getUnitNo().toUpperCase(Locale.ROOT)))
                .filter(item -> "checkout".equals(requestedAction) ? item.getCheckInAt() != null && item.getCheckOutAt() == null : item.getCheckInAt() == null)
                .findFirst()
                .orElseGet(() -> createGateFallbackVisitor(clean(visitorName).trim(), requestedAction));
        if ("checkin".equals(requestedAction)) {
            if (!"APPROVED".equalsIgnoreCase(visitor.getApprovalStatus())) throw new IllegalArgumentException("Resident approval is required before entry");
            visitor.setEntrySecurity(currentUser.requireUser());
            visitor.setCheckInAt(LocalDateTime.now());
            visitor.setStatus("CHECKED_IN");
        } else {
            LocalDateTime exitAt = LocalDateTime.now();
            visitor.setExitGate(visitor.getEntryGate());
            visitor.setExitSecurity(currentUser.requireUser());
            visitor.setExitTime(exitAt);
            visitor.setCheckOutAt(exitAt);
            visitor.setStatus("CHECKED_OUT");
        }
        visitors.save(visitor);
        return redirectToSecurity("visitors".equals(section) ? "visitors" : "entries",
                "checkin".equals(requestedAction) ? "Entry allowed and recorded." : "Visitor check-out recorded.");
    }

    @PostMapping("/visitors/scan")
    @PreAuthorize("hasRole('SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> scanVisitorPass(@Valid @RequestBody VisitorScanRequest request) {
        Visitor visitor = visitors.findByTenantIdAndQrCode(currentUser.requireTenantId(), request.qrCode().trim())
                .orElseThrow(() -> new IllegalArgumentException("Visitor pass was not found"));
        if (!"EXPECTED".equals(visitor.getStatus())) throw new IllegalArgumentException("This visitor pass is no longer valid for entry");
        if (visitor.getExpectedAt().isBefore(LocalDateTime.now().minusHours(24))) throw new IllegalArgumentException("This visitor pass has expired");
        String scanGate = clean(request.gateNumber()).isBlank() ? "Gate 1" : clean(request.gateNumber()).trim();
        visitor.setGateNumber(scanGate);
        resolveGateByNumber(currentUser.requireTenantId(), scanGate).ifPresent(visitor::setEntryGate);
        visitor.setEntrySecurity(currentUser.requireUser());
        visitor.setCheckInAt(LocalDateTime.now());
        visitor.setStatus("CHECKED_IN");
        return visitorView(visitors.save(visitor));
    }

    @GetMapping(value = "/visitors/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> visitorPassQr(@PathVariable Long id) throws Exception {
        AppUser user = currentUser.requireUser();
        Visitor visitor = visitors.findByIdAndTenantId(id, user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Visitor pass was not found"));
        if (user.getRole() == UserRole.RESIDENT && (visitor.getResident() == null || !visitor.getResident().getUser().getId().equals(user.getId()))) {
            throw new IllegalArgumentException("Visitor pass is not available to this resident");
        }
        BitMatrix matrix = new QRCodeWriter().encode(visitor.getQrCode(), BarcodeFormat.QR_CODE, 240, 240);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", output);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(output.toByteArray());
    }

    @GetMapping("/announcements")
    public List<Map<String, Object>> announcements() {
        AppUser user = currentUser.requireUser();
        LocalDateTime now = LocalDateTime.now();
        return announcements.findByTenantIdOrderByCreatedAtDesc(user.getTenantId()).stream()
                .filter(a -> canViewAnnouncement(user.getRole(), clean(a.getAudience()).toUpperCase(Locale.ROOT)))
                .filter(a -> user.getRole() == UserRole.SOCIETY_ADMIN || (a.getEffectiveFrom() == null || !a.getEffectiveFrom().isAfter(now)))
                .filter(a -> user.getRole() == UserRole.SOCIETY_ADMIN || a.getValidUntil() == null || !a.getValidUntil().isBefore(now))
                .map(a -> map("id", a.getId(), "title", a.getTitle(), "message", a.getMessage(),
                        "audience", a.getAudience(), "emergency", a.isEmergency(), "createdAt", a.getCreatedAt(),
                        "category", clean(a.getCategory()), "effectiveFrom", a.getEffectiveFrom(), "validUntil", a.getValidUntil(),
                        "actionRequired", a.isActionRequired(), "contactPerson", clean(a.getContactPerson()),
                        "contactPhone", clean(a.getContactPhone()), "attachmentReference", clean(a.getAttachmentReference()),
                        "inAppNotification", a.isInAppNotification(), "emailNotification", a.isEmailNotification()))
                .toList();
    }

    @PostMapping("/announcements")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> announce(@Valid @RequestBody AnnouncementRequest request) {
        Announcement item = new Announcement();
        item.setTenantId(currentUser.requireTenantId());
        item.setTitle(request.title().trim());
        item.setMessage(request.message().trim());
        item.setAudience(request.audience().trim().toUpperCase(Locale.ROOT));
        if (!Set.of("ALL", "RESIDENTS", "STAFF", "MAINTENANCE", "SECURITY").contains(item.getAudience())) throw new IllegalArgumentException("Invalid announcement audience");
        item.setEmergency(request.emergency());
        item.setCategory(clean(request.category()).isBlank() ? "GENERAL" : request.category().trim().toUpperCase(Locale.ROOT));
        item.setEffectiveFrom(request.effectiveFrom() == null ? LocalDateTime.now() : request.effectiveFrom());
        item.setValidUntil(request.validUntil() == null ? LocalDateTime.now().plusDays(30) : request.validUntil());
        if (!item.getValidUntil().isAfter(item.getEffectiveFrom())) throw new IllegalArgumentException("Expiry must be after the effective time");
        item.setActionRequired(request.actionRequired()); item.setContactPerson(clean(request.contactPerson()));
        item.setContactPhone(clean(request.contactPhone())); item.setAttachmentReference(clean(request.attachmentReference()));
        item.setInAppNotification(request.inAppNotification()); item.setEmailNotification(request.emailNotification());
        item = announcements.save(item);
        String savedAudience = item.getAudience();
        long recipientCount = users.findByTenantId(item.getTenantId()).stream()
                .filter(user -> canViewAnnouncement(user.getRole(), savedAudience))
                .count();
        long residentCount = users.findByTenantId(item.getTenantId()).stream()
                .filter(user -> user.getRole() == UserRole.RESIDENT)
                .count();
        return Map.of("id", item.getId(), "message", "Announcement published", "recipientCount", recipientCount,
                "residentCount", residentCount,
                "notification", item.isInAppNotification() ? "Selected dashboard users will see this notice" : "Notice board record created");
    }

    @GetMapping("/bills")
    public List<Map<String, Object>> bills() {
        AppUser user = currentUser.requireUser();
        return bills.findByTenantIdOrderByDueDateDesc(user.getTenantId()).stream()
                .filter(bill -> user.getRole() != UserRole.RESIDENT || ownsApartment(user, bill.getApartment()))
                .map(this::billView).toList();
    }

    @GetMapping("/amenities")
    public List<Map<String, Object>> amenities() {
        return amenities.findByTenantIdOrderByNameAsc(currentUser.requireTenantId()).stream()
                .map(a -> Map.<String, Object>of("id", a.getId(), "name", a.getName(), "capacity", a.getCapacity(),
                        "bookingFee", value(a.getBookingFee()), "approvalRequired", a.isApprovalRequired()))
                .toList();
    }

    @PostMapping("/amenities") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> amenity(@Valid @RequestBody AmenityRequest request){Amenity a=new Amenity();a.setTenantId(currentUser.requireTenantId());a.setName(request.name());a.setCapacity(request.capacity());a.setBookingFee(request.bookingFee());a.setApprovalRequired(request.approvalRequired());a=amenities.save(a);return Map.of("id",a.getId(),"message","Amenity created");}

    @PatchMapping("/amenities/{id}") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> updateAmenity(@PathVariable Long id, @Valid @RequestBody AmenityRequest request) {
        Amenity amenity = amenities.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        amenity.setName(request.name());
        amenity.setCapacity(request.capacity());
        amenity.setBookingFee(request.bookingFee());
        amenity.setApprovalRequired(request.approvalRequired());
        amenity = amenities.save(amenity);
        return Map.of("id", amenity.getId(), "message", "Amenity price and settings updated");
    }

    @GetMapping("/bookings")
    public List<Map<String, Object>> bookings() {
        AppUser user = currentUser.requireUser();
        return bookings.findByTenantIdOrderByStartTimeDesc(user.getTenantId()).stream()
                .filter(b -> user.getRole() != UserRole.RESIDENT || b.getResident().getUser().getId().equals(user.getId()))
                .map(this::bookingView).toList();
    }

    @PostMapping("/bookings")
    @PreAuthorize("hasRole('RESIDENT')")
    @Transactional
    public Map<String, Object> book(@Valid @RequestBody BookingRequest request) {
        AppUser user = currentUser.requireUser();
        if (!request.endTime().isAfter(request.startTime())) throw new IllegalArgumentException("End time must be after start time");
        Amenity amenity = amenities.findByIdAndTenantId(request.amenityId(), user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        if (bookings.existsByTenantIdAndAmenityIdAndStartTimeLessThanAndEndTimeGreaterThan(
                user.getTenantId(), amenity.getId(), request.endTime(), request.startTime())) {
            throw new IllegalArgumentException("Amenity is already booked for this time");
        }
        Booking booking = new Booking();
        booking.setTenantId(user.getTenantId());
        booking.setAmenity(amenity);
        booking.setResident(residentFor(user, null));
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setApprovalStatus(amenity.isApprovalRequired() ? "PENDING" : "APPROVED");
        booking.setAmount(value(amenity.getBookingFee()));
        booking.setPaymentMethod("ONLINE");
        booking.setPaymentStatus("PENDING");
        booking.setBookingReference("AMB-" + System.currentTimeMillis());
        booking.setEventType("RESIDENT_REQUEST");
        booking.setEventPurpose(clean(request.eventPurpose()));
        booking.setExpectedGuests(request.expectedGuests() == null ? 0 : request.expectedGuests());
        booking.setVehicleCount(request.vehicleCount() == null ? 0 : request.vehicleCount());
        booking.setOrganizerName(user.getFullName());
        booking.setOrganizerPhone(clean(request.contactNumber()));
        booking.setSpecialInstructions(clean(request.specialInstructions()));
        return bookingView(bookings.save(booking));
    }

    @PostMapping("/bookings/admin")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> createAdminBooking(@Valid @RequestBody AdminBookingRequest request) {
        AppUser user = currentUser.requireUser();
        if (!request.endTime().isAfter(request.startTime())) throw new IllegalArgumentException("End time must be after start time");
        Amenity amenity = amenities.findByIdAndTenantId(request.amenityId(), user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        if (bookings.existsByTenantIdAndAmenityIdAndStartTimeLessThanAndEndTimeGreaterThan(
                user.getTenantId(), amenity.getId(), request.endTime(), request.startTime())) {
            throw new IllegalArgumentException("Amenity is already booked for this time");
        }
        String paymentMethod = request.paymentMethod().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ONLINE", "CASH", "BANK TRANSFER", "UPI").contains(paymentMethod)) throw new IllegalArgumentException("Unsupported payment method");
        Booking booking = new Booking();
        booking.setTenantId(user.getTenantId());
        booking.setAmenity(amenity);
        booking.setResident(residentFor(user, request.residentId()));
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setApprovalStatus(amenity.isApprovalRequired() ? "PENDING" : "APPROVED");
        booking.setAmount(value(amenity.getBookingFee()));
        booking.setPaymentMethod(paymentMethod);
        booking.setPaymentStatus(paymentMethod.equals("CASH") ? "PENDING_COLLECTION" : "PAID");
        booking.setPaymentReference(clean(request.paymentReference()));
        booking.setBookingReference("AMB-" + System.currentTimeMillis());
        booking.setEventType(clean(request.eventType())); booking.setEventPurpose(clean(request.eventPurpose()));
        booking.setExpectedGuests(request.expectedGuests()); booking.setChildrenCount(request.childrenCount()); booking.setVehicleCount(request.vehicleCount());
        booking.setOrganizerName(clean(request.organizerName())); booking.setOrganizerPhone(clean(request.organizerPhone())); booking.setOrganizerEmail(clean(request.organizerEmail()));
        booking.setSetupStyle(clean(request.setupStyle())); booking.setEquipmentRequired(clean(request.equipmentRequired()));
        booking.setCateringDetails(clean(request.cateringDetails())); booking.setDecorationDetails(clean(request.decorationDetails()));
        booking.setAccessibilityNeeds(clean(request.accessibilityNeeds())); booking.setVehicleDetails(clean(request.vehicleDetails()));
        booking.setSecurityDeposit(value(request.securityDeposit())); booking.setDepositStatus(clean(request.depositStatus()));
        booking.setTermsAccepted(request.termsAccepted() ? "YES" : "NO"); booking.setEmergencyContact(clean(request.emergencyContact()));
        booking.setSpecialInstructions(clean(request.specialInstructions()));
        return bookingView(bookings.save(booking));
    }

    @PatchMapping("/bookings/{id}/approval")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> updateBookingApproval(@PathVariable Long id, @Valid @RequestBody BookingApprovalRequest request) {
        Booking booking = bookings.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Booking was not found"));
        String approval = request.approvalStatus().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(approval)) throw new IllegalArgumentException("Approval status must be APPROVED or REJECTED");
        booking.setApprovalStatus(approval);
        return bookingView(bookings.save(booking));
    }

    private Resident residentFor(AppUser user, Long requestedId) { return residentFor(user, requestedId, null); }
    private Resident residentFor(AppUser user, Long requestedId, String unitNo) {
        if (user.getRole() == UserRole.RESIDENT) {
            return residents.findFirstByUserOrderByIdAsc(user)
                    .orElseGet(() -> {
                        Apartment apartment = apartments.findByTenantId(user.getTenantId()).stream().findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("Add an apartment before creating visitor requests"));
                        Resident resident = new Resident();
                        resident.setTenantId(user.getTenantId());
                        resident.setUser(user);
                        resident.setApartment(apartment);
                        resident.setResidentType("RESIDENT");
                        return residents.save(resident);
                    });
        }
        if (requestedId == null && clean(unitNo).isBlank()) throw new IllegalArgumentException("Resident is required");
        if (requestedId == null) return residents.findByTenantIdOrderByIdAsc(user.getTenantId()).stream()
                .filter(resident -> unitNo.trim().equalsIgnoreCase(resident.getApartment().getUnitNo())).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Resident apartment was not found"));
        return residents.findByIdAndTenantId(requestedId, user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Resident was not found"));
    }

    private boolean ownsApartment(AppUser user, Apartment apartment) {
        return residents.findFirstByUserOrderByIdAsc(user)
                .map(r -> r.getApartment().getId().equals(apartment.getId())).orElse(false);
    }

    private Map<String, Object> apartmentView(Apartment a) {
        return map("id", a.getId(), "apartmentCode", a.getApartmentCode(), "unitNo", a.getUnitNo(), "block", a.getBlock() == null ? "" : a.getBlock().getName(),
                "floor", a.getFloorNo(), "type", a.getUnitType(), "occupancy", a.getOccupancyStatus(),
                "ownerName", clean(a.getOwnerName()), "ownerPhone", clean(a.getOwnerPhone()), "ownerEmail", clean(a.getOwnerEmail()),
                "builtUpAreaSqFt", a.getBuiltUpAreaSqFt(), "parkingSlot", clean(a.getParkingSlot()),
                "monthlyMaintenance", value(a.getMonthlyMaintenance()), "possessionDate", a.getPossessionDate(), "notes", clean(a.getNotes()));
    }

    private Map<String, Object> residentView(Resident r) {
        return map("id", r.getId(), "name", r.getUser().getFullName(), "email", r.getUser().getEmail(),
                "phone", clean(r.getUser().getPhone()), "unitNo", r.getApartment().getUnitNo(),
                "residentType", r.getResidentType(), "vehicleNumber", clean(r.getVehicleNumber()), "moveInDate", r.getMoveInDate());
    }

    private Map<String,Object> teamUserView(AppUser u){return map("id",u.getId(),"name",u.getFullName(),"email",u.getEmail(),"phone",clean(u.getPhone()),"role",u.getRole().name(),"designation",clean(u.getDesignation()),"employeeId",clean(u.getEmployeeId()),"joiningDate",u.getJoiningDate(),"workShift",clean(u.getWorkShift()),"accountLocked",u.isAccountLocked());}

    private Map<String, Object> securityAssignmentView(SecurityGuardAssignment assignment) {
        AppUser guard = assignment.getSecurityGuard();
        return map("id", assignment.getId(), "securityGuardId", guard.getId(), "securityGuardName", guard.getFullName(),
                "securityGuardEmail", guard.getEmail(), "assignmentType", assignment.getAssignmentType(),
                "assignmentValue", assignment.getAssignmentValue(), "shiftName", clean(assignment.getShiftName()),
                "notes", clean(assignment.getNotes()), "createdAt", assignment.getCreatedAt());
    }

    private Set<String> allowedSecurityUnits(AppUser user) {
        if (user.getRole() != UserRole.SECURITY_STAFF) return Set.of();
        List<SecurityGuardAssignment> assignments = securityGuardAssignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(user.getTenantId(), user.getId());
        if (assignments.isEmpty()) return Set.of();
        Set<String> units = new LinkedHashSet<>();
        List<Resident> tenantResidents = residents.findByTenantIdOrderByIdAsc(user.getTenantId());
        for (SecurityGuardAssignment assignment : assignments) {
            String type = clean(assignment.getAssignmentType()).toUpperCase(Locale.ROOT);
            String value = clean(assignment.getAssignmentValue()).trim();
            if (value.isBlank()) continue;
            if ("FLAT".equals(type)) {
                units.add(value.toUpperCase(Locale.ROOT));
            } else if ("BLOCK".equals(type)) {
                tenantResidents.stream()
                        .filter(resident -> resident.getApartment().getBlock() != null)
                        .filter(resident -> value.equalsIgnoreCase(resident.getApartment().getBlock().getName()))
                        .map(resident -> resident.getApartment().getUnitNo().toUpperCase(Locale.ROOT))
                        .forEach(units::add);
            }
        }
        return units;
    }

    private void ensureSecurityCanAccess(AppUser user, Resident resident) {
        if (user.getRole() != UserRole.SECURITY_STAFF || resident == null || resident.getApartment() == null) return;
        Set<String> allowedUnits = allowedSecurityUnits(user);
        if (!allowedUnits.isEmpty() && !allowedUnits.contains(resident.getApartment().getUnitNo().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("This security guard is not assigned to the selected flat");
        }
    }

    private Map<String, Object> complaintView(Complaint c) {
        return map("id", c.getId(), "title", c.getTitle(), "category", c.getCategory(), "priority", c.getPriority(),
                "subcategory", clean(c.getSubcategory()), "description", c.getDescription(), "locationDetails", clean(c.getLocationDetails()),
                "incidentAt", c.getIncidentAt(), "preferredContactMethod", clean(c.getPreferredContactMethod()),
                "reporterPhone", clean(c.getReporterPhone()), "accessPermission", Boolean.TRUE.equals(c.getAccessPermission()),
                "attachmentReference", clean(c.getAttachmentReference()), "status", c.getStatus(), "assignedTo", clean(c.getAssignedTo()),
                "resolutionNotes", clean(c.getResolutionNotes()), "dueAt", c.getDueAt(), "escalatedAt", c.getEscalatedAt(), "closedAt", c.getClosedAt(), "resident", c.getResident().getUser().getFullName(),
                "unitNo", c.getResident().getApartment().getUnitNo(), "createdAt", c.getCreatedAt(),
                "sparePartsUsed", clean(c.getSparePartsUsed()), "repairCost", value(c.getRepairCost()));
    }

    private Map<String, Object> visitorView(Visitor v) {
        return map("id", v.getId(), "name", v.getVisitorName(), "phone", v.getVisitorPhone(), "email", clean(v.getVisitorEmail()), "purpose", v.getPurpose(),
                "resident", v.getResident().getUser().getFullName(), "unitNo", v.getResident().getApartment().getUnitNo(),
                "expectedAt", v.getExpectedAt(), "checkInAt", v.getCheckInAt(), "checkOutAt", v.getCheckOutAt(),
                "approvalStatus", v.getApprovalStatus(), "status", v.getStatus(), "qrCode", v.getQrCode(),
                "vehicleNumber", clean(v.getVehicleNumber()), "photoReference", clean(v.getPhotoReference()),
                "gateNumber", clean(v.getGateNumber()).isBlank() ? "Gate 1" : clean(v.getGateNumber()),
                "passNumber", clean(v.getPassNumber()), "visitorCategory", clean(v.getVisitorCategory()),
                "entryGateId", v.getEntryGate() == null ? null : v.getEntryGate().getId(),
                "entryGateNumber", v.getEntryGate() == null ? clean(v.getGateNumber()) : v.getEntryGate().getGateNumber(),
                "exitGateId", v.getExitGate() == null ? null : v.getExitGate().getId(),
                "exitGateNumber", v.getExitGate() == null ? "" : v.getExitGate().getGateNumber(),
                "exitTime", v.getExitTime() == null ? v.getCheckOutAt() : v.getExitTime(),
                "entryType", clean(v.getEntryType()), "idProofType", clean(v.getIdProofType()), "idProofNumber", clean(v.getIdProofNumber()),
                "personsCount", v.getPersonsCount(), "specialInstructions", clean(v.getSpecialInstructions()));
    }

    private Optional<Gate> resolveGateByNumber(String tenantId, String gateNumber) {
        String value = clean(gateNumber);
        if (value.isBlank()) return Optional.empty();
        return gates.findFirstByTenantIdAndGateNumberIgnoreCase(tenantId, value)
                .filter(gate -> "ACTIVE".equalsIgnoreCase(gate.getStatus()));
    }

    private Map<String, Object> billView(MaintenanceBill b) {
        return map("id", b.getId(), "unitNo", b.getApartment().getUnitNo(), "month", b.getBillMonth(), "invoiceNumber", clean(b.getInvoiceNumber()),
                "invoiceDate", b.getInvoiceDate(), "periodStart", b.getBillingPeriodStart(), "periodEnd", b.getBillingPeriodEnd(),
                "baseAmount", value(b.getBaseAmount()), "lateFee", value(b.getLateFee()), "totalAmount", value(b.getTotalAmount()),
                "baseRatePerSqFt", value(b.getBaseRatePerSqFt()), "billedAreaSqFt", b.getBilledAreaSqFt(),
                "waterPreviousReading", value(b.getWaterPreviousReading()), "waterCurrentReading", value(b.getWaterCurrentReading()),
                "waterUnits", value(b.getWaterUnits()), "waterRatePerUnit", value(b.getWaterRatePerUnit()), "waterAmount", value(b.getWaterAmount()),
                "commonPowerFee", value(b.getCommonPowerFee()), "sinkingFund", value(b.getSinkingFund()), "repairReserve", value(b.getRepairReserve()),
                "parkingFee", value(b.getParkingFee()), "amenityFee", value(b.getAmenityFee()), "otherCharges", value(b.getOtherCharges()),
                "otherChargeDescription", clean(b.getOtherChargeDescription()), "previousBalance", value(b.getPreviousBalance()),
                "creditAdjustment", value(b.getCreditAdjustment()), "taxableAmount", value(b.getTaxableAmount()),
                "cgstRate", value(b.getCgstRate()), "cgstAmount", value(b.getCgstAmount()), "sgstRate", value(b.getSgstRate()), "sgstAmount", value(b.getSgstAmount()),
                "roundOff", value(b.getRoundOff()), "dueDate", b.getDueDate(), "paymentStatus", b.getPaymentStatus(),
                "paymentTerms", clean(b.getPaymentTerms()), "bankName", clean(b.getBankName()), "bankAccountNumber", clean(b.getBankAccountNumber()),
                "bankIfsc", clean(b.getBankIfsc()), "upiId", clean(b.getUpiId()), "societyGstin", clean(b.getSocietyGstin()),
                "societyPan", clean(b.getSocietyPan()), "notes", clean(b.getNotes()));
    }

    private Map<String, Object> bookingView(Booking b) {
        return map("id", b.getId(), "amenity", b.getAmenity().getName(), "resident", b.getResident().getUser().getFullName(),
                "unitNo", b.getResident().getApartment().getUnitNo(), "startTime", b.getStartTime(), "endTime", b.getEndTime(),
                "approvalStatus", b.getApprovalStatus(), "amount", value(b.getAmount()),
                "paymentMethod", clean(b.getPaymentMethod()), "paymentStatus", clean(b.getPaymentStatus()),
                "paymentReference", clean(b.getPaymentReference()), "bookingReference", clean(b.getBookingReference()),
                "eventType", clean(b.getEventType()), "eventPurpose", clean(b.getEventPurpose()), "expectedGuests", b.getExpectedGuests(),
                "childrenCount", b.getChildrenCount(), "vehicleCount", b.getVehicleCount(), "organizerName", clean(b.getOrganizerName()),
                "organizerPhone", clean(b.getOrganizerPhone()), "organizerEmail", clean(b.getOrganizerEmail()), "setupStyle", clean(b.getSetupStyle()),
                "equipmentRequired", clean(b.getEquipmentRequired()), "cateringDetails", clean(b.getCateringDetails()),
                "decorationDetails", clean(b.getDecorationDetails()), "accessibilityNeeds", clean(b.getAccessibilityNeeds()),
                "vehicleDetails", clean(b.getVehicleDetails()), "securityDeposit", value(b.getSecurityDeposit()),
                "depositStatus", clean(b.getDepositStatus()), "termsAccepted", clean(b.getTermsAccepted()),
                "emergencyContact", clean(b.getEmergencyContact()), "specialInstructions", clean(b.getSpecialInstructions()));
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }

    private Visitor createGateFallbackVisitor(String visitorName, String action) {
        AppUser user = currentUser.requireUser();
        Resident resident = residents.findByTenantIdOrderByIdAsc(user.getTenantId()).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Add a resident before recording a gate entry"));
        Visitor visitor = new Visitor();
        visitor.setTenantId(user.getTenantId());
        visitor.setResident(resident);
        visitor.setVisitorName(visitorName.isBlank() ? "Gate visitor" : visitorName);
        visitor.setVisitorPhone("Not recorded");
        visitor.setPurpose("Gate entry");
        visitor.setEntryType("WALK_IN");
        visitor.setGateNumber("Gate 1");
        visitor.setExpectedAt(LocalDateTime.now());
        visitor.setApprovalStatus("APPROVED");
        visitor.setQrCode(UUID.randomUUID().toString());
        visitor.setCheckInAt(LocalDateTime.now());
        visitor.setStatus("CHECKED_IN");
        if ("checkout".equals(action)) {
            visitor.setCheckOutAt(LocalDateTime.now());
            visitor.setStatus("CHECKED_OUT");
        }
        return visitors.save(visitor);
    }

    private static ResponseEntity<Void> redirectToSecurity(String section) {
        return redirectToSecurity(section, null);
    }

    private static ResponseEntity<Void> redirectToSecurity(String section, String notice) {
        String target = "/dashboards/security" + (notice == null ? "" : "?notice=" + java.net.URLEncoder.encode(notice, java.nio.charset.StandardCharsets.UTF_8)) + "#" + section;
        return ResponseEntity.status(HttpStatus.SEE_OTHER)
                .header(HttpHeaders.LOCATION, target)
                .build();
    }

    private static String clean(String value) { return value == null ? "" : value; }
    private static boolean canViewAnnouncement(UserRole role, String audience) {
        if (role == UserRole.SOCIETY_ADMIN) return true;
        return switch (role) {
            case RESIDENT -> Set.of("ALL", "RESIDENTS").contains(audience);
            case MAINTENANCE_STAFF -> Set.of("ALL", "STAFF", "MAINTENANCE").contains(audience);
            case SECURITY_STAFF -> Set.of("ALL", "STAFF", "SECURITY").contains(audience);
            default -> Set.of("ALL", "STAFF").contains(audience);
        };
    }
    private static BigDecimal value(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private static long slaHours(String priority){return switch(priority==null?"NORMAL":priority.toUpperCase(Locale.ROOT)){case "EMERGENCY"->2;case "HIGH"->8;case "LOW"->72;default->24;};}

    public record ComplaintRequest(String title, String category, String subcategory,
                                   String priority, String description, Long residentId,
                                   String locationDetails, Object incidentAt, String preferredContactMethod,
                                   String reporterPhone, boolean accessPermission, String attachmentReference, String assignedTo) {}
    public record ComplaintUpdate(@NotBlank String status, String assignedTo, String resolutionNotes, String sparePartsUsed, BigDecimal repairCost) {}
    public record ComplaintAssignment(@NotBlank String team, String assignmentNote) {}
    public record VisitorRequest(@NotBlank String name,@NotBlank String phone,@Email String email,@NotBlank String purpose,
                                 @NotNull @FutureOrPresent LocalDateTime expectedAt,Long residentId,String unitNo,
                                 String vehicleNumber,String photoReference,String entryType,String idProofType,String idProofNumber,
                                 @Positive Integer personsCount,String specialInstructions,String gateNumber) {}
    public record VisitorScanRequest(@NotBlank String qrCode,String gateNumber) {}
    public record AnnouncementRequest(@NotBlank @Size(max=120) String title, @NotBlank @Size(max=3000) String message,
                                      @NotBlank String audience, boolean emergency,String category,
                                      LocalDateTime effectiveFrom,LocalDateTime validUntil,boolean actionRequired,
                                      String contactPerson,String contactPhone,String attachmentReference,
                                      boolean inAppNotification,boolean emailNotification) {}
    public record BookingRequest(@NotNull Long amenityId, @NotNull @Future LocalDateTime startTime,
                                 @NotNull @Future LocalDateTime endTime,
                                 @PositiveOrZero Integer expectedGuests,@PositiveOrZero Integer vehicleCount,
                                 @NotBlank String eventPurpose,@NotBlank String contactNumber,String specialInstructions) {}
    public record AdminBookingRequest(@NotNull Long amenityId, @NotNull Long residentId,
                                      @NotNull LocalDateTime startTime, @NotNull LocalDateTime endTime,
                                      @NotBlank String paymentMethod, String paymentReference,
                                      String eventType,@NotBlank String eventPurpose,@Positive Integer expectedGuests,
                                      @PositiveOrZero Integer childrenCount,@PositiveOrZero Integer vehicleCount,
                                      @NotBlank String organizerName,@NotBlank String organizerPhone,@Email String organizerEmail,
                                      String setupStyle,String equipmentRequired,String cateringDetails,String decorationDetails,
                                      String accessibilityNeeds,String vehicleDetails,@PositiveOrZero BigDecimal securityDeposit,
                                      String depositStatus,boolean termsAccepted,String emergencyContact,String specialInstructions) {}
    public record BookingApprovalRequest(@NotBlank String approvalStatus) {}
    public record ApartmentRequest(@NotBlank String unitNo,@NotBlank String block,@PositiveOrZero int floor,
                                   @NotBlank String unitType,@NotBlank String occupancy,@NotBlank String ownerName,
                                   String ownerPhone,@Email String ownerEmail,@PositiveOrZero Integer builtUpAreaSqFt,
                                   String parkingSlot,@PositiveOrZero BigDecimal monthlyMaintenance,
                                   LocalDate possessionDate,@Size(max=1000) String notes){}
    public record ResidentRequest(@NotBlank String name,@Email @NotBlank String email,String phone,@NotBlank String unitNo,
                                  @NotBlank String residentType,LocalDate moveInDate,String vehicleNumber,String address,
                                  String emergencyContactName,String emergencyContactPhone,String notes,
                                  @NotBlank @Size(min=8,max=72) String temporaryPassword){}
    public record TeamUserRequest(@NotBlank String name,@Email @NotBlank String email,String phone,@NotBlank String role,
                                  @NotBlank String designation,String employeeId,LocalDate joiningDate,String workShift,
                                  String address,String emergencyContactName,String emergencyContactPhone,String notes,
                                  @NotBlank @Size(min=8,max=72) String temporaryPassword){}
    public record SecurityAssignmentRequest(@NotNull Long securityGuardId,@NotBlank String assignmentType,
                                            @NotBlank String assignmentValue,String shiftName,String notes){}
    public record AmenityRequest(@NotBlank String name,@Positive int capacity,@NotNull @PositiveOrZero BigDecimal bookingFee,boolean approvalRequired){}
}
