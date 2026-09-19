package com.smartapartment.service;

import com.smartapartment.dto.WorkerAttendanceDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
public class WorkerAttendanceService {

    private final WorkerAttendanceRepository attendanceRepository;
    private final WorkerAvailabilityRepository availabilityRepository;
    private final AppUserRepository userRepository;
    private final MaintenanceRequestRepository requestRepository;
    private final AutoAssignmentService autoAssignmentService;
    private final MaintenanceTrackingService trackingService;

    public WorkerAttendanceService(
            WorkerAttendanceRepository attendanceRepository,
            WorkerAvailabilityRepository availabilityRepository,
            AppUserRepository userRepository,
            MaintenanceRequestRepository requestRepository,
            AutoAssignmentService autoAssignmentService,
            @org.springframework.context.annotation.Lazy MaintenanceTrackingService trackingService) {
        this.attendanceRepository = attendanceRepository;
        this.availabilityRepository = availabilityRepository;
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.autoAssignmentService = autoAssignmentService;
        this.trackingService = trackingService;
    }

    @Transactional
    public WorkerAttendanceResponseDto clockIn(AppUser user, ClockInRequest request) {
        validateWorkerAccess(user);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(user.getId(), today)
                .orElseGet(() -> {
                    WorkerAttendance a = new WorkerAttendance();
                    a.setWorkerId(user.getId());
                    a.setTenantId(user.getTenantId());
                    a.setDate(today);
                    return a;
                });

        // Determine shift
        String shiftId = (request != null && request.shiftId() != null && !request.shiftId().isBlank())
                ? request.shiftId().trim().toUpperCase(Locale.ROOT)
                : (user.getWorkShift() != null ? user.getWorkShift().trim().toUpperCase(Locale.ROOT) : "GENERAL");
        WorkerShift shift = WorkerShift.fromString(shiftId);
        attendance.setShiftId(shift.name());

        // Determine status (PRESENT or LATE)
        String status = "PRESENT";
        if (shift.getStartTime() != null && now.toLocalTime().isAfter(shift.getStartTime().plusMinutes(15))) {
            status = "LATE";
        }
        attendance.setAttendanceStatus(status);
        attendance.setClockIn(now);
        attendance.setClockOut(null);
        attendance.setBreakStart(null);
        attendance.setBreakEnd(null);
        if (request != null && request.notes() != null) {
            attendance.setNotes(request.notes().trim());
        }

        WorkerAttendance saved = attendanceRepository.save(attendance);

        // Update availability to AVAILABLE
        WorkerAvailability availability = getOrCreateAvailability(user.getId(), user.getTenantId());
        availability.setStatus("AVAILABLE");
        availability.setCurrentTaskId(null);
        availability.setCurrentTaskNumber(null);
        availability.setLastUpdatedAt(now);
        availabilityRepository.save(availability);

        // Process waiting queue now that worker is available
        autoAssignmentService.processWaitingQueue(user.getTenantId());

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_AVAILABLE", null, null, "AVAILABLE",
                user.getTenantId(), user.getId(), user.getFullName(), null,
                "Worker " + user.getFullName() + " clocked in and is AVAILABLE", null));

        return WorkerAttendanceResponseDto.from(saved, user.getFullName());
    }

    @Transactional
    public WorkerAttendanceResponseDto clockOut(AppUser user, ClockOutRequest request) {
        validateWorkerAccess(user);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(user.getId(), today)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active attendance record found for today. Please clock in first."));

        if (attendance.getClockIn() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot clock out without clocking in first.");
        }

        // If currently on break, close the break
        if (attendance.getBreakStart() != null && attendance.getBreakEnd() == null) {
            attendance.setBreakEnd(now);
        }

        attendance.setClockOut(now);

        // Calculate total working minutes = (clockOut - clockIn) - breakDuration
        int netMinutes = calculateNetMinutes(attendance.getClockIn(), now, attendance.getBreakStart(), attendance.getBreakEnd());
        attendance.setTotalWorkingMinutes(netMinutes);

        // Status
        if (netMinutes < 240 && netMinutes > 0) {
            attendance.setAttendanceStatus("HALF_DAY");
        } else {
            attendance.setAttendanceStatus("CLOCKED_OUT");
        }

        if (request != null && request.notes() != null && !request.notes().isBlank()) {
            attendance.setNotes(request.notes().trim());
        }

        WorkerAttendance saved = attendanceRepository.save(attendance);

        // Update availability to OFFLINE
        WorkerAvailability availability = getOrCreateAvailability(user.getId(), user.getTenantId());
        availability.setStatus("OFFLINE");
        availability.setCurrentTaskId(null);
        availability.setCurrentTaskNumber(null);
        availability.setLastUpdatedAt(now);
        availabilityRepository.save(availability);

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_OFFLINE", null, null, "OFFLINE",
                user.getTenantId(), user.getId(), user.getFullName(), null,
                "Worker " + user.getFullName() + " clocked out and is OFFLINE", null));

        return WorkerAttendanceResponseDto.from(saved, user.getFullName());
    }

    @Transactional
    public WorkerAttendanceResponseDto startBreak(AppUser user, BreakRequest request) {
        validateWorkerAccess(user);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(user.getId(), today)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active attendance record found for today. Please clock in first."));

        if (attendance.getClockIn() == null || attendance.getClockOut() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Worker is not currently clocked in.");
        }

        if (attendance.getBreakStart() != null && attendance.getBreakEnd() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Worker is already on break.");
        }

        attendance.setBreakStart(now);
        attendance.setBreakEnd(null);
        if (request != null && request.notes() != null) {
            attendance.setNotes(request.notes().trim());
        }

        WorkerAttendance saved = attendanceRepository.save(attendance);

        // Update availability to ON_BREAK
        WorkerAvailability availability = getOrCreateAvailability(user.getId(), user.getTenantId());
        availability.setStatus("ON_BREAK");
        availability.setLastUpdatedAt(now);
        availabilityRepository.save(availability);

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "WORKER_BUSY", null, null, "ON_BREAK",
                user.getTenantId(), user.getId(), user.getFullName(), null,
                "Worker " + user.getFullName() + " started break", null));

        return WorkerAttendanceResponseDto.from(saved, user.getFullName());
    }

    @Transactional
    public WorkerAttendanceResponseDto endBreak(AppUser user, BreakRequest request) {
        validateWorkerAccess(user);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(user.getId(), today)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active attendance record found for today."));

        if (attendance.getBreakStart() == null || attendance.getBreakEnd() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Worker is not currently on break.");
        }

        attendance.setBreakEnd(now);
        if (request != null && request.notes() != null) {
            attendance.setNotes(request.notes().trim());
        }

        WorkerAttendance saved = attendanceRepository.save(attendance);

        // Update availability
        WorkerAvailability availability = getOrCreateAvailability(user.getId(), user.getTenantId());
        if (availability.getCurrentTaskId() != null) {
            availability.setStatus("BUSY");
        } else {
            availability.setStatus("AVAILABLE");
        }
        availability.setLastUpdatedAt(now);
        availabilityRepository.save(availability);

        if ("AVAILABLE".equals(availability.getStatus())) {
            autoAssignmentService.processWaitingQueue(user.getTenantId());
        }

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "AVAILABLE".equals(availability.getStatus()) ? "WORKER_AVAILABLE" : "WORKER_BUSY",
                null, null, availability.getStatus(),
                user.getTenantId(), user.getId(), user.getFullName(), null,
                "Worker " + user.getFullName() + " ended break (Status: " + availability.getStatus() + ")", null));

        return WorkerAttendanceResponseDto.from(saved, user.getFullName());
    }

    @Transactional(readOnly = true)
    public WorkerAttendanceResponseDto getWorkerAttendance(Long workerId, LocalDate date, AppUser requester) {
        authorizeWorkerInspection(workerId, requester);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        AppUser worker = userRepository.findById(workerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker not found with ID: " + workerId));

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(workerId, targetDate)
                .orElse(null);

        return WorkerAttendanceResponseDto.from(attendance, worker.getFullName());
    }

    @Transactional(readOnly = true)
    public WorkerAvailabilityResponseDto getWorkerAvailability(Long workerId, AppUser requester) {
        authorizeWorkerInspection(workerId, requester);
        AppUser worker = userRepository.findById(workerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker not found with ID: " + workerId));

        WorkerAvailability availability = availabilityRepository.findByWorkerId(workerId)
                .orElseGet(() -> {
                    WorkerAvailability a = new WorkerAvailability();
                    a.setWorkerId(workerId);
                    a.setTenantId(worker.getTenantId());
                    a.setStatus("OFFLINE");
                    return a;
                });

        return WorkerAvailabilityResponseDto.from(availability, worker.getFullName());
    }

    @Transactional
    public WorkerAvailabilityResponseDto updateWorkerAvailability(Long workerId, UpdateAvailabilityRequest request, AppUser requester) {
        authorizeWorkerInspection(workerId, requester);
        if (request == null || request.status() == null || request.status().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Availability status is required.");
        }

        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("AVAILABLE", "BUSY", "ON_BREAK", "OFFLINE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid availability status: " + status);
        }

        AppUser worker = userRepository.findById(workerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker not found with ID: " + workerId));

        WorkerAvailability availability = getOrCreateAvailability(workerId, worker.getTenantId());
        availability.setStatus(status);
        if (request.currentTaskId() != null) {
            availability.setCurrentTaskId(request.currentTaskId());
            availability.setCurrentTaskNumber(request.currentTaskNumber());
        } else if ("AVAILABLE".equals(status) || "OFFLINE".equals(status)) {
            availability.setCurrentTaskId(null);
            availability.setCurrentTaskNumber(null);
        }
        availability.setLastUpdatedAt(LocalDateTime.now());

        WorkerAvailability saved = availabilityRepository.save(availability);
        return WorkerAvailabilityResponseDto.from(saved, worker.getFullName());
    }

    @Transactional(readOnly = true)
    public WorkerDashboardSummaryDto getWorkerDashboardSummary(AppUser user) {
        LocalDate today = LocalDate.now();
        Long workerId = user.getId();

        WorkerAttendance attendance = attendanceRepository
                .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(workerId, today)
                .orElse(null);

        WorkerAvailability availability = availabilityRepository.findByWorkerId(workerId)
                .orElseGet(() -> {
                    WorkerAvailability a = new WorkerAvailability();
                    a.setWorkerId(workerId);
                    a.setTenantId(user.getTenantId());
                    a.setStatus("OFFLINE");
                    return a;
                });

        // Working hours calculations
        WorkingHoursSummaryDto workingHours = calculateWorkingHoursSummary(workerId, today, attendance);

        // Tasks assigned to worker
        List<MaintenanceRequest> allWorkerTasks = requestRepository.findByAssignedWorkerIdOrderByIdDesc(workerId);

        WorkerTaskDto currentTask = null;
        List<WorkerTaskDto> pendingTasks = new ArrayList<>();
        List<WorkerTaskDto> completedTasks = new ArrayList<>();
        List<WorkerTaskDto> upcomingTasks = new ArrayList<>();

        for (MaintenanceRequest req : allWorkerTasks) {
            WorkerTaskDto dto = new WorkerTaskDto(
                    req.getId(),
                    req.getRequestNumber(),
                    req.getTitle(),
                    req.getCategory(),
                    req.getPriority(),
                    req.getRequestStatus(),
                    req.getApartmentUnit(),
                    req.getPreferredTime(),
                    req.getWorkerResponseDeadline()
            );

            String status = req.getRequestStatus() != null ? req.getRequestStatus().toUpperCase(Locale.ROOT) : "";
            if ("COMPLETED".equals(status) || "CLOSED".equals(status)) {
                completedTasks.add(dto);
            } else if ("IN_PROGRESS".equals(status) || (availability.getCurrentTaskId() != null && availability.getCurrentTaskId().equals(req.getId()))) {
                if (currentTask == null) currentTask = dto;
                else pendingTasks.add(dto);
            } else if ("ASSIGNED".equals(status) || "WORKER_ACCEPTED".equals(status) || "REQUESTED".equals(status)) {
                pendingTasks.add(dto);
                if (req.getPreferredDate() != null && !req.getPreferredDate().isBefore(today)) {
                    upcomingTasks.add(dto);
                }
            }
        }

        return new WorkerDashboardSummaryDto(
                WorkerAttendanceResponseDto.from(attendance, user.getFullName()),
                WorkerAvailabilityResponseDto.from(availability, user.getFullName()),
                currentTask,
                pendingTasks,
                completedTasks,
                upcomingTasks,
                workingHours
        );
    }

    @Transactional(readOnly = true)
    public List<ManagerWorkerAttendanceViewDto> listAttendances(LocalDate date, AppUser requester) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        String tenantId = requester.getTenantId();

        List<AppUser> workers;
        if (tenantId == null || "platform".equalsIgnoreCase(tenantId)) {
            workers = userRepository.findByRole(UserRole.MAINTENANCE_STAFF);
        } else {
            workers = userRepository.findByTenantIdAndRole(tenantId, UserRole.MAINTENANCE_STAFF);
        }

        List<ManagerWorkerAttendanceViewDto> views = new ArrayList<>();
        for (AppUser worker : workers) {
            WorkerAttendance attendance = attendanceRepository
                    .findFirstByWorkerIdAndDateOrderByCreatedAtDesc(worker.getId(), targetDate)
                    .orElse(null);

            WorkerAvailability availability = availabilityRepository.findByWorkerId(worker.getId())
                    .orElse(null);

            int todayMinutes = 0;
            if (attendance != null) {
                if (attendance.getTotalWorkingMinutes() != null && attendance.getTotalWorkingMinutes() > 0) {
                    todayMinutes = attendance.getTotalWorkingMinutes();
                } else if (attendance.getClockIn() != null) {
                    LocalDateTime end = attendance.getClockOut() != null ? attendance.getClockOut() : LocalDateTime.now();
                    todayMinutes = calculateNetMinutes(attendance.getClockIn(), end, attendance.getBreakStart(), attendance.getBreakEnd());
                }
            }

            String hoursStr = (todayMinutes / 60) + "h " + (todayMinutes % 60) + "m";
            String taskNumber = availability != null ? availability.getCurrentTaskNumber() : null;
            Long taskId = availability != null ? availability.getCurrentTaskId() : null;
            String taskTitle = null;
            if (taskId != null) {
                taskTitle = requestRepository.findById(taskId).map(MaintenanceRequest::getTitle).orElse(null);
            }

            views.add(new ManagerWorkerAttendanceViewDto(
                    worker.getId(),
                    worker.getFullName(),
                    worker.getEmployeeId(),
                    worker.getEmail(),
                    worker.getDesignation() != null ? worker.getDesignation() : "General Maintenance",
                    worker.getWorkShift() != null ? worker.getWorkShift() : "General Shift",
                    attendance != null && attendance.getAttendanceStatus() != null ? attendance.getAttendanceStatus() : "OFFLINE",
                    attendance != null ? attendance.getClockIn() : null,
                    attendance != null ? attendance.getClockOut() : null,
                    hoursStr,
                    availability != null && availability.getStatus() != null ? availability.getStatus() : "OFFLINE",
                    taskId,
                    taskNumber,
                    taskTitle
            ));
        }

        return views;
    }

    @Transactional
    public void assignTaskToWorker(Long workerId, Long taskId, String taskNumber) {
        if (workerId == null) return;
        AppUser worker = userRepository.findById(workerId).orElse(null);
        if (worker == null) return;

        WorkerAvailability availability = getOrCreateAvailability(workerId, worker.getTenantId());
        availability.setStatus("BUSY");
        availability.setCurrentTaskId(taskId);
        availability.setCurrentTaskNumber(taskNumber);
        availability.setLastUpdatedAt(LocalDateTime.now());
        availabilityRepository.save(availability);
    }

    @Transactional
    public void releaseTaskFromWorker(Long workerId, Long taskId) {
        if (workerId == null) return;
        availabilityRepository.findByWorkerId(workerId).ifPresent(availability -> {
            if (Objects.equals(availability.getCurrentTaskId(), taskId)) {
                availability.setCurrentTaskId(null);
                availability.setCurrentTaskNumber(null);
                availability.setLastUpdatedAt(LocalDateTime.now());

                // Check attendance
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

                if ("AVAILABLE".equals(availability.getStatus())) {
                    autoAssignmentService.processWaitingQueue(availability.getTenantId());
                }
            }
        });
    }

    /**
     * Rule 9: Find eligible worker for auto-assignment.
     * Worker must NOT be automatically assigned if: ABSENT, ON_LEAVE, CLOCKED_OUT, OFFLINE, ON_BREAK.
     * Worker can be automatically assigned only when: PRESENT + AVAILABLE + Correct skill + Within shift.
     */
    @Transactional(readOnly = true)
    public Optional<AppUser> findEligibleWorkerForAutoAssignment(String category, String tenantId) {
        List<AppUser> workers;
        if (tenantId == null || "platform".equalsIgnoreCase(tenantId)) {
            workers = userRepository.findByRole(UserRole.MAINTENANCE_STAFF);
        } else {
            workers = userRepository.findByTenantIdAndRole(tenantId, UserRole.MAINTENANCE_STAFF);
        }

        LocalTime now = LocalTime.now();
        LocalDate today = LocalDate.now();

        for (AppUser worker : workers) {
            // 1. Skill check
            if (!isSkillMatching(worker.getDesignation(), category)) {
                continue;
            }

            // 2. Attendance check (Must be PRESENT or LATE, not CLOCKED_OUT / OFFLINE / ON_LEAVE / ABSENT)
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

            // 3. Shift check (Within shift window: use active attendance shift if clocked in, else worker.getWorkShift())
            String shiftStr = (attendance.getShiftId() != null && !attendance.getShiftId().isBlank())
                    ? attendance.getShiftId() : worker.getWorkShift();
            WorkerShift shift = WorkerShift.fromString(shiftStr);
            if (!shift.isWithinShift(now)) {
                continue;
            }

            // 4. Availability check (Must be AVAILABLE, not BUSY / ON_BREAK / OFFLINE)
            WorkerAvailability availability = availabilityRepository.findByWorkerId(worker.getId())
                    .orElse(null);
            if (availability == null || !"AVAILABLE".equalsIgnoreCase(availability.getStatus())) {
                continue;
            }

            return Optional.of(worker);
        }

        return Optional.empty();
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
        return desig.contains(cat) || cat.contains(desig);
    }

    private WorkingHoursSummaryDto calculateWorkingHoursSummary(Long workerId, LocalDate today, WorkerAttendance todayAttendance) {
        // Today's minutes
        int todayMinutes = 0;
        if (todayAttendance != null) {
            if (todayAttendance.getTotalWorkingMinutes() != null && todayAttendance.getTotalWorkingMinutes() > 0) {
                todayMinutes = todayAttendance.getTotalWorkingMinutes();
            } else if (todayAttendance.getClockIn() != null) {
                LocalDateTime end = todayAttendance.getClockOut() != null ? todayAttendance.getClockOut() : LocalDateTime.now();
                todayMinutes = calculateNetMinutes(todayAttendance.getClockIn(), end, todayAttendance.getBreakStart(), todayAttendance.getBreakEnd());
            }
        }

        // Weekly minutes (last 7 days)
        LocalDate weekStart = today.minusDays(6);
        List<WorkerAttendance> weeklyRecords = attendanceRepository.findByWorkerIdAndDateBetweenOrderByDateDesc(workerId, weekStart, today);
        int weeklyMinutes = sumWorkingMinutes(weeklyRecords, today, todayMinutes);

        // Monthly minutes (last 30 days)
        LocalDate monthStart = today.minusDays(29);
        List<WorkerAttendance> monthlyRecords = attendanceRepository.findByWorkerIdAndDateBetweenOrderByDateDesc(workerId, monthStart, today);
        int monthlyMinutes = sumWorkingMinutes(monthlyRecords, today, todayMinutes);

        return WorkingHoursSummaryDto.of(todayMinutes, weeklyMinutes, monthlyMinutes);
    }

    private int sumWorkingMinutes(List<WorkerAttendance> records, LocalDate today, int todayMinutes) {
        int sum = 0;
        boolean includedToday = false;
        for (WorkerAttendance r : records) {
            if (r.getDate().equals(today)) {
                sum += todayMinutes;
                includedToday = true;
            } else if (r.getTotalWorkingMinutes() != null) {
                sum += r.getTotalWorkingMinutes();
            }
        }
        if (!includedToday && todayMinutes > 0) {
            sum += todayMinutes;
        }
        return sum;
    }

    private int calculateNetMinutes(LocalDateTime clockIn, LocalDateTime clockOut, LocalDateTime breakStart, LocalDateTime breakEnd) {
        if (clockIn == null || clockOut == null || clockOut.isBefore(clockIn)) {
            return 0;
        }
        long totalMinutes = Duration.between(clockIn, clockOut).toMinutes();
        long breakMinutes = 0;
        if (breakStart != null) {
            LocalDateTime effectiveBreakEnd = breakEnd != null ? breakEnd : clockOut;
            if (effectiveBreakEnd.isAfter(breakStart)) {
                breakMinutes = Duration.between(breakStart, effectiveBreakEnd).toMinutes();
            }
        }
        return Math.max(0, (int) (totalMinutes - breakMinutes));
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

    private void validateWorkerAccess(AppUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required.");
        }
    }

    private void authorizeWorkerInspection(Long workerId, AppUser requester) {
        if (requester == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required.");
        }
        // Worker can inspect their own
        if (Objects.equals(requester.getId(), workerId)) {
            return;
        }
        // Staff manager / admin can inspect workers in same tenant
        if (requester.getRole() == UserRole.SUPER_ADMIN || requester.getRole() == UserRole.SOCIETY_ADMIN
                || requester.getRole() == UserRole.MAINTENANCE_STAFF) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized to access this worker's attendance.");
    }
}
