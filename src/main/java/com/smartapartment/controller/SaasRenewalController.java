package com.smartapartment.controller;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.*;
import java.time.LocalDate;
import java.util.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import java.io.ByteArrayOutputStream;

@RestController
public class SaasRenewalController {
    private final CurrentUserService current;
    private final TenantRepository tenants;
    private final SubscriptionPlanRepository plans;
    private final SaasRenewalPaymentRepository payments;
    @Value("${SMARTSOCIETY_SAAS_UPI_ID:${smartsociety.saas.upi-id:}}") private String upi;
    @Value("${SMARTSOCIETY_SAAS_PAYEE_NAME:${smartsociety.saas.payee-name:}}") private String payee;
    @org.springframework.beans.factory.annotation.Autowired private PaymentGatewayConfigRepository gatewayConfigs;
    private void loadPaymentAccount(){
        if(gatewayConfigs==null)return;
        gatewayConfigs.findAll().stream().filter(c->"SMARTSOCIETY_SAAS_UPI".equals(c.getProviderName())).findFirst().ifPresent(c->{upi=c.getMerchantId();payee=c.getConfigurationNotes();});
    }
    @GetMapping("/api/superadmin/saas-payment-account") @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String,String> paymentAccount(){loadPaymentAccount();return Map.of("upiId",upi,"payee",payee);}
    public record PaymentAccount(String upiId,String payee){}
    @PutMapping("/api/superadmin/saas-payment-account") @PreAuthorize("hasRole('SUPER_ADMIN')") @Transactional
    public Map<String,String> paymentAccount(@RequestBody PaymentAccount request){
        String address=request.upiId()==null?"":request.upiId().trim();String name=request.payee()==null?"":request.payee().trim();
        if(!address.matches("[A-Za-z0-9._-]{2,120}@[A-Za-z0-9]{2,80}")||name.isBlank()||name.length()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter the real receiving UPI ID and payee name");
        PaymentGatewayConfig config=gatewayConfigs.findAll().stream().filter(c->"SMARTSOCIETY_SAAS_UPI".equals(c.getProviderName())).findFirst().orElseGet(PaymentGatewayConfig::new);
        config.setProviderName("SMARTSOCIETY_SAAS_UPI");config.setMerchantId(address);config.setConfigurationNotes(name);config.setEnvironment("Manual verification");gatewayConfigs.save(config);
        return Map.of("upiId",address,"payee",name);
    }
    public SaasRenewalController(CurrentUserService current,TenantRepository tenants,SubscriptionPlanRepository plans,SaasRenewalPaymentRepository payments) {this.current=current;this.tenants=tenants;this.plans=plans;this.payments=payments;}
    private Tenant tenant(){return tenants.findByCode(current.requireTenantId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Society was not found"));}
    private SubscriptionPlan plan(Tenant tenant){return plans.findById(Optional.ofNullable(tenant.getSubscriptionPlanId()).orElse(-1L)).filter(p->Boolean.TRUE.equals(p.getActive())).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Ask superadmin to assign an active plan before renewal"));}
    @GetMapping("/api/society/subscription/catalogue") @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public List<SubscriptionPlan> catalogue(){return plans.findAll().stream().filter(p->Boolean.TRUE.equals(p.getActive())).toList();}
    @GetMapping("/api/society/subscription/renewal") @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public Map<String,Object> renewal(){loadPaymentAccount();Tenant t=tenant();SubscriptionPlan p=plan(t);return Map.of("plan",p.getName(),"amount",p.getMonthlyPrice(),"configured",!upi.isBlank()&&!payee.isBlank(),"payee",payee,"upiId",upi);}
    @GetMapping(value="/api/society/subscription/renewal/qr",produces="image/png") @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public byte[] qr() throws Exception {
        loadPaymentAccount();
        SubscriptionPlan p=plan(tenant());
        if(upi.isBlank()||payee.isBlank())throw new ResponseStatusException(HttpStatus.CONFLICT,"SaaS payment account is not configured");
        String uri="upi://pay?pa="+enc(upi)+"&pn="+enc(payee)+"&am="+p.getMonthlyPrice()+"&cu=INR&tn="+enc("SaaS renewal "+current.requireTenantId());
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();MatrixToImageWriter.writeToStream(new QRCodeWriter().encode(uri,BarcodeFormat.QR_CODE,280,280),"PNG",bytes);return bytes.toByteArray();
    }
    private String enc(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
    @GetMapping("/api/society/subscription/payments") @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public List<SaasRenewalPayment> own(){return payments.findByTenantIdOrderByCreatedAtDesc(current.requireTenantId());}
    public record Submission(String reference){}
    @PostMapping("/api/society/subscription/payments") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public SaasRenewalPayment submit(@RequestBody Submission request){
        loadPaymentAccount();
        if(upi.isBlank()||payee.isBlank())throw new ResponseStatusException(HttpStatus.CONFLICT,"Payment account is not configured");
        String ref=request.reference()==null?"":request.reference().trim();
        if(!ref.matches("[A-Za-z0-9-]{8,80}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a valid transaction reference (8–80 characters)");
        if(payments.existsByTransactionReference(ref))throw new ResponseStatusException(HttpStatus.CONFLICT,"This transaction reference was already submitted");
        Tenant t=tenant();SubscriptionPlan p=plan(t);
        if(payments.findByTenantIdOrderByCreatedAtDesc(current.requireTenantId()).stream().anyMatch(x->"PENDING_VERIFICATION".equals(x.getStatus())))throw new ResponseStatusException(HttpStatus.CONFLICT,"Your previous renewal is awaiting verification");
        SaasRenewalPayment payment=new SaasRenewalPayment();payment.setTenantId(current.requireTenantId());payment.setPlanId(p.getId());payment.setPlanName(p.getName());payment.setAmount(p.getMonthlyPrice());payment.setTransactionReference(ref);payment.setStatus("PENDING_VERIFICATION");return payments.save(payment);
    }
    @GetMapping("/api/superadmin/saas-payments") @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<SaasRenewalPayment> all(){return payments.findAllByOrderByCreatedAtDesc();}
    public record Review(boolean approve){}
    @PutMapping("/api/superadmin/saas-payments/{id}") @PreAuthorize("hasRole('SUPER_ADMIN')") @Transactional
    public SaasRenewalPayment review(@PathVariable("id") Long id,@RequestBody Review request){
        SaasRenewalPayment payment=payments.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Payment was not found"));
        if(!"PENDING_VERIFICATION".equals(payment.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Payment has already been reviewed");
        if(!request.approve()){payment.setStatus("REJECTED");return payments.save(payment);}
        Tenant t=tenants.findByCode(payment.getTenantId()).orElseThrow();
        if(!Objects.equals(t.getSubscriptionPlanId(),payment.getPlanId()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Assigned plan changed; reject this payment and arrange a corrected renewal");
        SubscriptionPlan p=plans.findById(payment.getPlanId()).orElseThrow();
        LocalDate start=t.getSubscriptionRenewsOn()!=null&&!t.getSubscriptionRenewsOn().isBefore(LocalDate.now())?t.getSubscriptionRenewsOn().plusDays(1):LocalDate.now();
        String cycle=String.valueOf(p.getBillingCycle()).toUpperCase();int months=switch(cycle){case "ANNUAL","YEARLY"->12;case "QUARTERLY"->3;case "HALF_YEARLY"->6;case "MONTHLY"->1;default->throw new ResponseStatusException(HttpStatus.CONFLICT,"Unsupported billing cycle");};
        payment.setCycleStart(start);payment.setCycleEnd(start.plusMonths(months).minusDays(1));payment.setStatus("VERIFIED");
        if(t.getSubscriptionStartedOn()==null)t.setSubscriptionStartedOn(start);t.setSubscriptionRenewsOn(payment.getCycleEnd());t.setSubscriptionStatus("ACTIVE");tenants.save(t);return payments.save(payment);
    }
}
