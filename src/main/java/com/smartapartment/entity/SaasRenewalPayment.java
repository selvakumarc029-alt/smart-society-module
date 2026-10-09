package com.smartapartment.entity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
@Entity @Table(name="saas_renewal_payments") @Getter @Setter
public class SaasRenewalPayment extends BaseEntity {
    private Long planId;
    private String planName;
    private BigDecimal amount;
    @Column(unique=true) private String transactionReference;
    private LocalDate cycleStart;
    private LocalDate cycleEnd;
}
