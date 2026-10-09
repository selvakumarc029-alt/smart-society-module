(() => {
    if (document.body.dataset.dashboardRole !== 'superadmin') return;
    const endpoint = '/api/superadmin/subscription-lifecycle';
    const date = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN') : 'Not recorded';
    async function request(path = '', options = {}) {
        const headers = {Accept: 'application/json', 'Content-Type': 'application/json'};
        const response = await fetch(endpoint + path, {...options, headers});
        if (response.redirected || response.status === 401 || response.status === 403) throw new Error('Your session is not authenticated as superadmin. Sign out and sign in as superadmin to load plan details.');
        if (!response.ok) throw new Error(`Plan details could not be loaded (HTTP ${response.status}). Try Refresh or contact platform support.`);
        return response.json();
    }
    function setup() {
        const panel = document.querySelector('[data-view="subscriptions"]');
        if (!panel) return;
        const card = document.createElement('section');
        card.className = 'card p-4 mb-4 border rounded-4';
        card.innerHTML = '<div class="d-flex flex-wrap justify-content-between gap-3"><div><h3>Plan expiry & admin access</h3><p>Alerts appear seven days before the plan end date. Suspension blocks all society admins, including existing sessions.</p></div><button type="button" class="btn btn-outline-primary" data-lifecycle-refresh>Refresh</button></div><p role="status" aria-live="polite" data-lifecycle-status></p><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Society</th><th>Plan</th><th>From date</th><th>End date</th><th>Expiry alert</th><th>Admin access</th><th>Action</th></tr></thead><tbody></tbody></table></div>';
        panel.prepend(card);
        const notice = document.createElement('p');
        notice.className = 'alert alert-warning'; notice.setAttribute('role', 'status'); notice.hidden = true;
        document.querySelector('[data-view="overview"]')?.prepend(notice);
        const status = card.querySelector('[data-lifecycle-status]');
        const tbody = card.querySelector('tbody');
        let loading = false;
        async function load() {
            if (loading) return;
            loading = true;
            try {
                const rows = await request();
                tbody.replaceChildren();
                const alerts = rows.filter(row => ['EXPIRING', 'EXPIRED'].includes(row.expiryState));
                notice.hidden = alerts.length === 0;
                notice.textContent = `${alerts.length} society plan(s) are expiring or expired: ${alerts.map(row => `${row.society} — ${row.expiryState === 'EXPIRED' ? 'expired' : row.daysRemaining + ' days remaining'}`).join('; ')}. Review Subscriptions to manage admin access.`;
                status.textContent = `${alerts.length} expiry alerts. Updated ${new Date().toLocaleTimeString('en-IN')}.`;
                for (const row of rows) {
                    const tr = document.createElement('tr');
                    for (const value of [row.society, row.plan, date(row.startDate), date(row.endDate), row.expiryState === 'EXPIRING' ? `${row.daysRemaining} days remaining` : row.expiryState.replaceAll('_', ' '), row.adminAccessSuspended ? 'Suspended' : 'Enabled']) {
                        const td = document.createElement('td'); td.textContent = value; tr.append(td);
                    }
                    const td = document.createElement('td');
                    const button = document.createElement('button'); button.type = 'button';
                    button.className = `btn btn-sm ${row.adminAccessSuspended ? 'btn-outline-success' : 'btn-outline-danger'}`;
                    button.textContent = row.adminAccessSuspended ? 'Restore admin access' : 'Suspend admin access';
                    button.addEventListener('click', async () => {
                        const suspended = !row.adminAccessSuspended;
                        if (!window.confirm(`${suspended ? 'Suspend' : 'Restore'} admin access for ${row.society}? ${suspended ? 'All society admins will be blocked immediately.' : 'Society admins will be able to access their dashboard again.'}`)) return;
                        button.disabled = true;
                        try { await request(`/${row.id}/admin-access`, {method: 'PUT', body: JSON.stringify({suspended})}); await load(); }
                        catch (error) { status.textContent = error.message; button.disabled = false; }
                    });
                    td.append(button); tr.append(td); tbody.append(tr);
                }
                if (!rows.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 7; td.textContent = 'No societies registered.'; tr.append(td); tbody.append(tr); }
            } catch (error) {
                status.textContent = error.message;
                tbody.replaceChildren();
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 7;
                td.textContent = error.message;
                tr.append(td); tbody.append(tr);
                notice.hidden = true;
            }
            finally { loading = false; }
        }
        card.querySelector('[data-lifecycle-refresh]').addEventListener('click', load);
        load();
        setInterval(() => { if (!document.hidden) load(); }, 60000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
