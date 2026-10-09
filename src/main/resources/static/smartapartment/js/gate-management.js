(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "admin" || document.body?.dataset.platform !== "smartsociety") return;

    async function api(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        if (response.redirected || response.status === 401 || response.status === 403) throw new Error("Sign in with your society admin account to manage gates.");
        if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("Gate management could not load. Please reload and try again.");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || payload.detail || "Gate management request failed");
        return payload;
    }
    const notify = message => typeof window.showToast === "function" ? window.showToast(message) : window.alert(message);

    function mount() {
        if (document.getElementById("gateManagementPanel")) return;
        const host = document.querySelector('[data-view="overview"]') || document.querySelector('.main-content');
        if (!host) return;
        const panel = document.createElement("section");
        panel.id = "gateManagementPanel";
        panel.className = "card border shadow-sm rounded-4 mb-4 bg-white";
        panel.innerHTML = `

            <div class="card-header bg-white border-bottom py-3 px-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-3" style="width: 38px; height: 38px;">
                        <i class="fa-solid fa-torii-gate fs-5"></i>
                    </div>
                    <div>
                        <h5 class="fw-bold mb-0 text-dark">Gate Management</h5>
                        <p class="text-muted small mb-0">View gates and their guards, with contact and shift details.</p>
                    </div>
                </div>
                <button class="btn btn-primary rounded-pill btn-sm px-3" type="button" data-gate-new>
                    <i class="fa-solid fa-plus me-1"></i> Add Gate
                </button>
            </div>
            <div class="card-body px-4 py-3">
                <form id="gateEditor" class="row g-3 bg-light border rounded-3 p-3 mb-4 d-none">
                    <input type="hidden" name="id">
                    <div class="col-md-2"><label class="form-label small fw-semibold text-secondary mb-1">Gate number</label><input class="form-control form-control-sm" name="gateNumber" placeholder="Gate 1" required style="min-height: 38px;"></div>
                    <div class="col-md-3"><label class="form-label small fw-semibold text-secondary mb-1">Gate name</label><input class="form-control form-control-sm" name="gateName" placeholder="Main Entrance" required style="min-height: 38px;"></div>
                    <div class="col-md-2"><label class="form-label small fw-semibold text-secondary mb-1">Type</label><select class="form-select form-select-sm" name="gateType" style="min-height: 38px;"><option>ENTRY</option><option>EXIT</option><option selected>BOTH</option></select></div>
                    <div class="col-md-3"><label class="form-label small fw-semibold text-secondary mb-1">Location</label><input class="form-control form-control-sm" name="location" placeholder="North side / Tower A" style="min-height: 38px;"></div>
                    <div class="col-md-2"><label class="form-label small fw-semibold text-secondary mb-1">Status</label><select class="form-select form-select-sm" name="status" style="min-height: 38px;"><option>ACTIVE</option><option>INACTIVE</option></select></div>
                    <div class="col-12 d-flex justify-content-end gap-2 pt-2"><button class="btn btn-light btn-sm rounded-pill px-3" type="button" data-gate-cancel>Cancel</button><button class="btn btn-primary btn-sm rounded-pill px-3" type="submit">Save Gate</button></div>
                </form>
                <div class="table-responsive mb-4"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th class="ps-3">Gate</th><th>Type</th><th>Location</th><th>Status</th><th class="text-end pe-3">Actions</th></tr></thead><tbody id="gateRows"><tr><td colspan="5" class="text-center text-muted py-4">Loading gates…</td></tr></tbody></table></div>
                <section class="border-top pt-3"><h5 class="fw-bold">Guards at each gate</h5><p class="text-muted small">Gate sign-in shows the guard's active security-console session. Assigned guards are listed separately when they have not signed in.</p><p id="gateAssignmentStatus" role="status" aria-live="polite"></p><div id="gateGuardCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px"><p>Loading guard information…</p></div></section>            </div>`;
        const snapshotCard = host.querySelector('.card:not(#gateManagementPanel)');
        if (snapshotCard && snapshotCard.parentElement === host) {
            snapshotCard.after(panel);
        } else {
            host.appendChild(panel);
        }
    }

    let gateCache = [];
    let deployments = [];
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function renderGuardCards() {
        deployments = await api('/api/society/gate-guards');
        const root = document.getElementById('gateGuardCards');
        if (!root) return;
        root.innerHTML = deployments.map(gate => `<article style="background:#f8fafc;border:1px solid #dbe3ef;border-radius:16px;padding:20px"><h6 class="fw-bold mb-2">${escape(gate.gateNumber)} · ${escape(gate.gateName)}</h6><p class="small text-muted">${escape(gate.location || 'Location not recorded')} · ${escape(gate.status)}</p>${gate.guards.map(guard => `<div style="padding:16px 0;border-top:1px solid #dbe3ef"><strong>${escape(guard.name)}</strong><p class="small my-2" style="color:${guard.signedInAt ? '#047857' : '#64748b'}">${escape(guard.presence)}</p><p class="small text-muted">${guard.shiftStart && guard.shiftEnd ? `${escape(guard.shiftStart)} – ${escape(guard.shiftEnd)}` : 'Shift times not recorded'}</p><button class="btn btn-primary btn-sm" style="min-height:40px" type="button" data-guard-details="${guard.id}" data-guard-gate="${gate.id}">Details</button></div>`).join('') || '<p class="text-muted mb-0">No guard assigned or signed in at this gate.</p>'}</article>`).join('') || '<p>No gates configured.</p>';
        assignmentStatus('');
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-guard-details]'); if (!button) return;
        const gate = deployments.find(g => String(g.id) === button.dataset.guardGate);
        const guard = gate?.guards.find(g => String(g.id) === button.dataset.guardDetails); if (!guard) return;
        document.getElementById('guardDetailsDialog')?.remove();
        const dialog = document.createElement('dialog'); dialog.id = 'guardDetailsDialog';
        dialog.style.cssText = 'width:min(680px,94vw);max-height:85vh;overflow:auto;border:1px solid #dbe3ef;border-radius:20px;padding:24px;color:#172033;background:white;';
        const fields = [['Full name',guard.name],['Phone number',guard.phone],['Email',guard.email],['Employee ID',guard.employeeId],['Designation',guard.designation],['Account status',guard.accountStatus],['Joining date',guard.joiningDate],['Gate',`${gate.gateNumber} · ${gate.gateName}`],['Gate location',gate.location],['Presence',guard.presence],['Gate sign-in time',guard.signedInAt ? new Date(guard.signedInAt).toLocaleString('en-IN') : null],['Shift start',guard.shiftStart],['Shift end',guard.shiftEnd],['Work shift',guard.workShift],['Address',guard.address],['Emergency contact',guard.emergencyContactName],['Emergency phone',guard.emergencyContactPhone],['Notes',guard.notes]];
        dialog.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px"><h3 style="margin:0">Guard details</h3><button type="button" class="btn btn-outline-secondary" aria-label="Close guard details">×</button></div><dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">${fields.map(([label,value]) => `<div style="overflow-wrap:anywhere"><dt style="font-size:13px;color:#64748b;margin-bottom:6px">${escape(label)}</dt><dd style="margin:0">${escape(value || 'Not recorded')}</dd></div>`).join('')}</dl>`;
        document.body.appendChild(dialog); dialog.querySelector('button').onclick = () => dialog.close(); dialog.showModal();
    });
    setInterval(() => { if (!document.hidden && ['', '#overview'].includes(location.hash) && document.getElementById('gateGuardCards')) renderGuardCards().catch(error => assignmentStatus(error.message,true)); }, 15000);

    function assignmentStatus(message, error = false) {
        const status = document.getElementById("gateAssignmentStatus");
        if (status) { status.textContent = message; status.className = error ? "text-danger" : "text-success"; }
    }
    async function refresh() {
        const gates = await api("/api/society/gates");
        gateCache = Array.isArray(gates) ? gates : [];
        const rows = document.getElementById("gateRows");
        rows.replaceChildren(...gateCache.map(gate => {
            const row = document.createElement("tr");
            row.innerHTML = `<td><strong></strong><div class="small text-muted"></div></td><td></td><td></td><td></td><td><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" type="button" data-gate-edit>Edit</button><button class="btn btn-sm btn-outline-danger" type="button" data-gate-delete>Deactivate</button></div></td>`;
            row.querySelector("strong").textContent = gate.gateNumber || gate.value;
            row.querySelector("td div.small").textContent = gate.gateName || "";
            row.children[1].textContent = gate.gateType || "BOTH";
            row.children[2].textContent = gate.location || "—";
            row.children[3].textContent = gate.status || "ACTIVE";
            row.querySelector("[data-gate-edit]").dataset.id = gate.id;
            row.querySelector("[data-gate-delete]").dataset.id = gate.id;
            return row;
        }));
        if (!gateCache.length) rows.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No gates configured.</td></tr>';
        await renderGuardCards();
    }

    function openEditor(gate = null) {
        const form = document.getElementById("gateEditor");
        form.reset(); form.classList.remove("d-none");
        if (gate) Object.entries(gate).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; });
    }

    document.addEventListener("click", async event => {
        const add = event.target.closest("[data-gate-new]");
        const cancel = event.target.closest("[data-gate-cancel]");
        const edit = event.target.closest("[data-gate-edit]");
        const del = event.target.closest("[data-gate-delete]");
        if (add) openEditor();
        if (cancel) document.getElementById("gateEditor")?.classList.add("d-none");
        if (edit) openEditor(gateCache.find(g => String(g.id) === edit.dataset.id));
        if (del && confirm("Deactivate this gate? New entries will no longer be allowed through it.")) {
            try { await api(`/api/society/gates/${del.dataset.id}`, {method: "DELETE"}); await refresh(); notify("Gate deactivated."); } catch (error) { notify(error.message); }
        }
    });

    document.addEventListener("submit", async event => {
        if (event.target?.id === "gateEditor") {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.target));
            const id = data.id; delete data.id;
            try { await api(id ? `/api/society/gates/${id}` : "/api/society/gates", {method: id ? "PUT" : "POST", body: JSON.stringify(data)}); event.target.classList.add("d-none"); await refresh(); notify("Gate saved."); } catch (error) { notify(error.message); }
        }
    });

    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { assignmentStatus(error.message, true); } });
})();
