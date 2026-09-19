package com.smartapartment.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class MaintenanceManagerDtos {

    public record ManagerDashboardSummaryDto(
            // 11 Dashboard KPI Cards
            long totalRequests,
            long newRequests,
            long waitingRequests,
            long assignedRequests,
            long travellingRequests,
            long inProgressRequests,
            long completedTodayRequests,
            long overdueRequests,
            long availableWorkers,
            long busyWorkers,
            long workersOnLeave,

            // Live Board & Queue Data
            Map<String, List<ManagerQueueItemDto>> kanbanColumns,
            List<ManagerWorkerBoardItemDto> workerBoard,
            List<ManagerAlertDto> recentAlerts,
            ManagerAnalyticsDto analytics
    ) {}

    public record ManagerQueueItemDto(
            Long requestId,
            String requestNumber,
            String residentName,
            String residentPhone,
            String flat,
            String building,
            String service,
            String category,
            String priority,
            LocalDateTime createdAt,
            String formattedCreatedAt,
            LocalDateTime autoAssignTime,
            String formattedAutoAssignTime,
            Long workerId,
            String workerName,
            String workerPhone,
            String status,
            String statusLabel,
            LocalDateTime eta,
            String formattedEta,
            Integer remainingMinutes,
            String remainingTimeString,
            Boolean isOverdue,
            Integer overdueMinutes,
            Integer reassignmentCount,
            String delayReason
    ) {}

    public record ManagerWorkerBoardItemDto(
            Long workerId,
            String workerName,
            String workerPhone,
            String skill,
            String workShift,
            String attendanceStatus,    // PRESENT, ABSENT, LATE, ON_LEAVE, HALF_DAY, OFFLINE
            String availabilityStatus,  // AVAILABLE, BUSY, ON_BREAK, OFFLINE
            Long currentRequestId,
            String currentRequestNumber,
            String currentStatus,
            LocalDateTime startedTime,
            String formattedStartedTime,
            LocalDateTime expectedCompletionTime,
            String formattedExpectedCompletionTime,
            Integer remainingMinutes,
            String remainingTimeString,
            String colorStatus,         // 🟢 AVAILABLE, 🟡 BUSY, 🔵 TRAVELLING, 🟣 WORKING, 🟠 ON BREAK, 🔴 OFFLINE, ⚫ ABSENT, ⚠ OVERDUE
            String colorBadgeClass,
            boolean isOverdue
    ) {}

    public record ManagerAlertDto(
            Long id,
            String alertType, // EMERGENCY_REQUEST, NO_WORKER_AVAILABLE, WORKER_REJECTION, WORKER_TIMEOUT, WORKER_UNAVAILABLE, TASK_OVERDUE, REQUEST_REOPENED, MULTIPLE_REASSIGNMENTS
            String title,
            String message,
            String severity, // HIGH, WARNING, INFO
            Long requestId,
            String requestNumber,
            Long workerId,
            String workerName,
            LocalDateTime timestamp,
            String formattedTime
    ) {}

    public record ManagerAnalyticsDto(
            String avgAssignmentTime,     // e.g. "4m 30s"
            Double avgAssignmentMinutes,
            String avgResponseTime,       // e.g. "6m 15s"
            Double avgResponseMinutes,
            String avgCompletionTime,     // e.g. "1h 20m"
            Double avgCompletionMinutes,
            double workerUtilizationRate, // e.g. 78.5%
            double attendanceRate,        // e.g. 92.0%
            double overdueRate,           // e.g. 8.0%
            long totalRequests,
            long completedRequests,
            long overdueRequests,
            long reassignedRequests,
            Map<String, Long> requestsByCategory,
            Map<String, Long> requestsByBuilding,
            Map<String, Long> requestsByPriority
    ) {}

    // Manual Management Actions
    public record AssignWorkerAction(
            Long workerId,
            String notes
    ) {}

    public record ReassignWorkerAction(
            Long workerId,
            String reason
    ) {}

    public record ChangePriorityAction(
            String priority,
            String reason
    ) {}

    public record ChangeEtaAction(
            LocalDateTime newEta,
            Integer additionalMinutes,
            String reason
    ) {}

    public record PutOnHoldAction(
            String reason
    ) {}

    public record ResumeAction(
            String notes
    ) {}

    public record CancelRequestAction(
            String reason
    ) {}

    public record OverrideAssignmentAction(
            Long workerId,
            String justification
    ) {}

    public record CloseRequestAction(
            String resolutionNotes
    ) {}

    public record QueueFilterParams(
            String status,
            String priority,
            String category,
            Long workerId,
            String building,
            LocalDate date
    ) {}
}
