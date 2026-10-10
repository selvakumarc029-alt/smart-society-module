package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/society")
public class GateEntryApiController {
    private final CurrentUserService currentUser;
    private final GateRepository gates;
    private final SecurityGateAssignmentRepository gateAssignments;
    private final VisitorRepository visitors;
    private final ResidentRepository residents;
    private final ApartmentRepository apartments;
    private final AppUserRepository users;
    private final AuditLogRepository auditLogs;

    public GateEntryApiController(CurrentUserService currentUser,
                                  GateRepository gates,
                                  SecurityGateAssignmentRepository gateAssignments,
                                  VisitorRepository visitors,
                                  ResidentRepository residents,
                                  ApartmentRepository apartments,
                                  AppUserRepository users,
                                  AuditLogRepository auditLogs) {
        this.currentUser = currentUser;
        this.gates = gates;
        this.gateAssignments = gateAssignments;
        this.visitors = visitors;
        this.residents = residents;
        this.apartments = apartments;
        this.users = users;
        this.auditLogs = auditLogs;
    }

    @GetMapping("/gates")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF','SUPER_ADMIN')")
    @Transactional
    public List<Map<String, Object>> listGates() {
        AppUser user = currentUser.requireUser();
        List<Gate> available = gates.findByTenantIdOrderByGateNumberAsc(user.getTenantId());
        if (user.getRole() == UserRole.SECURITY_STAFF) {
            List<SecurityGateAssignment> assigned = gateAssignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(user.getTenantId(), user.getId());
            if (!assigned.isEmpty()) {
                Set<Long> gateIds = assigned.stream().map(a -> a.getGate().getId()).collect(Collectors.toSet());
                available = available.stream().filter(g -> gateIds.contains(g.getId())).toList();
            }
            available = available.stream().filter(g -> "ACTIVE".equalsIgnoreCase(g.getStatus())).toList();
        }
        return available.stream().map(this::gateView).toList();
    }

    @PostMapping("/gates")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> createGate(@Valid @RequestBody GateRequest request) {
        String tenant = currentUser.requireTenantId();
        String number = request.gateNumber().trim();
        if (gates.existsByTenantIdAndGateNumberIgnoreCase(tenant, number)) throw new IllegalArgumentException("Gate number already exists");
        Gate gate = new Gate();
        gate.setTenantId(tenant);
        applyGate(gate, request);
        Gate saved = gates.save(gate);
        audit("GATE_CREATED", "Gate " + saved.getGateNumber() + " · " + saved.getGateName());
        return gateView(saved);
    }

    @PutMapping("/gates/{id}")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> updateGate(@PathVariable Long id, @Valid @RequestBody GateRequest request) {
        Gate gate = requireGate(id);
        gates.findFirstByTenantIdAndGateNumberIgnoreCase(currentUser.requireTenantId(), request.gateNumber().trim())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new IllegalArgumentException("Gate number already exists"); });
        applyGate(gate, request);
        Gate saved = gates.save(gate);
        audit("GATE_UPDATED", "Gate " + saved.getGateNumber() + " updated");
        return gateView(saved);
    }

    @DeleteMapping("/gates/{id}")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> deactivateGate(@PathVariable Long id) {
        Gate gate = requireGate(id);
        gate.setStatus("INACTIVE");
        gates.save(gate);
        audit("GATE_DEACTIVATED", "Gate " + gate.getGateNumber() + " deactivated");
        return Map.of("id", id, "status", "INACTIVE");
    }

    @GetMapping("/security/{securityId}/gates")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public List<Map<String, Object>> guardGates(@PathVariable Long securityId) {
        String tenant = currentUser.requireTenantId();
        requireSecurityUser(securityId, tenant);
        return gateAssignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(tenant, securityId).stream().map(this::assignmentView).toList();
    }

    @PostMapping("/security/{securityId}/gates")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> assignGuardGate(@PathVariable Long securityId, @Valid @RequestBody GateAssignmentRequest request) {
        String tenant = currentUser.requireTenantId();
        AppUser guard = requireSecurityUser(securityId, tenant);
        Gate gate = requireGate(request.gateId());
        SecurityGateAssignment assignment = gateAssignments.findByTenantIdAndSecurityGuardIdAndGateId(tenant, securityId, gate.getId()).orElseGet(SecurityGateAssignment::new);
        assignment.setTenantId(tenant);
        assignment.setSecurityGuard(guard);
        assignment.setGate(gate);
        assignment.setShiftStart(request.shiftStart());
        assignment.setShiftEnd(request.shiftEnd());
        assignment.setStatus("ACTIVE");
        SecurityGateAssignment saved = gateAssignments.save(assignment);
        audit("SECURITY_GATE_ASSIGNED", guard.getFullName() + " assigned to " + gate.getGateNumber());
        return assignmentView(saved);
    }

    @DeleteMapping("/security/{securityId}/gates/{gateId}")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> unassignGuardGate(@PathVariable Long securityId, @PathVariable Long gateId) {
        String tenant = currentUser.requireTenantId();
        requireSecurityUser(securityId, tenant);
        requireGate(gateId);
        gateAssignments.deleteByTenantIdAndSecurityGuardIdAndGateId(tenant, securityId, gateId);
        audit("SECURITY_GATE_UNASSIGNED", "Security user " + securityId + " removed from gate " + gateId);
        return Map.of("removed", true);
    }

    @GetMapping("/gate-entries")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF','RESIDENT')")
    public List<Map<String, Object>> gateEntries(@RequestParam(required = false) Long gateId,
                                                 @RequestParam(required = false) String status) {
        AppUser user = currentUser.requireUser();
        return visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream()
                .filter(v -> canView(user, v))
                .filter(v -> gateId == null || (v.getEntryGate() != null && gateId.equals(v.getEntryGate().getId())) || (v.getExitGate() != null && gateId.equals(v.getExitGate().getId())))
                .filter(v -> status == null || status.isBlank() || status.equalsIgnoreCase(v.getStatus()))
                .map(this::entryView).toList();
    }

    @GetMapping("/gate-entries/active")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<Map<String, Object>> activeEntries() {
        AppUser user = currentUser.requireUser();
        return visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream()
                .filter(v -> "CHECKED_IN".equalsIgnoreCase(v.getStatus()) || "INSIDE".equalsIgnoreCase(v.getStatus()))
                .filter(v -> canView(user, v)).map(this::entryView).toList();
    }

    @GetMapping("/gate-entries/search")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<Map<String, Object>> searchEntries(@RequestParam String query) {
        AppUser user = currentUser.requireUser();
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.isBlank()) return List.of();
        return visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream()
                .filter(v -> canView(user, v))
                .filter(v -> contains(v.getVisitorName(), q) || contains(v.getVisitorPhone(), q) || contains(v.getVehicleNumber(), q)
                        || contains(v.getPassNumber(), q) || (v.getResident() != null && contains(v.getResident().getApartment().getUnitNo(), q)))
                .limit(50).map(this::entryView).toList();
    }

    @PostMapping("/gate-entries")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF','RESIDENT')")
    @Transactional
    public Map<String, Object> createGateEntry(@Valid @RequestBody GateEntryRequest request) {
        AppUser user = currentUser.requireUser();
        String tenant = user.getTenantId();
        Gate entryGate = requireActiveGate(request.entryGateId());
        if (user.getRole() == UserRole.SECURITY_STAFF) ensureGuardGateAccess(user, entryGate);
        Resident resident = destinationResident(user, request.residentId(), request.unitNo());

        if (request.vehicleNumber() != null && !request.vehicleNumber().isBlank()) {
            String vehicle = request.vehicleNumber().trim();
            boolean duplicate = visitors.findByTenantIdOrderByExpectedAtDesc(tenant).stream().anyMatch(v -> vehicle.equalsIgnoreCase(nvl(v.getVehicleNumber())) && v.getCheckInAt() != null && v.getCheckOutAt() == null);
            if (duplicate) throw new IllegalArgumentException("This vehicle already has an active gate entry");
        }

        Visitor visitor = new Visitor();
        visitor.setTenantId(tenant);
        visitor.setResident(resident);
        visitor.setVisitorName(request.visitorName().trim());
        visitor.setVisitorPhone(request.mobileNumber().trim());
        visitor.setPurpose(request.purpose().trim());
        visitor.setVisitorCategory(normalize(request.visitorCategory(), "GUEST"));
        visitor.setEntryType(visitor.getVisitorCategory());
        visitor.setVehicleNumber(clean(request.vehicleNumber()));
        visitor.setPhotoReference(clean(request.photoReference()));
        visitor.setPersonsCount(request.numberOfVisitors() == null ? 1 : request.numberOfVisitors());
        visitor.setSpecialInstructions(clean(request.notes()));
        visitor.setEntryGate(entryGate);
        visitor.setGateNumber(entryGate.getGateNumber());
        visitor.setEntrySecurity(user.getRole() == UserRole.SECURITY_STAFF ? user : null);
        visitor.setExpectedAt(LocalDateTime.now());
        visitor.setQrCode(UUID.randomUUID().toString());
        boolean autoApproved = user.getRole() == UserRole.RESIDENT || request.autoApprove();
        visitor.setApprovalStatus(autoApproved ? "APPROVED" : "PENDING");
        visitor.setStatus(autoApproved ? "EXPECTED" : "PENDING_APPROVAL");
        visitor = visitors.save(visitor);
        visitor.setPassNumber("PASS-" + LocalDate.now().getYear() + "-" + String.format("%06d", visitor.getId()));
        visitor = visitors.save(visitor);
        audit("GATE_ENTRY_CREATED", visitor.getPassNumber() + " at " + entryGate.getGateNumber());
        return entryView(visitor);
    }

    @PatchMapping("/gate-entries/{id}/approve")
    @PreAuthorize("hasAnyRole('RESIDENT','SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> approve(@PathVariable Long id) {
        Visitor visitor = requireVisitor(id);
        ensureResidentOwnsVisitor(currentUser.requireUser(), visitor);
        visitor.setApprovalStatus("APPROVED");
        if ("PENDING_APPROVAL".equalsIgnoreCase(visitor.getStatus())) visitor.setStatus("EXPECTED");
        visitors.save(visitor);
        audit("VISITOR_APPROVED", visitor.getPassNumber() + " approved");
        return entryView(visitor);
    }

    @PatchMapping("/gate-entries/{id}/reject")
    @PreAuthorize("hasAnyRole('RESIDENT','SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> reject(@PathVariable Long id) {
        Visitor visitor = requireVisitor(id);
        ensureResidentOwnsVisitor(currentUser.requireUser(), visitor);
        if (visitor.getCheckInAt() != null) throw new IllegalArgumentException("A visitor who has already entered cannot be rejected");
        visitor.setApprovalStatus("REJECTED");
        visitor.setStatus("REJECTED");
        visitors.save(visitor);
        audit("VISITOR_REJECTED", visitor.getPassNumber() + " rejected");
        return entryView(visitor);
    }

    @PatchMapping("/gate-entries/{id}/entry")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> markEntry(@PathVariable Long id, @Valid @RequestBody GateActionRequest request) {
        AppUser user = currentUser.requireUser();
        Visitor visitor = requireVisitor(id);
        if (!"APPROVED".equalsIgnoreCase(visitor.getApprovalStatus())) throw new IllegalArgumentException("Resident approval is required before entry");
        if (visitor.getCheckInAt() != null) throw new IllegalArgumentException("Visitor is already inside");
        Gate gate = request.gateId() == null ? visitor.getEntryGate() : requireActiveGate(request.gateId());
        if (gate == null) throw new IllegalArgumentException("Entry gate is required");
        if (user.getRole() == UserRole.SECURITY_STAFF) ensureGuardGateAccess(user, gate);
        visitor.setEntryGate(gate);
        visitor.setGateNumber(gate.getGateNumber());
        visitor.setEntrySecurity(user.getRole() == UserRole.SECURITY_STAFF ? user : visitor.getEntrySecurity());
        visitor.setCheckInAt(LocalDateTime.now());
        visitor.setStatus("CHECKED_IN");
        visitors.save(visitor);
        audit("VISITOR_ENTERED", visitor.getPassNumber() + " entered through " + gate.getGateNumber());
        return entryView(visitor);
    }

    @PatchMapping("/gate-entries/{id}/exit")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> markExit(@PathVariable Long id, @Valid @RequestBody GateActionRequest request) {
        AppUser user = currentUser.requireUser();
        Visitor visitor = requireVisitor(id);
        if (visitor.getCheckInAt() == null) throw new IllegalArgumentException("Visitor must enter before exit can be recorded");
        if (visitor.getCheckOutAt() != null || visitor.getExitTime() != null) throw new IllegalArgumentException("Visitor exit is already recorded");
        if (request.gateId() == null) throw new IllegalArgumentException("Exit gate is required");
        Gate gate = requireActiveGate(request.gateId());
        if (user.getRole() == UserRole.SECURITY_STAFF) ensureGuardGateAccess(user, gate);
        LocalDateTime now = LocalDateTime.now();
        visitor.setExitGate(gate);
        visitor.setExitSecurity(user.getRole() == UserRole.SECURITY_STAFF ? user : null);
        visitor.setExitTime(now);
        visitor.setCheckOutAt(now);
        visitor.setStatus("CHECKED_OUT");
        visitors.save(visitor);
        audit("VISITOR_EXITED", visitor.getPassNumber() + " exited through " + gate.getGateNumber());
        return entryView(visitor);
    }

    @GetMapping("/gate-entries/dashboard")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public Map<String, Object> dashboard(@RequestParam(required = false) Long gateId) {
        AppUser user = currentUser.requireUser();
        LocalDate today = LocalDate.now();
        List<Visitor> list = visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream().filter(v -> canView(user, v)).toList();
        List<Visitor> todayList = list.stream().filter(v -> v.getCreatedAt() != null && today.equals(v.getCreatedAt().toLocalDate()))
                .filter(v -> gateId == null || (v.getEntryGate() != null && gateId.equals(v.getEntryGate().getId()))).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("visitorsToday", todayList.size());
        result.put("currentlyInside", list.stream().filter(v -> v.getCheckInAt() != null && v.getCheckOutAt() == null).count());
        result.put("pendingApprovals", list.stream().filter(v -> "PENDING".equalsIgnoreCase(v.getApprovalStatus()) || "PENDING_APPROVAL".equalsIgnoreCase(v.getStatus())).count());
        result.put("deliveriesToday", todayList.stream().filter(v -> "DELIVERY".equalsIgnoreCase(v.getVisitorCategory())).count());
        result.put("vehiclesInside", list.stream().filter(v -> v.getCheckInAt() != null && v.getCheckOutAt() == null && !clean(v.getVehicleNumber()).isBlank()).count());
        result.put("exitsToday", list.stream().filter(v -> v.getCheckOutAt() != null && today.equals(v.getCheckOutAt().toLocalDate())).count());
        return result;
    }

    private void applyGate(Gate gate, GateRequest request) {
        String type = normalize(request.gateType(), "BOTH");
        if (!Set.of("ENTRY","EXIT","BOTH").contains(type)) throw new IllegalArgumentException("Gate type must be ENTRY, EXIT, or BOTH");
        gate.setGateNumber(request.gateNumber().trim()); gate.setGateName(request.gateName().trim()); gate.setGateType(type);
        gate.setLocation(clean(request.location())); gate.setStatus(normalize(request.status(), "ACTIVE"));
        if (!Set.of("ACTIVE","INACTIVE").contains(gate.getStatus())) throw new IllegalArgumentException("Gate status must be ACTIVE or INACTIVE");
    }

    private Gate requireGate(Long id) { return gates.findByIdAndTenantId(id, currentUser.requireTenantId()).orElseThrow(() -> new IllegalArgumentException("Gate was not found")); }
    private Gate requireActiveGate(Long id) { Gate gate = requireGate(id); if (!"ACTIVE".equalsIgnoreCase(gate.getStatus())) throw new IllegalArgumentException("Selected gate is inactive"); return gate; }
    private Visitor requireVisitor(Long id) { return visitors.findByIdAndTenantId(id, currentUser.requireTenantId()).orElseThrow(() -> new IllegalArgumentException("Gate entry was not found")); }
    private AppUser requireSecurityUser(Long id, String tenant) { return users.findById(id).filter(u -> tenant.equals(u.getTenantId()) && u.getRole() == UserRole.SECURITY_STAFF).orElseThrow(() -> new IllegalArgumentException("Security guard was not found")); }

    private Resident destinationResident(AppUser user, Long residentId, String unitNo) {
        if (user.getRole() == UserRole.RESIDENT) return residents.findFirstByUserOrderByIdAsc(user).orElseThrow(() -> new IllegalArgumentException("Resident profile was not found"));
        if (residentId != null) return residents.findByIdAndTenantId(residentId, user.getTenantId()).orElseThrow(() -> new IllegalArgumentException("Resident was not found"));
        if (unitNo == null || unitNo.isBlank()) throw new IllegalArgumentException("Flat number is required");
        Apartment apartment = apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(user.getTenantId(), unitNo.trim()).orElseThrow(() -> new IllegalArgumentException("Apartment was not found"));
        return residents.findByTenantIdOrderByIdAsc(user.getTenantId()).stream().filter(r -> r.getApartment() != null && r.getApartment().getId().equals(apartment.getId())).findFirst().orElseThrow(() -> new IllegalArgumentException("No resident is assigned to this apartment"));
    }

    private void ensureGuardGateAccess(AppUser user, Gate gate) {
        List<SecurityGateAssignment> assigned = gateAssignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(user.getTenantId(), user.getId());
        if (!assigned.isEmpty() && assigned.stream().noneMatch(a -> a.getGate().getId().equals(gate.getId()) && "ACTIVE".equalsIgnoreCase(a.getStatus()))) throw new IllegalArgumentException("This security guard is not assigned to the selected gate");
    }

    private boolean canView(AppUser user, Visitor visitor) {
        if (user.getRole() == UserRole.RESIDENT) return visitor.getResident() != null && visitor.getResident().getUser() != null && visitor.getResident().getUser().getId().equals(user.getId());
        if (user.getRole() != UserRole.SECURITY_STAFF) return true;
        List<SecurityGateAssignment> assigned = gateAssignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(user.getTenantId(), user.getId());
        if (assigned.isEmpty()) return true;
        Set<Long> ids = assigned.stream().map(a -> a.getGate().getId()).collect(Collectors.toSet());
        return (visitor.getEntryGate() != null && ids.contains(visitor.getEntryGate().getId())) || (visitor.getExitGate() != null && ids.contains(visitor.getExitGate().getId())) || visitor.getCheckOutAt() == null;
    }

    private void ensureResidentOwnsVisitor(AppUser user, Visitor visitor) {
        if (user.getRole() != UserRole.RESIDENT) return;
        if (visitor.getResident() == null || visitor.getResident().getUser() == null || !visitor.getResident().getUser().getId().equals(user.getId())) throw new IllegalArgumentException("This visitor request does not belong to your apartment");
    }

    private Map<String, Object> gateView(Gate gate) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("id",gate.getId()); m.put("value",gate.getGateNumber()); m.put("gateNumber",gate.getGateNumber()); m.put("gateName",gate.getGateName()); m.put("label",gate.getGateNumber()+" · "+gate.getGateName()); m.put("gateType",gate.getGateType()); m.put("location",clean(gate.getLocation())); m.put("status",gate.getStatus()); return m;
    }
    private Map<String, Object> assignmentView(SecurityGateAssignment a) { Map<String,Object> m=new LinkedHashMap<>(); m.put("id",a.getId()); m.put("securityGuardId",a.getSecurityGuard().getId()); m.put("securityGuardName",a.getSecurityGuard().getFullName()); m.put("gateId",a.getGate().getId()); m.put("gateNumber",a.getGate().getGateNumber()); m.put("gateName",a.getGate().getGateName()); m.put("shiftStart",a.getShiftStart()); m.put("shiftEnd",a.getShiftEnd()); m.put("status",a.getStatus()); return m; }
    private Map<String, Object> entryView(Visitor v) { Map<String,Object> m=new LinkedHashMap<>(); m.put("id",v.getId()); m.put("passNumber",clean(v.getPassNumber())); m.put("visitorName",v.getVisitorName()); m.put("name",v.getVisitorName()); m.put("mobileNumber",v.getVisitorPhone()); m.put("phone",v.getVisitorPhone()); m.put("visitorCategory",clean(v.getVisitorCategory()).isBlank()?clean(v.getEntryType()):v.getVisitorCategory()); m.put("purpose",v.getPurpose()); m.put("residentId",v.getResident()==null?null:v.getResident().getId()); m.put("residentName",v.getResident()==null?"":v.getResident().getUser().getFullName()); m.put("unitNo",v.getResident()==null?"":v.getResident().getApartment().getUnitNo()); m.put("vehicleNumber",clean(v.getVehicleNumber())); m.put("numberOfVisitors",v.getPersonsCount()); m.put("approvalStatus",v.getApprovalStatus()); m.put("status",v.getStatus()); m.put("entryGate",v.getEntryGate()==null?null:gateView(v.getEntryGate())); m.put("entryGateId",v.getEntryGate()==null?null:v.getEntryGate().getId()); m.put("entryGateNumber",v.getEntryGate()==null?clean(v.getGateNumber()):v.getEntryGate().getGateNumber()); m.put("entryTime",v.getCheckInAt()); m.put("exitGate",v.getExitGate()==null?null:gateView(v.getExitGate())); m.put("exitGateId",v.getExitGate()==null?null:v.getExitGate().getId()); m.put("exitGateNumber",v.getExitGate()==null?"":v.getExitGate().getGateNumber()); m.put("exitTime",v.getExitTime()==null?v.getCheckOutAt():v.getExitTime()); m.put("qrCode",v.getQrCode()); return m; }

    private void audit(String action, String details) { AppUser user=currentUser.requireUser(); AuditLog log=new AuditLog(); log.setTenantId(user.getTenantId()); log.setUserId(user.getId()); log.setModule("GATE_ENTRY"); log.setAction(action); log.setDetails(details); auditLogs.save(log); }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static String nvl(String value) { return value == null ? "" : value; }
    private static String normalize(String value, String fallback) { String v=clean(value); return (v.isBlank()?fallback:v).toUpperCase(Locale.ROOT); }
    private static boolean contains(String value, String q) { return value != null && value.toLowerCase(Locale.ROOT).contains(q); }

    public record GateRequest(@NotBlank String gateNumber, @NotBlank String gateName, String gateType, String location, String status) {}
    public record GateAssignmentRequest(@NotNull Long gateId, LocalTime shiftStart, LocalTime shiftEnd) {}
    public record GateEntryRequest(@NotBlank String visitorName, @NotBlank String mobileNumber, @NotBlank String purpose,
                                   String visitorCategory, Long residentId, String unitNo, String vehicleNumber, String photoReference,
                                   @Positive Integer numberOfVisitors, @NotNull Long entryGateId, String notes, boolean autoApprove) {}
    public record GateActionRequest(Long gateId) {}
}
