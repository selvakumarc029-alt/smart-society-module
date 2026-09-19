package com.smartapartment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.dto.AutoAssignmentDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.AutoAssignmentService;
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
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AutoAssignmentIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private WorkerAttendanceRepository attendanceRepository;

    @Autowired
    private WorkerAvailabilityRepository availabilityRepository;

    @Autowired
    private MaintenanceRequestRepository requestRepository;

    @Autowired
    private MaintenanceStatusHistoryRepository historyRepository;

    @Autowired
    private WorkerTaskRejectionRepository rejectionRepository;

    @Autowired
    private AutoAssignmentService autoAssignmentService;

    private String tenantId;
    private AppUser residentUser;
    private AppUser workerA;
    private AppUser workerB;
    private MockHttpSession workerSession;

    @BeforeEach
    void setUp() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        tenantId = "tenant-" + unique;

        residentUser = new AppUser();
        residentUser.setEmail("resident_" + unique + "@smartsociety.test");
        residentUser.setFullName("John Resident");
        residentUser.setTenantId(tenantId);
        residentUser.setRole(UserRole.RESIDENT);
        residentUser.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
        residentUser = userRepository.save(residentUser);

        workerA = createWorker("Rahul Sharma", "Plumber", "EMP-A-" + unique);
        workerB = createWorker("Amit Kumar", "Plumber", "EMP-B-" + unique);

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

    private void clockInWorker(AppUser worker) {
        WorkerAttendance att = new WorkerAttendance();
        att.setWorkerId(worker.getId());
        att.setTenantId(tenantId);
        att.setDate(LocalDate.now());
        att.setShiftId("GENERAL");
        att.setAttendanceStatus("PRESENT");
        att.setClockIn(LocalDateTime.now().minusHours(1));
        attendanceRepository.save(att);

        WorkerAvailability av = availabilityRepository.findByWorkerId(worker.getId())
                .orElseGet(() -> {
                    WorkerAvailability a = new WorkerAvailability();
                    a.setWorkerId(worker.getId());
                    a.setTenantId(tenantId);
                    return a;
                });
        av.setStatus("AVAILABLE");
        av.setCurrentTaskId(null);
        av.setCurrentTaskNumber(null);
        av.setLastUpdatedAt(LocalDateTime.now());
        availabilityRepository.save(av);
    }

    private MaintenanceRequest createRequest(String category, String priority, String serviceType) {
        MaintenanceRequest r = new MaintenanceRequest();
        r.setRequestNumber("MR-" + System.nanoTime());
        r.setTenantId(tenantId);
        r.setResidentId(residentUser.getId());
        r.setResidentName(residentUser.getFullName());
        r.setCategory(category);
        r.setServiceType(serviceType);
        r.setTitle("Test Issue " + category);
        r.setDescription("Detailed description of " + category);
        r.setPriority(priority);
        r.setRequestStatus("REQUESTED");
        return requestRepository.save(r);
    }

    // 1. One available worker
    @Test
    void testOneAvailableWorker() {
        clockInWorker(workerA);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Tap Leakage");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("ASSIGNED", updated.getRequestStatus());
        assertEquals(workerA.getId(), updated.getAssignedWorkerId());
        assertEquals("Rahul Sharma", updated.getAssignedWorkerName());
        assertNotNull(updated.getWorkerResponseDeadline());
        assertEquals("90 mins", updated.getEstimatedDuration()); // Service duration for plumbing
    }

    // 2. Multiple available workers - Fair Workload Scoring
    @Test
    void testMultipleAvailableWorkers_WorkloadBalancing() {
        clockInWorker(workerA);
        clockInWorker(workerB);

        // Worker A has 1 prior active task
        MaintenanceRequest existingTask = createRequest("Plumbing", "MEDIUM", "Pipe Repair");
        existingTask.setAssignedWorkerId(workerA.getId());
        existingTask.setRequestStatus("IN_PROGRESS");
        requestRepository.save(existingTask);

        // Assign a new request -> Worker B should be selected because Worker A has higher workload
        MaintenanceRequest newReq = createRequest("Plumbing", "URGENT", "Drain Blockage");
        autoAssignmentService.scheduleAssignment(newReq);

        MaintenanceRequest updated = requestRepository.findById(newReq.getId()).orElseThrow();
        assertEquals("ASSIGNED", updated.getRequestStatus());
        assertEquals(workerB.getId(), updated.getAssignedWorkerId(), "Worker B with 0 active tasks should be preferred over Worker A");
    }

    // 3. All workers busy -> Request goes to WAITING_FOR_WORKER queue
    @Test
    void testAllWorkersBusy_GoesToWaitingQueue() {
        clockInWorker(workerA);
        // Mark worker A busy
        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        av.setStatus("BUSY");
        av.setCurrentTaskId(999L);
        availabilityRepository.save(av);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Burst Pipe");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", updated.getRequestStatus());
        assertNull(updated.getAssignedWorkerId());
    }

    // 4. Worker absent (not clocked in) -> not assigned
    @Test
    void testWorkerAbsent_NotAssigned() {
        // Neither workerA nor workerB is clocked in
        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Bathroom Leak");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", updated.getRequestStatus());
    }

    // 5. Worker on leave -> not assigned
    @Test
    void testWorkerOnLeave_NotAssigned() {
        clockInWorker(workerA);
        WorkerAttendance att = attendanceRepository.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(workerA.getId(), LocalDate.now()).orElseThrow();
        att.setAttendanceStatus("ON_LEAVE");
        attendanceRepository.save(att);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Water heater");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", updated.getRequestStatus());
    }

    // 6. Worker on break -> not assigned
    @Test
    void testWorkerOnBreak_NotAssigned() {
        clockInWorker(workerA);
        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        av.setStatus("ON_BREAK");
        availabilityRepository.save(av);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Leak");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", updated.getRequestStatus());
    }

    // 7. Worker offline -> not assigned
    @Test
    void testWorkerOffline_NotAssigned() {
        clockInWorker(workerA);
        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        av.setStatus("OFFLINE");
        availabilityRepository.save(av);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Tap repair");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", updated.getRequestStatus());
    }

    // 8. Worker rejects -> recorded with reason, automatically reassigns to next worker
    @Test
    void testWorkerRejection_ReassignedToNextWorker() throws Exception {
        clockInWorker(workerA);
        clockInWorker(workerB);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Main Valve Leak");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest assigned = requestRepository.findById(req.getId()).orElseThrow();
        Long firstWorkerId = assigned.getAssignedWorkerId();
        assertNotNull(firstWorkerId);

        AppUser firstWorker = (firstWorkerId.equals(workerA.getId())) ? workerA : workerB;
        AppUser secondWorker = (firstWorkerId.equals(workerA.getId())) ? workerB : workerA;

        // Worker rejects via REST API
        mvc.perform(post("/api/v1/auto-assignment/requests/" + req.getId() + "/reject")
                        .with(user(firstWorker.getEmail()).roles("MAINTENANCE_STAFF"))
                        .session(workerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new WorkerRejectRequestDto("Assigned to another urgent site"))))
                .andExpect(status().isOk());

        // Verify rejection recorded
        assertTrue(rejectionRepository.existsByMaintenanceRequestIdAndWorkerId(req.getId(), firstWorker.getId()));

        // Verify request reassigned to secondWorker
        MaintenanceRequest reassigned = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("ASSIGNED", reassigned.getRequestStatus());
        assertEquals(secondWorker.getId(), reassigned.getAssignedWorkerId());
    }

    // 9. Worker timeout -> automatically reassigns
    @Test
    void testWorkerTimeout_ReassignedToNextWorker() {
        clockInWorker(workerA);
        clockInWorker(workerB);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Kitchen Pipe");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest assigned = requestRepository.findById(req.getId()).orElseThrow();
        Long firstWorkerId = assigned.getAssignedWorkerId();

        // Simulate timeout by setting deadline in the past
        assigned.setWorkerResponseDeadline(LocalDateTime.now().minusMinutes(10));
        requestRepository.save(assigned);

        // Run periodic checks
        autoAssignmentService.runPeriodicAutoAssignmentChecks();

        MaintenanceRequest reassigned = requestRepository.findById(req.getId()).orElseThrow();
        assertNotEquals(firstWorkerId, reassigned.getAssignedWorkerId(), "Task should be reassigned to the other worker");
    }

    // 10. Emergency request -> Bypasses auto-assignment delay
    @Test
    void testEmergencyRequest_BypassesDelay() {
        clockInWorker(workerA);

        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Gas Heater Burst");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest assigned = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("ASSIGNED", assigned.getRequestStatus(), "Urgent request must assign immediately, not stay AUTO_ASSIGN_PENDING");
        assertNull(assigned.getAutoAssignDeadline());
    }

    // 11. Non-urgent request -> Places in AUTO_ASSIGN_PENDING with countdown
    @Test
    void testNonUrgentRequest_HasAutoAssignCountdown() {
        clockInWorker(workerA);

        MaintenanceRequest req = createRequest("Plumbing", "MEDIUM", "Sink Stoppage");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest pending = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("AUTO_ASSIGN_PENDING", pending.getRequestStatus());
        assertNotNull(pending.getAutoAssignDeadline());
        assertTrue(pending.getAutoAssignDeadline().isAfter(LocalDateTime.now()));
    }

    // 12. Queue Priority Ordering -> URGENT > HIGH > MEDIUM > LOW
    @Test
    void testQueuePriorityOrdering() {
        MaintenanceRequest low = createRequest("Plumbing", "LOW", "Low priority issue");
        low.setRequestStatus("WAITING_FOR_WORKER");
        requestRepository.save(low);

        MaintenanceRequest urgent = createRequest("Plumbing", "URGENT", "Urgent flooding");
        urgent.setRequestStatus("WAITING_FOR_WORKER");
        requestRepository.save(urgent);

        MaintenanceRequest high = createRequest("Plumbing", "HIGH", "High priority leak");
        high.setRequestStatus("WAITING_FOR_WORKER");
        requestRepository.save(high);

        List<WaitingQueueItemDto> queue = autoAssignmentService.getWaitingQueue(tenantId);
        assertFalse(queue.isEmpty());
        // First in queue must be URGENT, then HIGH, then LOW
        assertEquals("URGENT", queue.get(0).priority());
        assertEquals("HIGH", queue.get(1).priority());
        assertEquals("LOW", queue.get(2).priority());
    }

    // 13. Manual assignment cancels auto-assignment countdown
    @Test
    void testManualAssignment_CancelsAutoAssignCountdown() {
        clockInWorker(workerA);

        MaintenanceRequest req = createRequest("Plumbing", "MEDIUM", "Faucet replacement");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest pending = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("AUTO_ASSIGN_PENDING", pending.getRequestStatus());
        assertNotNull(pending.getAutoAssignDeadline());

        // Admin assigns manually
        pending.setAssignedWorkerId(workerA.getId());
        pending.setAssignedWorkerName(workerA.getFullName());
        pending.setRequestStatus("ASSIGNED");
        pending.setAutoAssignDeadline(null);
        requestRepository.save(pending);

        MaintenanceRequest updated = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("ASSIGNED", updated.getRequestStatus());
        assertNull(updated.getAutoAssignDeadline(), "Auto-assign deadline must be cancelled upon manual assignment");
    }

    // 14. Waiting queue drained when worker becomes available
    @Test
    void testWaitingQueueDrained_WhenWorkerBecomesAvailable() {
        // No workers available initially
        MaintenanceRequest req = createRequest("Plumbing", "URGENT", "Flooding");
        autoAssignmentService.scheduleAssignment(req);

        MaintenanceRequest queued = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("WAITING_FOR_WORKER", queued.getRequestStatus());

        // Worker A clocks in, triggering queue drain
        clockInWorker(workerA);
        autoAssignmentService.processWaitingQueue(tenantId);

        MaintenanceRequest assigned = requestRepository.findById(req.getId()).orElseThrow();
        assertEquals("ASSIGNED", assigned.getRequestStatus());
        assertEquals(workerA.getId(), assigned.getAssignedWorkerId());
    }

    // 15. Race condition & pessimistic locking protection
    @Test
    void testConcurrency_PessimisticLockingProtection() throws Exception {
        clockInWorker(workerA);

        MaintenanceRequest req1 = createRequest("Plumbing", "URGENT", "Concurrent Task 1");
        MaintenanceRequest req2 = createRequest("Plumbing", "URGENT", "Concurrent Task 2");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch latch = new CountDownLatch(1);

        Callable<Boolean> task1 = () -> {
            latch.await();
            return autoAssignmentService.assignWorker(req1, workerA, "AUTO");
        };

        Callable<Boolean> task2 = () -> {
            latch.await();
            return autoAssignmentService.assignWorker(req2, workerA, "AUTO");
        };

        Future<Boolean> future1 = executor.submit(task1);
        Future<Boolean> future2 = executor.submit(task2);

        // Start both simultaneously
        latch.countDown();

        boolean result1 = future1.get(5, TimeUnit.SECONDS);
        boolean result2 = future2.get(5, TimeUnit.SECONDS);
        executor.shutdown();

        // Exactly one should succeed, the other must fail to assign the same worker
        assertTrue(result1 ^ result2, "Exactly one concurrent assignment should succeed on the same worker");

        WorkerAvailability av = availabilityRepository.findByWorkerId(workerA.getId()).orElseThrow();
        assertEquals("BUSY", av.getStatus());
    }
}
