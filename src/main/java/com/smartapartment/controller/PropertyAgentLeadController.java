package com.smartapartment.controller;

import com.smartapartment.entity.PropertyEnquiry;
import com.smartapartment.entity.PropertyListing;
import com.smartapartment.repository.PropertyEnquiryRepository;
import com.smartapartment.repository.PropertyListingRepository;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/property/agent/leads")
public class PropertyAgentLeadController {
    private final PropertyListingRepository listings;
    private final PropertyEnquiryRepository enquiries;

    public PropertyAgentLeadController(PropertyListingRepository listings, PropertyEnquiryRepository enquiries) {
        this.listings = listings;
        this.enquiries = enquiries;
    }

    @GetMapping
    public List<LeadView> list(HttpSession session) {
        long agentId = requireAgent(session);
        var ownedListings = listings.findByCustomerIdOrderByCreatedAtDesc(agentId);
        var listingById = ownedListings.stream().collect(java.util.stream.Collectors.toMap(
                PropertyListing::getId, listing -> listing, (first, ignored) -> first));

        return enquiries.findAll().stream()
                .filter(enquiry -> listingById.containsKey(enquiry.getListingId()))
                .sorted(Comparator.comparing(PropertyEnquiry::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(enquiry -> toView(enquiry, listingById.get(enquiry.getListingId())))
                .toList();
    }

    @PostMapping
    @Transactional
    public LeadView create(@Valid @RequestBody CreateLeadRequest request, HttpSession session) {
        long agentId = requireAgent(session);
        PropertyListing listing = listings.findByIdAndCustomerId(request.listingId(), agentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Choose one of your own property listings for this lead"));

        PropertyEnquiry enquiry = new PropertyEnquiry();
        enquiry.setTenantId("propertydirect");
        enquiry.setCustomerId(agentId);
        enquiry.setListingId(listing.getId());
        enquiry.setName(request.name().trim());
        enquiry.setPhone(request.phone().trim());
        enquiry.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        enquiry.setEnquiryType(request.type().trim().toUpperCase(Locale.ROOT));
        enquiry.setMessage(request.message() == null ? "" : request.message().trim());
        return toView(enquiries.save(enquiry), listing);
    }

    private static long requireAgent(HttpSession session) {
        if (!Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:agent"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PropertyDirect agent login is required");
        }
        Object id = session.getAttribute("propertydirect:customerId");
        if (id instanceof Long agentId) return agentId;
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "PropertyDirect agent account is unavailable");
    }

    private static LeadView toView(PropertyEnquiry enquiry, PropertyListing listing) {
        String location = java.util.stream.Stream.of(listing.getLocality(), listing.getCity())
                .filter(value -> value != null && !value.isBlank())
                .collect(java.util.stream.Collectors.joining(", "));
        return new LeadView(enquiry.getId(), "#LD-" + enquiry.getId(), enquiry.getName(), enquiry.getPhone(),
                enquiry.getEmail(), listing.getId(), listing.getTitle(), location, enquiry.getEnquiryType(),
                enquiry.getMessage(), enquiry.getCreatedAt(), "New Lead");
    }

    public record CreateLeadRequest(
            @NotNull Long listingId,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 40) String phone,
            @Email @NotBlank @Size(max = 160) String email,
            @NotBlank @Size(max = 40) String type,
            @Size(max = 2000) String message) {}

    public record LeadView(Long id, String leadRef, String name, String phone, String email, Long listingId,
            String propertyTitle, String propertyLocation, String enquiryType, String message,
            LocalDateTime createdAt, String status) {}
}
