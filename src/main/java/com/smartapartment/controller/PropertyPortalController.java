package com.smartapartment.controller;



import com.fasterxml.jackson.databind.ObjectMapper;

import com.smartapartment.entity.*;

import com.smartapartment.repository.*;

import com.smartapartment.service.PropertyAccessService;

import jakarta.servlet.http.HttpSession;

import jakarta.validation.Valid;

import jakarta.validation.Validator;

import jakarta.validation.constraints.*;

import java.time.LocalDateTime;

import java.util.*;

import org.springframework.http.HttpStatus;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.*;

import org.springframework.web.multipart.MultipartFile;

import org.springframework.web.server.ResponseStatusException;



/** Shared, persistent workflow for customers, verified owners, builders and admins. */

@RestController

@RequestMapping({"/api/property/portal", "/api/propertydirect/portal"})

@Transactional

public class PropertyPortalController {

    private final PropertyAccessService access;

    private final PropertyCustomerRepository customers;

    private final PropertyListingRepository listings;

    private final PropertySellerApplicationRepository applications;

    private final PropertyProjectRepository projects;

    private final PropertyEnquiryRepository enquiries;

    private final PropertyVisitRepository visits;

    private final PropertyReportRepository reports;

    private final PropertyAuditEventRepository audit;

    private final PropertyApiController properties;

    private final ObjectMapper mapper;

    private final Validator validator;



    public PropertyPortalController(PropertyAccessService access, PropertyCustomerRepository customers,

            PropertyListingRepository listings, PropertySellerApplicationRepository applications,

            PropertyProjectRepository projects, PropertyEnquiryRepository enquiries, PropertyVisitRepository visits,

            PropertyReportRepository reports, PropertyAuditEventRepository audit, PropertyApiController properties,

            ObjectMapper mapper, Validator validator) {

        this.access=access; this.customers=customers; this.listings=listings; this.applications=applications;

        this.projects=projects; this.enquiries=enquiries; this.visits=visits; this.reports=reports;

        this.audit=audit; this.properties=properties; this.mapper=mapper; this.validator=validator;

    }



    @GetMapping("/me")

    public Map<String,Object> me(HttpSession session) {

        if (session.getAttribute("propertydirect:customerId") instanceof Long) {

            PropertyCustomer c=access.account(session);

            Map<String,Object> result=accountView(c);

            result.put("application", applications.findByCustomerId(c.getId()).orElse(null));

            return result;

        }

        if (!access.isAdmin(session)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please sign in to PropertyDirect");

        return Map.of("id", 0, "name", "PropertyDirect Administrator", "role", "ADMIN", "postingVerified", true,

                "email", "", "phone", "", "status", "ACTIVE");

    }



    @PatchMapping("/profile")

    public Map<String,Object> profile(@Valid @RequestBody ProfileRequest request, HttpSession session) {

        PropertyCustomer c=access.account(session);

        c.setName(request.name().trim()); c.setPhone(request.phone().trim());
        if (request.preferredCity() != null) c.setPreferredCity(request.preferredCity().trim());
        if (request.preferredLocality() != null) c.setPreferredLocality(request.preferredLocality().trim());
        if (request.preferredListingType() != null) c.setPreferredListingType(request.preferredListingType().trim());
        if (request.preferredPropertyType() != null) c.setPreferredPropertyType(request.preferredPropertyType().trim());
        if (request.preferredBhk() != null) c.setPreferredBhk(request.preferredBhk().trim());
        if (request.budgetMin() != null) c.setBudgetMin(request.budgetMin());
        if (request.budgetMax() != null) c.setBudgetMax(request.budgetMax());
        if (request.emailAlertsEnabled() != null) c.setEmailAlertsEnabled(request.emailAlertsEnabled());

        return accountView(customers.save(c));

    }



    @PostMapping("/applications")

    public PropertySellerApplication apply(@Valid @RequestBody ApplicationRequest request, HttpSession session) {

        PropertyCustomer c=access.account(session);

        String role=upper(request.role());

        require(Set.of("OWNER", "BUILDER").contains(role), "Choose Owner or Builder");

        require(!access.isAdmin(session), "Administrator accounts do not need a posting application");

        if ("BUILDER".equals(role)) require(!blank(request.companyName()) && !blank(request.registrationNumber()),

                "Builder company name and registration reference are required");

        PropertySellerApplication a=applications.findByCustomerId(c.getId()).orElseGet(PropertySellerApplication::new);

        require(!"PENDING".equals(a.getDecision()) || a.getId()==null, "Your application is already awaiting review");

        require(!c.isPostingVerified() || !role.equals(PropertyAccessService.role(c.getRole())), "Your posting access is already verified");

        a.setTenantId("propertydirect"); a.setCustomerId(c.getId()); a.setRequestedRole(role);

        a.setCompanyName(request.companyName()); a.setRegistrationNumber(request.registrationNumber());

        a.setVerificationDetails(request.verificationDetails()); a.setDecision("PENDING");

        a.setReviewNote(null); a.setReviewedAt(null); a.setReviewedBy(null);

        applications.save(a); event(session,"APPLICATION_SUBMITTED","APPLICATION",a.getId(),role);

        return a;

    }



    @GetMapping("/applications")

    public List<Map<String,Object>> applications(HttpSession session) {

        access.admin(session);

        return applications.findAllByOrderByCreatedAtDesc().stream().map(a -> {

            Map<String,Object> item=new LinkedHashMap<>(); item.put("application",a);

            item.put("account", customers.findById(a.getCustomerId()).map(this::accountView).orElse(Map.of()));

            return item;

        }).toList();

    }



    @PatchMapping("/applications/{id}")

    public PropertySellerApplication reviewApplication(@PathVariable Long id, @Valid @RequestBody DecisionRequest request, HttpSession session) {

        access.admin(session);

        PropertySellerApplication a=applications.findById(id).orElseThrow(() -> missing("Application"));

        require("PENDING".equals(a.getDecision()), "This application has already been reviewed");

        String decision=upper(request.decision());

        require(Set.of("APPROVED","REJECTED").contains(decision), "Choose Approved or Rejected");

        require(!blank(request.note()), "Record the verification result or rejection reason");

        PropertyCustomer c=customers.findById(a.getCustomerId()).orElseThrow(() -> missing("Account"));

        require(c.isActive() && "ACTIVE".equals(c.getStatus()), "Reactivate the account before reviewing its application");

        if ("APPROVED".equals(decision)) { c.setRole(a.getRequestedRole()); c.setPostingVerified(true); customers.save(c); }

        a.setDecision(decision); a.setReviewNote(request.note().trim()); a.setReviewedAt(LocalDateTime.now()); a.setReviewedBy(access.actor(session));

        event(session,"APPLICATION_"+decision,"APPLICATION",id,request.note());

        return applications.save(a);

    }



    @GetMapping("/accounts")

    public List<Map<String,Object>> accounts(HttpSession session) {

        access.admin(session);

        return customers.findAll().stream().sorted(Comparator.comparing(PropertyCustomer::getId).reversed()).map(this::accountView).toList();

    }



    @PatchMapping("/accounts/{id}")

    public Map<String,Object> accountStatus(@PathVariable Long id, @Valid @RequestBody AccountStatusRequest request, HttpSession session) {

        access.admin(session);

        require(!id.equals(session.getAttribute("propertydirect:customerId")), "You cannot suspend your own account");

        PropertyCustomer c=customers.findById(id).orElseThrow(() -> missing("Account"));

        require(!Set.of("ADMIN","SUPERADMIN").contains(PropertyAccessService.role(c.getRole())), "Administrator access is managed separately");

        String status=upper(request.status());

        require(Set.of("ACTIVE","SUSPENDED").contains(status), "Choose Active or Suspended");

        c.setActive("ACTIVE".equals(status)); c.setStatus(status);

        if (!c.isActive()) listings.findByCustomerIdOrderByCreatedAtDesc(id).forEach(l -> {if ("ACTIVE".equals(l.getStatus())) l.setStatus("INACTIVE");});

        event(session,"ACCOUNT_"+status,"ACCOUNT",id,request.note());

        return accountView(customers.save(c));
    }

    @PutMapping("/accounts/{id}")
    public Map<String, Object> updateAccount(@PathVariable Long id, @RequestBody AccountUpdateRequest request, HttpSession session) {
        access.admin(session);
        PropertyCustomer c = customers.findById(id).orElseThrow(() -> missing("Account"));

        if (request != null) {
            if (request.name() != null && !request.name().isBlank()) {
                c.setName(request.name().trim());
            }
            if (request.phone() != null && !request.phone().isBlank()) {
                c.setPhone(request.phone().trim());
            }
            if (request.email() != null && !request.email().isBlank()) {
                c.setEmail(request.email().trim());
            }
            if (request.role() != null && !request.role().isBlank()) {
                String newRole = upper(request.role());
                if (Set.of("CUSTOMER", "OWNER", "BUILDER").contains(newRole)) {
                    c.setRole(newRole);
                }
            }
            if (request.status() != null && !request.status().isBlank()) {
                String newStatus = upper(request.status());
                if (Set.of("ACTIVE", "SUSPENDED").contains(newStatus)) {
                    c.setActive("ACTIVE".equals(newStatus));
                    c.setStatus(newStatus);
                    if (!c.isActive()) {
                        listings.findByCustomerIdOrderByCreatedAtDesc(id).forEach(l -> {
                            if ("ACTIVE".equals(l.getStatus())) l.setStatus("INACTIVE");
                        });
                    }
                }
            }
            if (request.postingVerified() != null) {
                c.setPostingVerified(request.postingVerified());
                if (request.postingVerified() && "CUSTOMER".equalsIgnoreCase(c.getRole())) {
                    c.setRole("OWNER");
                }
            }
        }

        String note = (request != null && request.note() != null && !request.note().isBlank())
                ? request.note().trim()
                : "Profile details updated by administrator";
        event(session, "ACCOUNT_UPDATED", "ACCOUNT", id, note);
        return accountView(customers.save(c));
    }

    @PatchMapping("/accounts/{id}/posting-permission")
    public Map<String, Object> togglePostingPermission(
            @PathVariable Long id,
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) String note,
            HttpSession session) {
        access.admin(session);
        PropertyCustomer c = customers.findById(id).orElseThrow(() -> missing("Account"));
        boolean nextState = verified != null ? verified : !c.isPostingVerified();
        c.setPostingVerified(nextState);
        if (nextState && "CUSTOMER".equalsIgnoreCase(c.getRole())) {
            c.setRole("OWNER");
        }
        String auditNote = (note != null && !note.isBlank()) ? note.trim() : ("Posting permission updated to " + nextState);
        event(session, nextState ? "POSTING_APPROVED" : "POSTING_REVOKED", "ACCOUNT", id, auditNote);
        return accountView(customers.save(c));
    }



    @GetMapping("/listings")

    public List<PropertyListing> listingInventory(HttpSession session) {

        if (access.isAdmin(session)) return listings.findAll().stream().sorted(Comparator.comparing(PropertyListing::getId).reversed()).toList();

        return listings.findByCustomerIdOrderByCreatedAtDesc(access.account(session).getId());

    }



    @PostMapping(value={"/listings", "/listings/with-photos"}, consumes="multipart/form-data")
    public PropertyListing createListing(
            @RequestPart(value="property", required=false) String propertyJson,
            @RequestPart(value="listing", required=false) String listingJson,
            @RequestPart(value="photos", required=false) List<MultipartFile> photos,
            HttpSession session) throws Exception {
        String json = propertyJson != null && !propertyJson.isBlank() ? propertyJson : listingJson;
        require(json != null && !json.isBlank(), "Property listing data is required");

        ListingSubmission request;
        try {
            request = mapper.readValue(json, ListingSubmission.class);
            if (request.listing() == null) {
                PropertyApiController.ListingRequest flat = mapper.readValue(json, PropertyApiController.ListingRequest.class);
                request = new ListingSubmission(flat, request.ownerId(), request.projectId(), request.tower(), request.unitNumber(), "SUBMIT");
            }
        } catch (Exception ex) {
            PropertyApiController.ListingRequest flat = mapper.readValue(json, PropertyApiController.ListingRequest.class);
            request = new ListingSubmission(flat, null, null, null, null, "SUBMIT");
        }

        // Ensure society is populated so validation does not fail if frontend passed only locality
        if (request.listing() != null && (request.listing().society() == null || request.listing().society().isBlank())) {
            PropertyApiController.ListingRequest orig = request.listing();
            String soc = (orig.locality() != null && !orig.locality().isBlank()) ? orig.locality() : (orig.title() != null ? orig.title() : "Standard Community");
            PropertyApiController.ListingRequest fixedListing = new PropertyApiController.ListingRequest(
                orig.title(), orig.description(), soc, orig.locality(), orig.address(), orig.city(),
                orig.pincode(), orig.type(), orig.propertyType(), orig.price(), orig.deposit(),
                orig.maintenance(), orig.areaSqft(), orig.bhk(), orig.bathrooms(), orig.furnishing(),
                orig.parking(), orig.availableFrom(), orig.latitude(), orig.longitude(), orig.amenities(),
                orig.imageUrl(), orig.notes()
            );
            request = new ListingSubmission(fixedListing, request.ownerId(), request.projectId(), request.tower(), request.unitNumber(), request.intent());
        }

        validate(request); validate(request.listing());
        Long ownerId=postingOwner(request.ownerId(), session);
        boolean draft = "DRAFT".equals(upper(request.intent()));
        
        // Prevent duplicate submissions for the same property
        checkDuplicateSubmission(null, ownerId, request.listing(), request.unitNumber(), request.projectId());
        
        List<MultipartFile> finalPhotos = photos != null ? new java.util.ArrayList<>(photos) : new java.util.ArrayList<>();
        if (!draft && finalPhotos.isEmpty()) {
            if (access.isAdmin(session)) {
                // Admin posting fallback: provide standard valid PNG image
                byte[] samplePng = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=");
                finalPhotos.add(new InMemoryMultipartFile("photos", "property-cover.png", "image/png", samplePng));
            } else {
                require(false, "Add at least one property photo before submitting for approval");
            }
        }

        PropertyListing listing=properties.createForOwner(request.listing(), ownerId,
                finalPhotos, draft);
        assignUnit(listing,request.projectId(),request.tower(),request.unitNumber(),ownerId);
        
        // Retain both actual owner/builder and submitting account
        String actor = access.actor(session);
        Long submitterId = session.getAttribute("propertydirect:customerId") instanceof Long
                ? (Long) session.getAttribute("propertydirect:customerId")
                : null;
        String submitterRole = access.isAdmin(session) ? "ADMIN" : PropertyAccessService.role(access.account(session).getRole());
        listing.setSubmittedBy(actor);
        listing.setSubmittedById(submitterId);
        listing.setSubmitterRole(submitterRole);
        
        listings.saveAndFlush(listing);
        event(session, draft ? "LISTING_DRAFT_CREATED" : "LISTING_SUBMITTED", "LISTING", listing.getId(),
                draft ? "Draft saved: " + listing.getTitle() : "Submitted for admin review: " + listing.getTitle());
        return listing;
    }

    @GetMapping("/listings/{id}")
    public PropertyListing listing(@PathVariable Long id, HttpSession session) {
        return editableListing(id, session);
    }

    @PutMapping("/listings/{id}")
    public PropertyListing editListing(@PathVariable Long id, @Valid @RequestBody ListingSubmission request, HttpSession session) {
        PropertyListing l=editableListing(id,session); validate(request.listing());
        var r=request.listing();
        
        // Check for duplicate property submissions
        checkDuplicateSubmission(id, l.getCustomerId(), r, request.unitNumber(), request.projectId());

        boolean wasApproved = "ACTIVE".equalsIgnoreCase(l.getStatus()) && Set.of("APPROVED","VERIFIED").contains(upper(l.getVerificationStatus()));
        String materialChanges = detectMaterialChanges(l, r, request);
        boolean hasMaterialChanges = !materialChanges.isBlank();

        l.setTitle(r.title()); l.setDescription(r.description()); l.setSociety(r.society()); l.setLocality(r.locality());
        l.setAddress(r.address()); l.setCity(r.city()); l.setPincode(r.pincode()); l.setListingType(upper(r.type()));
        l.setPropertyType(r.propertyType()); l.setPrice(r.price()); l.setDeposit(r.deposit()); l.setMaintenance(r.maintenance());
        l.setAreaSqft(r.areaSqft()); l.setBhk(r.bhk()); l.setBathrooms(r.bathrooms()); l.setFurnishing(r.furnishing());
        l.setParking(r.parking()); l.setAvailableFrom(r.availableFrom()); l.setLatitude(r.latitude()); l.setLongitude(r.longitude());
        l.setAmenities(r.amenities()); l.setNotes(r.notes());
        if (r.floor() != null) l.setFloor(r.floor());
        if (r.totalFloors() != null) l.setTotalFloors(r.totalFloors());
        if (!blank(r.propertyAge())) l.setPropertyAge(r.propertyAge());
        if (!blank(r.constructionStatus())) l.setConstructionStatus(r.constructionStatus());
        if (r.applicableFees() != null) l.setApplicableFees(r.applicableFees());
        if (!blank(r.videoUrl())) l.setVideoUrl(r.videoUrl());
        if (!blank(r.availabilityStatus())) l.setAvailabilityStatus(r.availabilityStatus());
        if (!blank(r.ownershipDocUrl())) l.setOwnershipDocUrl(r.ownershipDocUrl());
        if (!blank(r.verificationDocuments())) l.setVerificationDocuments(r.verificationDocuments());
        if (!blank(r.reraNumber())) l.setReraNumber(r.reraNumber());
        if (!blank(r.privateVerificationNotes())) l.setPrivateVerificationNotes(r.privateVerificationNotes());
        assignUnit(l,request.projectId(),request.tower(),request.unitNumber(),l.getCustomerId());

        boolean draft = "DRAFT".equals(upper(request.intent()));
        if (wasApproved) {
            if (hasMaterialChanges) {
                // Material changes return approved listings to review queue
                l.setStatus("PENDING_APPROVAL");
                l.setVerificationStatus("PENDING");
                l.setReviewedBy(null);
                l.setReviewedAt(null);
                l.setReviewNote("Returned for review due to material changes: " + materialChanges);
                event(session, "MATERIAL_CHANGE_RETURNED_FOR_REVIEW", "LISTING", id, materialChanges);
            } else {
                // Non-material change preserves active approved status
                event(session, "LISTING_UPDATED", "LISTING", id, "Non-material details updated: " + l.getTitle());
            }
        } else {
            require(draft || !blank(l.getImageUrls()), "Add property photos before submitting for approval");
            l.setStatus(draft ? "DRAFT" : "PENDING_APPROVAL");
            l.setVerificationStatus(draft ? "DRAFT" : "PENDING");
            l.setRejectionReason(null);
            l.setReviewNote(null);
            l.setReviewedAt(null);
            l.setReviewedBy(null);
            event(session, draft ? "LISTING_DRAFT_UPDATED" : "LISTING_SUBMITTED", "LISTING", id,
                    draft ? "Draft updated: " + l.getTitle() : "Resubmitted for admin review: " + l.getTitle());
        }

        return listings.saveAndFlush(l);
    }

    @PostMapping(value="/listings/{id}/photos", consumes="multipart/form-data")
    public PropertyListing photos(@PathVariable Long id,@RequestPart("photos") List<MultipartFile> photos,HttpSession session) {
        PropertyListing l=editableListing(id,session);
        require(!photos.isEmpty(),"Select at least one photo");
        properties.attachPhotos(l,photos);
        boolean wasActive = "ACTIVE".equalsIgnoreCase(l.getStatus());
        if (wasActive) {
            l.setStatus("PENDING_APPROVAL");
            l.setVerificationStatus("PENDING");
            l.setReviewedBy(null);
            l.setReviewedAt(null);
            l.setReviewNote("Returned for review due to new photo uploads (" + photos.size() + " photos added)");
            event(session, "MATERIAL_CHANGE_RETURNED_FOR_REVIEW", "LISTING", id, photos.size() + " photos added to published listing");
        } else {
            event(session,"PHOTOS_ADDED","LISTING",id,photos.size() + " photos uploaded");
        }
        return listings.save(l);
    }

    @PatchMapping("/listings/{id}/status")
    public PropertyListing listingStatus(@PathVariable Long id, @Valid @RequestBody DecisionRequest request, HttpSession session) {
        String decision=upper(request.decision());
        if (Set.of("APPROVED","REJECTED","CHANGES_REQUESTED","ADMIN_REVIEW").contains(decision)) {
            access.admin(session);
            PropertyListing l=listings.findById(id).orElseThrow(() -> missing("Listing"));
            
            if ("ADMIN_REVIEW".equals(decision)) {
                l.setStatus("PENDING_APPROVAL");
                l.setVerificationStatus("ADMIN_REVIEW");
                event(session, "LISTING_UNDER_REVIEW", "LISTING", id, "Admin review in progress");
                return listings.saveAndFlush(l);
            }
            if ("APPROVED".equals(decision)) {
                require(!blank(l.getImageUrls()), "A listing must include photos before publication");
                verifiedOwner(l.getCustomerId());
                l.setStatus("ACTIVE");
                l.setVerificationStatus("APPROVED");
                l.setReviewedBy(access.actor(session));
                l.setReviewedAt(LocalDateTime.now());
                l.setReviewNote(blank(request.note()) ? "Approved and published publicly" : request.note().trim());
                l.setRejectionReason(null);
                properties.dispatchSavedSearchAlerts(l);
                event(session, "LISTING_APPROVED", "LISTING", id, l.getReviewNote());
                return listings.saveAndFlush(l);
            }
            if ("CHANGES_REQUESTED".equals(decision)) {
                require(!blank(request.note()), "A review note detailing requested changes is required");
                l.setStatus("CHANGES_REQUESTED");
                l.setVerificationStatus("CHANGES_REQUESTED");
                l.setReviewedBy(access.actor(session));
                l.setReviewedAt(LocalDateTime.now());
                l.setReviewNote(request.note().trim());
                event(session, "LISTING_CHANGES_REQUESTED", "LISTING", id, request.note().trim());
                return listings.saveAndFlush(l);
            }
            if ("REJECTED".equals(decision)) {
                require(!blank(request.note()), "A rejection reason is required");
                l.setStatus("REJECTED");
                l.setVerificationStatus("REJECTED");
                l.setReviewedBy(access.actor(session));
                l.setReviewedAt(LocalDateTime.now());
                l.setRejectionReason(request.note().trim());
                l.setReviewNote(request.note().trim());
                event(session, "LISTING_REJECTED", "LISTING", id, request.note().trim());
                return listings.saveAndFlush(l);
            }
        }
        
        PropertyListing l=editableListing(id,session);
        if ("SUBMIT".equals(decision)) {
            require(Set.of("DRAFT","REJECTED","INACTIVE").contains(upper(l.getStatus())) || "CHANGES_REQUESTED".equalsIgnoreCase(l.getVerificationStatus()), "This listing is already submitted or published");
            require(!blank(l.getImageUrls()), "Add property photos before submitting for approval");
            checkDuplicateSubmission(l.getId(), l.getCustomerId(), toListingRequest(l), l.getUnitNumber(), l.getProjectId());
            l.setVerificationStatus("PENDING");
            l.setStatus("PENDING_APPROVAL");
            l.setRejectionReason(null);
            event(session, "LISTING_SUBMITTED", "LISTING", id, blank(request.note()) ? "Submitted for admin review" : request.note());
        } else if ("INACTIVE".equals(decision)) {
            l.setStatus("INACTIVE");
            event(session, "LISTING_DEACTIVATED", "LISTING", id, blank(request.note()) ? "Deactivated by owner/builder" : request.note());
        } else if ("SOLD".equals(decision)) {
            require(Set.of("ACTIVE","APPROVED").contains(upper(l.getStatus())) || "APPROVED".equalsIgnoreCase(l.getVerificationStatus()), "Only an approved listing can be marked sold");
            l.setStatus("SOLD");
            event(session, "LISTING_MARKED_SOLD", "LISTING", id, blank(request.note()) ? "Marked as sold" : request.note());
        } else if ("RENTED".equals(decision)) {
            require(Set.of("ACTIVE","APPROVED").contains(upper(l.getStatus())) || "APPROVED".equalsIgnoreCase(l.getVerificationStatus()), "Only an approved listing can be marked rented");
            l.setStatus("RENTED");
            event(session, "LISTING_MARKED_RENTED", "LISTING", id, blank(request.note()) ? "Marked as rented" : request.note());
        } else if ("REACTIVATE".equals(decision)) {
            require(Set.of("INACTIVE","SOLD","RENTED").contains(upper(l.getStatus())), "Only inactive, sold or rented listings can be reactivated");
            if ("APPROVED".equalsIgnoreCase(l.getVerificationStatus())) {
                l.setStatus("ACTIVE");
                event(session, "LISTING_REACTIVATED", "LISTING", id, "Reactivated by owner");
            } else {
                l.setStatus("PENDING_APPROVAL");
                l.setVerificationStatus("PENDING");
                event(session, "LISTING_SUBMITTED", "LISTING", id, "Re-submitted for review");
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported listing status: " + decision);
        }
        return listings.saveAndFlush(l);
    }

    @GetMapping("/listings/{id}/history")
    public List<PropertyAuditEvent> listingHistory(@PathVariable Long id, HttpSession session) {
        PropertyListing l = listings.findById(id).orElseThrow(() -> missing("Listing"));
        if (!access.isAdmin(session) && !Objects.equals(access.account(session).getId(), l.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can view change history only for your own listings");
        }
        return audit.findByTargetTypeAndTargetIdOrderByCreatedAtAsc("LISTING", id);
    }

    @PatchMapping("/listings/{id}/featured")
    public PropertyListing feature(@PathVariable Long id,@RequestParam boolean featured,HttpSession session) {
        access.admin(session); PropertyListing l=listings.findById(id).orElseThrow(() -> missing("Listing"));
        require("ACTIVE".equals(l.getStatus()), "Only published listings can be featured");
        l.setFeatured(featured); event(session,"FEATURED_CHANGED","LISTING",id,String.valueOf(featured)); return listings.save(l);
    }

    @GetMapping("/projects")
    public List<PropertyProject> projects(HttpSession session) {
        if (access.isAdmin(session)) return projects.findAll();
        return projects.findByBuilderIdOrderByCreatedAtDesc(access.account(session).getId());
    }

    @GetMapping("/projects/{id}")
    public Map<String, Object> projectDetails(@PathVariable Long id, HttpSession session) {
        PropertyProject p = projects.findById(id).orElseThrow(() -> missing("Project"));
        List<PropertyListing> projectListings = listings.findAll().stream()
                .filter(l -> Objects.equals(p.getId(), l.getProjectId()))
                .sorted(Comparator.comparing(l -> String.valueOf(l.getTower()) + "_" + String.valueOf(l.getUnitNumber())))
                .toList();

        boolean privileged = access.isAdmin(session) || (session.getAttribute("propertydirect:customerId") instanceof Long &&
                Objects.equals(p.getBuilderId(), session.getAttribute("propertydirect:customerId")));
        if (!privileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access another builder's private project management records");
        }

        List<PropertyListing> unitsToReturn = projectListings;

        long availableCount = projectListings.stream()
                .filter(l -> "ACTIVE".equalsIgnoreCase(l.getStatus()) && !"SOLD".equalsIgnoreCase(l.getAvailabilityStatus()) && !"SOLD".equalsIgnoreCase(l.getStatus()) && !"RENTED".equalsIgnoreCase(l.getAvailabilityStatus()) && !"RENTED".equalsIgnoreCase(l.getStatus()))
                .count();
        long soldCount = projectListings.stream()
                .filter(l -> "SOLD".equalsIgnoreCase(l.getStatus()) || "SOLD".equalsIgnoreCase(l.getAvailabilityStatus()))
                .count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("project", p);
        response.put("totalUnitsListed", projectListings.size());
        response.put("availableUnitsCount", availableCount);
        response.put("soldUnitsCount", soldCount);
        response.put("units", unitsToReturn);
        return response;
    }

    @GetMapping("/projects/{id}/units")
    public Map<String, Object> projectUnits(@PathVariable Long id, HttpSession session) {
        return projectDetails(id, session);
    }



    @PostMapping("/projects")

    public PropertyProject project(@Valid @RequestBody ProjectRequest request,HttpSession session) {

        Long builderId=postingOwner(request.builderId(),session);

        require("BUILDER".equals(PropertyAccessService.role(verifiedOwner(builderId).getRole())), "Projects belong to verified builders");

        PropertyProject p=new PropertyProject(); p.setTenantId("propertydirect"); p.setBuilderId(builderId);

        p.setName(request.name().trim()); p.setCity(request.city().trim()); p.setRegistrationNumber(request.registrationNumber().trim());
        p.setConstructionStatus(request.constructionStatus()); p.setDescription(request.description());
        if (!blank(request.locality())) p.setLocality(request.locality().trim());
        if (!blank(request.reraNumber())) p.setReraNumber(request.reraNumber().trim());
        else p.setReraNumber(request.registrationNumber().trim());
        if (request.totalTowers() != null) p.setTotalTowers(request.totalTowers());
        if (request.totalUnits() != null) p.setTotalUnits(request.totalUnits());
        if (request.possessionDate() != null) p.setPossessionDate(request.possessionDate());
        projects.save(p);

        event(session,"PROJECT_CREATED","PROJECT",p.getId(),p.getName()); return p;

    }



    @PutMapping("/projects/{id}")

    public PropertyProject editProject(@PathVariable Long id,@Valid @RequestBody ProjectRequest request,HttpSession session) {

        PropertyProject p=projects.findById(id).orElseThrow(() -> missing("Project"));

        if (!access.isAdmin(session) && !Objects.equals(access.seller(session).getId(),p.getBuilderId()))

            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You can manage only your own projects");

        require(request.builderId()==null || Objects.equals(request.builderId(),p.getBuilderId()),"A project's builder cannot be changed");

        p.setName(request.name().trim()); p.setCity(request.city().trim());

        p.setRegistrationNumber(request.registrationNumber().trim()); p.setConstructionStatus(request.constructionStatus());

        p.setDescription(request.description());

        event(session,"PROJECT_EDITED","PROJECT",id,p.getName()); return projects.save(p);

    }



    @GetMapping("/enquiries")

    public List<Map<String,Object>> enquiries(HttpSession session) {

        boolean admin=access.isAdmin(session); Long accountId=admin?null:access.account(session).getId();

        Map<Long,PropertyListing> inventory=new HashMap<>(); listings.findAll().forEach(l -> inventory.put(l.getId(),l));
        Map<Long,PropertyProject> projectMap=new HashMap<>(); projects.findAll().forEach(p -> projectMap.put(p.getId(),p));

        return enquiries.findAll().stream().filter(e -> admin || Objects.equals(accountId,e.getCustomerId()) ||
                (inventory.containsKey(e.getListingId()) && Objects.equals(accountId,inventory.get(e.getListingId()).getCustomerId())) ||
                (e.getProjectId() != null && projectMap.containsKey(e.getProjectId()) && Objects.equals(accountId, projectMap.get(e.getProjectId()).getBuilderId())))

                .sorted(Comparator.comparing(PropertyEnquiry::getId).reversed()).map(e -> {

                    Map<String,Object> row=new LinkedHashMap<>(); row.put("enquiry",e);

                    String title = inventory.containsKey(e.getListingId()) ? inventory.get(e.getListingId()).getTitle() :
                                  (e.getProjectId() != null && projectMap.containsKey(e.getProjectId()) ? ("Project: " + projectMap.get(e.getProjectId()).getName()) : "Platform contact");
                    row.put("listingTitle", title);

                    boolean canReply = admin ||
                        (inventory.containsKey(e.getListingId()) && Objects.equals(accountId,inventory.get(e.getListingId()).getCustomerId())) ||
                        (e.getProjectId() != null && projectMap.containsKey(e.getProjectId()) && Objects.equals(accountId, projectMap.get(e.getProjectId()).getBuilderId()));
                    row.put("canReply", canReply);

                    return row;

                }).toList();

    }



    @PatchMapping("/enquiries/{id}/reply")

    public PropertyEnquiry reply(@PathVariable Long id,@Valid @RequestBody ReplyRequest request,HttpSession session) {

        PropertyEnquiry e=enquiries.findById(id).orElseThrow(() -> missing("Enquiry"));

        if (!access.isAdmin(session)) {
            if (e.getListingId() != null) {
                editableListing(e.getListingId(), session);
            } else if (e.getProjectId() != null) {
                PropertyProject p = projects.findById(e.getProjectId()).orElseThrow(() -> missing("Project"));
                if (!Objects.equals(access.account(session).getId(), p.getBuilderId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot reply to enquiries for other builders' projects");
                }
            }
        }

        e.setReply(request.reply().trim()); e.setRepliedAt(LocalDateTime.now()); e.setStatus("RESPONDED");

        event(session,"ENQUIRY_REPLIED","ENQUIRY",id,"Response sent to customer dashboard"); return enquiries.save(e);

    }



    @GetMapping("/visits")

    public List<PropertyVisit> visits(HttpSession session) {

        if (access.isAdmin(session)) return visits.findAll();

        Long id=access.account(session).getId();

        return visits.findAll().stream().filter(v -> Objects.equals(id,v.getCustomerId()) || Objects.equals(id,v.getListing().getCustomerId())).toList();

    }



    @PatchMapping("/visits/{id}")

    public PropertyVisit visit(@PathVariable Long id,@Valid @RequestBody VisitUpdate request,HttpSession session) {

        PropertyVisit v=visits.findById(id).orElseThrow(() -> missing("Visit"));

        boolean admin=access.isAdmin(session);

        Long accountId=admin?null:access.account(session).getId();

        boolean owner=admin || Objects.equals(accountId,v.getListing().getCustomerId());

        boolean customer=Objects.equals(accountId,v.getCustomerId());

        if (!owner && !customer) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This visit belongs to another account");

        require(!Set.of("COMPLETED","CANCELLED").contains(v.getVisitStatus()), "This visit is already closed");

        String next=upper(request.status());

        require(Set.of("CONFIRMED","CANCELLED","COMPLETED","REQUESTED").contains(next), "Unsupported visit status");

        require(owner || Set.of("CANCELLED","REQUESTED").contains(next), "Only the listing owner or administrator can confirm or complete a visit");

        if (request.scheduledAt()!=null) { require(request.scheduledAt().isAfter(LocalDateTime.now()),"Choose a future visit time"); v.setScheduledAt(request.scheduledAt()); }

        if ("REQUESTED".equals(next)) require(request.scheduledAt()!=null,"Choose a new visit time when rescheduling");

        if ("COMPLETED".equals(next)) require("CONFIRMED".equals(v.getVisitStatus()) && !v.getScheduledAt().isAfter(LocalDateTime.now()),"Complete a confirmed visit after its scheduled time");

        if ("CONFIRMED".equals(next)) require(v.getScheduledAt().isAfter(LocalDateTime.now()),"Reschedule this past visit before confirming it");

        v.setVisitStatus(next); event(session,"VISIT_"+next,"VISIT",id,""); return visits.save(v);

    }



    @PostMapping("/reports")

    public PropertyReport report(@Valid @RequestBody ReportRequest request,HttpSession session) {

        PropertyCustomer c=access.account(session); listings.findById(request.listingId()).orElseThrow(() -> missing("Listing"));

        PropertyReport r=new PropertyReport(); r.setTenantId("propertydirect"); r.setCustomerId(c.getId());

        r.setListingId(request.listingId()); r.setReason(request.reason().trim()); r.setStatus("OPEN");

        return reports.save(r);

    }



    @GetMapping("/reports")

    public List<PropertyReport> reports(HttpSession session) {

        if (access.isAdmin(session)) return reports.findAll();

        return reports.findByCustomerIdOrderByCreatedAtDesc(access.account(session).getId());

    }



    @PatchMapping("/reports/{id}")

    public PropertyReport resolveReport(@PathVariable Long id,@Valid @RequestBody ReplyRequest request,HttpSession session) {

        access.admin(session); PropertyReport r=reports.findById(id).orElseThrow(() -> missing("Report"));

        r.setResolution(request.reply()); r.setStatus("RESOLVED"); event(session,"REPORT_RESOLVED","REPORT",id,request.reply());

        return reports.save(r);

    }



    @GetMapping("/admin/overview")
    public Map<String, Object> adminOverview(HttpSession session) {
        access.admin(session);
        List<PropertyCustomer> allCustomers = customers.findAll();
        List<PropertyListing> allListings = listings.findAll();
        List<PropertyProject> allProjects = projects.findAll();
        List<PropertyEnquiry> allEnquiries = enquiries.findAll();
        List<PropertyVisit> allVisits = visits.findAll();
        List<PropertyReport> allReports = reports.findAll();
        List<PropertySellerApplication> allApplications = applications.findAllByOrderByCreatedAtDesc();

        long customersCount = allCustomers.stream().filter(c -> "CUSTOMER".equalsIgnoreCase(PropertyAccessService.role(c.getRole()))).count();
        long ownersCount = allCustomers.stream().filter(c -> "OWNER".equalsIgnoreCase(PropertyAccessService.role(c.getRole()))).count();
        long buildersCount = allCustomers.stream().filter(c -> "BUILDER".equalsIgnoreCase(PropertyAccessService.role(c.getRole()))).count();
        long suspendedCount = allCustomers.stream().filter(c -> !c.isActive() || "SUSPENDED".equalsIgnoreCase(c.getStatus())).count();

        long pendingVerifications = allApplications.stream().filter(a -> "PENDING".equalsIgnoreCase(a.getDecision())).count();

        long activeListings = allListings.stream().filter(l -> "ACTIVE".equalsIgnoreCase(l.getStatus()) && "APPROVED".equalsIgnoreCase(l.getVerificationStatus())).count();
        long pendingApprovals = allListings.stream().filter(l -> "PENDING_APPROVAL".equalsIgnoreCase(l.getStatus()) || "PENDING".equalsIgnoreCase(l.getVerificationStatus()) || "ADMIN_REVIEW".equalsIgnoreCase(l.getVerificationStatus())).count();
        long changesRequested = allListings.stream().filter(l -> "CHANGES_REQUESTED".equalsIgnoreCase(l.getStatus()) || "CHANGES_REQUESTED".equalsIgnoreCase(l.getVerificationStatus())).count();
        long rejectedListings = allListings.stream().filter(l -> "REJECTED".equalsIgnoreCase(l.getStatus()) || "REJECTED".equalsIgnoreCase(l.getVerificationStatus())).count();
        long soldListings = allListings.stream().filter(l -> "SOLD".equalsIgnoreCase(l.getStatus())).count();
        long rentedListings = allListings.stream().filter(l -> "RENTED".equalsIgnoreCase(l.getStatus())).count();
        long featuredListings = allListings.stream().filter(PropertyListing::isFeatured).count();

        List<PropertyListing> projectUnitListings = allListings.stream().filter(l -> l.getProjectId() != null).toList();
        long totalUnits = projectUnitListings.size();
        long availableUnits = projectUnitListings.stream().filter(l -> "ACTIVE".equalsIgnoreCase(l.getStatus()) && "APPROVED".equalsIgnoreCase(l.getVerificationStatus())).count();
        long soldUnits = projectUnitListings.stream().filter(l -> "SOLD".equalsIgnoreCase(l.getStatus())).count();

        long totalEnquiries = allEnquiries.size();
        long newEnquiries = allEnquiries.stream().filter(e -> "NEW".equalsIgnoreCase(e.getStatus()) || blank(e.getStatus())).count();

        long scheduledVisits = allVisits.size();
        long requestedVisits = allVisits.stream().filter(v -> "REQUESTED".equalsIgnoreCase(v.getVisitStatus())).count();

        long totalReports = allReports.size();
        long openReports = allReports.stream().filter(r -> "OPEN".equalsIgnoreCase(r.getStatus())).count();

        long totalAuditLogs = audit.count();

        Map<String, Object> realCounts = new LinkedHashMap<>();
        realCounts.put("totalUsers", allCustomers.size());
        realCounts.put("customers", customersCount);
        realCounts.put("owners", ownersCount);
        realCounts.put("builders", buildersCount);
        realCounts.put("suspendedAccounts", suspendedCount);
        realCounts.put("pendingVerifications", pendingVerifications);
        realCounts.put("totalListings", allListings.size());
        realCounts.put("activeListings", activeListings);
        realCounts.put("pendingApprovals", pendingApprovals);
        realCounts.put("changesRequested", changesRequested);
        realCounts.put("rejectedListings", rejectedListings);
        realCounts.put("soldListings", soldListings);
        realCounts.put("rentedListings", rentedListings);
        realCounts.put("featuredListings", featuredListings);
        realCounts.put("totalProjects", allProjects.size());
        realCounts.put("totalUnits", totalUnits);
        realCounts.put("availableUnits", availableUnits);
        realCounts.put("soldUnits", soldUnits);
        realCounts.put("totalEnquiries", totalEnquiries);
        realCounts.put("newEnquiries", newEnquiries);
        realCounts.put("scheduledVisits", scheduledVisits);
        realCounts.put("requestedVisits", requestedVisits);
        realCounts.put("totalReports", totalReports);
        realCounts.put("openReports", openReports);
        realCounts.put("totalAuditLogs", totalAuditLogs);

        List<PropertyAuditEvent> recentEvents = audit.findTop100ByOrderByCreatedAtDesc();
        List<Map<String, Object>> recentActivity = recentEvents.stream().limit(15).map(e -> {
            Map<String, Object> act = new LinkedHashMap<>();
            act.put("id", e.getId());
            act.put("action", e.getAction());
            act.put("targetType", e.getTargetType());
            act.put("targetId", e.getTargetId());
            act.put("detail", e.getDetail());
            act.put("actor", e.getActor());
            act.put("createdAt", e.getCreatedAt());
            return act;
        }).toList();

        List<Map<String, Object>> notifications = new ArrayList<>();
        if (pendingApprovals > 0) {
            notifications.add(Map.of("type", "warning", "title", "Pending Listing Approvals", "count", pendingApprovals,
                    "message", pendingApprovals + " property submission(s) awaiting administrative review.", "targetPanel", "my-properties", "filter", "PENDING_APPROVAL"));
        }
        if (pendingVerifications > 0) {
            notifications.add(Map.of("type", "warning", "title", "Owner & Builder Verifications", "count", pendingVerifications,
                    "message", pendingVerifications + " account verification application(s) awaiting approval.", "targetPanel", "verifications", "filter", "PENDING"));
        }
        if (openReports > 0) {
            notifications.add(Map.of("type", "danger", "title", "Open Reports & Complaints", "count", openReports,
                    "message", openReports + " consumer report(s) flagged for misleading content or abuse.", "targetPanel", "reports", "filter", "OPEN"));
        }
        if (newEnquiries > 0) {
            notifications.add(Map.of("type", "info", "title", "New Customer Inquiries", "count", newEnquiries,
                    "message", newEnquiries + " unanswered customer enquiry(s) across properties.", "targetPanel", "enquiries", "filter", "NEW"));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("counts", realCounts);
        response.put("recentActivity", recentActivity);
        response.put("notifications", notifications);
        response.put("timestamp", LocalDateTime.now());
        return response;
    }

    @GetMapping("/admin/inventory")
    public List<Map<String, Object>> adminInventory(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String purpose,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String query,
            HttpSession session) {
        access.admin(session);
        Map<Long, PropertyCustomer> customerMap = new HashMap<>();
        customers.findAll().forEach(c -> customerMap.put(c.getId(), c));
        Map<Long, PropertyProject> projectMap = new HashMap<>();
        projects.findAll().forEach(p -> projectMap.put(p.getId(), p));

        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String s = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        String p = purpose == null ? "" : purpose.trim().toUpperCase(Locale.ROOT);
        String c = city == null ? "" : city.trim().toLowerCase(Locale.ROOT);

        return listings.findAll().stream()
                .filter(l -> {
                    if (!s.isBlank() && !"ALL".equals(s)) {
                        if ("PENDING_APPROVAL".equals(s)) {
                            if (!("PENDING_APPROVAL".equalsIgnoreCase(l.getStatus()) || "PENDING".equalsIgnoreCase(l.getVerificationStatus()) || "ADMIN_REVIEW".equalsIgnoreCase(l.getVerificationStatus()))) return false;
                        } else if ("ACTIVE".equals(s)) {
                            if (!("ACTIVE".equalsIgnoreCase(l.getStatus()) && "APPROVED".equalsIgnoreCase(l.getVerificationStatus()))) return false;
                        } else if (!s.equalsIgnoreCase(l.getStatus()) && !s.equalsIgnoreCase(l.getVerificationStatus())) {
                            return false;
                        }
                    }
                    if (!p.isBlank() && !"ALL".equals(p) && !p.equalsIgnoreCase(l.getListingType())) return false;
                    if (!c.isBlank() && !"ALL".equals(c) && (l.getCity() == null || !l.getCity().toLowerCase(Locale.ROOT).contains(c))) return false;
                    if (!q.isBlank()) {
                        String full = (l.getTitle() + " " + (l.getAddress() == null ? "" : l.getAddress()) + " " + (l.getLocality() == null ? "" : l.getLocality()) + " " + (l.getCity() == null ? "" : l.getCity()) + " " + (l.getApartmentCode() == null ? "" : l.getApartmentCode())).toLowerCase(Locale.ROOT);
                        if (!full.contains(q)) return false;
                    }
                    return true;
                })
                .sorted(Comparator.comparing(PropertyListing::getId).reversed())
                .map(l -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", l.getId());
                    item.put("apartmentCode", l.getApartmentCode());
                    item.put("title", l.getTitle());
                    item.put("listingType", l.getListingType());
                    item.put("propertyType", l.getPropertyType());
                    item.put("status", l.getStatus());
                    item.put("verificationStatus", l.getVerificationStatus());
                    item.put("reviewNote", l.getReviewNote());
                    item.put("rejectionReason", l.getRejectionReason());
                    item.put("price", l.getPrice());
                    item.put("deposit", l.getDeposit());
                    item.put("maintenance", l.getMaintenance());
                    item.put("city", l.getCity());
                    item.put("locality", l.getLocality());
                    item.put("address", l.getAddress());
                    item.put("bhk", l.getBhk());
                    item.put("bathrooms", l.getBathrooms());
                    item.put("areaSqft", l.getAreaSqft());
                    item.put("floorNumber", l.getFloor());
                    item.put("totalFloors", l.getTotalFloors());
                    item.put("furnishing", l.getFurnishing());
                    item.put("parking", l.getParking());
                    item.put("amenities", l.getAmenities());
                    item.put("featured", l.isFeatured());
                    item.put("createdAt", l.getCreatedAt());
                    item.put("updatedAt", l.getUpdatedAt());
                    item.put("projectId", l.getProjectId());
                    item.put("tower", l.getTower());
                    item.put("unitNumber", l.getUnitNumber());
                    
                    PropertyCustomer owner = customerMap.get(l.getCustomerId());
                    item.put("ownerId", l.getCustomerId());
                    item.put("ownerName", owner == null ? "Unknown Owner" : owner.getName());
                    item.put("ownerEmail", owner == null ? "" : owner.getEmail());
                    item.put("ownerPhone", owner == null ? "" : owner.getPhone());
                    item.put("ownerRole", owner == null ? "OWNER" : owner.getRole());

                    if (l.getProjectId() != null && projectMap.containsKey(l.getProjectId())) {
                        PropertyProject proj = projectMap.get(l.getProjectId());
                        item.put("projectName", proj.getName());
                        item.put("reraNumber", proj.getReraNumber());
                    }

                    List<String> photos = l.getImageUrls() == null ? List.of() : l.getImageUrls().lines().filter(u -> !u.isBlank()).toList();
                    item.put("photoCount", photos.size());
                    item.put("primaryPhoto", photos.isEmpty() ? null : photos.get(0));
                    return item;
                }).toList();
    }

    @GetMapping("/admin/metadata")
    public Map<String, Object> adminMetadata(HttpSession session) {
        access.admin(session);
        List<PropertyListing> allListings = listings.findAll();

        Map<String, Long> categoryCounts = new LinkedHashMap<>();
        List<String> defaultCategories = List.of("Apartment", "Independent House / Villa", "Plot / Land", "Commercial", "Penthouse", "Studio");
        defaultCategories.forEach(cat -> {
            long count = allListings.stream().filter(l -> cat.equalsIgnoreCase(l.getPropertyType())).count();
            categoryCounts.put(cat, count);
        });

        List<String> standardAmenities = List.of(
            "Swimming Pool", "Gym / Fitness Centre", "Club House", "24/7 Security", "Power Backup",
            "Children's Play Area", "Reserved Parking", "Rainwater Harvesting", "EV Charging Station",
            "Intercom Facility", "Fire Fighting System", "Jogging Track", "Park / Garden"
        );
        Map<String, Long> amenityCounts = new LinkedHashMap<>();
        standardAmenities.forEach(am -> {
            long count = allListings.stream().filter(l -> l.getAmenities() != null && l.getAmenities().toLowerCase(Locale.ROOT).contains(am.toLowerCase(Locale.ROOT))).count();
            amenityCounts.put(am, count);
        });

        List<String> defaultCities = List.of("Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad");
        Map<String, Long> cityCounts = new LinkedHashMap<>();
        defaultCities.forEach(city -> {
            long count = allListings.stream().filter(l -> l.getCity() != null && l.getCity().toLowerCase(Locale.ROOT).contains(city.toLowerCase(Locale.ROOT))).count();
            cityCounts.put(city, count);
        });

        List<PropertyListing> featured = allListings.stream().filter(PropertyListing::isFeatured).toList();

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("categories", categoryCounts);
        meta.put("amenities", amenityCounts);
        meta.put("locations", cityCounts);
        meta.put("featuredListings", featured.stream().map(l -> {
            Map<String, Object> fMap = new LinkedHashMap<>();
            fMap.put("id", l.getId());
            fMap.put("title", l.getTitle());
            fMap.put("city", l.getCity() == null ? "" : l.getCity());
            fMap.put("price", l.getPrice());
            fMap.put("status", l.getStatus());
            fMap.put("featured", l.isFeatured());
            return fMap;
        }).toList());
        return meta;
    }

    @PostMapping("/admin/metadata/action")
    public Map<String, Object> updateMetadataAction(
            @RequestParam String type,
            @RequestParam String name,
            @RequestParam(defaultValue = "ADD") String operation,
            HttpSession session) {
        access.admin(session);
        event(session, "METADATA_" + upper(operation), upper(type), 0L, name);
        return Map.of("status", "SUCCESS", "message", type + " '" + name + "' updated successfully");
    }

    @PatchMapping("/reports/{id}/dismiss")
    public PropertyReport dismissReport(@PathVariable Long id, @Valid @RequestBody ReplyRequest request, HttpSession session) {
        access.admin(session);
        PropertyReport r = reports.findById(id).orElseThrow(() -> missing("Report"));
        r.setResolution(request.reply());
        r.setStatus("DISMISSED");
        event(session, "REPORT_DISMISSED", "REPORT", id, request.reply());
        return reports.save(r);
    }

    @GetMapping("/audit")
    public List<PropertyAuditEvent> audit(
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String search,
            HttpSession session) {
        access.admin(session);
        List<PropertyAuditEvent> all = audit.findAllByOrderByCreatedAtDesc();
        return all.stream().filter(e -> {
            if (targetType != null && !targetType.isBlank() && !"ALL".equalsIgnoreCase(targetType) && !targetType.equalsIgnoreCase(e.getTargetType())) {
                return false;
            }
            if (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action) && !e.getAction().toUpperCase(Locale.ROOT).contains(action.toUpperCase(Locale.ROOT))) {
                return false;
            }
            if (search != null && !search.isBlank()) {
                String s = search.toLowerCase(Locale.ROOT);
                boolean match = (e.getActor() != null && e.getActor().toLowerCase(Locale.ROOT).contains(s)) ||
                                (e.getDetail() != null && e.getDetail().toLowerCase(Locale.ROOT).contains(s)) ||
                                (String.valueOf(e.getTargetId()).contains(s));
                if (!match) return false;
            }
            return true;
        }).limit(200).toList();
    }



    private PropertyListing editableListing(Long id,HttpSession session) {

        PropertyListing l=listings.findById(id).orElseThrow(() -> missing("Listing"));

        if (!access.isAdmin(session) && !Objects.equals(access.seller(session).getId(),l.getCustomerId()))

            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You can manage only your own properties");

        return l;

    }



    private Long postingOwner(Long requested,HttpSession session) {
        if (access.isAdmin(session)) {
            require(requested!=null,"Select the actual verified owner or builder for this listing");
            PropertyCustomer c=customers.findById(requested).orElseThrow(() -> missing("Owner"));
            if (!c.isPostingVerified()) {
                c.setPostingVerified(true);
                customers.save(c);
            }
            return c.getId();
        }

        Long own=access.seller(session).getId();

        require(requested==null || requested.equals(own), "You cannot post on behalf of another account"); return own;

    }



    private PropertyCustomer verifiedOwner(Long id) {

        PropertyCustomer c=customers.findById(id).orElseThrow(() -> missing("Owner"));

        require(c.isActive() && "ACTIVE".equals(c.getStatus()) && c.isPostingVerified() &&

                Set.of("OWNER","BUILDER").contains(PropertyAccessService.role(c.getRole())), "The owner or builder must have approved posting access");

        return c;

    }



    private void assignUnit(PropertyListing listing,Long projectId,String tower,String unit,Long ownerId) {

        if (projectId==null) { listing.setProjectId(null); listing.setTower(null); listing.setUnitNumber(null); return; }

        PropertyProject p=projects.findById(projectId).orElseThrow(() -> missing("Project"));

        require(Objects.equals(p.getBuilderId(),ownerId), "Choose a project belonging to this builder");

        require(!blank(tower) && !blank(unit), "Tower and unit number are required for a project unit");

        String normalizedTower=upper(tower), normalizedUnit=upper(unit);

        require(listings.findAll().stream().noneMatch(l -> !Objects.equals(l.getId(),listing.getId()) && Objects.equals(projectId,l.getProjectId()) &&

                normalizedTower.equals(l.getTower()) && normalizedUnit.equals(l.getUnitNumber())), "That project unit already has a listing");

        listing.setProjectId(projectId); listing.setTower(normalizedTower); listing.setUnitNumber(normalizedUnit);

    }



    private void checkDuplicateSubmission(Long listingId, Long ownerId, PropertyApiController.ListingRequest r, String unitNumber, Long projectId) {
        if (ownerId == null || r == null) return;
        String address = upper(r.address());
        String society = upper(r.society());
        String city = upper(r.city());
        String bhk = upper(r.bhk());
        String unit = upper(unitNumber);

        List<PropertyListing> existingListings = listings.findByCustomerIdOrderByCreatedAtDesc(ownerId);
        for (PropertyListing existing : existingListings) {
            if (Objects.equals(existing.getId(), listingId)) continue;
            String existingStatus = upper(existing.getStatus());
            if (Set.of("INACTIVE", "SOLD", "RENTED", "REJECTED").contains(existingStatus)) continue;

            if (projectId != null && existing.getProjectId() != null && Objects.equals(projectId, existing.getProjectId())) {
                if (!unit.isBlank() && unit.equalsIgnoreCase(existing.getUnitNumber())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Unit " + unit + " in this project is already listed (Listing #" + existing.getId() + "). Duplicate submissions are not allowed.");
                }
            }

            if (!address.isBlank() && address.equalsIgnoreCase(existing.getAddress()) && city.equalsIgnoreCase(existing.getCity())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "A listing at this address already exists in your active inventory (Listing #" + existing.getId() + "). Duplicate submissions are not allowed.");
            }

            if (!society.isBlank() && society.equalsIgnoreCase(existing.getSociety()) && city.equalsIgnoreCase(existing.getCity())) {
                if (!unit.isBlank() && unit.equalsIgnoreCase(existing.getUnitNumber())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Unit " + unit + " in " + r.society() + " already exists in your active inventory (Listing #" + existing.getId() + "). Duplicate submissions are not allowed.");
                }
                if (!bhk.isBlank() && bhk.equalsIgnoreCase(existing.getBhk()) && r.propertyType() != null && r.propertyType().equalsIgnoreCase(existing.getPropertyType())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "A " + r.bhk() + " listing in " + r.society() + " already exists in your active inventory (Listing #" + existing.getId() + "). Duplicate submissions are not allowed.");
                }
            }
        }
    }

    private String detectMaterialChanges(PropertyListing l, PropertyApiController.ListingRequest r, ListingSubmission request) {
        List<String> changes = new ArrayList<>();
        if (l.getPrice() == null || r.price() == null || l.getPrice().compareTo(r.price()) != 0) {
            changes.add("Price changed from " + l.getPrice() + " to " + r.price());
        }
        if (l.getDeposit() != null && r.deposit() != null && l.getDeposit().compareTo(r.deposit()) != 0) {
            changes.add("Deposit changed from " + l.getDeposit() + " to " + r.deposit());
        }
        if (l.getMaintenance() != null && r.maintenance() != null && l.getMaintenance().compareTo(r.maintenance()) != 0) {
            changes.add("Maintenance changed from " + l.getMaintenance() + " to " + r.maintenance());
        }
        if (!Objects.equals(l.getAreaSqft(), r.areaSqft())) {
            changes.add("Area changed from " + l.getAreaSqft() + " to " + r.areaSqft() + " sqft");
        }
        if (!Objects.equals(upper(l.getBhk()), upper(r.bhk()))) {
            changes.add("BHK changed from " + l.getBhk() + " to " + r.bhk());
        }
        if (!Objects.equals(upper(l.getPropertyType()), upper(r.propertyType()))) {
            changes.add("Property type changed to " + r.propertyType());
        }
        if (!Objects.equals(upper(l.getListingType()), upper(r.type()))) {
            changes.add("Listing purpose changed to " + r.type());
        }
        if (!Objects.equals(upper(l.getAddress()), upper(r.address()))) {
            changes.add("Address modified");
        }
        if (!Objects.equals(upper(l.getSociety()), upper(r.society()))) {
            changes.add("Society modified");
        }
        if (!Objects.equals(upper(l.getCity()), upper(r.city()))) {
            changes.add("City modified");
        }
        if (!Objects.equals(upper(l.getPincode()), upper(r.pincode()))) {
            changes.add("Pincode modified");
        }
        if (!Objects.equals(l.getProjectId(), request.projectId()) || !Objects.equals(upper(l.getUnitNumber()), upper(request.unitNumber()))) {
            changes.add("Project/Unit assignment changed");
        }
        return String.join("; ", changes);
    }

    private PropertyApiController.ListingRequest toListingRequest(PropertyListing l) {
        return new PropertyApiController.ListingRequest(
                l.getTitle(), l.getDescription(), l.getSociety(), l.getLocality(), l.getAddress(),
                l.getCity(), l.getPincode(), l.getListingType(), l.getPropertyType(), l.getPrice(),
                l.getDeposit(), l.getMaintenance(), l.getAreaSqft(), l.getBhk(), l.getBathrooms(),
                l.getFurnishing(), l.getParking(), l.getAvailableFrom(), l.getLatitude(), l.getLongitude(),
                l.getAmenities(), l.getImageUrl(), l.getNotes(),
                l.getFloor(), l.getTotalFloors(), l.getPropertyAge(), l.getConstructionStatus(),
                l.getApplicableFees(), l.getVideoUrl(), l.getAvailabilityStatus(),
                l.getOwnershipDocUrl(), l.getVerificationDocuments(), l.getReraNumber(), l.getPrivateVerificationNotes()
        );
    }
    private Map<String,Object> accountView(PropertyCustomer c) {

        Map<String,Object> m=new LinkedHashMap<>();

        m.put("id", c.getId());

        m.put("name", c.getName());

        m.put("phone", c.getPhone());

        m.put("email", c.getEmail());

        m.put("username", c.getUsername());

        m.put("role", PropertyAccessService.role(c.getRole()));

        m.put("status", c.getStatus());

        m.put("active", c.isActive());

        m.put("postingVerified", c.isPostingVerified());

        m.put("registeredAt", c.getCreatedAt() != null ? c.getCreatedAt().toString() : "");
        m.put("preferredCity", c.getPreferredCity());
        m.put("preferredLocality", c.getPreferredLocality());
        m.put("preferredListingType", c.getPreferredListingType());
        m.put("preferredPropertyType", c.getPreferredPropertyType());
        m.put("preferredBhk", c.getPreferredBhk());
        m.put("budgetMin", c.getBudgetMin());
        m.put("budgetMax", c.getBudgetMax());
        m.put("emailAlertsEnabled", c.isEmailAlertsEnabled());

        applications.findByCustomerId(c.getId()).ifPresent(a -> {

            m.put("applicationId", a.getId());

            m.put("requestedRole", a.getRequestedRole());

            m.put("companyName", a.getCompanyName());

            m.put("registrationNumber", a.getRegistrationNumber());

            m.put("verificationDetails", a.getVerificationDetails());

            m.put("applicationDecision", a.getDecision());

            m.put("reviewNote", a.getReviewNote());

        });

        return m;

    }

    private void event(HttpSession session,String action,String type,Long id,String detail) {

        PropertyAuditEvent e=new PropertyAuditEvent(); e.setTenantId("propertydirect"); e.setActor(access.actor(session));

        e.setAction(action); e.setTargetType(type); e.setTargetId(id); e.setDetail(detail); audit.save(e);

    }

    private void validate(Object request) {

        require(request!=null,"Request details are required"); var errors=validator.validate(request);

        if (!errors.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,errors.iterator().next().getMessage());

    }

    private static void require(boolean valid,String message) {if(!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}

    private static ResponseStatusException missing(String what) {return new ResponseStatusException(HttpStatus.NOT_FOUND,what+" was not found");}

    private static boolean blank(String s) {return s==null || s.isBlank();}

    private static String upper(String s) {return s==null?"":s.trim().toUpperCase(Locale.ROOT);}



    public record ProfileRequest(@NotBlank @Size(max=120) String name,@NotBlank @Pattern(regexp="^[0-9+() -]{7,20}$") String phone, String preferredCity, String preferredLocality, String preferredListingType, String preferredPropertyType, String preferredBhk, java.math.BigDecimal budgetMin, java.math.BigDecimal budgetMax, Boolean emailAlertsEnabled) {
        public ProfileRequest(String name, String phone) {
            this(name, phone, null, null, null, null, null, null, null, null);
        }
    }

    public record ApplicationRequest(@NotBlank String role,@Size(max=160) String companyName,@Size(max=160) String registrationNumber,

            @NotBlank @Size(min=20,max=2000) String verificationDetails) {}

    public record DecisionRequest(@NotBlank String decision,@Size(max=2000) String note) {}

    public record AccountStatusRequest(@NotBlank String status,@NotBlank @Size(max=2000) String note) {}

    public record AccountUpdateRequest(String name, String email, String phone, String role, String status, Boolean postingVerified, String note) {}

    public record ListingSubmission(@NotNull @Valid PropertyApiController.ListingRequest listing,Long ownerId,Long projectId,

            @Size(max=80) String tower,@Size(max=80) String unitNumber,@NotBlank @Pattern(regexp="DRAFT|SUBMIT") String intent) {}

    public record ProjectRequest(Long builderId,@NotBlank @Size(max=160) String name,@NotBlank @Size(max=120) String city,
            @NotBlank @Size(max=160) String registrationNumber,@NotBlank @Size(max=80) String constructionStatus,@Size(max=2000) String description,
            String locality, String reraNumber, Integer totalTowers, Integer totalUnits, java.time.LocalDate possessionDate) {
        public ProjectRequest(Long builderId, String name, String city, String registrationNumber, String constructionStatus, String description) {
            this(builderId, name, city, registrationNumber, constructionStatus, description, null, null, null, null, null);
        }
    }

    public record ReplyRequest(@NotBlank @Size(max=2000) String reply) {}

    public record VisitUpdate(@NotBlank String status,LocalDateTime scheduledAt) {}

    public record ReportRequest(@NotNull Long listingId,@NotBlank @Size(min=10,max=2000) String reason) {}

    static class InMemoryMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final byte[] bytes;
        InMemoryMultipartFile(String name, String originalFilename, String contentType, byte[] bytes) {
            this.name = name; this.originalFilename = originalFilename; this.contentType = contentType; this.bytes = bytes;
        }
        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return bytes == null || bytes.length == 0; }
        @Override public long getSize() { return bytes.length; }
        @Override public byte[] getBytes() { return bytes; }
        @Override public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(bytes); }
        @Override public void transferTo(java.io.File dest) throws java.io.IOException { java.nio.file.Files.write(dest.toPath(), bytes); }
    }

}

