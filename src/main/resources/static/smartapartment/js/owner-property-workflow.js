/**
 * Owner Property Posting & Society Admin Approval Workflow
 * Handles:
 * - Flat owner property submission for Rent/Sale in Resident Dashboard
 * - Admin approval / rejection queue in Society Admin Dashboard
 * - Real-time statistics, status badges, and inspection dialogs
 */
(() => {
    'use strict';

    const API_BASE = '/api/society/property-listings';
    let currentListings = [];
    let currentStats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    let activeFilter = 'ALL';
    let activeTypeFilter = 'ALL';
    let searchQuery = '';

    // Preset high quality apartment images for quick demo selection
    const PRESET_IMAGES = [
        { label: 'Spacious Living Room', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80' },
        { label: 'Modern Master Bedroom', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80' },
        { label: 'Luxury Corner Flat', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80' },
        { label: 'Balcony & Garden View', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80' }
    ];

    function showToast(message, type = 'success') {
        let toast = document.getElementById('ownerPropertyToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ownerPropertyToast';
            toast.style.cssText = `
                position: fixed; bottom: 28px; right: 28px; z-index: 100000;
                padding: 14px 22px; border-radius: 12px; font-weight: 700; font-size: 0.9rem;
                display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                transition: opacity 0.3s ease, transform 0.3s ease; opacity: 0; transform: translateY(15px);
                font-family: 'Plus Jakarta Sans', system-ui, sans-serif; pointer-events: none;
            `;
            document.body.appendChild(toast);
        }

        if (type === 'success') {
            toast.style.background = '#065f46';
            toast.style.color = '#ffffff';
            toast.style.border = '1px solid #10b981';
            toast.innerHTML = `<i class="fa-solid fa-circle-check text-success-emphasis"></i> ${message}`;
        } else if (type === 'error') {
            toast.style.background = '#7f1d1d';
            toast.style.color = '#ffffff';
            toast.style.border = '1px solid #ef4444';
            toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger-emphasis"></i> ${message}`;
        } else {
            toast.style.background = '#0f172a';
            toast.style.color = '#ffffff';
            toast.style.border = '1px solid #3b82f6';
            toast.innerHTML = `<i class="fa-solid fa-info-circle text-info"></i> ${message}`;
        }

        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(15px)';
        }, 4500);
    }

    // -------------------------------------------------------------
    // DATA FETCHING & API
    // -------------------------------------------------------------

    async function fetchListings() {
        try {
            const params = new URLSearchParams();
            if (activeFilter !== 'ALL') params.append('status', activeFilter);
            if (activeTypeFilter !== 'ALL') params.append('type', activeTypeFilter);
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`${API_BASE}?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            currentListings = data.listings || [];
            currentStats = data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 };

            // Update badge counters
            updateBadges();

            // Render view depending on active dashboard
            if (document.querySelector('[data-view="post-property"]')) {
                renderResidentPropertyView();
            }
            if (document.querySelector('[data-view="property-approvals"]')) {
                renderAdminPropertyView();
            }
        } catch (err) {
            console.warn('Could not load property listings from API:', err);
        }
    }

    function updateBadges() {
        // Admin badge
        const adminBadge = document.getElementById('adminPendingPropertiesBadge');
        if (adminBadge) {
            adminBadge.textContent = currentStats.pending;
            adminBadge.style.display = currentStats.pending > 0 ? 'inline-block' : 'none';
        }

        const adminOverviewCount = document.getElementById('overviewPendingPropertyApprovals');
        if (adminOverviewCount) {
            adminOverviewCount.textContent = currentStats.pending;
        }

        // Resident badge
        const resPendingBadge = document.getElementById('residentPendingPropertiesBadge');
        if (resPendingBadge) {
            resPendingBadge.textContent = currentStats.pending;
            resPendingBadge.style.display = currentStats.pending > 0 ? 'inline-block' : 'none';
        }
    }

    // -------------------------------------------------------------
    // RESIDENT / OWNER DASHBOARD RENDERING
    // -------------------------------------------------------------

    function renderResidentPropertyView() {
        const container = document.getElementById('residentPropertyListingsContainer');
        if (!container) return;

        // Update stats
        const statTotal = document.getElementById('resPropStatTotal');
        const statPending = document.getElementById('resPropStatPending');
        const statApproved = document.getElementById('resPropStatApproved');
        const statRejected = document.getElementById('resPropStatRejected');

        if (statTotal) statTotal.textContent = currentStats.total;
        if (statPending) statPending.textContent = currentStats.pending;
        if (statApproved) statApproved.textContent = currentStats.approved;
        if (statRejected) statRejected.textContent = currentStats.rejected;

        if (currentListings.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 border rounded-4 bg-white shadow-sm p-4">
                    <div style="width: 68px; height: 68px; margin: 0 auto 16px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                        <i class="fa-solid fa-house-chimney-window"></i>
                    </div>
                    <h5 class="fw-bold text-dark mb-2">No Property Listings Yet</h5>
                    <p class="text-muted small mb-4" style="max-width: 480px; margin: 0 auto;">
                        Want to rent or sell your flat in the society? Fill in the details above and submit. Once verified by the Society Admin, your listing goes live to prospective tenants and buyers.
                    </p>
                    <button type="button" class="btn btn-primary rounded-pill px-4" onclick="document.getElementById('postPropertyFormCard')?.scrollIntoView({behavior: 'smooth'})">
                        <i class="fa-solid fa-plus-circle me-2"></i>Post Your Flat Now
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = currentListings.map(item => {
            const isPending = item.status === 'PENDING_APPROVAL';
            const isApproved = item.status === 'ACTIVE';
            const isRejected = item.status === 'REJECTED';

            let statusBadge = '';
            if (isPending) {
                statusBadge = `<span class="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold"><i class="fa-solid fa-clock-rotate-left me-1"></i> Awaiting Admin Approval</span>`;
            } else if (isApproved) {
                statusBadge = `<span class="badge bg-success px-3 py-2 rounded-pill fw-bold"><i class="fa-solid fa-circle-check me-1"></i> Approved & Live in Society</span>`;
            } else if (isRejected) {
                statusBadge = `<span class="badge bg-danger px-3 py-2 rounded-pill fw-bold"><i class="fa-solid fa-circle-xmark me-1"></i> Changes Requested</span>`;
            } else {
                statusBadge = `<span class="badge bg-secondary px-3 py-2 rounded-pill fw-bold">${item.status}</span>`;
            }

            const formattedPrice = item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : 'Contact Owner';
            const formattedDeposit = item.deposit ? `Deposit: ₹${Number(item.deposit).toLocaleString('en-IN')}` : '';
            const typeBadge = item.listingType === 'SALE'
                ? `<span class="badge bg-purple px-2 py-1 rounded" style="background:#7c3aed; color:#fff;">FOR SALE</span>`
                : `<span class="badge bg-primary px-2 py-1 rounded">FOR RENT</span>`;

            return `
                <div class="card border rounded-4 shadow-sm mb-3 overflow-hidden bg-white hover-shadow transition">
                    <div class="row g-0 align-items-center">
                        <div class="col-md-3" style="min-height: 180px; position: relative;">
                            <img src="${item.imageUrl || PRESET_IMAGES[0].url}" alt="${item.title}" style="width: 100%; height: 100%; min-height: 180px; object-fit: cover;">
                            <div style="position: absolute; top: 12px; left: 12px;">${typeBadge}</div>
                        </div>
                        <div class="col-md-9">
                            <div class="card-body p-4">
                                <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                                    <div>
                                        <span class="badge bg-light text-dark border me-2"><i class="fa-solid fa-door-open me-1 text-primary"></i>Flat ${item.unitNumber || 'A-101'}</span>
                                        <span class="badge bg-light text-dark border me-2"><i class="fa-solid fa-building me-1 text-info"></i>${item.tower || 'Block A'}</span>
                                        <span class="badge bg-light text-dark border"><i class="fa-solid fa-bed me-1 text-success"></i>${item.bhk || '3 BHK'}</span>
                                    </div>
                                    <div>${statusBadge}</div>
                                </div>
                                <h5 class="fw-bold text-dark mb-1">${item.title}</h5>
                                <p class="text-muted small mb-3 line-clamp-2">${item.description || 'No description provided.'}</p>
                                
                                <div class="row g-2 mb-3 py-2 px-3 rounded-3 bg-light border align-items-center">
                                    <div class="col-sm-4">
                                        <small class="text-muted d-block text-uppercase" style="font-size:0.68rem; font-weight:800;">Expected ${item.listingType === 'SALE' ? 'Price' : 'Rent'}</small>
                                        <strong class="fs-5 text-primary fw-bold">${formattedPrice}</strong> <small class="text-muted">${item.listingType === 'RENT' ? '/ mo' : ''}</small>
                                    </div>
                                    <div class="col-sm-4">
                                        <small class="text-muted d-block text-uppercase" style="font-size:0.68rem; font-weight:800;">Furnishing & Area</small>
                                        <span class="small fw-bold text-dark">${item.furnishing || 'Semi-Furnished'} • ${item.area || 1450} sq.ft</span>
                                    </div>
                                    <div class="col-sm-4">
                                        <small class="text-muted d-block text-uppercase" style="font-size:0.68rem; font-weight:800;">Availability</small>
                                        <span class="small fw-bold text-dark">${item.availableFrom || 'Immediate'}</span>
                                    </div>
                                </div>

                                ${item.reviewNote ? `
                                    <div class="alert alert-success py-2 px-3 mb-3 small d-flex align-items-center gap-2">
                                        <i class="fa-solid fa-circle-check text-success"></i>
                                        <span><strong>Admin Note:</strong> ${item.reviewNote}</span>
                                    </div>
                                ` : ''}

                                ${item.rejectionReason ? `
                                    <div class="alert alert-danger py-2 px-3 mb-3 small d-flex align-items-center gap-2">
                                        <i class="fa-solid fa-circle-exclamation text-danger"></i>
                                        <span><strong>Reason for review:</strong> ${item.rejectionReason}</span>
                                    </div>
                                ` : ''}

                                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    <small class="text-muted">Submitted by <strong>${item.submittedBy || 'Owner'}</strong> on ${formatDate(item.createdAt)}</small>
                                    <div class="d-flex gap-2">
                                        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.viewPropertyDetail(${item.id})">
                                            <i class="fa-solid fa-eye me-1"></i> View Full Details
                                        </button>
                                        ${isPending || isRejected ? `
                                            <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="window.withdrawProperty(${item.id})">
                                                <i class="fa-solid fa-trash-can me-1"></i> Withdraw
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // -------------------------------------------------------------
    // SOCIETY ADMIN DASHBOARD RENDERING
    // -------------------------------------------------------------

    function renderAdminPropertyView() {
        const tableBody = document.getElementById('adminPropertyApprovalTableBody');
        if (!tableBody) return;

        // Update stats
        const statTotal = document.getElementById('adminPropStatTotal');
        const statPending = document.getElementById('adminPropStatPending');
        const statApproved = document.getElementById('adminPropStatApproved');
        const statRejected = document.getElementById('adminPropStatRejected');

        if (statTotal) statTotal.textContent = currentStats.total;
        if (statPending) statPending.textContent = currentStats.pending;
        if (statApproved) statApproved.textContent = currentStats.approved;
        if (statRejected) statRejected.textContent = currentStats.rejected;

        if (currentListings.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-inbox fs-2 text-secondary mb-2 d-block"></i>
                        No property submissions matching the selected filter.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = currentListings.map(item => {
            const isPending = item.status === 'PENDING_APPROVAL';
            const isApproved = item.status === 'ACTIVE';
            const isRejected = item.status === 'REJECTED';

            let statusBadge = '';
            if (isPending) {
                statusBadge = `<span class="badge bg-warning text-dark px-2 py-1 rounded-pill"><i class="fa-solid fa-hourglass-half me-1"></i> Pending Approval</span>`;
            } else if (isApproved) {
                statusBadge = `<span class="badge bg-success px-2 py-1 rounded-pill"><i class="fa-solid fa-check me-1"></i> Approved</span>`;
            } else if (isRejected) {
                statusBadge = `<span class="badge bg-danger px-2 py-1 rounded-pill"><i class="fa-solid fa-xmark me-1"></i> Rejected</span>`;
            } else {
                statusBadge = `<span class="badge bg-secondary px-2 py-1 rounded-pill">${item.status}</span>`;
            }

            const formattedPrice = item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—';
            const typeBadge = item.listingType === 'SALE'
                ? `<span class="badge rounded" style="background:#7c3aed; color:#fff;">SALE</span>`
                : `<span class="badge bg-primary rounded">RENT</span>`;

            return `
                <tr class="align-middle">
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <img src="${item.imageUrl || PRESET_IMAGES[0].url}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0;">
                            <div>
                                <strong class="d-block text-dark">${item.title}</strong>
                                <small class="text-muted">${item.bhk || 'Apartment'} • ${item.area || 1200} sq.ft • ${item.furnishing || 'Semi-Furnished'}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border fw-bold">${item.unitNumber || '—'}</span>
                        <small class="text-muted d-block">${item.tower || 'Block A'}</small>
                    </td>
                    <td>
                        <strong class="text-dark d-block">${item.submittedBy || 'Flat Owner'}</strong>
                        <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${item.notes && item.notes.includes('Phone') ? 'Registered' : '+91 98440 22010'}</small>
                    </td>
                    <td>
                        <div class="mb-1">${typeBadge}</div>
                        <strong class="text-primary">${formattedPrice}</strong>
                        <small class="text-muted d-block">${item.listingType === 'RENT' ? '/ month' : ''}</small>
                    </td>
                    <td>
                        ${statusBadge}
                        <small class="text-muted d-block mt-1">${formatDate(item.createdAt)}</small>
                    </td>
                    <td>
                        <div class="d-flex gap-2 justify-content-end">
                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="window.viewPropertyDetail(${item.id})">
                                <i class="fa-solid fa-eye me-1"></i> Inspect
                            </button>
                            ${isPending ? `
                                <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="window.adminApproveListing(${item.id}, '${escapeHtml(item.title)}')">
                                    <i class="fa-solid fa-check me-1"></i> Approve
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="window.adminRejectListing(${item.id}, '${escapeHtml(item.title)}')">
                                    <i class="fa-solid fa-xmark me-1"></i> Reject
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // -------------------------------------------------------------
    // MODAL INSPECTION & ACTIONS
    // -------------------------------------------------------------

    window.viewPropertyDetail = function(id) {
        const item = currentListings.find(l => String(l.id) === String(id));
        if (!item) return;

        let modal = document.getElementById('propertyInspectionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'propertyInspectionModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                        <div class="modal-header bg-dark text-white border-0 py-3 px-4">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-primary px-3 py-1 rounded-pill" id="inspModalType">RENT</span>
                                <h5 class="modal-title fw-bold text-white mb-0" id="inspModalTitle">Property Details</h5>
                            </div>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4" id="inspModalBody"></div>
                        <div class="modal-footer border-0 bg-light px-4 py-3" id="inspModalFooter"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const isPending = item.status === 'PENDING_APPROVAL';
        const formattedPrice = item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—';
        const formattedDeposit = item.deposit ? `₹${Number(item.deposit).toLocaleString('en-IN')}` : '—';
        const formattedMaint = item.maintenance ? `₹${Number(item.maintenance).toLocaleString('en-IN')} / month` : 'Included';

        document.getElementById('inspModalType').textContent = item.listingType || 'RENT';
        document.getElementById('inspModalType').className = item.listingType === 'SALE' ? 'badge bg-purple text-white px-3 py-1 rounded-pill' : 'badge bg-primary text-white px-3 py-1 rounded-pill';
        document.getElementById('inspModalTitle').textContent = `Flat ${item.unitNumber} - ${item.title}`;

        document.getElementById('inspModalBody').innerHTML = `
            <div class="row g-4">
                <div class="col-md-5">
                    <img src="${item.imageUrl || PRESET_IMAGES[0].url}" class="img-fluid rounded-4 shadow-sm w-100 mb-3" style="max-height: 260px; object-fit: cover;">
                    <div class="p-3 bg-light rounded-3 border">
                        <small class="text-muted d-block text-uppercase fw-bold" style="font-size:0.7rem;">Owner Information</small>
                        <strong class="d-block text-dark fs-6 mt-1">${item.submittedBy || 'Kavya N'}</strong>
                        <div class="small text-muted mt-1"><i class="fa-solid fa-building me-1 text-primary"></i>Flat ${item.unitNumber}, ${item.tower}</div>
                        <div class="small text-muted"><i class="fa-solid fa-phone me-1 text-success"></i>+91 98440 22010</div>
                        <div class="small text-muted"><i class="fa-solid fa-envelope me-1 text-info"></i>kavya.owner@smartsociety.com</div>
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="row g-2 mb-3">
                        <div class="col-4">
                            <div class="p-2 border rounded-3 bg-light text-center">
                                <small class="text-muted d-block" style="font-size:0.68rem; font-weight:800;">PRICE</small>
                                <strong class="text-primary">${formattedPrice}</strong>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="p-2 border rounded-3 bg-light text-center">
                                <small class="text-muted d-block" style="font-size:0.68rem; font-weight:800;">SECURITY DEPOSIT</small>
                                <strong class="text-dark">${formattedDeposit}</strong>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="p-2 border rounded-3 bg-light text-center">
                                <small class="text-muted d-block" style="font-size:0.68rem; font-weight:800;">MAINTENANCE</small>
                                <strong class="text-dark">${formattedMaint}</strong>
                            </div>
                        </div>
                    </div>

                    <h6 class="fw-bold text-dark mb-1">Specifications</h6>
                    <p class="small text-muted mb-3">
                        <strong>BHK:</strong> ${item.bhk || '3 BHK'} &bull; 
                        <strong>Area:</strong> ${item.area || 1450} sq.ft &bull; 
                        <strong>Bathrooms:</strong> ${item.bathrooms || 2} &bull; 
                        <strong>Floor:</strong> ${item.floor || 1} &bull; 
                        <strong>Furnishing:</strong> ${item.furnishing || 'Semi-Furnished'} &bull; 
                        <strong>Parking:</strong> ${item.parking || 'Covered'} &bull; 
                        <strong>Available From:</strong> ${item.availableFrom || 'Immediate'}
                    </p>

                    <h6 class="fw-bold text-dark mb-1">Property Description</h6>
                    <p class="small text-muted mb-3 bg-light p-3 rounded-3 border">${item.description || 'No description provided.'}</p>

                    <h6 class="fw-bold text-dark mb-1">Included Amenities</h6>
                    <div class="d-flex flex-wrap gap-1 mb-3">
                        ${(item.amenities || 'Modular Kitchen, Lift, Power Backup, Gym, Security').split(',').map(a => `<span class="badge bg-light text-dark border px-2 py-1">${a.trim()}</span>`).join('')}
                    </div>

                    ${item.notes ? `
                        <h6 class="fw-bold text-dark mb-1">Guidelines & Tenant Preferences</h6>
                        <p class="small text-muted mb-0 bg-warning-subtle text-warning-emphasis p-2 rounded-3 border border-warning-subtle">
                            <i class="fa-solid fa-circle-info me-1"></i> ${item.notes}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;

        const isAdmin = document.querySelector('[data-view="property-approvals"]') !== null;
        const footer = document.getElementById('inspModalFooter');
        if (isAdmin && isPending) {
            footer.innerHTML = `
                <button type="button" class="btn btn-outline-secondary rounded-pill px-4" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-danger rounded-pill px-4" onclick="window.adminRejectListing(${item.id}, '${escapeHtml(item.title)}')">
                    <i class="fa-solid fa-xmark me-1"></i> Reject Listing
                </button>
                <button type="button" class="btn btn-success rounded-pill px-4 fw-bold shadow-sm" onclick="window.adminApproveListing(${item.id}, '${escapeHtml(item.title)}')">
                    <i class="fa-solid fa-check me-1"></i> Approve & Publish
                </button>
            `;
        } else {
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Close</button>
            `;
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    };

    window.adminApproveListing = async function(id, title) {
        const note = prompt(`Approve listing "${title}"?\n\nEnter optional approval remarks for the owner:`, 'Verified by Society Administration. Approved and published to community marketplace.');
        if (note === null) return; // cancelled

        try {
            const res = await fetch(`${API_BASE}/${id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            });
            if (!res.ok) throw new Error(`Approval failed with HTTP ${res.status}`);
            const data = await res.json();
            showToast(data.message || 'Property approved successfully!', 'success');

            // Hide modal if open
            const modalEl = document.getElementById('propertyInspectionModal');
            if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

            await fetchListings();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.adminRejectListing = async function(id, title) {
        const reason = prompt(`Reject listing "${title}"?\n\nEnter reason or required changes for the owner:`, 'Incomplete flat documents or pricing clarification needed.');
        if (!reason) return;

        try {
            const res = await fetch(`${API_BASE}/${id}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            if (!res.ok) throw new Error(`Rejection failed with HTTP ${res.status}`);
            const data = await res.json();
            showToast(data.message || 'Property rejected.', 'error');

            const modalEl = document.getElementById('propertyInspectionModal');
            if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

            await fetchListings();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.withdrawProperty = async function(id) {
        if (!confirm('Are you sure you want to withdraw this property listing?')) return;
        try {
            const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`Delete failed with HTTP ${res.status}`);
            showToast('Listing withdrawn successfully.', 'info');
            await fetchListings();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // -------------------------------------------------------------
    // FORM SUBMISSION (RESIDENT DASHBOARD)
    // -------------------------------------------------------------

    function initPostPropertyForm() {
        const form = document.getElementById('ownerPostPropertyForm');
        if (!form) return;

        // Photo preset chip clicks
        document.querySelectorAll('.preset-photo-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.preset-photo-chip').forEach(c => c.classList.remove('active', 'border-primary'));
                chip.classList.add('active', 'border-primary');
                const url = chip.dataset.url;
                const input = document.getElementById('propImageUrl');
                if (input) input.value = url;
                const preview = document.getElementById('propImagePreview');
                if (preview) {
                    preview.src = url;
                    preview.style.display = 'block';
                }
            });
        });

        // Listing Type toggle (Rent vs Sale)
        document.querySelectorAll('input[name="propListingTypeRadio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const isSale = radio.value === 'SALE';
                const priceLabel = document.getElementById('propPriceLabel');
                const depositGroup = document.getElementById('propDepositGroup');
                const maintGroup = document.getElementById('propMaintGroup');
                const prefGroup = document.getElementById('propTenantPrefGroup');

                if (priceLabel) {
                    priceLabel.textContent = isSale ? 'Expected Sale Price (₹) *' : 'Expected Monthly Rent (₹) *';
                }
                if (depositGroup) {
                    depositGroup.style.display = isSale ? 'none' : 'block';
                }
                if (prefGroup) {
                    prefGroup.querySelector('label').textContent = isSale ? 'Buyer Preference' : 'Tenant Preference';
                }
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Submitting for Admin Approval...`;
            }

            // Gather amenities checkboxes
            const selectedAmenities = [];
            form.querySelectorAll('input[name="propAmenities"]:checked').forEach(cb => {
                selectedAmenities.push(cb.value);
            });

            const typeRadio = form.querySelector('input[name="propListingTypeRadio"]:checked');
            const listingType = typeRadio ? typeRadio.value : 'RENT';

            const payload = {
                title: form.querySelector('#propTitle')?.value || '',
                description: form.querySelector('#propDescription')?.value || '',
                listingType: listingType,
                propertyType: form.querySelector('#propPropertyType')?.value || 'APARTMENT',
                unitNumber: form.querySelector('#propUnitNumber')?.value || 'A-101',
                tower: form.querySelector('#propTower')?.value || 'Block A',
                bhk: form.querySelector('#propBhk')?.value || '3 BHK',
                area: parseInt(form.querySelector('#propArea')?.value) || 1450,
                bathrooms: parseInt(form.querySelector('#propBathrooms')?.value) || 2,
                floor: parseInt(form.querySelector('#propFloor')?.value) || 1,
                price: parseFloat(form.querySelector('#propPrice')?.value) || 0,
                deposit: parseFloat(form.querySelector('#propDeposit')?.value) || 0,
                maintenance: parseFloat(form.querySelector('#propMaintenance')?.value) || 0,
                furnishing: form.querySelector('#propFurnishing')?.value || 'Semi-Furnished',
                parking: form.querySelector('#propParking')?.value || 'Covered',
                availableFrom: form.querySelector('#propAvailableFrom')?.value || null,
                tenantPreference: form.querySelector('#propTenantPref')?.value || 'Families & Professionals',
                amenities: selectedAmenities.join(', '),
                notes: form.querySelector('#propNotes')?.value || '',
                contactName: form.querySelector('#propContactName')?.value || 'Kavya N',
                contactPhone: form.querySelector('#propContactPhone')?.value || '+91 98440 22010',
                imageUrl: form.querySelector('#propImageUrl')?.value || PRESET_IMAGES[0].url
            };

            try {
                const res = await fetch(API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || `Submission failed with status ${res.status}`);
                }

                showToast('🎉 Property submitted to Society Admin for review! Check status below.', 'success');
                form.reset();

                // Reset preset active chip
                document.querySelectorAll('.preset-photo-chip').forEach(c => c.classList.remove('active', 'border-primary'));

                // Reload listings and scroll to list
                await fetchListings();
                document.getElementById('myPostedPropertiesHeader')?.scrollIntoView({ behavior: 'smooth' });

            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane me-2"></i>Submit Property to Admin for Approval`;
                }
            }
        });
    }

    // -------------------------------------------------------------
    // SEARCH & FILTER CONTROLS
    // -------------------------------------------------------------

    function initFilterControls() {
        // Admin status filter tabs
        document.querySelectorAll('[data-admin-prop-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-admin-prop-filter]').forEach(b => b.classList.remove('active', 'btn-primary'));
                document.querySelectorAll('[data-admin-prop-filter]').forEach(b => b.classList.add('btn-outline-secondary'));
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-secondary');
                activeFilter = btn.dataset.adminPropFilter;
                fetchListings();
            });
        });

        // Admin search input
        const searchInput = document.getElementById('adminPropSearchInput');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    searchQuery = searchInput.value;
                    fetchListings();
                }, 300);
            });
        }

        // Admin type filter
        const typeSelect = document.getElementById('adminPropTypeSelect');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                activeTypeFilter = typeSelect.value;
                fetchListings();
            });
        }
    }

    function formatDate(val) {
        if (!val) return 'Today';
        try {
            return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return 'Recently';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Initial load
    document.addEventListener('DOMContentLoaded', () => {
        fetchListings();
        initPostPropertyForm();
        initFilterControls();

        // Refresh periodically (every 30s)
        setInterval(fetchListings, 30000);
    });

    window.refreshPropertyApprovals = fetchListings;

})();
