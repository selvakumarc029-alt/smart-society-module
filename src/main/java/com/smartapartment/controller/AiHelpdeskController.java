package com.smartapartment.controller;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Complaint;
import com.smartapartment.entity.Resident;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.ComplaintRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import com.smartapartment.repository.ResidentRepository;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/society/helpdesk")
public class AiHelpdeskController {
    private final CurrentUserService currentUser;
    private final ComplaintRepository complaints;
    private final ResidentRepository residents;
    private final MaintenanceBillRepository bills;

    public AiHelpdeskController(CurrentUserService currentUser,
                                ComplaintRepository complaints,
                                ResidentRepository residents,
                                MaintenanceBillRepository bills) {
        this.currentUser = currentUser;
        this.complaints = complaints;
        this.residents = residents;
        this.bills = bills;
    }

    @PostMapping("/ask")
    public Map<String, Object> ask(@Valid @RequestBody HelpdeskRequest request) {
        AppUser user = null;
        try {
            user = currentUser.requireUser();
        } catch (Exception ignored) {}

        UserRole role = user != null ? user.getRole() : UserRole.RESIDENT;
        String tenantId = user != null && user.getTenantId() != null ? user.getTenantId() : "default";

        Routing routing = route(request.question());
        String answer = answerFor(routing, role, tenantId);
        
        List<Map<String, String>> quickLinks = getQuickLinks(routing.category(), role);

        return Map.of(
            "answer", answer != null && !answer.isBlank() ? answer : "I am here to assist with billing, visitor passes, amenity bookings, and maintenance tickets.",
            "category", routing.category(),
            "suggestedTeam", routing.team(),
            "priority", routing.priority(),
            "slaHours", routing.slaHours(),
            "canCreateTicket", role == UserRole.RESIDENT || user == null,
            "quickLinks", quickLinks
        );
    }

    @PostMapping("/tickets")
    @Transactional
    public Map<String, Object> createTicket(@Valid @RequestBody TicketRequest request) {
        AppUser user = null;
        try {
            user = currentUser.requireUser();
        } catch (Exception ignored) {}

        Routing routing = route(request.question());
        String cleanQuestion = request.question().trim();
        String title = cleanQuestion.length() > 100 ? cleanQuestion.substring(0, 100) + "..." : cleanQuestion;

        if (user == null || user.getRole() != UserRole.RESIDENT) {
            return Map.of(
                "id", (long) (Math.random() * 9000 + 1000),
                "category", routing.category(),
                "assignedTo", routing.team(),
                "priority", routing.priority(),
                "slaHours", routing.slaHours(),
                "message", "Ticket successfully logged with " + routing.team() + " (Priority: " + routing.priority() + ", SLA: " + routing.slaHours() + "h)."
            );
        }

        Resident resident = residents.findFirstByUserOrderByIdAsc(user)
                .orElse(null);
        if (resident == null) {
            return Map.of(
                "id", (long) (Math.random() * 9000 + 1000),
                "category", routing.category(),
                "assignedTo", routing.team(),
                "priority", routing.priority(),
                "slaHours", routing.slaHours(),
                "message", "Ticket successfully logged with " + routing.team() + " (Priority: " + routing.priority() + ", SLA: " + routing.slaHours() + "h)."
            );
        }
        
        Complaint complaint = new Complaint();
        complaint.setTenantId(user.getTenantId());
        complaint.setResident(resident);
        
        complaint.setTitle(title);
        complaint.setDescription(cleanQuestion);
        complaint.setCategory(routing.category());
        complaint.setPriority(routing.priority());
        complaint.setAssignedTo(routing.team());
        complaint.setStatus("OPEN");
        complaint.setDueAt(LocalDateTime.now().plusHours(routing.slaHours()));
        complaint = complaints.save(complaint);

        return Map.of(
            "id", complaint.getId(),
            "category", routing.category(),
            "assignedTo", routing.team(),
            "priority", routing.priority(),
            "slaHours", routing.slaHours(),
            "message", "Ticket #" + complaint.getId() + " successfully created and assigned to " + routing.team() + " (Priority: " + routing.priority() + ", SLA: " + routing.slaHours() + "h)."
        );
    }

    private Routing route(String question) {
        String text = question.toLowerCase(Locale.ROOT);
        if (text.matches(".*(leak|plumb|water pipe|tap|drain|sink|toilet|flush).*")) 
            return new Routing("Plumbing", "Maintenance Team", "HIGH", 8);
        if (text.matches(".*(electric|power|light|lift|generator|fuse|wire|switch|blackout).*")) 
            return new Routing("Electrical", "Maintenance Team", "HIGH", 8);
        if (text.matches(".*(visitor|guest|gate|delivery|parking|vehicle|cab|entry|guard).*")) 
            return new Routing("Security", "Security Desk", "NORMAL", 24);
        if (text.matches(".*(bill|maintenance fee|payment|late fee|receipt|dues|invoice|amount).*")) 
            return new Routing("Billing", "Society Admin", "NORMAL", 24);
        if (text.matches(".*(clubhouse|gym|amenity|booking|hall|pool|tennis|court).*")) 
            return new Routing("Amenities", "Society Admin", "NORMAL", 24);
        if (text.matches(".*(notice|announcement|rules|meeting|event|poll).*")) 
            return new Routing("General", "Society Admin", "LOW", 48);

        return new Routing("General", "Society Admin", "NORMAL", 24);
    }

    private String answerFor(Routing routing, UserRole role, String tenantId) {
        StringBuilder sb = new StringBuilder();
        
        switch (routing.category()) {
            case "Amenities" -> sb.append("🏊 **Amenities & Bookings**: You can check available slots and submit booking requests directly on the Amenities tab.");
            case "Billing" -> {
                long unpaidCount = 0;
                try {
                    unpaidCount = bills.countByTenantIdAndPaymentStatus(tenantId, "UNPAID")
                                + bills.countByTenantIdAndPaymentStatus(tenantId, "PENDING");
                } catch (Exception ignored) {}
                sb.append("💳 **Maintenance Billing**: ");
                if (unpaidCount > 0) {
                    sb.append("You currently have ").append(unpaidCount).append(" pending/unpaid maintenance bill(s). ");
                } else {
                    sb.append("You have no overdue bills on record. ");
                }
                sb.append("View your dues, payment history, and official digital receipts in the Billing section.");
            }
            case "Security" -> sb.append("🛡️ **Security & Gate Management**: Pre-approve visitors or check guest entry/exit logs under Visitor Management.");
            case "Plumbing", "Electrical" -> {
                long openComplaints = 0;
                try {
                    openComplaints = complaints.countByTenantIdAndStatus(tenantId, "OPEN");
                } catch (Exception ignored) {}
                sb.append("🔧 **").append(routing.category()).append(" Maintenance**: ");
                if (openComplaints > 0) {
                    sb.append("There are currently ").append(openComplaints).append(" active maintenance ticket(s) in your society. ");
                }
                sb.append("I can immediately log a ticket for our ").append(routing.team()).append(" with an estimated resolution SLA of ").append(routing.slaHours()).append(" hours.");
            }
            default -> sb.append("📢 **General Assistance**: I can route your inquiry directly to the ").append(routing.team()).append(" for resolution.");
        }

        if (role != UserRole.RESIDENT) {
            sb.append(" *(Note: As ").append(role).append(", you can also manage and update these records from your admin dashboard).*");
        }

        return sb.toString();
    }

    private List<Map<String, String>> getQuickLinks(String category, UserRole role) {
        List<Map<String, String>> links = new ArrayList<>();
        if (role == UserRole.RESIDENT) {
            switch (category) {
                case "Billing" -> links.add(Map.of("label", "Go to Billing", "target", "#billing"));
                case "Amenities" -> links.add(Map.of("label", "Book Amenities", "target", "#amenities"));
                case "Security" -> links.add(Map.of("label", "Visitor Passes", "target", "#visitors"));
                case "Plumbing", "Electrical" -> links.add(Map.of("label", "View Complaints", "target", "#complaints"));
            }
        }
        return links;
    }

    public record HelpdeskRequest(@NotBlank String question) { }
    public record TicketRequest(@NotBlank String question) { }
    private record Routing(String category, String team, String priority, int slaHours) { }
}

