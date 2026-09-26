package com.smartapartment.repository;

import com.smartapartment.entity.HomeServicePackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HomeServicePackageRepository extends JpaRepository<HomeServicePackage, Long> {
    List<HomeServicePackage> findByActiveTrueOrderByIdAsc();
    List<HomeServicePackage> findAllByOrderByIdAsc();
    List<HomeServicePackage> findByCategoryIgnoreCaseAndActiveTrue(String category);
    List<HomeServicePackage> findByDesignationIgnoreCaseAndActiveTrue(String designation);
    Optional<HomeServicePackage> findBySubServiceAndDesignationAndPackageName(String subService, String designation, String packageName);
}
