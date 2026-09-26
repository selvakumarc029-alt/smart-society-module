(() => {
    "use strict";

    const body = document.body;
    if (!body.matches(".dashboard-body, .app-dashboard")) return;

    const platform = "SmartApartment";
    const role = body.dataset.dashboardRole || "user";
    const roleNames = {
        superadmin: "Super Admin",
        admin: "Society Admin",
        resident: "Resident Workspace",
        security: "Security Console",
        maintenance: "Maintenance Desk",
        customer: "Customer Workspace",
        agent: "Agent Workspace",
        vendor: "Vendor Workspace",
        accountant: "Accountant Desk"
    };
    const roleName = roleNames[role] || "Workspace";
    const sidebar = document.querySelector(".sidebar, #sidebar, .dash-sidebar, .vendor-sidebar, .agent-sidebar");
    const brand = sidebar?.querySelector(".brand, .dash-brand, .agent-brand, .vendor-brand, .sidebar-header");
    const navigation = sidebar?.querySelector("nav, .sidebar-nav, .agent-nav, .vendor-nav, #sidebarNav");
    const header = document.querySelector(".header, .topbar, .dash-header, .vendor-top, .agent-top, .agent-header");

    body.classList.add("dashboard-redesign");

    function injectUnifiedSidebarContract() {
        if (document.getElementById("dashboardRuntimeSidebarContract")) return;
        const style = document.createElement("style");
        style.id = "dashboardRuntimeSidebarContract";
        style.textContent = `
            body.dashboard-body,
            body.app-dashboard {
                --dashboard-sidebar-width: 300px;
                --dashboard-topbar-height: 82px;
                width: 100% !important;
                min-width: 0 !important;
                margin: 0 !important;
            }
            .modal:not(.show):not(.active),
            .modal.hidden,
            #homeServicePackageModal:not(.show),
            #partnerAdminEditorModal:not(.show),
            #gatewayConfigModal:not(.show),
            #bookingDetailsDrawerOverlay:not(.open) {
                display: none !important;
                pointer-events: none !important;
                visibility: hidden !important;
                z-index: -9999 !important;
            }
            .modal.show {
                display: block !important;
                pointer-events: auto !important;
                visibility: visible !important;
                z-index: 1065 !important;
            }
            @media (min-width: 901px) {
                body.dashboard-body,
                body.app-dashboard {
                    height: 100vh !important;
                    height: 100dvh !important;
                    overflow: hidden !important;
                }
                body.dashboard-body :is(.dashboard-layout, .app-shell, .dash-shell, .agent-shell),
                body.app-dashboard :is(.dashboard-layout, .app-shell, .dash-shell, .agent-shell) {
                    width: 100% !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    min-height: 0 !important;
                    display: flex !important;
                    align-items: stretch !important;
                    overflow: hidden !important;
                }
                body.dashboard-body:not(.dashboard-sidebar-collapsed) :is(.sidebar, #sidebar),
                body.app-dashboard:not(.dashboard-sidebar-collapsed) :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) {
                    position: fixed !important;
                    inset: 0 auto 0 0 !important;
                    top: 0 !important;
                    left: 0 !important;
                    bottom: 0 !important;
                    width: var(--dashboard-sidebar-width) !important;
                    min-width: var(--dashboard-sidebar-width) !important;
                    max-width: var(--dashboard-sidebar-width) !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    transform: none !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    z-index: 1040 !important;
                    box-sizing: border-box !important;
                }
                body.dashboard-body.dashboard-sidebar-collapsed :is(.sidebar, #sidebar),
                body.app-dashboard.dashboard-sidebar-collapsed :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) {
                    transform: translateX(-100%) !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: fixed !important;
                    inset: 0 auto 0 0 !important;
                    width: var(--dashboard-sidebar-width) !important;
                    z-index: 1040 !important;
                }
                body.dashboard-body:not(.dashboard-sidebar-collapsed) :is(.dashboard-menu-toggle, .dashboard-sidebar-close, .dashboard-sidebar-open),
                body.app-dashboard:not(.dashboard-sidebar-collapsed) :is(.dashboard-menu-toggle, .dashboard-sidebar-close, .dashboard-sidebar-open, .pd-sidebar-close, .pd-sidebar-cancel, .pd-sidebar-reopen) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                }
                body.dashboard-body.dashboard-sidebar-collapsed .dashboard-menu-toggle,
                body.app-dashboard.dashboard-sidebar-collapsed .dashboard-menu-toggle {
                    display: inline-flex !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    width: auto !important;
                    min-width: 42px !important;
                    height: 42px !important;
                    pointer-events: auto !important;
                }
                body.dashboard-body :is(.sidebar, #sidebar) :is(.sidebar-header, .brand, .dash-brand, .agent-brand, .vendor-brand),
                body.app-dashboard :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) :is(.sidebar-header, .brand, .dash-brand, .agent-brand, .vendor-brand) {
                    flex: 0 0 var(--dashboard-topbar-height) !important;
                    height: var(--dashboard-topbar-height) !important;
                    min-height: var(--dashboard-topbar-height) !important;
                    max-height: var(--dashboard-topbar-height) !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 26px !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 14px !important;
                    overflow: hidden !important;
                    box-sizing: border-box !important;
                }
                body.dashboard-body :is(.sidebar, #sidebar) :is(.sidebar-nav, .nav, nav, .agent-nav, .vendor-nav),
                body.app-dashboard :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) :is(.sidebar-nav, .nav, nav, .agent-nav, .vendor-nav) {
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 16px 20px 12px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    flex-wrap: nowrap !important;
                    gap: 8px !important;
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                    scrollbar-gutter: stable !important;
                    box-sizing: border-box !important;
                }
                body.dashboard-body :is(.sidebar, #sidebar) :is(a, button, .nav-link),
                body.app-dashboard :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) :is(a, button, .nav-link) {
                    width: 100% !important;
                    min-width: 0 !important;
                    max-width: 100% !important;
                    min-height: 48px !important;
                    margin: 0 !important;
                    padding: 12px 16px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    gap: 12px !important;
                    text-align: left !important;
                    white-space: normal !important;
                    word-break: normal !important;
                    overflow-wrap: normal !important;
                    writing-mode: horizontal-tb !important;
                    text-orientation: mixed !important;
                    line-height: 1.25 !important;
                    box-sizing: border-box !important;
                }
                body.dashboard-body:not(.dashboard-sidebar-collapsed) :is(.main, .main-content),
                body.app-dashboard:not(.dashboard-sidebar-collapsed) :is(.dash-main, .vendor-main, .agent-main, .main-content) {
                    margin: 0 0 0 var(--dashboard-sidebar-width) !important;
                    width: calc(100% - var(--dashboard-sidebar-width)) !important;
                    max-width: calc(100% - var(--dashboard-sidebar-width)) !important;
                    min-width: 0 !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                    box-sizing: border-box !important;
                    background: #f8fafc !important;
                }
                body.dashboard-body.dashboard-sidebar-collapsed :is(.main, .main-content),
                body.app-dashboard.dashboard-sidebar-collapsed :is(.dash-main, .vendor-main, .agent-main, .main-content) {
                    margin: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                    box-sizing: border-box !important;
                    background: #f8fafc !important;
                }
                body.dashboard-body :is(.header, .topbar),
                body.app-dashboard :is(.dash-header, .vendor-top, .agent-top, .agent-header) {
                    flex: 0 0 var(--dashboard-topbar-height) !important;
                    min-height: var(--dashboard-topbar-height) !important;
                    height: var(--dashboard-topbar-height) !important;
                    max-height: none !important;
                    margin: 0 !important;
                    padding: 16px 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    gap: 14px !important;
                    flex-wrap: wrap !important;
                    border-radius: 0 !important;
                    box-sizing: border-box !important;
                }
            }
            @media (max-width: 900px) {
                body.dashboard-body,
                body.app-dashboard {
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                    height: auto !important;
                }
                body.dashboard-body.dashboard-menu-open,
                body.app-dashboard.dashboard-menu-open {
                    overflow: hidden !important;
                }
                body.dashboard-body :is(.sidebar, #sidebar),
                body.app-dashboard :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) {
                    position: fixed !important;
                    inset: 0 auto 0 0 !important;
                    top: 0 !important;
                    left: 0 !important;
                    bottom: 0 !important;
                    width: min(320px, calc(100vw - 32px)) !important;
                    min-width: 0 !important;
                    max-width: calc(100vw - 32px) !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    transform: translateX(-100%) !important;
                    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    z-index: 1050 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    box-shadow: 4px 0 30px rgba(0,0,0,0.3) !important;
                }
                body.dashboard-body.dashboard-menu-open :is(.sidebar, #sidebar),
                body.app-dashboard.dashboard-menu-open :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar),
                body.sidebar-open :is(.sidebar, #sidebar, .dash-sidebar, .vendor-sidebar, .agent-sidebar) {
                    transform: translateX(0) !important;
                }
                body.dashboard-body :is(.main, .main-content),
                body.app-dashboard :is(.dash-main, .vendor-main, .agent-main, .main-content) {
                    margin: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    padding: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow-x: hidden !important;
                    overflow-y: visible !important;
                    background: #f8fafc !important;
                }
                body.dashboard-body .dashboard-menu-toggle,
                body.app-dashboard .dashboard-menu-toggle {
                    display: inline-flex !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
                body.dashboard-body :is(.sidebar, #sidebar) .dashboard-sidebar-close,
                body.app-dashboard :is(.dash-sidebar, .vendor-sidebar, .agent-sidebar, .sidebar, #sidebar) :is(.dashboard-sidebar-close, .pd-sidebar-close) {
                    display: inline-flex !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
                .dashboard-scrim {
                    position: fixed !important;
                    inset: 0 !important;
                    background: rgba(15, 23, 42, 0.5) !important;
                    backdrop-filter: blur(4px) !important;
                    z-index: 1045 !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    transition: opacity 0.25s ease, visibility 0.25s ease !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                body.dashboard-menu-open .dashboard-scrim,
                body.sidebar-open .dashboard-scrim {
                    opacity: 1 !important;
                    visibility: visible !important;
                    pointer-events: auto !important;
                }
            }
        `;
        document.head.append(style);
    }

    injectUnifiedSidebarContract();

    if (brand && !brand.querySelector(".dashboard-brand-mark, .sidebar-home-mark, .agent-brand-icon, .vendor-brand-icon, .brand-mark") && !brand.querySelector("h4, span, strong")) {
        brand.setAttribute("aria-label", `${platform} home`);
        const mark = document.createElement("span");
        mark.className = "dashboard-brand-mark";
        mark.textContent = "⌂";
        mark.setAttribute("aria-hidden", "true");
        brand.append(mark);
    }

    let closeButton = sidebar?.querySelector(".dashboard-sidebar-close, .pd-sidebar-close");
    if (sidebar && !closeButton) {
        closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "dashboard-sidebar-close";
        closeButton.setAttribute("aria-label", "Close dashboard navigation");
        closeButton.innerHTML = "<span aria-hidden=\"true\">&times;</span>";
        sidebar.prepend(closeButton);
    }

    let menuButton = header?.querySelector(".dashboard-menu-toggle, .vendor-sidebar-toggle");
    if (!menuButton) {
        menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "dashboard-menu-toggle";
        menuButton.setAttribute("aria-label", "Open dashboard navigation");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.innerHTML = "<span></span>";
        if (header) header.prepend(menuButton);
    }

    if (header && !header.querySelector(".dashboard-header-meta")) {
        const meta = document.createElement("div");
        meta.className = "dashboard-header-meta";
        const status = document.createElement("span");
        status.className = "dashboard-live-status";
        status.innerHTML = "<i aria-hidden=\"true\"></i>Live workspace";
        const avatar = document.createElement("span");
        avatar.className = "dashboard-avatar";
        avatar.textContent = roleName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
        avatar.title = roleName;
        meta.append(status, avatar);
        header.append(meta);
    }

    function placeThemeToggle() {
        const meta = header?.querySelector(".dashboard-header-meta");
        const themeToggle = document.getElementById("themeToggle");
        if (themeToggle && meta && !themeToggle.closest("#electricalSwitchFixed, .fixed-electrical-switch") && !meta.contains(themeToggle)) {
            meta.prepend(themeToggle);
        }
    }

    placeThemeToggle();
    document.addEventListener("DOMContentLoaded", placeThemeToggle, { once: true });

    let scrim = document.querySelector(".dashboard-scrim");
    if (!scrim) {
        scrim = document.createElement("button");
        scrim.type = "button";
        scrim.className = "dashboard-scrim";
        scrim.setAttribute("aria-label", "Close dashboard navigation");
        body.append(scrim);
    }

    function setMenu(open) {
        if (open) {
            body.classList.remove("dashboard-sidebar-collapsed");
            body.classList.add("dashboard-menu-open");
            body.classList.add("sidebar-open");
        } else {
            body.classList.remove("dashboard-menu-open");
            body.classList.remove("sidebar-open");
        }
        menuButton?.setAttribute("aria-expanded", String(open));
        menuButton?.setAttribute("aria-label", open ? "Close dashboard navigation" : "Open dashboard navigation");
    }

    function closeSidebar() {
        if (window.matchMedia("(max-width: 900px)").matches) {
            setMenu(false);
            return;
        }
        setMenu(false);
        body.classList.add("dashboard-sidebar-collapsed");
    }

    menuButton?.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            const isOpen = body.classList.contains("dashboard-menu-open") || body.classList.contains("sidebar-open");
            setMenu(!isOpen);
            return;
        }
        if (body.classList.contains("dashboard-sidebar-collapsed")) {
            body.classList.remove("dashboard-sidebar-collapsed");
            menuButton?.setAttribute("aria-expanded", "true");
        } else {
            body.classList.add("dashboard-sidebar-collapsed");
            menuButton?.setAttribute("aria-expanded", "false");
        }
    });

    sidebar?.querySelectorAll(".dashboard-sidebar-close, .pd-sidebar-close, .pd-sidebar-cancel").forEach(btn => {
        btn.addEventListener("click", closeSidebar);
    });

    scrim?.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setMenu(false);
    });

    sidebar?.querySelectorAll("[data-panel]").forEach(button => {
        button.addEventListener("click", () => {
            window.setTimeout(() => syncNavigation(), 0);
            if (window.matchMedia("(max-width: 900px)").matches) setMenu(false);
        });
    });

    function syncNavigation() {
        sidebar?.querySelectorAll("[data-panel]").forEach(button => {
            const active = button.classList.contains("active");
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
    }
    syncNavigation();

    document.querySelectorAll("table").forEach(table => {
        if (table.parentElement?.classList.contains("dashboard-table-scroll")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "dashboard-table-scroll";
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", "Scrollable data table");
        wrapper.tabIndex = 0;
        table.before(wrapper);
        wrapper.append(table);
    });

    const panelObserver = new MutationObserver(syncNavigation);
    document.querySelectorAll("[data-panel]").forEach(button => {
        panelObserver.observe(button, { attributes: true, attributeFilter: ["class"] });
    });

    function setupSidebarWheelScroll() {
        document.querySelectorAll('.sidebar, #sidebar, .dash-sidebar, .vendor-sidebar, .agent-sidebar').forEach(sidebarEl => {
            const navEl = sidebarEl.querySelector('.sidebar-nav, nav, .agent-nav, .vendor-nav, #sidebarNav');
            if (!navEl) return;
            sidebarEl.addEventListener('wheel', (e) => {
                if (e.ctrlKey || e.shiftKey) return;
                if (!navEl.contains(e.target)) {
                    navEl.scrollTop += e.deltaY;
                }
            }, { passive: true });
        });
    }
    setupSidebarWheelScroll();
    document.addEventListener("DOMContentLoaded", setupSidebarWheelScroll);

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            setMenu(false);
        } else {
            body.classList.remove("dashboard-sidebar-collapsed");
        }
    }, { passive: true });
})();
