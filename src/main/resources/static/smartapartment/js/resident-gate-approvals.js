(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "resident") return;
    const notify = message => typeof window.showToast === "function" ? window.showToast(message) : window.alert(message);
    async function api(path, options = {}) {
        const response = await fetch(path, {...options, headers: {Accept: "application/json", ...options.headers}});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to update visitor approval");
        return payload;
    }
    function mount() {
        if (document.getElementById("residentGateApprovals")) return;
        const host = document.querySelector('[data-view="pass"]') || document.querySelector('[data-view="overview"]');
        if (!host) return;
        const panel = document.createElement("div");
        panel.id = "residentGateApprovals";
        panel.className = "card border-0 shadow-sm rounded-4 mb-4";
        panel.style.display = "none"; // Hidden by default, only shown if pending requests exist
        panel.innerHTML = `<div class="card-header bg-transparent border-0 pt-4 px-4 d-flex align-items-center justify-content-between"><div><h4 class="fw-bold mb-1"><i class="fa-solid fa-bell text-warning me-2 animate__animated animate__swing animate__infinite"></i>Gate Approval Requests</h4><p class="text-muted mb-0 small">Visitors currently waiting at security gate for resident approval.</p></div><span class="badge bg-warning text-dark rounded-pill px-3 py-1 fw-bold" id="gatePendingBadge">1 Waiting</span></div><div class="card-body px-4 pb-4"><div id="residentGateApprovalRows" class="d-grid gap-3"></div></div>`;
        host.prepend(panel);
    }
    async function refresh() {
        const panel = document.getElementById("residentGateApprovals");
        const entries = await api("/api/society/gate-entries").catch(() => []);
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
            card.className = "border border-primary-subtle rounded-4 p-3 d-flex flex-wrap justify-content-between align-items-center gap-3 bg-primary-subtle bg-opacity-25";
            card.innerHTML = `<div><strong class="d-block text-dark fs-6"></strong><span class="small text-muted"></span><div class="small mt-1 text-secondary"></div></div><div class="d-flex gap-2"><button class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-semibold" data-reject><i class="fa-solid fa-xmark me-1"></i>Reject</button><button class="btn btn-success btn-sm rounded-pill px-3 fw-semibold shadow-sm" data-approve><i class="fa-solid fa-check me-1"></i>Approve Entry</button></div>`;
            card.querySelector("strong").textContent = entry.visitorName || entry.name || "Visitor";
            card.querySelector("span").textContent = `${entry.visitorCategory || "Guest"} · ${entry.entryGateNumber || "Main Gate"}`;
            card.querySelector("div.small.mt-1").textContent = entry.purpose || "Resident Visit";
            card.querySelector("[data-reject]").dataset.id = entry.id;
            card.querySelector("[data-approve]").dataset.id = entry.id;
            return card;
        }));
    }
    document.addEventListener("click", async event => {
        const approve = event.target.closest("[data-approve]");
        const reject = event.target.closest("[data-reject]");
        if (!approve && !reject) return;
        const button = approve || reject; button.disabled = true;
        try { await api(`/api/society/gate-entries/${button.dataset.id}/${approve ? "approve" : "reject"}`, {method: "PATCH"}); await refresh(); notify(approve ? "Visitor approved for gate entry." : "Visitor entry rejected."); } catch (error) { notify(error.message); } finally { button.disabled = false; }
    });
    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { notify(error.message); } });
})();
