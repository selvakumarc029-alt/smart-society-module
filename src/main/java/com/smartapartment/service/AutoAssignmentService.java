package com.smartapartment.service;

import com.smartapartment.dto.AutoAssignmentDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
public class AutoAssignmentService {

    private static final Logger log = LoggerFactory.getLogger(AutoAssignmentService.class);

    private final MaintenanceRequestRepository requestRepository;
    private final MaintenanceStatusHistoryRepository historyRepository;
    private final WorkerAvailabilityRepository availabilityRepository;
    private final WorkerAttendanceRepository attendanceRepository;
    private final AppUserRepository userRepository;
    private final AutoAssignmentConfigRepository configRepository;
    private final WorkerTaskRejectionRepository rejectionRepository;
    private final NotificationRepository notificationRepository;
    private final MaintenanceTrackingService trackingService;

    public AutoAssignmentService(
            MaintenanceRequestRepository requestRepository,
            MaintenanceStatusHistoryRepository historyRepository,
            WorkerAvailabilityRepository availabilityRepository,
            WorkerAttendanceRepository attendanceRepository,
            AppUserRepository userRepository,
            AutoAssignmentConfigRepository configRepository,
            WorkerTaskRejectionRepository rejectionRepository,
            NotificationRepository notificationRepository,
            @org.springframework.context.annotation.Lazy MaintenanceTrackingService trackingService) {
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.availabilityRepository = availabilityRepository;
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.configRepository = configRepository;
        this.rejectionRepository = rejectionRepository;
        this.notificationRepository = notificationRepository;
        this.trackingService = trackingService;
    }

    /**
     * 1. Schedule Assignment for a newly created request.
     * URGENT requests bypass the delay and assign immediately.
     */
    @Transactional
    public void scheduleAssignment(MaintenanceRequest request) {
        if (request == null) return;

        AutoAssignmentConfig config = getOrCreateConfig(request.getTenantId());
        String priority = request.getPriority() != null ? request.getPriority().toUpperCase(Locale.ROOT) : "MEDIUM";

        if ("URGENT".equals(priority)) {
            log.info("Urgent request {} bypasses auto-assignment delay. Searching for workers immediately.", request.getRequestNumber());
            request.setAutoAssignDeadline(null);
            assignNextEligibleWorker(request);
        } else {
            int delayMinutes = (config.getAutoAssignmentDelayMinutes() != null && config.getAutoAssignmentDelayMinutes() > 0)
                    ? config.getAutoAssignmentDelayMinutes() : 5;
            LocalDateTime deadline = LocalDateTime.now().plusMinutes(delayMinutes);
            request.setAutoAssignDeadline(deadline);
            request.setRequestStatus("AUTO_ASSIGN_PENDING");
            requestRepository.save(request);

            recordStatusHistory(request.getId(), "REQUESTED", "AUTO_ASSIGN_PENDING", "Auto-Assignment Engine",
                    "Auto-assignment scheduled in " + delayMinutes + " minutes (Deadline: " + deadline + ")");
            log.info("Request {} scheduled for auto-assignment in {} minutes (at {})", request.getRequestNumber(), delayMinutes, deadline);

            trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                    "AUTO_ASSIGNMENT_PENDING",
                    request.getId(),
                    request.getRequestNumber(),
                    "AUTO_ASSIGN_PENDING",
                    request.getTenantId(),
                    null,
                    null,
                    request.getResidentId(),
                    "Auto-assignment scheduled in " + delayMinutes + " minutes",
                    request
            ));
        }
    }

    /**
     * Attempts to find and assign the best qualified and available worker.
     * If no worker is available, sets status to WAITING_FOR_WORKER and queues request.
     */
    @Transactional
    public Optional<AppUser> assignNextEligibleWorker(MaintenanceRequest request) {
        if (request == null) return Optional.empty();

        List<AppUser> qualifiedWorkers = findQualifiedWorkers(request);
        List<AppUser> availableWorkers = filterAvailableWorkers(qualifiedWorkers, request);

        if (availableWorkers.isEmpty()) {
            log.warn("No available qualified workers for request {} (category: {}). Enqueuing as WAITING_FOR_WORKER.",
                    request.getRequestNumber(), request.getCategory());
            String oldStatus = request.getRequestStatus();
            request.setRequestStatus("WAITING_FOR_WORKER");
            request.setAutoAssignDeadline(null);
            requestRepository.save(request);

            if (!"WAITING_FOR_WORKER".equalsIgnoreCase(oldStatus)) {
                recordStatusHistory(request.getId(), oldStatus, "WAITING_FOR_WORKER", "Auto-Assignment Engine",
                        "No qualified workers currently available. Added to waiting queue.");
            }

            trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                    "AUTO_ASSIGNMENT_PENDING",
                    request.getId(),
                    request.getRequestNumber(),
                    "WAITING_FOR_WORKER",
                    request.getTenantId(),
                    null,
                    null,
                    request.getResidentId(),
                    "No qualified workers currently available. Added to waiting queue.",
                    request
            ));

            return Optional.empty();
        }

        AppUser selectedWorker = selectWorker(availableWorkers, request);
        boolean assigned = assignWorker(request, selectedWorker, "AUTO");
        if (assigned) {
            return Optional.of(selectedWorker);
        }

        // If assignment failed due to race condition, try another available worker
        for (AppUser candidate : availableWorkers) {
            if (!candidate.getId().equals(selectedWorker.getId())) {
                if (assignWorker(request, candidate, "AUTO")) {
                    return Optional.of(candidate);
                }
            }
        }

        // Still no worker assigned
        request.setRequestStatus("WAITING_FOR_WORKER");
        request.setAutoAssignDeadline(null);
        requestRepository.save(request);
        return Optional.empty();
    }

    /**
     * 3. Qualified Worker Filter:
     * Matches category to worker skill/designation.
     * Excludes workers who previously rejected this request.
     */
    @Transactional(readOnly = true)
    public List<AppUser> findQualifiedWorkers(MaintenanceRequest request) {
        String tenantId = request.getTenantId();
        List<AppUser> allWorkers;
        if (tenantId == null || "platform".equalsIgnoreCase(tenantId)) {
            allWorkers = userRepository.findByRole(UserRole.MAINTENANCE_STAFF);
        } else {
            allWorkers = userRepository.findByTenantIdAndRole(tenantId, UserRole.MAINTENANCE_STAFF);
        }

        List<AppUser> qualified = new ArrayList<>();
        for (AppUser worker : allWorkers) {
            // Exclude if worker already rejected this request
            if (rejectionRepository.existsByMaintenanceRequestIdAndWorkerId(request.getId(), worker.getId())) {
                continue;
            }

            if (isSkillMatching(worker.getDesignation(), request.getCategory())) {
                qualified.add(worker);
            }
        }
        return qualified;
    }

    /**
     * 4 & 5. Availability & Busy Worker Filter:
     * - Attendance = PRESENT or LATE (clocked in today, not clocked out)
     * - Availability = AVAILABLE (not BUSY, ON_BREAK, OFFLINE)
     * - Within Shift = TRUE
     * - Worker not on leave / break / offline
     */
    @Transactional(readOnly = true)
    public List<AppUser> filterAvailableWorkers(List<AppUser> workers, MaintenanceRequest request) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        List<AppUser> available = new ArrayList<>();

        for (AppUser worker : workers) {
            // Check attendance
            WorkerAttendance attendance = attendanceRepository
                    .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(worker.getId(), today)
                    .orElse(null);

            if (attendance == null || attendance.getClockIn() == null || attendance.getClockOut() != null) {
                continue;
            }

            String attStatus = attendance.getAttendanceStatus() != null ? attendance.getAttendanceStatus().toUpperCase(Locale.ROOT) : "";
            if (!"PRESENT".equals(attStatus) && !"LATE".equals(attStatus)) {
                continue;
            }

            // Check shift
            String shiftStr = (attendance.getShiftId() != null && !attendance.getShiftId().isBlank())
                    ? attendance.getShiftId() : worker.getWorkShift();
            WorkerShift shift = WorkerShift.fromString(shiftStr);
            if (!shift.isWithinShift(now)) {
                continue;
            }

            // Check availability
            WorkerAvailability availability = availabilityRepository.findByWorkerId(worker.getId()).orElse(null);
            if (availability == null || !"AVAILABLE".equalsIgnoreCase(availability.getStatus())) {
                continue;
            }

            // Check active task count (never assign to busy worker)
            if (availability.getCurrentTaskId() != null) {
                continue;
            }

            available.add(worker);
        }

        return available;
    }

    /**
     * 6. Workload Balancing Score Calculation:
     * - Active tasks (-50 pts per task)
     * - Today's completed tasks (-10 pts per task)
     * - Exact skill match affinity (+30 pts for exact, +10 for general technician)
     * - Location / Building proximity (+20 pts if working in same building)
     */
    public double calculateWorkerScore(AppUser worker, MaintenanceRequest request) {
        double score = 100.0;

        // 1. Active tasks
        List<MaintenanceRequest> workerTasks = requestRepository.findByAssignedWorkerIdOrderByIdDesc(worker.getId());
        long activeCount = workerTasks.stream()
                .filter(t -> "ASSIGNED".equalsIgnoreCase(t.getRequestStatus())
                        || "WORKER_ACCEPTED".equalsIgnoreCase(t.getRequestStatus())
                        || "IN_PROGRESS".equalsIgnoreCase(t.getRequestStatus()))
                .count();
        score -= (activeCount * 50.0);

        // 2. Today's completed tasks
        LocalDate today = LocalDate.now();
        long completedToday = workerTasks.stream()
                .filter(t -> "COMPLETED".equalsIgnoreCase(t.getRequestStatus())
                        && t.getCompletedAt() != null
                        && t.getCompletedAt().toLocalDate().equals(today))
                .count();
        score -= (completedToday * 10.0);

        // 3. Skill match affinity
        String desig = worker.getDesignation() != null ? worker.getDesignation().toLowerCase(Locale.ROOT) : "";
        String cat = request.getCategory() != null ? request.getCategory().toLowerCase(Locale.ROOT) : "";
        if (desig.contains(cat) || (cat.contains("plumb") && desig.contains("plumb"))
                || (cat.contains("electr") && desig.contains("electr"))
                || (cat.contains("carpent") && desig.contains("carpent"))
                || (cat.contains("clean") && (desig.contains("clean") || desig.contains("housekeep")))
                || (cat.contains("ac") && (desig.contains("ac") || desig.contains("hvac")))) {
            score += 30.0;
        } else {
            score += 10.0; // General technician
        }

        // 4. Building / Location proximity
        if (request.getBuildingId() != null) {
            boolean sameBuilding = workerTasks.stream()
                    .anyMatch(t -> Objects.equals(t.getBuildingId(), request.getBuildingId())
                            && ("ASSIGNED".equalsIgnoreCase(t.getRequestStatus()) || "IN_PROGRESS".equalsIgnoreCase(t.getRequestStatus())));
            if (sameBuilding) {
                score += 20.0;
            }
        }

        return score;
    }

    /**
     * Selects worker with the highest workload balancing score.
     */
    public AppUser selectWorker(List<AppUser> eligibleWorkers, MaintenanceRequest request) {
        return eligibleWorkers.stream()
                .max(Comparator.comparingDouble((AppUser w) -> calculateWorkerScore(w, request))
                        .thenComparing(AppUser::getId, Comparator.reverseOrder()))
                .orElse(eligibleWorkers.get(0));
    }

    /**
     * 13. Race Condition Protection & 14. Service Duration Assignment:
     * Uses pessimistic write lock on WorkerAvailability.
     */
    @Transactional
    public boolean assignWorker(MaintenanceRequest request, AppUser worker, String assignmentType) {
        // Acquire pessimistic write lock on WorkerAvailability
        Optional<WorkerAvailability> optAvailability = availabilityRepository.findByWorkerIdWithLock(worker.getId());
        if (optAvailability.isEmpty()) {
            return false;
        }

        WorkerAvailability availability = optAvailability.get();
        if (!"AVAILABLE".equalsIgnoreCase(availability.getStatus()) || availability.getCurrentTaskId() != null) {
            log.warn("Race condition prevented: Worker {} is no longer available (status: {}, currentTask: {})",
                    worker.getFullName(), availability.getStatus(), availability.getCurrentTaskId());
            return false;
        }

        // 14. Service Duration Calculation
        int durationMinutes = calculateEstimatedDuration(request.getCategory());
        LocalDateTime now = LocalDateTime.now();
        request.setEstimatedDuration(durationMinutes + " mins");
        request.setEstimatedStartTime(now);
        request.setEstimatedEndTime(now.plusMinutes(durationMinutes));

        // Get response timeout from config
        AutoAssignmentConfig config = getOrCreateConfig(request.getTenantId());
        int timeoutMinutes = (config.getWorkerResponseTimeoutMinutes() != null && config.getWorkerResponseTimeoutMinutes() > 0)
                ? config.getWorkerResponseTimeoutMinutes() : 5;

        String oldStatus = request.getRequestStatus();
        request.setAssignedWorkerId(worker.getId());
        request.setAssignedWorkerName(worker.getFullName());
        request.setAssignedWorkerPhone(worker.getPhone());
        request.setRequestStatus("ASSIGNED");
        request.setAutoAssignDeadline(null);
        request.setWorkerResponseDeadline(now.plusMinutes(timeoutMinutes));
        request.setAssignmentAttemptCount((request.getAssignmentAttemptCount() == null ? 0 : request.getAssignmentAttemptCount()) + 1);

        requestRepository.save(request);

        // Update WorkerAvailability to BUSY
        availability.setStatus("BUSY");
        availability.setCurrentTaskId(request.getId());
        availability.setCurrentTaskNumber(request.getRequestNumber());
        availability.setLastUpdatedAt(now);
        availabilityRepository.save(availability);

        // Record history
        String initiator = "AUTO".equalsIgnoreCase(assignmentType) ? "Auto-Assignment Engine" : "Admin";
        recordStatusHistory(request.getId(), oldStatus, "ASSIGNED", initiator,
                "Assigned to " + worker.getFullName() + " (" + worker.getDesignation() + "). Acceptance timeout: " + timeoutMinutes + " minutes.");

        // 17. Send Notifications
        sendNotification(worker.getId(), request.getTenantId(), "MAINTENANCE_ASSIGNMENT",
                "New Maintenance Assignment",
                "You have a new maintenance request: " + request.getRequestNumber() + " (" + request.getTitle() + ").");

        if (request.getResidentId() != null) {
            sendNotification(request.getResidentId(), request.getTenantId(), "MAINTENANCE_UPDATE",
                    "Technician Assigned",
                    "Worker " + worker.getFullName() + " has been assigned to your maintenance request " + request.getRequestNumber() + ".");
        }

        log.info("Request {} successfully assigned to worker {} (attempt: {})",
                request.getRequestNumber(), worker.getFullName(), request.getAssignmentAttemptCount());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_ASSIGNED",
                request.getId(),
                request.getRequestNumber(),
                "ASSIGNED",
                request.getTenantId(),
                worker.getId(),
                worker.getFullName(),
                request.getResidentId(),
                "Worker " + worker.getFullName() + " assigned to request " + request.getRequestNumber(),
                request
        ));

        return true;
    }

    /**
     * 10. Worker Accepts Assignment.
     */
    @Transactional
    public void handleWorkerAccept(Long requestId, AppUser worker) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found: " + requestId));

        if (!Objects.equals(request.getAssignedWorkerId(), worker.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to this request.");
        }

        String oldStatus = request.getRequestStatus();
        request.setRequestStatus("WORKER_ACCEPTED");
        request.setWorkerResponseDeadline(null); // Clear timeout
        requestRepository.save(request);

        recordStatusHistory(requestId, oldStatus, "WORKER_ACCEPTED", worker.getFullName(),
                "Worker accepted the maintenance assignment.");

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_ACCEPTED",
                request.getId(),
                request.getRequestNumber(),
                "WORKER_ACCEPTED",
                request.getTenantId(),
                worker.getId(),
                worker.getFullName(),
                request.getResidentId(),
                "Worker " + worker.getFullName() + " accepted assignment",
                request
        ));
    }

    /**
     * 11. Worker Rejects Assignment.
     * Records rejection audit and automatically reassigns to next worker.
     */
    @Transactional
    public void handleWorkerReject(Long requestId, String reason, AppUser worker) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found: " + requestId));

        if (!Objects.equals(request.getAssignedWorkerId(), worker.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to this request.");
        }

        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rejection reason is required.");
        }

        // Record rejection
        WorkerTaskRejection rejection = new WorkerTaskRejection();
        rejection.setWorkerId(worker.getId());
        rejection.setWorkerName(worker.getFullName());
        rejection.setMaintenanceRequestId(requestId);
        rejection.setRequestNumber(request.getRequestNumber());
        rejection.setReason(reason.trim());
        rejection.setRejectedAt(LocalDateTime.now());
        rejection.setTenantId(request.getTenantId());
        rejectionRepository.save(rejection);

        request.setRejectionReason(reason.trim());

        // Release task from rejecting worker
        releaseWorkerAvailability(worker.getId(), requestId);

        recordStatusHistory(requestId, request.getRequestStatus(), "REJECTED_BY_WORKER", worker.getFullName(),
                "Worker rejected assignment. Reason: " + reason.trim());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_REJECTED",
                request.getId(),
                request.getRequestNumber(),
                "REJECTED_BY_WORKER",
                request.getTenantId(),
                worker.getId(),
                worker.getFullName(),
                request.getResidentId(),
                "Worker " + worker.getFullName() + " rejected assignment: " + reason,
                request
        ));

        // Reassign
        reassignWorker(requestId, "Worker rejection: " + reason.trim(), worker);
    }

    /**
     * 12. Reassignment:
     * Finds next available qualified worker, excluding previous rejecters.
     */
    @Transactional
    public void reassignWorker(Long requestId, String reason, AppUser initiator) {
        MaintenanceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found: " + requestId));

        if (request.getAssignedWorkerId() != null) {
            releaseWorkerAvailability(request.getAssignedWorkerId(), requestId);
        }

        String initiatorName = initiator != null ? initiator.getFullName() : "Auto-Assignment Engine";
        recordStatusHistory(requestId, request.getRequestStatus(), "REASSIGNING", initiatorName,
                "Reassignment triggered: " + reason);

        request.setAssignedWorkerId(null);
        request.setAssignedWorkerName(null);
        request.setAssignedWorkerPhone(null);
        request.setWorkerResponseDeadline(null);

        Optional<AppUser> nextWorker = assignNextEligibleWorker(request);
        if (nextWorker.isPresent()) {
            if (request.getResidentId() != null) {
                sendNotification(request.getResidentId(), request.getTenantId(), "MAINTENANCE_UPDATE",
                        "Technician Reassigned",
                        "Your maintenance request " + request.getRequestNumber() + " has been reassigned to another available technician: " + nextWorker.get().getFullName() + ".");
            }
        }
    }

    /**
     * 7 & 8. Process Waiting Queue:
     * Orders waiting requests by Priority: URGENT > HIGH > MEDIUM > LOW, then createdAt ASC (FIFO).
     */
    @Transactional
    public void processWaitingQueue(String tenantId) {
        List<MaintenanceRequest> waitingRequests;
        if (tenantId == null || "platform".equalsIgnoreCase(tenantId)) {
            waitingRequests = requestRepository.findAll().stream()
                    .filter(r -> "WAITING_FOR_WORKER".equalsIgnoreCase(r.getRequestStatus()))
                    .toList();
        } else {
            waitingRequests = requestRepository.findByTenantIdAndRequestStatusInOrderByCreatedAtDesc(tenantId, List.of("WAITING_FOR_WORKER"));
        }

        if (waitingRequests.isEmpty()) return;

        // Sort by priority order, then FIFO
        List<MaintenanceRequest> sorted = new ArrayList<>(waitingRequests);
        sorted.sort(Comparator.comparingInt((MaintenanceRequest r) -> getPriorityRank(r.getPriority()))
                .thenComparing(MaintenanceRequest::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));

        log.info("Processing waiting queue with {} requests (tenant: {})", sorted.size(), tenantId);
        for (MaintenanceRequest req : sorted) {
            Optional<AppUser> assigned = assignNextEligibleWorker(req);
            if (assigned.isEmpty()) {
                // If we could not assign this request, subsequent requests of same category might also not find workers,
                // but other categories might still find workers. So we continue.
            }
        }
    }

    /**
     * Scheduled Job: Run every 10 seconds.
     * 1. Checks requests in AUTO_ASSIGN_PENDING whose autoAssignDeadline has passed.
     * 2. Checks requests in ASSIGNED whose workerResponseDeadline has passed without acceptance.
     */
    @Scheduled(fixedDelay = 10000)
    @Transactional
    public void runPeriodicAutoAssignmentChecks() {
        LocalDateTime now = LocalDateTime.now();

        // 1. Process pending auto assignments
        List<MaintenanceRequest> pendingRequests = requestRepository.findAll().stream()
                .filter(r -> "AUTO_ASSIGN_PENDING".equalsIgnoreCase(r.getRequestStatus())
                        && r.getAutoAssignDeadline() != null
                        && !r.getAutoAssignDeadline().isAfter(now))
                .toList();

        for (MaintenanceRequest req : pendingRequests) {
            try {
                log.info("Countdown expired for request {}. Triggering auto-assignment.", req.getRequestNumber());
                assignNextEligibleWorker(req);
            } catch (Exception e) {
                log.error("Error auto-assigning pending request {}: {}", req.getRequestNumber(), e.getMessage());
            }
        }

        // 2. Process worker response timeouts
        List<MaintenanceRequest> timedOutRequests = requestRepository.findAll().stream()
                .filter(r -> "ASSIGNED".equalsIgnoreCase(r.getRequestStatus())
                        && r.getWorkerResponseDeadline() != null
                        && !r.getWorkerResponseDeadline().isAfter(now))
                .toList();

        for (MaintenanceRequest req : timedOutRequests) {
            try {
                log.warn("Worker response timeout expired for request {} (worker: {}). Reassigning.",
                        req.getRequestNumber(), req.getAssignedWorkerName());

                if (req.getAssignedWorkerId() != null) {
                    WorkerTaskRejection timeoutRecord = new WorkerTaskRejection();
                    timeoutRecord.setWorkerId(req.getAssignedWorkerId());
                    timeoutRecord.setWorkerName(req.getAssignedWorkerName());
                    timeoutRecord.setMaintenanceRequestId(req.getId());
                    timeoutRecord.setRequestNumber(req.getRequestNumber());
                    timeoutRecord.setReason("Worker response timeout expired");
                    timeoutRecord.setRejectedAt(LocalDateTime.now());
                    timeoutRecord.setTenantId(req.getTenantId());
                    rejectionRepository.save(timeoutRecord);
                }

                recordStatusHistory(req.getId(), "ASSIGNED", "WORKER_TIMEOUT", "Auto-Assignment Engine",
                        "Worker response timeout expired (" + req.getAssignedWorkerName() + " did not respond).");
                reassignWorker(req.getId(), "Worker response timeout expired", null);
            } catch (Exception e) {
                log.error("Error processing timeout for request {}: {}", req.getRequestNumber(), e.getMessage());
            }
        }
    }

    /**
     * Configuration Management
     */
    @Transactional(readOnly = true)
    public AutoAssignmentConfigDto getConfig(String tenantId) {
        return AutoAssignmentConfigDto.from(getOrCreateConfig(tenantId));
    }

    @Transactional
    public AutoAssignmentConfigDto updateConfig(String tenantId, UpdateAutoAssignmentConfigDto dto) {
        AutoAssignmentConfig config = getOrCreateConfig(tenantId);
        if (dto.autoAssignmentDelayMinutes() != null) config.setAutoAssignmentDelayMinutes(dto.autoAssignmentDelayMinutes());
        if (dto.workerResponseTimeoutMinutes() != null) config.setWorkerResponseTimeoutMinutes(dto.workerResponseTimeoutMinutes());
        if (dto.maxActiveTasks() != null) config.setMaxActiveTasks(dto.maxActiveTasks());
        if (dto.emergencyDelayMinutes() != null) config.setEmergencyDelayMinutes(dto.emergencyDelayMinutes());
        if (dto.defaultServiceDurationMinutes() != null) config.setDefaultServiceDurationMinutes(dto.defaultServiceDurationMinutes());
        if (dto.overdueThresholdHours() != null) config.setOverdueThresholdHours(dto.overdueThresholdHours());

        AutoAssignmentConfig saved = configRepository.save(config);
        return AutoAssignmentConfigDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<WaitingQueueItemDto> getWaitingQueue(String tenantId) {
        List<MaintenanceRequest> list;
        if (tenantId == null || "platform".equalsIgnoreCase(tenantId)) {
            list = requestRepository.findAll().stream()
                    .filter(r -> "WAITING_FOR_WORKER".equalsIgnoreCase(r.getRequestStatus()))
                    .toList();
        } else {
            list = requestRepository.findByTenantIdAndRequestStatusInOrderByCreatedAtDesc(tenantId, List.of("WAITING_FOR_WORKER"));
        }

        return list.stream()
                .sorted(Comparator.comparingInt((MaintenanceRequest r) -> getPriorityRank(r.getPriority()))
                        .thenComparing(MaintenanceRequest::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(WaitingQueueItemDto::from)
                .toList();
    }

    private AutoAssignmentConfig getOrCreateConfig(String tenantId) {
        String effectiveTenant = (tenantId == null || tenantId.isBlank()) ? "default" : tenantId;
        return configRepository.findFirstByTenantIdOrderByCreatedAtDesc(effectiveTenant)
                .orElseGet(() -> {
                    AutoAssignmentConfig c = new AutoAssignmentConfig();
                    c.setTenantId(effectiveTenant);
                    c.setAutoAssignmentDelayMinutes(5);
                    c.setWorkerResponseTimeoutMinutes(5);
                    c.setMaxActiveTasks(1);
                    c.setEmergencyDelayMinutes(0);
                    c.setDefaultServiceDurationMinutes(60);
                    c.setOverdueThresholdHours(24);
                    return configRepository.save(c);
                });
    }

    private int getPriorityRank(String priority) {
        if (priority == null) return 4;
        return switch (priority.toUpperCase(Locale.ROOT)) {
            case "URGENT" -> 1;
            case "HIGH" -> 2;
            case "MEDIUM" -> 3;
            case "LOW" -> 4;
            default -> 5;
        };
    }

    public int calculateEstimatedDuration(String category) {
        if (category == null) return 60;
        String cat = category.trim().toLowerCase(Locale.ROOT);
        if (cat.contains("plumb") || cat.contains("water")) return 90;
        if (cat.contains("electr") || cat.contains("appliance") || cat.contains("lift")) return 60;
        if (cat.contains("clean") || cat.contains("housekeep")) return 60;
        if (cat.contains("carpent")) return 120;
        if (cat.contains("ac") || cat.contains("cooling") || cat.contains("hvac")) return 120;
        if (cat.contains("paint")) return 240;
        return 60;
    }

    private boolean isSkillMatching(String workerDesignation, String category) {
        if (workerDesignation == null || workerDesignation.isBlank() || category == null || category.isBlank()) {
            return false;
        }
        String desig = workerDesignation.trim().toLowerCase(Locale.ROOT);
        String cat = category.trim().toLowerCase(Locale.ROOT);

        if (desig.contains("technician") || desig.contains("supervisor") || desig.contains("general")) {
            return true;
        }
        if (desig.contains("plumb") && (cat.contains("plumb") || cat.contains("water"))) {
            return true;
        }
        if (desig.contains("electr") && (cat.contains("electr") || cat.contains("appliance") || cat.contains("lift"))) {
            return true;
        }
        if (desig.contains("carpent") && cat.contains("carpent")) {
            return true;
        }
        if (desig.contains("hvac") && (cat.contains("ac") || cat.contains("cooling"))) {
            return true;
        }
        if (desig.contains("housekeep") && cat.contains("clean")) {
            return true;
        }
        if (desig.contains("paint") && cat.contains("paint")) {
            return true;
        }
        return desig.contains(cat) || cat.contains(desig);
    }

    private void releaseWorkerAvailability(Long workerId, Long taskId) {
        if (workerId == null) return;
        availabilityRepository.findByWorkerId(workerId).ifPresent(availability -> {
            if (Objects.equals(availability.getCurrentTaskId(), taskId)) {
                availability.setCurrentTaskId(null);
                availability.setCurrentTaskNumber(null);
                availability.setLastUpdatedAt(LocalDateTime.now());

                WorkerAttendance attendance = attendanceRepository
                        .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(workerId, LocalDate.now())
                        .orElse(null);

                if (attendance != null && attendance.getClockIn() != null && attendance.getClockOut() == null) {
                    if (attendance.getBreakStart() != null && attendance.getBreakEnd() == null) {
                        availability.setStatus("ON_BREAK");
                    } else {
                        availability.setStatus("AVAILABLE");
                    }
                } else {
                    availability.setStatus("OFFLINE");
                }
                availabilityRepository.save(availability);
            }
        });
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

    private void sendNotification(Long userId, String tenantId, String type, String title, String message) {
        try {
            Notification n = new Notification();
            n.setUserId(userId);
            n.setTenantId(tenantId != null ? tenantId : "default");
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setReadStatus(false);
            notificationRepository.save(n);
        } catch (Exception e) {
            log.warn("Failed to create notification for user {}: {}", userId, e.getMessage());
        }
    }
}
