(function () {
    'use strict';
    const societyPlatforms = new Set(['smartapartment', 'smartsociety']);
    function init() {
        const body = document.body;
        if (!body || !societyPlatforms.has(body.dataset.platform) || !body.dataset.dashboardRole) return;
        // Animated panels create containing blocks that can hide fixed-position dialogs.
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.parentElement !== body) body.appendChild(modal);
        });
        const topbar = document.querySelector('main .topbar');
        if (topbar && typeof ResizeObserver === 'function') {
            let previousHeight = 0;
            const measure = () => {
                const height = Math.ceil(topbar.getBoundingClientRect().height);
                if (height > 0 && height !== previousHeight) {
                    previousHeight = height;
                    body.style.setProperty('--dashboard-topbar-height', height + 'px');
                }
            };
            new ResizeObserver(measure).observe(topbar);
            measure();
        }
        // A newly selected panel starts at its heading, rather than inheriting
        // the old panel's scroll offset underneath the sticky header.
        let currentPanel = window.location.hash;
        let scheduled = false;
        function alignSelectedPanel() {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                const panel = document.querySelector('[data-view]:not(.hidden):not(.d-none)');
                const key = panel?.dataset.view || window.location.hash;
                if (!panel || key === currentPanel) return;
                currentPanel = key;
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                for (const container of [document.scrollingElement, document.querySelector('main'), document.querySelector('.main-content'), document.querySelector('.dashboard-container')]) {
                    if (container) container.scrollTop = 0;
                }
            });
        }
        currentPanel = document.querySelector('[data-view]:not(.hidden):not(.d-none)')?.dataset.view || currentPanel;
        window.addEventListener('click', event => {
            if (event.target.closest?.('[data-panel]')) alignSelectedPanel();
        }, true);
        window.addEventListener('hashchange', alignSelectedPanel);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
