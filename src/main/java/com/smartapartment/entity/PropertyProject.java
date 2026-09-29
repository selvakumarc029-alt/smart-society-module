package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "property_projects")
public class PropertyProject extends BaseEntity {
    private Long builderId;
    private String name;
    private String city;
    private String locality;
    private String registrationNumber;
    private String reraNumber;
    private String constructionStatus;
    private Integer totalTowers;
    private Integer totalUnits;
    private java.time.LocalDate possessionDate;
    @Column(length = 2000) private String description;
}
