package com.smartapartment.repository;
import com.smartapartment.entity.PropertyAuditEvent;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyAuditEventRepository extends JpaRepository<PropertyAuditEvent, Long> {
    List<PropertyAuditEvent> findTop100ByOrderByCreatedAtDesc();
    List<PropertyAuditEvent> findAllByOrderByCreatedAtDesc();
    List<PropertyAuditEvent> findByTargetTypeOrderByCreatedAtDesc(String targetType);
    List<PropertyAuditEvent> findByTargetTypeAndTargetIdOrderByCreatedAtAsc(String targetType, Long targetId);
    List<PropertyAuditEvent> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(String targetType, Long targetId);
}
