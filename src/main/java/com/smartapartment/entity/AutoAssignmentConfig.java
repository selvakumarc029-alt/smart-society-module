package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "auto_assignment_configs")
public class AutoAssignmentConfig extends BaseEntity {

    @Column(name = "auto_assignment_delay_minutes", nullable = false)
    private Integer autoAssignmentDelayMinutes = 5;

    @Column(name = "worker_response_timeout_minutes", nullable = false)
    private Integer workerResponseTimeoutMinutes = 5;

    @Column(name = "max_active_tasks", nullable = false)
    private Integer maxActiveTasks = 1;

    @Column(name = "emergency_delay_minutes", nullable = false)
    private Integer emergencyDelayMinutes = 0;

    @Column(name = "default_service_duration_minutes", nullable = false)
    private Integer defaultServiceDurationMinutes = 60;

    @Column(name = "overdue_threshold_hours", nullable = false)
    private Integer overdueThresholdHours = 24;
}
