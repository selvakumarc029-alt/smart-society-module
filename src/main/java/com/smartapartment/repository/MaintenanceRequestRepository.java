package com.smartapartment.repository;

import com.smartapartment.entity.MaintenanceRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MaintenanceRequestRepository extends JpaRepository<MaintenanceRequest, Long> {

    Optional<MaintenanceRequest> findByRequestNumber(String requestNumber);

    List<MaintenanceRequest> findByResidentIdOrderByCreatedAtDesc(Long residentId);

    List<MaintenanceRequest> findByResidentIdAndRequestStatusInOrderByCreatedAtDesc(Long residentId, Collection<String> statuses);

    List<MaintenanceRequest> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    List<MaintenanceRequest> findByTenantIdAndRequestStatusInOrderByCreatedAtDesc(String tenantId, Collection<String> statuses);

    long countByRequestNumberStartingWith(String prefix);

    Optional<MaintenanceRequest> findByIdAndResidentId(Long id, Long residentId);

    Optional<MaintenanceRequest> findByIdAndTenantId(Long id, String tenantId);

    List<MaintenanceRequest> findByAssignedWorkerIdOrderByIdDesc(Long assignedWorkerId);
}
