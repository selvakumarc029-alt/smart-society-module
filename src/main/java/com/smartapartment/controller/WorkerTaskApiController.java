package com.smartapartment.controller;

import com.smartapartment.dto.WorkerTaskDtos.*;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.WorkerTaskService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class WorkerTaskApiController {

    private final WorkerTaskService workerTaskService;
    private final CurrentUserService currentUserService;
    private final AppUserRepository userRepository;

    public WorkerTaskApiController(
            WorkerTaskService workerTaskService,
            CurrentUserService currentUserService,
            AppUserRepository userRepository) {
        this.workerTaskService = workerTaskService;
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
    }

    private AppUser resolveActiveUser(HttpSession session) {
        try {
            return currentUserService.requireUser();
        } catch (Exception e) {
            if (session != null && (Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))
                    || Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin")))) {
                return userRepository.findByEmail("worker@smartsociety")
                        .or(() -> userRepository.findByEmail("worker@smartapartment"))
                        .or(() -> userRepository.findAll().stream()
                                .filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF)
                                .findFirst())
                        .orElse(null);
            }
            return null;
        }
    }

    private AppUser requireWorkerUser(HttpSession session) {
        AppUser user = resolveActiveUser(session);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required.");
        }
        if (user.getRole() != UserRole.MAINTENANCE_STAFF && user.getRole() != UserRole.SUPER_ADMIN && user.getRole() != UserRole.SOCIETY_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only maintenance personnel can perform this action.");
        }
        return user;
    }

    @PostMapping("/api/maintenance/tasks/{id}/accept")
    public ResponseEntity<WorkerTaskDetailDto> acceptTask(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.acceptTask(id, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/travel")
    public ResponseEntity<WorkerTaskDetailDto> startTravel(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.startTravel(id, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/arrive")
    public ResponseEntity<WorkerTaskDetailDto> arriveAtLocation(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.arriveAtLocation(id, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/start")
    public ResponseEntity<WorkerTaskDetailDto> startWork(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.startWork(id, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/pause")
    public ResponseEntity<WorkerTaskDetailDto> pauseWork(
            @PathVariable Long id,
            @RequestBody(required = false) PauseTaskRequestDto dto,
            HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.pauseWork(id, dto, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/resume")
    public ResponseEntity<WorkerTaskDetailDto> resumeWork(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.resumeWork(id, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/complete")
    public ResponseEntity<WorkerTaskDetailDto> completeWork(
            @PathVariable Long id,
            @Valid @RequestBody CompleteTaskRequestDto dto,
            HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.completeWork(id, dto, worker));
    }

    @PostMapping("/api/maintenance/tasks/{id}/delay")
    public ResponseEntity<WorkerTaskDetailDto> delayTask(
            @PathVariable Long id,
            @Valid @RequestBody DelayTaskRequestDto dto,
            HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.delayTask(id, dto, worker));
    }

    @GetMapping("/api/workers/me/tasks")
    public ResponseEntity<WorkerMyTasksResponseDto> getMyTasks(HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.getMyTasks(worker));
    }

    @GetMapping("/api/maintenance/tasks/{id}")
    public ResponseEntity<WorkerTaskDetailDto> getTaskDetails(@PathVariable Long id, HttpSession session) {
        AppUser worker = requireWorkerUser(session);
        return ResponseEntity.ok(workerTaskService.getTaskDetails(id, worker));
    }
}
