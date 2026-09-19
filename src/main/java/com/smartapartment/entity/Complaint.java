package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "complaints")
public class Complaint extends BaseEntity {

    @ManyToOne
    private Resident resident;

    private String category;

    private String subcategory;

    private String priority;

    private String title;

    @Column(length = 2000)
    private String description;

    @Column(length = 500)
    private String locationDetails;

    private LocalDateTime incidentAt;

    private String preferredContactMethod;

    private String reporterPhone;

    private Boolean accessPermission;

    @Column(length = 500)
    private String attachmentReference;

    private String assignedTo;

    private String resolutionNotes;

    private String sparePartsUsed;

    private BigDecimal repairCost;

    private LocalDateTime dueAt;
    private LocalDateTime escalatedAt;
    private LocalDateTime closedAt;

    @Column(length = 40)
    private String bookingReference;

    @Column(length = 40)
    private String orderReference;

    @Column(length = 40)
    private String estimateStatus;

    @Column(length = 40)
    private String paymentStatus;

    @Column(length = 80)
    private String invoiceNumber;
}
