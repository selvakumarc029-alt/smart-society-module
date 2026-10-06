package com.smartsociety.config;

import com.smartsociety.entity.AppUser;
import com.smartsociety.entity.Apartment;
import com.smartsociety.entity.Block;
import com.smartsociety.entity.Complaint;
import com.smartsociety.entity.Resident;
import com.smartsociety.entity.SubscriptionPlan;
import com.smartsociety.entity.Tenant;
import com.smartsociety.entity.UserRole;
import com.smartsociety.repository.ApartmentRepository;
import com.smartsociety.repository.AppUserRepository;
import com.smartsociety.repository.BlockRepository;
import com.smartsociety.repository.ComplaintRepository;
import com.smartsociety.repository.ResidentRepository;
import com.smartsociety.repository.SubscriptionPlanRepository;
import com.smartsociety.repository.TenantRepository;
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
                               PasswordEncoder encoder,
                               Environment environment) {
        return args -> {
            String superAdminEmail = environment.getProperty("SEED_SUPER_ADMIN_EMAIL", "platform-owner@localhost.invalid");
            String superAdminPassword = environment.getProperty("SEED_SUPER_ADMIN_PASSWORD", UUID.randomUUID().toString());
            String residentEmail = environment.getProperty("SEED_RESIDENT_EMAIL", "resident@localhost.invalid");
            String residentPassword = environment.getProperty("SEED_RESIDENT_PASSWORD", UUID.randomUUID().toString());

            plans.findFirstByTenantIdAndNameOrderByIdAsc("platform", "Gold Plan").orElseGet(() -> {
                SubscriptionPlan plan = new SubscriptionPlan();
                plan.setTenantId("platform");
                plan.setName("Gold Plan");
                plan.setMonthlyPrice(new BigDecimal("2999"));
                plan.setMaxApartments(150);
                plan.setMaxResidents(500);
                plan.setVisitorManagement(true);
                plan.setAmenityBooking(false);
                plan.setAnalytics(false);
                return plans.save(plan);
            });

            plans.findFirstByTenantIdAndNameOrderByIdAsc("platform", "Platinum Plan").orElseGet(() -> {
                SubscriptionPlan plan = new SubscriptionPlan();
                plan.setTenantId("platform");
                plan.setName("Platinum Plan");
                plan.setMonthlyPrice(new BigDecimal("5999"));
                plan.setMaxApartments(400);
                plan.setMaxResidents(1500);
                plan.setVisitorManagement(true);
                plan.setAmenityBooking(true);
                plan.setAnalytics(true);
                return plans.save(plan);
            });

            plans.findFirstByTenantIdAndNameOrderByIdAsc("platform", "Diamond Plan").orElseGet(() -> {
                SubscriptionPlan plan = new SubscriptionPlan();
                plan.setTenantId("platform");
                plan.setName("Diamond Plan");
                plan.setMonthlyPrice(new BigDecimal("9999"));
                plan.setMaxApartments(1000);
                plan.setMaxResidents(4000);
                plan.setVisitorManagement(true);
                plan.setAmenityBooking(true);
                plan.setAnalytics(true);
                return plans.save(plan);
            });

            tenants.findByCode("green-heights").orElseGet(() -> {
                Tenant tenant = new Tenant();
                tenant.setTenantId("green-heights");
                tenant.setCode("green-heights");
                tenant.setSocietyName("Green Heights Apartment");
                tenant.setContactEmail("admin@greenheights.com");
                tenant.setPhone("9876543210");
                tenant.setAddress("Main Road");
                tenant.setCity("Chennai");
                tenant.setApproved(true);
                return tenants.save(tenant);
            });

            users.findByEmail(superAdminEmail).orElseGet(() -> {
                AppUser superAdmin = new AppUser();
                superAdmin.setTenantId("platform");
                superAdmin.setFullName("Platform Super Admin");
                superAdmin.setEmail(superAdminEmail);
                superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
                superAdmin.setRole(UserRole.SUPER_ADMIN);
                return users.save(superAdmin);
            });

            AppUser residentUser = users.findByEmail(residentEmail).orElseGet(() -> {
                AppUser user = new AppUser();
                user.setTenantId("green-heights");
                user.setFullName("Demo Resident");
                user.setEmail(residentEmail);
                user.setPasswordHash(encoder.encode(residentPassword));
                user.setRole(UserRole.RESIDENT);
                return users.save(user);
            });

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

            Resident resident = residents.findFirstByUserOrderByIdAsc(residentUser).orElseGet(() -> {
                Resident newResident = new Resident();
                newResident.setTenantId("green-heights");
                newResident.setUser(residentUser);
                newResident.setApartment(apartment);
                newResident.setResidentType("OWNER");
                newResident.setVehicleNumber("TN01AB1234");
                return residents.save(newResident);
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
        };
    }
}
