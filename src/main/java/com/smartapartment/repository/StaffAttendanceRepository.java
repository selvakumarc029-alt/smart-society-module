package com.smartapartment.repository;
import com.smartapartment.entity.StaffAttendance;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffAttendanceRepository extends JpaRepository<StaffAttendance,Long>{
    List<StaffAttendance> findByTenantIdOrderByWorkDateDesc(String t);
    Optional<StaffAttendance> findByTenantIdAndUserIdAndWorkDate(String t,Long u,LocalDate d);
    List<StaffAttendance> findByWorkDate(LocalDate workDate);
    Optional<StaffAttendance> findFirstByUserIdAndWorkDateOrderByCreatedAtDesc(Long userId, LocalDate workDate);
    List<StaffAttendance> findByUserIdOrderByWorkDateDesc(Long userId);
}
