package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "maintenance_requests")
public class MaintenanceRequest extends BaseEntity {

    @Column(name = "request_number", nullable = false, unique = true, length = 64)
    private String requestNumber;

    @Column(name = "resident_id", nullable = false)
    private Long residentId;

    @Column(name = "resident_name", length = 160)
    private String residentName;

    @Column(name = "resident_phone", length = 40)
    private String residentPhone;

    @Column(name = "resident_email", length = 160)
    private String residentEmail;

    @Column(name = "society_id")
    private Long societyId;

    @Column(name = "society_name", length = 180)
    private String societyName;

    @Column(name = "building_id")
    private Long buildingId;

    @Column(name = "building_name", length = 120)
    private String buildingName;

    @Column(name = "apartment_id")
    private Long apartmentId;

    @Column(name = "apartment_unit", length = 80)
    private String apartmentUnit;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(name = "service_type", nullable = false, length = 120)
    private String serviceType;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 3000)
    private String description;

    @Column(nullable = false, length = 30)
    private String priority; // LOW, MEDIUM, HIGH, URGENT

    @Column(name = "request_status", nullable = false, length = 50)
    private String requestStatus = "REQUESTED";

    @Column(name = "preferred_date")
    private LocalDate preferredDate;

    @Column(name = "preferred_time", length = 80)
    private String preferredTime;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(length = 2000)
    private String notes;

    @Column(name = "assigned_worker_id")
    private Long assignedWorkerId;

    @Column(name = "assigned_worker_name", length = 160)
    private String assignedWorkerName;

    @Column(name = "assigned_worker_phone", length = 40)
    private String assignedWorkerPhone;

    @Column(name = "estimated_duration", length = 80)
    private String estimatedDuration;

    @Column(name = "estimated_start_time")
    private LocalDateTime estimatedStartTime;

    @Column(name = "estimated_end_time")
    private LocalDateTime estimatedEndTime;

    @Column(name = "actual_start_time")
    private LocalDateTime actualStartTime;

    @Column(name = "actual_end_time")
    private LocalDateTime actualEndTime;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "auto_assign_deadline")
    private LocalDateTime autoAssignDeadline;

    @Column(name = "worker_response_deadline")
    private LocalDateTime workerResponseDeadline;

    @Column(name = "assignment_attempt_count")
    private Integer assignmentAttemptCount = 0;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Column(name = "actual_duration")
    private Integer actualDuration;

    @Column(name = "total_paused_minutes")
    private Integer totalPausedMinutes = 0;

    @Column(name = "current_pause_start")
    private LocalDateTime currentPauseStart;

    @Column(name = "current_pause_reason", length = 500)
    private String currentPauseReason;

    @Column(name = "completion_notes", length = 2000)
    private String completionNotes;

    @Column(name = "before_image_url", length = 1000)
    private String beforeImageUrl;

    @Column(name = "after_image_url", length = 1000)
    private String afterImageUrl;

    @Column(name = "delay_reason", length = 1000)
    private String delayReason;

    @Column(name = "is_overdue")
    private Boolean isOverdue = false;

    @Column(name = "overdue_minutes")
    private Integer overdueMinutes = 0;

    public boolean isEligibleForCancellation() {
        return switch (requestStatus == null ? "" : requestStatus.toUpperCase()) {
            case "REQUESTED", "AUTO_ASSIGN_PENDING", "ASSIGNED", "WAITING_FOR_WORKER", "REOPENED" -> true;
            default -> false;
        };
    }

    public boolean isEligibleForReopen() {
        return switch (requestStatus == null ? "" : requestStatus.toUpperCase()) {
            case "COMPLETED", "CLOSED", "RESIDENT_CONFIRMATION" -> true;
            default -> false;
        };
    }
}
