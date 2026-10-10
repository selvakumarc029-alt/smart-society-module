(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "resident") return;
    let saving = false;
    const notify = message => typeof window.showToast === "function" ? window.showToast(message) : window.alert(message);
    async function api(path, options = {}) {
        const response = await fetch(path, {credentials:'same-origin', cache:'no-store', ...options, headers: {Accept: "application/json", ...options.headers}});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || response.redirected) throw new Error(payload.detail || payload.message || "Sign in as the resident to review visitor approvals");
        return payload;
    }
    function mount() {
        if (document.getElementById("residentGateApprovals")) return;
        const host = document.querySelector('[data-view="pass"]') || document.querySelector('[data-view="overview"]');
        if (!host) return;
        const panel = document.createElement("div");
        panel.id = "residentGateApprovals";
        panel.className = "resident-gate-panel mb-4";
        panel.style.display = "none"; // Hidden by default, only shown if pending requests exist
        panel.innerHTML = `<div class="card-header bg-transparent border-0 pt-4 px-4 d-flex align-items-center justify-content-between"><div><h4 class="fw-bold mb-1"><i class="fa-solid fa-bell text-warning me-2 animate__animated animate__swing animate__infinite"></i>Gate Approval Requests</h4><p class="text-muted mb-0 small">Visitors currently waiting at security gate for resident approval.</p></div><span class="badge bg-warning text-dark rounded-pill px-3 py-1 fw-bold" id="gatePendingBadge">1 Waiting</span></div><div class="card-body px-4 pb-4"><div id="residentGateApprovalRows" class="d-grid gap-3"></div></div>`;
        host.prepend(panel);
        const style = document.createElement('style');
        style.textContent = '#residentGateApprovals{background:#fff!important;border:1px solid #dce5f3!important;border-radius:22px!important;padding:24px!important;box-shadow:0 8px 24px #1930580a!important}#residentGateApprovalRows{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px!important;margin-top:24px}.resident-gate-request{background:#f8faff!important;border:1px solid #dce5f3!important;border-radius:18px!important;padding:24px!important;display:flex;flex-direction:column;gap:20px;min-width:0;overflow-wrap:anywhere}.resident-gate-request strong{font-size:20px!important;margin-bottom:10px}.resident-gate-request .gate-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px;margin-top:auto}.resident-gate-request button{min-height:44px;border-radius:12px!important}.gate-decision-feedback{grid-column:1/-1;color:#275138;padding:14px;background:#edf9f2;border-radius:12px}@media(max-width:600px){#residentGateApprovals{padding:16px!important}#residentGateApprovals>.card-header{padding:0!important;flex-wrap:wrap;gap:12px}#residentGateApprovals>.card-body{padding:0!important}}';
        panel.appendChild(style);
    }
    async function refresh() {
        const panel = document.getElementById("residentGateApprovals");
        if (saving) return;
        let entries;
        try { entries = await api("/api/society/gate-entries"); }
        catch(error) { if(panel) {panel.style.display='block'; document.getElementById('residentGateApprovalRows').textContent=error.message;} return; }
        const pending = Array.isArray(entries) ? entries.filter(e => String(e.approvalStatus).toUpperCase() === "PENDING" || String(e.status).toUpperCase() === "PENDING_APPROVAL") : [];
        if (!panel) return;
        if (!pending.length) {
            panel.style.display = "none";
            return;
        }
        panel.style.display = "block";
        const badge = document.getElementById("gatePendingBadge");
        if (badge) badge.textContent = `${pending.length} Waiting`;
        const rows = document.getElementById("residentGateApprovalRows");
        if (!rows) return;
        rows.replaceChildren(...pending.map(entry => {
            const card = document.createElement("div");
            card.className = "resident-gate-request";
            card.innerHTML = `<div><strong class="d-block text-dark fs-6"></strong><span class="small text-muted"></span><div class="small mt-1 text-secondary"></div></div><div class="d-flex gap-2"><button class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-semibold" data-reject><i class="fa-solid fa-xmark me-1"></i>Reject</button><button class="btn btn-success btn-sm rounded-pill px-3 fw-semibold shadow-sm" data-approve><i class="fa-solid fa-check me-1"></i>Approve Entry</button></div>`;
            card.querySelector("strong").textContent = entry.visitorName || entry.name || "Visitor";
            card.querySelector("span").textContent = `${entry.visitorCategory || "Guest"} · ${entry.entryGateNumber || "Main Gate"}`;
            card.querySelector("div.small.mt-1").textContent = entry.purpose || "Resident Visit";
            card.querySelector("[data-reject]").dataset.id = entry.id;
            card.querySelector("[data-approve]").dataset.id = entry.id;
            card.querySelector('[data-reject]').parentElement.classList.add('gate-actions');
            return card;
        }));
    }
    document.addEventListener("click", async event => {
        const approve = event.target.closest("[data-approve]");
        const reject = event.target.closest("[data-reject]");
        if (!approve && !reject) return;
        const button = approve || reject;
        const card = button.closest('.resident-gate-request');
        if (!card || saving) return;
        saving = true;
        card.querySelectorAll('button').forEach(b => b.disabled=true);
        try {
            await api(`/api/society/gate-entries/${button.dataset.id}/${approve ? "approve" : "reject"}`, {method: "PATCH"});
            const feedback = document.createElement('p'); feedback.className='gate-decision-feedback'; feedback.setAttribute('role','status');
            feedback.textContent=approve ? 'Approved. Security will see your approval and can check this visitor in.' : 'Rejected. Security will see the rejection. This visitor cannot check in.';
            card.querySelector('.gate-actions').replaceChildren(feedback);
            notify(feedback.textContent);
        } catch (error) { notify(error.message); card.querySelectorAll('button').forEach(b => b.disabled=false); }
        finally { saving=false; }
    });
    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { notify(error.message); } });
    setInterval(() => {if(!document.hidden&&!saving)refresh();},10000);
})();
