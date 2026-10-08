(() => {
    "use strict";
    if (!["smartapartment", "smartsociety"].includes(document.body?.dataset.platform)
        || document.body.dataset.dashboardRole !== "maintenance-worker") return;
    const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
    const endpoint = "/api/society/service-tickets";
    let loading = false;
    let saving = false;
    let tickets = [];
    const message = (text, failed = false) => {
        const element = document.getElementById("workerServiceTicketMessage");
        if (element) { element.textContent = text; element.className = failed ? "small text-danger" : "small text-success"; }
    };
    async function api(path = "", options = {}) {
        const response = await fetch(endpoint + path, {credentials: "same-origin", ...options,
            headers: {Accept: "application/json", "Content-Type": "application/json"}});
        const data = await response.json().catch(() => null);
        if (response.redirected || !response.ok || !data) throw Error(data?.detail || data?.message || "Unable to save or load service tickets. Sign in again if needed.");
        return data;
    }
    function render() {
        const container = document.getElementById("workerServiceTickets");
        if (!container) return;
        container.innerHTML = tickets.length ? tickets.map(ticket => {
            const status = ticket.ticketStatus === "REQUESTED" ? "PENDING" : ticket.ticketStatus;
            const closed = ["CANCELLED", "CLOSED", "INVOICED"].includes(status);
            return `<article class="border rounded-3 p-3 bg-white">
                <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
                    <div><strong>${escape(ticket.ticketCode || '#' + ticket.id)} · ${escape(ticket.title || ticket.serviceType)}</strong>
                    <div class="small text-muted">${escape(ticket.requesterName)} · ${escape(ticket.serviceAddress)}</div></div>
                    <span class="badge bg-primary">${escape(status?.replaceAll('_', ' '))}</span>
                </div><p class="small">${escape(ticket.description)}</p>
                ${closed ? '<span class="small text-muted">This ticket is closed.</span>' : `<div class="d-flex align-items-center flex-wrap gap-2" role="group" aria-label="Service ticket status">
                    <span class="small text-muted">Quick status update:</span>
                    ${["PENDING", "IN_PROGRESS", "RESOLVED"].map(value => `<button type="button" class="btn btn-sm btn-outline-${value === 'RESOLVED' ? 'success' : value === 'PENDING' ? 'warning' : 'primary'} ${value === status ? 'active' : ''}" data-service-ticket="${ticket.id}" data-service-status="${value}" aria-pressed="${value === status}" ${saving || value === status ? 'disabled' : ''}>${value === 'IN_PROGRESS' ? 'In Progress' : value === 'PENDING' ? 'Pending' : 'Resolved'}</button>`).join('')}
                </div>`}</article>`;
        }).join('') : '<p class="small text-muted">No home service tickets are assigned to you.</p>';
    }
    async function load() {
        if (loading || saving) return;
        loading = true;
        try { const data = await api(); if (!Array.isArray(data)) throw Error("Unexpected ticket response"); tickets = data; render(); }
        catch (error) { message(error.message, true); }
        finally { loading = false; }
    }
    document.addEventListener("click", async event => {
        if (event.target.closest('[data-service-tickets-refresh]')) { message(""); await load(); return; }
        const button = event.target.closest('[data-service-ticket][data-service-status]');
        if (!button || button.disabled || saving || loading) return;
        const ticket = tickets.find(item => String(item.id) === button.dataset.serviceTicket);
        if (!ticket) return;
        saving = true;
        render();
        try {
            const saved = await api(`/${ticket.id}/status`, {method: "PATCH", body: JSON.stringify({ticketStatus: button.dataset.serviceStatus, version: ticket.version})});
            tickets = tickets.map(item => item.id === saved.id ? saved : item);
            message("Status saved. The resident’s service tickets will refresh within 10 seconds.");
        } catch (error) { message(error.message, true); }
        finally { saving = false; render(); }
    });
    document.addEventListener("DOMContentLoaded", () => { load(); setInterval(() => { if (!document.hidden) load(); }, 10000); });
})();
