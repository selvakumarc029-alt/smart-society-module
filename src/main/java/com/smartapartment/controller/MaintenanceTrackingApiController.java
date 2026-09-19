package com.smartapartment.controller;

import com.smartapartment.dto.RealTimeTrackingDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.ResidentRepository;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.MaintenanceTrackingService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maintenance/tracking")
public class MaintenanceTrackingApiController {

    private final MaintenanceTrackingService trackingService;
    private final CurrentUserService currentUser;
    private final AppUserRepository userRepository;
    private final ResidentRepository residentRepository;

    public MaintenanceTrackingApiController(
            MaintenanceTrackingService trackingService,
            CurrentUserService currentUser,
            AppUserRepository userRepository,
            ResidentRepository residentRepository) {
        this.trackingService = trackingService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.residentRepository = residentRepository;
    }

    private AppUser resolveActiveUser(HttpSession session) {
        try {
            return currentUser.requireUser();
        } catch (Exception e) {
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:resident"))) {
                return userRepository.findByEmail("resident@smartsociety")
                        .or(() -> userRepository.findByEmail("resident@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.RESIDENT)
                                .findFirst())
                        .orElse(null);
            }
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin")))) {
                return userRepository.findByEmail("admin@smartsociety")
                        .or(() -> userRepository.findByEmail("admin@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.SOCIETY_ADMIN || u.getRole() == UserRole.FACILITY_MANAGER)
                                .findFirst())
                        .orElse(null);
            }
            return null;
        }
    }

    // ==========================================
    // 1. SSE STREAMS
    // ==========================================

    @GetMapping(value = "/stream/resident", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamResidentEvents(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            SseEmitter emitter = new SseEmitter(5000L);
            try {
                emitter.send(SseEmitter.event().name("ERROR").data(Map.of("error", "Unauthorized")));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        Long residentId = residentRepository.findFirstByUserOrderByIdAsc(user)
                .map(r -> r.getId())
                .orElse(user.getId());

        return trackingService.subscribeResident(user.getTenantId(), residentId);
    }

    @GetMapping(value = "/stream/manager", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamManagerEvents(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = (user != null && user.getTenantId() != null) ? user.getTenantId() : "default";
        return trackingService.subscribeManager(tenantId);
    }

    @GetMapping(value = "/stream/{id}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamRequestEvents(@PathVariable Long id, HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String tenantId = (user != null && user.getTenantId() != null) ? user.getTenantId() : "default";
        return trackingService.subscribeRequest(id, tenantId, user);
    }

    // ==========================================
    // 2. LIVE TRACKING DATA
    // ==========================================

    @GetMapping("/active")
    public ResponseEntity<List<LiveTrackingCardDto>> getActiveTracking(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(trackingService.getResidentActiveTracking(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LiveTrackingCardDto> getTrackingCard(@PathVariable Long id, HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(trackingService.getRequestTrackingCard(id, user));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<LiveTrackingCardDto> confirmCompletion(
            @PathVariable Long id,
            @RequestBody(required = false) ConfirmCompletionRequest confirmRequest,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(trackingService.confirmCompletion(id, confirmRequest, user));
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<LiveTrackingCardDto> reopenRequest(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        String reason = body != null ? body.get("reason") : "Rework requested";
        return ResponseEntity.ok(trackingService.residentReopenRequest(id, reason, user));
    }
}
