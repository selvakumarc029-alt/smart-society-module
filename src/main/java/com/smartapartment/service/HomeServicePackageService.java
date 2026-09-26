package com.smartapartment.service;

import com.smartapartment.dto.HomeServicePackageDto;
import com.smartapartment.entity.HomeServicePackage;
import com.smartapartment.repository.HomeServicePackageRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class HomeServicePackageService {

    private final HomeServicePackageRepository packageRepository;

    @PostConstruct
    public void init() {
        try {
            seedDefaultPackagesIfEmpty();
        } catch (Exception e) {
            log.error("Failed to seed default home service packages: {}", e.getMessage(), e);
        }
    }

    public List<HomeServicePackage> getAllActivePackages() {
        return packageRepository.findByActiveTrueOrderByIdAsc();
    }

    public List<HomeServicePackage> getAllPackages() {
        return packageRepository.findAllByOrderByIdAsc();
    }

    public HomeServicePackage getPackageById(Long id) {
        return packageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Package not found with ID: " + id));
    }

    @Transactional
    public HomeServicePackage createPackage(HomeServicePackageDto dto) {
        if (dto.getCategory() == null || dto.getCategory().isBlank()) {
            throw new IllegalArgumentException("Category is required");
        }
        if (dto.getSubService() == null || dto.getSubService().isBlank()) {
            throw new IllegalArgumentException("Sub-Service is required");
        }
        if (dto.getDesignation() == null || dto.getDesignation().isBlank()) {
            dto.setDesignation(dto.getSubService());
        }
        if (dto.getPackageName() == null || dto.getPackageName().isBlank()) {
            throw new IllegalArgumentException("Package Name is required");
        }
        if (dto.getPrice() == null || dto.getPrice() < 0) {
            throw new IllegalArgumentException("Valid price is required");
        }

        HomeServicePackage pkg = new HomeServicePackage();
        copyDtoToEntity(dto, pkg);
        return packageRepository.save(pkg);
    }

    @Transactional
    public HomeServicePackage updatePackage(Long id, HomeServicePackageDto dto) {
        HomeServicePackage pkg = getPackageById(id);

        if (dto.getCategory() != null && !dto.getCategory().isBlank()) pkg.setCategory(dto.getCategory().trim());
        if (dto.getSubService() != null && !dto.getSubService().isBlank()) pkg.setSubService(dto.getSubService().trim());
        if (dto.getDesignation() != null && !dto.getDesignation().isBlank()) pkg.setDesignation(dto.getDesignation().trim());
        if (dto.getPackageName() != null && !dto.getPackageName().isBlank()) pkg.setPackageName(dto.getPackageName().trim());
        if (dto.getPrice() != null && dto.getPrice() >= 0) pkg.setPrice(dto.getPrice());
        if (dto.getPricePrefix() != null) pkg.setPricePrefix(dto.getPricePrefix().trim());
        if (dto.getRating() != null && !dto.getRating().isBlank()) pkg.setRating(dto.getRating().trim());
        if (dto.getReviews() != null && !dto.getReviews().isBlank()) pkg.setReviews(dto.getReviews().trim());
        if (dto.getDuration() != null && !dto.getDuration().isBlank()) pkg.setDuration(dto.getDuration().trim());
        if (dto.getOptionsCount() != null && !dto.getOptionsCount().isBlank()) pkg.setOptionsCount(dto.getOptionsCount().trim());
        if (dto.getFeatures() != null) pkg.setFeatures(dto.getFeatures());
        if (dto.getDetailedSections() != null) pkg.setDetailedSections(dto.getDetailedSections());
        if (dto.getBadge() != null) pkg.setBadge(dto.getBadge());
        if (dto.getThumbnail() != null) pkg.setThumbnail(dto.getThumbnail());
        if (dto.getActive() != null) pkg.setActive(dto.getActive());

        return packageRepository.save(pkg);
    }

    @Transactional
    public HomeServicePackage updatePrice(Long id, Double newPrice) {
        if (newPrice == null || newPrice < 0) {
            throw new IllegalArgumentException("Price must be a non-negative number");
        }
        HomeServicePackage pkg = getPackageById(id);
        pkg.setPrice(newPrice);
        return packageRepository.save(pkg);
    }

    @Transactional
    public void deletePackage(Long id) {
        HomeServicePackage pkg = getPackageById(id);
        // Soft delete for audit trail
        pkg.setActive(false);
        packageRepository.save(pkg);
    }

    @Transactional
    public void hardDeletePackage(Long id) {
        packageRepository.deleteById(id);
    }

    private void copyDtoToEntity(HomeServicePackageDto dto, HomeServicePackage pkg) {
        pkg.setCategory(dto.getCategory().trim());
        pkg.setSubService(dto.getSubService().trim());
        pkg.setDesignation(dto.getDesignation().trim());
        pkg.setPackageName(dto.getPackageName().trim());
        pkg.setPrice(dto.getPrice());
        pkg.setPricePrefix(dto.getPricePrefix() != null ? dto.getPricePrefix().trim() : null);
        pkg.setRating(dto.getRating() != null ? dto.getRating().trim() : "4.7");
        pkg.setReviews(dto.getReviews() != null ? dto.getReviews().trim() : "10K+");
        pkg.setDuration(dto.getDuration() != null ? dto.getDuration().trim() : "4 hrs");
        pkg.setOptionsCount(dto.getOptionsCount() != null ? dto.getOptionsCount().trim() : "5 options");
        pkg.setFeatures(dto.getFeatures() != null ? dto.getFeatures() : "");
        pkg.setDetailedSections(dto.getDetailedSections());
        pkg.setBadge(dto.getBadge());
        pkg.setThumbnail(dto.getThumbnail());
        pkg.setActive(dto.getActive() != null ? dto.getActive() : true);
    }

    @Transactional
    public void seedDefaultPackagesIfEmpty() {
        if (packageRepository.count() > 0) {
            log.info("HomeServicePackages already seeded ({} records found).", packageRepository.count());
            return;
        }

        log.info("Seeding default Home Service Packages with live pricing catalog...");
        List<HomeServicePackage> list = new ArrayList<>();

        // 1. Full House Cleaning - Furnished Apartment
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Furnished Apartment", "Essential ★",
                3069.0, "4.7", "38.2K+", "4 hrs", "5 options",
                "Bathroom & kitchen deep cleaning\nMachine floor cleaning\nCobweb & fan dusting\nBalcony & utility area cleaning\nFurniture dusting",
                "Standard"
        ));
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Furnished Apartment", "Premium 💎",
                3379.0, "4.8", "21.6K+", "4 hrs", "5 options",
                "Includes everything in Essential Plan\nCupboard cleaning (interior + exterior, if empty)\nWindow & grill deep degreasing\nAppliance exterior stain removal",
                "Popular"
        ));
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Furnished Apartment", "Elite 👑",
                3899.0, "4.9", "12.4K+", "5 hrs", "5 options",
                "Includes everything in Premium Plan\nMattress & sofa fabric steam sanitization\nKitchen tile buffing & anti-microbial fogging\nRe-cleaning guarantee 30 days",
                "Best Value"
        ));

        // 2. Full House Cleaning - Unfurnished Apartment
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Unfurnished Apartment", "Essential ★",
                2499.0, "4.7", "18.5K+", "3.5 hrs", "4 options",
                "Floor mechanical rotary scrubbing\nBathroom & kitchen descaling\nWindow tracks & grill wiping\nBalcony washing & sanitization",
                "Standard"
        ));
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Unfurnished Apartment", "Premium 💎",
                2899.0, "4.8", "14.2K+", "4 hrs", "4 options",
                "Includes everything in Essential Plan\nInterior paint mark removal\nExhaust & electrical switch deep wipe\nSanitization chemical spray",
                "Popular"
        ));
        list.add(createSeed(
                "Home Cleaning", "Full House Cleaning", "Unfurnished Apartment", "Elite 👑",
                3299.0, "4.9", "9.1K+", "4.5 hrs", "4 options",
                "Includes everything in Premium Plan\nFull home anti-microbial mist fogging\nFloor polishing buffing finish\nZero residue chemical rinse",
                "Best Value"
        ));

        // 3. Occupied Kitchen Cleaning
        list.add(createSeed(
                "Kitchen Cleaning", "Kitchen Cleaning", "Occupied Kitchen Cleaning", "Essential ★",
                1499.0, "4.74", "5.6K+", "2.5 hrs", "3 options",
                "Gas stove & chimney surface degreasing\nCountertop & backsplash scrub\nSink & tap hard water descaling\nFloor stain scrub",
                "Standard"
        ));
        list.add(createSeed(
                "Kitchen Cleaning", "Kitchen Cleaning", "Occupied Kitchen Cleaning", "Premium 💎",
                1899.0, "4.82", "8.9K+", "3 hrs", "3 options",
                "Includes everything in Essential Plan\nCabinet interior wiping (contents moved carefully)\nTiled wall heavy grease dissolution\nTrash bin disinfection",
                "Popular"
        ));
        list.add(createSeed(
                "Kitchen Cleaning", "Kitchen Cleaning", "Occupied Kitchen Cleaning", "Elite 👑",
                2299.0, "4.91", "4.3K+", "3.5 hrs", "3 options",
                "Includes everything in Premium Plan\nRefrigerator exterior & microwave interior wipe\nExhaust fan complete grease dissolution\nHerbal pest repel wipe",
                "Best Value"
        ));

        // 4. Empty Kitchen Cleaning
        list.add(createSeed(
                "Kitchen Cleaning", "Kitchen Cleaning", "Empty Kitchen Cleaning", "Essential ★",
                1199.0, "4.70", "4.1K+", "2 hrs", "2 options",
                "All modular cabinets interior/exterior scrub\nCountertop buffing & grease clearing\nSink, drain & tap descaling\nFloor machine wash",
                "Standard"
        ));
        list.add(createSeed(
                "Kitchen Cleaning", "Kitchen Cleaning", "Empty Kitchen Cleaning", "Premium 💎",
                1549.0, "4.85", "6.2K+", "2.5 hrs", "2 options",
                "Includes everything in Essential Plan\nHeavy oil stain tile treatment\nChimney & duct vent exterior polish\nSanitizing chemical mist",
                "Popular"
        ));

        // 5. Bathroom Cleaning
        list.add(createSeed(
                "Bathroom Cleaning", "Bathroom Cleaning", "Bathroom Cleaning", "Essential ★",
                499.0, "4.75", "42.8K+", "1 hr", "Single Bathroom",
                "Toilet bowl, washbasin & tap descaling\nWall tile stain scrub up to 7ft\nFloor scrub & mirror buffing\nDrain cleaning & deodorizing",
                "Standard"
        ));
        list.add(createSeed(
                "Bathroom Cleaning", "Bathroom Cleaning", "Bathroom Cleaning", "Deep Scrub 💎",
                799.0, "4.85", "28.1K+", "1.5 hrs", "Single Bathroom",
                "Includes everything in Essential\nHard water scale removal from glass partition\nShowerhead & diverter vinegar descaling\nAnti-fungal grout treatment",
                "Popular"
        ));
        list.add(createSeed(
                "Bathroom Cleaning", "Bathroom Cleaning", "Bathroom Cleaning", "2-Bathroom Combo 👑",
                999.0, "4.90", "19.5K+", "2 hrs", "2 Bathrooms",
                "Full deep cleaning for 2 full bathrooms\nAll fixtures, partition & floor machine buffing\nFragrance odorizer blocks included",
                "Best Value"
        ));

        // 6. Sofa & Upholstery Cleaning
        list.add(createSeed(
                "Home Cleaning", "Sofa Cleaning", "Sofa Cleaning", "3-Seater Fabric ★",
                449.0, "4.72", "15.4K+", "1 hr", "3 Seats",
                "Dry vacuuming dust extraction\nShampoo foaming & deep stain treatment\nWet vacuum water extraction (80% moisture removed)\nFabric conditioning",
                "Standard"
        ));
        list.add(createSeed(
                "Home Cleaning", "Sofa Cleaning", "Sofa Cleaning", "5-Seater / L-Shape 💎",
                699.0, "4.83", "22.7K+", "1.5 hrs", "5 Seats",
                "High-power suction deep dry vacuum\nEco-friendly enzyme fabric shampooing\nStain targeting on armrests and cushions\nFresh lavender deodorizer",
                "Popular"
        ));

        // 7. Plumbing Repairs
        list.add(createSeed(
                "Plumbing", "Tap Repair", "Plumbing & Tap Leakage", "Standard Tap Repair",
                199.0, "4.78", "31.2K+", "45 mins", "Per Point",
                "Tap leakage, valve washer & spindle repair\nFlow testing & thread sealing\n30 days workmanship warranty",
                "Standard"
        ));
        list.add(createSeed(
                "Plumbing", "Drain Clearing", "Plumbing & Tap Leakage", "Drain & Trap Overhaul",
                299.0, "4.80", "18.9K+", "1 hr", "Per Point",
                "Clogged basin, sink or bathroom drain trap clearing\nMechanical spring rod block removal\nLeakage prevention test",
                "Popular"
        ));
        list.add(createSeed(
                "Plumbing", "Flush Tank", "Plumbing & Tap Leakage", "Flush Tank Overhaul",
                349.0, "4.82", "12.1K+", "1 hr", "Per Unit",
                "Internal siphon valve & float ball replacement\nTank sealing & flush volume calibration\nSpare parts extra as required",
                "Popular"
        ));

        // 8. Electrical Repairs
        list.add(createSeed(
                "Electrical", "Switchboard Repair", "Electrical Repairs", "Switchboard & Socket",
                149.0, "4.76", "25.3K+", "45 mins", "Up to 2 Points",
                "Loose connection tightening & burnt switch replacement\nEarthing check & voltage reading\nSafe insulated tools used",
                "Standard"
        ));
        list.add(createSeed(
                "Electrical", "Fan Repair", "Electrical Repairs", "Ceiling Fan Service & Repair",
                199.0, "4.81", "19.8K+", "45 mins", "Per Fan",
                "Capacitor check, bearing oiling & wobble fix\nRegulator speed sync & noise removal\nBlade angle calibration",
                "Popular"
        ));
        list.add(createSeed(
                "Electrical", "MCB Tripping", "Electrical Repairs", "MCB & Short Circuit Inspection",
                299.0, "4.88", "11.4K+", "1 hr", "Per DB Box",
                "Circuit load testing & insulation resistance check\nTrip cause isolation & phase balancing\nSafety sign-off certificate",
                "Best Value"
        ));

        // 9. Carpentry Repairs
        list.add(createSeed(
                "Carpentry", "Cupboard Hinge", "Carpenter & Door Lock", "Hinge & Handle Alignment",
                179.0, "4.73", "16.5K+", "45 mins", "Up to 2 Hinges",
                "Cabinet door alignment & loose hinge screw tightening\nSoft-close mechanism calibration\nSmooth door swing test",
                "Standard"
        ));
        list.add(createSeed(
                "Carpentry", "Door Lock", "Carpenter & Door Lock", "Door Lock Fitting & Repair",
                249.0, "4.82", "14.1K+", "1 hr", "Per Lock",
                "Mortise, latch or cylindrical lock installation/repair\nStriker plate & keyhole adjustment\nSmooth latch engagement",
                "Popular"
        ));
        list.add(createSeed(
                "Carpentry", "Drill & Wall Hang", "Carpenter & Door Lock", "Drill & Hang Pack",
                129.0, "4.79", "35.6K+", "30 mins", "Up to 3 Holes",
                "Wall mirror, picture frame, shelf or curtain rod drilling\nHeavy-duty wall plugs (rawls) included\nLaser level precision alignment",
                "Popular"
        ));
        list.add(createSeed(
                "Carpentry", "Furniture Assembly", "Carpenter & Door Lock", "Modular Furniture Assembly",
                349.0, "4.86", "9.7K+", "1.5 hrs", "Per Item",
                "IKEA / Amazon / Pepperfry flat-pack bed, wardrobe, table assembly\nAll hardware torqued correctly\nStability & level test",
                "Best Value"
        ));

        // 10. Appliance Repair
        list.add(createSeed(
                "Appliance Repair", "AC Service", "AC & Appliance Repair", "AC Power Jet Servicing",
                449.0, "4.84", "48.2K+", "1 hr", "Per AC",
                "Indoor cooling coil high-pressure water jet cleaning\nFilter, drain pipe & blower wheel wash\nGas pressure check & cooling benchmark",
                "Popular"
        ));
        list.add(createSeed(
                "Appliance Repair", "Geyser Repair", "AC & Appliance Repair", "Geyser Inspection & Descaling",
                299.0, "4.77", "17.3K+", "1 hr", "Per Geyser",
                "Thermostat, heating element & safety valve inspection\nTank leakage & electrical earthing test\nInstant/Storage geyser covered",
                "Standard"
        ));
        list.add(createSeed(
                "Appliance Repair", "Washing Machine", "AC & Appliance Repair", "Washing Machine Inspection",
                349.0, "4.80", "19.5K+", "1 hr", "Per Machine",
                "Drum spin, motor, drain pump & inlet valve diagnosis\nVibration & noise trouble-shooting\nFront load & top load covered",
                "Standard"
        ));

        // 11. Pest Control
        list.add(createSeed(
                "Pest Control", "Cockroach Control", "Pest Control & Sanitization", "Cockroach Herbal Gel",
                349.0, "4.76", "23.8K+", "45 mins", "Up to 2 BHK",
                "Eco-friendly odorless herbal gel dots in cabinets\nDrainage and pipe entry spray\nSafe for kids, pets & elderly",
                "Standard"
        ));
        list.add(createSeed(
                "Pest Control", "Bed Bug Control", "Pest Control & Sanitization", "Bed Bug 2-Service Pack",
                699.0, "4.82", "11.6K+", "1.5 hrs", "Up to 2 Beds",
                "Intensive chemical spray on seams, frames & baseboards\nFree follow-up visit after 15 days\n30 days complete warranty",
                "Popular"
        ));

        // 12. Painting & Waterproofing
        list.add(createSeed(
                "Painting", "Single Wall Touchup", "Painting & Waterproofing", "Single Wall Paint & Touchup",
                449.0, "4.71", "8.9K+", "2 hrs", "Per Wall",
                "Wall putty sanding, crack filling & primer application\n2 coats of premium plastic emulsion paint\nFloor masking & cleanup",
                "Standard"
        ));
        list.add(createSeed(
                "Painting", "Waterproofing", "Painting & Waterproofing", "Damp & Seepage Inspection",
                399.0, "4.85", "6.4K+", "1 hr", "Per Room",
                "Moisture meter wall reading\nSeepage source detection (bathroom, external or pipe)\nComprehensive repair quotation",
                "Popular"
        ));

        packageRepository.saveAll(list);
        log.info("Successfully seeded {} default Home Service Packages with live pricing!", list.size());
    }

    private HomeServicePackage createSeed(String cat, String sub, String des, String name,
                                         Double price, String rating, String reviews,
                                         String duration, String options, String features, String badge) {
        HomeServicePackage p = new HomeServicePackage();
        p.setCategory(cat);
        p.setSubService(sub);
        p.setDesignation(des);
        p.setPackageName(name);
        p.setPrice(price);
        p.setRating(rating);
        p.setReviews(reviews);
        p.setDuration(duration);
        p.setOptionsCount(options);
        p.setFeatures(features);
        p.setBadge(badge);
        p.setActive(true);
        return p;
    }
}
