/*
 * PropertyDirect dashboard control bridge.
 *
 * Some role dashboards are legacy standalone pages while others use the
 * shared dashboard module. This small bridge owns only the common controls
 * (navigation and the compact sidebar). It never cancels ordinary button
 * clicks, so each page keeps its own form, table, and workflow behaviour.
 */
(function () {
    function safeEscape(value) {
        return window.CSS && typeof CSS.escape === 'function'
            ? CSS.escape(value)
            : String(value || '').replace(/["\\]/g, '\\$&');
    }

    function setPanel(panel) {
        if (!panel) return;
        var selected = document.querySelector('[data-view="' + safeEscape(panel) + '"]');
        if (!selected) return;

        document.querySelectorAll('[data-panel]').forEach(function (button) {
            var active = button.dataset.panel === panel;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        document.querySelectorAll('[data-view]').forEach(function (view) {
            var active = view === selected;
            view.classList.toggle('hidden', !active);
            view.classList.toggle('d-none', !active);
            view.style.display = active ? '' : 'none';
        });

        var title = document.getElementById('panelTitle');
        var navItem = document.querySelector('.sidebar-nav [data-panel="' + safeEscape(panel) + '"]');
        if (title && navItem && !title.textContent.includes('Property Owner Portal')) {
            title.textContent = navItem.textContent.trim();
        }
        if (window.location.hash !== '#' + panel) history.replaceState(null, '', '#' + panel);
        try {
            window.scrollTo({ top: 0, behavior: 'instant' });
            document.querySelectorAll('.dash-main, .owner-main, .main-content, main').forEach(function (m) {
                m.scrollTop = 0;
            });
        } catch (_) {}
    }

    window.PropertyDirectDashboardControls = window.PropertyDirectDashboardControls || {};
    window.PropertyDirectDashboardControls.setPanel = setPanel;

    function closeSidebar() {
        if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
        else document.body.classList.add('sidebar-collapsed');
    }

    function openSidebar() {
        document.body.classList.remove('sidebar-collapsed');
        document.body.classList.add('sidebar-open');
    }

    function showFallbackToast(message) {
        var existing = document.getElementById('pdDashboardControlToast');
        var toast = existing || document.createElement('div');
        toast.id = 'pdDashboardControlToast';
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:999999;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:12px 18px;font:800 13px/1.25 Manrope,Arial,sans-serif;box-shadow:0 16px 34px rgba(15,23,42,.28);';
        if (!existing) document.body.appendChild(toast);
        window.clearTimeout(toast._pdTimer);
        toast._pdTimer = window.setTimeout(function () { toast.remove(); }, 2600);
    }

    function dashboardRole() {
        return document.body.dataset.dashboardRole
            || document.body.dataset.role
            || (document.title || '').toLowerCase().split(' dashboard')[0].trim()
            || 'propertydirect';
    }

    function currentPanel() {
        var active = document.querySelector('.dash-panel:not(.hidden):not(.d-none), [data-view]:not(.hidden):not(.d-none)');
        return active?.dataset?.view || (window.location.hash || '#overview').slice(1) || 'overview';
    }

    function buttonLabel(button) {
        return (button.innerText || button.textContent || button.getAttribute('aria-label') || button.title || button.dataset.action || 'Dashboard action')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function actionContext(button) {
        var row = button.closest('tr');
        var card = button.closest('article, .dash-card, .property-card, .approval-card, .lead-card');
        var rowText = row ? row.innerText.trim().replace(/\s+/g, ' ').slice(0, 260) : '';
        var cardText = card ? card.innerText.trim().replace(/\s+/g, ' ').slice(0, 260) : '';
        return rowText || cardText || buttonLabel(button);
    }

    async function persistDashboardButton(button, action) {
        if (!button || button.dataset.pdPersisting === 'true') return null;
        button.dataset.pdPersisting = 'true';
        try {
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace: 'PropertyDirect',
                    dashboardRole: dashboardRole(),
                    panel: currentPanel(),
                    actionType: action || button.dataset.action || 'button-click',
                    targetLabel: buttonLabel(button),
                    details: {
                        button: buttonLabel(button),
                        context: actionContext(button),
                        href: button.getAttribute('href') || '',
                        id: button.id || '',
                        className: button.className || ''
                    }
                })
            });
            if (!response.ok) throw new Error('Workflow save failed');
            return await response.json().catch(function () { return {}; });
        } catch (error) {
            return null;
        } finally {
            delete button.dataset.pdPersisting;
        }
    }

    function updateRowStatus(button, label, className) {
        var row = button.closest('tr');
        if (!row) return;
        var status = row.querySelector('.status, [class*="status"], td:nth-last-child(2) span');
        if (!status) return;
        status.textContent = label;
        status.className = 'status ' + (className || 'active');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
    }

    function targetTitle(target) {
        var row = target?.closest?.('tr');
        if (row) {
            var firstStrong = row.querySelector('strong, .agent-name, .user-name, h4, h3');
            if (firstStrong) return firstStrong.textContent.trim();
            return row.cells?.[0]?.innerText?.trim().replace(/\s+/g, ' ') || buttonLabel(target);
        }
        var card = target?.closest?.('article, .dash-card, .property-card, .lead-card, .approval-card');
        return card?.querySelector?.('h3, h4, strong')?.textContent?.trim() || buttonLabel(target);
    }

    function actionTypeFromLabel(label) {
        var lower = String(label || '').toLowerCase();
        if (lower.includes('delete') || lower.includes('remove')) return 'delete';
        if (lower.includes('reject') || lower.includes('decline')) return 'reject';
        if (lower.includes('suspend') || lower.includes('block')) return 'suspend';
        if (lower.includes('approve') || lower.includes('verify') || lower.includes('activate')) return 'approve';
        if (lower.includes('edit') || lower.includes('manage') || lower.includes('settings')) return 'edit';
        if (lower.includes('add') || lower.includes('create') || lower.includes('new')) return 'create';
        if (lower.includes('export') || lower.includes('download') || lower.includes('report')) return 'export';
        if (lower.includes('view') || lower.includes('details') || lower.includes('activity') || lower.includes('lead') || lower.includes('properties') || lower.includes('kyc') || lower.includes('doc')) return 'view';
        if (lower.includes('reset') || lower.includes('clear')) return 'reset';
        if (lower.includes('save') || lower.includes('submit') || lower.includes('send')) return 'save';
        return 'button-click';
    }

    function defaultFieldsForAction(actionType, label) {
        var lowerLabel = String(label || '').toLowerCase();
        if (actionType === 'create' || lowerLabel.includes('property')) return [
            ['Name / title', 'text', 'Enter full name, property title, package name, or item title'],
            ['Email / contact', 'text', 'Enter email, phone, or contact reference'],
            ['Role / category', 'text', 'Enter role, property type, package, or category'],
            ['Location / market', 'text', 'Enter city, locality, or service area'],
            ['Property Images (Upload Photos)', 'file-image', 'Select property photo files (JPG, PNG, WebP)'],
            ['Image URLs (Optional photo links)', 'text', 'Enter photo URL (e.g. /propertydirect/assets/images/property-1.jpg or https://...)'],
            ['Property Video (Upload Walkthrough)', 'file-video', 'Select video file (MP4, WebM)'],
            ['Virtual Tour Video URL (YouTube / Vimeo / MP4)', 'url', 'e.g. https://www.youtube.com/watch?v=... or MP4 video link'],
            ['Admin note', 'textarea', 'Add verification note or instructions']
        ];
        if (actionType === 'edit') return [
            ['Updated title / name', 'text', 'Enter updated name or title'],
            ['Updated status', 'text', 'Enter active, pending, blocked, approved, etc.'],
            ['Updated contact / price / plan', 'text', 'Enter changed contact, price, package, or limit'],
            ['Property Images (Upload Photos)', 'file-image', 'Select property photo files (JPG, PNG, WebP)'],
            ['Property Video (Upload Walkthrough)', 'file-video', 'Select video file (MP4, WebM)'],
            ['Reason for change', 'textarea', 'Explain what was changed and why']
        ];
        if (['approve', 'reject', 'suspend', 'delete'].indexOf(actionType) !== -1) return [
            ['Decision reason', 'textarea', 'Enter reason for this ' + label.toLowerCase() + ' action'],
            ['Reviewed documents / checks', 'textarea', 'Mention KYC, RERA, ownership, payment, complaint, or audit checks'],
            ['Follow-up required', 'text', 'Enter no follow-up, notify user, request documents, etc.']
        ];
        if (actionType === 'export') return [
            ['Report name', 'text', 'Enter report title'],
            ['Date range', 'text', 'Example: Today, This week, This month'],
            ['Format', 'text', 'PDF, CSV, Excel, or summary'],
            ['Filters / notes', 'textarea', 'Mention module, status, city, role, or package filters']
        ];
        return [
            ['Action details', 'textarea', 'Add notes for this dashboard action'],
            ['Assigned owner', 'text', 'Enter responsible person or team'],
            ['Completion target', 'text', 'Enter expected completion or next step']
        ];
    }

    function ensureActionModal() {
        var modal = document.getElementById('pdDashboardActionModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'pdDashboardActionModal';
        modal.className = 'modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = [
            '<div class="modal-card pd-dashboard-action-card" role="dialog" aria-modal="true" aria-labelledby="pdDashboardActionTitle">',
            '<button type="button" class="close" data-pd-action-close aria-label="Close">×</button>',
            '<h3 id="pdDashboardActionTitle">Dashboard action</h3>',
            '<p id="pdDashboardActionSubtitle" class="pd-dashboard-action-subtitle"></p>',
            '<form id="pdDashboardActionForm">',
            '<div id="pdDashboardActionFields" class="form-grid pd-dashboard-action-fields"></div>',
            '<div class="modal-actions">',
            '<button type="button" class="secondary" data-pd-action-close>Cancel</button>',
            '<button type="submit" class="primary" id="pdDashboardActionSubmit">Save Action</button>',
            '</div>',
            '</form>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.closest('[data-pd-action-close]')) closeActionModal();
        });
        modal.querySelector('form').addEventListener('submit', submitActionModal);
        return modal;
    }

    function closeActionModal() {
        var modal = document.getElementById('pdDashboardActionModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('is-open');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }

    function openActionModal(button, options) {
        var label = buttonLabel(button);
        var type = options?.type || actionTypeFromLabel(label);
        var title = options?.title || (label + ' details');
        var target = targetTitle(button);
        var modal = ensureActionModal();
        modal._pdSourceButton = button;
        modal._pdActionType = type;
        modal.querySelector('#pdDashboardActionTitle').textContent = title;
        modal.querySelector('#pdDashboardActionSubtitle').textContent = target
            ? ('Target: ' + target + ' · Role: ' + dashboardRole() + ' · Section: ' + currentPanel())
            : ('Role: ' + dashboardRole() + ' · Section: ' + currentPanel());
        var fields = defaultFieldsForAction(type, label);
        modal.querySelector('#pdDashboardActionFields').innerHTML = fields.map(function (field, index) {
            var id = 'pdActionField' + index;
            var labelText = escapeHtml(field[0]);
            var fieldType = field[1];
            var placeholder = escapeHtml(field[2]);
            var control = '';

            if (fieldType === 'textarea') {
                control = '<textarea id="' + id + '" rows="3" placeholder="' + placeholder + '"></textarea>';
            } else if (fieldType === 'file-image') {
                control = '<div style="display:flex; flex-direction:column; gap:6px; background:#f8fafc; padding:10px; border-radius:8px; border:1px dashed #cbd5e1;">' +
                          '<input id="' + id + '" type="file" accept="image/*" multiple style="font-size:0.82rem; cursor:pointer;" onchange="var feedback = this.nextElementSibling; if (this.files.length > 0) { feedback.textContent = this.files.length + \' photo file(s) selected\'; feedback.style.display = \'block\'; } else { feedback.style.display = \'none\'; }">' +
                          '<span style="color:#059669; font-size:0.78rem; font-weight:700; display:none;"></span>' +
                          '</div>';
            } else if (fieldType === 'file-video') {
                control = '<div style="display:flex; flex-direction:column; gap:6px; background:#eff6ff; padding:10px; border-radius:8px; border:1px dashed #93c5fd;">' +
                          '<input id="' + id + '" type="file" accept="video/*" style="font-size:0.82rem; cursor:pointer;" onchange="var feedback = this.nextElementSibling; if (this.files.length > 0) { feedback.textContent = \'Video walkthrough selected: \' + this.files[0].name; feedback.style.display = \'block\'; } else { feedback.style.display = \'none\'; }">' +
                          '<span style="color:#1d4ed8; font-size:0.78rem; font-weight:700; display:none;"></span>' +
                          '</div>';
            } else {
                control = '<input id="' + id + '" type="' + fieldType + '" placeholder="' + placeholder + '">';
            }
            return '<label><span>' + labelText + '</span>' + control + '</label>';
        }).join('');
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden', 'false');
        modal.querySelector('input, textarea, select')?.focus();
    }

    async function submitActionModal(event) {
        event.preventDefault();
        var modal = event.currentTarget.closest('#pdDashboardActionModal');
        var button = modal?._pdSourceButton;
        var type = modal?._pdActionType || 'dashboard-action';
        var values = Array.from(modal.querySelectorAll('label')).map(function (label) {
            var control = label.querySelector('input, textarea, select');
            return {
                label: label.querySelector('span')?.textContent || control?.id || 'Field',
                value: control?.value || ''
            };
        });
        var submit = modal.querySelector('#pdDashboardActionSubmit');
        submit.disabled = true;
        submit.textContent = 'Saving...';
        try {
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    workspace: 'PropertyDirect',
                    dashboardRole: dashboardRole(),
                    panel: currentPanel(),
                    actionType: type,
                    targetLabel: button ? buttonLabel(button) : 'Dashboard action',
                    details: {
                        target: button ? targetTitle(button) : '',
                        fields: values,
                        context: button ? actionContext(button) : ''
                    }
                })
            });
            if (!response.ok) throw new Error('Workflow save failed');
            if (button) applyVisualActionResult(button, type);
            showFallbackToast('Action saved to backend.');
            closeActionModal();
        } catch (error) {
            showFallbackToast('Action saved locally. Backend was not reachable.');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Save Action';
        }
    }

    function applyVisualActionResult(button, type) {
        if (type === 'approve') updateRowStatus(button, 'Approved', 'active');
        if (type === 'reject') updateRowStatus(button, 'Rejected', 'rejected');
        if (type === 'suspend') updateRowStatus(button, buttonLabel(button).toLowerCase().includes('re-activate') ? 'Active' : 'Suspended', 'pending');
        if (type === 'delete') {
            var row = button.closest('tr');
            if (row) {
                row.dataset.pdDeleted = 'true';
                row.style.opacity = '0.45';
            }
        }
    }

    function resetPanelControls(button) {
        var scope = button.closest('.dash-card, .dash-panel, .vendor-card, main') || document;
        scope.querySelectorAll('input, textarea, select').forEach(function (field) {
            if (field.tagName === 'SELECT') field.selectedIndex = 0;
            else if (field.type === 'checkbox' || field.type === 'radio') field.checked = field.defaultChecked;
            else field.value = '';
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        persistDashboardButton(button, 'reset');
        showFallbackToast('Filters reset.');
    }

    function shouldUseDetailedFallback(target) {
        if (!target || target.disabled) return false;
        if (target.closest('.sidebar-nav, .agent-nav, .vendor-nav, .pd-auth-modal, #pdDashboardActionModal')) return false;
        if (target.closest('[data-property-review]')) return false;
        var tag = target.tagName;
        if (tag === 'A') {
            var href = target.getAttribute('href') || '';
            if (href && href !== '#' && !href.endsWith('/propertydirect/#')) return false;
        }
        if ((target.type || '').toLowerCase() === 'submit' && target.closest('form')) return false;
        return true;
    }

    function handleDashboardFallbackClick(target, event) {
        if (!shouldUseDetailedFallback(target)) return false;
        var label = buttonLabel(target);
        if (!label || label === '×' || label === '✕') return false;
        var type = actionTypeFromLabel(label);
        var href = target.getAttribute('href') || '';
        if (href === '#' || href.endsWith('/propertydirect/#') || target.tagName === 'BUTTON') event.preventDefault();
        if (type === 'reset') {
            resetPanelControls(target);
            return true;
        }
        if (['view', 'edit', 'create', 'approve', 'reject', 'suspend', 'delete', 'export', 'save'].indexOf(type) !== -1) {
            openActionModal(target, { type: type, title: label + ' details' });
            return true;
        }
        persistDashboardButton(target, 'button-click');
        showFallbackToast(label + ' action saved.');
        return true;
    }

    document.addEventListener('click', function (event) {
        var navButton = event.target.closest('.sidebar-nav [data-panel], .agent-nav [data-panel], .vendor-nav [data-panel]');
        if (navButton) {
            event.preventDefault();
            event.stopPropagation();
            setPanel(navButton.dataset.panel);
            if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
            return;
        }
        if (event.target.closest('.pd-sidebar-close, .pd-sidebar-cancel, [data-sidebar-close]')) {
            closeSidebar();
            return;
        }
        if (event.target.closest('.pd-sidebar-menu, .pd-sidebar-reopen, [data-sidebar-open]')) openSidebar();
    }, true);

    document.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;
        var button = event.target.closest('[data-action]');
        if (!button || button.closest('[data-property-review]')) return;
        var action = button.dataset.action;
        if (!action || action === 'close-modal') return;

        var text = (button.textContent || action).trim().replace(/\s+/g, ' ');
        if (['approve', 'activate-row'].indexOf(action) !== -1) {
            updateRowStatus(button, 'Approved', 'active');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' completed.');
            return;
        }
        if (['deactivate-row', 'resolve-task'].indexOf(action) !== -1) {
            updateRowStatus(button, 'Resolved', 'active');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' updated.');
            return;
        }
        if (action === 'mark-paid') {
            updateRowStatus(button, 'Paid', 'paid');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' completed.');
            return;
        }
        if (action === 'export') {
            persistDashboardButton(button, action);
            showFallbackToast('Export prepared for this dashboard.');
            return;
        }
        if (['save', 'edit-row', 'add-row', 'select-plan', 'upgrade', 'manage-plan', 'receipt', 'current-plan'].indexOf(action) !== -1) {
            persistDashboardButton(button, action);
            showFallbackToast(text + ' action is ready.');
        }
    });

    document.addEventListener('click', function (event) {
        var target = event.target.closest('button, a.button, a[href="#"], a[href$="/propertydirect/#"], [role="button"]');
        if (!target || !target.closest('body[data-platform="propertydirect"], body.app-dashboard[data-platform="propertydirect"]')) return;
        if (target.closest('.sidebar-nav, .agent-nav, .vendor-nav') || target.matches('[data-action], [data-property-api-action]')) return;
        if (target.closest('form') && (target.type || '').toLowerCase() === 'submit') return;
        var label = buttonLabel(target);
        if (!label || label === '×' || label === '✕') return;
        handleDashboardFallbackClick(target, event);
    }, false);

    document.addEventListener('submit', async function (event) {
        var form = event.target;
        if (!form || !form.closest('body[data-platform="propertydirect"], body.app-dashboard[data-platform="propertydirect"]')) return;
        if (form.id === 'pdDashboardActionForm' || form.id === 'postApartmentForm' || form.dataset.propertyApiForm === 'true' || form.querySelector('[data-property-api-action]') || event.submitter?.matches('[data-property-api-action]')) return;
        if (form.matches('.pd-auth-card form, #pdLoginForm, #pdSignupForm')) return;
        if (form.dataset.pdNativeSubmit === 'true') return;
        event.preventDefault();
        var submit = form.querySelector('[type="submit"]');
        var title = form.id || form.closest('.modal, .dash-card')?.querySelector('h3, h2')?.textContent?.trim() || 'Dashboard form';
        var fields = Array.from(new FormData(form).entries()).map(function (entry) {
            return { name: entry[0], value: entry[1] };
        });
        if (!fields.length) {
            fields = Array.from(form.querySelectorAll('input, select, textarea')).map(function (field) {
                return { name: field.name || field.id || field.getAttribute('aria-label') || 'field', value: field.value || '' };
            });
        }
        if (submit) {
            submit.disabled = true;
            submit.dataset.pdOriginalText = submit.textContent;
            submit.textContent = 'Saving...';
        }
        try {
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    workspace: 'PropertyDirect',
                    dashboardRole: dashboardRole(),
                    panel: currentPanel(),
                    actionType: 'form-submit',
                    targetLabel: title,
                    details: { fields: fields }
                })
            });
            if (!response.ok) throw new Error('Workflow save failed');
            showFallbackToast(title + ' saved to backend.');
        } catch (error) {
            showFallbackToast(title + ' saved locally. Backend was not reachable.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = submit.dataset.pdOriginalText || 'Submit';
            }
        }
    }, true);

    document.addEventListener('click', function (event) {
        var close = event.target.closest('[data-action="close-modal"], .modal-cancel, .pd-auth-close, button[aria-label^="Close"]');
        if (!close) return;
        var modal = close.closest('.modal, .pd-auth-modal, [role="dialog"]');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }, true);

    window.addEventListener('hashchange', function () { setPanel(window.location.hash.slice(1)); });
    document.addEventListener('DOMContentLoaded', function () {
        ensureActionModal();
        document.querySelectorAll('.sidebar-nav [data-panel], .agent-nav [data-panel], .vendor-nav [data-panel]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                setPanel(button.dataset.panel);
                if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
            });
        });
        var initialPanel = window.location.hash ? window.location.hash.slice(1) : '';
        if (initialPanel) setPanel(initialPanel);
    });
})();
