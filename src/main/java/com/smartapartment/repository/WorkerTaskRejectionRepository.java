package com.smartapartment.repository;

import com.smartapartment.entity.WorkerTaskRejection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkerTaskRejectionRepository extends JpaRepository<WorkerTaskRejection, Long> {

    List<WorkerTaskRejection> findByMaintenanceRequestIdOrderByRejectedAtDesc(Long maintenanceRequestId);

    boolean existsByMaintenanceRequestIdAndWorkerId(Long maintenanceRequestId, Long workerId);
}
