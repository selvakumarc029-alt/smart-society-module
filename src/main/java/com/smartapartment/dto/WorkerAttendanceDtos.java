package com.smartapartment.dto;

import com.smartapartment.entity.WorkerAttendance;
import com.smartapartment.entity.WorkerAvailability;
import com.smartapartment.entity.WorkerShift;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class WorkerAttendanceDtos {

    public record ClockInRequest(
            String shiftId,
            String notes
    ) {}

    public record ClockOutRequest(
            String notes
    ) {}

    public record BreakRequest(
            String notes
    ) {}

    public record UpdateAvailabilityRequest(
            String status,
            Long currentTaskId,
            String currentTaskNumber
    ) {}

    public record WorkerAttendanceResponseDto(
            Long id,
            Long workerId,
            String workerName,
            LocalDate date,
            String shiftId,
            String shiftName,
            LocalDateTime clockIn,
            LocalDateTime clockOut,
            LocalDateTime breakStart,
            LocalDateTime breakEnd,
            Integer totalWorkingMinutes,
            String attendanceStatus,
            String notes,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        public static WorkerAttendanceResponseDto from(WorkerAttendance attendance, String workerName) {
            if (attendance == null) return null;
            WorkerShift shift = WorkerShift.fromString(attendance.getShiftId());
            return new WorkerAttendanceResponseDto(
                    attendance.getId(),
                    attendance.getWorkerId(),
                    workerName,
                    attendance.getDate(),
                    attendance.getShiftId(),
                    shift != null ? shift.getDisplayName() : attendance.getShiftId(),
                    attendance.getClockIn(),
                    attendance.getClockOut(),
                    attendance.getBreakStart(),
                    attendance.getBreakEnd(),
                    attendance.getTotalWorkingMinutes() != null ? attendance.getTotalWorkingMinutes() : 0,
                    attendance.getAttendanceStatus(),
                    attendance.getNotes(),
                    attendance.getCreatedAt(),
                    attendance.getUpdatedAt()
            );
        }
    }

    public record WorkerAvailabilityResponseDto(
            Long id,
            Long workerId,
            String workerName,
            String status,
            Long currentTaskId,
            String currentTaskNumber,
            LocalDateTime lastUpdatedAt
    ) {
        public static WorkerAvailabilityResponseDto from(WorkerAvailability availability, String workerName) {
            if (availability == null) return null;
            return new WorkerAvailabilityResponseDto(
                    availability.getId(),
                    availability.getWorkerId(),
                    workerName,
                    availability.getStatus(),
                    availability.getCurrentTaskId(),
                    availability.getCurrentTaskNumber(),
                    availability.getLastUpdatedAt()
            );
        }
    }

    public record WorkingHoursSummaryDto(
            int todayMinutes,
            int weeklyMinutes,
            int monthlyMinutes,
            String todayFormatted,
            String weeklyFormatted,
            String monthlyFormatted
    ) {
        public static WorkingHoursSummaryDto of(int today, int weekly, int monthly) {
            return new WorkingHoursSummaryDto(
                    today,
                    weekly,
                    monthly,
                    formatMinutes(today),
                    formatMinutes(weekly),
                    formatMinutes(monthly)
            );
        }

        private static String formatMinutes(int totalMinutes) {
            int hours = totalMinutes / 60;
            int mins = totalMinutes % 60;
            if (hours > 0) {
                return hours + "h " + mins + "m";
            }
            return mins + "m";
        }
    }

    public record WorkerTaskDto(
            Long id,
            String requestNumber,
            String title,
            String category,
            String priority,
            String status,
            String flatNumber,
            String preferredTime,
            LocalDateTime workerResponseDeadline
    ) {}

    public record WorkerDashboardSummaryDto(
            WorkerAttendanceResponseDto attendance,
            WorkerAvailabilityResponseDto availability,
            WorkerTaskDto currentTask,
            List<WorkerTaskDto> pendingTasks,
            List<WorkerTaskDto> completedTasks,
            List<WorkerTaskDto> upcomingTasks,
            WorkingHoursSummaryDto workingHours
    ) {}

    public record ManagerWorkerAttendanceViewDto(
            Long workerId,
            String workerName,
            String employeeId,
            String email,
            String department,
            String shift,
            String attendanceStatus,
            LocalDateTime clockIn,
            LocalDateTime clockOut,
            String workingHours,
            String availabilityStatus,
            Long currentTaskId,
            String currentTaskNumber,
            String currentTaskTitle
    ) {}
}
