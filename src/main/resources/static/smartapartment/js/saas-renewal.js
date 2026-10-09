(() => {
    if (document.body.dataset.platform !== 'smartsociety') return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = value => Number(value || 0).toLocaleString('en-IN', {style:'currency',currency:'INR'});
    async function api(path, options={}) {
        const response=await fetch(path,{credentials:'same-origin',...options,headers:{Accept:'application/json','Content-Type':'application/json',...options.headers}});
        if(response.redirected || !(response.headers.get('content-type')||'').includes('application/json')) throw Error('Please sign in again to access subscription details.');
        const data=await response.json();if(!response.ok)throw Error(data.message||data.detail||'Subscription request could not be completed.');return data;
    }
    function dialog(title,content){
        document.getElementById('saasRenewalDialog')?.remove();
        const d=document.createElement('dialog');d.id='saasRenewalDialog';d.style.cssText='width:min(760px,94vw);max-height:88vh;overflow:auto;border:1px solid #dbe3ef;border-radius:20px;padding:24px;color:#172033;background:white;';
        d.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px"><h3 style="margin:0">${esc(title)}</h3><button type="button" class="btn btn-outline-secondary" aria-label="Close subscription dialog">×</button></div>${content}`;
        document.body.appendChild(d);d.querySelector('button').onclick=()=>d.close();d.showModal();return d;
    }
    async function catalogue(){
        const d=dialog('Plan catalogue','<p>Loading plans…</p>');
        try{const plans=await api('/api/society/subscription/catalogue');d.querySelector('p').outerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">${plans.map(p=>`<article style="padding:20px;border:1px solid #dbe3ef;border-radius:14px"><h4>${esc(p.name)}</h4><p>${esc(p.description)}</p><strong>${money(p.monthlyPrice)} / ${esc(p.billingCycle)}</strong><p>${esc(p.maxApartments)} flats · ${esc(p.maxResidents)} residents</p><small>Contact superadmin to assign or change this plan.</small></article>`).join('')||'<p>No active plans are available.</p>'}</div>`;}catch(e){d.querySelector('p').textContent=e.message;}
    }
    async function renew(){
        const d=dialog('Renew society plan','<p>Loading renewal details…</p>');
        try{const payment=await api('/api/society/subscription/renewal');
            d.querySelector('p').outerHTML=`<div><h4>${esc(payment.plan)} · ${money(payment.amount)}</h4>${payment.configured?`<p>Pay ${esc(payment.payee)} (${esc(payment.upiId)}) using this QR, then submit the transaction reference for verification.</p><img src="/api/society/subscription/renewal/qr" alt="UPI QR for SaaS renewal" width="280" height="280" style="display:block;margin:20px auto"><form><label for="saasTransactionReference">UPI transaction reference</label><input id="saasTransactionReference" class="form-control mt-2 mb-3" required pattern="[A-Za-z0-9-]{8,80}" maxlength="80"><button class="btn btn-primary" type="submit">Submit for verification</button></form><p role="status" id="saasSubmitStatus"></p>`:'<p role="status">The SaaS payment account has not been configured. Contact superadmin to enable renewal payments.</p>'}</div>`;
            const form=d.querySelector('form');if(form)form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('/api/society/subscription/payments',{method:'POST',body:JSON.stringify({reference:form.querySelector('input').value.trim()})});d.querySelector('#saasSubmitStatus').textContent='Submitted to superadmin. Your plan will renew after the payment is verified.';form.remove();await history();}catch(e){d.querySelector('#saasSubmitStatus').textContent=e.message;button.disabled=false;}};
        }catch(e){d.querySelector('p').textContent=e.message;}
    }
    async function history(){
        const admin=!!document.getElementById('saasRenewButton');
        const panel=document.querySelector('[data-view="subscriptions"]')||document.getElementById('panel-subscriptions')||document.getElementById('subscriptions');if(!panel)return;
        let root=document.getElementById('saasRecordedPayments');if(!root){root=document.createElement('section');root.id='saasRecordedPayments';root.style.cssText='background:white;border:1px solid #dbe3ef;border-radius:18px;padding:24px;margin-top:24px';panel.appendChild(root);}
        try{const rows=await api(admin?'/api/society/subscription/payments':'/api/superadmin/saas-payments');root.innerHTML=`<h4>SaaS renewal payments</h4><p>Transaction references require confirmation against the receiving account.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">${rows.map(p=>`<article style="border:1px solid #dbe3ef;border-radius:14px;padding:20px"><h5>${esc(p.planName)} · ${money(p.amount)}</h5>${admin?'':`<p>Society: ${esc(p.tenantId)}</p>`}<p>Reference: ${esc(p.transactionReference)}</p><p>Submitted: ${esc(p.createdAt?.replace('T',' ').slice(0,16))}</p><strong>${esc(p.status.replaceAll('_',' '))}</strong>${p.cycleStart?`<p>Valid: ${esc(p.cycleStart)} to ${esc(p.cycleEnd)}</p>`:''}${!admin&&p.status==='PENDING_VERIFICATION'?`<div style="display:flex;gap:12px;margin-top:16px"><button class="btn btn-primary" data-review="${p.id}" data-approve="true">Verify payment</button><button class="btn btn-outline-danger" data-review="${p.id}" data-approve="false">Reject</button></div>`:''}</article>`).join('')||'<p>No SaaS renewal payments have been recorded.</p>'}</div>`;
            root.querySelectorAll('[data-review]').forEach(button=>button.onclick=async()=>{if(!confirm(button.dataset.approve==='true'?'Confirm that this transaction and amount were received in the SaaS payment account?':'Reject this submitted payment reference?'))return;button.disabled=true;try{await api(`/api/superadmin/saas-payments/${button.dataset.review}`,{method:'PUT',body:JSON.stringify({approve:button.dataset.approve==='true'})});await history();}catch(e){alert(e.message);button.disabled=false;}});
        }catch(e){root.textContent=e.message;}
    }
    async function accountSetup(){
        if(document.getElementById('saasRenewButton'))return;
        const panel=document.querySelector('[data-view="subscriptions"]');if(!panel)return;
        const card=document.createElement('section');card.style.cssText='padding:24px;border:1px solid #dbe3ef;background:white;border-radius:18px;margin-top:24px';
        card.innerHTML='<h4>SaaS receiving UPI account</h4><p>Use the real receiving account. Verify each payment against this account before approving a renewal.</p><form style="display:grid;gap:14px"><label>Receiving UPI ID<input name="upi" class="form-control" required placeholder="your-account@bank"></label><label>Registered payee name<input name="payee" class="form-control" required maxlength="100"></label><button class="btn btn-primary" type="submit">Save payment account</button><p role="status"></p></form>';panel.appendChild(card);
        const form=card.querySelector('form');try{const data=await api('/api/superadmin/saas-payment-account');form.elements.upi.value=data.upiId;form.elements.payee.value=data.payee;}catch(e){form.querySelector('p').textContent=e.message;}
        form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('/api/superadmin/saas-payment-account',{method:'PUT',body:JSON.stringify({upiId:form.elements.upi.value,payee:form.elements.payee.value})});form.querySelector('p').textContent='Receiving account saved. Admin renewal QR codes now use this account.';}catch(e){form.querySelector('p').textContent=e.message;}finally{button.disabled=false;}};
    }
    document.addEventListener('DOMContentLoaded',()=>{document.getElementById('saasCatalogueButton')?.addEventListener('click',catalogue);document.getElementById('saasRenewButton')?.addEventListener('click',renew);history();accountSetup();});
    setInterval(()=>{if(!document.hidden&&['#subscriptions','#payments'].includes(location.hash))history();},15000);
})();
