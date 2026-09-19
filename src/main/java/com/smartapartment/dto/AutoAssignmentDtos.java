package com.smartapartment.dto;

import com.smartapartment.entity.AutoAssignmentConfig;
import com.smartapartment.entity.MaintenanceRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class AutoAssignmentDtos {

    public record AutoAssignmentConfigDto(
            Long id,
            String tenantId,
            int autoAssignmentDelayMinutes,
            int workerResponseTimeoutMinutes,
            int maxActiveTasks,
            int emergencyDelayMinutes,
            int defaultServiceDurationMinutes,
            int overdueThresholdHours
    ) {
        public static AutoAssignmentConfigDto from(AutoAssignmentConfig entity) {
            if (entity == null) {
                return new AutoAssignmentConfigDto(null, null, 5, 5, 1, 0, 60, 24);
            }
            return new AutoAssignmentConfigDto(
                    entity.getId(),
                    entity.getTenantId(),
                    entity.getAutoAssignmentDelayMinutes() != null ? entity.getAutoAssignmentDelayMinutes() : 5,
                    entity.getWorkerResponseTimeoutMinutes() != null ? entity.getWorkerResponseTimeoutMinutes() : 5,
                    entity.getMaxActiveTasks() != null ? entity.getMaxActiveTasks() : 1,
                    entity.getEmergencyDelayMinutes() != null ? entity.getEmergencyDelayMinutes() : 0,
                    entity.getDefaultServiceDurationMinutes() != null ? entity.getDefaultServiceDurationMinutes() : 60,
                    entity.getOverdueThresholdHours() != null ? entity.getOverdueThresholdHours() : 24
            );
        }
    }

    public record UpdateAutoAssignmentConfigDto(
            @NotNull(message = "Auto assignment delay is required")
            @Min(value = 1, message = "Delay must be at least 1 minute")
            @Max(value = 60, message = "Delay cannot exceed 60 minutes")
            Integer autoAssignmentDelayMinutes,

            @NotNull(message = "Worker response timeout is required")
            @Min(value = 1, message = "Timeout must be at least 1 minute")
            @Max(value = 60, message = "Timeout cannot exceed 60 minutes")
            Integer workerResponseTimeoutMinutes,

            @Min(value = 1, message = "Max active tasks must be at least 1")
            Integer maxActiveTasks,

            Integer emergencyDelayMinutes,

            Integer defaultServiceDurationMinutes,

            Integer overdueThresholdHours
    ) {}

    public record WorkerRejectRequestDto(
            @NotBlank(message = "Rejection reason is required")
            String reason
    ) {}

    public record ManualReassignRequestDto(
            Long targetWorkerId,
            String reason
    ) {}

    public record WaitingQueueItemDto(
            Long id,
            String requestNumber,
            String category,
            String serviceType,
            String title,
            String priority,
            String status,
            String apartmentUnit,
            LocalDate preferredDate,
            String preferredTime,
            LocalDateTime createdAt,
            int priorityRank
    ) {
        public static WaitingQueueItemDto from(MaintenanceRequest req) {
            int rank = switch (req.getPriority() == null ? "" : req.getPriority().toUpperCase()) {
                case "URGENT" -> 1;
                case "HIGH" -> 2;
                case "MEDIUM" -> 3;
                case "LOW" -> 4;
                default -> 5;
            };

            return new WaitingQueueItemDto(
                    req.getId(),
                    req.getRequestNumber(),
                    req.getCategory(),
                    req.getServiceType(),
                    req.getTitle(),
                    req.getPriority(),
                    req.getRequestStatus(),
                    req.getApartmentUnit(),
                    req.getPreferredDate(),
                    req.getPreferredTime(),
                    req.getCreatedAt(),
                    rank
            );
        }
    }
}
