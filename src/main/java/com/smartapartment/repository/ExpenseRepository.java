package com.smartapartment.repository;

import com.smartapartment.entity.Expense;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByTenantIdOrderByExpenseDateDesc(String tenantId);
    Optional<Expense> findByIdAndTenantId(Long id, String tenantId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Expense e where e.id=:id and e.tenantId=:tenant")
    Optional<Expense> lockByIdAndTenantId(@org.springframework.data.repository.query.Param("id") Long id,
            @org.springframework.data.repository.query.Param("tenant") String tenant);
}
