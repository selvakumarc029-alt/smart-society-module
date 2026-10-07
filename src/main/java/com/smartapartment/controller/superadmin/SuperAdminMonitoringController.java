package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Notification;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.NotificationRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin/monitoring")
public class SuperAdminMonitoringController {

    private final AppUserRepository users;
    private final NotificationRepository notifications;

    public SuperAdminMonitoringController(AppUserRepository users, NotificationRepository notifications) {
        this.users = users;
        this.notifications = notifications;
    }

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getMonitoringData() {
        return ResponseEntity.ok(Map.of(
            "stats", Map.of("gateEntriesToday", "0", "billsPending", "0", "adminApprovals", "0", "openRisks", "0"),
            "watchlist", List.of(),
            "commandWatch", List.of()
        ));
    }

    @org.springframework.web.bind.annotation.PostMapping("/action")
    @Transactional
    public ResponseEntity<Map<String, Object>> performMonitoringAction(@org.springframework.web.bind.annotation.RequestBody Map<String, String> payload) {
        String action = payload.get("action");
        String actionTitle = switch (action == null ? "" : action) {
            case "trigger-reminder" -> "Maintenance payment reminder";
            case "audit-gate" -> "Gate-entry audit initiated";
            case "sync-kyc" -> "Resident KYC sync initiated";
            case "escalate-complaints" -> "Open complaints escalated";
            case "review-damages" -> "Amenity damage review requested";
            case "audit-expenses" -> "Expense audit initiated";
            case "global-broadcast" -> "Platform-wide announcement";
            case "force-reports" -> "Report generation initiated";
            default -> null;
        };
        if (actionTitle == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported monitoring action"));
        }
        String message = "A platform administrator has initiated: " + actionTitle + ". Please review your SmartSociety notifications for details.";
        int recipientCount = 0;
        for (AppUser user : users.findAll()) {
            Notification notification = new Notification();
            notification.setTenantId(user.getTenantId());
            notification.setUserId(user.getId());
            notification.setType("PLATFORM_ACTION");
            notification.setTitle(actionTitle);
            notification.setMessage(message);
            notification.setReadStatus(false);
            notifications.save(notification);
            recipientCount++;
        }
        return ResponseEntity.ok(Map.of("status", "success", "message", actionTitle + " was sent to " + recipientCount + " platform users.", "recipients", recipientCount));
    }
}
