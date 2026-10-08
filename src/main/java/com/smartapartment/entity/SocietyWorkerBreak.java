package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Getter @Setter @Table(name="society_worker_breaks")
public class SocietyWorkerBreak extends BaseEntity {
    private Long attendanceId;
    private Long workerId;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
}
