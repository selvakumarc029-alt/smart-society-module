const fs=require('fs');
const file='src/main/java/com/smartapartment/controller/FinanceApiController.java';
let s=fs.readFileSync(file,'utf8');
s=s.replaceAll('expenses.findByIdAndTenantId(id,current.requireTenantId())','expenses.lockByIdAndTenantId(id,current.requireTenantId())')
    .replace('bills.findByIdAndTenantId(id,user.getTenantId())','bills.lockByIdAndTenantId(id,user.getTenantId())')
    .replace('e.setApprovalStatus("APPROVED");expenses.save(e);','requirePending(e);e.setApprovalStatus("APPROVED");expenses.save(e);')
    .replace('e.setApprovalStatus("REJECTED");','requirePending(e);e.setApprovalStatus("REJECTED");')
    .replace('e.setPaymentMode(mode.trim().toUpperCase(Locale.ROOT))','e.setPaymentMode(paymentMode(mode))')
    .replace('r.transactionId()))','r.transactionId().trim()))')
    .replace('p.setPaymentMode(r.mode().toUpperCase(Locale.ROOT))','p.setPaymentMode(paymentMode(r.mode()))');
const needle='    private static Map<String,Object> map(Object...v)';
if(!s.includes(needle))throw Error('Helper insertion point missing');
s=s.replace(needle,`    private static void requirePending(Expense e) {
        if(!"PENDING".equalsIgnoreCase(e.getApprovalStatus()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Only pending expenses can be approved or rejected");
    }
    private static String paymentMode(String raw) {
        String mode=raw==null?"":raw.trim().toUpperCase(Locale.ROOT).replaceAll("[ -]+","_");
        if(!Set.of("CASH","UPI","BANK_TRANSFER","CHEQUE","CARD","ONLINE","NET_BANKING").contains(mode))
            throw new IllegalArgumentException("Choose a valid payment mode");
        return mode;
    }

`+needle);
fs.writeFileSync(file,s);
console.log('Finance mutations now serialize record changes and preserve approval states');
