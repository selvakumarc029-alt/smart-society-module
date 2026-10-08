package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Getter @Setter @Table(name="society_security_access_logs")
public class SecurityAccessLog extends BaseEntity {
    private Long userId;
    private String guardName;
    private LocalDateTime loginAt;
    private LocalDateTime logoutAt;
    private String endReason;
}
