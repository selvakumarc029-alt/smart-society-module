package com.smartapartment.controller;

import com.smartapartment.entity.Announcement;
import com.smartapartment.repository.AnnouncementRepository;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Platform-wide notices are visible to every authenticated dashboard user. */
@RestController
@RequestMapping("/api/announcements/platform")
public class PlatformNoticeController {

    private final AnnouncementRepository announcements;
    private final CurrentUserService currentUser;

    public PlatformNoticeController(AnnouncementRepository announcements, CurrentUserService currentUser) {
        this.announcements = announcements;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return announcements.findNoticesForEmail(currentUser.requireUser().getEmail()).stream()
                .map(item -> Map.<String, Object>of(
                        "id", item.getId(),
                        "title", item.getTitle(),
                        "message", item.getMessage(),
                        "audience", item.getAudience(),
                        "recipient", item.getRecipientEmail() == null ? "ALL" : item.getRecipientEmail(),
                        "emergency", item.isEmergency(),
                        "createdAt", item.getCreatedAt()))
                .toList();
    }

    @PostMapping
    public Map<String, Object> publish(@Valid @RequestBody PlatformNoticeRequest request) {
        Announcement notice = new Announcement();
        notice.setTenantId("platform");
        boolean sendToAll = "ALL".equalsIgnoreCase(request.delivery());
        if (!sendToAll && (request.recipientEmail() == null || request.recipientEmail().isBlank())) {
            throw new IllegalArgumentException("Enter the email address of the person who should receive this notice");
        }
        notice.setGlobal(sendToAll);
        notice.setTitle(request.title().trim());
        notice.setMessage(request.message().trim());
        notice.setAudience(sendToAll ? "ALL" : "SPECIFIC");
        notice.setRecipientEmail(sendToAll ? null : request.recipientEmail().trim().toLowerCase());
        notice.setEmergency(request.emergency());
        notice.setValidUntil(LocalDateTime.now().plusDays(30));
        notice = announcements.save(notice);
        return Map.of("id", notice.getId(), "message", "Platform notice published");
    }

    public record PlatformNoticeRequest(
            @NotBlank String delivery,
            @Size(max = 320) String recipientEmail,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 3000) String message,
            boolean emergency) {
    }
}
