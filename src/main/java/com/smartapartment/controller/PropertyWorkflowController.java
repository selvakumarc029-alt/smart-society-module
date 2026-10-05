package com.smartapartment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.PropertyListing;
import com.smartapartment.entity.PropertyCustomer;
import com.smartapartment.repository.PropertyCustomerRepository;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class PropertyWorkflowController {
    private final PropertyApiController properties;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final PropertyCustomerRepository customers;

    public PropertyWorkflowController(PropertyApiController properties, ObjectMapper objectMapper, Validator validator, PropertyCustomerRepository customers) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.customers = customers;
    }

    @PostMapping(value = "/properties", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public PropertyListing create(
            @RequestPart("property") String propertyJson,
            @RequestPart("images") List<MultipartFile> images,
            HttpSession session) throws Exception {
        PropertyApiController.ListingRequest request = objectMapper.readValue(propertyJson, PropertyApiController.ListingRequest.class);
        var violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, violations.iterator().next().getMessage());
        }
        return properties.createApi(request, images, session);
    }

    @GetMapping("/properties/public")
    public PropertyPage publicListings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Integer bedrooms) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be at least 0 and size must be between 1 and 100");
        }
        List<PropertyListing> filtered = properties.listings(city, null, null, null, minPrice, maxPrice, null, "newest")
                .stream()
                .filter(item -> blank(keyword) || searchable(item).contains(keyword.trim().toLowerCase(Locale.ROOT)))
                .filter(item -> bedrooms == null || String.valueOf(item.getBhk()).startsWith(String.valueOf(bedrooms)))
                .toList();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil((double) filtered.size() / size);
        return new PropertyPage(filtered.subList(from, to), page, size, filtered.size(), totalPages, page + 1 < totalPages);
    }

    @GetMapping("/properties/my-listings")
    public List<PropertyListing> myListings(HttpSession session) {
        return properties.mine(session);
    }

    @PatchMapping("/properties/{id}/resubmit")
    public PropertyListing resubmit(@PathVariable Long id, @Valid @RequestBody PropertyApiController.ListingRequest request,
                                    HttpSession session) {
        return properties.resubmitApi(id, request, session);
    }

    @GetMapping("/admin/properties/pending")
    public List<AdminPropertyView> pending(HttpSession session) {
        return properties.adminListings("PENDING", session).stream().map(this::adminView).toList();
    }

    @PatchMapping("/admin/properties/{id}/status")
    public PropertyListing updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody PropertyStatusRequest request,
            HttpSession session) {
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!status.equals("APPROVED") && !status.equals("REJECTED") && !status.equals("CHANGES_REQUESTED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be APPROVED, REJECTED or CHANGES_REQUESTED");
        }
        if (!status.equals("APPROVED") && blank(request.rejectionReason())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason is required when rejecting or requesting changes");
        }
        return properties.verify(id,
                new PropertyApiController.ModerationRequest(status, request.rejectionReason(), "PropertyDirect Super Admin"),
                session);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String searchable(PropertyListing item) {
        return String.join(" ", text(item.getTitle()), text(item.getDescription()), text(item.getSociety()),
                text(item.getLocality()), text(item.getAddress()), text(item.getCity()), text(item.getPincode()))
                .toLowerCase(Locale.ROOT);
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }

    private AdminPropertyView adminView(PropertyListing item) {
        PropertyCustomer owner = item.getCustomerId() == null ? null : customers.findById(item.getCustomerId()).orElse(null);
        List<String> images = item.getImageUrls() == null ? List.of() : item.getImageUrls().lines().filter(url -> !url.isBlank()).toList();
        return new AdminPropertyView(item.getId(), item.getApartmentCode(), item.getTitle(), owner == null ? "Unknown owner" : owner.getName(),
                owner == null ? "" : owner.getEmail(), item.getPrice(), item.getDeposit(), item.getMaintenance(),
                item.getPropertyType(), item.getBhk(), item.getBathrooms(), item.getAreaSqft(), item.getFurnishing(), item.getParking(),
                item.getAddress(), item.getLocality(), item.getCity(), item.getPincode(), item.getLatitude(),
                item.getLongitude(), item.getDescription(), item.getAmenities(), item.getAvailableFrom(),
                item.getCreatedAt(), item.getVerificationStatus(), images);
    }

    public record PropertyPage(List<PropertyListing> content, int page, int size, long totalElements,
                               int totalPages, boolean hasNext) {}

    public record PropertyStatusRequest(
            @NotBlank String status,
            @Size(max = 2000) String rejectionReason) {}

    public record AdminPropertyView(Long id, String apartmentCode, String title, String ownerName, String ownerEmail,
            BigDecimal price, BigDecimal deposit, BigDecimal maintenance, String propertyType,
            String bedrooms, Integer bathrooms, Integer areaSqFt, String furnishing, String parking, String address,
            String locality, String city, String postalCode, Double latitude, Double longitude,
            String description, String amenities, java.time.LocalDate availableFrom,
            java.time.LocalDateTime submittedAt, String status, List<String> images) {}
}
