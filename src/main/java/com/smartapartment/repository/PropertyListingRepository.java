package com.smartapartment.repository;

import com.smartapartment.entity.PropertyListing;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PropertyListingRepository extends JpaRepository<PropertyListing, Long> {
    List<PropertyListing> findByStatusOrderByCreatedAtDesc(String s);
    List<PropertyListing> findByStatusAndVerificationStatusOrderByCreatedAtDesc(String s, String v);
    List<PropertyListing> findByStatusAndVerificationStatusInOrderByCreatedAtDesc(String s, Collection<String> v);
    List<PropertyListing> findByVerificationStatusOrderByCreatedAtDesc(String v);

    @Query("SELECT p FROM PropertyListing p WHERE p.ownerId = :c ORDER BY p.createdAt DESC")
    List<PropertyListing> findByCustomerIdOrderByCreatedAtDesc(@Param("c") Long c);

    @Query("SELECT p FROM PropertyListing p WHERE p.id = :i AND p.ownerId = :c")
    Optional<PropertyListing> findByIdAndCustomerId(@Param("i") Long i, @Param("c") Long c);

    List<PropertyListing> findByProjectId(Long projectId);
    List<PropertyListing> findByProjectIdOrderByCreatedAtDesc(Long projectId);
}
