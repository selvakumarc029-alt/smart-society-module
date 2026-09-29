package com.smartapartment.repository;
import com.smartapartment.entity.PropertyReport;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyReportRepository extends JpaRepository<PropertyReport, Long> {
    List<PropertyReport> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    List<PropertyReport> findByListingIdOrderByCreatedAtDesc(Long listingId);
    List<PropertyReport> findByStatusOrderByCreatedAtDesc(String status);
}
