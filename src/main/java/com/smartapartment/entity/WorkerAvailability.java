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
@Table(name = "worker_availabilities")
public class WorkerAvailability extends BaseEntity {

    @Column(name = "worker_id", nullable = false, unique = true)
    private Long workerId;

    @Column(name = "status", length = 40, nullable = false)
    private String status = "OFFLINE"; // AVAILABLE, BUSY, ON_BREAK, OFFLINE

    @Column(name = "current_task_id")
    private Long currentTaskId;

    @Column(name = "current_task_number", length = 60)
    private String currentTaskNumber;

    @Column(name = "last_updated_at")
    private LocalDateTime lastUpdatedAt;
}
