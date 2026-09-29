package com.smartapartment.entity;
import jakarta.persistence.*;import java.math.BigDecimal;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="saved_searches")
public class SavedSearch extends BaseEntity{private Long customerId;private String name;private String city;private String locality;private String listingType;private String propertyType;private String bhk;private BigDecimal minPrice;private BigDecimal maxPrice;private String amenities;private boolean alertsEnabled;}
