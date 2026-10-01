package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/society/property-listings")
public class SocietyPropertyListingApiController {

    private static final Logger log = LoggerFactory.getLogger(SocietyPropertyListingApiController.class);

    private final PropertyListingRepository propertyListingRepository;
    private final ApartmentRepository apartmentRepository;
    private final ResidentRepository residentRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationRepository notificationRepository;
    private final CurrentUserService currentUserService;

    public SocietyPropertyListingApiController(
            PropertyListingRepository propertyListingRepository,
            ApartmentRepository apartmentRepository,
            ResidentRepository residentRepository,
            AppUserRepository appUserRepository,
            NotificationRepository notificationRepository,
            CurrentUserService currentUserService) {
        this.propertyListingRepository = propertyListingRepository;
        this.apartmentRepository = apartmentRepository;
        this.residentRepository = residentRepository;
        this.appUserRepository = appUserRepository;
        this.notificationRepository = notificationRepository;
        this.currentUserService = currentUserService;
    }

    @PostConstruct
    public void initSampleData() {
        try {
            long ownerCount = propertyListingRepository.findAll().stream()
                    .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()))
                    .count();
            if (ownerCount == 0) {
                // Seed a realistic pending listing from Flat A-101 owner Kavya N
                PropertyListing sample1 = new PropertyListing();
                sample1.setTitle("Elegant 3 BHK Semi-Furnished Flat with Pool View");
                sample1.setDescription("Spacious 3 BHK apartment in Block A with modular kitchen, Italian marble flooring, 2 covered balconies, and dedicated parking. Direct from verified owner.");
                sample1.setListingType("RENT");
                sample1.setPropertyType("APARTMENT");
                sample1.setUnitNumber("A-101");
                sample1.setTower("Block A");
                sample1.setBhk("3 BHK");
                sample1.setArea(1650);
                sample1.setBathrooms(3);
                sample1.setFloor(1);
                sample1.setPrice(new BigDecimal("42000"));
                sample1.setDeposit(new BigDecimal("180000"));
                sample1.setMaintenance(new BigDecimal("3500"));
                sample1.setFurnishing("Semi-Furnished");
                sample1.setParking("Covered (Slot P-12)");
                sample1.setAvailableFrom(LocalDate.now().plusDays(15));
                sample1.setSociety("SmartApartment Elite Heights");
                sample1.setLocality("Whitefield");
                sample1.setCity("Bengaluru");
                sample1.setState("Karnataka");
                sample1.setPincode("560066");
                sample1.setStatus("PENDING_APPROVAL");
                sample1.setVerificationStatus("PENDING");
                sample1.setSubmittedBy("Kavya N");
                sample1.setSubmitterRole("OWNER");
                sample1.setAmenities("Modular Kitchen, Chimney, Geyser, Wardrobes, Power Backup, Gym Access, Swimming Pool, Clubhouse, 24x7 Security");
                sample1.setNotes("Preferred tenants: Families or working professionals. Non-smoking. Direct owner listing, no brokerage.");
                sample1.setImageUrl("https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80");
                sample1.setTenantId("tenant-default");
                propertyListingRepository.save(sample1);

                // Seed another approved listing for demonstration
                PropertyListing sample2 = new PropertyListing();
                sample2.setTitle("Modern 2 BHK Apartment for Immediate Sale");
                sample2.setDescription("Prime corner flat with maximum cross-ventilation, vastu compliant, overlooking landscaped central garden. Includes 1 covered basement car park.");
                sample2.setListingType("SALE");
                sample2.setPropertyType("APARTMENT");
                sample2.setUnitNumber("B-204");
                sample2.setTower("Block B");
                sample2.setBhk("2 BHK");
                sample2.setArea(1280);
                sample2.setBathrooms(2);
                sample2.setFloor(2);
                sample2.setPrice(new BigDecimal("8800000"));
                sample2.setDeposit(new BigDecimal("500000"));
                sample2.setMaintenance(new BigDecimal("2800"));
                sample2.setFurnishing("Unfurnished");
                sample2.setParking("Covered Car Park");
                sample2.setAvailableFrom(LocalDate.now().plusDays(30));
                sample2.setSociety("SmartApartment Elite Heights");
                sample2.setLocality("Whitefield");
                sample2.setCity("Bengaluru");
                sample2.setState("Karnataka");
                sample2.setPincode("560066");
                sample2.setStatus("ACTIVE");
                sample2.setVerificationStatus("VERIFIED");
                sample2.setSubmittedBy("Rahul Verma");
                sample2.setSubmitterRole("OWNER");
                sample2.setReviewedBy("Society Administrator");
                sample2.setReviewedAt(LocalDateTime.now().minusDays(2));
                sample2.setReviewNote("Title deed and society share certificate verified. Approved for community marketplace.");
                sample2.setAmenities("Piped Gas, Power Backup, Children Play Area, EV Charging Slot, Rainwater Harvesting, CCTV");
                sample2.setNotes("Clear titles with OC and CC. Bank loan easily available from SBI & HDFC.");
                sample2.setImageUrl("https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80");
                sample2.setTenantId("tenant-default");
                propertyListingRepository.save(sample2);

                log.info("Initialized 2 sample owner property listings for society.");
            }
        } catch (Exception e) {
            log.warn("Sample property listing initialization warning: {}", e.getMessage());
        }
    }

    /**
     * List properties.
     * Admin sees all listings.
     * Resident sees their own listings (or all approved plus own pending).
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getListings(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            HttpSession session) {

        AppUser user = resolveCurrentUser(session);
        boolean isAdmin = user != null && (user.getRole() == UserRole.SUPER_ADMIN || user.getRole() == UserRole.SOCIETY_ADMIN);

        List<PropertyListing> all = propertyListingRepository.findAll();
        // Filter to owner submissions or those created through society
        List<PropertyListing> filtered = all.stream()
                .filter(l -> l.getSubmitterRole() == null || "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> !"CANCELLED".equalsIgnoreCase(l.getStatus()))
                .sorted((a, b) -> {
                    LocalDateTime ta = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime tb = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    return tb.compareTo(ta);
                })
                .toList();

        // Status filter
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            filtered = filtered.stream()
                    .filter(l -> status.equalsIgnoreCase(l.getStatus()))
                    .toList();
        }

        // Type filter (RENT / SALE)
        if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) {
            filtered = filtered.stream()
                    .filter(l -> type.equalsIgnoreCase(l.getListingType()))
                    .toList();
        }

        // Search text
        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase().trim();
            filtered = filtered.stream()
                    .filter(l -> (l.getTitle() != null && l.getTitle().toLowerCase().contains(q))
                            || (l.getUnitNumber() != null && l.getUnitNumber().toLowerCase().contains(q))
                            || (l.getSubmittedBy() != null && l.getSubmittedBy().toLowerCase().contains(q))
                            || (l.getBhk() != null && l.getBhk().toLowerCase().contains(q)))
                    .toList();
        }

        // Calculate statistics across all owner listings
        long totalCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> !"CANCELLED".equalsIgnoreCase(l.getStatus()))
                .count();

        long pendingCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "PENDING_APPROVAL".equalsIgnoreCase(l.getStatus()))
                .count();

        long approvedCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "ACTIVE".equalsIgnoreCase(l.getStatus()))
                .count();

        long rejectedCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "REJECTED".equalsIgnoreCase(l.getStatus()))
                .count();

        Map<String, Object> stats = Map.of(
                "total", totalCount,
                "pending", pendingCount,
                "approved", approvedCount,
                "rejected", rejectedCount
        );

        Map<String, Object> response = new HashMap<>();
        response.put("listings", filtered);
        response.put("stats", stats);
        response.put("isAdmin", isAdmin);
        response.put("userEmail", user != null ? user.getEmail() : "guest");
        response.put("userName", user != null ? user.getFullName() : "Resident");

        return ResponseEntity.ok(response);
    }

    /**
     * Returns stats for summary badges
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        List<PropertyListing> all = propertyListingRepository.findAll();
        long totalCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> !"CANCELLED".equalsIgnoreCase(l.getStatus()))
                .count();

        long pendingCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "PENDING_APPROVAL".equalsIgnoreCase(l.getStatus()))
                .count();

        long approvedCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "ACTIVE".equalsIgnoreCase(l.getStatus()))
                .count();

        long rejectedCount = all.stream()
                .filter(l -> "OWNER".equalsIgnoreCase(l.getSubmitterRole()) || "RESIDENT".equalsIgnoreCase(l.getSubmitterRole()))
                .filter(l -> "REJECTED".equalsIgnoreCase(l.getStatus()))
                .count();

        return ResponseEntity.ok(Map.of(
                "total", totalCount,
                "pending", pendingCount,
                "approved", approvedCount,
                "rejected", rejectedCount
        ));
    }

    /**
     * Submit a new property listing from the Owner dashboard.
     * Routes directly to Society Admin with status PENDING_APPROVAL.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> submitListing(
            @RequestBody SocietyPropertyPostRequest req,
            HttpSession session) {

        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property title is required");
        }
        if (req.unitNumber() == null || req.unitNumber().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Flat / Unit number is required");
        }
        if (req.price() == null || req.price().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid expected rent or sale price is required");
        }

        AppUser user = resolveCurrentUser(session);
        String submitterName = (user != null && user.getFullName() != null && !user.getFullName().isBlank())
                ? user.getFullName()
                : (req.contactName() != null && !req.contactName().isBlank() ? req.contactName() : "Kavya N");

        String submitterEmail = (user != null && user.getEmail() != null) ? user.getEmail() : req.contactEmail();
        String tenantId = (user != null && user.getTenantId() != null) ? user.getTenantId() : "tenant-default";

        PropertyListing listing = new PropertyListing();
        listing.setTitle(req.title().trim());
        listing.setDescription(req.description() != null ? req.description().trim() : "");
        listing.setListingType(req.listingType() != null ? req.listingType().toUpperCase() : "RENT");
        listing.setPropertyType(req.propertyType() != null ? req.propertyType().toUpperCase() : "APARTMENT");
        listing.setUnitNumber(req.unitNumber().trim().toUpperCase());
        listing.setTower(req.tower() != null ? req.tower().trim() : "Block A");
        listing.setBhk(req.bhk() != null ? req.bhk() : "3 BHK");
        listing.setArea(req.area() != null && req.area() > 0 ? req.area() : 1450);
        listing.setBathrooms(req.bathrooms() != null && req.bathrooms() > 0 ? req.bathrooms() : 2);
        listing.setFloor(req.floor() != null ? req.floor() : 1);
        listing.setPrice(req.price());
        listing.setDeposit(req.deposit() != null ? req.deposit() : BigDecimal.ZERO);
        listing.setMaintenance(req.maintenance() != null ? req.maintenance() : BigDecimal.ZERO);
        listing.setFurnishing(req.furnishing() != null ? req.furnishing() : "Semi-Furnished");
        listing.setParking(req.parking() != null ? req.parking() : "Covered");
        listing.setAvailableFrom(req.availableFrom() != null ? req.availableFrom() : LocalDate.now().plusDays(7));
        listing.setSociety("SmartApartment Elite Heights");
        listing.setLocality("Whitefield");
        listing.setCity("Bengaluru");
        listing.setState("Karnataka");
        listing.setPincode("560066");

        // Set status to PENDING_APPROVAL for Admin review
        listing.setStatus("PENDING_APPROVAL");
        listing.setVerificationStatus("PENDING");
        listing.setSubmittedBy(submitterName);
        listing.setSubmittedById(user != null ? user.getId() : 1L);
        listing.setSubmitterRole("OWNER");
        listing.setTenantId(tenantId);

        // Amenities and Guidelines
        listing.setAmenities(req.amenities() != null ? req.amenities().trim() : "Modular Kitchen, Power Backup, Security, Lift");
        String finalNotes = (req.notes() != null ? req.notes().trim() : "");
        if (req.tenantPreference() != null && !req.tenantPreference().isBlank()) {
            finalNotes = "Tenant Preference: " + req.tenantPreference() + ". " + finalNotes;
        }
        listing.setNotes(finalNotes);

        // Images: Use provided image URL or a stunning high-res apartment fallback
        if (req.imageUrl() != null && !req.imageUrl().isBlank()) {
            listing.setImageUrl(req.imageUrl().trim());
        } else {
            String defaultImg = "RENT".equalsIgnoreCase(listing.getListingType())
                    ? "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80"
                    : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80";
            listing.setImageUrl(defaultImg);
        }

        PropertyListing saved = propertyListingRepository.save(listing);

        // Create resident confirmation notification
        try {
            if (user != null) {
                Notification notif = new Notification();
                notif.setUserId(user.getId());
                notif.setType("PROPERTY_SUBMISSION");
                notif.setTitle("Property Listing Submitted for Approval");
                notif.setMessage("Your listing for Flat " + saved.getUnitNumber() + " (" + saved.getTitle() + ") was received. Society Admin will review and verify it.");
                notif.setReadStatus(false);
                notif.setTenantId(tenantId);
                notificationRepository.save(notif);
            }
        } catch (Exception ex) {
            log.warn("Could not save resident notification: {}", ex.getMessage());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Property listing successfully submitted for Society Admin approval!",
                "listing", saved
        ));
    }

    /**
     * Admin Action: Approve a property listing.
     * Changes status to ACTIVE, verified.
     */
    @PutMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveListing(
            @PathVariable Long id,
            @RequestBody(required = false) ReviewDecisionRequest req,
            HttpSession session) {

        PropertyListing listing = propertyListingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property listing not found"));

        AppUser adminUser = resolveCurrentUser(session);
        String adminName = adminUser != null ? adminUser.getFullName() : "Society Administrator";

        listing.setStatus("ACTIVE");
        listing.setVerificationStatus("VERIFIED");
        listing.setReviewedBy(adminName);
        listing.setReviewedAt(LocalDateTime.now());
        listing.setReviewNote((req != null && req.note() != null && !req.note().isBlank())
                ? req.note().trim()
                : "Verified and approved by Society Administration. Published to community marketplace.");

        PropertyListing updated = propertyListingRepository.save(listing);

        // Notify submitter if user found
        if (listing.getSubmittedById() != null) {
            try {
                Notification notif = new Notification();
                notif.setUserId(listing.getSubmittedById());
                notif.setType("PROPERTY_APPROVED");
                notif.setTitle("Property Listing Approved!");
                notif.setMessage("Congratulations! Your listing for Flat " + listing.getUnitNumber() + " has been approved by the Society Admin and is now live.");
                notif.setReadStatus(false);
                notif.setTenantId(listing.getTenantId() != null ? listing.getTenantId() : "tenant-default");
                notificationRepository.save(notif);
            } catch (Exception ex) {
                log.warn("Could not send approval notification: {}", ex.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Property listing approved and published successfully!",
                "listing", updated
        ));
    }

    /**
     * Admin Action: Reject / Request clarification on a property listing.
     */
    @PutMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectListing(
            @PathVariable Long id,
            @RequestBody ReviewDecisionRequest req,
            HttpSession session) {

        PropertyListing listing = propertyListingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property listing not found"));

        AppUser adminUser = resolveCurrentUser(session);
        String adminName = adminUser != null ? adminUser.getFullName() : "Society Administrator";
        String reason = (req != null && req.reason() != null && !req.reason().isBlank())
                ? req.reason().trim()
                : "Listing details require clarification or do not meet society guidelines.";

        listing.setStatus("REJECTED");
        listing.setVerificationStatus("REJECTED");
        listing.setReviewedBy(adminName);
        listing.setReviewedAt(LocalDateTime.now());
        listing.setRejectionReason(reason);

        PropertyListing updated = propertyListingRepository.save(listing);

        // Notify submitter
        if (listing.getSubmittedById() != null) {
            try {
                Notification notif = new Notification();
                notif.setUserId(listing.getSubmittedById());
                notif.setType("PROPERTY_REJECTED");
                notif.setTitle("Property Listing Needs Changes");
                notif.setMessage("Your listing for Flat " + listing.getUnitNumber() + " was not approved. Reason: " + reason);
                notif.setReadStatus(false);
                notif.setTenantId(listing.getTenantId() != null ? listing.getTenantId() : "tenant-default");
                notificationRepository.save(notif);
            } catch (Exception ex) {
                log.warn("Could not send rejection notification: {}", ex.getMessage());
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Property listing marked as rejected with reason noted.",
                "listing", updated
        ));
    }

    /**
     * Withdraw / Cancel listing by owner or admin.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> cancelListing(@PathVariable Long id) {
        PropertyListing listing = propertyListingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property listing not found"));

        listing.setStatus("CANCELLED");
        propertyListingRepository.save(listing);

        return ResponseEntity.ok(Map.of(
                "message", "Property listing withdrawn successfully."
        ));
    }

    private AppUser resolveCurrentUser(HttpSession session) {
        try {
            return currentUserService.requireUser();
        } catch (Exception e) {
            // Check session fallback or return first resident/admin for demo resilience
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))) {
                return appUserRepository.findAll().stream()
                        .filter(u -> u.getRole() == UserRole.SOCIETY_ADMIN || u.getRole() == UserRole.SUPER_ADMIN)
                        .findFirst().orElse(null);
            }
            return appUserRepository.findAll().stream()
                    .filter(u -> u.getRole() == UserRole.RESIDENT)
                    .findFirst().orElse(null);
        }
    }

    public record SocietyPropertyPostRequest(
            String title,
            String description,
            String listingType,
            String propertyType,
            String unitNumber,
            String tower,
            String bhk,
            Integer area,
            Integer bathrooms,
            Integer floor,
            BigDecimal price,
            BigDecimal deposit,
            BigDecimal maintenance,
            String furnishing,
            String parking,
            LocalDate availableFrom,
            String tenantPreference,
            String amenities,
            String notes,
            String contactName,
            String contactPhone,
            String contactEmail,
            String imageUrl,
            String imageUrls
    ) {}

    public record ReviewDecisionRequest(
            String note,
            String reason
    ) {}
}
