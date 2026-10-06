(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "admin") return;

    async function api(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
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
                        <p class="text-muted small mb-0">Create apartment gates and assign security guards without hardcoded gate numbers.</p>
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
                <div class="border-top pt-3">
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <div class="d-inline-flex align-items-center justify-content-center bg-info bg-opacity-10 text-info rounded-3" style="width: 28px; height: 28px;">
                            <i class="fa-solid fa-shield-halved small"></i>
                        </div>
                        <h6 class="fw-bold mb-0 text-dark fs-6">Assign Guard to Gate</h6>
                    </div>
                    <form id="gateAssignmentForm" class="row g-3 align-items-end">
                        <div class="col-xl-3 col-md-3 col-sm-6">
                            <label class="form-label small fw-semibold text-secondary mb-1">Security guard <span class="text-danger">*</span></label>
                            <select class="form-select form-select-sm" name="securityId" required style="min-height: 38px;"></select>
                        </div>
                        <div class="col-xl-3 col-md-3 col-sm-6">
                            <label class="form-label small fw-semibold text-secondary mb-1">Gate <span class="text-danger">*</span></label>
                            <select class="form-select form-select-sm" name="gateId" required style="min-height: 38px;"></select>
                        </div>
                        <div class="col-xl-2 col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold text-secondary mb-1">Shift start</label>
                            <input class="form-control form-control-sm" type="time" name="shiftStart" style="min-height: 38px;">
                        </div>
                        <div class="col-xl-2 col-md-2 col-sm-6">
                            <label class="form-label small fw-semibold text-secondary mb-1">Shift end</label>
                            <input class="form-control form-control-sm" type="time" name="shiftEnd" style="min-height: 38px;">
                        </div>
                        <div class="col-xl-2 col-md-2 col-sm-12">
                            <button class="btn btn-primary btn-sm rounded-pill w-100 fw-semibold" type="submit" style="min-height: 38px;">
                                <i class="fa-solid fa-user-check me-1"></i> Assign
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;
        const snapshotCard = host.querySelector('.card:not(#gateManagementPanel)');
        if (snapshotCard && snapshotCard.parentElement === host) {
            snapshotCard.after(panel);
        } else {
            host.appendChild(panel);
        }
    }

    let gateCache = [];
    async function refresh() {
        const [gates, team] = await Promise.all([api("/api/society/gates"), api("/api/society/team-users")]);
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
        const gateSelect = document.querySelector('#gateAssignmentForm [name="gateId"]');
        gateSelect.replaceChildren(...gateCache.filter(g => g.status === "ACTIVE").map(g => Object.assign(document.createElement("option"), {value: g.id, textContent: g.label || `${g.gateNumber} · ${g.gateName}`})));
        const guards = Array.isArray(team) ? team.filter(u => u.role === "SECURITY_STAFF") : [];
        const guardSelect = document.querySelector('#gateAssignmentForm [name="securityId"]');
        guardSelect.replaceChildren(...guards.map(g => Object.assign(document.createElement("option"), {value: g.id, textContent: g.name})));
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
        if (event.target?.id === "gateAssignmentForm") {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.target));
            const securityId = data.securityId; delete data.securityId;
            if (!data.shiftStart) delete data.shiftStart; if (!data.shiftEnd) delete data.shiftEnd;
            data.gateId = Number(data.gateId);
            try { await api(`/api/society/security/${securityId}/gates`, {method: "POST", body: JSON.stringify(data)}); notify("Guard assigned to gate."); } catch (error) { notify(error.message); }
        }
    });

    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { notify(error.message); } });
})();
