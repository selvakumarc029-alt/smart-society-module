package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import com.smartapartment.entity.BankAccount;
import com.smartapartment.entity.PaymentGatewayConfig;
import com.smartapartment.repository.PaymentGatewayConfigRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin/finance")
public class SuperAdminFinanceController {
    private final PaymentGatewayConfigRepository gateways;
    public SuperAdminFinanceController(PaymentGatewayConfigRepository gateways) { this.gateways = gateways; }

    @GetMapping("/bank-accounts")
    public ResponseEntity<List<BankAccount>> getBankAccounts() {
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/bank-accounts")
    public ResponseEntity<BankAccount> linkBankAccount(@RequestBody BankAccount account) {
        // Stubbed: Link official society bank account
        return ResponseEntity.ok(account);
    }

    @GetMapping("/payment-gateways")
    public ResponseEntity<List<Map<String, Object>>> getPaymentGateways() {
        if (gateways.count() == 0) { PaymentGatewayConfig gateway = new PaymentGatewayConfig(); gateway.setProviderName("Stripe"); gateway.setEnvironment("Sandbox"); gateway.setTransactionFee("2.9% + Rs. 30"); gateway.setDigitalInvoicingEnabled(true); gateway.setActive(false); gateways.save(gateway); }
        return ResponseEntity.ok(gateways.findAllByOrderByCreatedAtAsc().stream().map(this::gatewayView).toList());
    }

    @PostMapping("/payment-gateways")
    public ResponseEntity<Map<String, Object>> configureGateway(@RequestBody PaymentGatewayConfig config) {
        if (config.getProviderName() == null || config.getProviderName().isBlank()) {
            throw new IllegalArgumentException("Payment gateway provider is required");
        }
        PaymentGatewayConfig saved = gateways.save(config);
        return ResponseEntity.ok(gatewayView(saved));
    }

    @PutMapping("/payment-gateways/{id}")
    public ResponseEntity<Map<String,Object>> updateGateway(@PathVariable Long id, @RequestBody PaymentGatewayConfig request) {
        PaymentGatewayConfig gateway = gateways.findById(id).orElseThrow(() -> new IllegalArgumentException("Gateway was not found"));
        gateway.setProviderName(request.getProviderName()); gateway.setMerchantId(request.getMerchantId()); gateway.setEnvironment(request.getEnvironment()); gateway.setTransactionFee(request.getTransactionFee()); gateway.setDigitalInvoicingEnabled(request.isDigitalInvoicingEnabled()); gateway.setActive(request.isActive());
        gateway.setWebhookUrl(request.getWebhookUrl()); gateway.setSettlementCurrency(request.getSettlementCurrency());
        gateway.setSettlementDays(request.getSettlementDays()); gateway.setSupportedMethods(request.getSupportedMethods());
        gateway.setRefundsEnabled(request.getRefundsEnabled()); gateway.setReconciliationEmail(request.getReconciliationEmail());
        gateway.setConfigurationNotes(request.getConfigurationNotes());
        if (request.getApiKey() != null && !request.getApiKey().isBlank()) gateway.setApiKey(request.getApiKey());
        if (request.getApiSecret() != null && !request.getApiSecret().isBlank()) gateway.setApiSecret(request.getApiSecret());
        return ResponseEntity.ok(gatewayView(gateways.save(gateway)));
    }

    private Map<String,Object> gatewayView(PaymentGatewayConfig gateway) {
        Map<String,Object> item = new java.util.LinkedHashMap<>();
        item.put("id",gateway.getId()); item.put("providerName",gateway.getProviderName()); item.put("environment",gateway.getEnvironment());
        item.put("transactionFee",gateway.getTransactionFee()); item.put("merchantId",gateway.getMerchantId());
        item.put("configured",gateway.getMerchantId()!=null&&!gateway.getMerchantId().isBlank());
        item.put("digitalInvoicingEnabled",gateway.isDigitalInvoicingEnabled()); item.put("active",gateway.isActive());
        item.put("webhookUrl",gateway.getWebhookUrl()); item.put("settlementCurrency",gateway.getSettlementCurrency());
        item.put("settlementDays",gateway.getSettlementDays()); item.put("supportedMethods",gateway.getSupportedMethods());
        item.put("refundsEnabled",Boolean.TRUE.equals(gateway.getRefundsEnabled())); item.put("reconciliationEmail",gateway.getReconciliationEmail());
        item.put("configurationNotes",gateway.getConfigurationNotes()); item.put("message","Gateway settings saved securely");
        return item;
    }

    @PostMapping("/late-fees/rules")
    public ResponseEntity<String> setLateFeeRules(@RequestParam Long billingRuleId, 
                                                  @RequestParam Double percentage, 
                                                  @RequestParam Double fixedAmount) {
        // Stubbed: Update billing rule with automated late fee calculation rules
        return ResponseEntity.ok("Late fee rules updated");
    }

    @PostMapping("/invoicing/toggle")
    public ResponseEntity<String> toggleDigitalInvoicing(@RequestParam boolean enable) {
        // Stubbed: Enable or disable digital invoicing modules system-wide
        return ResponseEntity.ok("Digital invoicing module status updated");
    }
}
