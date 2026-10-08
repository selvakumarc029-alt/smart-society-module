package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Getter @Setter
@Table(name="society_rent_changes", uniqueConstraints=@UniqueConstraint(columnNames={"tenant_id","apartment_id","effective_date"}))
public class SocietyRentChange extends BaseEntity {
    @ManyToOne(optional=false) private Apartment apartment;
    @Column(nullable=false, precision=14, scale=2) private BigDecimal previousRent;
    @Column(nullable=false, precision=14, scale=2) private BigDecimal monthlyRent;
    @Column(nullable=false) private LocalDate effectiveDate;
    private Long recordedByUserId;
    private String landlordName;
    @Column(length=1000) private String notes;
}
