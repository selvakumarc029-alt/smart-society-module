package com.smartapartment.repository;
import com.smartapartment.entity.SaasRenewalPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SaasRenewalPaymentRepository extends JpaRepository<SaasRenewalPayment,Long> {
    List<SaasRenewalPayment> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<SaasRenewalPayment> findAllByOrderByCreatedAtDesc();
    boolean existsByTransactionReference(String reference);
}
