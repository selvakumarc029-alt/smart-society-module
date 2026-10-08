package com.smartapartment.repository;

import com.smartapartment.entity.Apartment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApartmentRepository extends JpaRepository<Apartment, Long> {
    List<Apartment> findByTenantId(String tenantId);
    long countByTenantId(String tenantId);
    Optional<Apartment> findFirstByTenantIdAndUnitNoOrderByIdAsc(String tenantId, String unitNo);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from Apartment a where a.tenantId=:tenant and a.id=:id")
    Optional<Apartment> lockForAdmin(@org.springframework.data.repository.query.Param("tenant") String tenant,@org.springframework.data.repository.query.Param("id") Long id);
}
