package com.smartapartment.config;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Apartment;
import com.smartapartment.entity.Block;
import com.smartapartment.entity.Complaint;
import com.smartapartment.entity.Resident;
import com.smartapartment.entity.SubscriptionPlan;
import com.smartapartment.entity.Tenant;
import com.smartapartment.entity.UserRole;
import com.smartapartment.entity.MaintenanceHub;
import com.smartapartment.entity.MaintenancePartner;
import com.smartapartment.entity.StaffAttendance;
import com.smartapartment.repository.StaffAttendanceRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.smartapartment.repository.ApartmentRepository;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.BlockRepository;
import com.smartapartment.repository.ComplaintRepository;
import com.smartapartment.repository.ResidentRepository;
import com.smartapartment.repository.SubscriptionPlanRepository;
import com.smartapartment.repository.TenantRepository;
import com.smartapartment.repository.AmenityRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.UUID;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner seedData(AppUserRepository users,
                               TenantRepository tenants,
                               SubscriptionPlanRepository plans,
                               BlockRepository blocks,
                               ApartmentRepository apartments,
                               ResidentRepository residents,
                               ComplaintRepository complaints,
                               AmenityRepository amenities,
                               MaintenanceBillRepository maintenanceBills,
                               com.smartapartment.repository.MaintenanceHubRepository hubs,
                               com.smartapartment.repository.MaintenancePartnerRepository partners,
                               StaffAttendanceRepository staffAttendances,
                               com.smartapartment.repository.WorkerAttendanceRepository workerAttendances,
                               com.smartapartment.repository.WorkerAvailabilityRepository workerAvailabilities,
                               PasswordEncoder encoder,
                               Environment environment) {
        return args -> {
            boolean seedDemo = Boolean.parseBoolean(environment.getProperty("SEED_DEMO_ACCOUNTS", "true"));
            String superAdminEmail = environment.getProperty("SEED_SUPER_ADMIN_EMAIL", "superadmin@smartapartment");
            String superAdminPassword = environment.getProperty("SEED_SUPER_ADMIN_PASSWORD", "superadmin123");
            String residentEmail = environment.getProperty("SEED_RESIDENT_EMAIL", "resident@smartapartment");
            String residentPassword = environment.getProperty("SEED_RESIDENT_PASSWORD", "resident123");

            users.findByEmail("superadmin@smartapartment").ifPresentOrElse(superAdmin -> {
                superAdmin.setTenantId("platform");
                superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
                superAdmin.setStatus("ACTIVE");
                superAdmin.setAccountLocked(false);
                users.save(superAdmin);
            }, () -> {
                AppUser superAdmin = new AppUser();
                superAdmin.setTenantId("platform");
                superAdmin.setFullName("Platform Super Admin");
                superAdmin.setEmail("superadmin@smartapartment");
                superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
                superAdmin.setRole(UserRole.SUPER_ADMIN);
                superAdmin.setStatus("ACTIVE");
                superAdmin.setAccountLocked(false);
                users.save(superAdmin);
            });

            users.findByEmail("superadmin@smartsociety").ifPresentOrElse(superAdmin -> {
                superAdmin.setTenantId("platform");
                superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
                superAdmin.setStatus("ACTIVE");
                superAdmin.setAccountLocked(false);
                users.save(superAdmin);
            }, () -> {
                AppUser superAdmin = new AppUser();
                superAdmin.setTenantId("platform");
                superAdmin.setFullName("Platform Super Admin");
                superAdmin.setEmail("superadmin@smartsociety");
                superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
                superAdmin.setRole(UserRole.SUPER_ADMIN);
                superAdmin.setStatus("ACTIVE");
                superAdmin.setAccountLocked(false);
                users.save(superAdmin);
            });

            ensurePlan(plans, "Free", "FREE", BigDecimal.ZERO, 50, 150, false, false, false);
            ensurePlan(plans, "Standard", "STANDARD", new BigDecimal("4999"), 500, 1500, true, true, false);
            ensurePlan(plans, "Premium", "PREMIUM", new BigDecimal("9999"), 5000, 15000, true, true, true);

            // Production/local development starts with an empty operational workspace.
            // Demo societies, residents, bills and activity are opt-in only.
            if (!seedDemo) return;

            plans.findFirstByTenantIdAndNameOrderByIdAsc("platform", "Premium Plan").orElseGet(() -> {
                SubscriptionPlan plan = new SubscriptionPlan();
                plan.setTenantId("platform");
                plan.setName("Premium Plan");
                plan.setMonthlyPrice(new BigDecimal("4999"));
                plan.setMaxApartments(500);
                plan.setMaxResidents(1500);
                plan.setVisitorManagement(true);
                plan.setAmenityBooking(true);
                plan.setAnalytics(true);
                return plans.save(plan);
            });

            Tenant greenHeights = tenants.findByCode("green-heights").orElseGet(() -> {
                Tenant tenant = new Tenant();
                tenant.setTenantId("green-heights");
                tenant.setCode("green-heights");
                return tenant;
            });
            greenHeights.setSocietyName("Green Heights Apartment");
            greenHeights.setContactEmail("admin@greenheights.com");
            greenHeights.setPhone("9876543210");
            greenHeights.setAddress("Main Road");
            greenHeights.setCity("Chennai");
            greenHeights.setApproved(true);
            tenants.save(greenHeights);

            AppUser residentUser = createDemoUser(users, encoder, "green-heights", "Demo Resident",
                    residentEmail, residentPassword, UserRole.RESIDENT);

            if (seedDemo) {
                // Seed @smartapartment domain accounts (matching login page buttons)
                createDemoUser(users, encoder, "platform", "Platform Super Admin",
                        "superadmin@smartapartment", "superadmin123", UserRole.SUPER_ADMIN);
                createDemoUser(users, encoder, "green-heights", "Society Administrator",
                        "admin@smartapartment", "admin123", UserRole.SOCIETY_ADMIN);
                createDemoUser(users, encoder, "green-heights", "Demo Resident",
                        "resident@smartapartment", "resident123", UserRole.RESIDENT);
                createDemoUser(users, encoder, "green-heights", "Gate Security",
                        "security@smartapartment", "security123", UserRole.SECURITY_STAFF);
                createDemoUser(users, encoder, "green-heights", "Maintenance Staff",
                        "maintenance@smartapartment", "maintenance123", UserRole.MAINTENANCE_STAFF);
                createDemoUser(users, encoder, "green-heights", "Society Accountant",
                        "accountant@smartapartment", "accountant123", UserRole.ACCOUNTANT);

                // Seed @smartsociety domain accounts (matching alternative domain format)
                createDemoUser(users, encoder, "platform", "Platform Super Admin",
                        "superadmin@smartsociety", "superadmin123", UserRole.SUPER_ADMIN);
                createDemoUser(users, encoder, "green-heights", "Society Administrator",
                        "admin@smartsociety", "admin123", UserRole.SOCIETY_ADMIN);
                createDemoUser(users, encoder, "green-heights", "Demo Resident",
                        "resident@smartsociety", "resident123", UserRole.RESIDENT);
                createDemoUser(users, encoder, "green-heights", "Gate Security",
                        "security@smartsociety", "security123", UserRole.SECURITY_STAFF);
                createDemoUser(users, encoder, "green-heights", "Maintenance Staff",
                        "maintenance@smartsociety", "maintenance123", UserRole.MAINTENANCE_STAFF);
                createDemoUser(users, encoder, "green-heights", "Society Accountant",
                        "accountant@smartsociety", "accountant123", UserRole.ACCOUNTANT);
                createDemoUser(users, encoder, "green-heights", "Selva Kumar",
                        "selvakumarc029@gmail.com", "password123", UserRole.RESIDENT);
                createDemoUser(users, encoder, "green-heights", "Forge India Connect",
                        "forgeindiaconnectfic@gmail.com", "password123", UserRole.SOCIETY_ADMIN);
            }

            Block block = blocks.findFirstByTenantIdAndNameOrderByIdAsc("green-heights", "Block A").orElseGet(() -> {
                Block newBlock = new Block();
                newBlock.setTenantId("green-heights");
                newBlock.setName("Block A");
                newBlock.setTotalFloors(10);
                return blocks.save(newBlock);
            });

            Apartment apartment = apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc("green-heights", "A-204").orElseGet(() -> {
                Apartment newApartment = new Apartment();
                newApartment.setTenantId("green-heights");
                newApartment.setBlock(block);
                newApartment.setFloorNo(2);
                newApartment.setUnitNo("A-204");
                newApartment.setUnitType("2BHK");
                newApartment.setOccupancyStatus("OCCUPIED");
                newApartment.setOwnerName("Demo Owner");
                newApartment.setOwnerPhone("9876543210");
                return apartments.save(newApartment);
            });

            apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc("green-heights", "205").orElseGet(() -> {
                Apartment apt205 = new Apartment();
                apt205.setTenantId("green-heights");
                apt205.setBlock(block);
                apt205.setFloorNo(2);
                apt205.setUnitNo("205");
                apt205.setUnitType("2BHK");
                apt205.setOccupancyStatus("OCCUPIED");
                apt205.setOwnerName("Selva Kumar");
                apt205.setOwnerPhone("8778293269");
                return apartments.save(apt205);
            });

            // Seed default Maintenance Hub & on-duty trade partners for dispatch and auto-assignment
            MaintenanceHub defaultHub = hubs.findAll().stream().findFirst().orElseGet(() -> {
                MaintenanceHub hub = new MaintenanceHub();
                hub.setName("Green Heights Maintenance Hub");
                hub.setCity("Chennai");
                hub.setArea("Whitefield");
                hub.setLatitude(12.9716);
                hub.setLongitude(77.5946);
                hub.setCoverageRadiusKm(25.0);
                hub.setActive(true);
                return hubs.save(hub);
            });

            if (partners.count() == 0) {
                AppUser plumberUser = createDemoUser(users, encoder, "green-heights", "Ramesh Plumber",
                        "plumber@smartapartment", "password123", UserRole.MAINTENANCE_STAFF);
                plumberUser.setDesignation("Plumber");
                plumberUser.setPhone("9876543211");
                users.save(plumberUser);
                MaintenancePartner p1 = new MaintenancePartner();
                p1.setUserId(plumberUser.getId());
                p1.setName("Ramesh Plumber");
                p1.setPhone("9876543211");
                p1.setHubId(defaultHub.getId());
                p1.setTrade("Plumbing");
                p1.setSkillCategories("Plumbing,Water Supply,Pipes,Drainage");
                p1.setEmploymentType("INTERNAL");
                p1.setOnDuty(true);
                p1.setWorkState("IDLE");
                p1.setAvailability("IDLE");
                p1.setLatitude(12.9716);
                p1.setLongitude(77.5946);
                p1.setRating(4.8f);
                p1.setRatingCount(24);
                partners.save(p1);

                AppUser electricUser = createDemoUser(users, encoder, "green-heights", "Suresh Electrician",
                        "electrician@smartapartment", "password123", UserRole.MAINTENANCE_STAFF);
                electricUser.setDesignation("Electrician");
                electricUser.setPhone("9876543212");
                users.save(electricUser);
                MaintenancePartner p2 = new MaintenancePartner();
                p2.setUserId(electricUser.getId());
                p2.setName("Suresh Electrician");
                p2.setPhone("9876543212");
                p2.setHubId(defaultHub.getId());
                p2.setTrade("Electrical");
                p2.setSkillCategories("Electrical,Power Supply,Wiring,Lighting");
                p2.setEmploymentType("INTERNAL");
                p2.setOnDuty(true);
                p2.setWorkState("IDLE");
                p2.setAvailability("IDLE");
                p2.setLatitude(12.9716);
                p2.setLongitude(77.5946);
                p2.setRating(4.9f);
                p2.setRatingCount(31);
                partners.save(p2);

                AppUser carpUser = createDemoUser(users, encoder, "green-heights", "Anand Carpenter",
                        "carpenter@smartapartment", "password123", UserRole.MAINTENANCE_STAFF);
                carpUser.setDesignation("Carpenter");
                carpUser.setWorkShift("ALL_DAY");
                carpUser.setPhone("9876543213");
                users.save(carpUser);
                MaintenancePartner p3 = new MaintenancePartner();
                p3.setUserId(carpUser.getId());
                p3.setName("Anand Carpenter");
                p3.setPhone("9876543213");
                p3.setHubId(defaultHub.getId());
                p3.setTrade("Carpentry");
                p3.setSkillCategories("Carpentry,Doors,Windows,Furniture,Locks");
                p3.setEmploymentType("INTERNAL");
                p3.setOnDuty(true);
                p3.setWorkState("IDLE");
                p3.setAvailability("IDLE");
                p3.setLatitude(12.9716);
                p3.setLongitude(77.5946);
                p3.setRating(4.7f);
                p3.setRatingCount(19);
                partners.save(p3);

                AppUser cleanUser = createDemoUser(users, encoder, "green-heights", "Manoj Cleaner",
                        "cleaner@smartapartment", "password123", UserRole.MAINTENANCE_STAFF);
                cleanUser.setDesignation("Housekeeping");
                cleanUser.setWorkShift("ALL_DAY");
                cleanUser.setPhone("9876543214");
                users.save(cleanUser);
                MaintenancePartner p4 = new MaintenancePartner();
                p4.setUserId(cleanUser.getId());
                p4.setName("Manoj Cleaner");
                p4.setPhone("9876543214");
                p4.setHubId(defaultHub.getId());
                p4.setTrade("Cleaning");
                p4.setSkillCategories("Cleaning,Deep Cleaning,Housekeeping,Disinfection");
                p4.setEmploymentType("INTERNAL");
                p4.setOnDuty(true);
                p4.setWorkState("IDLE");
                p4.setAvailability("IDLE");
                p4.setLatitude(12.9716);
                p4.setLongitude(77.5946);
                p4.setRating(4.9f);
                p4.setRatingCount(42);
                partners.save(p4);

                plumberUser.setWorkShift("ALL_DAY");
                users.save(plumberUser);
                electricUser.setWorkShift("ALL_DAY");
                users.save(electricUser);

                // Seed active attendance and availability for today for all demo workers
                for (AppUser w : java.util.List.of(plumberUser, electricUser, carpUser, cleanUser)) {
                    staffAttendances.findByTenantIdAndUserIdAndWorkDate("green-heights", w.getId(), LocalDate.now())
                            .orElseGet(() -> {
                                StaffAttendance att = new StaffAttendance();
                                att.setTenantId("green-heights");
                                att.setUser(w);
                                att.setWorkDate(LocalDate.now());
                                att.setCheckInAt(LocalDateTime.now().minusHours(2));
                                return staffAttendances.save(att);
                            });

                    workerAttendances.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(w.getId(), LocalDate.now())
                            .orElseGet(() -> {
                                com.smartapartment.entity.WorkerAttendance wa = new com.smartapartment.entity.WorkerAttendance();
                                wa.setWorkerId(w.getId());
                                wa.setTenantId("green-heights");
                                wa.setDate(LocalDate.now());
                                wa.setShiftId("ALL_DAY");
                                wa.setAttendanceStatus("PRESENT");
                                wa.setClockIn(LocalDateTime.now().minusHours(2));
                                return workerAttendances.save(wa);
                            });

                    workerAvailabilities.findByWorkerId(w.getId())
                            .orElseGet(() -> {
                                com.smartapartment.entity.WorkerAvailability wav = new com.smartapartment.entity.WorkerAvailability();
                                wav.setWorkerId(w.getId());
                                wav.setTenantId("green-heights");
                                wav.setStatus("AVAILABLE");
                                wav.setLastUpdatedAt(LocalDateTime.now());
                                return workerAvailabilities.save(wav);
                            });
                }
            }

            // Unconditionally ensure cleaner and all maintenance workers have shifts, attendance, and availability
            AppUser cleanerStaff = users.findByEmail("cleaner@smartapartment").orElseGet(() -> {
                AppUser u = createDemoUser(users, encoder, "green-heights", "Manoj Cleaner",
                        "cleaner@smartapartment", "password123", UserRole.MAINTENANCE_STAFF);
                u.setDesignation("Housekeeping");
                u.setWorkShift("ALL_DAY");
                u.setPhone("9876543214");
                return users.save(u);
            });
            cleanerStaff.setDesignation("Housekeeping");
            cleanerStaff.setWorkShift("ALL_DAY");
            users.save(cleanerStaff);

            if (partners.findByUserId(cleanerStaff.getId()).isEmpty()) {
                MaintenancePartner p4 = new MaintenancePartner();
                p4.setUserId(cleanerStaff.getId());
                p4.setName("Manoj Cleaner");
                p4.setPhone("9876543214");
                p4.setHubId(defaultHub.getId());
                p4.setTrade("Cleaning");
                p4.setSkillCategories("Cleaning,Deep Cleaning,Housekeeping,Disinfection");
                p4.setEmploymentType("INTERNAL");
                p4.setOnDuty(true);
                p4.setWorkState("IDLE");
                p4.setAvailability("IDLE");
                p4.setLatitude(12.9716);
                p4.setLongitude(77.5946);
                p4.setRating(4.9f);
                p4.setRatingCount(42);
                partners.save(p4);
            }

            for (AppUser w : users.findAll().stream().filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF).toList()) {
                w.setWorkShift("ALL_DAY");
                users.save(w);

                workerAttendances.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(w.getId(), LocalDate.now())
                        .orElseGet(() -> {
                            com.smartapartment.entity.WorkerAttendance wa = new com.smartapartment.entity.WorkerAttendance();
                            wa.setWorkerId(w.getId());
                            wa.setTenantId(w.getTenantId() != null ? w.getTenantId() : "green-heights");
                            wa.setDate(LocalDate.now());
                            wa.setShiftId("ALL_DAY");
                            wa.setAttendanceStatus("PRESENT");
                            wa.setClockIn(LocalDateTime.now().minusHours(2));
                            return workerAttendances.save(wa);
                        });

                workerAvailabilities.findByWorkerId(w.getId())
                        .orElseGet(() -> {
                            com.smartapartment.entity.WorkerAvailability wav = new com.smartapartment.entity.WorkerAvailability();
                            wav.setWorkerId(w.getId());
                            wav.setTenantId(w.getTenantId() != null ? w.getTenantId() : "green-heights");
                            wav.setStatus("AVAILABLE");
                            wav.setLastUpdatedAt(LocalDateTime.now());
                            return workerAvailabilities.save(wav);
                        });
            }

            Resident resident = residents.findFirstByUserOrderByIdAsc(residentUser).orElseGet(() -> {
                Resident newResident = new Resident();
                newResident.setTenantId("green-heights");
                newResident.setUser(residentUser);
                newResident.setApartment(apartment);
                newResident.setResidentType("OWNER");
                newResident.setVehicleNumber("TN01AB1234");
                return residents.save(newResident);
            });

            users.findByTenantId("green-heights").stream()
                    .filter(user -> user.getRole() == UserRole.RESIDENT)
                    .filter(user -> residents.findFirstByUserOrderByIdAsc(user).isEmpty())
                    .forEach(user -> {
                        Resident demoResident = new Resident();
                        demoResident.setTenantId("green-heights");
                        demoResident.setUser(user);
                        demoResident.setApartment(apartment);
                        demoResident.setResidentType("OWNER");
                        demoResident.setVehicleNumber("TN01AB1234");
                        residents.save(demoResident);
                    });

            complaints.findFirstByTenantIdAndTitleOrderByIdAsc("green-heights", "Water leakage").orElseGet(() -> {
                Complaint complaint = new Complaint();
                complaint.setTenantId("green-heights");
                complaint.setResident(resident);
                complaint.setTitle("Water leakage");
                complaint.setCategory("Plumbing");
                complaint.setPriority("HIGH");
                complaint.setDescription("Leakage near kitchen sink");
                complaint.setStatus("OPEN");
                return complaints.save(complaint);
            });

            if (amenities.findByTenantIdOrderByNameAsc("green-heights").isEmpty()) {
                com.smartapartment.entity.Amenity clubhouse = new com.smartapartment.entity.Amenity();
                clubhouse.setTenantId("green-heights"); clubhouse.setName("Clubhouse"); clubhouse.setCapacity(80);
                clubhouse.setBookingFee(new BigDecimal("1000")); clubhouse.setApprovalRequired(true); amenities.save(clubhouse);
                com.smartapartment.entity.Amenity gym = new com.smartapartment.entity.Amenity();
                gym.setTenantId("green-heights"); gym.setName("Gym"); gym.setCapacity(20);
                gym.setBookingFee(BigDecimal.ZERO); gym.setApprovalRequired(false); amenities.save(gym);
            }

            if (maintenanceBills.findByTenantIdOrderByDueDateDesc("green-heights").isEmpty()) {
                com.smartapartment.entity.MaintenanceBill b1 = new com.smartapartment.entity.MaintenanceBill();
                b1.setTenantId("green-heights");
                b1.setApartment(apartment);
                b1.setBillMonth("August 2026");
                b1.setBaseAmount(new BigDecimal("3600"));
                b1.setLateFee(BigDecimal.ZERO);
                b1.setTotalAmount(new BigDecimal("3600"));
                b1.setDueDate(java.time.LocalDate.of(2026, 8, 25));
                b1.setPaymentStatus("UNPAID");
                maintenanceBills.save(b1);

                com.smartapartment.entity.MaintenanceBill b2 = new com.smartapartment.entity.MaintenanceBill();
                b2.setTenantId("green-heights");
                b2.setApartment(apartment);
                b2.setBillMonth("July 2026");
                b2.setBaseAmount(new BigDecimal("2500"));
                b2.setLateFee(BigDecimal.ZERO);
                b2.setTotalAmount(new BigDecimal("2500"));
                b2.setDueDate(java.time.LocalDate.of(2026, 7, 25));
                b2.setPaymentStatus("PAID");
                maintenanceBills.save(b2);
            }
        };
    }

    private static AppUser createDemoUser(AppUserRepository users, PasswordEncoder encoder,
                                          String tenantId, String name, String email,
                                          String password, UserRole role) {
        AppUser user = users.findByEmail(email).orElseGet(() -> {
            AppUser u = new AppUser();
            u.setEmail(email);
            return u;
        });
        user.setTenantId(tenantId);
        user.setFullName(name);
        user.setPasswordHash(encoder.encode(password));
        user.setRole(role);
        user.setStatus("ACTIVE");
        user.setAccountLocked(false);
        user.setAccessRevokedAt(null);
        return users.save(user);
    }

    private static void ensurePlan(SubscriptionPlanRepository plans, String name, String code,
                                   BigDecimal price, int flats, int residents,
                                   boolean visitors, boolean amenities, boolean analytics) {
        plans.findFirstByTenantIdAndNameOrderByIdAsc("platform", name).orElseGet(() -> {
            SubscriptionPlan plan = new SubscriptionPlan();
            plan.setTenantId("platform"); plan.setName(name); plan.setPlanCode(code);
            plan.setDescription(name + " SmartSociety subscription");
            plan.setMonthlyPrice(price); plan.setMaxApartments(flats); plan.setMaxResidents(residents);
            plan.setMaxAdmins(name.equals("Free") ? 1 : name.equals("Standard") ? 5 : 25);
            plan.setMaxSecurityStaff(name.equals("Free") ? 1 : name.equals("Standard") ? 10 : 50);
            plan.setMaxMaintenanceStaff(name.equals("Free") ? 1 : name.equals("Standard") ? 10 : 50);
            plan.setAuditHistoryDays(name.equals("Free") ? 7 : name.equals("Standard") ? 90 : 365);
            plan.setStorageGb(name.equals("Free") ? 1 : name.equals("Standard") ? 25 : 100);
            plan.setBillingCycle("MONTHLY"); plan.setSupportLevel(name.equals("Premium") ? "PRIORITY" : "STANDARD");
            plan.setActive(true); plan.setFeatured(name.equals("Standard"));
            plan.setVisitorManagement(visitors); plan.setAmenityBooking(amenities); plan.setAnalytics(analytics);
            plan.setComplaintManagement(true); plan.setAnnouncementManagement(true);
            plan.setBillingManagement(!name.equals("Free")); plan.setExpenseManagement(name.equals("Premium"));
            plan.setPaymentGateway(!name.equals("Free")); plan.setApiAccess(name.equals("Premium"));
            plan.setPrioritySupport(name.equals("Premium"));
            return plans.save(plan);
        });
    }
}
