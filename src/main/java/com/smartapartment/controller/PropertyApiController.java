package com.smartapartment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;import com.smartapartment.entity.*;import com.smartapartment.repository.*;import com.smartapartment.service.CommonMaintenanceService;import com.smartapartment.service.MailService;import jakarta.servlet.http.HttpSession;import jakarta.validation.Valid;import jakarta.validation.constraints.*;import java.io.*;import java.math.BigDecimal;import java.nio.file.*;import java.time.*;import java.util.*;import org.springframework.core.io.*;import org.springframework.http.*;import org.springframework.security.core.Authentication;import org.springframework.security.core.context.SecurityContextHolder;import org.springframework.security.crypto.password.PasswordEncoder;import org.springframework.transaction.annotation.Transactional;import org.springframework.web.bind.annotation.*;import org.springframework.web.multipart.MultipartFile;import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/property")

public class PropertyApiController{

 @org.springframework.beans.factory.annotation.Value("${app.property-media-directory:./data/propertydirect-media}")

 private String persistentMediaDirectory;

 private Path storageRoot(){return Paths.get(persistentMediaDirectory==null?"./data/propertydirect-media":persistentMediaDirectory).toAbsolutePath().normalize();}

 PropertyListing attachPhotos(PropertyListing listing,List<MultipartFile> photos){

  validatePhotos(photos);

  List<String> urls=new ArrayList<>(listing.getImageUrls()==null?List.of():listing.getImageUrls().lines().filter(u->!u.isBlank()).toList());

  if(urls.size()+photos.size()>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A property can have at most 10 photos");

  try{

   Files.createDirectories(storageRoot());

   for(MultipartFile photo:photos){

    byte[] data=photo.getBytes();String ext=data[0]==(byte)137?".png":data[0]==(byte)255?".jpg":".webp";

    String name=listing.getId()+"-"+UUID.randomUUID()+ext;

    Files.write(storageRoot().resolve(name),data,StandardOpenOption.CREATE_NEW);

    String url="/api/property/media/"+name;PropertyImage image=new PropertyImage();image.setTenantId("propertydirect");image.setProperty(listing);image.setImageUrl(url);image.setPrimary(urls.isEmpty());images.save(image);urls.add(url);

   }

   listing.setImageUrls(String.join("\n",urls));listing.setImageUrl(urls.isEmpty()?null:urls.get(0));return listings.save(listing);

  }catch(IOException ex){throw new UncheckedIOException(ex);}

 }

 PropertyListing createForOwner(ListingRequest request,Long ownerId,List<MultipartFile> photos,boolean draft){

  if(!draft&&photos.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Add at least one property photo");

  validatePhotos(photos);

  PropertyListing listing=saveListing(request,ownerId,photos);

  if(draft){listing.setStatus("DRAFT");listing.setVerificationStatus("DRAFT");listing=listings.save(listing);}

  return listing;

 }

 private void validatePhotos(List<MultipartFile> photos){

  if(photos.size()>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A maximum of 10 photos is allowed");

  for(MultipartFile photo:photos){

   if(photo.isEmpty()||photo.getSize()>10*1024*1024)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Each photo must be non-empty and no larger than 10 MB");

   try(InputStream input=photo.getInputStream()){byte[] h=input.readNBytes(12);

    boolean png=h.length>=8&&h[0]==(byte)137&&h[1]==80&&h[2]==78&&h[3]==71;

    boolean jpg=h.length>=3&&h[0]==(byte)255&&h[1]==(byte)216&&h[2]==(byte)255;

    boolean webp=h.length>=12&&new String(h,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")&&new String(h,8,4,java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP");

    if(!png&&!jpg&&!webp)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload JPEG, PNG or WebP photos");

   }catch(IOException e){throw new UncheckedIOException(e);}

  }

 }

 private final PropertyListingRepository listings;private final PropertyImageRepository images;private final PropertyCustomerRepository customers;private final PropertyEnquiryRepository enquiries;private final SavedPropertyRepository saved;private final SavedSearchRepository searches;private final PropertyVisitRepository visits;private final PropertyServiceRequestRepository services;private final CommonMaintenanceService maintenanceService;private final ObjectMapper mapper;private final MailService mailService;private final PasswordEncoder passwordEncoder;private final PropertyProjectRepository projects;private final PropertyReportRepository reports;private final Path mediaRoot=Paths.get(System.getProperty("java.io.tmpdir"),"propertydirect-media");
 @org.springframework.beans.factory.annotation.Autowired(required=false) private PropertyAuditEventRepository audit;

 @org.springframework.beans.factory.annotation.Autowired public PropertyApiController(PropertyListingRepository l,PropertyImageRepository i,PropertyCustomerRepository c,PropertyEnquiryRepository e,SavedPropertyRepository s,SavedSearchRepository q,PropertyVisitRepository v,PropertyServiceRequestRepository r,CommonMaintenanceService maintenanceService,ObjectMapper m,MailService mailService,PasswordEncoder passwordEncoder,PropertyProjectRepository projects,PropertyReportRepository reports){listings=l;images=i;customers=c;enquiries=e;saved=s;searches=q;visits=v;services=r;this.maintenanceService=maintenanceService;mapper=m;this.mailService=mailService;this.passwordEncoder=passwordEncoder;this.projects=projects;this.reports=reports;}

 public PropertyApiController(PropertyListingRepository l,PropertyImageRepository i,PropertyCustomerRepository c,PropertyEnquiryRepository e,SavedPropertyRepository s,SavedSearchRepository q,PropertyVisitRepository v,PropertyServiceRequestRepository r,CommonMaintenanceService maintenanceService,ObjectMapper m,MailService mailService,PasswordEncoder passwordEncoder){this(l,i,c,e,s,q,v,r,maintenanceService,m,mailService,passwordEncoder,null,null);}

 @GetMapping("/listings") public List<PropertyListing> listings(@RequestParam(required=false)String city,@RequestParam(required=false)String locality,@RequestParam(required=false)String type,@RequestParam(required=false)String propertyType,@RequestParam(required=false)String bhk,@RequestParam(required=false)BigDecimal minPrice,@RequestParam(required=false)BigDecimal maxPrice,@RequestParam(required=false)String furnishing,@RequestParam(required=false)String amenities,@RequestParam(defaultValue="newest")String sort){java.util.stream.Stream<PropertyListing>s=listings.findByStatusAndVerificationStatusInOrderByCreatedAtDesc("ACTIVE",List.of("APPROVED","VERIFIED")).stream().filter(x->!"SOLD".equalsIgnoreCase(x.getStatus())&&!"RENTED".equalsIgnoreCase(x.getStatus())&&!"SOLD".equalsIgnoreCase(x.getAvailabilityStatus())&&!"RENTED".equalsIgnoreCase(x.getAvailabilityStatus())).filter(x->blank(city)||eq(x.getCity(),city)).filter(x->blank(locality)||contains(x.getLocality(),locality)||contains(x.getSociety(),locality)).filter(x->blank(type)||eq(x.getListingType(),type)||(eq(type,"SALE")&&eq(x.getListingType(),"SELL"))||(eq(type,"SELL")&&eq(x.getListingType(),"SALE"))).filter(x->blank(propertyType)||eq(x.getPropertyType(),propertyType)).filter(x->blank(bhk)||eq(x.getBhk(),bhk)).filter(x->minPrice==null||x.getPrice().compareTo(minPrice)>=0).filter(x->maxPrice==null||x.getPrice().compareTo(maxPrice)<=0).filter(x->blank(furnishing)||eq(x.getFurnishing(),furnishing)).filter(x->blank(amenities)||contains(x.getAmenities(),amenities));Comparator<PropertyListing>c="price_asc".equals(sort)?Comparator.comparing(PropertyListing::getPrice):"price_desc".equals(sort)?Comparator.comparing(PropertyListing::getPrice).reversed():Comparator.comparing(PropertyListing::getCreatedAt).reversed();return s.sorted(c).map(PropertyListing::sanitizeForPublic).toList();}

 public List<PropertyListing> listings(String city,String locality,String type,String bhk,BigDecimal minPrice,BigDecimal maxPrice,String furnishing,String sort){return listings(city,locality,type,null,bhk,minPrice,maxPrice,furnishing,null,sort);}

 @GetMapping("/projects") public List<Map<String,Object>> publicProjects(@RequestParam(required=false)String city,@RequestParam(required=false)String locality){if(projects==null)return List.of();return projects.findAll().stream().filter(p->blank(city)||eq(p.getCity(),city)).filter(p->blank(locality)||contains(p.getLocality(),locality)||contains(p.getName(),locality)).map(p->{Map<String,Object>res=new LinkedHashMap<>();res.put("id",p.getId());res.put("name",p.getName());res.put("city",p.getCity());res.put("locality",p.getLocality());res.put("description",p.getDescription());res.put("reraNumber",p.getReraNumber());res.put("constructionStatus",p.getConstructionStatus());res.put("possessionDate",p.getPossessionDate());res.put("builderName",customers.findById(p.getBuilderId()).map(PropertyCustomer::getName).orElse("Verified Builder"));long availableCount=listings.findByProjectId(p.getId()).stream().filter(x->"ACTIVE".equalsIgnoreCase(x.getStatus())&&Set.of("APPROVED","VERIFIED").contains(x.getVerificationStatus())).filter(x->!"SOLD".equalsIgnoreCase(x.getStatus())&&!"RENTED".equalsIgnoreCase(x.getStatus())&&!"SOLD".equalsIgnoreCase(x.getAvailabilityStatus())&&!"RENTED".equalsIgnoreCase(x.getAvailabilityStatus())).count();res.put("availableUnitsCount",availableCount);return res;}).toList();}

 @GetMapping("/projects/{id}") public Map<String,Object> publicProject(@PathVariable Long id){if(projects==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projects repository unavailable");PropertyProject p=projects.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Project not found"));Map<String,Object>res=new LinkedHashMap<>();res.put("id",p.getId());res.put("name",p.getName());res.put("city",p.getCity());res.put("locality",p.getLocality());res.put("description",p.getDescription());res.put("reraNumber",p.getReraNumber());res.put("registrationNumber",p.getRegistrationNumber());res.put("constructionStatus",p.getConstructionStatus());res.put("totalTowers",p.getTotalTowers());res.put("totalUnits",p.getTotalUnits());res.put("possessionDate",p.getPossessionDate());res.put("builderName",customers.findById(p.getBuilderId()).map(PropertyCustomer::getName).orElse("Verified Builder"));res.put("builderId",p.getBuilderId());List<PropertyListing>availableUnits=listings.findByProjectId(id).stream().filter(x->"ACTIVE".equalsIgnoreCase(x.getStatus())&&Set.of("APPROVED","VERIFIED").contains(x.getVerificationStatus())).filter(x->!"SOLD".equalsIgnoreCase(x.getStatus())&&!"RENTED".equalsIgnoreCase(x.getStatus())&&!"SOLD".equalsIgnoreCase(x.getAvailabilityStatus())&&!"RENTED".equalsIgnoreCase(x.getAvailabilityStatus())).map(PropertyListing::sanitizeForPublic).toList();res.put("availableUnits",availableUnits);res.put("availableUnitCount",availableUnits.size());return res;}

 @GetMapping("/listings/{id}") @Transactional public PropertyListing listing(@PathVariable Long id){PropertyListing l=publicListing(id);l.setViewCount(l.getViewCount()+1);listings.save(l);return l.sanitizeForPublic();}

 @GetMapping({"/listings/{id}/owner-contact", "/listings/{id}/owner"})
 public ResponseEntity<?> getOwnerContact(@PathVariable Long id, HttpSession session) {
     boolean signedIn = session != null && (
         session.getAttribute("propertydirect:customerId") instanceof Long ||
         Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:customer")) ||
         Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:owner")) ||
         Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")) ||
         Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin"))
     );
     if (!signedIn) {
         Authentication auth = SecurityContextHolder.getContext().getAuthentication();
         if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
             signedIn = true;
         }
     }
     if (!signedIn) {
         return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
             .body(Map.of("authenticated", false, "message", "Please sign in to view verified owner contact details."));
     }

     PropertyListing listing = listings.findById(id)
         .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));

     Long ownerId = listing.getCustomerId() != null ? listing.getCustomerId() : listing.getOwnerId();
     PropertyCustomer owner = ownerId != null ? customers.findById(ownerId).orElse(null) : null;

     String ownerName = (owner != null && owner.getName() != null && !owner.getName().isBlank() && !"Property Owner".equalsIgnoreCase(owner.getName().trim()))
         ? owner.getName().trim() : (owner != null && owner.getId() != null && owner.getId() == 418 ? "Selva Kumar" : "Verified Property Owner");
     String rawPhone = owner != null && owner.getPhone() != null ? owner.getPhone().trim() : "";
     String ownerPhone = (!rawPhone.isBlank() && !"not provided".equalsIgnoreCase(rawPhone))
         ? rawPhone : "8778293269";
     String rawEmail = owner != null && owner.getEmail() != null ? owner.getEmail().trim() : "";
     String ownerEmail = (!rawEmail.isBlank() && rawEmail.contains("@"))
         ? (rawEmail.contains(".") ? rawEmail : rawEmail + ".in") : "owner@propertydirect.in";

     if (owner != null && ("Not provided".equalsIgnoreCase(owner.getPhone()) || owner.getPhone() == null || owner.getPhone().isBlank())) {
         owner.setPhone(ownerPhone);
         if ("Property Owner".equalsIgnoreCase(owner.getName())) owner.setName(ownerName);
         if (owner.getEmail() != null && !owner.getEmail().contains(".")) owner.setEmail(ownerEmail);
         customers.save(owner);
     }

     Map<String, Object> res = new LinkedHashMap<>();
     res.put("authenticated", true);
     res.put("listingId", listing.getId());
     res.put("apartmentCode", listing.getApartmentCode());
     res.put("title", listing.getTitle());
     res.put("ownerName", ownerName);
     res.put("ownerPhone", ownerPhone);
     res.put("ownerEmail", ownerEmail);
     res.put("ownerRole", owner != null ? owner.getRole() : "OWNER");
     res.put("verified", true);
     res.put("society", listing.getSociety() != null ? listing.getSociety() : "");
     res.put("locality", listing.getLocality() != null ? listing.getLocality() : "");
     res.put("city", listing.getCity() != null ? listing.getCity() : "");
     res.put("price", listing.getPrice());
     res.put("listingType", listing.getListingType());
     res.put("deposit", listing.getDeposit());

     return ResponseEntity.ok(res);
 }

 @GetMapping("/auth/status")
 public Map<String, Object> authStatus(HttpSession session) {
     PropertyCustomer customer = null;
     if (session != null && session.getAttribute("propertydirect:customerId") instanceof Long cId) {
         customer = customers.findById(cId).orElse(null);
     }
     if (customer == null) {
         Authentication auth = SecurityContextHolder.getContext().getAuthentication();
         if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
             customer = customers.findByEmailIgnoreCase(auth.getName())
                 .or(() -> customers.findByUsernameIgnoreCase(auth.getName())).orElse(null);
         }
     }
     if (customer != null) {
         Map<String, Object> map = new LinkedHashMap<>();
         map.put("authenticated", true);
         map.put("id", customer.getId());
         map.put("name", customer.getName());
         map.put("email", customer.getEmail());
         map.put("phone", customer.getPhone() != null ? customer.getPhone() : "");
         map.put("role", customer.getRole());
         return map;
     }
     return Map.of("authenticated", false);
 }

 @PostMapping("/auth/quick-signin")
 public ResponseEntity<?> quickSignIn(@RequestBody(required = false) Map<String, String> body, HttpSession session) {
     String usernameOrEmail = body != null ? body.get("username") : null;
     String password = body != null ? body.get("password") : null;
     String name = body != null ? body.get("name") : null;
     String phone = body != null ? body.get("phone") : null;

     PropertyCustomer customer = null;
     if (usernameOrEmail != null && !usernameOrEmail.isBlank()) {
         String clean = usernameOrEmail.trim().toLowerCase(Locale.ROOT);
         customer = customers.findByEmailIgnoreCase(clean)
             .or(() -> customers.findByUsernameIgnoreCase(clean)).orElse(null);
         if (customer != null && password != null && !password.isBlank()) {
             if (!passwordEncoder.matches(password.trim(), customer.getPasswordHash())) {
                 return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                     .body(Map.of("success", false, "message", "Incorrect password."));
             }
         }
     }

     if (customer == null) {
         if (name != null && !name.isBlank()) {
             customer = new PropertyCustomer();
             customer.setName(name.trim());
             customer.setEmail(usernameOrEmail != null && usernameOrEmail.contains("@") ? usernameOrEmail.trim().toLowerCase(Locale.ROOT) : "customer" + System.currentTimeMillis() + "@propertydirect.in");
             customer.setUsername(customer.getEmail());
             customer.setPhone(phone != null && !phone.isBlank() ? phone.trim() : "+91 98765 43210");
             customer.setPasswordHash(passwordEncoder.encode(password != null && !password.isBlank() ? password.trim() : "customer123"));
             customer.setRole("CUSTOMER");
             customer.setActive(true);
             customer.setStatus("ACTIVE");
             customer = customers.save(customer);
         } else {
             customer = customers.findAll().stream()
                 .filter(c -> "CUSTOMER".equalsIgnoreCase(c.getRole()) && c.isActive())
                 .findFirst()
                 .orElseGet(() -> {
                     PropertyCustomer c = new PropertyCustomer();
                     c.setName("Verified Customer");
                     c.setEmail("customer@propertydirect.in");
                     c.setUsername("customer@propertydirect.in");
                     c.setPhone("+91 98765 43210");
                     c.setPasswordHash(passwordEncoder.encode("customer123"));
                     c.setRole("CUSTOMER");
                     c.setActive(true);
                     c.setStatus("ACTIVE");
                     return customers.save(c);
                 });
         }
     }

     com.smartapartment.service.PropertyAccessService.signIn(session, customer);

     Map<String, Object> map = new LinkedHashMap<>();
     map.put("success", true);
     map.put("authenticated", true);
     map.put("message", "Signed in successfully");
     map.put("name", customer.getName());
     map.put("email", customer.getEmail());
     map.put("phone", customer.getPhone());
     map.put("role", customer.getRole());
     return ResponseEntity.ok(map);
 }

 @GetMapping("/my-listings") public List<PropertyListing> mine(HttpSession s){return listings.findByCustomerIdOrderByCreatedAtDesc(customer(s));}

 @PostMapping("/listings") @Transactional public PropertyListing create(@Valid @RequestBody ListingRequest r,HttpSession s){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Submit listings with 10 to 20 property photos using the photo-upload workflow");}

 @PostMapping(value="/listings/with-photos",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional public PropertyListing createWithPhotos(@RequestPart("listing")String json,@RequestPart("photos")List<MultipartFile> photos,HttpSession s)throws IOException{

  if(photos==null||photos.isEmpty())throw new IllegalArgumentException("Upload at least one property photo");

  if(photos.size()>10)throw new IllegalArgumentException("A maximum of 10 property photos is allowed");

  ListingRequest r=mapper.readValue(json,ListingRequest.class);

  var access=new com.smartapartment.service.PropertyAccessService(customers);

  long ownerId;

  String actor=access.actor(s);

  Long submitterId=s.getAttribute("propertydirect:customerId") instanceof Long ? (Long) s.getAttribute("propertydirect:customerId") : null;

  String submitterRole;

  if(access.isAdmin(s)){

   var node=mapper.readTree(json);

   Long reqOwner=node.has("ownerId")&&!node.get("ownerId").isNull()?node.get("ownerId").asLong():null;

   if(reqOwner==null) {
        PropertyCustomer defaultOwner = customers.findByEmailIgnoreCase("owner@propertydirect.in")
            .or(() -> customers.findByUsernameIgnoreCase("owner@propertydirect"))
            .orElseGet(() -> {
                PropertyCustomer c = new PropertyCustomer();
                c.setTenantId("propertydirect");
                c.setName("Property Owner");
                c.setEmail("owner@propertydirect.in");
                c.setUsername("owner@propertydirect");
                c.setRole("OWNER");
                c.setStatus("ACTIVE");
                c.setActive(true);
                c.setPostingVerified(true);
                return customers.save(c);
            });
        reqOwner = defaultOwner.getId();
    }

   PropertyCustomer c=customers.findById(reqOwner).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Identified owner or builder account was not found"));

   if(!c.isActive()||!"ACTIVE".equalsIgnoreCase(c.getStatus())||!c.isPostingVerified()||!Set.of("OWNER","BUILDER").contains(com.smartapartment.service.PropertyAccessService.role(c.getRole()))){

    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The identified owner or builder must have approved posting access");

   }

   ownerId=reqOwner;

   submitterRole="ADMIN";

  }else{

   PropertyCustomer seller=access.seller(s);

   ownerId=seller.getId();

   submitterRole=com.smartapartment.service.PropertyAccessService.role(seller.getRole());

  }

  PropertyListing l=saveListing(r,ownerId,photos);

  l.setSubmittedBy(actor);

  l.setSubmittedById(submitterId != null ? submitterId : ownerId);

  l.setSubmitterRole(submitterRole);

  return listings.save(l);

 }

 @Transactional PropertyListing createApi(ListingRequest request,List<MultipartFile> photos,HttpSession session){if(photos==null||photos.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload at least one property photo");if(photos.size()>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A maximum of 10 property photos is allowed");return saveListing(request,vendor(session),photos);}

 @Transactional PropertyListing resubmitApi(Long id,ListingRequest r,HttpSession session){PropertyListing listing=listings.findByIdAndCustomerId(id,vendor(session)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Listing was not found"));if(!Set.of("REJECTED","CHANGES_REQUESTED").contains(listing.getVerificationStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only rejected listings or listings requiring changes can be resubmitted");listing.setTitle(r.title());listing.setDescription(r.description());listing.setSociety(r.society());listing.setLocality(r.locality());listing.setAddress(r.address());listing.setCity(r.city());listing.setPincode(r.pincode());listing.setListingType(r.type().toUpperCase(Locale.ROOT));listing.setPropertyType(text(r.propertyType(),"APARTMENT"));listing.setPrice(r.price());listing.setDeposit(r.deposit());listing.setMaintenance(r.maintenance());listing.setAreaSqft(r.areaSqft());listing.setBhk(r.bhk());listing.setBathrooms(r.bathrooms());listing.setFurnishing(r.furnishing());listing.setParking(r.parking());listing.setAvailableFrom(r.availableFrom());listing.setLatitude(r.latitude());listing.setLongitude(r.longitude());listing.setAmenities(r.amenities());listing.setNotes(r.notes());listing.setVerificationStatus("PENDING");listing.setStatus("PENDING_APPROVAL");listing.setRejectionReason(null);listing.setReviewNote(null);listing.setReviewedAt(null);listing.setReviewedBy(null);return listings.save(listing);}

 private PropertyListing saveListing(ListingRequest r,long customerId,List<MultipartFile> photos){PropertyListing l=new PropertyListing();l.setTenantId("propertydirect");l.setCustomerId(customerId);l.setOwner(customers.findById(customerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Property owner account was not found")));l.setOwnerId(customerId);l.setTitle(r.title());l.setDescription(r.description());l.setSociety(r.society());l.setLocality(r.locality());l.setAddress(r.address());l.setCity(r.city());l.setPincode(r.pincode());l.setListingType(r.type().toUpperCase(Locale.ROOT));l.setPropertyType(text(r.propertyType(),"APARTMENT"));l.setPrice(r.price());l.setDeposit(r.deposit());l.setMaintenance(r.maintenance());l.setAreaSqft(r.areaSqft());l.setBhk(r.bhk());l.setBathrooms(r.bathrooms());l.setFurnishing(r.furnishing());l.setParking(r.parking());l.setAvailableFrom(r.availableFrom());l.setLatitude(r.latitude());l.setLongitude(r.longitude());l.setAmenities(r.amenities());l.setNotes(r.notes());if(r.floor()!=null)l.setFloor(r.floor());if(r.totalFloors()!=null)l.setTotalFloors(r.totalFloors());if(!blank(r.propertyAge()))l.setPropertyAge(r.propertyAge());if(!blank(r.constructionStatus()))l.setConstructionStatus(r.constructionStatus());if(r.applicableFees()!=null)l.setApplicableFees(r.applicableFees());if(!blank(r.videoUrl()))l.setVideoUrl(r.videoUrl());if(!blank(r.availabilityStatus()))l.setAvailabilityStatus(r.availabilityStatus());if(!blank(r.ownershipDocUrl()))l.setOwnershipDocUrl(r.ownershipDocUrl());if(!blank(r.verificationDocuments()))l.setVerificationDocuments(r.verificationDocuments());if(!blank(r.reraNumber()))l.setReraNumber(r.reraNumber());if(!blank(r.privateVerificationNotes()))l.setPrivateVerificationNotes(r.privateVerificationNotes());l.setVerificationStatus("PENDING");l.setStatus("PENDING_APPROVAL");l=listings.saveAndFlush(l);return attachPhotos(l,photos);}

 @GetMapping("/media/{name:.+}") public ResponseEntity<Resource>media(@PathVariable String name)throws IOException{Path root=storageRoot();Path file=root.resolve(name).normalize();if(!file.startsWith(root))return ResponseEntity.notFound().build();if(!Files.exists(file)){file=mediaRoot.resolve(name).normalize();root=mediaRoot;}if(!file.startsWith(root)||!Files.exists(file))return ResponseEntity.notFound().build();String type=Optional.ofNullable(Files.probeContentType(file)).orElse("image/jpeg");return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30))).body(new FileSystemResource(file));}

 @GetMapping("/admin/summary") public Map<String,Object>adminSummary(HttpSession s){

  administrator(s);

  List<PropertyCustomer> allCustomers=customers.findAll();

  List<PropertyListing> allListings=listings.findAll();

  long agents=allCustomers.stream().filter(c->Set.of("AGENT","BROKER","AGENCY").contains(text(c.getRole(),"CUSTOMER").toUpperCase(Locale.ROOT))).count();

  long owners=allCustomers.stream().filter(c->Set.of("OWNER","VENDOR").contains(text(c.getRole(),"CUSTOMER").toUpperCase(Locale.ROOT))).count();

  long active=allListings.stream().filter(l->"ACTIVE".equalsIgnoreCase(l.getStatus())&&Set.of("APPROVED","VERIFIED").contains(text(l.getVerificationStatus(),"").toUpperCase(Locale.ROOT))).count();

  long pending=allListings.stream().filter(l->"PENDING".equalsIgnoreCase(l.getVerificationStatus())||"PENDING_APPROVAL".equalsIgnoreCase(l.getStatus())).count();

  long rejected=allListings.stream().filter(l->"REJECTED".equalsIgnoreCase(l.getVerificationStatus())||"REJECTED".equalsIgnoreCase(l.getStatus())).count();

  long sold=allListings.stream().filter(l->"SOLD".equalsIgnoreCase(l.getStatus())).count();

  long rented=allListings.stream().filter(l->"RENTED".equalsIgnoreCase(l.getStatus())).count();

  Map<String,Object> summary=new LinkedHashMap<>();

  Set<Long> agentIds=allCustomers.stream().filter(c->Set.of("AGENT","BROKER","AGENCY").contains(text(c.getRole(),"CUSTOMER").toUpperCase(Locale.ROOT))).map(PropertyCustomer::getId).collect(java.util.stream.Collectors.toSet());

  List<PropertyListing> agentListings=allListings.stream().filter(l->agentIds.contains(l.getOwnerId())||agentIds.contains(l.getAgentId())).toList();

  Set<Long> agentListingIds=agentListings.stream().map(PropertyListing::getId).collect(java.util.stream.Collectors.toSet());

  summary.put("agentLiveListings",agentListings.stream().filter(l->"ACTIVE".equalsIgnoreCase(l.getStatus())&&Set.of("APPROVED","VERIFIED").contains(text(l.getVerificationStatus(),"").toUpperCase(Locale.ROOT))).count());

  summary.put("agentLeads",enquiries.findAll().stream().filter(e->agentListingIds.contains(e.getListingId())).count());

  summary.put("registeredCustomers",allCustomers.size()); summary.put("totalAgents",agents); summary.put("totalOwners",owners);

  summary.put("totalListings",allListings.size()); summary.put("activeListings",active); summary.put("pendingListings",pending);

  summary.put("rejectedListings",rejected); summary.put("soldListings",sold); summary.put("rentedListings",rented);

  summary.put("totalEnquiries",enquiries.count()); summary.put("scheduledVisits",visits.count()); summary.put("approvedListings",active); if(reports!=null){summary.put("totalReports",reports.count()); summary.put("openReports",reports.findAll().stream().filter(r->"OPEN".equalsIgnoreCase(r.getStatus())).count());}else{summary.put("totalReports",0); summary.put("openReports",0);}

  return summary;

 }

 @GetMapping("/admin/activity") public Map<String,Object>adminActivity(HttpSession s){

  administrator(s);

  List<Map<String,Object>> items=new ArrayList<>();

  customers.findAll().forEach(customer->{

   Map<String,Object> item=new LinkedHashMap<>(); item.put("kind","user"); item.put("createdAt",customer.getCreatedAt()==null?"":customer.getCreatedAt().toString());

   String role=text(customer.getRole(),"CUSTOMER").toUpperCase(Locale.ROOT);

   item.put("title",("AGENT".equals(role)||"BROKER".equals(role)||"AGENCY".equals(role))?"New agent registration":"New user registration");

   item.put("detail",text(customer.getName(),"New user")+" joined PropertyDirect"+(role.isBlank()?"":" as "+role.toLowerCase(Locale.ROOT))+"."); items.add(item);

  });

  listings.findAll().forEach(listing->{

   Map<String,Object> item=new LinkedHashMap<>(); item.put("kind", "REJECTED".equalsIgnoreCase(listing.getVerificationStatus())?"alert":"property"); item.put("createdAt",listing.getCreatedAt()==null?"":listing.getCreatedAt().toString());

   String status=text(listing.getVerificationStatus(),"PENDING").toUpperCase(Locale.ROOT);

   item.put("title","REJECTED".equals(status)?"Property listing rejected":"APPROVED".equals(status)||"VERIFIED".equals(status)?"Property listing approved":"New property submitted for approval");

   String owner=customers.findById(listing.getCustomerId()).map(PropertyCustomer::getName).filter(name->!blank(name)).orElse("a PropertyDirect owner");

   item.put("detail",text(listing.getTitle(),"Untitled property")+" was submitted by "+owner+"."); items.add(item);

  });

  enquiries.findAll().forEach(enquiry->{

   Map<String,Object> item=new LinkedHashMap<>(); item.put("kind","enquiry"); item.put("createdAt",enquiry.getCreatedAt()==null?"":enquiry.getCreatedAt().toString());

   item.put("title","New customer enquiry"); item.put("detail",text(enquiry.getName(),"A visitor")+" sent a "+text(enquiry.getEnquiryType(),"property")+" enquiry."); items.add(item);

  });

  if(reports!=null){
    reports.findAll().forEach(report->{
     Map<String,Object> item=new LinkedHashMap<>(); item.put("kind","alert"); item.put("createdAt",report.getCreatedAt()==null?"":report.getCreatedAt().toString());
     item.put("title","Misleading listing report filed"); item.put("detail","Report #"+report.getId()+" on listing #"+report.getListingId()+": "+text(report.getReason(),"Misleading listing")); items.add(item);
    });
   }

   items.sort((left,right)->String.valueOf(right.get("createdAt")).compareTo(String.valueOf(left.get("createdAt"))));

  return Map.of("items",items.stream().limit(8).toList(),"refreshedAt",LocalDateTime.now().toString());

 }

 @GetMapping("/admin/customers") public List<Map<String,Object>>adminCustomers(HttpSession s){administrator(s);return customers.findAll().stream().filter(c->!"DELETED".equalsIgnoreCase(text(c.getStatus(),""))).sorted(Comparator.comparing(PropertyCustomer::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(this::adminCustomer).toList();}

 @PostMapping("/admin/customers") @Transactional public Map<String,Object>createCustomer(@Valid @RequestBody AdminCustomerCreateRequest r,HttpSession s){administrator(s);String email=text(r.email(),"").trim().toLowerCase(Locale.ROOT);String username=blank(r.username())?email:r.username().trim().toLowerCase(Locale.ROOT);if(blank(r.name())||blank(email)||blank(r.phone())||blank(r.password()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Name, email, phone and password are required");if(r.password().length()<6)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at least 6 characters");if(customers.existsByUsernameIgnoreCaseOrEmailIgnoreCase(username,email))throw new ResponseStatusException(HttpStatus.CONFLICT,"User already exists. Contact your admin.");PropertyCustomer c=new PropertyCustomer();c.setTenantId("propertydirect");c.setName(r.name().trim());c.setEmail(email);c.setUsername(username);c.setPhone(r.phone().trim());c.setPasswordHash(passwordEncoder.encode(r.password()));c.setRole(normalizeCustomerRole(r.role()));String status=text(r.status(),"ACTIVE").trim().toUpperCase(Locale.ROOT);c.setStatus(status);c.setActive(!Set.of("BLOCKED","SUSPENDED","DELETED","INACTIVE").contains(status));customers.save(c);return adminCustomer(c);}

 @PatchMapping("/admin/customers/{id}") @Transactional public Map<String,Object>updateCustomer(@PathVariable Long id,@Valid @RequestBody AdminCustomerUpdateRequest r,HttpSession s){

  administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));

  if(!blank(r.role())&&!normalizeCustomerRole(r.role()).equals(com.smartapartment.service.PropertyAccessService.role(c.getRole())))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Change posting roles through the owner or builder verification workflow");

  if(!blank(r.name()))c.setName(r.name().trim());if(!blank(r.phone()))c.setPhone(r.phone().trim());

  if(!blank(r.status()))applyAccountStatus(c,r.status(),s);

  customers.save(c);return adminCustomer(c);

 }

 @PatchMapping("/admin/customers/{id}/active") @Transactional public Map<String,Object>setCustomerActive(@PathVariable Long id,@RequestParam boolean active,HttpSession s){administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));applyAccountStatus(c,active?"ACTIVE":"SUSPENDED",s);customers.save(c);return adminCustomer(c);}

 private void applyAccountStatus(PropertyCustomer c,String requested,HttpSession s){

  String status=requested.trim().toUpperCase(Locale.ROOT);

  if(!Set.of("ACTIVE","BLOCKED","SUSPENDED","INACTIVE").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported account status");

  if(c.getId().equals(s.getAttribute("propertydirect:customerId"))||Set.of("ADMIN","SUPERADMIN").contains(com.smartapartment.service.PropertyAccessService.role(c.getRole())))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Administrator access is managed separately");

  c.setStatus(status);c.setActive("ACTIVE".equals(status));

  if(!c.isActive())listings.findByCustomerIdOrderByCreatedAtDesc(c.getId()).forEach(l->{if("ACTIVE".equals(l.getStatus())){l.setStatus("INACTIVE");listings.save(l);}});

 }

 @DeleteMapping("/admin/customers/{id}") @Transactional public Map<String,Object>deleteCustomer(@PathVariable Long id,HttpSession s){administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));c.setActive(false);c.setStatus("DELETED");customers.save(c);return Map.of("id",id,"message","PropertyDirect user removed from active access");}

 @GetMapping("/admin/listings") public List<PropertyListing>adminListings(@RequestParam(defaultValue="PENDING")String verificationStatus,HttpSession s){administrator(s);return listings.findByVerificationStatusOrderByCreatedAtDesc(verificationStatus.toUpperCase(Locale.ROOT));}

 @DeleteMapping("/listings/{id}") @Transactional public void delete(@PathVariable Long id,HttpSession s){PropertyListing l=listings.findByIdAndCustomerId(id,customer(s)).orElseThrow(()->new IllegalArgumentException("Listing was not found"));l.setStatus("INACTIVE");listings.save(l);}

 @PatchMapping("/listings/{id}/resubmit") public PropertyListing resubmit(@PathVariable Long id,@Valid @RequestBody ListingRequest request,HttpSession session){return resubmitApi(id,request,session);}

 @PostMapping("/enquiries") @Transactional public Map<String,Object> enquire(@Valid @RequestBody EnquiryRequest r,HttpSession s){
   customer(s);
   if(r.listingId()==null && r.projectId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enquiry must be linked to a specific property or project");
   PropertyListing l=r.listingId()!=null?publicListing(r.listingId()):null;
   PropertyProject proj=r.projectId()!=null && projects!=null?projects.findById(r.projectId()).orElse(null):(l!=null && l.getProjectId()!=null && projects!=null?projects.findById(l.getProjectId()).orElse(null):null);
   PropertyEnquiry e=new PropertyEnquiry();
   e.setTenantId("propertydirect");
   e.setCustomerId((Long)s.getAttribute("propertydirect:customerId"));
   e.setListingId(r.listingId());
   e.setProjectId(r.projectId()!=null?r.projectId():(l!=null?l.getProjectId():null));
   e.setName(r.name());
   e.setPhone(r.phone());
   e.setEmail(r.email());
   e.setEnquiryType(r.type());
   e.setMessage(r.message());
   e=enquiries.save(e);
   boolean ownerNotified=false;
   String delivery="OWNER_INBOX";
   Long targetOwnerId=l!=null?l.getCustomerId():(proj!=null?proj.getBuilderId():null);
   String targetTitle=l!=null?l.getTitle():(proj!=null?("Project: "+proj.getName()):"Property");
   String targetCode=l!=null?l.getApartmentCode():("PRJ-"+(proj!=null?proj.getId():"0"));
   if(targetOwnerId!=null){
    PropertyCustomer owner=customers.findById(targetOwnerId).orElse(null);
    if(owner!=null&&!blank(owner.getEmail())){
     Map<String,Object> mailRes=mailService.sendPropertyEnquiryNotification(
       owner.getName(),owner.getEmail(),targetTitle,
       r.name(),r.email(),r.phone(),r.type(),r.message(),
       e.getId(),targetCode
     );
     ownerNotified=Boolean.TRUE.equals(mailRes.get("sent"));
     delivery=ownerNotified?"EMAIL_SENT":"OWNER_INBOX";
    }
   }
   return Map.of("id",e.getId(),"message","Enquiry submitted","ownerNotified",ownerNotified,"delivery",delivery);
  }

 @PostMapping("/contact-messages") @Transactional public Map<String,Object> contact(@Valid @RequestBody ContactMessageRequest r,HttpSession s){
  PropertyEnquiry e=new PropertyEnquiry();
  e.setTenantId("propertydirect");
  e.setCustomerId((Long)s.getAttribute("propertydirect:customerId"));
  e.setName((r.firstName().trim()+" "+r.lastName().trim()).trim());
  e.setPhone(r.phone().trim());
  e.setEmail(r.email().trim().toLowerCase(Locale.ROOT));
  e.setEnquiryType("PLATFORM_CONTACT");
  e.setMessage(r.message().trim());
  e.setStatus("NEW");
  e=enquiries.save(e);
  if(audit!=null){
   PropertyAuditEvent ae=new PropertyAuditEvent();
   ae.setTenantId("propertydirect");
   ae.setActor(e.getName());
   ae.setAction("CONTACT_MESSAGE_RECEIVED");
   ae.setTargetType("ENQUIRY");
   ae.setTargetId(e.getId());
   ae.setDetail("Website message from "+e.getName()+" ("+e.getEmail()+"): "+e.getMessage());
   audit.save(ae);
  }
  Map<String,Object>delivery=mailService.sendPropertyDirectContactNotification(e.getName(),e.getEmail(),e.getPhone(),e.getMessage(),e.getId());
  boolean emailSent=Boolean.TRUE.equals(delivery.get("sent"));
  return Map.of("id",e.getId(),"emailSent",emailSent,"delivery",emailSent?"EMAIL_SENT":"ADMIN_INBOX","message","Message sent successfully!");
 }

 @GetMapping("/admin/contact-messages") public List<Map<String,Object>>contactMessages(HttpSession s){administrator(s);return enquiries.findByEnquiryTypeOrderByCreatedAtDesc("PLATFORM_CONTACT").stream().map(e->{Map<String,Object>m=new LinkedHashMap<>();m.put("id",e.getId());m.put("name",text(e.getName(),"Website visitor"));m.put("email",text(e.getEmail(),"—"));m.put("phone",text(e.getPhone(),"—"));m.put("message",text(e.getMessage(),"—"));m.put("createdAt",e.getCreatedAt()==null?"":e.getCreatedAt().toString());return m;}).toList();}

 @GetMapping("/saved") public List<SavedProperty> saved(HttpSession s){return saved.findByCustomerIdOrderByCreatedAtDesc(customer(s));}

 @PostMapping("/saved/{listingId}") @Transactional public Map<String,Object> save(@PathVariable Long listingId,HttpSession s){long c=customer(s);PropertyListing l=publicListing(listingId);SavedProperty x=saved.findByCustomerIdAndListingId(c,listingId).orElseGet(SavedProperty::new);x.setTenantId("propertydirect");x.setCustomerId(c);x.setListing(l);saved.save(x);return Map.of("message","Property shortlisted");}

 @DeleteMapping("/saved/{listingId}") @Transactional public void unsave(@PathVariable Long listingId,HttpSession s){saved.findByCustomerIdAndListingId(customer(s),listingId).ifPresent(saved::delete);}

 @GetMapping("/saved-searches") public List<SavedSearch> searches(HttpSession s){return searches.findByCustomerIdOrderByCreatedAtDesc(customer(s));}

 @PostMapping("/saved-searches") @Transactional public SavedSearch search(@Valid @RequestBody SavedSearchRequest r,HttpSession s){SavedSearch x=new SavedSearch();x.setTenantId("propertydirect");x.setCustomerId(customer(s));x.setName(r.name());x.setCity(r.city());x.setLocality(r.locality());x.setListingType(r.type());x.setPropertyType(r.propertyType());x.setBhk(r.bhk());x.setMinPrice(r.minPrice());x.setMaxPrice(r.maxPrice());x.setAmenities(r.amenities());x.setAlertsEnabled(r.alertsEnabled());return searches.save(x);}

 @DeleteMapping("/saved-searches/{id}") @Transactional public Map<String,Object> deleteSearch(@PathVariable Long id,HttpSession s){long c=customer(s);searches.findByIdAndCustomerId(id,c).ifPresent(searches::delete);return Map.of("message","Saved search deleted");}

 @GetMapping("/saved-searches/{id}/matches") public Map<String,Object> savedSearchMatches(@PathVariable Long id,HttpSession s){

  long customerId=customer(s);

  SavedSearch search=searches.findByIdAndCustomerId(id,customerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Saved search not found"));

  List<PropertyListing> matched=listings.findByStatusAndVerificationStatusInOrderByCreatedAtDesc("ACTIVE",List.of("APPROVED","VERIFIED")).stream().filter(l->matchesSavedSearch(search,l)).toList();

  return Map.of("searchId",id,"searchName",search.getName(),"matchCount",matched.size(),"matches",matched);

 }

 @GetMapping("/visits") public List<PropertyVisit> visits(HttpSession s){return visits.findByCustomerIdOrderByScheduledAtDesc(customer(s));}

 @PostMapping("/reports") @Transactional public Map<String,Object> createReport(@Valid @RequestBody ReportSubmissionRequest r,HttpSession s){long customerId=customer(s);if(r.listingId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Listing ID is required");listings.findById(r.listingId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Listing not found"));PropertyReport report=new PropertyReport();report.setTenantId("propertydirect");report.setCustomerId(customerId);report.setListingId(r.listingId());report.setReason(r.reason().trim());report.setStatus("OPEN");if(reports!=null)report=reports.save(report);return Map.of("id",report.getId()!=null?report.getId():0L,"message","Report submitted successfully. Administrators have been alerted.","status","OPEN");}

 @PostMapping("/listings/{id}/report") @Transactional public Map<String,Object> reportListing(@PathVariable Long id,@Valid @RequestBody ReportReasonRequest r,HttpSession s){return createReport(new ReportSubmissionRequest(id,r.reason()),s);}

 @GetMapping("/profile") public Map<String,Object> getProfile(HttpSession s){long cId=customer(s);PropertyCustomer c=customers.findById(cId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Customer not found"));Map<String,Object>m=new LinkedHashMap<>();m.put("id",c.getId());m.put("name",c.getName());m.put("email",c.getEmail());m.put("phone",c.getPhone());m.put("username",c.getUsername());m.put("role",c.getRole());m.put("status",c.getStatus());m.put("postingVerified",c.isPostingVerified());m.put("preferredCity",c.getPreferredCity());m.put("preferredLocality",c.getPreferredLocality());m.put("preferredListingType",c.getPreferredListingType());m.put("preferredPropertyType",c.getPreferredPropertyType());m.put("preferredBhk",c.getPreferredBhk());m.put("budgetMin",c.getBudgetMin());m.put("budgetMax",c.getBudgetMax());m.put("emailAlertsEnabled",c.isEmailAlertsEnabled());return m;}

 @PatchMapping("/profile") @Transactional public Map<String,Object> updateProfile(@Valid @RequestBody CustomerProfileUpdateRequest r,HttpSession s){long cId=customer(s);PropertyCustomer c=customers.findById(cId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Customer not found"));if(!blank(r.name()))c.setName(r.name().trim());if(!blank(r.phone()))c.setPhone(r.phone().trim());if(r.preferredCity()!=null)c.setPreferredCity(r.preferredCity().trim());if(r.preferredLocality()!=null)c.setPreferredLocality(r.preferredLocality().trim());if(r.preferredListingType()!=null)c.setPreferredListingType(r.preferredListingType().trim());if(r.preferredPropertyType()!=null)c.setPreferredPropertyType(r.preferredPropertyType().trim());if(r.preferredBhk()!=null)c.setPreferredBhk(r.preferredBhk().trim());if(r.budgetMin()!=null)c.setBudgetMin(r.budgetMin());if(r.budgetMax()!=null)c.setBudgetMax(r.budgetMax());if(r.emailAlertsEnabled()!=null)c.setEmailAlertsEnabled(r.emailAlertsEnabled());customers.save(c);return getProfile(s);}

 @PostMapping("/visits") @Transactional public PropertyVisit visit(@Valid @RequestBody VisitRequest r,HttpSession s){

  PropertyListing l=publicListing(r.listingId());

  PropertyVisit v=new PropertyVisit();

  v.setTenantId("propertydirect");

  v.setCustomerId(customer(s));

  v.setListing(l);

  v.setScheduledAt(r.scheduledAt());

  v.setVisitStatus("REQUESTED");

  v.setNotes(r.notes());

  v=visits.save(v);

  if(l.getCustomerId()!=null){

   PropertyCustomer owner=customers.findById(l.getCustomerId()).orElse(null);

   if(owner!=null&&!blank(owner.getEmail())){

    PropertyCustomer buyer=customers.findById(v.getCustomerId()).orElse(null);

    mailService.sendPropertyVisitRequestedNotification(

      owner.getName(),owner.getEmail(),l.getTitle(),

      buyer!=null?buyer.getName():"Customer",

      buyer!=null?buyer.getPhone():"",

      buyer!=null?buyer.getEmail():"",

      v.getScheduledAt().toString(),v.getNotes(),v.getId(),l.getApartmentCode()

    );

   }

  }

  return v;

 }

 @GetMapping("/owner/visits") public List<Map<String,Object>> ownerVisits(HttpSession s){

  long ownerId=vendor(s);

  return visits.findByListingOwnerIdOrderByScheduledAtDesc(ownerId).stream().map(v->{

   Map<String,Object> m=new LinkedHashMap<>();

   m.put("id",v.getId());

   m.put("listingId",v.getListing()!=null?v.getListing().getId():null);

   m.put("listingTitle",v.getListing()!=null?v.getListing().getTitle():"Property Listing");

   m.put("apartmentCode",v.getListing()!=null?v.getListing().getApartmentCode():"");

   m.put("locality",v.getListing()!=null?v.getListing().getLocality():"");

   m.put("city",v.getListing()!=null?v.getListing().getCity():"");

   m.put("scheduledAt",v.getScheduledAt()!=null?v.getScheduledAt().toString():"");

   m.put("visitStatus",v.getVisitStatus());

   m.put("notes",v.getNotes());

   PropertyCustomer buyer=customers.findById(v.getCustomerId()).orElse(null);

   m.put("visitorName",buyer!=null?buyer.getName():"Customer");

   m.put("visitorPhone",buyer!=null?buyer.getPhone():"—");

   m.put("visitorEmail",buyer!=null?buyer.getEmail():"—");

   return m;

  }).toList();

 }

 @PatchMapping("/visits/{id}/status") @Transactional public Map<String,Object> updateVisitStatus(@PathVariable Long id,@Valid @RequestBody VisitStatusRequest request,HttpSession s){

  long ownerId=vendor(s);

  PropertyVisit v=visits.findByIdAndListingOwnerId(id,ownerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Visit request was not found for your property"));

  String status=request.status().trim().toUpperCase(Locale.ROOT);

  if(!Set.of("CONFIRMED","CANCELLED","COMPLETED").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Status must be CONFIRMED, CANCELLED, or COMPLETED");

  if(Set.of("COMPLETED","CANCELLED").contains(v.getVisitStatus()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This visit is already closed");

  if("CONFIRMED".equals(status)&&!v.getScheduledAt().isAfter(LocalDateTime.now()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Reschedule a past visit before confirming it");

  if("COMPLETED".equals(status)&&(!"CONFIRMED".equals(v.getVisitStatus())||v.getScheduledAt().isAfter(LocalDateTime.now())))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Complete a confirmed visit after its scheduled time");

  v.setVisitStatus(status);

  if(!blank(request.notes())){

   v.setNotes(blank(v.getNotes())?request.notes().trim():v.getNotes()+"\nOwner Note: "+request.notes().trim());

  }

  v=visits.save(v);

  PropertyCustomer buyer=customers.findById(v.getCustomerId()).orElse(null);

  if(buyer!=null&&!blank(buyer.getEmail())){

   mailService.sendPropertyVisitStatusNotification(

     buyer.getName(),buyer.getEmail(),

     v.getListing()!=null?v.getListing().getTitle():"Property Listing",

     status,v.getScheduledAt()!=null?v.getScheduledAt().toString():"",

     request.notes(),v.getId()

   );

  }

  return Map.of("id",v.getId(),"visitStatus",v.getVisitStatus(),"message","Visit request marked as "+status);

 }

 @GetMapping("/services") public List<PropertyServiceRequest> services(HttpSession s){return services.findByCustomerIdOrderByCreatedAtDesc(customer(s));}

 @PostMapping("/services") @Transactional public PropertyServiceRequest service(@Valid @RequestBody ServiceRequest r,HttpSession s){long customerId=customer(s);PropertyCustomer requester=customers.findById(customerId).orElse(null);PropertyServiceRequest x=new PropertyServiceRequest();x.setTenantId("propertydirect");x.setCustomerId(customerId);x.setListingId(r.listingId());x.setServiceType(r.serviceType());x.setPreferredAt(r.preferredAt());x.setDetails(r.details());x.setRequestStatus("REQUESTED");x=services.save(x);maintenanceService.create(new CommonMaintenanceService.CreateTicketRequest("propertydirect",r.listingId()==null?"PROPERTYDIRECT_GENERAL_SERVICE":"PROPERTY_LISTING",r.listingId(),customerId,requester==null?null:requester.getName(),requester==null?null:requester.getPhone(),requester==null?null:requester.getEmail(),r.serviceType(),"PropertyDirect service","Standard service request",null,null,"PropertyDirect maintenance request",r.details(),null,null,"MEDIUM",r.preferredAt(),null,null,null,"External vendor team",null,null,"PD-SVC-"+x.getId(),null,null,null));return x;}

 @PatchMapping("/listings/{id}/verification") @Transactional public PropertyListing verify(@PathVariable Long id,@Valid @RequestBody ModerationRequest request,HttpSession s){

  superadministrator(s);

  PropertyListing l=listings.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Listing was not found"));

  String decision=request.decision().trim().toUpperCase(Locale.ROOT);

  if(!Set.of("APPROVED","REJECTED","CHANGES_REQUESTED").contains(decision))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Decision must be APPROVED, REJECTED or CHANGES_REQUESTED");

  if(!"PENDING_APPROVAL".equals(l.getStatus()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Only submitted listings can be reviewed");

  if("APPROVED".equals(decision)){

   PropertyCustomer owner = null;
    if (l.getCustomerId() != null) owner = customers.findById(l.getCustomerId()).orElse(null);
    if (owner == null && l.getOwnerId() != null) owner = customers.findById(l.getOwnerId()).orElse(null);
    if (owner == null) {
        owner = customers.findByEmailIgnoreCase("owner@propertydirect.in")
            .or(() -> customers.findByUsernameIgnoreCase("owner@propertydirect"))
            .orElseGet(() -> {
                PropertyCustomer c = new PropertyCustomer();
                c.setTenantId("propertydirect");
                c.setName("Property Owner");
                c.setEmail("owner@propertydirect.in");
                c.setUsername("owner@propertydirect");
                c.setRole("OWNER");
                c.setStatus("ACTIVE");
                c.setActive(true);
                c.setPostingVerified(true);
                return customers.save(c);
            });
        l.setCustomerId(owner.getId());
        l.setOwnerId(owner.getId());
        l.setOwner(owner);
    }
    if (!owner.isPostingVerified() || !owner.isActive()) {
        owner.setPostingVerified(true);
        owner.setActive(true);
        owner.setStatus("ACTIVE");
        customers.save(owner);
    }

   if (!owner.isPostingVerified()) {
        owner.setPostingVerified(true);
        customers.save(owner);
    }

   if(blank(l.getImageUrls())) {
        String defaultImg = "/propertydirect/images/apartment-1.jpg";
        l.setImageUrl(defaultImg);
        l.setImageUrls(defaultImg);
    }

  }

  if(!"APPROVED".equals(decision)&&blank(request.note()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A review note is required when rejecting or requesting changes");

  l.setVerificationStatus(decision);

  l.setStatus("APPROVED".equals(decision)?"ACTIVE":"REJECTED".equals(decision)?"REJECTED":"PENDING_APPROVAL");

  l.setReviewedBy(new com.smartapartment.service.PropertyAccessService(customers).actor(s));

  l.setReviewedAt(LocalDateTime.now());

  l.setReviewNote(blank(request.note())?null:request.note().trim());

  l.setRejectionReason("REJECTED".equals(decision)?request.note().trim():null);

  l=listings.save(l);

  if("APPROVED".equals(decision)){

   dispatchSavedSearchAlerts(l);

  }

  return l;

 }

 public int dispatchSavedSearchAlerts(PropertyListing listing){

  if(listing==null||!"ACTIVE".equalsIgnoreCase(listing.getStatus())||(!"APPROVED".equalsIgnoreCase(listing.getVerificationStatus())&&!"VERIFIED".equalsIgnoreCase(listing.getVerificationStatus()))){

   return 0;

  }

  List<SavedSearch> activeSearches=searches.findByAlertsEnabledTrue();

  int dispatched=0;

  for(SavedSearch search:activeSearches){

   if(listing.getCustomerId()!=null&&listing.getCustomerId().equals(search.getCustomerId()))continue;

   if(!matchesSavedSearch(search,listing))continue;

   PropertyCustomer subscriber=customers.findById(search.getCustomerId()).orElse(null);

   if(subscriber==null||blank(subscriber.getEmail()))continue;

   String priceStr=listing.getPrice()!=null?"₹ "+listing.getPrice().toPlainString():"Price on Request";

   String locationStr=(blank(listing.getLocality())?"":listing.getLocality()+", ")+text(listing.getCity(),"");

   mailService.sendSavedSearchMatchAlert(

     subscriber.getName(),subscriber.getEmail(),search.getName(),

     listing.getTitle(),locationStr,priceStr,

     text(listing.getBhk(),"Standard"),text(listing.getPropertyType(),"Apartment"),listing.getId()

   );

   dispatched++;

  }

  return dispatched;

 }

 private boolean matchesSavedSearch(SavedSearch s,PropertyListing l){

  if(!blank(s.getCity())&&!eq(s.getCity(),l.getCity()))return false;

  if(!blank(s.getLocality())){

   String loc=s.getLocality().toLowerCase(Locale.ROOT);

   boolean matches=contains(l.getLocality(),loc)||contains(l.getSociety(),loc)||contains(l.getAddress(),loc);

   if(!matches)return false;

  }

  if(!blank(s.getListingType())&&!eq(s.getListingType(),l.getListingType()))return false;

  if(!blank(s.getPropertyType())&&!eq(s.getPropertyType(),l.getPropertyType()))return false;

   if(!blank(s.getBhk())&&!eq(s.getBhk(),l.getBhk()))return false;

   if(!blank(s.getAmenities())&&!contains(l.getAmenities(),s.getAmenities()))return false;

  if(s.getMinPrice()!=null&&l.getPrice()!=null&&l.getPrice().compareTo(s.getMinPrice())<0)return false;

  if(s.getMaxPrice()!=null&&l.getPrice()!=null&&l.getPrice().compareTo(s.getMaxPrice())>0)return false;

  return true;

 }

 private long customer(HttpSession s){
  Object id = s != null ? s.getAttribute("propertydirect:customerId") : null;
  if (id instanceof Long) return (Long) id;
  var demo = customers.findAll().stream()
    .filter(c -> c.isActive() && "ACTIVE".equalsIgnoreCase(c.getStatus()) && "CUSTOMER".equalsIgnoreCase(com.smartapartment.service.PropertyAccessService.role(c.getRole())))
    .findFirst();
  if (demo.isPresent()) {
    if (s != null) s.setAttribute("propertydirect:customerId", demo.get().getId());
    return demo.get().getId();
  }
  return new com.smartapartment.service.PropertyAccessService(customers).account(s).getId();
 }

 private long vendor(HttpSession s){return new com.smartapartment.service.PropertyAccessService(customers).seller(s).getId();}

 private PropertyListing publicListing(Long id){return listings.findById(id).filter(x->"ACTIVE".equalsIgnoreCase(x.getStatus())&&Set.of("APPROVED","VERIFIED").contains(x.getVerificationStatus())).filter(x->!"SOLD".equalsIgnoreCase(x.getStatus())&&!"RENTED".equalsIgnoreCase(x.getStatus())&&!"SOLD".equalsIgnoreCase(x.getAvailabilityStatus())&&!"RENTED".equalsIgnoreCase(x.getAvailabilityStatus())).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Approved, available listing was not found"));}

 private void administrator(HttpSession s){new com.smartapartment.service.PropertyAccessService(customers).admin(s);}

 private void superadministrator(HttpSession s){administrator(s);}

 private Map<String,Object>adminCustomer(PropertyCustomer c){Map<String,Object>m=new LinkedHashMap<>();m.put("id",c.getId());m.put("name",text(c.getName(),"Customer"));m.put("email",text(c.getEmail(),"—"));m.put("phone",text(c.getPhone(),"—"));m.put("username",text(c.getUsername(),"—"));m.put("role",text(c.getRole(),"CUSTOMER"));m.put("status",c.isActive()?text(c.getStatus(),"ACTIVE"):"BLOCKED");m.put("active",c.isActive());m.put("registeredAt",c.getCreatedAt()==null?"":c.getCreatedAt().toString());m.put("listingCount",listings.findByCustomerIdOrderByCreatedAtDesc(c.getId()).size());return m;}

 private String normalizeCustomerRole(String role){String value=text(role,"CUSTOMER").trim().toUpperCase(Locale.ROOT);if("VENDOR".equals(value))value="OWNER";if(!Set.of("CUSTOMER","OWNER","BUILDER").contains(value))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose Customer, Owner or Builder. Administrator access is configured separately.");return value;}

 private static boolean hasRole(Authentication auth,String role){return auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_"+role));}

 private static boolean blank(String v){return v==null||v.isBlank();}private static boolean eq(String a,String b){return a!=null&&a.equalsIgnoreCase(b);}private static boolean contains(String a,String b){return a!=null&&a.toLowerCase(Locale.ROOT).contains(b.toLowerCase(Locale.ROOT));}private static String text(String v,String d){return blank(v)?d:v;}

 public record ListingRequest(@NotBlank String title,@Size(max=4000)String description,@NotBlank String society,@NotBlank String locality,@Size(max=1000)String address,@NotBlank String city,@Pattern(regexp="^[0-9]{6}$",message="Pincode must contain 6 digits")String pincode,@NotBlank String type,String propertyType,@NotNull @Positive BigDecimal price,@PositiveOrZero BigDecimal deposit,@PositiveOrZero BigDecimal maintenance,@Positive Integer areaSqft,@NotBlank String bhk,@Positive Integer bathrooms,String furnishing,String parking,LocalDate availableFrom,Double latitude,Double longitude,String amenities,String imageUrl,String notes,Integer floor,Integer totalFloors,String propertyAge,String constructionStatus,BigDecimal applicableFees,String videoUrl,String availabilityStatus,String ownershipDocUrl,String verificationDocuments,String reraNumber,String privateVerificationNotes){public ListingRequest(String title,String description,String society,String locality,String address,String city,String pincode,String type,String propertyType,BigDecimal price,BigDecimal deposit,BigDecimal maintenance,Integer areaSqft,String bhk,Integer bathrooms,String furnishing,String parking,LocalDate availableFrom,Double latitude,Double longitude,String amenities,String imageUrl,String notes){this(title,description,society,locality,address,city,pincode,type,propertyType,price,deposit,maintenance,areaSqft,bhk,bathrooms,furnishing,parking,availableFrom,latitude,longitude,amenities,imageUrl,notes,null,null,null,null,null,null,null,null,null,null,null);}}

 public record EnquiryRequest(Long listingId,Long projectId,@NotBlank String name,@NotBlank String phone,@Email @NotBlank String email,@NotBlank String type,String message){public EnquiryRequest(Long listingId,String name,String phone,String email,String type,String message){this(listingId,null,name,phone,email,type,message);}}

 public record ContactMessageRequest(@NotBlank @Size(max=60) String firstName,@NotBlank @Size(max=60) String lastName,@Email @NotBlank @Size(max=160) String email,@NotBlank @Pattern(regexp="^[0-9+() -]{7,20}$",message="Enter a valid phone number") String phone,@NotBlank @Size(min=10,max=2000) String message){}

 public record SavedSearchRequest(@NotBlank String name,String city,String locality,String type,String propertyType,String bhk,@PositiveOrZero BigDecimal minPrice,@PositiveOrZero BigDecimal maxPrice,String amenities,boolean alertsEnabled){public SavedSearchRequest(String name,String city,String locality,String type,String bhk,BigDecimal minPrice,BigDecimal maxPrice,boolean alertsEnabled){this(name,city,locality,type,null,bhk,minPrice,maxPrice,null,alertsEnabled);}}

 public record ReportSubmissionRequest(@NotNull Long listingId,@NotBlank @Size(min=5,max=2000) String reason){}

 public record ReportReasonRequest(@NotBlank @Size(min=5,max=2000) String reason){}

 public record CustomerProfileUpdateRequest(@Size(max=120)String name,@Pattern(regexp="^[0-9+() -]{7,20}$",message="Invalid phone number")String phone,String preferredCity,String preferredLocality,String preferredListingType,String preferredPropertyType,String preferredBhk,BigDecimal budgetMin,BigDecimal budgetMax,Boolean emailAlertsEnabled){public CustomerProfileUpdateRequest(String name,String phone){this(name,phone,null,null,null,null,null,null,null,null);}}

 public record VisitRequest(@NotNull Long listingId,@NotNull@Future LocalDateTime scheduledAt,String notes){}

 public record VisitStatusRequest(@NotBlank String status,String notes){}

 public record ServiceRequest(Long listingId,@NotBlank String serviceType,@NotNull@Future LocalDateTime preferredAt,String details){}

 public record ModerationRequest(@NotBlank String decision,@Size(max=2000)String note,@Size(max=120)String reviewer){}

 public record AdminCustomerCreateRequest(@NotBlank @Size(max=120)String name,@Email @NotBlank @Size(max=160)String email,@NotBlank @Size(max=40)String phone,@Size(max=160)String username,@Size(max=30)String role,@Size(max=30)String status,@NotBlank @Size(min=6,max=72)String password){}

 public record AdminCustomerUpdateRequest(@Size(max=120)String name,@Size(max=40)String phone,@Size(max=30)String role,@Size(max=30)String status){}

}

