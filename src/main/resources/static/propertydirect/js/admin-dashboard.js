/**
 * PropertyDirect Platform Admin Dashboard Engine
 * Implements: Overview with real counts & activity, Customer Directory,
 * Owner & Builder Verifications, Builder Projects & Unit Inventory,
 * Property Inventory & Approval Queue, Enquiries & Visit Tracking,
 * Reports & Complaints, Categories & Locations Metadata, Featured Listings,
 * and Notifications & Audit History.
 */

(function () {
    'use strict';

    // State
    const state = {
        overview: null,
        users: [],
        applications: [],
        projects: [],
        inventory: [],
        enquiries: [],
        visits: [],
        reports: [],
        metadata: null,
        audit: []
    };

    // Helper: Toast notification
    function showToast(msg, isError) {
        const t = document.getElementById("toast") || document.getElementById("adminToast");
        if (!t) return;
        t.textContent = (isError ? "⚠ " : "✓ ") + msg;
        t.style.background = isError ? "#dc2626" : "#0f172a";
        t.classList.remove("hidden");
        t.style.display = "flex";
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => {
            t.classList.add("hidden");
            t.style.display = "none";
        }, 3500);
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (_) {
            return iso;
        }
    }

    function formatCurrency(val) {
        if (val == null) return '—';
        const num = Number(val);
        if (isNaN(num)) return val;
        if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
        return '₹' + num.toLocaleString('en-IN');
    }

    // Role Badges
    const roleBadges = {
        'CUSTOMER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">Customer / Tenant</span>',
        'OWNER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">Property Owner</span>',
        'BUILDER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a;">Builder / Developer</span>',
        'ADMIN': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">Platform Admin</span>',
        'SUPERADMIN': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff;">Super Admin</span>'
    };

    // Navigation and tab switching with filter presets
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
    window.PropertyDirectDashboardControls.setPanel = window.switchTabAndFilter;

    // Subtab switcher for Enquiries & Visits
    window.switchEnquirySubtab = function (subtab) {
        const enqSection = document.getElementById("subtabEnquiriesView");
        const visSection = document.getElementById("subtabVisitsView");
        const btnEnq = document.getElementById("subtabEnquiriesBtn");
        const btnVis = document.getElementById("subtabVisitsBtn");

        if (subtab === 'visits') {
            if (enqSection) {
                enqSection.classList.add('hidden');
                enqSection.hidden = true;
                enqSection.style.setProperty('display', 'none', 'important');
            }
            if (visSection) {
                visSection.classList.remove('hidden');
                visSection.hidden = false;
                visSection.style.setProperty('display', 'block', 'important');
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn';
                btnEnq.style.background = '#ffffff';
                btnEnq.style.color = '#334155';
            }
            if (btnVis) {
                btnVis.className = 'pill-btn active';
                btnVis.style.background = '#0f172a';
                btnVis.style.color = '#ffffff';
            }
            loadVisits();
        } else {
            if (visSection) {
                visSection.classList.add('hidden');
                visSection.hidden = true;
                visSection.style.setProperty('display', 'none', 'important');
            }
            if (enqSection) {
                enqSection.classList.remove('hidden');
                enqSection.hidden = false;
                enqSection.style.setProperty('display', 'block', 'important');
            }
            if (btnVis) {
                btnVis.className = 'pill-btn';
                btnVis.style.background = '#ffffff';
                btnVis.style.color = '#334155';
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn active';
                btnEnq.style.background = '#0f172a';
                btnEnq.style.color = '#ffffff';
            }
            loadEnquiries();
        }
    };

    // -------------------------------------------------------------
    // 1. OVERVIEW & REAL COUNTS
    // -------------------------------------------------------------
    async function loadOverview() {
        try {
            const res = await fetch('/api/property/portal/admin/overview', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.overview = await res.json();
            renderOverview();
        } catch (err) {
            console.error("Error loading overview:", err);
        }
    }

    function renderOverview() {
        if (!state.overview) return;
        const counts = state.overview.counts || {};
        const recentActivity = state.overview.recentActivity || [];
        const notifications = state.overview.notifications || [];

        // Summary card metrics
        const updateElem = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = Number(val || 0).toLocaleString('en-IN');
        };

        updateElem("overviewPendingApprovals", counts.pendingApprovals);
        updateElem("overviewPendingVerifications", counts.pendingVerifications);
        updateElem("overviewActiveProperties", counts.activeListings);
        updateElem("overviewTotalUsers", counts.totalUsers);
        updateElem("overviewBuilderProjects", counts.totalProjects);
        updateElem("overviewAvailableUnits", counts.availableUnits);
        updateElem("overviewTotalEnquiries", counts.totalEnquiries);
        updateElem("overviewScheduledVisits", counts.scheduledVisits);
        updateElem("overviewOpenReports", counts.openReports);
        updateElem("overviewTotalAudit", counts.totalAuditLogs);

        // Sidebar badges
        const badgeApps = document.getElementById("sidebarPendingAppsBadge");
        if (badgeApps) {
            badgeApps.textContent = counts.pendingVerifications || 0;
            badgeApps.style.display = counts.pendingVerifications > 0 ? "inline-block" : "none";
        }
        const badgeListings = document.getElementById("sidebarPendingListingsBadge");
        if (badgeListings) {
            badgeListings.textContent = counts.pendingApprovals || 0;
            badgeListings.style.display = counts.pendingApprovals > 0 ? "inline-block" : "none";
        }
        const badgeReports = document.getElementById("sidebarOpenReportsBadge");
        if (badgeReports) {
            badgeReports.textContent = counts.openReports || 0;
            badgeReports.style.display = counts.openReports > 0 ? "inline-block" : "none";
        }
        const badgeUsers = document.getElementById("sidebarUserCountBadge");
        if (badgeUsers) {
            badgeUsers.textContent = counts.totalUsers || 0;
        }

        // Actionable Notifications
        const notifContainer = document.getElementById("overviewNotificationsList");
        if (notifContainer) {
            if (notifications.length === 0) {
                notifContainer.innerHTML = `
                    <div style="padding:16px 20px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0; display:flex; align-items:center; gap:12px;">
                        <span style="font-size:1.3rem;">✓</span>
                        <div>
                            <strong style="color:#166534; font-size:0.9rem;">All Moderation Queues Clear</strong>
                            <p style="margin:2px 0 0 0; color:#15803d; font-size:0.82rem;">No pending approvals, open reports, or unreviewed verifications at this moment.</p>
                        </div>
                    </div>`;
            } else {
                notifContainer.innerHTML = notifications.map(n => {
                    const isDanger = n.type === 'danger';
                    const bg = isDanger ? '#fef2f2' : '#fffbeb';
                    const border = isDanger ? '#fecaca' : '#fde68a';
                    const textCol = isDanger ? '#991b1b' : '#92400e';
                    const icon = isDanger ? '🚨' : '⏳';
                    return `
                        <div style="padding:14px 18px; border-radius:12px; background:${bg}; border:1px solid ${border}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:1.3rem;">${icon}</span>
                                <div>
                                    <strong style="color:${textCol}; font-size:0.88rem;">${escapeHtml(n.title)} (${n.count})</strong>
                                    <p style="margin:2px 0 0 0; color:${textCol}; font-size:0.82rem; opacity:0.9;">${escapeHtml(n.message)}</p>
                                </div>
                            </div>
                            <button type="button" onclick="switchTabAndFilter('${n.targetPanel}', '${n.filter}')"
                                style="padding:7px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.8rem; font-weight:700; border:none; cursor:pointer;">
                                Review Now →
                            </button>
                        </div>`;
                }).join('');
            }
        }

        // Recent Activity Feed
        const activityContainer = document.getElementById("overviewRecentActivity");
        if (activityContainer) {
            if (recentActivity.length === 0) {
                activityContainer.innerHTML = `<div style="text-align:center; padding:24px; color:#64748b; font-size:0.86rem;">No recent activity recorded.</div>`;
            } else {
                activityContainer.innerHTML = recentActivity.map(act => {
                    let badge = '<span style="padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">' + escapeHtml(act.action) + '</span>';
                    if (act.action.includes('APPROVED')) badge = '<span style="padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d;">' + escapeHtml(act.action) + '</span>';
                    else if (act.action.includes('REJECTED') || act.action.includes('SUSPENDED')) badge = '<span style="padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c;">' + escapeHtml(act.action) + '</span>';
                    else if (act.action.includes('CHANGES_REQUESTED')) badge = '<span style="padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#b45309;">' + escapeHtml(act.action) + '</span>';
                    return `
                        <div style="padding:12px 16px; border-radius:10px; border:1px solid #f1f5f9; background:#ffffff; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                ${badge}
                                <span style="font-size:0.84rem; font-weight:700; color:#1e293b;">${escapeHtml(act.targetType)} #${act.targetId}</span>
                                <span style="font-size:0.82rem; color:#64748b;">${escapeHtml(act.detail || '—')}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px; font-size:0.76rem; color:#94a3b8; white-space:nowrap;">
                                <span>by ${escapeHtml(act.actor || 'system')}</span>
                                <span>•</span>
                                <span>${formatDateTime(act.createdAt)}</span>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    }

    // -------------------------------------------------------------
    // 2. CUSTOMER DIRECTORY
    // -------------------------------------------------------------
    async function loadUsers() {
        try {
            const res = await fetch('/api/property/portal/accounts', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.users = await res.json();
            renderUsersTable();
            populateAdminOwnerSelect();
        } catch (err) {
            console.error("Error loading accounts:", err);
            const tbody = document.getElementById("usersTableBody");
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:#ef4444;">Unable to load users directory.</td></tr>`;
        }
    }

    function renderUsersTable() {
        const tbody = document.getElementById("usersTableBody");
        if (!tbody) return;

        const query = (document.getElementById("userSearchInput")?.value || "").toLowerCase().trim();
        const roleFilter = (document.getElementById("userRoleFilter")?.value || "").toUpperCase().trim();
        const statusFilter = (document.getElementById("userStatusFilter")?.value || "").toUpperCase().trim();
        const verifyFilter = (document.getElementById("userVerifyFilter")?.value || "").toUpperCase().trim();

        const filtered = state.users.filter(u => {
            const name = (u.name || "").toLowerCase();
            const email = (u.email || "").toLowerCase();
            const phone = (u.phone || "").toLowerCase();
            const uid = String(u.id || "");
            const comp = (u.companyName || "").toLowerCase();
            const matchesQuery = !query || name.includes(query) || email.includes(query) || phone.includes(query) || uid.includes(query) || comp.includes(query);

            const uRole = (u.role || "CUSTOMER").toUpperCase();
            const matchesRole = !roleFilter || uRole === roleFilter;

            const isActive = u.active && (u.status || "ACTIVE").toUpperCase() === "ACTIVE";
            const matchesStatus = !statusFilter || (statusFilter === "ACTIVE" ? isActive : !isActive);

            let vState = "STANDARD";
            if (u.postingVerified) vState = "VERIFIED";
            else if (u.applicationDecision === "PENDING") vState = "PENDING";
            const matchesVerify = !verifyFilter || vState === verifyFilter;

            return matchesQuery && matchesRole && matchesStatus && matchesVerify;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No user accounts match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(u => {
            const uRole = (u.role || 'CUSTOMER').toUpperCase();
            const roleBadge = roleBadges[uRole] || `<span style="padding:4px 8px; border-radius:999px; font-size:0.74rem; background:#f1f5f9; color:#475569;">${uRole}</span>`;
            const isActive = u.active && (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
            const statusBadge = isActive
                ? `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;"><span style="width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>Active</span>`
                : `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"><span style="width:6px; height:6px; border-radius:50%; background:#ef4444;"></span>Suspended</span>`;

            let verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:700; background:#f1f5f9; color:#64748b;">Standard Customer</span>`;
            if (u.postingVerified) {
                verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;">✓ Verified Posting</span>`;
            } else if (u.applicationDecision === 'PENDING') {
                verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">⏳ Pending Review</span>`;
            }

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#USR-${u.id}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(u.name || '—')}</strong>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:2px; font-size:0.78rem; color:#64748b;">
                            <span>${escapeHtml(u.email || '—')}</span>
                            <span>•</span>
                            <span>${escapeHtml(u.phone || '—')}</span>
                        </div>
                        ${u.companyName ? `<small style="display:block; color:#475569; font-weight:700; margin-top:2px;">🏢 ${escapeHtml(u.companyName)}</small>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${roleBadge}</td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#475569;">${formatDateTime(u.registeredAt)}</td>
                    <td style="padding:14px 18px;">${statusBadge}</td>
                    <td style="padding:14px 18px;">${verifyBadge}</td>
                    <td style="padding:14px 18px; text-align:right; white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            <button type="button" onclick="inspectUser(${u.id})"
                                style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                Inspect
                            </button>
                            <button type="button" onclick="toggleUserStatus(${u.id}, ${isActive})"
                                style="padding:6px 12px; border-radius:8px; border:1px solid ${isActive ? '#fca5a5' : '#86efac'}; background:${isActive ? '#fff1f2' : '#f0fdf4'}; color:${isActive ? '#b91c1c' : '#15803d'}; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                ${isActive ? 'Suspend' : 'Reactivate'}
                            </button>
                            <button type="button" onclick="togglePostingPermission(${u.id}, ${u.postingVerified})"
                                style="padding:6px 10px; border-radius:8px; border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                ${u.postingVerified ? 'Revoke Post' : 'Grant Post'}
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    window.toggleUserStatus = async function (userId, currentlyActive) {
        const nextStatus = currentlyActive ? "SUSPENDED" : "ACTIVE";
        const actionVerb = currentlyActive ? "suspend" : "reactivate";
        const note = prompt(`Please provide an administrative reason to ${actionVerb} Account #USR-${userId}:`, `Administrative ${actionVerb}`);
        if (note == null || !note.trim()) return;

        try {
            const res = await fetch(`/api/property/portal/accounts/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ status: nextStatus, note: note.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to update status`);
            showToast(`Account #USR-${userId} is now ${nextStatus}!`);
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.togglePostingPermission = async function (userId, currentlyVerified) {
        const nextState = !currentlyVerified;
        const msg = nextState ? "Grant posting permission to" : "Revoke posting permission from";
        if (!confirm(`Are you sure you want to ${msg} Account #USR-${userId}?`)) return;

        try {
            const res = await fetch(`/api/property/portal/accounts/${userId}/posting-permission?verified=${nextState}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to update posting permission`);
            showToast(`Posting permission updated for #USR-${userId}!`);
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.inspectUser = function (userId) {
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
    };

    function populateAdminOwnerSelect() {
        const select = document.getElementById("adminOwnerSelect");
        if (!select) return;
        const verifiedSellers = state.users.filter(u =>
            (u.role === 'OWNER' || u.role === 'BUILDER') && u.postingVerified && u.active
        );
        const otherSellers = state.users.filter(u =>
            (u.role === 'OWNER' || u.role === 'BUILDER') && (!u.postingVerified || !u.active)
        );

        let html = '<option value="">— Choose Verified Owner or Builder Account —</option>';
        if (verifiedSellers.length > 0) {
            html += '<optgroup label="✓ Verified Owners & Builders (Authorized to Post)">';
            verifiedSellers.forEach(s => {
                const tag = s.companyName ? ` (${s.companyName})` : '';
                html += `<option value="${s.id}">${escapeHtml(s.name)} [#USR-${s.id}] · ${s.role}${escapeHtml(tag)}</option>`;
            });
            html += '</optgroup>';
        }
        if (otherSellers.length > 0) {
            html += '<optgroup label="⏳ Pending or Unverified (Requires Admin Verification)">';
            otherSellers.forEach(s => {
                html += `<option value="${s.id}">${escapeHtml(s.name)} [#USR-${s.id}] · ${s.role} [Unverified]</option>`;
            });
            html += '</optgroup>';
        }
        select.innerHTML = html;
    }

    // -------------------------------------------------------------
    // 3. OWNER & BUILDER VERIFICATION
    // -------------------------------------------------------------
    async function loadApplications() {
        try {
            const res = await fetch('/api/property/portal/applications', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.applications = await res.json();
            renderApplicationsTable();
        } catch (err) {
            console.error("Error loading applications:", err);
        }
    }

    function renderApplicationsTable() {
        const tbody = document.getElementById("verificationsTableBody");
        if (!tbody) return;

        const filter = (document.getElementById("appDecisionFilter")?.value || "").toUpperCase().trim();
        const filtered = state.applications.filter(item => {
            const dec = (item.application?.decision || '').toUpperCase();
            if (!filter || filter === 'ALL') return true;
            return dec === filter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No seller or builder applications found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const app = item.application || {};
            const acc = item.account || {};
            const isPending = (app.decision || '').toUpperCase() === 'PENDING';
            const isApproved = (app.decision || '').toUpperCase() === 'APPROVED';

            let decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">⏳ Pending Review</span>`;
            if (isApproved) {
                decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Approved</span>`;
            } else if ((app.decision || '').toUpperCase() === 'REJECTED') {
                decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">✕ Rejected</span>`;
            }

            const reqRoleBadge = (app.requestedRole === 'BUILDER')
                ? `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a;">Builder / Developer</span>`
                : `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">Property Owner</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(acc.name || 'Account #' + app.customerId)}</strong>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                            <span>${escapeHtml(acc.email || '')}</span> · <span>${escapeHtml(acc.phone || '')}</span>
                        </div>
                    </td>
                    <td style="padding:14px 18px;">${reqRoleBadge}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.86rem; color:#1e293b;">${escapeHtml(app.companyName || 'Individual Owner')}</strong>
                        <small style="color:#64748b;">${app.registrationNumber ? 'Reg: ' + escapeHtml(app.registrationNumber) : 'Self-owned property'}</small>
                    </td>
                    <td style="padding:14px 18px; max-width:280px;">
                        <div style="font-size:0.82rem; color:#334155; line-height:1.4;">${escapeHtml(app.verificationDetails || '—')}</div>
                        ${app.reviewNote ? `<div style="font-size:0.76rem; color:#64748b; margin-top:4px;"><strong>Admin Note:</strong> ${escapeHtml(app.reviewNote)}</div>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${decBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        ${isPending ? `
                            <button type="button" onclick="openReviewApplicationModal(${app.id}, '${escapeHtml(acc.name || '')}', '${app.requestedRole}')"
                                style="padding:7px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                                Review Application
                            </button>
                        ` : `
                            <span style="font-size:0.78rem; color:#94a3b8;">Reviewed by ${escapeHtml(app.reviewedBy || 'Admin')}</span>
                        `}
                    </td>
                </tr>`;
        }).join('');
    }

    window.openReviewApplicationModal = function (appId, applicantName, requestedRole) {
        const modal = document.getElementById("reviewAppModal");
        if (!modal) return;
        document.getElementById("reviewAppId").value = appId;
        document.getElementById("reviewAppName").textContent = applicantName;
        document.getElementById("reviewAppRole").textContent = requestedRole;
        document.getElementById("reviewAppNote").value = "";
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };

    window.submitApplicationReview = async function (decision) {
        const appId = document.getElementById("reviewAppId").value;
        const note = document.getElementById("reviewAppNote").value.trim();
        if (!note) {
            alert("Please enter a verification note or reason.");
            return;
        }

        try {
            const res = await fetch(`/api/property/portal/applications/${appId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ decision: decision, note: note })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to review application');

            showToast(`Application #${appId} marked as ${decision}!`);
            closeModal("reviewAppModal");
            loadApplications();
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // -------------------------------------------------------------
    // 4. BUILDER PROJECTS & UNIT INVENTORY
    // -------------------------------------------------------------
    async function loadProjects() {
        try {
            const res = await fetch('/api/property/portal/projects', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.projects = await res.json();
            renderProjectsTable();
        } catch (err) {
            console.error("Error loading projects:", err);
        }
    }

    function renderProjectsTable() {
        const tbody = document.getElementById("projectsTableBody");
        if (!tbody) return;

        if (state.projects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No builder projects listed yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.projects.map(p => {
            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#PRJ-${p.id}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.9rem; color:#0f172a;">${escapeHtml(p.name)}</strong>
                        <small style="color:#64748b;">${escapeHtml(p.locality || '')}, ${escapeHtml(p.city || '')}</small>
                    </td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#334155;">
                        <strong>${escapeHtml(p.builderName || 'Builder #' + p.builderId)}</strong>
                    </td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#475569;">
                        <code>${escapeHtml(p.reraNumber || p.registrationNumber || 'Pending')}</code>
                    </td>
                    <td style="padding:14px 18px;">
                        <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#334155;">
                            ${escapeHtml(p.constructionStatus || 'Under Construction')}
                        </span>
                    </td>
                    <td style="padding:14px 18px;">
                        <div style="font-size:0.82rem;">
                            <strong>${p.totalUnits || 0} Listed</strong>
                            <div style="color:#059669; font-weight:700;">${p.availableUnits != null ? p.availableUnits : '—'} Available</div>
                        </div>
                    </td>
                    <td style="padding:14px 18px; text-align:right;">
                        <button type="button" onclick="inspectProjectUnits(${p.id}, '${escapeHtml(p.name)}')"
                            style="padding:7px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                            View Units Breakdown →
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    window.inspectProjectUnits = async function (projectId, projectName) {
        const modal = document.getElementById("projectUnitsModal");
        const tbody = document.getElementById("projectUnitsTableBody");
        const title = document.getElementById("projectUnitsModalTitle");
        if (!modal || !tbody) return;

        title.textContent = `Unit Inventory — ${projectName}`;
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">Loading project units...</td></tr>`;
        modal.classList.remove("hidden");
        modal.style.display = "flex";

        try {
            const res = await fetch(`/api/property/portal/projects/${projectId}/units`, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const units = await res.json();

            if (units.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No units have been submitted under this project yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = units.map(u => {
                const isAvail = (u.status || '').toUpperCase() === 'ACTIVE' && (u.verificationStatus || '').toUpperCase() === 'APPROVED';
                const isSold = (u.status || '').toUpperCase() === 'SOLD';
                let statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#64748b;">${escapeHtml(u.status)}</span>`;
                if (isAvail) statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d;">Available</span>`;
                else if (isSold) statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c;">Sold</span>`;

                return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 14px; font-weight:800;">${escapeHtml(u.tower || '—')}</td>
                        <td style="padding:10px 14px; font-weight:700;">Unit ${escapeHtml(u.unitNumber || '—')}</td>
                        <td style="padding:10px 14px;">${escapeHtml(u.bhk || '—')} · ${u.areaSqft || '—'} sqft</td>
                        <td style="padding:10px 14px; font-weight:800; color:#0f172a;">${formatCurrency(u.price)}</td>
                        <td style="padding:10px 14px;">${statusBadge}</td>
                        <td style="padding:10px 14px; text-align:right;">
                            <button type="button" onclick="closeModal('projectUnitsModal'); switchTabAndFilter('my-properties', { status: 'ALL' });"
                                style="padding:4px 8px; border-radius:6px; background:#f1f5f9; font-size:0.74rem; font-weight:700; border:1px solid #cbd5e1; cursor:pointer;">
                                Inspect Listing
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Error loading units: ${err.message}</td></tr>`;
        }
    };

    // -------------------------------------------------------------
    // 5. PROPERTY INVENTORY & APPROVAL QUEUE
    // -------------------------------------------------------------
    async function loadInventory() {
        try {
            const res = await fetch('/api/property/portal/admin/inventory', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.inventory = await res.json();
            renderInventoryTable();
        } catch (err) {
            console.error("Error loading inventory:", err);
        }
    }

    function renderInventoryTable() {
        const tbody = document.getElementById("inventoryTableBody");
        if (!tbody) return;

        const statusFilter = (document.getElementById("inventoryStatusFilter")?.value || "").toUpperCase().trim();
        const typeFilter = (document.getElementById("inventoryTypeFilter")?.value || "").toUpperCase().trim();
        const search = (document.getElementById("inventorySearchInput")?.value || "").toLowerCase().trim();

        const filtered = state.inventory.filter(l => {
            const st = (l.status || '').toUpperCase();
            const ver = (l.verificationStatus || '').toUpperCase();

            if (statusFilter && statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING_APPROVAL') {
                    if (st !== 'PENDING_APPROVAL' && ver !== 'PENDING' && ver !== 'ADMIN_REVIEW') return false;
                } else if (statusFilter === 'ACTIVE') {
                    if (st !== 'ACTIVE' || ver !== 'APPROVED') return false;
                } else if (statusFilter === 'CHANGES_REQUESTED') {
                    if (st !== 'CHANGES_REQUESTED' && ver !== 'CHANGES_REQUESTED') return false;
                } else if (statusFilter === 'REJECTED') {
                    if (st !== 'REJECTED' && ver !== 'REJECTED') return false;
                } else if (st !== statusFilter && ver !== statusFilter) {
                    return false;
                }
            }

            if (typeFilter && typeFilter !== 'ALL') {
                if ((l.listingType || '').toUpperCase() !== typeFilter) return false;
            }

            if (search) {
                const title = (l.title || '').toLowerCase();
                const code = (l.apartmentCode || '').toLowerCase();
                const owner = (l.ownerName || '').toLowerCase();
                const loc = (l.locality || '' + ' ' + l.city || '').toLowerCase();
                if (!title.includes(search) && !code.includes(search) && !owner.includes(search) && !loc.includes(search)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No properties match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            const isPending = (l.status || '').toUpperCase() === 'PENDING_APPROVAL' || (l.verificationStatus || '').toUpperCase() === 'PENDING';
            const isActive = (l.status || '').toUpperCase() === 'ACTIVE' && (l.verificationStatus || '').toUpperCase() === 'APPROVED';

            let statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">${escapeHtml(l.status)}</span>`;
            if (isActive) {
                statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Live</span>`;
            } else if (isPending) {
                statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">⏳ Pending Approval</span>`;
            } else if ((l.status || '').toUpperCase() === 'CHANGES_REQUESTED') {
                statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#ffedd5; color:#c2410c; border:1px solid #fed7aa;">✎ Changes Requested</span>`;
            } else if ((l.status || '').toUpperCase() === 'REJECTED') {
                statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">✕ Rejected</span>`;
            } else if ((l.status || '').toUpperCase() === 'SOLD') {
                statusBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#e0e7ff; color:#3730a3;">Sold</span>`;
            }

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">
                        ${escapeHtml(l.apartmentCode || '#PDT-' + l.id)}
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(l.title)}</strong>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                            <span>${escapeHtml(l.propertyType)} · ${escapeHtml(l.bhk || '')}</span> · 
                            <span>${escapeHtml(l.locality || '')}, ${escapeHtml(l.city || '')}</span>
                        </div>
                        ${l.projectName ? `<small style="display:block; color:#2563eb; font-weight:700;">🏢 ${escapeHtml(l.projectName)} (${escapeHtml(l.tower || '')} Unit ${escapeHtml(l.unitNumber || '')})</small>` : ''}
                        ${l.reviewNote ? `<small style="display:block; color:#b45309; margin-top:2px;">Note: ${escapeHtml(l.reviewNote)}</small>` : ''}
                        ${l.rejectionReason ? `<small style="display:block; color:#dc2626; margin-top:2px;">Rejection: ${escapeHtml(l.rejectionReason)}</small>` : ''}
                    </td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#334155;">
                        <strong>${escapeHtml(l.ownerName || 'Owner #' + l.ownerId)}</strong>
                        <div style="color:#64748b; font-size:0.76rem;">${escapeHtml(l.ownerEmail || '')}</div>
                    </td>
                    <td style="padding:14px 18px; font-weight:800; font-size:0.9rem; color:#0f172a;">
                        ${formatCurrency(l.price)}
                    </td>
                    <td style="padding:14px 18px;">${statusBadge}</td>
                    <td style="padding:14px 18px;">
                        <button type="button" onclick="toggleFeatured(${l.id}, ${l.featured})"
                            style="padding:4px 8px; border-radius:6px; font-size:0.74rem; font-weight:700; cursor:pointer; border:1px solid ${l.featured ? '#f59e0b' : '#cbd5e1'}; background:${l.featured ? '#fef3c7' : '#ffffff'}; color:${l.featured ? '#b45309' : '#64748b'};">
                            ${l.featured ? '★ Featured' : '☆ Feature'}
                        </button>
                    </td>
                    <td style="padding:14px 18px; text-align:right; white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${isPending ? `
                                <button type="button" onclick="moderateListing(${l.id}, 'APPROVED')"
                                    style="padding:6px 10px; border-radius:8px; background:#10b981; color:#ffffff; font-size:0.76rem; font-weight:800; border:none; cursor:pointer;">
                                    ✓ Approve
                                </button>
                                <button type="button" onclick="moderateListingWithNote(${l.id}, 'CHANGES_REQUESTED')"
                                    style="padding:6px 10px; border-radius:8px; background:#f59e0b; color:#ffffff; font-size:0.76rem; font-weight:800; border:none; cursor:pointer;">
                                    ✎ Changes
                                </button>
                                <button type="button" onclick="moderateListingWithNote(${l.id}, 'REJECTED')"
                                    style="padding:6px 10px; border-radius:8px; background:#ef4444; color:#ffffff; font-size:0.76rem; font-weight:800; border:none; cursor:pointer;">
                                    ✕ Reject
                                </button>
                            ` : `
                                <button type="button" onclick="inspectListingDetails(${l.id})"
                                    style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                    Inspect
                                </button>
                            `}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    window.toggleFeatured = async function (listingId, currentlyFeatured) {
        const nextState = !currentlyFeatured;
        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/featured?featured=${nextState}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update featured flag');
            showToast(`Listing #${listingId} featured status updated!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.moderateListing = async function (listingId, decision) {
        const note = prompt("Enter approval remarks (or leave blank for standard approval):", "Approved and compliant with platform policies.");
        if (note == null) return;

        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ decision: decision, note: note.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update listing status');
            showToast(`Listing #${listingId} approved and published!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.moderateListingWithNote = async function (listingId, decision) {
        const promptLabel = decision === 'REJECTED' ? 'rejection reason' : 'requested changes details';
        const note = prompt(`Enter ${promptLabel} for Listing #${listingId}:`);
        if (!note || !note.trim()) {
            alert(`A ${promptLabel} is required.`);
            return;
        }

        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ decision: decision, note: note.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update listing status');
            showToast(`Listing #${listingId} marked as ${decision}!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.inspectListingDetails = function (listingId) {
        const l = state.inventory.find(x => x.id === listingId);
        if (!l) return;
        const modal = document.getElementById("inspectListingModal");
        const body = document.getElementById("inspectListingModalBody");
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; font-size:0.86rem;">
                <div><strong style="color:#0f172a;">Title:</strong> ${escapeHtml(l.title)}</div>
                <div><strong style="color:#0f172a;">Owner:</strong> ${escapeHtml(l.ownerName)} (${escapeHtml(l.ownerEmail)})</div>
                <div><strong style="color:#0f172a;">Location:</strong> ${escapeHtml(l.address || '')}, ${escapeHtml(l.locality || '')}, ${escapeHtml(l.city || '')}</div>
                <div><strong style="color:#0f172a;">Price:</strong> ${formatCurrency(l.price)} (Deposit: ${formatCurrency(l.deposit)})</div>
                <div><strong style="color:#0f172a;">Type & BHK:</strong> ${escapeHtml(l.propertyType)} · ${escapeHtml(l.bhk || '')} · Floor ${l.floorNumber || '—'}/${l.totalFloors || '—'}</div>
                <div><strong style="color:#0f172a;">Furnishing & Parking:</strong> ${escapeHtml(l.furnishing || '—')} · ${escapeHtml(l.parking || '—')}</div>
                <div><strong style="color:#0f172a;">Amenities:</strong> ${escapeHtml(l.amenities || '—')}</div>
                ${l.reviewNote ? `<div><strong style="color:#b45309;">Review Note:</strong> ${escapeHtml(l.reviewNote)}</div>` : ''}
                ${l.rejectionReason ? `<div><strong style="color:#dc2626;">Rejection Reason:</strong> ${escapeHtml(l.rejectionReason)}</div>` : ''}
            </div>`;
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };

    // -------------------------------------------------------------
    // 6. ENQUIRIES & VISIT TRACKING
    // -------------------------------------------------------------
    async function loadEnquiries() {
        try {
            const res = await fetch('/api/property/portal/enquiries', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.enquiries = await res.json();
            renderEnquiriesTable();
        } catch (err) {
            console.error("Error loading enquiries:", err);
            const tbody = document.getElementById("enquiriesTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No customer inquiries found. (Status: ${escapeHtml(err.message || 'Ready')})</td></tr>`;
            }
        }
    }

    function renderEnquiriesTable() {
        const tbody = document.getElementById("enquiriesTableBody");
        if (!tbody) return;

        if (state.enquiries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No customer enquiries yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.enquiries.map(row => {
            const e = row.enquiry || {};
            const isResponded = (e.status || '').toUpperCase() === 'RESPONDED';
            let stBadge = isResponded
                ? `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Responded</span>`
                : `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">New</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-size:0.82rem; color:#64748b;">${formatDateTime(e.createdAt)}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(e.name || 'Anonymous')}</strong>
                        <div style="font-size:0.76rem; color:#64748b;">${escapeHtml(e.phone || '')} · ${escapeHtml(e.email || '')}</div>
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.84rem; color:#1e293b;">${escapeHtml(row.listingTitle || 'General Enquiry')}</strong>
                        <small style="color:#64748b;">Type: ${escapeHtml(e.enquiryType || 'General')}</small>
                    </td>
                    <td style="padding:14px 18px; max-width:280px;">
                        <div style="font-size:0.82rem; color:#334155;">${escapeHtml(e.message || '—')}</div>
                        ${e.reply ? `<div style="font-size:0.76rem; color:#059669; margin-top:4px;"><strong>Admin Reply:</strong> ${escapeHtml(e.reply)}</div>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${stBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        <button type="button" onclick="replyToEnquiry(${e.id})"
                            style="padding:6px 12px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                            ${isResponded ? 'Send Follow-up' : 'Respond'}
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    window.replyToEnquiry = async function (enquiryId) {
        const reply = prompt(`Enter response message for Enquiry #${enquiryId}:`);
        if (!reply || !reply.trim()) return;

        try {
            const res = await fetch(`/api/property/portal/enquiries/${enquiryId}/reply`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ reply: reply.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send reply');
            showToast(`Response dispatched for Enquiry #${enquiryId}!`);
            loadEnquiries();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    async function loadVisits() {
        try {
            const res = await fetch('/api/property/portal/visits', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.visits = await res.json();
            renderVisitsTable();
        } catch (err) {
            console.error("Error loading visits:", err);
            const tbody = document.getElementById("visitsTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No scheduled site visits found.</td></tr>`;
            }
        }
    }

    function renderVisitsTable() {
        const tbody = document.getElementById("visitsTableBody");
        if (!tbody) return;

        if (state.visits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No site visits scheduled yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.visits.map(v => {
            const st = (v.visitStatus || 'REQUESTED').toUpperCase();
            let stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">${st}</span>`;
            if (st === 'CONFIRMED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Confirmed</span>`;
            else if (st === 'REQUESTED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">Requested</span>`;
            else if (st === 'CANCELLED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">Cancelled</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#VST-${v.id}</td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#0f172a; font-weight:700;">
                        ${formatDateTime(v.scheduledAt)}
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(v.visitorName || 'Visitor')}</strong>
                        <small style="color:#64748b;">${escapeHtml(v.visitorPhone || '')} · ${escapeHtml(v.visitorEmail || '')}</small>
                    </td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#334155;">
                        ${escapeHtml(v.listing?.title || 'Property #' + (v.listing?.id || '—'))}
                    </td>
                    <td style="padding:14px 18px;">${stBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${st === 'REQUESTED' ? `
                                <button type="button" onclick="updateVisit(${v.id}, 'CONFIRMED')"
                                    style="padding:6px 10px; border-radius:8px; background:#10b981; color:#ffffff; font-size:0.76rem; font-weight:800; border:none; cursor:pointer;">
                                    Confirm
                                </button>
                                <button type="button" onclick="updateVisit(${v.id}, 'CANCELLED')"
                                    style="padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#dc2626; font-size:0.76rem; font-weight:800; cursor:pointer;">
                                    Cancel
                                </button>
                            ` : `
                                <button type="button" onclick="updateVisit(${v.id}, 'CANCELLED')"
                                    style="padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#64748b; font-size:0.76rem; font-weight:700; cursor:pointer;">
                                    Cancel Visit
                                </button>
                            `}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    window.updateVisit = async function (visitId, status) {
        if (!confirm(`Are you sure you want to mark Visit #${visitId} as ${status}?`)) return;

        try {
            const res = await fetch(`/api/property/portal/visits/${visitId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ status: status })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update visit');
            showToast(`Visit #${visitId} status updated to ${status}!`);
            loadVisits();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // -------------------------------------------------------------
    // 7. REPORTS & COMPLAINTS
    // -------------------------------------------------------------
    async function loadReports() {
        try {
            const res = await fetch('/api/property/portal/reports', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.reports = await res.json();
            renderReportsTable();
        } catch (err) {
            console.error("Error loading reports:", err);
        }
    }

    function renderReportsTable() {
        const tbody = document.getElementById("reportsTableBody");
        if (!tbody) return;

        const filter = (document.getElementById("reportStatusFilter")?.value || "").toUpperCase().trim();
        const filtered = state.reports.filter(r => {
            if (!filter || filter === 'ALL') return true;
            return (r.status || '').toUpperCase() === filter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No consumer reports or complaints filed.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(r => {
            const isOpen = (r.status || '').toUpperCase() === 'OPEN';
            let stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">${escapeHtml(r.status)}</span>`;
            if (isOpen) stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">Open Complaint</span>`;
            else if ((r.status || '').toUpperCase() === 'RESOLVED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Resolved</span>`;
            else if ((r.status || '').toUpperCase() === 'DISMISSED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#64748b;">Dismissed</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#REP-${r.id}</td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#64748b;">${formatDateTime(r.createdAt)}</td>
                    <td style="padding:14px 18px;">
                        <a href="/propertydirect/apartment-detail?id=${r.listingId}" target="_blank" style="font-weight:700; color:#2563eb; text-decoration:none;">
                            Listing #${r.listingId} ↗
                        </a>
                    </td>
                    <td style="padding:14px 18px; max-width:300px;">
                        <div style="font-size:0.84rem; color:#0f172a; font-weight:600;">${escapeHtml(r.reason)}</div>
                        ${r.resolution ? `<small style="display:block; color:#15803d; margin-top:4px;"><strong>Resolution:</strong> ${escapeHtml(r.resolution)}</small>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${stBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        ${isOpen ? `
                            <div style="display:inline-flex; align-items:center; gap:6px;">
                                <button type="button" onclick="resolveReport(${r.id})"
                                    style="padding:6px 12px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                                    Resolve
                                </button>
                                <button type="button" onclick="dismissReport(${r.id})"
                                    style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#64748b; font-size:0.78rem; font-weight:700; cursor:pointer;">
                                    Dismiss
                                </button>
                            </div>
                        ` : `
                            <span style="font-size:0.78rem; color:#94a3b8;">Case Closed</span>
                        `}
                    </td>
                </tr>`;
        }).join('');
    }

    window.resolveReport = async function (reportId) {
        const resolution = prompt(`Enter resolution findings and action taken for Report #${reportId}:`, "Verified listing data with seller and confirmed compliance.");
        if (!resolution || !resolution.trim()) return;

        try {
            const res = await fetch(`/api/property/portal/reports/${reportId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ reply: resolution.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to resolve report');
            showToast(`Report #${reportId} resolved!`);
            loadReports();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.dismissReport = async function (reportId) {
        const dismissal = prompt(`Enter reason for dismissing Report #${reportId}:`, "Report evaluated; listing is authentic and complies with guidelines.");
        if (!dismissal || !dismissal.trim()) return;

        try {
            const res = await fetch(`/api/property/portal/reports/${reportId}/dismiss`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ reply: dismissal.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to dismiss report');
            showToast(`Report #${reportId} dismissed!`);
            loadReports();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // -------------------------------------------------------------
        // 8. CATEGORIES, AMENITIES & LOCATIONS METADATA
    // -------------------------------------------------------------
    const CATEGORY_TAGS = {
        'APARTMENT': 'High-Rise Living',
        'VILLA': 'Gated Community',
        'COMMERCIAL': 'Commercial Grade',
        'PLOT': 'Investment Land',
        'STUDIO': 'Compact Urban',
        'PENTHOUSE': 'Ultra-Luxury Tier',
        'OFFICE': 'Grade-A Workspace'
    };

    const AMENITY_GROUPS = {
        'Swimming Pool': 'Sports & Wellness',
        'Gym': 'Fitness & Health',
        'Clubhouse': 'Leisure & Social',
        'Power Backup': '24/7 Essentials',
        'Covered Parking': 'Convenience',
        '24/7 Security': 'Safety & Surveillance',
        'Lift': 'Infrastructure',
        'EV Charging': 'Green & Eco',
        'Children Play Area': 'Family Friendly',
        'Jogging Track': 'Wellness & Outdoor'
    };

    const LOCATION_TIERS = {
        'Bangalore': 'Tier 1 Metro • Tech Capital',
        'Bengaluru': 'Tier 1 Metro • Tech Capital',
        'Mumbai': 'Tier 1 Metro • Financial Center',
        'Delhi NCR': 'Tier 1 Metro • Capital Region',
        'Chennai': 'Tier 1 Metro • Industrial & IT Hub',
        'Hyderabad': 'Tier 1 Metro • High Growth Tech',
        'Pune': 'Tier 2 Metro • Education & IT',
        'Kolkata': 'Tier 1 Metro • Eastern Gateway',
        'Ahmedabad': 'Tier 2 Metro • Commerce Center',
        'Coimbatore': 'Tier 2 Growth • Manufacturing & IT',
        'Kochi': 'Tier 2 Growth • Port & Tourism'
    };

    function getCategoryTag(name) {
        const upper = (name || '').toUpperCase();
        for (const [k, v] of Object.entries(CATEGORY_TAGS)) {
            if (upper.includes(k)) return v;
        }
        return 'Specialized Category';
    }

    function getAmenityGroup(name) {
        for (const [k, v] of Object.entries(AMENITY_GROUPS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Standard Facility';
    }

    function getLocationTier(name) {
        for (const [k, v] of Object.entries(LOCATION_TIERS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Target Growth Market';
    }

    async function loadMetadata() {
        try {
            const res = await fetch('/api/property/portal/admin/metadata', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            state.metadata = await res.json();
            renderMetadataSection();
            renderFeaturedSection();
        } catch (err) {
            console.error("Error loading metadata:", err);
        }
    }

    function renderMetadataSection() {
        if (!state.metadata) return;
        const cats = state.metadata.categories || {};
        const amenities = state.metadata.amenities || {};
        const locations = state.metadata.locations || {};

        // Update Button Count Badges
        const catBadge = document.getElementById("metaCatBadge");
        if (catBadge) catBadge.textContent = Object.keys(cats).length + " Types";

        const amenBadge = document.getElementById("metaAmenBadge");
        if (amenBadge) amenBadge.textContent = Object.keys(amenities).length + " Items";

        const locBadge = document.getElementById("metaLocBadge");
        if (locBadge) locBadge.textContent = Object.keys(locations).length + " Cities";

        // 1. Categories Grid
        const catContainer = document.getElementById("metaCategoriesGrid");
        if (catContainer) {
            const catEntries = Object.entries(cats);
            if (catEntries.length === 0) {
                catContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No categories configured yet.</div>';
            } else {
                catContainer.innerHTML = catEntries.map(([name, count]) => {
                    const tag = getCategoryTag(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#64748b; font-weight:600;">${tag}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#eff6ff; color:#2563eb;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Category', '${escapeHtml(name)}')" title="Remove Category" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 2. Amenities Grid
        const amenContainer = document.getElementById("metaAmenitiesGrid");
        if (amenContainer) {
            const amenEntries = Object.entries(amenities);
            if (amenEntries.length === 0) {
                amenContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No amenities configured yet.</div>';
            } else {
                amenContainer.innerHTML = amenEntries.map(([name, count]) => {
                    const group = getAmenityGroup(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.86rem; color:#1e293b; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#059669; font-weight:700;">${group}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#475569;">${count}</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Amenity', '${escapeHtml(name)}')" title="Remove Amenity" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 3. Locations Grid
        const locContainer = document.getElementById("metaLocationsGrid");
        if (locContainer) {
            const locEntries = Object.entries(locations);
            if (locEntries.length === 0) {
                locContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No cities configured yet.</div>';
            } else {
                locContainer.innerHTML = locEntries.map(([name, count]) => {
                    const tier = getLocationTier(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#fff7ed; color:#ea580c; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#ea580c; font-weight:700;">${tier}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f8fafc; color:#334155; border:1px solid #e2e8f0;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Location', '${escapeHtml(name)}')" title="Remove City" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    }

    // Comprehensive Metadata Creation Modal
    window.openMetadataDetailModal = function (type) {
        const modal = document.getElementById("metadataDetailModal");
        if (!modal) {
            console.error("Modal #metadataDetailModal not found");
            return;
        }

        const iconBadge = document.getElementById("metaModalIconBadge");
        const titleEl = document.getElementById("metaModalTitle");
        const subtitleEl = document.getElementById("metaModalSubtitle");
        const typeInput = document.getElementById("metaItemType");
        const fieldsContainer = document.getElementById("metaDynamicFields");
        const submitBtn = document.getElementById("metaSubmitBtn");

        typeInput.value = type;

        if (type === 'Category') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>';
            iconBadge.style.background = '#eff6ff';
            iconBadge.style.color = '#2563eb';
            titleEl.textContent = 'Add Property Category';
            subtitleEl.textContent = 'Configure architectural property taxonomy, code slug, and search filter specifications.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Duplex Penthouse, Serviced Studio, Gated Villa" required
                        oninput="document.getElementById('metaCategorySlug').value = this.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')"
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Taxonomy Code / Slug</label>
                        <input id="metaCategorySlug" type="text" placeholder="e.g. DUPLEX_PENTHOUSE"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; font-family:monospace; background:#f8fafc; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Classification Group</label>
                        <select id="metaCategoryGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Residential">Residential Living</option>
                            <option value="Commercial">Commercial Real Estate</option>
                            <option value="Industrial">Industrial & Warehousing</option>
                            <option value="Land">Plot & Development Land</option>
                            <option value="Hospitality">Farmhouse & Resort Living</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Description & Guidelines</label>
                    <textarea id="metaCategoryDesc" rows="2" placeholder="Brief criteria for properties qualifying under this category..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaCategoryFeatured" checked style="width:16px; height:16px; accent-color:#2563eb; cursor:pointer;">
                    <label for="metaCategoryFeatured" style="font-size:0.82rem; color:#1e40af; font-weight:680; cursor:pointer; margin:0;">
                        Feature on search filter bar and buyer explore drawer
                    </label>
                </div>
            `;
        } else if (type === 'Amenity') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
            iconBadge.style.background = '#ecfdf5';
            iconBadge.style.color = '#059669';
            titleEl.textContent = 'Add Platform Amenity';
            subtitleEl.textContent = 'Register a standardized amenity for listing checklists, amenities filter, and compliance audits.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #065f46 0%, #059669 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Infinity Rooftop Pool, EV Fast Charger, Padel Court" required
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Group</label>
                        <select id="metaAmenityGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Sports & Fitness">Sports & Wellness</option>
                            <option value="Security & Safety">Security & Surveillance</option>
                            <option value="Green & Eco">Green Living & Eco</option>
                            <option value="Leisure & Clubhouse">Leisure & Clubhouse</option>
                            <option value="Smart Automation">Smart Home Automation</option>
                            <option value="Convenience">Convenience & Essentials</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Specification Tier</label>
                        <select id="metaAmenityTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Standard">Standard Facility</option>
                            <option value="Premium">Premium Upgrade</option>
                            <option value="Ultra-Luxury">Ultra-Luxury Signature</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Verification Guidelines</label>
                    <textarea id="metaAmenityGuidelines" rows="2" placeholder="e.g. Must support 22kW fast charging with dedicated parking bay..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#ecfdf5; border:1px solid #a7f3d0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaAmenityHighlight" checked style="width:16px; height:16px; accent-color:#059669; cursor:pointer;">
                    <label for="metaAmenityHighlight" style="font-size:0.82rem; color:#065f46; font-weight:680; cursor:pointer; margin:0;">
                        Include in quick search checklist and highlight on property cards
                    </label>
                </div>
            `;
        } else if (type === 'Location') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
            iconBadge.style.background = '#fff7ed';
            iconBadge.style.color = '#ea580c';
            titleEl.textContent = 'Add Market City / Location';
            subtitleEl.textContent = 'Expand regional platform operations, market benchmark rates, and locality clusters.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">City / Urban Center <span style="color:#ef4444;">*</span></label>
                        <input id="metaItemNameInput" type="text" placeholder="e.g. Coimbatore, Hyderabad, Pune" required
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">State / Province</label>
                        <input id="metaLocationState" type="text" placeholder="e.g. Tamil Nadu, Telangana"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Market Tier</label>
                        <select id="metaLocationTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Tier 1 Metro">Tier 1 Metro Capital</option>
                            <option value="Tier 2 Growth Hub">Tier 2 High-Growth Hub</option>
                            <option value="Emerging Corridor">Emerging Industrial Corridor</option>
                            <option value="Destination">Destination / Vacation Retreat</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Benchmark Rate (₹/sq.ft)</label>
                        <input id="metaLocationRate" type="text" placeholder="e.g. ₹ 5,500 - 11,000 / sq.ft"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Key Micro-Markets & Localities</label>
                    <input id="metaLocationLocalities" type="text" placeholder="Comma-separated: RS Puram, Peelamedu, Gandhipuram, Saravanampatti"
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#fff7ed; border:1px solid #fed7aa; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaLocationActive" checked style="width:16px; height:16px; accent-color:#ea580c; cursor:pointer;">
                    <label for="metaLocationActive" style="font-size:0.82rem; color:#9a3412; font-weight:680; cursor:pointer; margin:0;">
                        Open for public listings and buyer location filters immediately
                    </label>
                </div>
            `;
        }

        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.classList.add("active");
        modal.classList.add("show");
        modal.style.display = "flex";
        setTimeout(() => {
            const input = document.getElementById("metaItemNameInput");
            if (input) input.focus();
        }, 80);
    };

    window.submitMetadataDetail = async function (e) {
        if (e) e.preventDefault();
        const type = document.getElementById("metaItemType").value;
        const nameInput = document.getElementById("metaItemNameInput");
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            showToast("Please enter a valid item name", true);
            return;
        }

        const submitBtn = document.getElementById("metaSubmitBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Publishing to Platform...";
        }

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=ADD`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add item');

            // Optimistic update in state
            if (state.metadata) {
                if (type === 'Category') {
                    state.metadata.categories = state.metadata.categories || {};
                    state.metadata.categories[name] = 0;
                } else if (type === 'Amenity') {
                    state.metadata.amenities = state.metadata.amenities || {};
                    state.metadata.amenities[name] = 0;
                } else if (type === 'Location') {
                    state.metadata.locations = state.metadata.locations || {};
                    state.metadata.locations[name] = 0;
                }
                renderMetadataSection();
            }

            closeModal('metadataDetailModal');
            showToast(`${type} '${name}' successfully configured and published to platform catalog!`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save & Publish Item';
            }
        }
    };

    window.removeMetadataItem = async function (type, name) {
        if (!confirm(`Are you sure you want to remove ${type} '${name}' from platform catalog?`)) return;

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=REMOVE`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to remove item');

            if (state.metadata) {
                if (type === 'Category' && state.metadata.categories) delete state.metadata.categories[name];
                if (type === 'Amenity' && state.metadata.amenities) delete state.metadata.amenities[name];
                if (type === 'Location' && state.metadata.locations) delete state.metadata.locations[name];
                renderMetadataSection();
            }

            showToast(`${type} '${name}' removed from catalog.`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // Backwards compatibility alias
    window.addMetadataItem = function (type) {
        window.openMetadataDetailModal(type);
    };

// 9. FEATURED LISTINGS & PUBLIC CONTENT
    // -------------------------------------------------------------
    function renderFeaturedSection() {
        if (!state.metadata) return;
        const featured = state.metadata.featuredListings || [];
        const container = document.getElementById("featuredListingsContainer");
        if (!container) return;

        if (featured.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No properties currently set as featured. Feature approved listings from the Property Inventory tab.</div>`;
            return;
        }

        container.innerHTML = featured.map(l => `
            <div style="padding:16px 20px; border-radius:14px; border:1px solid #fde68a; background:#fffbeb; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.4rem;">★</span>
                    <div>
                        <strong style="display:block; font-size:0.92rem; color:#78350f;">${escapeHtml(l.title)} (#PDT-${l.id})</strong>
                        <small style="color:#b45309;">${escapeHtml(l.city || '')} · ${formatCurrency(l.price)}</small>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <a href="/propertydirect/apartment-detail?id=${l.id}" target="_blank"
                        style="padding:6px 12px; border-radius:8px; border:1px solid #fde68a; background:#ffffff; color:#78350f; font-size:0.78rem; font-weight:700; text-decoration:none;">
                        View Listing ↗
                    </a>
                    <button type="button" onclick="toggleFeatured(${l.id}, true)"
                        style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#dc2626; font-size:0.78rem; font-weight:700; cursor:pointer;">
                        Remove Featured
                    </button>
                </div>
            </div>
        `).join('');
    }

    // -------------------------------------------------------------
    // 10. NOTIFICATIONS & AUDIT HISTORY
    // -------------------------------------------------------------
    async function loadAudit() {
        const targetType = document.getElementById("auditTargetTypeFilter")?.value || "";
        const search = document.getElementById("auditSearchInput")?.value || "";

        let url = '/api/property/portal/audit?';
        if (targetType) url += `targetType=${encodeURIComponent(targetType)}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.audit = await res.json();
            renderAuditTable();
        } catch (err) {
            console.error("Error loading audit history:", err);
        }
    }

    function renderAuditTable() {
        const tbody = document.getElementById("auditTableBody");
        if (!tbody) return;

        if (state.audit.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No audit logs match criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.audit.map(e => {
            let badge = `<span style="padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">${escapeHtml(e.action)}</span>`;
            if (e.action.includes('APPROVED')) badge = `<span style="padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d;">${escapeHtml(e.action)}</span>`;
            else if (e.action.includes('REJECTED') || e.action.includes('SUSPENDED')) badge = `<span style="padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c;">${escapeHtml(e.action)}</span>`;
            else if (e.action.includes('CHANGES_REQUESTED')) badge = `<span style="padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#b45309;">${escapeHtml(e.action)}</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-size:0.82rem; color:#64748b; white-space:nowrap;">
                        ${formatDateTime(e.createdAt)}
                    </td>
                    <td style="padding:14px 18px;">${badge}</td>
                    <td style="padding:14px 18px; font-weight:700; font-size:0.84rem; color:#1e293b;">
                        ${escapeHtml(e.targetType)} #${e.targetId}
                    </td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#475569;">
                        <code>${escapeHtml(e.actor || 'system')}</code>
                    </td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#334155; line-height:1.4;">
                        ${escapeHtml(e.detail || '—')}
                    </td>
                </tr>`;
        }).join('');
    }

    // Modal Helper
    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("active");
            modal.classList.remove("show");
            modal.style.display = "none";
        }
    };

    // Initialize on DOM Ready
    document.addEventListener("DOMContentLoaded", function () {
        // Wire sidebar click listener
        document.querySelectorAll(".sidebar-nav [data-panel]").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                switchTabAndFilter(this.dataset.panel);
            });
        });

        // Wire filter listeners
        document.getElementById("userSearchInput")?.addEventListener("input", renderUsersTable);
        document.getElementById("userRoleFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userStatusFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userVerifyFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userFilterResetBtn")?.addEventListener("click", () => {
            document.getElementById("userSearchInput").value = "";
            document.getElementById("userRoleFilter").value = "";
            document.getElementById("userStatusFilter").value = "";
            document.getElementById("userVerifyFilter").value = "";
            renderUsersTable();
        });

        document.getElementById("appDecisionFilter")?.addEventListener("change", renderApplicationsTable);

        document.getElementById("inventoryStatusFilter")?.addEventListener("change", renderInventoryTable);
        document.getElementById("inventoryTypeFilter")?.addEventListener("change", renderInventoryTable);
        document.getElementById("inventorySearchInput")?.addEventListener("input", renderInventoryTable);

        document.getElementById("reportStatusFilter")?.addEventListener("change", renderReportsTable);

        document.getElementById("auditTargetTypeFilter")?.addEventListener("change", loadAudit);
        document.getElementById("auditSearchInput")?.addEventListener("input", loadAudit);

        // Hash change listener
        window.addEventListener("hashchange", function () {
            const h = window.location.hash.replace("#", "") || "overview";
            switchTabAndFilter(h);
        });

        // Initial tab from hash or default to overview
        const initialHash = window.location.hash.replace("#", "") || "overview";
        switchTabAndFilter(initialHash);
    });

})();
