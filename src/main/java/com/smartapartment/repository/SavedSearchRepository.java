package com.smartapartment.repository;import com.smartapartment.entity.SavedSearch;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface SavedSearchRepository extends JpaRepository<SavedSearch,Long>{
    List<SavedSearch> findByCustomerIdOrderByCreatedAtDesc(Long c);
    Optional<SavedSearch> findByIdAndCustomerId(Long id,Long c);
    List<SavedSearch> findByAlertsEnabledTrue();
}
