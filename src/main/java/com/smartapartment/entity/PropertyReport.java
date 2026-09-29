package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "property_reports")
public class PropertyReport extends BaseEntity {
    private Long customerId;
    private Long listingId;
    @Column(length = 2000) private String reason;
    @Column(length = 2000) private String resolution;
    @Column(nullable = false, length = 30, columnDefinition = "varchar(30) default 'OPEN'")
    private String status = "OPEN";
}
