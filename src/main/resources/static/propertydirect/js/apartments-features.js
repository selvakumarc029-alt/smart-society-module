/**
 * PropertyDirect Apartments Features - Real-Time CRUD Engine
 * 1. Search Properties (Live filtering, focus & scroll)
 * 2. Saved Searches (Create, Read, Apply/Update, Delete in Real Time)
 * 3. Compare Properties (Create/Add, Read matrix, Remove/Delete, Clear in Real Time)
 * 4. Recently Viewed (Create/Track, Read timeline, Remove/Delete, Clear in Real Time)
 */

(function () {
    'use strict';

    // Local Storage Keys
    const STORAGE_SAVED_SEARCHES = 'pd_saved_searches_local:v1';
    const STORAGE_COMPARE = 'pd_compare_properties:v1';
    const STORAGE_RECENT = 'pd_recently_viewed:v1';

    // In-memory caches
    let compareList = [];
    let recentlyViewedList = [];
    let savedSearchesList = [];

    // Initialize lists from storage
    try {
        compareList = JSON.parse(localStorage.getItem(STORAGE_COMPARE) || '[]');
    } catch (e) {
        compareList = [];
    }

    try {
        recentlyViewedList = JSON.parse(localStorage.getItem(STORAGE_RECENT) || '[]');
    } catch (e) {
        recentlyViewedList = [];
    }

    try {
        savedSearchesList = JSON.parse(localStorage.getItem(STORAGE_SAVED_SEARCHES) || '[]');
    } catch (e) {
        savedSearchesList = [];
    }

    // Toast helper
    function notify(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
            return;
        }
        let toastEl = document.getElementById('toast');
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = 'toast';
            toastEl.className = 'toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = message;
        toastEl.classList.remove('hidden');
        toastEl.style.display = 'block';
        clearTimeout(notify.timer);
        notify.timer = setTimeout(() => {
            toastEl.classList.add('hidden');
            toastEl.style.display = 'none';
        }, 2600);
    }

    // =========================================================================
    // 1. FEATURE: SEARCH PROPERTIES
    // =========================================================================
    window.triggerPropertySearchFocus = function () {
        const searchInput = document.getElementById('listingSearch');
        const searchbar = document.querySelector('.apartment-searchbar');
        if (searchInput) {
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            searchInput.focus();
            if (searchbar) {
                searchbar.classList.add('searchbar-glow-pulse');
                setTimeout(() => searchbar.classList.remove('searchbar-glow-pulse'), 1600);
            }
        }
        notify('Type locality, project or bedrooms to filter in real time.');
    };

    // =========================================================================
    // 2. FEATURE: SAVED SEARCHES (REAL-TIME CRUD)
    // =========================================================================

    // READ: Load saved searches from backend API with localStorage sync
    window.loadSavedSearches = async function () {
        try {
            const res = await fetch('/api/property/saved-searches', {
                headers: { Accept: 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Merge remote and local (avoid duplicates by name/id)
                    const remoteIds = new Set(data.map(d => String(d.id)));
                    const locals = savedSearchesList.filter(l => !remoteIds.has(String(l.id)));
                    savedSearchesList = [...data, ...locals];
                    localStorage.setItem(STORAGE_SAVED_SEARCHES, JSON.stringify(savedSearchesList));
                }
            }
        } catch (e) {
            console.warn('Backend saved-searches unavailable, using local store:', e);
        }
        updateSavedSearchesBadges();
        renderSavedSearchesList();
    };

    function updateSavedSearchesBadges() {
        const count = savedSearchesList.length;
        document.querySelectorAll('.saved-searches-count').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
        const toolbarBadge = document.getElementById('savedSearchesCountBadge');
        if (toolbarBadge) toolbarBadge.textContent = count;
        const navBadge = document.getElementById('navSavedSearchesCount');
        if (navBadge) navBadge.textContent = count;
    }

    // CREATE: Save search in real time
    window.saveCurrentSearch = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const form = document.getElementById('newSavedSearchForm');
        const nameInput = document.getElementById('savedSearchName');
        const name = (nameInput?.value || '').trim() ||
            `${document.getElementById('listingCity')?.value || 'All Cities'} ${document.getElementById('listingSearch')?.value || 'Listings'}`.trim();

        const city = document.getElementById('listingCity')?.value || '';
        const locality = document.getElementById('listingSearch')?.value || '';
        const minPrice = document.getElementById('minBudgetRange')?.value || null;
        const maxPrice = document.getElementById('budgetRange')?.value || null;
        const alertsEnabled = document.getElementById('savedSearchAlerts')?.checked !== false;

        const payload = {
            name,
            city,
            locality,
            type: window.activeSearchMode ? window.activeSearchMode.toUpperCase() : 'RENT',
            propertyType: 'Apartment',
            bhk: null,
            minPrice: minPrice ? Number(minPrice) : null,
            maxPrice: maxPrice ? Number(maxPrice) : null,
            amenities: null,
            alertsEnabled
        };

        let savedRecord = {
            id: 'local-' + Date.now(),
            ...payload,
            createdAt: new Date().toISOString()
        };

        // Try backend POST
        try {
            const res = await fetch('/api/property/saved-searches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const backendResult = await res.json();
                if (backendResult && backendResult.id) {
                    savedRecord = backendResult;
                }
            }
        } catch (err) {
            console.warn('Backend save search failed, saved to local session:', err);
        }

        // Add to list in real time
        savedSearchesList.unshift(savedRecord);
        localStorage.setItem(STORAGE_SAVED_SEARCHES, JSON.stringify(savedSearchesList));

        updateSavedSearchesBadges();
        renderSavedSearchesList();
        if (form) form.reset();

        notify(`🎉 Saved search "${name}" created!`);
    };

    // UPDATE / APPLY: Apply search criteria to live page
    window.applySavedSearch = function (searchId) {
        const item = savedSearchesList.find(s => String(s.id) === String(searchId));
        if (!item) return;

        if (item.city) {
            const citySelect = document.getElementById('listingCity');
            if (citySelect) {
                citySelect.value = item.city;
                citySelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (item.locality || item.name) {
            const searchInput = document.getElementById('listingSearch');
            if (searchInput) {
                searchInput.value = item.locality || '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (item.minPrice !== null && item.minPrice !== undefined) {
            const minSlider = document.getElementById('minBudgetRange');
            if (minSlider) {
                minSlider.value = item.minPrice;
                minSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (item.maxPrice !== null && item.maxPrice !== undefined) {
            const maxSlider = document.getElementById('budgetRange');
            if (maxSlider) {
                maxSlider.value = item.maxPrice;
                maxSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        closeAllFeatureDrawers();
        notify(`🔍 Applied criteria from "${item.name}"`);

        // Trigger search button
        const searchBtn = document.getElementById('listingSearchButton');
        if (searchBtn) searchBtn.click();
    };

    // DELETE: Delete saved search in real time
    window.deleteSavedSearch = async function (searchId) {
        try {
            if (!String(searchId).startsWith('local-')) {
                await fetch(`/api/property/saved-searches/${searchId}`, {
                    method: 'DELETE',
                    headers: { Accept: 'application/json' }
                });
            }
        } catch (e) {
            console.warn('Backend delete search failed:', e);
        }

        savedSearchesList = savedSearchesList.filter(s => String(s.id) !== String(searchId));
        localStorage.setItem(STORAGE_SAVED_SEARCHES, JSON.stringify(savedSearchesList));

        updateSavedSearchesBadges();
        renderSavedSearchesList();
        notify('🗑 Saved search deleted.');
    };

    function renderSavedSearchesList() {
        const container = document.getElementById('savedSearchesContainer');
        if (!container) return;

        if (!savedSearchesList.length) {
            container.innerHTML = `
                <div class="feature-empty-state">
                    <div class="empty-icon">💾</div>
                    <h4>No saved searches yet</h4>
                    <p>Save your search filters and discovery criteria to get instant match notifications.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = savedSearchesList.map(s => {
            const city = s.city || 'Any City';
            const locality = s.locality ? ` · ${s.locality}` : '';
            const type = s.listingType || s.type || 'Rent';
            const price = (s.minPrice || s.maxPrice)
                ? `₹${Number(s.minPrice || 0).toLocaleString('en-IN')} - ₹${Number(s.maxPrice || 250000).toLocaleString('en-IN')}`
                : 'Any Budget';
            const alertBadge = s.alertsEnabled !== false
                ? '<span class="status-pill-green">🔔 Active Alerts</span>'
                : '<span class="status-pill-gray">🔕 Muted</span>';

            return `
                <div class="feature-item-card" id="saved-search-${s.id}">
                    <div class="feature-item-main">
                        <div class="feature-item-header">
                            <h4 class="feature-item-title">${escapeHtml(s.name || 'Saved Search')}</h4>
                            ${alertBadge}
                        </div>
                        <p class="feature-item-subtitle">📍 ${escapeHtml(city + locality)} · <span class="tag-badge">${escapeHtml(type)}</span></p>
                        <p class="feature-item-detail">💰 Budget: <strong>${price}</strong></p>
                    </div>
                    <div class="feature-item-actions">
                        <button type="button" class="btn-action-apply" onclick="applySavedSearch('${s.id}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Apply Filter
                        </button>
                        <button type="button" class="btn-action-delete" onclick="deleteSavedSearch('${s.id}')" title="Delete Saved Search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // 3. FEATURE: COMPARE PROPERTIES (REAL-TIME CRUD)
    // =========================================================================

    // CREATE / REMOVE TOGGLE
    window.toggleCompareProperty = function (id) {
        const stringId = String(id);
        const existingIndex = compareList.findIndex(c => String(c.id) === stringId);

        if (existingIndex >= 0) {
            // DELETE from compare
            const removed = compareList.splice(existingIndex, 1)[0];
            localStorage.setItem(STORAGE_COMPARE, JSON.stringify(compareList));
            updateCompareBadges();
            syncCardCompareButtons();
            renderCompareModal();
            notify(`Removed "${removed.title || 'Property'}" from comparison.`);
            return;
        }

        // CREATE: Add to compare
        if (compareList.length >= 4) {
            alert('You can compare a maximum of 4 properties at once. Please remove one before adding another.');
            return;
        }

        // Find property data
        const apt = findPropertyData(stringId);
        if (!apt) {
            notify('Property details could not be found.', 'error');
            return;
        }

        compareList.push(apt);
        localStorage.setItem(STORAGE_COMPARE, JSON.stringify(compareList));
        updateCompareBadges();
        syncCardCompareButtons();
        renderCompareModal();

        notify(`⚖️ Added "${apt.title}" to comparison (${compareList.length}/4)`);
    };

    // DELETE: Remove specific property
    window.removeComparedProperty = function (id) {
        compareList = compareList.filter(c => String(c.id) !== String(id));
        localStorage.setItem(STORAGE_COMPARE, JSON.stringify(compareList));
        updateCompareBadges();
        syncCardCompareButtons();
        renderCompareModal();
        notify('Removed property from comparison.');
    };

    // DELETE ALL: Clear comparison
    window.clearComparisonList = function () {
        compareList = [];
        localStorage.setItem(STORAGE_COMPARE, JSON.stringify(compareList));
        updateCompareBadges();
        syncCardCompareButtons();
        renderCompareModal();
        notify('Comparison list cleared.');
    };

    function updateCompareBadges() {
        const count = compareList.length;
        document.querySelectorAll('.compare-count').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
        const toolbarBadge = document.getElementById('compareCountBadge');
        if (toolbarBadge) toolbarBadge.textContent = count;
        const navBadge = document.getElementById('navCompareCount');
        if (navBadge) navBadge.textContent = count;
    }

    let isSyncingCards = false;
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
                        compBtn.className = `btn-card-compare ${isCompared ? 'active' : ''}`;
                        compBtn.innerHTML = isCompared
                            ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Compared`
                            : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="8" height="18" rx="2"/><rect x="14" y="3" width="8" height="18" rx="2"/></svg> Compare`;

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
    }

    // READ: Render comparison matrix
    function renderCompareModal() {
        const container = document.getElementById('compareModalContent');
        if (!container) return;

        if (!compareList.length) {
            container.innerHTML = `
                <div class="feature-empty-state">
                    <div class="empty-icon">⚖️</div>
                    <h4>No properties in comparison</h4>
                    <p>Click the <strong>Compare</strong> button on any listing card to compare price, area, BHK, and amenities side-by-side.</p>
                </div>
            `;
            return;
        }

        const features = [
            { label: 'Property', render: (apt) => `
                <div class="compare-card-top">
                    <img src="${apt.image || '/propertydirect/assets/images/property-1.jpg'}" alt="${escapeHtml(apt.title)}">
                    <h5>${escapeHtml(apt.title)}</h5>
                    <button type="button" class="btn-remove-col" onclick="removeComparedProperty('${apt.id}')" title="Remove">✕ Remove</button>
                </div>
            ` },
            { label: 'Price / Rent', render: (apt) => `<strong>${formatMoney(apt.rent || apt.price)}</strong>` },
            { label: 'Deposit', render: (apt) => escapeHtml(apt.deposit || '₹1,00,000') },
            { label: 'Configuration', render: (apt) => `<strong>${escapeHtml(apt.bhk || apt.type || '2 BHK')}</strong>` },
            { label: 'Built-up Area', render: (apt) => `${escapeHtml(apt.sqft || '1,200 sq.ft')}` },
            { label: 'Bathrooms', render: (apt) => `${escapeHtml(apt.bathrooms ? apt.bathrooms + ' Baths' : '2 Baths')}` },
            { label: 'Furnishing', render: (apt) => `<span class="tag-badge">${escapeHtml(apt.furnishing || 'Semi-Furnished')}</span>` },
            { label: 'Availability', render: (apt) => `<span class="status-pill-green">${escapeHtml(apt.available || 'Ready to Move')}</span>` },
            { label: 'Locality & City', render: (apt) => `📍 ${escapeHtml(apt.locality || 'Central')}, ${escapeHtml(apt.city || 'Bangalore')}` },
            { label: 'Society / Builder', render: (apt) => escapeHtml(apt.society || 'Approved Society') },
            { label: 'Actions', render: (apt) => `
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <a href="/propertydirect/apartment-detail?id=${encodeURIComponent(apt.id)}" class="btn-action-primary" style="text-align:center; text-decoration:none;">View Details</a>
                    <button type="button" class="btn-action-apply" onclick="closeAllFeatureDrawers(); if(typeof openContactModal === 'function') openContactModal('${apt.id}');">Get Owner Info</button>
                </div>
            ` }
        ];

        let tableHtml = `
            <div class="compare-table-wrapper">
                <table class="compare-matrix-table">
                    <thead>
                        <tr>
                            <th class="matrix-th-feature">Feature</th>
                            ${compareList.map(apt => `<th class="matrix-th-col">${escapeHtml(apt.title)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${features.map(f => `
                            <tr>
                                <td class="matrix-td-feature">${f.label}</td>
                                ${compareList.map(apt => `<td>${f.render(apt)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    // =========================================================================
    // 4. FEATURE: RECENTLY VIEWED (REAL-TIME CRUD)
    // =========================================================================

    // CREATE / TRACK
    window.recordRecentlyViewed = function (idOrApt) {
        let apt = typeof idOrApt === 'object' ? idOrApt : findPropertyData(String(idOrApt));
        if (!apt) return;

        const stringId = String(apt.id);
        // Remove existing if present to move to top
        recentlyViewedList = recentlyViewedList.filter(r => String(r.id) !== stringId);
        recentlyViewedList.unshift({
            id: apt.id,
            title: apt.title,
            city: apt.city,
            locality: apt.locality,
            society: apt.society,
            price: apt.price || apt.rent,
            rent: apt.rent || apt.price,
            bhk: apt.bhk || apt.type,
            image: apt.image,
            sqft: apt.sqft,
            timestamp: Date.now()
        });

        // Cap at 20 items
        recentlyViewedList = recentlyViewedList.slice(0, 20);
        localStorage.setItem(STORAGE_RECENT, JSON.stringify(recentlyViewedList));

        updateRecentlyViewedBadges();
        renderRecentlyViewedList();
    };

    // DELETE: Remove specific recently viewed item
    window.removeRecentlyViewed = function (id) {
        recentlyViewedList = recentlyViewedList.filter(r => String(r.id) !== String(id));
        localStorage.setItem(STORAGE_RECENT, JSON.stringify(recentlyViewedList));
        updateRecentlyViewedBadges();
        renderRecentlyViewedList();
        notify('Removed from history.');
    };

    // DELETE ALL: Clear history
    window.clearRecentlyViewed = function () {
        recentlyViewedList = [];
        localStorage.setItem(STORAGE_RECENT, JSON.stringify(recentlyViewedList));
        updateRecentlyViewedBadges();
        renderRecentlyViewedList();
        notify('Recently viewed history cleared.');
    };

    function updateRecentlyViewedBadges() {
        const count = recentlyViewedList.length;
        document.querySelectorAll('.recent-count').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
        const toolbarBadge = document.getElementById('recentlyViewedCountBadge');
        if (toolbarBadge) toolbarBadge.textContent = count;
        const navBadge = document.getElementById('navRecentlyViewedCount');
        if (navBadge) navBadge.textContent = count;
    }

    // READ: Render recently viewed items
    function renderRecentlyViewedList() {
        const container = document.getElementById('recentlyViewedContainer');
        if (!container) return;

        if (!recentlyViewedList.length) {
            container.innerHTML = `
                <div class="feature-empty-state">
                    <div class="empty-icon">👁️</div>
                    <h4>No recently viewed properties</h4>
                    <p>Properties you explore or click on will automatically appear in your recent history.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentlyViewedList.map(item => {
            const timeAgo = formatTimeAgo(item.timestamp);
            return `
                <div class="feature-item-card recent-item-card">
                    <img class="recent-thumb" src="${item.image || '/propertydirect/assets/images/property-1.jpg'}" alt="${escapeHtml(item.title)}">
                    <div class="feature-item-main">
                        <div class="feature-item-header">
                            <h4 class="feature-item-title">${escapeHtml(item.title)}</h4>
                            <span class="recent-time">${timeAgo}</span>
                        </div>
                        <p class="feature-item-subtitle">📍 ${escapeHtml((item.locality || '') + (item.city ? ', ' + item.city : ''))}</p>
                        <p class="feature-item-detail"><strong>${formatMoney(item.rent || item.price)}</strong> · <span class="tag-badge">${escapeHtml(item.bhk || '2 BHK')}</span></p>
                    </div>
                    <div class="feature-item-actions">
                        <a href="/propertydirect/apartment-detail?id=${encodeURIComponent(item.id)}" class="btn-action-apply" style="text-decoration:none;">View</a>
                        <button type="button" class="btn-action-delete" onclick="removeRecentlyViewed('${item.id}')" title="Remove from History">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // MODAL & DRAWER CONTROLS
    // =========================================================================
    window.openSavedSearchesDrawer = function () {
        closeAllFeatureDrawers();
        const drawer = document.getElementById('savedSearchesModal');
        if (drawer) {
            drawer.classList.add('open');
            drawer.style.display = 'flex';
        }
        window.loadSavedSearches();
    };

    window.openCompareDrawer = function () {
        closeAllFeatureDrawers();
        const modal = document.getElementById('compareModal');
        if (modal) {
            modal.classList.add('open');
            modal.style.display = 'flex';
        }
        renderCompareModal();
    };

    window.openRecentlyViewedDrawer = function () {
        closeAllFeatureDrawers();
        const drawer = document.getElementById('recentlyViewedModal');
        if (drawer) {
            drawer.classList.add('open');
            drawer.style.display = 'flex';
        }
        renderRecentlyViewedList();
    };

    window.closeAllFeatureDrawers = function () {
        document.querySelectorAll('.pd-feature-overlay').forEach(modal => {
            modal.classList.remove('open');
            modal.style.display = 'none';
        });
    };

    // Helper: Find property data from memory or DOM card
    function findPropertyData(id) {
        const stringId = String(id);
        if (window.approvedDiscoveryListings && Array.isArray(window.approvedDiscoveryListings)) {
            const found = window.approvedDiscoveryListings.find(a => String(a.id) === stringId);
            if (found) return found;
        }

        // Try reading card dataset
        const card = document.querySelector(`.apartment-card[data-listing-id="${stringId}"]`);
        if (card) {
            return {
                id: stringId,
                title: card.dataset.apartmentTitle || card.querySelector('h2')?.textContent?.trim() || 'Property Listing',
                city: card.dataset.apartmentCity || 'Bangalore',
                locality: card.dataset.apartmentLocality || 'Central',
                society: card.dataset.apartmentSociety || 'Approved Society',
                rent: card.dataset.apartmentRent || '₹30,000',
                price: card.dataset.apartmentRent || '₹30,000',
                deposit: card.dataset.apartmentDeposit || '₹1,00,000',
                sqft: card.dataset.apartmentSqft || '1,200 sq.ft',
                bhk: card.dataset.apartmentBhk || '2 BHK',
                furnishing: card.dataset.apartmentFurnishing || 'Semi-Furnished',
                available: card.dataset.apartmentAvailability || 'Ready to Move',
                image: card.querySelector('img')?.src || '/propertydirect/assets/images/property-1.jpg'
            };
        }
        return null;
    }

    function formatMoney(val) {
        if (!val) return '₹30,000';
        if (String(val).startsWith('₹')) return String(val);
        const num = Number(val);
        return isNaN(num) ? String(val) : `₹${num.toLocaleString('en-IN')}`;
    }

    function formatTimeAgo(ts) {
        if (!ts) return 'Recent';
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // INITIALIZATION & OBSERVERS
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        updateSavedSearchesBadges();
        updateCompareBadges();
        updateRecentlyViewedBadges();
        window.loadSavedSearches();

        // Check hash routing (e.g. #saved-searches, #compare, #recently-viewed)
        const hash = window.location.hash.replace('#', '');
        if (hash === 'saved-searches') window.openSavedSearchesDrawer();
        else if (hash === 'compare') window.openCompareDrawer();
        else if (hash === 'recently-viewed') window.openRecentlyViewedDrawer();
        else if (hash === 'search') window.triggerPropertySearchFocus();

        // Observe #apartmentResults for card additions (debounced, NO deep subtree mutation loops)
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
        }

        // Track recently viewed on any card click
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.apartment-card');
            if (card && card.dataset.listingId) {
                // If not clicking the compare button itself, record recently viewed
                if (!e.target.closest('.btn-card-compare')) {
                    recordRecentlyViewed(card.dataset.listingId);
                }
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllFeatureDrawers();
        });
    });

})();
