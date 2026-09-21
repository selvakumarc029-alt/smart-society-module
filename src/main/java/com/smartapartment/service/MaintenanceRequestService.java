package com.smartapartment.service;

import com.smartapartment.dto.MaintenanceRequestDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.*;

@Service
public class MaintenanceRequestService {

    public static final Set<String> VALID_CATEGORIES = Set.of(
            "Electrical", "Plumbing", "Carpentry", "Cleaning", "AC",
            "Lift/Elevator", "Water", "Painting", "Civil Work", "Appliance",
            "Internet/Network", "Other"
    );

    public static final Set<String> VALID_PRIORITIES = Set.of(
            "LOW", "MEDIUM", "HIGH", "URGENT"
    );

    public static final List<String> ACTIVE_STATUSES = List.of(
            "REQUESTED", "AUTO_ASSIGN_PENDING", "ASSIGNED", "WORKER_ACCEPTED",
            "TRAVELLING", "ARRIVED", "IN_PROGRESS", "ON_HOLD",
            "RESIDENT_CONFIRMATION", "REOPENED", "WAITING_FOR_WORKER", "OVERDUE"
    );

    public static final List<String> COMPLETED_STATUSES = List.of(
            "COMPLETED", "CLOSED"
    );

    private final MaintenanceRequestRepository requestRepository;
    private final MaintenanceStatusHistoryRepository historyRepository;
    private final ResidentRepository residentRepository;
    private final ApartmentRepository apartmentRepository;
    private final TenantRepository tenantRepository;
    private final AppUserRepository userRepository;
    private final WorkerAttendanceService workerAttendanceService;
    private final AutoAssignmentService autoAssignmentService;
    private final MaintenanceTrackingService trackingService;

    public MaintenanceRequestService(
            MaintenanceRequestRepository requestRepository,
            MaintenanceStatusHistoryRepository historyRepository,
            ResidentRepository residentRepository,
            ApartmentRepository apartmentRepository,
            TenantRepository tenantRepository,
            AppUserRepository userRepository,
            WorkerAttendanceService workerAttendanceService,
            AutoAssignmentService autoAssignmentService,
            @org.springframework.context.annotation.Lazy MaintenanceTrackingService trackingService) {
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.residentRepository = residentRepository;
        this.apartmentRepository = apartmentRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.workerAttendanceService = workerAttendanceService;
        this.autoAssignmentService = autoAssignmentService;
        this.trackingService = trackingService;
    }

    @Transactional
    public MaintenanceRequestResponseDto createRequest(CreateMaintenanceRequestDto dto, AppUser user) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body cannot be empty");
        }

        // Validate Category
        String category = normalizeCategory(dto.category());
        if (!VALID_CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid category: '" + dto.category() + "'. Allowed categories: " + VALID_CATEGORIES);
        }

        // Validate Priority
        String priority = (dto.priority() == null) ? "MEDIUM" : dto.priority().trim().toUpperCase(Locale.ROOT);
        if (!VALID_PRIORITIES.contains(priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid priority: '" + dto.priority() + "'. Allowed priorities: LOW, MEDIUM, HIGH, URGENT");
        }

        // Validate title & description
        if (dto.title() == null || dto.title().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Problem title is required");
        }
        if (dto.description() == null || dto.description().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description is required");
        }
        if (dto.serviceType() == null || dto.serviceType().trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service type is required");
        }

        // Resolve Resident & Apartment
        Resident resident = resolveResidentForUser(user);
        Apartment apartment = null;
        if (dto.apartmentId() != null) {
            apartment = apartmentRepository.findById(dto.apartmentId()).orElse(null);
        }
        if (apartment == null && resident.getApartment() != null) {
            apartment = resident.getApartment();
        }

        Tenant tenant = null;
        String tenantId = user.getTenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            tenant = tenantRepository.findAll().stream()
                    .filter(t -> tenantId.equalsIgnoreCase(t.getCode()) || tenantId.equalsIgnoreCase(t.getTenantId()))
                    .findFirst().orElse(null);
        }

        String societyName = (tenant != null) ? tenant.getSocietyName() : "SmartApartment Community";
        Long societyId = (tenant != null) ? tenant.getId() : null;
        String buildingName = (apartment != null && apartment.getBlock() != null) ? apartment.getBlock().getName() : "Block A";
        Long buildingId = (apartment != null && apartment.getBlock() != null) ? apartment.getBlock().getId() : null;
        String apartmentUnit = (apartment != null) ? apartment.getUnitNo() : "Unit 101";
        Long apartmentId = (apartment != null) ? apartment.getId() : null;

        // Generate unique request number
        String requestNumber = generateUniqueRequestNumber();

        MaintenanceRequest request = new MaintenanceRequest();
        request.setRequestNumber(requestNumber);
        request.setTenantId(tenantId != null ? tenantId : "default");
        request.setResidentId(resident.getId());
        request.setResidentName(user.getFullName() != null ? user.getFullName() : "Resident");
        request.setResidentPhone(user.getPhone());
        request.setResidentEmail(user.getEmail());
        request.setSocietyId(societyId);
        request.setSocietyName(societyName);
        request.setBuildingId(buildingId);
        request.setBuildingName(buildingName);
        request.setApartmentId(apartmentId);
        request.setApartmentUnit(apartmentUnit);
        request.setCategory(category);
        request.setServiceType(dto.serviceType().trim());
        request.setTitle(dto.title().trim());
        request.setDescription(dto.description().trim());
        request.setPriority(priority);
        request.setRequestStatus("REQUESTED");
        request.setNotes(dto.notes() != null ? dto.notes().trim() : null);
        request.setImageUrl(dto.imageUrl() != null && !dto.imageUrl().isBlank() ? dto.imageUrl().trim() : null);
        request.setPreferredTime(dto.preferredTime() != null ? dto.preferredTime().trim() : null);

        if (dto.preferredDate() != null && !dto.preferredDate().isBlank()) {
            try {
                request.setPreferredDate(LocalDate.parse(dto.preferredDate().trim()));
            } catch (Exception ignored) {}
        }

        MaintenanceRequest saved = requestRepository.save(request);

        // Record initial status history
        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(saved.getId());
        history.setOldStatus(null);
        history.setNewStatus("REQUESTED");
        history.setChangedBy(user.getFullName() != null ? user.getFullName() : "Resident");
        history.setReason("Service request submitted by resident");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);

        // Schedule or execute auto-assignment engine
        autoAssignmentService.scheduleAssignment(saved);

        saved = requestRepository.findById(saved.getId()).orElse(saved);
        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(saved.getId());

        // Broadcast REQUEST_CREATED event
        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "REQUEST_CREATED",
                saved.getId(),
                saved.getRequestNumber(),
                saved.getRequestStatus(),
                saved.getTenantId(),
                saved.getAssignedWorkerId(),
                saved.getAssignedWorkerName(),
                saved.getResidentId(),
                "New maintenance request " + saved.getRequestNumber() + " submitted: " + saved.getTitle(),
                saved
        ));

        return MaintenanceRequestResponseDto.from(saved, historyList);
    }

    @Transactional(readOnly = true)
    public List<MaintenanceRequestResponseDto> listRequests(AppUser user, String filter) {
        boolean isResident = isResidentRole(user);
        String filterMode = (filter == null) ? "all" : filter.trim().toLowerCase(Locale.ROOT);

        List<MaintenanceRequest> requests;
        if (isResident) {
            Resident resident = resolveResidentForUser(user);
            if ("active".equals(filterMode)) {
                requests = requestRepository.findByResidentIdAndRequestStatusInOrderByCreatedAtDesc(resident.getId(), ACTIVE_STATUSES);
            } else if ("completed".equals(filterMode)) {
                requests = requestRepository.findByResidentIdAndRequestStatusInOrderByCreatedAtDesc(resident.getId(), COMPLETED_STATUSES);
            } else {
                requests = requestRepository.findByResidentIdOrderByCreatedAtDesc(resident.getId());
            }
        } else {
            String tenantId = user.getTenantId();
            if (tenantId == null || tenantId.isBlank() || isSuperAdmin(user)) {
                requests = requestRepository.findAll();
            } else {
                if ("active".equals(filterMode)) {
                    requests = requestRepository.findByTenantIdAndRequestStatusInOrderByCreatedAtDesc(tenantId, ACTIVE_STATUSES);
                } else if ("completed".equals(filterMode)) {
                    requests = requestRepository.findByTenantIdAndRequestStatusInOrderByCreatedAtDesc(tenantId, COMPLETED_STATUSES);
                } else {
                    requests = requestRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
                }
            }
        }

        return requests.stream()
                .map(req -> MaintenanceRequestResponseDto.from(req, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public MaintenanceRequestResponseDto getRequestDetails(Long id, AppUser user) {
        MaintenanceRequest request = findAndAuthorizeRequest(id, user);
        List<MaintenanceStatusHistory> history = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);
        return MaintenanceRequestResponseDto.from(request, history);
    }

    @Transactional
    public MaintenanceRequestResponseDto cancelRequest(Long id, CancelRequestDto dto, AppUser user) {
        MaintenanceRequest request = findAndAuthorizeRequest(id, user);

        if (!request.isEligibleForCancellation()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request " + request.getRequestNumber() + " cannot be cancelled in status: " + request.getRequestStatus());
        }

        String oldStatus = request.getRequestStatus();
        request.setRequestStatus("CANCELLED");
        request.setClosedAt(LocalDateTime.now());
        MaintenanceRequest updated = requestRepository.save(request);

        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(id);
        history.setOldStatus(oldStatus);
        history.setNewStatus("CANCELLED");
        history.setChangedBy(user.getFullName() != null ? user.getFullName() : "Resident");
        history.setReason(dto != null && dto.reason() != null && !dto.reason().isBlank()
                ? dto.reason().trim() : "Cancelled by resident");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);

        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "REQUEST_CLOSED",
                updated.getId(),
                updated.getRequestNumber(),
                updated.getRequestStatus(),
                updated.getTenantId(),
                updated.getAssignedWorkerId(),
                updated.getAssignedWorkerName(),
                updated.getResidentId(),
                "Maintenance request " + updated.getRequestNumber() + " cancelled by resident",
                updated
        ));

        return MaintenanceRequestResponseDto.from(updated, historyList);
    }

    @Transactional
    public MaintenanceRequestResponseDto reopenRequest(Long id, ReopenRequestDto dto, AppUser user) {
        MaintenanceRequest request = findAndAuthorizeRequest(id, user);

        if (!request.isEligibleForReopen()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request " + request.getRequestNumber() + " cannot be reopened from status: " + request.getRequestStatus());
        }

        String oldStatus = request.getRequestStatus();
        request.setRequestStatus("REOPENED");
        request.setCompletedAt(null);
        request.setClosedAt(null);
        MaintenanceRequest updated = requestRepository.save(request);

        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(id);
        history.setOldStatus(oldStatus);
        history.setNewStatus("REOPENED");
        history.setChangedBy(user.getFullName() != null ? user.getFullName() : "Resident");
        history.setReason(dto != null && dto.reason() != null && !dto.reason().isBlank()
                ? dto.reason().trim() : "Reopened by resident");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);

        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);

        trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                "REQUEST_REOPENED",
                updated.getId(),
                updated.getRequestNumber(),
                updated.getRequestStatus(),
                updated.getTenantId(),
                updated.getAssignedWorkerId(),
                updated.getAssignedWorkerName(),
                updated.getResidentId(),
                "Maintenance request " + updated.getRequestNumber() + " reopened by resident",
                updated
        ));

        return MaintenanceRequestResponseDto.from(updated, historyList);
    }

    @Transactional
    public MaintenanceRequestResponseDto updateRequest(Long id, UpdateMaintenanceRequestDto dto, AppUser user) {
        MaintenanceRequest request = findAndAuthorizeRequest(id, user);
        boolean isResident = isResidentRole(user);

        if (dto.title() != null && !dto.title().isBlank()) request.setTitle(dto.title().trim());
        if (dto.description() != null && !dto.description().isBlank()) request.setDescription(dto.description().trim());
        if (dto.notes() != null) request.setNotes(dto.notes().trim());
        if (dto.imageUrl() != null) request.setImageUrl(dto.imageUrl().trim());
        if (dto.preferredTime() != null) request.setPreferredTime(dto.preferredTime().trim());

        if (dto.preferredDate() != null && !dto.preferredDate().isBlank()) {
            try {
                request.setPreferredDate(LocalDate.parse(dto.preferredDate().trim()));
            } catch (Exception ignored) {}
        }

        if (dto.priority() != null && !dto.priority().isBlank()) {
            String p = dto.priority().trim().toUpperCase(Locale.ROOT);
            if (VALID_PRIORITIES.contains(p)) request.setPriority(p);
        }

        // Staff/Admin updates
        if (!isResident) {
            if (dto.assignedWorkerId() != null) {
                request.setAssignedWorkerId(dto.assignedWorkerId());
                request.setAutoAssignDeadline(null); // Cancel auto-assignment countdown on manual assignment
            }
            if (dto.assignedWorkerName() != null) request.setAssignedWorkerName(dto.assignedWorkerName().trim());
            if (dto.assignedWorkerPhone() != null) request.setAssignedWorkerPhone(dto.assignedWorkerPhone().trim());
            if (dto.estimatedDuration() != null) request.setEstimatedDuration(dto.estimatedDuration().trim());

            if (request.getAssignedWorkerId() != null) {
                workerAttendanceService.assignTaskToWorker(request.getAssignedWorkerId(), request.getId(), request.getRequestNumber());
            }

            if (dto.status() != null && !dto.status().isBlank() && !dto.status().equalsIgnoreCase(request.getRequestStatus())) {
                String oldStatus = request.getRequestStatus();
                String newStatus = dto.status().trim().toUpperCase(Locale.ROOT);
                request.setRequestStatus(newStatus);
                if ("COMPLETED".equalsIgnoreCase(newStatus)) {
                    request.setCompletedAt(LocalDateTime.now());
                    if (request.getAssignedWorkerId() != null) {
                        workerAttendanceService.releaseTaskFromWorker(request.getAssignedWorkerId(), request.getId());
                        autoAssignmentService.processWaitingQueue(request.getTenantId());
                    }
                } else if ("CLOSED".equalsIgnoreCase(newStatus)) {
                    request.setClosedAt(LocalDateTime.now());
                    if (request.getAssignedWorkerId() != null) {
                        workerAttendanceService.releaseTaskFromWorker(request.getAssignedWorkerId(), request.getId());
                        autoAssignmentService.processWaitingQueue(request.getTenantId());
                    }
                }

                MaintenanceStatusHistory history = new MaintenanceStatusHistory();
                history.setRequestId(id);
                history.setOldStatus(oldStatus);
                history.setNewStatus(newStatus);
                history.setChangedBy(user.getFullName() != null ? user.getFullName() : "Admin/Staff");
                history.setReason("Status updated by staff");
                history.setCreatedAt(LocalDateTime.now());
                historyRepository.save(history);
            }
        }

        MaintenanceRequest saved = requestRepository.save(request);
        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);
        return MaintenanceRequestResponseDto.from(saved, historyList);
    }

    @Transactional
    public MaintenanceRequestResponseDto autoAssignRequest(Long id, AppUser user) {
        MaintenanceRequest request = findAndAuthorizeRequest(id, user);
        AppUser worker = autoAssignmentService.assignNextEligibleWorker(request)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No eligible worker currently available for category: " + request.getCategory() +
                        ". (Request placed in waiting queue)."));

        MaintenanceRequest saved = requestRepository.findById(id).orElse(request);
        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);
        return MaintenanceRequestResponseDto.from(saved, historyList);
    }

    @Transactional(readOnly = true)
    public List<StatusHistoryItemDto> getStatusHistory(Long id, AppUser user) {
        findAndAuthorizeRequest(id, user);
        return historyRepository.findByRequestIdOrderByCreatedAtAsc(id)
                .stream().map(StatusHistoryItemDto::from).toList();
    }

    private MaintenanceRequest findAndAuthorizeRequest(Long id, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found with ID: " + id));

        if (isResidentRole(user)) {
            Resident resident = resolveResidentForUser(user);
            if (!Objects.equals(request.getResidentId(), resident.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Unauthorized: You cannot view or modify maintenance requests belonging to another resident.");
            }
        } else if (!isSuperAdmin(user)) {
            String tenantId = user.getTenantId();
            if (tenantId != null && !tenantId.isBlank() && !tenantId.equalsIgnoreCase(request.getTenantId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Unauthorized: Request belongs to another society/tenant.");
            }
        }
        return request;
    }

    private Resident resolveResidentForUser(AppUser user) {
        return residentRepository.findFirstByUserOrderByIdAsc(user)
                .orElseGet(() -> {
                    // Create default resident profile if not yet linked
                    Resident r = new Resident();
                    r.setUser(user);
                    r.setTenantId(user.getTenantId() != null ? user.getTenantId() : "default");
                    r.setResidentType("Owner");
                    r.setMoveInDate(LocalDate.now());

                    Apartment apt = apartmentRepository.findAll().stream().findFirst().orElseGet(() -> {
                        Apartment a = new Apartment();
                        a.setUnitNo("A-101");
                        a.setFloorNo(1);
                        a.setOccupancyStatus("OCCUPIED");
                        return apartmentRepository.save(a);
                    });
                    r.setApartment(apt);
                    return residentRepository.save(r);
                });
    }

    private String generateUniqueRequestNumber() {
        int currentYear = Year.now().getValue();
        String prefix = "MR-" + currentYear + "-";
        long count = requestRepository.countByRequestNumberStartingWith(prefix) + 1;
        String candidate = String.format(Locale.ROOT, "%s%05d", prefix, count);

        while (requestRepository.findByRequestNumber(candidate).isPresent()) {
            count++;
            candidate = String.format(Locale.ROOT, "%s%05d", prefix, count);
        }
        return candidate;
    }

    private String normalizeCategory(String category) {
        if (category == null) return "Other";
        String trimmed = category.trim();
        for (String c : VALID_CATEGORIES) {
            if (c.equalsIgnoreCase(trimmed)) return c;
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.contains("clean") || lower.contains("housekeep")) return "Cleaning";
        if (lower.contains("plumb") || lower.contains("water") || lower.contains("pipe") || lower.contains("drain")) return "Plumbing";
        if (lower.contains("electr") || lower.contains("wiring") || lower.contains("light") || lower.contains("switch")) return "Electrical";
        if (lower.contains("carpent") || lower.contains("wood") || lower.contains("door") || lower.contains("furniture") || lower.contains("drill") || lower.contains("repair")) return "Carpentry";
        if (lower.contains("ac") || lower.contains("cooling") || lower.contains("hvac")) return "AC";
        if (lower.contains("paint")) return "Painting";
        if (lower.contains("appliance") || lower.contains("fridge") || lower.contains("geyser") || lower.contains("ro")) return "Appliance";
        if (lower.contains("lift") || lower.contains("elevator")) return "Lift/Elevator";
        if (lower.contains("civil") || lower.contains("mason")) return "Civil Work";
        if (lower.contains("net") || lower.contains("wifi") || lower.contains("internet")) return "Internet/Network";
        return "Other";
    }

    private boolean isResidentRole(AppUser user) {
        return user.getRole() == null || user.getRole() == UserRole.RESIDENT;
    }

    private boolean isSuperAdmin(AppUser user) {
        return user.getRole() == UserRole.SUPER_ADMIN;
    }

    @org.springframework.transaction.annotation.Transactional
    public MaintenanceRequestResponseDto updateStage(Long id, String stage, String notes, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found with id: " + id));

        String oldStatus = request.getRequestStatus();
        String normalizedStage = stage != null ? stage.trim().toUpperCase(Locale.ROOT) : "ACCEPTED";
        String newStatus;
        String reason;

        switch (normalizedStage) {
            case "ACCEPTED" -> {
                newStatus = "ASSIGNED";
                reason = "Worker accepted and confirmed service booking.";
            }
            case "REACHED_LOCATION" -> {
                newStatus = "ARRIVED";
                reason = "Technician reached resident location / apartment unit.";
            }
            case "STARTED" -> {
                newStatus = "IN_PROGRESS";
                request.setActualStartTime(LocalDateTime.now());
                reason = "Service initiated. Preliminary checks complete.";
            }
            case "STAGE_1" -> {
                newStatus = "IN_PROGRESS";
                reason = "Stage 1: Preliminary deep clean & surface prep underway.";
            }
            case "PROCESSING" -> {
                newStatus = "IN_PROGRESS";
                reason = "Active processing: Deep machine scrub & sanitization in progress.";
            }
            case "COMPLETED" -> {
                newStatus = "COMPLETED";
                request.setCompletedAt(LocalDateTime.now());
                request.setActualEndTime(LocalDateTime.now());
                reason = "Service completed and verified.";
            }
            default -> {
                newStatus = normalizedStage;
                reason = notes != null ? notes : "Stage updated to " + normalizedStage;
            }
        }

        request.setRequestStatus(newStatus);
        if (notes != null && !notes.isBlank()) {
            request.setNotes(request.getNotes() != null ? request.getNotes() + "\n[" + normalizedStage + "] " + notes : "[" + normalizedStage + "] " + notes);
        }
        MaintenanceRequest updated = requestRepository.save(request);

        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(id);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setChangedBy(user != null && user.getFullName() != null ? user.getFullName() : "Technician");
        history.setReason(reason);
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);

        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);

        try {
            trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                    "STATUS_CHANGE",
                    updated.getId(),
                    updated.getRequestNumber(),
                    updated.getRequestStatus(),
                    updated.getTenantId(),
                    updated.getAssignedWorkerId(),
                    updated.getAssignedWorkerName(),
                    updated.getResidentId(),
                    reason,
                    null
            ));
        } catch (Exception ignored) {}

        return MaintenanceRequestResponseDto.from(updated, historyList);
    }

    @org.springframework.transaction.annotation.Transactional
    public MaintenanceRequestResponseDto submitReview(Long id, Integer rating, String review, String tags, AppUser user) {
        MaintenanceRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found with id: " + id));

        int validRating = (rating != null && rating >= 1 && rating <= 5) ? rating : 5;
        String reviewText = (review != null && !review.isBlank()) ? review.trim() : "Satisfactory service.";
        String tagsText = (tags != null && !tags.isBlank()) ? " | Tags: " + tags.trim() : "";

        String reviewNote = String.format(Locale.ROOT, "Verified Resident Review: %d/5 Stars - \"%s\"%s", validRating, reviewText, tagsText);
        request.setNotes(request.getNotes() != null ? request.getNotes() + "\n" + reviewNote : reviewNote);
        request.setRequestStatus("CLOSED");
        request.setClosedAt(LocalDateTime.now());

        MaintenanceRequest updated = requestRepository.save(request);

        MaintenanceStatusHistory history = new MaintenanceStatusHistory();
        history.setRequestId(id);
        history.setOldStatus("COMPLETED");
        history.setNewStatus("CLOSED");
        history.setChangedBy(user != null && user.getFullName() != null ? user.getFullName() : "Resident");
        history.setReason("Resident submitted service rating & review (" + validRating + "★).");
        history.setCreatedAt(LocalDateTime.now());
        historyRepository.save(history);

        List<MaintenanceStatusHistory> historyList = historyRepository.findByRequestIdOrderByCreatedAtAsc(id);

        try {
            trackingService.broadcastEvent(com.smartapartment.dto.RealTimeTrackingDtos.TrackingEventDto.of(
                    "REQUEST_CLOSED",
                    updated.getId(),
                    updated.getRequestNumber(),
                    updated.getRequestStatus(),
                    updated.getTenantId(),
                    updated.getAssignedWorkerId(),
                    updated.getAssignedWorkerName(),
                    updated.getResidentId(),
                    reviewNote,
                    null
            ));
        } catch (Exception ignored) {}

        return MaintenanceRequestResponseDto.from(updated, historyList);
    }
}
