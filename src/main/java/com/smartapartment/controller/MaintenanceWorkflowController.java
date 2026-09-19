package com.smartapartment.controller;

import com.smartapartment.entity.AppUser;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.MaintenanceWorkflowService;
import com.smartapartment.service.MaintenanceWorkflowService.*;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/maintenance/workflow")
public class MaintenanceWorkflowController {

    private final MaintenanceWorkflowService workflowService;
    private final CurrentUserService currentUser;
    private final com.smartapartment.repository.AppUserRepository users;

    public MaintenanceWorkflowController(MaintenanceWorkflowService workflowService, CurrentUserService currentUser, com.smartapartment.repository.AppUserRepository users) {
        this.workflowService = workflowService;
        this.currentUser = currentUser;
        this.users = users;
    }

    private AppUser getOrFallbackUser() {
        try {
            return currentUser.requireUser();
        } catch (Exception e) {
            return users.findByEmail("resident@smartsociety")
                    .or(() -> users.findByEmail("resident@smartapartment"))
                    .or(() -> users.findAll().stream().filter(u -> u.getRole() != null && "RESIDENT".equalsIgnoreCase(u.getRole().name())).findFirst())
                    .or(() -> users.findAll().stream().findFirst())
                    .orElseGet(() -> {
                        AppUser u = new AppUser();
                        u.setTenantId("society-1");
                        u.setFullName("Kavya Sharma");
                        u.setEmail("resident@smartsociety");
                        u.setPhone("9844022010");
                        u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
                        u.setRole(com.smartapartment.entity.UserRole.RESIDENT);
                        return users.save(u);
                    });
        }
    }

    public record AnalyzeRequest(String title, String description, String category) {}

    @PostMapping("/analyze")
    public AICategorizationResult analyze(@RequestBody AnalyzeRequest request) {
        return workflowService.aiAnalyze(
                request != null ? request.title() : "",
                request != null ? request.description() : "",
                request != null ? request.category() : "Plumbing"
        );
    }

    public record ServiceSubmitRequest(
            String title,
            String category,
            String serviceCategory,
            String description,
            String problemDescription,
            String unitNumber,
            String serviceAddress,
            String contactPhone,
            String contactName,
            String preferredDate,
            String preferredSlot,
            String attachmentUrl,
            Boolean accessPermission) {}

    @PostMapping(value = "/submit", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> submitJson(@RequestBody ServiceSubmitRequest request) {
        AppUser user = getOrFallbackUser();
        LocalDate date = null;
        if (request.preferredDate() != null && !request.preferredDate().isBlank()) {
            try {
                date = LocalDate.parse(request.preferredDate().trim());
            } catch (Exception ignored) {}
        }

        String cat = request.category() != null && !request.category().isBlank() ? request.category() : (request.serviceCategory() != null ? request.serviceCategory() : "Plumbing");
        String desc = request.description() != null && !request.description().isBlank() ? request.description() : (request.problemDescription() != null ? request.problemDescription() : "");
        String t = request.title() != null && !request.title().isBlank() ? request.title() : (cat + " Service Request");

        ServiceRequestInput input = new ServiceRequestInput(
                t,
                cat,
                desc,
                request.unitNumber(),
                request.serviceAddress(),
                request.contactPhone(),
                request.contactName(),
                date,
                request.preferredSlot(),
                request.attachmentUrl(),
                Boolean.TRUE.equals(request.accessPermission())
        );

        return workflowService.createServiceRequest(user, input);
    }

    @PostMapping(value = "/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> submitMultipart(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String category,
            @RequestParam String description,
            @RequestParam(required = false) String unitNumber,
            @RequestParam(required = false) String serviceAddress,
            @RequestParam(required = false) String contactPhone,
            @RequestParam(required = false) String contactName,
            @RequestParam(required = false) String preferredDate,
            @RequestParam(required = false) String preferredSlot,
            @RequestParam(required = false) MultipartFile file,
            @RequestParam(required = false) Boolean accessPermission) {

        AppUser user = getOrFallbackUser();
        LocalDate date = null;
        if (preferredDate != null && !preferredDate.isBlank()) {
            try {
                date = LocalDate.parse(preferredDate.trim());
            } catch (Exception ignored) {}
        }

        String attachmentUrl = null;
        if (file != null && !file.isEmpty()) {
            try {
                attachmentUrl = "data:" + (file.getContentType() != null ? file.getContentType() : "image/jpeg") + ";base64," + Base64.getEncoder().encodeToString(file.getBytes());
            } catch (IOException ignored) {}
        }

        ServiceRequestInput input = new ServiceRequestInput(
                title,
                category,
                description,
                unitNumber,
                serviceAddress,
                contactPhone,
                contactName,
                date,
                preferredSlot,
                attachmentUrl,
                Boolean.TRUE.equals(accessPermission)
        );

        return workflowService.createServiceRequest(user, input);
    }

    @GetMapping("/tickets/{ref}")
    public Map<String, Object> getTicketStatus(@PathVariable String ref) {
        return workflowService.getWorkflowStatusByReference(ref);
    }

    public record VendorResponseRequest(boolean accept, String declineReason) {}

    @PostMapping("/tickets/{id}/vendor-response")
    public Map<String, Object> respondToJob(@PathVariable Long id, @RequestBody VendorResponseRequest req) {
        return workflowService.respondToJobOffer(id, req.accept(), req.declineReason());
    }

    @PostMapping("/tickets/{id}/travel")
    public Map<String, Object> startTravel(@PathVariable Long id) {
        return workflowService.startTravel(id);
    }

    @PostMapping("/tickets/{id}/arrive")
    public Map<String, Object> arrive(
            @PathVariable Long id,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude) {
        return workflowService.arriveAtApartment(id, latitude, longitude);
    }

    @PostMapping("/tickets/{id}/diagnosis")
    public Map<String, Object> diagnosis(@PathVariable Long id) {
        return workflowService.startDiagnosis(id);
    }

    @PostMapping("/tickets/{id}/start-repair")
    public Map<String, Object> startRepair(@PathVariable Long id) {
        return workflowService.startRepairNoCost(id);
    }

    public record EstimateRequest(BigDecimal amount, BigDecimal estimateAmount, String description, String parts, String partsBreakdown, String labor, String laborBreakdown) {}

    @PostMapping("/tickets/{id}/estimate")
    public Map<String, Object> estimate(@PathVariable Long id, @RequestBody EstimateRequest req) {
        BigDecimal amt = req.amount() != null ? req.amount() : (req.estimateAmount() != null ? req.estimateAmount() : BigDecimal.valueOf(500));
        String parts = req.parts() != null ? req.parts() : (req.partsBreakdown() != null ? req.partsBreakdown() : "Standard replacement parts");
        String labor = req.labor() != null ? req.labor() : (req.laborBreakdown() != null ? req.laborBreakdown() : "Technician labor");
        return workflowService.generateEstimate(id, amt, req.description() != null ? req.description() : "Repair estimate", parts, labor);
    }

    public record EstimateDecisionRequest(boolean approve, String rejectionReason, String action) {}

    @PostMapping("/tickets/{id}/estimate-decision")
    public Map<String, Object> estimateDecision(@PathVariable Long id, @RequestBody EstimateDecisionRequest req) {
        return workflowService.residentEstimateDecision(id, req.approve(), req.rejectionReason(), req.action());
    }

    public record CompletionRequest(String notes, String photoUrl) {}

    @PostMapping(value = "/tickets/{id}/complete", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> completeJson(@PathVariable Long id, @RequestBody CompletionRequest req) {
        return workflowService.markWorkCompleted(id, req.notes(), null, req.photoUrl());
    }

    @PostMapping(value = "/tickets/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> completeMultipart(
            @PathVariable Long id,
            @RequestParam(required = false) String notes,
            @RequestParam(required = false) MultipartFile photo) throws IOException {
        byte[] bytes = photo != null && !photo.isEmpty() ? photo.getBytes() : null;
        return workflowService.markWorkCompleted(id, notes, bytes, null);
    }

    public record ResidentConfirmRequest(boolean confirmed, String reopenReason) {}

    @PostMapping("/tickets/{id}/resident-confirm")
    public Map<String, Object> residentConfirm(@PathVariable Long id, @RequestBody ResidentConfirmRequest req) {
        return workflowService.residentConfirmation(id, req.confirmed(), req.reopenReason());
    }

    public record PaymentRequest(String method, BigDecimal amount, String transactionRef) {}

    @PostMapping("/tickets/{id}/payment")
    public Map<String, Object> payment(@PathVariable Long id, @RequestBody PaymentRequest req) {
        return workflowService.processPayment(id, req.method(), req.amount(), req.transactionRef());
    }

    public record RatingRequest(int rating, String review, List<String> tags) {}

    @PostMapping("/tickets/{id}/rating")
    public Map<String, Object> rating(@PathVariable Long id, @RequestBody RatingRequest req) {
        return workflowService.submitRatingAndClose(id, req.rating(), req.review(), req.tags());
    }

    @GetMapping("/tickets/{id}/invoice")
    public Map<String, Object> invoice(@PathVariable Long id) {
        Map<String, Object> status = workflowService.getWorkflowStatus(id);
        Map<String, Object> inv = new LinkedHashMap<>();
        inv.put("invoiceNumber", status.get("invoiceNumber"));
        inv.put("date", LocalDate.now().toString());
        inv.put("residentName", status.get("requesterName"));
        inv.put("unitNumber", status.get("unitNumber"));
        inv.put("serviceAddress", status.get("serviceAddress"));
        inv.put("serviceCategory", status.get("category"));
        inv.put("serviceDescription", status.get("description"));
        inv.put("technicianName", status.get("assignedPartnerName"));
        inv.put("vendorType", status.get("vendorTypeLabel"));
        inv.put("estimateAmount", status.get("estimateAmount"));
        inv.put("paidAmount", status.get("paidAmount"));
        inv.put("paymentMethod", status.get("paymentMethod"));
        inv.put("paymentStatus", status.get("paymentStatus"));
        inv.put("partsBreakdown", status.get("estimatePartsBreakdown"));
        inv.put("laborBreakdown", status.get("estimateLaborBreakdown"));
        inv.put("societyName", "SmartApartment Residency Management");
        return inv;
    }
}
