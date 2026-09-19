package com.smartapartment.service;

import com.smartapartment.dto.MaintenanceRequestDtos.StatusHistoryItemDto;
import com.smartapartment.dto.WorkerTaskDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class WorkerTaskService {

    private static final Logger log = LoggerFactory.getLogger(WorkerTaskService.class);

    private final MaintenanceRequestRepository requestRepository;
    private final MaintenanceStatusHistoryRepository historyRepository;
    private final TaskPauseLogRepository pauseLogRepository;
    private final WorkerAvailabilityRepository availabilityRepository;
    private final WorkerAttendanceRepository attendanceRepository;
    private final AppUserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final AutoAssignmentService autoAssignmentService;
    private final MaintenanceTrackingService trackingService;

    public WorkerTaskService(
            MaintenanceRequestRepository requestRepository,
            MaintenanceStatusHistoryRepository historyRepository,
            TaskPauseLogRepository pauseLogRepository,
            WorkerAvailabilityRepository availabilityRepository,
            WorkerAttendanceRepository attendanceRepository,
            AppUserRepository userRepository,
            NotificationRepository notificationRepository,
            AutoAssignmentService autoAssignmentService,
            @org.springframework.context.annotation.Lazy MaintenanceTrackingService trackingService) {
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.pauseLogRepository = pauseLogRepository;
        this.availabilityRepository = availabilityRepository;
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.autoAssignmentService = autoAssignmentService;
        this.trackingService = trackingService;
    }

    /**
     * 1. Accept Task: ASSIGNED -> WORKER_ACCEPTED
     */
    @Transactional
    public WorkerTaskDetailDto acceptTask(Long id, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"ASSIGNED".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Task cannot be accepted from status: " + request.getRequestStatus());
        }

        request.setRequestStatus("WORKER_ACCEPTED");
        request.setWorkerResponseDeadline(null); // Clears response countdown
        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, currentStatus, "WORKER_ACCEPTED", worker.getFullName(),
                "Worker accepted the maintenance assignment.");

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_ACCEPTED", saved.getId(), saved.getRequestNumber(), "WORKER_ACCEPTED",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Worker " + worker.getFullName() + " accepted assignment", saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 2. Start Travel: WORKER_ACCEPTED -> TRAVELLING
     */
    @Transactional
    public WorkerTaskDetailDto startTravel(Long id, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"WORKER_ACCEPTED".equals(currentStatus) && !"ASSIGNED".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot start travel from status: " + request.getRequestStatus());
        }

        request.setRequestStatus("TRAVELLING");
        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, currentStatus, "TRAVELLING", worker.getFullName(),
                "Worker is travelling to resident location: " + request.getApartmentUnit() + " (" + request.getBuildingName() + ").");

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_TRAVELLING", saved.getId(), saved.getRequestNumber(), "TRAVELLING",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Worker " + worker.getFullName() + " is travelling to location", saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 3. Arrive: TRAVELLING -> ARRIVED
     */
    @Transactional
    public WorkerTaskDetailDto arriveAtLocation(Long id, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"TRAVELLING".equals(currentStatus) && !"WORKER_ACCEPTED".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot mark arrived from status: " + request.getRequestStatus());
        }

        request.setRequestStatus("ARRIVED");
        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, currentStatus, "ARRIVED", worker.getFullName(),
                "Worker arrived at resident unit: " + request.getApartmentUnit());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_ARRIVED", saved.getId(), saved.getRequestNumber(), "ARRIVED",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Worker " + worker.getFullName() + " arrived at location", saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 4. Start Work: ARRIVED / WORKER_ACCEPTED -> IN_PROGRESS
     * Sets actualStartTime and calculates estimatedEndTime.
     */
    @Transactional
    public WorkerTaskDetailDto startWork(Long id, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"ARRIVED".equals(currentStatus) && !"WORKER_ACCEPTED".equals(currentStatus) && !"TRAVELLING".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot start work from status: " + request.getRequestStatus());
        }

        LocalDateTime now = LocalDateTime.now();
        request.setActualStartTime(now);

        // Calculate estimatedEndTime using estimatedDuration
        int durationMinutes = parseEstimatedDuration(request.getEstimatedDuration(), request.getCategory());
        request.setEstimatedDuration(durationMinutes + " mins");
        request.setEstimatedStartTime(now);
        request.setEstimatedEndTime(now.plusMinutes(durationMinutes));

        request.setRequestStatus("IN_PROGRESS");
        MaintenanceRequest saved = requestRepository.save(request);

        // Update Worker Availability to BUSY
        WorkerAvailability av = getOrCreateAvailability(worker.getId(), worker.getTenantId());
        av.setStatus("BUSY");
        av.setCurrentTaskId(request.getId());
        av.setCurrentTaskNumber(request.getRequestNumber());
        av.setLastUpdatedAt(now);
        availabilityRepository.save(av);

        recordStatusHistory(id, currentStatus, "IN_PROGRESS", worker.getFullName(),
                "Work started. Expected completion: " + request.getEstimatedEndTime());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORK_STARTED", saved.getId(), saved.getRequestNumber(), "IN_PROGRESS",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Work started by " + worker.getFullName(), saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 5. Pause Work: IN_PROGRESS -> ON_HOLD
     * Stores pauseStart, reason, and updates availability.
     */
    @Transactional
    public WorkerTaskDetailDto pauseWork(Long id, PauseTaskRequestDto dto, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"IN_PROGRESS".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot pause work from status: " + request.getRequestStatus() + ". Task must be IN_PROGRESS.");
        }

        LocalDateTime now = LocalDateTime.now();
        request.setCurrentPauseStart(now);
        String reason = (dto != null && dto.reason() != null && !dto.reason().isBlank())
                ? dto.reason().trim() : "Other";
        request.setCurrentPauseReason(reason);
        request.setRequestStatus("ON_HOLD");

        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, currentStatus, "ON_HOLD", worker.getFullName(),
                "Work paused: " + reason);

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORK_PAUSED", saved.getId(), saved.getRequestNumber(), "ON_HOLD",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Work paused: " + reason, saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 5. Resume Work: ON_HOLD -> IN_PROGRESS
     * Stores pauseEnd, pauseDuration, accumulates totalPausedMinutes, extends estimatedEndTime.
     */
    @Transactional
    public WorkerTaskDetailDto resumeWork(Long id, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if (!"ON_HOLD".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot resume work from status: " + request.getRequestStatus() + ". Task must be ON_HOLD.");
        }

        LocalDateTime now = LocalDateTime.now();
        if (request.getCurrentPauseStart() != null) {
            int pauseMins = (int) Duration.between(request.getCurrentPauseStart(), now).toMinutes();
            request.setTotalPausedMinutes((request.getTotalPausedMinutes() != null ? request.getTotalPausedMinutes() : 0) + pauseMins);

            // Persist TaskPauseLog audit record
            TaskPauseLog logRecord = new TaskPauseLog();
            logRecord.setMaintenanceRequestId(request.getId());
            logRecord.setWorkerId(worker.getId());
            logRecord.setPauseStart(request.getCurrentPauseStart());
            logRecord.setPauseEnd(now);
            logRecord.setPauseDurationMinutes(pauseMins);
            logRecord.setReason(request.getCurrentPauseReason() != null ? request.getCurrentPauseReason() : "Pause resumed");
            logRecord.setTenantId(request.getTenantId());
            pauseLogRepository.save(logRecord);

            // Extend estimatedEndTime by paused duration
            if (request.getEstimatedEndTime() != null) {
                request.setEstimatedEndTime(request.getEstimatedEndTime().plusMinutes(pauseMins));
            }
        }

        request.setCurrentPauseStart(null);
        request.setCurrentPauseReason(null);
        request.setRequestStatus("IN_PROGRESS");

        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, currentStatus, "IN_PROGRESS", worker.getFullName(),
                "Work resumed. Updated expected completion: " + request.getEstimatedEndTime());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORK_RESUMED", saved.getId(), saved.getRequestNumber(), "IN_PROGRESS",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Work resumed by " + worker.getFullName(), saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 6. Complete Work: IN_PROGRESS / ON_HOLD -> COMPLETED
     * Stores actualEndTime, actualDuration (excluding paused time), completionNotes, before/after images.
     * Frees worker availability to AVAILABLE and triggers waiting queue.
     */
    @Transactional
    public WorkerTaskDetailDto completeWork(Long id, CompleteTaskRequestDto dto, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);
        String currentStatus = normalize(request.getRequestStatus());

        if ("COMPLETED".equals(currentStatus) || "CLOSED".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task is already completed.");
        }

        if (dto == null || dto.completionNotes() == null || dto.completionNotes().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completion notes are required to complete task.");
        }

        LocalDateTime now = LocalDateTime.now();

        // If currently on pause, close the pause
        if (request.getCurrentPauseStart() != null) {
            int pauseMins = (int) Duration.between(request.getCurrentPauseStart(), now).toMinutes();
            request.setTotalPausedMinutes((request.getTotalPausedMinutes() != null ? request.getTotalPausedMinutes() : 0) + pauseMins);

            TaskPauseLog logRecord = new TaskPauseLog();
            logRecord.setMaintenanceRequestId(request.getId());
            logRecord.setWorkerId(worker.getId());
            logRecord.setPauseStart(request.getCurrentPauseStart());
            logRecord.setPauseEnd(now);
            logRecord.setPauseDurationMinutes(pauseMins);
            logRecord.setReason(request.getCurrentPauseReason() != null ? request.getCurrentPauseReason() : "Completed during pause");
            logRecord.setTenantId(request.getTenantId());
            pauseLogRepository.save(logRecord);

            request.setCurrentPauseStart(null);
            request.setCurrentPauseReason(null);
        }

        request.setActualEndTime(now);
        request.setCompletedAt(now);

        // Net actual duration = (actualEndTime - actualStartTime) - totalPausedMinutes
        if (request.getActualStartTime() != null) {
            long totalMinutes = Duration.between(request.getActualStartTime(), now).toMinutes();
            int pausedMins = request.getTotalPausedMinutes() != null ? request.getTotalPausedMinutes() : 0;
            request.setActualDuration(Math.max(1, (int) totalMinutes - pausedMins));
        } else {
            request.setActualDuration(calculateDefaultDuration(request.getCategory()));
        }

        request.setCompletionNotes(dto.completionNotes().trim());
        if (dto.beforeImageUrl() != null && !dto.beforeImageUrl().isBlank()) {
            request.setBeforeImageUrl(dto.beforeImageUrl().trim());
        }
        if (dto.afterImageUrl() != null && !dto.afterImageUrl().isBlank()) {
            request.setAfterImageUrl(dto.afterImageUrl().trim());
        }

        request.setRequestStatus("COMPLETED");
        MaintenanceRequest saved = requestRepository.save(request);

        // Update Worker Availability to AVAILABLE
        WorkerAvailability av = getOrCreateAvailability(worker.getId(), worker.getTenantId());
        av.setStatus("AVAILABLE");
        av.setCurrentTaskId(null);
        av.setCurrentTaskNumber(null);
        av.setLastUpdatedAt(now);
        availabilityRepository.save(av);

        recordStatusHistory(id, currentStatus, "COMPLETED", worker.getFullName(),
                "Work completed. Notes: " + dto.completionNotes().trim());

        // Notify Resident
        if (request.getResidentId() != null) {
            sendNotification(request.getResidentId(), request.getTenantId(), "MAINTENANCE_COMPLETED",
                    "Maintenance Request Completed",
                    "Your maintenance request " + request.getRequestNumber() + " has been completed by " + worker.getFullName() + ".");
        }

        // Trigger waiting queue
        autoAssignmentService.processWaitingQueue(request.getTenantId());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORK_COMPLETED", saved.getId(), saved.getRequestNumber(), "COMPLETED",
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "Work completed by " + worker.getFullName(), saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 8. Delay Reason: Update estimated completion if delayed.
     */
    @Transactional
    public WorkerTaskDetailDto delayTask(Long id, DelayTaskRequestDto dto, AppUser worker) {
        MaintenanceRequest request = findAndAuthorizeTask(id, worker);

        if (dto == null || dto.delayReason() == null || dto.delayReason().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delay reason is required.");
        }
        if (dto.newEstimatedEndTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New estimated completion time is required.");
        }

        request.setEstimatedEndTime(dto.newEstimatedEndTime());
        request.setDelayReason(dto.delayReason().trim());
        MaintenanceRequest saved = requestRepository.save(request);

        recordStatusHistory(id, request.getRequestStatus(), "DELAY_REPORTED", worker.getFullName(),
                "ETA updated to " + dto.newEstimatedEndTime() + ". Reason: " + dto.delayReason().trim());

        // Notify Resident with updated ETA
        if (request.getResidentId() != null) {
            sendNotification(request.getResidentId(), request.getTenantId(), "MAINTENANCE_DELAY",
                    "Updated Completion Time",
                    "Technician " + worker.getFullName() + " updated the estimated completion for request " +
                            request.getRequestNumber() + " to " + dto.newEstimatedEndTime() + ". Reason: " + dto.delayReason().trim());
        }

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "ETA_UPDATED", saved.getId(), saved.getRequestNumber(), saved.getRequestStatus(),
                saved.getTenantId(), worker.getId(), worker.getFullName(), saved.getResidentId(),
                "ETA updated to " + dto.newEstimatedEndTime() + ": " + dto.delayReason().trim(), saved));

        return buildTaskDetailDto(saved);
    }

    /**
     * 1. Worker 'My Tasks' Dashboard query:
     * Current Task, Pending Tasks, Today's Tasks, Upcoming Tasks, Completed Tasks.
     */
    @Transactional(readOnly = true)
    public WorkerMyTasksResponseDto getMyTasks(AppUser worker) {
        List<MaintenanceRequest> allTasks = requestRepository.findByAssignedWorkerIdOrderByIdDesc(worker.getId());
        LocalDate today = LocalDate.now();

        WorkerTaskDetailDto currentTask = null;
        List<WorkerTaskDetailDto> pendingTasks = new ArrayList<>();
        List<WorkerTaskDetailDto> todayTasks = new ArrayList<>();
        List<WorkerTaskDetailDto> upcomingTasks = new ArrayList<>();
        List<WorkerTaskDetailDto> completedTasks = new ArrayList<>();

        for (MaintenanceRequest req : allTasks) {
            WorkerTaskDetailDto dto = buildTaskDetailDto(req);
            String status = normalize(req.getRequestStatus());

            // Today's tasks: touched today or preferred date today
            boolean isToday = (req.getActualStartTime() != null && req.getActualStartTime().toLocalDate().equals(today))
                    || (req.getPreferredDate() != null && req.getPreferredDate().equals(today))
                    || (req.getCreatedAt() != null && req.getCreatedAt().toLocalDate().equals(today));

            if (isToday) {
                todayTasks.add(dto);
            }

            if ("COMPLETED".equals(status) || "CLOSED".equals(status)) {
                if (req.getCompletedAt() != null && req.getCompletedAt().toLocalDate().equals(today)) {
                    completedTasks.add(dto);
                }
            } else if ("IN_PROGRESS".equals(status) || "ON_HOLD".equals(status)) {
                if (currentTask == null) currentTask = dto;
                else pendingTasks.add(dto);
            } else if ("ASSIGNED".equals(status) || "WORKER_ACCEPTED".equals(status)
                    || "TRAVELLING".equals(status) || "ARRIVED".equals(status)) {
                pendingTasks.add(dto);
                if (req.getPreferredDate() != null && req.getPreferredDate().isAfter(today)) {
                    upcomingTasks.add(dto);
                }
            }
        }

        return new WorkerMyTasksResponseDto(
                currentTask,
                pendingTasks,
                todayTasks,
                upcomingTasks,
                completedTasks
        );
    }

    /**
     * Get single task details with pause history and timeline.
     */
    @Transactional(readOnly = true)
    public WorkerTaskDetailDto getTaskDetails(Long id, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found with ID: " + id));

        // Authorization: worker must own task or be staff/admin
        if (user.getRole() == UserRole.MAINTENANCE_STAFF && !Objects.equals(request.getAssignedWorkerId(), user.getId())) {
            // Check if supervisor / admin
            String desig = user.getDesignation() != null ? user.getDesignation().toLowerCase(Locale.ROOT) : "";
            if (!desig.contains("supervisor") && !desig.contains("manager")) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized: You can only view tasks assigned to you.");
            }
        }

        return buildTaskDetailDto(request);
    }

    /**
     * 7. Overdue Check: Scheduled job every 30 seconds.
     * Flags tasks where now > estimatedEndTime and notifies manager.
     */
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void checkOverdueTasks() {
        LocalDateTime now = LocalDateTime.now();
        List<MaintenanceRequest> activeTasks = requestRepository.findAll().stream()
                .filter(r -> r.getEstimatedEndTime() != null
                        && now.isAfter(r.getEstimatedEndTime())
                        && !"COMPLETED".equalsIgnoreCase(r.getRequestStatus())
                        && !"CLOSED".equalsIgnoreCase(r.getRequestStatus())
                        && !"CANCELLED".equalsIgnoreCase(r.getRequestStatus()))
                .toList();

        for (MaintenanceRequest req : activeTasks) {
            int overdueMins = (int) Duration.between(req.getEstimatedEndTime(), now).toMinutes();
            boolean wasOverdue = Boolean.TRUE.equals(req.getIsOverdue());

            req.setIsOverdue(true);
            req.setOverdueMinutes(overdueMins);

            if (!wasOverdue) {
                recordStatusHistory(req.getId(), req.getRequestStatus(), "OVERDUE", "System Monitor",
                        "Task is overdue by " + overdueMins + " minutes. (Estimated end: " + req.getEstimatedEndTime() + ")");

                // Notify maintenance manager
                List<AppUser> managers = userRepository.findByRole(UserRole.SOCIETY_ADMIN);
                for (AppUser mgr : managers) {
                    sendNotification(mgr.getId(), req.getTenantId(), "TASK_OVERDUE",
                            "Maintenance Task Overdue: " + req.getRequestNumber(),
                            "Task " + req.getRequestNumber() + " (" + req.getTitle() + ") assigned to " +
                                    req.getAssignedWorkerName() + " is overdue by " + overdueMins + " minutes.");
                }

                trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                        "TASK_OVERDUE", req.getId(), req.getRequestNumber(), req.getRequestStatus(),
                        req.getTenantId(), req.getAssignedWorkerId(), req.getAssignedWorkerName(), req.getResidentId(),
                        "Task " + req.getRequestNumber() + " is overdue by " + overdueMins + " minutes", req));
            }
            requestRepository.save(req);
        }
    }

    private MaintenanceRequest findAndAuthorizeTask(Long id, AppUser worker) {
        MaintenanceRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found with ID: " + id));

        if (worker == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }

        // Security check: Worker can only update tasks assigned to them
        if (!Objects.equals(request.getAssignedWorkerId(), worker.getId())) {
            // Allow supervisor/admin override if needed
            String desig = worker.getDesignation() != null ? worker.getDesignation().toLowerCase(Locale.ROOT) : "";
            if (!desig.contains("supervisor") && !desig.contains("manager") && worker.getRole() != UserRole.SUPER_ADMIN && worker.getRole() != UserRole.SOCIETY_ADMIN) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Unauthorized: You can only update maintenance tasks assigned to you.");
            }
        }

        return request;
    }

    private WorkerTaskDetailDto buildTaskDetailDto(MaintenanceRequest req) {
        List<TaskPauseLog> pauses = pauseLogRepository.findByMaintenanceRequestIdOrderByPauseStartAsc(req.getId());
        List<StatusHistoryItemDto> history = historyRepository.findByRequestIdOrderByCreatedAtAsc(req.getId())
                .stream().map(StatusHistoryItemDto::from).toList();

        return WorkerTaskDetailDto.from(req, pauses, history);
    }

    private int parseEstimatedDuration(String durationStr, String category) {
        if (durationStr != null && !durationStr.isBlank()) {
            try {
                String num = durationStr.replaceAll("[^0-9]", "").trim();
                if (!num.isBlank()) {
                    return Integer.parseInt(num);
                }
            } catch (Exception ignored) {}
        }
        return calculateDefaultDuration(category);
    }

    private int calculateDefaultDuration(String category) {
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

    private WorkerAvailability getOrCreateAvailability(Long workerId, String tenantId) {
        return availabilityRepository.findByWorkerId(workerId)
                .orElseGet(() -> {
                    WorkerAvailability a = new WorkerAvailability();
                    a.setWorkerId(workerId);
                    a.setTenantId(tenantId);
                    a.setStatus("OFFLINE");
                    return a;
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
            log.warn("Failed to send notification to user {}: {}", userId, e.getMessage());
        }
    }

    private String normalize(String status) {
        return status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
    }
}
