package com.smartapartment.repository;

import com.smartapartment.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    List<AppUser> findByTenantId(String tenantId);
    List<AppUser> findByRole(com.smartapartment.entity.UserRole role);
    List<AppUser> findByTenantIdAndRole(String tenantId, com.smartapartment.entity.UserRole role);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from AppUser u where u.id=:id")
    Optional<AppUser> lockAttendanceUser(@org.springframework.data.repository.query.Param("id") Long id);
}
