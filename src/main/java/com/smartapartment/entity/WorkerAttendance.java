package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "worker_attendances")
public class WorkerAttendance extends BaseEntity {

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "work_date", nullable = false)
    private LocalDate date;

    @Column(name = "shift_id", length = 40)
    private String shiftId;

    @Column(name = "clock_in")
    private LocalDateTime clockIn;

    @Column(name = "clock_out")
    private LocalDateTime clockOut;

    @Column(name = "break_start")
    private LocalDateTime breakStart;

    @Column(name = "break_end")
    private LocalDateTime breakEnd;

    @Column(name = "total_working_minutes")
    private Integer totalWorkingMinutes = 0;

    @Column(name = "attendance_status", length = 40)
    private String attendanceStatus; // PRESENT, ABSENT, LATE, ON_LEAVE, HALF_DAY, OFFLINE, CLOCKED_OUT

    @Column(length = 1000)
    private String notes;
}
