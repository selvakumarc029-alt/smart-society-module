package com.smartapartment.controller;
import com.fasterxml.jackson.databind.ObjectMapper;import com.smartapartment.entity.*;import com.smartapartment.repository.*;import com.smartapartment.service.CommonMaintenanceService;import com.smartapartment.service.MailService;import jakarta.servlet.http.HttpSession;import jakarta.validation.Valid;import jakarta.validation.constraints.*;import java.io.*;import java.math.BigDecimal;import java.nio.file.*;import java.time.*;import java.util.*;import org.springframework.core.io.*;import org.springframework.http.*;import org.springframework.security.core.Authentication;import org.springframework.security.core.context.SecurityContextHolder;import org.springframework.security.crypto.password.PasswordEncoder;import org.springframework.transaction.annotation.Transactional;import org.springframework.web.bind.annotation.*;import org.springframework.web.multipart.MultipartFile;import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/property")
public class PropertyApiController{
 private final PropertyListingRepository listings;private final PropertyImageRepository images;private final PropertyCustomerRepository customers;private final PropertyEnquiryRepository enquiries;private final SavedPropertyRepository saved;private final SavedSearchRepository searches;private final PropertyVisitRepository visits;private final PropertyServiceRequestRepository services;private final CommonMaintenanceService maintenanceService;private final ObjectMapper mapper;private final MailService mailService;private final PasswordEncoder passwordEncoder;private final Path mediaRoot=Paths.get(System.getProperty("java.io.tmpdir"),"propertydirect-media");
 public PropertyApiController(PropertyListingRepository l,PropertyImageRepository i,PropertyCustomerRepository c,PropertyEnquiryRepository e,SavedPropertyRepository s,SavedSearchRepository q,PropertyVisitRepository v,PropertyServiceRequestRepository r,CommonMaintenanceService maintenanceService,ObjectMapper m,MailService mailService,PasswordEncoder passwordEncoder){listings=l;images=i;customers=c;enquiries=e;saved=s;searches=q;visits=v;services=r;this.maintenanceService=maintenanceService;mapper=m;this.mailService=mailService;this.passwordEncoder=passwordEncoder;}
 @GetMapping("/listings") public List<PropertyListing> listings(@RequestParam(required=false)String city,@RequestParam(required=false)String locality,@RequestParam(required=false)String type,@RequestParam(required=false)String bhk,@RequestParam(required=false)BigDecimal minPrice,@RequestParam(required=false)BigDecimal maxPrice,@RequestParam(required=false)String furnishing,@RequestParam(defaultValue="newest")String sort){java.util.stream.Stream<PropertyListing>s=listings.findByStatusAndVerificationStatusInOrderByCreatedAtDesc("ACTIVE",List.of("APPROVED","VERIFIED")).stream().filter(x->blank(city)||eq(x.getCity(),city)).filter(x->blank(locality)||contains(x.getLocality(),locality)||contains(x.getSociety(),locality)).filter(x->blank(type)||eq(x.getListingType(),type)).filter(x->blank(bhk)||eq(x.getBhk(),bhk)).filter(x->minPrice==null||x.getPrice().compareTo(minPrice)>=0).filter(x->maxPrice==null||x.getPrice().compareTo(maxPrice)<=0).filter(x->blank(furnishing)||eq(x.getFurnishing(),furnishing));Comparator<PropertyListing>c="price_asc".equals(sort)?Comparator.comparing(PropertyListing::getPrice):"price_desc".equals(sort)?Comparator.comparing(PropertyListing::getPrice).reversed():Comparator.comparing(PropertyListing::getCreatedAt).reversed();return s.sorted(c).toList();}
 @GetMapping("/listings/{id}") @Transactional public PropertyListing listing(@PathVariable Long id){PropertyListing l=publicListing(id);l.setViewCount(l.getViewCount()+1);return listings.save(l);}
 @GetMapping("/my-listings") public List<PropertyListing> mine(HttpSession s){return listings.findByCustomerIdOrderByCreatedAtDesc(customer(s));}
 @PostMapping("/listings") @Transactional public PropertyListing create(@Valid @RequestBody ListingRequest r,HttpSession s){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Submit listings with 10 to 20 property photos using the photo-upload workflow");}
 @PostMapping(value="/listings/with-photos",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional public PropertyListing createWithPhotos(@RequestPart("listing")String json,@RequestPart("photos")List<MultipartFile> photos,HttpSession s)throws IOException{if(photos==null||photos.isEmpty())throw new IllegalArgumentException("Upload at least one property photo");if(photos.size()>10)throw new IllegalArgumentException("A maximum of 10 property photos is allowed");ListingRequest r=mapper.readValue(json,ListingRequest.class);return saveListing(r,vendor(s),photos);}
 @Transactional PropertyListing createApi(ListingRequest request,List<MultipartFile> photos,HttpSession session){if(photos==null||photos.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload at least one property photo");if(photos.size()>10)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A maximum of 10 property photos is allowed");return saveListing(request,vendor(session),photos);}
 @Transactional PropertyListing resubmitApi(Long id,ListingRequest r,HttpSession session){PropertyListing listing=listings.findByIdAndCustomerId(id,vendor(session)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Listing was not found"));if(!Set.of("REJECTED","CHANGES_REQUESTED").contains(listing.getVerificationStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only rejected listings or listings requiring changes can be resubmitted");listing.setTitle(r.title());listing.setDescription(r.description());listing.setSociety(r.society());listing.setLocality(r.locality());listing.setAddress(r.address());listing.setCity(r.city());listing.setPincode(r.pincode());listing.setListingType(r.type().toUpperCase(Locale.ROOT));listing.setPropertyType(text(r.propertyType(),"APARTMENT"));listing.setPrice(r.price());listing.setDeposit(r.deposit());listing.setMaintenance(r.maintenance());listing.setAreaSqft(r.areaSqft());listing.setBhk(r.bhk());listing.setBathrooms(r.bathrooms());listing.setFurnishing(r.furnishing());listing.setParking(r.parking());listing.setAvailableFrom(r.availableFrom());listing.setLatitude(r.latitude());listing.setLongitude(r.longitude());listing.setAmenities(r.amenities());listing.setNotes(r.notes());listing.setVerificationStatus("PENDING");listing.setStatus("PENDING_APPROVAL");listing.setRejectionReason(null);listing.setReviewNote(null);listing.setReviewedAt(null);listing.setReviewedBy(null);return listings.save(listing);}
 private PropertyListing saveListing(ListingRequest r,long customerId,List<MultipartFile> photos){PropertyListing l=new PropertyListing();l.setTenantId("propertydirect");l.setCustomerId(customerId);l.setOwner(customers.findById(customerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Property owner account was not found")));l.setTitle(r.title());l.setDescription(r.description());l.setSociety(r.society());l.setLocality(r.locality());l.setAddress(r.address());l.setCity(r.city());l.setPincode(r.pincode());l.setListingType(r.type().toUpperCase(Locale.ROOT));l.setPropertyType(text(r.propertyType(),"APARTMENT"));l.setPrice(r.price());l.setDeposit(r.deposit());l.setMaintenance(r.maintenance());l.setAreaSqft(r.areaSqft());l.setBhk(r.bhk());l.setBathrooms(r.bathrooms());l.setFurnishing(r.furnishing());l.setParking(r.parking());l.setAvailableFrom(r.availableFrom());l.setLatitude(r.latitude());l.setLongitude(r.longitude());l.setAmenities(r.amenities());l.setNotes(r.notes());l.setVerificationStatus("PENDING");l.setStatus("PENDING_APPROVAL");l=listings.saveAndFlush(l);if(!photos.isEmpty()){try{Files.createDirectories(mediaRoot);List<String>urls=new ArrayList<>();for(int index=0;index<photos.size();index++){MultipartFile photo=photos.get(index);if(photo.isEmpty()||photo.getContentType()==null||!photo.getContentType().startsWith("image/"))throw new IllegalArgumentException("Every uploaded file must be an image");String ext=Optional.ofNullable(photo.getOriginalFilename()).filter(n->n.contains(".")).map(n->n.substring(n.lastIndexOf('.'))).orElse(".jpg");String name=l.getId()+"-"+UUID.randomUUID()+ext.replaceAll("[^A-Za-z0-9.]","");Files.copy(photo.getInputStream(),mediaRoot.resolve(name),StandardCopyOption.REPLACE_EXISTING);String url="/api/property/media/"+name;urls.add(url);PropertyImage image=new PropertyImage();image.setTenantId("propertydirect");image.setProperty(l);image.setImageUrl(url);image.setPrimary(index==0);images.saveAndFlush(image);}l.setImageUrls(String.join("\n",urls));l.setImageUrl(urls.get(0));l=listings.saveAndFlush(l);}catch(IOException ex){throw new UncheckedIOException(ex);}}return l;}
 @GetMapping("/media/{name:.+}") public ResponseEntity<Resource>media(@PathVariable String name)throws IOException{Path file=mediaRoot.resolve(name).normalize();if(!file.startsWith(mediaRoot)||!Files.exists(file))return ResponseEntity.notFound().build();String type=Optional.ofNullable(Files.probeContentType(file)).orElse("image/jpeg");return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30))).body(new FileSystemResource(file));}
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
  summary.put("totalEnquiries",enquiries.count()); summary.put("scheduledVisits",visits.count()); summary.put("approvedListings",active);
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
  items.sort((left,right)->String.valueOf(right.get("createdAt")).compareTo(String.valueOf(left.get("createdAt"))));
  return Map.of("items",items.stream().limit(8).toList(),"refreshedAt",LocalDateTime.now().toString());
 }
 @GetMapping("/admin/customers") public List<Map<String,Object>>adminCustomers(HttpSession s){administrator(s);return customers.findAll().stream().filter(c->!"DELETED".equalsIgnoreCase(text(c.getStatus(),""))).sorted(Comparator.comparing(PropertyCustomer::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(this::adminCustomer).toList();}
 @PostMapping("/admin/customers") @Transactional public Map<String,Object>createCustomer(@Valid @RequestBody AdminCustomerCreateRequest r,HttpSession s){administrator(s);String email=text(r.email(),"").trim().toLowerCase(Locale.ROOT);String username=blank(r.username())?email:r.username().trim().toLowerCase(Locale.ROOT);if(blank(r.name())||blank(email)||blank(r.phone())||blank(r.password()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Name, email, phone and password are required");if(r.password().length()<6)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at least 6 characters");if(customers.existsByUsernameIgnoreCaseOrEmailIgnoreCase(username,email))throw new ResponseStatusException(HttpStatus.CONFLICT,"User already exists. Contact your admin.");PropertyCustomer c=new PropertyCustomer();c.setTenantId("propertydirect");c.setName(r.name().trim());c.setEmail(email);c.setUsername(username);c.setPhone(r.phone().trim());c.setPasswordHash(passwordEncoder.encode(r.password()));c.setRole(normalizeCustomerRole(r.role()));String status=text(r.status(),"ACTIVE").trim().toUpperCase(Locale.ROOT);c.setStatus(status);c.setActive(!Set.of("BLOCKED","SUSPENDED","DELETED","INACTIVE").contains(status));customers.save(c);return adminCustomer(c);}
 @PatchMapping("/admin/customers/{id}") @Transactional public Map<String,Object>updateCustomer(@PathVariable Long id,@Valid @RequestBody AdminCustomerUpdateRequest r,HttpSession s){administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));if(!blank(r.name()))c.setName(r.name().trim());if(!blank(r.phone()))c.setPhone(r.phone().trim());if(!blank(r.role()))c.setRole(r.role().trim().toUpperCase(Locale.ROOT));if(!blank(r.status())){String status=r.status().trim().toUpperCase(Locale.ROOT);c.setStatus(status);c.setActive(!Set.of("BLOCKED","SUSPENDED","DELETED","INACTIVE").contains(status));}customers.save(c);return adminCustomer(c);}
 @PatchMapping("/admin/customers/{id}/active") @Transactional public Map<String,Object>setCustomerActive(@PathVariable Long id,@RequestParam boolean active,HttpSession s){administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));c.setActive(active);c.setStatus(active?"ACTIVE":"BLOCKED");customers.save(c);return adminCustomer(c);}
 @DeleteMapping("/admin/customers/{id}") @Transactional public Map<String,Object>deleteCustomer(@PathVariable Long id,HttpSession s){administrator(s);PropertyCustomer c=customers.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"PropertyDirect user was not found"));c.setActive(false);c.setStatus("DELETED");customers.save(c);return Map.of("id",id,"message","PropertyDirect user removed from active access");}
 @GetMapping("/admin/listings") public List<PropertyListing>adminListings(@RequestParam(defaultValue="PENDING")String verificationStatus,HttpSession s){administrator(s);return listings.findByVerificationStatusOrderByCreatedAtDesc(verificationStatus.toUpperCase(Locale.ROOT));}
 @DeleteMapping("/listings/{id}") @Transactional public void delete(@PathVariable Long id,HttpSession s){PropertyListing l=listings.findByIdAndCustomerId(id,customer(s)).orElseThrow(()->new IllegalArgumentException("Listing was not found"));l.setStatus("INACTIVE");listings.save(l);}
 @PatchMapping("/listings/{id}/resubmit") public PropertyListing resubmit(@PathVariable Long id,@Valid @RequestBody ListingRequest request,HttpSession session){return resubmitApi(id,request,session);}
 @PostMapping("/enquiries") @Transactional public Map<String,Object> enquire(@Valid @RequestBody EnquiryRequest r,HttpSession s){
  customer(s);
  PropertyListing l=publicListing(r.listingId());
  PropertyEnquiry e=new PropertyEnquiry();
  e.setTenantId("propertydirect");
  e.setCustomerId((Long)s.getAttribute("propertydirect:customerId"));
  e.setListingId(r.listingId());
  e.setName(r.name());
  e.setPhone(r.phone());
  e.setEmail(r.email());
  e.setEnquiryType(r.type());
  e.setMessage(r.message());
  e=enquiries.save(e);
  boolean ownerNotified=false;
  String delivery="OWNER_INBOX";
  if(l.getCustomerId()!=null){
   PropertyCustomer owner=customers.findById(l.getCustomerId()).orElse(null);
   if(owner!=null&&!blank(owner.getEmail())){
    Map<String,Object> mailRes=mailService.sendPropertyEnquiryNotification(
      owner.getName(),owner.getEmail(),l.getTitle(),
      r.name(),r.email(),r.phone(),r.type(),r.message(),
      e.getId(),l.getApartmentCode()
    );
    ownerNotified=Boolean.TRUE.equals(mailRes.get("sent"));
    delivery=ownerNotified?"EMAIL_SENT":"OWNER_INBOX";
   }
  }
  return Map.of("id",e.getId(),"message","Enquiry submitted","ownerNotified",ownerNotified,"delivery",delivery);
 }
 @PostMapping("/contact-messages") @Transactional public Map<String,Object> contact(@Valid @RequestBody ContactMessageRequest r,HttpSession s){PropertyEnquiry e=new PropertyEnquiry();e.setTenantId("propertydirect");e.setCustomerId((Long)s.getAttribute("propertydirect:customerId"));e.setName((r.firstName().trim()+" "+r.lastName().trim()).trim());e.setPhone(r.phone().trim());e.setEmail(r.email().trim().toLowerCase(Locale.ROOT));e.setEnquiryType("PLATFORM_CONTACT");e.setMessage(r.message().trim());e=enquiries.save(e);Map<String,Object>delivery=mailService.sendPropertyDirectContactNotification(e.getName(),e.getEmail(),e.getPhone(),e.getMessage(),e.getId());boolean emailSent=Boolean.TRUE.equals(delivery.get("sent"));return Map.of("id",e.getId(),"emailSent",emailSent,"delivery",emailSent?"EMAIL_SENT":"ADMIN_INBOX","message",emailSent?"Your message was received and PropertyDirect support has been notified.":"Your message was received by PropertyDirect support and added to the Super Admin inbox.");}
 @GetMapping("/admin/contact-messages") public List<Map<String,Object>>contactMessages(HttpSession s){administrator(s);return enquiries.findByEnquiryTypeOrderByCreatedAtDesc("PLATFORM_CONTACT").stream().map(e->{Map<String,Object>m=new LinkedHashMap<>();m.put("id",e.getId());m.put("name",text(e.getName(),"Website visitor"));m.put("email",text(e.getEmail(),"—"));m.put("phone",text(e.getPhone(),"—"));m.put("message",text(e.getMessage(),"—"));m.put("createdAt",e.getCreatedAt()==null?"":e.getCreatedAt().toString());return m;}).toList();}
 @GetMapping("/saved") public List<SavedProperty> saved(HttpSession s){return saved.findByCustomerIdOrderByCreatedAtDesc(customer(s));}
 @PostMapping("/saved/{listingId}") @Transactional public Map<String,Object> save(@PathVariable Long listingId,HttpSession s){long c=customer(s);PropertyListing l=publicListing(listingId);SavedProperty x=saved.findByCustomerIdAndListingId(c,listingId).orElseGet(SavedProperty::new);x.setTenantId("propertydirect");x.setCustomerId(c);x.setListing(l);saved.save(x);return Map.of("message","Property shortlisted");}
 @DeleteMapping("/saved/{listingId}") @Transactional public void unsave(@PathVariable Long listingId,HttpSession s){saved.findByCustomerIdAndListingId(customer(s),listingId).ifPresent(saved::delete);}
 @GetMapping("/saved-searches") public List<SavedSearch> searches(HttpSession s){return searches.findByCustomerIdOrderByCreatedAtDesc(customer(s));}
 @PostMapping("/saved-searches") @Transactional public SavedSearch search(@Valid @RequestBody SavedSearchRequest r,HttpSession s){SavedSearch x=new SavedSearch();x.setTenantId("propertydirect");x.setCustomerId(customer(s));x.setName(r.name());x.setCity(r.city());x.setLocality(r.locality());x.setListingType(r.type());x.setBhk(r.bhk());x.setMinPrice(r.minPrice());x.setMaxPrice(r.maxPrice());x.setAlertsEnabled(r.alertsEnabled());return searches.save(x);}
 @GetMapping("/saved-searches/{id}/matches") public Map<String,Object> savedSearchMatches(@PathVariable Long id,HttpSession s){
  long customerId=customer(s);
  SavedSearch search=searches.findByIdAndCustomerId(id,customerId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Saved search not found"));
  List<PropertyListing> matched=listings.findByStatusAndVerificationStatusInOrderByCreatedAtDesc("ACTIVE",List.of("APPROVED","VERIFIED")).stream().filter(l->matchesSavedSearch(search,l)).toList();
  return Map.of("searchId",id,"searchName",search.getName(),"matchCount",matched.size(),"matches",matched);
 }
 @GetMapping("/visits") public List<PropertyVisit> visits(HttpSession s){return visits.findByCustomerIdOrderByScheduledAtDesc(customer(s));}
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
  if(!"APPROVED".equals(decision)&&blank(request.note()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A review note is required when rejecting or requesting changes");
  l.setVerificationStatus(decision);
  l.setStatus("APPROVED".equals(decision)?"ACTIVE":"REJECTED".equals(decision)?"REJECTED":"PENDING_APPROVAL");
  l.setReviewedBy(text(request.reviewer(),"PropertyDirect Super Admin"));
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
  if(!blank(s.getBhk())&&!eq(s.getBhk(),l.getBhk()))return false;
  if(s.getMinPrice()!=null&&l.getPrice()!=null&&l.getPrice().compareTo(s.getMinPrice())<0)return false;
  if(s.getMaxPrice()!=null&&l.getPrice()!=null&&l.getPrice().compareTo(s.getMaxPrice())>0)return false;
  return true;
 }
 private long customer(HttpSession s){Object id=s.getAttribute("propertydirect:customerId");if(id instanceof Long value)return value;Authentication auth=SecurityContextHolder.getContext().getAuthentication();if(auth!=null&&auth.isAuthenticated()&&hasRole(auth,"CUSTOMER"))return customers.findByEmailIgnoreCase(auth.getName()).map(PropertyCustomer::getId).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"PropertyDirect customer account was not found"));throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"PropertyDirect customer login is required");}
 private long vendor(HttpSession s){if(!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:vendor"))&&!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:agent"))&&!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:admin")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only PropertyDirect vendors, agents, or property admins can submit property listings");Object id=s.getAttribute("propertydirect:customerId");if(id instanceof Long value)return value;throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Property seller account is unavailable");}
 private PropertyListing publicListing(Long id){return listings.findById(id).filter(x->"ACTIVE".equals(x.getStatus())&&Set.of("APPROVED","VERIFIED").contains(x.getVerificationStatus())).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Approved listing was not found"));}
 private void administrator(HttpSession s){Authentication auth=SecurityContextHolder.getContext().getAuthentication();if(!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:admin"))&&!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:superadmin"))&&(auth==null||(!hasRole(auth,"ADMIN")&&!hasRole(auth,"SUPER_ADMIN"))))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Property administrator login is required");}
 private void superadministrator(HttpSession s){Authentication auth=SecurityContextHolder.getContext().getAuthentication();if(!Boolean.TRUE.equals(s.getAttribute("dashboard:propertydirect:superadmin"))&&(auth==null||!hasRole(auth,"SUPER_ADMIN")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the PropertyDirect Super Admin can decide listing publication");}
 private Map<String,Object>adminCustomer(PropertyCustomer c){Map<String,Object>m=new LinkedHashMap<>();m.put("id",c.getId());m.put("name",text(c.getName(),"Customer"));m.put("email",text(c.getEmail(),"—"));m.put("phone",text(c.getPhone(),"—"));m.put("username",text(c.getUsername(),"—"));m.put("role",text(c.getRole(),"CUSTOMER"));m.put("status",c.isActive()?text(c.getStatus(),"ACTIVE"):"BLOCKED");m.put("active",c.isActive());m.put("registeredAt",c.getCreatedAt()==null?"":c.getCreatedAt().toString());m.put("listingCount",listings.findByCustomerIdOrderByCreatedAtDesc(c.getId()).size());return m;}
 private String normalizeCustomerRole(String role){String value=text(role,"CUSTOMER").trim().toUpperCase(Locale.ROOT).replace(" / BUYER","").replace("DIRECT PROPERTY ","").replace("VERIFIED ","").replace("REAL ESTATE ","").replace("SUPER ADMIN STAFF","ADMIN").replace(" ","_");if(value.contains("AGENT"))return"AGENT";if(value.contains("OWNER")||value.contains("VENDOR"))return"OWNER";if(value.contains("ADMIN"))return"ADMIN";return"CUSTOMER";}
 private static boolean hasRole(Authentication auth,String role){return auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_"+role));}
 private static boolean blank(String v){return v==null||v.isBlank();}private static boolean eq(String a,String b){return a!=null&&a.equalsIgnoreCase(b);}private static boolean contains(String a,String b){return a!=null&&a.toLowerCase(Locale.ROOT).contains(b.toLowerCase(Locale.ROOT));}private static String text(String v,String d){return blank(v)?d:v;}
 public record ListingRequest(@NotBlank String title,@Size(max=4000)String description,@NotBlank String society,@NotBlank String locality,@Size(max=1000)String address,@NotBlank String city,@Pattern(regexp="^[0-9]{6}$",message="Pincode must contain 6 digits")String pincode,@NotBlank String type,String propertyType,@NotNull @Positive BigDecimal price,@PositiveOrZero BigDecimal deposit,@PositiveOrZero BigDecimal maintenance,@Positive Integer areaSqft,@NotBlank String bhk,@Positive Integer bathrooms,String furnishing,String parking,LocalDate availableFrom,Double latitude,Double longitude,String amenities,String imageUrl,String notes){}
 public record EnquiryRequest(Long listingId,@NotBlank String name,@NotBlank String phone,@Email @NotBlank String email,@NotBlank String type,String message){}
 public record ContactMessageRequest(@NotBlank @Size(max=60) String firstName,@NotBlank @Size(max=60) String lastName,@Email @NotBlank @Size(max=160) String email,@NotBlank @Pattern(regexp="^[0-9+() -]{7,20}$",message="Enter a valid phone number") String phone,@NotBlank @Size(min=10,max=2000) String message){}
 public record SavedSearchRequest(@NotBlank String name,String city,String locality,String type,String bhk,@PositiveOrZero BigDecimal minPrice,@PositiveOrZero BigDecimal maxPrice,boolean alertsEnabled){}
 public record VisitRequest(@NotNull Long listingId,@NotNull@Future LocalDateTime scheduledAt,String notes){}
 public record VisitStatusRequest(@NotBlank String status,String notes){}
 public record ServiceRequest(Long listingId,@NotBlank String serviceType,@NotNull@Future LocalDateTime preferredAt,String details){}
 public record ModerationRequest(@NotBlank String decision,@Size(max=2000)String note,@Size(max=120)String reviewer){}
 public record AdminCustomerCreateRequest(@NotBlank @Size(max=120)String name,@Email @NotBlank @Size(max=160)String email,@NotBlank @Size(max=40)String phone,@Size(max=160)String username,@Size(max=30)String role,@Size(max=30)String status,@NotBlank @Size(min=6,max=72)String password){}
 public record AdminCustomerUpdateRequest(@Size(max=120)String name,@Size(max=40)String phone,@Size(max=30)String role,@Size(max=30)String status){}
}
