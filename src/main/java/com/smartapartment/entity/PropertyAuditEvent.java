package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "property_audit_events")
public class PropertyAuditEvent extends BaseEntity {
    private String actor;
    private String action;
    private String targetType;
    private Long targetId;
    @Column(length = 2000) private String detail;
}
