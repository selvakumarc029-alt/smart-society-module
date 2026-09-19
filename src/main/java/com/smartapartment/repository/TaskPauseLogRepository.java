package com.smartapartment.repository;

import com.smartapartment.entity.TaskPauseLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskPauseLogRepository extends JpaRepository<TaskPauseLog, Long> {

    List<TaskPauseLog> findByMaintenanceRequestIdOrderByPauseStartAsc(Long maintenanceRequestId);

    List<TaskPauseLog> findByMaintenanceRequestIdAndPauseEndIsNull(Long maintenanceRequestId);
}
