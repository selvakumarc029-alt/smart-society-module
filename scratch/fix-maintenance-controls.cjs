const fs=require('fs');let p='src/main/resources/static/smartapartment/js/worker-attendance-module.js',s=fs.readFileSync(p,'utf8');const mark='    async function workerStartTravel(taskId) {';if(!s.includes(mark))throw new Error('Travel handler missing');s=s.replace(mark,`    const pendingRejections = new Set();
    async function rejectWorkerTask(taskId) {
        if (pendingRejections.has(taskId)) return;
        const reason = prompt("Why are you rejecting this assignment?");
        if (reason === null) return;
        if (!reason.trim()) { showToast("A rejection reason is required.", "warning"); return; }
        pendingRejections.add(taskId);
        try {
            const res = await fetch("/api/v1/auto-assignment/requests/" + taskId + "/reject", {
                method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() })
            });
            if (res.redirected || !res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.message || "Unable to reject this assignment. Please sign in again if your session expired.");
            }
            showToast("Assignment rejected. The existing reassignment workflow will find another worker.", "success");
            await loadWorkerDashboardSummary();
            if (window.loadAdminResidentRequests) await window.loadAdminResidentRequests();
        } catch (error) { showToast(error.message, "danger"); }
        finally { pendingRejections.delete(taskId); }
    }

`+mark);fs.writeFileSync(p,s);
p='src/main/resources/static/smartapartment/js/maintenance-manager-dashboard.js';s=fs.readFileSync(p,'utf8').replace('    function attachActionListeners() {','    const boundActionButtons = new WeakSet();\n    function attachActionListeners() {').replace("        document.querySelectorAll('.mgr-action').forEach(el => {","        document.querySelectorAll('.mgr-action').forEach(el => {\n            if (boundActionButtons.has(el)) return;\n            boundActionButtons.add(el);");s=s.replace('            await executeSimpleAction(endpoint, payload, \'Worker assigned successfully\');','            return executeSimpleAction(endpoint, payload, \'Worker assigned successfully\');').replace("            await executeSimpleAction(`/api/maintenance/manager/\${reqId}/priority`, { priority, reason }, 'Priority updated');","            return executeSimpleAction(`/api/maintenance/manager/\${reqId}/priority`, { priority, reason }, 'Priority updated');").replace("            await executeSimpleAction(`/api/maintenance/manager/\${reqId}/eta`, { additionalMinutes, reason }, 'ETA updated');","            return executeSimpleAction(`/api/maintenance/manager/\${reqId}/eta`, { additionalMinutes, reason }, 'ETA updated');");
const a=s.indexOf("        document.getElementById('mgr-modal-submit').addEventListener");const b=s.indexOf('    function showManagerToast',a);if(a<0||b<0)throw new Error('Action block missing');s=s.slice(0,a)+`        const submit = document.getElementById('mgr-modal-submit');
        const error = document.createElement('p'); error.className = 'text-danger small mt-2'; error.setAttribute('role', 'alert');
        modalEl.querySelector('.modal-body').appendChild(error);
        submit.addEventListener('click', async () => {
            if (submit.disabled) return;
            submit.disabled = true; error.textContent = '';
            try { if (await onSubmit() !== false) modal.hide(); else error.textContent = 'The action was not saved. Check the error notification and try again.'; }
            catch (failure) { error.textContent = failure.message; }
            finally { submit.disabled = false; }
        });
    }

    async function executeSimpleAction(url, body, successMsg) {
        try {
            const resp = await fetch(url, {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            if (resp.redirected || !resp.ok) {
                const error = await resp.json().catch(() => ({}));
                throw new Error(error.message || error.error || 'The action could not be saved. Refresh or sign in again.');
            }
            showManagerToast('SUCCESS', successMsg);
            loadDashboardSummary();
            return true;
        } catch (error) {
            showManagerToast('Action failed', error.message);
            return false;
        }
    }

`+s.slice(b);fs.writeFileSync(p,s);
for(const name of ['maintenance','maintenance-worker']){p='src/main/resources/templates/dashboards/'+name+'.html';s=fs.readFileSync(p,'utf8').replaceAll('worker-attendance-module.js?v=20260919-v1','worker-attendance-module.js?v=20261008-task-buttons-v2').replaceAll('maintenance-manager-dashboard.js?v=20260919-v1','maintenance-manager-dashboard.js?v=20261008-action-buttons-v2');fs.writeFileSync(p,s);}
