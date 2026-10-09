package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "tenants")
public class Tenant extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String societyName;

    private String contactEmail;

    private String contactName;

    private String phone;

    private String website;

    private String address;

    private String city;

    private String state;

    private String country;

    private String postalCode;

    private String societyType;

    private String registrationNumber;

    private Integer totalUnits;

    private Integer totalWings;

    @Column(length = 1500)
    private String onboardingNotes;

    private Long subscriptionPlanId;

    private java.time.LocalDate subscriptionStartedOn;

    private java.time.LocalDate subscriptionRenewsOn;

    private String subscriptionStatus;

    // Separate access control from payment/subscription state.
    private Boolean adminAccessSuspended = false;

    private boolean approved;
}
