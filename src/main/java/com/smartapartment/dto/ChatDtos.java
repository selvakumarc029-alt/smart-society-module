package com.smartapartment.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public class ChatDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SendMessageRequest {
        private Long conversationId;
        private String conversationKey;
        private Long maintenanceRequestId;
        private String ticketNumber;
        private String ticketTitle;
        private String channelType; // CUSTOMER_MAINTENANCE or MAINTENANCE_ADMIN
        private String conversationType; // alias for channelType
        private String senderId;
        private String senderRole;  // CUSTOMER, MAINTENANCE, ADMIN
        private String senderName;
        private String senderEmail;
        private String senderUnit;
        private String message;
        private String messageType; // TEXT, IMAGE, FILE, SYSTEM
        private String priority;
        private String attachmentName;
        private String attachmentData;
        private String category;

        @JsonSetter("conversationId")
        public void setConversationId(Object val) {
            if (val == null) return;
            if (val instanceof Number) {
                this.conversationId = ((Number) val).longValue();
            } else {
                String s = val.toString().trim();
                try {
                    this.conversationId = Long.parseLong(s);
                } catch (NumberFormatException e) {
                    this.conversationKey = s;
                }
            }
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatMessageResponse {
        private Long id;
        private Long conversationId;
        private String conversationKey;
        private Long maintenanceRequestId;
        private String ticketNumber;
        private String ticketTitle;
        private String channelType;
        private String conversationType;
        private String senderId;
        private String senderRole;
        private String senderName;
        private String senderUnit;
        private String message;
        private String messageType; // TEXT, IMAGE, FILE, SYSTEM
        private String priority;
        private boolean isRead;
        private LocalDateTime createdAt;
        private String formattedTime;
        private String category;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConversationSummary {
        private Long id;
        private Long conversationId;
        private String conversationKey;
        private Long maintenanceRequestId;
        private String ticketNumber;
        private String ticketTitle;
        private String channelType;
        private String conversationType;
        private String customerId;
        private String customerName;
        private String customerUnit;
        private String maintenanceUserId;
        private String maintenanceUserName;
        private String adminId;
        private String adminName;
        private String title;
        private String subtitle;
        private String unit;
        private String lastMessage;
        private String lastSender;
        private String formattedTime;
        private long unreadCount;
        private String category;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UnreadCountSummary {
        private long customerMaintenanceUnread;
        private long maintenanceAdminUnread;
        private long totalUnread;
    }
}
