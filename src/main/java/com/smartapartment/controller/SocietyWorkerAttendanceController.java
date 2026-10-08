package com.smartapartment.controller;

import com.smartapartment.dto.WorkerAttendanceDtos.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;

/** Adds Society break history around the existing attendance workflow. */
@RestController @RequiredArgsConstructor
@RequestMapping("/api/society/workforce/attendance")
@PreAuthorize("hasRole('MAINTENANCE_STAFF')")
public class SocietyWorkerAttendanceController {
    private final CurrentUserService current;
    private final WorkerAttendanceService service;
    private final WorkerAttendanceRepository attendance;
    private final SocietyWorkerBreakRepository breaks;
    private final AppUserRepository users;

    public record AttendanceActionRequest(String shiftId,String notes){}

    @PostMapping("/{action}") @Transactional
    public WorkerAttendanceResponseDto action(@PathVariable String action,@RequestBody(required=false) AttendanceActionRequest body){
        AppUser user=current.requireUser();users.lockAttendanceUser(user.getId()).orElseThrow();
        var notes=body==null?null:body.notes();var request=new BreakRequest(notes);
        var existing=attendance.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(user.getId(),LocalDate.now()).orElse(null);
        if(existing!=null&&!java.util.Objects.equals(user.getTenantId(),existing.getTenantId()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Attendance belongs to another society");
        if("clock-in".equals(action)){
            if(existing!=null&&existing.getClockIn()!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"Today's attendance is already recorded");
            return service.clockIn(user,new ClockInRequest(body==null?null:body.shiftId(),notes));
        }
        if(existing==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Clock in first");
        if(existing.getClockOut()!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"Today's shift is already checked out");
        WorkerAttendanceResponseDto result;
        if("break-start".equals(action)){
            if(existing.getBreakStart()!=null&&existing.getBreakEnd()!=null&&breaks.findByTenantIdAndAttendanceIdOrderByStartedAtAsc(user.getTenantId(),existing.getId()).isEmpty()){
                var legacy=new SocietyWorkerBreak();legacy.setTenantId(user.getTenantId());legacy.setAttendanceId(existing.getId());legacy.setWorkerId(user.getId());legacy.setStartedAt(existing.getBreakStart());legacy.setEndedAt(existing.getBreakEnd());breaks.save(legacy);
            }
            result=service.startBreak(user,request);
            var period=new SocietyWorkerBreak();period.setTenantId(user.getTenantId());period.setAttendanceId(existing.getId());period.setWorkerId(user.getId());period.setStartedAt(result.breakStart());breaks.save(period);
        }else if("break-end".equals(action)||"clock-out".equals(action)){
            result="break-end".equals(action)?service.endBreak(user,request):service.clockOut(user,new ClockOutRequest(notes));
            if(result.breakEnd()!=null){
                var history=breaks.findByTenantIdAndAttendanceIdOrderByStartedAtAsc(user.getTenantId(),existing.getId());
                var open=history.stream().filter(b->b.getEndedAt()==null).findFirst();
                if(open.isPresent()){open.get().setEndedAt(result.breakEnd());breaks.save(open.get());}
                else if(history.isEmpty()&&result.breakStart()!=null){var period=new SocietyWorkerBreak();period.setTenantId(user.getTenantId());period.setAttendanceId(existing.getId());period.setWorkerId(user.getId());period.setStartedAt(result.breakStart());period.setEndedAt(result.breakEnd());breaks.save(period);}
            }
        }else throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported attendance action");
        if("clock-out".equals(action)){
            long paused=breaks.findByTenantIdAndAttendanceIdOrderByStartedAtAsc(user.getTenantId(),existing.getId()).stream().filter(b->b.getEndedAt()!=null).mapToLong(b->Math.max(0,Duration.between(b.getStartedAt(),b.getEndedAt()).toMinutes())).sum();
            existing.setTotalWorkingMinutes((int)Math.max(0,Duration.between(existing.getClockIn(),existing.getClockOut()).toMinutes()-paused));
            result=WorkerAttendanceResponseDto.from(attendance.save(existing),user.getFullName());
        }
        return result;
    }
}
