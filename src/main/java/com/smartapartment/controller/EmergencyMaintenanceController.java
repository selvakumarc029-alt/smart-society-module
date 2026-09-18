package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.CommonMaintenanceTicketRepository;
import com.smartapartment.service.EmergencyMaintenanceService;
import com.smartapartment.service.EmergencyMaintenanceService.*;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import javax.imageio.ImageIO;
import java.io.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/maintenance/dispatch")
public class EmergencyMaintenanceController {
    private final EmergencyMaintenanceService service;
    private final CommonMaintenanceTicketRepository tickets;
    public EmergencyMaintenanceController(EmergencyMaintenanceService service,CommonMaintenanceTicketRepository tickets){this.service=service;this.tickets=tickets;}
    @GetMapping("/context")
    public Map<String,Object> context(HttpSession s,@RequestParam(defaultValue="smartsociety") String platform){
        Actor a=service.actor(s,platform);return Map.of("admin",a.admin(),"worker",a.worker(),"name",a.name(),"platform",a.platform());
    }
    @GetMapping("/hubs") public List<Map<String,Object>> hubs(HttpSession s,@RequestParam(defaultValue="smartsociety")String platform,@RequestParam(defaultValue="false") boolean all){
        Actor a=service.actor(s,platform);return service.hubsWithPartnerCounts(a, all || a.admin());
    }
    @PostMapping("/hubs") public MaintenanceHub hub(HttpSession s,@Valid @RequestBody HubInput r){return service.hub(service.actor(s,"smartsociety"),r);}
    @PutMapping("/hubs/{id}") public MaintenanceHub updateHub(HttpSession s,@PathVariable Long id,@RequestBody HubUpdateInput r){return service.updateHub(service.actor(s,"smartsociety"),id,r);}
    @PostMapping("/hubs/{id}/toggle-active") public Map<String,Object> toggleHub(HttpSession s,@PathVariable Long id){
        var h = service.toggleHubActive(service.actor(s,"smartsociety"), id);
        return Map.of("message","Hub active status updated","active",h.isActive(),"activeStatus",h.isActive()?"Active":"Inactive","status",h.getStatus());
    }
    @GetMapping("/partners") public List<Map<String,Object>> partners(HttpSession s){return service.directory(service.actor(s,"smartsociety"));}
    @PostMapping("/partners/{id}/toggle-duty")
    public Map<String,Object> toggleDuty(HttpSession s, @PathVariable Long id){
        var p = service.togglePartnerDuty(service.actor(s,"smartsociety"), id);
        return Map.of("message", "Duty status updated", "onDuty", p.isOnDuty(), "workState", p.getWorkState(), "dutyStatus", p.isOnDuty() ? "On Duty" : "Off Duty");
    }
    @PatchMapping("/partners/{id}")
    public Map<String,Object> updatePartner(HttpSession s, @PathVariable Long id, @RequestBody PartnerAdminUpdateInput r){
        var p = service.updatePartner(service.actor(s,"smartsociety"), id, r);
        return Map.of("message", "Partner profile updated", "id", p.getId(), "hubId", p.getHubId(), "trade", p.getTrade(), "employmentType", p.getEmploymentType(), "onDuty", p.isOnDuty());
    }
    @GetMapping("/worker-accounts") public List<Map<String,Object>> workers(HttpSession s){return service.workerAccounts(service.actor(s,"smartsociety"));}
    @PostMapping("/partners") public Map<String,Object> partner(HttpSession s,@Valid @RequestBody PartnerInput r){return Map.of("id",service.partner(service.actor(s,"smartsociety"),r).getId());}
    @PostMapping("/duty") public Map<String,String> duty(HttpSession s,@Valid @RequestBody DutyInput r){service.duty(service.actor(s,"smartsociety"),r);return Map.of("message","Duty status saved");}
    @GetMapping("/bookings") public List<Map<String,Object>> list(HttpSession s,@RequestParam(defaultValue="smartsociety")String platform){return service.list(service.actor(s,platform));}
    @GetMapping("/bookings/{id}") public Map<String,Object> view(HttpSession s,@PathVariable Long id,@RequestParam(defaultValue="smartsociety")String platform){return service.view(service.actor(s,platform),service.readable(service.actor(s,platform),id));}
    @PostMapping("/bookings") public Map<String,Object> create(HttpSession s,@RequestParam(defaultValue="smartsociety")String platform,@Valid @RequestBody BookingInput r){Actor a=service.actor(s,platform);return service.view(a,service.create(a,r));}
    public record Assignment(@NotNull Long partnerId){}
    @PostMapping("/bookings/{id}/assign") public Map<String,String> assign(HttpSession s,@PathVariable Long id,@Valid @RequestBody Assignment r){service.assign(service.actor(s,"smartsociety"),id,r.partnerId());return Map.of("message","Assignment offered to partner");}
    @PostMapping("/admin/assign")
    public Map<String,String> adminAssign(HttpSession s,@Valid @RequestBody AdminAssignRequest r){
        service.adminAssignPartner(service.actor(s,"smartsociety"), r.bookingId(), r.partnerId());
        return Map.of("message","Admin manually assigned partner");
    }

    @GetMapping("/admin/failed")
    public List<Map<String,Object>> failedQueue(HttpSession s){
        return service.listFailed(service.actor(s,"smartsociety"));
    }

    @GetMapping("/bookings/{id}/candidates")
    public List<Map<String,Object>> candidates(HttpSession s, @PathVariable Long id){
        return service.candidatePartnersForBooking(service.actor(s,"smartsociety"), id);
    }

    @GetMapping("/bookings/{id}/history")
    public List<Map<String,Object>> history(HttpSession s, @PathVariable Long id, @RequestParam(defaultValue="smartsociety") String platform){
        return service.history(service.actor(s, platform), id);
    }

    @GetMapping("/bookings/{id}/timeline")
    public List<Map<String,Object>> timeline(HttpSession s, @PathVariable Long id, @RequestParam(defaultValue="smartsociety") String platform){
        return service.timeline(service.actor(s, platform), id);
    }

    @GetMapping(value = "/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter streamEvents(HttpSession s, @RequestParam(defaultValue = "smartsociety") String platform) {
        return service.subscribe(service.actor(s, platform));
    }

    @GetMapping("/events")
    public List<EmergencyMaintenanceService.DispatchEvent> recentEvents(
            HttpSession s,
            @RequestParam(defaultValue = "0") long since,
            @RequestParam(defaultValue = "smartsociety") String platform) {
        service.actor(s, platform);
        return service.recentEvents(since);
    }

    public record AdminAssignRequest(@NotNull Long bookingId,@NotNull Long partnerId){}

    public record Action(@NotBlank String action, Double latitude, Double longitude, String notes){}
    @PostMapping("/bookings/{id}/action") public Map<String,String> action(HttpSession s,@PathVariable Long id,@Valid @RequestBody Action r){
        service.transition(service.actor(s,"smartsociety"), id, r.action(), r.latitude(), r.longitude(), r.notes());
        if ("CALL_CUSTOMER".equalsIgnoreCase(r.action())) {
            var b = service.readable(service.actor(s, "smartsociety"), id);
            return Map.of("message", "Call customer authorized", "phone", b.getRequesterPhone() != null ? b.getRequesterPhone() : "", "name", b.getRequesterName() != null ? b.getRequesterName() : "");
        }
        return Map.of("message","Job updated");
    }
    @PostMapping(value="/bookings/{id}/photos/{kind}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> photo(
            HttpSession s,
            @PathVariable Long id,
            @PathVariable String kind,
            @RequestParam(value="photo", required=false) MultipartFile photo,
            @RequestParam(value="file", required=false) MultipartFile file,
            @RequestParam(value="image", required=false) MultipartFile image,
            @RequestParam(value="latitude", required=false) Double latitude,
            @RequestParam(value="longitude", required=false) Double longitude) throws IOException{
        MultipartFile upload = photo != null ? photo : (file != null ? file : image);
        if(upload == null || upload.isEmpty() || upload.getSize()>5*1024*1024)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload a valid PNG or JPEG image up to 5 MB");
        byte[] input=upload.getBytes();
        // Inspect dimensions before decoding to avoid allocating an unbounded raster.
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(input))){
            var readers=ImageIO.getImageReaders(stream);
            if(!readers.hasNext())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid image");
            var reader=readers.next();
            try{reader.setInput(stream);String format=reader.getFormatName();
                if(!Set.of("JPEG","JPG","PNG").contains(format.toUpperCase(Locale.ROOT)) || (long)reader.getWidth(0)*reader.getHeight(0)>20_000_000)
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use a JPEG/PNG image under 20 megapixels");
                var output=new ByteArrayOutputStream();ImageIO.write(reader.read(0),"png",output);
                service.photo(service.actor(s,"smartsociety"),id,kind,output.toByteArray(),latitude,longitude);
            }finally{reader.dispose();}
        }
        var b = service.readable(service.actor(s, "smartsociety"), id);
        return Map.of("message","Photo saved", "kind", kind, "jobStatus", b.getJobStatus(), "photoUrl", "/api/maintenance/dispatch/bookings/" + id + "/photos/" + kind.toLowerCase(Locale.ROOT));
    }
    @GetMapping("/bookings/{id}/photos/{kind}")
    public ResponseEntity<byte[]> photo(HttpSession s,@PathVariable Long id,@PathVariable String kind,@RequestParam(defaultValue="smartsociety")String platform){
        var b=service.readable(service.actor(s,platform),id);
        byte[] bytes="before".equalsIgnoreCase(kind)?b.getBeforePhoto():"after".equalsIgnoreCase(kind)?b.getAfterPhoto():null;
        if(bytes==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Photo not available");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(bytes);
    }
    public record Review(@Min(1) @Max(5) int rating,@Size(max=1000) String review){}
    @PostMapping("/bookings/{id}/review")public Map<String,String> review(HttpSession s,@PathVariable Long id,@RequestParam(defaultValue="smartsociety")String platform,@Valid @RequestBody Review r){service.review(service.actor(s,platform),id,r.rating(),r.review());return Map.of("message","Thank you. Your sign-off and review are saved.");}
    public record ConfirmationRequest(@Size(max=1000) String notes){}
    @PostMapping({"/bookings/{id}/confirm", "/bookings/{id}/approve"})
    public Map<String,String> confirm(HttpSession s,@PathVariable Long id,@RequestParam(defaultValue="smartsociety")String platform,@RequestBody(required=false) ConfirmationRequest r){
        service.confirm(service.actor(s,platform),id,r != null ? r.notes() : null);
        return Map.of("message","Service completion confirmed. Thank you!");
    }
    @GetMapping("/bookings/{id}/review-request")
    public Map<String,Object> reviewRequest(HttpSession s,@PathVariable Long id,@RequestParam(defaultValue="smartsociety")String platform){
        return service.reviewRequest(service.actor(s,platform),id);
    }
    @PostMapping("/bookings/{id}/send-review-link")
    public Map<String,Object> resendReviewLink(HttpSession s,@PathVariable Long id){
        return service.resendReviewLink(service.actor(s,"smartsociety"), id);
    }
    @GetMapping("/reviews/pending-notifications")
    public List<Map<String,Object>> pendingReviewNotifications(HttpSession s){
        return service.pendingReviewNotifications(service.actor(s,"smartsociety"));
    }
    @GetMapping("/tickets")
    public List<CommonMaintenanceTicket> tickets(HttpSession s,@RequestParam(defaultValue="smartsociety") String platform){
        Actor a=service.actor(s,platform);
        return tickets.findAll().stream()
            .filter(t -> a.admin()
                    || (a.worker()
                        && (Objects.equals(a.id(), t.getVendorId()) || Objects.equals(a.tenant(), t.getTenantId()))
                        && ("REQUESTED".equalsIgnoreCase(String.valueOf(t.getTicketStatus()))
                            || Objects.equals(a.id(), t.getVendorId())))
                    || (!a.worker() && a.platform().equalsIgnoreCase(String.valueOf(t.getSourcePlatform()))
                        && Objects.equals(a.id(), t.getRequesterId())))
            .sorted(Comparator.comparing(CommonMaintenanceTicket::getId).reversed())
            .toList();
    }
    public record TicketInput(@NotBlank @Size(max=180)String title,@NotBlank @Size(max=3000)String description,
            @NotBlank @Size(max=600)String serviceAddress,@NotBlank @Size(max=60)String city,@NotBlank @Size(max=120)String category,
            @NotNull @Pattern(regexp="LOW|MEDIUM|HIGH")String priority,@NotBlank @Size(max=40)String phone){}
    @PostMapping("/tickets")
    public CommonMaintenanceTicket ticket(HttpSession s, @RequestParam(defaultValue="smartsociety") String platform, @Valid @RequestBody TicketInput r) {
        Actor a = service.actor(s, platform);
        return service.createAndRouteTicket(a, r.title(), r.description(), r.serviceAddress(), r.city(), r.category(), r.priority(), r.phone());
    }

    public record DutyStatusInput(String status) {}

    @GetMapping("/admin/duty-status")
    public Map<String, Object> getAdminDutyStatus(HttpSession s, @RequestParam(defaultValue="smartsociety") String platform) {
        Actor a = service.actor(s, platform);
        return Map.of("dutyStatus", service.getAdminDutyStatus(a.tenant()), "busy", service.isMaintenanceAdminBusy(a.tenant()));
    }

    @PostMapping("/admin/duty-status")
    public Map<String, Object> setAdminDutyStatus(HttpSession s, @RequestParam(defaultValue="smartsociety") String platform, @RequestBody DutyStatusInput input) {
        Actor a = service.actor(s, platform);
        service.setAdminDutyStatus(a.tenant(), input != null ? input.status() : "AVAILABLE");
        return Map.of("dutyStatus", service.getAdminDutyStatus(a.tenant()), "busy", service.isMaintenanceAdminBusy(a.tenant()));
    }

    @PostMapping("/tickets/auto-assign")
    public Map<String, Object> autoAssignTickets(HttpSession s, @RequestParam(defaultValue="smartsociety") String platform) {
        Actor a = service.actor(s, platform);
        List<CommonMaintenanceTicket> assigned = service.autoAssignOpenPool(a);
        return Map.of("assignedCount", assigned.size(), "assignedTickets", assigned);
    }

    @GetMapping("/admin/workers-status")
    public List<Map<String, Object>> getWorkersStatus(HttpSession s, @RequestParam(defaultValue="smartsociety") String platform) {
        Actor a = service.actor(s, platform);
        return service.getWorkersStatusList(a.tenant());
    }

    public record WorkerAttendanceInput(String action) {}

    @PostMapping("/admin/workers/{userId}/attendance")
    public Map<String, Object> toggleWorkerAttendance(HttpSession s, @PathVariable Long userId,
            @RequestParam(defaultValue="smartsociety") String platform,
            @RequestBody(required = false) WorkerAttendanceInput input) {
        Actor a = service.actor(s, platform);
        service.admin(a);
        String action = (input != null && input.action() != null) ? input.action() : "checkin";
        return service.toggleWorkerAttendance(userId, action, a.tenant());
    }
    public record TicketUpdate(@Pattern(regexp="REQUESTED|ASSIGNED|IN_PROGRESS|ON_HOLD|RESOLVED|CLOSED") @NotNull String status,
            @Size(max=3000)String notes,@Future LocalDateTime preferredAt,
            @Min(1) @Max(10080) Integer estimatedMinutes){}
    @PatchMapping("/tickets/{id}")
    @Transactional
    public CommonMaintenanceTicket ticket(HttpSession s,@PathVariable Long id,@Valid @RequestBody TicketUpdate r){
        Actor actor = service.actor(s,"smartsociety");
        var t = tickets.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Maintenance ticket not found"));
        boolean samePlatform = actor.platform().equalsIgnoreCase(String.valueOf(t.getSourcePlatform()));
        boolean unassignedRequest = "REQUESTED".equalsIgnoreCase(String.valueOf(t.getTicketStatus())) && t.getVendorId() == null;
        boolean assignedToWorker = Objects.equals(actor.id(), t.getVendorId());
        boolean workerCanManage = actor.worker() && (assignedToWorker || (samePlatform && Objects.equals(actor.tenant(), t.getTenantId()) && unassignedRequest));
        if (!actor.admin() && !workerCanManage) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This maintenance ticket is assigned to another worker or is not available for claim");
        }

        String nextStatus = r.status().toUpperCase(Locale.ROOT);
        String current = String.valueOf(t.getTicketStatus());
        if (Set.of("RESOLVED", "CLOSED", "INVOICED", "CANCELLED").contains(current) && !current.equals(nextStatus))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed or cancelled work cannot be restarted");
        if ("RESOLVED".equals(nextStatus) && !Set.of("IN_PROGRESS", "RESOLVED").contains(current))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Start processing the work before completing it");
        if ("IN_PROGRESS".equals(nextStatus)) {
            if (t.getWorkStartedAt() == null) t.setWorkStartedAt(LocalDateTime.now());
            if (r.estimatedMinutes() != null) t.setEstimatedCompletionAt(LocalDateTime.now().plusMinutes(r.estimatedMinutes()));
        }
        if (actor.worker() && "ASSIGNED".equals(nextStatus) && unassignedRequest) {
            t.setVendorId(actor.id());
            t.setVendorName(actor.name());
        }
        t.setTicketStatus(nextStatus);
        if (r.notes() != null && !r.notes().isBlank()) t.setVendorNotes(r.notes().trim());
        if (r.preferredAt()!=null) t.setPreferredAt(r.preferredAt());
        if (Set.of("ASSIGNED","IN_PROGRESS","ON_HOLD").contains(nextStatus) && t.getAssignedAt() == null) {
            t.setAssignedAt(LocalDateTime.now());
        }
        if (Set.of("RESOLVED","CLOSED").contains(nextStatus)) {
            t.setResolvedAt(t.getResolvedAt() == null ? LocalDateTime.now() : t.getResolvedAt());
        }
        return t;
    }
}
