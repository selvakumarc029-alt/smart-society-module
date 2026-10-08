package com.smartapartment.controller;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.CommonMaintenanceTicket;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.CommonMaintenanceTicketRepository;
import com.smartapartment.service.CommonMaintenanceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** SmartSociety worker updates; never accepts PropertyDirect tickets. */
@RestController
@RequestMapping("/api/society/service-tickets")
public class SocietyServiceTicketController {
    private final AppUserRepository users;
    private final CommonMaintenanceTicketRepository tickets;
    private final CommonMaintenanceService service;

    public SocietyServiceTicketController(AppUserRepository users, CommonMaintenanceTicketRepository tickets,
                                         CommonMaintenanceService service) {
        this.users = users;
        this.tickets = tickets;
        this.service = service;
    }

    private AppUser worker() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in as a maintenance worker");
        var user = users.findByEmail(auth.getName()).filter(u -> !u.isAccountLocked())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Active worker account required"));
        if (user.getRole() != UserRole.MAINTENANCE_STAFF)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned maintenance worker can update service status");
        return user;
    }

    private boolean assigned(AppUser user, CommonMaintenanceTicket ticket) {
        return "smartsociety".equalsIgnoreCase(ticket.getSourcePlatform())
                && user.getTenantId() != null && Objects.equals(user.getTenantId(), ticket.getTenantId())
                && Objects.equals(user.getId(), ticket.getVendorId());
    }

    @GetMapping
    public List<CommonMaintenanceTicket> assignedTickets() {
        var user = worker();
        return tickets.findAll().stream().filter(t -> assigned(user, t))
                .sorted((a, b) -> String.valueOf(b.getCreatedAt()).compareTo(String.valueOf(a.getCreatedAt())))
                .toList();
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public CommonMaintenanceTicket update(@PathVariable Long id, @Valid @RequestBody WorkerStatusRequest request) {
        var user = worker();
        var ticket = tickets.findById(id).filter(t -> assigned(user, t))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned service ticket not found"));
        if (request.version() == null || !Objects.equals(request.version(), ticket.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This ticket changed. Refresh before updating it.");
        if (!Set.of("PENDING", "IN_PROGRESS", "RESOLVED").contains(request.ticketStatus()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Pending, In Progress or Resolved");
        if (Set.of("CANCELLED", "CLOSED", "INVOICED").contains(String.valueOf(ticket.getTicketStatus())))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This ticket is closed and cannot be updated");
        if (!"RESOLVED".equals(request.ticketStatus())) ticket.setResolvedAt(null);
        if ("PENDING".equals(request.ticketStatus())) ticket.setWorkStartedAt(null);
        return service.updateStatus(id, new CommonMaintenanceService.StatusUpdateRequest(
                request.ticketStatus(), null, null, null, null, null, null, null));
    }

    public record WorkerStatusRequest(@NotBlank String ticketStatus, Long version) {}
}
