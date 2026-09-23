const toast = document.getElementById("toast");
const nav = document.getElementById("nav");
const menuButton = document.getElementById("menuButton");
const registerModal = document.getElementById("registerModal");
const closeRegisterModal = document.getElementById("closeRegisterModal");
const submitSociety = document.getElementById("submitSociety");
const registerModalTitle = document.getElementById("registerModalTitle");
const superadminModal = document.getElementById("superadminModal");
const closeSuperadminModal = document.getElementById("closeSuperadminModal");
const submitSuperadminLogin = document.getElementById("submitSuperadminLogin");
const superadminUsername = document.getElementById("superadminUsername");
const superadminPassword = document.getElementById("superadminPassword");
const dashboardLoginModal = document.getElementById("dashboardLoginModal");
const closeDashboardLoginModal = document.getElementById("closeDashboardLoginModal");
const submitDashboardLogin = document.getElementById("submitDashboardLogin");
const dashboardLoginTitle = document.getElementById("dashboardLoginTitle");
const dashboardLoginHelp = document.getElementById("dashboardLoginHelp");
const dashboardUsername = document.getElementById("dashboardUsername");
const dashboardPassword = document.getElementById("dashboardPassword");
const toggleDashboardPassword = document.getElementById("toggleDashboardPassword");
const smartForgotPasswordTrigger = document.getElementById("smartForgotPasswordTrigger");
const smartForgotPasswordForm = document.getElementById("smartForgotPasswordForm");
const smartForgotStepEmail = document.getElementById("smartForgotStepEmail");
const smartForgotStepOtp = document.getElementById("smartForgotStepOtp");
const smartForgotStepPassword = document.getElementById("smartForgotStepPassword");
const smartForgotEmail = document.getElementById("smartForgotEmail");
const smartResetOtp = document.getElementById("smartResetOtp");
const smartResetNewPassword = document.getElementById("smartResetNewPassword");
const smartResetConfirmPassword = document.getElementById("smartResetConfirmPassword");
const smartForgotPasswordState = document.getElementById("smartForgotPasswordState");
const smartSendOtpBtn = document.getElementById("smartSendOtpBtn");
const smartVerifyOtpBtn = document.getElementById("smartVerifyOtpBtn");
const smartResetPasswordBtn = document.getElementById("smartResetPasswordBtn");
const smartBackToLoginBtn = document.getElementById("smartBackToLoginBtn");
const toggleSmartResetPassword = document.getElementById("toggleSmartResetPassword");
const roleExperience = document.getElementById("roleExperience");
const roleSearchButton = document.getElementById("roleSearchButton");
const roleFilters = document.getElementById("roleFilters");
const societySearch = document.getElementById("societySearch");

const roleViews = {
    Admin: {
        key: "admin",
        icon: "A",
        label: "Society operations",
        title: "Run the entire community from one command centre.",
        description: "Track collections, residents, service requests and daily operations without switching tools.",
        dashboard: "/dashboards/society-admin",
        dashboardLabel: "Open Admin Dashboard",
        searchLabel: "Search Admin Tools",
        placeholder: "Search billing, residents, complaints or reports...",
        filters: ["Billing", "Residents", "Complaints", "Reports"]
    },
    Resident: {
        key: "resident",
        icon: "R",
        label: "Your home, simplified",
        title: "Everything you need as a resident, close at hand.",
        description: "Pay maintenance, approve visitors, book amenities and follow community updates from one personal space.",
        dashboard: "/dashboards/resident",
        dashboardLabel: "Open Resident App",
        searchLabel: "Search Resident Services",
        placeholder: "Search payments, amenities, notices or requests...",
        filters: ["Pay Dues", "Visitor Pass", "Amenities", "Notices"]
    },
    Security: {
        key: "security",
        icon: "S",
        label: "Gate operations",
        title: "A faster, safer view built for the security desk.",
        description: "Verify visitors, record gate movement and respond to resident approvals with a focused live queue.",
        dashboard: "/dashboards/security",
        dashboardLabel: "Open Security Console",
        searchLabel: "Search Gate Records",
        placeholder: "Search visitor, flat number, pass or vehicle...",
        filters: ["Expected", "Check In", "Gate Log", "Emergency"]
    },
    Maintenance: {
        key: "maintenance",
        icon: "M",
        label: "Service operations",
        title: "Keep every maintenance task moving clearly.",
        description: "Track assigned work, complaint queues, team availability and daily service updates in one compact workspace.",
        dashboard: "/dashboards/maintenance",
        dashboardLabel: "Open Maintenance Console",
        searchLabel: "Search Maintenance Tasks",
        placeholder: "Search task, complaint, flat number or service type...",
        filters: ["Assigned", "In Progress", "Complaints", "Profile"]
    }
};

const roleSearchPanels = {
    Admin: [
        [["bill", "due", "maintenance"], "billing"],
        [["resident", "member", "flat", "block"], "residents"],
        [["visitor", "guest", "gate"], "visitors"],
        [["complaint", "issue", "ticket"], "complaints"],
        [["amenity", "booking", "club", "gym"], "amenities"],
        [["notice", "announcement", "alert"], "announcements"],
        [["expense", "vendor", "cost"], "expenses"],
        [["payment", "collection", "receipt"], "payments"],
        [["report", "analytics", "data"], "reports"]
    ],
    Resident: [
        [["bill", "due", "payment", "maintenance"], "billing"],
        [["visitor", "guest", "pass"], "pass"],
        [["complaint", "issue", "request"], "complaints"],
        [["amenity", "booking", "club", "gym"], "amenities"],
        [["notice", "announcement", "alert"], "announcements"],
        [["profile", "account"], "profile"]
    ],
    Security: [
        [["entry", "check in", "check out", "vehicle", "gate"], "entries"],
        [["pass", "approval", "expected"], "pass"],
        [["visitor", "guest", "flat"], "visitors"]
    ],
    Maintenance: [
        [["task", "assigned", "work", "job"], "tasks"],
        [["complaint", "issue", "ticket", "queue"], "complaints"],
        [["profile", "team", "availability"], "profile"]
    ]
};

let activeRole = "Admin";
let pendingDashboardLogin = null;
let dashboardLoginSubmitting = false;
let smartForgotOtpVerified = false;

const roleAuth = {
    Admin: "admin",
    Resident: "resident",
    Security: "security",
    Maintenance: "maintenance"
};

const dashboardLoginHints = {
    superadmin: ["Super Admin Login", "Sign in to open the platform owner dashboard."],
    admin: ["Society Admin Login", "Sign in to open the society admin dashboard."],
    resident: ["Resident Login", "Sign in to open the resident dashboard."],
    security: ["Security Login", "Sign in to open the security dashboard."],
    maintenance: ["Maintenance Login", "Sign in to open the maintenance dashboard."]
};

const dashboardTargets = {
    superadmin: "/dashboards/superadmin",
    admin: "/dashboards/society-admin",
    resident: "/dashboards/resident",
    security: "/dashboards/security",
    maintenance: "/dashboards/maintenance"
};

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

document.addEventListener("click", (event) => {
    const dashboardLink = event.target.closest("[data-dashboard-login]");
    if (dashboardLink) {
        event.preventDefault();
        openDashboardLogin({
            platform: dashboardLink.dataset.platform,
            role: dashboardLink.dataset.role,
            target: dashboardLink.dataset.target || dashboardLink.getAttribute("href")
        });
        return;
    }

    const protectedLink = event.target.closest("[data-protected='superadmin']");
    if (protectedLink) {
        event.preventDefault();
        openDashboardLogin({ platform: "smartapartment", role: "superadmin", target: "/dashboards/superadmin" });
        return;
    }

    const tab = event.target.closest(".tab");
    if (tab) {
        document.querySelectorAll(".tab").forEach(item => {
            item.classList.remove("active");
            item.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        activeRole = tab.dataset.mode;
        renderRoleView(activeRole);
        return;
    }

    const actionButton = event.target.closest("[data-action]");
    const action = actionButton?.dataset.action;
    if (!action) return;

    const messages = {
        login: "Login flow opened",
        plan: "Subscription plan selected",
        search: "SmartApartment modules searched",
        filter: "Module filter applied",
        platform: "Platform workflow opened"
    };

    if (action === "register") {
        if (registerModalTitle) registerModalTitle.textContent = "Register Society";
        registerModal?.classList.remove("hidden");
        return;
    }

    if (action === "plan") {
        if (registerModalTitle) registerModalTitle.textContent = "Choose Your Plan";
        const planSelect = registerModal?.querySelector("label:last-of-type select");
        if (planSelect) planSelect.value = "Standard";
        registerModal?.classList.remove("hidden");
        window.setTimeout(() => planSelect?.focus(), 80);
        return;
    }

    if (action === "superadmin-login") {
        openDashboardLogin({ platform: "smartapartment", role: "superadmin", target: "/dashboards/superadmin" });
        return;
    }

    if (action === "dashboard-login") {
        openDashboardLogin({ platform: "smartapartment" });
        return;
    }

    if (action === "search") {
        openRoleSearch();
        return;
    }

    if (action === "filter") {
        openRoleFilter(actionButton.textContent.trim());
        return;
    }

    if (action === "platform") {
        if (scrollToSection("modules")) showToast("Platform modules opened");
        return;
    }

    showToast(messages[action] || "Action completed");
});

function openRoleSearch() {
    const query = societySearch?.value.trim().toLowerCase() || "";
    const panels = roleSearchPanels[activeRole] || [];
    const match = panels.find(([keywords]) => keywords.some(keyword => query.includes(keyword)));
    const panel = match?.[1] || "overview";
    const destination = `${roleViews[activeRole].dashboard}#${panel}`;
    showToast(query ? `Opening ${activeRole} results for “${societySearch.value.trim()}”` : `Opening ${activeRole} dashboard`);
    window.setTimeout(() => {
        openDashboardLogin({ platform: "smartapartment", role: roleAuth[activeRole], target: destination });
    }, 180);
}

function openDashboardLogin({ platform, role, target }) {
    pendingDashboardLogin = { platform, role, target };
    setSmartForgotMode(false);
    const [title, help] = role
        ? dashboardLoginHints[role] || ["Dashboard Login", "Sign in to open this dashboard."]
        : ["Login", "Enter your credentials to open your workspace."];
    if (dashboardLoginTitle) dashboardLoginTitle.textContent = title;
    if (dashboardLoginHelp) dashboardLoginHelp.textContent = help;
    if (dashboardUsername) dashboardUsername.value = "";
    if (dashboardPassword) {
        dashboardPassword.value = "";
        dashboardPassword.type = "password";
    }
    if (toggleDashboardPassword) {
        toggleDashboardPassword.textContent = "Show";
        toggleDashboardPassword.setAttribute("aria-label", "Show password");
    }
    dashboardLoginModal?.classList.remove("hidden");
    window.setTimeout(() => dashboardUsername?.focus(), 80);
}

function setSmartForgotMode(enabled) {
    smartForgotOtpVerified = false;
    const loginFields = document.getElementById("dashboardLoginFields");
    if (loginFields) loginFields.classList.toggle("hidden", enabled);
    smartForgotPasswordForm?.classList.toggle("hidden", !enabled);
    submitDashboardLogin?.classList.toggle("hidden", enabled);
    smartForgotPasswordTrigger?.classList.toggle("hidden", enabled);
    if (dashboardUsername) dashboardUsername.disabled = enabled;
    if (dashboardPassword) dashboardPassword.disabled = enabled;
    if (toggleDashboardPassword) toggleDashboardPassword.disabled = enabled;
    if (smartForgotStepEmail) smartForgotStepEmail.classList.remove("hidden");
    if (smartForgotStepOtp) smartForgotStepOtp.classList.add("hidden");
    if (smartForgotStepPassword) smartForgotStepPassword.classList.add("hidden");
    if (smartForgotPasswordState) smartForgotPasswordState.textContent = "";
    if (enabled) {
        if (smartForgotEmail && dashboardUsername?.value) smartForgotEmail.value = dashboardUsername.value;
        if (dashboardLoginTitle) dashboardLoginTitle.textContent = "Reset Password";
        if (dashboardLoginHelp) dashboardLoginHelp.textContent = "Enter your registered SmartSociety email. We will send an OTP to your mailbox.";
        window.setTimeout(() => smartForgotEmail?.focus(), 80);
    } else {
        const role = pendingDashboardLogin?.role;
        const [title, help] = role
            ? dashboardLoginHints[role] || ["Dashboard Login", "Sign in to open this dashboard."]
            : ["Login", "Enter your credentials to open your workspace."];
        if (dashboardLoginTitle) dashboardLoginTitle.textContent = title;
        if (dashboardLoginHelp) dashboardLoginHelp.textContent = help;
        smartForgotPasswordForm?.reset?.();
    }
}

function setSmartForgotState(message, isError = false) {
    if (!smartForgotPasswordState) return;
    smartForgotPasswordState.textContent = message;
    smartForgotPasswordState.style.color = isError ? "#dc2626" : "#047857";
}

async function requestSmartForgotOtp() {
    const email = smartForgotEmail?.value.trim() || "";
    if (!email) {
        setSmartForgotState("Please enter your registered email address.", true);
        return;
    }
    smartSendOtpBtn.disabled = true;
    smartSendOtpBtn.textContent = "Sending OTP...";
    try {
        const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, platform: "smartsociety" })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setSmartForgotState(data.message || "Unable to send OTP. Please check the email address.", true);
            return;
        }
        setSmartForgotState(data.message || "OTP sent to your email address.");
        if (data.otpPreview && smartResetOtp) smartResetOtp.value = data.otpPreview;
        smartForgotStepOtp?.classList.remove("hidden");
        window.setTimeout(() => smartResetOtp?.focus(), 80);
    } catch (error) {
        setSmartForgotState("Network error. Please try again.", true);
    } finally {
        smartSendOtpBtn.disabled = false;
        smartSendOtpBtn.textContent = "Send OTP to Email";
    }
}

async function verifySmartForgotOtp() {
    const email = smartForgotEmail?.value.trim() || "";
    const otp = smartResetOtp?.value.trim() || "";
    if (otp.length !== 6) {
        setSmartForgotState("Please enter the 6-digit OTP sent to your email.", true);
        return;
    }
    smartVerifyOtpBtn.disabled = true;
    smartVerifyOtpBtn.textContent = "Verifying...";
    try {
        const response = await fetch("/api/auth/verify-reset-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setSmartForgotState(data.message || "Invalid or expired OTP.", true);
            return;
        }
        smartForgotOtpVerified = true;
        setSmartForgotState("OTP verified. Now create your new password.");
        smartForgotStepPassword?.classList.remove("hidden");
        window.setTimeout(() => smartResetNewPassword?.focus(), 80);
    } catch (error) {
        setSmartForgotState("Network error. Please try again.", true);
    } finally {
        smartVerifyOtpBtn.disabled = false;
        smartVerifyOtpBtn.textContent = "Verify OTP";
    }
}

async function saveSmartForgotPassword(event) {
    event.preventDefault();
    const email = smartForgotEmail?.value.trim() || "";
    const otp = smartResetOtp?.value.trim() || "";
    const newPassword = smartResetNewPassword?.value || "";
    const confirmPassword = smartResetConfirmPassword?.value || "";
    if (!smartForgotOtpVerified) {
        setSmartForgotState("Please verify the OTP first.", true);
        return;
    }
    if (newPassword.length < 6) {
        setSmartForgotState("New password must be at least 6 characters.", true);
        return;
    }
    if (newPassword !== confirmPassword) {
        setSmartForgotState("Passwords do not match.", true);
        return;
    }
    smartResetPasswordBtn.disabled = true;
    smartResetPasswordBtn.textContent = "Saving...";
    try {
        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setSmartForgotState(data.message || "Password reset failed.", true);
            return;
        }
        if (dashboardUsername) dashboardUsername.value = email;
        if (dashboardPassword) dashboardPassword.value = "";
        setSmartForgotMode(false);
        showToast(data.message || "Password reset successfully. Please login.");
    } catch (error) {
        setSmartForgotState("Network error. Please try again.", true);
    } finally {
        smartResetPasswordBtn.disabled = false;
        smartResetPasswordBtn.textContent = "Save New Password";
    }
}

async function submitDashboardCredentials() {
    if (!pendingDashboardLogin) {
        pendingDashboardLogin = { platform: "smartapartment" };
    }
    if (dashboardLoginSubmitting) return;
    const username = dashboardUsername?.value?.trim() || "";
    const password = dashboardPassword?.value || "";
    if (!username || !password) {
        showToast("Please enter your email and password.");
        if (!username) dashboardUsername?.focus();
        else dashboardPassword?.focus();
        return;
    }
    dashboardLoginSubmitting = true;
    if (submitDashboardLogin) {
        submitDashboardLogin.disabled = true;
        submitDashboardLogin.setAttribute("aria-busy", "true");
        submitDashboardLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2" style="width:1rem;height:1rem;border-width:2px;"></span>Signing in...';
    }
    try {
        const response = await fetch("/api/auth/dashboard-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                platform: pendingDashboardLogin.platform || "smartapartment",
                role: pendingDashboardLogin.role || "",
                username: username,
                password: password
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showToast(data.message || data.error || "Invalid username or password");
            if (submitDashboardLogin) {
                submitDashboardLogin.disabled = false;
                submitDashboardLogin.removeAttribute("aria-busy");
                submitDashboardLogin.textContent = "Login & Open Dashboard";
            }
            dashboardLoginSubmitting = false;
            return;
        }
        if (submitDashboardLogin) {
            submitDashboardLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2" style="width:1rem;height:1rem;border-width:2px;"></span>Opening Dashboard...';
        }
        const target = data.redirect || pendingDashboardLogin.target || "/dashboards/superadmin";
        window.location.replace(target);
    } catch (error) {
        showToast("Login failed. Please try again.");
        if (submitDashboardLogin) {
            submitDashboardLogin.disabled = false;
            submitDashboardLogin.removeAttribute("aria-busy");
            submitDashboardLogin.textContent = "Login & Open Dashboard";
        }
        dashboardLoginSubmitting = false;
    }
}

function openRoleFilter(label) {
    if (societySearch) societySearch.value = label;
    openRoleSearch();
}

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (!section) return false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
}

function readRegisterFields() {
    return [...registerModal.querySelectorAll("input, select")]
        .map(field => field.value?.trim())
        .filter(Boolean);
}

societySearch?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openRoleSearch();
});

function renderRoleView(role) {
    const view = roleViews[role];
    if (!view) return;
    if (roleExperience) roleExperience.dataset.currentRole = view.key;
    if (roleSearchButton) roleSearchButton.textContent = view.searchLabel;
    if (societySearch) societySearch.placeholder = view.placeholder;
    if (roleFilters) roleFilters.innerHTML = view.filters.map(filter => `<button data-action="filter">${filter}</button>`).join("");
}

menuButton?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open") || false;
    menuButton.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
});
closeRegisterModal?.addEventListener("click", () => registerModal?.classList.add("hidden"));
registerModal?.addEventListener("click", (event) => {
    if (event.target === registerModal) registerModal.classList.add("hidden");
});
if (!document.getElementById("registerDetailsForm")) submitSociety?.addEventListener("click", async () => {
    const planSelect = document.getElementById("societyPlanSelect") || document.querySelector("#registerModal select");
    const planName = planSelect ? planSelect.value : "Free Trial";
    const payload = {
        societyName: document.getElementById("societyName")?.value || "",
        contactEmail: document.getElementById("societyAdminEmail")?.value || "",
        phone: document.getElementById("societyPhone")?.value || "",
        address: document.getElementById("societyAddress")?.value || "",
        city: document.getElementById("societyCity")?.value || "",
        adminName: document.getElementById("societyAdminName")?.value || "",
        adminEmail: document.getElementById("societyAdminEmail")?.value || "",
        password: document.getElementById("societyPassword")?.value || "",
        planName: planName
    };
    submitSociety.disabled = true;
    try {
        const response = await fetch("/api/auth/register-tenant", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Registration failed");
        registerModal?.classList.add("hidden");
        showToast(`Workspace provisioned under ${planName} plan! Sign in to enter.`);
        window.setTimeout(() => {
            openDashboardLogin({ platform: "smartapartment", role: "admin", target: "/dashboards/society-admin" });
            if (dashboardUsername) dashboardUsername.value = payload.adminEmail;
        }, 300);
    } catch(error) {
        showToast(error.message);
    } finally {
        submitSociety.disabled = false;
    }
});
closeSuperadminModal?.addEventListener("click", () => superadminModal?.classList.add("hidden"));
superadminModal?.addEventListener("click", (event) => {
    if (event.target === superadminModal) superadminModal.classList.add("hidden");
});
submitSuperadminLogin?.addEventListener("click", () => {
    superadminModal?.classList.add("hidden");
    openDashboardLogin({ platform: "smartapartment", role: "superadmin", target: "/dashboards/superadmin" });
});
closeDashboardLoginModal?.addEventListener("click", () => dashboardLoginModal?.classList.add("hidden"));
dashboardLoginModal?.addEventListener("click", (event) => {
    if (event.target === dashboardLoginModal) dashboardLoginModal.classList.add("hidden");
});
submitDashboardLogin?.addEventListener("click", submitDashboardCredentials);
smartForgotPasswordTrigger?.addEventListener("click", () => setSmartForgotMode(true));
smartBackToLoginBtn?.addEventListener("click", () => setSmartForgotMode(false));
smartSendOtpBtn?.addEventListener("click", requestSmartForgotOtp);
smartVerifyOtpBtn?.addEventListener("click", verifySmartForgotOtp);
smartForgotPasswordForm?.addEventListener("submit", saveSmartForgotPassword);
toggleSmartResetPassword?.addEventListener("click", () => {
    if (!smartResetNewPassword) return;
    const reveal = smartResetNewPassword.type === "password";
    smartResetNewPassword.type = reveal ? "text" : "password";
    toggleSmartResetPassword.textContent = reveal ? "Hide" : "Show";
    smartResetNewPassword.focus();
});
toggleDashboardPassword?.addEventListener("click", () => {
    if (!dashboardPassword) return;
    const reveal = dashboardPassword.type === "password";
    dashboardPassword.type = reveal ? "text" : "password";
    toggleDashboardPassword.textContent = reveal ? "Hide" : "Show";
    toggleDashboardPassword.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    dashboardPassword.focus();
});
dashboardUsername?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        if (!dashboardPassword?.value) dashboardPassword?.focus();
        else submitDashboardCredentials();
    }
});
dashboardPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        submitDashboardCredentials();
    }
});

const loginRequired = new URLSearchParams(window.location.search).get("loginRequired");
if (loginRequired) {
    openDashboardLogin({ platform: "smartapartment" });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
}

setupMotion();

function setupMotion() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = document.querySelectorAll(".owner-banner, .section, .split-section, .service-card, .assist-card");
    targets.forEach((target) => target.classList.add("reveal"));
    if (reducedMotion || !("IntersectionObserver" in window)) {
        targets.forEach((target) => target.classList.add("is-visible"));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    targets.forEach((target) => observer.observe(target));
}
