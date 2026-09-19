package com.smartapartment.repository;

import com.smartapartment.entity.MaintenanceStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MaintenanceStatusHistoryRepository extends JpaRepository<MaintenanceStatusHistory, Long> {

    List<MaintenanceStatusHistory> findByRequestIdOrderByCreatedAtAsc(Long requestId);
}
