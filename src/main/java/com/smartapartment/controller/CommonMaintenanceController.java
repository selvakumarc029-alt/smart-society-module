package com.smartapartment.controller;

import com.smartapartment.entity.CommonMaintenanceTicket;
import com.smartapartment.repository.CommonMaintenanceTicketRepository;
import com.smartapartment.service.CommonMaintenanceService;
import com.smartapartment.service.EmergencyMaintenanceService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/maintenance")
public class CommonMaintenanceController {

    private final CommonMaintenanceTicketRepository tickets;
    private final CommonMaintenanceService service;
    private final EmergencyMaintenanceService dispatch;

    public CommonMaintenanceController(CommonMaintenanceTicketRepository tickets, CommonMaintenanceService service, EmergencyMaintenanceService dispatch) {
        this.tickets = tickets;
        this.service = service;
        this.dispatch = dispatch;
    }

    @GetMapping
    public List<CommonMaintenanceTicket> list(@RequestParam(required = false) String sourcePlatform,
                                              @RequestParam(required = false) String status, HttpSession session) {
        var actor = dispatch.actor(session, sourcePlatform == null ? "smartsociety" : sourcePlatform);
        var stream = tickets.findAll().stream().filter(t -> actor.admin() ||
                (actor.worker() ? java.util.Objects.equals(actor.id(), t.getVendorId()) :
                actor.platform().equalsIgnoreCase(t.getSourcePlatform())));
        if (sourcePlatform != null && !sourcePlatform.isBlank()) {
            stream = stream.filter(t -> sourcePlatform.equalsIgnoreCase(t.getSourcePlatform()));
        }
        if (status != null && !status.isBlank()) {
            stream = stream.filter(t -> status.equalsIgnoreCase(t.getTicketStatus()));
        }
        return stream
                .sorted((left, right) -> String.valueOf(right.getCreatedAt()).compareTo(String.valueOf(left.getCreatedAt())))
                .toList();
    }

    @PostMapping
    @Transactional
    public CommonMaintenanceTicket create(@Valid @RequestBody MaintenanceTicketRequest request, HttpSession session) {
        var actor = dispatch.actor(session, request.sourcePlatform());
        var ticket = service.create(new CommonMaintenanceService.CreateTicketRequest(
                actor.platform(),
                request.targetEntityType(),
                request.targetEntityId(),
                actor.id(),
                actor.name(),
                request.requesterPhone(),
                request.requesterEmail(),
                request.serviceType(),
                request.serviceCategory(),
                request.serviceOption(),
                request.priceLabel(),
                request.warrantyLabel(),
                request.title(),
                request.description(),
                request.serviceAddress(),
                request.city(),
                request.priority(),
                request.preferredAt(),
                request.alternateAt(),
                request.dueAt(),
                null,
                null,
                null,
                null,
                request.externalReference(),
                request.accessType(),
                request.contactMethod(),
                request.attachmentReference()
        ));
        ticket.setTenantId(actor.tenant());
        return tickets.save(ticket);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public CommonMaintenanceTicket updateStatus(@PathVariable Long id, @Valid @RequestBody MaintenanceStatusRequest request, HttpSession session) {
        var actor = dispatch.actor(session, "smartsociety");
        dispatch.admin(actor);
        return service.updateStatus(id, new CommonMaintenanceService.StatusUpdateRequest(
                request.ticketStatus(),
                request.vendorId(),
                request.vendorName(),
                request.vendorPhone(),
                request.vendorEmail(),
                request.externalReference(),
                request.vendorNotes(),
                request.billReference()
        ));
    }

    @PostMapping("/vendor-callback/{id}")
    @Transactional
    public CommonMaintenanceTicket vendorCallback(@PathVariable Long id, @Valid @RequestBody MaintenanceStatusRequest request, HttpSession session) {
        return updateStatus(id, request, session);
    }

    public record MaintenanceTicketRequest(
            @NotBlank String sourcePlatform,
            String targetEntityType,
            Long targetEntityId,
            Long requesterId,
            @Size(max = 120) String requesterName,
            @Size(max = 40) String requesterPhone,
            @Size(max = 160) String requesterEmail,
            @NotBlank String serviceType,
            String serviceCategory,
            String serviceOption,
            String priceLabel,
            String warrantyLabel,
            @NotBlank String title,
            @Size(max = 3000) String description,
            @Size(max = 600) String serviceAddress,
            @Size(max = 60) String city,
            String priority,
            LocalDateTime preferredAt,
            LocalDateTime alternateAt,
            LocalDateTime dueAt,
            Long vendorId,
            String vendorName,
            String vendorPhone,
            String vendorEmail,
            String externalReference,
            String accessType,
            String contactMethod,
            String attachmentReference
    ) {}

    public record MaintenanceStatusRequest(
            @NotBlank String ticketStatus,
            Long vendorId,
            String vendorName,
            String vendorPhone,
            String vendorEmail,
            String externalReference,
            String vendorNotes,
            String billReference
    ) {}
}
