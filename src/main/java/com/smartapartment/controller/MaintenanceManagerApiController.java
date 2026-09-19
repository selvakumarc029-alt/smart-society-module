package com.smartapartment.controller;

import com.smartapartment.dto.MaintenanceManagerDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.MaintenanceManagerService;
import com.smartapartment.service.MaintenanceTrackingService;
import jakarta.servlet.http.HttpSession;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/maintenance/manager")
public class MaintenanceManagerApiController {

    private final MaintenanceManagerService managerService;
    private final MaintenanceTrackingService trackingService;
    private final CurrentUserService currentUser;
    private final AppUserRepository userRepository;

    public MaintenanceManagerApiController(
            MaintenanceManagerService managerService,
            MaintenanceTrackingService trackingService,
            CurrentUserService currentUser,
            AppUserRepository userRepository) {
        this.managerService = managerService;
        this.trackingService = trackingService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
    }

    private AppUser resolveActiveManager(HttpSession session) {
        try {
            return currentUser.requireUser();
        } catch (Exception e) {
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin")))) {
                return userRepository.findByEmail("admin@smartsociety")
                        .or(() -> userRepository.findByEmail("admin@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.FACILITY_MANAGER || u.getRole() == UserRole.SOCIETY_ADMIN || u.getRole() == UserRole.SUPER_ADMIN)
                                .findFirst())
                        .orElse(null);
            }
            return null;
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<ManagerDashboardSummaryDto> getDashboardSummary(HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(managerService.getDashboardSummary(manager));
    }

    @GetMapping("/queue")
    public ResponseEntity<List<ManagerQueueItemDto>> getQueue(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Long workerId,
            @RequestParam(required = false) String building,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) {
            return ResponseEntity.status(401).build();
        }
        QueueFilterParams filters = new QueueFilterParams(status, priority, category, workerId, building, date);
        return ResponseEntity.ok(managerService.getQueue(manager, filters));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamManagerEvents(HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        String tenantId = (manager != null && manager.getTenantId() != null) ? manager.getTenantId() : "default";
        return trackingService.subscribeManager(tenantId);
    }

    // ==========================================
    // MANUAL AUDITED ACTIONS
    // ==========================================

    @PostMapping("/{id}/assign")
    public ResponseEntity<ManagerQueueItemDto> assignWorker(
            @PathVariable Long id,
            @RequestBody AssignWorkerAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.assignWorker(id, action, manager));
    }

    @PostMapping("/{id}/reassign")
    public ResponseEntity<ManagerQueueItemDto> reassignWorker(
            @PathVariable Long id,
            @RequestBody ReassignWorkerAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.reassignWorker(id, action, manager));
    }

    @PostMapping("/{id}/priority")
    public ResponseEntity<ManagerQueueItemDto> changePriority(
            @PathVariable Long id,
            @RequestBody ChangePriorityAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.changePriority(id, action, manager));
    }

    @PostMapping("/{id}/eta")
    public ResponseEntity<ManagerQueueItemDto> changeEta(
            @PathVariable Long id,
            @RequestBody ChangeEtaAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.changeEta(id, action, manager));
    }

    @PostMapping("/{id}/hold")
    public ResponseEntity<ManagerQueueItemDto> putOnHold(
            @PathVariable Long id,
            @RequestBody(required = false) PutOnHoldAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.putOnHold(id, action != null ? action : new PutOnHoldAction("Placed on hold"), manager));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ManagerQueueItemDto> resumeRequest(
            @PathVariable Long id,
            @RequestBody(required = false) ResumeAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.resumeRequest(id, action != null ? action : new ResumeAction("Resumed"), manager));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ManagerQueueItemDto> cancelRequest(
            @PathVariable Long id,
            @RequestBody(required = false) CancelRequestAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.cancelRequest(id, action != null ? action : new CancelRequestAction("Cancelled by manager"), manager));
    }

    @PostMapping("/{id}/override")
    public ResponseEntity<ManagerQueueItemDto> overrideAssignment(
            @PathVariable Long id,
            @RequestBody OverrideAssignmentAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.overrideAssignment(id, action, manager));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ManagerQueueItemDto> closeRequest(
            @PathVariable Long id,
            @RequestBody(required = false) CloseRequestAction action,
            HttpSession session) {
        AppUser manager = resolveActiveManager(session);
        if (manager == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(managerService.closeRequest(id, action != null ? action : new CloseRequestAction("Closed by manager"), manager));
    }
}
