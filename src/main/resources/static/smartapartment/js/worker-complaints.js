(() => {
    'use strict';
    if (document.body?.dataset.dashboardRole !== 'maintenance-worker') return;
    const endpoint = '/api/society/complaints';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    let saving = false, loading = false;
    const message = (text, failed = false) => {
        const node = document.getElementById('workerComplaintsMessage');
        if (node) { node.textContent = text; node.className = `small text-${failed ? 'danger' : 'success'}`; }
    };
    async function api(path = '', options = {}) {
        const response = await fetch(endpoint + path, {credentials:'same-origin', ...options, headers:{'Content-Type':'application/json',Accept:'application/json'}});
        const data = await response.json().catch(() => null);
        if (!response.ok || response.redirected || !data) throw Error(data?.detail || data?.message || 'Unable to load or save complaints. Check your society session.');
        return data;
    }
    async function load() {
        const container = document.getElementById('workerComplaints');
        if (!container || loading || saving) return;
        loading = true;
        try {
            const items = await api();
            if (!Array.isArray(items)) throw Error('Unexpected complaint response');
            container.innerHTML = items.length ? items.map(item => {
                const closed = ['RESOLVED','CLOSED'].includes(item.status);
                return `<article class="border rounded-3 p-3 bg-white"><div class="d-flex justify-content-between gap-2 flex-wrap"><strong>#T-${esc(item.id)} · ${esc(item.title)}</strong><span class="badge bg-primary">${esc(item.status?.replaceAll('_',' '))}</span></div><p class="small text-muted mt-2">${esc(item.unitNo)} · ${esc(item.description)}</p><p class="small">${esc(item.resolutionNotes)}</p>${closed ? '<span class="small text-muted">Saved resolution</span>' : `<form data-worker-complaint="${esc(item.id)}"><label class="form-label small">Progress / repair notes</label><textarea name="notes" class="form-control mb-2" required maxlength="255">${esc(item.resolutionNotes)}</textarea><div class="d-flex gap-2"><button type="submit" name="status" value="IN_PROGRESS" class="btn btn-sm btn-primary">Save In Progress</button><button type="submit" name="status" value="RESOLVED" class="btn btn-sm btn-success">Save Resolved</button></div></form>`}</article>`;
            }).join('') : '<p class="text-muted small">No complaints are assigned to the maintenance team.</p>';
        } catch (error) { message(error.message, true); }
        finally { loading = false; }
    }
    document.addEventListener('submit', async event => {
        const form = event.target.closest('[data-worker-complaint]');
        if (!form) return;
        event.preventDefault();
        if (saving) return;
        const status = event.submitter?.value;
        if (!['IN_PROGRESS','RESOLVED'].includes(status)) return;
        saving = true;
        form.querySelectorAll('button').forEach(button => button.disabled = true);
        try {
            await api('/' + form.dataset.workerComplaint, {method:'PATCH', body:JSON.stringify({status,resolutionNotes:form.elements.notes.value})});
            message('Saved. The resident complaint view refreshes within 15 seconds.');
        } catch (error) { message(error.message, true); }
        finally { saving = false; form.querySelectorAll('button').forEach(button => button.disabled = false); await load(); }
    });
    document.addEventListener('click', event => {if (event.target.closest('[data-worker-complaints-refresh]')) load();});
    function start() {load(); setInterval(() => {if (!document.hidden) load();},15000);}
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
