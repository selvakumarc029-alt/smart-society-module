package com.smartapartment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "properties", uniqueConstraints = @UniqueConstraint(name="uq_property_project_unit", columnNames={"project_id", "tower", "unit_number"}))
public class PropertyListing extends BaseEntity {
    /** Stable, read-only public reference; existing records receive the same format. */
    @jakarta.persistence.Transient
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getApartmentCode() {
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "PDT-%04d", getId());
    }

    // 1. Primary Key inherited from BaseEntity: id
    
    // 2-3. Title & Description
    private String title;
    @Column(length = 4000) private String description;
    
    // 4-5. Categorization
    @Column(name = "property_type") private String propertyType = "APARTMENT";
    @Column(name = "listing_type") private String listingType = "RENT";
    
    // 6-9. Financials & Core Dimensions
    private BigDecimal price;
    private Integer bedrooms = 2;
    private Integer bathrooms = 2;
    private Integer area = 1200; // sqft
    
    // 10-12. Detailed Area Specs
    @Column(name = "carpet_area") private Integer carpetArea;
    @Column(name = "built_up_area") private Integer builtUpArea;
    @Column(name = "plot_area") private Integer plotArea;
    
    // 13-18. Structure & Condition
    private Integer floor;
    @Column(name = "total_floors") private Integer totalFloors;
    private String facing;
    private String furnishing;
    @Column(name = "construction_status") private String constructionStatus = "Ready to Move";
    @Column(name = "property_age") private String propertyAge = "1-3 Years";
    
    // 19-24. Location Hierarchy
    @Column(length = 1000) private String address;
    private String city;
    private String state;
    private String pincode;
    private Double latitude;
    private Double longitude;
    
    // 25-26. Ownership & Agent Links
    @Column(name = "owner_id") private Long ownerId;
    @Column(name = "submitted_by") private String submittedBy;
    @Column(name = "submitted_by_id") private Long submittedById;
    @Column(name = "submitter_role") private String submitterRole;
    @Column(name = "agent_id") private Long agentId;
    @Column(name = "project_id") private Long projectId;
    @Column(name = "tower") private String tower;
    @Column(name = "unit_number") private String unitNumber;
    @Column(nullable=false,columnDefinition="boolean default false") private boolean featured=false;
    
    // 27-28. Statuses
    private String status = "PUBLISHED"; // Pending, Published, Rejected, Suspended, Sold, Rented, Expired
    @Column(name = "verification_status") private String verificationStatus = "VERIFIED"; // Pending, Verified, Rejected
    
    // Additional fields for application rendering
    private String society;
    private String locality;
    private BigDecimal deposit;
    private BigDecimal maintenance;
    @Column(name = "applicable_fees") private BigDecimal applicableFees;
    private String bhk;
    private String parking;
    private LocalDate availableFrom;
    @Column(name = "availability_status") private String availabilityStatus = "AVAILABLE"; // AVAILABLE, UNDER_OFFER, SOLD, RENTED
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(length = 2000) private String reviewNote;
    @Column(length = 2000) private String rejectionReason;
    private long viewCount;
    private String imageUrl;
    @Lob @Column(columnDefinition = "CLOB") private String imageUrls;
    @Column(name = "video_url", length = 1000) private String videoUrl;
    @Column(length = 2000) String amenities;
    @Column(length = 2000) String notes;
    
    // Private verification documents and internal verification notes (separated from public display)
    @Column(name = "ownership_doc_url", length = 1000) private String ownershipDocUrl;
    @Lob @Column(name = "verification_documents", columnDefinition = "CLOB") private String verificationDocuments;
    @Column(name = "rera_number") private String reraNumber;
    @Column(name = "private_verification_notes", length = 2000) private String privateVerificationNotes;

    public Integer getAreaSqft() { return area; }
    public void setAreaSqft(Integer areaSqft) { this.area = areaSqft; }
    public Long getCustomerId() { return ownerId; }
    public void setCustomerId(Long customerId) { this.ownerId = customerId; }
    public void setOwner(PropertyCustomer customer) { if (customer != null) this.ownerId = customer.getId(); }

    /** Returns a clean public view copy of the listing that excludes private verification documents and admin notes */
    public PropertyListing sanitizeForPublic() {
        PropertyListing copy = new PropertyListing();
        copy.setId(getId());
        copy.setCreatedAt(getCreatedAt());
        copy.setUpdatedAt(getUpdatedAt());
        copy.setTitle(getTitle());
        copy.setDescription(getDescription());
        copy.setPropertyType(getPropertyType());
        copy.setListingType(getListingType());
        copy.setPrice(getPrice());
        copy.setBedrooms(getBedrooms());
        copy.setBathrooms(getBathrooms());
        copy.setArea(getArea());
        copy.setCarpetArea(getCarpetArea());
        copy.setBuiltUpArea(getBuiltUpArea());
        copy.setPlotArea(getPlotArea());
        copy.setFloor(getFloor());
        copy.setTotalFloors(getTotalFloors());
        copy.setFacing(getFacing());
        copy.setFurnishing(getFurnishing());
        copy.setConstructionStatus(getConstructionStatus());
        copy.setPropertyAge(getPropertyAge());
        copy.setAddress(getAddress());
        copy.setCity(getCity());
        copy.setState(getState());
        copy.setPincode(getPincode());
        copy.setLatitude(getLatitude());
        copy.setLongitude(getLongitude());
        copy.setProjectId(getProjectId());
        copy.setTower(getTower());
        copy.setUnitNumber(getUnitNumber());
        copy.setFeatured(isFeatured());
        copy.setStatus(getStatus());
        copy.setVerificationStatus(getVerificationStatus());
        copy.setSociety(getSociety());
        copy.setLocality(getLocality());
        copy.setDeposit(getDeposit());
        copy.setMaintenance(getMaintenance());
        copy.setApplicableFees(getApplicableFees());
        copy.setBhk(getBhk());
        copy.setParking(getParking());
        copy.setAvailableFrom(getAvailableFrom());
        copy.setAvailabilityStatus(getAvailabilityStatus());
        copy.setImageUrl(getImageUrl());
        copy.setImageUrls(getImageUrls());
        copy.setVideoUrl(getVideoUrl());
        copy.setAmenities(getAmenities());
        copy.setViewCount(getViewCount());
        copy.setOwnerId(getOwnerId());
        copy.setReraNumber(getReraNumber());

        // Explicitly NULL OUT private verification documents and private review notes for public safety
        copy.setOwnershipDocUrl(null);
        copy.setVerificationDocuments(null);
        copy.setPrivateVerificationNotes(null);
        copy.setNotes(null);
        copy.setReviewNote(null);
        copy.setRejectionReason(null);
        copy.setReviewedBy(null);
        return copy;
    }
}
