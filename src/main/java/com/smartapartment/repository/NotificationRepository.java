package com.smartapartment.repository;
import com.smartapartment.entity.Notification;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface NotificationRepository extends JpaRepository<Notification,Long>{List<Notification> findByTenantIdAndUserIdOrderByCreatedAtDesc(String t,Long u);Optional<Notification> findByIdAndTenantIdAndUserId(Long id,String t,Long u);    boolean existsByTenantIdAndUserIdAndTypeAndTitleAndCreatedAtAfter(String tenantId,Long userId,String type,String title,java.time.LocalDateTime since);
}
