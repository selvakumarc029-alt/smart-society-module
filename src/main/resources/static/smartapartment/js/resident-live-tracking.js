/**
 * Smart Apartment Resident Live Tracking Module
 * Real-time SSE-powered tracking of maintenance requests with live countdown timers,
 * 10-step status timeline, and confirmation/reopening workflows.
 */

(function () {
    'use strict';

    let eventSource = null;
    let reconnectTimeout = null;
    let reconnectDelay = 3000;
    let timerInterval = null;
    let trackingRequests = [];

    // Initialize module
    function init() {
        const container = document.getElementById('resident-live-tracking-container');
        if (!container) return;

        loadTrackingCards();
        connectSse();
        startTimerTicker();
    }

    // Connect to Server-Sent Events stream
    function connectSse() {
        if (eventSource) {
            eventSource.close();
        }

        const sseUrl = '/api/maintenance/tracking/stream/resident';
        eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('open', () => {
            console.log('[ResidentTracking] SSE stream connected.');
            reconnectDelay = 3000;
            updateConnectionStatus(true);
        });

        eventSource.addEventListener('CONNECTED', (e) => {
            console.log('[ResidentTracking] Connection established:', e.data);
            updateConnectionStatus(true);
        });

        eventSource.addEventListener('maintenance-event', (e) => {
            try {
                const event = JSON.parse(e.data);
                console.log('[ResidentTracking] Received event:', event.eventType, event);
                handleRealtimeEvent(event);
            } catch (err) {
                console.error('[ResidentTracking] Error parsing event data:', err);
            }
        });

        eventSource.addEventListener('ping', () => {
            // Heartbeat received
        });

        eventSource.addEventListener('error', () => {
            console.warn('[ResidentTracking] SSE connection lost. Reconnecting in', reconnectDelay, 'ms');
            updateConnectionStatus(false);
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
                connectSse();
            }, reconnectDelay);
        });
    }

    function updateConnectionStatus(isConnected) {
        const badge = document.getElementById('tracking-live-beacon');
        if (badge) {
            badge.className = isConnected ? 'badge bg-success-subtle text-success border border-success' : 'badge bg-warning-subtle text-warning border border-warning';
            badge.innerHTML = isConnected ? '<i class="fas fa-circle text-success me-1 fa-beat" style="font-size: 8px;"></i> LIVE UPDATES' : '<i class="fas fa-circle text-warning me-1" style="font-size: 8px;"></i> RECONNECTING...';
        }
    }

    // Handle real-time event without full page reload
    function handleRealtimeEvent(event) {
        if (!event) return;

        // If request already displayed, update its data or refresh active cards
        loadTrackingCards();

        // Show toast notification
        showToast(event.eventType, event.message || 'Maintenance request status updated');
    }

    // Fetch active tracking cards
    async function loadTrackingCards() {
        const container = document.getElementById('resident-live-tracking-cards');
        if (!container) return;

        try {
            const resp = await fetch('/api/maintenance/tracking/active');
            if (!resp.ok) {
                if (resp.status === 401) return;
                throw new Error('Failed to load tracking data');
            }
            trackingRequests = await resp.json();
            renderTrackingCards(trackingRequests);
        } catch (err) {
            console.error('[ResidentTracking] Failed to load cards:', err);
        }
    }

    // Render cards
    function renderTrackingCards(cards) {
        const container = document.getElementById('resident-live-tracking-cards');
        if (!container) return;

        if (!cards || cards.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-tools fa-2x mb-2 text-secondary opacity-50"></i>
                    <p class="mb-0">No active maintenance requests being tracked right now.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cards.map(card => renderSingleCard(card)).join('');
        attachCardListeners();
    }

    function renderSingleCard(card) {
        const isCompleted = card.currentStatus === 'COMPLETED' || card.currentStatus === 'RESIDENT_CONFIRMATION';
        const isClosed = card.currentStatus === 'CLOSED';

        return `
            <div class="card shadow-sm border-0 mb-4 tracking-card" id="tracking-card-${card.requestId}" data-req-id="${card.requestId}">
                <div class="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary fs-6 px-3 py-2">${escapeHtml(card.requestNumber)}</span>
                        <span class="badge bg-info-subtle text-info border border-info">${escapeHtml(card.service)}</span>
                        <span class="badge ${getPriorityBadgeClass(card.priority)}">${escapeHtml(card.priority)}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge ${getStatusBadgeClass(card.currentStatus)} fs-6 py-2 px-3">
                            ${escapeHtml(card.statusBadge || card.currentStatus)}
                        </span>
                    </div>
                </div>

                <div class="card-body">
                    <div class="row g-3">
                        <!-- Problem & Location Details -->
                        <div class="col-lg-4 col-md-6 border-end-md">
                            <h6 class="fw-bold text-dark mb-1">${escapeHtml(card.problem)}</h6>
                            <p class="text-muted small mb-3">${escapeHtml(card.description || 'No description provided.')}</p>
                            
                            <div class="small text-secondary mb-2">
                                <i class="fas fa-building me-1 text-primary"></i> <strong>Location:</strong> ${escapeHtml(card.buildingName || '')} - Unit ${escapeHtml(card.apartmentUnit || '')}
                            </div>

                            <div class="p-3 bg-light rounded-3 mt-3">
                                <div class="d-flex align-items-center justify-content-between mb-1">
                                    <span class="small text-muted">Assigned Technician:</span>
                                    <span class="small fw-bold text-dark">${escapeHtml(card.assignedWorkerName || 'Assigning...')}</span>
                                </div>
                                ${card.assignedWorkerPhone ? `
                                <div class="d-flex align-items-center justify-content-between">
                                    <span class="small text-muted">Contact:</span>
                                    <a href="tel:${escapeHtml(card.assignedWorkerPhone)}" class="small text-primary text-decoration-none fw-semibold">
                                        <i class="fas fa-phone-alt me-1"></i> ${escapeHtml(card.assignedWorkerPhone)}
                                    </a>
                                </div>` : ''}
                            </div>
                        </div>

                        <!-- Live Timer & ETA -->
                        <div class="col-lg-4 col-md-6 border-end-lg">
                            <div class="text-center p-3 rounded-3 ${card.isOverdue ? 'bg-danger-subtle border border-danger' : 'bg-primary-subtle border border-primary-subtle'}">
                                <span class="small text-uppercase fw-bold ${card.isOverdue ? 'text-danger' : 'text-primary'}">
                                    ${card.isOverdue ? '⚠️ Work Overdue' : '⏱️ Estimated Remaining Time'}
                                </span>
                                <div class="fs-2 fw-bold mt-1 ${card.isOverdue ? 'text-danger' : 'text-dark'}" id="timer-display-${card.requestId}">
                                    ${escapeHtml(card.remainingTimeString || '--')}
                                </div>
                                <div class="small text-muted mt-1">
                                    ${card.estimatedEndTime ? `Expected End: ${new Date(card.estimatedEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Schedule pending'}
                                </div>
                            </div>

                            <div class="mt-3">
                                <div class="small text-muted mb-1"><i class="fas fa-info-circle me-1 text-info"></i> Latest Activity:</div>
                                <div class="p-2 bg-white border rounded small text-dark">${escapeHtml(card.latestActivity || 'Request registered.')}</div>
                            </div>

                            <!-- Resident Actions -->
                            <div class="mt-3 d-flex flex-wrap gap-2">
                                ${card.canConfirm ? `
                                    <button class="btn btn-success btn-sm flex-fill confirm-completion-btn" data-id="${card.requestId}" data-num="${escapeHtml(card.requestNumber)}">
                                        <i class="fas fa-check-circle me-1"></i> Confirm & Close
                                    </button>
                                ` : ''}
                                ${card.canReopen ? `
                                    <button class="btn btn-warning btn-sm flex-fill reopen-req-btn" data-id="${card.requestId}" data-num="${escapeHtml(card.requestNumber)}">
                                        <i class="fas fa-redo me-1"></i> Request Rework
                                    </button>
                                ` : ''}
                                ${card.canCancel ? `
                                    <button class="btn btn-outline-danger btn-sm cancel-req-btn" data-id="${card.requestId}">
                                        <i class="fas fa-times me-1"></i> Cancel
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <!-- 10-Step Timeline -->
                        <div class="col-lg-4 col-12">
                            <h6 class="fw-bold small text-muted text-uppercase mb-2">Service Lifecycle Progress</h6>
                            <div class="tracking-timeline">
                                ${(card.timeline || []).map(step => renderTimelineStep(step)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderTimelineStep(step) {
        let stateClass = 'pending';
        let icon = 'far fa-circle';

        if (step.completed) {
            stateClass = 'completed';
            icon = 'fas fa-check-circle text-success';
        } else if (step.active) {
            stateClass = 'active';
            icon = 'fas fa-spinner fa-spin text-primary';
        }

        return `
            <div class="timeline-step ${stateClass} d-flex align-items-start gap-2 mb-2">
                <div class="timeline-icon mt-1">
                    <i class="${icon}"></i>
                </div>
                <div class="timeline-content flex-grow-1">
                    <div class="d-flex justify-content-between align-items-baseline">
                        <span class="small fw-bold ${step.active ? 'text-primary' : (step.completed ? 'text-dark' : 'text-muted')}">
                            ${escapeHtml(step.title)}
                        </span>
                        ${step.formattedTime ? `<span class="badge bg-light text-secondary border" style="font-size: 10px;">${escapeHtml(step.formattedTime)}</span>` : ''}
                    </div>
                    <div class="text-muted" style="font-size: 11px;">${escapeHtml(step.description || '')}</div>
                </div>
            </div>
        `;
    }

    // Dynamic timer ticker (updates countdowns every 10 seconds without server roundtrip)
    function startTimerTicker() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const now = new Date();
            trackingRequests.forEach(req => {
                if (!req.estimatedEndTime) return;
                const el = document.getElementById(`timer-display-${req.requestId}`);
                if (!el) return;

                const end = new Date(req.estimatedEndTime);
                const diffMs = end - now;
                const diffMins = Math.round(diffMs / 60000);

                if (diffMins > 0) {
                    el.textContent = `${diffMins} mins remaining`;
                    el.className = 'fs-2 fw-bold mt-1 text-dark';
                } else if (diffMins === 0) {
                    el.textContent = `Due right now`;
                    el.className = 'fs-2 fw-bold mt-1 text-warning';
                } else {
                    const overdueMins = Math.abs(diffMins);
                    el.textContent = `Overdue by ${overdueMins} mins`;
                    el.className = 'fs-2 fw-bold mt-1 text-danger';
                }
            });
        }, 10000);
    }

    function attachCardListeners() {
        // Confirm completion
        document.querySelectorAll('.confirm-completion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reqId = btn.dataset.id;
                const reqNum = btn.dataset.num;
                showConfirmModal(reqId, reqNum);
            });
        });

        // Reopen request
        document.querySelectorAll('.reopen-req-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reqId = btn.dataset.id;
                const reqNum = btn.dataset.num;
                showReopenModal(reqId, reqNum);
            });
        });

        // Cancel request
        document.querySelectorAll('.cancel-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                if (!confirm('Are you sure you want to cancel this maintenance request?')) return;
                try {
                    const resp = await fetch(`/api/maintenance/requests/${reqId}/cancel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: 'Cancelled by resident' })
                    });
                    if (resp.ok) {
                        showToast('CANCELLED', 'Request cancelled successfully');
                        loadTrackingCards();
                    } else {
                        alert('Unable to cancel request');
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });
    }

    // Modals for Confirmation and Reopen
    function showConfirmModal(reqId, reqNum) {
        const modalHtml = `
            <div class="modal fade" id="confirmCompletionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title"><i class="fas fa-star me-2"></i> Confirm Completion: ${escapeHtml(reqNum)}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted">Please rate your satisfaction with the service provided:</p>
                            <div class="mb-3 text-center">
                                <div class="rating-stars fs-3 text-warning" id="confirm-rating-stars">
                                    <i class="far fa-star rating-star" data-val="1"></i>
                                    <i class="far fa-star rating-star" data-val="2"></i>
                                    <i class="far fa-star rating-star" data-val="3"></i>
                                    <i class="far fa-star rating-star" data-val="4"></i>
                                    <i class="far fa-star rating-star" data-val="5"></i>
                                </div>
                                <input type="hidden" id="selected-rating-val" value="5">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold">Feedback / Comments (Optional):</label>
                                <textarea id="confirm-feedback-text" class="form-control" rows="3" placeholder="Great service, thank you!"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success btn-sm" id="submit-confirm-btn">Confirm & Close Request</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let existing = document.getElementById('confirmCompletionModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('confirmCompletionModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Star rating clicks
        const stars = modalEl.querySelectorAll('.rating-star');
        stars.forEach(s => {
            s.addEventListener('click', () => {
                const val = parseInt(s.dataset.val);
                document.getElementById('selected-rating-val').value = val;
                stars.forEach((st, idx) => {
                    if (idx < val) {
                        st.className = 'fas fa-star rating-star text-warning';
                    } else {
                        st.className = 'far fa-star rating-star text-warning';
                    }
                });
            });
        });
        // Default to 5 stars
        stars.forEach(st => st.className = 'fas fa-star rating-star text-warning');

        document.getElementById('submit-confirm-btn').addEventListener('click', async () => {
            const rating = parseInt(document.getElementById('selected-rating-val').value);
            const feedback = document.getElementById('confirm-feedback-text').value;

            try {
                const resp = await fetch(`/api/maintenance/tracking/${reqId}/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rating, feedback })
                });

                if (resp.ok) {
                    modal.hide();
                    showToast('CLOSED', 'Request closed successfully! Thank you for your feedback.');
                    loadTrackingCards();
                } else {
                    alert('Failed to confirm request');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    function showReopenModal(reqId, reqNum) {
        const modalHtml = `
            <div class="modal fade" id="reopenRequestModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title"><i class="fas fa-redo me-2"></i> Request Rework: ${escapeHtml(reqNum)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted">If the issue was not fully resolved, describe what is still needed:</p>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold">Reason for Rework (Required):</label>
                                <textarea id="reopen-reason-text" class="form-control" rows="3" placeholder="e.g. Tap is still leaking slightly from the joint..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-warning btn-sm" id="submit-reopen-btn">Submit Rework Request</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        let existing = document.getElementById('reopenRequestModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('reopenRequestModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        document.getElementById('submit-reopen-btn').addEventListener('click', async () => {
            const reason = document.getElementById('reopen-reason-text').value;
            if (!reason || !reason.trim()) {
                alert('Please enter a reason for reopening');
                return;
            }

            try {
                const resp = await fetch(`/api/maintenance/tracking/${reqId}/reopen`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: reason.trim() })
                });

                if (resp.ok) {
                    modal.hide();
                    showToast('REOPENED', 'Rework request submitted. A technician will be assigned.');
                    loadTrackingCards();
                } else {
                    alert('Failed to reopen request');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    function showToast(title, message) {
        // Bootstrap toast or custom notification
        const toastContainer = document.getElementById('live-toast-container') || createToastContainer();
        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-bg-dark border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
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

    function getPriorityBadgeClass(p) {
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

    // Auto-initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ResidentLiveTracking = {
        init,
        loadTrackingCards,
        connectSse
    };
})();
