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
}
