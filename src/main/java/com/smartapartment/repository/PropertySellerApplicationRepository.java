package com.smartapartment.repository;
import com.smartapartment.entity.PropertySellerApplication;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertySellerApplicationRepository extends JpaRepository<PropertySellerApplication, Long> {
    Optional<PropertySellerApplication> findByCustomerId(Long customerId);
    List<PropertySellerApplication> findAllByOrderByCreatedAtDesc();
}
