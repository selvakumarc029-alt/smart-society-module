package com.smartapartment.controller;

import com.smartapartment.dto.AutoAssignmentDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.service.AutoAssignmentService;
import com.smartapartment.service.CurrentUserService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auto-assignment")
public class AutoAssignmentApiController {

    private final AutoAssignmentService autoAssignmentService;
    private final CurrentUserService currentUserService;
    private final AppUserRepository userRepository;

    public AutoAssignmentApiController(
            AutoAssignmentService autoAssignmentService,
            CurrentUserService currentUserService,
            AppUserRepository userRepository) {
        this.autoAssignmentService = autoAssignmentService;
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
    }

    private AppUser resolveActiveUser(HttpSession session) {
        try {
            return currentUserService.requireUser();
        } catch (Exception e) {
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin")))) {
                return userRepository.findByEmail("admin@smartsociety")
                        .or(() -> userRepository.findByEmail("admin@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF || u.getRole() == UserRole.SOCIETY_ADMIN)
                                .findFirst())
                        .orElse(null);
            }
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:resident"))) {
                return userRepository.findByEmail("resident@smartsociety")
                        .or(() -> userRepository.findByEmail("resident@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.RESIDENT)
                                .findFirst())
                        .orElse(null);
            }
            return null;
        }
    }

    @GetMapping("/config")
    public ResponseEntity<AutoAssignmentConfigDto> getConfig(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = user != null ? user.getTenantId() : "default";
        return ResponseEntity.ok(autoAssignmentService.getConfig(tenantId));
    }

    @PutMapping("/config")
    public ResponseEntity<AutoAssignmentConfigDto> updateConfig(
            @Valid @RequestBody UpdateAutoAssignmentConfigDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = user != null ? user.getTenantId() : "default";
        return ResponseEntity.ok(autoAssignmentService.updateConfig(tenantId, dto));
    }

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<Void> acceptAssignment(@PathVariable Long id, HttpSession session) {
        AppUser user = resolveActiveUser(session);
        autoAssignmentService.handleWorkerAccept(id, user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/requests/{id}/reject")
    public ResponseEntity<Void> rejectAssignment(
            @PathVariable Long id,
            @Valid @RequestBody WorkerRejectRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        autoAssignmentService.handleWorkerReject(id, dto.reason(), user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/requests/{id}/reassign")
    public ResponseEntity<Void> forceReassign(
            @PathVariable Long id,
            @RequestBody(required = false) ManualReassignRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String reason = (dto != null && dto.reason() != null && !dto.reason().isBlank())
                ? dto.reason() : "Manually reassigned by admin/manager";
        autoAssignmentService.reassignWorker(id, reason, user);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/queue")
    public ResponseEntity<List<WaitingQueueItemDto>> getWaitingQueue(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = user != null ? user.getTenantId() : "default";
        return ResponseEntity.ok(autoAssignmentService.getWaitingQueue(tenantId));
    }

    @PostMapping("/queue/process")
    public ResponseEntity<Void> triggerProcessQueue(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = user != null ? user.getTenantId() : "default";
        autoAssignmentService.processWaitingQueue(tenantId);
        return ResponseEntity.ok().build();
    }
}
