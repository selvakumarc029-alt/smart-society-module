package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/society/admin-insights")
@PreAuthorize("hasRole('SOCIETY_ADMIN')")
@Transactional(readOnly=true)
public class AdminInsightsApiController {
    private final CurrentUserService current;
    private final ApartmentRepository apartments;
    private final BlockRepository blocks;
    private final ResidentRepository residents;
    private final AppUserRepository users;
    private final WorkerAttendanceRepository attendances;
    private final StaffAttendanceRepository staffAttendance;
    private final SocietyWorkerBreakRepository breaks;
    private final MaintenanceRequestRepository requests;
    private final CommonMaintenanceTicketRepository tickets;
    private final SecurityAccessLogRepository securityLogs;
    private final MaintenanceBillRepository bills;
    private final PaymentRepository payments;
    private final NotificationRepository notifications;
    private final SocietyRentChangeRepository rents;

    static Map<String,Object> view(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    private static String text(String value){return value==null?"":value;}
    private static BigDecimal money(BigDecimal value){return value==null?BigDecimal.ZERO:value;}
    private static long minutes(LocalDateTime from,LocalDateTime to){return from==null||to==null?0:Math.max(0,Duration.between(from,to).toMinutes());}
    private List<Resident> activeResidents(String tenant) {
        return residents.findByTenantIdOrderByIdAsc(tenant).stream().filter(r->r.getUser()!=null
                && !r.getUser().isAccountLocked() && Objects.equals(tenant,r.getUser().getTenantId())
                && r.getApartment()!=null && Objects.equals(tenant,r.getApartment().getTenantId())
                && (r.getMoveInDate()==null || !r.getMoveInDate().isAfter(LocalDate.now()))).toList();
    }
    @GetMapping("/occupancy")
    public Map<String,Object> occupancy(){
        String tenant=current.requireTenantId();var people=activeResidents(tenant);
        List<Map<String,Object>> flats=new ArrayList<>();
        for(var a:apartments.findByTenantId(tenant)){
            var occupants=people.stream().filter(r->Objects.equals(r.getApartment().getId(),a.getId())).toList();
            String status=text(a.getOccupancyStatus()).toUpperCase(Locale.ROOT);
            boolean occupied=!occupants.isEmpty()||Set.of("OCCUPIED","FILLED","RENTED","OWNER_OCCUPIED","TENANT_OCCUPIED").contains(status);
            boolean unavailable=Set.of("BLOCKED","UNDER_MAINTENANCE","INACTIVE","UNAVAILABLE").contains(status);
            flats.add(view("id",a.getId(),"unitNo",a.getUnitNo(),"type",a.getUnitType(),"block",a.getBlock()==null?"Unassigned block":a.getBlock().getName(),
                    "floor",a.getFloorNo(),"status",occupied?"Filled":unavailable?"Unavailable":"Available",
                    "residents",occupants.size(),"tenants",occupants.stream().filter(r->"TENANT".equalsIgnoreCase(r.getResidentType())).count(),
                    "occupants",occupants.stream().map(r->r.getUser().getFullName()).toList(),"landlord",a.getOwnerName()));
        }
        Set<String> names=new TreeSet<>();blocks.findByTenantId(tenant).forEach(b->names.add(b.getName()));flats.forEach(f->names.add((String)f.get("block")));
        var groups=names.stream().map(name->{var rows=flats.stream().filter(f->Objects.equals(name,f.get("block"))).toList();return view("block",name,"total",rows.size(),
                "filled",rows.stream().filter(f->"Filled".equals(f.get("status"))).count(),"available",rows.stream().filter(f->"Available".equals(f.get("status"))).count(),
                "unavailable",rows.stream().filter(f->"Unavailable".equals(f.get("status"))).count(),"tenants",rows.stream().mapToLong(f->((Number)f.get("tenants")).longValue()).sum(),
                "residents",rows.stream().mapToInt(f->((Number)f.get("residents")).intValue()).sum());}).toList();
        return view("blocks",groups,"flats",flats,"totalTenants",people.stream().filter(r->"TENANT".equalsIgnoreCase(r.getResidentType())).count(),"totalResidents",people.size());
    }
    private LocalDate[] range(LocalDate start,LocalDate end){
        start=start==null?LocalDate.now():start;end=end==null?start:end;
        if(end.isBefore(start)||end.isAfter(start.plusDays(30)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a date range of up to 31 days");
        return new LocalDate[]{start,end};
    }
    @GetMapping("/maintenance")
    public Map<String,Object> maintenance(@RequestParam(required=false) LocalDate start,@RequestParam(required=false) LocalDate end){
        var dates=range(start,end);String tenant=current.requireTenantId();var workers=users.findByTenantIdAndRole(tenant,UserRole.MAINTENANCE_STAFF);
        var byId=new HashMap<Long,AppUser>();workers.forEach(w->byId.put(w.getId(),w));
        List<Map<String,Object>> rows=new ArrayList<>();
        for(var a:attendances.findByTenantIdAndDateBetweenOrderByDateDesc(tenant,dates[0],dates[1])){
            var w=byId.get(a.getWorkerId());if(w==null)continue;
            var periods=breaks.findByTenantIdAndAttendanceIdOrderByStartedAtAsc(tenant,a.getId());
            long breakMinutes=periods.isEmpty()?minutes(a.getBreakStart(),a.getBreakEnd()==null?LocalDateTime.now():a.getBreakEnd()):periods.stream().mapToLong(b->minutes(b.getStartedAt(),b.getEndedAt()==null?LocalDateTime.now():b.getEndedAt())).sum();
            long worked=Math.max(0,minutes(a.getClockIn(),a.getClockOut()==null?LocalDateTime.now():a.getClockOut())-breakMinutes);
            rows.add(view("workerId",w.getId(),"name",w.getFullName(),"date",a.getDate(),"checkIn",a.getClockIn(),"checkOut",a.getClockOut(),"status",a.getAttendanceStatus(),
                    "breakMinutes",breakMinutes,"breakCount",periods.isEmpty()?(a.getBreakStart()==null?0:1):periods.size(),"workingMinutes",worked,"notes",a.getNotes(),"breaks",periods.stream().map(b->view("start",b.getStartedAt(),"end",b.getEndedAt())).toList()));
        }
        var recorded=rows.stream().map(r->(Long)r.get("workerId")).collect(java.util.stream.Collectors.toSet());
        workers.stream().filter(w->!w.isAccountLocked()&&!recorded.contains(w.getId())).forEach(w->rows.add(view("workerId",w.getId(),"name",w.getFullName(),"date",null,"status","No attendance recorded","workingMinutes",0,"breakMinutes",0,"breakCount",0)));
        List<Map<String,Object>> reports=new ArrayList<>();
        for(var r:requests.findByTenantIdOrderByCreatedAtDesc(tenant))if(r.getAssignedWorkerId()!=null&&byId.containsKey(r.getAssignedWorkerId())&&inRange(r.getUpdatedAt(),dates))
            reports.add(view("reference",r.getRequestNumber(),"worker",byId.get(r.getAssignedWorkerId()).getFullName(),"title",r.getTitle(),"flat",r.getApartmentUnit(),"status",r.getRequestStatus(),"notes",r.getCompletionNotes(),"updatedAt",r.getUpdatedAt()));
        for(var t:tickets.findByTenantIdAndSourcePlatformIgnoreCaseOrderByCreatedAtDesc(tenant,"smartsociety"))if(t.getVendorId()!=null&&byId.containsKey(t.getVendorId())&&inRange(t.getUpdatedAt(),dates))
            reports.add(view("reference",t.getTicketCode(),"worker",byId.get(t.getVendorId()).getFullName(),"title",t.getTitle(),"flat",t.getServiceAddress(),"status",t.getTicketStatus(),"notes",text(t.getCompletionNotes()).isBlank()?t.getVendorNotes():t.getCompletionNotes(),"updatedAt",t.getUpdatedAt()));
        return view("workers",workers.stream().filter(w->!w.isAccountLocked()).count(),"attendance",rows,"reports",reports);
    }
    private boolean inRange(LocalDateTime value,LocalDate[] dates){return value!=null&&!value.toLocalDate().isBefore(dates[0])&&!value.toLocalDate().isAfter(dates[1]);}
    @GetMapping("/security")
    public Map<String,Object> security(@RequestParam(required=false) LocalDate start,@RequestParam(required=false) LocalDate end){
        var dates=range(start,end);String tenant=current.requireTenantId();
        var sessions=securityLogs.findByTenantIdAndLoginAtBetweenOrderByLoginAtDesc(tenant,dates[0].atStartOfDay(),dates[1].atTime(LocalTime.MAX)).stream()
                .map(s->view("name",s.getGuardName(),"login",s.getLoginAt(),"logout",s.getLogoutAt(),"endReason",s.getEndReason())).toList();
        var duty=staffAttendance.findByTenantIdOrderByWorkDateDesc(tenant).stream().filter(a->a.getUser()!=null&&a.getUser().getRole()==UserRole.SECURITY_STAFF
                &&Objects.equals(tenant,a.getUser().getTenantId())&&!a.getWorkDate().isBefore(dates[0])&&!a.getWorkDate().isAfter(dates[1]))
                .map(a->view("name",a.getUser().getFullName(),"date",a.getWorkDate(),"checkIn",a.getCheckInAt(),"checkOut",a.getCheckOutAt())).toList();
        return view("sessions",sessions,"attendance",duty);
    }
    private List<Map<String,Object>> dues(String tenant){
        var paid=new HashMap<Long,BigDecimal>();
        payments.findByTenantIdOrderByPaidAtDesc(tenant).stream().filter(p->p.getBill()!=null&&Objects.equals(tenant,p.getBill().getTenantId())
                &&Set.of("SUCCESS","PAID","COMPLETED","APPROVED").contains(text(p.getPaymentStatus()).toUpperCase(Locale.ROOT)))
                .forEach(p->paid.merge(p.getBill().getId(),money(p.getAmount()),BigDecimal::add));
        var flats=new LinkedHashMap<Long,Map<String,Object>>();
        for(var b:bills.findByTenantIdOrderByDueDateDesc(tenant)){
            if(b.getApartment()==null||!Objects.equals(tenant,b.getApartment().getTenantId())||Set.of("PAID","CANCELLED","VOID","WAIVED").contains(text(b.getPaymentStatus()).toUpperCase(Locale.ROOT)))continue;
            var amount=money(b.getTotalAmount()).subtract(paid.getOrDefault(b.getId(),BigDecimal.ZERO)).max(BigDecimal.ZERO);if(amount.signum()==0)continue;
            var a=b.getApartment();var row=flats.computeIfAbsent(a.getId(),id->view("apartmentId",id,"unitNo",a.getUnitNo(),"block",a.getBlock()==null?"Unassigned block":a.getBlock().getName(),"pending",BigDecimal.ZERO,"overdue",BigDecimal.ZERO,"invoices",new ArrayList<>()));
            row.put("pending",((BigDecimal)row.get("pending")).add(amount));
            if(b.getDueDate()!=null&&b.getDueDate().isBefore(LocalDate.now()))row.put("overdue",((BigDecimal)row.get("overdue")).add(amount));
            @SuppressWarnings("unchecked") var invoices=(List<Map<String,Object>>)row.get("invoices");
            invoices.add(view("id",b.getId(),"reference",b.getInvoiceNumber(),"month",b.getBillMonth(),"dueDate",b.getDueDate(),"amount",amount));
        }
        return new ArrayList<>(flats.values());
    }
    @GetMapping("/billing") public Map<String,Object> billing(){
        String tenant=current.requireTenantId();var rows=dues(tenant);
        return view("pending",rows.stream().map(r->(BigDecimal)r.get("pending")).reduce(BigDecimal.ZERO,BigDecimal::add),"overdue",rows.stream().map(r->(BigDecimal)r.get("overdue")).reduce(BigDecimal.ZERO,BigDecimal::add),"flats",rows,
                "rents",rents.findByTenantIdOrderByEffectiveDateDescIdDesc(tenant).stream().map(r->view("id",r.getId(),"apartmentId",r.getApartment().getId(),"unitNo",r.getApartment().getUnitNo(),"landlord",r.getLandlordName(),"previousRent",r.getPreviousRent(),"monthlyRent",r.getMonthlyRent(),"effectiveDate",r.getEffectiveDate(),"notes",r.getNotes())).toList());
    }
    @PostMapping("/dues/{apartmentId}/notice") @Transactional
    public Map<String,Object> notice(@PathVariable Long apartmentId){
        String tenant=current.requireTenantId();var flat=apartments.lockForAdmin(tenant,apartmentId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Flat not found"));
        var row=dues(tenant).stream().filter(r->Objects.equals(apartmentId,r.get("apartmentId"))).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"This flat has no pending dues"));
        String title="Dues reminder · "+flat.getUnitNo();
        var recipients=activeResidents(tenant).stream().filter(r->Objects.equals(apartmentId,r.getApartment().getId())).map(r->r.getUser().getId()).distinct().toList();
        if(recipients.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"No active resident account is assigned to this flat");
        int sent=0;
        for(var userId:recipients){
            if(notifications.existsByTenantIdAndUserIdAndTypeAndTitleAndCreatedAtAfter(tenant,userId,"DUE_REMINDER",title,LocalDate.now().atStartOfDay()))continue;
            var n=new Notification();n.setTenantId(tenant);n.setUserId(userId);n.setType("DUE_REMINDER");n.setTitle(title);n.setMessage("Flat "+flat.getUnitNo()+" has ₹"+row.get("pending")+" pending maintenance dues (₹"+row.get("overdue")+" overdue). Please review your invoices in Billing and submit payment proof. Contact the society office for assistance.");notifications.save(n);sent++;
        }
        return view("sent",sent,"recipients",recipients.size(),"message",sent==0?"A reminder was already sent to this flat today":"Notice delivered to "+sent+" resident account(s)");
    }
    public record RentRequest(@NotNull @DecimalMin("0.00") @Digits(integer=12,fraction=2) BigDecimal currentRent,
            @NotNull @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal newRent,@NotNull @FutureOrPresent LocalDate effectiveDate,
            @NotBlank @Size(max=200) String landlordName,@Size(max=1000) String notes,Long expectedLatestId){}
    @PostMapping("/rents/{apartmentId}") @Transactional
    public Map<String,Object> rent(@PathVariable Long apartmentId,@Valid @RequestBody RentRequest r){
        var actor=current.requireUser();String tenant=actor.getTenantId();var flat=apartments.lockForAdmin(tenant,apartmentId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Flat not found"));
        var history=rents.findByTenantIdAndApartmentIdOrderByEffectiveDateDescIdDesc(tenant,apartmentId);
        var latest=history.isEmpty()?null:history.getFirst();
        if(!Objects.equals(r.expectedLatestId(),latest==null?null:latest.getId()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Rent history changed. Refresh before saving");
        var previous=latest==null?r.currentRent():latest.getMonthlyRent();
        if(r.currentRent().compareTo(previous)!=0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Current rent does not match the latest recorded amount");
        if(r.newRent().compareTo(previous)<=0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"New rent must be greater than current rent");
        if(latest!=null&&!r.effectiveDate().isAfter(latest.getEffectiveDate()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Choose an effective date after the latest recorded rent change");
        var change=new SocietyRentChange();change.setTenantId(tenant);change.setApartment(flat);change.setPreviousRent(previous);change.setMonthlyRent(r.newRent());change.setEffectiveDate(r.effectiveDate());change.setRecordedByUserId(actor.getId());change.setLandlordName(r.landlordName().trim());change.setNotes(r.notes());rents.save(change);
        for(var userId:activeResidents(tenant).stream().filter(x->Objects.equals(apartmentId,x.getApartment().getId())).map(x->x.getUser().getId()).distinct().toList()){
            var n=new Notification();n.setTenantId(tenant);n.setUserId(userId);n.setType("RENT_CHANGE");n.setTitle("Landlord rent update · "+flat.getUnitNo());n.setMessage("Landlord "+change.getLandlordName()+": monthly rent ₹"+previous+" → ₹"+r.newRent()+" effective "+r.effectiveDate()+". This is separate from society maintenance charges. "+text(r.notes()));notifications.save(n);
        }
        return view("id",change.getId(),"message","Landlord rent change recorded; maintenance charges and existing invoices are unchanged");
    }
}
