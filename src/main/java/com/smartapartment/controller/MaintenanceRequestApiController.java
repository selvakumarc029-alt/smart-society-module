package com.smartapartment.controller;

import com.smartapartment.dto.MaintenanceRequestDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.MaintenanceRequestService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maintenance/requests")
public class MaintenanceRequestApiController {

    private final MaintenanceRequestService requestService;
    private final CurrentUserService currentUser;
    private final AppUserRepository userRepository;

    public MaintenanceRequestApiController(
            MaintenanceRequestService requestService,
            CurrentUserService currentUser,
            AppUserRepository userRepository) {
        this.requestService = requestService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
    }

    private AppUser resolveActiveUser(HttpSession session) {
        try {
            return currentUser.requireUser();
        } catch (Exception e) {
            // Check if resident session is active
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:resident"))) {
                return userRepository.findByEmail("resident@smartsociety")
                        .or(() -> userRepository.findByEmail("resident@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.RESIDENT)
                                .findFirst())
                        .orElseGet(this::createFallbackResident);
            }

            // Check if admin / maintenance session is active
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin")))) {
                return userRepository.findByEmail("admin@smartsociety")
                        .or(() -> userRepository.findByEmail("admin@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.SOCIETY_ADMIN || u.getRole() == UserRole.SUPER_ADMIN)
                                .findFirst())
                        .orElseGet(this::createFallbackResident);
            }

            // Fallback for resident
            return userRepository.findByEmail("resident@smartsociety")
                    .or(() -> userRepository.findByEmail("resident@smartapartment"))
                    .or(() -> userRepository.findAll().stream()
                            .filter(u -> u.getRole() == UserRole.RESIDENT)
                            .findFirst())
                    .orElseGet(this::createFallbackResident);
        }
    }

    private AppUser createFallbackResident() {
        AppUser u = new AppUser();
        u.setTenantId("society-1");
        u.setFullName("Kavya Sharma");
        u.setEmail("resident@smartsociety");
        u.setPhone("9844022010");
        u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
        u.setRole(UserRole.RESIDENT);
        return userRepository.save(u);
    }

    @PostMapping
    public ResponseEntity<MaintenanceRequestResponseDto> createRequest(
            @Valid @RequestBody CreateMaintenanceRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        MaintenanceRequestResponseDto created = requestService.createRequest(dto, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<MaintenanceRequestResponseDto>> listRequests(
            @RequestParam(required = false, defaultValue = "all") String filter,
            @RequestParam(required = false) String status,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        String filterMode = (status != null && !status.isBlank()) ? status : filter;
        List<MaintenanceRequestResponseDto> list = requestService.listRequests(user, filterMode);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MaintenanceRequestResponseDto> getRequestDetails(
            @PathVariable Long id,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        MaintenanceRequestResponseDto details = requestService.getRequestDetails(id, user);
        return ResponseEntity.ok(details);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MaintenanceRequestResponseDto> updateRequest(
            @PathVariable Long id,
            @RequestBody UpdateMaintenanceRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        MaintenanceRequestResponseDto updated = requestService.updateRequest(id, dto, user);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<MaintenanceRequestResponseDto> cancelRequest(
            @PathVariable Long id,
            @RequestBody(required = false) CancelRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        MaintenanceRequestResponseDto cancelled = requestService.cancelRequest(id, dto, user);
        return ResponseEntity.ok(cancelled);
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<MaintenanceRequestResponseDto> reopenRequest(
            @PathVariable Long id,
            @RequestBody(required = false) ReopenRequestDto dto,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        MaintenanceRequestResponseDto reopened = requestService.reopenRequest(id, dto, user);
        return ResponseEntity.ok(reopened);
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<StatusHistoryItemDto>> getStatusHistory(
            @PathVariable Long id,
            HttpSession session) {
        AppUser user = resolveActiveUser(session);
        List<StatusHistoryItemDto> history = requestService.getStatusHistory(id, user);
        return ResponseEntity.ok(history);
    }

    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadImage(
            @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File cannot be empty");
        }

        try {
            String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
            String base64Data = Base64.getEncoder().encodeToString(file.getBytes());
            String dataUri = "data:" + mimeType + ";base64," + base64Data;
            return ResponseEntity.ok(Map.of("imageUrl", dataUri, "fileName", file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.jpg"));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process image file");
        }
    }
}
