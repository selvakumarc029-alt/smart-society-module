package com.smartapartment.repository;import com.smartapartment.entity.PropertyVisit;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyVisitRepository extends JpaRepository<PropertyVisit,Long>{
    List<PropertyVisit> findByCustomerIdOrderByScheduledAtDesc(Long c);
    Optional<PropertyVisit> findByIdAndCustomerId(Long id,Long c);
    List<PropertyVisit> findByListingOwnerIdOrderByScheduledAtDesc(Long ownerId);
    Optional<PropertyVisit> findByIdAndListingOwnerId(Long id,Long ownerId);
}
