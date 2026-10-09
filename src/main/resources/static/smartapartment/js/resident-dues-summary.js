(() => {
    'use strict';
    function summary(bills) {
        if (!Array.isArray(bills)) return null;
        const unpaid = bills.filter(b => !['PAID', 'CANCELLED', 'VOID'].includes(String(b.paymentStatus || '').toUpperCase()));
        const amount = unpaid.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
        const dueDate = unpaid.map(b => b.dueDate).filter(Boolean).sort()[0];
        return { amount, count: unpaid.length, dueDate };
    }
    if (typeof module !== 'undefined' && module.exports) { module.exports = summary; return; }
    function openPayment(bill) {
        document.getElementById('residentInvoicePayment')?.remove();
        const dialog = document.createElement('dialog'); dialog.id = 'residentInvoicePayment';
        dialog.style.cssText = 'width:min(560px,calc(100vw - 32px));border:1px solid #dce5f2;border-radius:20px;padding:24px;max-height:85vh;overflow:auto';
        const title = document.createElement('h3'); title.textContent = 'Pay maintenance invoice';
        const detail = document.createElement('p'); detail.textContent = `${bill.invoiceNumber || bill.month} · ${bill.unitNo || ''} · Rs. ${Number(bill.totalAmount).toLocaleString('en-IN')}`;
        dialog.append(title,detail);
        const upi = String(bill.upiId || '').trim();
        if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upi)) {
            const pay = document.createElement('a'); pay.className = 'btn btn-primary'; pay.textContent = 'Pay with UPI app';
            pay.href = 'upi://pay?' + new URLSearchParams({pa:upi,pn:'Society maintenance',am:Number(bill.totalAmount).toFixed(2),cu:'INR',tn:bill.invoiceNumber || `Maintenance ${bill.month}`});
            const account = document.createElement('p'); account.textContent = 'Receiving UPI ID: ' + upi; dialog.append(account,pay);
            const qr = document.createElement('img'); qr.src=`/api/society/bills/${bill.id}/payment-qr`; qr.alt='Scan this invoice payment QR using your phone UPI app'; qr.width=240;qr.height=240;qr.style.cssText='display:block;margin:16px auto;max-width:100%;object-fit:contain';
            const qrHelp=document.createElement('p');qrHelp.textContent='On a computer: scan this QR using Google Pay, PhonePe or another UPI app on your phone. Confirm the receiving name and amount in your app before paying.';
            qr.addEventListener('error',()=>{qr.hidden=true;qrHelp.textContent='Payment QR could not load. Retry after signing in, or use the receiving UPI ID in your phone app.';});dialog.append(qr,qrHelp);
            pay.textContent='Open UPI app on this phone';
            pay.addEventListener('click',()=>{help.textContent='If no app opens, scan the QR with your phone instead. Desktop browsers usually have no UPI app installed.';});
            const help = document.createElement('p'); help.textContent = 'Open this on your phone with a UPI app installed. Payment status changes after the society confirms receipt.'; dialog.append(help);
        }
        if (bill.bankAccountNumber && bill.bankIfsc) {
            const bank = document.createElement('p'); bank.textContent = `Bank transfer: ${bill.bankName || 'Society account'} · Account ${bill.bankAccountNumber} · IFSC ${bill.bankIfsc}`; dialog.append(bank);
        }
        const instructions = document.createElement('p');
        instructions.textContent = !upi && !(bill.bankAccountNumber && bill.bankIfsc) ? 'Payment details have not been configured on this invoice. Ask your society administrator to add the receiving UPI ID or bank account.' : 'Include the invoice number in your payment reference and share the transaction reference with the society office for verification.';
        dialog.append(instructions);
        const close = document.createElement('button'); close.type='button'; close.className='btn btn-outline-primary'; close.textContent='Close'; close.addEventListener('click',()=>dialog.close()); dialog.append(close);
        document.body.append(dialog); dialog.showModal();
    }
    function renderInvoices(bills) {
        const body = document.querySelector('[data-view="billing"] .billing-table tbody'); if (!body) return;
        body.replaceChildren();
        if (!Array.isArray(bills) || !bills.length) {
            const row = body.insertRow(); const cell=row.insertCell(); cell.colSpan=6; cell.textContent=Array.isArray(bills)?'No maintenance invoices have been issued.':'Sign in to load your maintenance invoices.'; return;
        }
        bills.forEach(b => {
            const row=body.insertRow();
            [b.month || '—',b.invoiceNumber || 'Maintenance',`Base Rs. ${Number(b.baseAmount || 0).toLocaleString('en-IN')} · Late fee Rs. ${Number(b.lateFee || 0).toLocaleString('en-IN')}`,`Rs. ${Number(b.totalAmount || 0).toLocaleString('en-IN')}`,b.paymentStatus || 'UNPAID'].forEach(value=>{const cell=row.insertCell();cell.textContent=value;});
            const cell=row.insertCell();
            if (['PAID','CANCELLED','VOID'].includes(String(b.paymentStatus).toUpperCase())) cell.textContent=b.paymentStatus;
            else {const pay=document.createElement('button');pay.type='button';pay.className='btn btn-primary';pay.textContent='Pay Invoice';pay.addEventListener('click',()=>openPayment(b));cell.append(pay);}
        });
    }
    window.renderResidentDues = function(bills) {
        if (document.body.dataset.dashboardRole !== 'resident') return;
        renderInvoices(bills);
        const result = summary(bills);
        const money = result ? `Rs. ${result.amount.toLocaleString('en-IN', {maximumFractionDigits: 2})}` : 'Unavailable';
        const detail = !result ? 'Sign in to load your saved invoices.' : !result.count ? 'No outstanding invoices.' : `${result.count} unpaid invoice${result.count === 1 ? '' : 's'}${result.dueDate ? ' · Due ' + new Date(result.dueDate + 'T00:00:00').toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : ''}`;
        ['[data-view="overview"] .overview-card-box[data-panel="billing"]', '[data-view="billing"] .billing-card-box'].forEach(selector => {
            const card = document.querySelector(selector);
            if (!card) return;
            card.querySelector('.card-metric').textContent = money;
            card.querySelector('.card-subtext').textContent = detail;
        });
        const last = document.querySelectorAll('[data-view="billing"] .billing-card-box')[1];
        if (last) {
            last.querySelector('.card-label').textContent = 'Paid invoices';
            const paid = Array.isArray(bills) ? bills.filter(b => String(b.paymentStatus).toUpperCase() === 'PAID') : null;
            last.querySelector('.card-metric').textContent = paid ? String(paid.length) : 'Unavailable';
            last.querySelector('.card-subtext').textContent = paid ? 'Confirmed paid maintenance invoices.' : 'Sign in to load payment history.';
        }
    };
})();