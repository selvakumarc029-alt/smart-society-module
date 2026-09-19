package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "task_pause_logs")
public class TaskPauseLog extends BaseEntity {

    @Column(name = "maintenance_request_id", nullable = false)
    private Long maintenanceRequestId;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "pause_start", nullable = false)
    private LocalDateTime pauseStart = LocalDateTime.now();

    @Column(name = "pause_end")
    private LocalDateTime pauseEnd;

    @Column(name = "pause_duration_minutes")
    private Integer pauseDurationMinutes = 0;

    @Column(name = "reason", length = 500)
    private String reason; // Waiting for spare part, Resident unavailable, Additional issue, Technical problem, Other
}
