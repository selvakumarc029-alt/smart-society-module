package com.smartapartment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/** Tenant-scoped record maintenance. Existing business creation routes remain authoritative. */
@RestController
@RequestMapping("/api/society/records")
@PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')")
@Transactional
public class SocietyRecordCrudController {
    private static final Map<String, Class<? extends BaseEntity>> TYPES = Map.of(
            "apartments", Apartment.class, "residents", Resident.class, "team-users", AppUser.class,
            "amenities", Amenity.class, "vendors", Vendor.class, "parking", ParkingAllocation.class,
            "events", CommunityEvent.class, "documents", SocietyDocument.class);
    private static final Set<UserRole> TEAM = Set.of(UserRole.SECURITY_STAFF, UserRole.MAINTENANCE_STAFF, UserRole.ACCOUNTANT);
    private final CurrentUserService current;
    private final EntityManager em;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final SocietyApiController society;
    private final OperationsApiController operations;
    private final AccountantActionsController accounting;

    public SocietyRecordCrudController(CurrentUserService current, EntityManager em, ObjectMapper mapper,
            Validator validator, SocietyApiController society, OperationsApiController operations,
            AccountantActionsController accounting) {
        this.current=current; this.em=em; this.mapper=mapper; this.validator=validator;
        this.society=society; this.operations=operations; this.accounting=accounting;
    }

    private Class<? extends BaseEntity> type(String resource) {
        if (current.requireUser().getRole()==UserRole.ACCOUNTANT && !"vendors".equals(resource))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the society administrator can manage these records");
        Class<? extends BaseEntity> type=TYPES.get(resource);
        if(type==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Record category was not found");
        return type;
    }

    @GetMapping("/{resource}")
    public List<Map<String,Object>> list(@PathVariable String resource) {
        Class<? extends BaseEntity> type=type(resource);
        return em.createQuery("select r from "+type.getSimpleName()+" r where r.tenantId=:tenant order by r.id desc",type)
                .setParameter("tenant",current.requireTenantId()).getResultStream()
                .filter(r->!(r instanceof AppUser u) || TEAM.contains(u.getRole())).map(this::view).toList();
    }

    @PostMapping("/{resource}")
    public Object create(@PathVariable String resource,@RequestBody Map<String,Object> input) {
        type(resource);
        writable(resource,input,true);
        return switch(resource) {
            case "apartments" -> { var r=read(input,SocietyApiController.ApartmentRequest.class); unique(Apartment.class,"unitNo",r.unitNo(),null); yield society.apartment(r); }
            case "residents" -> {var r=read(input,SocietyApiController.ResidentRequest.class);residentType(r.residentType());yield society.resident(r);}
            case "team-users" -> society.teamUser(read(input,SocietyApiController.TeamUserRequest.class));
            case "amenities" -> { var r=read(input,SocietyApiController.AmenityRequest.class); unique(Amenity.class,"name",r.name(),null); yield society.amenity(r); }
            case "vendors" -> accounting.createVendor(read(input,AccountantActionsController.VendorInput.class));
            case "parking" -> { var r=read(input,OperationsApiController.ParkingRequest.class); unique(ParkingAllocation.class,"slotNumber",r.slot(),null); yield operations.parking(r); }
            case "events" -> operations.event(read(input,OperationsApiController.EventRequest.class));
            case "documents" -> { var r=read(input,OperationsApiController.DocumentRequest.class); safeUrl(r.storageUrl()); yield operations.document(r); }
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        };
    }

    @PatchMapping("/{resource}/{id}")
    public Map<String,Object> update(@PathVariable String resource,@PathVariable Long id,
            @RequestHeader(value="If-Match",required=false) String expected,@RequestBody Map<String,Object> input) {
        BaseEntity entity=record(resource,id,expected);
        writable(resource,input,false);
        Map<String,Object> merged=new LinkedHashMap<>(view(entity));
        merged.putAll(input);
        input=merged;
        switch(resource) {
            case "apartments" -> {
                var r=read(input,SocietyApiController.ApartmentRequest.class);
                unique(Apartment.class,"unitNo",r.unitNo(),id);
                society.updateApartment(id,r);
            }
            case "amenities" -> {
                var r=read(input,SocietyApiController.AmenityRequest.class);
                unique(Amenity.class,"name",r.name(),id); society.updateAmenity(id,r);
            }
            case "vendors" -> {
                var r=read(input,AccountantActionsController.VendorInput.class); Vendor v=(Vendor)entity;
                v.setName(r.name().trim());v.setServiceCategory(r.category().trim());v.setPhone(r.phone().trim());
                v.setEmail(clean(r.email()));v.setTaxNumber(clean(r.taxNumber()));
            }
            case "parking" -> {
                var r=read(input,OperationsApiController.ParkingRequest.class); ParkingAllocation p=(ParkingAllocation)entity;
                unique(ParkingAllocation.class,"slotNumber",r.slot(),id);p.setSlotNumber(r.slot().trim());
                p.setApartment(apartment(r.unitNo()));p.setVehicleNumber(clean(r.vehicleNumber()));p.setVehicleType(clean(r.vehicleType()));
            }
            case "events" -> {
                var r=read(input,OperationsApiController.EventRequest.class);
                if(!r.endsAt().isAfter(r.startsAt()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Event end must be after start");
                CommunityEvent e=(CommunityEvent)entity;e.setTitle(r.title().trim());e.setDescription(clean(r.description()));
                e.setVenue(r.venue().trim());e.setStartsAt(r.startsAt());e.setEndsAt(r.endsAt());
            }
            case "documents" -> {
                var r=read(input,OperationsApiController.DocumentRequest.class);safeUrl(r.storageUrl());
                SocietyDocument d=(SocietyDocument)entity;d.setName(r.name().trim());d.setCategory(r.category().trim());
                d.setContentType(r.contentType().trim());d.setStorageUrl(r.storageUrl().trim());
            }
            case "residents", "team-users" -> {
                var r=read(input,AccountEdit.class); AppUser u=entity instanceof Resident resident?resident.getUser():(AppUser)entity;
                u.setFullName(r.name().trim());u.setPhone(clean(r.phone()));u.setAddress(clean(r.address()));
                u.setEmergencyContactName(clean(r.emergencyContactName()));u.setEmergencyContactPhone(clean(r.emergencyContactPhone()));u.setProfileNotes(clean(r.notes()));
                // Login identity, passwords and roles are intentionally managed by the existing account flows.
                if(entity instanceof Resident resident){
                    residentType(r.residentType());
                    resident.setApartment(apartment(r.unitNo()));resident.setResidentType(r.residentType().trim().toUpperCase(Locale.ROOT));
                    resident.setMoveInDate(r.moveInDate());resident.setVehicleNumber(clean(r.vehicleNumber()));
                }else {u.setDesignation(clean(r.designation()));u.setEmployeeId(clean(r.employeeId()));u.setJoiningDate(r.joiningDate());u.setWorkShift(clean(r.workShift()));}
            }
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        em.flush();return view(entity);
    }

    @DeleteMapping("/{resource}/{id}")
    public Map<String,Object> delete(@PathVariable String resource,@PathVariable Long id,
            @RequestHeader(value="If-Match",required=false)String expected) {
        BaseEntity entity=record(resource,id,expected);
        if(entity instanceof AppUser || entity instanceof Resident) {
            AppUser user=entity instanceof Resident r?r.getUser():(AppUser)entity;
            if(Objects.equals(user.getId(),current.requireUser().getId()))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"You cannot deactivate your own account");
            user.setAccountLocked(true);user.setStatus("INACTIVE");user.setAccessRevokedAt(LocalDateTime.now());entity.setStatus("INACTIVE");
            em.flush();return Map.of("id",id,"message","Account deactivated. Its history has been preserved.");
        }
        em.remove(entity);em.flush();return Map.of("id",id,"message","Record deleted");
    }

    @GetMapping("/{resource}/{id}")
    public Map<String,Object> get(@PathVariable String resource,@PathVariable Long id){return view(find(resource,id));}

    private BaseEntity find(String resource,Long id) {
        Class<? extends BaseEntity> type=type(resource);
        BaseEntity r=em.createQuery("select r from "+type.getSimpleName()+" r where r.id=:id and r.tenantId=:tenant",type)
                .setParameter("id",id).setParameter("tenant",current.requireTenantId()).getResultStream().findFirst()
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Record was not found"));
        if(r instanceof AppUser u && !TEAM.contains(u.getRole()))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Record was not found");
        return r;
    }
    private BaseEntity record(String resource,Long id,String expected) {
        BaseEntity r=find(resource,id);
        if(expected==null)throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,"Refresh this record before changing it");
        if(!version(r).equals(expected.replace("\"","")))throw new ResponseStatusException(HttpStatus.CONFLICT,"This record changed. Refresh it before saving or deleting.");
        em.lock(r,LockModeType.OPTIMISTIC);
        if(r instanceof Resident resident)em.lock(resident.getUser(),LockModeType.OPTIMISTIC);
        return r;
    }

    private String version(BaseEntity r){return r.getVersion()+(r instanceof Resident resident?"-"+resident.getUser().getVersion():"");}
    private void unique(Class<?> type,String field,String value,Long excluding) {
        String query="select count(r) from "+type.getSimpleName()+" r where r.tenantId=:tenant and lower(trim(r."+field+"))=:value"+(excluding==null?"":" and r.id<>:id");
        var q=em.createQuery(query,Long.class).setParameter("tenant",current.requireTenantId()).setParameter("value",clean(value).toLowerCase(Locale.ROOT));
        if(excluding!=null)q.setParameter("id",excluding);
        if(q.getSingleResult()>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"A record with this "+field+" already exists");
    }
    private Apartment apartment(String unit){return em.createQuery("select a from Apartment a where a.tenantId=:tenant and lower(trim(a.unitNo))=:unit",Apartment.class)
            .setParameter("tenant",current.requireTenantId()).setParameter("unit",clean(unit).toLowerCase(Locale.ROOT)).getResultStream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an existing flat in this society"));}
    private <T>T read(Map<String,Object> input,Class<T> type){
        final T request;
        Map<String,Object> normalized=new LinkedHashMap<>(input);
        normalized.replaceAll((key,value)->value instanceof String text&&!key.equals("temporaryPassword")?text.trim():value);
        try{request=mapper.convertValue(normalized,type);}catch(IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter valid field values and dates");}
        for(var component:type.getRecordComponents()){
            Object value=input.get(component.getName());
            int maximum=component.getName().equals("description")?2000:component.getName().equals("notes")&&type==SocietyApiController.ApartmentRequest.class?1000:255;
            if(value instanceof String text && text.length()>maximum)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,component.getName()+": value is too long");
        }
        var violations=validator.validate(request);
        if(!violations.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,violations.stream().sorted(Comparator.comparing(v->v.getPropertyPath().toString())).map(v->v.getPropertyPath()+": "+v.getMessage()).findFirst().orElse("Invalid fields"));
        return request;
    }
    private static String clean(String v){return v==null?"":v.trim();}
    private void writable(String resource,Map<String,Object> input,boolean creating){
        Class<?> request=switch(resource){
            case "apartments" -> SocietyApiController.ApartmentRequest.class;
            case "amenities" -> SocietyApiController.AmenityRequest.class;
            case "vendors" -> AccountantActionsController.VendorInput.class;
            case "parking" -> OperationsApiController.ParkingRequest.class;
            case "events" -> OperationsApiController.EventRequest.class;
            case "documents" -> OperationsApiController.DocumentRequest.class;
            case "residents" -> creating?SocietyApiController.ResidentRequest.class:AccountEdit.class;
            case "team-users" -> creating?SocietyApiController.TeamUserRequest.class:AccountEdit.class;
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        };
        Set<String> allowed=new HashSet<>();for(var component:request.getRecordComponents())allowed.add(component.getName());
        if(!allowed.containsAll(input.keySet()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The request contains an unknown or read-only field");
    }
    private static void residentType(String value){if(!Set.of("OWNER","TENANT","FAMILY_MEMBER","FAMILY").contains(clean(value).toUpperCase(Locale.ROOT)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a valid resident type");}
    private static void safeUrl(String raw){String url=clean(raw);if(url.matches(".*[\\\\\\x00-\\x20].*")||(!(url.startsWith("/")&&!url.startsWith("//"))&&!url.matches("(?i)^https?://[^\\s]+$")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use a local document path or an HTTP/HTTPS URL");}
    private Map<String,Object> view(BaseEntity r){
        Map<String,Object> v=new LinkedHashMap<>();v.put("id",r.getId());v.put("version",version(r));v.put("status",r.getStatus());
        if(r instanceof Apartment a){v.putAll(values("unitNo",a.getUnitNo(),"block",a.getBlock()==null?"":a.getBlock().getName(),"floor",a.getFloorNo(),"unitType",a.getUnitType(),"occupancy",a.getOccupancyStatus(),"ownerName",a.getOwnerName(),"ownerPhone",a.getOwnerPhone(),"ownerEmail",a.getOwnerEmail(),"builtUpAreaSqFt",a.getBuiltUpAreaSqFt(),"parkingSlot",a.getParkingSlot(),"monthlyMaintenance",a.getMonthlyMaintenance(),"possessionDate",a.getPossessionDate(),"notes",a.getNotes()));}
        else if(r instanceof Resident || r instanceof AppUser){
            AppUser u=r instanceof Resident resident?resident.getUser():(AppUser)r;
            v.putAll(values("name",u.getFullName(),"email",u.getEmail(),"phone",u.getPhone(),"role",u.getRole(),"address",u.getAddress(),"emergencyContactName",u.getEmergencyContactName(),"emergencyContactPhone",u.getEmergencyContactPhone(),"notes",u.getProfileNotes(),"designation",u.getDesignation(),"employeeId",u.getEmployeeId(),"joiningDate",u.getJoiningDate(),"workShift",u.getWorkShift(),"accountLocked",u.isAccountLocked()));
            if(r instanceof Resident resident)v.putAll(values("unitNo",resident.getApartment().getUnitNo(),"residentType",resident.getResidentType(),"moveInDate",resident.getMoveInDate(),"vehicleNumber",resident.getVehicleNumber()));
        }else if(r instanceof ParkingAllocation p)v.putAll(values("slot",p.getSlotNumber(),"unitNo",p.getApartment().getUnitNo(),"vehicleNumber",p.getVehicleNumber(),"vehicleType",p.getVehicleType()));
        else if(r instanceof Vendor vendor)v.putAll(values("name",vendor.getName(),"category",vendor.getServiceCategory(),"phone",vendor.getPhone(),"email",vendor.getEmail(),"taxNumber",vendor.getTaxNumber()));
        else { Map<String,Object> fields=mapper.convertValue(r,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});fields.remove("tenantId");v.putAll(fields);v.put("version",version(r)); }
        return v;
    }
    private static Map<String,Object> values(Object... fields){Map<String,Object> v=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)v.put((String)fields[i],fields[i+1]);return v;}
    public record AccountEdit(@NotBlank @Size(max=255)String name,@Size(max=255)String phone,@Size(max=255)String address,
            @Size(max=255)String emergencyContactName,@Size(max=255)String emergencyContactPhone,@Size(max=255)String notes,
            String unitNo,String residentType,LocalDate moveInDate,String vehicleNumber,String designation,String employeeId,LocalDate joiningDate,String workShift){}
}
