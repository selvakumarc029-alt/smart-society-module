package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin/audit")
public class SuperAdminAuditLogController {

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getAuditData() {
        return ResponseEntity.ok(Map.of(
            "stats", Map.of("auditEventsLogged", "0", "minuteActionsToday", "0", "securityOverrides", "0", "systemHealth", "—"),
            "stream", List.of()
        ));
    }
}
