package com.smartapartment.controller;

import com.smartapartment.dto.MaintenanceRequestDtos.MaintenanceRequestResponseDto;
import com.smartapartment.dto.WorkerAttendanceDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.MaintenanceRequestService;
import com.smartapartment.service.WorkerAttendanceService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/workers")
public class WorkerAttendanceApiController {

    private final WorkerAttendanceService attendanceService;
    private final MaintenanceRequestService maintenanceRequestService;
    private final CurrentUserService currentUserService;

    public WorkerAttendanceApiController(
            WorkerAttendanceService attendanceService,
            MaintenanceRequestService maintenanceRequestService,
            CurrentUserService currentUserService) {
        this.attendanceService = attendanceService;
        this.maintenanceRequestService = maintenanceRequestService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/attendance/clock-in")
    public ResponseEntity<WorkerAttendanceResponseDto> clockIn(@RequestBody(required = false) ClockInRequest request) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.clockIn(user, request));
    }

    @PostMapping("/attendance/clock-out")
    public ResponseEntity<WorkerAttendanceResponseDto> clockOut(@RequestBody(required = false) ClockOutRequest request) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.clockOut(user, request));
    }

    @PostMapping("/attendance/break-start")
    public ResponseEntity<WorkerAttendanceResponseDto> breakStart(@RequestBody(required = false) BreakRequest request) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.startBreak(user, request));
    }

    @PostMapping("/attendance/break-end")
    public ResponseEntity<WorkerAttendanceResponseDto> breakEnd(@RequestBody(required = false) BreakRequest request) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.endBreak(user, request));
    }

    @GetMapping("/attendance")
    public ResponseEntity<List<ManagerWorkerAttendanceViewDto>> listAttendances(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.listAttendances(date, user));
    }

    @GetMapping("/{id}/attendance")
    public ResponseEntity<WorkerAttendanceResponseDto> getWorkerAttendance(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.getWorkerAttendance(id, date, user));
    }

    @GetMapping("/{id}/availability")
    public ResponseEntity<WorkerAvailabilityResponseDto> getWorkerAvailability(@PathVariable Long id) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.getWorkerAvailability(id, user));
    }

    @PutMapping("/{id}/availability")
    public ResponseEntity<WorkerAvailabilityResponseDto> updateWorkerAvailability(
            @PathVariable Long id,
            @RequestBody UpdateAvailabilityRequest request) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.updateWorkerAvailability(id, request, user));
    }

    @GetMapping("/dashboard-summary")
    public ResponseEntity<WorkerDashboardSummaryDto> getDashboardSummary() {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(attendanceService.getWorkerDashboardSummary(user));
    }

    @PostMapping("/auto-assign/{requestId}")
    public ResponseEntity<MaintenanceRequestResponseDto> autoAssign(@PathVariable Long requestId) {
        AppUser user = currentUserService.requireUser();
        return ResponseEntity.ok(maintenanceRequestService.autoAssignRequest(requestId, user));
    }
}
