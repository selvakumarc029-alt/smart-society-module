package com.smartapartment.dto;

import com.smartapartment.dto.MaintenanceRequestDtos.StatusHistoryItemDto;
import com.smartapartment.entity.MaintenanceRequest;
import com.smartapartment.entity.TaskPauseLog;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class WorkerTaskDtos {

    public record PauseTaskRequestDto(
            String reason
    ) {}

    public record CompleteTaskRequestDto(
            @NotBlank(message = "Completion notes are required")
            String completionNotes,
            String beforeImageUrl,
            String afterImageUrl
    ) {}

    public record DelayTaskRequestDto(
            @NotBlank(message = "Delay reason is required")
            String delayReason,
            @NotNull(message = "New estimated completion time is required")
            LocalDateTime newEstimatedEndTime
    ) {}

    public record TaskPauseLogDto(
            Long id,
            LocalDateTime pauseStart,
            LocalDateTime pauseEnd,
            int pauseDurationMinutes,
            String reason
    ) {
        public static TaskPauseLogDto from(TaskPauseLog entity) {
            int duration = entity.getPauseDurationMinutes() != null ? entity.getPauseDurationMinutes() : 0;
            if (duration == 0 && entity.getPauseStart() != null) {
                LocalDateTime end = entity.getPauseEnd() != null ? entity.getPauseEnd() : LocalDateTime.now();
                duration = (int) Duration.between(entity.getPauseStart(), end).toMinutes();
            }
            return new TaskPauseLogDto(
                    entity.getId(),
                    entity.getPauseStart(),
                    entity.getPauseEnd(),
                    Math.max(0, duration),
                    entity.getReason()
            );
        }
    }

    public record WorkerTaskDetailDto(
            Long id,
            String requestNumber,
            String residentName,
            String residentPhone,
            String apartmentUnit,
            String buildingName,
            String category,
            String serviceType,
            String title,
            String description,
            String priority,
            String status,
            Long assignedWorkerId,
            String assignedWorkerName,
            LocalDateTime assignedTime,
            String estimatedDuration,
            LocalDateTime estimatedStartTime,
            LocalDateTime estimatedEndTime,
            LocalDateTime actualStartTime,
            LocalDateTime actualEndTime,
            Integer actualDuration,
            int totalPausedMinutes,
            boolean isPaused,
            LocalDateTime currentPauseStart,
            String currentPauseReason,
            boolean isOverdue,
            int overdueMinutes,
            String completionNotes,
            String beforeImageUrl,
            String afterImageUrl,
            String delayReason,
            int elapsedMinutes,
            int remainingMinutes,
            LocalDate preferredDate,
            String preferredTime,
            List<TaskPauseLogDto> pauseHistory,
            List<StatusHistoryItemDto> statusHistory
    ) {
        public static WorkerTaskDetailDto from(
                MaintenanceRequest req,
                List<TaskPauseLog> pauses,
                List<StatusHistoryItemDto> history) {

            LocalDateTime now = LocalDateTime.now();
            boolean paused = "ON_HOLD".equalsIgnoreCase(req.getRequestStatus()) || req.getCurrentPauseStart() != null;

            // Calculate elapsed time (excluding paused time)
            int elapsed = 0;
            if (req.getActualStartTime() != null) {
                LocalDateTime end = req.getActualEndTime() != null ? req.getActualEndTime() : now;
                long totalElapsed = Duration.between(req.getActualStartTime(), end).toMinutes();
                int pausedMins = req.getTotalPausedMinutes() != null ? req.getTotalPausedMinutes() : 0;
                if (paused && req.getCurrentPauseStart() != null) {
                    pausedMins += (int) Duration.between(req.getCurrentPauseStart(), now).toMinutes();
                }
                elapsed = Math.max(0, (int) totalElapsed - pausedMins);
            }

            // Calculate remaining time and overdue
            int remaining = 0;
            boolean overdue = Boolean.TRUE.equals(req.getIsOverdue());
            int overdueMins = req.getOverdueMinutes() != null ? req.getOverdueMinutes() : 0;

            if (req.getEstimatedEndTime() != null && !"COMPLETED".equalsIgnoreCase(req.getRequestStatus()) && !"CLOSED".equalsIgnoreCase(req.getRequestStatus())) {
                if (now.isAfter(req.getEstimatedEndTime())) {
                    overdue = true;
                    overdueMins = (int) Duration.between(req.getEstimatedEndTime(), now).toMinutes();
                    remaining = 0;
                } else {
                    remaining = (int) Duration.between(now, req.getEstimatedEndTime()).toMinutes();
                }
            }

            List<TaskPauseLogDto> pauseDtos = (pauses == null) ? List.of()
                    : pauses.stream().map(TaskPauseLogDto::from).toList();

            return new WorkerTaskDetailDto(
                    req.getId(),
                    req.getRequestNumber(),
                    req.getResidentName(),
                    req.getResidentPhone(),
                    req.getApartmentUnit(),
                    req.getBuildingName(),
                    req.getCategory(),
                    req.getServiceType(),
                    req.getTitle(),
                    req.getDescription(),
                    req.getPriority(),
                    req.getRequestStatus(),
                    req.getAssignedWorkerId(),
                    req.getAssignedWorkerName(),
                    req.getCreatedAt(),
                    req.getEstimatedDuration(),
                    req.getEstimatedStartTime(),
                    req.getEstimatedEndTime(),
                    req.getActualStartTime(),
                    req.getActualEndTime(),
                    req.getActualDuration(),
                    req.getTotalPausedMinutes() != null ? req.getTotalPausedMinutes() : 0,
                    paused,
                    req.getCurrentPauseStart(),
                    req.getCurrentPauseReason(),
                    overdue,
                    overdueMins,
                    req.getCompletionNotes(),
                    req.getBeforeImageUrl(),
                    req.getAfterImageUrl(),
                    req.getDelayReason(),
                    elapsed,
                    remaining,
                    req.getPreferredDate(),
                    req.getPreferredTime(),
                    pauseDtos,
                    history != null ? history : List.of()
            );
        }
    }

    public record WorkerMyTasksResponseDto(
            WorkerTaskDetailDto currentTask,
            List<WorkerTaskDetailDto> pendingTasks,
            List<WorkerTaskDetailDto> todayTasks,
            List<WorkerTaskDetailDto> upcomingTasks,
            List<WorkerTaskDetailDto> completedTasks
    ) {}
}
