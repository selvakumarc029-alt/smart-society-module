(() => {
    if (document.body.dataset.platform !== 'smartsociety' || document.body.dataset.dashboardRole !== 'admin') return;
    let busy = false;
    const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    async function load() {
        const rows = document.getElementById('adminGateEntriesRows');
        if (!rows || busy) return;
        busy = true;
        const status = document.getElementById('adminGateEntriesStatus');
        const button = document.getElementById('adminGateEntriesRefresh');
        button.disabled = true;
        try {
            const response = await fetch('/api/society/gate-entries', {headers:{Accept:'application/json'}});
            if (response.redirected || response.status === 401 || response.status === 403) throw Error('Sign in as society admin to view gate entries.');
            if (!(response.headers.get('content-type') || '').includes('application/json')) throw Error('Gate entries could not be loaded. Please retry.');
            const data = await response.json();
            if (!response.ok) throw Error(data.message || 'Gate entries could not be loaded.');
            if (!Array.isArray(data)) throw Error('Unexpected gate entry response.');
            rows.replaceChildren();
            data.sort((a,b) => Date.parse(b.entryTime || 0) - Date.parse(a.entryTime || 0)).forEach(entry => {
                const row = document.createElement('tr');
                [entry.visitorName || entry.name, entry.unitNo, entry.purpose, entry.entryGateNumber, date(entry.entryTime), entry.exitGateNumber, date(entry.exitTime), (entry.status || '').replaceAll('_',' ')].forEach(value => {
                    const cell = document.createElement('td'); cell.textContent = value || '—'; cell.style.padding = '16px'; row.appendChild(cell);
                });
                rows.appendChild(row);
            });
            if (!data.length) { const row = rows.insertRow(); const cell = row.insertCell(); cell.colSpan = 8; cell.textContent = 'No gate entries recorded for this society yet.'; }
            status.textContent = `${data.length} records · Updated ${new Date().toLocaleTimeString('en-IN')}`;
            status.className = 'text-muted';
        } catch (error) { status.textContent = error.message; status.className = 'text-danger'; }
        finally { busy = false; button.disabled = false; }
    }
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('adminGateEntriesRefresh')?.addEventListener('click',load);
        if (location.hash === '#gate-entries') load();
        setInterval(() => { if (!document.hidden && location.hash === '#gate-entries') load(); },15000);
    });
    document.addEventListener('society:panelchange', event => {if (event.detail.panel === 'gate-entries') load();});
})();
