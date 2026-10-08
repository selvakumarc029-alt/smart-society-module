package com.smartapartment.controller;

import com.smartapartment.entity.Vendor;
import com.smartapartment.repository.VendorRepository;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Accountant vendor entry; existing society administration routes are unchanged. */
@RestController
@RequestMapping("/api/society/accounting")
@PreAuthorize("hasAnyRole('ACCOUNTANT','SOCIETY_ADMIN')")
public class AccountantActionsController {
    private final CurrentUserService current;
    private final VendorRepository vendors;

    public AccountantActionsController(CurrentUserService current, VendorRepository vendors) {
        this.current = current;
        this.vendors = vendors;
    }

    @PostMapping("/vendors")
    @Transactional
    public Vendor createVendor(@Valid @RequestBody VendorInput input) {
        Vendor vendor = new Vendor();
        vendor.setTenantId(current.requireTenantId());
        vendor.setName(input.name().trim());
        vendor.setServiceCategory(input.category().trim());
        vendor.setPhone(input.phone().trim());
        vendor.setEmail(input.email() == null ? "" : input.email().trim());
        vendor.setTaxNumber(input.taxNumber() == null ? "" : input.taxNumber().trim());
        return vendors.save(vendor);
    }

    public record VendorInput(@NotBlank @Size(max = 150) String name,
                              @NotBlank @Size(max = 100) String category,
                              @NotBlank @Size(max = 30) String phone,
                              @Email @Size(max = 150) String email,
                              @Size(max = 50) String taxNumber) {}
}
