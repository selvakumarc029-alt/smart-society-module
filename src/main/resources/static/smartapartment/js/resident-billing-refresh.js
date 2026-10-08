(() => {
    "use strict";
    if (!["smartapartment", "smartsociety"].includes(document.body?.dataset.platform)
        || document.body.dataset.dashboardRole !== "resident") return;
    let refreshing = false;
    async function refresh() {
        const panel = document.querySelector('[data-view="billing"]');
        if (document.hidden || !panel || panel.classList.contains("d-none") || panel.classList.contains("hidden")
            || refreshing || typeof window.loadSocietyBackendData !== "function") return;
        refreshing = true;
        try { await window.loadSocietyBackendData(); }
        catch (_) { /* Preserve the last confirmed invoice list while offline. */ }
        finally { refreshing = false; }
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("DOMContentLoaded", () => setInterval(refresh, 15000));
})();
