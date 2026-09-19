package com.smartapartment.dto;

import java.time.LocalDateTime;
import java.util.List;

public class RealTimeTrackingDtos {

    public record LiveTrackingCardDto(
            Long requestId,
            String requestNumber,
            String service,
            String problem,
            String description,
            Long assignedWorkerId,
            String assignedWorkerName,
            String assignedWorkerPhone,
            String currentStatus,
            String statusBadge,
            String priority,
            String apartmentUnit,
            String buildingName,
            String societyName,
            LocalDateTime createdAt,
            LocalDateTime estimatedStartTime,
            LocalDateTime estimatedEndTime,
            Integer remainingMinutes,
            String remainingTimeString,
            String latestActivity,
            Boolean isOverdue,
            Integer overdueMinutes,
            boolean canConfirm,
            boolean canReopen,
            boolean canCancel,
            List<TimelineStepDto> timeline,
            List<ActivityFeedItemDto> activities
    ) {}

    public record TimelineStepDto(
            int stepOrder,
            String stepKey,
            String title,
            boolean completed,
            boolean active,
            LocalDateTime timestamp,
            String formattedTime,
            String description
    ) {}

    public record ActivityFeedItemDto(
            LocalDateTime timestamp,
            String formattedTime,
            String actor,
            String oldStatus,
            String newStatus,
            String description
    ) {}

    public record ConfirmCompletionRequest(
            Integer rating,
            String feedback
    ) {}

    public record TrackingEventDto(
            String eventType,
            Long requestId,
            String requestNumber,
            String status,
            String tenantId,
            Long workerId,
            String workerName,
            Long residentId,
            String message,
            LocalDateTime timestamp,
            Object payload
    ) {
        public static TrackingEventDto of(String eventType, Long requestId, String requestNumber,
                                          String status, String tenantId, Long workerId, String workerName,
                                          Long residentId, String message, Object payload) {
            return new TrackingEventDto(eventType, requestId, requestNumber, status, tenantId,
                    workerId, workerName, residentId, message, LocalDateTime.now(), payload);
        }
    }
}
