package com.smartapartment.dto;

import com.smartapartment.entity.MaintenanceRequest;
import com.smartapartment.entity.MaintenanceStatusHistory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class MaintenanceRequestDtos {

    public record CreateMaintenanceRequestDto(
            @NotBlank(message = "Service category is required")
            String category,

            @NotBlank(message = "Service type is required")
            String serviceType,

            @NotBlank(message = "Problem title is required")
            @Size(max = 200, message = "Problem title must not exceed 200 characters")
            String title,

            @NotBlank(message = "Description is required")
            @Size(max = 3000, message = "Description must not exceed 3000 characters")
            String description,

            @NotBlank(message = "Priority is required")
            String priority,

            String preferredDate,
            String preferredTime,
            String imageUrl,
            String notes,
            Long apartmentId
    ) {}

    public record UpdateMaintenanceRequestDto(
            String title,
            String description,
            String priority,
            String preferredDate,
            String preferredTime,
            String notes,
            String imageUrl,
            Long assignedWorkerId,
            String assignedWorkerName,
            String assignedWorkerPhone,
            String estimatedDuration,
            String estimatedEndTime,
            String status
    ) {}

    public record CancelRequestDto(
            String reason
    ) {}

    public record ReopenRequestDto(
            String reason
    ) {}

    public record StatusHistoryItemDto(
            Long id,
            Long requestId,
            String oldStatus,
            String newStatus,
            String changedBy,
            String reason,
            LocalDateTime createdAt
    ) {
        public static StatusHistoryItemDto from(MaintenanceStatusHistory entity) {
            return new StatusHistoryItemDto(
                    entity.getId(),
                    entity.getRequestId(),
                    entity.getOldStatus(),
                    entity.getNewStatus(),
                    entity.getChangedBy(),
                    entity.getReason(),
                    entity.getCreatedAt()
            );
        }
    }

    public record MaintenanceRequestResponseDto(
            Long id,
            String requestNumber,
            Long residentId,
            String residentName,
            String residentPhone,
            String residentEmail,
            Long societyId,
            String societyName,
            String tenantId,
            Long buildingId,
            String buildingName,
            Long apartmentId,
            String apartmentUnit,
            String category,
            String serviceType,
            String title,
            String description,
            String priority,
            String status,
            LocalDate preferredDate,
            String preferredTime,
            String imageUrl,
            String notes,
            Long assignedWorkerId,
            String assignedWorkerName,
            String assignedWorkerPhone,
            String estimatedDuration,
            LocalDateTime estimatedStartTime,
            LocalDateTime estimatedEndTime,
            LocalDateTime actualStartTime,
            LocalDateTime actualEndTime,
            LocalDateTime completedAt,
            LocalDateTime closedAt,
            LocalDateTime autoAssignDeadline,
            LocalDateTime workerResponseDeadline,
            Integer assignmentAttemptCount,
            String rejectionReason,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            int progressPercentage,
            boolean eligibleForCancellation,
            boolean eligibleForReopen,
            List<StatusHistoryItemDto> history
    ) {
        public static MaintenanceRequestResponseDto from(MaintenanceRequest req, List<MaintenanceStatusHistory> historyList) {
            List<StatusHistoryItemDto> historyDtos = (historyList == null) ? List.of()
                    : historyList.stream().map(StatusHistoryItemDto::from).toList();

            return new MaintenanceRequestResponseDto(
                    req.getId(),
                    req.getRequestNumber(),
                    req.getResidentId(),
                    req.getResidentName(),
                    req.getResidentPhone(),
                    req.getResidentEmail(),
                    req.getSocietyId(),
                    req.getSocietyName(),
                    req.getTenantId(),
                    req.getBuildingId(),
                    req.getBuildingName(),
                    req.getApartmentId(),
                    req.getApartmentUnit(),
                    req.getCategory(),
                    req.getServiceType(),
                    req.getTitle(),
                    req.getDescription(),
                    req.getPriority(),
                    req.getRequestStatus(),
                    req.getPreferredDate(),
                    req.getPreferredTime(),
                    req.getImageUrl(),
                    req.getNotes(),
                    req.getAssignedWorkerId(),
                    req.getAssignedWorkerName(),
                    req.getAssignedWorkerPhone(),
                    req.getEstimatedDuration(),
                    req.getEstimatedStartTime(),
                    req.getEstimatedEndTime(),
                    req.getActualStartTime(),
                    req.getActualEndTime(),
                    req.getCompletedAt(),
                    req.getClosedAt(),
                    req.getAutoAssignDeadline(),
                    req.getWorkerResponseDeadline(),
                    req.getAssignmentAttemptCount() != null ? req.getAssignmentAttemptCount() : 0,
                    req.getRejectionReason(),
                    req.getCreatedAt(),
                    req.getUpdatedAt(),
                    calculateProgress(req.getRequestStatus()),
                    req.isEligibleForCancellation(),
                    req.isEligibleForReopen(),
                    historyDtos
            );
        }

        private static int calculateProgress(String status) {
            if (status == null) return 10;
            return switch (status.toUpperCase()) {
                case "REQUESTED" -> 15;
                case "AUTO_ASSIGN_PENDING", "WAITING_FOR_WORKER" -> 25;
                case "ASSIGNED" -> 35;
                case "WORKER_ACCEPTED" -> 45;
                case "TRAVELLING" -> 55;
                case "ARRIVED" -> 65;
                case "IN_PROGRESS" -> 75;
                case "ON_HOLD" -> 60;
                case "RESIDENT_CONFIRMATION" -> 90;
                case "COMPLETED", "CLOSED" -> 100;
                case "REOPENED" -> 30;
                case "CANCELLED" -> 0;
                case "OVERDUE" -> 70;
                default -> 20;
            };
        }
    }
}
