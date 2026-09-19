package com.smartapartment.service;

import com.smartapartment.dto.RealTimeTrackingDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class MaintenanceTrackingService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceTrackingService.class);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MMM dd, yyyy hh:mm a");
    private static final long SSE_TIMEOUT = 180_000L; // 3 minutes

    private final MaintenanceRequestRepository requestRepository;
    private final MaintenanceStatusHistoryRepository historyRepository;
    private final ResidentRepository residentRepository;
    private final AppUserRepository userRepository;
    private final WorkerAvailabilityRepository availabilityRepository;
    private final AutoAssignmentService autoAssignmentService;

    // SSE Emitters Maps
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> residentEmitters = new ConcurrentHashMap<>();
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> managerEmitters = new ConcurrentHashMap<>();
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> requestEmitters = new ConcurrentHashMap<>();

    public MaintenanceTrackingService(
            MaintenanceRequestRepository requestRepository,
            MaintenanceStatusHistoryRepository historyRepository,
            ResidentRepository residentRepository,
            AppUserRepository userRepository,
            WorkerAvailabilityRepository availabilityRepository,
            @Lazy AutoAssignmentService autoAssignmentService) {
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.residentRepository = residentRepository;
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.autoAssignmentService = autoAssignmentService;
    }

    // ==========================================
    // 1. SSE SUBSCRIPTIONS
    // ==========================================

    public SseEmitter subscribeResident(String tenantId, Long residentId) {
        String key = (tenantId != null ? tenantId : "default") + ":" + residentId;
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        CopyOnWriteArrayList<SseEmitter> list = residentEmitters.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> {
            list.remove(emitter);
            emitter.complete();
        });
        emitter.onError(e -> list.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(Map.of("message", "Subscribed to live tracking", "residentId", residentId, "timestamp", System.currentTimeMillis())));
        } catch (IOException e) {
            list.remove(emitter);
        }
        return emitter;
    }

    public SseEmitter subscribeManager(String tenantId) {
        String key = tenantId != null ? tenantId : "default";
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        CopyOnWriteArrayList<SseEmitter> list = managerEmitters.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> {
            list.remove(emitter);
            emitter.complete();
        });
        emitter.onError(e -> list.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(Map.of("message", "Subscribed to maintenance operations dashboard", "tenantId", key, "timestamp", System.currentTimeMillis())));
        } catch (IOException e) {
            list.remove(emitter);
        }
        return emitter;
    }

    public SseEmitter subscribeRequest(Long requestId, String tenantId, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found"));

        // Multi-tenant check
        if (tenantId != null && !tenantId.isBlank() && request.getTenantId() != null && !tenantId.equalsIgnoreCase(request.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to request from different tenant");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        CopyOnWriteArrayList<SseEmitter> list = requestEmitters.computeIfAbsent(requestId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> {
            list.remove(emitter);
            emitter.complete();
        });
        emitter.onError(e -> list.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(Map.of("message", "Subscribed to request " + request.getRequestNumber(), "requestId", requestId, "timestamp", System.currentTimeMillis())));
        } catch (IOException e) {
            list.remove(emitter);
        }
        return emitter;
    }

    // ==========================================
    // 2. EVENT BROADCASTING
    // ==========================================

    public void broadcastEvent(TrackingEventDto event) {
        if (event == null) return;
        log.info("Broadcasting Maintenance SSE Event: {} for request {}", event.eventType(), event.requestNumber());

        // 1. Send to Request-specific emitters
        if (event.requestId() != null) {
            CopyOnWriteArrayList<SseEmitter> reqList = requestEmitters.get(event.requestId());
            if (reqList != null) {
                for (SseEmitter emitter : reqList) {
                    try {
                        emitter.send(SseEmitter.event().name("maintenance-event").data(event));
                    } catch (Exception ex) {
                        reqList.remove(emitter);
                    }
                }
            }
        }

        // 2. Send to Resident-specific emitters
        if (event.residentId() != null) {
            String resKey = (event.tenantId() != null ? event.tenantId() : "default") + ":" + event.residentId();
            CopyOnWriteArrayList<SseEmitter> resList = residentEmitters.get(resKey);
            if (resList != null) {
                for (SseEmitter emitter : resList) {
                    try {
                        emitter.send(SseEmitter.event().name("maintenance-event").data(event));
                    } catch (Exception ex) {
                        resList.remove(emitter);
                    }
                }
            }
        }

        // 3. Send to Manager emitters for this tenant
        String mgrKey = event.tenantId() != null ? event.tenantId() : "default";
        CopyOnWriteArrayList<SseEmitter> mgrList = managerEmitters.get(mgrKey);
        if (mgrList != null) {
            for (SseEmitter emitter : mgrList) {
                try {
                    emitter.send(SseEmitter.event().name("maintenance-event").data(event));
                } catch (Exception ex) {
                    mgrList.remove(emitter);
                }
            }
        }
    }

    // Heartbeat every 25 seconds
    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        Map<String, Object> ping = Map.of("type", "HEARTBEAT", "timestamp", System.currentTimeMillis());

        residentEmitters.values().forEach(list -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data(ping));
                } catch (Exception e) {
                    list.remove(emitter);
                }
            }
        });

        managerEmitters.values().forEach(list -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data(ping));
                } catch (Exception e) {
                    list.remove(emitter);
                }
            }
        });

        requestEmitters.values().forEach(list -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data(ping));
                } catch (Exception e) {
                    list.remove(emitter);
                }
            }
        });
    }

    // ==========================================
    // 3. LIVE TRACKING DATA QUERIES
    // ==========================================

    @Transactional(readOnly = true)
    public List<LiveTrackingCardDto> getResidentActiveTracking(AppUser user) {
        Resident resident = resolveResidentForUser(user);
        List<String> activeStatuses = List.of(
                "REQUESTED", "AUTO_ASSIGN_PENDING", "ASSIGNED", "WORKER_ACCEPTED",
                "TRAVELLING", "ARRIVED", "IN_PROGRESS", "ON_HOLD",
                "RESIDENT_CONFIRMATION", "REOPENED", "WAITING_FOR_WORKER", "COMPLETED"
        );
        List<MaintenanceRequest> requests = requestRepository
                .findByResidentIdAndRequestStatusInOrderByCreatedAtDesc(resident.getId(), activeStatuses);

        return requests.stream()
                .map(this::buildLiveTrackingCard)
                .toList();
    }

    @Transactional(readOnly = true)
    public LiveTrackingCardDto getRequestTrackingCard(Long requestId, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found"));

        // Validate resident ownership or staff/admin role
        validateAccess(request, user);

        return buildLiveTrackingCard(request);
    }

    @Transactional
    public LiveTrackingCardDto confirmCompletion(Long requestId, ConfirmCompletionRequest confirmRequest, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found"));
        validateAccess(request, user);

        String currentStatus = request.getRequestStatus() != null ? request.getRequestStatus().toUpperCase(Locale.ROOT) : "";
        if (!"COMPLETED".equals(currentStatus) && !"RESIDENT_CONFIRMATION".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request " + request.getRequestNumber() + " cannot be confirmed from status: " + request.getRequestStatus());
        }

        request.setRequestStatus("CLOSED");
        request.setClosedAt(LocalDateTime.now());
        if (confirmRequest != null && confirmRequest.feedback() != null && !confirmRequest.feedback().isBlank()) {
            String note = "Resident Feedback: " + confirmRequest.feedback().trim();
            if (confirmRequest.rating() != null) {
                note += " (Rating: " + confirmRequest.rating() + "/5)";
            }
            request.setNotes(request.getNotes() != null ? request.getNotes() + "\n" + note : note);
        }
        MaintenanceRequest saved = requestRepository.save(request);

        // Record history
        recordStatusHistory(saved.getId(), currentStatus, "CLOSED",
                user.getFullName() != null ? user.getFullName() : "Resident",
                "Resident confirmed satisfactory completion of service.");

        // Free worker availability if assigned and currently busy
        if (saved.getAssignedWorkerId() != null) {
            availabilityRepository.findByWorkerId(saved.getAssignedWorkerId()).ifPresent(av -> {
                if ("BUSY".equalsIgnoreCase(av.getStatus()) || (av.getCurrentTaskId() != null && av.getCurrentTaskId().equals(saved.getId()))) {
                    av.setStatus("AVAILABLE");
                    av.setCurrentTaskId(null);
                    av.setCurrentTaskNumber(null);
                    av.setLastUpdatedAt(LocalDateTime.now());
                    availabilityRepository.save(av);
                    // Broadcast worker availability
                    broadcastEvent(TrackingEventDto.of("WORKER_AVAILABLE", null, null, "AVAILABLE",
                            saved.getTenantId(), saved.getAssignedWorkerId(), saved.getAssignedWorkerName(), null,
                            "Worker " + saved.getAssignedWorkerName() + " is now AVAILABLE", null));
                }
            });
            // Trigger waiting queue for this tenant
            autoAssignmentService.processWaitingQueue(saved.getTenantId());
        }

        // Broadcast SSE event
        broadcastEvent(TrackingEventDto.of("REQUEST_CLOSED", saved.getId(), saved.getRequestNumber(),
                "CLOSED", saved.getTenantId(), saved.getAssignedWorkerId(), saved.getAssignedWorkerName(),
                saved.getResidentId(), "Maintenance request " + saved.getRequestNumber() + " was confirmed and closed by resident.", saved));

        return buildLiveTrackingCard(saved);
    }

    @Transactional
    public LiveTrackingCardDto residentReopenRequest(Long requestId, String reason, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found"));
        validateAccess(request, user);

        if (!request.isEligibleForReopen()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request " + request.getRequestNumber() + " cannot be reopened from status: " + request.getRequestStatus());
        }

        String oldStatus = request.getRequestStatus();
        request.setRequestStatus("REOPENED");
        request.setCompletedAt(null);
        request.setClosedAt(null);
        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(saved.getId(), oldStatus, "REOPENED",
                user.getFullName() != null ? user.getFullName() : "Resident",
                reason != null && !reason.isBlank() ? reason.trim() : "Resident requested rework / issue persisted.");

        // Schedule auto assignment
        autoAssignmentService.scheduleAssignment(saved);

        saved = requestRepository.findById(saved.getId()).orElse(saved);

        broadcastEvent(TrackingEventDto.of("REQUEST_REOPENED", saved.getId(), saved.getRequestNumber(),
                "REOPENED", saved.getTenantId(), saved.getAssignedWorkerId(), saved.getAssignedWorkerName(),
                saved.getResidentId(), "Request " + saved.getRequestNumber() + " was reopened by resident: " + reason, saved));

        return buildLiveTrackingCard(saved);
    }

    // ==========================================
    // 4. HELPER CARD & TIMELINE BUILDER
    // ==========================================

    public LiveTrackingCardDto buildLiveTrackingCard(MaintenanceRequest req) {
        List<MaintenanceStatusHistory> history = historyRepository.findByRequestIdOrderByCreatedAtAsc(req.getId());
        LocalDateTime now = LocalDateTime.now();

        // Calculate remaining minutes
        Integer remainingMinutes = null;
        String remainingTimeString = "Pending schedule";
        boolean isOverdue = false;
        int overdueMinutes = 0;

        if (req.getEstimatedEndTime() != null) {
            Duration diff = Duration.between(now, req.getEstimatedEndTime());
            long mins = diff.toMinutes();
            if (mins >= 0) {
                remainingMinutes = (int) mins;
                remainingTimeString = mins + " mins remaining";
            } else {
                remainingMinutes = 0;
                isOverdue = true;
                overdueMinutes = (int) Math.abs(mins);
                remainingTimeString = "Overdue by " + overdueMinutes + " mins";
            }
        } else if ("COMPLETED".equalsIgnoreCase(req.getRequestStatus()) || "CLOSED".equalsIgnoreCase(req.getRequestStatus())) {
            remainingTimeString = "Completed";
        }

        // Determine Status Badge
        String status = req.getRequestStatus() != null ? req.getRequestStatus().toUpperCase(Locale.ROOT) : "REQUESTED";
        String statusBadge = switch (status) {
            case "REQUESTED" -> "📋 REQUESTED";
            case "AUTO_ASSIGN_PENDING" -> "⏳ AUTO-ASSIGN PENDING";
            case "WAITING_FOR_WORKER" -> "🕒 WAITING IN QUEUE";
            case "ASSIGNED" -> "👤 WORKER ASSIGNED";
            case "WORKER_ACCEPTED" -> "🤝 WORKER ACCEPTED";
            case "TRAVELLING" -> "🔵 ON THE WAY";
            case "ARRIVED" -> "📍 WORKER ARRIVED";
            case "IN_PROGRESS" -> "🟢 WORK IN PROGRESS";
            case "ON_HOLD" -> "🟠 ON HOLD";
            case "COMPLETED" -> "✅ WORK COMPLETED";
            case "RESIDENT_CONFIRMATION" -> "⭐ CONFIRMATION PENDING";
            case "CLOSED" -> "🔒 CLOSED";
            case "CANCELLED" -> "❌ CANCELLED";
            case "REOPENED" -> "🔄 REOPENED";
            default -> status;
        };

        // Latest activity
        String latestActivity = "Request logged";
        if (!history.isEmpty()) {
            MaintenanceStatusHistory last = history.get(history.size() - 1);
            latestActivity = (last.getReason() != null && !last.getReason().isBlank())
                    ? last.getReason() : ("Status changed to " + last.getNewStatus() + " by " + last.getChangedBy());
        }

        // Build 10-step Timeline
        List<TimelineStepDto> timeline = buildTimelineSteps(req, history);

        // Build Activity Feed
        List<ActivityFeedItemDto> activities = history.stream()
                .map(h -> new ActivityFeedItemDto(
                        h.getCreatedAt(),
                        h.getCreatedAt() != null ? h.getCreatedAt().format(DATE_TIME_FORMATTER) : "",
                        h.getChangedBy() != null ? h.getChangedBy() : "System",
                        h.getOldStatus(),
                        h.getNewStatus(),
                        h.getReason() != null ? h.getReason() : "Status updated"
                ))
                .toList();

        boolean canConfirm = "COMPLETED".equalsIgnoreCase(status) || "RESIDENT_CONFIRMATION".equalsIgnoreCase(status);
        boolean canReopen = req.isEligibleForReopen();
        boolean canCancel = req.isEligibleForCancellation();

        return new LiveTrackingCardDto(
                req.getId(),
                req.getRequestNumber(),
                req.getServiceType() != null ? req.getServiceType() : req.getCategory(),
                req.getTitle(),
                req.getDescription(),
                req.getAssignedWorkerId(),
                req.getAssignedWorkerName() != null ? req.getAssignedWorkerName() : "Unassigned",
                req.getAssignedWorkerPhone(),
                status,
                statusBadge,
                req.getPriority(),
                req.getApartmentUnit(),
                req.getBuildingName(),
                req.getSocietyName(),
                req.getCreatedAt(),
                req.getEstimatedStartTime(),
                req.getEstimatedEndTime(),
                remainingMinutes,
                remainingTimeString,
                latestActivity,
                isOverdue,
                overdueMinutes,
                canConfirm,
                canReopen,
                canCancel,
                timeline,
                activities
        );
    }

    private List<TimelineStepDto> buildTimelineSteps(MaintenanceRequest req, List<MaintenanceStatusHistory> history) {
        List<TimelineStepDto> steps = new ArrayList<>();
        Set<String> passedStatuses = new HashSet<>();
        Map<String, LocalDateTime> statusTimes = new HashMap<>();

        if (req.getCreatedAt() != null) {
            passedStatuses.add("REQUESTED");
            statusTimes.put("REQUESTED", req.getCreatedAt());
        }

        for (MaintenanceStatusHistory h : history) {
            if (h.getNewStatus() != null) {
                String s = h.getNewStatus().toUpperCase(Locale.ROOT);
                passedStatuses.add(s);
                statusTimes.putIfAbsent(s, h.getCreatedAt());
            }
        }

        String cur = req.getRequestStatus() != null ? req.getRequestStatus().toUpperCase(Locale.ROOT) : "REQUESTED";

        // 10 Steps Definition
        String[][] stepDefs = {
                {"1", "REQUESTED", "Request Created", "Maintenance ticket submitted by resident"},
                {"2", "ASSIGNED", "Worker Assigned", "Qualified maintenance worker assigned"},
                {"3", "WORKER_ACCEPTED", "Worker Accepted", "Worker confirmed task assignment"},
                {"4", "TRAVELLING", "Worker On The Way", "Worker is en route to unit"},
                {"5", "ARRIVED", "Worker Arrived", "Worker has arrived at location"},
                {"6", "IN_PROGRESS", "Work Started", "Maintenance service commenced"},
                {"7", "IN_PROGRESS_ACTIVE", "Work In Progress", "Active service work being performed"},
                {"8", "COMPLETED", "Work Completed", "Worker completed service tasks"},
                {"9", "RESIDENT_CONFIRMATION", "Resident Confirmation", "Awaiting resident confirmation"},
                {"10", "CLOSED", "Closed", "Request verified and closed"}
        };

        for (int i = 0; i < stepDefs.length; i++) {
            int order = i + 1;
            String key = stepDefs[i][1];
            String title = stepDefs[i][2];
            String desc = stepDefs[i][3];

            boolean isCompleted = false;
            boolean isActive = false;
            LocalDateTime time = statusTimes.get(key);

            if ("IN_PROGRESS_ACTIVE".equals(key)) {
                isCompleted = passedStatuses.contains("COMPLETED") || passedStatuses.contains("CLOSED");
                isActive = "IN_PROGRESS".equals(cur);
                time = statusTimes.get("IN_PROGRESS");
            } else {
                isCompleted = passedStatuses.contains(key) && !cur.equals(key);
                isActive = cur.equals(key);
                if (cur.equals(key)) {
                    isCompleted = false;
                }
            }

            steps.add(new TimelineStepDto(
                    order,
                    key,
                    title,
                    isCompleted,
                    isActive,
                    time,
                    time != null ? time.format(TIME_FORMATTER) : null,
                    desc
            ));
        }

        return steps;
    }

    private void recordStatusHistory(Long requestId, String oldStatus, String newStatus, String changedBy, String reason) {
        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(requestId);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setChangedBy(changedBy);
        history.setReason(reason);
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);
    }

    private Resident resolveResidentForUser(AppUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User is not authenticated");
        }
        return residentRepository.findFirstByUserOrderByIdAsc(user)
                .orElseGet(() -> {
                    Resident r = new Resident();
                    r.setUser(user);
                    r.setTenantId(user.getTenantId() != null ? user.getTenantId() : "default");
                    return residentRepository.save(r);
                });
    }

    private void validateAccess(MaintenanceRequest request, AppUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        boolean isStaffOrAdmin = user.getRole() == UserRole.FACILITY_MANAGER
                || user.getRole() == UserRole.SOCIETY_ADMIN
                || user.getRole() == UserRole.SUPER_ADMIN
                || user.getRole() == UserRole.MAINTENANCE_STAFF;

        if (!isStaffOrAdmin) {
            Resident resident = resolveResidentForUser(user);
            if (!resident.getId().equals(request.getResidentId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Request does not belong to you");
            }
        }
    }
}
