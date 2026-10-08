package com.smartapartment.repository;

import com.smartapartment.entity.CommonMaintenanceTicket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommonMaintenanceTicketRepository extends JpaRepository<CommonMaintenanceTicket, Long> {
    List<CommonMaintenanceTicket> findBySourcePlatformIgnoreCaseOrderByCreatedAtDesc(String sourcePlatform);
    List<CommonMaintenanceTicket> findByRequesterIdOrderByCreatedAtDesc(Long requesterId);
    List<CommonMaintenanceTicket> findByTicketStatusIgnoreCaseOrderByCreatedAtDesc(String ticketStatus);
    List<CommonMaintenanceTicket> findByVendorIdOrderByCreatedAtDesc(Long vendorId);
    List<CommonMaintenanceTicket> findByTenantIdAndSourcePlatformIgnoreCaseOrderByCreatedAtDesc(String tenantId,String sourcePlatform);
}
