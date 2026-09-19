package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.dto.WorkerTaskDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.WorkerTaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class WorkerTaskManagementIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private MaintenanceRequestRepository requestRepository;

    @Autowired
    private WorkerAvailabilityRepository availabilityRepository;

    @Autowired
    private TaskPauseLogRepository pauseLogRepository;

    @Autowired
    private WorkerTaskService workerTaskService;

    private String tenantId;
    private AppUser workerA;
    private AppUser workerB;
    private MockHttpSession workerSession;

    @BeforeEach
    void setUp() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        tenantId = "tenant-" + unique;

        workerA = createWorker("Rajesh Technician", "Plumber", "EMP-A-" + unique);
        workerB = createWorker("Suresh Technician", "Plumber", "EMP-B-" + unique);

        workerSession = new MockHttpSession();
        workerSession.setAttribute("dashboard:smartapartment:maintenance", Boolean.TRUE);
    }

    private AppUser createWorker(String name, String designation, String empId) {
        AppUser worker = new AppUser();
        worker.setEmail(empId.toLowerCase() + "@smartsociety.test");
        worker.setFullName(name);
        worker.setDesignation(designation);
        worker.setWorkShift("General Shift");
        worker.setEmployeeId(empId);
        worker.setTenantId(tenantId);
        worker.setRole(UserRole.MAINTENANCE_STAFF);
        worker.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
        return userRepository.save(worker);
    }

    private MaintenanceRequest createAssignedTask(AppUser worker, String status) {
        MaintenanceRequest r = new MaintenanceRequest();
        r.setRequestNumber("TSK-" + System.nanoTime());
        r.setTenantId(tenantId);
        r.setResidentId(101L);
        r.setResidentName("John Resident");
        r.setApartmentUnit("A-204");
        r.setBuildingName("Block A");
        r.setCategory("Plumbing");
        r.setServiceType("Pipe Leakage");
        r.setTitle("Kitchen Sink Leak");
        r.setDescription("Water dripping under the sink pipe");
        r.setPriority("HIGH");
        r.setRequestStatus(status);
        r.setAssignedWorkerId(worker.getId());
        r.setAssignedWorkerName(worker.getFullName());
        r.setEstimatedDuration("90 mins");
        return requestRepository.save(r);
    }

    // 1. Accept Task: ASSIGNED -> WORKER_ACCEPTED
    @Test
    void testAcceptTask() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "ASSIGNED");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/accept")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WORKER_ACCEPTED"));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("WORKER_ACCEPTED", updated.getRequestStatus());
        assertNull(updated.getWorkerResponseDeadline(), "Worker response deadline should be cleared upon acceptance");
    }

    // 2. Start Travel: WORKER_ACCEPTED -> TRAVELLING
    @Test
    void testStartTravel() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "WORKER_ACCEPTED");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/travel")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TRAVELLING"));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("TRAVELLING", updated.getRequestStatus());
    }

    // 3. Arrive: TRAVELLING -> ARRIVED
    @Test
    void testArriveAtLocation() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "TRAVELLING");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/arrive")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARRIVED"));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("ARRIVED", updated.getRequestStatus());
    }

    // 4. Start Work: ARRIVED -> IN_PROGRESS with actualStartTime and calculated estimatedEndTime
    @Test
    void testStartWork() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "ARRIVED");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/start")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.actualStartTime").isNotEmpty())
                .andExpect(jsonPath("$.estimatedEndTime").isNotEmpty());

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("IN_PROGRESS", updated.getRequestStatus());
        assertNotNull(updated.getActualStartTime());
        assertNotNull(updated.getEstimatedEndTime());
        assertTrue(updated.getEstimatedEndTime().isAfter(updated.getActualStartTime()));

        // Worker availability should be BUSY
        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        assertEquals("BUSY", av.getStatus());
        assertEquals(task.getId(), av.getCurrentTaskId());
    }

    // 5. Pause Work: IN_PROGRESS -> ON_HOLD with pauseStart and reason
    @Test
    void testPauseWork() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "IN_PROGRESS");
        task.setActualStartTime(LocalDateTime.now().minusMinutes(20));
        task.setEstimatedEndTime(LocalDateTime.now().plusMinutes(70));
        requestRepository.save(task);

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/pause")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new PauseTaskRequestDto("Waiting for spare part"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ON_HOLD"))
                .andExpect(jsonPath("$.isPaused").value(true))
                .andExpect(jsonPath("$.currentPauseReason").value("Waiting for spare part"));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("ON_HOLD", updated.getRequestStatus());
        assertNotNull(updated.getCurrentPauseStart());
        assertEquals("Waiting for spare part", updated.getCurrentPauseReason());
    }

    // 6. Resume Work: ON_HOLD -> IN_PROGRESS, stores pause duration and extends ETA
    @Test
    void testResumeWork() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "ON_HOLD");
        task.setActualStartTime(LocalDateTime.now().minusMinutes(40));
        LocalDateTime pauseStart = LocalDateTime.now().minusMinutes(15);
        task.setCurrentPauseStart(pauseStart);
        task.setCurrentPauseReason("Resident unavailable");
        LocalDateTime originalEta = LocalDateTime.now().plusMinutes(50);
        task.setEstimatedEndTime(originalEta);
        requestRepository.save(task);

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/resume")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.isPaused").value(false));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("IN_PROGRESS", updated.getRequestStatus());
        assertNull(updated.getCurrentPauseStart());
        assertTrue(updated.getTotalPausedMinutes() >= 14, "Should accumulate paused minutes");
        assertTrue(updated.getEstimatedEndTime().isAfter(originalEta), "ETA should be extended by pause duration");

        // Verify TaskPauseLog record
        assertFalse(pauseLogRepository.findByMaintenanceRequestIdOrderByPauseStartAsc(task.getId()).isEmpty());
    }

    // 7. Complete Work: IN_PROGRESS -> COMPLETED with actualDuration (excluding pause) & frees worker
    @Test
    void testCompleteWork() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "IN_PROGRESS");
        task.setActualStartTime(LocalDateTime.now().minusMinutes(60));
        task.setTotalPausedMinutes(15);
        requestRepository.save(task);

        CompleteTaskRequestDto dto = new CompleteTaskRequestDto(
                "Replaced leaking seal under sink and tested water flow.",
                "https://example.com/before.jpg",
                "https://example.com/after.jpg"
        );

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/complete")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completionNotes").value("Replaced leaking seal under sink and tested water flow."));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("COMPLETED", updated.getRequestStatus());
        assertNotNull(updated.getActualEndTime());
        assertNotNull(updated.getCompletedAt());
        // Net duration: 60 - 15 = approx 45 minutes
        assertTrue(updated.getActualDuration() >= 40 && updated.getActualDuration() <= 50);

        // Worker availability should be reset to AVAILABLE
        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        assertEquals("AVAILABLE", av.getStatus());
        assertNull(av.getCurrentTaskId());
    }

    // 8. Delay Task: Updates estimatedEndTime and delayReason
    @Test
    void testDelayTask() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "IN_PROGRESS");
        task.setActualStartTime(LocalDateTime.now().minusMinutes(30));
        task.setEstimatedEndTime(LocalDateTime.now().plusMinutes(30));
        requestRepository.save(task);

        LocalDateTime newEta = LocalDateTime.now().plusMinutes(90);
        DelayTaskRequestDto dto = new DelayTaskRequestDto("Main pipe valve required extra plumbing cement", newEta);

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/delay")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delayReason").value("Main pipe valve required extra plumbing cement"));

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertEquals("Main pipe valve required extra plumbing cement", updated.getDelayReason());
    }

    // 9. Overdue detection
    @Test
    void testOverdueDetection() {
        MaintenanceRequest task = createAssignedTask(workerA, "IN_PROGRESS");
        task.setActualStartTime(LocalDateTime.now().minusMinutes(120));
        task.setEstimatedEndTime(LocalDateTime.now().minusMinutes(30)); // 30 mins ago
        requestRepository.save(task);

        workerTaskService.checkOverdueTasks();

        MaintenanceRequest updated = requestRepository.findById(task.getId()).orElseThrow();
        assertTrue(updated.getIsOverdue());
        assertTrue(updated.getOverdueMinutes() >= 29);
    }

    // 10. Unauthorized Worker: Worker B cannot update Worker A's task -> 403 FORBIDDEN
    @Test
    void testUnauthorizedWorker_Forbidden() throws Exception {
        MaintenanceRequest task = createAssignedTask(workerA, "ASSIGNED");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/accept")
                        .with(user(workerB.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isForbidden());
    }

    // 11. Invalid state transition protection
    @Test
    void testInvalidStateTransition_Rejected() throws Exception {
        // Attempting to resume a task that is not ON_HOLD
        MaintenanceRequest task = createAssignedTask(workerA, "ASSIGNED");

        mvc.perform(post("/api/maintenance/tasks/" + task.getId() + "/resume")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isBadRequest());
    }

    // 12. Get My Tasks: Returns Current, Pending, Today's, Upcoming, Completed
    @Test
    void testGetMyTasks() throws Exception {
        createAssignedTask(workerA, "IN_PROGRESS");
        createAssignedTask(workerA, "ASSIGNED");

        MaintenanceRequest completed = createAssignedTask(workerA, "COMPLETED");
        completed.setCompletedAt(LocalDateTime.now());
        requestRepository.save(completed);

        mvc.perform(get("/api/workers/me/tasks")
                        .with(user(workerA.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentTask").isNotEmpty())
                .andExpect(jsonPath("$.pendingTasks", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.completedTasks", hasSize(greaterThanOrEqualTo(1))));
    }
}
