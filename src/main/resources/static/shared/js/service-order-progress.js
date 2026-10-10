(() => {
    'use strict';
    const role = document.body.dataset.dashboardRole;
    const worker = role === 'maintenance-worker';
    const customer = role === 'resident' || role === 'customer';
    if (!worker && !customer) return;
    const platform = role === 'customer' ? 'propertydirect' : 'smartsociety';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labels = {OFFERED:'Awaiting worker acceptance',ASSIGNED:'Worker assigned',ACCEPTED:'Order accepted',JOB_CONFIRMED:'Order accepted',EN_ROUTE:'On the way',TRAVELING:'On the way',REACHED_LOCATION:'Reached location',ARRIVED:'Reached location',PHOTO_START:'Ready to start',DIAGNOSING:'Started inspection',IN_PROGRESS:'Work in progress',WORK_COMPLETED:'Work completed',COMPLETED:'Work completed',CLOSED:'Reviewed',UNASSIGNED:'Awaiting an available worker',FAILED_ASSIGNMENT:'Awaiting an available worker'};
    let host, orders = [], busy = false;
    async function api(path, options = {}) {
        const response = await fetch(path, {...options, credentials:'same-origin', headers:{Accept:'application/json', ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers}});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || 'Unable to update service order.');
        return data;
    }
    function mount() {
        if (host?.isConnected) return true;
        const panel = document.querySelector(worker ? '[data-view="tasks"]' : '[data-view="services"]');
        if (!panel) return false;
        host = document.createElement('section'); host.className = 'service-order-progress';
        host.innerHTML = `<header><div><h3>${worker ? 'Assigned service orders' : 'Your service updates'}</h3><p>${worker ? 'Only you can update the progress of your assigned jobs.' : 'Progress is updated by your assigned maintenance worker.'}</p></div></header><div data-orders aria-live="polite">Loading service orders…</div>`;
        panel.prepend(host); host.addEventListener('click', click);
        return true;
    }
    function action(order) {
        const status = order.jobStatus;
        const legacy = ['JOB_CONFIRMED','TRAVELING','ARRIVED','DIAGNOSING','WORK_COMPLETED','ESTIMATE_PENDING','PAID','CLOSED'].includes(status);
        if (status === 'OFFERED') return ['Accept order','ACCEPT'];
        if (['ACCEPTED','ASSIGNED','JOB_CONFIRMED'].includes(status)) return ['On the way',legacy ? 'travel' : 'EN_ROUTE'];
        if (['EN_ROUTE','TRAVELING'].includes(status)) return ['Reached location',legacy ? 'arrive' : 'REACHED'];
        if (status === 'PHOTO_START') return ['Start work','START'];
        if (['ARRIVED','DIAGNOSING'].includes(status)) return ['Start work','start-repair'];
        if (status === 'IN_PROGRESS') return ['Complete work', order.beforePhotoUrl ? 'COMPLETE' : 'complete'];
        return null;
    }
    function render() {
        host.querySelector('[data-orders]').innerHTML = orders.length ? orders.map(order => {
            const next = worker ? action(order) : null;
            const done = ['COMPLETED','WORK_COMPLETED','CLOSED','PAID','PAYMENT_PENDING'].includes(order.jobStatus);
            const photo = worker && ['REACHED_LOCATION','IN_PROGRESS'].includes(order.jobStatus);
            const reviewUrl = typeof order.customerReviewUrl === 'string' && order.customerReviewUrl.startsWith('/feedback/') ? order.customerReviewUrl : null;
            return `<article><div class="service-order-title"><strong>${escape(order.orderReference || order.bookingReference)}</strong><span>${escape(labels[order.jobStatus] || order.jobStatus)}</span></div><h4>${escape(order.category)}</h4><p>${escape(order.description)}</p><p><b>Worker:</b> ${escape(order.partnerName || 'Matching available worker')} · ${escape(order.serviceAddress || order.location || '')}</p><p>${escape(order.dispatchReason || '')}</p><div class="service-order-actions">${next ? `<button type="button" data-order="${Number(order.id)}" data-action="${next[1]}">${next[0]}</button>` : ''}${photo ? `<label>Upload ${order.jobStatus === 'REACHED_LOCATION' ? 'before' : 'after'} photo<input type="file" accept="image/png,image/jpeg" data-photo="${Number(order.id)}" data-kind="${order.jobStatus === 'REACHED_LOCATION' ? 'before' : 'after'}"></label>` : ''}${customer && done && !order.reviewRating ? reviewUrl ? `<a href="${escape(reviewUrl)}">Review completed service</a>` : `<button type="button" data-review="${Number(order.id)}">Review completed service</button>` : ''}</div></article>`;
        }).join('') : '<div class="service-order-empty">No service orders yet.</div>';
        host.querySelectorAll('[data-photo]').forEach(input => input.addEventListener('change', async () => {
            if (!input.files[0]) return;
            const data = new FormData(); data.append('photo',input.files[0]);
            input.disabled = true;
            try { await api(`/api/maintenance/dispatch/bookings/${input.dataset.photo}/photos/${input.dataset.kind}`,{method:'POST',body:data}); await load(); }
            catch(error) { showError(error.message); input.disabled=false; }
        }));
    }
    function showError(message) {
        let error = host.querySelector('[data-error]');
        if (!error) {error=document.createElement('p');error.dataset.error='';error.setAttribute('role','alert');host.prepend(error);}
        error.textContent=message;
    }
    async function load() {
        if (busy || !mount()) return;
        busy=true;
        try { orders=await api(`/api/maintenance/dispatch/bookings?platform=${platform}`); render(); }
        catch(error) {showError(error.message);}
        finally {busy=false;}
    }
    async function click(event) {
        if (event.target.closest('[data-refresh]')) { await load(); return; }
        const button=event.target.closest('[data-action]');
        const review=event.target.closest('[data-review]');
        if (review) { openReview(Number(review.dataset.review)); return; }
        if (!button || !worker) return;
        button.disabled=true;
        try {
            const action=button.dataset.action,id=Number(button.dataset.order);
            if (['travel','arrive','start-repair','complete'].includes(action)) await api(`/api/maintenance/workflow/tickets/${id}/${action}`,{method:'POST',body:JSON.stringify(action==='complete'?{notes:'Work completed by assigned technician'}:{})});
            else await api(`/api/maintenance/dispatch/bookings/${id}/action`,{method:'POST',body:JSON.stringify({action})});
            await load();
        } catch(error) {showError(error.message); button.disabled=false;}
    }
    function openReview(id) {
        const dialog=document.createElement('dialog');dialog.className='service-review-dialog';
        dialog.innerHTML='<form><h3>Review completed service</h3><label>Rating<select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label><label>Your review<textarea name="review" maxlength="1000" required></textarea></label><p role="alert"></p><button type="button" data-close>Cancel</button><button type="submit">Submit review</button></form>';
        document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};
        dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
            try {await api(`/api/maintenance/workflow/tickets/${id}/rating`,{method:'POST',body:JSON.stringify({rating:Number(form.rating.value),review:form.review.value,tags:[]})});dialog.close();dialog.remove();await load();}
            catch(error){dialog.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
        };
    }
    load();setInterval(()=>{if(!document.hidden)load();},10000);
})();
