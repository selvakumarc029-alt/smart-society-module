(function () {
    'use strict';
    if (!['smartapartment', 'smartsociety'].includes(document.body?.dataset.platform)
        || !document.querySelector('[data-view="assets"] [data-action="service-log"]')) return;

    function localDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function validateDates(servicedOn, nextDue, today) {
        const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
            && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
        if (!valid(servicedOn) || !valid(nextDue)) return 'Enter valid service and next-due dates.';
        if (servicedOn > today) return 'The service date cannot be in the future.';
        if (nextDue <= servicedOn || nextDue <= today) return 'The next-due date must be after today and the service date.';
        return '';
    }

    let dialog;
    let activeRow;
    let returnFocus;
    function buildDialog() {
        dialog = document.createElement('dialog');
        dialog.className = 'maintenance-asset-demo-dialog border-0 rounded-4 shadow-lg p-4';
        dialog.setAttribute('aria-labelledby', 'assetDemoTitle');
        dialog.innerHTML = `<form>
            <h4 id="assetDemoTitle" class="mb-2">Log Service</h4>
            <p data-asset-name class="fw-semibold text-break mb-2"></p>
            <p class="small text-muted">Demo only. Changes reset when this page reloads.</p>
            <label class="form-label w-100">Service date<input name="servicedOn" type="date" class="form-control mt-1" required></label>
            <label class="form-label w-100">Next service due<input name="nextDue" type="date" class="form-control mt-1" required></label>
            <p data-error role="alert" class="text-danger small mb-3"></p>
            <div class="d-flex justify-content-end flex-wrap gap-2">
                <button type="button" data-cancel class="btn btn-outline-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save demo service</button>
            </div>
        </form>`;
        document.body.appendChild(dialog);
        dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => { if (event.target === dialog) {
            const box = dialog.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        } });
        dialog.addEventListener('close', () => { returnFocus?.focus(); activeRow = null; });
        dialog.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            const servicedOn = dialog.querySelector('[name="servicedOn"]').value;
            const nextDue = dialog.querySelector('[name="nextDue"]').value;
            const error = validateDates(servicedOn, nextDue, localDate());
            dialog.querySelector('[data-error]').textContent = error;
            if (error || !activeRow) return;
            activeRow.cells[3].textContent = servicedOn;
            activeRow.cells[4].textContent = nextDue;
            activeRow.cells[4].classList.remove('text-danger');
            activeRow.cells[4].classList.add('text-success');
            returnFocus.textContent = 'Log Service';
            returnFocus.title = `Demo service logged on ${servicedOn}. Log another service.`;
            dialog.close();
            window.showToast?.('Demo service updated. Changes reset on page reload.', 'success');
        });
    }

    // Capture only this demo control so the older immediate-update handler cannot also run.
    window.addEventListener('click', event => {
        const button = event.target.closest?.('[data-view="assets"] [data-action="service-log"]');
        if (!button || button.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const row = button.closest('tr');
        if (!row || row.cells.length < 5) return;
        if (!dialog) buildDialog();
        if (dialog.open) return;
        activeRow = row;
        returnFocus = button;
        dialog.querySelector('[data-asset-name]').textContent = row.cells[0].textContent.trim();
        dialog.querySelector('[data-error]').textContent = '';
        const today = localDate();
        const next = new Date(today + 'T12:00:00');
        next.setDate(next.getDate() + 60);
        const serviceInput = dialog.querySelector('[name="servicedOn"]');
        serviceInput.value = today;
        serviceInput.max = today;
        const dueInput = dialog.querySelector('[name="nextDue"]');
        dueInput.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
        dueInput.min = today;
        dialog.showModal();
    }, true);
})();
