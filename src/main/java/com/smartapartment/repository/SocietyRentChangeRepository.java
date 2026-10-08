package com.smartapartment.repository;
import com.smartapartment.entity.SocietyRentChange;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SocietyRentChangeRepository extends JpaRepository<SocietyRentChange,Long> {
    List<SocietyRentChange> findByTenantIdOrderByEffectiveDateDescIdDesc(String tenantId);
    List<SocietyRentChange> findByTenantIdAndApartmentIdOrderByEffectiveDateDescIdDesc(String tenantId,Long apartmentId);
}
