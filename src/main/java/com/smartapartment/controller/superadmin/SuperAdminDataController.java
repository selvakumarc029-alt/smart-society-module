package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import com.smartapartment.entity.PrivacyDataRequest;
import com.smartapartment.repository.PrivacyDataRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin/data")
public class SuperAdminDataController {
    private final PrivacyDataRequestRepository requests;

    public SuperAdminDataController(PrivacyDataRequestRepository requests) { this.requests = requests; }

    @GetMapping("/master-lists/flats")
    public ResponseEntity<List<Object>> exportFlatsMasterList() {
        // Stubbed: Export all flats
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/master-lists/residents")
    public ResponseEntity<List<Object>> exportResidentsMasterList() {
        // Stubbed: Export all residents
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/backup")
    public ResponseEntity<String> triggerDatabaseBackup() {
        // Stubbed: Trigger a manual DB backup
        return ResponseEntity.ok("Backup initiated successfully");
    }

    @GetMapping("/privacy/requests")
    public ResponseEntity<List<PrivacyDataRequest>> getDataDeletionRequests() {
        return ResponseEntity.ok(requests.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping("/privacy/process-deletion")
    public ResponseEntity<PrivacyDataRequest> processDataDeletion(@RequestParam Long requestId, @RequestBody PrivacyDecision decision) {
        PrivacyDataRequest request = requests.findById(requestId).orElseThrow(() -> new IllegalArgumentException("Privacy request was not found"));
        request.setStatus(decision.approved() ? "Processed" : "Rejected");
        request.setDetails((request.getDetails() == null ? "" : request.getDetails()) + " | Review: " + decision.note().trim());
        request.setProcessedAt(java.time.LocalDateTime.now());
        return ResponseEntity.ok(requests.save(request));
    }

    public record PrivacyDecision(boolean approved, String note) {}
}
