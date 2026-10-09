window.handleCallPhone = event => { event.stopPropagation(); };
function escapeText(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML.replaceAll(String.fromCharCode(34), '&quot;').replaceAll(String.fromCharCode(39), '&#39;'); }        // Service Requests View Switcher (Cards vs Table)
        window.toggleServiceRequestsView = function(mode) {
            const cardsCont = document.getElementById('serviceCardsContainer');
            const tableCont = document.getElementById('serviceTableContainer');
            const btnCards = document.getElementById('btnServiceCardsView');
            const btnTable = document.getElementById('btnServiceTableView');
            if (mode === 'table') {
                cardsCont?.classList.add('d-none');
                tableCont?.classList.remove('d-none');
                btnCards?.classList.remove('active');
                btnTable?.classList.add('active');
            } else {
                cardsCont?.classList.remove('d-none');
                tableCont?.classList.add('d-none');
                btnCards?.classList.add('active');
                btnTable?.classList.remove('active');
            }
        };

        // Service Requests Filter Reset Helper
        window.resetServiceFilters = function() {
            const platformFilter = document.getElementById("ssServicePlatformFilter");
            const statusFilter = document.getElementById("ssServiceStatusFilter");
            const searchInput = document.getElementById("ssServiceSearchInput");
            if (platformFilter) platformFilter.value = "ALL";
            if (statusFilter) statusFilter.value = "ALL";
            if (searchInput) searchInput.value = "";
            filterSmartSocietyServiceRequests();
            window.showToast?.("Filters reset to show all service requests.");
        };

        let allSmartSocietyServiceRequests = []; let serviceRequestLoadError = null;

        async function loadSmartSocietySuperAdminServiceRequests(btn) {
            const table = document.getElementById("smartSocietyServiceRequestsTable");
            const cardsGrid = document.getElementById("serviceCardsGrid");
            if (!table && !cardsGrid) return;

            let icon = null;
            if (btn) {
                icon = btn.querySelector("i");
                if (icon) icon.classList.add("fa-spin");
                btn.disabled = true;
            }

            try {
                const response = await fetch("/api/society/admin-insights/service-requests", {headers: {Accept: "application/json"}});
                if (response.redirected || response.status === 401 || response.status === 403) throw new Error("Sign in with your society admin account to load requests."); if (!response.ok) throw new Error("Failed to load service requests");
                allSmartSocietyServiceRequests = await response.json(); serviceRequestLoadError = null;

                const openCount = allSmartSocietyServiceRequests.filter(t => !/RESOLVED|CLOSED/i.test(t.ticketStatus || "")).length;
                const openTicketsEl = document.getElementById("overviewOpenTickets");
                if (openTicketsEl) openTicketsEl.textContent = openCount;

                filterSmartSocietyServiceRequests();
                if (btn) {
                    window.showToast?.("✓ Service requests refreshed.");
                }
            } catch (error) { serviceRequestLoadError = error.message; document.getElementById("ssServiceRowCount").textContent = "Not loaded"; ["ssTotalServiceRequests","ssPendingServiceRequests","ssInProgressServiceRequests","ssResolvedServiceRequests"].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = "—"; });
                if (table) table.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${escapeText(error.message)}</td></tr>`; if (cardsGrid) cardsGrid.textContent = error.message; document.getElementById("serviceEmptyState")?.classList.add("d-none");
                window.showToast?.("Failed to load service requests: " + error.message, true);
            } finally {
                if (btn) {
                    if (icon) icon.classList.remove("fa-spin");
                    btn.disabled = false;
                }
            }
        }

        function renderSmartSocietyServiceRequests(tickets) {
            const table = document.getElementById("smartSocietyServiceRequestsTable");
            const cardsGrid = document.getElementById("serviceCardsGrid");
            const emptyState = document.getElementById("serviceEmptyState");
            const countBadge = document.getElementById("ssServiceRowCount");

            const total = allSmartSocietyServiceRequests.length;
            const pending = allSmartSocietyServiceRequests.filter(t => /PENDING|REQUESTED|OPEN/i.test(t.ticketStatus || "")).length;
            const inProgress = allSmartSocietyServiceRequests.filter(t => /IN_PROGRESS|ASSIGNED/i.test(t.ticketStatus || "")).length;
            const resolved = allSmartSocietyServiceRequests.filter(t => /RESOLVED|CLOSED/i.test(t.ticketStatus || "")).length;

            const totalEl = document.getElementById("ssTotalServiceRequests");
            const pendingEl = document.getElementById("ssPendingServiceRequests");
            const inProgressEl = document.getElementById("ssInProgressServiceRequests");
            const resolvedEl = document.getElementById("ssResolvedServiceRequests");

            if (totalEl) totalEl.textContent = total;
            if (pendingEl) pendingEl.textContent = pending;
            if (inProgressEl) inProgressEl.textContent = inProgress;
            if (resolvedEl) resolvedEl.textContent = resolved;

            if (countBadge) {
                countBadge.textContent = `${tickets.length} record${tickets.length === 1 ? '' : 's'}`;
            }

            if (!tickets.length) {
                if (table) table.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No service requests found.</td></tr>`;
                if (cardsGrid) {
                    cardsGrid.innerHTML = '';
                    cardsGrid.classList.add('d-none');
                }
                if (emptyState) emptyState.classList.remove('d-none');
                return;
            }

            if (emptyState) emptyState.classList.add('d-none');
            if (cardsGrid) cardsGrid.classList.remove('d-none');

            const escapeText = text => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

            // Helper to parse complex ticket description lines
            function parseTicketDescription(rawDesc) {
                if (!rawDesc) return { meta: {}, scopeList: [], notes: "" };
                const meta = {};
                const scopeList = [];
                const notesLines = [];

                // Clean character artifacts if present
                const cleanDesc = String(rawDesc).replace(/\?\u0085/g, "★").replace(/\?1/g, "₹");
                const lines = cleanDesc.split(/\r?\n/);
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    const colonIdx = trimmed.indexOf(":");
                    if (colonIdx > 0) {
                        const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
                        const val = trimmed.substring(colonIdx + 1).trim();
                        if (key.includes("scope")) {
                            val.split(";").forEach(s => {
                                const item = s.trim();
                                if (item) scopeList.push(item);
                            });
                        } else if (key.includes("payment status")) {
                            meta.paymentStatus = val;
                        } else if (key.includes("transaction id")) {
                            meta.transactionId = val;
                        } else if (key.includes("payment mode")) {
                            meta.paymentMode = val;
                        } else if (key.includes("amount")) {
                            meta.amount = val;
                        } else if (key.includes("coupon")) {
                            meta.coupon = val;
                        } else if (key.includes("slot")) {
                            meta.slot = val;
                        } else if (key.includes("customer address") || key === "address") {
                            meta.address = val;
                        } else if (key === "service" || key.includes("sub-service")) {
                            meta.service = val;
                        } else if (key === "platform") {
                            meta.platform = val;
                        } else if (key === "requester") {
                            meta.requester = val;
                        } else if (key.includes("phone")) {
                            meta.phone = val;
                        } else {
                            notesLines.push(trimmed);
                        }
                    } else {
                        notesLines.push(trimmed);
                    }
                });
                return { meta, scopeList, notes: notesLines.join("\n").trim() };
            }

            // Render Card Grid View
            if (cardsGrid) {
                cardsGrid.innerHTML = tickets.map(ticket => {
                    const status = String(ticket.ticketStatus || "PENDING").toUpperCase();
                    const isPending = /PENDING|REQUESTED|OPEN/i.test(status);
                    const isInProgress = /IN_PROGRESS|ASSIGNED/i.test(status);
                    const isResolved = /RESOLVED|CLOSED/i.test(status);

                    const statusBadgeCls = isResolved ? "bg-success-subtle text-success-emphasis border border-success-subtle" :
                                           isInProgress ? "bg-info-subtle text-info-emphasis border border-info-subtle" :
                                           "bg-warning-subtle text-warning-emphasis border border-warning-subtle";

                    const statusIcon = isResolved ? "fa-circle-check" :
                                       isInProgress ? "fa-spinner fa-spin-pulse" :
                                       "fa-clock";

                    const isPropertyDirect = ticket.sourcePlatform === "propertydirect";
                    const platformBadge = isPropertyDirect ?
                        `<span class="badge rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center" style="background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a; font-size: 0.76rem; gap: 8px;"><i class="fa-solid fa-house-chimney me-1.5"></i><span>PropertyDirect</span></span>` :
                        `<span class="badge rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 0.76rem; gap: 8px;"><i class="fa-solid fa-building me-1.5"></i><span>SmartSociety</span></span>`;

                    const createdDate = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
                    const preferredDate = ticket.preferredAt ? new Date(ticket.preferredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Flexible";
                    const priority = escapeText(ticket.priority || "MEDIUM").toUpperCase();
                    const priorityCls = priority === "HIGH" || priority === "URGENT" ? "badge bg-danger-subtle text-danger-emphasis border border-danger-subtle" :
                                        priority === "LOW" ? "badge bg-secondary-subtle text-secondary border border-secondary-subtle" :
                                        "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle";

                    const parsed = parseTicketDescription(ticket.description);
                    const displayAmount = parsed.meta.amount || ticket.priceLabel || "Free / Standard";
                    const payStatus = (parsed.meta.paymentStatus || ticket.paymentStatus || "PAID").toUpperCase();
                    const isPaid = /PAID|COMPLETED|SUCCESS/.test(payStatus);
                    const paymentStatusBadge = isPaid ?
                        `<span class="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle px-3 py-1 fw-bold d-inline-flex align-items-center" style="font-size: 0.74rem; gap: 8px;"><i class="fa-solid fa-circle-check me-1.5"></i><span>${escapeText(payStatus)}</span></span>` :
                        `<span class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-1 fw-bold d-inline-flex align-items-center" style="font-size: 0.74rem; gap: 8px;"><i class="fa-solid fa-clock me-1.5"></i><span>${escapeText(payStatus)}</span></span>`;

                    return `
                        <div class="service-request-card">
                            <!-- Top Header: Ticket ID, Platform, Priority & Live Status -->
                            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-2.5 border-bottom" style="border-color: #f1f5f9 !important;">
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <span class="badge rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center" style="background: #f8fafc; color: #0f172a; border: 1.5px solid #cbd5e1; font-size: 0.8rem; gap: 8px;">
                                        <i class="fa-solid fa-ticket text-primary me-1.5"></i>
                                        <span>#${ticket.id}</span>
                                    </span>
                                    ${platformBadge}
                                    <span class="${priorityCls} rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center" style="font-size: 0.75rem; gap: 8px;">
                                        <i class="fa-solid fa-flag me-1.5"></i>
                                        <span>${priority}</span>
                                    </span>
                                    ${ticket.serviceCategory ? `
                                        <span class="badge rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.75rem; gap: 8px;">
                                            <i class="fa-solid fa-layer-group text-secondary me-1.5"></i>
                                            <span>${escapeText(ticket.serviceCategory)}</span>
                                        </span>
                                    ` : ''}
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center ${statusBadgeCls}" style="font-size: 0.78rem; gap: 8px;">
                                        <i class="fa-solid ${statusIcon} me-1.5"></i>
                                        <span>${status.replace("_", " ")}</span>
                                    </span>
                                </div>
                            </div>

                            <!-- Spacious 2-Column Split Body -->
                            <div class="service-card-body-grid">
                                <!-- Left Column: Requester, Service Package & Address -->
                                <div class="d-flex flex-column gap-3">
                                    <!-- Requester Profile -->
                                    <div class="service-info-subcard">
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 44px; height: 44px; font-size: 1.15rem; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe;">
                                                <i class="fa-solid fa-user"></i>
                                            </div>
                                            <div class="min-w-0 flex-grow-1">
                                                <div class="fw-bold text-dark text-truncate" style="font-size: 1rem; color: #0f172a !important;">
                                                    ${escapeText(ticket.requesterName || parsed.meta.requester || "Anonymous Requester")}
                                                </div>
                                                <div class="d-flex align-items-center gap-3 flex-wrap small mt-1.5" style="font-size: 0.82rem;">
                                                    ${(ticket.requesterPhone || parsed.meta.phone) ? `
                                                        <a href="tel:${escapeText(ticket.requesterPhone || parsed.meta.phone)}" onclick="window.handleCallPhone(event, '${escapeText(ticket.requesterPhone || parsed.meta.phone)}')" class="text-decoration-none fw-semibold text-primary d-inline-flex align-items-center" style="gap: 8px;">
                                                            <i class="fa-solid fa-phone me-1.5"></i>
                                                            <span>${escapeText(ticket.requesterPhone || parsed.meta.phone)}</span>
                                                        </a>
                                                    ` : ''}
                                                    ${ticket.requesterEmail ? `
                                                        <span class="text-muted d-inline-flex align-items-center" style="gap: 8px;">
                                                            <i class="fa-solid fa-envelope me-1.5"></i>
                                                            <span>${escapeText(ticket.requesterEmail)}</span>
                                                        </span>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Service Package & Address -->
                                    <div class="service-info-subcard">
                                        <div class="mb-3">
                                            <span class="text-uppercase text-muted fw-bold d-block mb-1.5" style="font-size: 0.68rem; letter-spacing: 0.05em;">Service Requested</span>
                                            <div class="d-flex align-items-center gap-2.5 fw-bold text-dark" style="font-size: 1.05rem; color: #0f172a !important; line-height: 1.35;">
                                                <i class="fa-solid fa-screwdriver-wrench text-primary flex-shrink-0 me-2" style="font-size: 1rem;"></i>
                                                <span>${escapeText(ticket.serviceType || parsed.meta.service || "Standard Request")}</span>
                                            </div>
                                            ${ticket.serviceOption ? `
                                                <div class="d-inline-flex align-items-center mt-2 px-3 py-1 rounded-pill bg-light border" style="font-size: 0.78rem; gap: 8px;">
                                                    <span class="text-muted fw-semibold">Tier:</span>
                                                    <span class="fw-bold text-dark">${escapeText(ticket.serviceOption)}</span>
                                                </div>
                                            ` : ''}
                                        </div>

                                        <div class="pt-2.5 border-top small" style="border-color: #e2e8f0 !important; font-size: 0.84rem;">
                                            <div class="d-flex align-items-start gap-2.5 text-secondary" style="line-height: 1.5;">
                                                <i class="fa-solid fa-location-dot text-danger flex-shrink-0 mt-1 me-2" style="font-size: 0.95rem;"></i>
                                                <div>
                                                    <strong class="text-dark" style="margin-right: 8px;">Service Address:</strong>
                                                    <span class="text-secondary">${escapeText(ticket.serviceAddress || parsed.meta.address || "Address on file")}</span>
                                                </div>
                                            </div>
                                            ${(ticket.externalReference || ticket.title) ? `
                                                <div class="d-flex align-items-center gap-2 mt-2 text-secondary">
                                                    <i class="fa-solid fa-tag text-muted flex-shrink-0 me-2" style="font-size: 0.85rem;"></i>
                                                    <strong class="text-dark" style="margin-right: 6px;">Ref:</strong>
                                                    <code class="px-2.5 py-0.5 bg-white border rounded text-dark font-monospace fw-semibold" style="font-size: 0.78rem; letter-spacing: 0.02em;">${escapeText(ticket.externalReference || ticket.title)}</code>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>

                                    <!-- Schedule Timestamps -->
                                    <div class="service-info-subcard py-3 px-3">
                                        <div class="row g-2 align-items-center">
                                            <div class="col-12 col-sm-6">
                                                <span class="text-muted d-block fw-bold text-uppercase mb-1.5" style="font-size: 0.68rem; letter-spacing: 0.05em;">Preferred Timing</span>
                                                <div class="d-flex align-items-center gap-2 fw-semibold text-dark flex-wrap" style="font-size: 0.84rem; line-height: 1.4;">
                                                    <i class="fa-regular fa-calendar-check text-primary flex-shrink-0 me-2" style="font-size: 0.95rem;"></i>
                                                    <span style="white-space: nowrap;">${preferredDate}</span>
                                                    ${parsed.meta.slot ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-0.5 fw-bold ms-1" style="font-size: 0.7rem;">${escapeText(parsed.meta.slot)}</span>` : ''}
                                                </div>
                                            </div>
                                            <div class="col-12 col-sm-6 ps-sm-3 border-start-sm" style="border-left: 1px solid #e2e8f0;">
                                                <span class="text-muted d-block fw-bold text-uppercase mb-1.5" style="font-size: 0.68rem; letter-spacing: 0.05em;">Logged Date</span>
                                                <div class="d-flex align-items-center gap-2 text-secondary" style="font-size: 0.84rem; line-height: 1.4; white-space: nowrap;">
                                                    <i class="fa-regular fa-clock text-muted flex-shrink-0 me-2" style="font-size: 0.9rem;"></i>
                                                    <span style="white-space: nowrap;">${createdDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Column: Booking & Financial Card + Assigned Technician -->
                                <div class="d-flex flex-column gap-3">
                                    <!-- Booking & Financial Summary -->
                                    <div class="service-info-subcard" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important; border: 1.5px solid #e2e8f0 !important;">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="text-uppercase fw-bold text-secondary small d-inline-flex align-items-center" style="font-size: 0.7rem; letter-spacing: 0.05em; gap: 8px;">
                                                <i class="fa-solid fa-receipt text-primary me-2"></i>
                                                <span>Payment & Booking</span>
                                            </span>
                                            ${paymentStatusBadge}
                                        </div>

                                        <div class="d-flex align-items-center gap-2.5 mb-2.5">
                                            <span class="fw-bold text-dark" style="font-size: 1.55rem; letter-spacing: -0.02em; color: #0f172a !important;">
                                                ${displayAmount}
                                            </span>
                                            ${parsed.meta.coupon ? `
                                                <span class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1 small fw-bold d-inline-flex align-items-center" style="font-size: 0.74rem; gap: 8px;">
                                                    <i class="fa-solid fa-ticket-simple me-1.5"></i>
                                                    <span>${escapeText(parsed.meta.coupon)}</span>
                                                </span>
                                            ` : ''}
                                        </div>

                                        <div class="pt-2 border-top small" style="border-color: #e2e8f0 !important; font-size: 0.8rem; line-height: 1.6;">
                                            <div class="d-flex justify-content-between align-items-center py-1">
                                                <span class="text-muted">Payment Mode:</span>
                                                <strong class="text-dark">${escapeText(parsed.meta.paymentMode || "Direct Booking")}</strong>
                                            </div>
                                            ${parsed.meta.transactionId ? `
                                                <div class="d-flex justify-content-between align-items-center py-1">
                                                    <span class="text-muted">Transaction ID:</span>
                                                    <code class="text-dark fw-bold font-monospace" style="font-size: 0.78rem;">${escapeText(parsed.meta.transactionId)}</code>
                                                </div>
                                            ` : ''}
                                            ${parsed.meta.slot ? `
                                                <div class="d-flex justify-content-between align-items-center py-1">
                                                    <span class="text-muted">Booking Slot:</span>
                                                    <span class="badge bg-light text-dark border px-2.5 py-0.5 rounded-pill fw-semibold">${escapeText(parsed.meta.slot)}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>

                                    <!-- Assigned Technician / Vendor -->
                                    ${ticket.vendorName ? `
                                        <div class="service-info-subcard" style="background: #f0fdf4 !important; border: 1.5px solid #bbf7d0 !important;">
                                            <div class="d-flex justify-content-between align-items-center mb-1.5">
                                                <span class="text-uppercase fw-bold text-success small d-inline-flex align-items-center" style="font-size: 0.7rem; letter-spacing: 0.05em; gap: 8px;">
                                                    <i class="fa-solid fa-user-gear me-2"></i>
                                                    <span>Assigned Technician</span>
                                                </span>
                                                <span class="badge bg-success text-white rounded-pill px-2.5 py-0.5 fw-bold" style="font-size: 0.7rem;">Active</span>
                                            </div>
                                            <div class="d-flex align-items-center justify-content-between gap-2 mt-1">
                                                <div>
                                                    <strong class="text-dark d-block" style="font-size: 0.98rem; color: #064e3b !important;">${escapeText(ticket.vendorName)}</strong>
                                                    ${ticket.vendorPhone ? `
                                                        <a href="tel:${escapeText(ticket.vendorPhone)}" onclick="window.handleCallPhone(event, '${escapeText(ticket.vendorPhone)}')" class="small text-success text-decoration-none fw-semibold d-inline-flex align-items-center mt-1" style="gap: 8px;">
                                                            <i class="fa-solid fa-phone me-1.5"></i>
                                                            <span>${escapeText(ticket.vendorPhone)}</span>
                                                        </a>
                                                    ` : ''}
                                                </div>
                                            </div>
                                            ${ticket.vendorNotes ? `
                                                <div class="mt-2 pt-2 border-top border-success-subtle small text-dark opacity-85 d-flex align-items-center" style="font-size: 0.8rem; gap: 8px;">
                                                    <i class="fa-solid fa-circle-check text-success flex-shrink-0 me-2"></i>
                                                    <span>${escapeText(ticket.vendorNotes)}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : `
                                        <div class="service-info-subcard text-center py-3" style="background: #f8fafc; border: 1.5px dashed #cbd5e1;">
                                            <i class="fa-solid fa-user-clock text-secondary fs-5 mb-1 d-block opacity-60"></i>
                                            <small class="text-muted fw-semibold d-block">Technician not yet dispatched</small>
                                        </div>
                                    `}
                                </div>
                            </div>

                            <!-- Package Features & Scope Included Section (Structured Chips) -->
                            ${parsed.scopeList && parsed.scopeList.length > 0 ? `
                                <div class="p-3 rounded-3" style="background: #f0fdfa; border: 1.5px solid #ccfbf1;">
                                    <div class="fw-bold mb-2.5 d-flex align-items-center gap-2" style="color: #0f766e !important; font-size: 0.82rem;">
                                        <i class="fa-solid fa-list-check flex-shrink-0 me-2" style="font-size: 0.9rem;"></i>
                                        <span>Package Features & Scope Included (${parsed.scopeList.length}):</span>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        ${parsed.scopeList.map(item => `
                                            <span class="service-scope-chip d-inline-flex align-items-center" style="gap: 8px;">
                                                <i class="fa-solid fa-check text-success flex-shrink-0 me-1.5" style="font-size: 0.8rem;"></i>
                                                <span>${escapeText(item)}</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Notes & Special Requirements -->
                            ${parsed.notes ? `
                                <div class="service-notes-box">
                                    <div class="fw-bold mb-1 d-flex align-items-center" style="color: #92400e !important; font-size: 0.8rem; gap: 8px;">
                                        <i class="fa-solid fa-comment-dots text-warning me-2"></i>
                                        <span>Additional Requirements & Customer Notes:</span>
                                    </div>
                                    <div style="font-size: 0.82rem; line-height: 1.5; color: #78350f;">${escapeText(parsed.notes)}</div>
                                </div>
                            ` : ''}

                            <!-- Card Footer: Quick Action Buttons & Status Update -->
                            <div class="pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2 mt-auto" style="border-color: #f1f5f9 !important;">
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <span class="small text-secondary">Status is updated by the assigned maintenance worker.</span>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    ${(ticket.requesterPhone || parsed.meta.phone) ? `
                                        <a href="tel:${escapeText(ticket.requesterPhone || parsed.meta.phone)}" onclick="window.handleCallPhone(event, '${escapeText(ticket.requesterPhone || parsed.meta.phone)}')" class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center" style="font-size: 0.78rem; gap: 8px;">
                                            <i class="fa-solid fa-phone me-2"></i><span>Call Requester</span>
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join("");
            }

            // Render Table View
            if (table) {
                table.innerHTML = tickets.map(ticket => {
                    const status = String(ticket.ticketStatus || "PENDING").toUpperCase();
                    const badgeCls = /RESOLVED|CLOSED/.test(status) ? "bg-success" : /IN_PROGRESS|ASSIGNED/.test(status) ? "bg-info text-dark" : "bg-warning text-dark";
                    const platformBadge = ticket.sourcePlatform === "propertydirect" ? '<span class="badge bg-warning text-dark">PropertyDirect</span>' : '<span class="badge bg-primary">SmartSociety</span>';
                    const createdDate = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("en-IN") : "—";
                    const preferredDate = ticket.preferredAt ? new Date(ticket.preferredAt).toLocaleString("en-IN") : "Flexible";

                    return `
                        <tr>
                            <td><strong>#${ticket.id}</strong><br><small class="text-muted">${createdDate}</small></td>
                            <td>${platformBadge}</td>
                            <td>
                                <strong>${escapeText(ticket.requesterName || "—")}</strong><br>
                                <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${escapeText(ticket.requesterPhone || "—")}</small><br>
                                <small class="text-muted">${escapeText(ticket.requesterEmail || "")}</small>
                            </td>
                            <td>
                                <strong class="text-primary">${escapeText(ticket.serviceCategory || "—")}</strong><br>
                                <span class="small fw-semibold">${escapeText(ticket.serviceType || "—")}</span><br>
                                <small class="text-muted">${escapeText(ticket.serviceOption || "Standard")}</small>
                            </td>
                            <td>
                                <span class="small">${escapeText(ticket.serviceAddress || "—")}</span><br>
                                <small class="text-muted">Ref: ${escapeText(ticket.externalReference || ticket.title || "—")}</small>
                            </td>
                            <td>
                                <span class="small"><i class="fa-regular fa-clock me-1"></i>${preferredDate}</span><br>
                                <span class="badge bg-secondary-subtle text-secondary small">${escapeText(ticket.priority || "MEDIUM")}</span>
                            </td>
                            <td><span class="badge ${badgeCls}">${status.replace("_", " ")}</span></td>
                            <td>
                                <span class="small text-muted">Worker updates status</span>
                            </td>
                        </tr>
                        ${ticket.description ? `<tr class="table-light"><td colspan="8" class="small text-muted py-2 px-4"><i class="fa-solid fa-quote-left me-2"></i><strong>Requirement:</strong> ${escapeText(ticket.description)}</td></tr>` : ''}
                    `;
                }).join("");
            }
        }

        function filterSmartSocietyServiceRequests() { if(serviceRequestLoadError) return;
            const platform = document.getElementById("ssServicePlatformFilter")?.value || "ALL";
            const status = document.getElementById("ssServiceStatusFilter")?.value || "ALL";
            const query = (document.getElementById("ssServiceSearchInput")?.value || "").toLowerCase().trim();

            const filtered = allSmartSocietyServiceRequests.filter(ticket => {
                const matchPlatform = platform === "ALL" || (ticket.sourcePlatform || "").toLowerCase() === platform.toLowerCase();
                const ticketStatus = String(ticket.ticketStatus || "PENDING").toUpperCase();
                const matchStatus = status === "ALL" ||
                    (status === "PENDING" && /PENDING|REQUESTED|OPEN/i.test(ticketStatus)) ||
                    (status === "IN_PROGRESS" && /IN_PROGRESS|ASSIGNED/i.test(ticketStatus)) ||
                    (status === "RESOLVED" && /RESOLVED|CLOSED/i.test(ticketStatus));

                const fullText = `${ticket.id} ${ticket.requesterName} ${ticket.requesterPhone} ${ticket.requesterEmail} ${ticket.serviceCategory} ${ticket.serviceType} ${ticket.serviceAddress} ${ticket.description}`.toLowerCase();
                const matchQuery = !query || fullText.includes(query);

                return matchPlatform && matchStatus && matchQuery;
            });

            renderSmartSocietyServiceRequests(filtered);
        }


document.addEventListener('society:panelchange', event => { if (event.detail?.panel === 'service-requests') loadSmartSocietySuperAdminServiceRequests(); });
document.addEventListener('DOMContentLoaded', () => { if(location.hash === '#service-requests') loadSmartSocietySuperAdminServiceRequests(); });
