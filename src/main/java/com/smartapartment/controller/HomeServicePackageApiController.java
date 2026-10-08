package com.smartapartment.controller;

import com.smartapartment.dto.HomeServicePackageDto;
import com.smartapartment.entity.HomeServicePackage;
import com.smartapartment.service.HomeServicePackageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class HomeServicePackageApiController {

    private final HomeServicePackageService packageService;

    /**
     * Read endpoint consumed by Residents and Customers to get live pricing catalog.
     */
    @GetMapping("/api/home-services/packages")
    public ResponseEntity<List<HomeServicePackage>> getAllActivePackages() {
        return ResponseEntity.ok(packageService.getAllActivePackages());
    }

    /**
     * Read single package.
     */
    @GetMapping("/api/home-services/packages/{id}")
    public ResponseEntity<HomeServicePackage> getPackageById(@PathVariable Long id) {
        return ResponseEntity.ok(packageService.getPackageById(id));
    }

    /**
     * Admin endpoint to get all packages (including inactive) for admin table view.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/api/admin/home-services/packages")
    public ResponseEntity<List<HomeServicePackage>> getAllPackagesForAdmin() {
        return ResponseEntity.ok(packageService.getAllPackages());
    }

    /**
     * CRUD: Create new service package.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/api/admin/home-services/packages")
    public ResponseEntity<?> createPackage(@RequestBody HomeServicePackageDto dto) {
        try {
            HomeServicePackage created = packageService.createPackage(dto);
            log.info("Admin created new package ID {}: {} for {} (₹{})",
                    created.getId(), created.getPackageName(), created.getDesignation(), created.getPrice());
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException ex) {
            Map<String, String> err = new HashMap<>();
            err.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception ex) {
            log.error("Error creating package: {}", ex.getMessage(), ex);
            Map<String, String> err = new HashMap<>();
            err.put("error", "Failed to create package: " + ex.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    /**
     * CRUD: Update package details & price.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/api/admin/home-services/packages/{id}")
    public ResponseEntity<?> updatePackage(@PathVariable Long id, @RequestBody HomeServicePackageDto dto) {
        try {
            HomeServicePackage updated = packageService.updatePackage(id, dto);
            log.info("Admin updated package ID {}: {} for {} to price ₹{}",
                    updated.getId(), updated.getPackageName(), updated.getDesignation(), updated.getPrice());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            Map<String, String> err = new HashMap<>();
            err.put("error", ex.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception ex) {
            log.error("Error updating package {}: {}", id, ex.getMessage(), ex);
            Map<String, String> err = new HashMap<>();
            err.put("error", "Failed to update package: " + ex.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    /**
     * CRUD: Quick inline price update.
     * Expects { "price": 2899 } or direct numeric query param.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PatchMapping("/api/admin/home-services/packages/{id}/price")
    public ResponseEntity<?> updatePriceOnly(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Object priceObj = body.get("price");
            if (priceObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Field 'price' is required"));
            }
            Double newPrice = Double.valueOf(priceObj.toString());
            HomeServicePackage updated = packageService.updatePrice(id, newPrice);
            log.info("Admin updated price for package ID {} to ₹{}", id, updated.getPrice());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Error updating price for package {}: {}", id, ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * CRUD: Delete package (soft delete / active = false).
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @DeleteMapping("/api/admin/home-services/packages/{id}")
    public ResponseEntity<?> deletePackage(@PathVariable Long id) {
        try {
            packageService.deletePackage(id);
            log.info("Admin deleted/deactivated package ID {}", id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Package #" + id + " deactivated"));
        } catch (Exception ex) {
            log.error("Error deleting package {}: {}", id, ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Reset catalog to system defaults if needed.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/api/admin/home-services/packages/reset-defaults")
    public ResponseEntity<?> resetDefaults() {
        try {
            packageService.seedDefaultPackagesIfEmpty();
            return ResponseEntity.ok(Map.of("success", true, "message", "Default packages verified"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", ex.getMessage()));
        }
    }
}
