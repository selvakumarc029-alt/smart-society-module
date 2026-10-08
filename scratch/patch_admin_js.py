# -*- coding: utf-8 -*-

js_path = 'src/main/resources/static/propertydirect/js/admin-dashboard.js'
with open(js_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace switchTabAndFilter function
old_switch = """    // Navigation and tab switching with filter presets
    window.switchTabAndFilter = function (panelId, filterOptions) {
        if (!panelId) return;

        // Update nav buttons
        document.querySelectorAll("[data-panel]").forEach(btn => {
            if (btn.dataset.panel === panelId) btn.classList.add("active");
            else btn.classList.remove("active");
        });

        // Update view sections
        document.querySelectorAll("[data-view]").forEach(view => {
            if (view.dataset.view === panelId) {
                view.classList.remove("hidden");
                view.style.display = "block";
            } else {
                view.classList.add("hidden");
                view.style.display = "none";
            }
        });

        // Update header title
        const activeBtn = document.querySelector(`.sidebar-nav [data-panel="${panelId}"]`);
        const titleElem = document.getElementById("panelTitle");
        if (activeBtn && titleElem) {
            titleElem.textContent = activeBtn.textContent.trim();
        }

        // Apply filter presets if passed
        if (filterOptions) {
            if (typeof filterOptions === 'string') {
                if (panelId === 'my-properties') {
                    const statusSelect = document.getElementById("inventoryStatusFilter");
                    if (statusSelect) {
                        statusSelect.value = filterOptions;
                        renderInventoryTable();
                    }
                } else if (panelId === 'verifications') {
                    const decSelect = document.getElementById("appDecisionFilter");
                    if (decSelect) {
                        decSelect.value = filterOptions;
                        renderApplicationsTable();
                    }
                } else if (panelId === 'reports') {
                    const repSelect = document.getElementById("reportStatusFilter");
                    if (repSelect) {
                        repSelect.value = filterOptions;
                        renderReportsTable();
                    }
                } else if (panelId === 'enquiries' && filterOptions === 'VISITS') {
                    switchEnquirySubtab('visits');
                } else if (panelId === 'enquiries') {
                    switchEnquirySubtab('enquiries');
                }
            } else if (typeof filterOptions === 'object') {
                if (filterOptions.status && panelId === 'my-properties') {
                    const sel = document.getElementById("inventoryStatusFilter");
                    if (sel) { sel.value = filterOptions.status; renderInventoryTable(); }
                }
            }
        }

        // Load data on demand
        if (panelId === 'overview') loadOverview();
        else if (panelId === 'users') loadUsers();
        else if (panelId === 'verifications') loadApplications();
        else if (panelId === 'projects') loadProjects();
        else if (panelId === 'my-properties') loadInventory();
        else if (panelId === 'enquiries') { loadEnquiries(); loadVisits(); }
        else if (panelId === 'reports') loadReports();
        else if (panelId === 'metadata') loadMetadata();
        else if (panelId === 'content') loadMetadata();
        else if (panelId === 'audit') loadAudit();

        if (history.pushState) {
            history.pushState(null, null, '#' + panelId);
        }
    };"""

new_switch = """    // Navigation and tab switching with filter presets
    window.switchTabAndFilter = function (panelId, filterOptions) {
        if (!panelId) panelId = 'overview';

        // Alias support for legacy or renamed panels
        if (panelId === 'leads' || panelId === 'tours') panelId = 'enquiries';
        if (panelId === 'kyc') panelId = 'verifications';

        // Update nav buttons
        document.querySelectorAll("[data-panel]").forEach(btn => {
            const isActive = (btn.dataset.panel === panelId);
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", String(isActive));
        });

        // Update view sections
        document.querySelectorAll("[data-view]").forEach(view => {
            const isTarget = (view.dataset.view === panelId);
            view.classList.toggle("hidden", !isTarget);
            view.classList.toggle("d-none", !isTarget);
            view.style.display = isTarget ? "block" : "none";
        });

        // Update header title
        const activeBtn = document.querySelector(`.sidebar-nav [data-panel="${panelId}"]`);
        const titleElem = document.getElementById("panelTitle");
        if (activeBtn && titleElem) {
            titleElem.textContent = activeBtn.textContent.trim();
        }

        // Apply filter presets if passed
        if (filterOptions) {
            if (typeof filterOptions === 'string') {
                if (panelId === 'my-properties') {
                    const statusSelect = document.getElementById("inventoryStatusFilter");
                    if (statusSelect) {
                        statusSelect.value = filterOptions;
                        renderInventoryTable();
                    }
                } else if (panelId === 'verifications') {
                    const decSelect = document.getElementById("appDecisionFilter");
                    if (decSelect) {
                        decSelect.value = filterOptions;
                        renderApplicationsTable();
                    }
                } else if (panelId === 'reports') {
                    const repSelect = document.getElementById("reportStatusFilter");
                    if (repSelect) {
                        repSelect.value = filterOptions;
                        renderReportsTable();
                    }
                } else if (panelId === 'enquiries' && filterOptions === 'VISITS') {
                    switchEnquirySubtab('visits');
                } else if (panelId === 'enquiries') {
                    switchEnquirySubtab('enquiries');
                }
            } else if (typeof filterOptions === 'object') {
                if (filterOptions.status && panelId === 'my-properties') {
                    const sel = document.getElementById("inventoryStatusFilter");
                    if (sel) { sel.value = filterOptions.status; renderInventoryTable(); }
                }
            }
        }

        // Load data on demand
        if (panelId === 'overview') loadOverview();
        else if (panelId === 'users') loadUsers();
        else if (panelId === 'verifications') loadApplications();
        else if (panelId === 'projects') loadProjects();
        else if (panelId === 'my-properties') loadInventory();
        else if (panelId === 'enquiries') { loadEnquiries(); loadVisits(); }
        else if (panelId === 'reports') loadReports();
        else if (panelId === 'metadata') loadMetadata();
        else if (panelId === 'content') loadMetadata();
        else if (panelId === 'audit') loadAudit();

        if (window.location.hash !== '#' + panelId) {
            if (history.pushState) {
                history.pushState(null, null, '#' + panelId);
            } else {
                location.hash = '#' + panelId;
            }
        }
    };

    // Global aliasing so any existing script or controls route cleanly to switchTabAndFilter
    window.switchTab = window.switchTabAndFilter;
    window.openPanel = window.switchTabAndFilter;
    window.PropertyDirectDashboardControls = window.PropertyDirectDashboardControls || {};
    window.PropertyDirectDashboardControls.setPanel = window.switchTabAndFilter;"""

assert old_switch in code, "old_switch not found in admin-dashboard.js"
code = code.replace(old_switch, new_switch)

# 2. Update inspectUser to handle userInspectModal with complete fidelity
old_inspect = """    window.inspectUser = function (userId) {
        const u = state.users.find(x => x.id === userId);
        if (!u) return;
        const modal = document.getElementById("inspectUserModal");
        const body = document.getElementById("inspectUserModalBody");
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; font-size:0.86rem;">
                <div><strong style="color:#0f172a;">Name:</strong> ${escapeHtml(u.name)}</div>
                <div><strong style="color:#0f172a;">Email:</strong> ${escapeHtml(u.email)}</div>
                <div><strong style="color:#0f172a;">Phone:</strong> ${escapeHtml(u.phone)}</div>
                <div><strong style="color:#0f172a;">Role:</strong> ${escapeHtml(u.role)}</div>
                <div><strong style="color:#0f172a;">Status:</strong> ${u.active ? 'Active' : 'Suspended'} (${escapeHtml(u.status)})</div>
                <div><strong style="color:#0f172a;">Posting Verified:</strong> ${u.postingVerified ? 'Yes' : 'No'}</div>
                <div><strong style="color:#0f172a;">Registered At:</strong> ${formatDateTime(u.registeredAt)}</div>
                ${u.companyName ? `<div><strong style="color:#0f172a;">Company:</strong> ${escapeHtml(u.companyName)}</div>` : ''}
                ${u.registrationNumber ? `<div><strong style="color:#0f172a;">Reg / RERA:</strong> ${escapeHtml(u.registrationNumber)}</div>` : ''}
                ${u.verificationDetails ? `<div><strong style="color:#0f172a;">Verification Details:</strong><br><span style="color:#475569;">${escapeHtml(u.verificationDetails)}</span></div>` : ''}
            </div>`;
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };"""

new_inspect = """    window.inspectUser = function (userId) {
        const u = state.users.find(x => x.id === userId);
        if (!u) return;

        const modal = document.getElementById("userInspectModal") || document.getElementById("inspectUserModal");
        if (!modal) return;

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };

        setTxt("inspectModalTitle", u.name || `User #${u.id}`);
        setTxt("inspectUserSubtitle", `ID #USR-${u.id} • Registered ${formatDateTime(u.registeredAt)}`);
        setTxt("inspectName", u.name);
        setTxt("inspectEmail", u.email);
        setTxt("inspectPhone", u.phone);
        setTxt("inspectRegDate", formatDateTime(u.registeredAt));

        const initials = (u.name || 'CU').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const avatarEl = document.getElementById("inspectAvatar");
        if (avatarEl) avatarEl.textContent = initials;

        const uRole = (u.role || 'CUSTOMER').toUpperCase();
        const roleEl = document.getElementById("inspectRoleBadge");
        if (roleEl) roleEl.innerHTML = roleBadges[uRole] || uRole;

        const isActive = u.active && (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        const statEl = document.getElementById("inspectStatusBadge");
        if (statEl) {
            statEl.innerHTML = isActive
                ? `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d;">Active</span>`
                : `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c;">Suspended</span>`;
        }

        const postEl = document.getElementById("inspectPostingBadge");
        if (postEl) {
            if (u.postingVerified) {
                postEl.innerHTML = `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#d1fae5; color:#065f46;">✓ Verified Posting Granted</span>`;
            } else if (u.applicationDecision === 'PENDING') {
                postEl.innerHTML = `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fef3c7; color:#92400e;">⏳ Application Awaiting Review</span>`;
            } else {
                postEl.innerHTML = `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:700; background:#f1f5f9; color:#64748b;">Not Verified</span>`;
            }
        }

        // Seller/Builder Application Card
        const appCard = document.getElementById("inspectApplicationCard");
        if (appCard) {
            if (u.applicationId || u.companyName || u.registrationNumber || u.verificationDetails) {
                appCard.style.display = "block";
                setTxt("inspectCompany", u.companyName);
                setTxt("inspectRegNumber", u.registrationNumber);
                setTxt("inspectVerifyDetails", u.verificationDetails || "No additional notes submitted.");
                setTxt("inspectAppDecision", u.applicationDecision || "PENDING");
                setTxt("inspectReviewNote", u.reviewNote || "None");
            } else {
                appCard.style.display = "none";
            }
        }

        // Suspend / Reactivate Action button
        const suspBtn = document.getElementById("inspectSuspendBtn");
        if (suspBtn) {
            suspBtn.textContent = isActive ? "Suspend Account" : "Reactivate Account";
            suspBtn.style.background = isActive ? "#fee2e2" : "#dcfce7";
            suspBtn.style.color = isActive ? "#b91c1c" : "#15803d";
            suspBtn.onclick = () => {
                toggleUserStatus(u.id, isActive);
                closeModal("userInspectModal");
            };
        }

        // Posting Permission Action button
        const postBtn = document.getElementById("inspectPostingBtn");
        if (postBtn) {
            postBtn.textContent = u.postingVerified ? "Revoke Posting Permission" : "Grant Posting Permission";
            postBtn.onclick = () => {
                togglePostingPermission(u.id, u.postingVerified);
                closeModal("userInspectModal");
            };
        }

        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";
    };

    window.closeInspectModal = function () {
        closeModal("userInspectModal");
        closeModal("inspectUserModal");
    };"""

assert old_inspect in code, "old_inspect not found in admin-dashboard.js"
code = code.replace(old_inspect, new_inspect)

# 3. Add window hashchange listener in DOMContentLoaded
old_hash = """        // Initial tab from hash or default to overview
        const initialHash = window.location.hash.replace("#", "") || "overview";
        switchTabAndFilter(initialHash);"""

new_hash = """        // Hash change listener
        window.addEventListener("hashchange", function () {
            const h = window.location.hash.replace("#", "") || "overview";
            switchTabAndFilter(h);
        });

        // Initial tab from hash or default to overview
        const initialHash = window.location.hash.replace("#", "") || "overview";
        switchTabAndFilter(initialHash);"""

assert old_hash in code, "old_hash not found in admin-dashboard.js"
code = code.replace(old_hash, new_hash)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("admin-dashboard.js patched successfully!")
