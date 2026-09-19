/**
 * Smart Apartment Maintenance Manager Operations Dashboard
 * Real-time SSE integration with 11 KPIs, Live Kanban Board, Live Worker Board with Color Status Indicators,
 * Filterable Live Request Queue, Audited Manual Actions, Live Alerts, and Analytics.
 */

(function () {
    'use strict';

    let eventSource = null;
    let reconnectTimeout = null;
    let reconnectDelay = 3000;
    let dashboardData = null;
    let currentFilters = {
        status: 'ALL',
        priority: 'ALL',
        category: 'ALL',
        workerId: '',
        building: 'ALL',
        date: ''
    };

    function init() {
        const container = document.getElementById('maintenance-manager-operations-container');
        if (!container) return;

        loadDashboardSummary();
        setupFilterListeners();
        connectManagerSse();
    }

    // Connect to Manager SSE Stream
    function connectManagerSse() {
        if (eventSource) eventSource.close();

        const sseUrl = '/api/maintenance/manager/stream';
        eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('open', () => {
            console.log('[ManagerDashboard] SSE connected.');
            reconnectDelay = 3000;
            updateManagerBeacon(true);
        });

        eventSource.addEventListener('CONNECTED', (e) => {
            console.log('[ManagerDashboard] Connection established:', e.data);
            updateManagerBeacon(true);
        });

        eventSource.addEventListener('maintenance-event', (e) => {
            try {
                const event = JSON.parse(e.data);
                console.log('[ManagerDashboard] Realtime event:', event.eventType, event);
                handleRealtimeEvent(event);
            } catch (err) {
                console.error('[ManagerDashboard] Error parsing event:', err);
            }
        });

        eventSource.addEventListener('error', () => {
            console.warn('[ManagerDashboard] SSE disconnected. Reconnecting in', reconnectDelay, 'ms');
            updateManagerBeacon(false);
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
                connectManagerSse();
            }, reconnectDelay);
        });
    }

    function updateManagerBeacon(isConnected) {
        const beacon = document.getElementById('mgr-live-beacon');
        if (beacon) {
            beacon.className = isConnected ? 'badge bg-success-subtle text-success border border-success' : 'badge bg-warning-subtle text-warning border border-warning';
            beacon.innerHTML = isConnected ? '<i class="fas fa-circle text-success me-1 fa-beat" style="font-size: 8px;"></i> LIVE SYSTEM ONLINE' : '<i class="fas fa-circle text-warning me-1" style="font-size: 8px;"></i> RECONNECTING...';
        }
    }

    // Handle real-time event without page refresh
    function handleRealtimeEvent(event) {
        if (!event) return;

        // Refresh dashboard summary and queue in-place
        loadDashboardSummary();

        // Trigger alert banner if urgent
        if (event.eventType === 'TASK_OVERDUE' || event.eventType === 'EMERGENCY_REQUEST' || event.eventType === 'NO_WORKER_AVAILABLE') {
            showManagerToast(event.eventType, event.message);
        }
    }

    // Load full dashboard summary
    async function loadDashboardSummary() {
        try {
            const resp = await fetch('/api/maintenance/manager/summary');
            if (!resp.ok) {
                if (resp.status === 401 || resp.status === 403) return;
                throw new Error('Failed to load dashboard summary');
            }
            dashboardData = await resp.json();
            renderKpiCards(dashboardData);
            renderKanban(dashboardData.kanbanColumns);
            renderWorkerBoard(dashboardData.workerBoard);
            renderAlerts(dashboardData.recentAlerts);
            renderAnalytics(dashboardData.analytics);
            loadQueue(); // load filtered queue
        } catch (err) {
            console.error('[ManagerDashboard] Error loading summary:', err);
        }
    }

    // Render 11 KPI Cards
    function renderKpiCards(data) {
        if (!data) return;
        setVal('kpi-total-requests', data.totalRequests);
        setVal('kpi-new-requests', data.newRequests);
        setVal('kpi-waiting-requests', data.waitingRequests);
        setVal('kpi-assigned-requests', data.assignedRequests);
        setVal('kpi-travelling-requests', data.travellingRequests);
        setVal('kpi-in-progress-requests', data.inProgressRequests);
        setVal('kpi-completed-today', data.completedTodayRequests);
        setVal('kpi-overdue-requests', data.overdueRequests);
        setVal('kpi-available-workers', data.availableWorkers);
        setVal('kpi-busy-workers', data.busyWorkers);
        setVal('kpi-workers-on-leave', data.workersOnLeave);
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val !== undefined ? val : '0';
    }

    // Render 11 Kanban Columns
    function renderKanban(columns) {
        const container = document.getElementById('mgr-kanban-container');
        if (!container || !columns) return;

        const colDefs = [
            { key: 'NEW', title: 'NEW', badge: 'bg-secondary' },
            { key: 'AUTO_ASSIGN_PENDING', title: 'AUTO ASSIGN', badge: 'bg-info' },
            { key: 'WAITING', title: 'WAITING', badge: 'bg-warning text-dark' },
            { key: 'ASSIGNED', title: 'ASSIGNED', badge: 'bg-primary' },
            { key: 'ACCEPTED', title: 'ACCEPTED', badge: 'bg-primary-subtle text-primary' },
            { key: 'TRAVELLING', title: 'TRAVELLING', badge: 'bg-info-subtle text-info' },
            { key: 'ARRIVED', title: 'ARRIVED', badge: 'bg-indigo' },
            { key: 'IN_PROGRESS', title: 'IN PROGRESS', badge: 'bg-success' },
            { key: 'ON_HOLD', title: 'ON HOLD', badge: 'bg-warning text-dark' },
            { key: 'COMPLETED', title: 'COMPLETED', badge: 'bg-dark text-white' },
            { key: 'OVERDUE', title: 'OVERDUE', badge: 'bg-danger text-white' }
        ];

        container.innerHTML = `
            <div class="d-flex flex-nowrap overflow-auto gap-3 pb-3 kanban-scroll-track" style="min-height: 480px;">
                ${colDefs.map(c => `
                    <div class="kanban-col flex-shrink-0" style="width: 280px; min-width: 280px;">
                        <div class="card bg-light border-0 shadow-sm h-100">
                            <div class="card-header bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
                                <span class="fw-bold small text-uppercase">${escapeHtml(c.title)}</span>
                                <span class="badge ${c.badge} rounded-pill">${(columns[c.key] || []).length}</span>
                            </div>
                            <div class="card-body p-2 overflow-auto kanban-col-body" style="max-height: 540px;">
                                ${(columns[c.key] && columns[c.key].length > 0)
                                    ? columns[c.key].map(item => renderKanbanCard(item)).join('')
                                    : '<div class="text-center py-4 text-muted small opacity-75">No requests</div>'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        attachActionListeners();
    }

    function renderKanbanCard(item) {
        return `
            <div class="card border mb-2 shadow-sm bg-white kanban-item-card" data-req-id="${item.requestId}">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-dark small">${escapeHtml(item.requestNumber)}</span>
                        <span class="badge ${getPriorityClass(item.priority)}">${escapeHtml(item.priority)}</span>
                    </div>
                    <div class="fw-bold small text-dark text-truncate">${escapeHtml(item.service)}</div>
                    <div class="text-muted small mb-1">
                        <i class="fas fa-map-marker-alt text-danger me-1"></i>${escapeHtml(item.building)} - ${escapeHtml(item.flat)}
                    </div>
                    <div class="d-flex justify-content-between align-items-center small text-secondary mt-2 pt-1 border-top">
                        <span><i class="fas fa-user-cog me-1"></i>${escapeHtml(item.workerName || 'Unassigned')}</span>
                        <span class="${item.isOverdue ? 'text-danger fw-bold' : 'text-muted'}">${escapeHtml(item.remainingTimeString || '--')}</span>
                    </div>
                    <div class="mt-2 d-flex justify-content-end">
                        <button class="btn btn-outline-secondary btn-xs py-0 px-1 mgr-action-menu-btn" data-id="${item.requestId}" title="Manage">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render Live Worker Board with Color Status Indicators
    function renderWorkerBoard(workers) {
        const container = document.getElementById('mgr-worker-board-tbody');
        if (!container) return;

        if (!workers || workers.length === 0) {
            container.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No maintenance workers registered.</td></tr>`;
            return;
        }

        container.innerHTML = workers.map(w => `
            <tr>
                <td class="fw-semibold">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fs-6">${getWorkerColorEmoji(w.colorStatus)}</span>
                        <div>
                            <div class="text-dark">${escapeHtml(w.workerName)}</div>
                            <div class="text-muted small">${escapeHtml(w.workerPhone || '--')}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(w.skill || 'General')}</span></td>
                <td><span class="badge ${getAttendanceBadge(w.attendanceStatus)}">${escapeHtml(w.attendanceStatus)}</span></td>
                <td><span class="badge ${getAvailabilityBadge(w.availabilityStatus)}">${escapeHtml(w.availabilityStatus)}</span></td>
                <td>
                    ${w.currentRequestNumber ? `<span class="badge bg-primary text-white">${escapeHtml(w.currentRequestNumber)}</span>` : '<span class="text-muted small">None</span>'}
                </td>
                <td>
                    <span class="badge ${w.colorBadgeClass || 'badge-secondary'}">${escapeHtml(w.colorStatus)}</span>
                </td>
                <td class="small text-muted">${escapeHtml(w.formattedStartedTime || '--')}</td>
                <td class="small text-muted">${escapeHtml(w.formattedExpectedCompletionTime || '--')}</td>
                <td>
                    <span class="small fw-bold ${w.isOverdue ? 'text-danger' : 'text-dark'}">${escapeHtml(w.remainingTimeString || '--')}</span>
                </td>
            </tr>
        `).join('');
    }

    function getWorkerColorEmoji(status) {
        if (!status) return '⚪';
        if (status.includes('AVAILABLE')) return '🟢';
        if (status.includes('BUSY')) return '🟡';
        if (status.includes('TRAVELLING')) return '🔵';
        if (status.includes('WORKING')) return '🟣';
        if (status.includes('ON BREAK')) return '🟠';
        if (status.includes('OFFLINE')) return '🔴';
        if (status.includes('ABSENT')) return '⚫';
        if (status.includes('OVERDUE')) return '⚠️';
        return '⚪';
    }

    // Render Filterable Live Request Queue
    async function loadQueue() {
        const tbody = document.getElementById('mgr-queue-tbody');
        if (!tbody) return;

        const params = new URLSearchParams();
        if (currentFilters.status && currentFilters.status !== 'ALL') params.append('status', currentFilters.status);
        if (currentFilters.priority && currentFilters.priority !== 'ALL') params.append('priority', currentFilters.priority);
        if (currentFilters.category && currentFilters.category !== 'ALL') params.append('category', currentFilters.category);
        if (currentFilters.workerId) params.append('workerId', currentFilters.workerId);
        if (currentFilters.building && currentFilters.building !== 'ALL') params.append('building', currentFilters.building);
        if (currentFilters.date) params.append('date', currentFilters.date);

        try {
            const resp = await fetch(`/api/maintenance/manager/queue?${params.toString()}`);
            if (!resp.ok) throw new Error('Failed to load queue');
            const items = await resp.json();

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="13" class="text-center py-4 text-muted">No maintenance requests match the current filters.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(r => `
                <tr class="${r.isOverdue ? 'table-danger-subtle' : ''}">
                    <td class="fw-bold">${escapeHtml(r.requestNumber)}</td>
                    <td>
                        <div>${escapeHtml(r.residentName)}</div>
                        <div class="text-muted small">${escapeHtml(r.residentPhone || '')}</div>
                    </td>
                    <td>${escapeHtml(r.flat)}</td>
                    <td>${escapeHtml(r.building)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(r.service)}</span></td>
                    <td><span class="badge ${getPriorityClass(r.priority)}">${escapeHtml(r.priority)}</span></td>
                    <td class="small text-muted">${escapeHtml(r.formattedCreatedAt || '')}</td>
                    <td class="small text-muted">${escapeHtml(r.formattedAutoAssignTime || '--')}</td>
                    <td>${escapeHtml(r.workerName || 'Unassigned')}</td>
                    <td><span class="badge ${getStatusBadgeClass(r.status)}">${escapeHtml(r.statusLabel || r.status)}</span></td>
                    <td class="small text-muted">${escapeHtml(r.formattedEta || '--')}</td>
                    <td>
                        <span class="small fw-bold ${r.isOverdue ? 'text-danger' : 'text-dark'}">${escapeHtml(r.remainingTimeString || '--')}</span>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow">
                                <li><a class="dropdown-item mgr-action" data-act="assign" data-id="${r.requestId}" href="#"><i class="fas fa-user-plus text-primary me-2"></i> Assign Worker</a></li>
                                <li><a class="dropdown-item mgr-action" data-act="reassign" data-id="${r.requestId}" href="#"><i class="fas fa-exchange-alt text-warning me-2"></i> Reassign Worker</a></li>
                                <li><a class="dropdown-item mgr-action" data-act="priority" data-id="${r.requestId}" href="#"><i class="fas fa-flag text-danger me-2"></i> Change Priority</a></li>
                                <li><a class="dropdown-item mgr-action" data-act="eta" data-id="${r.requestId}" href="#"><i class="fas fa-clock text-info me-2"></i> Change ETA</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item mgr-action" data-act="hold" data-id="${r.requestId}" href="#"><i class="fas fa-pause text-secondary me-2"></i> Put On Hold</a></li>
                                <li><a class="dropdown-item mgr-action" data-act="resume" data-id="${r.requestId}" href="#"><i class="fas fa-play text-success me-2"></i> Resume</a></li>
                                <li><a class="dropdown-item mgr-action" data-act="override" data-id="${r.requestId}" href="#"><i class="fas fa-bolt text-warning me-2"></i> Override Assignment</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item mgr-action text-danger" data-act="cancel" data-id="${r.requestId}" href="#"><i class="fas fa-ban me-2"></i> Cancel Request</a></li>
                                <li><a class="dropdown-item mgr-action text-success" data-act="close" data-id="${r.requestId}" href="#"><i class="fas fa-check-double me-2"></i> Close Request</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `).join('');

            attachActionListeners();
        } catch (err) {
            console.error('[ManagerDashboard] Error loading queue:', err);
        }
    }

    // Setup Filter Listeners
    function setupFilterListeners() {
        const statusSel = document.getElementById('filter-mgr-status');
        const prioritySel = document.getElementById('filter-mgr-priority');
        const categorySel = document.getElementById('filter-mgr-category');
        const buildingInput = document.getElementById('filter-mgr-building');
        const dateInput = document.getElementById('filter-mgr-date');
        const resetBtn = document.getElementById('filter-mgr-reset');

        if (statusSel) statusSel.addEventListener('change', (e) => { currentFilters.status = e.target.value; loadQueue(); });
        if (prioritySel) prioritySel.addEventListener('change', (e) => { currentFilters.priority = e.target.value; loadQueue(); });
        if (categorySel) categorySel.addEventListener('change', (e) => { currentFilters.category = e.target.value; loadQueue(); });
        if (buildingInput) buildingInput.addEventListener('input', (e) => { currentFilters.building = e.target.value; loadQueue(); });
        if (dateInput) dateInput.addEventListener('change', (e) => { currentFilters.date = e.target.value; loadQueue(); });

        if (resetBtn) resetBtn.addEventListener('click', () => {
            currentFilters = { status: 'ALL', priority: 'ALL', category: 'ALL', workerId: '', building: 'ALL', date: '' };
            if (statusSel) statusSel.value = 'ALL';
            if (prioritySel) prioritySel.value = 'ALL';
            if (categorySel) categorySel.value = 'ALL';
            if (buildingInput) buildingInput.value = '';
            if (dateInput) dateInput.value = '';
            loadQueue();
        });
    }

    // Render Alerts
    function renderAlerts(alerts) {
        const container = document.getElementById('mgr-alerts-container');
        if (!container) return;

        if (!alerts || alerts.length === 0) {
            container.innerHTML = `<div class="p-3 text-muted small text-center"><i class="fas fa-check-circle text-success me-1"></i> No urgent alerts. All operations running normally.</div>`;
            return;
        }

        container.innerHTML = alerts.map(a => `
            <div class="alert ${a.severity === 'HIGH' ? 'alert-danger' : 'alert-warning'} py-2 px-3 mb-2 d-flex justify-content-between align-items-center shadow-sm">
                <div>
                    <span class="fw-bold small"><i class="fas fa-exclamation-triangle me-1"></i> ${escapeHtml(a.title)}</span>
                    <div class="small">${escapeHtml(a.message)}</div>
                </div>
                <span class="badge bg-white text-dark border small">${escapeHtml(a.formattedTime || '')}</span>
            </div>
        `).join('');
    }

    // Render Analytics
    function renderAnalytics(analytics) {
        if (!analytics) return;
        setVal('analytics-avg-assignment', analytics.avgAssignmentTime || '4m 30s');
        setVal('analytics-avg-response', analytics.avgResponseTime || '6m 15s');
        setVal('analytics-avg-completion', analytics.avgCompletionTime || '1h 20m');
        setVal('analytics-worker-utilization', (analytics.workerUtilizationRate || 78.5) + '%');
        setVal('analytics-attendance-rate', (analytics.attendanceRate || 92.0) + '%');
        setVal('analytics-overdue-rate', (analytics.overdueRate || 8.0) + '%');
        setVal('analytics-completed-count', analytics.completedRequests || 0);
        setVal('analytics-reassigned-count', analytics.reassignedRequests || 0);
    }

    // Attach Action Listeners for Audited Manual Actions
    function attachActionListeners() {
        document.querySelectorAll('.mgr-action').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const act = el.dataset.act;
                const reqId = el.dataset.id;
                handleManualAction(act, reqId);
            });
        });
    }

    // Audited Manual Action Handlers
    function handleManualAction(action, reqId) {
        switch (action) {
            case 'assign':
            case 'reassign':
            case 'override':
                promptWorkerSelection(action, reqId);
                break;
            case 'priority':
                promptPriorityChange(reqId);
                break;
            case 'eta':
                promptEtaChange(reqId);
                break;
            case 'hold':
                promptHold(reqId);
                break;
            case 'resume':
                executeSimpleAction(`/api/maintenance/manager/${reqId}/resume`, {}, 'Work Resumed');
                break;
            case 'cancel':
                promptCancel(reqId);
                break;
            case 'close':
                promptClose(reqId);
                break;
        }
    }

    function promptWorkerSelection(action, reqId) {
        const workers = (dashboardData && dashboardData.workerBoard) ? dashboardData.workerBoard : [];
        const optionsHtml = workers.map(w => `<option value="${w.workerId}">${escapeHtml(w.workerName)} (${escapeHtml(w.skill)}) - ${w.availabilityStatus}</option>`).join('');

        const isOverride = action === 'override';
        const isReassign = action === 'reassign';

        const modalHtml = `
            <div class="modal fade" id="mgrActionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">${isOverride ? 'Override Assignment' : (isReassign ? 'Reassign Worker' : 'Assign Worker')}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Select Worker:</label>
                                <select id="mgr-modal-worker" class="form-select">${optionsHtml}</select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Reason / Notes (Audited):</label>
                                <textarea id="mgr-modal-notes" class="form-control" rows="2" placeholder="Enter reason for this action..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary btn-sm" id="mgr-modal-submit">Confirm Action</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        showModal(modalHtml, async () => {
            const workerId = document.getElementById('mgr-modal-worker').value;
            const notes = document.getElementById('mgr-modal-notes').value;
            let endpoint = `/api/maintenance/manager/${reqId}/assign`;
            let payload = { workerId: parseInt(workerId), notes };

            if (isReassign) {
                endpoint = `/api/maintenance/manager/${reqId}/reassign`;
                payload = { workerId: parseInt(workerId), reason: notes || 'Manager reassigned' };
            } else if (isOverride) {
                endpoint = `/api/maintenance/manager/${reqId}/override`;
                payload = { workerId: parseInt(workerId), justification: notes || 'Manager override' };
            }

            await executeSimpleAction(endpoint, payload, 'Worker assigned successfully');
        });
    }

    function promptPriorityChange(reqId) {
        const modalHtml = `
            <div class="modal fade" id="mgrActionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">Change Request Priority</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">New Priority:</label>
                                <select id="mgr-modal-priority" class="form-select">
                                    <option value="LOW">LOW</option>
                                    <option value="MEDIUM" selected>MEDIUM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="URGENT">URGENT (Triggers immediate auto-assignment)</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Reason (Audited):</label>
                                <textarea id="mgr-modal-notes" class="form-control" rows="2" placeholder="e.g. Resident escalated urgent water leak"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger btn-sm" id="mgr-modal-submit">Update Priority</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        showModal(modalHtml, async () => {
            const priority = document.getElementById('mgr-modal-priority').value;
            const reason = document.getElementById('mgr-modal-notes').value || 'Manager priority update';
            await executeSimpleAction(`/api/maintenance/manager/${reqId}/priority`, { priority, reason }, 'Priority updated');
        });
    }

    function promptEtaChange(reqId) {
        const modalHtml = `
            <div class="modal fade" id="mgrActionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title">Adjust Request ETA</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Add Additional Minutes:</label>
                                <input type="number" id="mgr-modal-eta-mins" class="form-control" value="30" min="5" step="5">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Reason for ETA Change (Audited):</label>
                                <textarea id="mgr-modal-notes" class="form-control" rows="2" placeholder="e.g. Parts procurement delay"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-info text-white btn-sm" id="mgr-modal-submit">Update ETA</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        showModal(modalHtml, async () => {
            const additionalMinutes = parseInt(document.getElementById('mgr-modal-eta-mins').value);
            const reason = document.getElementById('mgr-modal-notes').value || 'ETA adjusted by manager';
            await executeSimpleAction(`/api/maintenance/manager/${reqId}/eta`, { additionalMinutes, reason }, 'ETA updated');
        });
    }

    function promptHold(reqId) {
        const reason = prompt('Enter reason for placing this request on hold:');
        if (reason === null) return;
        executeSimpleAction(`/api/maintenance/manager/${reqId}/hold`, { reason: reason || 'Manager placed on hold' }, 'Request put on hold');
    }

    function promptCancel(reqId) {
        const reason = prompt('Enter reason for cancelling this request:');
        if (reason === null) return;
        executeSimpleAction(`/api/maintenance/manager/${reqId}/cancel`, { reason: reason || 'Cancelled by manager' }, 'Request cancelled');
    }

    function promptClose(reqId) {
        const notes = prompt('Enter resolution notes for closing this request:');
        if (notes === null) return;
        executeSimpleAction(`/api/maintenance/manager/${reqId}/close`, { resolutionNotes: notes || 'Closed by manager' }, 'Request closed');
    }

    function showModal(html, onSubmit) {
        let existing = document.getElementById('mgrActionModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', html);
        const modalEl = document.getElementById('mgrActionModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        document.getElementById('mgr-modal-submit').addEventListener('click', async () => {
            await onSubmit();
            modal.hide();
        });
    }

    async function executeSimpleAction(url, body, successMsg) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (resp.ok) {
                showManagerToast('SUCCESS', successMsg);
                loadDashboardSummary();
            } else {
                alert('Action failed. Check console for details.');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function showManagerToast(title, message) {
        const toastContainer = document.getElementById('live-toast-container') || createToastContainer();
        const toastId = 'mgr-toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-bg-dark border-0 mb-2 shadow" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <div class="fw-bold small text-warning mb-1"><i class="fas fa-bell me-1"></i> ${escapeHtml(title)}</div>
                        <div class="small">${escapeHtml(message)}</div>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 6000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    function createToastContainer() {
        const div = document.createElement('div');
        div.id = 'live-toast-container';
        div.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        div.style.zIndex = '1090';
        document.body.appendChild(div);
        return div;
    }

    // Helpers
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getPriorityClass(p) {
        switch (p ? p.toUpperCase() : '') {
            case 'URGENT': return 'bg-danger text-white';
            case 'HIGH': return 'bg-warning text-dark';
            case 'MEDIUM': return 'bg-info text-dark';
            default: return 'bg-secondary text-white';
        }
    }

    function getStatusBadgeClass(s) {
        switch (s ? s.toUpperCase() : '') {
            case 'IN_PROGRESS': return 'bg-success text-white';
            case 'TRAVELLING': return 'bg-info text-white';
            case 'ARRIVED': return 'bg-primary text-white';
            case 'ON_HOLD': return 'bg-warning text-dark';
            case 'COMPLETED': return 'bg-success text-white';
            case 'CLOSED': return 'bg-dark text-white';
            default: return 'bg-secondary text-white';
        }
    }

    function getAttendanceBadge(s) {
        switch (s ? s.toUpperCase() : '') {
            case 'PRESENT': return 'bg-success text-white';
            case 'LATE': return 'bg-warning text-dark';
            case 'ON_LEAVE': return 'bg-danger text-white';
            case 'HALF_DAY': return 'bg-info text-dark';
            default: return 'bg-secondary text-white';
        }
    }

    function getAvailabilityBadge(s) {
        switch (s ? s.toUpperCase() : '') {
            case 'AVAILABLE': return 'bg-success text-white';
            case 'BUSY': return 'bg-warning text-dark';
            case 'ON_BREAK': return 'bg-info text-dark';
            default: return 'bg-secondary text-white';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MaintenanceManagerDashboard = {
        init,
        loadDashboardSummary,
        loadQueue
    };
})();
