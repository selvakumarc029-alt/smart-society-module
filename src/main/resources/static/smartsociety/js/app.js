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
        openDashboardLogin({ platform: "smartsociety", role: "superadmin", target: "/dashboards/superadmin" });
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
        search: "SmartSociety modules searched",
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
        openDashboardLogin({ platform: "smartsociety", role: "superadmin", target: "/dashboards/superadmin" });
        return;
    }

    if (action === "dashboard-login") {
        openDashboardLogin({ platform: "smartsociety" });
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
        openDashboardLogin({ platform: "smartsociety", role: roleAuth[activeRole], target: destination });
    }, 180);
}

function openDashboardLogin({ platform, role, target }) {
    pendingDashboardLogin = { platform, role, target };
    const [title, help] = role
        ? dashboardLoginHints[role] || ["Dashboard Login", "Sign in to open this dashboard."]
        : ["Login", "Enter your credentials to open your workspace."];
    if (dashboardLoginTitle) dashboardLoginTitle.textContent = title;
    if (dashboardLoginHelp) dashboardLoginHelp.textContent = help;
    if (dashboardUsername) dashboardUsername.value = "";
    if (dashboardPassword) dashboardPassword.value = "";
    dashboardLoginModal?.classList.remove("hidden");
    window.setTimeout(() => dashboardUsername?.focus(), 80);
}

async function submitDashboardCredentials() {
    if (!pendingDashboardLogin) {
        pendingDashboardLogin = { platform: "smartsociety" };
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
                platform: pendingDashboardLogin.platform || "smartsociety",
                role: pendingDashboardLogin.role || "",
                username: username,
                password: password
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showToast(data.message || "Invalid username or password");
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

menuButton?.addEventListener("click", () => nav?.classList.toggle("open"));
closeRegisterModal?.addEventListener("click", () => registerModal?.classList.add("hidden"));
registerModal?.addEventListener("click", (event) => {
    if (event.target === registerModal) registerModal.classList.add("hidden");
});
submitSociety?.addEventListener("click", () => {
    const values = readRegisterFields();
    const society = values[0] || "Society";
    const plan = values[values.length - 1] || "selected plan";
    registerModal?.classList.add("hidden");
    showToast(`${society} registration submitted with ${plan}`);
});
closeSuperadminModal?.addEventListener("click", () => superadminModal?.classList.add("hidden"));
superadminModal?.addEventListener("click", (event) => {
    if (event.target === superadminModal) superadminModal.classList.add("hidden");
});
submitSuperadminLogin?.addEventListener("click", () => {
    superadminModal?.classList.add("hidden");
    openDashboardLogin({ platform: "smartsociety", role: "superadmin", target: "/dashboards/superadmin" });
});
closeDashboardLoginModal?.addEventListener("click", () => dashboardLoginModal?.classList.add("hidden"));
dashboardLoginModal?.addEventListener("click", (event) => {
    if (event.target === dashboardLoginModal) dashboardLoginModal.classList.add("hidden");
});
submitDashboardLogin?.addEventListener("click", submitDashboardCredentials);
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
    openDashboardLogin({ platform: "smartsociety" });
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
