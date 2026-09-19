package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.dto.MaintenanceManagerDtos.*;
import com.smartapartment.dto.MaintenanceRequestDtos.*;
import com.smartapartment.dto.RealTimeTrackingDtos.*;
import com.smartapartment.dto.WorkerAttendanceDtos.*;
import com.smartapartment.dto.WorkerTaskDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class MaintenanceSystemEndToEndIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ResidentRepository residentRepository;

    @Autowired
    private ApartmentRepository apartmentRepository;

    @Autowired
    private MaintenanceRequestRepository requestRepository;

    @Autowired
    private MaintenanceStatusHistoryRepository historyRepository;

    @Autowired
    private WorkerAttendanceRepository attendanceRepository;

    @Autowired
    private WorkerAvailabilityRepository availabilityRepository;

    @Autowired
    private TaskPauseLogRepository pauseLogRepository;

    @Autowired
    private MaintenanceTrackingService trackingService;

    @Autowired
    private MaintenanceManagerService managerService;

    @Autowired
    private MaintenanceRequestService requestService;

    @Autowired
    private WorkerAttendanceService attendanceService;

    @Autowired
    private AutoAssignmentService autoAssignmentService;

    @Autowired
    private WorkerTaskService taskService;

    private String tenantA;
    private String tenantB;
    private AppUser residentUserA;
    private AppUser workerUserA;
    private AppUser managerUserA;
    private AppUser residentUserB;
    private Resident residentA;
    private MockHttpSession managerSession;
    private MockHttpSession residentSession;

    @BeforeEach
    void setUp() {
        String uid = UUID.randomUUID().toString().substring(0, 8);
        tenantA = "society-a-" + uid;
        tenantB = "society-b-" + uid;

        // 1. Resident A
        residentUserA = new AppUser();
        residentUserA.setEmail("resident-a-" + uid + "@society.com");
        residentUserA.setFullName("Aarav Sharma");
        residentUserA.setPhone("9876543210");
        residentUserA.setPasswordHash("$2a$10$placeholder");
        residentUserA.setRole(UserRole.RESIDENT);
        residentUserA.setTenantId(tenantA);
        residentUserA = userRepository.save(residentUserA);

        residentA = new Resident();
        residentA.setUser(residentUserA);
        residentA.setResidentType("OWNER");
        residentA.setTenantId(tenantA);
        residentA = residentRepository.save(residentA);

        // 2. Worker A (Plumber)
        workerUserA = new AppUser();
        workerUserA.setEmail("worker-a-" + uid + "@society.com");
        workerUserA.setFullName("Rahul Kumar");
        workerUserA.setPhone("9876500001");
        workerUserA.setPasswordHash("$2a$10$placeholder");
        workerUserA.setRole(UserRole.MAINTENANCE_STAFF);
        workerUserA.setDesignation("Plumbing");
        workerUserA.setWorkShift("GENERAL");
        workerUserA.setTenantId(tenantA);
        workerUserA = userRepository.save(workerUserA);

        // 3. Manager A
        managerUserA = new AppUser();
        managerUserA.setEmail("manager-a-" + uid + "@society.com");
        managerUserA.setFullName("Suresh Facility Head");
        managerUserA.setPhone("9876599999");
        managerUserA.setPasswordHash("$2a$10$placeholder");
        managerUserA.setRole(UserRole.FACILITY_MANAGER);
        managerUserA.setTenantId(tenantA);
        managerUserA = userRepository.save(managerUserA);

        // 4. Resident B (Tenant B - Isolation check)
        residentUserB = new AppUser();
        residentUserB.setEmail("resident-b-" + uid + "@society.com");
        residentUserB.setFullName("Vikram Patel");
        residentUserB.setPasswordHash("$2a$10$placeholder");
        residentUserB.setRole(UserRole.RESIDENT);
        residentUserB.setTenantId(tenantB);
        residentUserB = userRepository.save(residentUserB);

        Resident residentB = new Resident();
        residentB.setUser(residentUserB);
        residentB.setResidentType("OWNER");
        residentB.setTenantId(tenantB);
        residentRepository.save(residentB);

        managerSession = new MockHttpSession();
        managerSession.setAttribute("dashboard:smartapartment:admin", true);

        residentSession = new MockHttpSession();
        residentSession.setAttribute("dashboard:smartapartment:resident", true);
    }

    @Test
    @Transactional
    void testCompleteMaintenanceLifecycleEndToEnd() {
        // Step 1: Worker Clocks In -> Status PRESENT, Availability AVAILABLE
        WorkerAttendanceResponseDto clockInResp = attendanceService.clockIn(workerUserA, new ClockInRequest("GENERAL", "On duty"));
        assertNotNull(clockInResp);
        assertTrue("PRESENT".equals(clockInResp.attendanceStatus()) || "LATE".equals(clockInResp.attendanceStatus()));

        WorkerAvailability av = availabilityRepository.findByWorkerId(workerUserA.getId()).orElse(null);
        assertNotNull(av);
        assertEquals("AVAILABLE", av.getStatus());

        // Step 2: Resident creates Maintenance Request (Plumbing)
        CreateMaintenanceRequestDto createDto = new CreateMaintenanceRequestDto(
                "Plumbing",
                "Pipe Repair",
                "Bathroom Tap Leakage",
                "Urgent leakage under the sink in master bathroom",
                "URGENT",
                null,
                null,
                null,
                null,
                null
        );

        MaintenanceRequestResponseDto reqDto = requestService.createRequest(createDto, residentUserA);
        assertNotNull(reqDto);
        assertNotNull(reqDto.requestNumber());

        MaintenanceRequest request = requestRepository.findById(reqDto.id()).orElseThrow();
        assertEquals("ASSIGNED", request.getRequestStatus()); // URGENT bypasses delay and auto-assigns immediately
        assertEquals(workerUserA.getId(), request.getAssignedWorkerId());
        assertEquals("Rahul Kumar", request.getAssignedWorkerName());

        // Step 3: Worker Accepts Task
        WorkerTaskDetailDto acceptDto = taskService.acceptTask(request.getId(), workerUserA);
        assertNotNull(acceptDto);
        assertEquals("WORKER_ACCEPTED", acceptDto.status());

        // Step 4: Worker Starts Travel
        WorkerTaskDetailDto travelDto = taskService.startTravel(request.getId(), workerUserA);
        assertEquals("TRAVELLING", travelDto.status());

        // Step 5: Worker Arrives
        WorkerTaskDetailDto arriveDto = taskService.arriveAtLocation(request.getId(), workerUserA);
        assertEquals("ARRIVED", arriveDto.status());

        // Step 6: Worker Starts Work -> IN_PROGRESS, Timers Active
        WorkerTaskDetailDto startDto = taskService.startWork(request.getId(), workerUserA);
        assertEquals("IN_PROGRESS", startDto.status());
        assertNotNull(startDto.actualStartTime());
        assertNotNull(startDto.estimatedEndTime());

        // Step 7: Worker Pauses Work -> ON_HOLD
        WorkerTaskDetailDto pauseDto = taskService.pauseWork(request.getId(), new PauseTaskRequestDto("Need spare valve from store"), workerUserA);
        assertEquals("ON_HOLD", pauseDto.status());

        // Step 8: Worker Resumes Work -> IN_PROGRESS
        WorkerTaskDetailDto resumeDto = taskService.resumeWork(request.getId(), workerUserA);
        assertEquals("IN_PROGRESS", resumeDto.status());
        assertEquals(1, pauseLogRepository.findAll().stream().filter(p -> p.getMaintenanceRequestId().equals(request.getId())).count());

        // Step 9: Worker Completes Work -> COMPLETED
        WorkerTaskDetailDto completeDto = taskService.completeWork(request.getId(),
                new CompleteTaskRequestDto("Replaced rubber washer and tightened brass valve. No leak.", "http://img/b.jpg", "http://img/a.jpg"),
                workerUserA);
        assertEquals("COMPLETED", completeDto.status());

        // Verify worker availability freed back to AVAILABLE
        WorkerAvailability freedAv = availabilityRepository.findByWorkerId(workerUserA.getId()).orElseThrow();
        assertEquals("AVAILABLE", freedAv.getStatus());

        // Step 10: Resident Inspects Live Tracking Card
        LiveTrackingCardDto trackingCard = trackingService.getRequestTrackingCard(request.getId(), residentUserA);
        assertNotNull(trackingCard);
        assertEquals("COMPLETED", trackingCard.currentStatus());
        assertTrue(trackingCard.canConfirm());
        assertFalse(trackingCard.timeline().isEmpty());

        // Step 11: Resident Confirms Completion -> CLOSED
        LiveTrackingCardDto confirmedCard = trackingService.confirmCompletion(request.getId(),
                new ConfirmCompletionRequest(5, "Excellent prompt work!"), residentUserA);
        assertEquals("CLOSED", confirmedCard.currentStatus());
        assertNotNull(requestRepository.findById(request.getId()).orElseThrow().getClosedAt());

        // Step 12: Resident Reopens Request -> REOPENED (or ASSIGNED immediately if urgent)
        LiveTrackingCardDto reopenedCard = trackingService.residentReopenRequest(request.getId(),
                "Small drip observed again after 2 hours", residentUserA);
        assertTrue("REOPENED".equals(reopenedCard.currentStatus()) || "ASSIGNED".equals(reopenedCard.currentStatus()));
    }

    @Test
    @Transactional
    void testMaintenanceManagerDashboardAndAuditedActions() {
        // Create request
        CreateMaintenanceRequestDto createDto = new CreateMaintenanceRequestDto(
                "Electrical",
                "Wiring Repair",
                "Living Room Switch Board Sparking",
                "Sparks coming from main AC switch",
                "HIGH",
                null,
                null,
                null,
                null,
                null
        );
        MaintenanceRequestResponseDto reqDto = requestService.createRequest(createDto, residentUserA);
        Long reqId = reqDto.id();

        // 1. Verify Manager Dashboard Summary (11 KPIs, Kanban, Worker Board, Analytics)
        ManagerDashboardSummaryDto summary = managerService.getDashboardSummary(managerUserA);
        assertNotNull(summary);
        assertTrue(summary.totalRequests() >= 1);
        assertNotNull(summary.kanbanColumns());
        assertTrue(summary.kanbanColumns().containsKey("NEW") || summary.kanbanColumns().containsKey("AUTO_ASSIGN_PENDING"));
        assertNotNull(summary.workerBoard());
        assertNotNull(summary.analytics());
        assertNotNull(summary.analytics().avgAssignmentTime());

        // 2. Audited Manual Action: Assign Worker
        ManagerQueueItemDto assigned = managerService.assignWorker(reqId,
                new AssignWorkerAction(workerUserA.getId(), "Direct dispatch for electrical issue"), managerUserA);
        assertEquals("ASSIGNED", assigned.status());
        assertEquals(workerUserA.getFullName(), assigned.workerName());

        // Verify audit log in MaintenanceStatusHistory
        List<MaintenanceStatusHistory> history1 = historyRepository.findByRequestIdOrderByCreatedAtAsc(reqId);
        assertTrue(history1.stream().anyMatch(h -> h.getReason().contains("Direct dispatch")));

        // 3. Audited Manual Action: Change Priority
        ManagerQueueItemDto priorityChanged = managerService.changePriority(reqId,
                new ChangePriorityAction("URGENT", "Escalated by resident phone call"), managerUserA);
        assertEquals("URGENT", priorityChanged.priority());

        // 4. Audited Manual Action: Change ETA
        LocalDateTime newEta = LocalDateTime.now().plusHours(2);
        ManagerQueueItemDto etaChanged = managerService.changeEta(reqId,
                new ChangeEtaAction(newEta, 30, "Procuring specialized copper wire"), managerUserA);
        assertNotNull(etaChanged.eta());

        // 5. Audited Manual Action: Put On Hold
        ManagerQueueItemDto onHold = managerService.putOnHold(reqId,
                new PutOnHoldAction("Waiting for power shutdown clearance"), managerUserA);
        assertEquals("ON_HOLD", onHold.status());

        // 6. Audited Manual Action: Resume
        ManagerQueueItemDto resumed = managerService.resumeRequest(reqId,
                new ResumeAction("Shutdown clearance obtained"), managerUserA);
        assertEquals("IN_PROGRESS", resumed.status());

        // 7. Audited Manual Action: Close Request
        ManagerQueueItemDto closed = managerService.closeRequest(reqId,
                new CloseRequestAction("Resolved and verified by supervisor"), managerUserA);
        assertEquals("CLOSED", closed.status());

        // Verify full audit trail has entries for all manual interventions
        List<MaintenanceStatusHistory> fullHistory = historyRepository.findByRequestIdOrderByCreatedAtAsc(reqId);
        assertTrue(fullHistory.size() >= 6);
    }

    @Test
    @Transactional
    void testMultiSocietyIsolation() {
        // Tenant A request
        CreateMaintenanceRequestDto createA = new CreateMaintenanceRequestDto(
                "Plumbing", "Tap", "Leak in A", "Description A", "MEDIUM", null, null, null, null, null
        );
        MaintenanceRequestResponseDto reqA = requestService.createRequest(createA, residentUserA);

        // Tenant B request
        CreateMaintenanceRequestDto createB = new CreateMaintenanceRequestDto(
                "Plumbing", "Tap", "Leak in B", "Description B", "MEDIUM", null, null, null, null, null
        );
        MaintenanceRequestResponseDto reqB = requestService.createRequest(createB, residentUserB);

        // Manager A (Tenant A) dashboard must only contain Tenant A requests
        ManagerDashboardSummaryDto summaryA = managerService.getDashboardSummary(managerUserA);
        List<ManagerQueueItemDto> queueA = managerService.getQueue(managerUserA, new QueueFilterParams("ALL", "ALL", "ALL", null, "ALL", null));

        assertTrue(queueA.stream().anyMatch(r -> r.requestId().equals(reqA.id())));
        assertFalse(queueA.stream().anyMatch(r -> r.requestId().equals(reqB.id())));
    }

    @Test
    void testTrackingAndManagerApiEndpoints() throws Exception {
        // 1. Manager Summary API
        mvc.perform(get("/api/maintenance/manager/summary")
                        .with(user(managerUserA.getEmail()).roles("FACILITY_MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRequests").exists())
                .andExpect(jsonPath("$.kanbanColumns").exists())
                .andExpect(jsonPath("$.workerBoard").exists())
                .andExpect(jsonPath("$.analytics").exists());

        // 2. Manager Queue API with filters
        mvc.perform(get("/api/maintenance/manager/queue?status=ALL&priority=ALL")
                        .with(user(managerUserA.getEmail()).roles("FACILITY_MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // 3. Resident Active Tracking API
        mvc.perform(get("/api/maintenance/tracking/active")
                        .with(user(residentUserA.getEmail()).roles("RESIDENT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
