/**
 * Resident Maintenance Service Request Module
 * Handles request creation, validation, listing, filtering, details, timeline history,
 * cancellation, and reopening.
 */
(() => {
    let currentFilter = 'all';
    let requestsCache = [];
    let currentDetailRequest = null;

    const STATUS_BADGE_MAP = {
        REQUESTED: { bg: 'bg-primary', text: 'text-white', icon: 'fa-paper-plane', label: 'Requested' },
        AUTO_ASSIGN_PENDING: { bg: 'bg-info', text: 'text-dark', icon: 'fa-robot', label: 'Auto-Assign Pending' },
        ASSIGNED: { bg: 'bg-info', text: 'text-white', icon: 'fa-user-check', label: 'Assigned' },
        WORKER_ACCEPTED: { bg: 'bg-primary', text: 'text-white', icon: 'fa-thumbs-up', label: 'Worker Accepted' },
        TRAVELLING: { bg: 'bg-warning', text: 'text-dark', icon: 'fa-motorcycle', label: 'Travelling' },
        ARRIVED: { bg: 'bg-warning', text: 'text-dark', icon: 'fa-location-dot', label: 'Arrived' },
        IN_PROGRESS: { bg: 'bg-warning', text: 'text-dark', icon: 'fa-screwdriver-wrench', label: 'In Progress' },
        ON_HOLD: { bg: 'bg-secondary', text: 'text-white', icon: 'fa-pause', label: 'On Hold' },
        COMPLETED: { bg: 'bg-success', text: 'text-white', icon: 'fa-circle-check', label: 'Completed' },
        RESIDENT_CONFIRMATION: { bg: 'bg-info', text: 'text-dark', icon: 'fa-clipboard-check', label: 'Resident Confirmation' },
        CLOSED: { bg: 'bg-dark', text: 'text-white', icon: 'fa-lock', label: 'Closed' },
        CANCELLED: { bg: 'bg-danger', text: 'text-white', icon: 'fa-ban', label: 'Cancelled' },
        REOPENED: { bg: 'bg-warning', text: 'text-dark', icon: 'fa-rotate-left', label: 'Reopened' },
        WAITING_FOR_WORKER: { bg: 'bg-secondary', text: 'text-white', icon: 'fa-clock', label: 'Waiting for Worker' },
        OVERDUE: { bg: 'bg-danger', text: 'text-white', icon: 'fa-triangle-exclamation', label: 'Overdue' }
    };

    const PRIORITY_BADGE_MAP = {
        LOW: { bg: 'bg-secondary bg-opacity-10 text-secondary border border-secondary', label: 'Low' },
        MEDIUM: { bg: 'bg-info bg-opacity-10 text-info border border-info', label: 'Medium' },
        HIGH: { bg: 'bg-warning bg-opacity-10 text-dark border border-warning', label: 'High' },
        URGENT: { bg: 'bg-danger bg-opacity-10 text-danger border border-danger fw-bold', label: 'URGENT' }
    };

    function esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[c]));
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function formatDateTime(dtStr) {
        if (!dtStr) return '—';
        try {
            const d = new Date(dtStr);
            return d.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dtStr;
        }
    }

    async function loadRequests(filter = currentFilter) {
        currentFilter = filter;
        const tbody = document.getElementById('maintenanceRequestsTbody');
        const emptyState = document.getElementById('maintenanceEmptyState');
        const loadingSpinner = document.getElementById('maintenanceLoadingSpinner');

        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (tbody) tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';

        try {
            const res = await fetch(`/api/maintenance/requests?filter=${encodeURIComponent(filter)}`);
            if (!res.ok) throw new Error('Failed to load maintenance requests');
            const data = await res.json();
            requestsCache = Array.isArray(data) ? data : [];

            // Update KPI counts
            updateStatsCounters();

            // Render table
            renderTable(requestsCache);
        } catch (err) {
            console.error('Error loading requests:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i class="fa-solid fa-triangle-exclamation me-2"></i>${esc(err.message)}</td></tr>`;
            }
        } finally {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
    }

    function updateStatsCounters() {
        // Fetch all to update overall stats
        fetch('/api/maintenance/requests?filter=all')
            .then(r => r.ok ? r.json() : [])
            .then(all => {
                const totalCount = all.length;
                const activeCount = all.filter(r => ![ 'COMPLETED', 'CLOSED', 'CANCELLED' ].includes(r.status)).length;
                const completedCount = all.filter(r => [ 'COMPLETED', 'CLOSED' ].includes(r.status)).length;

                const totalEl = document.getElementById('statTotalRequests');
                const activeEl = document.getElementById('statActiveRequests');
                const completedEl = document.getElementById('statCompletedRequests');

                if (totalEl) totalEl.textContent = totalCount;
                if (activeEl) activeEl.textContent = activeCount;
                if (completedEl) completedEl.textContent = completedCount;
            })
            .catch(err => console.warn('Could not update stats counters:', err));
    }

    function renderTable(requests) {
        const tbody = document.getElementById('maintenanceRequestsTbody');
        const emptyState = document.getElementById('maintenanceEmptyState');
        if (!tbody) return;

        if (!requests || requests.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = requests.map(req => {
            const statusConfig = STATUS_BADGE_MAP[req.status] || { bg: 'bg-secondary', text: 'text-white', icon: 'fa-circle-info', label: req.status || 'Unknown' };
            const priorityConfig = PRIORITY_BADGE_MAP[req.priority] || { bg: 'bg-light text-dark', label: req.priority || 'Normal' };

            const canCancel = req.eligibleForCancellation;
            const canReopen = req.eligibleForReopen;

            return `
                <tr class="align-middle">
                    <td>
                        <strong class="text-primary font-monospace" style="font-size:0.92rem;">${esc(req.requestNumber)}</strong>
                        <div class="small text-muted">${esc(req.apartmentUnit || 'Unit')} &bull; ${esc(req.buildingName || 'Block')}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border px-2 py-1">${esc(req.category)}</span>
                        <div class="small text-muted mt-1">${esc(req.serviceType)}</div>
                    </td>
                    <td>
                        <strong class="text-dark d-block" style="max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(req.title)}</strong>
                        <span class="small text-muted d-block text-truncate" style="max-width:240px;">${esc(req.description)}</span>
                    </td>
                    <td>
                        <span class="badge ${priorityConfig.bg} px-2 py-1 rounded-pill">${priorityConfig.label}</span>
                    </td>
                    <td>
                        <span class="small text-dark fw-semibold">${formatDate(req.createdAt)}</span>
                        <div class="text-muted" style="font-size:0.75rem;">${formatDateTime(req.createdAt).split(',')[1] || ''}</div>
                    </td>
                    <td>
                        <span class="badge ${statusConfig.bg} ${statusConfig.text} px-3 py-2 rounded-pill shadow-xs d-inline-flex align-items-center gap-1">
                            <i class="fa-solid ${statusConfig.icon}"></i> ${statusConfig.label}
                        </span>
                        ${req.status === 'AUTO_ASSIGN_PENDING' && req.autoAssignDeadline ? `
                            <div class="mt-1">
                                <span class="badge bg-warning bg-opacity-25 text-dark border border-warning px-2 py-1 rounded-pill small auto-assign-timer" data-deadline="${req.autoAssignDeadline}">
                                    <i class="fa-solid fa-clock me-1 text-warning"></i>Auto assigning in <span class="countdown-text">--:--</span>
                                </span>
                            </div>
                        ` : ''}
                        ${req.status === 'WAITING_FOR_WORKER' ? `
                            <div class="mt-1">
                                <span class="badge bg-secondary bg-opacity-25 text-dark border border-secondary px-2 py-1 rounded-pill small">
                                    <i class="fa-solid fa-hourglass-half me-1 text-secondary"></i>In Queue (Waiting for Worker)
                                </span>
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        ${req.assignedWorkerName ? `
                            <strong class="d-block small text-dark"><i class="fa-solid fa-user-gear text-primary me-1"></i>${esc(req.assignedWorkerName)}</strong>
                            ${req.assignedWorkerPhone ? `<span class="small text-muted">${esc(req.assignedWorkerPhone)}</span>` : ''}
                        ` : '<span class="badge bg-light text-muted border">Unassigned</span>'}
                    </td>
                    <td>
                        ${req.estimatedEndTime ? `
                            <span class="small text-dark fw-semibold">${formatDateTime(req.estimatedEndTime)}</span>
                        ` : (req.preferredDate ? `<span class="small text-muted">Pref: ${formatDate(req.preferredDate)}</span>` : '<span class="text-muted small">Pending</span>')}
                    </td>
                    <td>
                        <div class="d-flex gap-1 flex-wrap">
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold" onclick="window.ResidentMaintenance.viewDetails(${req.id})">
                                <i class="fa-solid fa-eye me-1"></i>Details
                            </button>
                            ${canCancel ? `
                                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" title="Cancel Request" onclick="window.ResidentMaintenance.cancelRequest(${req.id})">
                                    <i class="fa-solid fa-ban"></i>
                                </button>
                            ` : ''}
                            ${canReopen ? `
                                <button type="button" class="btn btn-sm btn-outline-warning rounded-pill px-2" title="Reopen Request" onclick="window.ResidentMaintenance.reopenRequest(${req.id})">
                                    <i class="fa-solid fa-rotate-left"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterRequests(searchQuery) {
        if (!searchQuery || searchQuery.trim() === '') {
            renderTable(requestsCache);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        const filtered = requestsCache.filter(r =>
            (r.requestNumber && r.requestNumber.toLowerCase().includes(q)) ||
            (r.category && r.category.toLowerCase().includes(q)) ||
            (r.serviceType && r.serviceType.toLowerCase().includes(q)) ||
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.description && r.description.toLowerCase().includes(q)) ||
            (r.assignedWorkerName && r.assignedWorkerName.toLowerCase().includes(q))
        );
        renderTable(filtered);
    }

    function openCreateModal() {
        const form = document.getElementById('createMaintenanceRequestForm');
        if (form) form.reset();

        const previewId = document.getElementById('reqPreviewNumber');
        if (previewId) {
            const currentYear = new Date().getFullYear();
            previewId.textContent = `MR-${currentYear}-AUTO`;
        }

        const dateInput = document.getElementById('reqPreferredDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            dateInput.min = today;
        }

        const imgPreview = document.getElementById('reqImagePreview');
        if (imgPreview) {
            imgPreview.style.display = 'none';
            imgPreview.src = '';
        }

        const alertEl = document.getElementById('createReqValidationAlert');
        if (alertEl) alertEl.style.display = 'none';

        const modal = document.getElementById('createMaintenanceRequestModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    function closeCreateModal() {
        const modal = document.getElementById('createMaintenanceRequestModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const alertEl = document.getElementById('createReqValidationAlert');
        const submitBtn = document.getElementById('submitReqBtn');

        const category = document.getElementById('reqCategory')?.value;
        const serviceType = document.getElementById('reqServiceType')?.value;
        const title = document.getElementById('reqTitle')?.value;
        const description = document.getElementById('reqDescription')?.value;
        const priority = document.getElementById('reqPriority')?.value || 'MEDIUM';
        const preferredDate = document.getElementById('reqPreferredDate')?.value;
        const preferredTime = document.getElementById('reqPreferredTime')?.value;
        const notes = document.getElementById('reqNotes')?.value;
        const fileInput = document.getElementById('reqImageFile');

        // Validation
        const errors = [];
        if (!category || category.trim() === '') errors.push('Please select a valid Service Category.');
        if (!serviceType || serviceType.trim() === '') errors.push('Service Type is required.');
        if (!title || title.trim() === '') errors.push('Problem Title is required.');
        if (!description || description.trim() === '') errors.push('Description is required.');
        if (!priority || priority.trim() === '') errors.push('Priority is required.');

        if (errors.length > 0) {
            if (alertEl) {
                alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>${errors.join('<br>')}`;
                alertEl.style.display = 'block';
            }
            return;
        }

        if (alertEl) alertEl.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
        }

        try {
            let imageUrl = null;

            // Handle image upload if selected
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const upRes = await fetch('/api/maintenance/requests/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    if (upRes.ok) {
                        const upData = await upRes.json();
                        imageUrl = upData.imageUrl;
                    }
                } catch (upErr) {
                    console.warn('Image upload failed, proceeding without image:', upErr);
                }
            }

            const payload = {
                category: category.trim(),
                serviceType: serviceType.trim(),
                title: title.trim(),
                description: description.trim(),
                priority: priority.trim(),
                preferredDate: preferredDate || null,
                preferredTime: preferredTime || null,
                imageUrl: imageUrl,
                notes: notes ? notes.trim() : null
            };

            const response = await fetch('/api/maintenance/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to create maintenance request');
            }

            const created = await response.json();
            closeCreateModal();

            // Show success toast / alert
            showSuccessNotification(`Service Request ${created.requestNumber} submitted successfully! Current status: REQUESTED.`);

            // Reload requests list
            await loadRequests('all');

            // Switch filter tab to "All"
            document.querySelectorAll('[data-maint-filter]').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.maintFilter === 'all');
            });

        } catch (err) {
            console.error('Error submitting request:', err);
            if (alertEl) {
                alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>${esc(err.message)}`;
                alertEl.style.display = 'block';
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Submit Request';
            }
        }
    }

    async function viewDetails(id) {
        const modal = document.getElementById('maintenanceRequestDetailsModal');
        const content = document.getElementById('maintDetailsContent');
        if (!modal || !content) return;

        modal.style.display = 'flex';
        content.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <h6>Loading Request Details & History...</h6>
            </div>
        `;

        try {
            const res = await fetch(`/api/maintenance/requests/${id}`);
            if (!res.ok) throw new Error('Could not load request details');
            const data = await res.json();
            currentDetailRequest = data;

            renderDetailsView(data);
        } catch (err) {
            content.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i>${esc(err.message)}</div>`;
        }
    }

    function renderDetailsView(req) {
        const content = document.getElementById('maintDetailsContent');
        if (!content) return;

        const statusConfig = STATUS_BADGE_MAP[req.status] || { bg: 'bg-secondary', text: 'text-white', icon: 'fa-circle-info', label: req.status };
        const priorityConfig = PRIORITY_BADGE_MAP[req.priority] || { bg: 'bg-light text-dark', label: req.priority };

        content.innerHTML = `
            <!-- Header Summary Card -->
            <div class="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-light">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h4 class="fw-bold mb-0 text-dark font-monospace">${esc(req.requestNumber)}</h4>
                            <span class="badge ${statusConfig.bg} ${statusConfig.text} px-3 py-2 rounded-pill">
                                <i class="fa-solid ${statusConfig.icon} me-1"></i>${statusConfig.label}
                            </span>
                            <span class="badge ${priorityConfig.bg} px-3 py-2 rounded-pill">${priorityConfig.label}</span>
                        </div>
                        <div class="text-muted small mt-1">
                            Created: <strong>${formatDateTime(req.createdAt)}</strong> &bull; Apartment: <strong>${esc(req.apartmentUnit)} (${esc(req.buildingName)})</strong>
                        </div>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button type="button" class="btn btn-primary btn-sm rounded-pill px-3 fw-bold" onclick="window.openMaintenanceLiveTracking ? window.openMaintenanceLiveTracking(${req.id}, '${esc(req.requestNumber)}') : null">
                            <i class="fa-solid fa-satellite-dish me-1"></i>Live Journey & Rating
                        </button>
                        ${req.eligibleForCancellation ? `
                            <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold" onclick="window.ResidentMaintenance.cancelRequest(${req.id})">
                                <i class="fa-solid fa-ban me-1"></i>Cancel Request
                            </button>
                        ` : ''}
                        ${req.eligibleForReopen ? `
                            <button type="button" class="btn btn-outline-warning btn-sm rounded-pill px-3 fw-bold" onclick="window.ResidentMaintenance.reopenRequest(${req.id})">
                                <i class="fa-solid fa-rotate-left me-1"></i>Reopen Request
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small text-muted fw-bold">Resolution Progress</span>
                        <span class="small fw-bold text-primary">${req.progressPercentage}%</span>
                    </div>
                    <div class="progress" style="height: 8px; border-radius: 999px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: ${req.progressPercentage}%"></div>
                    </div>
                </div>
            </div>

            ${req.status === 'AUTO_ASSIGN_PENDING' && req.autoAssignDeadline ? `
                <div class="alert alert-warning d-flex align-items-center gap-2 mb-4 rounded-4 shadow-sm">
                    <i class="fa-solid fa-robot fa-xl text-warning"></i>
                    <div>
                        <strong class="text-dark">Auto-Assignment in Progress:</strong>
                        <span class="text-muted">The system is searching for the most suitable available technician.</span>
                        <div class="mt-1">
                            <span class="badge bg-warning text-dark px-3 py-1.5 rounded-pill auto-assign-timer" data-deadline="${req.autoAssignDeadline}">
                                <i class="fa-solid fa-clock me-1"></i>Auto assigning in <span class="countdown-text">--:--</span>
                            </span>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${req.status === 'WAITING_FOR_WORKER' ? `
                <div class="alert alert-secondary d-flex align-items-center gap-2 mb-4 rounded-4 shadow-sm">
                    <i class="fa-solid fa-hourglass-half fa-xl text-secondary"></i>
                    <div>
                        <strong class="text-dark">Queued: Waiting for Worker</strong>
                        <div class="text-muted small">All qualified technicians are currently occupied. Your request has been queued by priority and will be assigned immediately when a technician becomes available.</div>
                    </div>
                </div>
            ` : ''}

            <!-- 2-Column Info Grid -->
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <div class="card border border-light-subtle rounded-4 p-3 h-100 bg-white">
                        <h6 class="fw-bold text-dark mb-3"><i class="fa-solid fa-screwdriver-wrench text-primary me-2"></i>Service Information</h6>
                        <div class="mb-2"><span class="text-muted small d-block">Service Category:</span><strong>${esc(req.category)}</strong></div>
                        <div class="mb-2"><span class="text-muted small d-block">Service Type:</span><strong>${esc(req.serviceType)}</strong></div>
                        <div class="mb-2"><span class="text-muted small d-block">Problem Title:</span><strong>${esc(req.title)}</strong></div>
                        <div class="mb-2"><span class="text-muted small d-block">Problem Description:</span><p class="mb-0 small text-secondary bg-light p-2 rounded-3">${esc(req.description)}</p></div>
                        ${req.notes ? `<div class="mb-2"><span class="text-muted small d-block">Additional Notes:</span><p class="mb-0 small text-secondary">${esc(req.notes)}</p></div>` : ''}
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card border border-light-subtle rounded-4 p-3 h-100 bg-white">
                        <h6 class="fw-bold text-dark mb-3"><i class="fa-solid fa-user-gear text-primary me-2"></i>Assignment & Schedule</h6>
                        <div class="mb-2">
                            <span class="text-muted small d-block">Assigned Worker:</span>
                            ${req.assignedWorkerName ? `
                                <strong>${esc(req.assignedWorkerName)}</strong>
                                ${req.assignedWorkerPhone ? `<span class="text-muted small ms-2"><i class="fa-solid fa-phone me-1"></i>${esc(req.assignedWorkerPhone)}</span>` : ''}
                            ` : '<span class="badge bg-light text-muted border">Pending Staff Assignment</span>'}
                        </div>
                        <div class="mb-2"><span class="text-muted small d-block">Preferred Schedule:</span><span>${formatDate(req.preferredDate)} &bull; ${esc(req.preferredTime || 'Anytime')}</span></div>
                        <div class="mb-2"><span class="text-muted small d-block">Estimated Duration:</span><span>${esc(req.estimatedDuration || 'Pending Assessment')}</span></div>
                        <div class="mb-2"><span class="text-muted small d-block">Estimated Completion:</span><span>${formatDateTime(req.estimatedEndTime)}</span></div>
                        ${req.imageUrl ? `
                            <div class="mt-2">
                                <span class="text-muted small d-block mb-1">Attached Image:</span>
                                <a href="${esc(req.imageUrl)}" target="_blank" rel="noopener">
                                    <img src="${esc(req.imageUrl)}" alt="Attached Media" class="img-thumbnail rounded-3" style="max-height: 120px; object-fit: cover;">
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Activity History / Timeline -->
            <div class="card border border-light-subtle rounded-4 p-4 bg-white">
                <h6 class="fw-bold text-dark mb-3"><i class="fa-solid fa-timeline text-primary me-2"></i>Activity History & Timeline</h6>
                ${(!req.history || req.history.length === 0) ? `
                    <p class="text-muted small mb-0">No status history recorded yet.</p>
                ` : `
                    <div class="timeline-container position-relative ps-4" style="border-left: 2px solid #e2e8f0; margin-left: 12px;">
                        ${req.history.map(item => `
                            <div class="timeline-item position-relative mb-3">
                                <div class="timeline-dot position-absolute" style="left: -23px; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 3px solid #fff; box-shadow: 0 0 0 2px #93c5fd;"></div>
                                <div class="d-flex justify-content-between align-items-baseline">
                                    <strong class="text-dark small">${esc(item.newStatus)}</strong>
                                    <span class="text-muted" style="font-size:0.75rem;">${formatDateTime(item.createdAt)}</span>
                                </div>
                                <div class="small text-muted">Changed by: <strong>${esc(item.changedBy || 'System')}</strong></div>
                                ${item.reason ? `<div class="small text-secondary mt-1 fst-italic">"${esc(item.reason)}"</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }

    function closeDetailsModal() {
        const modal = document.getElementById('maintenanceRequestDetailsModal');
        if (modal) modal.style.display = 'none';
    }

    async function cancelRequest(id) {
        const reason = prompt('Please enter a reason for cancelling this request:');
        if (reason === null) return; // cancelled prompt

        try {
            const res = await fetch(`/api/maintenance/requests/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason.trim() })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to cancel request');
            }

            showSuccessNotification('Request cancelled successfully.');
            await loadRequests(currentFilter);
            if (currentDetailRequest && currentDetailRequest.id === id) {
                viewDetails(id);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    async function reopenRequest(id) {
        const reason = prompt('Please enter a reason for reopening this request:');
        if (reason === null) return;

        try {
            const res = await fetch(`/api/maintenance/requests/${id}/reopen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason.trim() })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to reopen request');
            }

            showSuccessNotification('Request reopened successfully. Our maintenance team has been notified.');
            await loadRequests(currentFilter);
            if (currentDetailRequest && currentDetailRequest.id === id) {
                viewDetails(id);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    function showSuccessNotification(message) {
        if (typeof showToast === 'function') {
            showToast(message);
        } else {
            const alertBox = document.createElement('div');
            alertBox.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 end-0 m-4 shadow-lg';
            alertBox.style.zIndex = '9999';
            alertBox.innerHTML = `
                <i class="fa-solid fa-circle-check me-2"></i>${esc(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(alertBox);
            setTimeout(() => alertBox.remove(), 5000);
        }
    }

    // Expose public API
    window.ResidentMaintenance = {
        loadRequests,
        filterRequests,
        openCreateModal,
        closeCreateModal,
        handleFormSubmit,
        viewDetails,
        closeDetailsModal,
        cancelRequest,
        reopenRequest
    };

    // Auto-init on page load
    document.addEventListener('DOMContentLoaded', () => {
        // Wire up search bar
        const searchInput = document.getElementById('maintenanceSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => filterRequests(e.target.value));
        }

        // Wire up filter tabs
        document.querySelectorAll('[data-maint-filter]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('[data-maint-filter]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadRequests(tab.dataset.maintFilter);
            });
        });

        // Wire up image preview
        const fileInput = document.getElementById('reqImageFile');
        const imgPreview = document.getElementById('reqImagePreview');
        if (fileInput && imgPreview) {
            fileInput.addEventListener('change', () => {
                const file = fileInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imgPreview.src = e.target.result;
                        imgPreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    imgPreview.src = '';
                    imgPreview.style.display = 'none';
                }
            });
        }

        // Initial fetch
        loadRequests('all');

        // Start countdown ticker for auto-assign pending requests
        startCountdownTicker();
    });

    function startCountdownTicker() {
        setInterval(() => {
            const timers = document.querySelectorAll('.auto-assign-timer');
            timers.forEach(el => {
                const deadlineStr = el.getAttribute('data-deadline');
                if (!deadlineStr) return;
                const deadline = new Date(deadlineStr).getTime();
                const now = new Date().getTime();
                const diff = deadline - now;
                const span = el.querySelector('.countdown-text');
                if (!span) return;

                if (diff <= 0) {
                    span.textContent = '00:00';
                    if (!el.getAttribute('data-refreshed')) {
                        el.setAttribute('data-refreshed', 'true');
                        setTimeout(() => loadRequests(currentFilter), 3000);
                    }
                } else {
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    span.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            });
        }, 1000);
    }
})();
