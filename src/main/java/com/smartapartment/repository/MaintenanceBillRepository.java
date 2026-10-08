package com.smartapartment.repository;

import com.smartapartment.entity.MaintenanceBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MaintenanceBillRepository extends JpaRepository<MaintenanceBill, Long> {
    long countByTenantIdAndPaymentStatus(String tenantId, String paymentStatus);
    boolean existsByTenantIdAndApartmentIdAndBillMonth(String tenantId, Long apartmentId, String billMonth);
    List<MaintenanceBill> findByTenantIdOrderByDueDateDesc(String tenantId);
    Optional<MaintenanceBill> findByIdAndTenantId(Long id, String tenantId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from MaintenanceBill b where b.id=:id and b.tenantId=:tenant")
    Optional<MaintenanceBill> lockByIdAndTenantId(@Param("id") Long id,@Param("tenant") String tenant);
    List<MaintenanceBill> findByTenantIdAndPaymentStatusIgnoreCaseAndDueDateBefore(String tenantId, String paymentStatus, LocalDate date);

    @Query("select coalesce(sum(b.totalAmount), 0) from MaintenanceBill b " +
            "where b.tenantId = :tenantId and upper(b.paymentStatus) = 'PAID'")
    BigDecimal sumPaidRevenue(@Param("tenantId") String tenantId);

    default BigDecimal monthlyRevenue(String tenantId) {
        return sumPaidRevenue(tenantId);
    }
}
