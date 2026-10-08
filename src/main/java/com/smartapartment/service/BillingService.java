package com.smartapartment.service;

import com.smartapartment.entity.Apartment;
import com.smartapartment.entity.MaintenanceBill;
import com.smartapartment.repository.ApartmentRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.math.RoundingMode;

@Service
public class BillingService {

    private final ApartmentRepository apartmentRepository;
    private final MaintenanceBillRepository billRepository;

    public BillingService(ApartmentRepository apartmentRepository, MaintenanceBillRepository billRepository) {
        this.apartmentRepository = apartmentRepository;
        this.billRepository = billRepository;
    }

    @Transactional
    public int generateMonthlyBills(String tenantId, String billMonth, BigDecimal amount) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant is required");
        }
        try {
            java.time.YearMonth.parse(billMonth);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Bill month must use YYYY-MM format");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Bill amount must be greater than zero");
        }
        int created = 0;
        for (Apartment apartment : apartmentRepository.findByTenantId(tenantId)) {
            if (billRepository.existsByTenantIdAndApartmentIdAndBillMonth(tenantId, apartment.getId(), billMonth)) {
                continue;
            }
            MaintenanceBill bill = new MaintenanceBill();
            bill.setTenantId(tenantId);
            bill.setApartment(apartment);
            bill.setBillMonth(billMonth);
            bill.setBaseAmount(amount);
            bill.setLateFee(BigDecimal.ZERO);
            bill.setTotalAmount(amount);
            bill.setDueDate(LocalDate.now().plusDays(15));
            bill.setPaymentStatus("UNPAID");
            billRepository.save(bill);
            created++;
        }
        return created;
    }

    @Transactional
    public int generateDetailedMonthlyBills(String tenantId, String billMonth, DetailedInvoice details) {
        return generateDetailedBills(tenantId, billMonth, details, null, null);
    }

    @Transactional
    public int generateDetailedBillForFlat(String tenantId, String billMonth, DetailedInvoice details, Long apartmentId, String unitType) {
        if (apartmentId == null || apartmentId <= 0) throw new IllegalArgumentException("Select a registered flat number");
        if (unitType == null || unitType.isBlank()) throw new IllegalArgumentException("Select the flat's BHK type");
        return generateDetailedBills(tenantId, billMonth, details, apartmentId, unitType);
    }

    private int generateDetailedBills(String tenantId, String billMonth, DetailedInvoice details, Long apartmentId, String unitType) {
        if (tenantId == null || tenantId.isBlank()) throw new IllegalArgumentException("Tenant is required");
        YearMonth cycle;
        try { cycle = YearMonth.parse(billMonth); }
        catch (RuntimeException exception) { throw new IllegalArgumentException("Bill month must use YYYY-MM format"); }
        if (details == null || details.baseRatePerSqFt() == null || details.baseRatePerSqFt().signum() < 0) {
            throw new IllegalArgumentException("Base maintenance rate is required");
        }
        var selected = apartmentRepository.findByTenantId(tenantId);
        if (apartmentId != null) {
            if (details.periodStart() == null || details.periodEnd() == null || details.invoiceDate() == null || details.dueDate() == null
                    || details.periodEnd().isBefore(details.periodStart()) || details.dueDate().isBefore(details.invoiceDate()))
                throw new IllegalArgumentException("Choose a valid billing period and due date");
            if (details.baseRatePerSqFt().signum() == 0 && nvl(details.otherCharges()).signum() <= 0)
                throw new IllegalArgumentException("Maintenance fee must be greater than zero");
            var flat = selected.stream().filter(a -> apartmentId.equals(a.getId())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Selected flat was not found in your society"));
            if (!normalizeType(unitType).equals(normalizeType(flat.getUnitType())))
                throw new IllegalArgumentException("Selected BHK type does not match the registered flat");
            if (billRepository.existsByTenantIdAndApartmentIdAndBillMonth(tenantId, apartmentId, billMonth))
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                        "An invoice already exists for this flat and month. No duplicate was generated.");
            selected = java.util.List.of(flat);
        }
        int created = 0;
        for (Apartment apartment : selected) {
            if (billRepository.existsByTenantIdAndApartmentIdAndBillMonth(tenantId, apartment.getId(), billMonth)) continue;
            int area = apartment.getBuiltUpAreaSqFt() == null || apartment.getBuiltUpAreaSqFt() <= 0
                    ? details.defaultAreaSqFt() : apartment.getBuiltUpAreaSqFt();
            BigDecimal base;
            if (details.baseRatePerSqFt().compareTo(BigDecimal.ZERO) > 0) {
                base = details.baseRatePerSqFt().multiply(BigDecimal.valueOf(area));
            } else if (details.otherCharges() != null && details.otherCharges().compareTo(BigDecimal.ZERO) > 0) {
                base = details.otherCharges();
            } else if (apartment.getMonthlyMaintenance() != null && apartment.getMonthlyMaintenance().compareTo(BigDecimal.ZERO) > 0) {
                base = apartment.getMonthlyMaintenance();
            } else {
                base = BigDecimal.valueOf(2500);
            }
            BigDecimal waterUnits = nonNegative(details.waterCurrentReading().subtract(details.waterPreviousReading()));
            BigDecimal waterAmount = waterUnits.multiply(details.waterRatePerUnit());
            BigDecimal parking = apartment.getParkingSlot() == null || apartment.getParkingSlot().isBlank()
                    ? BigDecimal.ZERO : details.parkingFee();
            BigDecimal taxable = sum(base, waterAmount, details.commonPowerFee(), details.sinkingFund(),
                    details.repairReserve(), parking, details.amenityFee(),
                    (details.baseRatePerSqFt().compareTo(BigDecimal.ZERO) > 0 ? details.otherCharges() : BigDecimal.ZERO));
            BigDecimal cgstAmount = percent(taxable, details.cgstRate());
            BigDecimal sgstAmount = percent(taxable, details.sgstRate());
            BigDecimal total = taxable.add(cgstAmount).add(sgstAmount)
                    .add(details.previousBalance()).subtract(details.creditAdjustment()).add(details.roundOff());

            MaintenanceBill bill = new MaintenanceBill();
            bill.setTenantId(tenantId); bill.setApartment(apartment); bill.setBillMonth(billMonth);
            bill.setInvoiceNumber(details.invoicePrefix() + "-" + cycle.toString().replace("-", "") + "-" + apartment.getUnitNo().replaceAll("[^A-Za-z0-9]", ""));
            bill.setInvoiceDate(details.invoiceDate()); bill.setBillingPeriodStart(details.periodStart()); bill.setBillingPeriodEnd(details.periodEnd());
            bill.setBaseRatePerSqFt(details.baseRatePerSqFt()); bill.setBilledAreaSqFt(area); bill.setBaseAmount(money(base));
            bill.setWaterPreviousReading(details.waterPreviousReading()); bill.setWaterCurrentReading(details.waterCurrentReading());
            bill.setWaterUnits(waterUnits); bill.setWaterRatePerUnit(details.waterRatePerUnit()); bill.setWaterAmount(money(waterAmount));
            bill.setCommonPowerFee(details.commonPowerFee()); bill.setSinkingFund(details.sinkingFund()); bill.setRepairReserve(details.repairReserve());
            bill.setParkingFee(parking); bill.setAmenityFee(details.amenityFee()); bill.setOtherCharges(details.otherCharges());
            bill.setOtherChargeDescription(details.otherChargeDescription()); bill.setPreviousBalance(details.previousBalance());
            bill.setCreditAdjustment(details.creditAdjustment()); bill.setTaxableAmount(money(taxable));
            bill.setCgstRate(details.cgstRate()); bill.setCgstAmount(money(cgstAmount)); bill.setSgstRate(details.sgstRate()); bill.setSgstAmount(money(sgstAmount));
            bill.setRoundOff(details.roundOff()); bill.setLateFee(BigDecimal.ZERO); bill.setTotalAmount(money(total)); bill.setDueDate(details.dueDate());
            bill.setPaymentStatus("UNPAID"); bill.setPaymentTerms(details.paymentTerms()); bill.setBankName(details.bankName());
            bill.setBankAccountNumber(details.bankAccountNumber()); bill.setBankIfsc(details.bankIfsc()); bill.setUpiId(details.upiId());
            bill.setSocietyGstin(details.societyGstin()); bill.setSocietyPan(details.societyPan()); bill.setNotes(details.notes());
            billRepository.save(bill); created++;
        }
        return created;
    }

    private static String normalizeType(String type) {
        return type == null ? "" : type.replaceAll("\\s+", "").toUpperCase(java.util.Locale.ROOT);
    }

    private BigDecimal sum(BigDecimal... values) { BigDecimal total=BigDecimal.ZERO; for(BigDecimal v:values) total=total.add(nvl(v)); return total; }
    private BigDecimal percent(BigDecimal amount, BigDecimal rate) { return amount.multiply(nvl(rate)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP); }
    private BigDecimal nonNegative(BigDecimal value) { return value.signum() < 0 ? BigDecimal.ZERO : value; }
    private BigDecimal nvl(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private BigDecimal money(BigDecimal value) { return nvl(value).setScale(2, RoundingMode.HALF_UP); }

    public record DetailedInvoice(String invoicePrefix, LocalDate invoiceDate, LocalDate periodStart, LocalDate periodEnd,
                                  LocalDate dueDate, int defaultAreaSqFt, BigDecimal baseRatePerSqFt,
                                  BigDecimal waterPreviousReading, BigDecimal waterCurrentReading, BigDecimal waterRatePerUnit,
                                  BigDecimal commonPowerFee, BigDecimal sinkingFund, BigDecimal repairReserve,
                                  BigDecimal parkingFee, BigDecimal amenityFee, BigDecimal otherCharges,
                                  String otherChargeDescription, BigDecimal previousBalance, BigDecimal creditAdjustment,
                                  BigDecimal cgstRate, BigDecimal sgstRate, BigDecimal roundOff, String paymentTerms,
                                  String bankName, String bankAccountNumber, String bankIfsc, String upiId,
                                  String societyGstin, String societyPan, String notes) {}
}
