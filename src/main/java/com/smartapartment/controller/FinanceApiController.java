package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/society/finance")
public class FinanceApiController {
    private final CurrentUserService current; private final ExpenseRepository expenses;
    private final MaintenanceBillRepository bills; private final PaymentRepository payments;
    public FinanceApiController(CurrentUserService c,ExpenseRepository e,MaintenanceBillRepository b,PaymentRepository p){current=c;expenses=e;bills=b;payments=p;}

    @GetMapping("/expenses") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')")
    public List<Map<String,Object>> expenses(){return expenses.findByTenantIdOrderByExpenseDateDesc(current.requireTenantId()).stream().map(e->map("id",e.getId(),"title",blank(e.getExpenseTitle(),e.getCategory()),"category",e.getCategory(),"vendor",e.getVendorName(),"vendorPhone",blank(e.getVendorPhone(),""),"invoiceNumber",blank(e.getInvoiceNumber(),""),"invoiceDate",e.getInvoiceDate(),"dueDate",e.getDueDate(),"amount",e.getAmount(),"taxAmount",e.getTaxAmount(),"date",e.getExpenseDate(),"approvalStatus",e.getApprovalStatus(),"paymentMode",blank(e.getPaymentMode(),""),"paymentReference",blank(e.getPaymentReference(),""),"paidDate",e.getPaidDate(),"description",blank(e.getDescription(),""),"approvalNote",blank(e.getApprovalNote(),""))).toList();}

    @GetMapping("/payments") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')")
    public List<Map<String,Object>> payments(){return payments.findByTenantIdOrderByPaidAtDesc(current.requireTenantId()).stream().map(p->map("id",p.getId(),"billId",p.getBill().getId(),"unitNo",p.getBill().getApartment().getUnitNo(),"billMonth",p.getBill().getBillMonth(),"billDueDate",p.getBill().getDueDate(),"billTotal",p.getBill().getTotalAmount(),"amount",p.getAmount(),"mode",p.getPaymentMode(),"transactionId",p.getTransactionId(),"status",p.getPaymentStatus(),"paidAt",p.getPaidAt())).toList();}

    @PostMapping("/expenses") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')") @Transactional
    public Map<String,Object> expense(@Valid @RequestBody ExpenseRequest r){Expense e=new Expense();e.setTenantId(current.requireTenantId());applyExpense(e,r);e.setApprovalStatus("PENDING");e=expenses.save(e);return map("id",e.getId(),"message","Expense recorded");}

    @PatchMapping("/expenses/{id}") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')") @Transactional
    public Map<String,Object> updateExpense(@PathVariable Long id,@Valid @RequestBody ExpenseRequest r){Expense e=expenses.lockByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Expense was not found"));if(!"PENDING".equalsIgnoreCase(e.getApprovalStatus()))throw new IllegalArgumentException("Only pending expenses can be edited");applyExpense(e,r);expenses.save(e);return map("id",id,"message","Expense updated");}

    @DeleteMapping("/expenses/{id}") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> deleteExpense(@PathVariable Long id){Expense e=expenses.lockByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Expense was not found"));if(!"PENDING".equalsIgnoreCase(e.getApprovalStatus()))throw new IllegalArgumentException("Only pending expenses can be removed");expenses.delete(e);return map("id",id,"message","Expense removed");}

    @PatchMapping("/expenses/{id}/approve") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> approve(@PathVariable Long id){Expense e=expenses.lockByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Expense was not found"));requirePending(e);e.setApprovalStatus("APPROVED");expenses.save(e);return map("id",id,"message","Expense approved");}

    @PatchMapping("/expenses/{id}/reject") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> reject(@PathVariable Long id,@RequestParam(required=false,defaultValue="") String note){Expense e=expenses.lockByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Expense was not found"));requirePending(e);e.setApprovalStatus("REJECTED");e.setApprovalNote(note.trim());expenses.save(e);return map("id",id,"message","Expense rejected");}

    @PatchMapping("/expenses/{id}/pay") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')") @Transactional
    public Map<String,Object> payExpense(@PathVariable Long id,@RequestParam String mode,@RequestParam(required=false,defaultValue="") String reference){Expense e=expenses.lockByIdAndTenantId(id,current.requireTenantId()).orElseThrow(()->new IllegalArgumentException("Expense was not found"));if(!"APPROVED".equalsIgnoreCase(e.getApprovalStatus()))throw new IllegalArgumentException("Approve the expense before recording payment");e.setApprovalStatus("PAID");e.setPaymentMode(paymentMode(mode));e.setPaymentReference(reference.trim());e.setPaidDate(LocalDate.now());expenses.save(e);return map("id",id,"message","Expense payment recorded");}

    @PostMapping("/bills/{id}/pay") @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT')") @Transactional
    public Map<String,Object> pay(@PathVariable Long id,@Valid @RequestBody PaymentRequest r){AppUser user=current.requireUser();MaintenanceBill bill=bills.lockByIdAndTenantId(id,user.getTenantId()).orElseThrow(()->new IllegalArgumentException("Bill was not found"));if(user.getRole()==UserRole.RESIDENT){throw new IllegalArgumentException("Online gateway confirmation is required; residents cannot mark bills paid directly");}if("PAID".equalsIgnoreCase(bill.getPaymentStatus()))throw new IllegalArgumentException("Bill is already paid");if(payments.existsByTenantIdAndTransactionId(user.getTenantId(),r.transactionId().trim()))throw new IllegalArgumentException("Transaction reference already exists");Payment p=new Payment();p.setTenantId(user.getTenantId());p.setBill(bill);p.setAmount(bill.getTotalAmount());p.setPaymentMode(paymentMode(r.mode()));p.setTransactionId(r.transactionId().trim());p.setPaymentStatus("SUCCESS");p.setPaidAt(LocalDateTime.now());payments.save(p);bill.setPaymentStatus("PAID");bills.save(bill);return map("paymentId",p.getId(),"message","Payment recorded");}

    private static void requirePending(Expense e) {
        if(!"PENDING".equalsIgnoreCase(e.getApprovalStatus()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Only pending expenses can be approved or rejected");
    }
    private static String paymentMode(String raw) {
        String mode=raw==null?"":raw.trim().toUpperCase(Locale.ROOT).replaceAll("[ -]+","_");
        if(!Set.of("CASH","UPI","BANK_TRANSFER","CHEQUE","CARD","ONLINE","NET_BANKING").contains(mode))
            throw new IllegalArgumentException("Choose a valid payment mode");
        return mode;
    }

    private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
    private void applyExpense(Expense e,ExpenseRequest r){e.setCategory(r.category().trim());e.setExpenseTitle(blank(r.title(),r.category()));e.setVendorName(r.vendor().trim());e.setVendorPhone(blank(r.vendorPhone(),""));e.setInvoiceNumber(blank(r.invoiceNumber(),""));e.setInvoiceDate(r.invoiceDate());e.setDueDate(r.dueDate());e.setAmount(r.amount());e.setTaxAmount(r.taxAmount());e.setExpenseDate(r.date());e.setDescription(blank(r.description(),""));}
    private static String blank(String value,String fallback){return value==null||value.trim().isEmpty()?fallback:value.trim();}
    public record ExpenseRequest(@NotBlank String category,@NotBlank String vendor,@NotNull @Positive BigDecimal amount,@NotNull LocalDate date,String title,String vendorPhone,String invoiceNumber,LocalDate invoiceDate,LocalDate dueDate,@PositiveOrZero BigDecimal taxAmount,String description){}
    public record PaymentRequest(@NotBlank String mode,@NotBlank String transactionId){}
}
