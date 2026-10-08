package com.smartapartment.controller;

import com.smartapartment.service.BillingService;
import com.smartapartment.service.CurrentUserService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;
    private final CurrentUserService currentUser;

    public BillingController(BillingService billingService, CurrentUserService currentUser) {
        this.billingService = billingService;
        this.currentUser = currentUser;
    }

    @PostMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "2500") BigDecimal amount,
                                        @RequestParam(required = false) String month) {
        YearMonth cycle = parseMonth(month);
        int count = billingService.generateMonthlyBills(currentUser.requireTenantId(), cycle.toString(), amount);
        return Map.of("message", "Bills generated", "count", count, "month", cycle.toString());
    }

    @PostMapping("/generate-detailed")
    public Map<String,Object> generateDetailed(@Valid @RequestBody DetailedBillRequest r) {
        return generate(r, false);
    }

    @PostMapping("/generate-for-flat")
    public Map<String,Object> generateForFlat(@Valid @RequestBody DetailedBillRequest r) {
        return generate(r, true);
    }

    private Map<String,Object> generate(DetailedBillRequest r, boolean singleFlat) {
        YearMonth cycle = parseMonth(r.month());
        BillingService.DetailedInvoice details = new BillingService.DetailedInvoice(
                text(r.invoicePrefix(), "INV"), r.invoiceDate(), r.periodStart(), r.periodEnd(), r.dueDate(),
                r.defaultAreaSqFt(), nvl(r.baseRatePerSqFt()), nvl(r.waterPreviousReading()), nvl(r.waterCurrentReading()),
                nvl(r.waterRatePerUnit()), nvl(r.commonPowerFee()), nvl(r.sinkingFund()), nvl(r.repairReserve()),
                nvl(r.parkingFee()), nvl(r.amenityFee()), nvl(r.otherCharges()), text(r.otherChargeDescription(), ""),
                nvl(r.previousBalance()), nvl(r.creditAdjustment()), nvl(r.cgstRate()), nvl(r.sgstRate()), nvl(r.roundOff()),
                text(r.paymentTerms(), "Pay on or before the due date"), text(r.bankName(), ""), text(r.bankAccountNumber(), ""),
                text(r.bankIfsc(), ""), text(r.upiId(), ""), text(r.societyGstin(), ""), text(r.societyPan(), ""), text(r.notes(), ""));
        int count = singleFlat
                ? billingService.generateDetailedBillForFlat(currentUser.requireTenantId(), cycle.toString(), details, r.apartmentId(), r.unitType())
                : billingService.generateDetailedMonthlyBills(currentUser.requireTenantId(), cycle.toString(), details);
        return Map.of("message", "Detailed invoices generated", "count", count, "month", cycle.toString());
    }

    private BigDecimal nvl(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private String text(String value,String fallback){return value==null||value.isBlank()?fallback:value.trim();}

    public record DetailedBillRequest(@NotBlank String month, String invoicePrefix, @NotNull LocalDate invoiceDate,
            @NotNull LocalDate periodStart, @NotNull LocalDate periodEnd, @NotNull LocalDate dueDate,
            @Min(1) int defaultAreaSqFt, @NotNull @PositiveOrZero BigDecimal baseRatePerSqFt,
            @PositiveOrZero BigDecimal waterPreviousReading, @PositiveOrZero BigDecimal waterCurrentReading,
            @PositiveOrZero BigDecimal waterRatePerUnit, @PositiveOrZero BigDecimal commonPowerFee,
            @PositiveOrZero BigDecimal sinkingFund, @PositiveOrZero BigDecimal repairReserve,
            @PositiveOrZero BigDecimal parkingFee, @PositiveOrZero BigDecimal amenityFee,
            @PositiveOrZero BigDecimal otherCharges, String otherChargeDescription,
            @PositiveOrZero BigDecimal previousBalance, @PositiveOrZero BigDecimal creditAdjustment,
            @PositiveOrZero BigDecimal cgstRate, @PositiveOrZero BigDecimal sgstRate, BigDecimal roundOff,
            String paymentTerms, String bankName, String bankAccountNumber, String bankIfsc, String upiId,
            String societyGstin, String societyPan, String notes, Long apartmentId, String unitType) {}

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) return YearMonth.now();
        try { return YearMonth.parse(month.trim()); }
        catch (Exception ignored) { return YearMonth.parse(month.trim(), DateTimeFormatter.ofPattern("MMMM uuuu", Locale.ENGLISH)); }
    }
}
