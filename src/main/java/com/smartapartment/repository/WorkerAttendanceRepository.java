package com.smartapartment.repository;

import com.smartapartment.entity.WorkerAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerAttendanceRepository extends JpaRepository<WorkerAttendance, Long> {

    Optional<WorkerAttendance> findFirstByWorkerIdAndDateOrderByCreatedAtDesc(Long workerId, LocalDate date);

    List<WorkerAttendance> findByWorkerIdAndDateBetweenOrderByDateDesc(Long workerId, LocalDate start, LocalDate end);

    List<WorkerAttendance> findByTenantIdAndDateOrderByCreatedAtDesc(String tenantId, LocalDate date);

    List<WorkerAttendance> findByWorkerIdOrderByDateDesc(Long workerId);

    List<WorkerAttendance> findByTenantIdOrderByDateDesc(String tenantId);
}
