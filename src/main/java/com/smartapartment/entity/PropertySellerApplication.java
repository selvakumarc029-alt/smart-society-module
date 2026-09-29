package com.smartapartment.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity
@Table(name = "property_seller_applications", uniqueConstraints = @UniqueConstraint(columnNames = "customer_id"))
public class PropertySellerApplication extends BaseEntity {
    @Column(name = "customer_id", nullable = false) private Long customerId;
    private String requestedRole;
    private String companyName;
    private String registrationNumber;
    @Column(length = 2000) private String verificationDetails;
    private String decision = "PENDING";
    @Column(length = 2000) private String reviewNote;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
}
