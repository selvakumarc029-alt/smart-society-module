package com.smartapartment.service;

import com.smartapartment.entity.CommonMaintenanceTicket;
import com.smartapartment.repository.CommonMaintenanceTicketRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class CommonMaintenanceService {

    private final CommonMaintenanceTicketRepository tickets;

    public CommonMaintenanceService(CommonMaintenanceTicketRepository tickets) {
        this.tickets = tickets;
    }

    @Transactional
    public CommonMaintenanceTicket create(CreateTicketRequest request) {
        CommonMaintenanceTicket ticket = new CommonMaintenanceTicket();
        ticket.setTenantId(normalizePlatform(request.sourcePlatform()));
        ticket.setSourcePlatform(normalizePlatform(request.sourcePlatform()));
        ticket.setTargetEntityType(text(request.targetEntityType(), "GENERAL"));
        ticket.setTargetEntityId(request.targetEntityId());
        ticket.setRequesterId(request.requesterId());
        ticket.setRequesterName(request.requesterName());
        ticket.setRequesterPhone(request.requesterPhone());
        ticket.setRequesterEmail(request.requesterEmail());
        ticket.setServiceType(text(request.serviceType(), "General maintenance"));
        ticket.setServiceCategory(request.serviceCategory());
        ticket.setServiceOption(request.serviceOption());
        ticket.setPriceLabel(request.priceLabel());
        ticket.setWarrantyLabel(request.warrantyLabel());
        ticket.setTitle(text(request.title(), ticket.getServiceType()));
        ticket.setDescription(request.description());
        ticket.setServiceAddress(request.serviceAddress());
        ticket.setCity(request.city());
        ticket.setPriority(normalizePriority(request.priority()));
        ticket.setTicketStatus("REQUESTED");
        ticket.setPreferredAt(request.preferredAt());
        ticket.setAlternateAt(request.alternateAt());
        LocalDateTime calculatedDueAt = request.dueAt();
        if (calculatedDueAt == null) {
            // Non-emergency track SLA policy: first operational action is expected within 4-24 hours.
            long hours = switch (ticket.getPriority()) {
                case "EMERGENCY", "URGENT" -> 4;
                case "HIGH" -> 8;
                case "LOW" -> 24;
                default -> 16;
            };
            calculatedDueAt = LocalDateTime.now().plusHours(hours);
        }
        ticket.setDueAt(calculatedDueAt);
        ticket.setVendorId(request.vendorId());
        ticket.setVendorName(request.vendorName());
        ticket.setVendorPhone(request.vendorPhone());
        ticket.setVendorEmail(request.vendorEmail());
        ticket.setExternalReference(request.externalReference());
        ticket.setAccessType(request.accessType());
        ticket.setContactMethod(request.contactMethod());
        ticket.setAttachmentReference(request.attachmentReference());
        CommonMaintenanceTicket saved = tickets.save(ticket);
        if (saved.getTicketCode() == null || saved.getTicketCode().isBlank()) {
            int year = saved.getCreatedAt() != null ? saved.getCreatedAt().getYear() : java.time.LocalDate.now().getYear();
            saved.setTicketCode(String.format(Locale.ROOT, "TCK-%04d-%04d", year, saved.getId()));
            saved = tickets.save(saved);
        }
        return saved;
    }

    @Transactional
    public CommonMaintenanceTicket updateStatus(Long id, StatusUpdateRequest request) {
        CommonMaintenanceTicket ticket = tickets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance ticket was not found"));
        String status = normalizeStatus(request.ticketStatus());
        ticket.setTicketStatus(status);
        ticket.setVendorId(request.vendorId() == null ? ticket.getVendorId() : request.vendorId());
        ticket.setVendorName(text(request.vendorName(), ticket.getVendorName()));
        ticket.setVendorPhone(text(request.vendorPhone(), ticket.getVendorPhone()));
        ticket.setVendorEmail(text(request.vendorEmail(), ticket.getVendorEmail()));
        ticket.setExternalReference(text(request.externalReference(), ticket.getExternalReference()));
        ticket.setVendorNotes(text(request.vendorNotes(), ticket.getVendorNotes()));
        ticket.setBillReference(text(request.billReference(), ticket.getBillReference()));
        if ("ASSIGNED".equals(status) || "DISPATCHED".equals(status) || "IN_PROGRESS".equals(status)) {
            ticket.setAssignedAt(ticket.getAssignedAt() == null ? LocalDateTime.now() : ticket.getAssignedAt());
        }
        if ("IN_PROGRESS".equals(status) && ticket.getWorkStartedAt() == null) ticket.setWorkStartedAt(LocalDateTime.now());
        if ("RESOLVED".equals(status) || "CLOSED".equals(status) || "INVOICED".equals(status)) {
            ticket.setResolvedAt(ticket.getResolvedAt() == null ? LocalDateTime.now() : ticket.getResolvedAt());
        }
        return tickets.save(ticket);
    }

    private static String normalizePlatform(String value) {
        String normalized = text(value, "smartsociety").trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("smartsociety") && !normalized.equals("propertydirect")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourcePlatform must be smartsociety or propertydirect");
        }
        return normalized;
    }

    private static String normalizePriority(String value) {
        String normalized = text(value, "MEDIUM").trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY" -> normalized;
            default -> "MEDIUM";
        };
    }

    private static String normalizeStatus(String value) {
        String normalized = text(value, "REQUESTED").trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (normalized) {
            case "PENDING", "OPEN", "REQUESTED" -> "REQUESTED";
            case "ASSIGNED", "DISPATCHED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "INVOICED", "CLOSED", "CANCELLED" -> normalized;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported maintenance status");
        };
    }

    private static String text(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    public record CreateTicketRequest(
            String sourcePlatform,
            String targetEntityType,
            Long targetEntityId,
            Long requesterId,
            String requesterName,
            String requesterPhone,
            String requesterEmail,
            String serviceType,
            String serviceCategory,
            String serviceOption,
            String priceLabel,
            String warrantyLabel,
            String title,
            String description,
            String serviceAddress,
            String city,
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

    public record StatusUpdateRequest(
            String ticketStatus,
            Long vendorId,
            String vendorName,
            String vendorPhone,
            String vendorEmail,
            String externalReference,
            String vendorNotes,
            String billReference
    ) {}
}
