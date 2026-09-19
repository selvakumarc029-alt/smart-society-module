package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "maintenance_status_histories")
public class MaintenanceStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false)
    private Long requestId;

    @Column(name = "old_status", length = 50)
    private String oldStatus;

    @Column(name = "new_status", nullable = false, length = 50)
    private String newStatus;

    @Column(name = "changed_by", length = 160)
    private String changedBy;

    @Column(length = 2000)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
