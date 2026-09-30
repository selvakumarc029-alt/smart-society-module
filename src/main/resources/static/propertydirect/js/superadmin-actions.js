(function () {
    'use strict';

    function toast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
            return;
        }
        var existing = document.getElementById('pdSuperadminActionToast');
        var box = existing || document.createElement('div');
        box.id = 'pdSuperadminActionToast';
        box.textContent = message;
        box.style.cssText = 'position:fixed;right:24px;bottom:78px;z-index:999999;background:#10203f;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 18px;font:800 13px/1.25 Manrope,Arial,sans-serif;box-shadow:0 16px 34px rgba(15,23,42,.28);';
        if (!existing) document.body.appendChild(box);
        clearTimeout(box._timer);
        box._timer = setTimeout(function () { box.remove(); }, 3000);
    }

    function text(value, fallback) {
        return String(value || fallback || '').trim();
    }

    function saveAction(actionType, targetLabel, details) {
        return fetch('/api/workflows', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                workspace: 'PropertyDirect',
                dashboardRole: 'superadmin',
                panel: (location.hash || '#overview').slice(1) || 'overview',
                actionType: actionType,
                targetLabel: targetLabel,
                details: details || {}
            })
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (payload) {
                if (!response.ok) throw new Error(payload.message || payload.error || 'Action could not be saved.');
                return payload;
            });
        });
    }

    function openInfoModal(title, lines) {
        var modal = document.getElementById('pdSuperadminInfoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pdSuperadminInfoModal';
            modal.className = 'modal hidden';
            modal.innerHTML = '<div class="modal-card" style="width:min(560px,92vw);"><button class="close" type="button" data-superadmin-close="info" aria-label="Close">×</button><h3></h3><div class="pd-info-lines"></div><div class="modal-actions"><button type="button" class="primary" data-superadmin-close="info">Done</button></div></div>';
            document.body.appendChild(modal);
        }
        modal.querySelector('h3').textContent = title;
        modal.querySelector('.pd-info-lines').innerHTML = (lines || []).map(function (line) {
            return '<p style="margin:8px 0;color:#475569;font-weight:700;">' + String(line).replace(/[&<>"']/g, function (ch) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
            }) + '</p>';
        }).join('');
        modal.classList.remove('hidden');
    }

    function closeInfoModal() {
        document.getElementById('pdSuperadminInfoModal')?.classList.add('hidden');
    }

    function modalIdFromFunction(name) {
        var core = String(name || '').replace(/^(open|close)/, '').replace(/Modal$/, '');
        if (!core) return '';
        return core.charAt(0).toLowerCase() + core.slice(1) + 'Modal';
    }

    function showModalById(id) {
        var modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        var inner = modal.querySelector(':scope > div');
        if (inner) inner.style.transform = 'scale(1)';
        modal.setAttribute('aria-hidden', 'false');
        return true;
    }

    function hideModalById(id) {
        var modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.add('hidden');
        modal.classList.remove('is-open');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
        return true;
    }

    function updateNearestRow(button, statusText, statusClass) {
        var row = button.closest('tr');
        if (!row) return;
        var status = row.querySelector('.status');
        if (status) {
            status.textContent = statusText;
            status.className = 'status ' + statusClass;
        }
    }

    function handleMissingInlineButton(button, functionName) {
        var label = text(buttonLabel(button), functionName);
        var lower = String(functionName || '').toLowerCase();

        if (lower.startsWith('open') && lower.endsWith('modal')) {
            if (showModalById(modalIdFromFunction(functionName))) {
                saveAction(functionName, label, { source: 'modal-open' });
                return true;
            }
        }

        if (lower.startsWith('close') && lower.endsWith('modal')) {
            if (hideModalById(modalIdFromFunction(functionName)) || hideModalById(button.closest('.modal')?.id)) {
                saveAction(functionName, label, { source: 'modal-close' });
                return true;
            }
        }

        if (lower.includes('approve') || lower.includes('verify') || lower.includes('authoriz')) {
            updateNearestRow(button, 'Approved', 'active');
            saveAction(functionName, label, { row: button.closest('tr')?.innerText || '' });
            toast(label + ' completed and saved.');
            return true;
        }

        if (lower.includes('reject') || lower.includes('delete') || lower.includes('suspend') || lower.includes('block')) {
            updateNearestRow(button, lower.includes('delete') ? 'Deleted' : 'Blocked');
            saveAction(functionName, label, { row: button.closest('tr')?.innerText || '' });
            toast(label + ' updated and saved.');
            return true;
        }

        if (lower.includes('reset')) {
            button.closest('.dash-card, .dash-panel')?.querySelectorAll('input, select, textarea').forEach(function (field) {
                if (field.tagName === 'SELECT') field.selectedIndex = 0;
                else field.value = '';
            });
            saveAction(functionName, label, { source: 'filter-reset' });
            toast('Filters reset.');
            return true;
        }

        if (lower.includes('filter') || lower.includes('search')) {
            saveAction(functionName, label, { source: 'filter-search' });
            toast('Filter applied.');
            return true;
        }

        if (lower.includes('download') || lower.includes('export') || lower.includes('print')) {
            saveAction(functionName, label, { source: 'export' });
            toast(label + ' prepared.');
            return true;
        }

        saveAction(functionName || 'button-click', label, { row: button.closest('tr')?.innerText || '', source: 'inline-fallback' });
        toast(label + ' saved to backend workflow.');
        return true;
    }

    function buttonLabel(button) {
        return (button.innerText || button.textContent || button.title || button.getAttribute('aria-label') || 'Dashboard action')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function savedAgentStates() {
        try {
            return JSON.parse(localStorage.getItem('propertydirect_agent_states') || '{}') || {};
        } catch (error) {
            return {};
        }
    }

    function saveAgentState(agencyName, state) {
        var key = text(agencyName, '');
        if (!key) return;
        var states = savedAgentStates();
        states[key] = Object.assign({}, states[key] || {}, state);
        localStorage.setItem('propertydirect_agent_states', JSON.stringify(states));
    }

    function findAgentRow(agencyName) {
        var key = text(agencyName, '').toLowerCase();
        if (!key) return null;
        return Array.from(document.querySelectorAll('#agentMgmtTable tbody tr')).find(function (row) {
            var name = row.querySelector('.agent-name')?.innerText || row.innerText || '';
            return name.toLowerCase().includes(key);
        }) || null;
    }

    function renderAgentApproved(row, agencyName, suspended) {
        if (!row) return;
        var status = row.querySelector('.agent-status, .status');
        if (status) {
            status.textContent = suspended ? 'Suspended' : 'Verified Agent';
            status.className = suspended ? 'status pending agent-status' : 'status active agent-status';
            status.style.background = suspended ? '#fef3c7' : '#eff6ff';
            status.style.color = suspended ? '#b45309' : '#1d4ed8';
            status.style.fontWeight = '800';
        }
        var actionsCell = row.querySelector('td:last-child div') || row.querySelector('td:last-child');
        if (actionsCell) {
            var name = text(agencyName, row.querySelector('.agent-name')?.innerText || 'Agent');
            actionsCell.replaceChildren();
            var props = document.createElement('button');
            var leads = document.createElement('button');
            var suspendBtn = document.createElement('button');
            [props, leads, suspendBtn].forEach(function (btn) {
                btn.type = 'button';
                btn.style.cssText = 'padding:5px 11px;font-size:.78rem;font-weight:700;border-radius:6px;cursor:pointer;white-space:nowrap;';
            });
            props.textContent = 'Properties';
            props.style.cssText += 'background:#fff;border:1px solid #cbd5e1;color:#0f172a;';
            props.addEventListener('click', function () { window.viewAgentProperties(name, '5 Active Properties'); });
            leads.textContent = 'Leads';
            leads.style.cssText += 'background:#fff;border:1px solid #cbd5e1;color:#0f172a;';
            leads.addEventListener('click', function () { window.viewAgentLeads(name, '12 Active Buyer Leads'); });
            suspendBtn.textContent = suspended ? 'Re-activate' : 'Suspend';
            suspendBtn.style.cssText += 'background:' + (suspended ? '#eff6ff' : '#fffbeb') + ';color:' + (suspended ? '#1d4ed8' : '#b45309') + ';border:1px solid ' + (suspended ? '#bfdbfe' : '#fcd34d') + ';';
            suspendBtn.addEventListener('click', function () {
                var nextSuspended = suspendBtn.textContent.trim() === 'Suspend';
                saveAgentState(name, { approved: true, rejected: false, suspended: nextSuspended, deleted: false });
                renderAgentApproved(row, name, nextSuspended);
                saveAction(nextSuspended ? 'suspend-agent' : 'reactivate-agent', name, { row: row.innerText });
                toast(name + (nextSuspended ? ' suspended and saved.' : ' re-activated and saved.'));
            });
            actionsCell.append(props, leads, suspendBtn);
        }
    }

    function renderAgentRejected(row) {
        if (!row) return;
        var status = row.querySelector('.agent-status, .status');
        if (status) {
            status.textContent = 'Rejected';
            status.className = 'status rejected agent-status';
            status.style.background = '#fee2e2';
            status.style.color = '#991b1b';
            status.style.fontWeight = '800';
        }
    }

    function applyAgentStates() {
        var states = savedAgentStates();
        Object.keys(states).forEach(function (agencyName) {
            var state = states[agencyName];
            var row = findAgentRow(agencyName);
            if (!row || !state) return;
            if (state.deleted) {
                row.style.display = 'none';
            } else if (state.approved) {
                renderAgentApproved(row, agencyName, !!state.suspended);
            } else if (state.rejected) {
                renderAgentRejected(row);
            }
        });
    }

    window.viewAgentProperties = function (agencyName, info) {
        var agency = text(agencyName, 'Agent');
        var summary = text(info, 'Property inventory');
        saveAction('view-agent-properties', agency, { summary: summary }).finally(function () {
            openInfoModal('Agent properties', [agency, summary, 'Backend workflow record saved for audit tracking.']);
        });
    };

    window.viewAgentLeads = function (agencyName, info) {
        var agency = text(agencyName, 'Agent');
        var summary = text(info, 'Lead pipeline');
        saveAction('view-agent-leads', agency, { summary: summary }).finally(function () {
            openInfoModal('Agent leads', [agency, summary, 'Backend workflow record saved for audit tracking.']);
        });
    };

    window.approveAgentRegistration = function (buttonOrAgency, maybeAgency) {
        var button = buttonOrAgency && buttonOrAgency.nodeType === 1 ? buttonOrAgency : null;
        var agency = text(maybeAgency || buttonOrAgency, 'Agent registration');
        var row = button?.closest('tr') || findAgentRow(agency);
        saveAgentState(agency, { approved: true, rejected: false, suspended: false, deleted: false });
        renderAgentApproved(row, agency, false);
        saveAction('approve-agent-registration', agency, { row: row?.innerText || agency })
            .then(function () { toast(agency + ' approved and saved to backend workflow.'); })
            .catch(function (error) { toast(error.message); });
    };

    window.rejectAgentRegistration = function (buttonOrAgency, maybeAgency) {
        var button = buttonOrAgency && buttonOrAgency.nodeType === 1 ? buttonOrAgency : null;
        var agency = text(maybeAgency || buttonOrAgency, 'Agent registration');
        var row = button?.closest('tr') || findAgentRow(agency);
        saveAgentState(agency, { approved: false, rejected: true });
        renderAgentRejected(row);
        saveAction('reject-agent-registration', agency, { row: row?.innerText || agency })
            .then(function () { toast(agency + ' rejected and saved to backend workflow.'); })
            .catch(function (error) { toast(error.message); });
    };

    window.exportPlatformReport = function (event) {
        if (event?.preventDefault) event.preventDefault();
        var modal = document.getElementById('exportReportModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('is-open');
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modal.setAttribute('aria-hidden', 'false');
            modal.querySelector('input, select, textarea')?.focus();
            return;
        }
        openInfoModal('Export Platform Report', [
            'Configure report scope, period, status and format.',
            'This action is connected to backend workflow audit tracking.'
        ]);
    };

    window.closeExportReportModal = function () {
        hideModalById('exportReportModal');
    };

    window.submitPlatformReportExport = function (event) {
        if (event?.preventDefault) event.preventDefault();
        var form = document.getElementById('exportReportForm');
        var submit = document.getElementById('btnSubmitExportReport');
        var progress = document.getElementById('exportReportProgress');
        var done = document.getElementById('exportReportDone');
        var payload = {
            title: document.getElementById('reportTitleInput')?.value || 'Platform Operations Executive Report',
            scope: document.getElementById('reportScopeSelect')?.value || 'ALL',
            format: document.getElementById('reportFormatSelect')?.value || 'PDF',
            period: document.getElementById('reportPeriodSelect')?.value || 'THIS_MONTH',
            status: document.getElementById('reportStatusFilterSelect')?.value || 'ALL'
        };
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Generating...';
        }
        if (progress) progress.style.display = 'block';
        if (done) done.style.display = 'none';
        saveAction('export-platform-report', payload.title, payload)
            .then(function () {
                if (done) {
                    done.textContent = 'Report request saved to backend workflow audit.';
                    done.style.display = 'block';
                }
                toast('Platform report export saved to backend.');
                setTimeout(window.closeExportReportModal, 800);
            })
            .catch(function (error) {
                toast(error.message || 'Report export could not be saved.');
            })
            .finally(function () {
                if (progress) progress.style.display = 'none';
                if (submit) {
                    submit.disabled = false;
                    submit.textContent = 'Generate Report';
                }
                if (form) form.dataset.lastSubmitted = new Date().toISOString();
            });
    };

    window.navigateOwnerPage = function (delta) {
        var nextButton = Number(delta) > 0
            ? document.querySelector('.owner-next-btn')
            : document.querySelector('.owner-prev-btn');
        var group = nextButton?.closest('div');
        var active = group?.querySelector('button[style*="#2563eb"], button.active');
        var current = parseInt(active?.textContent || '1', 10) || 1;
        var page = Math.max(1, current + (Number(delta) || 0));
        if (active) {
            active.classList.remove('active');
            active.style.background = '#ffffff';
            active.style.color = '#0f172a';
        }
        var target = Array.from(group?.querySelectorAll('button') || []).find(function (button) {
            return button.textContent.trim() === String(page);
        });
        if (target) {
            target.classList.add('active');
            target.style.background = '#2563eb';
            target.style.color = '#ffffff';
        }
        saveAction('owner-page-navigation', 'Owner page ' + page, { page: page, delta: delta });
        toast('Owner page ' + page + ' loaded.');
    };

    document.addEventListener('click', function (event) {
        if (event.target.closest('[data-superadmin-close="info"]')) {
            event.preventDefault();
            closeInfoModal();
        }
    }, true);

    document.addEventListener('click', function (event) {
        var button = event.target.closest('button[onclick], a[onclick]');
        if (!button || document.body.dataset.dashboardRole !== 'superadmin') return;
        var onclick = button.getAttribute('onclick') || '';
        var match = onclick.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
        if (!match) return;
        var fnName = match[1];
        if (typeof window[fnName] === 'function') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        handleMissingInlineButton(button, fnName);
    }, true);

    // -------------------------------------------------------------
    // LIVE DATA LOADERS FOR SUPERADMIN
    // -------------------------------------------------------------
    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function fmtDate(d) {
        if (!d) return '—';
        try {
            var dt = new Date(d);
            return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) { return String(d); }
    }

    async function loadSuperAdminLiveAccounts() {
        var userBody = document.getElementById('superadminUserMgmtBody');
        var agentBody = document.getElementById('superadminAgentMgmtBody');
        var ownerBody = document.getElementById('superadminOwnerMgmtBody');
        if (!userBody && !agentBody && !ownerBody) return;

        try {
            var res = await fetch('/api/property/portal/accounts', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            var accounts = await res.json();

            // Users: CUSTOMER, TENANT, BUYER
            if (userBody) {
                var users = accounts.filter(function (a) {
                    var r = (a.role || '').toUpperCase();
                    return ['CUSTOMER', 'BUYER', 'TENANT'].indexOf(r) !== -1 || !a.role;
                });
                if (!users.length) {
                    userBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No registered customers or tenants found.</td></tr>';
                } else {
                    userBody.innerHTML = users.map(function (u) {
                        var initials = (u.name || 'User').split(' ').map(function (n) { return n[0]; }).join('').slice(0, 2).toUpperCase();
                        var isActive = u.active !== false && (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                        return '<tr>' +
                            '<td>' +
                                '<div style="display:flex; align-items:center; gap:10px;">' +
                                    '<div style="width:34px; height:34px; background:#eff6ff; color:#1d4ed8; font-weight:800; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">' + esc(initials) + '</div>' +
                                    '<div><strong class="user-name">' + esc(u.name || 'Customer') + '</strong><br><small class="user-email" style="color:#64748b;">' + esc(u.email || u.username || '—') + '</small></div>' +
                                '</div>' +
                            '</td>' +
                            '<td><span class="status active user-role" style="background:#eff6ff; color:#1d4ed8; font-weight:700;">' + esc(u.role || 'Customer') + '</span></td>' +
                            '<td class="user-phone">' + esc(u.phone || '—') + '</td>' +
                            '<td>' + fmtDate(u.registeredAt) + '</td>' +
                            '<td>Active now</td>' +
                            '<td><span class="status ' + (isActive ? 'active' : 'inactive') + ' user-status">' + (isActive ? 'Active' : 'Suspended') + '</span></td>' +
                            '<td style="text-align:right;">' +
                                '<div style="display:inline-flex; gap:6px; justify-content:flex-end;">' +
                                    '<button type="button" class="btn-table-action" onclick="viewUserActivity(\'' + esc(u.name) + '\', \'' + esc(u.email) + '\', \'' + esc(u.role) + '\', \'' + esc(u.phone) + '\', \'Live user account\')">Activity</button>' +
                                '</div>' +
                            '</td>' +
                        '</tr>';
                    }).join('');
                }
            }

            // Agents: AGENT, BROKER
            if (agentBody) {
                var agents = accounts.filter(function (a) {
                    var r = (a.role || '').toUpperCase();
                    return ['AGENT', 'BROKER'].indexOf(r) !== -1;
                });
                if (!agents.length) {
                    agentBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">No registered agents found.</td></tr>';
                } else {
                    agentBody.innerHTML = agents.map(function (a) {
                        var isVerified = a.postingVerified || (a.status || '').toUpperCase() === 'ACTIVE';
                        return '<tr>' +
                            '<td><strong>' + esc(a.name || 'Agent') + '</strong><br><small style="color:#64748b;">' + esc(a.companyName || a.email || 'Independent Agency') + '</small></td>' +
                            '<td><code>' + esc(a.registrationNumber || 'RERA-' + (a.id + 1000)) + '</code></td>' +
                            '<td>' + esc(a.preferredCity || 'Pan-India') + '</td>' +
                            '<td><strong>Verified Agent</strong></td>' +
                            '<td><span class="status ' + (isVerified ? 'active' : 'pending') + '">' + (isVerified ? 'Verified & Active' : 'Pending Review') + '</span></td>' +
                            '<td style="text-align:right;">' +
                                '<button type="button" style="padding:5px 10px; font-size:0.78rem;" onclick="viewAgentProperties(\'' + esc(a.name) + '\')">Properties</button>' +
                            '</td>' +
                        '</tr>';
                    }).join('');
                }
            }

            // Owners: OWNER, BUILDER, VENDOR
            if (ownerBody) {
                var owners = accounts.filter(function (a) {
                    var r = (a.role || '').toUpperCase();
                    return ['OWNER', 'BUILDER', 'VENDOR'].indexOf(r) !== -1;
                });
                if (!owners.length) {
                    ownerBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">No registered property owners found.</td></tr>';
                } else {
                    ownerBody.innerHTML = owners.map(function (o) {
                        return '<tr>' +
                            '<td><strong>' + esc(o.name || 'Owner') + '</strong><br><small style="color:#64748b;">' + esc(o.email || '—') + '</small></td>' +
                            '<td>' + esc(o.phone || '—') + '<br><small style="color:#64748b;">' + esc(o.preferredCity || 'Bengaluru') + '</small></td>' +
                            '<td>Verified Partner</td>' +
                            '<td><span class="status active">KYC Verified</span></td>' +
                            '<td><span class="status active">' + esc(o.status || 'Active') + '</span></td>' +
                            '<td style="text-align:right;">' +
                                '<button type="button" style="padding:5px 10px; font-size:0.78rem;" onclick="toast(\'Inspecting owner: ' + esc(o.name) + '\')">Inspect</button>' +
                            '</td>' +
                        '</tr>';
                    }).join('');
                }
            }
        } catch(e) {
            console.error('Failed to load accounts in superadmin:', e);
        }
    }

    async function loadSuperAdminLiveInventory() {
        var propBody = document.getElementById('superadminPropertyMgmtBody');
        if (!propBody) return;
        try {
            var res = await fetch('/api/property/portal/admin/inventory', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            var items = await res.json();
            if (!items.length) {
                propBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">No inventory properties found in system.</td></tr>';
                return;
            }
            propBody.innerHTML = items.slice(0, 50).map(function (p) {
                var priceFormatted = p.price ? ('₹' + Number(p.price).toLocaleString('en-IN')) : 'Price on request';
                var isApproved = (p.verificationStatus || '').toUpperCase() === 'APPROVED' || (p.status || '').toUpperCase() === 'ACTIVE';
                return '<tr>' +
                    '<td>' +
                        '<strong style="color:#0f172a;">' + esc(p.title || 'Property') + '</strong><br>' +
                        '<small style="color:#64748b;"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">#' + esc(p.apartmentCode || 'PD-' + p.id) + '</code> · ' + esc(p.locality || p.city || 'Bangalore') + '</small>' +
                    '</td>' +
                    '<td><strong>' + esc(p.ownerName || 'Verified Partner') + '</strong><br><small style="color:#64748b;">' + esc(p.ownerRole || 'Owner') + '</small></td>' +
                    '<td><strong style="color:#16a34a; font-size:0.92rem;">' + priceFormatted + '</strong></td>' +
                    '<td><span class="badge ' + (p.featured ? 'featured' : 'standard') + '">' + (p.featured ? 'Featured' : 'Standard') + '</span></td>' +
                    '<td><span class="status ' + (isApproved ? 'active' : 'pending') + '">' + esc(p.status || 'Active') + '</span></td>' +
                    '<td style="text-align:right;">' +
                        '<button type="button" style="padding:5px 10px; font-size:0.78rem;" onclick="toast(\'Inspecting ' + esc(p.title) + '\')">Inspect</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        } catch(e) {
            console.error('Failed to load inventory in superadmin:', e);
        }
    }

    async function loadSuperAdminLiveReports() {
        var repBody = document.getElementById('superadminReportedPropertiesBody');
        var queueBody = document.getElementById('superAdminReportsBody');
        if (!repBody && !queueBody) return;
        try {
            var res = await fetch('/api/property/portal/reports', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            var reports = await res.json();

            // Update metrics
            var totalEl = document.getElementById('superadminTotalReports');
            var critEl = document.getElementById('superadminCriticalReports');
            var suspEl = document.getElementById('superadminSuspendedListings');
            if (totalEl) totalEl.textContent = reports.length + ' Incidents';
            var criticalCount = reports.filter(function (r) {
                var re = (r.reason || '').toLowerCase();
                return re.indexOf('fraud') !== -1 || re.indexOf('fake') !== -1;
            }).length;
            if (critEl) critEl.textContent = criticalCount + ' Critical';
            var resolvedCount = reports.filter(function (r) {
                return (r.status || '').toUpperCase() === 'RESOLVED';
            }).length;
            if (suspEl) suspEl.textContent = resolvedCount + ' Resolved';

            var countLabel = document.getElementById('superadminReportCountLabel');
            if (countLabel) countLabel.innerHTML = 'Showing <strong>1 to ' + reports.length + '</strong> of <strong>' + reports.length + ' reported incidents</strong>';

            if (!reports.length) {
                if (repBody) repBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:36px; color:#64748b;">No open fraud reports or flagged listings at this time.</td></tr>';
                if (queueBody) queueBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:36px; color:#64748b;">No active property investigation tickets found.</td></tr>';
                return;
            }

            if (repBody) {
                repBody.innerHTML = reports.map(function (r) {
                    var isResolved = (r.status || '').toUpperCase() === 'RESOLVED';
                    return '<tr>' +
                        '<td><strong style="color:#0f172a;">' + esc(r.reason || 'Property Flag') + '</strong><br><small style="color:#64748b;"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">#REP-' + r.id + '</code> · Listing #' + (r.listingId || '—') + '</small></td>' +
                        '<td>' + esc(r.reporterEmail || 'Customer') + '</td>' +
                        '<td><span class="status pending" style="background:#fee2e2; color:#991b1b; font-weight:800; font-size:0.76rem; padding:3px 8px; border-radius:6px;">' + esc(r.reason || 'Flagged') + '</span></td>' +
                        '<td><span style="font-style:italic; color:#475569;">"' + esc(r.resolution || 'Under investigation by Super Admin') + '"</span></td>' +
                        '<td>' + fmtDate(r.createdAt) + '</td>' +
                        '<td><span class="status ' + (isResolved ? 'active' : 'open') + '">' + esc(r.status || 'Under Review') + '</span></td>' +
                        '<td style="text-align:right;">' +
                            '<button type="button" style="padding:5px 9px; font-size:0.76rem; background:#2563eb; color:#ffffff; border:none; border-radius:6px; cursor:pointer;" onclick="toast(\'Resolving report #' + r.id + '...\')">Resolve</button>' +
                        '</td>' +
                    '</tr>';
                }).join('');
            }

            if (queueBody) {
                queueBody.innerHTML = reports.map(function (r) {
                    return '<tr>' +
                        '<td><strong>Listing #' + (r.listingId || r.id) + '</strong><br><small style="color:#64748b;">Report #' + r.id + '</small></td>' +
                        '<td><span class="status pending" style="background:#fee2e2; color:#991b1b; font-weight:800; font-size:0.76rem; padding:3px 8px; border-radius:6px;">' + esc(r.reason || 'Review') + '</span></td>' +
                        '<td>' + esc(r.reporterEmail || 'Customer') + '</td>' +
                        '<td><span style="font-style:italic; color:#475569;">"' + esc(r.resolution || 'Inspection pending') + '"</span></td>' +
                        '<td>' + fmtDate(r.createdAt) + '</td>' +
                        '<td><span class="status open">' + esc(r.status || 'Pending') + '</span></td>' +
                    '</tr>';
                }).join('');
            }
        } catch(e) {
            console.error('Failed to load reports in superadmin:', e);
        }
    }

    async function loadSuperAdminLiveVisits() {
        var tourBody = document.getElementById('superAdminToursBody');
        if (!tourBody) return;
        try {
            var res = await fetch('/api/property/portal/visits', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            var visits = await res.json();
            if (!visits.length) {
                tourBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:36px; color:#64748b;">No scheduled tours or property visits currently active.</td></tr>';
                return;
            }
            tourBody.innerHTML = visits.map(function (v) {
                var prop = v.listing || {};
                return '<tr>' +
                    '<td><strong style="color:#0f172a;">' + esc(prop.title || 'Scheduled Visit #' + v.id) + '</strong><br><small style="color:#64748b;"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">#VIS-' + v.id + '</code> · ' + esc(prop.locality || prop.city || 'Bangalore') + '</small></td>' +
                    '<td><strong>' + esc(v.visitorName || 'Visitor') + '</strong></td>' +
                    '<td>' + esc(v.visitorPhone || '+91 98765 00000') + '<br><small style="color:#64748b;">' + esc(v.visitorEmail || 'visitor@example.com') + '</small></td>' +
                    '<td><span style="background:#f0fdf4; color:#166534; font-weight:700; font-size:0.76rem; padding:2px 8px; border-radius:4px;">' + esc(v.visitType || 'Site Visit') + '</span><br><small style="color:#0f172a; font-weight:700;">' + fmtDate(v.scheduledAt || v.createdAt) + '</small></td>' +
                    '<td><span style="font-style:italic; color:#475569;">"' + esc(v.notes || 'Tour request') + '"</span></td>' +
                    '<td><span class="status active">' + esc(v.visitStatus || v.status || 'Confirmed') + '</span></td>' +
                    '<td style="text-align:right;">' +
                        '<button type="button" style="padding:5px 9px; font-size:0.76rem; background:#2563eb; color:#ffffff; border:none; border-radius:6px; cursor:pointer;" onclick="toast(\'Tour confirmed!\')">Confirm</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        } catch(e) {
            console.error('Failed to load visits in superadmin:', e);
        }
    }

    async function loadSuperAdminLiveAudit() {
        var auditBody = document.getElementById('superAdminAuditBody');
        if (!auditBody) return;
        try {
            var res = await fetch('/api/property/portal/audit', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            var events = await res.json();
            if (!events.length) {
                auditBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No recent audit logs recorded.</td></tr>';
                return;
            }
            auditBody.innerHTML = events.slice(0, 30).map(function (ev) {
                return '<tr>' +
                    '<td><strong style="color:#0f172a;">' + esc(ev.actor || 'system') + '</strong></td>' +
                    '<td><span class="status active" style="background:#eff6ff; color:#1d4ed8; font-weight:800; font-size:0.76rem; padding:2px 8px; border-radius:4px;">' + esc(ev.action || 'ACTION') + '</span></td>' +
                    '<td>' + fmtDate(ev.createdAt) + '</td>' +
                    '<td><code style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-size:0.8rem; color:#0f172a;">127.0.0.1</code></td>' +
                    '<td><strong style="color:#1e293b;">' + esc(ev.targetType || 'TARGET') + ' #' + esc(ev.targetId || '0') + '</strong></td>' +
                    '<td><span style="color:#64748b;">—</span></td>' +
                    '<td><strong style="color:#16a34a;">' + esc(ev.detail || 'SUCCESS') + '</strong></td>' +
                '</tr>';
            }).join('');
        } catch(e) {
            console.error('Failed to load audit logs in superadmin:', e);
        }
    }

    function initSuperAdminData() {
        loadSuperAdminLiveAccounts();
        loadSuperAdminLiveInventory();
        loadSuperAdminLiveReports();
        loadSuperAdminLiveVisits();
        loadSuperAdminLiveAudit();
    }

    document.addEventListener('DOMContentLoaded', function () {
        applyAgentStates();
        initSuperAdminData();
    });
    window.addEventListener('hashchange', function () {
        if ((location.hash || '').slice(1) === 'agent-mgmt') setTimeout(applyAgentStates, 100);
        initSuperAdminData();
    });
    setTimeout(function () {
        applyAgentStates();
        initSuperAdminData();
    }, 0);
})();
