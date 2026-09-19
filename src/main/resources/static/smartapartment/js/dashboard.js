const titles = {
    overview: "Overview",
    monitoring: "Apartment Monitoring",
    societies: "Society Management",
    subscriptions: "Subscriptions",
    users: "Users",
    analytics: "Analytics",
    settings: "Settings",
    flats: "Blocks and Flats",
    residents: "Residents",
    billing: "Maintenance Billing",
    visitors: "Visitor Management",
    complaints: "Complaints",
    amenities: "Amenities",
    announcements: "Announcements",
    expenses: "Expenses",
    payments: "Payments",
    reports: "Reports",
    profile: "Profile",
    pass: "Visitor Pass",
    entries: "Gate Entries",
    tasks: "Maintenance Tasks",
    "billing-rules": "Recurring Charge Rules",
    staff: "Domestic Staff",
    deliveries: "Delivery Management",
    polls: "Community Polls",
    assets: "Assets and Preventive Maintenance",
    "audit-logs": "Granular Audit Trail",
    services: "NoBroker Carpentry & Home Services",
    maintenance: "Maintenance / Service Requests"
};
const securityPanelTitles = {
    overview: "Overview",
    verify: "Pass / OTP Verification",
    entries: "Gate Entry Register",
    visitors: "Active Visitors",
    deliveries: "Delivery Log",
    staff: "Daily Staff & Attendance",
    incidents: "Gate Incidents",
    announcements: "Announcements",
    profile: "Profile Settings"
};

const toast = document.getElementById("toast");
const dashboardRole = document.body.dataset.dashboardRole || "admin";
const dashboardStorageKey = `smartapartment-dashboard-state:v12:${dashboardRole}`;
const residentProfileStorageKey = "smartapartment-resident-profile:v1";
const residentAdminInboxKey = "smartapartment-resident-admin-inbox:v1";
const residentPaymentProofsKey = "smartapartment-resident-payment-proofs:v1";
const rolePanelRoutes = {
    superadmin: ["monitoring", "audit-logs", "societies", "subscriptions", "analytics"],
    admin: ["residents", "billing", "visitors", "complaints"],
    resident: ["maintenance", "billing", "pass", "services", "complaints", "amenities", "announcements", "deliveries", "profile"],
    security: ["entries", "pass", "visitors", "entries"],
    maintenance: ["tasks", "complaints", "tasks", "profile"]
};
let activeAction = null;
let activePaymentProof = null;
let latestPlatformAuditStream = [];

async function persistWorkflowAction(action, button, values = []) {
    const context = getContext(button || document.body);
    const response = await fetch("/api/workflows", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            workspace: "SmartSociety",
            dashboardRole,
            panel: context.panel,
            actionType: action,
            targetLabel: context.target,
            details: { values, button: buttonLabel(button || document.body), recordedAt: new Date().toISOString() }
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Action could not be saved to the database");
    return data;
}

function setupDashboardSidebarControls() {
    const sidebar = document.getElementById("sidebar") || document.querySelector(".dash-sidebar");
    if (!sidebar || sidebar.dataset.closeControlReady === "true") return;
    sidebar.dataset.closeControlReady = "true";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "dashboard-sidebar-close";
    closeButton.setAttribute("aria-label", "Close sidebar");
    closeButton.title = "Close sidebar";
    closeButton.textContent = "×";
    sidebar.prepend(closeButton);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "dashboard-sidebar-open";
    openButton.setAttribute("aria-label", "Open sidebar");
    openButton.setAttribute("aria-controls", sidebar.id || "sidebar");
    openButton.setAttribute("aria-expanded", "true");
    openButton.title = "Open sidebar";
    openButton.innerHTML = "<span></span><span></span><span></span>";
    document.body.appendChild(openButton);

    const setSidebarOpen = open => {
        /* A flex child that is only translated off-screen still reserves its
           full width. Remove it from the layout completely when closed so the
           content area always begins at the viewport edge. */
        if (open) {
            sidebar.style.removeProperty("transform");
            sidebar.style.removeProperty("margin-right");
            sidebar.style.removeProperty("opacity");
            sidebar.style.removeProperty("pointer-events");
            sidebar.style.removeProperty("transition");
            sidebar.style.setProperty("display", "flex", "important");
            document.body.classList.remove("dashboard-sidebar-closed");
        } else {
            sidebar.style.setProperty("display", "none", "important");
            document.body.classList.add("dashboard-sidebar-closed");
        }
        openButton.setAttribute("aria-expanded", String(open));
        closeButton.setAttribute("aria-hidden", String(!open));
        if (open) sidebar.querySelector("button, a")?.focus();
        else openButton.focus();
    };

    closeButton.addEventListener("click", () => setSidebarOpen(false));
    openButton.addEventListener("click", () => setSidebarOpen(true));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !document.body.classList.contains("dashboard-sidebar-closed")) {
            setSidebarOpen(false);
        }
    });
}

setupDashboardSidebarControls();

function enhanceExistingDetailedForms() {
    const schemas = {
        billingRuleForm: [[0,"Charge definition","Name, amount and recurrence"],[5,"Schedule & automation","Next run date and automatic processing"]],
        staffForm: [[0,"Identity & service","Worker contact, role and verification"],[4,"Access coverage","Assigned area, proof and emergency contact"],[7,"Working schedule","Days, shift timing and administrative notes"]],
        deliveryForm: [[0,"Recipient & courier","Destination, provider and tracking identity"],[5,"Package details","Recipient, package type, condition and storage"],[9,"Evidence & instructions","Proof reference and handling notes"]],
        pollForm: [[0,"Poll definition","Question, category and decision context"],[3,"Voting configuration","Options, closing time, audience and result visibility"]],
        assetForm: [[0,"Asset identification","Name, category, location and serial number"],[4,"Ownership & condition","Purchase information and current condition"],[8,"Vendor, warranty & AMC","Service provider and coverage details"],[12,"Preventive maintenance","Service history, interval and maintenance notes"]],
        expenseForm: [[0,"Expense identification","Title, category and expense date"],[3,"Vendor & invoice","Payee contact and invoice references"],[8,"Amounts & audit context","Base amount, tax and supporting description"]],
        visitorPassForm: [[0,"Visitor & destination","Identity, contact and flat information"],[4,"Schedule & purpose","Validity, visit purpose and resident instructions"]],
        qrPassForm: [[0,"Pass verification","QR/pass reference and visitor identity"],[3,"Gate processing","Destination, entry details and security notes"]],
        incidentForm: [[0,"Incident classification","Type, location and related vehicle"],[3,"Facts & escalation","People involved, immediate action and full incident narrative"]]
    };
    Object.entries(schemas).forEach(([id, sections]) => {
        const form = document.getElementById(id);
        if (!form || form.dataset.detailedSectionsReady) return;
        form.dataset.detailedSectionsReady = "true";
        form.classList.add("detailed-record-form");
        const originalChildren = [...form.children];
        [...sections].reverse().forEach(([before,title,note]) => {
            const marker = document.createElement("div");
            marker.className = "col-12 detailed-form-section";
            marker.innerHTML = `<strong>${title}</strong><span>${note}</span>`;
            form.insertBefore(marker, originalChildren[before] || null);
        });
    });
}

enhanceExistingDetailedForms();

function setupDetailedProfileSettings() {
    const sidebarNav = document.querySelector("#sidebar nav, #sidebar .nav");
    const content = document.querySelector(".dashboard-container");
    if (!sidebarNav || !content || content.dataset.profileSettingsReady) return;
    content.dataset.profileSettingsReady = "true";

    const roleNames = {
        superadmin: "Platform Owner", admin: "Society Administrator", resident: "Resident",
        security: "Security Officer", maintenance: "Maintenance Professional", accountant: "Accountant"
    };
    let panel = document.querySelector('[data-view="profile"]');
    if (!panel && dashboardRole !== "superadmin") {
        const link = document.createElement("a");
        link.href = "#profile";
        link.className = "nav-link btn btn-link text-start text-decoration-none";
        link.dataset.panel = "profile";
        link.innerHTML = '<i class="fa-solid fa-user-gear me-2"></i> Profile Settings';
        sidebarNav.appendChild(link);
        panel = document.createElement("section");
        panel.className = "d-none";
        panel.dataset.view = "profile";
        content.appendChild(panel);
    }

    const host = dashboardRole === "superadmin" ? document.querySelector('[data-view="settings"]') : panel;
    if (!host) return;
    if (panel) panel.innerHTML = "";
    const profile = document.createElement("div");
    profile.className = "profile-settings";
    profile.innerHTML = `
        <div class="profile-settings__heading">
            <div><span class="profile-settings__eyebrow">ACCOUNT & ACCESS</span><h2>My Profile Settings</h2><p>Manage your personal details, communication choices, and account security.</p></div>
            <span class="profile-settings__state" id="profileSaveState"><i class="fa-solid fa-circle-check"></i> Profile connected</span>
        </div>
        <div class="profile-settings__summary">
            <div class="profile-avatar" id="profileAvatar">—</div>
            <div><strong id="profileSummaryName">Loading profile…</strong><span id="profileSummaryRole">${roleNames[dashboardRole] || "Dashboard User"}</span><small id="profileSummaryEmail"></small></div>
            <dl><div><dt>Workspace</dt><dd id="profileWorkspace">—</dd></div><div><dt>Account</dt><dd id="profileAccountStatus">—</dd></div><div><dt>MFA</dt><dd id="profileMfaStatus">—</dd></div></dl>
        </div>
        <form id="dashboardProfileForm" class="profile-settings__section">
            <div class="profile-settings__section-title"><span class="profile-settings__icon-box"><i class="fa-solid fa-address-card"></i></span><div><h3>Personal information</h3><p>These details identify you to the people and workflows you manage.</p></div></div>
            <div class="profile-form-grid">
                <label><span>Full name *</span><input id="profileFullName" autocomplete="name" maxlength="120" required></label>
                <label><span>Email address</span><input id="profileEmail" type="email" readonly><small>Your login email is protected from profile edits.</small></label>
                <label><span>Phone number</span><input id="profilePhone" type="tel" autocomplete="tel" maxlength="30" placeholder="Add contact number"></label>
                <label><span>Designation / responsibility</span><input id="profileDesignation" maxlength="100" placeholder="Add your designation"></label>
                <label><span>Dashboard role</span><input id="profileRole" readonly></label>
                <label><span>Society / workspace</span><input id="profileTenant" readonly></label>
            </div>
            <div class="profile-settings__actions"><button type="reset" class="btn profile-secondary-button">Discard changes</button><button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save profile</button></div>
        </form>
        <form id="dashboardPreferencesForm" class="profile-settings__section">
            <div class="profile-settings__section-title"><span class="profile-settings__icon-box"><i class="fa-solid fa-bell"></i></span><div><h3>Notifications & display</h3><p>Choose how this dashboard should keep you informed.</p></div></div>
            <div class="profile-preference-grid">
                <label><input type="checkbox" name="emailAlerts"><span><strong>Email notifications</strong><small>Approvals, assignments, reports, and important updates.</small></span></label>
                <label><input type="checkbox" name="browserAlerts"><span><strong>Dashboard notifications</strong><small>Show timely alerts while you are signed in.</small></span></label>
                <label><input type="checkbox" name="weeklySummary"><span><strong>Weekly activity summary</strong><small>Receive a concise summary of relevant activity.</small></span></label>
                <label><input type="checkbox" name="securityAlerts"><span><strong>Security alerts</strong><small>Important sign-in and account protection messages.</small></span></label>
                <label class="profile-select"><span><strong>Language</strong><small>Dashboard display language.</small></span><select name="language"><option value="en">English</option><option value="ta">Tamil</option><option value="hi">Hindi</option></select></label>
                <label class="profile-select"><span><strong>Time zone</strong><small>Used for activity and report times.</small></span><select name="timezone"><option value="Asia/Calcutta">India Standard Time (IST)</option><option value="UTC">UTC</option></select></label>
            </div>
            <div class="profile-settings__actions"><button type="submit" class="btn btn-primary" data-preferences-save><i class="fa-solid fa-check"></i><span>Save preferences</span></button></div>
        </form>
        <form id="dashboardPasswordForm" class="profile-settings__section">
            <div class="profile-settings__section-title"><span class="profile-settings__icon-box"><i class="fa-solid fa-shield-halved"></i></span><div><h3>Password & security</h3><p>Use at least 8 characters with a number and symbol.</p></div></div>
            <div class="profile-form-grid profile-password-grid">
                <label><span>Current password</span><div class="profile-password"><input name="currentPassword" type="password" autocomplete="current-password" required><button type="button" data-password-toggle aria-label="Show current password"><i class="fa-regular fa-eye"></i></button></div></label>
                <label><span>New password</span><div class="profile-password"><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-password-toggle aria-label="Show new password"><i class="fa-regular fa-eye"></i></button></div></label>
                <label><span>Confirm new password</span><div class="profile-password"><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-password-toggle aria-label="Show confirmation"><i class="fa-regular fa-eye"></i></button></div></label>
            </div>
            <div class="profile-security-note"><i class="fa-solid fa-lock"></i><span><strong>Account protection</strong>Your password is stored securely. You will use the new password at your next sign-in.</span></div>
            <div class="profile-settings__actions"><button type="submit" class="btn btn-primary"><i class="fa-solid fa-key"></i> Update password</button></div>
        </form>`;
    if (dashboardRole === "superadmin") {
        const separator = document.createElement("div");
        separator.className = "profile-platform-separator";
        separator.innerHTML = "<span>Platform configuration</span><p>Controls below apply across the SmartSociety platform.</p>";
        host.prepend(separator);
        host.prepend(profile);
    } else host.appendChild(profile);

    let loadedProfile = null;
    const state = (message, error = false) => {
        const node = document.getElementById("profileSaveState");
        if (!node) return;
        node.classList.toggle("is-error", error);
        node.innerHTML = `<i class="fa-solid fa-${error ? "circle-exclamation" : "circle-check"}"></i> ${message}`;
    };
    const paint = data => {
        loadedProfile = data;
        profile.querySelector("#profileFullName").value = data.name || "";
        profile.querySelector("#profileEmail").value = data.email || "";
        profile.querySelector("#profilePhone").value = data.phone || "";
        profile.querySelector("#profileDesignation").value = data.designation || "";
        profile.querySelector("#profileRole").value = String(data.role || roleNames[dashboardRole] || "").replaceAll("_", " ");
        profile.querySelector("#profileTenant").value = data.tenantId || "Platform";
        profile.querySelector("#profileSummaryName").textContent = data.name || "Profile";
        profile.querySelector("#profileSummaryEmail").textContent = data.email || "";
        profile.querySelector("#profileSummaryRole").textContent = roleNames[dashboardRole] || String(data.role || "").replaceAll("_", " ");
        profile.querySelector("#profileWorkspace").textContent = data.tenantId || "Platform";
        profile.querySelector("#profileAccountStatus").textContent = data.accountLocked ? "Locked" : "Active";
        profile.querySelector("#profileMfaStatus").textContent = data.mfaEnabled ? "Enabled" : "Not enabled";
        profile.querySelector("#profileAvatar").textContent = (data.name || "U").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
        state("Profile up to date");
    };
    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || body.error || "Unable to save these settings");
        return body;
    };
    request("/api/society/me").then(paint).catch(error => state(error.message, true));
    profile.querySelector("#dashboardProfileForm").addEventListener("reset", event => { event.preventDefault(); if (loadedProfile) paint(loadedProfile); });
    profile.querySelector("#dashboardProfileForm").addEventListener("submit", async event => {
        event.preventDefault(); state("Saving profile…");
        try { paint(await request("/api/society/me", { method: "PUT", body: JSON.stringify({ name: profile.querySelector("#profileFullName").value, phone: profile.querySelector("#profilePhone").value, designation: profile.querySelector("#profileDesignation").value }) })); showToast("✓ Profile settings saved."); }
        catch (error) { state(error.message, true); showToast(error.message); }
    });
    const preferenceKey = `smartapartment-profile-preferences:v1:${dashboardRole}`;
    const preferences = profile.querySelector("#dashboardPreferencesForm");
    try { const saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}"); [...preferences.elements].forEach(input => { if (!input.name || saved[input.name] === undefined) return; input.type === "checkbox" ? input.checked = saved[input.name] : input.value = saved[input.name]; }); } catch (_) {}
    preferences.addEventListener("submit", async event => {
        event.preventDefault();
        const button = preferences.querySelector("[data-preferences-save]");
        if (button?.disabled) return;
        const values = {};
        [...preferences.elements].forEach(input => { if (input.name) values[input.name] = input.type === "checkbox" ? input.checked : input.value; });
        if (button) {
            button.disabled = true;
            button.classList.remove("btn-success", "animate__pulse");
            button.classList.add("btn-primary");
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Saving…</span>';
        }
        try {
            await new Promise(resolve => window.setTimeout(resolve, 450));
            localStorage.setItem(preferenceKey, JSON.stringify(values));
            state("Preferences saved");
            showToast("✓ Notification and display preferences saved.");
            if (button) {
                button.classList.remove("btn-primary");
                button.classList.add("btn-success", "animate__animated", "animate__pulse");
                button.innerHTML = '<i class="fa-solid fa-circle-check animate__animated animate__zoomIn"></i><span>Preferences saved</span>';
                window.setTimeout(() => {
                    if (!button.isConnected) return;
                    button.disabled = false;
                    button.classList.remove("btn-success", "animate__animated", "animate__pulse");
                    button.classList.add("btn-primary");
                    button.innerHTML = '<i class="fa-solid fa-check"></i><span>Save preferences</span>';
                }, 2200);
            }
        } catch (error) {
            state("Unable to save preferences", true);
            if (button) {
                button.disabled = false;
                button.classList.remove("btn-success");
                button.classList.add("btn-primary");
                button.innerHTML = '<i class="fa-solid fa-check"></i><span>Save preferences</span>';
            }
            showToast("Preferences could not be saved.");
        }
    });
    profile.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => { const input = button.previousElementSibling; const show = input.type === "password"; input.type = show ? "text" : "password"; button.innerHTML = `<i class="fa-regular fa-eye${show ? "-slash" : ""}"></i>`; }));
    profile.querySelector("#dashboardPasswordForm").addEventListener("submit", async event => {
        event.preventDefault(); const form = event.currentTarget; const currentPassword = form.currentPassword.value; const newPassword = form.newPassword.value;
        if (newPassword !== form.confirmPassword.value) { state("New passwords do not match", true); return; }
        state("Updating password…");
        try { const result = await request("/api/society/me/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }); form.reset(); state("Password updated"); showToast(`✓ ${result.message}`); }
        catch (error) { state(error.message, true); showToast(error.message); }
    });
}

setupDetailedProfileSettings();

function setupDetailedMonitoringExport() {
    const trigger = document.getElementById("monitoringExportButton");
    if (!trigger || trigger.dataset.exportReady) return;
    trigger.dataset.exportReady = "true";
    const modal = document.createElement("div");
    modal.className = "monitoring-export-dialog hidden";
    modal.id = "monitoringExportDialog";
    modal.innerHTML = `<div class="monitoring-export-card" role="dialog" aria-modal="true" aria-labelledby="monitoringExportTitle">
        <div class="monitoring-export-header"><div><span>APARTMENT COMMAND WATCH</span><h2 id="monitoringExportTitle">Export detailed monitoring report</h2><p>Choose the exact period, scope, sections, and output format for this report.</p></div><button type="button" data-monitoring-export-close aria-label="Close export report">×</button></div>
        <form id="monitoringExportForm">
            <section><div class="monitoring-export-section-title"><i class="fa-regular fa-file-lines"></i><div><h3>Report details</h3><p>Name and identify the generated document.</p></div></div><div class="monitoring-export-grid">
                <label class="wide"><span>Report title *</span><input name="title" value="Apartment Monitoring Report" maxlength="120" required></label>
                <label><span>Prepared by *</span><input name="preparedBy" maxlength="100" placeholder="Enter responsible person" required></label>
                <label><span>Reference / purpose</span><input name="purpose" maxlength="120" placeholder="e.g. Monthly governance review"></label>
            </div></section>
            <section><div class="monitoring-export-section-title"><i class="fa-regular fa-calendar"></i><div><h3>Reporting period and society scope</h3><p>Limit the report to the required date range and workspace.</p></div></div><div class="monitoring-export-grid">
                <label><span>Period preset</span><select name="preset"><option value="today">Today</option><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom range</option></select></label>
                <label><span>Society</span><select name="society"><option value="ALL">All societies</option></select></label>
                <label><span>From date *</span><input name="fromDate" type="date" required></label>
                <label><span>To date *</span><input name="toDate" type="date" required></label>
            </div></section>
            <section><div class="monitoring-export-section-title"><i class="fa-solid fa-list-check"></i><div><h3>Report sections</h3><p>Select the operational information to include.</p></div></div><div class="monitoring-export-options">
                <label><input type="checkbox" name="summary" checked><span><strong>Executive summary</strong><small>Gate entries, pending bills, approvals, and open risks.</small></span></label>
                <label><input type="checkbox" name="commandWatch" checked><span><strong>Command Watch metrics</strong><small>Module-level live metrics, trends, and action ownership.</small></span></label>
                <label><input type="checkbox" name="watchlist" checked><span><strong>Live society watchlist</strong><small>Current signals, responsible owners, and access rules.</small></span></label>
                <label><input type="checkbox" name="auditContext"><span><strong>Audit context</strong><small>Selected society/module filters and available audit-event count.</small></span></label>
            </div></section>
            <section><div class="monitoring-export-section-title"><i class="fa-solid fa-sliders"></i><div><h3>Output options</h3><p>Control the file structure and supporting information.</p></div></div><div class="monitoring-export-grid">
                <label><span>File format</span><select name="format"><option value="csv">CSV spreadsheet</option><option value="json">JSON data file</option></select></label>
                <label><span>File name</span><input name="fileName" value="apartment-monitoring-report" maxlength="80" pattern="[A-Za-z0-9_-]+" required><small>Letters, numbers, hyphens, and underscores only.</small></label>
                <label class="wide"><span>Report notes</span><textarea name="notes" rows="3" maxlength="500" placeholder="Add review notes, exceptions, or follow-up instructions"></textarea></label>
            </div><div class="monitoring-export-inline-options"><label><input type="checkbox" name="generatedAt" checked> Include generation timestamp</label><label><input type="checkbox" name="emptyRows" checked> Include clear “no records” messages</label></div></section>
            <div class="monitoring-export-validation" role="status" aria-live="polite"></div>
            <div class="monitoring-export-actions"><button type="button" class="monitoring-export-cancel" data-monitoring-export-close>Cancel</button><button type="submit" class="monitoring-export-submit"><i class="fa-solid fa-download"></i> Generate and download report</button></div>
        </form></div>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("form");
    const close = () => { modal.classList.add("hidden"); document.body.classList.remove("monitoring-export-open"); trigger.focus(); };
    const open = () => {
        const society = form.elements.society;
        const selected = society.value;
        society.replaceChildren(new Option("All societies", "ALL"));
        (window.platformTenants || []).forEach(tenant => { const name = String(tenant.societyName || "").trim(); if (name) society.add(new Option(name, name)); });
        if ([...society.options].some(option => option.value === selected)) society.value = selected;
        modal.classList.remove("hidden"); document.body.classList.add("monitoring-export-open"); form.elements.title.focus();
    };
    const iso = date => date.toISOString().slice(0, 10);
    const applyPreset = () => {
        const today = new Date(); const start = new Date(today); const preset = form.elements.preset.value;
        if (preset === "today") start.setDate(today.getDate()); else if (preset !== "custom") start.setDate(today.getDate() - (Number(preset) - 1));
        if (preset !== "custom") { form.elements.fromDate.value = iso(start); form.elements.toDate.value = iso(today); }
    };
    const tableRows = selector => [...document.querySelectorAll(`${selector} tr`)].map(row => [...row.cells].map(cell => cell.textContent.trim())).filter(row => row.some(Boolean) && !row.join(" ").toLowerCase().includes("no records"));
    const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const buildReport = values => {
        const stats = [...document.querySelectorAll('[data-view="monitoring"] .stats article')].map(card => ({ metric: card.querySelector("span")?.textContent.trim() || "Metric", value: card.querySelector("strong")?.textContent.trim() || "0" }));
        const commandRows = tableRows("#commandWatchGrid"); const watchRows = tableRows("#liveSocietyWatchlistTable");
        return { metadata: { title: values.title, preparedBy: values.preparedBy, purpose: values.purpose, society: values.society === "ALL" ? "All societies" : values.society, fromDate: values.fromDate, toDate: values.toDate, notes: values.notes, generatedAt: values.generatedAt ? new Date().toISOString() : undefined }, sections: { executiveSummary: values.summary ? stats : undefined, commandWatch: values.commandWatch ? commandRows.map(row => ({ module: row[0] || "", metricsAndTrends: row[1] || "", action: row[2] || "" })) : undefined, liveSocietyWatchlist: values.watchlist ? watchRows.map(row => ({ society: row[0] || "", module: row[1] || "", currentSignal: row[2] || "", owner: row[3] || "", accessRule: row[4] || "" })) : undefined, auditContext: values.auditContext ? { societyFilter: document.getElementById("auditSocietyFilter")?.selectedOptions[0]?.textContent || "All Societies", moduleFilter: document.getElementById("auditModuleFilter")?.selectedOptions[0]?.textContent || "All Modules", availableEvents: latestPlatformAuditStream.length } : undefined } };
    };
    const toCsv = (report, includeEmpty) => {
        const rows = [[report.metadata.title], ["Prepared by", report.metadata.preparedBy], ["Purpose", report.metadata.purpose], ["Society scope", report.metadata.society], ["Period", `${report.metadata.fromDate} to ${report.metadata.toDate}`]];
        if (report.metadata.generatedAt) rows.push(["Generated", report.metadata.generatedAt]); if (report.metadata.notes) rows.push(["Notes", report.metadata.notes]);
        if (report.sections.executiveSummary) { rows.push([], ["EXECUTIVE SUMMARY"], ["Metric", "Value"]); report.sections.executiveSummary.forEach(item => rows.push([item.metric, item.value])); }
        if (report.sections.commandWatch) { rows.push([], ["COMMAND WATCH METRICS"], ["Module", "Live metrics and trends", "Action"]); report.sections.commandWatch.forEach(item => rows.push([item.module, item.metricsAndTrends, item.action])); if (!report.sections.commandWatch.length && includeEmpty) rows.push(["No command-watch records available"]); }
        if (report.sections.liveSocietyWatchlist) { rows.push([], ["LIVE SOCIETY WATCHLIST"], ["Society", "Module", "Current signal", "Owner", "Access rule"]); report.sections.liveSocietyWatchlist.forEach(item => rows.push([item.society, item.module, item.currentSignal, item.owner, item.accessRule])); if (!report.sections.liveSocietyWatchlist.length && includeEmpty) rows.push(["No watchlist records available"]); }
        if (report.sections.auditContext) rows.push([], ["AUDIT CONTEXT"], ["Society filter", report.sections.auditContext.societyFilter], ["Module filter", report.sections.auditContext.moduleFilter], ["Available events", report.sections.auditContext.availableEvents]);
        return rows.map(row => row.map(quote).join(",")).join("\n");
    };
    trigger.addEventListener("click", open); modal.querySelectorAll("[data-monitoring-export-close]").forEach(button => button.addEventListener("click", close)); modal.addEventListener("click", event => { if (event.target === modal) close(); }); form.elements.preset.addEventListener("change", applyPreset); applyPreset();
    form.addEventListener("submit", event => {
        event.preventDefault(); const selectedSections = ["summary", "commandWatch", "watchlist", "auditContext"].some(name => form.elements[name].checked); const status = modal.querySelector(".monitoring-export-validation");
        if (!selectedSections) { status.textContent = "Select at least one report section."; return; }
        if (form.elements.fromDate.value > form.elements.toDate.value) { status.textContent = "The From date must be before or equal to the To date."; return; }
        status.textContent = ""; const values = Object.fromEntries(new FormData(form)); ["summary", "commandWatch", "watchlist", "auditContext", "generatedAt", "emptyRows"].forEach(name => values[name] = form.elements[name].checked); const report = buildReport(values); const format = values.format; const content = format === "json" ? JSON.stringify(report, null, 2) : toCsv(report, values.emptyRows); downloadText(`${values.fileName}.${format}`, content); close(); showToast(`✓ Detailed monitoring report exported as ${format.toUpperCase()}.`);
    });
}

setupDetailedMonitoringExport();

function subscriptionTierDepth(plan) {
    const name = String(plan?.name || plan?.planCode || "").toLowerCase();
    if (name.includes("diamond") || name.includes("premium")) return { key: "diamond", featureLimit: 10, detailLimit: 8, label: "Complete" };
    if (name.includes("platinum") || name.includes("standard")) return { key: "platinum", featureLimit: 7, detailLimit: 6, label: "Advanced" };
    return { key: "gold", featureLimit: 4, detailLimit: 4, label: "Essential" };
}

function renderSubscriptionCatalogue(plans, tenants) {
    const cards = document.getElementById("subscriptionPlanCards");
    const assignmentBody = document.getElementById("societyPlanAssignmentTable");
    if (!assignmentBody) return;
    const cataloguePlans = plans.filter(plan => ["gold", "platinum", "diamond"].some(tier => String(plan.name || plan.planCode || "").toLowerCase().includes(tier)));
    const money = value => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
    const featureLabels = plan => [
        plan.complaintManagement && "Complaints", plan.announcementManagement && "Announcements",
        plan.billingManagement && "Maintenance billing", plan.visitorManagement && "Visitor management",
        plan.amenityBooking && "Amenity booking", plan.expenseManagement && "Expense approvals",
        plan.analytics && "Advanced analytics", plan.paymentGateway && "Online payments",
        plan.apiAccess && "API access", plan.prioritySupport && "Priority support"
    ].filter(Boolean);
    if (cards) cards.replaceChildren(...cataloguePlans.map((plan, index) => {
        const card = document.createElement("article");
        const depth = subscriptionTierDepth(plan);
        const details = [
            ["Flats", Number(plan.maxApartments || 0).toLocaleString("en-IN")],
            ["Residents", Number(plan.maxResidents || 0).toLocaleString("en-IN")],
            ["Audit history", `${plan.auditHistoryDays || 0} days`],
            ["Administrators", Number(plan.maxAdmins || 0).toLocaleString("en-IN")],
            ["Security staff", Number(plan.maxSecurityStaff || 0).toLocaleString("en-IN")],
            ["Maintenance staff", Number(plan.maxMaintenanceStaff || 0).toLocaleString("en-IN")],
            ["Storage", `${plan.storageGb || 0} GB`],
            ["Support", String(plan.supportLevel || "Standard").replaceAll("_", " ")]
        ].slice(0, depth.detailLimit);
        card.className = `subscription-catalogue-card plan-${depth.key}${plan.featured ? " featured" : ""}`;
        card.innerHTML = `<div class="subscription-catalogue-card__top"><span>${plan.featured ? "MOST POPULAR" : depth.label.toUpperCase()}</span><em class="${plan.active === false ? "is-inactive" : ""}">${plan.active === false ? "Inactive" : "Active"}</em></div><h4>${plan.name}</h4><p>${plan.description || "SmartSociety subscription plan"}</p><div class="subscription-price"><strong>${money(plan.monthlyPrice)}</strong><span>/ ${String(plan.billingCycle || "MONTHLY").toLowerCase()}</span></div><dl>${details.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl><ul>${featureLabels(plan).slice(0, depth.featureLimit).map(feature => `<li><i class="fa-solid fa-check"></i>${feature}</li>`).join("") || "<li>No additional modules enabled</li>"}</ul><button type="button" data-catalogue-plan-edit="${plan.id}"><i class="fa-solid fa-pen-to-square"></i>Edit ${plan.name} plan</button>`;
        return card;
    }));
    const planCount = document.getElementById("subscriptionPlanCount");
    if (planCount) planCount.textContent = cataloguePlans.length;
    const planById = new Map(plans.map(plan => [String(plan.id), plan]));
    let assigned = 0;
    assignmentBody.replaceChildren(...tenants.map(tenant => {
        const current = planById.get(String(tenant.subscriptionPlanId)); if (current) assigned++;
        const row = document.createElement("tr"); row.dataset.tenantId = tenant.id;
        const options = cataloguePlans.map(plan => `<option value="${plan.id}" ${String(plan.id) === String(tenant.subscriptionPlanId) ? "selected" : ""}>${plan.name}</option>`).join("");
        row.innerHTML = `<td><strong>${tenant.societyName || "Unnamed society"}</strong><small>${tenant.contactEmail || "No contact email"}</small></td><td>${[tenant.city, tenant.state].filter(Boolean).join(", ") || "Not provided"}</td><td><span class="subscription-current-plan ${current ? `plan-${current.name.toLowerCase()}` : "unassigned"}">${current?.name || "Unassigned"}</span></td><td>${tenant.subscriptionStartedOn || "—"}</td><td>${tenant.subscriptionRenewsOn || "—"}</td><td><span class="subscription-assignment-status ${tenant.subscriptionStatus === "ACTIVE" ? "active" : ""}">${tenant.subscriptionStatus || "Not assigned"}</span></td><td><div class="subscription-assignment-control"><select aria-label="Select plan for ${tenant.societyName}"><option value="">Select plan</option>${options}</select><button type="button" data-assign-society-plan>Save</button></div></td>`;
        return row;
    }));
    if (!tenants.length) { const row=document.createElement("tr");row.innerHTML='<td colspan="7" class="text-center text-muted py-5">No registered societies are available for subscription assignment.</td>';assignmentBody.appendChild(row); }
    document.getElementById("assignedSocietyCount").textContent = assigned;
}

function renderOverviewPlanCards(plans) {
    const root = document.getElementById("overviewPlanCards");
    if (!root) return;
    const cataloguePlans = plans.filter(plan => ["gold", "platinum", "diamond"].some(tier => String(plan.name || plan.planCode || "").toLowerCase().includes(tier)));
    const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
    const money = value => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
    const featureLabels = plan => [
        plan.visitorManagement && "Visitor management", plan.amenityBooking && "Amenity booking",
        plan.billingManagement && "Maintenance billing", plan.complaintManagement && "Complaint management",
        plan.announcementManagement && "Announcements", plan.expenseManagement && "Expense approvals",
        plan.analytics && "Advanced analytics", plan.paymentGateway && "Payment gateway",
        plan.apiAccess && "API access", plan.prioritySupport && "Priority support"
    ].filter(Boolean);
    if (!cataloguePlans.length) {
        root.innerHTML = '<div class="col-12 text-center text-muted py-4">No subscription plans are available.</div>';
        return;
    }
    root.innerHTML = cataloguePlans.map((plan, index) => {
        const features = featureLabels(plan);
        const depth = subscriptionTierDepth(plan);
        const kicker = plan.featured ? '<i class="fa-solid fa-star me-1"></i> Most used' : depth.label;
        const details = [
            `${Number(plan.maxApartments || 0).toLocaleString("en-IN")} flats and ${Number(plan.maxResidents || 0).toLocaleString("en-IN")} residents`,
            `${Number(plan.maxAdmins || 0)} admin(s) and ${Number(plan.maxSecurityStaff || 0)} security staff`,
            `${Number(plan.auditHistoryDays || 0)} day audit history`,
            `${Number(plan.maxMaintenanceStaff || 0)} maintenance staff`,
            `${Number(plan.storageGb || 0)} GB document storage`,
            `${safe(plan.supportLevel || "STANDARD")} support`,
            safe(features.slice(0, depth.featureLimit).join(" · ") || "Core workspace access")
        ].slice(0, depth.detailLimit);
        return `<div class="col-md-4"><article class="card h-100 p-4 subscription-plan-card plan-${depth.key} rounded-4 ${plan.featured ? "featured-plan border-0 shadow bg-white" : "border border-primary border-opacity-25 bg-primary bg-opacity-10"}" data-plan-id="${plan.id}"><span class="badge ${plan.featured ? "bg-warning text-dark" : "bg-primary text-white"} mb-3 plan-kicker">${kicker}</span><div class="d-flex justify-content-between align-items-center mb-3 plan-title-row"><h3 class="fw-bold mb-0">${safe(plan.name)}</h3><span class="badge ${plan.active === false ? "bg-secondary" : "bg-success"} status">${plan.active === false ? "Inactive" : "Live"}</span></div><p class="text-muted small">${safe(plan.description || "SmartSociety subscription plan")} <strong>${money(plan.monthlyPrice)} / ${safe(String(plan.billingCycle || "MONTHLY").toLowerCase())}</strong>.</p><ul class="text-muted small mb-4 flex-grow-1">${details.map(detail=>`<li>${detail}</li>`).join("")}</ul><button class="btn ${plan.featured ? "btn-primary" : "btn-outline-primary"} w-100 rounded-pill" type="button" data-catalogue-plan-edit="${plan.id}">Edit Plan</button></article></div>`;
    }).join("");
}

document.addEventListener("click", async event => {
    const edit = event.target.closest("[data-catalogue-plan-edit]");
    if (edit) {
        event.preventDefault(); event.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent("catalogue-plan-edit", { detail: { planId: edit.dataset.cataloguePlanEdit } }));
        return;
    }
    const save = event.target.closest("[data-assign-society-plan]");
    if (!save) return;
    event.preventDefault();
    const row = save.closest("tr"); const planId = row?.querySelector("select")?.value;
    if (!row?.dataset.tenantId || !planId) { showToast("Select a subscription plan first."); return; }
    save.disabled = true; save.textContent = "Saving…";
    try {
        const response = await fetch(`/api/platform/tenants/${row.dataset.tenantId}/plan?planId=${encodeURIComponent(planId)}`, { method: "PUT", headers: { Accept: "application/json" } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "Unable to assign this plan");
        showToast(`✓ Subscription updated for ${body.societyName || "society"}.`);
        await loadPlatformBackendData();
    } catch (error) { showToast(error.message || "Unable to assign this plan"); }
    finally { save.disabled = false; save.textContent = "Save"; }
});

function removeStaticDashboardOperationalData() {
    document.querySelectorAll("[data-view] table tbody").forEach(tbody => {
        const columns = tbody.closest("table")?.querySelectorAll("thead th").length || 1;
        tbody.innerHTML = `<tr class="dashboard-empty-row"><td colspan="${columns}" class="text-muted text-center py-4">No records available.</td></tr>`;
    });

    const metricSelectors = [
        "[data-view] .stats strong",
        "[data-view] .billing-summary-item strong",
        "[data-view] .visitor-stat strong",
        "[data-view] .row.g-3.mb-4 .card-body strong.fs-5",
        "[data-view] .row.g-3.mb-4 .card-body strong.fs-2"
    ];
    document.querySelectorAll(metricSelectors.join(",")).forEach(metric => {
        const current = metric.textContent.trim();
        metric.textContent = /rs\.|₹/i.test(current) ? "Rs. 0" : /%/.test(current) ? "0%" : "0";
    });

    document.querySelectorAll("[data-view] [data-profile-field][value], [data-view] input[id^='prof'][value], [data-view] input[id^='tech'][value]").forEach(field => {
        field.value = "";
        field.removeAttribute("value");
    });
}

removeStaticDashboardOperationalData();

function auditStatusClass(status) {
    return ["SUCCESS", "APPROVED", "PAID_VERIFIED", "BROADCASTED", "AUTHENTICATED"].includes(status)
        ? "bg-success" : status === "ESCALATED" ? "bg-danger" : "bg-warning text-dark";
}

function renderPlatformAuditStream() {
    const body = document.getElementById("minuteAuditStreamBody");
    if (!body) return;
    const society = document.getElementById("auditSocietyFilter")?.value || "ALL";
    const module = document.getElementById("auditModuleFilter")?.value || "ALL";
    const visibleItems = latestPlatformAuditStream.filter(item =>
        (society === "ALL" || item.society === society) &&
        (module === "ALL" || item.module === module)
    );
    body.replaceChildren(...visibleItems.map(item => {
        const row = document.createElement("tr");
        [item.time, item.society, item.module, item.actor, item.detail, item.ip].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value || "";
            row.appendChild(cell);
        });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `badge ${auditStatusClass(item.status)}`;
        badge.textContent = item.status || "UNKNOWN";
        statusCell.appendChild(badge);
        row.appendChild(statusCell);
        return row;
    }));
    if (!visibleItems.length) {
        const empty = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.className = "text-center text-muted py-4";
        cell.textContent = "No audit events match the selected filters.";
        empty.appendChild(cell);
        body.appendChild(empty);
    }
}

function wirePlatformAuditControls() {
    const societyFilter = document.getElementById("auditSocietyFilter");
    const moduleFilter = document.getElementById("auditModuleFilter");
    const exportButton = document.getElementById("auditLogExportButton");
    [societyFilter, moduleFilter].filter(Boolean).forEach(filter => {
        if (filter.dataset.auditBound) return;
        filter.dataset.auditBound = "true";
        filter.addEventListener("change", renderPlatformAuditStream);
    });
    if (exportButton && !exportButton.dataset.auditBound) {
        exportButton.dataset.auditBound = "true";
        exportButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const society = societyFilter?.selectedOptions[0]?.textContent.trim() || "All Societies";
            const module = moduleFilter?.selectedOptions[0]?.textContent.trim() || "All Modules";
            const rows = latestPlatformAuditStream.filter(item =>
                (societyFilter?.value === "ALL" || item.society === societyFilter?.value) &&
                (moduleFilter?.value === "ALL" || item.module === moduleFilter?.value)
            );
            const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
            const csv = [
                `SmartSociety Audit Log Stream - ${society} - ${module}`,
                `Generated,${quote(new Date().toLocaleString())}`,
                "",
                "Time,Society,Module,Actor,Detail,IP,Status",
                ...rows.map(item => [item.time, item.society, item.module, item.actor, item.detail, item.ip, item.status].map(quote).join(","))
            ].join("\n");
            downloadText(`smartsociety-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast(`✓ Exported ${rows.length} audit log ${rows.length === 1 ? "entry" : "entries"}.`);
        });
    }
}

function dashboardContentRoot() {
    return document.querySelector(".main");
}

// Persistent backend hydration. The existing dashboard interactions remain as
// progressive UI enhancements; authoritative records always come from the API.
async function loadSocietyBackendData() {
    if (dashboardRole === "superadmin") return loadPlatformBackendData();
    const request = async (path) => {
        const response = await fetch(`/api/society/${path}`, { headers: { Accept: "application/json" } });
        if (response.status === 401) {
            window.location.href = "/?loginRequired=true";
            throw new Error("Authentication required");
        }
        if (response.status === 403) throw new Error(`The ${path} dataset is not available to this role`);
        if (!response.ok) throw new Error(`Unable to load ${path}`);
        return response.json();
    };
    const cell = (row, value) => { const td = document.createElement("td"); td.textContent = value ?? ""; row.appendChild(td); };
    const statusCell = (row, value) => { const td = document.createElement("td"); const span = document.createElement("span"); span.className = `status ${statusClass(value)}`; span.textContent = value; td.appendChild(span); row.appendChild(td); };
    const fill = (selector, items, render) => {
        document.querySelectorAll(selector).forEach(table => {
            const body = table.tBodies[0]; if (!body) return; body.replaceChildren();
            items.forEach(item => body.appendChild(render(item, cell, statusCell, table)));
        });
    };

    try {
        const optional = path => request(path).catch(() => []);
        const canReadResidents = ["admin", "accountant", "security", "maintenance"].includes(dashboardRole);
        const canReadFinance = ["admin", "accountant"].includes(dashboardRole);
        const [overview, apartments, residents, complaints, visitors, bills, amenityItems, bookingItems, noticeItems, me, expenseItems, paymentItems, teamItems, subscription] = await Promise.all([
            request("overview"), optional("apartments"), canReadResidents ? optional("residents") : Promise.resolve([]),
            optional("complaints"), optional("visitors"), optional("bills"), optional("amenities"), optional("bookings"), optional("announcements"), request("me"), canReadFinance ? optional("finance/expenses") : Promise.resolve([]), canReadFinance ? optional("finance/payments") : Promise.resolve([]), dashboardRole === "admin" ? optional("team-users") : Promise.resolve([]), dashboardRole === "admin" ? request("subscription").catch(() => null) : Promise.resolve(null)
        ]);
        const overviewByLabel = {"total flats":overview.totalApartments,"residents":overview.totalResidents,
            "unpaid bills":overview.unpaidBills,"open complaints":overview.pendingComplaints,
            "open requests":overview.pendingComplaints,"inside visitors":overview.visitorCount};
        document.querySelectorAll('[data-view="overview"] .stats article').forEach((card) => {
            const label=card.querySelector("span")?.textContent.trim().toLowerCase(); const node=card.querySelector("strong");
            if (node && overviewByLabel[label] !== undefined) node.textContent = overviewByLabel[label];
        });
        fill('table[data-table="flats"]', apartments, (a,c,s) => { const r=document.createElement("tr");r.dataset.recordId=a.id;Object.entries(a).forEach(([k,v])=>r.dataset[k]=v??"");c(r,[a.unitNo,a.apartmentCode].filter(Boolean).join(" · "));c(r,a.ownerName);c(r,[a.ownerPhone,a.ownerEmail].filter(Boolean).join(" · ")||"—");c(r,`${a.block||"Block A"} · Floor ${a.floor??0}`);c(r,a.type);c(r,a.builtUpAreaSqFt?`${a.builtUpAreaSqFt} sq.ft`:"—");c(r,a.parkingSlot||"—");s(r,a.occupancy);const td=document.createElement("td");const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-outline-primary";button.dataset.action="save";button.textContent="Edit";td.appendChild(button);r.appendChild(td);return r; });
        fill('table[data-table="residents"]', [...residents,...teamItems], (x,c,s) => { const r=document.createElement("tr");const team=Boolean(x.role);c(r,x.name);c(r,[x.phone,x.email].filter(Boolean).join(" · ")||"—");c(r,team?(x.employeeId||"—"):(x.unitNo||"—"));c(r,team?x.role.replaceAll("_"," "):x.residentType);c(r,team?([x.designation,x.workShift].filter(Boolean).join(" · ")||"Society team"):(x.vehicleNumber?`Vehicle: ${x.vehicleNumber}`:"Resident access"));s(r,x.accountLocked?"LOCKED":"ACTIVE");const td=document.createElement("td");const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-outline-primary";button.dataset.action="notify";button.textContent="Notify";td.appendChild(button);r.appendChild(td);return r; });
        if (typeof window.renderSmartApartmentResidents === "function") window.renderSmartApartmentResidents();
        fill('table[data-table="billing"]', bills, (b,c,s) => {
            const r=document.createElement("tr");
            r.dataset.recordId=b.id;
            const money=value=>`Rs. ${Number(value || 0).toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
            if(dashboardRole==="resident"){
                c(r,b.month); c(r,"Maintenance"); c(r,money(b.totalAmount)); s(r,b.paymentStatus);
            } else if(dashboardRole==="accountant") {
                const waterAndPower=Number(b.waterAmount || 0)+Number(b.commonPowerFee || 0);
                const gst=Number(b.cgstAmount || 0)+Number(b.sgstAmount || 0);
                c(r,b.invoiceNumber || `INV-${String(b.id).padStart(6,"0")}`);
                c(r,b.unitNo || "—");
                c(r,"—");
                c(r,b.month || "—");
                c(r,money(b.baseAmount));
                c(r,money(waterAndPower));
                c(r,money(gst));
                c(r,money(b.totalAmount));
                s(r,b.paymentStatus || "UNPAID");
            } else {
                c(r,b.unitNo); c(r,b.month); c(r,money(b.totalAmount)); s(r,b.paymentStatus);
            }
            const td=document.createElement("td");
            if(b.paymentStatus==="PAID") td.textContent="Paid";
            else { const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-success";button.dataset.action="pay";button.textContent="Mark Paid";td.appendChild(button); }
            r.appendChild(td); return r;
        });
        fill('table[data-table="complaints"],table[data-table="maintenance-complaints"]', complaints, (x,c,s,table) => {
            const r=document.createElement("tr");
            r.dataset.recordId=x.id;
            const closed=["RESOLVED","CLOSED"].includes(x.status);
            if(dashboardRole==="maintenance"){
                c(r,`T-${String(x.id).padStart(4,"0")}`);
                const summary=document.createElement("td");
                const title=document.createElement("strong");title.textContent=x.title;summary.appendChild(title);
                const detail=document.createElement("small");detail.className="d-block text-muted mt-1";detail.textContent=[x.priority, x.description, x.preferredContactMethod && `Contact: ${x.preferredContactMethod}`, x.reporterPhone].filter(Boolean).join(" · ");summary.appendChild(detail);r.appendChild(summary);
                c(r,[x.unitNo,x.locationDetails].filter(Boolean).join(" · ")||"—");
                c(r,[x.category,x.subcategory].filter(Boolean).join(" / ")||"—");
                const logged=x.incidentAt||x.createdAt;c(r,logged?new Date(logged).toLocaleString("en-IN"):"—");
            }else{
                c(r,x.title);
                if(dashboardRole==="resident"){c(r,x.category);s(r,x.status);}
                else{c(r,x.unitNo);c(r,x.assignedTo||"Unassigned");s(r,x.status);}
            }
            const td=document.createElement("td");
            if(dashboardRole==="resident")td.textContent="Admin controlled";
            else if(closed){const badge=document.createElement("span");badge.className="badge bg-success-subtle text-success-emphasis";badge.textContent=x.status;td.appendChild(badge);}
            else if(dashboardRole==="maintenance"){
                const assignment=document.createElement("small");assignment.className="d-block mb-2 text-muted";assignment.textContent=x.assignedTo?`Assigned to ${x.assignedTo}`:"Unassigned ticket";td.appendChild(assignment);
                const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-primary";b.dataset.backendAction=x.status==="IN_PROGRESS"?"complaint-resolve":"complaint-start";b.textContent=x.status==="IN_PROGRESS"?"Mark Fixed":"Claim & Start";td.appendChild(b);
            }else{
                if(dashboardRole==="admin"){const assign=document.createElement("button");assign.type="button";assign.className="btn btn-sm btn-primary me-2";assign.dataset.backendAction="complaint-assign";assign.textContent=x.assignedTo?"Reassign":"Assign";td.appendChild(assign);}
                const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-outline-danger";b.dataset.backendAction="complaint-close";b.textContent="Close Ticket";td.appendChild(b);
            }
            r.appendChild(td);return r;
        });
        fill('table[data-table="visitors"],table[data-table="entries"]', visitors, (v,c,s,table) => { const r=document.createElement("tr");r.dataset.recordId=v.id;c(r,v.name);if(dashboardRole==="admin"){c(r,v.unitNo);c(r,v.purpose);c(r,v.expectedAt);}else{c(r,v.phone);c(r,v.unitNo);if(table.dataset.table==="entries"){c(r,v.purpose);c(r,v.resident);}else{c(r,v.checkInAt||v.expectedAt);}}s(r,v.status);const td=document.createElement("td");if(v.status==="CHECKED_OUT")td.textContent="Checked out";else{const b=document.createElement("button");b.dataset.backendAction=v.status==="CHECKED_IN"?"visitor-checkout":"visitor-checkin";b.textContent=v.status==="CHECKED_IN"?"Check Out":"Check In";td.appendChild(b);}r.appendChild(td);return r; });
        const visitorCounters = document.querySelectorAll('[data-view="visitors"] .compact-stats strong');
        const visitorStatus = value => String(value || "").toUpperCase();
        if (visitorCounters[0]) visitorCounters[0].textContent = visitors.filter(visitor => ["WAITING", "EXPECTED", "PENDING"].includes(visitorStatus(visitor.status))).length;
        if (visitorCounters[1]) visitorCounters[1].textContent = visitors.filter(visitor => ["INSIDE", "CHECKED_IN"].includes(visitorStatus(visitor.status))).length;
        if (visitorCounters[2]) visitorCounters[2].textContent = visitors.filter(visitor => visitorStatus(visitor.status) === "CHECKED_OUT").length;
        fill('table[data-table="expenses"]',expenseItems,(x,c,s)=>{const r=document.createElement("tr");r.dataset.recordId=x.id;c(r,`${x.title || x.category}${x.invoiceNumber ? ` · Invoice: ${x.invoiceNumber}` : ""}${x.description ? ` · ${x.description}` : ""}`);c(r,`${x.vendor || "—"}${x.vendorPhone ? ` · ${x.vendorPhone}` : ""}`);c(r,`Rs. ${Number(x.amount || 0).toLocaleString("en-IN")}${Number(x.taxAmount || 0) ? ` + tax Rs. ${Number(x.taxAmount).toLocaleString("en-IN")}` : ""}`);c(r,`Expense: ${x.date || "—"}${x.dueDate ? ` · Due: ${x.dueDate}` : ""}${x.paidDate ? ` · Paid: ${x.paidDate}` : ""}`);s(r,x.approvalStatus);const td=document.createElement("td");if(x.approvalStatus==="PENDING"){[["expense-edit","Edit","btn-outline-primary"],["expense-approve","Approve","btn-primary"],["expense-reject","Reject","btn-outline-danger"],["expense-delete","Remove","btn-outline-secondary"]].forEach(([action,label,style])=>{const b=document.createElement("button");b.type="button";b.className=`btn btn-sm ${style} me-2 mb-1`;b.dataset.backendAction=action;b.textContent=label;if(action==="expense-edit")b.dataset.expense=JSON.stringify(x);td.appendChild(b);});}else if(x.approvalStatus==="APPROVED"){const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-success";b.dataset.backendAction="expense-pay";b.textContent="Record payment";td.appendChild(b);}else td.textContent=x.approvalStatus==="PAID" ? `${x.paymentMode || "Paid"}${x.paymentReference ? ` · ${x.paymentReference}` : ""}` : (x.approvalNote || "Closed");r.appendChild(td);return r;});
        window.societyPaymentRecords = paymentItems;
        window.societyBillRecords = bills;
        renderPaymentRegister();
        window.societyAmenities = amenityItems;
        window.societyResidents = residents;
        window.societyApartments = apartments;
        renderAmenityBookingDesk(amenityItems, bookingItems, residents);
        renderAnnouncements(noticeItems);
        if (subscription) renderSocietySubscription(subscription);
        const setOverviewQuick = (id, count, label) => { const node = document.getElementById(id); if (node) node.textContent = `${count} ${label}`; };
        setOverviewQuick("overviewVisitorRecords", visitors.length, `visitor record${visitors.length === 1 ? "" : "s"}`);
        setOverviewQuick("overviewAmenityBookings", bookingItems.length, `amenity booking${bookingItems.length === 1 ? "" : "s"}`);
        setOverviewQuick("overviewExpenseRecords", expenseItems.length, `expense record${expenseItems.length === 1 ? "" : "s"}`);
        const openComplaints = complaints.filter(complaint => !["RESOLVED", "CLOSED"].includes(String(complaint.status || "").toUpperCase())).length;
        setOverviewQuick("overviewOpenComplaints", openComplaints, `open complaint${openComplaints === 1 ? "" : "s"}`);
        window.societyCurrentUser = me;
        const nameField=document.querySelector('[data-profile-field="name"]');const emailField=document.querySelector('[data-profile-field="email"]');if(nameField)nameField.value=me.name;if(emailField)emailField.value=me.email;
        const residentWelcomeName = document.getElementById("residentWelcomeName");
        if (residentWelcomeName && me?.name) residentWelcomeName.textContent = me.name;
        document.documentElement.dataset.backendConnected = "true";
    } catch (error) {
        console.error("Dashboard backend hydration failed", error);
    }
}

function renderSocietySubscription(subscription) {
    const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    const localDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"}) : "Not scheduled";
    const money = value => `Rs. ${Number(value || 0).toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
    const active = String(subscription.status || "INACTIVE").toUpperCase() === "ACTIVE";
    const planName = subscription.planName || "No plan assigned";
    const cycle = String(subscription.billingCycle || "Not configured").replaceAll("_", " ").toLowerCase();

    setText("saasHeroPlan", planName);
    setText("saasHeroDescription", active
        ? `${subscription.societyName || "This society"} is covered by the ${planName} plan. Capacity, renewal and invoice details are shown below.`
        : "A platform subscription must be assigned before paid society services can be used.");
    const heroStatus = document.getElementById("saasHeroStatus");
    if (heroStatus) {
        heroStatus.textContent = active ? "Subscription active" : "Subscription inactive";
        heroStatus.className = `badge border mb-2 ${active ? "bg-success-subtle text-success-emphasis border-success-subtle" : "bg-warning-subtle text-warning-emphasis border-warning-subtle"}`;
    }
    setText("saasCurrentPlan", planName);
    setText("saasPlanCycle", cycle === "not configured" ? "Billing cycle not configured" : `${cycle[0].toUpperCase()}${cycle.slice(1)} billing`);
    setText("saasPlanStatus", active ? "Active" : String(subscription.status || "Inactive").replaceAll("_", " "));
    setText("saasPlanStarted", subscription.startedOn ? `Activated ${localDate(subscription.startedOn)}` : "Activation date not recorded");
    setText("saasFlatCapacity", `${Number(subscription.usedFlats || 0).toLocaleString("en-IN")} / ${Number(subscription.maxFlats || 0).toLocaleString("en-IN")} flats`);
    setText("saasFlatRemaining", `${Number(subscription.remainingFlats || 0).toLocaleString("en-IN")} flats remaining`);
    setText("saasNextRenewal", localDate(subscription.renewsOn));
    setText("saasRenewalAmount", subscription.amount > 0 ? `${money(subscription.amount)} + applicable taxes` : "No renewal charge configured");

    const body = document.querySelector("#saasInvoiceTable tbody");
    if (!body) return;
    body.replaceChildren();
    const invoices = Array.isArray(subscription.invoices) ? subscription.invoices : [];
    if (!invoices.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7; cell.className = "text-center text-muted py-5";
        cell.textContent = "No subscription invoices are available for this workspace yet.";
        row.appendChild(cell); body.appendChild(row); return;
    }
    invoices.forEach(invoice => {
        const row = document.createElement("tr");
        const values = [invoice.number, invoice.plan, `${localDate(invoice.cycleStart)} – ${localDate(invoice.cycleEnd)}`, money(invoice.amount)];
        values.forEach(value => { const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell); });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span"); badge.className = "status active"; badge.textContent = invoice.status || "Paid"; statusCell.appendChild(badge); row.appendChild(statusCell);
        const dateCell = document.createElement("td"); dateCell.textContent = localDate(invoice.invoiceDate); row.appendChild(dateCell);
        const actionCell = document.createElement("td");
        const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-sm btn-outline-primary"; button.dataset.subscriptionAction = "invoice"; button.dataset.invoice = invoice.number; button.textContent = "Download"; actionCell.appendChild(button); row.appendChild(actionCell);
        body.appendChild(row);
    });
}

async function loadPlatformBackendData(){
    try{
        const get=async p=>{const r=await fetch(`/api/${p}`,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("Platform data unavailable");return r.json();};
        const [overview,tenants,users, plans, roles, privacyReqs, gateways, monitoring, audit, subscriptions, analytics, sentNotices]=await Promise.all([
            get("platform/overview"),get("platform/tenants"),get("platform/users"),get("platform/plans"),
            get("superadmin/roles/list").catch(()=>[]),
            get("superadmin/data/privacy/requests").catch(()=>[]),
            get("superadmin/finance/payment-gateways").catch(()=>[]),
            get("superadmin/monitoring/data").catch(()=>({stats:{}, watchlist:[]})),
            get("superadmin/audit/data").catch(()=>({stats:{}, stream:[]})),
            get("superadmin/subscriptions/data").catch(()=>({mapping:[], admins:[], rules:[]})),
            get("superadmin/analytics/data").catch(()=>({})),
            get("superadmin/notices").catch(()=>[])
        ]);
        const auditSocietyFilter = document.getElementById("auditSocietyFilter");
        if (auditSocietyFilter) {
            const selectedSociety = auditSocietyFilter.value || "ALL";
            auditSocietyFilter.replaceChildren(new Option("All Societies", "ALL"));
            tenants.forEach(tenant => {
                const name = String(tenant.societyName || "").trim();
                if (name) auditSocietyFilter.add(new Option(name, name));
            });
            auditSocietyFilter.value = [...auditSocietyFilter.options].some(option => option.value === selectedSociety) ? selectedSociety : "ALL";
        }
        const byLabel={"active societies":overview.tenants,"platform users":overview.users,"pending approvals":overview.pendingTenants,
                       "gate entries today": monitoring.stats.gateEntriesToday, "bills pending": monitoring.stats.billsPending, "admin approvals": monitoring.stats.adminApprovals, "open risks": monitoring.stats.openRisks,
                       "audit events logged": audit.stats.auditEventsLogged, "minute actions today": audit.stats.minuteActionsToday, "security overrides": audit.stats.securityOverrides, "system health": audit.stats.systemHealth};

        document.querySelectorAll('.stats article').forEach(card=>{const key=card.querySelector("span")?.textContent.trim().toLowerCase();const value=card.querySelector("strong");if(value&&byLabel[key]!==undefined)value.textContent=byLabel[key];});
        const fill=(selector,items,rowBuilder)=>document.querySelectorAll(selector).forEach(table=>{const body=table;if(table.tagName==="TABLE") { const tb=table.tBodies[0]; if(tb) tb.replaceChildren(...items.map(rowBuilder)); } else { table.replaceChildren(...items.map(rowBuilder)); }});
        const td=(row,value)=>{const cell=document.createElement("td");cell.textContent=value??"";row.appendChild(cell);};
        const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
        const planById = new Map(plans.map(plan => [String(plan.id), plan]));
        window.platformTenants = tenants;
        window.platformUsers = users;
        window.platformBillingRules = subscriptions.rules || [];
        window.platformGateways = gateways || [];
        const noticeSocietySelect = document.getElementById("specificSociety");
        if (noticeSocietySelect) {
            const selectedSociety = noticeSocietySelect.value;
            noticeSocietySelect.replaceChildren(new Option("-- Select a Society --", "", true, false));
            tenants.forEach(tenant => noticeSocietySelect.add(new Option(tenant.societyName, tenant.id)));
            if ([...noticeSocietySelect.options].some(option => option.value === selectedSociety)) noticeSocietySelect.value = selectedSociety;
        }
        fill('table[data-table="societies"]',tenants,t=>{const r=document.createElement("tr");r.dataset.recordId=t.id;td(r,t.societyName);td(r,[t.city,t.state].filter(Boolean).join(", "));td(r,planById.get(String(t.subscriptionPlanId))?.name||"Unassigned");td(r,t.approved?"Approved":"Pending");const c=document.createElement("td");c.innerHTML=`<button class="btn btn-sm btn-outline-primary me-1" data-backend-action="edit-society">Edit</button><button class="btn btn-sm ${t.approved?'btn-outline-danger':'btn-outline-success'}" data-backend-action="${t.approved?'suspend-society':'approve-society'}">${t.approved?'Suspend':'Approve'}</button>`;r.appendChild(c);return r;});
        fill('table[data-table="users"]',users,u=>{const r=document.createElement("tr");r.dataset.userId=u.id;td(r,u.name);td(r,u.role);td(r,u.tenantId);td(r,u.locked?"Locked":"Active");const c=document.createElement("td");c.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-platform-user-edit>Edit User</button>`;r.appendChild(c);return r;});
        window.platformPlans = plans;
        renderOverviewPlanCards(plans);
        renderSubscriptionCatalogue(plans, tenants);
        fill('#subscriptionPlansTable', plans, plan=>{const r=document.createElement("tr");r.dataset.planId=plan.id;td(r,plan.name);td(r,`Rs. ${plan.monthlyPrice}`);td(r,plan.maxApartments);td(r,plan.maxResidents);td(r,[plan.visitorManagement&&"Visitors",plan.amenityBooking&&"Amenities",plan.analytics&&"Analytics"].filter(Boolean).join(" · ") || "Core");const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-plan-action='edit'>Edit Plan</button>";r.appendChild(c);return r;});
        
        window.platformRolePolicies = roles;
        fill('#accessRolesTable', roles, ro=>{const r=document.createElement("tr");r.dataset.rolePolicyId=ro.id;td(r,ro.role);td(r,ro.permissions);const status=document.createElement("td");status.innerHTML=`<span class="badge ${ro.status==='Active'?'bg-success':'bg-secondary'}">${ro.status}</span>`;r.appendChild(status);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-role-policy-edit>Edit</button>";r.appendChild(c);return r;});
        fill('#privacyRequestsTable', privacyReqs, p=>{const r=document.createElement("tr");r.dataset.privacyRequestId=p.id;td(r,`PRQ-${p.id}`);td(r,p.details);td(r,p.requestType);const status=document.createElement("td");status.innerHTML=`<span class="badge ${p.status==='Pending'?'bg-warning text-dark':p.status==='Processed'?'bg-success':'bg-secondary'}">${p.status}</span>`;r.appendChild(status);const c=document.createElement("td");c.innerHTML=p.status==='Pending'?"<button type='button' class='btn btn-sm btn-outline-danger' data-privacy-review>Review</button>":"<span class='small text-muted'>Completed</span>";r.appendChild(c);return r;});
        fill('#paymentGatewaysTable', gateways, g=>{const r=document.createElement("tr");r.dataset.gatewayId=g.id;td(r,g.providerName);td(r,g.environment || "Sandbox");const status=document.createElement("td");status.innerHTML=`<span class="badge ${g.active?'bg-success':'bg-secondary'}">${g.active?'Active':'Disabled'}</span>`;r.appendChild(status);td(r,g.transactionFee || "—");const c=document.createElement("td");c.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-gateway-config>Configure</button>`;r.appendChild(c);return r;});
        
        fill('#liveSocietyWatchlistTable', monitoring.watchlist, m=>{const r=document.createElement("tr");td(r,m.society);td(r,m.module);td(r,m.currentSignal);td(r,m.owner);td(r,m.accessRule);return r;});
        const noticeHistoryCount = document.getElementById("platformNoticeHistoryCount");
        if (noticeHistoryCount) noticeHistoryCount.textContent = `${sentNotices.length} sent`;
        window.platformSentNotices = sentNotices;
        fill('#platformNoticeHistoryTable', sentNotices, notice=>{
            const r=document.createElement("tr");
            r.dataset.noticeId=notice.id;
            const title=document.createElement("td");
            title.innerHTML=`<strong class="d-block">${escapeHtml(notice.title || "Platform notice")}</strong><small class="text-muted">${escapeHtml(notice.category || "GENERAL")}</small>`;
            r.appendChild(title);
            const message=document.createElement("td");
            message.style.minWidth="260px";
            message.textContent=notice.message || "";
            r.appendChild(message);
            td(r,notice.targetLabel || "—");
            const priority=document.createElement("td");
            const priorityLabel=notice.emergency ? "URGENT" : (notice.priority || "NORMAL");
            priority.innerHTML=`<span class="badge ${notice.emergency?'bg-danger':'bg-primary-subtle text-primary-emphasis'}">${escapeHtml(priorityLabel)}</span>`;
            r.appendChild(priority);
            const sender=document.createElement("td");
            sender.innerHTML=`<strong class="d-block">${escapeHtml(notice.senderName || "Super Admin")}</strong><small class="text-muted">${escapeHtml(notice.senderEmail || "")}</small>`;
            r.appendChild(sender);
            const sentAt=document.createElement("td");
            sentAt.textContent=notice.createdAt ? new Date(notice.createdAt).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
            r.appendChild(sentAt);
            const delivery=document.createElement("td");
            delivery.innerHTML=`<strong class="d-block">${Number(notice.notifiedUsers || 0).toLocaleString("en-IN")} users</strong><small class="text-muted">${Number(notice.societyCount || 0).toLocaleString("en-IN")} societ${Number(notice.societyCount || 0)===1?'y':'ies'}</small>`;
            r.appendChild(delivery);
            const actions=document.createElement("td");
            actions.innerHTML=`<div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-outline-primary text-nowrap" data-platform-notice-view="${notice.id}"><i class="fa-regular fa-eye me-1"></i>View details</button><button type="button" class="btn btn-sm btn-primary" data-platform-notice-edit="${notice.id}"><i class="fa-solid fa-pen me-1"></i>Edit</button></div>`;
            r.appendChild(actions);
            return r;
        });
        if (!sentNotices.length) {
            const historyBody=document.getElementById("platformNoticeHistoryTable");
            if (historyBody) historyBody.innerHTML='<tr><td colspan="8" class="text-center text-muted py-4">No platform notices have been sent yet.</td></tr>';
        }
        if(monitoring.commandWatch) {
            fill('#commandWatchGrid', monitoring.commandWatch, c=>{
                const r=document.createElement("tr");
                td(r,c.module);
                td(r,c.metrics);
                const btnTd = document.createElement("td");
                btnTd.innerHTML = `<button class="btn btn-sm btn-outline-primary" data-backend-action="${c.actionType}">${c.actionLabel}</button>`;
                r.appendChild(btnTd);
                return r;
            });
        }
        latestPlatformAuditStream = Array.isArray(audit.stream) ? audit.stream : [];
        wirePlatformAuditControls();
        renderPlatformAuditStream();
        fill('#subscriptionMappingTable', subscriptions.mapping, m=>{const r=document.createElement("tr");td(r,m.society);td(r,m.plan);td(r,m.flats);td(r,m.renewal);td(r,m.adminOwner);const s=document.createElement("td");s.innerHTML=`<span class="badge ${m.status==='Current'?'bg-success':m.status==='Renewal Due'?'bg-warning text-dark':'bg-danger'}">${m.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-plan-action='review'>Review Plan</button>";r.appendChild(c);return r;});
        fill('#subscriptionAdminsTable', subscriptions.admins, a=>{const r=document.createElement("tr");td(r,a.admin);td(r,a.society);td(r,a.role);td(r,a.lastLogin);td(r,a.mfa);const s=document.createElement("td");s.innerHTML=`<span class="badge ${a.status==='Active'?'bg-success':a.status==='MFA Pending'?'bg-warning text-dark':'bg-danger'}">${a.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-access-audit>Audit Access</button>";r.appendChild(c);return r;});
        fill('#billingRulesTable', subscriptions.rules, u=>{const r=document.createElement("tr");r.dataset.ruleId=u.id;td(r,u.rule);td(r,u.plan);td(r,u.amount);td(r,u.cycle);td(r,u.grace);const s=document.createElement("td");s.innerHTML=`<span class="badge ${u.status==='Active'||u.status==='Live'?'bg-success':'bg-secondary'}">${u.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-billing-rule-edit>Edit Rule</button>";r.appendChild(c);return r;});

        const paymentSummary = subscriptions.paymentSummary || {};
        const subscriptionPayments = subscriptions.payments || [];
        const setFinanceText = (id, value) => { const element=document.getElementById(id); if(element) element.textContent=value; };
        const rupees = value => `Rs. ${Number(value || 0).toLocaleString("en-IN", {minimumFractionDigits:0, maximumFractionDigits:2})}`;
        const localDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "Not scheduled";
        setFinanceText("financeSubscribedSocieties", Number(paymentSummary.subscribedSocieties || 0).toLocaleString("en-IN"));
        setFinanceText("financePaidSocieties", Number(paymentSummary.paidSocieties || 0).toLocaleString("en-IN"));
        setFinanceText("financeCollectedCharges", rupees(paymentSummary.collectedCharges));
        setFinanceText("financePendingCharges", rupees(paymentSummary.pendingCharges));
        setFinanceText("financePendingSocieties", `${Number(paymentSummary.pendingSocieties || 0).toLocaleString("en-IN")} ${Number(paymentSummary.pendingSocieties || 0) === 1 ? "society" : "societies"} pending`);
        setFinanceText("financePaymentRowCount", `${subscriptionPayments.length.toLocaleString("en-IN")} ${subscriptionPayments.length === 1 ? "record" : "records"}`);
        const paymentTableBody = document.querySelector("#subscriptionPaymentsTable tbody");
        if (paymentTableBody) {
            if (!subscriptionPayments.length) {
                const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=7;cell.className="empty-payment-register";cell.innerHTML='<i class="fa-solid fa-receipt d-block mb-2 fs-4"></i>No societies currently have an assigned subscription plan.';row.appendChild(cell);paymentTableBody.replaceChildren(row);
            } else {
                paymentTableBody.replaceChildren(...subscriptionPayments.map(payment => {
                    const row=document.createElement("tr");
                    const society=document.createElement("td");society.className="society-cell";const societyName=document.createElement("strong");societyName.textContent=payment.society || "Unnamed society";const location=document.createElement("small");location.textContent=payment.location || "Location not recorded";society.append(societyName,location);row.appendChild(society);
                    td(row,payment.plan || "Unassigned");td(row,String(payment.billingCycle || "MONTHLY").replaceAll("_"," "));
                    const amount=document.createElement("td");amount.className="payment-amount";amount.textContent=rupees(payment.billingAmount);row.appendChild(amount);
                    const status=document.createElement("td");const badge=document.createElement("span");badge.className=`badge ${payment.paymentStatus === "PAID" ? "bg-success" : payment.paymentStatus === "FREE" ? "bg-primary" : "bg-warning text-dark"}`;badge.textContent=payment.paymentStatus || "PENDING";status.appendChild(badge);row.appendChild(status);
                    td(row,localDate(payment.subscriptionStartedOn));td(row,localDate(payment.nextRenewalOn));return row;
                }));
            }
        }

        window.platformAnalytics = analytics;
        const kpis=analytics.kpis||{},operational=analytics.operational||{};
        const metric=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
        metric("analyticsMrr",`Rs. ${Number(kpis.mrr||0).toLocaleString("en-IN")}`);
        metric("analyticsVisitors",Number(kpis.activeUsers||0)+Number(kpis.visitorRecords||0));
        metric("analyticsPayments",`${Number(kpis.paymentSuccessRate||0).toFixed(1)}%`);
        metric("analyticsSla",`${Number(kpis.averageResolutionHours||0).toFixed(1)} hours`);
        metric("analyticsGeneratedAt",analytics.generatedAt?`Updated ${new Date(analytics.generatedAt).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}`:"No analytics generated yet");
        const chart=document.getElementById("analyticsRevenueChart");
        if(chart){const trend=analytics.revenueTrend||[],max=Math.max(0,...trend.flatMap(item=>[Number(item.billed||0),Number(item.collected||0)]));if(max===0)chart.innerHTML='<div class="analytics-empty"><i class="fa-solid fa-chart-column"></i><strong>No revenue activity yet</strong><span>The chart will appear after real bills and collections are recorded.</span></div>';else chart.replaceChildren(...trend.map(item=>{const group=document.createElement("div");group.className="analytics-chart-month";group.innerHTML=`<div><i style="height:${Math.max(3,Number(item.billed||0)/max*100)}%" title="Billed: Rs. ${Number(item.billed||0).toLocaleString("en-IN")}"></i><b style="height:${Math.max(3,Number(item.collected||0)/max*100)}%" title="Collected: Rs. ${Number(item.collected||0).toLocaleString("en-IN")}"></b></div><span>${item.month}</span>`;return group;}));}
        const health=document.getElementById("analyticsOperationalHealth");if(health){const items=[["Registered societies",operational.registeredSocieties||0],["Gate / visitor records",operational.gateEntries||0],["Maintenance requests",operational.maintenanceRequests||0],["Payment follow-ups",operational.openPaymentFollowUps||0]];health.replaceChildren(...items.map(([label,value])=>{const row=document.createElement("div");row.innerHTML=`<span>${label}</span><strong>${Number(value).toLocaleString("en-IN")}</strong>`;return row;}));}
        const societyTable=document.getElementById("analyticsSocietyTable");
        if(societyTable){const rows=(analytics.societies||[]).map(item=>{const row=document.createElement("tr");row.innerHTML=`<td><strong>${item.society}</strong></td><td>${item.plan}</td><td>${item.activeUsers}</td><td>${Number(item.collectionRate||0).toFixed(1)}%</td><td>${item.openRequests}</td><td><span class="analytics-health ${String(item.health).toLowerCase().replaceAll(" ","-")}">${item.health}</span></td>`;return row;});if(!rows.length){const empty=document.createElement("tr");empty.innerHTML='<td colspan="6" class="text-center text-muted py-5">No registered societies are available for comparison.</td>';rows.push(empty);}societyTable.replaceChildren(...rows);}
        const mix=document.getElementById("analyticsSubscriptionMix");
        if(mix){const entries=Object.entries(analytics.subscriptionMix||{}),total=entries.reduce((sum,[,count])=>sum+Number(count),0);if(!entries.length)mix.innerHTML='<div class="analytics-empty compact"><strong>No subscription assignments</strong><span>Assign plans to registered societies to see the distribution.</span></div>';else mix.replaceChildren(...entries.map(([plan,count])=>{const row=document.createElement("div");const percent=total?Math.round(Number(count)/total*100):0;row.className="analytics-mix-row";row.innerHTML=`<div><strong>${plan}</strong><span>${count} societ${Number(count)===1?"y":"ies"} · ${percent}%</span></div><progress max="100" value="${percent}"></progress>`;return row;}));}
        const actions=document.getElementById("analyticsRecommendedActions");if(actions){const items=analytics.recommendations||[];if(!items.length)actions.innerHTML='<div class="analytics-empty compact"><i class="fa-solid fa-circle-check"></i><strong>No immediate actions</strong><span>There are no data-backed recommendations at this time.</span></div>';else actions.replaceChildren(...items.map(item=>{const row=document.createElement("div");row.className=`analytics-action ${item.level||"primary"}`;row.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><div><strong>${item.title}</strong><span>${item.detail}</span></div>`;return row;}));}

    }catch(error){console.error("Platform hydration failed",error);}
}

async function mutateSociety(path, method, body) {
    const response = await fetch(`/api/${path}`, {method, headers:{"Content-Type":"application/json",Accept:"application/json"}, body:body===undefined?undefined:JSON.stringify(body)});
    const result = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.message || "The operation could not be completed");
    return result;
}

function flatPayload(values = [], row = null) {
    const numberOrNull = value => value === "" || value == null ? null : Number(value);
    return {
        unitNo: values[0] || row?.dataset.unitNo || row?.children[0]?.textContent.trim() || "",
        ownerName: values[1] || row?.dataset.ownerName || row?.children[1]?.textContent.trim() || "",
        occupancy: values[2] || row?.dataset.occupancy || row?.querySelector(".status")?.textContent.trim().toUpperCase().replaceAll(" ", "_") || "VACANT",
        block: values[3] || row?.dataset.block || "Block A",
        floor: Number(values[4] || row?.dataset.floor || 0),
        unitType: values[5] || row?.dataset.type || "2BHK",
        ownerPhone: values[6] ?? row?.dataset.ownerPhone ?? "",
        ownerEmail: values[7] ?? row?.dataset.ownerEmail ?? "",
        builtUpAreaSqFt: numberOrNull(values[8] ?? row?.dataset.builtUpAreaSqFt),
        parkingSlot: values[9] ?? row?.dataset.parkingSlot ?? "",
        monthlyMaintenance: numberOrNull(values[10] ?? row?.dataset.monthlyMaintenance),
        possessionDate: values[11] || row?.dataset.possessionDate || null,
        notes: values[12] ?? row?.dataset.notes ?? ""
    };
}

function ensureTargetedAnnouncementPanel() {
    if (!["maintenance", "security"].includes(dashboardRole)) return;
    const panelId = "roleAnnouncementList";
    if (document.getElementById(panelId)) return;
    const nav = document.querySelector("#sidebar .sidebar-nav");
    const content = document.querySelector(".dashboard-container");
    if (!nav || !content) return;
    const link = document.createElement("a");
    link.href = "#announcements";
    link.className = "nav-link btn btn-link text-start text-decoration-none";
    link.dataset.panel = "announcements";
    link.innerHTML = '<i class="fa-solid fa-bullhorn me-2"></i> Announcements';
    link.addEventListener("click", () => openPanel("announcements"));
    nav.appendChild(link);
    const panel = document.createElement("section");
    panel.className = "d-none animate__animated animate__fadeIn";
    panel.dataset.view = "announcements";
    panel.id = "panel-announcements";
    panel.tabIndex = -1;
    panel.innerHTML = `<div class="card shadow-sm border-0 rounded-4"><div class="card-header bg-transparent border-0 pt-4 px-4"><span class="small text-primary fw-bold text-uppercase">Society communication</span><h4 class="fw-bold mb-1 mt-1">Announcements</h4><p class="text-muted mb-0">Updates sent directly to the ${dashboardRole} dashboard.</p></div><div class="card-body px-4 pb-4" id="roleAnnouncementList"><div class="text-center text-muted py-4">Loading society notices…</div></div></div>`;
    content.appendChild(panel);
}

function renderAnnouncements(noticeItems = []) {
    if (dashboardRole === "admin") {
        document.querySelectorAll('table[data-table="announcements"] tbody').forEach(body => {
            body.replaceChildren();
            if (!noticeItems.length) {
                const row = document.createElement("tr"); row.innerHTML = '<td colspan="4" class="text-muted text-center py-4">No announcements published yet.</td>'; body.appendChild(row); return;
            }
            noticeItems.forEach(notice => {
                const row = document.createElement("tr");
                const noticeCell = document.createElement("td");
                const title = document.createElement("div"); title.className = "fw-semibold"; title.textContent = notice.title;
                const message = document.createElement("div"); message.className = "small text-muted text-truncate"; message.style.maxWidth = "520px"; message.textContent = notice.message;
                noticeCell.append(title, message); row.appendChild(noticeCell);
                [notice.audience || "ALL", notice.emergency ? "Urgent" : "Standard", notice.createdAt ? new Date(notice.createdAt).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "Just now"].forEach((value, index) => {
                    const cell = document.createElement("td");
                    if (index === 1) { const badge = document.createElement("span"); badge.className = notice.emergency ? "badge text-bg-danger" : "badge text-bg-primary"; badge.textContent = value; cell.appendChild(badge); } else cell.textContent = value.replaceAll("_", " ");
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
        });
        const message = document.getElementById("announcementMessage");
        const counter = document.getElementById("announcementCharacterCount");
        const titleInput = document.getElementById("announcementTitle");
        const audienceInput = document.getElementById("announcementAudience");
        const urgentInput = document.getElementById("announcementEmergency");
        const state = document.getElementById("announcementState");
        const updateCount = () => { if (counter && message) counter.textContent = `${message.value.length} / 3000 characters`; };
        if (message && !message.dataset.counterBound) { message.dataset.counterBound = "true"; message.addEventListener("input", updateCount); }
        const markDraftChanged = () => {
            if (!state) return;
            state.textContent = "Draft changed";
            state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2";
        };
        [titleInput, message, audienceInput, urgentInput].filter(Boolean).forEach(input => {
            if (input.dataset.draftBound) return;
            input.dataset.draftBound = "true";
            input.addEventListener(input.matches("input, textarea") ? "input" : "change", markDraftChanged);
        });
        updateCount();
        return;
    }
    ensureTargetedAnnouncementPanel();
    const list = document.getElementById(dashboardRole === "resident" ? "residentAnnouncementList" : "roleAnnouncementList");
    if (!list) return;
    list.replaceChildren();
    const audiences = dashboardRole === "resident" ? ["ALL", "RESIDENTS"] : dashboardRole === "maintenance" ? ["ALL", "STAFF", "MAINTENANCE"] : ["ALL", "STAFF", "SECURITY"];
    const roleNotices = noticeItems.filter(n => audiences.includes(String(n.audience || "ALL").toUpperCase()));
    if (!roleNotices.length) { list.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-regular fa-bell-slash fs-2 d-block mb-2"></i>No active society notices.</div>'; return; }
    roleNotices.forEach(notice => {
        const article = document.createElement("article");
        article.className = `alert border-start border-4 shadow-sm mb-3 ${notice.emergency ? "alert-danger border-danger" : "alert-info border-primary"}`;
        const badges = [notice.category ? `<span class="badge text-bg-light me-2">${escapeAttribute(notice.category.replaceAll("_"," "))}</span>` : "", notice.actionRequired ? '<span class="badge text-bg-warning">Action required</span>' : ""].join("");
        const contact = [notice.contactPerson, notice.contactPhone].filter(Boolean).join(" · ");
        article.innerHTML = `<div class="d-flex justify-content-between align-items-start gap-3"><h5 class="alert-heading fw-bold mb-2"><i class="fa-solid ${notice.emergency ? "fa-triangle-exclamation" : "fa-bullhorn"} me-2"></i>${escapeAttribute(notice.title)}</h5><div>${badges}</div></div><p class="mb-2" style="white-space:pre-wrap">${escapeAttribute(notice.message)}</p>${contact ? `<p class="small mb-2"><strong>Contact:</strong> ${escapeAttribute(contact)}</p>` : ""}${notice.attachmentReference ? `<p class="small mb-2"><strong>Reference:</strong> ${escapeAttribute(notice.attachmentReference)}</p>` : ""}<hr class="my-2 opacity-25"><p class="mb-0 small fw-semibold">Published by Society Admin · ${notice.createdAt ? new Date(notice.createdAt).toLocaleString([], {dateStyle:"medium",timeStyle:"short"}) : "Just now"}${notice.validUntil ? ` · Visible until ${new Date(notice.validUntil).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}` : ""}</p>`;
        list.appendChild(article);
    });
    const noticeNav = document.querySelector('[data-panel="announcements"]');
    if (noticeNav) { let badge=noticeNav.querySelector(".resident-notice-count"); if (!badge) { badge=document.createElement("span"); badge.className="resident-notice-count badge rounded-pill text-bg-danger ms-auto"; noticeNav.appendChild(badge); } badge.textContent=String(roleNotices.length); }
    const unseen = roleNotices.filter(n => n.inAppNotification && !localStorage.getItem(`smartsociety-notice-seen-${n.id}`));
    if (unseen.length) { showToast(`${unseen.length} new society notice${unseen.length === 1 ? "" : "s"}. Open Notice Board to read.`); unseen.forEach(n => localStorage.setItem(`smartsociety-notice-seen-${n.id}`,"1")); }
}

function renderAmenityBookingDesk(amenityItems = [], bookingItems = [], residents = []) {
    if (dashboardRole !== "admin") return;
    const formatDateTime = value => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
    const paymentLabel = booking => {
        const method = booking.paymentMethod || "Not recorded";
        const status = booking.paymentStatus ? ` · ${booking.paymentStatus.replaceAll("_", " ")}` : "";
        return `${method}${status}`;
    };
    document.querySelectorAll('table[data-table="amenity-bookings"] tbody').forEach(body => {
        body.replaceChildren();
        if (!bookingItems.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="9" class="text-muted text-center py-4">No amenity bookings yet. Resident requests will appear here automatically.</td>';
            body.appendChild(row);
            return;
        }
        bookingItems.forEach(booking => {
            const row = document.createElement("tr");
            row.dataset.recordId = booking.id;
            const add = value => { const td = document.createElement("td"); td.textContent = value; row.appendChild(td); };
            add(booking.amenity || "—");
            add(booking.resident || "—");
            add(booking.unitNo || "—");
            add(`${formatDateTime(booking.startTime)} – ${formatDateTime(booking.endTime)}`);
            add(paymentLabel(booking));
            add(`Rs. ${booking.amount ?? 0}`);
            add([
                booking.eventPurpose && `Purpose: ${booking.eventPurpose}`,
                booking.expectedGuests != null && `Guests: ${booking.expectedGuests}`,
                booking.vehicleCount != null && `Vehicles: ${booking.vehicleCount}`,
                booking.organizerPhone && `Contact: ${booking.organizerPhone}`,
                booking.specialInstructions && `Notes: ${booking.specialInstructions}`
            ].filter(Boolean).join(" · ") || "—");
            const approval = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = `status ${statusClass(booking.approvalStatus)}`;
            badge.textContent = booking.approvalStatus || "PENDING";
            approval.appendChild(badge); row.appendChild(approval);
            const action = document.createElement("td");
            if (booking.approvalStatus === "PENDING") {
                ["APPROVED", "REJECTED"].forEach(status => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = `btn btn-sm ${status === "APPROVED" ? "btn-primary me-2" : "btn-outline-danger"}`;
                    button.dataset.backendAction = status === "APPROVED" ? "booking-approve" : "booking-reject";
                    button.textContent = status === "APPROVED" ? "Approve" : "Reject";
                    action.appendChild(button);
                });
            } else action.textContent = "Reviewed";
            row.appendChild(action);
            body.appendChild(row);
        });
    });
    document.querySelectorAll('table[data-table="amenity-prices"] tbody').forEach(body => {
        body.replaceChildren();
        if (!amenityItems.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="5" class="text-muted text-center py-4">No amenities are configured yet.</td>';
            body.appendChild(row);
            return;
        }
        amenityItems.forEach(amenity => {
            const row = document.createElement("tr");
            [amenity.name, amenity.capacity, `Rs. ${amenity.bookingFee ?? 0}`, amenity.approvalRequired ? "Required" : "Not required"].forEach(value => {
                const td = document.createElement("td"); td.textContent = value; row.appendChild(td);
            });
            const action = document.createElement("td");
            const button = document.createElement("button");
            button.type = "button"; button.className = "btn btn-sm btn-outline-primary";
            button.dataset.action = "amenity-price-edit";
            button.dataset.amenityId = amenity.id;
            button.dataset.amenityName = amenity.name;
            button.dataset.amenityCapacity = amenity.capacity;
            button.dataset.amenityPrice = amenity.bookingFee ?? 0;
            button.dataset.amenityApproval = amenity.approvalRequired ? "Yes" : "No";
            button.textContent = "Edit price";
            action.appendChild(button); row.appendChild(action); body.appendChild(row);
        });
    });
}

async function syncSocietyWorkspace(note = "") {
    const state = document.getElementById("societySyncState");
    if (state) state.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Syncing live records';
    try {
        await loadSocietyBackendData();
        const timestamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        if (state) state.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i>Synced ${timestamp}`;
        appendDashboardActivity(`Society data synced${note ? `: ${note}` : ""}`);
        showToast("✓ Society records refreshed");
        return true;
    } catch (error) {
        if (state) state.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Sync needs retry';
        showToast(error.message || "Unable to sync society records");
        return false;
    }
}

function wireSocietySyncDialog() {
    const trigger = document.getElementById("societySyncButton");
    const modal = document.getElementById("societySyncModal");
    const note = document.getElementById("societySyncNote");
    const close = () => {
        modal?.classList.add("hidden");
        modal?.setAttribute("aria-hidden", "true");
    };
    if (!trigger || !modal || trigger.dataset.syncReady) return;
    trigger.dataset.syncReady = "true";
    trigger.addEventListener("click", event => {
        // The dashboard also has delegated click handlers. Stop this click here so
        // they cannot immediately close or redirect away from the sync form.
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        if (note) note.value = "";
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        note?.focus();
    }, true);
    ["closeSocietySyncModal", "cancelSocietySync"].forEach(id => document.getElementById(id)?.addEventListener("click", close));
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    document.getElementById("confirmSocietySync")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Syncing…';
        const completed = await syncSocietyWorkspace(document.getElementById("societySyncNote")?.value.trim() || "");
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-rotate me-2"></i>Sync now';
        if (completed) close();
    });
}

function wireSocietyNoticeDialog() {
    const trigger = document.getElementById("societyNoticeButton");
    const dialog = document.getElementById("societyNoticeDialog");
    const form = document.getElementById("societyNoticeForm");
    if (!trigger || !dialog || !form || trigger.dataset.noticeReady) return;
    trigger.dataset.noticeReady = "true";
    const close = () => { dialog.classList.add("hidden"); dialog.setAttribute("aria-hidden", "true"); };
    const open = () => { dialog.classList.remove("hidden"); dialog.setAttribute("aria-hidden", "false"); document.getElementById("societyNoticeTitleInput")?.focus(); };
    trigger.addEventListener("click", event => { event.preventDefault(); open(); });
    ["societyNoticeClose", "societyNoticeCancel"].forEach(id => document.getElementById(id)?.addEventListener("click", close));
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const send = document.getElementById("societyNoticeSend");
        const title = document.getElementById("societyNoticeTitleInput")?.value.trim() || "";
        const message = document.getElementById("societyNoticeMessage")?.value.trim() || "";
        const audience = document.getElementById("societyNoticeAudience")?.value || "RESIDENTS";
        if (!title || !message) { showToast("Enter a notice title and message."); return; }
        if (send) { send.disabled = true; send.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Sending…'; }
        try {
            const result = await mutateSociety("society/announcements", "POST", { title, message, audience, emergency: Boolean(document.getElementById("societyNoticeUrgent")?.checked), category: "GENERAL", effectiveFrom: null, validUntil: null, actionRequired: false, contactPerson: "", contactPhone: "", attachmentReference: "", inAppNotification: true, emailNotification: false });
            form.reset();
            close();
            await loadSocietyBackendData();
            showToast(`✓ Notice sent to ${result.recipientCount || 0} selected dashboard user(s).`);
        } catch (error) {
            showToast(error.message || "Notice could not be sent.");
        } finally {
            if (send) { send.disabled = false; send.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Send notice'; }
        }
    });
}

function moneyLabel(value) { return `Rs. ${Number(value || 0).toLocaleString("en-IN", {maximumFractionDigits: 2})}`; }

function renderPaymentRegister() {
    const records = window.societyPaymentRecords || [];
    const bills = window.societyBillRecords || [];
    const search = document.getElementById("paymentSearch")?.value.trim().toLowerCase() || "";
    const mode = document.getElementById("paymentModeFilter")?.value || "";
    const month = document.getElementById("paymentMonthFilter")?.value || "";
    const filtered = records.filter(payment => {
        const searchable = `${payment.unitNo || ""} ${payment.transactionId || ""} ${payment.billMonth || ""}`.toLowerCase();
        return (!search || searchable.includes(search)) && (!mode || payment.mode === mode) && (!month || String(payment.billMonth || "").startsWith(month));
    });
    const body = document.querySelector('table[data-table="payments"] tbody');
    if (body) {
        body.replaceChildren(...filtered.map(payment => {
            const row = document.createElement("tr");
            const values = [`${payment.unitNo || "—"} · ${payment.billMonth || "Maintenance bill"}`, moneyLabel(payment.amount), payment.mode || "—", payment.transactionId || "—", payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"}) : "—"];
            values.forEach(value => { const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell); });
            const status = document.createElement("td"); const badge = document.createElement("span"); badge.className = `status ${statusClass(payment.status)}`; badge.textContent = payment.status || "SUCCESS"; status.appendChild(badge); row.appendChild(status);
            const receipt = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-sm btn-outline-primary"; button.dataset.paymentReceipt = JSON.stringify(payment); button.textContent = "View receipt"; receipt.appendChild(button); row.appendChild(receipt); return row;
        }));
        if (!filtered.length) body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No payments match the selected filters.</td></tr>';
    }
    const collected = records.filter(item => String(item.status || "").toUpperCase() === "SUCCESS").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outstandingBills = bills.filter(item => String(item.paymentStatus || "").toUpperCase() !== "PAID");
    const outstanding = outstandingBills.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentCollected = records.filter(item => String(item.paidAt || "").startsWith(currentMonth)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const digital = records.filter(item => ["UPI", "BANK_TRANSFER", "CARD", "ONLINE"].includes(String(item.mode || "").toUpperCase())).length;
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set("paymentsCollected", moneyLabel(collected)); set("paymentsCount", `${records.length} successful payment${records.length === 1 ? "" : "s"}`); set("paymentsOutstanding", moneyLabel(outstanding)); set("paymentsDueCount", `${outstandingBills.length} pending bill${outstandingBills.length === 1 ? "" : "s"}`); set("paymentsThisMonth", moneyLabel(currentCollected)); set("paymentsDigitalRate", records.length ? `${Math.round((digital / records.length) * 100)}%` : "0%");
}

function exportPaymentRegister() {
    const records = window.societyPaymentRecords || [];
    const header = ["Flat", "Billing month", "Amount", "Method", "Transaction reference", "Paid at", "Status"];
    const rows = records.map(item => [item.unitNo, item.billMonth, item.amount, item.mode, item.transactionId, item.paidAt, item.status]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); link.download = `payment-register-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast("Payment register exported.");
}

function resetExpenseForm() {
    const form = document.getElementById("expenseForm"); if (!form) return;
    form.reset(); form.dataset.editingId = "";
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    const save = document.getElementById("saveExpense"); if (save) save.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Record Expense';
    document.getElementById("cancelExpenseEdit")?.classList.add("d-none");
    const state = document.getElementById("expenseFormState"); if (state) { state.textContent = "New expense"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
}

function editExpense(button) {
    const form = document.getElementById("expenseForm"); if (!form) return;
    const expense = JSON.parse(button.dataset.expense || "{}"); form.dataset.editingId = expense.id || "";
    ["title", "category", "vendor", "vendorPhone", "invoiceNumber", "invoiceDate", "dueDate", "amount", "taxAmount", "date", "description"].forEach(field => { if (form.elements[field]) form.elements[field].value = expense[field] ?? ""; });
    const save = document.getElementById("saveExpense"); if (save) save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Expense';
    document.getElementById("cancelExpenseEdit")?.classList.remove("d-none");
    const state = document.getElementById("expenseFormState"); if (state) { state.textContent = `Editing ${expense.title || expense.category}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
    form.scrollIntoView({behavior:"smooth",block:"center"}); form.elements.title.focus();
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("expenseForm");
    if (!form) return;
    resetExpenseForm();
    form.addEventListener("submit", event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form).entries());
        const payload = {...values, amount:Number(values.amount), taxAmount:values.taxAmount ? Number(values.taxAmount) : null};
        ["invoiceDate", "dueDate"].forEach(field => payload[field] = values[field] || null);
        const id = form.dataset.editingId;
        mutateSociety(`society/finance/expenses${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", payload)
            .then(() => { showToast(id ? "Expense details updated." : "Expense recorded for approval."); resetExpenseForm(); return loadSocietyBackendData(); })
            .catch(error => showToast(error.message || "Expense could not be saved."));
    });
    document.getElementById("cancelExpenseEdit")?.addEventListener("click", resetExpenseForm);
    ["paymentSearch", "paymentModeFilter", "paymentMonthFilter"].forEach(id => document.getElementById(id)?.addEventListener("input", renderPaymentRegister));
    document.getElementById("paymentModeFilter")?.addEventListener("change", renderPaymentRegister);
    document.getElementById("clearPaymentFilters")?.addEventListener("click", () => { ["paymentSearch", "paymentModeFilter", "paymentMonthFilter"].forEach(id => { const field = document.getElementById(id); if (field) field.value = ""; }); renderPaymentRegister(); });
    document.getElementById("exportPayments")?.addEventListener("click", exportPaymentRegister);
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-payment-receipt]"); if (!button) return;
    const payment = JSON.parse(button.dataset.paymentReceipt || "{}");
    window.alert(`Payment Receipt\n\nFlat: ${payment.unitNo || "—"}\nBilling cycle: ${payment.billMonth || "—"}\nAmount: ${moneyLabel(payment.amount)}\nMethod: ${payment.mode || "—"}\nReference: ${payment.transactionId || "—"}\nPaid at: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : "—"}\nStatus: ${payment.status || "SUCCESS"}`);
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-subscription-action]"); if (!button) return;
    const action = button.dataset.subscriptionAction;
    if (action === "support") {
        window.location.href = "mailto:support@smartapartment.local?subject=" + encodeURIComponent("Society subscription support request");
        return;
    }
    const rows = [...document.querySelectorAll("#saasInvoiceTable tbody tr")].map(row => [...row.children].slice(0, 6).map(cell => cell.textContent.trim()));
    if (action === "export") {
        const csv = [["Invoice number", "Plan", "Billing cycle", "Amount", "Payment status", "Invoice date"], ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); link.download = "saas-invoice-history.csv"; link.click(); URL.revokeObjectURL(link.href); showToast("Invoice history exported.");
        return;
    }
    if (action === "invoice") {
        const row = button.closest("tr"); const values = row ? [...row.children].slice(0, 6).map(cell => cell.textContent.trim()) : [button.dataset.invoice || "Invoice"];
        const content = `SmartApartment SaaS Invoice\n\nInvoice number: ${values[0]}\nPlan: ${values[1]}\nBilling cycle: ${values[2]}\nAmount: ${values[3]}\nPayment status: ${values[4]}\nInvoice date: ${values[5]}\n\nThis is a subscription invoice record generated from the SmartApartment society dashboard.`;
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], {type:"text/plain"})); link.download = `${values[0] || "subscription-invoice"}.txt`; link.click(); URL.revokeObjectURL(link.href); showToast("Invoice record downloaded.");
    }
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-society-report]");
    if (!button) return;
    const action = button.dataset.societyReport;
    const period = document.getElementById("reportPeriod")?.value || "Current month";
    const focus = document.getElementById("reportFocus")?.value || "All operational areas";
    const prepared = document.getElementById("reportPreparedAt");

    if (action === "refresh") {
        if (prepared) prepared.innerHTML = `<i class="fa-solid fa-check text-success me-1"></i>Insights refreshed for <strong>${period}</strong> · ${focus} · ${new Date().toLocaleString()}.`;
        showToast("Report insights refreshed.");
        return;
    }

    const reports = {
        billing: [["Metric", "Value"], ["Period", period], ["Total billed", "Rs. 5,00,000"], ["Collected", "Rs. 4,30,000"], ["Collection rate", "86%"], ["Pending bills", "46"]],
        visitors: [["Metric", "Value"], ["Period", period], ["Visitor entries", "1,248"], ["Approved visitors", "1,180"], ["Delayed exits", "42"], ["Staff entries", "120"]],
        complaints: [["Metric", "Value"], ["Period", period], ["Open complaints", "12"], ["Resolved within SLA", "92%"], ["Average resolution time", "14 hours"], ["Priority cases", "3"]],
        expenses: [["Metric", "Value"], ["Period", period], ["Approved expenses", "Rs. 1,84,000"], ["Pending approvals", "3"], ["Vendors paid", "8"], ["Budget utilization", "74%"]]
    };
    const keys = action === "all" ? Object.keys(reports) : [action];
    const rows = keys.flatMap((key, index) => (index ? [[""]] : []).concat([[key.toUpperCase()]], reports[key] || []));
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = action === "all" ? "society-reporting-pack.csv" : `society-${action}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    if (prepared) prepared.innerHTML = `<i class="fa-solid fa-download text-primary me-1"></i>${action === "all" ? "Reporting pack" : `${action[0].toUpperCase()}${action.slice(1)} report`} exported for <strong>${period}</strong>.`;
    showToast("Report download started.");
});

document.addEventListener("DOMContentLoaded", loadSocietyBackendData);
document.addEventListener("DOMContentLoaded", wireSocietySyncDialog);
document.addEventListener("DOMContentLoaded", wireSocietyNoticeDialog);
if (document.readyState !== "loading") wireSocietySyncDialog();
if (document.readyState !== "loading") wireSocietyNoticeDialog();
document.addEventListener("click", event => {
    const button = event.target.closest("[data-access-audit]");
    if (!button) return;
    const row = button.closest("tr");
    const admin = row?.children[0]?.textContent.trim() || "this administrator";
    event.preventDefault();
    if (typeof window.forceOpenPanel === "function") window.forceOpenPanel("users");
    else document.querySelector('[data-panel="users"]')?.click();
    showToast(`Reviewing the live account and access status for ${admin}.`);
});
function openComplaintAssignmentDialog(button) {
    if (dashboardRole !== "admin") { showToast("Only the Society Admin can assign complaint tasks."); return; }
    const row = button.closest("tr");
    const id = row?.dataset.recordId;
    if (!id) return;
    let dialog = document.getElementById("complaintAssignmentDialog");
    if (!dialog) {
        dialog = document.createElement("div");
        dialog.id = "complaintAssignmentDialog";
        dialog.className = "society-sync-dialog";
        dialog.innerHTML = `<div class="modal-card p-4" style="max-width:560px"><button type="button" class="btn-close float-end" aria-label="Close"></button><div class="mb-4"><span class="small fw-bold text-primary text-uppercase">Complaint workflow</span><h4 class="fw-bold mb-1">Assign complaint task</h4><p class="text-muted mb-0">Only the Society Admin can choose the team responsible for a resident complaint.</p></div><form class="row g-3"><div class="col-12"><label class="form-label fw-semibold">Assign to</label><select class="form-select" name="team" required><option value="MAINTENANCE">Maintenance dashboard</option><option value="SECURITY">Security dashboard</option></select></div><div class="col-12"><label class="form-label fw-semibold">Assignment note</label><textarea class="form-control" name="note" rows="3" placeholder="Describe the action required for the assigned team"></textarea></div><div class="col-12 d-flex justify-content-end gap-2"><button type="button" class="btn btn-light" data-cancel>Cancel</button><button type="submit" class="btn btn-primary"><i class="fa-solid fa-user-check me-1"></i> Assign task</button></div></form></div>`;
        document.body.appendChild(dialog);
        const close = () => dialog.classList.add("hidden");
        dialog.querySelector(".btn-close").addEventListener("click", close);
        dialog.querySelector("[data-cancel]").addEventListener("click", close);
        dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
        dialog.querySelector("form").addEventListener("submit", async event => {
            event.preventDefault();
            const activeId = dialog.dataset.complaintId;
            const submit = event.currentTarget.querySelector('[type="submit"]');
            submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Assigning…';
            try {
                await mutateSociety(`society/complaints/${activeId}/assignment`, "PATCH", { team: event.currentTarget.team.value, assignmentNote: event.currentTarget.note.value.trim() });
                close(); await loadSocietyBackendData(); showToast("✓ Complaint task assigned successfully.");
            } catch (error) { showToast(error.message || "Complaint could not be assigned"); }
            finally { submit.disabled = false; submit.innerHTML = '<i class="fa-solid fa-user-check me-1"></i> Assign task'; }
        });
    }
    dialog.dataset.complaintId = id;
    dialog.classList.remove("hidden");
}

document.addEventListener("click",event=>{
    const button=event.target.closest("[data-backend-action]");if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();const row=button.closest("tr");const id=row?.dataset.recordId;
    const action=button.dataset.backendAction;
    if(action === "complaint-assign") { openComplaintAssignmentDialog(button); return; }
    button.disabled=true;
    const monitoringActions=["trigger-reminder", "audit-gate", "sync-kyc", "escalate-complaints", "review-damages", "audit-expenses", "global-broadcast", "force-reports"];
    if(monitoringActions.includes(action) && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
    let operation;
    if(action === "add-society") {
        const societyName = window.prompt("Society name", "");
        if (!societyName?.trim()) { button.disabled = false; return; }
        const city = window.prompt("City", "");
        if (!city?.trim()) { showToast("Please enter the city for the society."); button.disabled = false; return; }
        const contactEmail = window.prompt("Contact email (optional)", "") || "";
        operation = mutateSociety("platform/tenants", "POST", {societyName: societyName.trim(), city: city.trim(), contactEmail});
    }
    else if(action === "edit-society") {
        const society = (window.platformTenants || []).find(item => String(item.id) === String(id));
        const administrator = (window.platformUsers || []).find(user =>
            String(user.tenantId) === String(society?.tenantId) && ["SOCIETY_ADMIN", "FACILITY_MANAGER"].includes(String(user.role))
        );
        if (!society || typeof window.openSocietyEditor !== "function") {
            showToast("The complete society profile is still loading. Please try again.");
            button.disabled = false;
            return;
        }
        window.openSocietyEditor(society, administrator || null);
        button.disabled = false;
        return;
    }
    else if(action==="announcement-publish"){
        const panel = button.closest('[data-view="announcements"]');
        const title = panel?.querySelector("#announcementTitle")?.value.trim() || "";
        const message = panel?.querySelector("#announcementMessage")?.value.trim() || "";
        const audience = panel?.querySelector("#announcementAudience")?.value || "ALL";
        const emergency = Boolean(panel?.querySelector("#announcementEmergency")?.checked);
        if (!title || !message) { showToast("Enter both an announcement title and message."); button.disabled = false; return; }
        const payload={title,message,audience,emergency,category:panel?.querySelector("#announcementCategory")?.value || "GENERAL",
            effectiveFrom:panel?.querySelector("#announcementEffectiveFrom")?.value || null,validUntil:panel?.querySelector("#announcementValidUntil")?.value || null,
            actionRequired:Boolean(panel?.querySelector("#announcementActionRequired")?.checked),contactPerson:panel?.querySelector("#announcementContactPerson")?.value.trim() || "",
            contactPhone:panel?.querySelector("#announcementContactPhone")?.value.trim() || "",attachmentReference:panel?.querySelector("#announcementAttachment")?.value.trim() || "",
            inAppNotification:Boolean(panel?.querySelector("#announcementInApp")?.checked),emailNotification:Boolean(panel?.querySelector("#announcementEmail")?.checked)};
        operation=mutateSociety("society/announcements","POST",payload);
    }
    else if(action==="amenity-book"){const start=new Date(Date.now()+86400000);start.setMinutes(0,0,0);const end=new Date(start.getTime()+3600000);operation=mutateSociety("society/bookings","POST",{amenityId:Number(button.dataset.amenityId),startTime:start.toISOString().slice(0,19),endTime:end.toISOString().slice(0,19)});}
    else if(action.startsWith("visitor-"))operation=mutateSociety(`society/visitors/${id}/${action.endsWith("checkout")?"checkout":"checkin"}`,"PATCH");
    else if(action==="complaint-close")operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"CLOSED",assignedTo:"",resolutionNotes:"Closed from dashboard"});
    else if(action==="complaint-start"){
        const technician=window.societyCurrentUser?.name||"Maintenance technician";
        operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"IN_PROGRESS",assignedTo:technician,resolutionNotes:`Work claimed and started by ${technician}`,sparePartsUsed:"",repairCost:null});
    }
    else if(action==="complaint-resolve"){
        const technician=window.societyCurrentUser?.name||"Maintenance technician";
        operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"RESOLVED",assignedTo:technician,resolutionNotes:`Repair completed by ${technician}`,sparePartsUsed:"",repairCost:null});
    }
    else if(action==="expense-edit"){editExpense(button);button.disabled=false;return;}
    else if(action==="expense-approve")operation=mutateSociety(`society/finance/expenses/${id}/approve`,"PATCH");
    else if(action==="expense-reject"){const note=window.prompt("Reason for rejecting this expense (optional):","");if(note===null){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}/reject?note=${encodeURIComponent(note)}`,"PATCH");}
    else if(action==="expense-delete"){if(!window.confirm("Remove this pending expense?")){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}`,"DELETE");}
    else if(action==="expense-pay"){const mode=window.prompt("Payment mode (CASH, UPI, BANK_TRANSFER, CHEQUE):","BANK_TRANSFER");if(!mode?.trim()){button.disabled=false;return;}const reference=window.prompt("Payment reference / cheque number (optional):","");if(reference===null){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}/pay?mode=${encodeURIComponent(mode)}&reference=${encodeURIComponent(reference)}`,"PATCH");}
    else if(action==="booking-approve" || action==="booking-reject")operation=mutateSociety(`society/bookings/${id}/approval`,"PATCH",{approvalStatus:action==="booking-approve"?"APPROVED":"REJECTED"});
    // Super Admin Actions
    else if(action==="suspend-society")operation=mutateSociety(`platform/tenants/${id}/approval?approved=false`,"PATCH");
    else if(action==="approve-society")operation=mutateSociety(`platform/tenants/${id}/approval?approved=true`,"PATCH");
    else if(action==="process-privacy")operation=mutateSociety(`superadmin/data/privacy/process-deletion?requestId=${id}`,"POST");
    else if(action==="update-billing-rule")operation=mutateSociety(`superadmin/subscriptions/rules?ruleName=TestRule`,"POST");
    else if(monitoringActions.includes(action)) {
        operation = mutateSociety("superadmin/monitoring/action", "POST", {action: action});
    }
    else operation=Promise.reject(new Error(`Unsupported dashboard action: ${action}`));
    
    operation.then(result=>{
        if (action === "add-society") showToast(`✓ ${result.societyName || "Society"} added and ready for approval.`);
        if (action === "edit-society") showToast(`✓ ${result.societyName || "Society"} updated.`);
        if (action === "announcement-publish") {
            const panel = button.closest('[data-view="announcements"]');
            const state = panel?.querySelector("#announcementState");
            if (state) { state.textContent = "Published successfully"; state.className = "badge bg-success-subtle text-success-emphasis border border-success-subtle px-3 py-2"; }
            const message = panel?.querySelector("#announcementMessage");
            if (message) message.value = "";
            panel?.querySelector("#announcementEmergency") && (panel.querySelector("#announcementEmergency").checked = false);
            showToast(`✓ Announcement published. ${result.residentCount || 0} resident account(s) can now see it.`);
        }
        if (action === "suspend-society") showToast("✓ Society suspended. Platform access has been paused.");
        if (action === "approve-society") showToast("✓ Society approved and activated.");
        if(monitoringActions.includes(action)) {
            const message=result.message || "Platform action completed.";
            showToast("✓ " + message);
            if("Notification" in window && Notification.permission === "granted") new Notification("SmartSociety alert sent", {body: message, icon: "/favicon.svg"});
        }
        return loadSocietyBackendData();
    }).catch(error=>showToast(error.message)).finally(()=>button.disabled=false);
},true);

function persistDashboardState() {
    // Server APIs are authoritative. DOM state is intentionally not persisted.
}

function restoreDashboardState() {
    localStorage.removeItem(dashboardStorageKey);
}

function profileInputs() {
    return [...document.querySelectorAll('[data-view="profile"] [data-profile-field]')];
}

function saveResidentProfileState() {
    if (dashboardRole !== "resident") return null;
    const fields = profileInputs();
    if (!fields.length) return null;
    const profile = fields.reduce((data, field) => {
        data[field.dataset.profileField] = field.value.trim();
        return data;
    }, {});
    localStorage.setItem(residentProfileStorageKey, JSON.stringify(profile));
    return profile;
}

function restoreResidentProfileState() {
    if (dashboardRole !== "resident") return;
    try {
        const saved = JSON.parse(localStorage.getItem(residentProfileStorageKey) || "{}");
        profileInputs().forEach(field => {
            const value = saved[field.dataset.profileField];
            if (value) field.value = value;
        });
    } catch {
        localStorage.removeItem(residentProfileStorageKey);
    }
}

function wireAutosave() {
    document.addEventListener("input", event => {
        if (event.target.matches("[data-profile-field]")) saveResidentProfileState();
        if (event.target.closest(".main")) persistDashboardState();
    });
    document.addEventListener("change", event => {
        if (event.target.matches("[data-profile-field]")) saveResidentProfileState();
        if (event.target.closest(".main")) persistDashboardState();
    });
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4200);
}

function buttonLabel(button) {
    return button?.textContent?.trim() || "";
}

function escapeAttribute(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function currentMonthName() {
    return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function readNearbyFields(button) {
    const scope = button?.closest?.(".card, .header, [data-view]") || document;
    return [...scope.querySelectorAll("input, select, textarea")]
        .map(field => {
            const label = field.closest("label")?.childNodes?.[0]?.textContent?.trim();
            const name = label || field.getAttribute("name") || field.placeholder || "Field";
            return `${name}: ${field.value || field.textContent || ""}`.trim();
        })
        .filter(value => !value.endsWith(":"));
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function getContext(button) {
    const panel = button.closest("[data-view]")?.dataset.view || "overview";
    const panelTitle = titles[panel] || panel;
    const row = button.closest("tr");
    if (row) {
        const cells = [...row.children].map(cell => cell.textContent.trim()).filter(Boolean);
        return {
            panel,
            panelTitle,
            target: cells.slice(0, Math.min(3, cells.length - 1 || cells.length)).join(" / "),
            detail: cells.join(" | ")
        };
    }
    const card = button.closest(".card");
    if (card) {
        const heading = card.querySelector("h2, h3")?.textContent.trim();
        const copy = card.querySelector("p")?.textContent.trim();
        return { panel, panelTitle, target: heading || button.textContent.trim(), detail: copy || panelTitle };
    }
    const text = button.textContent.trim();
    return { panel, panelTitle, target: text || panelTitle, detail: panelTitle };
}

function showActionReceipt({ title, lines }) {
    const modal = ensureActionModal();
    modal.querySelector("#dashboardActionTitle").textContent = title;
    modal.querySelector("#dashboardActionText").innerHTML = lines.map(line => {
        const clean = String(line).replace(/^<strong>|<\/strong>/g, "");
        const [label, ...rest] = clean.split(":");
        return `<span class="receipt-line"><strong>${label.trim()}:</strong><span>${rest.join(":").trim()}</span></span>`;
    }).join("");
    modal.querySelector("#dashboardActionFields").innerHTML = "";
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Done";
    save.onclick = closeActionModal;
    modal.classList.remove("hidden");
}

function openPanel(panel, updateHistory = true) {
    const selectedView = document.querySelector(`[data-view="${panel}"]`);
    if (!selectedView) return;
    document.querySelectorAll("[data-panel]").forEach(button => {
        const active = button.dataset.panel === panel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-view]").forEach(view => {
        const shouldHide = view !== selectedView;
        if (shouldHide) {
            view.style.setProperty("display", "none", "important");
        } else {
            view.style.setProperty("display", "block", "important");
        }
        view.classList.toggle("d-none", shouldHide);
        view.classList.toggle("hidden", shouldHide);
    });
    // Security uses its own heading id; keep it synchronized with the panel just like every other dashboard.
    const title = document.getElementById("title") || document.getElementById("securityTitle");
    if (title) title.textContent = dashboardRole === "security"
        ? (securityPanelTitles[panel] || "Security Dashboard")
        : (titles[panel] || "Dashboard");
    if (updateHistory && location.hash !== `#${panel}`) history.pushState(null, "", `#${panel}`);
    selectedView.focus({ preventScroll: true });
}

function animateStats() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".stats strong").forEach(stat => {
        const match = stat.textContent.trim().match(/^(\d+)(.*)$/);
        if (!match) return;
        const target = Number(match[1]);
        const suffix = match[2];
        const started = performance.now();
        const tick = now => {
            const progress = Math.min((now - started) / 650, 1);
            stat.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function addRow(tableName, cells) {
    const tbody = document.querySelector(`[data-table="${tableName}"] tbody`);
    if (!tbody) return;
    const row = document.createElement("tr");
    const columnCount = tbody.querySelector("tr")?.children.length || cells.length;
    row.innerHTML = Array.from({ length: columnCount }, (_, index) => `<td>${cells[index] || "Created"}</td>`).join("");
    tbody.appendChild(row);
}

function ensureSecurityVisitorTable() {
    if (dashboardRole !== "security") return null;
    const table = document.querySelector('[data-view="visitors"] table');
    if (!table) return null;
    table.dataset.table = "visitors";
    const heading = document.querySelector('[data-view="visitors"] h2');
    if (heading && heading.textContent.trim() === "Current Visitors Inside") {
        heading.textContent = "Visitor Queue";
    }
    return table.querySelector("tbody");
}

function findVisitorRow(visitor, flat) {
    const tbody = ensureSecurityVisitorTable();
    if (!tbody) return null;
    const normalizedVisitor = String(visitor || "").trim().toLowerCase();
    const normalizedFlat = String(flat || "").trim().toLowerCase();
    return [...tbody.querySelectorAll("tr")].find(row => {
        const cells = row.children;
        return cells[0]?.textContent.trim().toLowerCase() === normalizedVisitor
            && cells[2]?.textContent.trim().toLowerCase() === normalizedFlat;
    }) || null;
}

function upsertExpectedVisitorFromPass({ visitor, flat, validUntil }) {
    const tbody = ensureSecurityVisitorTable();
    if (!tbody || !visitor) return;
    const row = findVisitorRow(visitor, flat);
    const expectedTime = validUntil || "Pass approved";
    if (row) {
        const status = row.querySelector(".status");
        const action = row.querySelector("button");
        if (!status || !status.textContent.trim().toLowerCase().includes("inside")) {
            if (row.children[3]) row.children[3].textContent = expectedTime;
            if (row.children[4]) row.children[4].innerHTML = "<span class='status pending'>Expected</span>";
            if (row.children[5]) row.children[5].innerHTML = "<button data-action='checkin'>Check In</button>";
        } else if (action) {
            action.dataset.action = "checkout";
            action.textContent = "Check Out";
        }
        return;
    }
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
        <td>${escapeAttribute(visitor)}</td>
        <td>-</td>
        <td>${escapeAttribute(flat || "D-401")}</td>
        <td>${escapeAttribute(expectedTime)}</td>
        <td><span class="status pending">Expected</span></td>
        <td><button data-action="checkin">Check In</button></td>`;
    tbody.appendChild(newRow);
}

function syncApprovedPassesToVisitors() {
    if (dashboardRole !== "security") return;
    ensureSecurityVisitorTable();
    document.querySelectorAll('[data-table="passes"] tbody tr').forEach(row => {
        const cells = row.children;
        const status = cells[4]?.textContent.trim().toLowerCase() || "";
        if (!status.includes("approved")) return;
        upsertExpectedVisitorFromPass({
            visitor: cells[0]?.textContent.trim(),
            flat: cells[1]?.textContent.trim(),
            validUntil: cells[2]?.textContent.trim()
        });
    });
}

function setStatus(button, text, cls) {
    const status = button.closest("tr")?.querySelector(".status");
    if (!status) return;
    status.textContent = text;
    status.className = `status ${cls}`;
}

function updateRowAction(button, text, action, disabled = false) {
    if (!button?.matches?.("button")) return;
    button.textContent = text;
    button.dataset.action = action;
    button.disabled = disabled;
}

function openSubscriptionSubtab(name) {
    const panel = document.querySelector('[data-view="subscriptions"]');
    if (!panel) return;
    panel.querySelectorAll("[data-subtab]").forEach(button => {
        const active = button.dataset.subtab === name;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    panel.querySelectorAll("[data-subpanel]").forEach(section => {
        const shouldHide = section.dataset.subpanel !== name;
        section.classList.toggle("hidden", shouldHide);
        section.classList.toggle("d-none", shouldHide);
    });
}

function setInlineState(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
}

function appendDashboardActivity(message) {
    const log = document.getElementById("platformActivityLog") || document.getElementById("societyActivityLog");
    if (!log) return;
    const stamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const entry = document.createElement("li");
    entry.innerHTML = `<strong>${stamp}</strong><span>${escapeAttribute(message)}</span>`;
    const list = log.querySelector("ul");
    if (!list) return;
    list.prepend(entry);
    [...list.children].slice(5).forEach(item => item.remove());
}

function appendPlatformActivity(message) {
    if (dashboardRole !== "superadmin") return;
    appendDashboardActivity(message);
}

function residentInboxItems() {
    try {
        return JSON.parse(localStorage.getItem(residentAdminInboxKey) || "[]");
    } catch {
        localStorage.removeItem(residentAdminInboxKey);
        return [];
    }
}

function pushResidentInboxItem(item) {
    const items = residentInboxItems();
    items.unshift({
        id: `resident-${Date.now()}`,
        resident: "Kavya N",
        flat: "A-101",
        createdAt: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        status: "Pending Admin Review",
        ...item
    });
    localStorage.setItem(residentAdminInboxKey, JSON.stringify(items.slice(0, 25)));
}

function sharedComplaints() {
    try {
        return JSON.parse(localStorage.getItem("smartapartment-shared-complaints:v1") || "[]");
    } catch {
        return [];
    }
}

function persistSharedComplaint(values) {
    const title = values[0] || "Resident complaint";
    const category = values[1] || "Other";
    const subcategory = values[2] || "";
    const priority = values[3] || "NORMAL";
    const incidentAt = values[4] || "";
    const location = values[5] || "A-101";
    const contactMethod = values[6] || "IN_APP";
    const reporterPhone = values[7] || "";
    const staffEntry = values[8] || "No";
    const attachment = values[9] || "";
    const description = values[10] || "No extra details";
    const nowStr = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

    const newRecord = {
        id: `complaint-${Date.now()}`,
        title,
        category,
        subcategory,
        priority,
        incidentAt,
        location,
        contactMethod,
        reporterPhone,
        staffEntry,
        attachment,
        description,
        status: "Open",
        createdAt: nowStr,
        flat: "A-101",
        resident: "Kavya N"
    };

    const items = sharedComplaints();
    items.unshift(newRecord);
    localStorage.setItem("smartapartment-shared-complaints:v1", JSON.stringify(items.slice(0, 100)));
    renderSharedComplaintsToTables();
}

function renderSharedComplaintsToTables() {
    const items = sharedComplaints();
    if (!items.length) return;

    document.querySelectorAll('table[data-table="complaints"]').forEach(table => {
        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        items.forEach(item => {
            if (tbody.querySelector(`tr[data-record-id="${item.id}"]`)) return;
            const tr = document.createElement("tr");
            tr.dataset.recordId = item.id;

            if (dashboardRole === "resident") {
                tr.innerHTML = `<td><strong>${escapeAttribute(item.title)}</strong><br><small class="text-muted">${escapeAttribute(item.category)}</small></td>` +
                               `<td>${escapeAttribute(item.category)}</td>` +
                               `<td>${escapeAttribute(item.location)}</td>` +
                               `<td><span class="badge bg-${item.priority === "URGENT" || item.priority === "HIGH" ? "danger" : "info"}">${escapeAttribute(item.priority)}</span></td>` +
                               `<td><span class="badge bg-danger status open">${escapeAttribute(item.status)}</span></td>`;
            } else if (dashboardRole === "maintenance") {
                tr.innerHTML = `<td><strong>${escapeAttribute(item.title)}</strong><br><small class="text-muted">${escapeAttribute(item.resident)} · ${escapeAttribute(item.flat)}</small></td>` +
                               `<td>${escapeAttribute(item.location)}</td>` +
                               `<td><span class="badge bg-${item.priority === "URGENT" || item.priority === "HIGH" ? "danger" : "info"}">${escapeAttribute(item.priority)}</span></td>` +
                               `<td><span class="badge bg-danger status open">${escapeAttribute(item.status)}</span></td>` +
                               `<td><button class="btn btn-sm btn-primary" data-action="assign">Taken</button></td>`;
            } else {
                tr.innerHTML = `<td><strong>${escapeAttribute(item.title)}</strong><br><small class="text-muted">${escapeAttribute(item.description.substring(0, 45))}${item.description.length > 45 ? "..." : ""}</small></td>` +
                               `<td>${escapeAttribute(item.flat || item.location)}</td>` +
                               `<td>${escapeAttribute(item.category)}</td>` +
                               `<td><span class="badge bg-danger status open">${escapeAttribute(item.status)}</span></td>` +
                               `<td><button class="btn btn-sm btn-primary" data-action="assign">Assign</button> <button class="btn btn-sm btn-outline-danger" data-action="close">Close Ticket</button></td>`;
            }
            tbody.prepend(tr);
        });
    });
}

function residentPaymentProofs() {
    try {
        return JSON.parse(localStorage.getItem(residentPaymentProofsKey) || "[]");
    } catch {
        localStorage.removeItem(residentPaymentProofsKey);
        return [];
    }
}

function writeResidentPaymentProofs(items) {
    localStorage.setItem(residentPaymentProofsKey, JSON.stringify(items.slice(0, 80)));
}

function paymentProofKey(proof) {
    return `${proof.flat || "A-101"}|${proof.month || ""}|${proof.type || ""}`.toLowerCase();
}

function upsertResidentPaymentProof(proof) {
    const key = paymentProofKey(proof);
    const items = residentPaymentProofs().filter(item => paymentProofKey(item) !== key);
    writeResidentPaymentProofs([proof, ...items]);
}

function latestResidentPaymentProof(flat = "A-101", month = "June", type = "Maintenance") {
    const key = paymentProofKey({ flat, month, type });
    return residentPaymentProofs().find(item => paymentProofKey(item) === key);
}

function readFileAsDataUrl(file) {
    if (!file) return Promise.resolve("");
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

function renderResidentInboxForAdmins() {
    if (!["admin", "superadmin"].includes(dashboardRole)) return;
    const anchor = document.querySelector('[data-view="overview"] .activity-log')
        || document.querySelector('[data-view="monitoring"] .card')
        || document.querySelector('[data-view="overview"]');
    if (!anchor) return;
    document.getElementById("residentAdminInbox")?.remove();
    const items = residentInboxItems();
    const card = document.createElement("div");
    card.className = "card shadow-sm border-0 rounded-4 resident-inbox-card";
    card.id = "residentAdminInbox";
    card.innerHTML = `
        <div class="card-header bg-transparent border-0 pt-4 px-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div><span class="small text-primary fw-bold text-uppercase">Resident workspace</span><h4 class="fw-bold mb-1 mt-1">Resident Requests & Proofs</h4><p class="text-muted mb-0">New submissions from residents that may need an admin review.</p></div>
            <span class="badge ${items.length ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle" : "bg-success-subtle text-success-emphasis border border-success-subtle"} rounded-pill px-3 py-2">${items.length} pending</span>
        </div>
        ${items.length ? `<div class="card-body px-4 pb-4"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th>Type</th><th>Resident</th><th>Details</th><th>Status</th></tr></thead><tbody>${items.map(item => `
                <tr>
                    <td>${escapeAttribute(item.type || "Request")}</td>
                    <td>${escapeAttribute(item.resident || "Resident")}<br><small>${escapeAttribute(item.flat || "")}</small></td>
                    <td><strong>${escapeAttribute(item.title || item.method || "Resident update")}</strong><br><small>${escapeAttribute(item.details || item.proof || item.createdAt || "")}</small></td>
                    <td><span class="status pending">${escapeAttribute(item.status || "Pending")}</span></td>
                </tr>`).join("")}</tbody>
        </table></div></div>` : `<div class="card-body pt-2 pb-4 px-4"><div class="text-center text-muted py-4"><i class="fa-regular fa-circle-check text-success fs-4 d-block mb-2"></i><strong class="d-block text-dark mb-1">No requests waiting for review</strong><span class="small">Resident submissions and payment proofs will appear here when received.</span></div></div>`}`;
    const panel = anchor.closest("[data-view]");
    if (panel) {
        panel.appendChild(card);
    } else {
        anchor.insertAdjacentElement("afterend", card);
    }
}

function rowValues(button) {
    const row = button.closest("tr");
    if (!row) return [];
    return [...row.children].slice(0, -1).map(cell => cell.textContent.trim());
}

function updateRowFromValues(button, values) {
    const row = button.closest("tr");
    if (!row) return false;
    const cells = [...row.children];
    const editableCount = Math.max(cells.length - 2, 0);
    for (let index = 0; index < editableCount; index += 1) {
        if (values[index]) cells[index].textContent = values[index];
    }
    const statusValue = values[editableCount];
    if (statusValue && cells[editableCount]) {
        cells[editableCount].innerHTML = `<span class="status ${statusClass(statusValue)}">${statusValue}</span>`;
    }
    return true;
}

function updateVisitorStats(button) {
    const view = button.closest('[data-view="visitors"]');
    if (!view) return;
    const statuses = [...view.querySelectorAll("tbody .status")].map(status => status.textContent.trim().toLowerCase());
    const statValues = view.querySelectorAll(".compact-stats strong");
    if (statValues[0]) statValues[0].textContent = String(statuses.filter(status => status.includes("waiting")).length);
    if (statValues[1]) statValues[1].textContent = String(statuses.filter(status => status.includes("inside")).length);
    if (statValues[2]) statValues[2].textContent = String(statuses.filter(status => status.includes("checked out")).length);
}

function moneyNumber(value) {
    return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function formatRs(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function adminBillingRows() {
    return [
        { flat: "A-101", resident: "Kavya N", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "B-204", resident: "Meena Rao", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "C-303", resident: "Vijay P", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "D-401", resident: "Arun Kumar", type: "Maintenance", defaultStatus: "Unpaid" }
    ];
}

function billingRowData(row) {
    if (!row) return {};
    const cells = [...row.children].map(cell => cell.textContent.trim());
    return {
        flat: row.dataset.flat || cells[0] || "Flat",
        resident: row.dataset.resident || residentNameForFlat(cells[0]) || "Resident",
        month: row.dataset.month || cells[1] || currentMonthName(),
        type: row.dataset.type || "Maintenance",
        amount: row.dataset.amount || cells[2] || "Rs. 0",
        status: row.querySelector(".status")?.textContent.trim() || row.dataset.status || cells[3] || "Pending",
        paidAt: row.dataset.paidAt || "",
        paymentMethod: row.dataset.paymentMethod || "",
        paymentRef: row.dataset.paymentRef || "",
        proof: row.dataset.proof || ""
    };
}

function residentNameForFlat(flat) {
    const map = {
        "A-101": "Kavya N",
        "B-204": "Meena Rao",
        "C-303": "Vijay P",
        "D-401": "Arun Kumar",
        "A-305": "Resident A-305"
    };
    return map[flat] || "";
}

function applyBillingRowMetadata(row, data = {}) {
    if (!row) return;
    const merged = { ...billingRowData(row), ...data };
    row.dataset.flat = merged.flat;
    row.dataset.resident = merged.resident || residentNameForFlat(merged.flat);
    row.dataset.month = merged.month;
    row.dataset.type = merged.type || "Maintenance";
    row.dataset.amount = merged.amount;
    row.dataset.status = merged.status;
    if (merged.paidAt) row.dataset.paidAt = merged.paidAt;
    else delete row.dataset.paidAt;
    if (merged.paymentMethod) row.dataset.paymentMethod = merged.paymentMethod;
    else delete row.dataset.paymentMethod;
    if (merged.paymentRef) row.dataset.paymentRef = merged.paymentRef;
    else delete row.dataset.paymentRef;
    if (merged.proof) row.dataset.proof = merged.proof;
    else delete row.dataset.proof;
}

function ensureAdminBillingMetadata() {
    if (dashboardRole !== "admin") return;
    document.querySelectorAll('[data-table="billing"] tbody tr').forEach(row => {
        const data = billingRowData(row);
        applyBillingRowMetadata(row, {
            resident: data.resident || residentNameForFlat(data.flat),
            type: data.type || "Maintenance",
            paymentMethod: data.status.toLowerCase().includes("paid") ? (data.paymentMethod || "Recorded payment") : data.paymentMethod,
            paymentRef: data.status.toLowerCase().includes("paid") ? (data.paymentRef || `SA-${data.flat}-${data.month}`.replace(/\s+/g, "-")) : data.paymentRef,
            paidAt: data.status.toLowerCase().includes("paid") ? (data.paidAt || new Date().toLocaleDateString("en-IN")) : data.paidAt
        });
    });
}

function billingReceiptText(row) {
    const data = billingRowData(row);
    const receiptNo = `SA-${data.flat}-${data.month}-${data.paymentRef || "REC"}`.replace(/\s+/g, "-").toUpperCase();
    return [
        "SmartApartment Maintenance Receipt",
        `Receipt No: ${receiptNo}`,
        `Society: Green Nest Apartments`,
        `Flat: ${data.flat}`,
        `Resident: ${data.resident}`,
        `Bill Month: ${data.month}`,
        `Bill Type: ${data.type}`,
        `Amount Paid: ${data.amount}`,
        `Payment Status: ${data.status}`,
        `Payment Method: ${data.paymentMethod || "Not recorded"}`,
        `Payment Reference: ${data.paymentRef || "Not recorded"}`,
        `Payment Proof: ${data.proof || "Not attached"}`,
        `Paid / Recorded On: ${data.paidAt || "Not recorded"}`,
        `Generated: ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
    ].join("\n");
}

function showBillingReceipt(row) {
    const data = billingRowData(row);
    if (!data.status.toLowerCase().includes("paid")) {
        showToast("Receipt is available only after payment is marked paid");
        return {
            title: "Receipt unavailable",
            lines: [
                `<strong>Flat:</strong> ${data.flat}`,
                `<strong>Resident:</strong> ${data.resident}`,
                `<strong>Month:</strong> ${data.month}`,
                `<strong>Status:</strong> ${data.status}`
            ]
        };
    }
    const text = billingReceiptText(row);
    downloadText(`SmartApartment-${data.flat}-${data.month}-receipt.txt`.replace(/\s+/g, "-"), text);
    return {
        title: "Billing receipt",
        lines: [
            `<strong>Flat:</strong> ${data.flat}`,
            `<strong>Resident:</strong> ${data.resident}`,
            `<strong>Month:</strong> ${data.month}`,
            `<strong>Amount:</strong> ${data.amount}`,
            `<strong>Method:</strong> ${data.paymentMethod || "Recorded payment"}`,
            `<strong>Reference:</strong> ${data.paymentRef || "Not recorded"}`,
            `<strong>Proof:</strong> ${data.proof || "Not attached"}`,
            `<strong>Paid on:</strong> ${data.paidAt || "Not recorded"}`
        ]
    };
}

function findAdminBillingRow(flat, month, type = "Maintenance") {
    return [...document.querySelectorAll('[data-table="billing"] tbody tr')].find(row => {
        const data = billingRowData(row);
        return String(data.flat).toLowerCase() === String(flat).toLowerCase()
            && String(data.month).toLowerCase() === String(month).toLowerCase()
            && String(data.type || "Maintenance").toLowerCase() === String(type || "Maintenance").toLowerCase();
    });
}

function applyProofDecisionToResidentBill(proof) {
    if (dashboardRole !== "resident") return;
    const row = [...document.querySelectorAll('[data-table="billing"] tbody tr')].find(item => {
        const data = billDetailsFromButton(item.querySelector("[data-action]") || item);
        return String(data.month).toLowerCase() === String(proof.month).toLowerCase()
            && String(data.type).toLowerCase() === String(proof.type).toLowerCase();
    });
    if (!row) return;
    const status = row.querySelector(".status");
    const action = row.querySelector("[data-action]");
    if (!status || !action) return;
    if (proof.status === "Approved") {
        status.textContent = "Paid";
        status.className = "status paid";
        action.textContent = "Receipt";
        action.dataset.action = "receipt";
        action.disabled = false;
    } else if (proof.status === "Rejected") {
        status.textContent = "Unpaid";
        status.className = "status pending";
        action.textContent = "Pay Now";
        action.dataset.action = "pay";
        action.disabled = false;
    } else if (proof.status === "Pending Review") {
        status.textContent = "Pending Review";
        status.className = "status pending";
        action.textContent = "Awaiting Admin";
        action.dataset.action = "pay";
        action.disabled = true;
    }
}

function syncResidentBillingFromProofs() {
    if (dashboardRole !== "resident") return;
    document.querySelectorAll('[data-table="billing"] tbody tr').forEach(row => {
        const action = row.querySelector("[data-action]");
        if (!action) return;
        const bill = billDetailsFromButton(action);
        const proof = latestResidentPaymentProof("A-101", bill.month, bill.type);
        if (proof) {
            applyProofDecisionToResidentBill(proof);
            return;
        }
        const status = row.querySelector(".status");
        if (status?.textContent.trim().toLowerCase().includes("paid")) {
            status.textContent = "Unpaid";
            status.className = "status pending";
            action.textContent = "Pay Now";
            action.dataset.action = "pay";
            action.disabled = false;
        }
    });
}

function renderPaymentProofReviewForAdmins() {
    if (dashboardRole !== "admin") return;
    const review = document.getElementById("paymentProofReviewQueue");
    if (!review || review.dataset.rendered) return;
    const proofs = residentPaymentProofs();
    review.dataset.rendered = "true";
    if (!proofs.length) {
        review.innerHTML = `
            <div class="payment-proof-head"><h4>Payment Proof Review</h4><span class="inline-state">0 proofs</span></div>
            <div class="billing-proof-empty"><i class="fa-solid fa-receipt"></i><span>No resident payment proofs are waiting for review.</span></div>`;
        return;
    }
    review.innerHTML = `
        <div class="card-head payment-proof-head">
            <h4>Payment Proof Review</h4>
            <span class="inline-state">${proofs.length} proof${proofs.length === 1 ? "" : "s"}</span>
        </div>
        <table data-table="payment-proofs">
            <thead><tr><th>Resident</th><th>Bill</th><th>Screenshot</th><th>Status</th><th>Admin Review</th></tr></thead>
            <tbody>${proofs.length ? proofs.map(proof => `
                <tr data-proof-id="${escapeAttribute(proof.id)}">
                    <td>${escapeAttribute(proof.resident || "Resident")}<br><small>${escapeAttribute(proof.flat || "")}</small></td>
                    <td>${escapeAttribute(proof.month || "")} ${escapeAttribute(proof.type || "")}<br><small>${escapeAttribute(proof.amount || "")} | ${escapeAttribute(proof.method || "")}</small></td>
                    <td>${proof.proofImage ? `<a href="${proof.proofImage}" target="_blank" rel="noopener"><img src="${proof.proofImage}" alt="Payment screenshot" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid rgba(49,127,196,.25);"></a>` : escapeAttribute(proof.proofName || "No screenshot")}<br><small>${escapeAttribute(proof.proofName || "")}</small></td>
                    <td><span class="status ${proof.status === "Approved" ? "paid" : proof.status === "Rejected" ? "open" : "pending"}">${escapeAttribute(proof.status || "Pending Review")}</span><br><small>${escapeAttribute(proof.submittedAt || "")}</small></td>
                    <td><button data-action="approve-payment-proof">Approve Payment</button> <button data-action="reject-payment-proof">Reject Proof</button></td>
                </tr>`).join("") : '<tr><td colspan="5">No resident payment proofs yet</td></tr>'}</tbody>
        </table>`;
}

function syncAdminBillingFromPaymentProofs() {
    if (dashboardRole !== "admin") return;
    const a101Row = findAdminBillingRow("A-101", "June", "Maintenance");
    const a101Action = a101Row?.querySelector("[data-action]");
    const a101Proof = latestResidentPaymentProof("A-101", "June", "Maintenance");
    if (a101Row && a101Action && !a101Proof && billingRowData(a101Row).status.toLowerCase().includes("paid")) {
        setStatus(a101Action, "Unpaid", "pending");
        a101Action.textContent = "Mark Paid";
        a101Action.dataset.action = "pay";
        a101Action.disabled = false;
        applyBillingRowMetadata(a101Row, { ...billingRowData(a101Row), status: "Unpaid", paidAt: "", paymentMethod: "", paymentRef: "", proof: "" });
    }
    residentPaymentProofs().forEach(proof => {
        const row = findAdminBillingRow(proof.flat, proof.month, proof.type);
        const action = row?.querySelector("[data-action]");
        if (!row || !action) return;
        if (proof.status === "Approved") {
            setStatus(action, "Paid", "paid");
            action.textContent = "Receipt";
            action.dataset.action = "receipt";
            action.disabled = false;
            applyBillingRowMetadata(row, {
                ...billingRowData(row),
                status: "Paid",
                paidAt: proof.reviewedAt || proof.submittedAt,
                paymentMethod: proof.method,
                paymentRef: proof.paymentRef,
                proof: proof.proofName
            });
        } else if (proof.status === "Rejected") {
            setStatus(action, "Unpaid", "pending");
            action.textContent = "Mark Paid";
            action.dataset.action = "pay";
            action.disabled = false;
            applyBillingRowMetadata(row, { ...billingRowData(row), status: "Unpaid" });
        } else {
            setStatus(action, "Pending Review", "pending");
            action.textContent = "Review Proof";
            action.dataset.action = "pay";
            action.disabled = true;
            applyBillingRowMetadata(row, { ...billingRowData(row), status: "Pending Review", proof: proof.proofName });
        }
        updateBillingStats(action);
    });
}

function updatePaymentProofStatus(id, status, adminNote = "") {
    const items = residentPaymentProofs();
    const proof = items.find(item => item.id === id);
    if (!proof) return null;
    proof.status = status;
    proof.adminNote = adminNote;
    proof.reviewedAt = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    writeResidentPaymentProofs(items);
    return proof;
}

function handlePaymentProofReview(action, button, values = []) {
    const row = button.closest("[data-proof-id]");
    const proofId = row?.dataset.proofId;
    if (!proofId) return null;
    const approved = action === "approve-payment-proof";
    const proof = updatePaymentProofStatus(proofId, approved ? "Approved" : "Rejected", values[0] || "");
    if (!proof) return null;
    const status = row.querySelector(".status");
    if (status) {
        status.textContent = proof.status;
        status.className = `status ${approved ? "paid" : "open"}`;
    }
    const billingRow = findAdminBillingRow(proof.flat, proof.month, proof.type);
    const billAction = billingRow?.querySelector("[data-action]");
    if (billingRow && billAction) {
        if (approved) {
            setStatus(billAction, "Paid", "paid");
            billAction.textContent = "Receipt";
            billAction.dataset.action = "receipt";
            billAction.disabled = false;
            applyBillingRowMetadata(billingRow, {
                ...billingRowData(billingRow),
                status: "Paid",
                paidAt: proof.reviewedAt,
                paymentMethod: proof.method,
                paymentRef: proof.paymentRef,
                proof: proof.proofName
            });
            updateBillingStats(billAction);
        } else {
            setStatus(billAction, "Unpaid", "pending");
            billAction.textContent = "Mark Paid";
            billAction.dataset.action = "pay";
            billAction.disabled = false;
            applyBillingRowMetadata(billingRow, { ...billingRowData(billingRow), status: "Unpaid", proof: proof.proofName });
            updateBillingStats(billAction);
        }
    }
    row.querySelectorAll("button").forEach(actionButton => {
        actionButton.disabled = true;
        actionButton.textContent = approved ? "Approved" : "Rejected";
    });
    persistDashboardState();
    appendDashboardActivity(`${proof.status} payment proof for ${proof.flat} ${proof.month}`);
    return {
        title: approved ? "Payment approved" : "Payment proof rejected",
        lines: [
            `<strong>Flat:</strong> ${proof.flat}`,
            `<strong>Resident:</strong> ${proof.resident}`,
            `<strong>Bill:</strong> ${proof.month} ${proof.type}`,
            `<strong>Amount:</strong> ${proof.amount}`,
            `<strong>Proof:</strong> ${proof.proofName}`,
            `<strong>Status:</strong> ${proof.status}`,
            `<strong>Note:</strong> ${proof.adminNote || "No note"}`
        ]
    };
}

function generateMonthlyBillingRows({ month, amount, dueDate, note }) {
    const tbody = document.querySelector('[data-table="billing"] tbody');
    if (!tbody) return { created: 0, skipped: 0 };
    let created = 0;
    let skipped = 0;
    adminBillingRows().forEach(item => {
        const existing = [...tbody.querySelectorAll("tr")].find(row => {
            const data = billingRowData(row);
            return data.flat === item.flat && data.month === month;
        });
        if (existing) {
            skipped += 1;
            return;
        }
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeAttribute(item.flat)}</td>
            <td>${escapeAttribute(month)}</td>
            <td>${escapeAttribute(amount)}</td>
            <td><span class="status pending">Unpaid</span></td>
            <td><button data-action="pay">Mark Paid</button></td>`;
        applyBillingRowMetadata(row, {
            flat: item.flat,
            resident: item.resident,
            type: item.type,
            month,
            amount,
            status: "Unpaid",
            paidAt: "",
            paymentMethod: "",
            paymentRef: "",
            proof: note ? `Due ${dueDate || "not set"} - ${note}` : `Due ${dueDate || "not set"}`
        });
        tbody.appendChild(row);
        created += 1;
    });
    updateBillingStats(tbody);
    return { created, skipped };
}

function controlQueueRowData(button) {
    const row = button?.closest?.('[data-view="control"] table tbody tr');
    if (!row) return null;
    const cells = row.children;
    return {
        row,
        request: cells[0]?.textContent.trim() || "Request",
        module: cells[1]?.textContent.trim() || "Module",
        detail: cells[2]?.textContent.trim() || "",
        status: row.querySelector(".status")?.textContent.trim() || cells[3]?.textContent.trim() || ""
    };
}

function setControlQueueStatus(button, status, cls, actionText, action = button?.dataset.action, disabled = true) {
    setStatus(button, status, cls);
    updateRowAction(button, actionText, action, disabled);
}

function findTableRow(tableName, predicate) {
    const tbody = document.querySelector(`[data-table="${tableName}"] tbody`);
    if (!tbody) return null;
    return [...tbody.querySelectorAll("tr")].find(predicate) || null;
}

function updateResidentQueueRecord({ name, flat, role, status }) {
    const tbody = document.querySelector('[data-table="residents"] tbody');
    if (!tbody) return;
    let row = findTableRow("residents", item =>
        item.children[0]?.textContent.trim().toLowerCase() === name.toLowerCase()
        || item.children[1]?.textContent.trim().toLowerCase() === flat.toLowerCase()
    );
    if (!row) {
        row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeAttribute(name)}</td>
            <td>${escapeAttribute(flat)}</td>
            <td>${escapeAttribute(role)}</td>
            <td><span class="status ${statusClass(status)}">${escapeAttribute(status)}</span></td>
            <td><button data-action="notify">Notify</button></td>`;
        tbody.appendChild(row);
        return;
    }
    row.children[0].textContent = name;
    row.children[1].textContent = flat;
    row.children[2].textContent = role;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="notify">Notify</button>';
}

function updateComplaintQueueRecord({ issue, flat, team, status }) {
    const row = findTableRow("complaints", item =>
        item.children[0]?.textContent.trim().toLowerCase().includes(issue.toLowerCase())
        && item.children[1]?.textContent.trim().toLowerCase() === flat.toLowerCase()
    );
    if (!row) {
        addRow("complaints", [
            issue,
            flat,
            team,
            `<span class='status ${statusClass(status)}'>${escapeAttribute(status)}</span>`,
            "<button data-action='close'>Close</button>"
        ]);
        return;
    }
    row.children[2].textContent = team;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="close">Close</button>';
}

function updateExpenseQueueRecord({ expense, vendor, amount, status }) {
    const row = findTableRow("expenses", item =>
        item.children[0]?.textContent.trim().toLowerCase().includes(expense.toLowerCase())
    );
    if (!row) {
        addRow("expenses", [
            expense,
            vendor,
            amount,
            `<span class='status ${statusClass(status)}'>${escapeAttribute(status)}</span>`,
            "<button data-action='approve' disabled>Approved</button>"
        ]);
        return;
    }
    row.children[1].textContent = vendor;
    row.children[2].textContent = amount;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="approve" disabled>Approved</button>';
}

function updateAmenityQueueRecord({ amenity, status, note }) {
    const card = [...document.querySelectorAll('[data-view="amenities"] .card')].find(item =>
        item.querySelector("h3")?.textContent.trim().toLowerCase() === amenity.toLowerCase()
    );
    if (!card) return;
    const badge = card.querySelector(".status");
    if (badge) {
        badge.textContent = status;
        badge.className = `status ${statusClass(status)}`;
    }
    const copy = card.querySelector("p");
    if (copy) copy.textContent = note;
    const button = card.querySelector("button");
    updateRowAction(button, status, "approve", true);
}

function findOrCreateBillingRowForFlat(flat, month, amount) {
    const tbody = document.querySelector('[data-table="billing"] tbody');
    if (!tbody) return null;
    let row = findTableRow("billing", item => {
        const data = billingRowData(item);
        return data.flat === flat && data.month === month;
    });
    if (row) return row;
    row = document.createElement("tr");
    row.innerHTML = `
        <td>${escapeAttribute(flat)}</td>
        <td>${escapeAttribute(month)}</td>
        <td>${escapeAttribute(amount)}</td>
        <td><span class="status pending">Unpaid</span></td>
        <td><button data-action="pay">Mark Paid</button></td>`;
    tbody.appendChild(row);
    applyBillingRowMetadata(row, {
        flat,
        resident: residentNameForFlat(flat),
        month,
        amount,
        status: "Unpaid"
    });
    return row;
}

function actionQueueRows() {
    return [...document.querySelectorAll('[data-view="control"] table tbody tr')]
        .filter(row => row.children.length >= 5)
        .map(row => ({
            request: row.children[0]?.textContent.trim() || "",
            module: row.children[1]?.textContent.trim() || "",
            detail: row.children[2]?.textContent.trim() || "",
            status: row.querySelector(".status")?.textContent.trim() || row.children[3]?.textContent.trim() || "",
            action: row.children[4]?.textContent.trim() || ""
        }));
}

function exportControlQueue(values = []) {
    const period = values[0] || currentMonthName();
    const owner = values[1] || "Society Admin";
    const note = values[2] || "Operational queue export";
    const rows = actionQueueRows();
    const text = [
        "SmartApartment Admin Action Queue",
        `Society: Green Nest Apartments`,
        `Period: ${period}`,
        `Prepared by: ${owner}`,
        `Note: ${note}`,
        `Generated: ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`,
        "",
        ...rows.map((row, index) => `${index + 1}. ${row.request} | ${row.module} | ${row.detail} | Status: ${row.status} | Action: ${row.action}`)
    ].join("\n");
    downloadText("SmartApartment-admin-action-queue.txt", text);
    appendDashboardActivity(`Action queue exported for ${period}`);
    return {
        title: "Action queue exported",
        lines: [
            `<strong>Period:</strong> ${period}`,
            `<strong>Prepared by:</strong> ${owner}`,
            `<strong>Items:</strong> ${rows.length}`,
            `<strong>Pending:</strong> ${rows.filter(row => /pending|open|waiting|unpaid/i.test(row.status)).length}`,
            `<strong>File:</strong> SmartApartment-admin-action-queue.txt`
        ]
    };
}

function performControlQueueAction(action, button, values = []) {
    const queue = controlQueueRowData(button);
    if (!queue) return null;
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    if (queue.module === "Residents" && action === "approve") {
        const name = values[0] || "Vijay P";
        const flat = values[1] || "C-303";
        const role = values[2] || "Tenant";
        const kycRef = values[3] || "KYC verified";
        const accessStart = values[4] || "Today";
        const note = values[5] || "Tenant access approved";
        updateResidentQueueRecord({ name, flat, role, status: "Active" });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Resident KYC approved: ${name}, ${flat}`);
        return {
            title: "Resident access approved",
            lines: [
                `<strong>Resident:</strong> ${name}`,
                `<strong>Flat:</strong> ${flat}`,
                `<strong>Role:</strong> ${role}`,
                `<strong>KYC reference:</strong> ${kycRef}`,
                `<strong>Access starts:</strong> ${accessStart}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Complaints" && action === "assign") {
        const team = values[0] || "Plumbing";
        const technician = values[1] || "Maintenance Team";
        const priority = values[2] || "High";
        const due = values[3] || "Today";
        const note = values[4] || "A-101 requires plumber assignment";
        updateComplaintQueueRecord({ issue: "Water leakage", flat: "A-101", team, status: "In Progress" });
        setControlQueueStatus(button, "Assigned", "progress", "Assigned", "assign", true);
        appendDashboardActivity(`Complaint assigned: Water leakage to ${technician}`);
        return {
            title: "Complaint assigned",
            lines: [
                `<strong>Issue:</strong> Water leakage`,
                `<strong>Flat:</strong> A-101`,
                `<strong>Team:</strong> ${team}`,
                `<strong>Technician:</strong> ${technician}`,
                `<strong>Priority:</strong> ${priority}`,
                `<strong>SLA due:</strong> ${due}`,
                `<strong>Work note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Amenities" && action === "approve") {
        const amenity = values[0] || "Guest Room";
        const resident = values[1] || "Resident bookings";
        const slot = values[2] || "Next available slot";
        const charges = values[3] || "As per society rules";
        const note = values[4] || "2 bookings approved";
        updateAmenityQueueRecord({ amenity, status: "Approved", note: `${resident} - ${slot} - ${charges}` });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Amenity booking approved: ${amenity}`);
        return {
            title: "Amenity bookings approved",
            lines: [
                `<strong>Amenity:</strong> ${amenity}`,
                `<strong>Resident / booking:</strong> ${resident}`,
                `<strong>Slot:</strong> ${slot}`,
                `<strong>Charges:</strong> ${charges}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Expenses" && action === "approve") {
        const vendor = values[0] || "PowerCare";
        const invoice = values[1] || "PowerCare invoice";
        const amount = values[2] || "Rs. 18,000";
        const paymentMode = values[3] || "Bank transfer";
        const note = values[4] || "Generator service approved";
        updateExpenseQueueRecord({ expense: "Generator service", vendor, amount, status: "Approved" });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Expense approved: ${vendor} ${amount}`);
        return {
            title: "Expense approved",
            lines: [
                `<strong>Expense:</strong> Generator service`,
                `<strong>Vendor:</strong> ${vendor}`,
                `<strong>Invoice:</strong> ${invoice}`,
                `<strong>Amount:</strong> ${amount}`,
                `<strong>Payment mode:</strong> ${paymentMode}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Billing" && action === "pay") {
        const method = values[0] || "Manual verification";
        const ref = values[1] || "B204-JUNE-PAID";
        const paidAt = values[2] || new Date().toLocaleDateString("en-IN");
        const proof = values[3] || "Admin verified";
        const note = values[4] || "June maintenance dues cleared";
        const row = findOrCreateBillingRowForFlat("B-204", "June", "Rs. 2,500");
        if (row) {
            const billButton = row.querySelector("button");
            if (billButton) {
                setStatus(billButton, "Paid", "paid");
                billButton.textContent = "Receipt";
                billButton.dataset.action = "receipt";
            } else {
                row.children[3].innerHTML = '<span class="status paid">Paid</span>';
            }
            applyBillingRowMetadata(row, {
                flat: "B-204",
                resident: residentNameForFlat("B-204"),
                month: "June",
                amount: "Rs. 2,500",
                status: "Paid",
                paidAt,
                paymentMethod: method,
                paymentRef: ref,
                proof: `${proof}${note ? ` - ${note}` : ""}`
            });
            updateBillingStats(row);
        }
        setControlQueueStatus(button, "Paid", "paid", "Receipt", "receipt", false);
        appendDashboardActivity(`Billing marked paid: B-204 June ${ref}`);
        return row ? showBillingReceipt(row) : {
            title: "Bill marked paid",
            lines: [
                `<strong>Flat:</strong> B-204`,
                `<strong>Month:</strong> June`,
                `<strong>Amount:</strong> Rs. 2,500`,
                `<strong>Reference:</strong> ${ref}`
            ]
        };
    }
    if (queue.module === "Billing" && action === "receipt") {
        const row = findOrCreateBillingRowForFlat("B-204", "June", "Rs. 2,500");
        return showBillingReceipt(row);
    }
    return null;
}

function updateBillingStats(scope = document) {
    const view = scope.closest?.('[data-view="billing"]') || document.querySelector('[data-view="billing"]');
    if (!view) return;
    const rows = [...view.querySelectorAll('[data-table="billing"] tbody tr')];
    const totals = rows.reduce((sum, row) => {
        const amount = moneyNumber(row.children[2]?.textContent);
        const status = row.querySelector(".status")?.textContent.toLowerCase() || "";
        sum.total += amount;
        if (status.includes("paid")) sum.collected += amount;
        else sum.pending += amount;
        return sum;
    }, { total: 0, collected: 0, pending: 0 });
    const statValues = view.querySelectorAll(".billing-stats strong");
    if (statValues[0]) statValues[0].textContent = formatRs(totals.total);
    if (statValues[1]) statValues[1].textContent = formatRs(totals.collected);
    if (statValues[2]) statValues[2].textContent = formatRs(totals.pending);
}

function ensureResidentPortal() {
    if (dashboardRole !== "resident") return;
    document.querySelectorAll('[data-view="overview"] .pill-row span').forEach(chip => {
        if (chip.textContent.trim().toLowerCase().includes("visitor")) {
            chip.textContent = "Visitor request";
        }
    });
    const overviewCopy = document.querySelector('[data-view="overview"] .card p');
    if (overviewCopy) {
        overviewCopy.textContent = "Residents can pay bills, submit visitor requests to security, raise complaints, request amenities, read announcements, and update profile details.";
    }
}

function billDetailsFromButton(button) {
    const row = button.closest("tr");
    const cells = row ? [...row.children].map(cell => cell.textContent.trim()) : [];
    return {
        row,
        flat: dashboardRole === "resident" ? "A-101" : (row?.children?.[0]?.textContent.trim() || "A-101"),
        month: cells[0] || currentMonthName(),
        type: cells[1] || "Maintenance",
        amount: cells[2] || "Rs. 2,500",
        status: cells[3] || "Unpaid"
    };
}

function paymentUriFor(method, bill) {
    const amount = String(bill.amount || "").replace(/[^\d.]/g, "") || "2500";
    const note = `${bill.type} ${bill.month} Flat A-101`;
    return `upi://pay?pa=smartapartment@upi&pn=SmartApartment&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note)}&mode=02&purpose=00&mc=0000&tr=SA${Date.now()}`;
}

function paymentMethodLabel(method) {
    const labels = {
        gpay: "Google Pay",
        upi: "UPI",
        paytm: "Paytm",
        phonepe: "PhonePe"
    };
    return labels[method] || "UPI";
}

function openResidentPaymentModal(button) {
    const modal = ensureActionModal();
    const bill = billDetailsFromButton(button);
    activePaymentProof = null;
    activeAction = { action: "resident-pay", button };
    modal.querySelector("#dashboardActionTitle").textContent = "Choose Payment App";
    modal.querySelector("#dashboardActionText").innerHTML = `
        <div class="payment-summary-card">
            <div class="payment-summary-left">
                <span class="payment-bill-badge"><i class="fa-solid fa-receipt me-1"></i> Maintenance Bill</span>
                <div class="payment-bill-title">${escapeAttribute(bill.month)} · ${escapeAttribute(bill.type)}</div>
            </div>
            <div class="payment-summary-right">
                <small class="payment-amount-label">Total Payable</small>
                <div class="payment-amount-val">${escapeAttribute(bill.amount)}</div>
            </div>
        </div>`;
    modal.querySelector("#dashboardActionFields").innerHTML = `
        <div class="payment-apps-grid">
            <button type="button" class="payment-app-card gpay-card" data-payment-method="gpay">
                <div class="payment-app-icon gpay-bg">
                    <i class="fa-brands fa-google"></i>
                </div>
                <div class="payment-app-details">
                    <span class="payment-app-title">Google Pay</span>
                    <span class="payment-app-sub">Pay via GPay UPI</span>
                </div>
                <div class="payment-app-arrow">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </button>
            <button type="button" class="payment-app-card phonepe-card" data-payment-method="phonepe">
                <div class="payment-app-icon phonepe-bg">
                    <i class="fa-solid fa-mobile-screen-button"></i>
                </div>
                <div class="payment-app-details">
                    <span class="payment-app-title">PhonePe</span>
                    <span class="payment-app-sub">Instant UPI Pay</span>
                </div>
                <div class="payment-app-arrow">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </button>
            <button type="button" class="payment-app-card paytm-card" data-payment-method="paytm">
                <div class="payment-app-icon paytm-bg">
                    <i class="fa-solid fa-wallet"></i>
                </div>
                <div class="payment-app-details">
                    <span class="payment-app-title">Paytm UPI</span>
                    <span class="payment-app-sub">Wallet & Bank UPI</span>
                </div>
                <div class="payment-app-arrow">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </button>
            <button type="button" class="payment-app-card upi-card" data-payment-method="upi">
                <div class="payment-app-icon upi-bg">
                    <i class="fa-solid fa-qrcode"></i>
                </div>
                <div class="payment-app-details">
                    <span class="payment-app-title">Any UPI / QR</span>
                    <span class="payment-app-sub">BHIM / CRED / Others</span>
                </div>
                <div class="payment-app-arrow">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </button>
        </div>`;
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Cancel Payment";
    save.className = "payment-cancel-btn full";
    save.disabled = false;
    save.onclick = closeActionModal;
    modal.querySelectorAll("[data-payment-method]").forEach(methodButton => {
        methodButton.addEventListener("click", () => openResidentQrPayment(button, methodButton.dataset.paymentMethod));
    });
    modal.classList.remove("hidden");
}

function openResidentQrPayment(button, method) {
    const modal = ensureActionModal();
    const bill = billDetailsFromButton(button);
    const methodName = paymentMethodLabel(method);
    const upiLink = paymentUriFor(method, bill);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(upiLink)}`;
    modal.querySelector("#dashboardActionTitle").textContent = `${methodName} Payment`;
    modal.querySelector("#dashboardActionText").innerHTML = `
        <div class="payment-summary-card">
            <div class="payment-summary-left">
                <span class="payment-bill-badge"><i class="fa-solid fa-shield-halved me-1"></i> Verified Payee</span>
                <div class="payment-bill-title">SmartApartment - Flat A-101</div>
            </div>
            <div class="payment-summary-right">
                <small class="payment-amount-label">Amount</small>
                <div class="payment-amount-val">${escapeAttribute(bill.amount)}</div>
            </div>
        </div>`;
    modal.querySelector("#dashboardActionFields").innerHTML = `
        <div class="payment-qr-wrapper">
            <div class="payment-qr-image-container">
                <img src="${qrUrl}" alt="${methodName} QR code for ${escapeAttribute(bill.amount)}" class="payment-qr-img">
                <span class="payment-qr-hint"><i class="fa-solid fa-camera me-1"></i> Scan with ${methodName}</span>
            </div>
            <div class="payment-qr-instructions">
                <div class="payment-upi-details">
                    <span class="payment-upi-label">UPI ID</span>
                    <strong class="payment-upi-id">smartapartment@upi</strong>
                </div>
                <a class="payment-direct-app-btn" href="${upiLink}">
                    <i class="fa-solid fa-arrow-up-right-from-square me-2"></i> Open ${methodName} App
                </a>
                <div class="payment-upload-zone">
                    <label for="paymentProofUpload" class="payment-upload-label">
                        <i class="fa-solid fa-cloud-arrow-up me-2"></i>
                        <span>Upload Payment Screenshot</span>
                        <input type="file" id="paymentProofUpload" accept="image/*" class="d-none">
                    </label>
                    <div id="paymentProofState" class="payment-proof-status">
                        <i class="fa-solid fa-circle-info me-1"></i> Screenshot required before confirming payment
                    </div>
                </div>
            </div>
        </div>`;
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Confirm Payment";
    save.className = "primary full";
    save.disabled = true;
    save.onclick = () => confirmResidentPayment(button, methodName);
    const proofInput = modal.querySelector("#paymentProofUpload");
    proofInput?.addEventListener("change", () => {
        const file = proofInput.files?.[0];
        activePaymentProof = file ? { name: file.name, size: file.size, method: methodName, file } : null;
        const state = modal.querySelector("#paymentProofState");
        if (state) {
            if (file) {
                state.className = "payment-proof-status success";
                state.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i> Attached: <strong>${escapeAttribute(file.name)}</strong>`;
            } else {
                state.className = "payment-proof-status";
                state.innerHTML = `<i class="fa-solid fa-circle-info me-1"></i> Screenshot required before confirming payment`;
            }
        }
        save.disabled = !file;
    });
}

async function confirmResidentPayment(button, methodName) {
    if (!activePaymentProof?.name) {
        showToast("Upload payment screenshot first");
        return;
    }
    const bill = billDetailsFromButton(button);
    const screenshotDataUrl = await readFileAsDataUrl(activePaymentProof.file);
    const proof = {
        id: `proof-${Date.now()}`,
        flat: "A-101",
        resident: "Kavya N",
        month: bill.month,
        type: bill.type,
        amount: bill.amount,
        method: methodName,
        proofName: activePaymentProof.name,
        proofSize: activePaymentProof.size,
        proofImage: screenshotDataUrl,
        status: "Pending Review",
        submittedAt: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        paymentRef: `SA-A-101-${bill.month}-${Date.now()}`.replace(/\s+/g, "-")
    };
    upsertResidentPaymentProof(proof);
    setStatus(button, "Pending Review", "pending");
    button.textContent = "Awaiting Admin";
    button.dataset.action = "pay";
    button.disabled = true;
    updateBillingStats(button);
    pushResidentInboxItem({
        type: "Payment Proof",
        title: `${bill.month} ${bill.type} - ${bill.amount}`,
        method: methodName,
        proof: activePaymentProof.name,
        details: `${methodName} screenshot uploaded: ${activePaymentProof.name}. Waiting for admin approval.`
    });
    persistDashboardState();
    showActionReceipt({
        title: "Payment proof submitted",
        lines: [
            `<strong>Result:</strong> Sent to admin for review`,
            `<strong>Bill:</strong> ${bill.month} ${bill.type}`,
            `<strong>Amount:</strong> ${bill.amount}`,
            `<strong>Proof:</strong> ${activePaymentProof.name}`,
            `<strong>UPI:</strong> smartapartment@upi`,
            `<strong>Status:</strong> Unpaid until admin accepts the screenshot`,
            `<strong>Time:</strong> ${proof.submittedAt}`
        ]
    });
    activePaymentProof = null;
}

function ensureMaintenanceTables() {
    if (dashboardRole !== "maintenance") return;
    const complaintTable = document.querySelector('[data-view="complaints"] table');
    if (complaintTable) complaintTable.dataset.table = "maintenance-complaints";
    const header = document.querySelector(".header");
    document.getElementById("maintenanceAvailabilityState")?.remove();
    if (header && !header.querySelector('[data-action="rest"]')) {
        const actions = header.querySelector(".header-actions") || header;
        actions.insertAdjacentHTML("beforeend", '<button data-action="rest">Take Rest</button>');
    }
}

function maintenanceTaskExists(task, location) {
    const tbody = document.querySelector('[data-table="tasks"] tbody');
    if (!tbody) return false;
    const normalizedTask = String(task || "").trim().toLowerCase();
    const normalizedLocation = String(location || "").trim().toLowerCase();
    return [...tbody.querySelectorAll("tr")].some(row => {
        const cells = row.children;
        return cells[0]?.textContent.trim().toLowerCase().includes(normalizedTask)
            && cells[1]?.textContent.trim().toLowerCase() === normalizedLocation;
    });
}

function addMaintenanceTask({ task, location, priority, status = "Pending", note = "" }) {
    const tbody = document.querySelector('[data-table="tasks"] tbody');
    if (!tbody || !task) return false;
    if (maintenanceTaskExists(task, location)) return false;
    const row = document.createElement("tr");
    const cleanTask = escapeAttribute(task);
    const cleanNote = note ? `<small>${escapeAttribute(note)}</small>` : "";
    row.innerHTML = `
        <td><strong>${cleanTask}</strong>${cleanNote}</td>
        <td>${escapeAttribute(location || "Common Area")}</td>
        <td>${escapeAttribute(priority || "Medium")}</td>
        <td><span class="status ${statusClass(status)}">${escapeAttribute(status)}</span></td>
        <td><button data-action="complete">Complete</button></td>`;
    tbody.appendChild(row);
    return true;
}

function addResidentComplaint(values) {
    const tbody = document.querySelector('[data-table="complaints"] tbody');
    if (!tbody) return;
    const issue = values[0] || "Resident complaint";
    const category = values[1] || "General";
    const location = values[2] || "Flat A-101";
    const urgency = values[3] || "Normal";
    const description = values[4] || "No extra details";
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><strong>${escapeAttribute(issue)}</strong><small>${escapeAttribute(location)} - ${escapeAttribute(description)}</small></td>
        <td>${escapeAttribute(category)} / ${escapeAttribute(urgency)}</td>
        <td><span class="status open">Open</span></td>
        <td><button data-action="close">Close</button></td>`;
    tbody.prepend(row);
}

function updateResidentAmenityBooking(button, values) {
    const card = button.closest(".card");
    if (!card) return;
    const amenity = button.dataset.amenityName || card.querySelector("h3, h4")?.textContent.trim() || "Amenity";
    const date = values[0] || "Today";
    const time = [values[1], values[2]].filter(Boolean).join(" - ") || "Preferred slot";
    const guests = values[3] ? `${values[3]} guest(s)` : "Resident";
    const purpose = values[5] || "Personal use";
    let details = card.querySelector(".amenity-booking-details");
    if (!details) {
        details = document.createElement("div");
        details.className = "amenity-booking-details";
        card.appendChild(details);
    }
    details.innerHTML = `
        <span class="status pending">Approval Pending</span>
        <p><strong>${escapeAttribute(date)} - ${escapeAttribute(time)}</strong></p>
        <p>${escapeAttribute(guests)} | ${escapeAttribute(purpose)}</p>`;
    updateRowAction(button, "Requested", "book", true);
    return { amenity, date, time, guests, purpose };
}

function residentAmenityForButton(button) {
    const requested = String(button.dataset.amenityName || "").toLowerCase();
    const aliases = requested.includes("gym") ? ["gym", "fitness"]
        : requested.includes("clubhouse") ? ["clubhouse", "party", "hall"]
        : requested.includes("parking") ? ["parking"] : [requested];
    return (window.societyAmenities || []).find(item => {
        const name = String(item.name || "").toLowerCase();
        return aliases.some(alias => alias && name.includes(alias));
    });
}

async function submitResidentAmenityBooking(button, values) {
    const [date, start, end, guests, vehicles, purpose, contactNumber, specialInstructions] = values;
    const amenity = residentAmenityForButton(button);
    if (!amenity) throw new Error("This amenity is not configured by the society admin");
    if (!date || !start || !end || !purpose || !contactNumber) {
        throw new Error("Enter the date, start time, end time, purpose and contact number");
    }
    const result = await mutateSociety("society/bookings", "POST", {
        amenityId: Number(amenity.id),
        startTime: `${date}T${start}`,
        endTime: `${date}T${end}`,
        expectedGuests: Number(guests || 0),
        vehicleCount: Number(vehicles || 0),
        eventPurpose: purpose,
        contactNumber,
        specialInstructions: specialInstructions || ""
    });
    const display = updateResidentAmenityBooking(button, values);
    pushResidentInboxItem({
        type: "Amenity Request",
        title: result.amenity || display?.amenity || amenity.name,
        details: `${display?.date || date} ${display?.time || `${start} - ${end}`} | ${display?.guests || guests} | ${purpose}`
    });
    await loadSocietyBackendData();
    showToast(`✓ ${result.amenity || amenity.name} request sent to admin`);
    return {
        title: "Amenity request submitted",
        lines: [
            `<strong>Amenity:</strong> ${result.amenity || amenity.name}`,
            `<strong>Slot:</strong> ${date} ${start} - ${end}`,
            `<strong>Details:</strong> ${guests || 0} guests · ${vehicles || 0} vehicles · ${purpose}`,
            `<strong>Contact:</strong> ${contactNumber}`,
            `<strong>Status:</strong> ${result.approvalStatus || "PENDING"} — visible to Society Admin`
        ]
    };
}

function statusClass(value) {
    const text = String(value).toLowerCase();
    if (text.includes("paid")) return "paid";
    if (text.includes("occup") || text.includes("active") || text.includes("live")) return "active";
    if (text.includes("approve")) return "approved";
    if (text.includes("closed") || text.includes("resolve")) return "resolved";
    if (text.includes("progress") || text.includes("inside")) return "progress";
    if (text.includes("open")) return "open";
    return "pending";
}

function ensureActionModal() {
    let modal = document.getElementById("dashboardActionModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "dashboardActionModal";
    // Do not use Bootstrap's generic .modal class here. Bootstrap hides it until
    // its own controller is invoked, while this dashboard uses a lightweight
    // native dialog controller.
    modal.className = "dashboard-action-dialog hidden";
    modal.innerHTML = `
        <div class="modal-card dashboard-action-card">
            <button class="close" type="button" data-modal-close aria-label="Close">×</button>
            <h2 id="dashboardActionTitle">Complete action</h2>
            <p id="dashboardActionText"></p>
            <div class="form-grid" id="dashboardActionFields"></div>
            <button class="primary full" type="button" id="dashboardActionSave">Confirm</button>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-modal-close]").addEventListener("click", closeActionModal);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeActionModal();
    });
    
    const saveBtn = modal.querySelector("#dashboardActionSave");
    saveBtn.removeEventListener("click", submitActionModal);
    saveBtn.addEventListener("click", submitActionModal);
    return modal;
}

function actionConfig(action, button) {
    const panel = button.closest("[data-view]")?.dataset.view || "overview";
    const context = getContext(button);
    const table = button.dataset.table;
    const label = buttonLabel(button).toLowerCase();
    const queue = dashboardRole === "admin" ? controlQueueRowData(button) : null;
    if (dashboardRole === "admin" && action === "amenity-booking") {
        return ["Add Detailed Amenity Booking", "Record the complete reservation, event, attendance, setup, access, payment and compliance details.", ["Amenity", "Booked by / flat", "Start date & time", "End date & time", "Event type|select:BIRTHDAY,MEETING,CELEBRATION,SPORTS,RELIGIOUS EVENT,COMMUNITY EVENT,OTHER", "Event purpose / description", "Expected guests|number", "Children attending|number", "Vehicles expected|number", "Organizer name", "Organizer mobile|tel", "Organizer email|email", "Seating / setup style|select:STANDARD,THEATRE,CLASSROOM,ROUND TABLE,OPEN FLOOR,CUSTOM", "Equipment required", "Catering details", "Decoration details", "Accessibility requirements", "Vehicle numbers / parking instructions", "Payment method|select:ONLINE,CASH,BANK TRANSFER,UPI", "Payment reference", "Security deposit (Rs.)|number", "Deposit status|select:NOT REQUIRED,PENDING,RECEIVED,WAIVED", "Emergency contact|tel", "Terms accepted|select:Yes,No", "Special instructions / cleanup notes|textarea"]];
    }
    if (dashboardRole === "admin" && action === "amenity-price-edit") {
        return ["Edit Amenity Price", `Update the price and approval setting for ${button.dataset.amenityName || "this amenity"}.`, ["Amenity name", "Capacity|number", "Booking price (Rs.)|number", "Approval required|select:Yes,No"]];
    }
    if (action === "save" && label.includes("sync")) {
        return ["Sync Society Data", "Confirm syncing residents, billing, visitors and complaint records for this society.", ["Sync note"]];
    }
    if (action === "save" && panel === "profile") {
        return ["Save Profile", "Confirm and permanently save your resident profile details on this browser.", []];
    }
    if (dashboardRole === "resident" && action === "notify") {
        return ["Contact Admin", "Send a complete, traceable message to the society admin team.", ["Subject", "Category|select:BILLING,COMPLAINT,AMENITY,VISITOR,PROFILE,SAFETY,OTHER", "Priority|select:NORMAL,HIGH,URGENT", "Related flat / reference", "Preferred contact method|select:IN_APP,PHONE,EMAIL,WHATSAPP", "Contact number|tel", "Preferred callback date & time|datetime-local", "Attachment / screenshot reference", "Detailed message|textarea"]];
    }
    if (dashboardRole === "maintenance" && action === "save" && label.includes("availability")) {
        return ["Update Availability", "Share complete shift, location, workload and escalation coverage before receiving assignments.", ["Availability status|select:AVAILABLE,BUSY,ON_BREAK,OFF_DUTY,ON_CALL", "Current work zone", "Shift start|datetime-local", "Available until|datetime-local", "Active task count|number", "Skills available", "Emergency response available|select:Yes,No", "Backup teammate", "Supervisor note|textarea"]];
    }
    if (dashboardRole === "maintenance" && action === "rest") {
        return ["Take Rest", "Set a controlled rest window and hand over active responsibilities before pausing assignments.", ["Rest start|datetime-local", "Rest until|datetime-local", "Current task handover", "Backup teammate", "Backup contact number|tel", "Supervisor informed|select:Yes,No", "Reason and medical/access notes|textarea"]];
    }
    if (dashboardRole === "maintenance" && action === "add" && table === "tasks") {
        return ["Add Maintenance Task", "Create a complete task with asset, location, safety, material, SLA and assignment information.", ["Task title", "Category|select:PLUMBING,ELECTRICAL,LIFT,CARPENTRY,CLEANING,HVAC,FIRE_SAFETY,COMMON_AREA,OTHER", "Exact location / flat", "Asset / equipment reference", "Priority|select:LOW,NORMAL,HIGH,URGENT,EMERGENCY", "Assigned technician", "Requested by", "Contact phone|tel", "Start date & time|datetime-local", "SLA due date & time|datetime-local", "Safety isolation required|select:No,Yes", "Parts / tools expected", "Access instructions", "Detailed work scope|textarea"]];
    }
    if (dashboardRole === "maintenance" && action === "assign") {
        const row = button.closest("tr");
        const issue = row?.children[0]?.textContent.trim() || context.target;
        const flat = row?.children[1]?.textContent.trim() || "Common Area";
        return ["Take Complaint Task", `Move "${issue}" from the complaint queue into assigned tasks for ${flat}.`, ["Assigned to", "Priority", "Start time", "Work note"]];
    }
    if (dashboardRole === "maintenance" && action === "service-log") {
        const row = button.closest("tr");
        const asset = row?.children[0]?.textContent.trim() || "Asset";
        return ["Log Preventive Service", `Record the inspection, readings and service outcome for ${asset}.`, ["Service date|date", "Technician / vendor", "Service type|select:Inspection,Preventive service,Repair", "Meter or runtime reading", "Parts used", "Condition after service|select:Operational,Needs follow-up,Out of service", "Next service date|date", "Work notes"]];
    }
    if (dashboardRole === "admin" && action === "notify" && label.includes("export") && panel === "control") {
        return ["Export Action Queue", "Download a detailed control-center report with request, module, detail, status, and pending action for every row.", ["Report period", "Prepared by", "Export note"]];
    }
    if (queue?.module === "Residents" && action === "approve") {
        return ["Approve Resident KYC", `Verify ${queue.detail} before activating resident portal access.`, ["Resident name", "Flat / unit", "Resident role", "KYC reference", "Access start date", "Admin note"]];
    }
    if (queue?.module === "Complaints" && action === "assign") {
        return ["Assign Complaint Work", `Route ${queue.detail} with team, technician, priority and SLA details.`, ["Team / category", "Technician / vendor", "Priority", "SLA due time", "Work note"]];
    }
    if (queue?.module === "Amenities" && action === "approve") {
        return ["Approve Amenity Booking", `Approve the waiting amenity bookings with slot and charge details.`, ["Amenity", "Resident / booking detail", "Date and time slot", "Charges / deposit", "Approval note"]];
    }
    if (queue?.module === "Expenses" && action === "approve") {
        return ["Approve Vendor Expense", `Check vendor, invoice, amount and payment mode before approval.`, ["Vendor", "Invoice number", "Amount", "Payment mode", "Approval note"]];
    }
    if (queue?.module === "Billing" && action === "pay") {
        return ["Mark Queue Bill Paid", `Record verified payment details for ${queue.detail}.`, ["Payment method", "Reference number", "Received date", "Proof / screenshot filename", "Admin note"]];
    }
    if (queue?.module === "Billing" && action === "receipt") {
        return ["Billing Receipt", "Download the exact receipt for B-204 June maintenance after payment verification.", []];
    }
    if (action === "save" && label.includes("edit")) {
        const table = button.closest("table")?.dataset.table || "";
        const editFields = {
            flats: ["Flat number", "Owner name", "Occupancy|select:VACANT,OCCUPIED,UNDER_MAINTENANCE", "Block", "Floor|number", "Unit type|select:1BHK,2BHK,3BHK,4BHK,DUPLEX,PENTHOUSE", "Owner mobile|tel", "Owner email|email", "Built-up area (sq.ft)|number", "Parking slot", "Monthly maintenance (Rs.)|number", "Possession date|date", "Notes|textarea"],
            residents: ["Full name", "Flat / unit", "Resident type|select:OWNER,TENANT,FAMILY_MEMBER", "Email address|email", "Mobile number|tel", "Move-in date|date", "Vehicle number", "Emergency contact name", "Emergency contact phone|tel", "KYC reference", "Account status|select:ACTIVE,LOCKED,PENDING", "Profile notes|textarea"],
            billing: ["Invoice month", "Flat / unit", "Resident", "Charge type", "Base amount|number", "Additional charges|number", "Tax amount|number", "Late fee|number", "Due date|date", "Payment status|select:UNPAID,PARTIAL,PAID,OVERDUE,WAIVED", "Payment reference", "Billing correction note|textarea"],
            visitors: ["Visitor full name", "Mobile number|tel", "Email address|email", "Flat / unit", "Entry type|select:GUEST,DELIVERY,SERVICE_STAFF,VENDOR,CAB", "Purpose / organisation", "Persons count|number", "Expected arrival|datetime-local", "Vehicle number", "ID proof type", "ID proof reference", "Access status|select:EXPECTED,APPROVED,CHECKED_IN,CHECKED_OUT,DENIED", "Special instructions|textarea"],
            complaints: ["Issue title", "Flat / unit", "Category", "Subcategory", "Priority|select:LOW,NORMAL,HIGH,URGENT,EMERGENCY", "Incident date & time|datetime-local", "Exact location", "Assigned team", "Assigned technician", "SLA due time|datetime-local", "Status|select:OPEN,ASSIGNED,IN_PROGRESS,WAITING_FOR_PARTS,RESOLVED,CLOSED", "Resolution / access notes|textarea"],
            expenses: ["Expense title", "Category", "Expense date|date", "Vendor", "Vendor phone|tel", "Invoice number", "Payment method", "Base amount|number", "Tax amount|number", "Total amount|number", "Status|select:DRAFT,PENDING,APPROVED,PAID,REJECTED", "Receipt reference", "Description / approval note|textarea"]
        };
        return ["Edit Record", `Update details for ${context.target}.`, editFields[table] || ["Name / title", "Details", "Status"]];
    }
    if (action === "save") {
        return ["Save Changes", `Save the latest details in ${titles[panel] || panel}.`, []];
    }
    if (action === "notify" && label.includes("receipt")) {
        return ["Download Receipt", `Generate a receipt for ${context.target}.`, ["Receipt note"]];
    }
    if (action === "receipt") {
        if (dashboardRole === "admin" && button.closest('[data-table="billing"]')) {
            return ["Billing Receipt", "Generate the exact receipt for this flat, resident, month, and payment reference.", []];
        }
        return ["Download Receipt", `Generate a billing receipt for ${context.target}.`, ["Receipt note"]];
    }
    if (action === "notify" && label.includes("export")) {
        return ["Export Report", `Export the visible ${titles[panel] || panel} report.`, ["Report period"]];
    }
    if (action === "notify" && label.includes("publish")) {
        return ["Publish Announcement", "Send this announcement to residents and staff.", ["Audience", "Publish note"]];
    }
    if (action === "notify" && label.includes("contact")) {
        return ["Contact Admin", "Send a clear message to the society admin team.", ["Message"]];
    }
    if (action === "add" && table === "entries") {
        return ["New Detailed Gate Entry", "Record identity, destination, visit purpose, vehicle, timing and gate verification details.", ["Visitor / staff name", "Mobile number|tel", "Email address|email", "Flat / unit", "Entry type|select:GUEST,DELIVERY,SERVICE_STAFF,CAB,DOMESTIC_STAFF,VENDOR", "Purpose / company", "Persons count|number", "Vehicle number", "ID proof type|select:None,Aadhaar,Driving Licence,Passport,Voter ID,Company ID", "ID proof last 4 / reference", "Host / approved by", "Expected exit time|datetime-local", "Gate notes|textarea"]];
    }
    if (action === "add" && table === "visitors") {
        return ["Add Detailed Visitor", "Create a complete visitor record with identity, host, schedule, vehicle and access instructions.", ["Visitor full name", "Mobile number|tel", "Email address|email", "Flat / unit", "Entry type|select:GUEST,DELIVERY,SERVICE_STAFF,CAB,DOMESTIC_STAFF,VENDOR", "Purpose / organisation", "Persons count|number", "Expected arrival|datetime-local", "Vehicle number", "ID proof type|select:None,Aadhaar,Driving Licence,Passport,Voter ID,Company ID", "ID proof last 4 / reference", "Photo / document reference", "Special access instructions|textarea"]];
    }
    if (action === "add" && table === "passes") {
        return ["Create Detailed Visitor Pass", "Create a traceable pre-authorised gate pass with identity, validity and host instructions.", ["Visitor full name", "Mobile number|tel", "Flat / unit", "Visit type|select:GUEST,DELIVERY,SERVICE,VENDOR,CAB", "Purpose / organisation", "Valid from|datetime-local", "Valid until|datetime-local", "Persons count|number", "Vehicle number", "ID proof reference", "Host instructions|textarea"]];
    }
    if (action === "add" && table === "societies") {
        return ["Add Society", "Register a society tenant with city, plan and onboarding status.", ["Society name", "City", "Plan", "Admin email"]];
    }
    if (action === "add" && table === "users") {
        return ["Create Platform User", "Create an account, assign a role, and connect the user to the right society.", ["Full name", "Role", "Society", "Email / phone"]];
    }
    if (action === "add" && table === "flats") {
        return ["Add Flat", "Create a complete flat profile with property, ownership, contact, parking and maintenance details.", ["Flat number", "Owner name", "Occupancy|select:VACANT,OCCUPIED,UNDER_MAINTENANCE", "Block / tower", "Floor|number", "Unit type|select:1BHK,2BHK,3BHK,4BHK,DUPLEX,PENTHOUSE", "Owner mobile|tel", "Owner email|email", "Built-up area (sq.ft)|number", "Parking slot", "Monthly maintenance (Rs.)|number", "Possession date|date", "Notes|textarea"]];
    }
    if (action === "add" && table === "residents") {
        return ["Add Resident", "Create a complete resident login and connect it to an existing flat.", ["Full name", "Email address|email", "Mobile number|tel", "Flat / unit", "Resident type|select:OWNER,TENANT,FAMILY_MEMBER", "Move-in date|date", "Vehicle number", "Residential address|textarea", "Emergency contact name", "Emergency contact phone|tel", "Profile notes|textarea", "Temporary password|password"]];
    }
    if (action === "add" && ["security-users","maintenance-users","accountant-users"].includes(table)) {
        const config = table === "security-users"
            ? ["Add Security Staff", "SECURITY_STAFF", "Security Officer", "Day Shift,Evening Shift,Night Shift,Rotational"]
            : table === "maintenance-users"
            ? ["Add Maintenance Staff", "MAINTENANCE_STAFF", "Maintenance Technician", "General Shift,Morning Shift,Evening Shift,On Call"]
            : ["Add Accountant", "ACCOUNTANT", "Society Accountant", "General Shift,Part Time,Remote / Hybrid"];
        return [config[0], `Create a secure ${config[2].toLowerCase()} account with contact, employment and emergency details.`, ["Full name", "Email address|email", "Mobile number|tel", `Designation`, "Employee ID", "Joining date|date", `Work shift|select:${config[3]}`, "Residential address|textarea", "Emergency contact name", "Emergency contact phone|tel", "Administrative notes|textarea", "Temporary password|password"]];
    }
    if (action === "add" && table === "complaints") {
        if (dashboardRole === "resident") {
            return ["Raise Detailed Complaint", "Create a traceable service request with complete incident, contact, access and evidence information for the society team.", ["Issue / complaint title", "Category|select:Plumbing,Electrical,Lift / Elevator,Security,Cleaning,Carpentry,Pest Control,Water Supply,Power Supply,Common Area,Parking,Other", "Subcategory / issue type", "Priority|select:LOW,NORMAL,HIGH,URGENT,EMERGENCY", "Incident date & time|datetime-local", "Exact location / room / common area", "Preferred contact method|select:PHONE,EMAIL,WHATSAPP,IN_APP", "Contact phone|tel", "Allow maintenance staff entry|select:No,Yes", "Photo / video / document reference", "Detailed problem description, observations and access instructions|textarea"]];
        }
        return ["Create Detailed Complaint", "Create a complete, traceable service ticket with resident, incident, access, contact and assignment information.", ["Issue / complaint title", "Flat / unit", "Category|select:Plumbing,Electrical,Lift / Elevator,Security,Cleaning,Carpentry,Pest Control,Water Supply,Power Supply,Common Area,Parking,Other", "Subcategory / issue type", "Priority|select:LOW,NORMAL,HIGH,URGENT,EMERGENCY", "Incident date & time|datetime-local", "Exact location / room / area", "Preferred contact|select:PHONE,EMAIL,WHATSAPP,IN_APP", "Contact phone|tel", "Allow staff entry|select:No,Yes", "Assign team|select:Unassigned,Plumbing Team,Electrical Team,Security Team,Housekeeping,Facility Team,External Vendor", "Photo / document reference", "Detailed description and access instructions|textarea"]];
    }
    if (action === "add" && table === "expenses") {
        return ["Add Detailed Expense", "Record complete vendor, invoice, tax, payment and approval information.", ["Expense title", "Category|select:MAINTENANCE,UTILITIES,SECURITY,HOUSEKEEPING,REPAIRS,AMENITY,ADMINISTRATION,OTHER", "Expense date|date", "Vendor / payee", "Vendor phone|tel", "Vendor tax / GST number", "Invoice number", "Payment method|select:CASH,BANK_TRANSFER,UPI,CHEQUE,CARD", "Base amount (Rs.)|number", "Tax amount (Rs.)|number", "Total amount (Rs.)|number", "Cost centre / block", "Receipt / document reference", "Detailed business purpose|textarea"]];
    }
    if (action === "add" && table === "incomes") {
        return ["Record Detailed Income", "Create an auditable income entry with payer, receipt, banking, tax and allocation details.", ["Income category|select:MAINTENANCE_COLLECTION,AMENITY_BOOKING,INTEREST_INCOME,LATE_FEE,PARKING_FEE,EVENT_SPONSORSHIP,REFUND_RECEIVED,OTHER", "Received date|date", "Payer / source name", "Flat / unit or ledger reference", "Amount received (Rs.)|number", "Payment method|select:UPI,BANK_TRANSFER,CASH,CHEQUE,CARD,NET_BANKING", "Transaction / UTR / cheque reference", "Receipt number", "Credited bank / cash account", "Tax / GST amount (Rs.)|number", "Tax treatment|select:NOT_APPLICABLE,TAXABLE,TAX_INCLUDED,TDS_DEDUCTED", "Allocation / cost centre", "Receipt or supporting document reference", "Income status|select:RECEIVED,PARTIALLY_RECEIVED,PENDING_CONFIRMATION,REVERSED", "Recorded / verified by", "Narration and reconciliation notes|textarea"]];
    }
    if (action === "add" && table === "vendors") {
        return ["Add Detailed Vendor", "Create a complete vendor profile with contract, compliance, banking and payment-control details.", ["Vendor legal name", "Trading / display name", "Service category|select:SECURITY,MAINTENANCE,PLUMBING,ELECTRICAL,HOUSEKEEPING,LANDSCAPING,WASTE_MANAGEMENT,PEST_CONTROL,LIFT_SERVICE,UTILITY,OTHER", "Service scope and deliverables|textarea", "Registered business address|textarea", "GSTIN / tax registration number", "PAN / business registration reference", "Primary contact person", "Primary mobile number|tel", "Primary email address|email", "Emergency / escalation contact|tel", "Contract / work order reference", "Contract start date|date", "Contract expiry date|date", "Billing cycle|select:ONE_TIME,MONTHLY,QUARTERLY,HALF_YEARLY,ANNUAL,ON_CALL", "Payment terms|select:ADVANCE,NET_7,NET_15,NET_30,NET_45,NET_60,ON_COMPLETION", "Service-level agreement / response time", "Beneficiary account name", "Bank name", "Account number", "IFSC / routing code", "Preferred payment method|select:BANK_TRANSFER,UPI,CHEQUE,CASH,CARD", "Approved rate / contract value (Rs.)|number", "Insurance / licence / compliance reference", "Background / document verification status|select:VERIFIED,PENDING,EXPIRED,NOT_APPLICABLE", "Vendor status|select:ACTIVE,PENDING_APPROVAL,ON_HOLD,INACTIVE", "Approved / onboarded by", "Internal vendor notes and payment instructions|textarea"]];
    }
    if (action === "update-plan") {
        const plan = button.dataset.plan || context.target || "Selected plan";
        return [`Subscribe to ${plan}`, "Confirm complete society, billing, invoice and authorization details for this subscription.", ["Society name", "Registration / tenant ID", "Administrator name", "Administrator email|email", "Administrator phone|tel", "Billing cycle|select:MONTHLY,QUARTERLY,HALF_YEARLY,ANNUALLY", "Subscription start date|date", "Renewal date|date", "Billing contact name", "Billing email|email", "Tax / GST number", "Invoice address|textarea", "Purchase order / approval reference", "Subscription note|textarea"]];
    }
    if (action === "edit-plan") {
        const plan = button.dataset.plan || context.target || "Subscription plan";
        return [`Edit ${plan}`, "Update complete catalogue, pricing, capacity, support and publication settings.", ["Plan name", "Plan code", "Description|textarea", "Monthly price (Rs.)|number", "Billing cycle|select:MONTHLY,QUARTERLY,ANNUALLY", "Maximum flats|number", "Maximum residents|number", "Maximum admins|number", "Maximum security staff|number", "Maximum maintenance staff|number", "Storage (GB)|number", "Audit history days|number", "Trial days|number", "Grace days|number", "Support level|select:STANDARD,PRIORITY,DEDICATED", "Active|select:Yes,No", "Featured|select:Yes,No"]];
    }
    if (dashboardRole === "superadmin" && action === "notify" && label.toLowerCase().includes("platform notice")) {
        return ["Send Platform Notice", "Send an official notice to society administrators.", ["Target|select:All Registered Societies,Specific Society", "Message|textarea"]];
    }
    if (dashboardRole === "superadmin" && action === "subscription-map") {
        return ["Update Society Subscription", `Correct the subscription mapping for ${context.target}.`, ["Society", "Current plan", "New plan", "Flat usage", "Renewal date", "Admin owner", "Review note"]];
    }
    if (dashboardRole === "superadmin" && action === "admin-seat") {
        const labelText = buttonLabel(button);
        return [`${labelText} - Admin Access`, `Record precise platform access action for ${context.target}.`, ["Admin name", "Society", "Role", "MFA status", "Access decision", "Audit note"]];
    }
    if (dashboardRole === "superadmin" && action === "billing-rule") {
        return ["Update Billing Rule", `Adjust the billing rule for ${context.target}.`, ["Rule name", "Plan", "Amount", "Billing cycle", "Grace period", "Effective from", "Rule note"]];
    }
    if (dashboardRole === "superadmin" && action === "subscription-audit") {
        return ["Run Invoice Dry Run", "Preview subscription invoices without changing live billing records.", ["Invoice month", "Include trials", "Include renewal due societies", "Dry run note"]];
    }
    if (dashboardRole === "admin" && action === "approve-payment-proof") {
        return ["Approve Payment Proof", "Review the screenshot and approve only if the payment is valid. This will mark the resident bill as paid.", ["Admin review note"]];
    }
    if (dashboardRole === "admin" && action === "reject-payment-proof") {
        return ["Reject Payment Proof", "Reject only if the screenshot is wrong, unclear, duplicate, or not matching the bill. The resident bill will stay unpaid.", ["Rejection reason"]];
    }
    const configs = {
        add: ["Add Detailed Record", `Create a complete item in ${titles[panel] || panel}.`, ["Name / title", "Category", "Effective date|date", "Responsible person", "Contact / reference", "Detailed notes|textarea"]],
        save: ["Save changes", `Confirm updates for ${titles[panel] || panel}.`, []],
        notify: ["Send Notification", `Write a message for: ${context.target}.`, ["Message"]],
        generate: ["Generate Detailed Monthly Bills", "Create itemized maintenance bills per flat with base rates, water meters, sinking funds, reserve funds, parking fees, and GST tax breakdowns.", ["Billing month", "Base rate (per sq.ft)", "Water sub-meter rate (per unit)", "Common power backup fee", "Sinking fund contribution", "Building repair reserve", "Covered parking fee", "GST tax rate (%)", "Payment due date"]],
        pay: dashboardRole === "admin"
            ? ["Mark Bill Paid", "Record verified payment details so the receipt is exact for this flat and resident.", ["Payment method", "Reference number", "Received date", "Proof / screenshot filename", "Admin note"]]
            : ["Confirm Payment", "Record complete payer, transaction and receipt details before confirming payment.", ["Payer name", "Flat / invoice reference", "Payment method|select:UPI,CARD,NET_BANKING,BANK_TRANSFER,CHEQUE", "Amount (Rs.)|number", "Transaction reference", "Payment date|date", "Payer mobile|tel", "Payer email|email", "Receipt email required|select:Yes,No", "Payment note|textarea"]],
        book: dashboardRole === "resident"
            ? ["Book Amenity", `Request ${button.closest(".card")?.querySelector("h3")?.textContent || button.textContent.trim()} with complete scheduling and usage details.`, ["Booking date|date", "Start time|time", "End time|time", "Guests count|number", "Vehicles count|number", "Purpose / event", "Contact number|tel", "Special setup or access notes|textarea"]]
            : ["Confirm Detailed Booking", `Reserve ${button.closest(".card")?.querySelector("h3")?.textContent || button.textContent.trim()}.`, ["Booked for / resident", "Flat / unit", "Booking date|date", "Start time|time", "End time|time", "Guests count|number", "Payment reference", "Booking notes|textarea"]],
        approve: ["Review and Approve", `Record a traceable decision for ${context.target}.`, ["Decision|select:APPROVED,APPROVED_WITH_CONDITIONS", "Effective date|date", "Reviewed by", "Verification reference", "Conditions / approval note|textarea"]],
        suspend: ["Suspend society", "Provide a reason before suspending access.", ["Reason"]],
        assign: ["Assign Detailed Work", "Route this request with responsibility, priority and deadline information.", ["Team|select:Plumbing Team,Electrical Team,Security Team,Housekeeping,Facility Team,External Vendor", "Assigned person", "Priority|select:LOW,NORMAL,HIGH,URGENT", "Start by|datetime-local", "Complete by|datetime-local", "Work scope / instructions|textarea"]],
        checkin: ["Visitor Check-in", "Confirm identity, pass, vehicle and gate-entry details.", ["Identity verified|select:Yes,No", "Pass / QR reference", "Persons entering|number", "Vehicle number", "Entry gate", "Items carried", "Gate note|textarea"]],
        checkout: ["Visitor Check-out", "Record the complete exit and any exception details.", ["Exit date & time|datetime-local", "Persons exiting|number", "Pass returned|select:Yes,No,Not applicable", "Exit gate", "Vehicle number", "Incident / exit note|textarea"]],
        complete: ["Complete Detailed Task", "Record work performed, materials, cost and completion evidence.", ["Completion date & time|datetime-local", "Completed by", "Work performed|textarea", "Parts / materials used", "Cost (Rs.)|number", "Photo / document reference", "Follow-up required|select:No,Yes", "Follow-up notes|textarea"]],
        close: ["Close Detailed Complaint", "Document the final resolution and closure information.", ["Resolution category|select:FIXED,NO_FAULT_FOUND,DUPLICATE,RESIDENT_UNAVAILABLE,VENDOR_COMPLETED,OTHER", "Root cause", "Resolution performed|textarea", "Resolved by", "Repair cost (Rs.)|number", "Parts used", "Completion reference", "Resident informed|select:Yes,No", "Closure note|textarea"]],
        inspect: ["Category details", `Review details for ${button.textContent.trim()}.`, []]
    };
    return configs[action] || [`Action: ${action}`, `Proceed with the ${action} action?`, []];
}

function openActionModal(action, button) {
    if (dashboardRole === "resident" && action === "pay") {
        openResidentPaymentModal(button);
        return;
    }
    if (dashboardRole === "accountant" && action === "pay" && button.closest('[data-table="billing"]')) {
        performAction(action, button, []);
        showToast("Payment marked as paid");
        return;
    }
    if (dashboardRole === "admin" && action === "receipt" && button.closest('[data-table="billing"]')) {
        showActionReceipt(showBillingReceipt(button.closest("tr")));
        return;
    }
    const modal = ensureActionModal();
    const [title, text, fields] = actionConfig(action, button);
    const tableName = button.closest("table")?.dataset.table || button.dataset.table || "";
    const row = button.closest("tr");
    const existingValues = action === "amenity-price-edit"
        ? [button.dataset.amenityName || "", button.dataset.amenityCapacity || "", button.dataset.amenityPrice || "0", button.dataset.amenityApproval || "Yes"]
        : action === "save" && buttonLabel(button).toLowerCase().includes("edit")
        ? (tableName === "flats" && row ? [row.dataset.unitNo||row.children[0]?.textContent.trim()||"",row.dataset.ownerName||row.children[1]?.textContent.trim()||"",row.dataset.occupancy||row.querySelector(".status")?.textContent.trim()||"VACANT",row.dataset.block||"Block A",row.dataset.floor||"0",row.dataset.type||"2BHK",row.dataset.ownerPhone||"",row.dataset.ownerEmail||"",row.dataset.builtUpAreaSqFt||"",row.dataset.parkingSlot||"",row.dataset.monthlyMaintenance||"",row.dataset.possessionDate||"",row.dataset.notes||""] : rowValues(button))
        : [];
    activeAction = { action, button };
    modal.querySelector("#dashboardActionTitle").textContent = title;
    modal.querySelector("#dashboardActionText").textContent = text;
    const isFlatForm = tableName === "flats" && (action === "add" || action === "save");
    const isPeopleForm = action === "add" && ["residents","security-users","maintenance-users","accountant-users"].includes(tableName);
    const isComplaintForm = action === "add" && tableName === "complaints";
    const isIncomeForm = action === "add" && tableName === "incomes";
    const isVendorForm = action === "add" && tableName === "vendors";
    const isResidentComplaintForm = isComplaintForm && dashboardRole === "resident";
    const isDetailedWorkflow = fields.length >= 7;
    modal.querySelector(".dashboard-action-card")?.classList.toggle("flat-detail-card", isFlatForm || isPeopleForm || isComplaintForm || isDetailedWorkflow);
    
    let linkBanner = "";
    if (tableName === "residents" && action === "add") {
        linkBanner = `
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 14px; padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.08);">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 240px;">
                        <strong style="display: block; font-size: 0.92rem; color: #1e40af; margin-bottom: 3px;">
                            <i class="fa-solid fa-link" style="margin-right: 6px; color: #2563eb;"></i> Generate Resident Self-Registration Link
                        </strong>
                        <span style="font-size: 0.82rem; color: #475569; line-height: 1.4; display: block;">
                            Generate a unique single-person link. Send it to the resident so they can update their details by themselves.
                        </span>
                    </div>
                    <button type="button" id="btnGenerateResidentLink" onclick="window.generateResidentSelfLink()" style="background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border: none; padding: 9px 16px; border-radius: 10px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                        <i class="fa-solid fa-qrcode"></i> Generate Link
                    </button>
                </div>
                <div id="residentSelfLinkOutput" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid #93c5fd;">
                    <label style="font-size: 0.78rem; font-weight: 700; color: #1e3a8a; display: block; margin-bottom: 6px;">Shareable Single-Person Resident Link:</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" id="generatedResidentUrlInput" readonly style="flex: 1; background: #ffffff; border: 1px solid #93c5fd; padding: 9px 12px; border-radius: 8px; font-family: monospace; font-size: 0.82rem; color: #0f172a;" value="">
                        <button type="button" onclick="window.copyGeneratedResidentUrl()" style="background: #0f172a; color: #ffffff; border: none; padding: 9px 14px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer; white-space: nowrap;">
                            <i class="fa-solid fa-copy"></i> Copy Link
                        </button>
                        <a id="previewGeneratedResidentUrl" href="#" target="_blank" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 9px 14px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; white-space: nowrap;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
                        </a>
                    </div>
                    <small style="display: block; color: #1e40af; font-size: 0.76rem; margin-top: 6px; font-weight: 600;">
                        ✓ This link belongs to ONE person only. Submitted details will auto-appear in your Residents table.
                    </small>
                </div>
            </div>
            <div class="flat-form-section"><strong>Or fill details directly below:</strong><span>Manual Admin Creation</span></div>
        `;
    }

    modal.querySelector("#dashboardActionFields").innerHTML = linkBanner + fields
        .map((field, index) => {
            const section = isFlatForm && index === 0 ? '<div class="flat-form-section"><strong>Property details</strong><span>Identify and classify the flat</span></div>'
                : isFlatForm && index === 6 ? '<div class="flat-form-section"><strong>Owner contact</strong><span>Primary ownership and communication details</span></div>'
                : isFlatForm && index === 8 ? '<div class="flat-form-section"><strong>Area, parking &amp; billing</strong><span>Operational information used by society administration</span></div>'
                : isPeopleForm && index === 0 ? '<div class="flat-form-section"><strong>Personal &amp; contact details</strong><span>Identity and primary communication information</span></div>'
                : isPeopleForm && index === 3 ? `<div class="flat-form-section"><strong>${tableName === "residents" ? "Residence details" : "Employment details"}</strong><span>${tableName === "residents" ? "Flat, occupancy and vehicle information" : "Role assignment, joining date and work shift"}</span></div>`
                : isPeopleForm && index === 8 ? '<div class="flat-form-section"><strong>Emergency information</strong><span>Contact used if urgent assistance is required</span></div>'
                : isPeopleForm && index === 11 ? '<div class="flat-form-section"><strong>Account access</strong><span>Temporary password must contain at least 8 characters</span></div>'
                : isComplaintForm && index === 0 ? '<div class="flat-form-section"><strong>Complaint identification</strong><span>Resident, flat and issue classification</span></div>'
                : isComplaintForm && index === (isResidentComplaintForm ? 4 : 5) ? '<div class="flat-form-section"><strong>Incident details</strong><span>When and exactly where the issue occurred</span></div>'
                : isComplaintForm && index === (isResidentComplaintForm ? 6 : 7) ? '<div class="flat-form-section"><strong>Contact &amp; access</strong><span>How to contact the resident and whether staff may enter</span></div>'
                : isComplaintForm && index === (isResidentComplaintForm ? 9 : 10) ? `<div class="flat-form-section"><strong>${isResidentComplaintForm ? "Evidence &amp; full description" : "Assignment &amp; evidence"}</strong><span>${isResidentComplaintForm ? "Supporting reference, observations and entry instructions" : "Initial routing, supporting reference and full description"}</span></div>`
                : isIncomeForm && index === 0 ? '<div class="flat-form-section"><strong>Income and payer</strong><span>Classify the receipt and identify who paid it</span></div>'
                : isIncomeForm && index === 5 ? '<div class="flat-form-section"><strong>Receipt and settlement</strong><span>Payment channel, traceable reference and destination account</span></div>'
                : isIncomeForm && index === 9 ? '<div class="flat-form-section"><strong>Tax and allocation</strong><span>Tax treatment and the ledger or cost centre for this income</span></div>'
                : isIncomeForm && index === 13 ? '<div class="flat-form-section"><strong>Verification and notes</strong><span>Confirm the receipt status and document reconciliation details</span></div>'
                : isVendorForm && index === 0 ? '<div class="flat-form-section"><strong>Business identity and service</strong><span>Identify the legal entity and the work it is authorised to perform</span></div>'
                : isVendorForm && index === 7 ? '<div class="flat-form-section"><strong>Primary contact and contract</strong><span>Record the accountable person and contract schedule</span></div>'
                : isVendorForm && index === 17 ? '<div class="flat-form-section"><strong>Banking and commercial terms</strong><span>Capture approved payment destination, rates and settlement controls</span></div>'
                : isVendorForm && index === 23 ? '<div class="flat-form-section"><strong>Compliance and onboarding</strong><span>Verify documents, approval status and operational instructions</span></div>'
                : ["visitors","entries"].includes(tableName) && index === 0 ? '<div class="flat-form-section"><strong>Visitor identity</strong><span>Name, contact and destination details</span></div>'
                : ["visitors","entries"].includes(tableName) && index === 4 ? '<div class="flat-form-section"><strong>Visit &amp; access details</strong><span>Entry classification, purpose, group size and vehicle</span></div>'
                : ["visitors","entries"].includes(tableName) && index === 9 ? '<div class="flat-form-section"><strong>Verification &amp; instructions</strong><span>Identity reference, evidence and gate directions</span></div>'
                : tableName === "passes" && index === 0 ? '<div class="flat-form-section"><strong>Visitor &amp; host</strong><span>Identity, contact and destination</span></div>'
                : tableName === "passes" && index === 3 ? '<div class="flat-form-section"><strong>Pass validity</strong><span>Visit classification, schedule and vehicle details</span></div>'
                : action === "amenity-booking" && index === 0 ? '<div class="flat-form-section"><strong>Reservation &amp; schedule</strong><span>Select the amenity, resident and complete booking period</span></div>'
                : action === "amenity-booking" && index === 4 ? '<div class="flat-form-section"><strong>Event &amp; attendance</strong><span>Purpose, guest composition and expected vehicle load</span></div>'
                : action === "amenity-booking" && index === 9 ? '<div class="flat-form-section"><strong>Organizer contact</strong><span>Responsible person and communication details</span></div>'
                : action === "amenity-booking" && index === 12 ? '<div class="flat-form-section"><strong>Setup, services &amp; access</strong><span>Seating, equipment, catering, decoration and accessibility</span></div>'
                : action === "amenity-booking" && index === 18 ? '<div class="flat-form-section"><strong>Payment, deposit &amp; compliance</strong><span>Transaction information, emergency contact and booking terms</span></div>'
                : isDetailedWorkflow && index === 0 && !isFlatForm && !isPeopleForm && !isComplaintForm ? '<div class="flat-form-section"><strong>Required details</strong><span>Complete all relevant information before confirming</span></div>'
                : "";
            return section + actionInputMarkup(action, field, index, existingValues[index]);
        })
        .join("");
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Confirm";
    save.onclick = null;
    modal.classList.remove("hidden");
    modal.querySelector("[data-action-input]")?.focus();
}

function actionInputMarkup(action, field, index, value = "") {
    let labelText = field;
    let inputHtml = `<input data-action-input="${index}" placeholder="${field}" value="${escapeAttribute(value)}">`;
    if (action === "amenity-booking" && index === 0) {
        const options = (window.societyAmenities || []).map(amenity => `<option value="${escapeAttribute(amenity.id)}">${escapeAttribute(amenity.name)} · Rs. ${escapeAttribute(amenity.bookingFee ?? 0)}</option>`).join("");
        inputHtml = `<select data-action-input="${index}"><option value="">Select amenity</option>${options}</select>`;
    } else if (action === "amenity-booking" && index === 1) {
        const options = (window.societyResidents || []).map(resident => `<option value="${escapeAttribute(resident.id)}">${escapeAttribute(resident.name)} — Flat ${escapeAttribute(resident.unitNo)}</option>`).join("");
        inputHtml = `<select data-action-input="${index}"><option value="">Select resident and flat</option>${options}</select>`;
    } else if (action === "amenity-booking" && (index === 2 || index === 3)) {
        const when = new Date(Date.now() + (index === 2 ? 86400000 : 90000000));
        when.setMinutes(0, 0, 0);
        inputHtml = `<input type="datetime-local" data-action-input="${index}" value="${escapeAttribute(value || when.toISOString().slice(0, 16))}">`;
    } else if (field.includes("|")) {
        const parts = field.split("|");
        labelText = parts[0];
        const typeInfo = parts[1];
        if (typeInfo.startsWith("select:")) {
            const options = typeInfo.substring(7).split(",").map(opt => `<option value="${escapeAttribute(opt)}">${escapeAttribute(opt)}</option>`).join("");
            inputHtml = `<select data-action-input="${index}">${options}</select>`;
        } else if (typeInfo === "textarea") {
            inputHtml = `<textarea data-action-input="${index}" placeholder="${labelText}">${escapeAttribute(value)}</textarea>`;
        } else if (typeInfo === "datetime-local") {
            const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
            inputHtml = `<input type="datetime-local" data-action-input="${index}" value="${escapeAttribute(value || defaultTime)}">`;
        } else {
            inputHtml = `<input type="${typeInfo}" data-action-input="${index}" placeholder="${labelText}" value="${escapeAttribute(value)}">`;
        }
    } else if (action === "generate") {
        const defaults = [
            currentMonthName(), "1.35", "3.50", "253.00", "150.00", "100.00", "100.00", "18", "15-Aug-2026"
        ];
        const val = value || defaults[index] || "";
        inputHtml = `<input data-action-input="${index}" value="${escapeAttribute(val)}">`;
    } else if (action === "add" && field === "Flat / unit" && Array.isArray(window.societyApartments)) {
        const options = window.societyApartments.map(flat => `<option value="${escapeAttribute(flat.unitNo)}">${escapeAttribute(flat.unitNo)} — ${escapeAttribute(flat.block)} · Floor ${escapeAttribute(flat.floor)}</option>`).join("");
        inputHtml = `<select data-action-input="${index}"><option value="">Select an existing flat</option>${options}</select>`;
    } else if (action === "add" && field.toLowerCase().includes("expected time")) {
        const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
        inputHtml = `<input type="datetime-local" data-action-input="${index}" value="${escapeAttribute(value || defaultTime)}">`;
    }

    const required = actionFieldIsRequired(action, labelText, index);
    if (required) {
        inputHtml = inputHtml.replace(/<(input|select|textarea)\b/, '<$1 required aria-required="true" data-required="true"');
    }
    return `<label><span>${labelText}${required ? ' <span class="required-star" aria-hidden="true">*</span>' : ''}</span>${inputHtml}</label>`;
}

function actionFieldIsRequired(action, labelText, index) {
    if (dashboardRole === "accountant" && action === "add" && /Income category|Received date|Payer \/ source name|Amount received|Payment method|Income status/.test(labelText)) {
        return true;
    }
    if (dashboardRole === "accountant" && action === "add" && /Vendor legal name|Service category|Primary contact person|Primary mobile number|Contract \/ work order reference|Contract start date|Contract expiry date|Billing cycle|Payment terms|Vendor status/.test(labelText)) {
        return true;
    }
    if (dashboardRole === "accountant" && action === "add" && /Flat \/ unit or ledger reference|Transaction \/ UTR|Receipt number|Credited bank|Tax treatment|Allocation|Receipt or supporting|Recorded \/ verified|Trading \/ display|Service scope|Registered business|GSTIN|PAN|Primary email|Emergency|Service-level|Beneficiary|Bank name|Account number|IFSC|Preferred payment|Approved rate|Insurance|Background|Approved \/ onboarded|Internal vendor/.test(labelText)) {
        return false;
    }
    if (dashboardRole === "resident" && action === "book") {
        return [0, 1, 2, 5, 6].includes(index);
    }
    const optional = /optional|notes?|instructions?|reference|attachment|evidence|photo|document|vehicle|parking|secondary|emergency|email|cost|price|deposit|children|guests?|persons?|items carried|parts|materials|follow-up/i;
    return !optional.test(labelText);
}

function closeActionModal() {
    document.getElementById("dashboardActionModal")?.classList.add("hidden");
    activeAction = null;
}

async function performAction(action, button, values = []) {
    const context = getContext(button);
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const fieldValues = values.filter(Boolean);
    const nearbyValues = action === "save" || buttonLabel(button).toLowerCase().includes("publish") ? readNearbyFields(button) : [];
    const note = [...fieldValues, ...nearbyValues].filter(Boolean).join(" | ");
    const label = buttonLabel(button).toLowerCase();
    const messages = {
        approve: `Approved ${context.target}`,
        suspend: `Suspended ${context.target}`,
        add: `Added new record in ${context.panelTitle}`,
        "update-plan": `Updated ${button.dataset.plan || context.target} plan`,
        save: label.includes("sync") ? `Synced ${context.panelTitle}` : `Saved ${context.panelTitle}`,
        generate: `Generated monthly bills for ${context.panelTitle}`,
        pay: `Payment marked paid for ${context.target}`,
        close: `Closed ${context.target}`,
        assign: dashboardRole === "maintenance" ? `Taken task for ${context.target}` : `Assigned ${context.target}`,
        notify: label.includes("receipt") ? `Receipt generated for ${context.target}` : label.includes("export") ? `Report exported from ${context.panelTitle}` : label.includes("publish") ? `Announcement published from ${context.panelTitle}` : `Notification sent to ${context.target}`,
        checkin: `Checked in ${context.target}`,
        checkout: `Checked out ${context.target}`,
        complete: `Completed ${context.target}`,
        book: `Booking confirmed for ${context.target}`,
        rest: "Maintenance team rest window updated"
    };

    if (dashboardRole === "admin" && (action === "approve-payment-proof" || action === "reject-payment-proof")) {
        const receipt = handlePaymentProofReview(action, button, values);
        if (receipt) return receipt;
    }

    if (dashboardRole === "admin" && action === "notify" && label.includes("export") && context.panel === "control") {
        persistDashboardState();
        return exportControlQueue(values);
    }
    const controlQueueReceipt = dashboardRole === "admin" ? performControlQueueAction(action, button, values) : null;
    if (controlQueueReceipt) {
        persistDashboardState();
        showToast(controlQueueReceipt.title);
        return controlQueueReceipt;
    }

    if (dashboardRole === "admin" && action === "amenity-booking") {
        const [amenityId, residentId, startTime, endTime, eventType, eventPurpose, expectedGuests, childrenCount, vehicleCount,
            organizerName, organizerPhone, organizerEmail, setupStyle, equipmentRequired, cateringDetails, decorationDetails,
            accessibilityNeeds, vehicleDetails, paymentMethod, paymentReference, securityDeposit, depositStatus,
            emergencyContact, termsAccepted, specialInstructions] = values;
        if (!amenityId || !residentId || !startTime || !endTime || !paymentMethod) return { title: "Booking details required", lines: ["Select the amenity and resident, then enter the requested date, time and payment method."] };
        if (!eventPurpose || !organizerName || !organizerPhone || termsAccepted !== "Yes") return { title: "Complete booking details required", lines: ["Enter the event purpose and organizer contact, then confirm that the amenity terms are accepted."] };
        mutateSociety("society/bookings/admin", "POST", { amenityId: Number(amenityId), residentId: Number(residentId), startTime, endTime,
            eventType, eventPurpose, expectedGuests: Number(expectedGuests || 1), childrenCount: Number(childrenCount || 0), vehicleCount: Number(vehicleCount || 0),
            organizerName, organizerPhone, organizerEmail, setupStyle, equipmentRequired, cateringDetails, decorationDetails,
            accessibilityNeeds, vehicleDetails, paymentMethod, paymentReference: paymentReference || "", securityDeposit: Number(securityDeposit || 0),
            depositStatus, emergencyContact, termsAccepted: termsAccepted === "Yes", specialInstructions })
            .then(() => { loadSocietyBackendData(); showToast("Amenity booking recorded"); })
            .catch(error => showToast(error.message || "Amenity booking could not be recorded"));
        return { title: "Detailed amenity booking recorded", lines: [`<strong>Event:</strong> ${eventType} · ${eventPurpose}`, `<strong>Attendance:</strong> ${expectedGuests || 1} guests · ${vehicleCount || 0} vehicles`, `<strong>Organizer:</strong> ${organizerName} · ${organizerPhone}`, `<strong>Payment:</strong> ${paymentMethod} · Deposit ${depositStatus}`] };
    }

    if (dashboardRole === "admin" && action === "amenity-price-edit") {
        const [name, capacity, bookingFee, approvalRequired] = values;
        if (!name || !capacity || bookingFee === "") return { title: "Amenity details required", lines: ["Enter the amenity name, capacity and booking price."] };
        mutateSociety(`society/amenities/${button.dataset.amenityId}`, "PATCH", { name, capacity: Number(capacity), bookingFee: Number(bookingFee), approvalRequired: approvalRequired === "Yes" })
            .then(() => { loadSocietyBackendData(); showToast("Amenity price updated"); })
            .catch(error => showToast(error.message || "Amenity price could not be updated"));
        return { title: "Amenity price updated", lines: [`<strong>${name}</strong> is now Rs. ${bookingFee} per booking.`] };
    }

    if (dashboardRole === "admin" && action === "save" && button.closest('table[data-table="flats"]')) {
        const row = button.closest("tr");
        const payload = flatPayload(values, row);
        if (!payload.unitNo || !payload.ownerName) return { title: "Flat details required", lines: ["Enter a flat number and owner name before saving."] };
        if (row?.dataset.recordId) mutateSociety(`society/apartments/${row.dataset.recordId}`, "PATCH", payload).then(() => loadSocietyBackendData()).catch(error => showToast(error.message || "Flat could not be updated"));
        if (row) Object.entries(payload).forEach(([key,value])=>row.dataset[key]=value??"");
        appendDashboardActivity(`Flat updated: ${payload.unitNo}`);
        persistDashboardState();
        return { title: "Flat updated", lines: [`<strong>Flat:</strong> ${payload.unitNo}`, `<strong>Owner:</strong> ${payload.ownerName}`, `<strong>Block:</strong> ${payload.block} · Floor ${payload.floor}`, `<strong>Type:</strong> ${payload.unitType}`, `<strong>Occupancy:</strong> ${payload.occupancy}`] };
    }

    if (dashboardRole === "maintenance" && action === "save" && label.includes("availability")) {
        const status = values[0] || "Available";
        const zone = values[1] || "All blocks";
        const until = values[2] || "End of shift";
        appendDashboardActivity(`Availability updated: ${status} - ${zone} until ${until}`);
    }
    if (dashboardRole === "maintenance" && action === "rest") {
        const restUntil = values[0] || "30 minutes";
        const backup = values[1] || "Backup team";
        const reason = values[2] || "Break";
        appendDashboardActivity(`Maintenance rest set until ${restUntil}; backup ${backup}; reason ${reason}`);
    }
    if (dashboardRole === "maintenance" && action === "assign") {
        const row = button.closest("tr");
        const issue = row?.children[0]?.textContent.trim() || context.target;
        const location = row?.children[1]?.textContent.trim() || "Common Area";
        const assignee = values[0] || "Maintenance Team";
        const priority = values[1] || "High";
        const startTime = values[2] || "Now";
        const workNote = values[3] || "Taken from complaint queue";
        addMaintenanceTask({
            task: issue,
            location,
            priority,
            status: "In Progress",
            note: `${assignee} - ${startTime} - ${workNote}`
        });
        setStatus(button, "Assigned", "progress");
        updateRowAction(button, "Taken", "assign", true);
        appendDashboardActivity(`Complaint moved to tasks: ${issue} at ${location}`);
    }
    if (dashboardRole === "maintenance" && action === "service-log") {
        const row = button.closest("tr");
        const asset = row?.children[0]?.textContent.trim() || "Asset";
        const serviceDate = values[0] || new Date().toLocaleDateString("en-CA");
        const technician = values[1] || "Maintenance team";
        const serviceType = values[2] || "Preventive service";
        const condition = values[5] || "Operational";
        const nextService = values[6] || row?.children[4]?.textContent.trim() || "To be scheduled";
        if (row?.children[3]) row.children[3].textContent = serviceDate;
        if (row?.children[4]) row.children[4].innerHTML = `<strong class="${condition === "Operational" ? "text-success" : "text-warning"}">${escapeAttribute(nextService)}</strong>`;
        updateRowAction(button, "Service logged", "service-log", true);
        appendDashboardActivity(`${serviceType} logged for ${asset} by ${technician}; condition: ${condition}`);
    }
    if (dashboardRole === "resident" && action === "notify") {
        pushResidentInboxItem({
            type: "Contact Admin",
            title: values[0] || "Resident message",
            details: `${values[1] || "General"} - ${values[2] || "No message"}${values[3] ? ` | Callback: ${values[3]}` : ""}`
        });
        showToast("Message sent to admin");
        return {
            title: "Message sent",
            lines: [
                `<strong>Subject:</strong> ${values[0] || "Resident message"}`,
                `<strong>Category:</strong> ${values[1] || "General"}`,
                `<strong>Message:</strong> ${values[2] || "No message"}`,
                `<strong>Callback:</strong> ${values[3] || "Not requested"}`,
                `<strong>Status:</strong> Visible to Admin and Super Admin`
            ]
        };
    }

    if (dashboardRole === "superadmin" && action === "notify" && context.panel === "subscriptions" && label.includes("export")) {
        const rows = [...document.querySelectorAll('[data-view="subscriptions"] table tbody tr')].map(row =>
            [...row.children].map(cell => cell.textContent.trim()).join(" | ")
        );
        const text = [
            "SmartApartment Subscription Ledger",
            `Generated: ${now}`,
            `Section: ${context.panelTitle}`,
            "",
            ...rows
        ].join("\n");
        downloadText("SmartApartment-subscription-ledger.txt", text);
        appendPlatformActivity("Subscription ledger exported");
        return {
            title: "Subscription ledger exported",
            lines: [
                `<strong>Rows:</strong> ${rows.length}`,
                `<strong>File:</strong> SmartApartment-subscription-ledger.txt`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "subscription-map") {
        const row = button.closest("tr");
        const society = values[0] || row?.children[0]?.textContent.trim() || "Society";
        const currentPlan = values[1] || row?.children[1]?.textContent.trim() || "Current plan";
        const newPlan = values[2] || currentPlan;
        const flatUsage = values[3] || row?.children[2]?.textContent.trim() || "0 / 0";
        const renewal = values[4] || row?.children[3]?.textContent.trim() || "Next billing cycle";
        const adminOwner = values[5] || row?.children[4]?.textContent.trim() || "Society Admin";
        const reviewNote = values[6] || "Mapping reviewed";
        if (row) {
            row.children[0].textContent = society;
            row.children[1].textContent = newPlan;
            row.children[2].textContent = flatUsage;
            row.children[3].textContent = renewal;
            row.children[4].textContent = adminOwner;
            row.children[5].innerHTML = '<span class="status approved">Updated</span>';
        }
        updateRowAction(button, "Reviewed", "subscription-map", true);
        appendPlatformActivity(`Subscription mapping updated: ${society} ${currentPlan} to ${newPlan}`);
        persistDashboardState();
        return {
            title: "Subscription mapping updated",
            lines: [
                `<strong>Society:</strong> ${society}`,
                `<strong>Previous plan:</strong> ${currentPlan}`,
                `<strong>Current plan:</strong> ${newPlan}`,
                `<strong>Flat usage:</strong> ${flatUsage}`,
                `<strong>Renewal:</strong> ${renewal}`,
                `<strong>Admin owner:</strong> ${adminOwner}`,
                `<strong>Note:</strong> ${reviewNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "admin-seat") {
        const row = button.closest("tr");
        const adminName = values[0] || row?.children[0]?.textContent.trim() || "Admin";
        const society = values[1] || row?.children[1]?.textContent.trim() || "Society";
        const role = values[2] || row?.children[2]?.textContent.trim() || "Society Admin";
        const mfa = values[3] || row?.children[4]?.textContent.trim() || "Enabled";
        const decision = values[4] || buttonLabel(button) || "Audited";
        const auditNote = values[5] || "Access reviewed by Super Admin";
        if (row) {
            row.children[0].textContent = adminName;
            row.children[1].textContent = society;
            row.children[2].textContent = role;
            row.children[3].textContent = now;
            row.children[4].textContent = mfa;
            row.children[5].innerHTML = `<span class="status ${statusClass(decision)}">${escapeAttribute(decision)}</span>`;
        }
        updateRowAction(button, decision.toLowerCase().includes("reset") ? "Reset Sent" : "Audited", "admin-seat", true);
        appendPlatformActivity(`Admin access action: ${adminName} - ${decision}`);
        persistDashboardState();
        return {
            title: "Admin access updated",
            lines: [
                `<strong>Admin:</strong> ${adminName}`,
                `<strong>Society:</strong> ${society}`,
                `<strong>Role:</strong> ${role}`,
                `<strong>MFA:</strong> ${mfa}`,
                `<strong>Decision:</strong> ${decision}`,
                `<strong>Audit note:</strong> ${auditNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "billing-rule") {
        const row = button.closest("tr");
        const rule = values[0] || row?.children[0]?.textContent.trim() || "Billing rule";
        const plan = values[1] || row?.children[1]?.textContent.trim() || "Plan";
        const amount = values[2] || row?.children[2]?.textContent.trim() || "Rs. 0";
        const cycle = values[3] || row?.children[3]?.textContent.trim() || "Monthly";
        const grace = values[4] || row?.children[4]?.textContent.trim() || "0 days";
        const effective = values[5] || "Next invoice";
        const ruleNote = values[6] || "Rule reviewed";
        if (row) {
            row.children[0].textContent = rule;
            row.children[1].textContent = plan;
            row.children[2].textContent = amount;
            row.children[3].textContent = cycle;
            row.children[4].textContent = grace;
            row.children[5].innerHTML = '<span class="status approved">Updated</span>';
        }
        updateRowAction(button, "Rule Updated", "billing-rule", true);
        appendPlatformActivity(`Billing rule updated: ${rule} ${amount}`);
        persistDashboardState();
        return {
            title: "Billing rule updated",
            lines: [
                `<strong>Rule:</strong> ${rule}`,
                `<strong>Plan:</strong> ${plan}`,
                `<strong>Amount:</strong> ${amount}`,
                `<strong>Cycle:</strong> ${cycle}`,
                `<strong>Grace:</strong> ${grace}`,
                `<strong>Effective:</strong> ${effective}`,
                `<strong>Note:</strong> ${ruleNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "subscription-audit") {
        const invoiceMonth = values[0] || currentMonthName();
        const includeTrials = values[1] || "Yes";
        const includeRenewals = values[2] || "Yes";
        const auditNote = values[3] || "Dry run only";
        const rows = [...document.querySelectorAll('[data-subpanel="mapping"] tbody tr')].map(row => ({
            society: row.children[0]?.textContent.trim(),
            plan: row.children[1]?.textContent.trim(),
            renewal: row.children[3]?.textContent.trim(),
            status: row.querySelector(".status")?.textContent.trim()
        }));
        downloadText("SmartApartment-invoice-dry-run.txt", [
            "SmartApartment Invoice Dry Run",
            `Invoice month: ${invoiceMonth}`,
            `Include trials: ${includeTrials}`,
            `Include renewal due societies: ${includeRenewals}`,
            `Note: ${auditNote}`,
            `Generated: ${now}`,
            "",
            ...rows.map(row => `${row.society} | ${row.plan} | ${row.renewal} | ${row.status}`)
        ].join("\n"));
        appendPlatformActivity(`Invoice dry run completed for ${invoiceMonth}`);
        return {
            title: "Invoice dry run completed",
            lines: [
                `<strong>Invoice month:</strong> ${invoiceMonth}`,
                `<strong>Societies checked:</strong> ${rows.length}`,
                `<strong>Trials:</strong> ${includeTrials}`,
                `<strong>Renewals:</strong> ${includeRenewals}`,
                `<strong>File:</strong> SmartApartment-invoice-dry-run.txt`
            ]
        };
    }

    if (action === "approve") {
        const panel = button.closest("[data-view]")?.dataset.view;
        if (panel === "flats") {
            setStatus(button, "Occupied", "active");
            updateRowAction(button, "Edit", "save");
        } else if (panel === "residents") {
            setStatus(button, "Active", "active");
            updateRowAction(button, "Notify", "notify");
        } else if (panel === "expenses") {
            setStatus(button, "Approved", "approved");
            updateRowAction(button, "Approved", "approve", true);
        } else if (panel === "amenities") {
            const card = button.closest(".card");
            const status = card?.querySelector(".status");
            if (status) {
                status.textContent = "Approved";
                status.className = "status approved";
            }
            updateRowAction(button, "Approved", "approve", true);
        } else {
            setStatus(button, "Active", "active");
            updateRowAction(button, panel === "users" ? "Notify" : "Suspend", panel === "users" ? "notify" : "suspend");
        }
    }
    if (action === "suspend") {
        setStatus(button, "Suspended", "pending");
        updateRowAction(button, "Approve", "approve");
    }
    if (action === "close") setStatus(button, "Closed", "resolved");
    if (action === "complete") setStatus(button, "Completed", "resolved");
    if (action === "close") updateRowAction(button, "Closed", "close", true);
    if (action === "complete") updateRowAction(button, "Completed", "complete", true);
    if (action === "assign" && dashboardRole !== "maintenance") {
        setStatus(button, "Assigned", "progress");
        updateRowAction(button, "Assigned", "assign", true);
    }
    if (action === "pay") {
        if (dashboardRole === "accountant" && button.closest('[data-table="billing"]')) {
            setStatus(button, "Paid", "paid");
            button.textContent = "Paid";
            button.disabled = true;
            button.dataset.action = "";
            updateBillingStats(button);
            persistDashboardState();
            return { title: "Payment marked as paid", lines: [] };
        }
        if (dashboardRole === "admin" && button.closest('[data-table="billing"]')) {
            const row = button.closest("tr");
            const data = billingRowData(row);
            const paidAt = values[2] || new Date().toLocaleDateString("en-IN");
            const method = values[0] || "Manual verification";
            const ref = values[1] || `SA-${data.flat}-${data.month}`.replace(/\s+/g, "-");
            const proof = values[3] || "Admin verified";
            if (row?.dataset.recordId) {
                mutateSociety(`society/finance/bills/${row.dataset.recordId}/pay`, "POST", {
                    mode: method,
                    transactionId: ref
                }).then(() => loadSocietyBackendData()).catch(error => showToast(error.message || "Payment could not be recorded"));
            }
            setStatus(button, "Paid", "paid");
            button.textContent = "Receipt";
            button.dataset.action = "receipt";
            applyBillingRowMetadata(row, {
                ...data,
                status: "Paid",
                paidAt,
                paymentMethod: method,
                paymentRef: ref,
                proof
            });
            updateBillingStats(button);
            persistDashboardState();
            return showBillingReceipt(row);
        }
        setStatus(button, "Paid", "paid");
        button.textContent = "Receipt";
        button.dataset.action = "receipt";
        updateBillingStats(button);
    }
    if (action === "receipt") {
        const row = button.closest('[data-table="billing"] tr');
        if (dashboardRole === "admin" && row) return showBillingReceipt(row);
        downloadText("smartapartment-billing-receipt.txt", `SmartApartment Billing Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "save" && label.includes("edit")) {
        updateRowFromValues(button, values);
    }
    if (action === "notify" && label.includes("receipt")) {
        downloadText("smartapartment-receipt.txt", `SmartApartment Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("export")) {
        downloadText("smartapartment-report.txt", `SmartApartment Report\nSection: ${context.panelTitle}\nTarget: ${context.target}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("publish")) {
        setInlineState("announcementState", `Published ${now}${note ? ` · ${note}` : ""}`);
    }
    if (action === "save" && label.includes("sync")) syncSocietyWorkspace(note);
    if (action === "save" && context.panel === "profile") {
        const profile = saveResidentProfileState();
        const name = profile?.name || context.target;
        setInlineState("residentProfileState", `Saved ${now} · ${name}`);
    }
    if (dashboardRole === "resident" && action === "book") {
        const booking = updateResidentAmenityBooking(button, values);
        pushResidentInboxItem({
            type: "Amenity Request",
            title: booking?.amenity || "Amenity",
            details: `${booking?.date || "Today"} ${booking?.time || ""} | ${booking?.guests || "Resident"} | ${booking?.purpose || "Personal use"}`
        });
        persistDashboardState();
        showToast(`✓ ${booking?.amenity || "Amenity"} request sent`);
        return {
            title: "Amenity request sent",
            lines: [
                `<strong>Amenity:</strong> ${booking?.amenity || "Amenity"}`,
                `<strong>Slot:</strong> ${booking?.date || "Today"} ${booking?.time || ""}`,
                `<strong>Details:</strong> ${booking?.guests || "Resident"} | ${booking?.purpose || "Personal use"}`,
                `<strong>Status:</strong> Waiting for admin approval`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (action === "book") {
        updateRowAction(button, "Booked", "book", true);
        const card = button.closest(".card");
        const status = card?.querySelector(".status");
        if (status) {
            status.textContent = "Booked";
            status.className = "status approved";
        }
    }
    if (action === "checkin") {
        setStatus(button, "Inside", "progress");
        button.textContent = "Check Out";
        button.dataset.action = "checkout";
        updateVisitorStats(button);
    }
    if (action === "checkout") {
        setStatus(button, "Checked Out", "resolved");
        button.textContent = "Done";
        button.disabled = true;
        updateVisitorStats(button);
    }
    if (action === "update-plan") {
        const card = button.closest(".subscription-plan-card, .card");
        const status = card?.querySelector(".status");
        const plan = button.dataset.plan || context.target;
        const society = values[0] || "Current society";
        const adminEmail = values[1] || "Existing admin";
        const billingCycle = values[2] || "Monthly";
        const startDate = values[3] || "Immediate";
        const subscriptionNote = values[4] || "Subscription confirmed";
        if (status) {
            status.textContent = "Selected";
            status.className = "status approved";
        }
        updateRowAction(button, "Subscribed", "update-plan");
        appendPlatformActivity(`Subscription confirmed: ${society} selected ${plan} (${billingCycle})`);
        if (dashboardRole === "superadmin") {
            persistDashboardState();
            return {
                title: "Subscription confirmed",
                lines: [
                    `<strong>Plan:</strong> ${plan}`,
                    `<strong>Society:</strong> ${society}`,
                    `<strong>Admin:</strong> ${adminEmail}`,
                    `<strong>Billing cycle:</strong> ${billingCycle}`,
                    `<strong>Starts:</strong> ${startDate}`,
                    `<strong>Note:</strong> ${subscriptionNote}`
                ]
            };
        }
    }
    if (action === "notify" && button.matches("button") && button.closest("tr")) updateRowAction(button, "Notified", "notify");
    if (action === "notify" && dashboardRole === "superadmin") {
        appendPlatformActivity(`Notice sent to ${fieldValues[0] || context.target}${fieldValues[1] ? `: ${fieldValues[1]}` : ""}`);
        setInlineState("platformNoticeState", `Last notice sent ${now}`);
    }
    if (action === "add") {
        const table = button.dataset.table;
        if (dashboardRole === "accountant" && table === "incomes") {
            const [category, receivedDate, payer, ledgerReference, amountValue, paymentMethod, paymentReference,
                receiptNumber, creditedAccount, taxAmount, taxTreatment, allocation, documentReference,
                incomeStatus, verifiedBy, notes] = values;
            const amount = Number(amountValue || 0);
            if (!category || !receivedDate || !payer || !Number.isFinite(amount) || amount <= 0 || !paymentMethod) {
                return { title: "Income details required", lines: ["Enter the category, received date, payer, positive amount and payment method before recording income."] };
            }
            const status = incomeStatus || "RECEIVED";
            const statusClass = status === "RECEIVED" ? "success" : status === "PARTIALLY_RECEIVED" ? "warning text-dark" : status === "REVERSED" ? "danger" : "secondary";
            const categoryLabel = category.replaceAll("_", " ");
            const source = `${payer}${ledgerReference ? ` · ${ledgerReference}` : ""}`;
            const description = `${paymentMethod}${paymentReference ? ` · ${paymentReference}` : ""}${receiptNumber ? ` · Receipt ${receiptNumber}` : ""}`;
            addRow("incomes", [
                receivedDate,
                categoryLabel,
                source,
                description,
                `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `<span class="badge bg-${statusClass}">${status.replaceAll("_", " ")}</span>`
            ]);
            persistDashboardState();
            return {
                title: "Income recorded",
                lines: [
                    `<strong>Category:</strong> ${categoryLabel}`,
                    `<strong>Received from:</strong> ${payer}${ledgerReference ? ` · ${ledgerReference}` : ""}`,
                    `<strong>Amount:</strong> Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `<strong>Settlement:</strong> ${paymentMethod}${paymentReference ? ` · ${paymentReference}` : ""}`,
                    `<strong>Receipt:</strong> ${receiptNumber || "Not provided"}${creditedAccount ? ` · ${creditedAccount}` : ""}`,
                    `<strong>Tax:</strong> ${taxAmount ? `Rs. ${taxAmount} · ${taxTreatment}` : taxTreatment || "Not applicable"}`,
                    `<strong>Allocation:</strong> ${allocation || "General income"}`,
                    `<strong>Verification:</strong> ${incomeStatus || "RECEIVED"} · ${verifiedBy || "Not recorded"}`,
                    `<strong>Supporting record:</strong> ${documentReference || "Not attached"}${notes ? ` · ${notes}` : ""}`
                ]
            };
        }
        if (dashboardRole === "accountant" && table === "vendors") {
            const [legalName, tradingName, serviceCategory, serviceScope, businessAddress, gstin, pan,
                contactPerson, mobile, email, emergencyContact, contractReference, contractStart, contractExpiry,
                billingCycle, paymentTerms, serviceLevelAgreement, beneficiaryName, bankName, accountNumber,
                ifsc, paymentMethod, contractValue, complianceReference, verificationStatus, vendorStatus,
                approvedBy, notes] = values;
            if (!legalName || !serviceCategory || !contactPerson || !mobile || !contractReference || !contractStart || !contractExpiry) {
                return { title: "Vendor details required", lines: ["Enter the vendor name, service category, primary contact, mobile number and complete contract dates before onboarding the vendor."] };
            }
            const status = vendorStatus || "PENDING_APPROVAL";
            const statusClass = status === "ACTIVE" ? "success" : status === "ON_HOLD" ? "warning text-dark" : status === "INACTIVE" ? "secondary" : "primary";
            addRow("vendors", [
                legalName,
                serviceCategory.replaceAll("_", " "),
                contactPerson,
                mobile,
                contractExpiry,
                `<span class="badge bg-${statusClass}">${status.replaceAll("_", " ")}</span>`
            ]);
            persistDashboardState();
            return {
                title: "Vendor profile created",
                lines: [
                    `<strong>Vendor:</strong> ${legalName}${tradingName ? ` · ${tradingName}` : ""}`,
                    `<strong>Service:</strong> ${serviceCategory.replaceAll("_", " ")}${serviceScope ? ` · ${serviceScope}` : ""}`,
                    `<strong>Contact:</strong> ${contactPerson} · ${mobile}${email ? ` · ${email}` : ""}`,
                    `<strong>Contract:</strong> ${contractReference} · ${contractStart} to ${contractExpiry}`,
                    `<strong>Commercials:</strong> ${billingCycle} · ${paymentTerms}${contractValue ? ` · Rs. ${Number(contractValue).toLocaleString("en-IN")}` : ""}`,
                    `<strong>Banking:</strong> ${beneficiaryName || "Not provided"}${bankName ? ` · ${bankName}` : ""}${paymentMethod ? ` · ${paymentMethod}` : ""}`,
                    `<strong>Compliance:</strong> ${verificationStatus || "PENDING"}${complianceReference ? ` · ${complianceReference}` : ""}`,
                    `<strong>Status:</strong> ${status.replaceAll("_", " ")}${approvedBy ? ` · ${approvedBy}` : ""}`,
                    `<strong>Notes:</strong> ${notes || "None"}${emergencyContact ? ` · Escalation: ${emergencyContact}` : ""}${businessAddress ? ` · Address: ${businessAddress}` : ""}${gstin ? ` · GSTIN: ${gstin}` : ""}${pan ? ` · PAN: ${pan}` : ""}${ifsc ? ` · IFSC: ${ifsc}` : ""}${accountNumber ? ` · A/C: ${accountNumber}` : ""}${serviceLevelAgreement ? ` · SLA: ${serviceLevelAgreement}` : ""}`
                ]
            };
        }
        if (dashboardRole === "resident" && table === "complaints") {
            const payload = {
                title: values[0] || "Resident complaint",
                category: values[1] || "Plumbing",
                subcategory: values[2] || "General Maintenance",
                priority: values[3] || "NORMAL",
                incidentAt: (values[4] && values[4].trim() !== "") ? values[4].trim() : null,
                locationDetails: values[5] || "Flat 205",
                preferredContactMethod: values[6] || "PHONE",
                reporterPhone: values[7] || "8778293269",
                accessPermission: values[8] === "Yes",
                attachmentReference: values[9] || "",
                description: values[10] || values[0] || "Water leakage assistance required",
                residentId: null,
                assignedTo: ""
            };
            const res = await mutateSociety("society/complaints", "POST", payload);
            loadSocietyBackendData();
            persistSharedComplaint(values);
            pushResidentInboxItem({
                type: "Complaint",
                title: values[0] || payload.title,
                details: `${payload.category} | ${payload.locationDetails} | ${payload.priority} | ${payload.description}`
            });
            persistDashboardState();
            const assignee = res && res.assignedTo ? res.assignedTo : null;
            if (assignee) {
                showToast(`✓ Auto-assigned to ${assignee} (Maintenance TL Busy)`, "success");
            } else {
                showToast("✓ Complaint submitted and notified to Maintenance Team Leader!", "success");
            }
            return {
                title: assignee ? "Complaint Auto-Assigned" : "Complaint Notified to Maintenance",
                lines: [
                    `<strong>Issue:</strong> ${payload.title}`,
                    `<strong>Category:</strong> ${payload.category}`,
                    `<strong>Subcategory:</strong> ${payload.subcategory}`,
                    `<strong>Urgency:</strong> ${payload.priority}`,
                    `<strong>Location:</strong> ${payload.locationDetails}`,
                    `<strong>Contact:</strong> ${payload.preferredContactMethod}${payload.reporterPhone ? ` · ${payload.reporterPhone}` : ""}`,
                    `<strong>Staff entry:</strong> ${payload.accessPermission ? "Yes" : "No"}`,
                    `<strong>Status:</strong> ${assignee ? `⚡ Auto-assigned to ${assignee} (TL Busy)` : "Sent to Maintenance Dashboard"}`
                ]
            };
        }
        if (dashboardRole === "maintenance" && table === "tasks") {
            addMaintenanceTask({
                task: values[0] || "New maintenance task",
                location: values[1] || "Common Area",
                priority: values[2] || "Medium",
                status: "Pending",
                note: `${values[3] || "Maintenance Team"} - ${values[4] || "Today"}${values[5] ? ` - ${values[5]}` : ""}`
            });
            persistDashboardState();
            showToast(`✓ Added maintenance task: ${values[0] || "New maintenance task"}`);
            return {
                title: "Action completed",
                lines: [
                    `<strong>Result:</strong> Added maintenance task: ${values[0] || "New maintenance task"}`,
                    `<strong>Section:</strong> ${context.panelTitle}`,
                    `<strong>Target:</strong> ${values[1] || "Common Area"}`,
                    `<strong>Details:</strong> Priority ${values[2] || "Medium"} | Assigned to ${values[3] || "Maintenance Team"} | Due ${values[4] || "Today"}${values[5] ? ` | ${values[5]}` : ""}`,
                    `<strong>Time:</strong> ${now}`
                ]
            };
        }
        if (dashboardRole === "admin" && table === "residents") {
            const payload={name:values[0],email:values[1],phone:values[2],unitNo:values[3],residentType:values[4]||"TENANT",moveInDate:values[5]||null,vehicleNumber:values[6]||"",address:values[7]||"",emergencyContactName:values[8]||"",emergencyContactPhone:values[9]||"",notes:values[10]||"",temporaryPassword:values[11]};
            mutateSociety("society/residents","POST",payload).then(()=>{loadSocietyBackendData();showToast("Resident account created");}).catch(e=>showToast(e.message));
            appendDashboardActivity(`Resident added: ${payload.name}`);
            const newRes = {
                id: 'RES_' + Date.now(),
                name: payload.name,
                phone: payload.phone,
                email: payload.email,
                unitNo: payload.unitNo,
                type: payload.residentType,
                status: 'Active',
                registeredAt: new Date().toISOString()
            };
            let existingList = JSON.parse(localStorage.getItem('smartapartment_residents') || '[]');
            existingList.unshift(newRes);
            localStorage.setItem('smartapartment_residents', JSON.stringify(existingList));
            if (typeof window.renderSmartApartmentResidents === 'function') window.renderSmartApartmentResidents();
            return {title:"Resident account created",lines:[`<strong>Name:</strong> ${payload.name}`,`<strong>Flat:</strong> ${payload.unitNo}`,`<strong>Type:</strong> ${payload.residentType}`,`<strong>Login:</strong> ${payload.email}`]};
        }
        if (dashboardRole === "admin" && ["security-users","maintenance-users","accountant-users"].includes(table)) {
            const role=table==="security-users"?"SECURITY_STAFF":table==="maintenance-users"?"MAINTENANCE_STAFF":"ACCOUNTANT";
            const payload={name:values[0],email:values[1],phone:values[2],role,designation:values[3],employeeId:values[4]||"",joiningDate:values[5]||null,workShift:values[6]||"",address:values[7]||"",emergencyContactName:values[8]||"",emergencyContactPhone:values[9]||"",notes:values[10]||"",temporaryPassword:values[11]};
            mutateSociety("society/team-users","POST",payload).then(()=>{loadSocietyBackendData();showToast(`${payload.designation} account created`);}).catch(e=>showToast(e.message));
            appendDashboardActivity(`${role.replaceAll("_"," ")} added: ${payload.name}`);
            return {title:"Society team account created",lines:[`<strong>Name:</strong> ${payload.name}`,`<strong>Role:</strong> ${role.replaceAll("_"," ")}`,`<strong>Designation:</strong> ${payload.designation}`,`<strong>Employee ID:</strong> ${payload.employeeId||"Not assigned"}`,`<strong>Login:</strong> ${payload.email}`]};
        }
        const rows = {
            societies: [values[0] || "New Society", values[1] || "Chennai", values[2] || "Standard", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"],
            users: [values[0] || "New User", values[1] || "Resident", values[2] || "Green Nest", "<span class='status pending'>Invited</span>", "<button data-action='approve'>Activate</button>"],
            flats: [values[0] || "D-401", values[1] || "New Owner", values[2] || "Vacant", `<span class='status pending'>${values[3] || "Setup"}</span>`, "<button data-action='approve'>Activate</button>"],
            residents: [values[0] || "New Resident", values[1] || "D-401", values[2] || "Tenant", "<span class='status pending'>Invited</span>", "<button data-action='approve'>Approve</button>"],
            visitors: [values[0] || "New Visitor", values[1] || "D-401", values[2] || "Guest", values[3] || "Today", "<span class='status pending'>Waiting</span>", "<button data-action='checkin'>Check In</button>"],
            complaints: [values[0] || "New Complaint", values[1] || "D-401", values[2] || "Maintenance", "<span class='status open'>Open</span>", "<button data-action='assign'>Assign</button> <button data-action='close'>Close</button>"],
            expenses: [values[0] || "New Expense", values[1] || "Vendor", values[2] || "Rs. 5,000", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"],
            passes: [values[0] || "Visitor", values[1] || "D-401", values[2] || "Today", values[3] || "Guest", "<span class='status approved'>Approved</span>"],
            entries: [values[0] || "New Visitor", values[1] || "99999 00000", values[2] || "D-401", values[3] || "Guest", values[4] || "Resident", "<span class='status pending'>Waiting</span>", "<button data-action='checkin'>Check In</button>"],
            tasks: ["New Task", "Common Area", "Medium", "<span class='status pending'>Pending</span>", "<button data-action='complete'>Complete</button>"]
        };
        addRow(table, rows[table] || ["New Item", "Created", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"]);
        if (table === "passes") {
            upsertExpectedVisitorFromPass({
                visitor: values[0] || "Visitor",
                flat: values[1] || "D-401",
                validUntil: values[2] || "Today"
            });
        }
        if (table === "visitors") updateVisitorStats(button);
        if (dashboardRole === "superadmin") {
            appendPlatformActivity(`${table === "societies" ? "Society registered" : table === "users" ? "User created" : "Record added"}: ${values[0] || "New item"}`);
        }
        if (dashboardRole === "admin") {
            appendDashboardActivity(`${table === "flats" ? "Flat added" : table === "residents" ? "Resident invited" : table === "visitors" ? "Visitor added" : table === "complaints" ? "Complaint ticket created" : table === "expenses" ? "Expense added" : "Record added"}: ${values[0] || "New item"}`);
            if(table==="expenses")mutateSociety("society/finance/expenses","POST",{category:values[0]||"General",vendor:values[1]||"Vendor",amount:Math.max(1,moneyNumber(values[2]||"1")),date:new Date().toISOString().slice(0,10)}).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
            if(table==="flats")mutateSociety("society/apartments","POST",flatPayload(values)).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
            if(table==="visitors")fetch("/api/society/residents").then(r=>r.json()).then(list=>{const resident=list.find(x=>x.unitNo===(values[3]||""));if(!resident)throw new Error("Select a flat that has an active resident");return mutateSociety("society/visitors","POST",{name:values[0],phone:values[1],email:values[2]||"",residentId:resident.id,unitNo:values[3],entryType:values[4]||"GUEST",purpose:values[5]||"Guest visit",personsCount:Number(values[6]||1),expectedAt:values[7]||new Date(Date.now()+3600000).toISOString().slice(0,19),vehicleNumber:values[8]||"",idProofType:values[9]||"",idProofNumber:values[10]||"",photoReference:values[11]||"",specialInstructions:values[12]||""});}).then(()=>{loadSocietyBackendData();showToast("Detailed visitor record created");}).catch(e=>showToast(e.message));
            if(table==="complaints")fetch("/api/society/residents").then(r=>r.json()).then(list=>{const resident=list.find(x=>x.unitNo===(values[1]||""));if(!resident)throw new Error("Select a flat that has an active resident");return mutateSociety("society/complaints","POST",{title:values[0],residentId:resident.id,category:values[2]||"Other",subcategory:values[3]||"",priority:values[4]||"NORMAL",incidentAt:values[5]||null,locationDetails:values[6]||"",preferredContactMethod:values[7]||"IN_APP",reporterPhone:values[8]||resident.phone||"",accessPermission:values[9]==="Yes",assignedTo:values[10]==="Unassigned"?"":values[10]||"",attachmentReference:values[11]||"",description:values[12]||"No additional description provided"});}).then(()=>{loadSocietyBackendData();showToast("Detailed complaint created");}).catch(e=>showToast(e.message));
        }
    }
    if (action === "generate") {
        const month = values[0] || "Current Month";
        const baseRate = values[1] || "1.35";
        const waterRate = values[2] || "3.50";
        const powerFee = values[3] || "253.00";
        const sinkingFee = values[4] || "150.00";
        const repairFee = values[5] || "100.00";
        const parkingFee = values[6] || "100.00";
        const gstRate = values[7] || "18";
        const dueDate = values[8] || "15-Aug-2026";
        const amount = "Rs. 3,600";
        if (["admin", "accountant"].includes(dashboardRole)) {
            const backendAmount = 3600;
            fetch(`/api/billing/generate?amount=${encodeURIComponent(backendAmount)}`, {method:"POST", headers:{Accept:"application/json"}})
                .then(response => response.ok ? response.json() : response.json().then(error => Promise.reject(error)))
                .then(() => loadSocietyBackendData())
                .catch(error => showToast(error.message || "Unable to generate bills"));
            const result = generateMonthlyBillingRows({ month, amount, dueDate, note: `Base:${baseRate}|Water:${waterRate}|GST:${gstRate}%` });
            persistDashboardState();
            return {
                title: "Itemized monthly bills generated",
                lines: [
                    `<strong>Month:</strong> ${month}`,
                    `<strong>Base Rate:</strong> Rs. ${baseRate} / sq.ft`,
                    `<strong>Water Sub-meter:</strong> Rs. ${waterRate} / unit`,
                    `<strong>Power & DG:</strong> Rs. ${powerFee}`,
                    `<strong>Sinking Fund:</strong> Rs. ${sinkingFee}`,
                    `<strong>Repair Fund:</strong> Rs. ${repairFee}`,
                    `<strong>Covered Parking:</strong> Rs. ${parkingFee}`,
                    `<strong>GST Rate:</strong> ${gstRate}%`,
                    `<strong>Due Date:</strong> ${dueDate}`
                ]
            };
        }
        addRow("billing", ["A-305", month, amount, "<span class='status pending'>Unpaid</span>", "<button data-action='pay'>Mark Paid</button>"]);
        updateBillingStats(button);
    }
    const summary = messages[action] || `Completed ${context.target}`;
    if (action === "save" && dashboardRole === "superadmin") {
        setInlineState("settingsSavedAt", `Saved ${now}${note ? ` · ${note}` : ""}`);
        appendPlatformActivity(`Platform settings saved${note ? ` (${note})` : ""}`);
    }
    if ((action === "approve" || action === "suspend") && dashboardRole === "superadmin") {
        appendPlatformActivity(summary);
    }
    if (dashboardRole === "admin" && ["save", "notify", "generate", "pay", "receipt", "book", "approve", "assign", "close", "checkin", "checkout"].includes(action)) {
        appendDashboardActivity(`${summary}${note ? ` (${note})` : ""}`);
    }
    persistDashboardState();
    showToast(`✓ ${summary}`);
    return {
        title: "Action completed",
        lines: [
            `<strong>Result:</strong> ${summary}`,
            `<strong>Section:</strong> ${context.panelTitle}`,
            `<strong>Target:</strong> ${context.target}`,
            note ? `<strong>Details:</strong> ${note}` : "<strong>Details:</strong> No additional note entered",
            `<strong>Time:</strong> ${now}`
        ]
    };
}

async function submitActionModal() {
    if (!activeAction) return;
    const modal = ensureActionModal();
    const fieldScope = modal.querySelector("#dashboardActionFields") || modal;

    const isComplaintAction = activeAction.action === "add" && (
        activeAction.button?.dataset?.table === "complaints" ||
        activeAction.button?.closest?.("table")?.dataset?.table === "complaints" ||
        modal.querySelector("#dashboardActionTitle")?.textContent?.toLowerCase().includes("complaint")
    );

    if (isComplaintAction) {
        const inputs = [...modal.querySelectorAll("[data-action-input]")];
        const categoryVal = inputs[1]?.value?.trim() || "Plumbing";
        const descVal = inputs[10]?.value?.trim() || "";
        const locVal = inputs[5]?.value?.trim() || "Flat 205";

        if (inputs[0] && !inputs[0].value.trim()) {
            const shortDesc = descVal ? (descVal.length > 35 ? descVal.substring(0, 35) + "…" : descVal) : "Maintenance Issue";
            inputs[0].value = `${categoryVal}: ${shortDesc} (${locVal})`;
        }
        if (inputs[2] && !inputs[2].value.trim()) {
            inputs[2].value = "General Maintenance";
        }
        if (inputs[5] && !inputs[5].value.trim()) {
            inputs[5].value = "Flat 205";
        }
        if (inputs[7] && !inputs[7].value.trim()) {
            inputs[7].value = "8778293269";
        }
    }

    if (window.validateRequiredScope && !window.validateRequiredScope(fieldScope)) {
        const firstInvalid = fieldScope.querySelector(".required-field-invalid, :invalid, [aria-invalid='true']");
        if (firstInvalid) {
            const card = modal.querySelector(".modal-card");
            if (card) {
                card.scrollTo({ top: Math.max(0, firstInvalid.offsetTop - 60), behavior: "smooth" });
            }
            firstInvalid.focus({ preventScroll: true });
        }
        const labelText = firstInvalid?.closest("label")?.querySelector("span")?.textContent?.replace("*", "").trim();
        showToast(`Please complete required field: ${labelText || "all required fields"}`, "warning");
        return;
    }
    const values = [...modal.querySelectorAll("[data-action-input]")].map(input => input.value.trim());

    if (dashboardRole === "resident" && activeAction.action === "book") {
        const save = modal.querySelector("#dashboardActionSave");
        save.disabled = true;
        save.textContent = "Submitting…";
        try {
            const receipt = await submitResidentAmenityBooking(activeAction.button, values);
            const saved = await persistWorkflowAction(activeAction.action, activeAction.button, values).catch(() => ({ id: "LOCAL" }));
            receipt.lines.push(`<strong>Database reference:</strong> WF-${saved.id}`);
            activeAction = null;
            showActionReceipt(receipt);
        } catch (error) {
            showToast(error.message || "Amenity request could not be submitted");
        } finally {
            save.disabled = false;
            if (activeAction) save.textContent = "Confirm";
        }
        return;
    }

    const save = modal.querySelector("#dashboardActionSave");
    save.disabled = true;
    save.textContent = "Saving…";
    try {
        const saved = await persistWorkflowAction(activeAction.action, activeAction.button, values).catch(() => ({ id: "LOCAL" }));
        const receipt = await performAction(activeAction.action, activeAction.button, values);
        if (receipt && receipt.lines) {
            receipt.lines.push(`<strong>Database reference:</strong> WF-${saved.id}`);
        }
        activeAction = null;
        if (receipt) showActionReceipt(receipt);
    } catch (error) {
        showToast(error.message || "Action could not be saved");
    } finally {
        save.disabled = false;
        if (activeAction) save.textContent = "Confirm";
    }
}

function enhanceDashboardCategories() {
    document.querySelectorAll("[data-panel]").forEach(button => {
        button.setAttribute("aria-controls", `panel-${button.dataset.panel}`);
        button.setAttribute("aria-selected", String(button.classList.contains("active")));
    });
    document.querySelectorAll("[data-view]").forEach(view => {
        view.id = `panel-${view.dataset.view}`;
        view.tabIndex = -1;
    });

    const routes = rolePanelRoutes[dashboardRole] || [];
    document.querySelectorAll('[data-view="overview"] .stats article').forEach((tile, index) => {
        const target = routes[index];
        if (!target || !document.querySelector(`[data-view="${target}"]`)) return;
        tile.dataset.categoryPanel = target;
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `Open ${titles[target] || target}`);
    });

    document.querySelectorAll(".pill-row span").forEach(chip => {
        chip.dataset.categoryAction = dashboardRole === "resident" ? "book" : "notify";
        chip.tabIndex = 0;
        chip.setAttribute("role", "button");
        chip.setAttribute("aria-label", `Open action for ${chip.textContent.trim()}`);
    });

    document.querySelectorAll('[data-view="overview"] .grid .card').forEach(card => {
        card.dataset.categoryAction = "inspect";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Review ${card.querySelector("h3")?.textContent.trim() || "overview card"}`);
    });

    document.querySelectorAll('[data-view]:not([data-view="overview"]) .stats article').forEach(tile => {
        tile.dataset.categoryAction = "inspect";
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
    });
}

document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => openPanel(button.dataset.panel));
});

document.addEventListener("click", event => {
    const panelBtn = event.target.closest("[data-panel]");
    if (panelBtn && panelBtn.dataset.panel) {
        event.preventDefault();
        openPanel(panelBtn.dataset.panel);
        return;
    }
    const panelTile = event.target.closest("[data-category-panel]");
    if (panelTile) {
        openPanel(panelTile.dataset.categoryPanel);
        return;
    }
    const categoryAction = event.target.closest("[data-category-action]");
    if (categoryAction) {
        openActionModal(categoryAction.dataset.categoryAction, categoryAction);
        return;
    }
    const subscriptionTab = event.target.closest("[data-subtab]");
    if (subscriptionTab) {
        event.preventDefault();
        openSubscriptionSubtab(subscriptionTab.dataset.subtab);
        persistDashboardState();
        return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault();
    openActionModal(button.dataset.action, button);
});

document.addEventListener("keydown", event => {
    const control = event.target.closest("[data-category-panel], [data-category-action]");
    if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        control.click();
    }
    if (event.key === "Escape") closeActionModal();
});

window.addEventListener("hashchange", () => {
    const panel = location.hash.replace("#", "");
    if (panel) openPanel(panel, false);
});

restoreDashboardState();
restoreResidentProfileState();
ensureResidentPortal();
ensureMaintenanceTables();
ensureAdminBillingMetadata();
syncAdminBillingFromPaymentProofs();
syncResidentBillingFromProofs();
syncApprovedPassesToVisitors();
renderResidentInboxForAdmins();
renderPaymentProofReviewForAdmins();
renderSharedComplaintsToTables();
enhanceDashboardCategories();
wireAutosave();

if (dashboardRole === "superadmin") {
    loadPlatformBackendData();
} else {
    loadSocietyBackendData();
    if (["admin", "maintenance"].includes(dashboardRole) && !window.societyComplaintSyncReady) {
        window.societyComplaintSyncReady = true;
        const refreshSharedComplaints = () => {
            if (document.visibilityState === "visible") loadSocietyBackendData();
        };
        window.addEventListener("focus", refreshSharedComplaints);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") refreshSharedComplaints();
        });
        window.setInterval(() => {
            const complaintPanel = document.querySelector('[data-view="complaints"]');
            if (complaintPanel && !complaintPanel.classList.contains("d-none") && !complaintPanel.classList.contains("hidden")) {
                refreshSharedComplaints();
            }
        }, 15000);
    }
}

document.addEventListener("click", event => {
    const btn = event.target.closest('[data-action="edit-plan-modal"]');
    if (!btn) return;
    const modal = document.getElementById("editPlanModal");
    if (!modal) return;
    document.getElementById("editPlanId").value = btn.dataset.planId || "1";
    document.getElementById("editPlanName").value = btn.dataset.planName || "";
    document.getElementById("editPlanPrice").value = btn.dataset.planPrice || "0";
    document.getElementById("editPlanMaxFlats").value = btn.dataset.planFlats || "50";
    document.getElementById("editPlanMaxResidents").value = btn.dataset.planResidents || "150";
    modal.classList.remove("hidden");
});

document.getElementById("closeEditPlanModal")?.addEventListener("click", () => {
    document.getElementById("editPlanModal")?.classList.add("hidden");
});

document.getElementById("savePlanBtn")?.addEventListener("click", async () => {
    const id = document.getElementById("editPlanId").value;
    const name = document.getElementById("editPlanName").value;
    const monthlyPrice = Number(document.getElementById("editPlanPrice").value);
    const maxApartments = Number(document.getElementById("editPlanMaxFlats").value);
    const maxResidents = Number(document.getElementById("editPlanMaxResidents").value);
    const visitorManagement = document.getElementById("editPlanVisitors").checked;
    const amenityBooking = document.getElementById("editPlanAmenities").checked;
    const analytics = document.getElementById("editPlanAnalytics").checked;

    try {
        const response = await fetch(`/api/platform/plans/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name, monthlyPrice, maxApartments, maxResidents,
                visitorManagement, amenityBooking, analytics
            })
        });
        if (!response.ok) throw new Error("Failed to save plan changes");
        showToast(`Plan ${name} updated successfully!`);
        document.getElementById("editPlanModal")?.classList.add("hidden");
        if (typeof loadPlatformBackendData === "function") loadPlatformBackendData();
    } catch (err) {
        showToast(err.message || "Error updating plan");
    }
});

window.generateResidentSelfLink = function() {
    const token = "RES_" + Date.now().toString(36).toUpperCase() + "_" + Math.floor(Math.random() * 1000);
    const fullUrl = `${window.location.origin}/resident/update-details?token=${token}`;
    const urlInput = document.getElementById("generatedResidentUrlInput");
    const previewLink = document.getElementById("previewGeneratedResidentUrl");
    const outputContainer = document.getElementById("residentSelfLinkOutput");
    
    if (urlInput) urlInput.value = fullUrl;
    if (previewLink) previewLink.href = fullUrl;
    if (outputContainer) outputContainer.style.display = "block";
};

window.copyGeneratedResidentUrl = function() {
    const urlInput = document.getElementById("generatedResidentUrlInput");
    if (!urlInput || !urlInput.value) return;
    urlInput.select();
    try {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            showToast("✓ Single-person resident link copied to clipboard!");
        }).catch(() => {
            document.execCommand("copy");
            showToast("✓ Link copied to clipboard!");
        });
    } catch (e) {
        document.execCommand("copy");
        showToast("✓ Link copied to clipboard!");
    }
};

window.renderSmartApartmentResidents = function() {
    const tbody = document.querySelector('[data-table="residents"] tbody');
    if (!tbody) return;
    const residents = JSON.parse(localStorage.getItem("smartapartment_residents") || "[]");
    if (!Array.isArray(residents) || residents.length === 0) return;

    residents.forEach(res => {
        const tokenAttr = res.token || res.id;
        const resName = (res.name || 'Resident').trim();
        const resEmail = (res.email || '').trim().toLowerCase();
        
        // Check if already rendered by token or name/email match
        let existingRow = tbody.querySelector(`tr[data-resident-token="${tokenAttr}"]`);
        if (!existingRow) {
            const allRows = [...tbody.querySelectorAll("tr")];
            const duplicate = allRows.some(row => {
                const text = row.textContent.toLowerCase();
                return (resName && text.includes(resName.toLowerCase())) || (resEmail && text.includes(resEmail));
            });
            if (duplicate) return;

            const contactStr = [res.phone, res.email].filter(Boolean).join(" · ") || "N/A";
            const tr = document.createElement("tr");
            tr.dataset.residentToken = tokenAttr;
            tr.innerHTML = `
                <td><strong>${escapeAttribute(resName)}</strong></td>
                <td>${escapeAttribute(contactStr)}</td>
                <td><span class="badge bg-light text-dark border">${escapeAttribute(res.unitNo || 'Unit')}</span></td>
                <td>${escapeAttribute(res.type || 'TENANT')}</td>
                <td><span class="small text-muted"><i class="fa-solid fa-link text-primary me-1"></i>${res.vehicleNo ? 'Vehicle: ' + escapeAttribute(res.vehicleNo) : 'Self-Registered'}</span></td>
                <td><span class="badge bg-success status active">ACTIVE</span></td>
                <td><button class="btn btn-sm btn-outline-primary" data-action="notify">Notify</button></td>
            `;
            tbody.insertBefore(tr, tbody.firstChild);
        }
    });
};

const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();

document.addEventListener("DOMContentLoaded", () => {
    if (dashboardRole === "superadmin") {
        fetch('/api/platform/overview')
            .then(res => res.json())
            .then(data => {
                const el1 = document.getElementById("overviewActiveSocieties");
                if (el1) el1.textContent = data.activeSocieties || 0;
                
                const el2 = document.getElementById("overviewMonthlyRevenue");
                if (el2) el2.textContent = 'Rs. ' + (data.monthlyRevenue || 0).toLocaleString();
                
                const el3 = document.getElementById("overviewTrialAccounts");
                if (el3) el3.textContent = data.trialAccounts || 0;
                
                const el4 = document.getElementById("overviewOpenTickets");
                if (el4) el4.textContent = data.openTickets || 0;
            })
            .catch(err => console.error("Error fetching overview stats:", err));
    }
    window.renderSmartApartmentResidents();
});

document.addEventListener("input", (e) => {
    if (!e.target) return;
    const target = e.target;
    if (target.type === "tel" || (target.name && /phone|mobile|contact/i.test(target.name)) || (target.id && /phone|mobile|contact/i.test(target.id))) {
        target.value = target.value.replace(/[^0-9]/g, "");
    }
});
