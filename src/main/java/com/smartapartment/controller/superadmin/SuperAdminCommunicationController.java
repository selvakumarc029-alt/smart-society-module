package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import com.smartapartment.entity.HelpdeskRoutingRule;
import com.smartapartment.entity.NotificationTemplate;
import com.smartapartment.repository.NotificationTemplateRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin/communication")
public class SuperAdminCommunicationController {
    private final NotificationTemplateRepository templates;
    public SuperAdminCommunicationController(NotificationTemplateRepository templates) { this.templates = templates; }

    @PostMapping("/alerts/approve")
    public ResponseEntity<String> approveSystemAlerts(@RequestParam Long alertId) {
        // Stubbed: Approve automated system-wide SMS or email alerts
        return ResponseEntity.ok("System alert approved for dispatch");
    }

    @GetMapping("/templates")
    public ResponseEntity<List<NotificationTemplate>> getTemplates() {
        if (templates.count() == 0) { NotificationTemplate template = new NotificationTemplate(); template.setTemplateName("Maintenance Due Reminder"); template.setChannel("EMAIL"); template.setSubject("Upcoming Maintenance Dues"); template.setBodyContent("Dear Resident, please clear your pending dues by the 5th."); template.setActive(true); templates.save(template); }
        return ResponseEntity.ok(templates.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping("/templates")
    public ResponseEntity<NotificationTemplate> createTemplate(@RequestBody NotificationTemplate template) {
        template.setId(null); return ResponseEntity.ok(templates.save(template));
    }

    @PutMapping("/templates/{id}")
    public ResponseEntity<NotificationTemplate> updateTemplate(@PathVariable Long id, @RequestBody NotificationTemplate request) {
        NotificationTemplate template = templates.findById(id).orElseThrow(() -> new IllegalArgumentException("Template was not found"));
        template.setTemplateName(request.getTemplateName()); template.setChannel(request.getChannel()); template.setSubject(request.getSubject()); template.setBodyContent(request.getBodyContent()); template.setActive(request.isActive());
        return ResponseEntity.ok(templates.save(template));
    }

    @PostMapping("/notice-board/global")
    public ResponseEntity<String> publishGlobalNotice(@RequestParam String title, @RequestParam String message) {
        // Stubbed: Publish to the master community notice board
        return ResponseEntity.ok("Global notice published");
    }

    @GetMapping("/helpdesk/routing-rules")
    public ResponseEntity<List<HelpdeskRoutingRule>> getRoutingRules() {
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/helpdesk/routing-rules")
    public ResponseEntity<HelpdeskRoutingRule> configureRoutingRule(@RequestBody HelpdeskRoutingRule rule) {
        // Stubbed: Control helpdesk escalation paths and ticket routing
        return ResponseEntity.ok(rule);
    }
}
