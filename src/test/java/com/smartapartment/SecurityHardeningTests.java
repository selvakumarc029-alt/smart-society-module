package com.smartapartment;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityHardeningTests {

    @Autowired
    MockMvc mockMvc;

    @Test
    void anonymousDashboardUrlsCannotCreateSocietyLoginFlags() throws Exception {
        for (String path : java.util.List.of("superadmin", "society-admin", "resident", "maintenance", "maintenance-worker", "accountant", "security")) {
            var session = new org.springframework.mock.web.MockHttpSession();
            mockMvc.perform(get("/dashboards/" + path).session(session))
                    .andExpect(status().is3xxRedirection()).andExpect(redirectedUrl("/?loginRequired=true"));
            org.junit.jupiter.api.Assertions.assertNull(session.getAttribute("dashboard:smartapartment:superadmin"));
            org.junit.jupiter.api.Assertions.assertNull(session.getAttribute("dashboard:smartapartment:maintenance"));
        }
    }

    @Test
    void anonymousCannotAccessSuperAdminApi() throws Exception {
        mockMvc.perform(get("/api/superadmin/analytics/data"))
                .andExpect(status().is3xxRedirection());
    }

    @Test
    void anonymousCannotCreateASuperAdminSessionFromDashboardUrl() throws Exception {
        mockMvc.perform(get("/propertydirect/dashboards/superadmin"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/propertydirect?loginRequired=true"));
    }
}
