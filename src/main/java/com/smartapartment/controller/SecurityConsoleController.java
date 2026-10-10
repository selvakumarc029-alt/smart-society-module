package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.servlet.http.HttpSession;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;

/** All new routes and policy data belong exclusively to the security dashboard. */
@RestController
@RequestMapping("/api/society/security-console")
@PreAuthorize("hasAnyRole('SECURITY_STAFF','SOCIETY_ADMIN')")
@Transactional
public class SecurityConsoleController {
    private final CurrentUserService current;
    private final GateRepository gates;
    private final VisitorRepository visitors;
    private final ResidentRepository residents;
    private final SecurityGateAssignmentRepository assignments;
    private final SecurityConsoleGateRepository policies;
    private final SecurityConsolePassRepository passes;
    private final SecurityConsoleEventRepository events;
    private final SecurityConsoleWatchRepository watches;
    private final NotificationRepository notifications;
    private final EntityManager em;
    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public SecurityConsoleController(CurrentUserService current, GateRepository gates, VisitorRepository visitors,
            ResidentRepository residents, SecurityGateAssignmentRepository assignments,
            SecurityConsoleGateRepository policies, SecurityConsolePassRepository passes,
            SecurityConsoleEventRepository events, SecurityConsoleWatchRepository watches,
            NotificationRepository notifications, EntityManager em, @Value("${app.jwt.secret:this_is_a_very_secure_and_long_jwt_secret_for_local_dev_12345}") String secret) {
        this.current=current; this.gates=gates; this.visitors=visitors; this.residents=residents;
        this.assignments=assignments; this.policies=policies; this.passes=passes; this.events=events;
        this.watches=watches; this.notifications=notifications; this.em=em;
        this.key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/snapshot")
    public Map<String,Object> snapshot() {
        AppUser user=current.requireUser(); String tenant=user.getTenantId();
        List<Visitor> people=visitors.findByTenantIdOrderByExpectedAtDesc(tenant);
        List<SecurityConsoleEvent> recent=events.findTop200ByTenantIdOrderByIdDesc(tenant);
        List<SecurityConsoleEvent> hour=events.findByTenantIdAndOccurredAtAfter(tenant, LocalDateTime.now().minusHours(1));
        var assigned=assignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(tenant,user.getId());
        var allAssignments=assignments.findByTenantIdOrderByCreatedAtDesc(tenant);
        List<Map<String,Object>> gateViews=new ArrayList<>();
        for(Gate gate:gates.findByTenantIdOrderByGateNumberAsc(tenant)) {
            var policy=policies.findByTenantIdAndGateId(tenant,gate.getId()).orElse(null);
            Map<String,Object> view=new LinkedHashMap<>();
            view.put("id",gate.getId()); view.put("number",gate.getGateNumber()); view.put("name",gate.getGateName());
            view.put("type",policy==null?defaultType(gate):policy.getDesignatedType());
            view.put("status",policy==null?("ACTIVE".equals(gate.getStatus())?"OPEN":"MAINTENANCE"):policy.getOperatingStatus());
            view.put("barrierStatus","NOT_CONNECTED");
            view.put("allowed",assigned.isEmpty() || assigned.stream().anyMatch(a->a.getGate().getId().equals(gate.getId()) && activeShift(a)));
            view.put("guard",allAssignments.stream().filter(a->a.getGate().getId().equals(gate.getId()) && activeShift(a)).findFirst().map(a->a.getSecurityGuard().getFullName()).orElse("No active assignment"));
            view.put("guards",allAssignments.stream().filter(a->a.getGate().getId().equals(gate.getId()) && activeShift(a))
                    .map(a->Map.of("id",a.getSecurityGuard().getId(),"name",a.getSecurityGuard().getFullName())).distinct().toList());
            view.put("inside",people.stream().filter(this::inside).filter(v->v.getEntryGate()!=null && gate.getId().equals(v.getEntryGate().getId())).count());
            view.put("pending",people.stream().filter(v->!inside(v) && v.getCheckOutAt()==null && "PENDING".equals(v.getApprovalStatus()))
                    .filter(v->v.getEntryGate()!=null && gate.getId().equals(v.getEntryGate().getId())).count());
            view.put("shiftId",allAssignments.stream().filter(a->a.getGate().getId().equals(gate.getId()) && activeShift(a)).findFirst().map(SecurityGateAssignment::getId).orElse(null));
            view.put("throughput",hour.stream().filter(e->gate.getId().equals(e.getGateId()) && Set.of("ENTRY","EXIT","OVERRIDE").contains(e.getEventType())).count());
            view.put("lastVehicle",people.stream().filter(v->v.getEntryGate()!=null && gate.getId().equals(v.getEntryGate().getId()) && v.getCheckInAt()!=null && !clean(v.getVehicleNumber()).isBlank()).max(Comparator.comparing(Visitor::getCheckInAt)).map(Visitor::getVehicleNumber).orElse("No vehicle recorded"));
            gateViews.add(view);
        }
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("gates",gateViews); result.put("visitors",people.stream().map(this::view).toList());
        result.put("events",recent.stream().map(this::eventView).toList());
        result.put("watchlist",watches.findByTenantIdAndStatus(tenant,"ACTIVE").stream().map(w->Map.of("type",w.getIdentifierType(),"value",w.getIdentifierValue(),"reason",w.getReason())).toList());
        result.put("guard",user.getFullName()); result.put("role",user.getRole().name());
        result.put("lockdown",locked(tenant)); result.put("serverTime",LocalDateTime.now());
        result.put("inside",people.stream().filter(this::inside).count());
        result.put("overstays",people.stream().filter(this::overstay).count());
        result.put("hourly",hour.stream().filter(e->Set.of("ENTRY","EXIT").contains(e.getEventType())).count());
        result.put("residents",residents.findByTenantIdOrderByIdAsc(tenant).stream().filter(r->r.getUser()!=null && r.getApartment()!=null).map(r->Map.of("id",r.getId(),"name",r.getUser().getFullName(),"unit",r.getApartment().getUnitNo())).toList());
        return result;
    }

    @PostMapping("/session")
    public Map<String,Object> session(@Valid @RequestBody SessionRequest request,HttpSession session) {
        Gate gate=gate(request.gateId()); guardAccess(gate);
        String token=UUID.randomUUID().toString();
        session.setAttribute("securityConsoleGate",gate.getId()); session.setAttribute("securityConsoleToken",token);
        session.setAttribute("securityConsoleGuard",current.requireUser().getId());
        session.setAttribute("securityConsoleTenant",current.requireTenantId());
        session.setAttribute("securityConsoleStarted",Instant.now());
        return Map.of("token",token,"gateId",gate.getId(),"startedAt",Instant.now());
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@Valid @RequestBody VerifyRequest request,HttpSession session) {
        Gate gate=terminal(session,request.token());
        Long retryAt=(Long)session.getAttribute("securityConsoleRetryAt");
        if(retryAt!=null && retryAt>System.currentTimeMillis()) return ResponseEntity.status(429).body(Map.of("message","Too many failed lookups. Wait one minute."));
        Visitor visitor=lookup(request.query(),request.mode(),request.direction());
        if(visitor==null) {
            Integer failures=(Integer)session.getAttribute("securityConsoleFailures"); int count=failures==null?1:failures+1;
            session.setAttribute("securityConsoleFailures",count);
            if(count>=5) {session.setAttribute("securityConsoleRetryAt",System.currentTimeMillis()+60000); session.setAttribute("securityConsoleFailures",0);}
            return deny(gate,null,"PASS_NOT_FOUND: No valid matching credential.");
        }
        session.setAttribute("securityConsoleFailures",0);
        String problem=problem(visitor,gate,request.direction());
        if(problem!=null) return deny(gate,visitor,problem);
        event(gate,visitor,"VERIFIED","INFO","Identity found; awaiting guard decision.",null);
        return ResponseEntity.ok(view(visitor));
    }

    @PostMapping("/action")
    public ResponseEntity<?> action(@Valid @RequestBody ActionRequest request,HttpSession session) {
        Gate gate=terminal(session,request.token()); lockTenant();
        Visitor visitor=visitor(request.visitorId()); em.lock(visitor,LockModeType.PESSIMISTIC_WRITE); em.refresh(visitor);
        if("DENY".equals(request.action())) {
            if(inside(visitor) || visitor.getCheckOutAt()!=null) return deny(gate,visitor,"An active or completed journey cannot be denied retroactively.");
            if(clean(request.reason()).isBlank()) throw new IllegalArgumentException("A denial reason is required");
            visitor.setStatus("REJECTED"); visitor.setApprovalStatus("REJECTED");
            event(gate,visitor,"DENIED","HIGH",request.reason(),null);
            return ResponseEntity.ok(view(visitor));
        }
        if(!Set.of("ENTRY","EXIT","OVERRIDE").contains(request.action())) throw new IllegalArgumentException("Unknown action");
        boolean override="OVERRIDE".equals(request.action());
        String problem=problem(visitor,gate,"EXIT".equals(request.action())?"EXIT":"ENTRY");
        if(override) {
            if(!Set.of("RESIDENT_ESCORT","EMERGENCY_SERVICE","SYSTEM_OFFLINE").contains(clean(request.reason()))) throw new IllegalArgumentException("Select a valid override reason");
            validatePhoto(request.photo());
            // Resident approval is required even for an audited manual action.
            if(problem!=null) return deny(gate,visitor,problem);
        } else if(problem!=null) return deny(gate,visitor,problem);
        LocalDateTime now=LocalDateTime.now();
        if("EXIT".equals(request.action())) {
            visitor.setExitGate(gate); visitor.setExitSecurity(current.requireUser()); visitor.setExitTime(now); visitor.setCheckOutAt(now); visitor.setStatus("CHECKED_OUT");
        } else {
            visitor.setEntryGate(gate); visitor.setGateNumber(gate.getGateNumber()); visitor.setEntrySecurity(current.requireUser()); visitor.setCheckInAt(now); visitor.setStatus("CHECKED_IN");
        }
        event(gate,visitor,request.action(),override?"HIGH":"INFO",override?request.reason():"Recorded at "+gate.getGateNumber(),override?request.photo():null);
        return ResponseEntity.ok(view(visitor));
    }

    @PostMapping("/passes")
    public Map<String,Object> create(@Valid @RequestBody PassRequest request,HttpSession session) {
        Gate active=terminal(session,request.token()); lockTenant();
        Gate assigned=gate(request.gateId());
        Resident resident=residents.findByIdAndTenantId(request.residentId(),current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Resident not found"));
        if(!Set.of("GUEST","DELIVERY","PARCEL","FOOD_DELIVERY","CAB","DOMESTIC_STAFF","CONTRACTOR").contains(request.category())) throw new IllegalArgumentException("Invalid visitor category");
        Visitor visitor=new Visitor(); visitor.setTenantId(current.requireTenantId()); visitor.setResident(resident);
        visitor.setVisitorName(request.name().trim()); visitor.setVisitorPhone(request.phone().trim()); visitor.setPurpose(request.purpose().trim());
        visitor.setVehicleNumber(clean(request.vehicle())); visitor.setEntryType(request.category()); visitor.setVisitorCategory(request.category());
        visitor.setPhotoReference(clean(request.photo())); visitor.setExpectedAt(LocalDateTime.now()); visitor.setPersonsCount(1);
        visitor.setEntryGate(assigned); visitor.setGateNumber(assigned.getGateNumber()); visitor.setStatus("PENDING_APPROVAL"); visitor.setApprovalStatus("PENDING");
        visitor.setQrCode(UUID.randomUUID().toString()); visitors.saveAndFlush(visitor);
        visitor.setPassNumber("SEC-"+visitor.getId());
        String pin; String digest;
        Set<String> existing=new HashSet<>(); passes.findByTenantIdOrderByIdDesc(current.requireTenantId()).stream().filter(p->p.getValidUntil().isAfter(LocalDateTime.now())).forEach(p->existing.add(p.getPinDigest()));
        do {pin=String.format("%06d",random.nextInt(1000000)); digest=digest(pin);} while(existing.contains(digest));
        SecurityConsolePass pass=new SecurityConsolePass(); pass.setTenantId(current.requireTenantId()); pass.setVisitor(visitor); pass.setAssignedGate(assigned);
        pass.setAllGates(request.allGates()); pass.setPinDigest(digest); pass.setTokenId(UUID.randomUUID().toString()); pass.setValidUntil(LocalDateTime.now().plusHours(request.hours())); passes.saveAndFlush(pass);
        event(active,visitor,"PASS_CREATED","INFO","Pass assigned to "+(request.allGates()?"ALL_GATES":assigned.getGateNumber()),null);
        notifyResident(visitor,active);
        Instant expiry=Instant.now().plusSeconds(Math.min(request.hours()*3600L,300));
        String jwt=Jwts.builder().issuer("security-console").subject(pass.getId().toString()).id(pass.getTokenId()).claim("tenant",current.requireTenantId()).claim("direction","ENTRY").expiration(Date.from(expiry)).signWith(key).compact();
        return Map.of("visitor",view(visitor),"pass_id",pass.getId(),"passcode_pin",pin,"dynamic_qr_token",jwt,"qr_image",qrImage(jwt),"qr_valid_until",expiry,"valid_until",pass.getValidUntil(),"assigned_gate_number",request.allGates()?"ALL_GATES":assigned.getGateNumber(),"direction","ENTRY");
    }

    @PostMapping("/resident-alert")
    public Map<String,String> alert(@Valid @RequestBody ResidentAlert request,HttpSession session) {
        Gate gate=terminal(session,request.token()); Visitor visitor=visitor(request.visitorId());
        notifyResident(visitor,gate); event(gate,visitor,"RESIDENT_ALERT","INFO","Resident confirmation requested.",null);
        return Map.of("message","Confirmation request saved to the resident's notifications.");
    }

    @PostMapping("/incidents")
    public Map<String,String> incident(@Valid @RequestBody IncidentRequest request,HttpSession session) {
        Gate gate=terminal(session,request.token());
        if(!Set.of("LOW","MEDIUM","HIGH","CRITICAL").contains(request.severity())) throw new IllegalArgumentException("Invalid severity");
        event(gate,null,"INCIDENT",request.severity(),request.details(),null);
        return Map.of("message","Incident added to the audit trail.");
    }

    @PostMapping("/lockdown")
    public Map<String,Object> lockdown(@Valid @RequestBody LockdownRequest request,HttpSession session) {
        Gate gate=terminal(session,request.token()); lockTenant();
        if(!request.enabled() && current.requireUser().getRole()!=UserRole.SOCIETY_ADMIN) throw new IllegalArgumentException("Only a society administrator can release lockdown");
        event(gate,null,request.enabled()?"LOCKDOWN":"LOCKDOWN_RELEASED","CRITICAL",request.reason(),null);
        return Map.of("lockdown",request.enabled(),"message","Console entry restrictions updated. Physical barriers are not connected; contact the response team.");
    }

    @PostMapping("/watchlist")
    public Map<String,String> watch(@Valid @RequestBody WatchRequest request,HttpSession session) {
        Gate gate=terminal(session,request.token());
        if(!Set.of("PHONE","VEHICLE").contains(request.type())) throw new IllegalArgumentException("Choose phone or vehicle");
        String value=normalize(request.value()); if(value.length()<4) throw new IllegalArgumentException("Enter a valid identifier");
        SecurityConsoleWatch watch=new SecurityConsoleWatch(); watch.setTenantId(current.requireTenantId()); watch.setIdentifierType(request.type()); watch.setIdentifierValue(value); watch.setReason(request.reason()); watches.save(watch);
        event(gate,null,"WATCHLIST_ADDED","HIGH",request.type()+": "+value+" · "+request.reason(),null);
        return Map.of("message","Watchlist restriction saved.");
    }

    @PutMapping("/gates/{id}/policy")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public Map<String,String> policy(@PathVariable Long id,@Valid @RequestBody PolicyRequest request) {
        Gate gate=gate(id); lockTenant();
        if(!Set.of("PEDESTRIAN_ONLY","VEHICULAR_MAIN","SERVICE_DELIVERY","EMERGENCY_EXIT_ONLY").contains(request.type()) || !Set.of("OPEN","LOCKED","RESTRICTED_HOURS","MAINTENANCE").contains(request.status())) throw new IllegalArgumentException("Invalid gate policy");
        if("RESTRICTED_HOURS".equals(request.status()) && (request.opensAt()==null || request.closesAt()==null)) throw new IllegalArgumentException("Opening and closing times are required");
        SecurityConsoleGate policy=policies.findByTenantIdAndGateId(current.requireTenantId(),id).orElseGet(SecurityConsoleGate::new);
        policy.setTenantId(current.requireTenantId()); policy.setGate(gate); policy.setDesignatedType(request.type()); policy.setOperatingStatus(request.status()); policy.setOpensAt(request.opensAt()); policy.setClosesAt(request.closesAt()); policies.save(policy);
        event(gate,null,"POLICY_CHANGED","HIGH",request.type()+" / "+request.status(),null);
        return Map.of("message","Security console gate policy saved.");
    }

    private String problem(Visitor v,Gate gate,String direction) {
        if(!Set.of("ENTRY","EXIT").contains(clean(direction))) return "Invalid direction";
        if("EXIT".equals(direction)) return !inside(v)?"NO_OPEN_JOURNEY: Visitor is not currently inside.":("ENTRY".equals(gate.getGateType())?"ENTRY_ONLY: Use an exit-capable gate.":null);
        if(inside(v)) return "ANTI_PASSBACK: Visitor is already inside. Record an exit first.";
        if(v.getCheckOutAt()!=null) return "PASS_CONSUMED: Create a fresh pass for another visit.";
        if("REJECTED".equals(v.getStatus())) return "PASS_REJECTED: Entry has been denied.";
        if(locked(current.requireTenantId())) return "LOCKDOWN: All console entries are restricted.";
        SecurityConsoleGate policy=policies.findByTenantIdAndGateId(current.requireTenantId(),gate.getId()).orElse(null);
        String type=policy==null?defaultType(gate):policy.getDesignatedType();
        if(!"ACTIVE".equals(gate.getStatus()) || (policy!=null && Set.of("LOCKED","MAINTENANCE").contains(policy.getOperatingStatus()))) return "GATE_UNAVAILABLE: Choose an operational gate.";
        if(policy!=null && "RESTRICTED_HOURS".equals(policy.getOperatingStatus()) && !within(LocalTime.now(),policy.getOpensAt(),policy.getClosesAt())) return "GATE_CLOSED: Outside permitted hours.";
        if("EXIT".equals(gate.getGateType()) || "EMERGENCY_EXIT_ONLY".equals(type)) return "EMERGENCY_EXIT_ONLY: Inbound access is prohibited.";
        if("PEDESTRIAN_ONLY".equals(type) && !clean(v.getVehicleNumber()).isBlank()) return "PEDESTRIAN_ONLY: Vehicles must use a vehicular gate.";
        if("SERVICE_DELIVERY".equals(type) && !Set.of("DELIVERY","PARCEL","FOOD_DELIVERY","CONTRACTOR","DOMESTIC_STAFF").contains(clean(v.getEntryType()))) return "SERVICE_ONLY: Use the designated visitor entrance.";
        SecurityConsolePass pass=passes.findByTenantIdAndVisitorId(current.requireTenantId(),v.getId()).orElse(null);
        Gate assigned=pass==null?v.getEntryGate():pass.getAssignedGate();
        boolean all=pass!=null && pass.isAllGates();
        if(!all && assigned!=null && !assigned.getId().equals(gate.getId())) return "GATE_MISMATCH_ERROR: Re-route to "+assigned.getGateNumber();
        if(!all && assigned==null && !clean(v.getGateNumber()).isBlank() && !v.getGateNumber().equalsIgnoreCase(gate.getGateNumber())) return "GATE_MISMATCH_ERROR: Re-route to "+v.getGateNumber();
        LocalDateTime expiry=pass!=null?pass.getValidUntil():(v.getExpectedAt()==null?null:v.getExpectedAt().plusHours(4));
        if(expiry==null || expiry.isBefore(LocalDateTime.now())) return "PASS_EXPIRED: A current pass is required.";
        if(v.getExpectedAt()!=null && v.getExpectedAt().isAfter(LocalDateTime.now())) return "PASS_NOT_YET_VALID: Visitor is expected later.";
        if(flagged(v)) return "SECURITY ALERT: FLAG DETECTED. Escalate to the supervisor.";
        if(!"APPROVED".equalsIgnoreCase(v.getApprovalStatus())) return "RESIDENT_APPROVAL_REQUIRED: Request confirmation or record an audited override.";
        return null;
    }

    private Visitor lookup(String query,String mode,String direction) {
        String q=clean(query); String tenant=current.requireTenantId();
        if("QR".equals(mode)) {
            try {
                var claims=Jwts.parser().verifyWith(key).requireIssuer("security-console").require("tenant",tenant).require("direction",direction).build().parseSignedClaims(q).getPayload();
                return passes.findByIdAndTenantId(Long.valueOf(claims.getSubject()),tenant).filter(p->p.getTokenId().equals(claims.getId()) && p.getValidUntil().isAfter(LocalDateTime.now())).map(SecurityConsolePass::getVisitor).orElse(null);
            } catch(RuntimeException ex) { return null; }
        }
        if("PIN".equals(mode) && q.matches("[0-9]{4,6}")) return passes.findByTenantIdOrderByIdDesc(tenant).stream().filter(p->p.getPinDigest().equals(digest(q)) && p.getValidUntil().isAfter(LocalDateTime.now())).findFirst().map(SecurityConsolePass::getVisitor).orElse(null);
        if(!Set.of("PIN","VEHICLE").contains(clean(mode))) return null;
        List<Visitor> matches=visitors.findByTenantIdOrderByExpectedAtDesc(tenant).stream().filter(v->"VEHICLE".equals(mode)?!normalize(q).isBlank() && normalize(v.getVehicleNumber()).equals(normalize(q)) && v.getCheckOutAt()==null:q.equals(v.getPassNumber())).toList();
        return matches.size()==1?matches.getFirst():null;
    }

    private Gate terminal(HttpSession session,String token) {
        if(token==null || !token.equals(session.getAttribute("securityConsoleToken")) || !current.requireUser().getId().equals(session.getAttribute("securityConsoleGuard"))) throw new IllegalArgumentException("Select a gate to start a valid guard session");
        Instant started=(Instant)session.getAttribute("securityConsoleStarted");
        if(started==null || started.plusSeconds(12*3600).isBefore(Instant.now())) throw new IllegalArgumentException("Guard session expired. Select your gate again.");
        Gate gate=gate((Long)session.getAttribute("securityConsoleGate")); guardAccess(gate); return gate;
    }
    private void guardAccess(Gate gate) {
        var user=current.requireUser(); if(user.getRole()==UserRole.SOCIETY_ADMIN) return;
        var list=assignments.findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(user.getTenantId(),user.getId());
        if(!list.isEmpty() && list.stream().noneMatch(a->a.getGate().getId().equals(gate.getId()) && activeShift(a))) throw new IllegalArgumentException("No active guard assignment for this gate and shift");
    }
    private boolean activeShift(SecurityGateAssignment a) {return "ACTIVE".equals(a.getStatus()) && (a.getShiftStart()==null || a.getShiftEnd()==null || within(LocalTime.now(),a.getShiftStart(),a.getShiftEnd()));}
    private static boolean within(LocalTime now,LocalTime start,LocalTime end) {return start!=null && end!=null && (start.equals(end) || (start.isBefore(end)?!now.isBefore(start)&&now.isBefore(end):!now.isBefore(start)||now.isBefore(end)));}
    private void lockTenant() {
        // Lock one stable row for this tenant before pass, lockdown and entry mutations.
        var list=gates.findByTenantIdOrderByGateNumberAsc(current.requireTenantId());
        if(list.isEmpty()) throw new IllegalArgumentException("No gates configured");
        em.lock(list.stream().min(Comparator.comparing(Gate::getId)).orElseThrow(),LockModeType.PESSIMISTIC_WRITE);
    }
    private Gate gate(Long id) {return gates.findByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Gate not found"));}
    private Visitor visitor(Long id) {return visitors.findByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Visitor not found"));}
    private boolean inside(Visitor v) {return v.getCheckInAt()!=null && v.getCheckOutAt()==null && v.getExitTime()==null;}
    private boolean overstay(Visitor v) {return inside(v) && (v.getCheckInAt().isBefore(LocalDateTime.now().minusHours(4)) || passes.findByTenantIdAndVisitorId(current.requireTenantId(),v.getId()).map(p->p.getValidUntil().isBefore(LocalDateTime.now())).orElse(false));}
    private boolean locked(String tenant) {return events.findFirstByTenantIdAndEventTypeInOrderByIdDesc(tenant,List.of("LOCKDOWN","LOCKDOWN_RELEASED")).map(e->"LOCKDOWN".equals(e.getEventType())).orElse(false);}
    private boolean flagged(Visitor v) {return watches.findByTenantIdAndStatus(current.requireTenantId(),"ACTIVE").stream().anyMatch(w->w.getIdentifierValue().equals(normalize("PHONE".equals(w.getIdentifierType())?v.getVisitorPhone():v.getVehicleNumber())));}
    private String defaultType(Gate gate) {return "EXIT".equals(gate.getGateType())?"EMERGENCY_EXIT_ONLY":(clean(gate.getGateName()).toLowerCase(Locale.ROOT).matches(".*(service|delivery).*" )?"SERVICE_DELIVERY":"VEHICULAR_MAIN");}
    private void notifyResident(Visitor v,Gate gate) {
        if(v.getResident()==null || v.getResident().getUser()==null) throw new IllegalArgumentException("No resident contact is attached to this visitor");
        Notification n=new Notification(); n.setTenantId(current.requireTenantId()); n.setUserId(v.getResident().getUser().getId()); n.setType("VISITOR_APPROVAL"); n.setTitle("Confirm Visitor Entry at "+gate.getGateNumber()); n.setMessage(v.getVisitorName()+" is awaiting confirmation. Pass "+v.getPassNumber()+". Review your visitor approvals."); notifications.save(n);
    }
    private ResponseEntity<?> deny(Gate gate,Visitor visitor,String message) {event(gate,visitor,"DENIED","HIGH",message,null); Map<String,Object> body=new LinkedHashMap<>();body.put("message",message);if(visitor!=null)body.put("visitor",view(visitor));return ResponseEntity.status(409).body(body);}
    private void event(Gate gate,Visitor visitor,String type,String severity,String details,String photo) {
        AppUser user=current.requireUser(); SecurityConsoleEvent e=new SecurityConsoleEvent(); e.setTenantId(user.getTenantId()); e.setGuardId(user.getId()); e.setGuardName(user.getFullName()); e.setGateId(gate.getId()); e.setGateNumber(gate.getGateNumber()); e.setEventType(type); e.setSeverity(severity); e.setDetails(details); e.setPhoto(photo);
        if(visitor!=null) {e.setVisitorId(visitor.getId());e.setVisitorName(visitor.getVisitorName());} events.save(e);
    }
    private Map<String,Object> eventView(SecurityConsoleEvent e) {Map<String,Object> m=new LinkedHashMap<>();m.put("id",e.getId());m.put("gateId",e.getGateId());m.put("gate",e.getGateNumber());m.put("visitor",clean(e.getVisitorName()));m.put("type",e.getEventType());m.put("severity",e.getSeverity());m.put("details",e.getDetails());m.put("at",e.getOccurredAt());m.put("guard",e.getGuardName());m.put("hasPhoto",e.getPhoto()!=null);return m;}
    private Map<String,Object> view(Visitor v) {
        Map<String,Object> m=new LinkedHashMap<>(); m.put("id",v.getId());m.put("name",clean(v.getVisitorName()));m.put("phone",clean(v.getVisitorPhone()));m.put("vehicle",clean(v.getVehicleNumber()));m.put("purpose",clean(v.getPurpose()));m.put("category",clean(v.getEntryType()));m.put("status",v.getStatus());m.put("approval",clean(v.getApprovalStatus()));m.put("passNumber",clean(v.getPassNumber()));m.put("photo",clean(v.getPhotoReference()));
        m.put("unit",v.getResident()!=null && v.getResident().getApartment()!=null?v.getResident().getApartment().getUnitNo():"—");m.put("resident",v.getResident()!=null && v.getResident().getUser()!=null?v.getResident().getUser().getFullName():"—");
        m.put("entryGateId",v.getEntryGate()==null?null:v.getEntryGate().getId());m.put("entryGate",v.getEntryGate()==null?clean(v.getGateNumber()):v.getEntryGate().getGateNumber());m.put("exitGateId",v.getExitGate()==null?null:v.getExitGate().getId());m.put("exitGate",v.getExitGate()==null?"":v.getExitGate().getGateNumber());m.put("entryAt",v.getCheckInAt());m.put("exitAt",v.getCheckOutAt());m.put("expectedAt",v.getExpectedAt());m.put("inside",inside(v));m.put("flagged",flagged(v));m.put("overstay",overstay(v));
        var pass=passes.findByTenantIdAndVisitorId(current.requireTenantId(),v.getId()).orElse(null);m.put("allGates",pass!=null&&pass.isAllGates());m.put("validUntil",pass==null?(v.getExpectedAt()==null?null:v.getExpectedAt().plusHours(4)):pass.getValidUntil());return m;
    }
    private static void validatePhoto(String photo) {
        if(photo==null || photo.length()>1400000 || !photo.startsWith("data:image/jpeg;base64,")) throw new IllegalArgumentException("A captured JPEG photo is required (maximum 1 MB)");
        try {byte[] bytes=Base64.getDecoder().decode(photo.substring(photo.indexOf(',')+1));if(bytes.length<100 || bytes[0]!=(byte)0xff || bytes[1]!=(byte)0xd8) throw new IllegalArgumentException();} catch(RuntimeException ex) {throw new IllegalArgumentException("Invalid captured photo");}
    }
    private String qrImage(String token) {
        try {
            var matrix=new com.google.zxing.MultiFormatWriter().encode(token,com.google.zxing.BarcodeFormat.QR_CODE,300,300);
            var output=new java.io.ByteArrayOutputStream();
            com.google.zxing.client.j2se.MatrixToImageWriter.writeToStream(matrix,"PNG",output);
            return "data:image/png;base64,"+Base64.getEncoder().encodeToString(output.toByteArray());
        } catch(Exception ex) {throw new IllegalStateException("Unable to generate QR image");}
    }
    private String digest(String value) {try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((current.requireTenantId()+":"+value+":"+Base64.getEncoder().encodeToString(key.getEncoded())).getBytes(StandardCharsets.UTF_8)));}catch(Exception ex){throw new IllegalStateException("Credential digest unavailable");}}
    private static String clean(String s) {return s==null?"":s.trim();}
    private static String normalize(String s) {return clean(s).replaceAll("[^A-Za-z0-9]","").toUpperCase(Locale.ROOT);}

    public record SessionRequest(@NotNull Long gateId) {}
    public record VerifyRequest(@NotBlank @Size(max=4096) String query,@NotBlank String mode,@NotBlank String direction,@NotBlank String token) {}
    public record ActionRequest(@NotNull Long visitorId,@NotBlank String action,@Size(max=1000) String reason,String photo,@NotBlank String token) {}
    public record ResidentAlert(@NotNull Long visitorId,@NotBlank String token) {}
    public record PassRequest(@NotBlank @Size(max=120) String name,@NotBlank @Size(max=30) String phone,@NotBlank @Size(max=200) String purpose,@NotBlank String category,@Size(max=30) String vehicle,@Size(max=240) String photo,@NotNull Long residentId,@NotNull Long gateId,boolean allGates,@Min(1) @Max(24) int hours,@NotBlank String token) {}
    public record IncidentRequest(@NotBlank @Size(max=1800) String details,@NotBlank String severity,@NotBlank String token) {}
    public record LockdownRequest(boolean enabled,@NotBlank @Size(max=1000) String reason,@NotBlank String token) {}
    public record WatchRequest(@NotBlank String type,@NotBlank @Size(max=40) String value,@NotBlank @Size(max=240) String reason,@NotBlank String token) {}
    public record PolicyRequest(@NotBlank String type,@NotBlank String status,LocalTime opensAt,LocalTime closesAt) {}
}
