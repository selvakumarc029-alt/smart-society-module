package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "home_service_packages")
public class HomeServicePackage extends BaseEntity {

    @Column(nullable = false)
    private String category; // e.g. "Home Cleaning", "Kitchen Cleaning", "Bathroom Cleaning", "Appliance Repair", "Plumbing", "Electrical", "Carpentry"

    @Column(nullable = false)
    private String subService; // e.g. "Full House Cleaning", "Occupied Kitchen", "Tap Repair", etc.

    @Column(nullable = false)
    private String designation; // e.g. "Furnished Apartment", "Empty Kitchen", "1 BHK", etc.

    @Column(nullable = false)
    private String packageName; // e.g. "Essential ★", "Premium 💎", "Elite 👑"

    @Column(nullable = false)
    private Double price; // e.g. 3069.0

    private String pricePrefix; // e.g. "Starts at", "FLAT"

    private String rating = "4.7"; // e.g. "4.7"

    private String reviews = "10K+"; // e.g. "38.2K+"

    private String duration = "4 hrs"; // e.g. "4 hrs"

    private String optionsCount = "5 options"; // e.g. "5 options"

    @Column(columnDefinition = "TEXT")
    private String features; // JSON string or newline-separated features list

    @Column(columnDefinition = "TEXT")
    private String detailedSections; // Optional JSON or description

    private String badge; // e.g. "Popular", "Best Value"

    private String thumbnail; // Image or SVG URL

    private boolean active = true;
}
