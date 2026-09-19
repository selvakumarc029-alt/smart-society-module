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
@Table(name = "worker_task_rejections")
public class WorkerTaskRejection extends BaseEntity {

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "worker_name", length = 160)
    private String workerName;

    @Column(name = "maintenance_request_id", nullable = false)
    private Long maintenanceRequestId;

    @Column(name = "request_number", length = 64)
    private String requestNumber;

    @Column(name = "rejected_at", nullable = false)
    private LocalDateTime rejectedAt = LocalDateTime.now();

    @Column(name = "reason", length = 1000)
    private String reason;
}
