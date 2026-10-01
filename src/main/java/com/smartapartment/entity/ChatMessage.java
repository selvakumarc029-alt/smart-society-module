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
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender_id", length = 100)
    private String senderId;

    @Column(name = "sender_role", nullable = false, length = 40)
    private String senderRole; // CUSTOMER, MAINTENANCE, ADMIN

    @Column(name = "sender_name", length = 160)
    private String senderName;

    @Column(nullable = false, length = 4000)
    private String message;

    @Column(name = "message_type", length = 40)
    private String messageType = "TEXT"; // TEXT, IMAGE, FILE, SYSTEM

    @Column(name = "is_read")
    private boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
