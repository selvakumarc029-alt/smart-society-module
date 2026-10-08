package com.smartapartment.repository;
import com.smartapartment.entity.SecurityAccessLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
public interface SecurityAccessLogRepository extends JpaRepository<SecurityAccessLog,Long> {
    List<SecurityAccessLog> findByTenantIdAndLoginAtBetweenOrderByLoginAtDesc(String tenantId,LocalDateTime start,LocalDateTime end);
}
