const fs = require('fs');
const path = require('path');

const srcPath = path.resolve('src/main/resources/static/propertydirect/js/apartments-features.js');
let content = fs.readFileSync(srcPath, 'utf8');

// 1. Replace syncCardCompareButtons definition
const oldSync = `    function syncCardCompareButtons() {
        const compareIds = new Set(compareList.map(c => String(c.id)));
        document.querySelectorAll('.apartment-card').forEach(card => {
            const cardId = String(card.dataset.listingId || '');
            let compBtn = card.querySelector('.btn-card-compare');
            if (!compBtn) {
                // Inject compare button into card actions if missing
                const actions = card.querySelector('.apt-actions');
                if (actions) {
                    compBtn = document.createElement('button');
                    compBtn.type = 'button';
                    compBtn.className = 'btn-card-compare';
                    compBtn.title = 'Add to Comparison';
                    actions.appendChild(compBtn);
                }
            }
            if (compBtn) {
                const isCompared = compareIds.has(cardId);
                compBtn.className = \`btn-card-compare \${isCompared ? 'active' : ''}\`;
                compBtn.innerHTML = isCompared
                    ? \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Compared\`
                    : \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="8" height="18" rx="2"/><rect x="14" y="3" width="8" height="18" rx="2"/></svg> Compare\`;
                compBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCompareProperty(cardId);
                };
            }
        });
    }`;

const newSync = `    let isSyncingCards = false;
    function syncCardCompareButtons() {
        if (isSyncingCards) return;
        isSyncingCards = true;

        try {
            const compareIds = new Set(compareList.map(c => String(c.id)));
            const cards = document.querySelectorAll('#apartmentResults .apartment-card, .apartment-card');

            cards.forEach(card => {
                const cardId = String(card.dataset.listingId || '');
                if (!cardId) return;

                const isCompared = compareIds.has(cardId);
                let compBtn = card.querySelector('.btn-card-compare');

                if (!compBtn) {
                    const actions = card.querySelector('.apt-actions');
                    if (actions) {
                        compBtn = document.createElement('button');
                        compBtn.type = 'button';
                        compBtn.className = 'btn-card-compare';
                        compBtn.title = 'Add to Comparison';
                        actions.appendChild(compBtn);
                    }
                }

                if (compBtn) {
                    // CRITICAL: Only touch DOM if comparison state actually changed!
                    const currentComparedState = compBtn.getAttribute('data-compared');
                    const targetState = String(isCompared);

                    if (currentComparedState !== targetState) {
                        compBtn.setAttribute('data-compared', targetState);
                        compBtn.className = \`btn-card-compare \${isCompared ? 'active' : ''}\`;
                        compBtn.innerHTML = isCompared
                            ? \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Compared\`
                            : \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="8" height="18" rx="2"/><rect x="14" y="3" width="8" height="18" rx="2"/></svg> Compare\`;

                        compBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCompareProperty(cardId);
                        };
                    }
                }
            });
        } finally {
            setTimeout(() => {
                isSyncingCards = false;
            }, 60);
        }
    }`;

// 2. Replace MutationObserver initialization
const oldObserver = `        // Observe #apartmentResults for card injections
        const resultsEl = document.getElementById('apartmentResults');
        if (resultsEl) {
            const observer = new MutationObserver(() => {
                syncCardCompareButtons();
            });
            observer.observe(resultsEl, { childList: true, subtree: true });
            syncCardCompareButtons();
        }`;

const newObserver = `        // Observe #apartmentResults for card additions (debounced, NO deep subtree mutation loops)
        const resultsEl = document.getElementById('apartmentResults');
        if (resultsEl) {
            let debounceTimer = null;
            const observer = new MutationObserver((mutations) => {
                if (isSyncingCards) return;

                const hasCardChanges = mutations.some(m => {
                    return Array.from(m.addedNodes || []).some(n => n.nodeType === 1 && (n.classList?.contains('apartment-card') || n.querySelector?.('.apartment-card'))) ||
                           Array.from(m.removedNodes || []).some(n => n.nodeType === 1 && (n.classList?.contains('apartment-card') || n.querySelector?.('.apartment-card')));
                });

                if (hasCardChanges) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        syncCardCompareButtons();
                    }, 80);
                }
            });

            // Observe ONLY direct childList additions (new apartment-card children), NOT deep subtree!
            observer.observe(resultsEl, { childList: true });
            syncCardCompareButtons();
        }`;

// Normalize line endings for replacement
const normContent = content.replace(/\r\n/g, '\n');
const normOldSync = oldSync.replace(/\r\n/g, '\n');
const normNewSync = newSync.replace(/\r\n/g, '\n');
const normOldObs = oldObserver.replace(/\r\n/g, '\n');
const normNewObs = newObserver.replace(/\r\n/g, '\n');

if (normContent.includes(normOldSync)) {
    console.log('✓ Found oldSync');
} else {
    console.error('❌ oldSync not found');
}

if (normContent.includes(normOldObs)) {
    console.log('✓ Found oldObserver');
} else {
    console.error('❌ oldObserver not found');
}

let updated = normContent.replace(normOldSync, normNewSync).replace(normOldObs, normNewObs);

// Convert back to CRLF if needed
if (content.includes('\r\n')) {
    updated = updated.replace(/\n/g, '\r\n');
}

fs.writeFileSync(srcPath, updated, 'utf8');
console.log('✓ Wrote updated apartments-features.js to src');

const targetPath = path.resolve('target/classes/static/propertydirect/js/apartments-features.js');
if (fs.existsSync(path.dirname(targetPath))) {
    fs.writeFileSync(targetPath, updated, 'utf8');
    console.log('✓ Copied updated apartments-features.js to target');
}
