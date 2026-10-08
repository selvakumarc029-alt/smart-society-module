(function (root) {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = value => Number(value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    function csv(rows) {
        return '\uFEFF' + rows.map(row => row.map(value => {
            let text = String(value ?? '');
            if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
        }).join(',')).join('\r\n');
    }
    function dateValue(raw) {
        const value = String(raw || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const parsed = new Date(value + 'T12:00:00Z');
            if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new Error('Use a valid due date.');
            return value;
        }
        const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        if (!match || !months.includes(match[2].toLowerCase())) throw new Error('Use a valid due date (YYYY-MM-DD).');
        const date = `${match[3]}-${String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
        if (new Date(date + 'T12:00:00Z').toISOString().slice(0,10) !== date) throw new Error('Use a valid due date.');
        return date;
    }
    function billingPayload(values, today) {
        const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        let month = String(values.batchMonth || '').trim();
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            const parts = month.toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
            if (!parts || !monthNames.includes(parts[1])) throw new Error('Use a billing month such as 2026-10 or October 2026.');
            month = `${parts[2]}-${String(monthNames.indexOf(parts[1]) + 1).padStart(2,'0')}`;
        }
        const number = key => {
            const value = Number(values[key]);
            if (values[key] === '' || !Number.isFinite(value) || value < 0) throw new Error('Enter valid non-negative billing charges.');
            return value;
        };
        const [year, mm] = month.split('-').map(Number);
        const dueDate = dateValue(values.batchDueDate);
        const periodEnd = `${month}-${new Date(year, mm, 0).getDate()}`;
        const periodStart = `${month}-01`;
        if (dueDate < periodStart) throw new Error('The due date must not be before the billing period.');
        return {month, invoiceDate:today, periodStart, periodEnd, dueDate,
            defaultAreaSqFt: 1, baseRatePerSqFt:number('batchBaseRate'), waterRatePerUnit:number('batchWaterRate'),
            commonPowerFee:number('batchPowerFee'), sinkingFund:number('batchSinkingFee'),
            repairReserve:number('batchRepairFee'), parkingFee:number('batchParkingFee'),
            cgstRate:number('batchGstRate') / 2, sgstRate:number('batchGstRate') / 2};
    }
    const core = {csv, dateValue, billingPayload};
    if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
    if (!root.document || document.body?.dataset.dashboardRole !== 'accountant' || document.body.dataset.platform === 'propertydirect') return;
    let state = {bills:[], payments:[], expenses:[], vendors:[], residents:[]};
    let selectedBill = null;
    let dialog = null;
    let refreshPromise = null;
    let observer = null;
    let busy = false;
    const today = () => new Date().toLocaleDateString('en-CA');
    function notice(message, error) {
        let box = document.getElementById('accountantActionStatus');
        if (!box) {
            box = document.createElement('div'); box.id = 'accountantActionStatus'; box.setAttribute('role','status'); box.setAttribute('aria-live','polite');
            box.style.cssText = 'position:fixed;bottom:24px;right:24px;max-width:420px;padding:16px;border-radius:12px;z-index:1200;color:white;box-shadow:0 8px 24px #0003';
            document.body.appendChild(box);
        }
        box.style.background = error ? '#991b1b' : '#0f172a'; box.textContent = message; box.hidden = false;
        clearTimeout(box.timer); box.timer = setTimeout(() => { box.hidden = true; }, 6500);
    }
    async function request(url, method = 'GET', data) {
        const response = await fetch(url, {method, credentials:'same-origin', headers:{Accept:'application/json','Content-Type':'application/json'}, body:data === undefined ? undefined : JSON.stringify(data)});
        const payload = await response.json().catch(() => null);
        if (!response.ok || response.redirected || payload === null) throw new Error(payload?.message || payload?.error || 'Unable to complete this action. Check your login and try again.');
        return payload;
    }
    function button(label, action, id) { return `<button type="button" class="btn btn-sm btn-outline-primary me-2" data-accounting-action="${action}" data-record-id="${id}">${label}</button>`; }
    function table(name, rows, render) {
        const target = document.querySelector(`table[data-table="${name}"] tbody`);
        if (!target) return;
        const columns = target.closest('table').querySelectorAll('thead th').length;
        target.innerHTML = rows.length ? rows.map(row => `<tr data-accounting-row="true" data-record-id="${row.id}">${render(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr data-accounting-row="true"><td colspan="${columns}" class="text-muted text-center py-4">No records available.</td></tr>`;
    }
    function render() {
        observer?.disconnect();
        const headings = {'vendors':['Vendor Name','Service Provided','Email','Phone','GST / Tax Number','Status'], 'billing':['Invoice No.','Flat','Resident Name','Month','Maintenance Base','Water & Power','GST','Total Payable','Status','Action']};
        Object.entries(headings).forEach(([name, labels]) => document.querySelectorAll(`table[data-table="${name}"] thead th`).forEach((cell,index) => { cell.textContent=labels[index]; }));
        const residents = new Map(state.residents.map(r => [r.unitNo, r.name || r.fullName]));
        table('billing',state.bills,b => [esc(b.invoiceNumber || `INV-${b.id}`),esc(b.unitNo),esc(residents.get(b.unitNo) || '—'),esc(b.month),money(b.baseAmount),money(Number(b.waterAmount||0)+Number(b.commonPowerFee||0)),money(Number(b.cgstAmount||0)+Number(b.sgstAmount||0)),money(b.totalAmount),esc(b.paymentStatus),button('View invoice','invoice',b.id)+(b.paymentStatus !== 'PAID' ? button('Record payment','income',b.id) : '')]);
        table('incomes',state.payments,p => [esc(p.paidAt),esc(p.mode),esc(p.unitNo),esc(p.transactionId),money(p.amount),esc(p.status)]);
        table('expenses',state.expenses,e => [esc(e.date),esc(e.category),esc(e.vendor),esc(e.invoiceNumber),money(e.amount),esc(e.approvalStatus) + (e.approvalStatus === 'PENDING' ? ' ' + button('Edit','expense',e.id) : e.approvalStatus === 'APPROVED' ? ' ' + button('Record payment','expense-pay',e.id) : '')]);
        table('vendors',state.vendors,v => [esc(v.name),esc(v.serviceCategory),esc(v.email || '—'),esc(v.phone),esc(v.taxNumber || '—'),'Registered']);
        observe();
    }
    function observe() {
        if (!observer) observer = new MutationObserver(() => {
            if (['billing','incomes','expenses','vendors'].some(name => {
                const body = document.querySelector(`table[data-table="${name}"] tbody`);
                return body && !body.querySelector('[data-accounting-row]');
            })) render();
        });
        ['billing','incomes','expenses','vendors'].forEach(name => { const body = document.querySelector(`table[data-table="${name}"] tbody`); if (body) observer.observe(body,{childList:true}); });
    }
    function refresh() {
        if (refreshPromise) return refreshPromise;
        refreshPromise = Promise.all(['/api/society/bills','/api/society/finance/payments','/api/society/finance/expenses','/api/society/operations/vendors','/api/society/residents'].map(url=>request(url)))
            .then(([bills,payments,expenses,vendors,residents]) => { state={bills,payments,expenses,vendors,residents}; render(); })
            .finally(() => { refreshPromise=null; });
        return refreshPromise;
    }
    function openForm(title, fields, save) {
        dialog?.remove();
        dialog = document.createElement('dialog'); dialog.setAttribute('aria-label',title);
        dialog.style.cssText = 'border:0;border-radius:18px;padding:24px;width:min(540px,94vw);max-height:85vh;box-shadow:0 20px 60px #0005';
        dialog.innerHTML = `<form><h3 class="h5 mb-3">${esc(title)}</h3>${fields}<p data-form-error role="alert" class="text-danger small"></p><div class="d-flex gap-2 mt-4 justify-content-end"><button type="button" class="btn btn-light" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        const opener = document.activeElement;
        document.body.appendChild(dialog); dialog.showModal();
        dialog.addEventListener('close',() => { if (opener?.isConnected) opener.focus(); });
        dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
        dialog.querySelector('form').onsubmit = async event => {
            event.preventDefault();
            if (busy || !event.target.reportValidity()) return;
            busy=true; const submit=event.target.querySelector('[type="submit"]'); submit.disabled=true;
            try { await save(Object.fromEntries(new FormData(event.target))); dialog.close(); notice('Saved successfully.'); await refresh().catch(error=>notice('Saved, but the tables could not refresh: '+error.message,true)); }
            catch(error) { event.target.querySelector('[data-form-error]').textContent=error.message; }
            finally { busy=false; submit.disabled=false; }
        };
    }
    function input(name,label,value='',type='text',required=true) {
        return `<label class="d-block mb-3">${esc(label)}<input class="form-control mt-1" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0.01" step="0.01"':''}></label>`;
    }
    function income(id) {
        const bills = state.bills.filter(b => b.paymentStatus !== 'PAID' && (!id || String(b.id) === String(id)));
        if (!bills.length) { notice('No unpaid bills are available to record a collection.'); return; }
        openForm('Record maintenance collection',`<label class="d-block mb-3">Unpaid invoice<select class="form-select mt-1" name="billId" required>${bills.map(b=>`<option value="${b.id}">${esc(b.unitNo)} · ${esc(b.month)} · Rs. ${money(b.totalAmount)}</option>`).join('')}</select></label><label class="d-block mb-3">Payment mode<select class="form-select mt-1" name="mode"><option>BANK_TRANSFER</option><option>UPI</option><option>CASH</option><option>CHEQUE</option></select></label>${input('transactionId','Verified transaction / receipt reference')}`,values=>request(`/api/society/finance/bills/${encodeURIComponent(values.billId)}/pay`,'POST',{mode:values.mode,transactionId:values.transactionId.trim()}));
    }
    function expense(id) {
        const item=state.expenses.find(e=>String(e.id)===String(id)) || {};
        openForm(id?'Edit pending expense':'Record expense',input('title','Expense title',item.title)+input('category','Category',item.category)+input('vendor','Vendor',item.vendor)+input('amount','Amount (Rs.)',item.amount,'number')+input('date','Expense date',item.date||today(),'date')+input('invoiceNumber','Invoice reference',item.invoiceNumber,'text',false)+input('description','Description',item.description,'text',false),values=>request(`/api/society/finance/expenses${id?'/'+encodeURIComponent(id):''}`,id?'PATCH':'POST',{...values,amount:Number(values.amount)}));
    }
    function vendor() {
        openForm('Register vendor',input('name','Vendor name')+input('category','Service category')+input('phone','Phone','','tel')+input('email','Email','','email',false)+input('taxNumber','GST / tax number','','text',false),values=>request('/api/society/accounting/vendors','POST',values));
    }
    function expensePayment(id) {
        openForm('Record approved expense payment',`<label class="d-block mb-3">Payment mode<select name="mode" class="form-select"><option>BANK_TRANSFER</option><option>UPI</option><option>CASH</option><option>CHEQUE</option></select></label>${input('reference','Payment reference')}`,values=>request(`/api/society/finance/expenses/${encodeURIComponent(id)}/pay?${new URLSearchParams(values)}`,'PATCH'));
    }
    function invoice(id) {
        const bill=state.bills.find(b=>String(b.id)===String(id));
        if (!bill) throw new Error('Select an invoice first.');
        selectedBill=bill.id;
        const fields={invModalNo:bill.invoiceNumber||`INV-${bill.id}`, invModalName:state.residents.find(r=>r.unitNo===bill.unitNo)?.name||'Resident', invModalFlat:`Unit: ${bill.unitNo}`, invBaseAmt:`Rs. ${money(bill.baseAmount)}`,invWaterAmt:`Rs. ${money(bill.waterAmount)}`,invGstAmt:`Rs. ${money(Number(bill.cgstAmount||0)+Number(bill.sgstAmount||0))}`,invTotalAmt:`Rs. ${money(bill.totalAmount)}`,invModalStatus:bill.paymentStatus};
        Object.entries(fields).forEach(([key,value])=>{const field=document.getElementById(key);if(field)field.textContent=value;});
        const modal=document.getElementById('invoiceModal');
        if(modal){
            for(const [key,value] of Object.entries({invModalDate:`Invoice date: ${bill.invoiceDate || 'Not recorded'}`,invModalDueDate:`Due date: ${bill.dueDate || 'Not recorded'}`,invModalPeriod:bill.month})){
                const field=document.getElementById(key);if(field)field.textContent=value;
            }
            const status=document.getElementById('invModalStatus');
            if(status){status.style.background=bill.paymentStatus==='PAID'?'#d1e7dd':'#fff3cd';status.style.color=bill.paymentStatus==='PAID'?'#0f5132':'#664d03';}
            const rows=[['Society base maintenance',bill.baseAmount],['Metered water supply',bill.waterAmount],['Common area electricity',bill.commonPowerFee],['Sinking fund',bill.sinkingFund],['Repair reserve',bill.repairReserve],['Parking',bill.parkingFee],['Amenities',bill.amenityFee],['Other charges',bill.otherCharges],['Previous balance',bill.previousBalance],['Credit adjustment',-Number(bill.creditAdjustment||0)],['CGST',bill.cgstAmount],['SGST',bill.sgstAmount],['Late fee',bill.lateFee],['Rounding',bill.roundOff]];
            const tbody=modal.querySelector('table tbody');
            if(tbody)tbody.innerHTML=rows.map(([label,amount],index)=>`<tr><td style="padding:9px 12px">${index+1}</td><td style="padding:9px 12px">${esc(label)}</td><td style="padding:9px 12px">Saved invoice charge</td><td style="padding:9px 12px;text-align:right">Rs. ${money(amount)}</td></tr>`).join('');
            const header=document.getElementById('invModalNo')?.parentElement?.parentElement?.firstElementChild;
            if(header){header.children[0].textContent='Society maintenance invoice';header.children[1].textContent=`GSTIN: ${bill.societyGstin||'Not recorded'} | PAN: ${bill.societyPan||'Not recorded'}`;header.children[2].textContent=bill.notes||'';}
            const bankSection=modal.querySelector('table')?.nextElementSibling;
            const paragraphs=bankSection?.querySelectorAll('p');
            if(paragraphs?.length===2){paragraphs[0].textContent=`Bank: ${bill.bankName||'Not recorded'} · Account: ${bill.bankAccountNumber||'Not recorded'} · IFSC: ${bill.bankIfsc||'Not recorded'} · UPI: ${bill.upiId||'Not recorded'}`;paragraphs[1].textContent=bill.paymentTerms||'No payment terms recorded for this invoice.';}
            modal.style.display='flex';
        }
    }
    async function ledger() {
        await refresh();
        const rows=[['Type','Date','Flat / Vendor','Reference','Amount (Rs.)','Status'],...state.payments.map(p=>['Income',p.paidAt,p.unitNo,p.transactionId,p.amount,p.status]),...state.expenses.map(e=>['Expense',e.date,e.vendor,e.invoiceNumber,e.amount,e.approvalStatus])];
        const url=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'})); const link=document.createElement('a');link.href=url;link.download=`society-ledger-${today()}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function batch() {
        const modal=document.getElementById('itemizedBatchModal'); if(!modal)return;
        document.getElementById('batchMonth').value=today().slice(0,7);
        document.getElementById('batchDueDate').value=today();
        let area=document.getElementById('accountingDefaultArea');
        if(!area){const label=document.createElement('label');label.textContent='Fallback flat area (sq.ft; used only if the flat has no stored area)';area=document.createElement('input');area.id='accountingDefaultArea';area.className='form-control';area.type='number';area.min='1';area.value='1000';area.required=true;label.appendChild(area);modal.querySelector('form').insertBefore(label,modal.querySelector('form').lastElementChild);}
        modal.style.display='flex';
    }
    window.addEventListener('click',event=>{
        const target=event.target.closest?.('button'); if(!target||target.disabled)return;
        const action=target.dataset.accountingAction;
        const tableName=target.dataset.table;
        const inline=target.getAttribute('onclick')||'';
        let run=null;
        if(action==='invoice')run=()=>invoice(target.dataset.recordId);
        else if(action==='income')run=()=>income(target.dataset.recordId);
        else if(action==='expense')run=()=>expense(target.dataset.recordId);
        else if(action==='expense-pay')run=()=>expensePayment(target.dataset.recordId);
        else if(target.dataset.action==='add' && ['incomes','expenses','vendors'].includes(tableName))run=()=>({incomes:income,expenses:expense,vendors:vendor}[tableName])();
        else if(target.dataset.action==='generate'||inline==='openInvoiceModal()')run=batch;
        else if(inline==='printSelectedInvoice()')run=()=>{const id=selectedBill||state.bills[0]?.id;if(!id)throw new Error('There are no invoices to print.');invoice(id);window.print();};
        else if(target.dataset.action==='save' && /download ledger/i.test(target.textContent))run=ledger;
        if(!run)return;
        event.preventDefault();event.stopImmediatePropagation();
        if(target.dataset.accountingBusy)return;
        target.dataset.accountingBusy='true';
        Promise.resolve().then(run).catch(error=>notice(error.message,true)).finally(()=>{delete target.dataset.accountingBusy;});
    },true);
    window.addEventListener('submit',async event=>{
        const form=event.target;
        if(!form.closest?.('#itemizedBatchModal'))return;
        event.preventDefault();event.stopImmediatePropagation();
        if(busy||!form.reportValidity())return;
        const submit=form.querySelector('[type="submit"]');busy=true;if(submit)submit.disabled=true;
        try {
            const ids=['batchMonth','batchDueDate','batchBaseRate','batchWaterRate','batchPowerFee','batchSinkingFee','batchRepairFee','batchParkingFee','batchGstRate'];
            const payload=billingPayload(Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value])),today());
            const area=Number(document.getElementById('accountingDefaultArea')?.value);
            if(!Number.isInteger(area)||area<1)throw new Error('Enter a valid fallback flat area.');
            payload.defaultAreaSqFt=area;
            const result=await request('/api/billing/generate-detailed','POST',payload);
            document.getElementById('itemizedBatchModal').style.display='none';notice(`${result.count} invoice(s) generated for ${result.month}.`);await refresh();
        }catch(error){notice(error.message,true);}finally{busy=false;if(submit)submit.disabled=false;}
    },true);
    root.refreshAccountantRecords=refresh;
    async function init(){try{if(typeof root.loadSocietyBackendData==='function')await root.loadSocietyBackendData();await refresh();}catch(error){notice(error.message,true);}}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window === 'undefined' ? globalThis : window);
