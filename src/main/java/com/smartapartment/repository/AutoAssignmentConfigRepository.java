package com.smartapartment.repository;

import com.smartapartment.entity.AutoAssignmentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AutoAssignmentConfigRepository extends JpaRepository<AutoAssignmentConfig, Long> {

    Optional<AutoAssignmentConfig> findFirstByTenantIdOrderByCreatedAtDesc(String tenantId);
}
