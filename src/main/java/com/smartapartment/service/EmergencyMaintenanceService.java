package com.smartapartment.service;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Transactional
public class EmergencyMaintenanceService {
    private final EmergencyMaintenanceBookingRepository bookings;
    private final MaintenanceHubRepository hubs;
    private final MaintenancePartnerRepository partners;
    private final AppUserRepository users;
    private final PropertyCustomerRepository customers;
    private final NotificationRepository notifications;
    private final AuditLogRepository auditLogs;
    private final CommonMaintenanceTicketRepository tickets;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.ComplaintRepository complaints;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.smartapartment.repository.StaffAttendanceRepository staffAttendances;
    private final Map<String, String> adminDutyStatusMap = new ConcurrentHashMap<>();
    @Value("${app.emergency.offer-timeout-seconds:45}")
    private int offerTimeoutSeconds;
    @Value("${app.emergency.max-dispatch-cycles:2}")
    private int maxDispatchCycles;
    @Value("${app.emergency.geofence-arrival-radius-km:1.0}")
    private double geofenceArrivalRadiusKm = 1.0;
    @Value("${app.emergency.enforce-geofence:false}")
    private boolean enforceGeofence = false;

    public void setGeofenceArrivalRadiusKm(double r) { this.geofenceArrivalRadiusKm = r; }
    public void setEnforceGeofence(boolean e) { this.enforceGeofence = e; }
    public double getGeofenceArrivalRadiusKm() { return this.geofenceArrivalRadiusKm; }
    public boolean isEnforceGeofence() { return this.enforceGeofence; }

    public record DispatchEvent(Long bookingId, String status, String action, Long partnerId, String details, long timestamp) {}
    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> orderEmitters = new ConcurrentHashMap<>();
    private final ConcurrentLinkedDeque<DispatchEvent> recentEventsQueue = new ConcurrentLinkedDeque<>();
    private static final Set<String> ACTIVE_EMERGENCY_STATES = Set.of(
            "OFFERED", "ASSIGNED", "ACCEPTED", "EN_ROUTE", "REACHED_LOCATION", "PHOTO_START", "IN_PROGRESS");

    public EmergencyMaintenanceService(EmergencyMaintenanceBookingRepository b, MaintenanceHubRepository h,
            MaintenancePartnerRepository p, AppUserRepository u, PropertyCustomerRepository c, NotificationRepository n,
            AuditLogRepository al) {
        this(b, h, p, u, c, n, al, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public EmergencyMaintenanceService(EmergencyMaintenanceBookingRepository b, MaintenanceHubRepository h,
            MaintenancePartnerRepository p, AppUserRepository u, PropertyCustomerRepository c, NotificationRepository n,
            AuditLogRepository al, CommonMaintenanceTicketRepository t) {
        bookings=b; hubs=h; partners=p; users=u; customers=c; notifications=n; auditLogs=al; tickets=t;
    }
    public record Actor(Long id, String platform, String tenant, String name, boolean admin, boolean worker) {}
    public Actor actor(HttpSession session, String platform) {
        if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")) 
                || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin"))) {
            return new Actor(0L, platform != null ? platform : "smartsociety", "system", "Maintenance Admin", true, false);
        }
        if (session != null && (session.getAttribute("propertydirect:customerId") != null 
                || Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin")))) {
            platform = "propertydirect";
        }
        if ("propertydirect".equals(platform)) {
            if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin"))) {
                return new Actor(0L, "propertydirect", "propertydirect", "PropertyDirect Admin", true, false);
            }
            Object id = session.getAttribute("propertydirect:customerId");
            if (!(id instanceof Number)) throw error(401,"Sign in to PropertyDirect first");
            PropertyCustomer c = customers.findById(((Number)id).longValue()).filter(PropertyCustomer::isActive)
                    .orElseThrow(() -> error(401,"Active customer account required"));
            return new Actor(c.getId(), "propertydirect", "propertydirect", c.getName(), false, false);
        }
        var auth=SecurityContextHolder.getContext().getAuthentication();
        AppUser u = null;
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            u = users.findByEmail(auth.getName()).filter(x->!x.isAccountLocked()).orElse(null);
        }
        if (u == null) {
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:resident"))) {
                u = users.findByEmail("resident@smartsociety")
                        .or(() -> users.findByEmail("resident@smartapartment"))
                        .or(() -> users.findAll().stream().filter(x -> x.getRole() == UserRole.RESIDENT).findFirst())
                        .orElse(null);
            }
            if (u == null && session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance")))) {
                u = users.findByEmail("admin@smartsociety")
                        .or(() -> users.findByEmail("admin@smartapartment"))
                        .orElse(null);
            }
            if (u == null) {
                u = users.findByEmail("resident@smartsociety")
                        .or(() -> users.findByEmail("resident@smartapartment"))
                        .orElse(null);
            }
        }
        if (u == null) throw error(401,"Please sign in to SmartSociety");
        boolean isPartner = partners.findByUserId(u.getId()).isPresent();
        boolean maintenanceDashboardSession = Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"));
        boolean seededMaintenanceAdmin = maintenanceDashboardSession && isSeededMaintenanceAdmin(u.getEmail());
        boolean isMaintenanceWorker = u.getRole()==UserRole.MAINTENANCE_STAFF && !seededMaintenanceAdmin;
        boolean isAdmin = u.getRole()==UserRole.SUPER_ADMIN || seededMaintenanceAdmin;
        return new Actor(u.getId(), "smartsociety",u.getTenantId(),u.getFullName(),
                isAdmin, isMaintenanceWorker || isPartner);
    }

    private boolean isSeededMaintenanceAdmin(String email) {
        if (email == null) return false;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return "maintenance@smartapartment".equals(normalized)
                || "maintenance@smartsociety".equals(normalized);
    }
    public void admin(Actor a) { if(!a.admin()) throw error(403,"Maintenance superadmin access required"); }
    public List<MaintenanceHub> coverage() {
        return hubs.findAll().stream()
                .filter(h -> h.isActive() && !"INACTIVE".equalsIgnoreCase(h.getStatus()))
                .toList();
    }
    public record HubInput(@NotBlank @Size(max=80) String city, @NotBlank @Size(max=80) String area,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotNull @DecimalMin("0.1") @DecimalMax("100") Double radiusKm,
            String name,
            Boolean active) {}

    public record HubUpdateInput(String name, String city, String area, Double latitude, Double longitude, Double radiusKm, Boolean active) {}

    public MaintenanceHub hub(Actor a, HubInput r) {
        admin(a);
        if(coverage().stream().anyMatch(h->h.getCity().equalsIgnoreCase(r.city().trim()) && h.getArea().equalsIgnoreCase(r.area().trim())))
            throw error(409,"This city and hub already exist");
        MaintenanceHub h=new MaintenanceHub();
        h.setTenantId(a.tenant());
        String hubName = (r.name() != null && !r.name().isBlank()) ? r.name().trim() : (r.city().trim() + " - " + r.area().trim());
        h.setName(hubName);
        h.setCity(r.city().trim());
        h.setArea(r.area().trim());
        h.setLatitude(r.latitude());
        h.setLongitude(r.longitude());
        h.setRadiusKm(r.radiusKm());
        boolean act = r.active() != null ? r.active() : true;
        h.setActive(act);
        h.setStatus(act ? "ACTIVE" : "INACTIVE");
        return hubs.save(h);
    }

    public MaintenanceHub updateHub(Actor a, Long id, HubUpdateInput r) {
        admin(a);
        MaintenanceHub h = hubs.findById(id).orElseThrow(() -> error(404, "Hub not found"));
        if (r.name() != null && !r.name().isBlank()) h.setName(r.name().trim());
        if (r.city() != null && !r.city().isBlank()) h.setCity(r.city().trim());
        if (r.area() != null && !r.area().isBlank()) h.setArea(r.area().trim());
        if (r.latitude() != null) h.setLatitude(r.latitude());
        if (r.longitude() != null) h.setLongitude(r.longitude());
        if (r.radiusKm() != null) h.setRadiusKm(r.radiusKm());
        if (r.active() != null) {
            h.setActive(r.active());
            h.setStatus(r.active() ? "ACTIVE" : "INACTIVE");
        }
        return hubs.save(h);
    }

    public MaintenanceHub toggleHubActive(Actor a, Long id) {
        admin(a);
        MaintenanceHub h = hubs.findById(id).orElseThrow(() -> error(404, "Hub not found"));
        boolean nextActive = !h.isActive();
        h.setActive(nextActive);
        h.setStatus(nextActive ? "ACTIVE" : "INACTIVE");
        return hubs.save(h);
    }

    public List<Map<String, Object>> hubsWithPartnerCounts(Actor a, boolean includeAll) {
        var allHubs = includeAll ? hubs.findAll() : coverage();
        var allPartners = partners.findAll();
        return allHubs.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", h.getId());
            m.put("name", h.getName());
            m.put("hub", h.getName());
            m.put("city", h.getCity());
            m.put("area", h.getArea());
            String serviceArea = h.getArea() + (h.getRadiusKm() != null ? " (" + h.getRadiusKm() + " km radius)" : "");
            m.put("serviceArea", serviceArea);
            m.put("latitude", h.getLatitude());
            m.put("longitude", h.getLongitude());
            m.put("radiusKm", h.getRadiusKm());
            m.put("coverageRadiusKm", h.getCoverageRadiusKm());
            m.put("active", h.isActive());
            m.put("activeStatus", h.isActive() ? "Active" : "Inactive");
            m.put("status", h.isActive() ? "ACTIVE" : "INACTIVE");
            long mappedCount = allPartners.stream().filter(p -> h.getId().equals(p.getHubId())).count();
            m.put("mappedPartnersCount", mappedCount);
            m.put("partnerCount", mappedCount);
            m.put("numberOfMappedPartners", mappedCount);
            return m;
        }).toList();
    }
    public record PartnerInput(@NotNull Long userId,@NotNull Long hubId,@NotBlank @Size(max=80) String trade,
            @Pattern(regexp="INTERNAL|THIRD_PARTY") @NotNull String employmentType,@Size(max=150) String company) {}
    public MaintenancePartner partner(Actor a,PartnerInput r) {
        admin(a);
        AppUser u=users.findById(r.userId()).filter(x->x.getRole()==UserRole.MAINTENANCE_STAFF && !x.isAccountLocked())
                .orElseThrow(()->error(400,"Select an active maintenance worker account"));
        hubs.findById(r.hubId()).orElseThrow(()->error(400,"Hub not found"));
        MaintenancePartner p=partners.findByUserId(r.userId()).orElseGet(MaintenancePartner::new);
        if("BUSY".equals(p.getAvailability())) throw error(409,"Cannot change a partner during an active assignment");
        if("THIRD_PARTY".equals(r.employmentType()) && (r.company()==null || r.company().isBlank())) throw error(400,"Vendor company is required");
        p.setTenantId(u.getTenantId());p.setUserId(u.getId());p.setHubId(r.hubId());p.setTrade(r.trade());
        p.setEmploymentType(r.employmentType());p.setCompany(r.company());return partners.save(p);
    }
    public record PartnerAdminUpdateInput(Long hubId, String trade, String employmentType, String company, Boolean onDuty) {}

    public MaintenancePartner updatePartner(Actor a, Long partnerId, PartnerAdminUpdateInput r) {
        admin(a);
        MaintenancePartner p = partners.lockById(partnerId).orElseThrow(() -> error(404, "Partner not found"));
        if (activeJobCount(p.getId()) > 0 && (r.hubId() != null || (r.trade() != null && !r.trade().isBlank()))) {
            throw error(409, "Hub or trade cannot be changed while the partner owns an active emergency order");
        }
        if (r.hubId() != null) {
            MaintenanceHub h = hubs.findById(r.hubId()).orElseThrow(() -> error(404, "Hub not found"));
            if (!h.isActive()) throw error(409, "Choose an active maintenance hub");
            p.setHubId(h.getId());
        }
        if (r.trade() != null && !r.trade().isBlank()) p.setTrade(r.trade().trim());
        if (r.employmentType() != null && !r.employmentType().isBlank()) {
            String type = r.employmentType().trim().toUpperCase(Locale.ROOT);
            if (!Set.of("INTERNAL", "IN_HOUSE", "CONTRACTOR", "THIRD_PARTY").contains(type)) throw error(400, "Invalid employment type");
            p.setEmploymentType(type);
        }
        if (r.company() != null) p.setCompany(r.company().trim());
        if (r.onDuty() != null) {
            if (!r.onDuty() && activeJobCount(p.getId()) > 0) throw error(409, "Partner cannot be marked off duty during an active emergency order");
            p.setOnDuty(r.onDuty());
            if (!r.onDuty()) { p.setWorkState("OFFLINE"); p.setAvailability("OFFLINE"); }
            else if (!"BUSY".equalsIgnoreCase(p.getWorkState())) { p.setWorkState("IDLE"); p.setAvailability("IDLE"); }
        }
        return partners.save(p);
    }
    public List<Map<String,Object>> directory(Actor a) {
        List<EmergencyMaintenanceBooking> ratingSource = bookings.findAll();
        return partners.findAll().stream().filter(p->a.admin() || (a.worker() && p.getUserId().equals(a.id()))).map(p->{
            Map<String,Object> m=new LinkedHashMap<>();
            m.put("id",p.getId());
            m.put("partnerId",p.getId());
            m.put("userId",p.getUserId());
            m.put("hubId",p.getHubId());

            String hubName = "Unassigned Hub";
            String hubCity = "N/A";
            String hubArea = "N/A";
            if (p.getHubId() != null) {
                var hOpt = hubs.findById(p.getHubId());
                if (hOpt.isPresent()) {
                    var h = hOpt.get();
                    hubName = h.getName() != null ? h.getName() : h.getCity() + " " + h.getArea();
                    hubCity = h.getCity() != null ? h.getCity() : "N/A";
                    hubArea = h.getArea() != null ? h.getArea() : "N/A";
                }
            }
            m.put("hubName", hubName);
            m.put("hub", hubName);
            m.put("hubCity", hubCity);
            m.put("city", hubCity);
            m.put("hubArea", hubArea);

            m.put("trade", p.getTrade() != null ? p.getTrade() : "General Maintenance");
            m.put("skillCategories", p.getSkillCategories());
            m.put("employmentType", p.getEmploymentType() != null ? p.getEmploymentType() : "IN_HOUSE");
            m.put("company", p.getCompany());
            m.put("availability", p.getAvailability());
            long activeJobs = ratingSource.stream().filter(b -> Objects.equals(p.getId(), b.getPartnerId()) && ACTIVE_EMERGENCY_STATES.contains(b.getJobStatus())).count();
            List<Integer> ratings = ratingSource.stream().filter(b -> Objects.equals(p.getId(), b.getPartnerId()) && b.getRating() != null).map(EmergencyMaintenanceBooking::getRating).toList();
            double averageRating = ratings.isEmpty() ? 0.0 : ratings.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            m.put("activeJobCount", activeJobs);
            m.put("averageRating", Math.round(averageRating * 10.0) / 10.0);
            m.put("ratingCount", ratings.size());
            m.put("tradeCode", normalizeTradeTag(p.getTrade()));

            String ws = p.getWorkState() != null ? p.getWorkState() : (p.getAvailability() != null ? p.getAvailability() : "IDLE");
            m.put("workState", ws);
            m.put("workStatus", ws);

            m.put("onDuty", p.isOnDuty());
            String ds = p.isOnDuty() ? "On Duty" : "Off Duty";
            m.put("dutyStatus", ds);
            m.put("dutyState", ds);

            m.put("latitude", p.getLatitude());
            m.put("longitude", p.getLongitude());
            m.put("locationUpdatedAt", p.getLocationUpdatedAt());

            String name = p.getName() != null && !p.getName().isBlank() ? p.getName() : null;
            String phone = p.getPhone() != null && !p.getPhone().isBlank() ? p.getPhone() : null;
            if (p.getUserId() != null) {
                var uOpt = users.findById(p.getUserId());
                if (uOpt.isPresent()) {
                    if (name == null || name.isBlank()) name = uOpt.get().getFullName();
                    if (phone == null || phone.isBlank()) phone = uOpt.get().getPhone();
                }
            }
            if (name == null || name.isBlank()) name = "Partner #" + p.getId();
            if (phone == null || phone.isBlank()) phone = "N/A";
            m.put("name", name);
            m.put("partner", name);
            m.put("phone", phone);
            return m;
        }).toList();
    }

    public MaintenancePartner togglePartnerDuty(Actor a, Long partnerId) {
        admin(a);
        MaintenancePartner p = partners.lockById(partnerId).orElseThrow(() -> error(404, "Partner not found"));
        boolean nextDuty = !p.isOnDuty();
        if (!nextDuty && activeJobCount(p.getId()) > 0) {
            throw error(409, "Partner cannot be marked off duty while an emergency order is active");
        }
        p.setOnDuty(nextDuty);
        if (!nextDuty) {
            p.setWorkState("OFFLINE");
            p.setAvailability("OFFLINE");
        } else {
            p.setWorkState("IDLE");
            p.setAvailability("IDLE");
        }
        return partners.save(p);
    }
    public List<Map<String,Object>> workerAccounts(Actor a) {
        admin(a);return users.findAll().stream().filter(u->u.getRole()==UserRole.MAINTENANCE_STAFF && !u.isAccountLocked())
            .map(u->Map.<String,Object>of("id",u.getId(),"name",u.getFullName(),"email",u.getEmail())).toList();
    }
    public record DutyInput(@NotNull @Pattern(regexp="IDLE|OFFLINE") String availability,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,@DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public void duty(Actor a,DutyInput r) {
        MaintenancePartner ref=partners.findByUserId(a.id()).filter(p->a.worker()).orElseThrow(()->error(403,"No partner profile. Ask the maintenance admin to map your account to a hub."));
        MaintenancePartner p=partners.lockById(ref.getId()).orElseThrow();
        if("BUSY".equals(p.getAvailability()) || activeJobCount(p.getId()) > 0) throw error(409,"Finish or decline your active booking before changing duty status");
        coordinates(r.latitude(),r.longitude());p.setAvailability(r.availability());
        p.setLatitude(r.latitude());p.setLongitude(r.longitude());p.setLocationUpdatedAt(r.latitude()==null?null:LocalDateTime.now());
    }
    public record BookingInput(@NotBlank @Size(max=40) String requesterPhone,@NotBlank @Size(max=600) String serviceAddress,
            @NotBlank @Size(max=80) String city,@Size(max=80) String area,
            @NotBlank @Size(max=80) String category,
            @NotBlank @Size(max=3000) String description,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,@DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public MaintenanceHub resolveHub(String city, String area, Double lat, Double lon) {
        List<MaintenanceHub> activeHubs = coverage();
        if (activeHubs.isEmpty()) return null;

        // 1. Customer coordinates where available (nearest active hub within coverage radius)
        if (lat != null && lon != null) {
            Optional<MaintenanceHub> nearestByCoord = activeHubs.stream()
                    .filter(x -> x.getLatitude() != null && x.getLongitude() != null)
                    .filter(x -> distance(lat, lon, x.getLatitude(), x.getLongitude()) <= x.getCoverageRadiusKm())
                    .min(Comparator.comparingDouble(x -> distance(lat, lon, x.getLatitude(), x.getLongitude())));
            if (nearestByCoord.isPresent()) {
                return nearestByCoord.get();
            }
        }

        if (city == null || city.isBlank()) return null;

        List<MaintenanceHub> cityHubs = activeHubs.stream()
                .filter(x -> x.getCity() != null && x.getCity().equalsIgnoreCase(city.trim()))
                .toList();

        // 2. Exact/known customer locality mapping
        if (area != null && !area.isBlank()) {
            Optional<MaintenanceHub> exactLocality = cityHubs.stream()
                    .filter(x -> x.getArea() != null && x.getArea().equalsIgnoreCase(area.trim()))
                    .findFirst();
            if (exactLocality.isPresent()) {
                return exactLocality.get();
            }
        }

        // 3. City/area-based mapping
        if (!cityHubs.isEmpty()) {
            return cityHubs.get(0);
        }

        // 4. Safe fallback requiring admin attention if resolution is impossible
        return null;
    }

    public EmergencyMaintenanceBooking create(Actor a, BookingInput r) {
        if (a.worker() || a.admin()) throw error(403, "Use a resident or customer account to request a service");
        coordinates(r.latitude(), r.longitude());
        if (r.latitude() == null && (r.area() == null || r.area().isBlank())) throw error(400, "Select an area/hub or share your coordinates");
        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
        b.setTenantId(a.tenant());
        b.setSourcePlatform(a.platform());
        b.setRequesterId(a.id());
        b.setRequesterName(a.name());
        b.setRequesterPhone(r.requesterPhone());
        b.setServiceAddress(r.serviceAddress());
        b.setCity(r.city().trim());
        b.setArea(r.area());
        b.setCategory(r.category());
        b.setDescription(r.description());
        b.setLatitude(r.latitude());
        b.setLongitude(r.longitude());
        
        MaintenanceHub h = resolveHub(r.city().trim(), r.area(), r.latitude(), r.longitude());
        b.setHubId(h == null ? null : h.getId());
        b.setJobStatus("UNASSIGNED");
        b.setDispatchCycleCount(1);
        b.setOfferSequence(0);
        b.setArrivalDueAt(LocalDateTime.now().plusMinutes(30));
        b.setDispatchReason(h == null ? "No partners within service area; admin review required" : "PENDING_DISPATCH: emergency booking registered in hub pipeline");
        
        EmergencyMaintenanceBooking saved = bookings.save(b);
        // Persist the public emergency order identifier after the database assigns the primary key.
        if (saved.getOrderReference() != null) saved.setOrderReference(saved.getOrderReference());
        saved = bookings.save(saved);
        broadcastEvent(saved.getId(), saved.getJobStatus(), "CREATED", saved.getPartnerId(), "Emergency booking registered in hub pipeline");
        dispatch(saved);
        saved = bookings.save(saved);
        return saved;
    }


    /**
     * Compatibility workflow for the resident live-tracking experience.  The legacy emergency
     * dispatch engine keeps its offer/accept loop; this entry point promotes a successful auto
     * match immediately to ASSIGNED so the three-stage resident workflow can begin at once.
     */
    public EmergencyMaintenanceBooking createWorkflow(Actor a, BookingInput r, String unitNumber) {
        EmergencyMaintenanceBooking b = create(a, r);
        b = locked(b.getId());
        if (unitNumber != null && !unitNumber.isBlank()) b.setUnitNumber(unitNumber.trim());
        if ("OFFERED".equalsIgnoreCase(b.getJobStatus()) && b.getPartnerId() != null) {
            LocalDateTime now = LocalDateTime.now();
            b.setJobStatus("ASSIGNED");
            b.setAcceptedAt(now);
            b.setAcceptanceDueAt(null);
            b.setArrivalDueAt(now.plusMinutes(30));
            b.setDispatchReason("Auto-assigned to matching available technician");
            recordAudit(b, "AUTO_ASSIGNED", b.getPartnerId(), "Immediate workflow assignment completed by matching engine", a.id());
            bookings.save(b);
            broadcastEvent(b.getId(), b.getJobStatus(), "AUTO_ASSIGNED", b.getPartnerId(), "Technician automatically assigned");
        }
        return bookings.save(b);
    }

    public EmergencyMaintenanceBooking workflowReadable(Actor a, String identifier) {
        EmergencyMaintenanceBooking b = resolveWorkflowBooking(identifier);
        boolean allowed = a.admin() || (a.worker() && assigned(a, b)) || (!a.worker() && owns(a, b));
        if (!allowed) throw error(403, "This maintenance order is not available to your account");
        return b;
    }

    private EmergencyMaintenanceBooking resolveWorkflowBooking(String identifier) {
        if (identifier == null || identifier.isBlank()) throw error(404, "Maintenance order not found");
        String raw = identifier.trim();
        Optional<EmergencyMaintenanceBooking> byRef = bookings.findByOrderReference(raw);
        if (byRef.isPresent()) return byRef.get();
        try {
            String numeric = raw.toUpperCase(Locale.ROOT).replace("ORD-EMG-", "").replace("EMG-", "");
            return bookings.findById(Long.parseLong(numeric)).orElseThrow(() -> error(404, "Maintenance order not found"));
        } catch (NumberFormatException ex) {
            throw error(404, "Maintenance order not found");
        }
    }

    public String workflowStageName(EmergencyMaintenanceBooking b) {
        String s = b.getJobStatus() == null ? "UNASSIGNED" : b.getJobStatus().toUpperCase(Locale.ROOT);
        return switch (s) {
            case "COMPLETED" -> "STAGE_3_COMPLETED";
            case "IN_PROGRESS", "PHOTO_START", "BEFORE_PHOTO_UPLOADED" -> "STAGE_2_STARTED";
            case "REACHED_LOCATION", "ON_SITE" -> "STAGE_1_REACHED";
            case "ASSIGNED", "ACCEPTED", "EN_ROUTE" -> "ASSIGNED";
            default -> "PENDING_ASSIGNMENT";
        };
    }

    public Map<String,Object> workflowView(Actor a, EmergencyMaintenanceBooking b) {
        Map<String,Object> base = new LinkedHashMap<>(view(a, b));
        base.put("currentStage", workflowStageName(b));
        base.put("residentId", b.getRequesterId());
        base.put("residentName", b.getRequesterName());
        base.put("unitNumber", b.getUnitNumber() != null && !b.getUnitNumber().isBlank() ? b.getUnitNumber() : b.getServiceAddress());
        base.put("contactNumber", maskPhone(b.getRequesterPhone()));
        base.put("tradeCategory", normalizeWorkflowTrade(b.getCategory()));
        base.put("startPhotoUrl", b.getBeforePhotoUrl());
        base.put("completionPhotoUrl", b.getAfterPhotoUrl());
        base.put("reviewRating", b.getRating());
        base.put("reviewComments", b.getReview());
        base.put("reviewTags", b.getReviewTags());
        if (b.getPartnerId() != null) {
            partners.findById(b.getPartnerId()).ifPresent(p -> {
                base.put("partnerRating", p.getRating() == null ? 0.0f : p.getRating());
                base.put("partnerRatingCount", p.getRatingCount() == null ? 0 : p.getRatingCount());
                base.put("partnerType", "INTERNAL".equalsIgnoreCase(p.getEmploymentType()) || "IN_HOUSE".equalsIgnoreCase(p.getEmploymentType()) ? "INTERNAL_STAFF" : "THIRD_PARTY");
            });
        }
        return base;
    }

    private String normalizeWorkflowTrade(String category) {
        String n = normalizeTradeTag(category);
        if (n.startsWith("PLUMB")) return "PLUMBING";
        if (n.startsWith("ELECT")) return "ELECTRICAL";
        if (n.startsWith("CARP")) return "CARPENTRY";
        return category == null ? "OTHER" : category.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) return "";
        String value = phone.trim();
        String digits = value.replaceAll("\\D", "");
        if (digits.length() <= 4) return "****";
        return "+** ******" + digits.substring(digits.length() - 4);
    }

    public List<Map<String,Object>> workflowActiveOrders(Actor a) {
        admin(a);
        return bookings.findAll().stream()
                .filter(b -> !Set.of("COMPLETED", "CANCELLED").contains(String.valueOf(b.getJobStatus()).toUpperCase(Locale.ROOT)))
                .sorted(Comparator.comparing(EmergencyMaintenanceBooking::getId).reversed())
                .map(b -> workflowView(a, b))
                .toList();
    }

    public Map<String,Object> workflowMetrics(Actor a) {
        admin(a);
        long pending = bookings.findAll().stream().filter(b -> "PENDING_ASSIGNMENT".equals(workflowStageName(b))).count();
        long active = bookings.findAll().stream().filter(b -> Set.of("ASSIGNED", "STAGE_1_REACHED", "STAGE_2_STARTED").contains(workflowStageName(b))).count();
        long available = partners.findAll().stream().filter(MaintenancePartner::isOnDuty)
                .filter(p -> "IDLE".equalsIgnoreCase(p.getWorkState()) || "IDLE".equalsIgnoreCase(p.getAvailability()))
                .count();
        return Map.of("pendingAssignment", pending, "activeJobs", active, "availableTechnicians", available);
    }

    public EmergencyMaintenanceBooking workflowStage(Actor a, String identifier, String requestedStage,
                                                       byte[] beforePhotoBytes, String imageUrl,
                                                       Double latitude, Double longitude, String notes,
                                                       boolean adminOverride) {
        coordinates(latitude, longitude);
        EmergencyMaintenanceBooking b = resolveWorkflowBooking(identifier);
        boolean workerOwns = a.worker() && assigned(a, b);
        boolean adminAllowed = a.admin() && adminOverride;
        if (!workerOwns && !adminAllowed) throw error(403, "Only the assigned technician or an admin override can update this order");
        String stage = requestedStage == null ? "" : requestedStage.trim().toUpperCase(Locale.ROOT);
        LocalDateTime now = LocalDateTime.now();
        String current = workflowStageName(b);

        switch (stage) {
            case "STAGE_1_REACHED" -> {
                if (!"ASSIGNED".equals(current)) throw error(409, "Reached Location requires an assigned order; current stage is " + current);
                b.setJobStatus("REACHED_LOCATION");
                b.setReachedAt(now);
                b.setDispatchReason(adminAllowed ? "Reached Location recorded by admin override" : "Technician reached resident location");
                if (b.getPartnerId() != null && latitude != null && longitude != null) {
                    partners.findById(b.getPartnerId()).ifPresent(p -> {
                        p.setLatitude(latitude); p.setLongitude(longitude); p.setLocationUpdatedAt(now); partners.save(p);
                    });
                }
                if (b.getRequesterId() != null) {
                    Notification n = new Notification();
                    n.setUserId(b.getRequesterId());
                    n.setType("SERVICE_PARTNER_ARRIVED");
                    n.setTitle("Worker is at your door");
                    n.setMessage("Your technician has reached your location for " + b.getOrderReference() + ".");
                    n.setReadStatus(false);
                    notifications.save(n);
                }
                recordAudit(b, "STAGE_1_REACHED", b.getPartnerId(), "Technician checked in on-site" + (adminAllowed ? " via admin override" : ""), a.id());
            }
            case "STAGE_2_STARTED" -> {
                if (!"STAGE_1_REACHED".equals(current)) throw error(409, "Work Started requires Reached Location first; current stage is " + current);
                boolean hasUpload = beforePhotoBytes != null && beforePhotoBytes.length > 0;
                boolean hasUrl = isValidImageUrl(imageUrl);
                if (!hasUpload && !hasUrl) throw error(400, "A before-work image file or valid image URL is mandatory before work can start");
                if (hasUpload) {
                    b.setBeforePhoto(beforePhotoBytes);
                    b.setBeforePhotoUrl("/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/before");
                } else {
                    b.setBeforePhotoUrl(imageUrl.trim());
                }
                b.setBeforePhotoLatitude(latitude);
                b.setBeforePhotoLongitude(longitude);
                b.setPhotoStartAt(now);
                b.setStartedAt(now);
                if (b.getEstimatedDurationMinutes() == null || b.getEstimatedDurationMinutes() <= 0) {
                    b.setEstimatedDurationMinutes(defaultWorkEstimateMinutes(b.getCategory()));
                }
                b.setEstimatedCompletionAt(now.plusMinutes(b.getEstimatedDurationMinutes()));
                b.setJobStatus("IN_PROGRESS");
                b.setDispatchReason(adminAllowed ? "Work started with photo proof via admin override" : "Repairs currently underway");
                recordAudit(b, "STAGE_2_STARTED", b.getPartnerId(), "Mandatory before photo verified and work started" + (adminAllowed ? " via admin override" : ""), a.id());
            }
            case "STAGE_3_COMPLETED" -> {
                if (!"STAGE_2_STARTED".equals(current)) throw error(409, "Completion requires Work Started first; current stage is " + current);
                if (b.getBeforePhoto() == null && !isValidImageUrl(b.getBeforePhotoUrl()) && (b.getBeforePhotoUrl() == null || !b.getBeforePhotoUrl().startsWith("/api/"))) {
                    throw error(409, "Before-work photo proof is missing");
                }
                b.setJobStatus("COMPLETED");
                b.setCompletedAt(now);
                b.setReviewRequestedAt(now);
                if (notes != null && !notes.isBlank()) b.setCompletionNotes(notes.trim());
                b.setDispatchReason("Work completed; resident review unlocked");
                recordAudit(b, "STAGE_3_COMPLETED", b.getPartnerId(), "Service completed and technician returned to active pool" + (adminAllowed ? " via admin override" : ""), a.id());
                release(b);
                triggerCustomerReviewRequest(b, a.id());
            }
            default -> throw error(400, "Stage must be STAGE_1_REACHED, STAGE_2_STARTED, or STAGE_3_COMPLETED");
        }
        bookings.save(b);
        broadcastEvent(b.getId(), b.getJobStatus(), stage, b.getPartnerId(), "Workflow stage changed to " + stage);
        return b;
    }


    private int defaultWorkEstimateMinutes(String category) {
        String trade = normalizeTradeTag(category);
        if (trade.startsWith("ELECT")) return 60;
        if (trade.startsWith("PLUMB")) return 75;
        if (trade.startsWith("CARP")) return 90;
        return 90;
    }

    private boolean isValidImageUrl(String url) {
        if (url == null || url.isBlank()) return false;
        try {
            java.net.URI uri = java.net.URI.create(url.trim());
            String scheme = uri.getScheme();
            return scheme != null && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) && uri.getHost() != null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public void workflowReview(Actor a, String identifier, int rating, String comment, List<String> tags) {
        EmergencyMaintenanceBooking b = resolveWorkflowBooking(identifier);
        if (!owns(a, b)) throw error(403, "Only the resident who created this booking can review it");
        if (!"COMPLETED".equalsIgnoreCase(b.getJobStatus())) throw error(409, "Review is unlocked only after work completion");
        if (b.getRating() != null) throw error(409, "Review already submitted");
        if (rating < 1 || rating > 5) throw error(400, "Rating must be between 1 and 5");
        if (comment != null && comment.length() > 1000) throw error(400, "Review comment must be 1000 characters or less");
        List<String> safeTags = tags == null ? List.of() : tags.stream()
                .filter(Objects::nonNull).map(String::trim).filter(x -> !x.isBlank()).distinct().limit(8).toList();
        b.setRating(rating);
        b.setReview(comment == null ? null : comment.trim());
        b.setReviewTags(String.join(",", safeTags));
        b.setCustomerSignedOffAt(LocalDateTime.now());
        b.setReviewNotificationStatus("COMPLETED");
        recordAudit(b, "CUSTOMER_SIGNED_OFF", b.getPartnerId(), "Resident submitted rating " + rating + "/5", a.id());
        bookings.save(b);
        recalculatePartnerRating(b.getPartnerId());
        broadcastEvent(b.getId(), b.getJobStatus(), "CUSTOMER_REVIEW_SUBMITTED", b.getPartnerId(), "Resident review submitted");
    }

    private void recalculatePartnerRating(Long partnerId) {
        if (partnerId == null) return;
        MaintenancePartner p = partners.findById(partnerId).orElse(null);
        if (p == null) return;
        List<EmergencyMaintenanceBooking> reviewed = bookings.findByPartnerIdAndRatingIsNotNull(partnerId);
        if (reviewed.isEmpty()) {
            p.setRating(0.0f); p.setRatingCount(0);
        } else {
            double avg = reviewed.stream().map(EmergencyMaintenanceBooking::getRating).filter(Objects::nonNull).mapToInt(Integer::intValue).average().orElse(0.0);
            p.setRating((float)Math.round(avg * 10.0) / 10.0f);
            p.setRatingCount((int) reviewed.stream().filter(x -> x.getRating() != null).count());
        }
        partners.save(p);
    }

    private void coordinates(Double lat, Double lon) { if ((lat == null) != (lon == null)) throw error(400, "Both latitude and longitude are required"); }

    public static double distance(double a, double b, double c, double d) {
        double x = Math.pow(Math.sin(Math.toRadians(c - a) / 2), 2) + Math.cos(Math.toRadians(a)) * Math.cos(Math.toRadians(c)) * Math.pow(Math.sin(Math.toRadians(d - b) / 2), 2);
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
    }

    public List<MaintenancePartner> findEligiblePartners(EmergencyMaintenanceBooking b, MaintenanceHub h) {
        if (h == null || b == null) return List.of();
        return partners.findByHubId(h.getId()).stream()
                .filter(MaintenancePartner::isOnDuty)
                .filter(p -> "IDLE".equalsIgnoreCase(p.getWorkState() == null ? p.getAvailability() : p.getWorkState()))
                .filter(p -> !"BUSY".equalsIgnoreCase(p.getWorkState()) && !"BUSY".equalsIgnoreCase(p.getAvailability()))
                .filter(p -> !"OFFLINE".equalsIgnoreCase(p.getWorkState()) && !"OFFLINE".equalsIgnoreCase(p.getAvailability()))
                .filter(p -> isTradeMatch(p, b.getCategory()))
                .filter(p -> activeJobCount(p.getId()) == 0)
                .filter(p -> !b.getDeclinedPartnerIds().contains("," + p.getId() + ","))
                .filter(p -> users.findById(p.getUserId()).map(u -> !u.isAccountLocked()).orElse(false))
                .sorted(
                    Comparator.comparing((MaintenancePartner p) -> p.getHubId() != null && p.getHubId().equals(b.getHubId()) ? 0 : 1)
                              .thenComparingDouble(p -> partnerDistance(p, b, h))
                )
                .toList();
    }

    public String inferCityForHub(String hubTag) {
        if (hubTag == null || hubTag.isBlank()) return "Chennai";
        String key = hubTag.trim();
        Optional<String> configuredCity = coverage().stream()
                .filter(h -> (h.getArea() != null && h.getArea().equalsIgnoreCase(key))
                        || (h.getName() != null && h.getName().equalsIgnoreCase(key)))
                .map(MaintenanceHub::getCity)
                .filter(Objects::nonNull)
                .filter(x -> !x.isBlank())
                .findFirst();
        if (configuredCity.isPresent()) return configuredCity.get();

        String normalized = key.toLowerCase(Locale.ROOT);
        if (Set.of("marathahalli", "whitefield", "indiranagar", "koramangala", "hsr layout", "electronic city")
                .stream().anyMatch(normalized::contains)) return "Bangalore";
        if (Set.of("adyar", "velachery", "anna nagar", "t nagar", "tambaram", "porur", "omr")
                .stream().anyMatch(normalized::contains)) return "Chennai";
        return "Chennai";
    }

    public String normalizeTradeTag(String value) {
        if (value == null) return "";
        String v = value.trim().toLowerCase(Locale.ROOT);
        if (v.startsWith("plumb")) return "PLUMB";
        if (v.startsWith("elect") || v.contains("electric")) return "ELECT";
        if (v.startsWith("carp") || v.contains("wood") || v.contains("door")) return "CARP";
        return v.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    public boolean isTradeMatch(MaintenancePartner p, String category) {
        if (category == null || category.isBlank() || p == null) return false;
        String requested = normalizeTradeTag(category);
        if (requested.equals(normalizeTradeTag(p.getTrade()))) return true;
        if (p.getSkillCategories() != null) {
            return Arrays.stream(p.getSkillCategories().split(","))
                    .map(this::normalizeTradeTag)
                    .anyMatch(requested::equals);
        }
        return false;
    }

    private long activeJobCount(Long partnerId) {
        if (partnerId == null) return 0;
        return bookings.countByPartnerIdAndJobStatusIn(partnerId, ACTIVE_EMERGENCY_STATES);
    }

    public void dispatch(EmergencyMaintenanceBooking b) {
        dispatch(b, false);
    }

    public void dispatch(EmergencyMaintenanceBooking b, boolean isTimeout) {
        MaintenanceHub h = resolveHub(b.getCity(), b.getArea(), b.getLatitude(), b.getLongitude());
        b.setHubId(h == null ? null : h.getId());
        b.setPartnerId(null);
        b.setDistanceKm(null);

        if (h == null) {
            moveToFailedQueue(b, "No partners within service area");
            return;
        }

        List<MaintenancePartner> candidates = findEligiblePartners(b, h);
        boolean offered = false;
        for (MaintenancePartner candidate : candidates) {
            try {
                offer(b, candidate, h);
                offered = true;
                break;
            } catch (ResponseStatusException ex) {
                if (!HttpStatus.CONFLICT.equals(ex.getStatusCode())) throw ex;
                // Candidate availability changed between ranking and reservation. Continue
                // down the ranked list instead of failing the customer's order.
            }
        }
        if (!offered) {
            String reason = determineFailureReason(b, h, isTimeout);
            moveToFailedQueue(b, reason);
        }
    }

    public String determineFailureReason(EmergencyMaintenanceBooking b, MaintenanceHub h, boolean isTimeout) {
        if (h == null) {
            return "No partners within service area";
        }
        List<MaintenancePartner> hubPartners = partners.findByHubId(h.getId());
        if (hubPartners.isEmpty()) {
            return "No partners within service area";
        }
        List<MaintenancePartner> tradePartners = hubPartners.stream()
                .filter(p -> isTradeMatch(p, b.getCategory()))
                .toList();
        if (tradePartners.isEmpty()) {
            return "No partner with matching trade";
        }

        String declined = b.getDeclinedPartnerIds() != null ? b.getDeclinedPartnerIds() : ",";
        List<MaintenancePartner> remaining = tradePartners.stream()
                .filter(p -> !declined.contains("," + p.getId() + ","))
                .toList();

        if (remaining.isEmpty()) {
            return isTimeout ? "Assignment timeout" : "All candidates declined";
        }

        List<MaintenancePartner> onDuty = remaining.stream()
                .filter(MaintenancePartner::isOnDuty)
                .toList();
        if (onDuty.isEmpty()) {
            return "No on-duty partners";
        }

        boolean allBusy = onDuty.stream()
                .allMatch(p -> "BUSY".equalsIgnoreCase(p.getWorkState()) || "BUSY".equalsIgnoreCase(p.getAvailability()));
        if (allBusy) {
            return "All partners busy";
        }

        return "No eligible partners";
    }

    private double partnerDistance(MaintenancePartner p, EmergencyMaintenanceBooking b, MaintenanceHub h) {
        Double targetLat = b.getLatitude();
        Double targetLon = b.getLongitude();
        if (targetLat == null || targetLon == null) {
            targetLat = h != null ? h.getLatitude() : null;
            targetLon = h != null ? h.getLongitude() : null;
        }
        if (targetLat == null || targetLon == null) return Double.MAX_VALUE;

        boolean freshLoc = p.getLatitude() != null && p.getLongitude() != null
                && p.getLocationUpdatedAt() != null
                && p.getLocationUpdatedAt().isAfter(LocalDateTime.now().minusMinutes(30));

        double pLat = freshLoc ? p.getLatitude() : (h != null && h.getLatitude() != null ? h.getLatitude() : 0.0);
        double pLon = freshLoc ? p.getLongitude() : (h != null && h.getLongitude() != null ? h.getLongitude() : 0.0);

        if (pLat == 0.0 && pLon == 0.0) return Double.MAX_VALUE;
        return distance(targetLat, targetLon, pLat, pLon);
    }

    private void offer(EmergencyMaintenanceBooking b, MaintenancePartner p, MaintenanceHub h) {
        // Re-lock and re-check the partner immediately before reservation so two concurrent
        // dispatch loops cannot allocate overlapping emergency work to the same person.
        MaintenancePartner lockedPartner = partners.lockById(p.getId()).orElseThrow(() -> error(404, "Partner not found"));
        if (!lockedPartner.isOnDuty()
                || !"IDLE".equalsIgnoreCase(lockedPartner.getAvailability())
                || activeJobCount(lockedPartner.getId()) > 0) {
            throw error(409, "Partner availability changed during dispatch; retry matching");
        }
        p = lockedPartner;
        p.setAvailability("BUSY");
        p.setWorkState("BUSY");
        b.setPartnerId(p.getId());
        b.setHubId(h.getId());
        b.setJobStatus("OFFERED");
        if (b.getAssignmentType() == null || !"Manual".equalsIgnoreCase(b.getAssignmentType())) {
            b.setAssignmentType("Auto");
        }
        if (b.getAssignedAt() == null) {
            b.setAssignedAt(LocalDateTime.now());
        }
        LocalDateTime offeredAt = LocalDateTime.now();
        b.setOfferedAt(offeredAt);
        b.setAcceptanceDueAt(offeredAt.plusSeconds(Math.max(1, offerTimeoutSeconds)));
        b.setOfferSequence((b.getOfferSequence() == null ? 0 : b.getOfferSequence()) + 1);
        double d = partnerDistance(p, b, h);
        b.setDistanceKm(d == Double.MAX_VALUE ? null : Math.round(d * 10) / 10.0);
        b.setDispatchReason("Awaiting partner acceptance (" + offerTimeoutSeconds + " second limit)");
        // Build partner notification without exposing customer personal data
        Notification n = new Notification();
        // Tenant ID omitted; Notification entity does not include tenantId
        n.setUserId(p.getUserId());
        n.setType("EMERGENCY_OFFER");
        n.setTitle("New Emergency Assignment");
        StringBuilder msg = new StringBuilder();
        msg.append("Category: ").append(b.getCategory()).append("\n");
        msg.append("Description: ").append(b.getDescription() != null ? b.getDescription() : "").append("\n");
        msg.append("Location: ").append(b.getCity());
        if (b.getArea() != null && !b.getArea().isBlank()) msg.append(", ").append(b.getArea());
        msg.append("\n");
        if (b.getDistanceKm() != null) {
            msg.append("Approx. distance: ").append(b.getDistanceKm()).append(" km\n");
        }
        n.setMessage(msg.toString());
        n.setReadStatus(false);
        notifications.save(n);
        recordAudit(b, "OFFERED", p.getId(), "Offered via " + b.getAssignmentType() + " assignment. Trade: " + p.getTrade() + ". Approx distance: " + (b.getDistanceKm() != null ? b.getDistanceKm() + " km" : "unknown"), p.getUserId());
        partners.save(p);
        bookings.save(b);
        broadcastEvent(b.getId(), b.getJobStatus(), "OFFERED", p.getId(), "Booking offered to partner " + p.getId());
    }
    public void assign(Actor a,Long id,Long partnerId) {
        admin(a);EmergencyMaintenanceBooking b=locked(id);
        if(!"UNASSIGNED".equals(b.getJobStatus()) && !"FAILED_ASSIGNMENT".equals(b.getJobStatus()))throw error(409,"Only unassigned or failed bookings can be assigned");
        MaintenancePartner p=partners.lockById(partnerId).orElseThrow(()->error(404,"Partner not found"));
        MaintenanceHub h=hubs.findById(p.getHubId()).orElseThrow();
        if(!"IDLE".equalsIgnoreCase(p.getAvailability()) || !isTradeMatch(p, b.getCategory()) || !h.getCity().equalsIgnoreCase(b.getCity())
            || !"ACTIVE".equalsIgnoreCase(h.getStatus()) || users.findById(p.getUserId()).map(AppUser::isAccountLocked).orElse(true)
            || activeJobCount(p.getId()) > 0)
            throw error(409,"Choose an idle, active partner with the matching trade, no active emergency job, and the correct service city");
        b.setAssignmentType("Manual");
        b.setAssignedBy(a.name() != null ? a.name() : "Admin");
        b.setAssignedAt(LocalDateTime.now());
        recordAudit(b, "MANUALLY_OFFERED", p.getId(), "Manually offered by " + b.getAssignedBy() + " (Assignment Type: Manual)", a.id());
        offer(b,p,h);
    }
    private EmergencyMaintenanceBooking locked(Long id) {return bookings.lockById(id).orElseThrow(()->error(404,"Booking not found"));}
    private boolean owns(Actor a,EmergencyMaintenanceBooking b) {
        return a != null && b != null && !a.worker() && Objects.equals(a.platform(), b.getSourcePlatform()) && a.id() != null && a.id().equals(b.getRequesterId());
    }
    private boolean assigned(Actor a,EmergencyMaintenanceBooking b) {return a.worker() && b.getPartnerId()!=null && partners.findById(b.getPartnerId()).map(p->p.getUserId().equals(a.id())).orElse(false);}
    public EmergencyMaintenanceBooking readable(Actor a,Long id) {
        EmergencyMaintenanceBooking b=bookings.findById(id).orElseThrow(()->error(404,"Booking not found"));
        boolean allowed = a.admin() || (a.worker() && assigned(a, b)) || (!a.worker() && owns(a, b));
        if(!allowed) throw error(403,"This booking is not assigned to your account");
        return b;
    }
    public List<Map<String,Object>> list(Actor a) {
        return bookings.findAll().stream()
                .filter(b -> a.admin() || (a.worker() && assigned(a, b)) || (!a.worker() && owns(a, b)))
                .sorted(Comparator.comparing(EmergencyMaintenanceBooking::getId).reversed())
                .map(b -> view(a, b))
                .toList();
    }
    public Map<String,Object> view(Actor a,EmergencyMaintenanceBooking b) {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",b.getId());
        m.put("bookingId",b.getId());
        m.put("bookingReference",b.getBookingReference());
        m.put("orderReference",b.getOrderReference());
        m.put("orderId",b.getOrderReference());
        m.put("category",b.getCategory());
        m.put("serviceCategory",b.getCategory());
        m.put("issueType",b.getCategory());
        m.put("description",b.getDescription());
        m.put("issueDescription",b.getDescription());
        m.put("city",b.getCity());
        m.put("area",b.getArea());
        String displayLoc = (b.getArea() != null && !b.getArea().isBlank())
                ? (b.getArea() + (b.getCity() != null && !b.getCity().isBlank() ? ", " + b.getCity() : ""))
                : (b.getCity() != null && !b.getCity().isBlank() ? b.getCity() : (b.getServiceAddress() != null ? b.getServiceAddress() : "Hub Area"));
        m.put("location", displayLoc);
        m.put("hubId", b.getHubId());

        // Resolved Hub
        MaintenanceHub hub = null;
        if (b.getHubId() != null) {
            hub = hubs.findById(b.getHubId()).orElse(null);
        }
        if (hub == null && (b.getCity() != null || b.getArea() != null)) {
            try {
                hub = resolveHub(b.getCity(), b.getArea(), b.getLatitude(), b.getLongitude());
            } catch (Exception ignored) {}
        }
        String resolvedHubName = hub != null 
                ? (hub.getName() != null && !hub.getName().isBlank() ? hub.getName() : (hub.getCity() + " Hub (" + (hub.getArea() != null ? hub.getArea() : "Main") + ")"))
                : (b.getHubId() != null ? "Hub #" + b.getHubId() : "Pending Hub Resolution");
        m.put("resolvedHub", resolvedHubName);
        m.put("hubName", resolvedHubName);
        m.put("hub", resolvedHubName);
        m.put("hubLatitude", hub != null ? hub.getLatitude() : 12.9716);
        m.put("hubLongitude", hub != null ? hub.getLongitude() : 77.5946);
        m.put("hubRadiusKm", hub != null ? hub.getCoverageRadiusKm() : 10.0);

        Double incidentLat = b.getLatitude();
        Double incidentLon = b.getLongitude();
        if (incidentLat == null && hub != null && hub.getLatitude() != null) {
            double offsetLat = ((b.getId() != null ? (b.getId() % 7) - 3 : 0) * 0.008);
            double offsetLon = ((b.getId() != null ? (b.getId() % 5) - 2 : 0) * 0.008);
            incidentLat = hub.getLatitude() + offsetLat;
            incidentLon = hub.getLongitude() + offsetLon;
        } else if (incidentLat == null) {
            incidentLat = 12.9716;
            incidentLon = 77.5946;
        }
        m.put("latitude", incidentLat);
        m.put("longitude", incidentLon);

        // Assigned Partner
        m.put("partnerId", b.getPartnerId());
        String partnerName = "Unassigned";
        String partnerPhone = "";
        Double partnerLat = null;
        Double partnerLon = null;
        String partnerTrade = null;
        String partnerWorkState = null;
        String partnerEmploymentType = null;
        String partnerDutyStatus = null;
        String partnerHubName = null;
        if (b.getPartnerId() != null) {
            var partnerOpt = partners.findById(b.getPartnerId());
            if (partnerOpt.isPresent()) {
                var p = partnerOpt.get();
                if (p.getName() != null && !p.getName().isBlank()) {
                    partnerName = p.getName();
                } else {
                    partnerName = users.findById(p.getUserId()).map(AppUser::getFullName).orElse("Partner #" + p.getId());
                }
                partnerPhone = p.getPhone() != null ? p.getPhone() : "";
                partnerLat = p.getLatitude();
                partnerLon = p.getLongitude();
                partnerTrade = p.getTrade() != null ? p.getTrade() : "General Maintenance";
                partnerWorkState = p.getWorkState() != null ? p.getWorkState() : p.getAvailability();
                partnerEmploymentType = p.getEmploymentType() != null ? p.getEmploymentType() : "IN_HOUSE";
                partnerDutyStatus = p.isOnDuty() ? "On Duty" : "Off Duty";
                partnerHubName = p.getHubId() != null ? hubs.findById(p.getHubId()).map(MaintenanceHub::getName).orElse("Hub #" + p.getHubId()) : null;
            } else {
                partnerName = "Partner #" + b.getPartnerId();
            }
        }
        if (partnerLat == null && b.getPartnerId() != null && incidentLat != null) {
            partnerLat = incidentLat + 0.009;
            partnerLon = incidentLon + 0.007;
        }
        m.put("assignedPartner", partnerName);
        m.put("partnerName", partnerName);
        m.put("partnerPhone", partnerPhone);
        m.put("partnerLatitude", partnerLat);
        m.put("partnerLongitude", partnerLon);
        m.put("partnerTrade", partnerTrade != null ? partnerTrade : "N/A");
        m.put("partnerWorkState", partnerWorkState != null ? partnerWorkState : "IDLE");
        m.put("partnerEmploymentType", partnerEmploymentType != null ? partnerEmploymentType : "IN_HOUSE");
        m.put("partnerDutyStatus", partnerDutyStatus != null ? partnerDutyStatus : (b.getPartnerId() != null ? "On Duty" : "N/A"));
        m.put("partnerHub", partnerHubName != null ? partnerHubName : (b.getPartnerId() != null ? resolvedHubName : "Unassigned"));
        m.put("partnerHubName", partnerHubName != null ? partnerHubName : (b.getPartnerId() != null ? resolvedHubName : "Unassigned"));
        m.put("partnerCurrentStatus", b.getPartnerId() != null ? (partnerDutyStatus + " (" + partnerWorkState + ")") : "Unassigned");

        String rawStatus = b.getJobStatus() != null ? b.getJobStatus() : "UNASSIGNED";
        String statusLabel = switch (rawStatus) {
            case "UNASSIGNED" -> "Searching Partner";
            case "OFFERED" -> "Awaiting Acceptance";
            case "ASSIGNED", "ACCEPTED" -> "Accepted";
            case "EN_ROUTE" -> "En Route";
            case "REACHED_LOCATION", "ON_SITE" -> "On Site";
            case "PHOTO_START", "BEFORE_PHOTO_UPLOADED" -> "Before Photo Uploaded";
            case "IN_PROGRESS" -> "In Progress";
            case "COMPLETED" -> "Completed";
            case "FAILED_ASSIGNMENT", "FAILED" -> "Failed Assignment";
            case "CANCELLED" -> "Cancelled";
            default -> rawStatus;
        };
        String operationalStatus = switch (rawStatus) {
            case "UNASSIGNED", "OFFERED" -> "PENDING_DISPATCH";
            case "FAILED_ASSIGNMENT", "FAILED" -> b.getEscalatedAt() != null ? "UNASSIGNED_ESCALATED" : "PENDING_DISPATCH";
            case "ASSIGNED", "ACCEPTED" -> "ACCEPTED";
            case "REACHED_LOCATION", "ON_SITE" -> "REACHED_LOCATION";
            case "PHOTO_START", "BEFORE_PHOTO_UPLOADED" -> "PHOTO_START";
            case "IN_PROGRESS" -> "IN_PROGRESS";
            case "COMPLETED" -> "COMPLETED";
            default -> rawStatus;
        };
        if ("UNASSIGNED_ESCALATED".equals(operationalStatus)) statusLabel = "Escalated - Manual Override Required";
        m.put("jobStatus", rawStatus);
        m.put("currentStatus", rawStatus);
        m.put("status", rawStatus);
        m.put("lifecycleStatus", rawStatus);
        m.put("operationalStatus", operationalStatus);
        m.put("dispatchState", operationalStatus);
        m.put("criticalDispatch", "PENDING_DISPATCH".equals(operationalStatus) || "UNASSIGNED_ESCALATED".equals(operationalStatus));
        m.put("dispatchCycleCount", b.getDispatchCycleCount() == null ? 1 : b.getDispatchCycleCount());
        m.put("maxDispatchCycles", Math.max(1, maxDispatchCycles));
        m.put("offerSequence", b.getOfferSequence() == null ? 0 : b.getOfferSequence());
        m.put("acceptanceDueAt", b.getAcceptanceDueAt());
        m.put("acceptanceWindowSeconds", offerTimeoutSeconds);
        m.put("escalatedAt", b.getEscalatedAt());
        m.put("escalationReason", b.getEscalationReason());
        m.put("statusLabel", statusLabel);
        m.put("statusBadgeLabel", statusLabel);
        m.put("assignmentType", b.getAssignmentType() != null ? b.getAssignmentType() : "Auto");
        m.put("assignedBy", b.getAssignedBy() != null ? b.getAssignedBy() : ("Manual".equalsIgnoreCase(b.getAssignmentType()) ? "Admin" : "System Auto-Dispatch"));
        m.put("assignedAt", b.getAssignedAt());
        if (b.getAssignedAt() != null) {
            m.put("assignedAtFormatted", b.getAssignedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        } else {
            m.put("assignedAtFormatted", null);
        }
        m.put("assignmentAuditLog", b.getAssignmentAuditLog());
        m.put("assignmentHistory", history(a, b.getId()));
        m.put("declinedPartnerIds", b.getDeclinedPartnerIds());
        m.put("dispatchReason",b.getDispatchReason());
        m.put("distanceKm",b.getDistanceKm());
        m.put("distance", b.getDistanceKm() != null ? (b.getDistanceKm() + " km") : "Hub area");
        m.put("createdAt",b.getCreatedAt());
        if (b.getCreatedAt() != null) {
            m.put("createdTimeFormatted", b.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            LocalDateTime elapsedUntil = b.getCompletedAt() != null ? b.getCompletedAt() : LocalDateTime.now();
            long elapsedSeconds = Math.max(0, java.time.Duration.between(b.getCreatedAt(), elapsedUntil).getSeconds());
            long elapsedMinutes = elapsedSeconds / 60;
            String elapsedText = elapsedMinutes >= 60 ? ((elapsedMinutes / 60) + "h " + (elapsedMinutes % 60) + "m") : (elapsedMinutes + "m " + (elapsedSeconds % 60) + "s");
            m.put("timeElapsedSeconds", elapsedSeconds);
            m.put("timeElapsedFormatted", elapsedText);
        }
        m.put("offeredAt",b.getOfferedAt());
        m.put("acceptedAt",b.getAcceptedAt());
        m.put("arrivalDueAt",b.getArrivalDueAt());
        m.put("reachedAt",b.getReachedAt());
        m.put("arrivalDistanceKm", b.getArrivalDistanceKm());
        m.put("arrivalGeofenceVerified", b.getArrivalGeofenceVerified());
        m.put("photoStartAt",b.getPhotoStartAt());
        m.put("beforePhotoAt", b.getPhotoStartAt());
        m.put("beforePhotoLatitude", b.getBeforePhotoLatitude());
        m.put("beforePhotoLongitude", b.getBeforePhotoLongitude());
        m.put("photoEndAt", b.getPhotoEndAt());
        m.put("afterPhotoLatitude", b.getAfterPhotoLatitude());
        m.put("afterPhotoLongitude", b.getAfterPhotoLongitude());
        m.put("photoCompletedAt", b.getPhotoEndAt());
        m.put("afterPhotoAt", b.getPhotoEndAt());
        m.put("startedAt",b.getStartedAt());
        m.put("inProgressAt", b.getStartedAt());
        m.put("estimatedDurationMinutes", b.getEstimatedDurationMinutes());
        m.put("estimatedCompletionAt", b.getEstimatedCompletionAt());
        long remainingWorkMinutes = 0;
        String remainingWorkText = "Estimate pending";
        if (b.getCompletedAt() != null || "COMPLETED".equalsIgnoreCase(b.getJobStatus())) {
            remainingWorkText = "Completed";
        } else if (b.getEstimatedCompletionAt() != null) {
            long seconds = java.time.Duration.between(LocalDateTime.now(), b.getEstimatedCompletionAt()).getSeconds();
            remainingWorkMinutes = Math.max(0, (long)Math.ceil(seconds / 60.0));
            remainingWorkText = seconds > 0 ? (remainingWorkMinutes + " min remaining") : "Estimate elapsed · finishing shortly";
        } else if (b.getStartedAt() == null) {
            remainingWorkText = "Starts after technician check-in and photo verification";
        }
        m.put("remainingWorkMinutes", remainingWorkMinutes);
        m.put("remainingWorkText", remainingWorkText);
        m.put("workProgress", workflowStageName(b).equals("STAGE_3_COMPLETED") ? "Completed" : workflowStageName(b).equals("STAGE_2_STARTED") ? "Processing" : workflowStageName(b).equals("STAGE_1_REACHED") || workflowStageName(b).equals("ASSIGNED") ? "Started" : "Awaiting assignment");
        m.put("completedAt",b.getCompletedAt());
        m.put("reviewLinkSentAt", b.getReviewLinkSentAt());
        m.put("reviewNotificationStatus", b.getReviewNotificationStatus());
        m.put("reviewLinkSent", b.getReviewLinkSentAt() != null || "SENT".equalsIgnoreCase(b.getReviewNotificationStatus()));
        m.put("timeline", buildTimeline(b));
        m.put("lifecycleTimeline", buildTimeline(b));
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("accepted", b.getAcceptedAt());
        summary.put("reachedLocation", b.getReachedAt());
        summary.put("beforePhoto", b.getPhotoStartAt());
        summary.put("inProgress", b.getStartedAt());
        summary.put("completed", b.getCompletedAt());
        m.put("timelineSummary", summary);
        m.put("hasBeforePhoto",b.getBeforePhoto()!=null);
        m.put("hasAfterPhoto",b.getAfterPhoto()!=null);
        m.put("beforePhotoUrl", b.getBeforePhotoUrl() != null ? b.getBeforePhotoUrl() : (b.getBeforePhoto() != null ? "/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/before" : null));
        m.put("afterPhotoUrl", b.getAfterPhotoUrl() != null ? b.getAfterPhotoUrl() : (b.getAfterPhoto() != null ? "/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/after" : null));
        m.put("completionNotes", b.getCompletionNotes());
        m.put("reviewRequestedAt",b.getReviewRequestedAt());
        m.put("customerReviewUrl", b.getCustomerReviewUrl() != null ? b.getCustomerReviewUrl() : (b.getId() != null ? "/api/maintenance/dispatch/bookings/" + b.getId() + "/review" : null));
        m.put("reviewNotificationChannels", b.getReviewNotificationChannels() != null ? b.getReviewNotificationChannels() : (b.getReviewRequestedAt() != null ? "IN_APP,SMS,WHATSAPP,PUSH" : null));
        m.put("reviewNotificationStatus", b.getReviewNotificationStatus() != null ? b.getReviewNotificationStatus() : (b.getReviewRequestedAt() != null ? "PREPARED" : "IDLE"));
        m.put("reviewRequestPayload", b.getReviewRequestPayload());
        m.put("reviewNotificationPrepared", "PREPARED".equals(b.getReviewNotificationStatus()) || b.getReviewRequestedAt() != null);
        m.put("rating",b.getRating());
        m.put("customerSignedOffAt",b.getCustomerSignedOffAt());
        m.put("customerConfirmed", b.getCustomerSignedOffAt() != null);
        m.put("isCustomerConfirmed", b.getCustomerSignedOffAt() != null);
        m.put("serviceCompletionApproved", b.getCustomerSignedOffAt() != null);
        boolean isActive = !"COMPLETED".equals(b.getJobStatus()) && !"CANCELLED".equals(b.getJobStatus()) && !"FAILED".equals(b.getJobStatus());
        m.put("active", isActive);
        m.put("isActiveEmergency", isActive);
        LocalDateTime now = LocalDateTime.now();
        boolean slaBreached = false;
        boolean slaRisk = false;
        Long slaMinutesRemaining = null;
        Long slaSecondsRemaining = null;
        String slaStage = "WITHIN_SLA";
        String slaStageLabel = "Within SLA";
        
        LocalDateTime targetDeadline = b.getArrivalDueAt();
        if (targetDeadline == null && b.getCreatedAt() != null) {
            targetDeadline = b.getCreatedAt().plusMinutes(30);
        }
        if (targetDeadline == null) {
            targetDeadline = now.plusMinutes(30);
        }
        
        m.put("arrivalDueAt", targetDeadline);
        m.put("slaTargetDeadline", targetDeadline);
        m.put("slaTargetDeadlineFormatted", targetDeadline.format(DateTimeFormatter.ofPattern("hh:mm a")));
        m.put("slaTargetMinutes", 30);
        
        if (b.getReachedAt() != null) {
            if (b.getReachedAt().isAfter(targetDeadline)) {
                slaBreached = true;
                slaRisk = false;
                slaStage = "SLA_BREACHED";
                slaStageLabel = "SLA Breached (Arrived Late)";
            } else {
                slaBreached = false;
                slaRisk = false;
                slaStage = "SLA_MET";
                slaStageLabel = "Within SLA (Arrived On-Time)";
            }
        } else if (isActive) {
            long secondsRemaining = java.time.Duration.between(now, targetDeadline).getSeconds();
            long minutesRemaining = secondsRemaining / 60;
            slaMinutesRemaining = minutesRemaining;
            slaSecondsRemaining = secondsRemaining;
            if (secondsRemaining <= 0) {
                slaBreached = true;
                slaRisk = false;
                slaStage = "SLA_BREACHED";
                slaStageLabel = "SLA Breached";
            } else if (minutesRemaining <= 10 || (("UNASSIGNED".equals(b.getJobStatus()) || "FAILED_ASSIGNMENT".equals(b.getJobStatus())) && b.getCreatedAt() != null && b.getCreatedAt().plusMinutes(15).isBefore(now))) {
                slaBreached = false;
                slaRisk = true;
                slaStage = "APPROACHING_BREACH";
                slaStageLabel = "Approaching SLA Breach";
            } else {
                slaBreached = false;
                slaRisk = false;
                slaStage = "WITHIN_SLA";
                slaStageLabel = "Within SLA";
            }
        } else {
            if ("COMPLETED".equals(b.getJobStatus())) {
                slaStage = "SLA_MET";
                slaStageLabel = "Within SLA (Met)";
            } else {
                slaStage = "CLOSED";
                slaStageLabel = "Closed";
            }
        }
        
        m.put("slaStage", slaStage);
        m.put("slaStageLabel", slaStageLabel);
        m.put("slaBreached", slaBreached);
        m.put("slaRisk", slaRisk);
        m.put("isSlaRiskOrBreached", slaBreached || slaRisk);
        m.put("slaMinutesRemaining", slaMinutesRemaining);
        m.put("slaSecondsRemaining", slaSecondsRemaining);
        m.put("slaOverdueMinutes", (slaMinutesRemaining != null && slaMinutesRemaining < 0) ? Math.abs(slaMinutesRemaining) : 0);
        
        String slaStatusText;
        if ("SLA_BREACHED".equals(slaStage)) {
            slaStatusText = slaMinutesRemaining != null && slaMinutesRemaining < 0 ? ("SLA Breached (" + Math.abs(slaMinutesRemaining) + "m overdue)") : "SLA Breached";
        } else if ("APPROACHING_BREACH".equals(slaStage)) {
            slaStatusText = slaMinutesRemaining != null ? ("Approaching SLA Breach (" + slaMinutesRemaining + "m left)") : "Approaching SLA Breach";
        } else if ("WITHIN_SLA".equals(slaStage)) {
            slaStatusText = slaMinutesRemaining != null ? ("Within SLA (" + slaMinutesRemaining + "m left)") : "Within SLA";
        } else {
            slaStatusText = slaStageLabel;
        }
        m.put("slaStatus", slaStatusText);
        m.put("slaStatusText", slaStatusText);
        m.put("slaWithinSla", "WITHIN_SLA".equals(slaStage) || "SLA_MET".equals(slaStage));
        m.put("slaApproachingBreach", "APPROACHING_BREACH".equals(slaStage));

        // Step 7: Unassigned & Failed Assignment Queue metadata
        long waitingMinutes = 0;
        long waitingSeconds = 0;
        if (b.getCreatedAt() != null) {
            java.time.Duration dur = java.time.Duration.between(b.getCreatedAt(), now);
            waitingMinutes = Math.max(0, dur.toMinutes());
            waitingSeconds = Math.max(0, dur.getSeconds() % 60);
        }
        String timeWaitingFormatted;
        if (waitingMinutes < 1) {
            timeWaitingFormatted = "Just now (< 1m)";
        } else if (waitingMinutes >= 60) {
            timeWaitingFormatted = (waitingMinutes / 60) + "h " + (waitingMinutes % 60) + "m";
        } else {
            timeWaitingFormatted = waitingMinutes + "m";
        }
        m.put("timeWaitingMinutes", waitingMinutes);
        m.put("timeWaitingSeconds", waitingSeconds);
        m.put("timeWaitingFormatted", timeWaitingFormatted);

        String failureReason = b.getDispatchReason();
        if (failureReason == null || failureReason.isBlank()) {
            if ("FAILED_ASSIGNMENT".equals(rawStatus) || "FAILED".equals(rawStatus)) {
                failureReason = "All candidate partners declined or assignment timed out";
            } else if ("UNASSIGNED".equals(rawStatus) || b.getPartnerId() == null) {
                failureReason = hub != null ? ("Awaiting partner match in " + hub.getName()) : "Searching for nearby service partner";
            } else {
                failureReason = "Partner assigned";
            }
        }
        m.put("assignmentFailureReason", failureReason);
        m.put("failureReason", failureReason);

        int possiblePartnersCount = 0;
        if (hub != null) {
            possiblePartnersCount = (int) partners.findByHubId(hub.getId()).stream()
                    .filter(p -> isTradeMatch(p, b.getCategory()))
                    .count();
        }
        m.put("possiblePartnersCount", possiblePartnersCount);
        m.put("possiblePartnersText", possiblePartnersCount > 0 ? (possiblePartnersCount + " partner" + (possiblePartnersCount > 1 ? "s" : "") + " available") : "0 available partners");

        boolean unassignedOrFailed = ("UNASSIGNED".equals(rawStatus) || "FAILED_ASSIGNMENT".equals(rawStatus) || "FAILED".equals(rawStatus) || b.getPartnerId() == null) && !"COMPLETED".equals(rawStatus) && !"CANCELLED".equals(rawStatus);
        m.put("requiresAdminAction", unassignedOrFailed);
        m.put("isUnassignedOrFailed", unassignedOrFailed);

        boolean contactAllowed = a.admin() || owns(a, b) || (assigned(a, b) && b.getAcceptedAt() != null);
        m.put("contactUnlocked", contactAllowed);
        m.put("canCallCustomer", contactAllowed);
        if (contactAllowed) {
            String custName = b.getRequesterName();
            String custPhone = b.getRequesterPhone();
            if ((custName == null || custName.isBlank()) && b.getRequesterId() != null) {
                var cOpt = customers.findById(b.getRequesterId());
                if (cOpt.isPresent()) {
                    custName = cOpt.get().getName();
                    if (custPhone == null || custPhone.isBlank()) custPhone = cOpt.get().getPhone();
                } else {
                    var uOpt = users.findById(b.getRequesterId());
                    if (uOpt.isPresent()) {
                        custName = uOpt.get().getFullName();
                        if (custPhone == null || custPhone.isBlank()) custPhone = uOpt.get().getPhone();
                    }
                }
            }
            if (custName == null || custName.isBlank()) custName = "Resident Requester";
            m.put("requesterName", custName);
            m.put("customer", custName);
            m.put("customerName", custName);
            m.put("requesterPhone", custPhone);
            m.put("phone", custPhone);
            m.put("customerPhone", custPhone);
            m.put("serviceAddress", b.getServiceAddress());
            m.put("address", b.getServiceAddress());
        } else {
            m.put("requesterName", null);
            m.put("customer", null);
            m.put("customerName", null);
            m.put("requesterPhone", null);
            m.put("phone", null);
            m.put("customerPhone", null);
            m.put("serviceAddress", null);
            m.put("address", null);
        }
        return m;
    }
    public void transition(Actor a,Long id,String action) {
        transition(a, id, action, null, null, null);
    }
    public void transition(Actor a,Long id,String action,Double lat,Double lon) {
        transition(a, id, action, lat, lon, null);
    }
    public void transition(Actor a,Long id,String action,Double lat,Double lon,String notes) {
        EmergencyMaintenanceBooking b=locked(id);if(!assigned(a,b))throw error(403,"Only the assigned partner can update this job");
        String s=b.getJobStatus();LocalDateTime now=LocalDateTime.now();
        if ("COMPLETED".equals(s) || "CANCELLED".equals(s)) {
            throw error(409, "A completed or cancelled job cannot return to an active state; current status is " + s);
        }
        switch(action) {
            case "ACCEPT" -> {
                expect(s,"OFFERED");
                // Guard against duplicate acceptance (race condition)
                if(b.getAcceptedAt()!=null) throw error(409,"Booking already accepted by another partner");
                if(b.getOfferedAt().plusSeconds(offerTimeoutSeconds).isBefore(now)) {
                    recordAudit(b, "TIMED_OUT", b.getPartnerId(), "Partner response timed out after " + offerTimeoutSeconds + " seconds without response", null);
                    release(b);
                    b.setDeclinedPartnerIds(b.getDeclinedPartnerIds() + b.getPartnerId() + ",");
                    dispatch(b, true);
                    throw error(409,"Offer expired. Refresh your jobs");
                }
                b.setJobStatus("ACCEPTED");
                b.setAcceptedAt(now);
                b.setArrivalDueAt(now.plusMinutes(30));
                b.setDispatchReason("Partner accepted; arrival target 30 minutes");
                recordAudit(b, "ACCEPTED", b.getPartnerId(), "Partner accepted emergency assignment; target arrival 30 minutes", a.id());
            }
            case "DECLINE" -> {
                expect(s,"OFFERED");
                recordAudit(b, "DECLINED", b.getPartnerId(), "Partner declined emergency assignment offer", a.id());
                release(b);
                b.setDeclinedPartnerIds(b.getDeclinedPartnerIds()+b.getPartnerId()+",");
                dispatch(b, false);
            }
            case "CALL_CUSTOMER" -> {
                if (b.getAcceptedAt() == null || !Set.of("ACCEPTED", "ASSIGNED", "REACHED_LOCATION", "PHOTO_START", "IN_PROGRESS").contains(s)) {
                    throw error(403, "Customer contact details and calling are only permitted after job acceptance");
                }
                recordAudit(b, "CALL_CUSTOMER", b.getPartnerId(), "Partner initiated call to customer", a.id());
            }
            case "REACHED", "REACHED_LOCATION" -> {
                if (!"ACCEPTED".equals(s) && !"ASSIGNED".equals(s)) {
                    throw error(409, "This action requires ACCEPTED or ASSIGNED; current status is " + s);
                }
                b.setJobStatus("REACHED_LOCATION");
                b.setReachedAt(now);
                b.setDispatchReason("Partner reached location; awaiting start photo");

                // Update partner location if GPS provided
                MaintenancePartner p = b.getPartnerId() != null ? partners.findById(b.getPartnerId()).orElse(null) : null;
                if (lat != null && lon != null && p != null) {
                    p.setLatitude(lat);
                    p.setLongitude(lon);
                    p.setLocationUpdatedAt(now);
                    partners.save(p);
                }
                Double pLat = (lat != null) ? lat : (p != null ? p.getLatitude() : null);
                Double pLon = (lon != null) ? lon : (p != null ? p.getLongitude() : null);

                String geoDetails;
                if (b.getLatitude() != null && b.getLongitude() != null && pLat != null && pLon != null) {
                    double distKm = distance(b.getLatitude(), b.getLongitude(), pLat, pLon);
                    double roundedDist = Math.round(distKm * 100) / 100.0;
                    boolean verified = distKm <= geofenceArrivalRadiusKm;
                    b.setArrivalDistanceKm(roundedDist);
                    b.setArrivalGeofenceVerified(verified);
                    if (enforceGeofence && !verified) {
                        throw error(409, "Partner is outside the arrival geofence (" + roundedDist + " km away, maximum allowed is " + geofenceArrivalRadiusKm + " km)");
                    }
                    geoDetails = "Partner reached service location. Proximity: " + roundedDist + " km (Geofence verified: " + verified + ")";
                } else {
                    b.setArrivalGeofenceVerified(null);
                    geoDetails = "Partner reached service location (GPS proximity not available)";
                }

                recordAudit(b, "REACHED_LOCATION", b.getPartnerId(), geoDetails, a.id());
                if (b.getRequesterId() != null) {
                    try {
                        Notification n = new Notification();
                        n.setUserId(b.getRequesterId());
                        n.setType("SERVICE_PARTNER_ARRIVED");
                        n.setTitle("Service partner has arrived");
                        n.setMessage("Your service partner has arrived at your premises for " + (b.getOrderReference() != null ? b.getOrderReference() : b.getBookingReference()) + ".");
                        n.setReadStatus(false);
                        notifications.save(n);
                    } catch (Exception ignored) {
                        // Notification delivery is best-effort; the lifecycle transition remains authoritative.
                    }
                }
            }
            case "START", "START_WORK", "IN_PROGRESS" -> {
                expect(s, "PHOTO_START");
                if (b.getBeforePhoto() == null) throw error(409, "Before photo is required");
                b.setJobStatus("IN_PROGRESS");
                b.setStartedAt(now);
                if (b.getEstimatedDurationMinutes() == null || b.getEstimatedDurationMinutes() <= 0) {
                    b.setEstimatedDurationMinutes(defaultWorkEstimateMinutes(b.getCategory()));
                }
                b.setEstimatedCompletionAt(now.plusMinutes(b.getEstimatedDurationMinutes()));
                b.setDispatchReason("Service in progress; estimated completion " + b.getEstimatedCompletionAt());
                recordAudit(b, "IN_PROGRESS", b.getPartnerId(), "Partner started service work", a.id());
            }
            case "COMPLETE", "COMPLETED" -> {
                expect(s, "IN_PROGRESS");
                if (b.getBeforePhoto() == null) throw error(409, "Before photo is missing; required before completion");
                if (b.getAfterPhoto() == null) throw error(409, "Upload an after photo before completion");
                if (b.getPartnerId() == null) throw error(409, "Assigned partner required to complete");
                if (b.getStartedAt() == null) throw error(409, "Job must have a recorded start time before completion");
                b.setJobStatus("COMPLETED");
                b.setCompletedAt(now);
                b.setReviewRequestedAt(now);
                if (notes != null && !notes.isBlank()) {
                    b.setCompletionNotes(notes.trim());
                }
                b.setDispatchReason("Completed; awaiting customer sign-off and review");
                String auditDetail = "Job completed; partner released to IDLE" + (b.getCompletionNotes() != null ? " | Notes: " + b.getCompletionNotes() : "");
                recordAudit(b, "COMPLETED", b.getPartnerId(), auditDetail, a.id());
                release(b);
                triggerCustomerReviewRequest(b, a.id());
            }
            default -> throw error(400,"Unknown job action");
        }
        bookings.save(b);
        broadcastEvent(b.getId(), b.getJobStatus(), action, b.getPartnerId(), "Booking transitioned: " + action);
    }
    public void photo(Actor a,Long id,String kind,byte[] bytes) {
        photo(a, id, kind, bytes, null, null);
    }
    public void photo(Actor a,Long id,String kind,byte[] bytes,Double latitude,Double longitude) {
        coordinates(latitude, longitude);
        EmergencyMaintenanceBooking b=locked(id);
        if(!assigned(a,b)) throw error(403,"Only the assigned partner can upload evidence");
        String s = b.getJobStatus();
        if ("COMPLETED".equals(s) || "CANCELLED".equals(s)) {
            throw error(409, "A completed or cancelled job cannot receive photo updates; current status is " + s);
        }
        if(bytes == null || bytes.length == 0) throw error(400,"Photo data is required");
        if("before".equalsIgnoreCase(kind)){
            expect(b.getJobStatus(),"REACHED_LOCATION");
            b.setBeforePhoto(bytes);
            b.setBeforePhotoUrl("/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/before");
            MaintenancePartner proofPartner = b.getPartnerId() != null ? partners.findById(b.getPartnerId()).orElse(null) : null;
            Double proofLat = latitude != null ? latitude : (proofPartner != null ? proofPartner.getLatitude() : b.getLatitude());
            Double proofLon = longitude != null ? longitude : (proofPartner != null ? proofPartner.getLongitude() : b.getLongitude());
            b.setBeforePhotoLatitude(proofLat);
            b.setBeforePhotoLongitude(proofLon);
            b.setPhotoStartAt(LocalDateTime.now());
            b.setJobStatus("PHOTO_START");
            b.setDispatchReason("Before photo uploaded; condition verified and ready for work");
            recordAudit(b, "BEFORE_PHOTO_UPLOADED", b.getPartnerId(), "Before photo uploaded (" + bytes.length + " bytes) - existing damage documented prior to start", a.id());
            bookings.save(b);
            broadcastEvent(b.getId(), b.getJobStatus(), "PHOTO_START", b.getPartnerId(), "Before photo uploaded and verified");
        } else if("after".equalsIgnoreCase(kind)){
            expect(b.getJobStatus(),"IN_PROGRESS");
            b.setAfterPhoto(bytes);
            b.setAfterPhotoUrl("/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/after");
            MaintenancePartner proofPartner = b.getPartnerId() != null ? partners.findById(b.getPartnerId()).orElse(null) : null;
            Double proofLat = latitude != null ? latitude : (proofPartner != null ? proofPartner.getLatitude() : b.getLatitude());
            Double proofLon = longitude != null ? longitude : (proofPartner != null ? proofPartner.getLongitude() : b.getLongitude());
            b.setAfterPhotoLatitude(proofLat);
            b.setAfterPhotoLongitude(proofLon);
            b.setPhotoEndAt(LocalDateTime.now());
            recordAudit(b, "AFTER_PHOTO_UPLOADED", b.getPartnerId(), "After photo uploaded (" + bytes.length + " bytes) - completion evidence documented", a.id());
            bookings.save(b);
            broadcastEvent(b.getId(), b.getJobStatus(), "PHOTO_AFTER", b.getPartnerId(), "Completion photo uploaded");
        } else {
            throw error(400,"Photo must be before or after");
        }
    }
    public void confirm(Actor a, Long id, String notes) {
        EmergencyMaintenanceBooking b = locked(id);
        if (!owns(a, b)) throw error(403, "Only the booking customer can confirm service completion");
        expect(b.getJobStatus(), "COMPLETED");
        if (b.getCustomerSignedOffAt() != null) throw error(409, "Customer confirmation already recorded");
        b.setCustomerSignedOffAt(LocalDateTime.now());
        String auditDetail = "Customer confirmed service completion" + (notes != null && !notes.isBlank() ? ": " + notes.trim() : "");
        recordAudit(b, "CUSTOMER_CONFIRMED", b.getPartnerId(), auditDetail, a.id());
        bookings.save(b);
        broadcastEvent(b.getId(), b.getJobStatus(), "CUSTOMER_CONFIRMED", b.getPartnerId(), "Customer confirmed service completion");
    }
    public void review(Actor a,Long id,int rating,String text) {
        EmergencyMaintenanceBooking b=locked(id);if(!owns(a,b))throw error(403,"Only the booking customer can sign off");expect(b.getJobStatus(),"COMPLETED");
        if(b.getRating()!=null)throw error(409,"Review already submitted");if(rating<1||rating>5)throw error(400,"Rating must be 1 to 5");
        b.setRating(rating);b.setReview(text);b.setCustomerSignedOffAt(LocalDateTime.now());
        recordAudit(b, "CUSTOMER_SIGNED_OFF", b.getPartnerId(), "Customer signed off with rating " + rating + "/5", a.id());
        bookings.save(b);
        recalculatePartnerRating(b.getPartnerId());
        broadcastEvent(b.getId(), b.getJobStatus(), "CUSTOMER_SIGNED_OFF", b.getPartnerId(), "Customer submitted sign-off & review");
    }
    private void release(EmergencyMaintenanceBooking b) {
        if(b.getPartnerId()!=null) partners.lockById(b.getPartnerId()).ifPresent(p->{
            p.setAvailability("IDLE");
            p.setWorkState("IDLE");
            partners.save(p);
        });
    }
    private void expect(String actual,String required) {if(!required.equals(actual))throw error(409,"This action requires "+required+"; current status is "+actual);}
    public void retryPending() {
        for(EmergencyMaintenanceBooking item:bookings.findByJobStatusIn(List.of("OFFERED","UNASSIGNED","FAILED_ASSIGNMENT"))) {
            try {
                EmergencyMaintenanceBooking b=locked(item.getId());
                if("OFFERED".equals(b.getJobStatus()) && b.getOfferedAt() != null && b.getOfferedAt().isBefore(LocalDateTime.now().minusSeconds(offerTimeoutSeconds))) {
                    recordAudit(b, "TIMED_OUT", b.getPartnerId(), "Partner response timed out after " + offerTimeoutSeconds + " seconds without response", null);
                    Long expiredPartnerId = b.getPartnerId();
                    release(b);
                    if (expiredPartnerId != null && !b.getDeclinedPartnerIds().contains("," + expiredPartnerId + ",")) {
                        b.setDeclinedPartnerIds(b.getDeclinedPartnerIds()+expiredPartnerId+",");
                    }
                    dispatch(b, true);
                } else if("UNASSIGNED".equals(b.getJobStatus())) {
                    dispatch(b, false);
                } else if ("FAILED_ASSIGNMENT".equals(b.getJobStatus()) && b.getEscalatedAt() == null) {
                    int cycle = b.getDispatchCycleCount() == null ? 1 : b.getDispatchCycleCount();
                    if (cycle < Math.max(1, maxDispatchCycles)) {
                        b.setDispatchCycleCount(cycle + 1);
                        b.setDeclinedPartnerIds(",");
                        b.setPartnerId(null);
                        b.setJobStatus("UNASSIGNED");
                        b.setDispatchReason("PENDING_DISPATCH: starting automatic dispatch cycle " + b.getDispatchCycleCount());
                        recordAudit(b, "DISPATCH_CYCLE_RETRY", null, "Starting automatic dispatch cycle " + b.getDispatchCycleCount(), null);
                        bookings.save(b);
                        dispatch(b, false);
                    }
                }
            } catch (ObjectOptimisticLockingFailureException ignored) {
                // A foreground request updated this booking first; the next scheduler tick will re-read it.
            }
        }
    }
    public void adminAssignPartner(Actor a, Long bookingId, Long partnerId) {
        admin(a);
        EmergencyMaintenanceBooking b = locked(bookingId);
        Set<String> reassignableStates = Set.of("FAILED_ASSIGNMENT", "UNASSIGNED", "OFFERED", "ASSIGNED", "ACCEPTED", "EN_ROUTE");
        if (!reassignableStates.contains(b.getJobStatus()))
            throw error(409, "This order can only be reassigned before on-site work/proof capture begins");
        Long previousPartnerId = b.getPartnerId();
        if (previousPartnerId != null && !previousPartnerId.equals(partnerId)) {
            // Release the previously offered/assigned partner before applying an admin override.
            release(b);
        }
        MaintenancePartner p = partners.lockById(partnerId).orElseThrow(() -> error(404, "Partner not found"));
        if (users.findById(p.getUserId()).map(AppUser::isAccountLocked).orElse(true))
            throw error(409, "Partner account is locked or disabled");
        if (!p.isOnDuty())
            throw error(409, "Partner is currently off-duty and cannot receive assignments");
        long otherActiveJobs = bookings.findByPartnerIdAndJobStatusIn(p.getId(), ACTIVE_EMERGENCY_STATES).stream()
                .filter(existing -> !Objects.equals(existing.getId(), b.getId()))
                .count();
        if (otherActiveJobs > 0)
            throw error(409, "Partner already owns an active emergency order; overlapping assignments are not allowed");
        MaintenanceHub h = p.getHubId() != null ? hubs.findById(p.getHubId()).orElse(null) : null;
        if (h == null)
            throw error(404, "Hub not found for this partner");
        if (!h.isActive() || !"ACTIVE".equalsIgnoreCase(h.getStatus()))
            throw error(409, "Cannot assign partner belonging to an inactive hub");
        if (!isTradeMatch(p, b.getCategory()))
            throw error(409, "Partner trade does not match booking category");
        // Mark partner as busy and assign booking
        p.setAvailability("BUSY");
        p.setWorkState("BUSY");
        b.setPartnerId(p.getId());
        b.setHubId(h.getId());
        b.setJobStatus("ASSIGNED");
        b.setAssignmentType("Manual");
        b.setAssignedBy(a.name() != null ? a.name() : "Admin");
        LocalDateTime now = LocalDateTime.now();
        b.setAssignedAt(now);
        b.setAcceptedAt(now);
        b.setArrivalDueAt(now.plusMinutes(30));
        b.setDispatchReason("Manually assigned by admin (" + b.getAssignedBy() + ")");
        b.setEscalatedAt(null);
        b.setEscalationReason(null);
        recordAudit(b, "MANUALLY_ASSIGNED", p.getId(), "Manually assigned by " + b.getAssignedBy() + " (Assignment Type: Manual)", a.id());
        partners.save(p);
        bookings.save(b);

        if (complaints != null) {
            try {
                complaints.findByTenantIdOrderByCreatedAtDesc(b.getTenantId()).stream()
                    .filter(c -> "OPEN".equalsIgnoreCase(c.getStatus()) || c.getAssignedTo() == null || c.getAssignedTo().isBlank())
                    .filter(c -> (b.getUnitNumber() != null && c.getLocationDetails() != null && c.getLocationDetails().contains(b.getUnitNumber()))
                              || (c.getDescription() != null && b.getDescription() != null && b.getDescription().contains(c.getDescription()))
                              || (c.getReporterPhone() != null && c.getReporterPhone().equals(b.getRequesterPhone())))
                    .findFirst()
                    .ifPresent(c -> {
                        c.setAssignedTo(p.getPartnerName());
                        c.setStatus("ASSIGNED");
                        c.setResolutionNotes("Manually assigned by Maintenance Team Leader to " + p.getPartnerName() + " (" + p.getTrade() + ")");
                        complaints.save(c);
                    });
            } catch (Exception ignored) {}
        }

        if (tickets != null) {
            try {
                tickets.findAll().stream()
                    .filter(t -> Objects.equals(t.getRequesterPhone(), b.getRequesterPhone()) || (b.getUnitNumber() != null && t.getServiceAddress() != null && t.getServiceAddress().contains(b.getUnitNumber())))
                    .filter(t -> !"COMPLETED".equalsIgnoreCase(t.getTicketStatus()))
                    .findFirst()
                    .ifPresent(t -> {
                        t.setTicketStatus("ASSIGNED");
                        t.setVendorId(p.getUserId());
                        t.setVendorName(p.getPartnerName());
                        t.setVendorNotes("Manually assigned by Maintenance Team Leader to " + p.getPartnerName());
                        t.setAssignedAt(now);
                        tickets.save(t);
                    });
            } catch (Exception ignored) {}
        }

        broadcastEvent(b.getId(), b.getJobStatus(), "MANUALLY_ASSIGNED", p.getId(), "Admin manually assigned partner " + p.getId());
    }

    public List<Map<String, Object>> candidatePartnersForBooking(Actor a, Long bookingId) {
        admin(a);
        EmergencyMaintenanceBooking b = locked(bookingId);
        MaintenanceHub resolvedHub = b.getHubId() != null ? hubs.findById(b.getHubId()).orElse(null) : resolveHub(b.getCity(), b.getArea(), b.getLatitude(), b.getLongitude());

        return partners.findAll().stream()
                .filter(p -> p.getHubId() != null)
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("partnerId", p.getId());
                    m.put("id", p.getId());
                    final String[] pName = { p.getName() != null && !p.getName().isBlank() ? p.getName() : null };
                    final String[] pPhone = { p.getPhone() != null && !p.getPhone().isBlank() ? p.getPhone() : null };
                    users.findById(p.getUserId()).ifPresent(u -> {
                        if (pName[0] == null) pName[0] = u.getFullName();
                        if (pPhone[0] == null) pPhone[0] = u.getPhone();
                    });
                    String resolvedName = pName[0] != null ? pName[0] : ("Partner #" + p.getId());
                    m.put("name", resolvedName);
                    m.put("partnerName", resolvedName);
                    m.put("phone", pPhone[0] != null ? pPhone[0] : "");

                    m.put("trade", p.getTrade() != null ? p.getTrade() : "General Maintenance");
                    m.put("skillCategories", p.getSkillCategories());
                    MaintenanceHub h = hubs.findById(p.getHubId()).orElse(null);
                    m.put("hubId", p.getHubId());
                    String hubLabel = h != null ? (h.getName() != null && !h.getName().isBlank() ? h.getName() : h.getCity() + " Hub (" + (h.getArea() != null ? h.getArea() : "Main") + ")") : ("Hub #" + p.getHubId());
                    m.put("hubName", hubLabel);
                    m.put("hub", hubLabel);
                    m.put("hubCity", h != null ? h.getCity() : null);
                    m.put("hubArea", h != null ? h.getArea() : null);

                    double dist = partnerDistance(p, b, resolvedHub != null ? resolvedHub : h);
                    m.put("distanceKm", dist == Double.MAX_VALUE ? null : Math.round(dist * 10) / 10.0);
                    m.put("distance", dist == Double.MAX_VALUE ? "Within hub zone" : (Math.round(dist * 10) / 10.0) + " km");

                    m.put("employmentType", p.getEmploymentType() != null ? p.getEmploymentType() : "IN_HOUSE");
                    m.put("onDuty", p.isOnDuty());
                    m.put("dutyStatus", p.isOnDuty() ? "On Duty" : "Off Duty");
                    String ws = p.getWorkState() != null ? p.getWorkState() : p.getAvailability();
                    m.put("workState", ws != null ? ws : "IDLE");
                    m.put("workStatus", ws != null ? ws : "IDLE");
                    String currAvail = p.getAvailability() != null ? p.getAvailability() : (p.isOnDuty() ? ("IDLE".equalsIgnoreCase(ws) ? "Available" : ws) : "Unavailable");
                    m.put("currentAvailability", currAvail);
                    m.put("availability", currAvail);
                    m.put("company", p.getCompany());

                    boolean tradeMatch = isTradeMatch(p, b.getCategory());
                    boolean hubMatch = resolvedHub != null && p.getHubId().equals(resolvedHub.getId());
                    boolean activeUser = users.findById(p.getUserId()).map(u -> !u.isAccountLocked()).orElse(false);
                    long activeJobs = activeJobCount(p.getId());
                    m.put("activeJobCount", activeJobs);
                    m.put("tradeMatch", tradeMatch);
                    m.put("hubMatch", hubMatch);
                    m.put("eligible", tradeMatch && p.isOnDuty() && "IDLE".equalsIgnoreCase(ws) && activeUser && activeJobs == 0);

                    return m;
                })
                .sorted(Comparator.comparing((Map<String, Object> m) -> Boolean.TRUE.equals(m.get("eligible")) ? 0 : 1)
                        .thenComparing(m -> Boolean.TRUE.equals(m.get("tradeMatch")) ? 0 : 1)
                        .thenComparing(m -> Boolean.TRUE.equals(m.get("onDuty")) ? 0 : 1)
                        .thenComparing(m -> (Double) (m.get("distanceKm") != null ? m.get("distanceKm") : 99999.0)))
                .toList();
    }

    public void moveToFailedQueue(EmergencyMaintenanceBooking b) {
        moveToFailedQueue(b, "No eligible partners; requires admin manual assignment");
    }

    public void moveToFailedQueue(EmergencyMaintenanceBooking b, String reason) {
        int cycle = b.getDispatchCycleCount() == null ? 1 : Math.max(1, b.getDispatchCycleCount());
        b.setJobStatus("FAILED_ASSIGNMENT");
        if (cycle >= Math.max(1, maxDispatchCycles)) {
            b.setEscalatedAt(LocalDateTime.now());
            b.setEscalationReason(reason);
            b.setDispatchReason("UNASSIGNED_ESCALATED: " + reason);
            recordAudit(b, "UNASSIGNED_ESCALATED", null, "Auto-assignment exhausted after " + cycle + " dispatch cycle(s): " + reason, null);
            broadcastEvent(b.getId(), "UNASSIGNED_ESCALATED", "UNASSIGNED_ESCALATED", null, "Manual admin override / third-party escalation required");
        } else {
            b.setDispatchReason("Dispatch cycle " + cycle + " exhausted: " + reason + ". Automatic retry cycle scheduled.");
            recordAudit(b, "FAILED_ASSIGNMENT", null, "Dispatch cycle " + cycle + " exhausted: " + reason, null);
            broadcastEvent(b.getId(), b.getJobStatus(), "FAILED_ASSIGNMENT", null, "Dispatch cycle " + cycle + " exhausted; retry scheduled");
        }
        bookings.save(b);
    }

    public List<Map<String, Object>> listFailed(Actor a) {
        admin(a);
        return bookings.findAll().stream()
                .filter(b -> "FAILED_ASSIGNMENT".equals(b.getJobStatus()) || "UNASSIGNED".equals(b.getJobStatus()))
                .sorted(Comparator.comparing(EmergencyMaintenanceBooking::getId).reversed())
                .map(b -> view(a, b))
                .toList();
    }

    private void recordAudit(EmergencyMaintenanceBooking b, String action, Long partnerId, String details, Long actorUserId) {
        String partnerName = partnerId != null ? partners.findById(partnerId).map(p -> p.getName() != null && !p.getName().isBlank() ? p.getName() : "Partner #" + p.getId()).orElse("Partner #" + partnerId) : "None";
        String timeStr = LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String entry = String.format("[%s] %s: Partner=%s (ID: %s) - %s", timeStr, action, partnerName, partnerId != null ? partnerId : "N/A", details);

        String currentLog = b.getAssignmentAuditLog() != null ? b.getAssignmentAuditLog() : "";
        b.setAssignmentAuditLog(currentLog + (currentLog.isEmpty() ? "" : "\n") + entry);

        try {
            AuditLog al = new AuditLog();
            al.setTenantId(b.getTenantId() != null ? b.getTenantId() : "system");
            al.setUserId(actorUserId != null ? actorUserId : (partnerId != null ? partners.findById(partnerId).map(MaintenancePartner::getUserId).orElse(0L) : 0L));
            al.setModule("EMERGENCY_DISPATCH");
            al.setAction(action);
            al.setDetails("Booking " + (b.getOrderReference() != null ? b.getOrderReference() : (b.getBookingReference() != null ? b.getBookingReference() : "ID:" + b.getId())) + " (" + b.getCategory() + "): " + entry);
            auditLogs.save(al);
        } catch (Exception ignored) {
            // Best effort persistence in audit_logs
        }
    }

    public List<Map<String, Object>> history(Actor a, Long id) {
        EmergencyMaintenanceBooking b = readable(a, id);
        List<Map<String, Object>> list = new ArrayList<>();
        if (b.getAssignmentAuditLog() != null && !b.getAssignmentAuditLog().isBlank()) {
            for (String line : b.getAssignmentAuditLog().split("\n")) {
                if (line.isBlank()) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("raw", line);
                if (line.startsWith("[") && line.contains("] ")) {
                    int endBracket = line.indexOf("] ");
                    item.put("timestamp", line.substring(1, endBracket));
                    String rest = line.substring(endBracket + 2);
                    int colon = rest.indexOf(": ");
                    if (colon > 0) {
                        item.put("action", rest.substring(0, colon));
                        item.put("details", rest.substring(colon + 2));
                    }
                }
                list.add(item);
            }
        }
        return list;
    }

    public void broadcastEvent(Long bookingId, String status, String action, Long partnerId, String details) {
        DispatchEvent ev = new DispatchEvent(bookingId, status, action, partnerId, details, System.currentTimeMillis());
        recentEventsQueue.addLast(ev);
        while (recentEventsQueue.size() > 100) {
            recentEventsQueue.pollFirst();
        }
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("dispatch").data(ev));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
        var scoped = orderEmitters.get(bookingId);
        if (scoped != null) {
            for (SseEmitter emitter : scoped) {
                try {
                    emitter.send(SseEmitter.event().name("order").data(ev));
                } catch (Exception e) {
                    scoped.remove(emitter);
                }
            }
            if (scoped.isEmpty()) orderEmitters.remove(bookingId);
        }
    }

    public SseEmitter subscribe(Actor a) {
        SseEmitter emitter = new SseEmitter(180_000L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("message", "Subscribed to emergency dispatch events", "timestamp", System.currentTimeMillis())));
        } catch (Exception e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    public SseEmitter subscribeOrder(Actor a, String identifier) {
        EmergencyMaintenanceBooking b = workflowReadable(a, identifier);
        SseEmitter emitter = new SseEmitter(180_000L);
        CopyOnWriteArrayList<SseEmitter> scoped = orderEmitters.computeIfAbsent(b.getId(), key -> new CopyOnWriteArrayList<>());
        scoped.add(emitter);
        Runnable cleanup = () -> {
            scoped.remove(emitter);
            if (scoped.isEmpty()) orderEmitters.remove(b.getId());
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("orderId", b.getOrderReference(), "timestamp", System.currentTimeMillis())));
        } catch (Exception e) { cleanup.run(); }
        return emitter;
    }

    public SseEmitter subscribeAdmin(Actor a) {
        admin(a);
        return subscribe(a);
    }

    public List<DispatchEvent> recentEvents(long since) {
        return recentEventsQueue.stream()
                .filter(ev -> ev.timestamp() > since)
                .toList();
    }

    public List<Map<String, Object>> buildTimeline(EmergencyMaintenanceBooking b) {
        List<Map<String, Object>> list = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        // 1. Accepted — timestamp
        list.add(timelineEntry("ACCEPTED", "Accepted", b.getAcceptedAt(), fmt,
                "Partner accepted assignment", b.getAcceptedAt() != null));

        // 2. Reached Location — timestamp
        list.add(timelineEntry("REACHED_LOCATION", "Reached Location", b.getReachedAt(), fmt,
                "Partner arrived at service location", b.getReachedAt() != null));

        // 3. Before Photo — timestamp
        list.add(timelineEntry("BEFORE_PHOTO", "Before Photo", b.getPhotoStartAt(), fmt,
                "Mandatory pre-work condition photo uploaded", b.getPhotoStartAt() != null));

        // 4. In Progress — timestamp
        list.add(timelineEntry("IN_PROGRESS", "In Progress", b.getStartedAt(), fmt,
                "Emergency maintenance service in progress", b.getStartedAt() != null));

        // 5. Completed — timestamp
        list.add(timelineEntry("COMPLETED", "Completed", b.getCompletedAt(), fmt,
                "Service completed by partner", b.getCompletedAt() != null));

        // Optional After Photo & Customer Sign-off
        if (b.getPhotoEndAt() != null) {
            list.add(timelineEntry("AFTER_PHOTO", "After Photo", b.getPhotoEndAt(), fmt,
                    "Completion proof photo uploaded", true));
        }
        if (b.getReviewLinkSentAt() != null || b.getReviewRequestedAt() != null) {
            LocalDateTime sentAt = b.getReviewLinkSentAt() != null ? b.getReviewLinkSentAt() : b.getReviewRequestedAt();
            list.add(timelineEntry("REVIEW_LINK_SENT", "Review Link Sent", sentAt, fmt,
                    "Resident feedback request dispatched", true));
        }
        if (b.getCustomerSignedOffAt() != null) {
            list.add(timelineEntry("CUSTOMER_CONFIRMED", "Customer Confirmed", b.getCustomerSignedOffAt(), fmt,
                    "Customer verified and approved service completion", true));
        }

        return list;
    }

    private Map<String, Object> timelineEntry(String stage, String title, LocalDateTime time, DateTimeFormatter fmt, String desc, boolean completed) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("stage", stage);
        map.put("title", title);
        map.put("name", title);
        map.put("timestamp", time);
        map.put("formattedTime", time != null ? time.format(fmt) : null);
        map.put("completed", completed);
        map.put("description", desc);
        return map;
    }

    public List<Map<String, Object>> timeline(Actor a, Long id) {
        return buildTimeline(readable(a, id));
    }

    private void triggerCustomerReviewRequest(EmergencyMaintenanceBooking b, Long actorUserId) {
        String ref = b.getOrderReference() != null ? b.getOrderReference() : (b.getBookingReference() != null ? b.getBookingReference() : ("EMG-" + String.format(Locale.ROOT, "%05d", b.getId())));
        if (b.getFeedbackToken() == null || b.getFeedbackToken().isBlank()) b.setFeedbackToken(UUID.randomUUID().toString());
        String reviewUrl = "/feedback/" + ref + "?token=" + b.getFeedbackToken();
        b.setCustomerReviewUrl(reviewUrl);
        b.setReviewNotificationChannels("IN_APP,SMS,WHATSAPP,PUSH");
        b.setReviewNotificationStatus("PREPARED");

        String partnerName = b.getPartnerId() != null ? partners.findById(b.getPartnerId())
                .map(p -> p.getName() != null && !p.getName().isBlank() ? p.getName() : "Technician #" + p.getId())
                .orElse("Assigned Partner") : "Assigned Partner";

        String reviewMsg = String.format(
                "Your emergency maintenance request %s (%s) has been completed by %s. Please review and rate your service: %s",
                ref, b.getCategory() != null ? b.getCategory() : "Service", partnerName, reviewUrl
        );

        String payload = String.format(Locale.ROOT,
                "{\"bookingReference\":\"%s\",\"bookingId\":%d,\"customer\":\"%s\",\"phone\":\"%s\",\"category\":\"%s\",\"partner\":\"%s\",\"reviewUrl\":\"%s\",\"message\":\"%s\",\"channels\":[\"IN_APP\",\"SMS\",\"WHATSAPP\",\"PUSH\"],\"status\":\"PREPARED\"}",
                ref, b.getId(),
                b.getRequesterName() != null ? b.getRequesterName() : "Customer",
                b.getRequesterPhone() != null ? b.getRequesterPhone() : "",
                b.getCategory() != null ? b.getCategory() : "Emergency",
                partnerName,
                reviewUrl,
                reviewMsg.replace("\"", "\\\"")
        );
        b.setReviewRequestPayload(payload);

        // Deliver to in-app notification repository if requester has user account
        if (b.getRequesterId() != null) {
            try {
                Notification n = new Notification();
                n.setUserId(b.getRequesterId());
                n.setType("REVIEW_REQUEST");
                n.setTitle("Rate Service: " + ref + " (" + (b.getCategory() != null ? b.getCategory() : "Emergency") + ")");
                n.setMessage(reviewMsg);
                n.setReadStatus(false);
                notifications.save(n);
                b.setReviewLinkSentAt(LocalDateTime.now());
                b.setReviewNotificationStatus("SENT");
            } catch (Exception ignored) {
                // Best effort in-app notification; external channels can consume the prepared payload.
            }
        }

        recordAudit(b, "REVIEW_REQUEST_PREPARED", b.getPartnerId(),
                "Customer review request prepared for " + ref + " across channels [IN_APP, SMS, WHATSAPP, PUSH]", actorUserId);
        broadcastEvent(b.getId(), b.getJobStatus(), "REVIEW_REQUEST_PREPARED", b.getPartnerId(),
                "Customer review request prepared for booking " + ref);
    }

    public Map<String, Object> resendReviewLink(Actor a, Long id) {
        admin(a);
        EmergencyMaintenanceBooking b = locked(id);
        expect(b.getJobStatus(), "COMPLETED");
        if (b.getCustomerReviewUrl() == null || b.getCustomerReviewUrl().isBlank() || b.getFeedbackToken() == null || !b.getCustomerReviewUrl().startsWith("/feedback/")) {
            triggerCustomerReviewRequest(b, a.id());
        } else {
            b.setReviewRequestedAt(LocalDateTime.now());
            b.setReviewLinkSentAt(LocalDateTime.now());
            b.setReviewNotificationStatus("SENT");
            if (b.getRequesterId() != null) {
                Notification n = new Notification();
                n.setUserId(b.getRequesterId());
                n.setType("REVIEW_REQUEST");
                n.setTitle("Please rate your maintenance service");
                n.setMessage("Please review " + (b.getOrderReference() != null ? b.getOrderReference() : b.getBookingReference()) + ": " + b.getCustomerReviewUrl());
                n.setReadStatus(false);
                notifications.save(n);
            }
            recordAudit(b, "REVIEW_LINK_RESENT", b.getPartnerId(), "Maintenance admin manually resent the resident review link", a.id());
            broadcastEvent(b.getId(), b.getJobStatus(), "REVIEW_LINK_RESENT", b.getPartnerId(), "Resident review link resent by maintenance admin");
        }
        bookings.save(b);
        return reviewRequest(a, id);
    }

    public Map<String, Object> reviewRequest(Actor a, Long id) {
        EmergencyMaintenanceBooking b = readable(a, id);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bookingId", b.getId());
        m.put("bookingReference", b.getBookingReference());
        m.put("orderReference", b.getOrderReference());
        m.put("customerName", b.getRequesterName());
        m.put("customerPhone", b.getRequesterPhone());
        m.put("category", b.getCategory());
        m.put("jobStatus", b.getJobStatus());
        m.put("reviewRequestedAt", b.getReviewRequestedAt());
        m.put("reviewLinkSentAt", b.getReviewLinkSentAt());
        m.put("customerReviewUrl", b.getCustomerReviewUrl());
        m.put("channels", b.getReviewNotificationChannels() != null ? Arrays.asList(b.getReviewNotificationChannels().split(",")) : List.of("IN_APP", "SMS", "WHATSAPP", "PUSH"));
        m.put("status", b.getReviewNotificationStatus() != null ? b.getReviewNotificationStatus() : "PREPARED");
        m.put("payload", b.getReviewRequestPayload());
        m.put("rating", b.getRating());
        m.put("review", b.getReview());
        m.put("signedOff", b.getCustomerSignedOffAt() != null);
        return m;
    }

    private EmergencyMaintenanceBooking feedbackBooking(String orderReference, String token) {
        if (orderReference == null || orderReference.isBlank() || token == null || token.isBlank()) throw error(404, "Feedback link is invalid or expired");
        EmergencyMaintenanceBooking b = bookings.findByOrderReference(orderReference.trim()).orElseGet(() -> {
            try {
                String raw = orderReference.trim().toUpperCase(Locale.ROOT).replace("ORD-EMG-", "");
                return bookings.findById(Long.parseLong(raw)).orElse(null);
            } catch (Exception ignored) { return null; }
        });
        if (b == null || b.getFeedbackToken() == null || !java.security.MessageDigest.isEqual(
                b.getFeedbackToken().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                token.getBytes(java.nio.charset.StandardCharsets.UTF_8))) throw error(404, "Feedback link is invalid or expired");
        if (!"COMPLETED".equals(b.getJobStatus())) throw error(409, "Feedback is available after service completion");
        return b;
    }

    public Map<String,Object> publicFeedbackView(String orderReference, String token) {
        EmergencyMaintenanceBooking b = feedbackBooking(orderReference, token);
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("orderReference", b.getOrderReference());
        m.put("category", b.getCategory());
        m.put("completedAt", b.getCompletedAt());
        m.put("rating", b.getRating());
        m.put("review", b.getReview());
        m.put("submitted", b.getCustomerSignedOffAt() != null);
        m.put("partnerName", b.getPartnerId() == null ? "Service Partner" : partners.findById(b.getPartnerId()).map(p -> p.getName() == null || p.getName().isBlank() ? "Service Partner" : p.getName()).orElse("Service Partner"));
        return m;
    }

    public void submitPublicFeedback(String orderReference, String token, int rating, String review) {
        if (rating < 1 || rating > 5) throw error(400, "Rating must be between 1 and 5");
        EmergencyMaintenanceBooking b = feedbackBooking(orderReference, token);
        if (review != null && review.length() > 1000) throw error(400, "Review must be 1000 characters or less");
        b.setRating(rating);
        b.setReview(review == null ? null : review.trim());
        b.setCustomerSignedOffAt(LocalDateTime.now());
        b.setReviewNotificationStatus("COMPLETED");
        recordAudit(b, "CUSTOMER_FEEDBACK_SUBMITTED", b.getPartnerId(), "Resident submitted a " + rating + "/5 service rating", b.getRequesterId());
        bookings.save(b);
        broadcastEvent(b.getId(), b.getJobStatus(), "CUSTOMER_FEEDBACK_SUBMITTED", b.getPartnerId(), "Customer feedback recorded");
    }

    public List<Map<String, Object>> pendingReviewNotifications(Actor a) {
        admin(a);
        return bookings.findAll().stream()
                .filter(b -> "COMPLETED".equals(b.getJobStatus()) && b.getRating() == null)
                .sorted(Comparator.comparing(EmergencyMaintenanceBooking::getId).reversed())
                .map(b -> reviewRequest(a, b.getId()))
                .toList();
    }

    public void setAdminDutyStatus(String tenant, String status) {
        if (tenant == null || tenant.isBlank()) tenant = "smartsociety";
        String normalized = (status == null || status.isBlank()) ? "AVAILABLE" : status.trim().toUpperCase(Locale.ROOT);
        adminDutyStatusMap.put(tenant.toLowerCase(Locale.ROOT), normalized);
        if ("BUSY".equalsIgnoreCase(normalized) || "OFF-DUTY".equalsIgnoreCase(normalized) || "OFF_DUTY".equalsIgnoreCase(normalized)) {
            try {
                processMaintenanceQueueAndAutoAssign(tenant);
            } catch (Exception ignored) {}
        }
        broadcastEvent(0L, "DUTY_STATUS_CHANGED", normalized, null,
                "Maintenance Team Head duty status set to " + normalized + ("BUSY".equalsIgnoreCase(normalized) ? " (⚡ Auto-Assign Active - 10m SLA)" : ""));
    }

    public String getAdminDutyStatus(String tenant) {
        if (tenant == null || tenant.isBlank()) tenant = "smartsociety";
        return adminDutyStatusMap.getOrDefault(tenant.toLowerCase(Locale.ROOT), "AVAILABLE");
    }

    public boolean isMaintenanceAdminBusy(String tenant) {
        String status = getAdminDutyStatus(tenant);
        if ("BUSY".equalsIgnoreCase(status) || "OFF-DUTY".equalsIgnoreCase(status) || "OFF_DUTY".equalsIgnoreCase(status)) {
            return true;
        }
        String smartSocietyStatus = getAdminDutyStatus("smartsociety");
        if ("BUSY".equalsIgnoreCase(smartSocietyStatus) || "OFF-DUTY".equalsIgnoreCase(smartSocietyStatus) || "OFF_DUTY".equalsIgnoreCase(smartSocietyStatus)) {
            return true;
        }
        boolean anyBusyStatus = adminDutyStatusMap.values().stream()
                .anyMatch(s -> "BUSY".equalsIgnoreCase(s) || "OFF-DUTY".equalsIgnoreCase(s) || "OFF_DUTY".equalsIgnoreCase(s));
        if (anyBusyStatus) {
            return true;
        }
        if (tickets != null) {
            long activeAdminTickets = tickets.findAll().stream()
                    .filter(t -> (tenant == null || tenant.equalsIgnoreCase(t.getTenantId()) || tenant.equalsIgnoreCase(t.getSourcePlatform())))
                    .filter(t -> isSeededMaintenanceAdmin(t.getVendorEmail()))
                    .filter(t -> Set.of("ASSIGNED", "IN_PROGRESS").contains(String.valueOf(t.getTicketStatus()).toUpperCase(Locale.ROOT)))
                    .count();
            if (activeAdminTickets >= 2) {
                return true;
            }
        }
        return false;
    }

    public boolean isWorkerPresentToday(Long userId, String tenant) {
        LocalDate today = LocalDate.now();
        if (staffAttendances != null) {
            Optional<StaffAttendance> att = staffAttendances.findFirstByUserIdAndWorkDateOrderByCreatedAtDesc(userId, today);
            if (att.isPresent()) {
                return att.get().getCheckInAt() != null && att.get().getCheckOutAt() == null;
            }
        }
        // Fallback check on partner duty state
        return partners.findByUserId(userId).map(MaintenancePartner::isOnDuty).orElse(true);
    }

    public long getWorkerActiveWorkload(Long userId, Long partnerId) {
        long activeTickets = (tickets != null) ? tickets.findAll().stream()
                .filter(t -> Objects.equals(t.getVendorId(), userId))
                .filter(t -> Set.of("ASSIGNED", "IN_PROGRESS", "DISPATCHED", "ON_HOLD").contains(String.valueOf(t.getTicketStatus()).toUpperCase(Locale.ROOT)))
                .count() : 0L;

        long activeBookings = (partnerId != null) ? bookings.findByPartnerIdAndJobStatusIn(partnerId, ACTIVE_EMERGENCY_STATES).size() : 0L;

        return activeTickets + activeBookings;
    }

    public boolean isWorkerFreeNow(Long userId, Long partnerId) {
        long load = getWorkerActiveWorkload(userId, partnerId);
        if (load > 0) return false;
        if (partnerId != null) {
            return partners.findById(partnerId)
                    .map(p -> !"BUSY".equalsIgnoreCase(p.getWorkState()) && !"BUSY".equalsIgnoreCase(p.getAvailability()) && !"OFFLINE".equalsIgnoreCase(p.getWorkState()))
                    .orElse(true);
        }
        return true;
    }

    public Optional<AppUser> findFreeMaintenanceWorker(String tenant, String category) {
        List<AppUser> candidateWorkers = users.findAll().stream()
                .filter(u -> !u.isAccountLocked())
                .filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF)
                .filter(u -> !isSeededMaintenanceAdmin(u.getEmail()))
                .filter(u -> tenant == null || "system".equalsIgnoreCase(tenant) || "platform".equalsIgnoreCase(tenant) || tenant.equalsIgnoreCase(u.getTenantId()) || u.getTenantId() == null)
                .toList();

        if (candidateWorkers.isEmpty()) {
            candidateWorkers = users.findAll().stream()
                    .filter(u -> !u.isAccountLocked())
                    .filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF)
                    .filter(u -> !isSeededMaintenanceAdmin(u.getEmail()))
                    .toList();
        }

        if (candidateWorkers.isEmpty()) {
            return Optional.empty();
        }

        // Multi-Factor Auto-Assignment Scoring:
        // 1. Attendance: Present today (+500 points; absent workers heavily penalized)
        // 2. Free Now: 0 active tasks (+300 points)
        // 3. Workload Balance: -40 points per active job (favoring least-loaded)
        // 4. Trade/Skill Match: Exact match (+200 points), General tech (+50 points)
        String normalizedCat = (category == null ? "" : category.toLowerCase(Locale.ROOT).trim());

        Map<Long, Integer> workerScores = new HashMap<>();
        Map<Long, Long> workerLoads = new HashMap<>();
        Map<Long, Boolean> workerFreeMap = new HashMap<>();

        for (AppUser w : candidateWorkers) {
            Optional<MaintenancePartner> pOpt = partners.findByUserId(w.getId());
            Long partnerId = pOpt.map(MaintenancePartner::getId).orElse(null);

            boolean present = isWorkerPresentToday(w.getId(), tenant);
            long load = getWorkerActiveWorkload(w.getId(), partnerId);
            boolean freeNow = isWorkerFreeNow(w.getId(), partnerId);

            workerLoads.put(w.getId(), load);
            workerFreeMap.put(w.getId(), freeNow);

            int score = 0;
            if (present) {
                score += 500;
            } else {
                score -= 1000; // Disqualify absent staff if any present staff exist
            }

            if (freeNow) {
                score += 300;
            }

            score -= (int)(load * 40);

            // Maximum concurrent load threshold penalty (3 jobs)
            if (load >= 3) {
                score -= 500;
            }

            // Skill / Trade matching
            String desig = (w.getDesignation() != null ? w.getDesignation().toLowerCase(Locale.ROOT) : "");
            String partnerTrade = pOpt.map(p -> p.getTrade() != null ? p.getTrade().toLowerCase(Locale.ROOT) : "").orElse("");
            String partnerSkills = pOpt.map(p -> p.getSkillCategories() != null ? p.getSkillCategories().toLowerCase(Locale.ROOT) : "").orElse("");

            boolean isDirectSkillMatch = false;
            if (!normalizedCat.isEmpty()) {
                if (normalizedCat.contains("plumb") && (desig.contains("plumb") || partnerTrade.contains("plumb") || partnerSkills.contains("plumb"))) {
                    isDirectSkillMatch = true;
                } else if (normalizedCat.contains("electr") && (desig.contains("electr") || partnerTrade.contains("electr") || partnerSkills.contains("electr"))) {
                    isDirectSkillMatch = true;
                } else if (normalizedCat.contains("carpent") && (desig.contains("carpent") || partnerTrade.contains("carpent") || partnerSkills.contains("carpent"))) {
                    isDirectSkillMatch = true;
                } else if ((normalizedCat.contains("ac") || normalizedCat.contains("hvac")) && (desig.contains("hvac") || desig.contains("ac") || partnerTrade.contains("hvac"))) {
                    isDirectSkillMatch = true;
                } else if (desig.contains(normalizedCat) || partnerTrade.contains(normalizedCat) || partnerSkills.contains(normalizedCat)) {
                    isDirectSkillMatch = true;
                }
            }

            if (isDirectSkillMatch) {
                score += 200;
            } else if (desig.contains("technician") || desig.contains("general") || desig.contains("maintenance")) {
                score += 50;
            }

            // Partner rating bonus
            float rating = pOpt.map(MaintenancePartner::getRating).orElse(4.5f);
            score += (int)(rating * 10);

            workerScores.put(w.getId(), score);
        }

        // Return candidate with highest score, tie-broken by lowest load
        return candidateWorkers.stream().max((w1, w2) -> {
            int s1 = workerScores.getOrDefault(w1.getId(), 0);
            int s2 = workerScores.getOrDefault(w2.getId(), 0);
            if (s1 != s2) {
                return Integer.compare(s1, s2);
            }
            long l1 = workerLoads.getOrDefault(w1.getId(), 0L);
            long l2 = workerLoads.getOrDefault(w2.getId(), 0L);
            if (l1 != l2) {
                return Long.compare(l2, l1); // lower load gives higher priority
            }
            return Long.compare(w2.getId(), w1.getId());
        });
    }

    public List<Map<String, Object>> getWorkersStatusList(String tenant) {
        List<AppUser> workers = users.findAll().stream()
                .filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF && !isSeededMaintenanceAdmin(u.getEmail()))
                .sorted(Comparator.comparing(AppUser::getId))
                .toList();

        List<Map<String, Object>> list = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (AppUser w : workers) {
            Optional<MaintenancePartner> pOpt = partners.findByUserId(w.getId());
            Optional<StaffAttendance> attOpt = (staffAttendances != null)
                    ? staffAttendances.findFirstByUserIdAndWorkDateOrderByCreatedAtDesc(w.getId(), today)
                    : Optional.empty();

            boolean checkedIn = false;
            String checkInTime = null;
            String checkOutTime = null;

            if (attOpt.isPresent()) {
                StaffAttendance att = attOpt.get();
                checkedIn = (att.getCheckInAt() != null && att.getCheckOutAt() == null);
                if (att.getCheckInAt() != null) checkInTime = att.getCheckInAt().format(DateTimeFormatter.ofPattern("hh:mm a"));
                if (att.getCheckOutAt() != null) checkOutTime = att.getCheckOutAt().format(DateTimeFormatter.ofPattern("hh:mm a"));
            } else {
                checkedIn = pOpt.map(MaintenancePartner::isOnDuty).orElse(true);
            }

            long activeLoad = getWorkerActiveWorkload(w.getId(), pOpt.map(MaintenancePartner::getId).orElse(null));
            boolean isFreeNow = isWorkerFreeNow(w.getId(), pOpt.map(MaintenancePartner::getId).orElse(null));

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", w.getId());
            map.put("name", w.getFullName());
            map.put("email", w.getEmail());
            map.put("phone", w.getPhone() != null ? w.getPhone() : "");
            map.put("designation", w.getDesignation() != null ? w.getDesignation() : "Maintenance Staff");
            map.put("workShift", w.getWorkShift() != null ? w.getWorkShift() : "General Shift");
            map.put("employeeId", w.getEmployeeId() != null ? w.getEmployeeId() : "EMP-" + w.getId());
            map.put("accountLocked", w.isAccountLocked());
            map.put("presentToday", checkedIn);
            map.put("checkInTime", checkInTime);
            map.put("checkOutTime", checkOutTime);
            map.put("activeWorkload", activeLoad);
            map.put("isFreeNow", isFreeNow);
            map.put("onDuty", pOpt.map(MaintenancePartner::isOnDuty).orElse(checkedIn));
            map.put("workState", pOpt.map(MaintenancePartner::getWorkState).orElse(isFreeNow ? "IDLE" : "BUSY"));
            map.put("rating", pOpt.map(MaintenancePartner::getRating).orElse(4.8f));
            list.add(map);
        }
        return list;
    }

    public Map<String, Object> toggleWorkerAttendance(Long userId, String action, String tenant) {
        AppUser user = users.findById(userId).orElseThrow(() -> error(404, "Worker not found"));
        LocalDate today = LocalDate.now();
        boolean checkin = "checkin".equalsIgnoreCase(action);

        if (staffAttendances != null) {
            StaffAttendance att = staffAttendances.findFirstByUserIdAndWorkDateOrderByCreatedAtDesc(userId, today)
                    .orElseGet(() -> {
                        StaffAttendance x = new StaffAttendance();
                        x.setTenantId(user.getTenantId() != null ? user.getTenantId() : "green-heights");
                        x.setUser(user);
                        x.setWorkDate(today);
                        return x;
                    });
            if (checkin) {
                att.setCheckInAt(LocalDateTime.now());
                att.setCheckOutAt(null);
            } else {
                att.setCheckOutAt(LocalDateTime.now());
            }
            staffAttendances.save(att);
        }

        partners.findByUserId(userId).ifPresent(p -> {
            p.setOnDuty(checkin);
            if (!checkin) {
                p.setWorkState("OFFLINE");
                p.setAvailability("OFFLINE");
            } else {
                p.setWorkState("IDLE");
                p.setAvailability("IDLE");
            }
            partners.save(p);
        });

        broadcastEvent(0L, checkin ? "WORKER_CHECKIN" : "WORKER_CHECKOUT", "ATTENDANCE_CHANGED", userId,
                "Worker " + user.getFullName() + (checkin ? " marked PRESENT (Checked-In)" : " marked ABSENT (Checked-Out)"));

        // Trigger queue auto-dispatch if a worker checked in
        if (checkin) {
            try { processMaintenanceQueueAndAutoAssign(tenant); } catch (Exception ignored) {}
        }

        return Map.of("userId", userId, "name", user.getFullName(), "presentToday", checkin, "action", action);
    }

    public List<CommonMaintenanceTicket> processMaintenanceQueueAndAutoAssign(String tenant) {
        if (tickets == null) return Collections.emptyList();
        if (tenant == null || tenant.isBlank()) tenant = "smartsociety";

        boolean adminBusy = isMaintenanceAdminBusy(tenant);

        List<CommonMaintenanceTicket> openTickets = tickets.findAll().stream()
                .filter(t -> "REQUESTED".equalsIgnoreCase(String.valueOf(t.getTicketStatus())) && t.getVendorId() == null)
                .sorted(Comparator.comparing(CommonMaintenanceTicket::getId))
                .toList();

        List<CommonMaintenanceTicket> assignedList = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (CommonMaintenanceTicket ticket : openTickets) {
            LocalDateTime created = ticket.getCreatedAt() != null ? ticket.getCreatedAt() : now;
            long elapsedMinutes = ChronoUnit.MINUTES.between(created, now);

            // 10-Minute SLA Rule:
            // 1. If Team Head is busy, auto-assign queued tickets to available workers.
            // 2. If ticket has been pending for >= 10 minutes without Team Head assignment, auto-escalate and assign.
            boolean eligibleForAutoAssign = adminBusy || elapsedMinutes >= 10;

            if (!eligibleForAutoAssign) {
                continue;
            }

            Optional<AppUser> bestWorker = findFreeMaintenanceWorker(ticket.getTenantId() != null ? ticket.getTenantId() : tenant, ticket.getServiceType());
            if (bestWorker.isPresent()) {
                AppUser worker = bestWorker.get();
                ticket.setTicketStatus("ASSIGNED");
                ticket.setVendorId(worker.getId());
                ticket.setVendorName(worker.getFullName());
                ticket.setVendorEmail(worker.getEmail());
                ticket.setVendorPhone(worker.getPhone());
                ticket.setAssignedAt(now);
                String reason = adminBusy
                        ? "⚡ Auto-assigned to " + worker.getFullName() + " (" + (worker.getDesignation() != null ? worker.getDesignation() : "Staff") + ") [Attendance: Verified Present | Multi-Factor Match] because Maintenance Team Head is busy."
                        : "⚡ Auto-assigned to " + worker.getFullName() + " (" + (worker.getDesignation() != null ? worker.getDesignation() : "Staff") + ") [10-minute SLA window reached without manual dispatch].";
                ticket.setVendorNotes(reason);
                CommonMaintenanceTicket saved = tickets.save(ticket);
                assignedList.add(saved);

                // Synchronize complaint if linked
                if (complaints != null) {
                    complaints.findAll().stream()
                            .filter(c -> "OPEN".equalsIgnoreCase(c.getStatus()))
                            .filter(c -> Objects.equals(c.getId(), ticket.getTargetEntityId()) 
                                    || (ticket.getTitle() != null && ticket.getTitle().contains(c.getTitle()))
                                    || (ticket.getDescription() != null && ticket.getDescription().contains(c.getDescription())))
                            .findFirst()
                            .ifPresent(c -> {
                                c.setStatus("IN_PROGRESS");
                                c.setAssignedTo(worker.getFullName());
                                c.setResolutionNotes(reason);
                                complaints.save(c);
                            });
                }

                // Synchronize partner state
                partners.findByUserId(worker.getId()).ifPresent(p -> {
                    p.setWorkState("BUSY");
                    p.setAvailability("BUSY");
                    partners.save(p);
                });

                // Emit real-time SSE broadcast event
                broadcastEvent(saved.getId(), "ASSIGNED", "AUTO_ASSIGNED", worker.getId(),
                        "⚡ Ticket #" + saved.getTicketId() + " (" + saved.getServiceType() + ") auto-assigned to " + worker.getFullName() + " (TL Busy / 10m SLA)");
            }
        }
        return assignedList;
    }

    public CommonMaintenanceTicket createAndRouteTicket(Actor actor, String title, String description,
            String serviceAddress, String city, String category, String priority, String phone) {
        if (tickets == null) throw error(500, "Ticket service unavailable");
        String tenant = (actor.tenant() != null && !actor.tenant().isBlank()) ? actor.tenant() : "smartsociety";
        String platform = (actor.platform() != null && !actor.platform().isBlank()) ? actor.platform() : "smartsociety";

        CommonMaintenanceTicket t = new CommonMaintenanceTicket();
        t.setTenantId(tenant);
        t.setSourcePlatform(platform);
        t.setRequesterId(actor.id());
        t.setRequesterName(actor.name() != null ? actor.name() : (actor.worker() ? "Technician " + actor.id() : "Resident"));
        t.setRequesterPhone(phone);
        t.setTargetEntityType("GENERAL");
        t.setTitle(title);
        t.setDescription(description);
        t.setServiceAddress(serviceAddress);
        t.setCity(city);
        t.setServiceType(category);
        t.setServiceCategory(category);
        t.setPriority(priority != null ? priority.toUpperCase(Locale.ROOT) : "MEDIUM");
        t.setDueAt(LocalDateTime.now().plusHours("HIGH".equalsIgnoreCase(priority) ? 24 : "LOW".equalsIgnoreCase(priority) ? 72 : 48));

        boolean adminBusy = isMaintenanceAdminBusy(tenant);
        if (adminBusy) {
            Optional<AppUser> freeWorker = findFreeMaintenanceWorker(tenant, category);
            if (freeWorker.isPresent()) {
                AppUser worker = freeWorker.get();
                t.setTicketStatus("ASSIGNED");
                t.setVendorId(worker.getId());
                t.setVendorName(worker.getFullName());
                t.setVendorEmail(worker.getEmail());
                t.setVendorPhone(worker.getPhone());
                t.setAssignedAt(LocalDateTime.now());
                t.setVendorNotes("⚡ Auto-assigned to free worker " + worker.getFullName() + " (" + (worker.getDesignation() != null ? worker.getDesignation() : "Staff") + ") [Attendance: Present | Workload Match] because Maintenance Team Head is busy.");
            } else {
                t.setTicketStatus("REQUESTED");
                t.setVendorNotes("Maintenance Team Head is busy; queued for auto-assignment within 10-minute SLA window.");
            }
        } else {
            t.setTicketStatus("REQUESTED");
            t.setVendorNotes(actor.worker() ? "Raised by technician on site for maintenance admin queue." : "Raised for maintenance queue.");
        }

        CommonMaintenanceTicket saved = tickets.save(t);
        if (saved.getTicketCode() == null || saved.getTicketCode().isBlank()) {
            int year = saved.getCreatedAt() != null ? saved.getCreatedAt().getYear() : java.time.LocalDate.now().getYear();
            saved.setTicketCode(String.format(Locale.ROOT, "TCK-%04d-%04d", year, saved.getId()));
            saved = tickets.save(saved);
        }

        if (adminBusy && "ASSIGNED".equalsIgnoreCase(saved.getTicketStatus())) {
            broadcastEvent(saved.getId(), "ASSIGNED", "AUTO_ASSIGNED", saved.getVendorId(),
                    "⚡ Ticket #" + saved.getTicketId() + " (" + category + ") auto-assigned to " + saved.getVendorName() + " (TL Busy)");
        }
        return saved;
    }

    public List<CommonMaintenanceTicket> autoAssignOpenPool(Actor actor) {
        String tenant = (actor.tenant() != null && !actor.tenant().isBlank()) ? actor.tenant() : "smartsociety";
        return processMaintenanceQueueAndAutoAssign(tenant);
    }

    private static ResponseStatusException error(int status, String message) {return new ResponseStatusException(HttpStatus.valueOf(status), message);}
}
