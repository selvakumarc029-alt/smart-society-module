package com.smartapartment.repository;

import com.smartapartment.entity.WorkerAvailability;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerAvailabilityRepository extends JpaRepository<WorkerAvailability, Long> {

    Optional<WorkerAvailability> findByWorkerId(Long workerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT wa FROM WorkerAvailability wa WHERE wa.workerId = :workerId")
    Optional<WorkerAvailability> findByWorkerIdWithLock(@Param("workerId") Long workerId);

    List<WorkerAvailability> findByTenantIdAndStatus(String tenantId, String status);

    List<WorkerAvailability> findByTenantId(String tenantId);
}
