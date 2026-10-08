package com.smartapartment.repository;
import com.smartapartment.entity.SocietyWorkerBreak;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SocietyWorkerBreakRepository extends JpaRepository<SocietyWorkerBreak,Long> {
    List<SocietyWorkerBreak> findByTenantIdAndAttendanceIdOrderByStartedAtAsc(String tenantId,Long attendanceId);
}
