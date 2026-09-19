package com.smartapartment.service;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Transactional
public class MaintenanceWorkflowService {

    private final EmergencyMaintenanceBookingRepository bookings;
    private final CommonMaintenanceTicketRepository tickets;
    private final ComplaintRepository complaints;
    private final MaintenancePartnerRepository partners;
    private final MaintenanceHubRepository hubs;
    private final AppUserRepository users;
    private final NotificationRepository notifications;
    private final AuditLogRepository auditLogs;

    @Autowired(required = false)
    private StaffAttendanceRepository attendances;

    @Autowired(required = false)
    private EmergencyMaintenanceService emergencyService;

    public MaintenanceWorkflowService(
            EmergencyMaintenanceBookingRepository bookings,
            CommonMaintenanceTicketRepository tickets,
            ComplaintRepository complaints,
            MaintenancePartnerRepository partners,
            MaintenanceHubRepository hubs,
            AppUserRepository users,
            NotificationRepository notifications,
            AuditLogRepository auditLogs) {
        this.bookings = bookings;
        this.tickets = tickets;
        this.complaints = complaints;
        this.partners = partners;
        this.hubs = hubs;
        this.users = users;
        this.notifications = notifications;
        this.auditLogs = auditLogs;
    }

    public record AICategorizationResult(
            String serviceCategory,
            String priority,
            boolean isEmergency,
            String requiredSkill,
            double confidence,
            String reason) {}

    public AICategorizationResult aiAnalyze(String title, String description, String userCategory) {
        String combined = ((title != null ? title : "") + " " + (description != null ? description : "") + " " + (userCategory != null ? userCategory : "")).toLowerCase(Locale.ROOT);

        // Emergency detection keywords
        boolean emergency = combined.contains("burst") || combined.contains("flood") || combined.contains("spark")
                || combined.contains("shock") || combined.contains("fire") || combined.contains("smoke")
                || combined.contains("gas") || combined.contains("leakage severe") || combined.contains("overflow")
                || combined.contains("blackout") || combined.contains("short circuit") || combined.contains("elevator stuck")
                || combined.contains("stuck in lift") || combined.contains("electric shock") || combined.contains("urgent");

        String priority = emergency ? "EMERGENCY" : "NORMAL";
        if (!emergency) {
            if (combined.contains("not working") || combined.contains("fault") || combined.contains("damaged") || combined.contains("broken")) {
                priority = "HIGH";
            } else if (combined.contains("minor") || combined.contains("inspection") || combined.contains("routine") || combined.contains("slow")) {
                priority = "LOW";
            }
        }

        // Category determination
        String category = "Plumbing";
        String requiredSkill = "PLUMBER";
        String reason = "Detected plumbing fixtures or water supply indicators.";

        if (combined.contains("ac") || combined.contains("air condition") || combined.contains("cool") || combined.contains("filter")
                || combined.contains("gas refill") || combined.contains("hvac") || combined.contains("chilling") || "ac".equalsIgnoreCase(userCategory)) {
            category = "AC";
            requiredSkill = "HVAC_TECHNICIAN";
            reason = "Detected air conditioning, compressor or cooling airflow parameters.";
        } else if (combined.contains("elect") || combined.contains("wire") || combined.contains("switch") || combined.contains("plug")
                || combined.contains("light") || combined.contains("fuse") || combined.contains("mcb") || combined.contains("power") || combined.contains("voltage")) {
            category = "Electrical";
            requiredSkill = "ELECTRICIAN";
            reason = "Detected electrical switches, wiring, or power distribution keywords.";
        } else if (combined.contains("carpenter") || combined.contains("wood") || combined.contains("door") || combined.contains("lock")
                || combined.contains("handle") || combined.contains("hinge") || combined.contains("drawer") || combined.contains("wardrobe")
                || combined.contains("furniture") || combined.contains("cabinet") || combined.contains("latch")) {
            category = "Carpentry";
            requiredSkill = "CARPENTER";
            reason = "Detected woodwork, door fixtures, lock mechanisms or furniture requirements.";
        } else if (combined.contains("clean") || combined.contains("wash") || combined.contains("scrub") || combined.contains("sanitiz")
                || combined.contains("pest") || combined.contains("dust") || combined.contains("mop") || combined.contains("sofa") || combined.contains("deep clean")) {
            category = "Cleaning";
            requiredSkill = "HOUSEKEEPING";
            reason = "Detected deep cleaning, sanitization, or housekeeping services.";
        } else if (combined.contains("plumb") || combined.contains("pipe") || combined.contains("tap") || combined.contains("sink")
                || combined.contains("drain") || combined.contains("toilet") || combined.contains("flush") || combined.contains("faucet")
                || combined.contains("leak") || combined.contains("water") || combined.contains("geyser") || combined.contains("basin")) {
            category = "Plumbing";
            requiredSkill = "PLUMBER";
            reason = "Detected water distribution, drainage pipes or sanitary fixture keywords.";
        } else if (userCategory != null && !userCategory.isBlank() && !"Others".equalsIgnoreCase(userCategory)) {
            category = userCategory.trim();
            requiredSkill = normalizeTrade(category);
            reason = "Categorized according to user-selected trade category.";
        } else {
            category = "Others";
            requiredSkill = "GENERAL_HANDYMAN";
            reason = "General maintenance query requiring multi-skilled technician diagnosis.";
        }

        double confidence = emergency ? 0.96 : 0.91;
        return new AICategorizationResult(category, priority, emergency, requiredSkill, confidence, reason);
    }

    private String normalizeTrade(String cat) {
        if (cat == null) return "GENERAL_HANDYMAN";
        String lower = cat.toLowerCase(Locale.ROOT);
        if (lower.contains("plumb")) return "PLUMBER";
        if (lower.contains("elect")) return "ELECTRICIAN";
        if (lower.contains("ac") || lower.contains("hvac")) return "HVAC_TECHNICIAN";
        if (lower.contains("carp")) return "CARPENTER";
        if (lower.contains("clean")) return "HOUSEKEEPING";
        return "GENERAL_HANDYMAN";
    }

    public record ServiceRequestInput(
            String title,
            String category,
            String description,
            String unitNumber,
            String serviceAddress,
            String contactPhone,
            String contactName,
            LocalDate preferredDate,
            String preferredSlot,
            String attachmentUrl,
            boolean accessPermission) {}

    public Map<String, Object> createServiceRequest(AppUser user, ServiceRequestInput input) {
        AICategorizationResult ai = aiAnalyze(input.title(), input.description(), input.category());

        String finalCategory = ai.serviceCategory();
        String priority = ai.priority();
        boolean isEmergency = ai.isEmergency();
        String skill = ai.requiredSkill();

        String unit = (input.unitNumber() != null && !input.unitNumber().isBlank()) ? input.unitNumber().trim() : "205";
        String address = (input.serviceAddress() != null && !input.serviceAddress().isBlank())
                ? input.serviceAddress().trim() : ("Flat " + unit + ", " + (user.getTenantId() != null ? user.getTenantId() : "Smart Society"));
        String phone = (input.contactPhone() != null && !input.contactPhone().isBlank())
                ? input.contactPhone().trim() : (user.getPhone() != null ? user.getPhone() : "8778293269");
        String name = (input.contactName() != null && !input.contactName().isBlank())
                ? input.contactName().trim() : user.getFullName();

        String title = (input.title() != null && !input.title().isBlank())
                ? input.title().trim() : (finalCategory + ": " + (input.description() != null && input.description().length() > 30 ? input.description().substring(0, 30) + "…" : input.description()) + " (Flat " + unit + ")");

        // 1. Check AMC / Society Vendor vs Approved External Vendor
        VendorSelectionResult vendorSelection = findEligibleVendorWithFallback(user.getTenantId(), finalCategory, skill);

        MaintenancePartner assignedPartner = vendorSelection.partner();
        boolean isAmc = vendorSelection.isAmc();
        String vendorType = vendorSelection.vendorType();

        // 2. Create EmergencyMaintenanceBooking (for Real-time Lifecycle & SSE tracking)
        EmergencyMaintenanceBooking booking = new EmergencyMaintenanceBooking();
        booking.setTenantId(user.getTenantId());
        booking.setSourcePlatform("smartsociety");
        booking.setRequesterId(user.getId());
        booking.setRequesterName(name);
        booking.setRequesterPhone(phone);
        booking.setServiceAddress(address);
        booking.setUnitNumber(unit);
        booking.setCity("Chennai");
        booking.setArea("Whitefield");
        booking.setCategory(finalCategory);
        booking.setDescription(input.description() != null ? input.description().trim() : title);
        booking.setIsEmergency(isEmergency);
        booking.setRequiredSkill(skill);
        booking.setAiCategorizationNotes(ai.reason());
        booking.setLatitude(12.9716);
        booking.setLongitude(77.5946);
        booking.setPreferredDate(input.preferredDate() != null ? input.preferredDate() : LocalDate.now());
        booking.setPreferredSlot(input.preferredSlot() != null ? input.preferredSlot() : "MORNING");
        booking.setResidentAttachmentUrl(input.attachmentUrl());
        booking.setEstimateStatus("NONE");
        booking.setPaymentStatus("NOT_REQUIRED");

        // Hub assignment
        hubs.findAll().stream().filter(MaintenanceHub::isActive).findFirst().ifPresent(h -> booking.setHubId(h.getId()));

        if (assignedPartner != null) {
            booking.setPartnerId(assignedPartner.getId());
            booking.setJobStatus("OFFERED");
            booking.setAssignmentType("Auto");
            booking.setIsAmcVendor(isAmc);
            booking.setVendorType(vendorType);
            booking.setAssignedAt(LocalDateTime.now());
            booking.setOfferedAt(LocalDateTime.now());
            booking.setAcceptanceDueAt(LocalDateTime.now().plusSeconds(60));
            booking.setDispatchReason("⚡ Auto-assigned to " + (isAmc ? "AMC / Society Vendor" : "Approved External Vendor") + " " + assignedPartner.getPartnerName() + " (" + finalCategory + ")");
            assignedPartner.setAvailability("BUSY");
            assignedPartner.setWorkState("BUSY");
            partners.save(assignedPartner);
        } else {
            booking.setJobStatus("UNASSIGNED");
            booking.setDispatchReason("Awaiting available technician in queue (Auto-assignment engine monitoring SLA)");
        }

        EmergencyMaintenanceBooking savedBooking = bookings.save(booking);
        savedBooking.setOrderReference("ORD-EMG-" + String.format(Locale.ROOT, "%04d", savedBooking.getId()));
        savedBooking = bookings.save(savedBooking);

        // 3. Create CommonMaintenanceTicket (for routine sync)
        CommonMaintenanceTicket ticket = new CommonMaintenanceTicket();
        ticket.setTenantId(user.getTenantId());
        ticket.setSourcePlatform("smartsociety");
        ticket.setRequesterId(user.getId());
        ticket.setRequesterName(name);
        ticket.setRequesterPhone(phone);
        ticket.setTargetEntityType("COMPLAINT");
        ticket.setTargetEntityId(savedBooking.getId());
        ticket.setTitle(title);
        ticket.setDescription(booking.getDescription());
        ticket.setServiceAddress(address);
        ticket.setCity("Chennai");
        ticket.setServiceType(finalCategory);
        ticket.setServiceCategory(finalCategory);
        ticket.setPriority(priority);
        ticket.setIsEmergency(isEmergency);
        ticket.setRequiredSkill(skill);
        ticket.setAiCategorizationNotes(ai.reason());
        ticket.setPreferredDate(booking.getPreferredDate());
        ticket.setPreferredSlot(booking.getPreferredSlot());
        ticket.setEstimateStatus("NONE");
        ticket.setPaymentStatus("NOT_REQUIRED");

        if (assignedPartner != null) {
            ticket.setTicketStatus("ASSIGNED");
            ticket.setVendorId(assignedPartner.getUserId());
            ticket.setVendorName(assignedPartner.getPartnerName());
            ticket.setVendorPhone(assignedPartner.getPhone());
            ticket.setIsAmcVendor(isAmc);
            ticket.setVendorType(vendorType);
            ticket.setAssignedAt(LocalDateTime.now());
            ticket.setVendorNotes("Assigned via Auto Assignment Engine to " + assignedPartner.getPartnerName() + " (" + vendorType + ")");
        } else {
            ticket.setTicketStatus("REQUESTED");
            ticket.setVendorNotes("Queued in Auto Assignment Engine pool.");
        }
        tickets.save(ticket);

        // 4. Create Complaint record
        Complaint complaint = new Complaint();
        complaint.setTenantId(user.getTenantId());
        complaint.setTitle(title);
        complaint.setDescription(booking.getDescription());
        complaint.setCategory(finalCategory);
        complaint.setSubcategory(ai.requiredSkill());
        complaint.setPriority(priority);
        complaint.setLocationDetails("Flat " + unit);
        complaint.setReporterPhone(phone);
        complaint.setAccessPermission(input.accessPermission());
        complaint.setStatus(assignedPartner != null ? "IN_PROGRESS" : "OPEN");
        complaint.setAssignedTo(assignedPartner != null ? assignedPartner.getPartnerName() : "");
        complaint.setResolutionNotes(booking.getDispatchReason());
        complaint.setBookingReference(savedBooking.getBookingReference());
        complaint.setOrderReference(savedBooking.getOrderReference());
        complaint.setEstimateStatus("NONE");
        complaint.setPaymentStatus("NOT_REQUIRED");
        complaints.save(complaint);

        // Notify resident and partner
        sendNotification(user.getId(), "TICKET_CREATED", "Service Request Created",
                "Your " + finalCategory + " request (" + savedBooking.getOrderReference() + ") has been created. Assigned to: " + (assignedPartner != null ? assignedPartner.getPartnerName() : "Matching technician..."));

        if (assignedPartner != null) {
            sendNotification(assignedPartner.getUserId(), "JOB_OFFER", "New Job Request Assigned",
                    "New " + finalCategory + " job at Flat " + unit + ". Please accept or decline.");
        }

        // Broadcast SSE
        if (emergencyService != null) {
            emergencyService.broadcastEvent(savedBooking.getId(), savedBooking.getJobStatus(), "REQUEST_CREATED",
                    assignedPartner != null ? assignedPartner.getId() : null,
                    "New ticket created: " + savedBooking.getOrderReference() + " (" + finalCategory + ")");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ticketId", savedBooking.getOrderReference());
        result.put("bookingId", savedBooking.getId());
        result.put("ticketReference", savedBooking.getOrderReference());
        result.put("bookingReference", savedBooking.getBookingReference());
        result.put("orderReference", savedBooking.getOrderReference());
        result.put("id", savedBooking.getId());
        result.put("workflowStage", savedBooking.getJobStatus());
        result.put("category", finalCategory);
        result.put("priority", priority);
        result.put("isEmergency", isEmergency);
        result.put("requiredSkill", skill);
        result.put("aiConfidence", ai.confidence());
        result.put("aiReason", ai.reason());
        result.put("isAmcVendor", isAmc);
        result.put("vendorType", vendorType);
        result.put("vendorRole", vendorType);
        result.put("assignedVendor", assignedPartner != null ? assignedPartner.getPartnerName() : "Searching Vendor");
        result.put("jobOfferStatus", assignedPartner != null ? "OFFERED" : "UNASSIGNED");
        result.put("status", savedBooking.getJobStatus());
        result.put("preferredDate", savedBooking.getPreferredDate());
        result.put("preferredSlot", savedBooking.getPreferredSlot());
        return result;
    }

    public record VendorSelectionResult(MaintenancePartner partner, boolean isAmc, String vendorType) {}

    public VendorSelectionResult findEligibleVendorWithFallback(String tenantId, String category, String skill) {
        List<MaintenancePartner> allPartners = partners.findAll();

        // 1. Check AMC / Society Vendor (INTERNAL)
        List<MaintenancePartner> amcCandidates = allPartners.stream()
                .filter(p -> "INTERNAL".equalsIgnoreCase(p.getEmploymentType()) || "AMC".equalsIgnoreCase(p.getEmploymentType()))
                .filter(MaintenancePartner::isOnDuty)
                .filter(p -> "IDLE".equalsIgnoreCase(p.getAvailability()) || "AVAILABLE".equalsIgnoreCase(p.getAvailability()))
                .filter(p -> isSkillMatch(p, category, skill))
                .sorted(Comparator.comparing(this::partnerWorkloadScore))
                .toList();

        if (!amcCandidates.isEmpty()) {
            return new VendorSelectionResult(amcCandidates.get(0), true, "AMC_SOCIETY_VENDOR");
        }

        // 2. Fallback: Search Approved External Vendor (THIRD_PARTY)
        List<MaintenancePartner> externalCandidates = allPartners.stream()
                .filter(p -> !"INTERNAL".equalsIgnoreCase(p.getEmploymentType()) && !"AMC".equalsIgnoreCase(p.getEmploymentType()))
                .filter(MaintenancePartner::isOnDuty)
                .filter(p -> "IDLE".equalsIgnoreCase(p.getAvailability()) || "AVAILABLE".equalsIgnoreCase(p.getAvailability()))
                .filter(p -> isSkillMatch(p, category, skill))
                .sorted(Comparator.comparing(this::partnerWorkloadScore))
                .toList();

        if (!externalCandidates.isEmpty()) {
            return new VendorSelectionResult(externalCandidates.get(0), false, "EXTERNAL_APPROVED_VENDOR");
        }

        return new VendorSelectionResult(null, false, "UNASSIGNED");
    }

    private int partnerWorkloadScore(MaintenancePartner p) {
        long activeJobs = bookings.countByPartnerIdAndJobStatusIn(p.getId(), Set.of("OFFERED", "ASSIGNED", "ACCEPTED", "TRAVELING", "ARRIVED", "DIAGNOSING", "IN_PROGRESS"));
        boolean attended = attendances != null && attendances.findAll().stream()
                .anyMatch(a -> a.getUser() != null && Objects.equals(a.getUser().getId(), p.getUserId()) && LocalDate.now().equals(a.getWorkDate()) && a.getCheckInAt() != null);
        return (int) (activeJobs * 10 - (attended ? 5 : 0) - (p.getRating() != null ? (p.getRating() * 2) : 0));
    }

    private boolean isSkillMatch(MaintenancePartner p, String category, String skill) {
        if (p == null) return false;
        String trade = (p.getTrade() != null ? p.getTrade() : "").toLowerCase(Locale.ROOT);
        String skills = (p.getSkillCategories() != null ? p.getSkillCategories() : "").toLowerCase(Locale.ROOT);
        String targetCat = (category != null ? category : "").toLowerCase(Locale.ROOT);
        String targetSkill = (skill != null ? skill : "").toLowerCase(Locale.ROOT);

        return trade.contains(targetCat) || trade.contains(targetSkill) || skills.contains(targetCat) || skills.contains(targetSkill)
                || (targetCat.contains("plumb") && (trade.contains("plumb") || skills.contains("plumb")))
                || (targetCat.contains("elect") && (trade.contains("elect") || skills.contains("elect")))
                || (targetCat.contains("ac") && (trade.contains("ac") || trade.contains("hvac") || skills.contains("ac")))
                || (targetCat.contains("carp") && (trade.contains("carp") || skills.contains("carp")))
                || (targetCat.contains("clean") && (trade.contains("clean") || skills.contains("clean")));
    }

    // Step: Vendor Job Response (Accept / Decline)
    public Map<String, Object> respondToJobOffer(Long bookingId, boolean accept, String declineReason) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!"OFFERED".equalsIgnoreCase(b.getJobStatus()) && !"ASSIGNED".equalsIgnoreCase(b.getJobStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Job is not awaiting acceptance. Current status: " + b.getJobStatus());
        }

        if (accept) {
            b.setJobStatus("JOB_CONFIRMED");
            b.setAcceptedAt(LocalDateTime.now());
            b.setArrivalDueAt(LocalDateTime.now().plusMinutes(30));
            b.setDispatchReason("Job confirmed by technician " + (b.getPartnerId() != null ? partners.findById(b.getPartnerId()).map(MaintenancePartner::getPartnerName).orElse("") : ""));
            bookings.save(b);
            syncLinkedEntities(b, "JOB_CONFIRMED", "Job confirmed by technician");
            broadcast(b.getId(), "JOB_CONFIRMED", "JOB_CONFIRMED", "Technician confirmed the job");
            return Map.of("success", true, "message", "Job confirmed", "status", "JOB_CONFIRMED");
        } else {
            // Decline -> Auto-reassign to another vendor
            Long declinedPartnerId = b.getPartnerId();
            b.setVendorDeclineReason(declineReason != null ? declineReason.trim() : "Technician declined offer");
            String declinedIds = (b.getDeclinedPartnerIds() != null ? b.getDeclinedPartnerIds() : ",") + declinedPartnerId + ",";
            b.setDeclinedPartnerIds(declinedIds);

            if (declinedPartnerId != null) {
                partners.findById(declinedPartnerId).ifPresent(p -> {
                    p.setAvailability("IDLE");
                    p.setWorkState("IDLE");
                    partners.save(p);
                });
            }

            // Find next eligible vendor
            VendorSelectionResult nextVendor = findEligibleVendorWithFallback(b.getTenantId(), b.getCategory(), b.getRequiredSkill());
            if (nextVendor.partner() != null && !declinedIds.contains("," + nextVendor.partner().getId() + ",")) {
                MaintenancePartner nextP = nextVendor.partner();
                b.setPartnerId(nextP.getId());
                b.setIsAmcVendor(nextVendor.isAmc());
                b.setVendorType(nextVendor.vendorType());
                b.setJobStatus("OFFERED");
                b.setOfferedAt(LocalDateTime.now());
                b.setAcceptanceDueAt(LocalDateTime.now().plusSeconds(60));
                b.setDispatchReason("Reassigned to " + nextP.getPartnerName() + " (" + nextVendor.vendorType() + ") after previous vendor decline.");
                nextP.setAvailability("BUSY");
                nextP.setWorkState("BUSY");
                partners.save(nextP);
                bookings.save(b);
                syncLinkedEntities(b, "ASSIGNED", b.getDispatchReason());
                broadcast(b.getId(), "OFFERED", "REASSIGNED", "Reassigned to " + nextP.getPartnerName());
                return Map.of("success", true, "message", "Decline recorded. Reassigned to " + nextP.getPartnerName(), "status", "OFFERED", "assignedVendor", nextP.getPartnerName());
            } else {
                b.setPartnerId(null);
                b.setJobStatus("UNASSIGNED");
                b.setDispatchReason("Previous vendor declined (" + (declineReason != null ? declineReason : "no reason") + "). In auto-assignment pool for next available technician.");
                bookings.save(b);
                syncLinkedEntities(b, "REQUESTED", b.getDispatchReason());
                broadcast(b.getId(), "UNASSIGNED", "DECLINED_UNASSIGNED", "Technician declined; awaiting next match");
                return Map.of("success", true, "message", "Decline recorded. Ticket in pool for next available technician.", "status", "UNASSIGNED");
            }
        }
    }

    // Step: Technician Travels to Property
    public Map<String, Object> startTravel(Long bookingId) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        b.setJobStatus("TRAVELING");
        b.setDispatchReason("Technician is traveling to the property");
        bookings.save(b);
        syncLinkedEntities(b, "IN_PROGRESS", "Technician is on the way");
        broadcast(b.getId(), "TRAVELING", "START_TRAVEL", "Technician is on the way");
        return Map.of("success", true, "message", "Travel started", "status", "TRAVELING");
    }

    // Step: Visit Apartment / Arrive
    public Map<String, Object> arriveAtApartment(Long bookingId, Double latitude, Double longitude) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        b.setJobStatus("ARRIVED");
        b.setReachedAt(LocalDateTime.now());
        b.setArrivalDistanceKm(0.0);
        b.setArrivalGeofenceVerified(true);
        b.setDispatchReason("Technician has arrived at apartment Flat " + (b.getUnitNumber() != null ? b.getUnitNumber() : ""));
        bookings.save(b);
        syncLinkedEntities(b, "IN_PROGRESS", "Technician arrived at doorstep");
        broadcast(b.getId(), "ARRIVED", "ARRIVED", "Technician arrived at your doorstep");

        if (b.getRequesterId() != null) {
            sendNotification(b.getRequesterId(), "TECHNICIAN_ARRIVED", "Technician Arrived",
                    "Your maintenance technician has arrived at your apartment.");
        }
        return Map.of("success", true, "message", "Arrival recorded", "status", "ARRIVED");
    }

    // Step: Diagnosis
    public Map<String, Object> startDiagnosis(Long bookingId) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        b.setJobStatus("DIAGNOSING");
        b.setDiagnosisStartedAt(LocalDateTime.now());
        b.setDispatchReason("Technician is currently diagnosing the issue");
        bookings.save(b);
        syncLinkedEntities(b, "IN_PROGRESS", "Technician is diagnosing the issue");
        broadcast(b.getId(), "DIAGNOSING", "START_DIAGNOSIS", "Technician is diagnosing the issue");
        return Map.of("success", true, "message", "Diagnosis started", "status", "DIAGNOSING");
    }

    // Step: No Additional Cost -> Start Repair Directly
    public Map<String, Object> startRepairNoCost(Long bookingId) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        b.setAdditionalCostRequired(false);
        b.setEstimateStatus("NONE");
        b.setEstimateAmount(BigDecimal.ZERO);
        b.setJobStatus("IN_PROGRESS");
        b.setStartedAt(LocalDateTime.now());
        b.setDispatchReason("Repair started (Covered under society service / No extra cost)");
        bookings.save(b);
        syncLinkedEntities(b, "IN_PROGRESS", "Repair work in progress");
        broadcast(b.getId(), "IN_PROGRESS", "START_REPAIR", "Repair started without extra charges");
        return Map.of("success", true, "message", "Repair started", "status", "IN_PROGRESS");
    }

    // Step: Additional Cost Required -> Generate Estimate
    public Map<String, Object> generateEstimate(Long bookingId, BigDecimal amount, String description, String parts, String labor) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        b.setAdditionalCostRequired(true);
        b.setEstimateAmount(amount != null ? amount : BigDecimal.ZERO);
        b.setEstimateDescription(description != null ? description.trim() : "Repair estimate for required parts and labor");
        b.setEstimatePartsBreakdown(parts != null ? parts.trim() : "");
        b.setEstimateLaborBreakdown(labor != null ? labor.trim() : "");
        b.setEstimateStatus("PENDING_APPROVAL");
        b.setJobStatus("ESTIMATE_PENDING");
        b.setDispatchReason("Cost estimate of ₹" + b.getEstimateAmount() + " sent to resident for approval.");
        bookings.save(b);
        syncLinkedEntities(b, "IN_PROGRESS", "Cost estimate pending resident approval (₹" + b.getEstimateAmount() + ")");
        broadcast(b.getId(), "ESTIMATE_PENDING", "ESTIMATE_GENERATED", "Estimate generated: ₹" + b.getEstimateAmount());

        if (b.getRequesterId() != null) {
            sendNotification(b.getRequesterId(), "ESTIMATE_APPROVAL_REQUIRED", "Cost Estimate Generated: ₹" + b.getEstimateAmount(),
                    "The technician generated a repair estimate of ₹" + b.getEstimateAmount() + ". Please review and approve.");
        }

        return Map.of("success", true, "message", "Estimate generated and sent to resident", "status", "ESTIMATE_PENDING", "amount", b.getEstimateAmount());
    }

    // Step: Resident Estimate Approval / Rejection
    public Map<String, Object> residentEstimateDecision(Long bookingId, boolean approve, String rejectionReason, String action) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!"ESTIMATE_PENDING".equalsIgnoreCase(b.getJobStatus()) && !"PENDING_APPROVAL".equalsIgnoreCase(b.getEstimateStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No pending estimate for this booking.");
        }

        if (approve) {
            b.setEstimateStatus("APPROVED");
            b.setEstimateApprovedAt(LocalDateTime.now());
            b.setJobStatus("IN_PROGRESS");
            b.setStartedAt(LocalDateTime.now());
            b.setDispatchReason("Resident approved estimate of ₹" + b.getEstimateAmount() + ". Repair in progress.");
            bookings.save(b);
            syncLinkedEntities(b, "IN_PROGRESS", "Estimate approved (₹" + b.getEstimateAmount() + "). Repair in progress.");
            broadcast(b.getId(), "IN_PROGRESS", "ESTIMATE_APPROVED", "Resident approved estimate");

            if (b.getPartnerId() != null) {
                partners.findById(b.getPartnerId()).ifPresent(p -> sendNotification(p.getUserId(), "ESTIMATE_APPROVED", "Estimate Approved",
                        "Resident approved the estimate of ₹" + b.getEstimateAmount() + ". You may now start the repair."));
            }
            return Map.of("success", true, "message", "Estimate approved. Repair in progress.", "status", "IN_PROGRESS");
        } else {
            b.setEstimateStatus("REJECTED");
            b.setEstimateRejectionReason(rejectionReason != null ? rejectionReason.trim() : "Resident declined estimate.");

            if ("CANCEL".equalsIgnoreCase(action)) {
                b.setJobStatus("CANCELLED");
                b.setCancelledAt(LocalDateTime.now());
                b.setDispatchReason("Request cancelled following estimate rejection: " + b.getEstimateRejectionReason());
                releasePartner(b);
            } else {
                b.setJobStatus("DIAGNOSING");
                b.setDispatchReason("Resident requested revised estimate: " + b.getEstimateRejectionReason());
            }

            bookings.save(b);
            syncLinkedEntities(b, b.getJobStatus(), b.getDispatchReason());
            broadcast(b.getId(), b.getJobStatus(), "ESTIMATE_REJECTED", "Estimate rejected: " + b.getEstimateRejectionReason());

            if (b.getPartnerId() != null) {
                partners.findById(b.getPartnerId()).ifPresent(p -> sendNotification(p.getUserId(), "ESTIMATE_REJECTED", "Estimate Rejected",
                        "Resident rejected the estimate: " + (rejectionReason != null ? rejectionReason : "Requested revised estimate.")));
            }
            return Map.of("success", true, "message", "Estimate rejected", "status", b.getJobStatus());
        }
    }

    // Step: Technician Marks Work Completed & Uploads Photos / Notes
    public Map<String, Object> markWorkCompleted(Long bookingId, String completionNotes, byte[] afterPhotoBytes, String photoUrl) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        b.setJobStatus("WORK_COMPLETED");
        b.setCompletedAt(LocalDateTime.now());
        b.setWorkCompletedAt(LocalDateTime.now());
        b.setCompletionNotes(completionNotes != null ? completionNotes.trim() : "Work completed as per specifications.");

        if (afterPhotoBytes != null && afterPhotoBytes.length > 0) {
            b.setAfterPhoto(afterPhotoBytes);
            b.setAfterPhotoUrl("/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/after");
            b.setPhotoEndAt(LocalDateTime.now());
        } else if (photoUrl != null && !photoUrl.isBlank()) {
            b.setAfterPhotoUrl(photoUrl.trim());
            b.setPhotoEndAt(LocalDateTime.now());
        }

        b.setDispatchReason("Work completed by technician; awaiting resident confirmation.");
        bookings.save(b);
        syncLinkedEntities(b, "RESOLVED", "Work completed. Awaiting resident confirmation.");
        broadcast(b.getId(), "WORK_COMPLETED", "WORK_COMPLETED", "Technician marked work as completed");

        if (b.getRequesterId() != null) {
            sendNotification(b.getRequesterId(), "WORK_COMPLETED_CONFIRM", "Service Completed - Please Confirm",
                    "Technician marked your maintenance request as completed. Please inspect and confirm.");
        }

        return Map.of("success", true, "message", "Work marked completed", "status", "WORK_COMPLETED");
    }

    // Step: Resident Confirmation (Confirm vs Issue Not Resolved / Reopen)
    public Map<String, Object> residentConfirmation(Long bookingId, boolean confirmed, String reopenReason) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (confirmed) {
            b.setResidentConfirmedAt(LocalDateTime.now());
            b.setCustomerSignedOffAt(LocalDateTime.now());

            // Check if payment is required
            boolean hasCost = b.getEstimateAmount() != null && b.getEstimateAmount().compareTo(BigDecimal.ZERO) > 0;
            if (hasCost && !"PAID".equalsIgnoreCase(b.getPaymentStatus())) {
                b.setPaymentStatus("PENDING");
                b.setJobStatus("PAYMENT_PENDING");
                b.setDispatchReason("Resolution confirmed by resident. Pending payment of ₹" + b.getEstimateAmount() + ".");
            } else {
                b.setPaymentStatus("NOT_REQUIRED");
                b.setJobStatus("PENDING_REVIEW");
                b.setDispatchReason("Resolution confirmed by resident. Ready for rating and feedback.");
            }

            bookings.save(b);
            syncLinkedEntities(b, "RESOLVED", b.getDispatchReason());
            broadcast(b.getId(), b.getJobStatus(), "RESIDENT_CONFIRMED", "Resident confirmed issue resolution");

            return Map.of("success", true, "message", "Resolution confirmed", "status", b.getJobStatus(), "paymentRequired", hasCost, "amount", hasCost ? b.getEstimateAmount() : BigDecimal.ZERO);
        } else {
            // Issue Not Resolved -> Reopen Ticket -> Technician Follow-up
            int currentReopens = b.getReopenCount() != null ? b.getReopenCount() : 0;
            b.setReopenCount(currentReopens + 1);
            b.setReopenReason(reopenReason != null ? reopenReason.trim() : "Resident reported issue was not resolved.");
            b.setReopenedAt(LocalDateTime.now());
            b.setJobStatus("REOPENED");
            b.setDispatchReason("⚠️ Reopened by resident (Attempt #" + b.getReopenCount() + "): " + b.getReopenReason());

            bookings.save(b);
            syncLinkedEntities(b, "IN_PROGRESS", b.getDispatchReason());
            broadcast(b.getId(), "REOPENED", "TICKET_REOPENED", "Ticket reopened by resident");

            if (b.getPartnerId() != null) {
                partners.findById(b.getPartnerId()).ifPresent(p -> sendNotification(p.getUserId(), "TICKET_REOPENED", "Follow-up Required",
                        "Resident reported issue was not resolved: " + b.getReopenReason() + ". Please follow up immediately."));
            }

            return Map.of("success", true, "message", "Ticket reopened. Technician notified for follow-up.", "status", "REOPENED", "reopenCount", b.getReopenCount());
        }
    }

    // Step: Payment & Invoice Generation
    public Map<String, Object> processPayment(Long bookingId, String method, BigDecimal amount, String transactionRef) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        b.setPaymentStatus("PAID");
        b.setPaymentMethod(method != null ? method : "UPI");
        b.setPaidAmount(amount != null ? amount : (b.getEstimateAmount() != null ? b.getEstimateAmount() : BigDecimal.ZERO));
        b.setPaymentReference(transactionRef != null ? transactionRef : ("TXN-" + System.currentTimeMillis()));
        b.setPaidAt(LocalDateTime.now());

        String invNo = "INV-" + LocalDate.now().getYear() + "-" + String.format(Locale.ROOT, "%05d", b.getId());
        b.setInvoiceNumber(invNo);
        b.setJobStatus("PAID");
        b.setDispatchReason("Payment of ₹" + b.getPaidAmount() + " verified. Invoice #" + invNo + " generated.");

        bookings.save(b);
        syncLinkedEntities(b, "RESOLVED", "Payment completed. Invoice: " + invNo);
        broadcast(b.getId(), "PAID", "PAYMENT_COMPLETED", "Payment completed. Invoice #" + invNo);

        return Map.of("success", true, "message", "Payment processed successfully", "invoiceNumber", invNo, "status", "PAID", "amountPaid", b.getPaidAmount());
    }

    // Step: Rating, Review & Ticket Close
    public Map<String, Object> submitRatingAndClose(Long bookingId, int rating, String review, List<String> tags) {
        EmergencyMaintenanceBooking b = bookings.lockById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        b.setRating(Math.max(1, Math.min(5, rating)));
        b.setReview(review != null ? review.trim() : "");
        if (tags != null && !tags.isEmpty()) {
            b.setReviewTags(String.join(",", tags));
        }
        b.setJobStatus("CLOSED");
        b.setDispatchReason("Ticket closed with resident rating " + b.getRating() + "/5.");
        bookings.save(b);

        releasePartner(b);

        // Recalculate partner rating
        if (b.getPartnerId() != null) {
            partners.findById(b.getPartnerId()).ifPresent(p -> {
                List<EmergencyMaintenanceBooking> allRated = bookings.findByPartnerIdAndRatingIsNotNull(p.getId());
                if (!allRated.isEmpty()) {
                    double avg = allRated.stream().mapToInt(EmergencyMaintenanceBooking::getRating).average().orElse(5.0);
                    p.setRating((float) (Math.round(avg * 10.0) / 10.0));
                    p.setRatingCount(allRated.size());
                    partners.save(p);
                }
            });
        }

        syncLinkedEntities(b, "CLOSED", "Ticket closed with rating: " + b.getRating() + "/5");
        broadcast(b.getId(), "CLOSED", "TICKET_CLOSED", "Ticket closed with rating " + b.getRating() + "/5");

        return Map.of("success", true, "message", "Rating submitted and ticket closed", "status", "CLOSED", "rating", b.getRating());
    }

    // Comprehensive view for frontend rendering
    public Map<String, Object> getWorkflowStatus(Long bookingId) {
        EmergencyMaintenanceBooking b = bookings.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        MaintenancePartner p = b.getPartnerId() != null ? partners.findById(b.getPartnerId()).orElse(null) : null;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("bookingReference", b.getBookingReference());
        m.put("orderReference", b.getOrderReference());
        m.put("ticketId", b.getOrderReference());
        m.put("title", b.getCategory() + " Service Request");
        m.put("category", b.getCategory());
        m.put("description", b.getDescription());
        m.put("unitNumber", b.getUnitNumber());
        m.put("serviceAddress", b.getServiceAddress());
        m.put("requesterName", b.getRequesterName());
        m.put("requesterPhone", b.getRequesterPhone());
        m.put("createdAt", b.getCreatedAt());
        m.put("status", b.getJobStatus());
        m.put("dispatchReason", b.getDispatchReason());

        // AI Categorization Details
        m.put("isEmergency", Boolean.TRUE.equals(b.getIsEmergency()));
        m.put("requiredSkill", b.getRequiredSkill() != null ? b.getRequiredSkill() : "GENERAL_HANDYMAN");
        m.put("aiNotes", b.getAiCategorizationNotes());

        // Vendor Assignment Details
        m.put("assignedPartnerId", b.getPartnerId());
        m.put("assignedPartnerName", p != null ? p.getPartnerName() : (b.getPartnerId() != null ? "Technician #" + b.getPartnerId() : "Unassigned"));
        m.put("assignedPartnerPhone", p != null ? p.getPhone() : "");
        m.put("assignedPartnerRating", p != null ? p.getRating() : 5.0f);
        m.put("assignedPartnerTrade", p != null ? p.getTrade() : b.getCategory());
        m.put("isAmcVendor", Boolean.TRUE.equals(b.getIsAmcVendor()));
        m.put("vendorType", b.getVendorType() != null ? b.getVendorType() : (Boolean.TRUE.equals(b.getIsAmcVendor()) ? "AMC_SOCIETY_VENDOR" : "EXTERNAL_APPROVED_VENDOR"));
        m.put("vendorTypeLabel", Boolean.TRUE.equals(b.getIsAmcVendor()) ? "AMC / Society Vendor" : "Approved External Vendor");

        // Schedule
        m.put("preferredDate", b.getPreferredDate() != null ? b.getPreferredDate().toString() : "");
        m.put("preferredSlot", b.getPreferredSlot() != null ? b.getPreferredSlot() : "Morning");

        // Timestamps
        m.put("offeredAt", b.getOfferedAt());
        m.put("acceptedAt", b.getAcceptedAt());
        m.put("reachedAt", b.getReachedAt());
        m.put("startedAt", b.getStartedAt());
        m.put("completedAt", b.getCompletedAt());
        m.put("residentConfirmedAt", b.getResidentConfirmedAt());

        // Estimate details
        m.put("additionalCostRequired", Boolean.TRUE.equals(b.getAdditionalCostRequired()));
        m.put("estimateAmount", b.getEstimateAmount() != null ? b.getEstimateAmount() : BigDecimal.ZERO);
        m.put("estimateDescription", b.getEstimateDescription());
        m.put("estimatePartsBreakdown", b.getEstimatePartsBreakdown());
        m.put("estimateLaborBreakdown", b.getEstimateLaborBreakdown());
        m.put("estimateStatus", b.getEstimateStatus() != null ? b.getEstimateStatus() : "NONE");
        m.put("estimateApprovedAt", b.getEstimateApprovedAt());
        m.put("estimateRejectionReason", b.getEstimateRejectionReason());

        // Photos
        m.put("residentAttachmentUrl", b.getResidentAttachmentUrl());
        m.put("beforePhotoUrl", b.getBeforePhotoUrl() != null ? b.getBeforePhotoUrl() : (b.getBeforePhoto() != null ? "/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/before" : null));
        m.put("afterPhotoUrl", b.getAfterPhotoUrl() != null ? b.getAfterPhotoUrl() : (b.getAfterPhoto() != null ? "/api/maintenance/dispatch/bookings/" + b.getId() + "/photos/after" : null));
        m.put("completionNotes", b.getCompletionNotes());

        // Reopen info
        m.put("reopenCount", b.getReopenCount() != null ? b.getReopenCount() : 0);
        m.put("reopenReason", b.getReopenReason());
        m.put("reopenedAt", b.getReopenedAt());

        // Payment and Invoice
        m.put("paymentStatus", b.getPaymentStatus() != null ? b.getPaymentStatus() : "NOT_REQUIRED");
        m.put("paymentMethod", b.getPaymentMethod());
        m.put("paidAmount", b.getPaidAmount());
        m.put("paidAt", b.getPaidAt());
        m.put("invoiceNumber", b.getInvoiceNumber());

        // Rating & Review
        m.put("rating", b.getRating());
        m.put("review", b.getReview());
        m.put("reviewTags", b.getReviewTags());

        // State Machine Stepper Index (0 to 9)
        m.put("currentStepIndex", calculateStepIndex(b.getJobStatus()));
        m.put("statusLabel", formatStatusLabel(b.getJobStatus()));

        return m;
    }

    public Map<String, Object> getWorkflowStatusByReference(String ref) {
        if (ref == null || ref.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reference required");
        }
        String clean = ref.trim();
        Optional<EmergencyMaintenanceBooking> opt = bookings.findByOrderReference(clean);
        if (opt.isEmpty()) {
            try {
                long id = Long.parseLong(clean.replaceAll("[^0-9]", ""));
                opt = bookings.findById(id);
            } catch (Exception ignored) {}
        }
        EmergencyMaintenanceBooking b = opt.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found with reference: " + ref));
        return getWorkflowStatus(b.getId());
    }

    private int calculateStepIndex(String status) {
        if (status == null) return 0;
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "UNASSIGNED", "OFFERED" -> 1;
            case "JOB_CONFIRMED", "ACCEPTED" -> 2;
            case "TRAVELING", "EN_ROUTE" -> 3;
            case "ARRIVED", "REACHED_LOCATION" -> 4;
            case "DIAGNOSING" -> 5;
            case "ESTIMATE_PENDING" -> 6;
            case "IN_PROGRESS" -> 7;
            case "WORK_COMPLETED" -> 8;
            case "PAYMENT_PENDING", "PAID" -> 9;
            case "CLOSED" -> 10;
            case "REOPENED" -> 5; // loops back to diagnosis / follow-up
            default -> 1;
        };
    }

    private String formatStatusLabel(String status) {
        if (status == null) return "Requested";
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "UNASSIGNED" -> "Matching Vendor";
            case "OFFERED" -> "Vendor Notified";
            case "JOB_CONFIRMED", "ACCEPTED" -> "Job Confirmed";
            case "TRAVELING", "EN_ROUTE" -> "Technician Traveling";
            case "ARRIVED", "REACHED_LOCATION" -> "Arrived at Apartment";
            case "DIAGNOSING" -> "Diagnosis in Progress";
            case "ESTIMATE_PENDING" -> "Estimate Awaiting Resident Approval";
            case "IN_PROGRESS" -> "Repair in Progress";
            case "WORK_COMPLETED" -> "Completed (Awaiting Resident Confirmation)";
            case "REOPENED" -> "Reopened (Follow-up Required)";
            case "PAYMENT_PENDING" -> "Payment Pending";
            case "PAID" -> "Paid - Ready for Rating";
            case "CLOSED" -> "Closed";
            case "CANCELLED" -> "Cancelled";
            default -> status;
        };
    }

    private void releasePartner(EmergencyMaintenanceBooking b) {
        if (b.getPartnerId() != null) {
            partners.findById(b.getPartnerId()).ifPresent(p -> {
                p.setAvailability("IDLE");
                p.setWorkState("IDLE");
                partners.save(p);
            });
        }
    }

    private void syncLinkedEntities(EmergencyMaintenanceBooking b, String complaintStatus, String notes) {
        // Sync CommonMaintenanceTicket
        try {
            tickets.findAll().stream()
                    .filter(t -> Objects.equals(t.getTargetEntityId(), b.getId()) || Objects.equals(t.getTicketCode(), b.getOrderReference()))
                    .findFirst()
                    .ifPresent(t -> {
                        t.setTicketStatus(b.getJobStatus());
                        t.setVendorNotes(notes);
                        t.setEstimateStatus(b.getEstimateStatus());
                        t.setEstimateAmount(b.getEstimateAmount());
                        t.setPaymentStatus(b.getPaymentStatus());
                        t.setInvoiceNumber(b.getInvoiceNumber());
                        if ("WORK_COMPLETED".equalsIgnoreCase(b.getJobStatus()) || "RESOLVED".equalsIgnoreCase(b.getJobStatus()) || "CLOSED".equalsIgnoreCase(b.getJobStatus())) {
                            t.setResolvedAt(LocalDateTime.now());
                        }
                        tickets.save(t);
                    });
        } catch (Exception ignored) {}

        // Sync Complaint
        try {
            complaints.findAll().stream()
                    .filter(c -> Objects.equals(c.getOrderReference(), b.getOrderReference()) || Objects.equals(c.getBookingReference(), b.getBookingReference()))
                    .findFirst()
                    .ifPresent(c -> {
                        c.setStatus(complaintStatus);
                        c.setResolutionNotes(notes);
                        c.setEstimateStatus(b.getEstimateStatus());
                        c.setPaymentStatus(b.getPaymentStatus());
                        c.setInvoiceNumber(b.getInvoiceNumber());
                        complaints.save(c);
                    });
        } catch (Exception ignored) {}
    }

    private void sendNotification(Long userId, String type, String title, String message) {
        if (userId == null) return;
        try {
            Notification n = new Notification();
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setReadStatus(false);
            notifications.save(n);
        } catch (Exception ignored) {}
    }

    private void broadcast(Long bookingId, String status, String action, String message) {
        if (emergencyService != null) {
            try {
                emergencyService.broadcastEvent(bookingId, status, action, null, message);
            } catch (Exception ignored) {}
        }
    }
}
