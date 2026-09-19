package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Getter @Setter
@Table(name = "emergency_maintenance_bookings")
public class EmergencyMaintenanceBooking extends BaseEntity {
    private String sourcePlatform;
    @Column(name = "order_reference", length = 32, unique = true) private String orderReference;
    private Long requesterId;
    private String requesterName;
    private String requesterPhone;
    @Column(length = 600) private String serviceAddress;
    @Column(length = 120) private String unitNumber;
    private String city;
    private String area;
    private String category;
    @Column(length = 3000) private String description;
    private Double latitude;
    private Double longitude;
    private Long hubId;
    private Long partnerId;
    private String assignmentType = "Auto"; // Auto or Manual
    private String assignedBy;
    private LocalDateTime assignedAt;
    private String jobStatus = "UNASSIGNED";
    private String dispatchReason;
    @Column(length = 4000) private String declinedPartnerIds = ",";
    @Column(length = 8000) private String assignmentAuditLog = "";
    private Double distanceKm;
    private LocalDateTime offeredAt;
    private LocalDateTime acceptanceDueAt;
    private Integer dispatchCycleCount = 1;
    private Integer offerSequence = 0;
    private LocalDateTime escalatedAt;
    @Column(length = 1000) private String escalationReason;
    private LocalDateTime acceptedAt;
    private LocalDateTime arrivalDueAt;
    private LocalDateTime reachedAt;
    private Double arrivalDistanceKm;
    private Boolean arrivalGeofenceVerified;
    private LocalDateTime photoStartAt;
    private Double beforePhotoLatitude;
    private Double beforePhotoLongitude;
    private LocalDateTime photoEndAt;
    private Double afterPhotoLatitude;
    private Double afterPhotoLongitude;
    private LocalDateTime startedAt;
    /** Persisted work ETA shown to admin and the requesting resident while repairs are active. */
    private Integer estimatedDurationMinutes;
    private LocalDateTime estimatedCompletionAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime customerSignedOffAt;
    private LocalDateTime reviewRequestedAt;
    private LocalDateTime reviewLinkSentAt;
    @Column(length = 1000) private String beforePhotoUrl;
    @Column(length = 1000) private String afterPhotoUrl;
    @Column(length = 1000) private String customerReviewUrl;
    @Column(length = 64, unique = true) private String feedbackToken;
    private Integer rating;
    @Column(length = 1000) private String review;
    @Column(length = 500) private String reviewTags;
    @Column(length = 2000) private String completionNotes;
    private String reviewNotificationChannels; // IN_APP,SMS,WHATSAPP,PUSH
    private String reviewNotificationStatus;   // PREPARED, SENT, COMPLETED
    @Column(length = 3000) private String reviewRequestPayload;
    @Lob @com.fasterxml.jackson.annotation.JsonIgnore private byte[] beforePhoto;
    @Lob @com.fasterxml.jackson.annotation.JsonIgnore private byte[] afterPhoto;

    private Boolean isEmergency;
    @Column(length = 80) private String requiredSkill;
    @Column(length = 1500) private String aiCategorizationNotes;
    private Boolean isAmcVendor;
    @Column(length = 60) private String vendorType; // AMC_SOCIETY_VENDOR or EXTERNAL_APPROVED_VENDOR
    @Column(length = 1000) private String vendorDeclineReason;
    private LocalDateTime diagnosisStartedAt;
    private Boolean additionalCostRequired;
    private java.math.BigDecimal estimateAmount;
    @Column(length = 2000) private String estimateDescription;
    @Column(length = 2000) private String estimatePartsBreakdown;
    @Column(length = 1000) private String estimateLaborBreakdown;
    @Column(length = 40) private String estimateStatus; // NONE, PENDING_APPROVAL, APPROVED, REJECTED
    private LocalDateTime estimateApprovedAt;
    @Column(length = 1000) private String estimateRejectionReason;
    private LocalDateTime workCompletedAt;
    private Integer reopenCount = 0;
    @Column(length = 1500) private String reopenReason;
    private LocalDateTime reopenedAt;
    private LocalDateTime residentConfirmedAt;
    @Column(length = 40) private String paymentStatus; // NOT_REQUIRED, PENDING, PAID
    @Column(length = 60) private String paymentMethod;
    @Column(length = 120) private String paymentReference;
    private java.math.BigDecimal paidAmount;
    private LocalDateTime paidAt;
    @Column(length = 80) private String invoiceNumber;
    private java.time.LocalDate preferredDate;
    @Column(length = 80) private String preferredSlot;
    @Column(length = 1000) private String residentAttachmentUrl;

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getBookingReference() {
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "EMG-%05d", getId());
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getOrderReference() {
        if (orderReference != null && !orderReference.isBlank()) return orderReference;
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "ORD-EMG-%04d", getId());
    }
}
