package com.smartapartment.controller;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/society/gate-guards") @PreAuthorize("hasRole('SOCIETY_ADMIN')")
public class GuardDeploymentController {
 private final CurrentUserService current;private final GateRepository gates;private final SecurityGateAssignmentRepository assignments;private final AppUserRepository users;private final GuardGatePresence presence;
 public GuardDeploymentController(CurrentUserService current,GateRepository gates,SecurityGateAssignmentRepository assignments,AppUserRepository users,GuardGatePresence presence){this.current=current;this.gates=gates;this.assignments=assignments;this.users=users;this.presence=presence;}
 @GetMapping @Transactional(readOnly=true)
 public List<Map<String,Object>> list(){
  String tenant=current.requireTenantId();var assigned=assignments.findByTenantIdOrderByCreatedAtDesc(tenant);var active=presence.active(tenant);
  return gates.findByTenantIdOrderByGateNumberAsc(tenant).stream().map(gate->{
   Map<Long,Map<String,Object>> roster=new LinkedHashMap<>();
   assigned.stream().filter(a->gate.getId().equals(a.getGate().getId())&&"ACTIVE".equals(a.getStatus())).forEach(a->{Map<String,Object> guard=profile(a.getSecurityGuard());guard.put("shiftStart",a.getShiftStart());guard.put("shiftEnd",a.getShiftEnd());guard.put("presence","Assigned · not signed in");roster.put(a.getSecurityGuard().getId(),guard);});
   active.stream().filter(p->gate.getId().equals(p.gateId())).forEach(p->users.findById(p.guardId()).filter(u->tenant.equals(u.getTenantId())&&u.getRole()==UserRole.SECURITY_STAFF&&!u.isAccountLocked()).ifPresent(u->{Map<String,Object> guard=roster.computeIfAbsent(u.getId(),id->profile(u));guard.put("presence","Signed in at gate");guard.put("signedInAt",p.since());}));
   Map<String,Object> row=new LinkedHashMap<>();row.put("id",gate.getId());row.put("gateNumber",gate.getGateNumber());row.put("gateName",gate.getGateName());row.put("location",gate.getLocation());row.put("status",gate.getStatus());row.put("guards",new ArrayList<>(roster.values()));return row;
  }).toList();
 }
 private Map<String,Object> profile(AppUser user){
  Map<String,Object> m=new LinkedHashMap<>();m.put("id",user.getId());m.put("name",user.getFullName());m.put("phone",user.getPhone());m.put("email",user.getEmail());m.put("employeeId",user.getEmployeeId());m.put("designation",user.getDesignation());m.put("joiningDate",user.getJoiningDate());m.put("workShift",user.getWorkShift());m.put("address",user.getAddress());m.put("emergencyContactName",user.getEmergencyContactName());m.put("emergencyContactPhone",user.getEmergencyContactPhone());m.put("notes",user.getProfileNotes());m.put("accountStatus",user.isAccountLocked()?"Locked":user.getStatus());return m;
 }
}
