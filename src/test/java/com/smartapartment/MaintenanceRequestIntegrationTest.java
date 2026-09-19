package com.smartapartment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class MaintenanceRequestIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private AppUserRepository userRepository;

    private MockHttpSession residentSession;

    @BeforeEach
    void setUp() throws Exception {
        residentSession = new MockHttpSession();
        residentSession.setAttribute("dashboard:smartapartment:resident", Boolean.TRUE);

        // Ensure resident account exists
        if (userRepository.findByEmail("resident@smartsociety").isEmpty()
                && userRepository.findByEmail("resident@smartapartment").isEmpty()) {
            AppUser resident = new AppUser();
            resident.setEmail("resident@smartsociety");
            resident.setFullName("Kavya Sharma");
            resident.setPhone("9844022010");
            resident.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
            resident.setRole(UserRole.RESIDENT);
            resident.setTenantId("society-1");
            userRepository.save(resident);
        }
    }

    @Test
    void createValidRequest_GeneratesRequestNumberAndStatusHistory() throws Exception {
        String payload = """
                {
                    "category": "Plumbing",
                    "serviceType": "Kitchen Tap Leakage",
                    "title": "Kitchen sink pipe leaking continuously",
                    "description": "Water is dripping from the drain pipe under the kitchen sink, causing pooling.",
                    "priority": "HIGH",
                    "preferredDate": "2026-09-25",
                    "preferredTime": "Morning (9:00 AM - 12:00 PM)",
                    "notes": "Please ring doorbell twice."
                }
                """;

        String response = mvc.perform(post("/api/maintenance/requests")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.requestNumber", startsWith("MR-2026-")))
                .andExpect(jsonPath("$.category").value("Plumbing"))
                .andExpect(jsonPath("$.serviceType").value("Kitchen Tap Leakage"))
                .andExpect(jsonPath("$.title").value("Kitchen sink pipe leaking continuously"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andExpect(jsonPath("$.eligibleForCancellation").value(true))
                .andExpect(jsonPath("$.eligibleForReopen").value(false))
                .andExpect(jsonPath("$.history", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.history[0].newStatus").value("REQUESTED"))
                .andReturn().getResponse().getContentAsString();

        JsonNode root = json.readTree(response);
        long requestId = root.get("id").asLong();

        // Verify GET /api/maintenance/requests/{id}
        mvc.perform(get("/api/maintenance/requests/" + requestId)
                        .session(residentSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(requestId))
                .andExpect(jsonPath("$.title").value("Kitchen sink pipe leaking continuously"));

        // Verify GET /api/maintenance/requests/{id}/history
        mvc.perform(get("/api/maintenance/requests/" + requestId + "/history")
                        .session(residentSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].newStatus").value("REQUESTED"));
    }

    @Test
    void createRequest_ValidationErrors_Returns400() throws Exception {
        // Missing title
        String missingTitle = """
                {
                    "category": "Plumbing",
                    "serviceType": "Tap Leak",
                    "title": "",
                    "description": "Some description",
                    "priority": "HIGH"
                }
                """;
        mvc.perform(post("/api/maintenance/requests")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(missingTitle))
                .andExpect(status().isBadRequest());

        // Invalid category
        String invalidCategory = """
                {
                    "category": "RocketScience",
                    "serviceType": "Launch",
                    "title": "Rocket failure",
                    "description": "Some description",
                    "priority": "HIGH"
                }
                """;
        mvc.perform(post("/api/maintenance/requests")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCategory))
                .andExpect(status().isBadRequest());

        // Invalid priority
        String invalidPriority = """
                {
                    "category": "Electrical",
                    "serviceType": "Light",
                    "title": "Broken light",
                    "description": "Some description",
                    "priority": "SUPER_DUPER"
                }
                """;
        mvc.perform(post("/api/maintenance/requests")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPriority))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelAndReopenLifecycle() throws Exception {
        // Create a request
        String payload = """
                {
                    "category": "Carpentry",
                    "serviceType": "Door Lock",
                    "title": "Balcony door lock jammed",
                    "description": "The key is stuck inside the cylinder.",
                    "priority": "MEDIUM"
                }
                """;

        String res = mvc.perform(post("/api/maintenance/requests")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        long id = json.readTree(res).get("id").asLong();

        // Cancel the request
        mvc.perform(post("/api/maintenance/requests/" + id + "/cancel")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Fixed it myself with WD-40\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.eligibleForCancellation").value(false));

        // Attempt to cancel again -> 400 Bad Request
        mvc.perform(post("/api/maintenance/requests/" + id + "/cancel")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Another attempt\"}"))
                .andExpect(status().isBadRequest());

        // Update to COMPLETED via PUT (simulating staff completion with maintenance session)
        MockHttpSession adminSession = new MockHttpSession();
        adminSession.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);

        mvc.perform(put("/api/maintenance/requests/" + id)
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Reopen the request
        mvc.perform(post("/api/maintenance/requests/" + id + "/reopen")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Lock got jammed again after 2 days\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REOPENED"))
                .andExpect(jsonPath("$.eligibleForCancellation").value(true));
    }

    @Test
    void listRequests_FiltersAllActiveCompleted() throws Exception {
        mvc.perform(get("/api/maintenance/requests?filter=all")
                        .session(residentSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.List.class)));

        mvc.perform(get("/api/maintenance/requests?filter=active")
                        .session(residentSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.List.class)));

        mvc.perform(get("/api/maintenance/requests?filter=completed")
                        .session(residentSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.List.class)));
    }
}
