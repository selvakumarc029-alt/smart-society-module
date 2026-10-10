(() => {
    'use strict';
    const dialog = document.getElementById('maintenanceWorkerRegistration');
    const form = document.getElementById('maintenanceWorkerRegistrationForm');
    const message = document.getElementById('workerRegistrationMessage');
    const password = document.getElementById('newWorkerPassword');
    const submit = document.getElementById('createWorkerAccountButton');
    document.getElementById('addMaintenanceWorkerButton').addEventListener('click', () => {
        form.reset(); password.type = 'password'; message.textContent = ''; dialog.showModal();
    });
    document.getElementById('closeWorkerRegistration').addEventListener('click', () => dialog.close());
    document.getElementById('showNewWorkerPassword').addEventListener('change', event => {
        password.type = event.target.checked ? 'text' : 'password';
    });
    dialog.addEventListener('close', () => {password.value = ''; password.type = 'password';});
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (submit.disabled || !form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form));
        const payload = {...values, name: values.name.trim(), email: values.email.trim().toLowerCase(), role: 'MAINTENANCE_STAFF'};
        submit.disabled = true; submit.textContent = 'Creating…'; message.textContent = '';
        try {
            const response = await fetch('/api/society/team-users', {
                method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || response.redirected) throw new Error(result.detail || result.message || result.error || 'Could not create account. Sign in with your maintenance administrator account and retry.');
            password.value = ''; password.type = 'password';
            message.className = 'col-12 text-success';
            message.textContent = `Account created for ${result.name || payload.name}. Sign in from the SmartSociety login using ${payload.email} and the password you set. The worker will open their own maintenance dashboard.`;
            form.reset();
            if (typeof window.loadMaintenanceWorkersAttendance === 'function') await window.loadMaintenanceWorkersAttendance();
        } catch (error) { message.className = 'col-12 text-danger'; message.textContent = error.message; }
        finally { submit.disabled = false; submit.textContent = 'Create worker account'; }
    });
})();
