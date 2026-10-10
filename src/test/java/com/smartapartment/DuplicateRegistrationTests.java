package com.smartapartment;

import com.smartapartment.controller.AuthController;
import com.smartapartment.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DuplicateRegistrationTests {
    @Test void duplicatesAreRejectedWithoutChangingAccounts() {
        AppUserRepository users = mock(AppUserRepository.class);
        PropertyCustomerRepository customers = mock(PropertyCustomerRepository.class);
        TenantRepository tenants = mock(TenantRepository.class);
        AuthController controller = new AuthController(null, new MockEnvironment(), customers,
                null, null, null, users, tenants, null, null, null, false);
        when(users.existsByEmailIgnoreCase("existing@example.com")).thenReturn(true);
        var society = controller.registerResident(new AuthController.ResidentSelfRegisterRequest(
                "Existing", " EXISTING@example.com ", "", "password123", "", "", "", ""));
        assertEquals(409, society.getStatusCode().value());
        assertTrue(society.getBody().toString().contains("User already exists. Contact your admin."));
        verifyNoInteractions(tenants);
        verify(users, never()).save(any());
        when(customers.existsByUsernameIgnoreCaseOrEmailIgnoreCase("existing@example.com", "existing@example.com")).thenReturn(true);
        var property = controller.registerPropertyDirect(new AuthController.PropertyDirectRegisterRequest(
                "Existing", "EXISTING@example.com", "", "password123"));
        assertEquals(409, property.getStatusCode().value());
        assertTrue(property.getBody().toString().contains("User already exists. Contact your admin."));
        verify(customers, never()).save(any());
    }
}
