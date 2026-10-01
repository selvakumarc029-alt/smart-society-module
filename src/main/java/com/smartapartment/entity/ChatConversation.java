package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "chat_conversations")
public class ChatConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "maintenance_request_id")
    private Long maintenanceRequestId;

    @Column(name = "conversation_type", nullable = false, length = 60)
    private String conversationType; // CUSTOMER_MAINTENANCE or MAINTENANCE_ADMIN

    @Column(name = "customer_id", length = 100)
    private String customerId;

    @Column(name = "customer_name", length = 160)
    private String customerName;

    @Column(name = "customer_unit", length = 80)
    private String customerUnit; // e.g. Flat A-101

    @Column(name = "maintenance_user_id", length = 100)
    private String maintenanceUserId;

    @Column(name = "maintenance_user_name", length = 160)
    private String maintenanceUserName;

    @Column(name = "admin_id", length = 100)
    private String adminId;

    @Column(name = "admin_name", length = 160)
    private String adminName;

    @Column(name = "ticket_number", length = 64)
    private String ticketNumber; // e.g. REQ-1024, T-102, MR-2026-00001

    @Column(name = "ticket_title", length = 200)
    private String ticketTitle; // e.g. AC Repair

    @Column(nullable = false, length = 40)
    private String status = "OPEN"; // OPEN, CLOSED

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
