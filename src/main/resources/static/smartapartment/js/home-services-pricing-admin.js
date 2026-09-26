/**
 * Home Services & Package Pricing Admin Management Module
 * Enables full CRUD operations (Create, Read, Update, Delete) on home service packages and pricing.
 * Changes persist in the backend database and automatically synchronize with resident & customer apps.
 */
(() => {
    "use strict";

    let _allPackages = [];
    let _activeFilterCategory = "ALL";
    let _activeSearchQuery = "";
    let _activeSort = "DEFAULT";
    let _currentViewMode = localStorage.getItem("adminPricingViewMode") || "cards";

    const escapeHtml = str => String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    function showToast(message, type = "success") {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }
        alert(message);
    }

    async function loadAdminPackages() {
        const tbody = document.getElementById("adminPricingTableBody");
        const cardView = document.getElementById("adminPricingCardView");
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="d-flex flex-column align-items-center justify-content-center">
                            <div class="spinner-border text-primary mb-2" role="status" style="width: 2rem; height: 2rem;"></div>
                            <span class="text-muted small fw-semibold">Loading live package pricing catalog...</span>
                        </div>
                    </td>
                </tr>`;
        }
        if (cardView) {
            cardView.innerHTML = `
                <div class="text-center py-5" style="grid-column: 1 / -1;">
                    <div class="spinner-border text-primary mb-2" role="status" style="width: 2rem; height: 2rem;"></div>
                    <div class="text-muted small fw-semibold">Loading live package pricing cards...</div>
                </div>`;
        }

        try {
            const res = await fetch("/api/admin/home-services/packages", { credentials: "same-origin" });
            if (!res.ok) throw new Error("Failed to load packages (" + res.status + ")");
            _allPackages = await res.json();
            renderPricingStats();
            populateCategoryFilter();
            renderAdminPricingTable();
        } catch (err) {
            console.error("Error loading admin packages:", err);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-danger">
                            <i class="fa-solid fa-triangle-exclamation fs-3 mb-2"></i>
                            <div class="fw-bold">Unable to load package prices</div>
                            <div class="small text-muted mb-3">${escapeHtml(err.message)}</div>
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.loadAdminPackages()">
                                <i class="fa-solid fa-rotate me-1"></i> Retry
                            </button>
                        </td>
                    </tr>`;
            }
            if (cardView) {
                cardView.innerHTML = `
                    <div class="text-center py-5 text-danger" style="grid-column: 1 / -1; background: #ffffff; border-radius: 16px; border: 1px dashed #fca5a5;">
                        <i class="fa-solid fa-triangle-exclamation fs-3 mb-2"></i>
                        <div class="fw-bold">Unable to load package cards</div>
                        <div class="small text-muted mb-3">${escapeHtml(err.message)}</div>
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.loadAdminPackages()">
                            <i class="fa-solid fa-rotate me-1"></i> Retry
                        </button>
                    </div>`;
            }
        }
    }

    function renderPricingStats() {
        const totalEl = document.getElementById("statTotalPackages");
        const categoriesEl = document.getElementById("statCoveredCategories");
        const minPriceEl = document.getElementById("statMinPrice");
        const maxPriceEl = document.getElementById("statMaxPrice");

        if (!_allPackages || !_allPackages.length) {
            if (totalEl) totalEl.textContent = "0";
            if (categoriesEl) categoriesEl.textContent = "0";
            if (minPriceEl) minPriceEl.textContent = "₹0";
            if (maxPriceEl) maxPriceEl.textContent = "₹0";
            return;
        }

        const activeList = _allPackages.filter(p => p.active !== false);
        const categories = new Set(activeList.map(p => p.category));
        const prices = activeList.map(p => Number(p.price) || 0).filter(pr => pr > 0);
        const min = prices.length ? Math.min(...prices) : 0;
        const max = prices.length ? Math.max(...prices) : 0;

        if (totalEl) totalEl.textContent = activeList.length;
        if (categoriesEl) categoriesEl.textContent = categories.size;
        if (minPriceEl) minPriceEl.textContent = `₹${min.toLocaleString('en-IN')}`;
        if (maxPriceEl) maxPriceEl.textContent = `₹${max.toLocaleString('en-IN')}`;
    }

    function populateCategoryFilter() {
        const select = document.getElementById("pricingCategoryFilter");
        if (!select) return;
        const currentVal = select.value || "ALL";
        const categories = Array.from(new Set(_allPackages.map(p => p.category).filter(Boolean))).sort();

        let html = `<option value="ALL">All Categories (${_allPackages.length})</option>`;
        categories.forEach(cat => {
            const count = _allPackages.filter(p => p.category === cat).length;
            html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</option>`;
        });
        select.innerHTML = html;
        select.value = currentVal;
    }

    function getFilteredPackages() {
        let list = [..._allPackages];

        if (_activeFilterCategory && _activeFilterCategory !== "ALL") {
            list = list.filter(p => (p.category || "").toLowerCase() === _activeFilterCategory.toLowerCase());
        }

        if (_activeSearchQuery) {
            const q = _activeSearchQuery.toLowerCase();
            list = list.filter(p =>
                (p.packageName || "").toLowerCase().includes(q) ||
                (p.subService || "").toLowerCase().includes(q) ||
                (p.designation || "").toLowerCase().includes(q) ||
                (p.category || "").toLowerCase().includes(q) ||
                String(p.price || "").includes(q)
            );
        }

        if (_activeSort === "PRICE_ASC") {
            list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        } else if (_activeSort === "PRICE_DESC") {
            list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        } else if (_activeSort === "NAME_ASC") {
            list.sort((a, b) => (a.packageName || "").localeCompare(b.packageName || ""));
        }

        return list;
    }

    function applyViewMode(mode) {
        _currentViewMode = mode || "cards";
        try {
            localStorage.setItem("adminPricingViewMode", _currentViewMode);
        } catch (_) {}

        const cardView = document.getElementById("adminPricingCardView");
        const tableView = document.getElementById("adminPricingTableView");
        const cardsBtn = document.getElementById("pricingViewCardsBtn");
        const tableBtn = document.getElementById("pricingViewTableBtn");

        if (_currentViewMode === "table") {
            if (cardView) cardView.style.display = "none";
            if (tableView) tableView.style.display = "block";
            if (cardsBtn) cardsBtn.classList.remove("active");
            if (tableBtn) tableBtn.classList.add("active");
        } else {
            if (cardView) cardView.style.display = "grid";
            if (tableView) tableView.style.display = "none";
            if (cardsBtn) cardsBtn.classList.add("active");
            if (tableBtn) tableBtn.classList.remove("active");
        }
    }
    window.setPricingViewMode = applyViewMode;

    function getCategoryIcon(category = "") {
        const cat = category.toLowerCase();
        if (cat.includes("clean")) return "fa-solid fa-broom";
        if (cat.includes("plumb")) return "fa-solid fa-wrench";
        if (cat.includes("elect")) return "fa-solid fa-bolt";
        if (cat.includes("carp")) return "fa-solid fa-hammer";
        if (cat.includes("appliance")) return "fa-solid fa-gears";
        if (cat.includes("pest")) return "fa-solid fa-shield-virus";
        if (cat.includes("paint")) return "fa-solid fa-paint-roller";
        if (cat.includes("pack") || cat.includes("move")) return "fa-solid fa-truck-moving";
        return "fa-solid fa-screwdriver-wrench";
    }

    function renderAdminPricingCards(filtered) {
        const cardView = document.getElementById("adminPricingCardView");
        if (!cardView) return;

        if (!filtered.length) {
            cardView.innerHTML = `
                <div class="empty-state-card shadow-xs py-5 px-4 text-center" style="grid-column: 1 / -1; background: #ffffff; border-radius: 16px; border: 1px dashed #cbd5e1;">
                    <div class="empty-state-icon text-muted mb-2"><i class="fa-solid fa-tags fs-2"></i></div>
                    <h6 class="fw-bold text-dark mb-1">No Service Packages Found</h6>
                    <p class="text-muted small mb-3">No packages match your search query or filter criteria.</p>
                    <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.resetPricingFilter()">
                        <i class="fa-solid fa-rotate-left me-1"></i> Reset Filters
                    </button>
                </div>`;
            return;
        }

        cardView.innerHTML = filtered.map(pkg => {
            const priceFormatted = Number(pkg.price || 0).toLocaleString('en-IN');
            const catBadgeClass = getCategoryBadgeClass(pkg.category);
            const catIcon = getCategoryIcon(pkg.category);
            const features = parseFeaturesList(pkg.features);

            return `
                <div class="admin-pricing-card ${pkg.active === false ? 'inactive-package' : ''}" id="pricingCard_${pkg.id}">
                    <div class="card-top-bar">
                        <div class="d-flex align-items-center gap-1.5 flex-wrap">
                            <span class="badge ${catBadgeClass} rounded-pill px-2.5 py-1" style="font-size: 0.7rem; font-weight: 700;">
                                <i class="${catIcon} me-1"></i>${escapeHtml(pkg.category)}
                            </span>
                            ${pkg.badge ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-0.5" style="font-size: 0.62rem; font-weight: 700;">${escapeHtml(pkg.badge)}</span>` : ""}
                        </div>
                        <div class="d-flex align-items-center gap-1.5">
                            ${pkg.active !== false
                                ? `<span class="card-status-pill active"><i class="fa-solid fa-circle-check"></i> Active</span>`
                                : `<span class="card-status-pill inactive"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>`}
                            <span class="pkg-id-badge">#${pkg.id}</span>
                        </div>
                    </div>

                    <div class="card-main-content">
                        <h5 class="card-service-title" title="${escapeHtml(pkg.subService)}">${escapeHtml(pkg.subService)}</h5>
                        
                        <div class="card-designation-pill">
                            <i class="fa-solid fa-layer-group text-primary me-1"></i>${escapeHtml(pkg.designation)}
                        </div>

                        <div class="card-pkg-name-row">
                            <span class="card-pkg-name">
                                <i class="fa-solid fa-gem text-primary" style="font-size: 0.8rem;"></i>
                                ${escapeHtml(pkg.packageName)}
                            </span>
                        </div>

                        <div class="card-meta-chips">
                            <span class="card-meta-chip">
                                <i class="fa-solid fa-star text-warning"></i> <strong>${escapeHtml(pkg.rating || "4.7")}</strong> <span class="text-muted">(${escapeHtml(pkg.reviews || "10K+")})</span>
                            </span>
                            <span class="card-meta-chip">
                                <i class="fa-regular fa-clock text-muted"></i> ${escapeHtml(pkg.duration || "2 - 4 hrs")}
                            </span>
                            ${pkg.optionsCount ? `<span class="card-meta-chip"><i class="fa-solid fa-cubes text-muted"></i> ${escapeHtml(pkg.optionsCount)}</span>` : ""}
                        </div>

                        <!-- Price Panel with Quick Inline Price Editor -->
                        <div class="card-price-panel">
                            <div class="d-flex align-items-center justify-content-between" id="cardPriceDisplayBox_${pkg.id}">
                                <div>
                                    <span class="text-muted small fw-bold d-block" style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em;">Live Price</span>
                                    <div class="d-flex align-items-baseline gap-1">
                                        <span class="card-price-currency">₹</span>
                                        <span class="card-price-amount" id="cardPriceText_${pkg.id}">${priceFormatted}</span>
                                        ${pkg.pricePrefix ? `<span class="text-muted small ms-1" style="font-size: 0.75rem;">${escapeHtml(pkg.pricePrefix)}</span>` : ""}
                                    </div>
                                </div>
                                <button type="button" class="quick-price-btn" title="Quick edit price" onclick="window.enterQuickPriceEdit(${pkg.id}, ${pkg.price})">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            
                            <div class="d-none align-items-center gap-1.5" id="cardPriceEditBox_${pkg.id}">
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text py-0 px-2 fw-bold text-primary bg-white">₹</span>
                                    <input type="number" class="form-control form-control-sm px-2 fw-bold" id="cardQuickPriceInput_${pkg.id}" value="${pkg.price}" min="0" step="1" onkeydown="if(event.key==='Enter') window.saveQuickPrice(${pkg.id}); else if(event.key==='Escape') window.cancelQuickPriceEdit(${pkg.id});">
                                </div>
                                <button type="button" class="quick-price-save-btn" title="Save price" onclick="window.saveQuickPrice(${pkg.id})">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                                <button type="button" class="quick-price-cancel-btn" title="Cancel" onclick="window.cancelQuickPriceEdit(${pkg.id})">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Scope & Features Section -->
                        <div class="card-scope-section">
                            <div class="card-scope-heading">
                                <i class="fa-solid fa-circle-check text-success"></i> Included Features &amp; Scope
                            </div>
                            <ul class="card-features-list">
                                ${features.slice(0, 3).map(f => `<li><i class="fa-solid fa-check text-success"></i> <span>${escapeHtml(f)}</span></li>`).join("")}
                            </ul>
                            ${features.length > 3 ? `<div class="card-more-features">+${features.length - 3} more scope items</div>` : ""}
                        </div>
                    </div>

                    <div class="card-footer-actions">
                        <button type="button" class="pkg-action-edit" title="Edit Full Package" onclick="window.openEditPackageModal(${pkg.id})">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Details
                        </button>
                        <button type="button" class="pkg-action-delete" title="Deactivate Package" onclick="window.deletePackageConfirm(${pkg.id}, '${escapeHtml(pkg.packageName)}')">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
        }).join("");
    }

    function renderAdminPricingTable() {
        const tbody = document.getElementById("adminPricingTableBody");
        const countBadge = document.getElementById("pricingFilteredCount");

        const filtered = getFilteredPackages();
        if (countBadge) {
            countBadge.textContent = `Showing ${filtered.length} of ${_allPackages.length} packages`;
        }

        renderAdminPricingCards(filtered);
        applyViewMode(_currentViewMode);

        if (!tbody) return;

        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="empty-state-card shadow-xs py-4">
                            <div class="empty-state-icon text-muted"><i class="fa-solid fa-tags"></i></div>
                            <h6 class="fw-bold text-dark mb-1">No Service Packages Found</h6>
                            <p class="text-muted small mb-3">No packages match your search query or filter criteria.</p>
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.resetPricingFilter()">
                                <i class="fa-solid fa-rotate-left me-1"></i> Reset Filters
                            </button>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(pkg => {
            const priceFormatted = Number(pkg.price || 0).toLocaleString('en-IN');
            const catBadgeClass = getCategoryBadgeClass(pkg.category);
            const features = parseFeaturesList(pkg.features);
            const featuresPreview = features.slice(0, 2).map(f => `<div class="scope-item"><i class="fa-solid fa-check text-success me-1" style="font-size:0.65rem;"></i>${escapeHtml(f)}</div>`).join("");
            const moreCount = features.length > 2 ? `<span class="badge bg-light text-secondary border rounded-pill mt-0.5" style="font-size:0.65rem; width:fit-content;">+${features.length - 2} more</span>` : "";

            return `
                <tr id="pricingRow_${pkg.id}" class="${pkg.active === false ? 'opacity-50 bg-light' : ''}">
                    <td class="text-center">
                        <span class="pkg-id-badge">#${pkg.id}</span>
                    </td>
                    <td>
                        <div class="fw-bold text-dark mb-0.5" style="letter-spacing: -0.01em; font-size: 0.88rem;">${escapeHtml(pkg.subService)}</div>
                        <span class="badge ${catBadgeClass} rounded-pill px-2.5 py-0.5" style="font-size: 0.68rem; font-weight: 600;">
                            ${escapeHtml(pkg.category)}
                        </span>
                    </td>
                    <td>
                        <span class="fw-semibold text-slate-700" style="font-size: 0.84rem;">${escapeHtml(pkg.designation)}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1.5 flex-wrap">
                            <span class="fw-bold text-primary" style="font-size: 0.88rem;">${escapeHtml(pkg.packageName)}</span>
                            ${pkg.badge ? `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size:0.62rem; font-weight: 700;">${escapeHtml(pkg.badge)}</span>` : ""}
                        </div>
                        <div class="text-muted d-flex align-items-center gap-2 mt-1" style="font-size: 0.72rem;">
                            <span><i class="fa-solid fa-star text-warning me-0.5"></i><strong>${escapeHtml(pkg.rating || "4.7")}</strong> <span class="text-slate-400">(${escapeHtml(pkg.reviews || "10K+")})</span></span>
                            <span class="text-slate-300">•</span>
                            <span><i class="fa-regular fa-clock me-0.5"></i>${escapeHtml(pkg.duration || "4 hrs")}</span>
                        </div>
                    </td>
                    <td>
                        <!-- Live Editable Price Box -->
                        <div class="d-flex align-items-center gap-2" id="priceDisplayBox_${pkg.id}">
                            <div class="pricing-amount-pill">
                                <span class="currency-symbol">₹</span>
                                <span class="price-val" id="priceText_${pkg.id}">${priceFormatted}</span>
                            </div>
                            <button type="button" class="quick-price-btn" title="Quick edit price" onclick="window.enterQuickPriceEdit(${pkg.id}, ${pkg.price})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                        <div class="d-none align-items-center gap-1.5" id="priceEditBox_${pkg.id}">
                            <div class="input-group input-group-sm" style="max-width: 130px;">
                                <span class="input-group-text py-0 px-2 fw-bold text-primary bg-white">₹</span>
                                <input type="number" class="form-control form-control-sm px-2 fw-bold" id="quickPriceInput_${pkg.id}" value="${pkg.price}" min="0" step="1" onkeydown="if(event.key==='Enter') window.saveQuickPrice(${pkg.id}); else if(event.key==='Escape') window.cancelQuickPriceEdit(${pkg.id});">
                            </div>
                            <button type="button" class="quick-price-save-btn" title="Save price" onclick="window.saveQuickPrice(${pkg.id})">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button type="button" class="quick-price-cancel-btn" title="Cancel" onclick="window.cancelQuickPriceEdit(${pkg.id})">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <div class="scope-container">
                            ${featuresPreview || '<span class="text-muted small">Standard scope</span>'}
                            ${moreCount}
                        </div>
                    </td>
                    <td class="text-center">
                        ${pkg.active !== false
                            ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold" style="font-size:0.72rem;"><i class="fa-solid fa-circle-check me-1"></i>Active</span>`
                            : `<span class="badge bg-secondary-subtle text-secondary border rounded-pill px-2.5 py-1 fw-semibold" style="font-size:0.72rem;">Inactive</span>`}
                    </td>
                    <td class="text-end">
                        <div class="d-inline-flex align-items-center justify-content-end gap-1.5">
                            <button type="button" class="pkg-action-edit" title="Edit Full Package" onclick="window.openEditPackageModal(${pkg.id})">
                                <i class="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button type="button" class="pkg-action-delete" title="Deactivate Package" onclick="window.deletePackageConfirm(${pkg.id}, '${escapeHtml(pkg.packageName)}')">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    }

    function parseFeaturesList(feat) {
        if (!feat) return [];
        if (Array.isArray(feat)) return feat;
        if (feat.startsWith("[")) {
            try { return JSON.parse(feat); } catch(e) {}
        }
        return feat.split("\n").map(s => s.trim()).filter(Boolean);
    }

    function getCategoryBadgeClass(category = "") {
        const cat = category.toLowerCase();
        if (cat.includes("clean")) return "bg-primary-subtle text-primary border border-primary-subtle";
        if (cat.includes("plumb")) return "bg-info-subtle text-info-emphasis border border-info-subtle";
        if (cat.includes("elect")) return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
        if (cat.includes("carp")) return "bg-secondary-subtle text-secondary border border-secondary-subtle";
        if (cat.includes("appliance")) return "bg-success-subtle text-success border border-success-subtle";
        if (cat.includes("pest")) return "bg-danger-subtle text-danger border border-danger-subtle";
        if (cat.includes("paint")) return "bg-purple-subtle text-purple border";
        return "bg-light text-dark border";
    }

    // Quick inline price editor (supports both Table and Card elements)
    window.enterQuickPriceEdit = function(id, currentPrice) {
        // 1. Table
        const tDisp = document.getElementById(`priceDisplayBox_${id}`);
        const tEdit = document.getElementById(`priceEditBox_${id}`);
        const tInput = document.getElementById(`quickPriceInput_${id}`);
        if (tDisp && tEdit) {
            tDisp.classList.remove("d-flex");
            tDisp.classList.add("d-none");
            tEdit.classList.remove("d-none");
            tEdit.classList.add("d-flex");
            if (tInput) {
                tInput.value = currentPrice;
                if (_currentViewMode === "table") {
                    tInput.focus();
                    tInput.select();
                }
            }
        }

        // 2. Card
        const cDisp = document.getElementById(`cardPriceDisplayBox_${id}`);
        const cEdit = document.getElementById(`cardPriceEditBox_${id}`);
        const cInput = document.getElementById(`cardQuickPriceInput_${id}`);
        if (cDisp && cEdit) {
            cDisp.classList.remove("d-flex");
            cDisp.classList.add("d-none");
            cEdit.classList.remove("d-none");
            cEdit.classList.add("d-flex");
            if (cInput) {
                cInput.value = currentPrice;
                if (_currentViewMode !== "table") {
                    cInput.focus();
                    cInput.select();
                }
            }
        }
    };

    window.cancelQuickPriceEdit = function(id) {
        // 1. Table
        const tDisp = document.getElementById(`priceDisplayBox_${id}`);
        const tEdit = document.getElementById(`priceEditBox_${id}`);
        if (tDisp && tEdit) {
            tDisp.classList.remove("d-none");
            tDisp.classList.add("d-flex");
            tEdit.classList.remove("d-flex");
            tEdit.classList.add("d-none");
        }

        // 2. Card
        const cDisp = document.getElementById(`cardPriceDisplayBox_${id}`);
        const cEdit = document.getElementById(`cardPriceEditBox_${id}`);
        if (cDisp && cEdit) {
            cDisp.classList.remove("d-none");
            cDisp.classList.add("d-flex");
            cEdit.classList.remove("d-flex");
            cEdit.classList.add("d-none");
        }
    };

    window.saveQuickPrice = async function(id) {
        const tInput = document.getElementById(`quickPriceInput_${id}`);
        const cInput = document.getElementById(`cardQuickPriceInput_${id}`);
        let inputVal = "";
        if (_currentViewMode === "table" && tInput) {
            inputVal = tInput.value;
        } else if (cInput) {
            inputVal = cInput.value;
        } else if (tInput) {
            inputVal = tInput.value;
        }

        const newPrice = parseFloat(inputVal);
        if (isNaN(newPrice) || newPrice < 0) {
            showToast("Please enter a valid price", "error");
            return;
        }

        try {
            const res = await fetch(`/api/admin/home-services/packages/${id}/price`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price: newPrice }),
                credentials: "same-origin"
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${res.status}`);
            }

            const updated = await res.json();
            // Update in-memory item
            const item = _allPackages.find(p => p.id === id);
            if (item) item.price = updated.price;

            const formatted = Number(updated.price).toLocaleString('en-IN');
            const tText = document.getElementById(`priceText_${id}`);
            if (tText) tText.textContent = formatted;
            const cText = document.getElementById(`cardPriceText_${id}`);
            if (cText) cText.textContent = formatted;

            window.cancelQuickPriceEdit(id);
            renderPricingStats();
            showToast(`✓ Price updated to ₹${formatted} for ${updated.designation} (${updated.packageName})! Syncing to residents and customers...`);

            try {
                localStorage.setItem("smartapartment_pricing_sync", String(Date.now()));
                window.dispatchEvent(new CustomEvent("home-services:pricing-updated", { detail: updated }));
            } catch (_) {}

            // Notify resident/customer modules if loaded in same window
            if (typeof window.syncHomeServicesPricing === "function") {
                window.syncHomeServicesPricing();
            }
        } catch (err) {
            console.error("Failed to update price:", err);
            showToast("Failed to update price: " + err.message, "error");
        }
    };

    // Full Add / Edit Modal handlers
    window.openAddPackageModal = function() {
        document.getElementById("modalPackageForm")?.reset();
        document.getElementById("modalPackageId").value = "";
        document.getElementById("modalPackageTitle").textContent = "Add New Service Package";
        document.getElementById("modalCategory").value = _activeFilterCategory !== "ALL" ? _activeFilterCategory : "Home Cleaning";
        document.getElementById("modalRating").value = "4.7";
        document.getElementById("modalReviews").value = "10K+";
        document.getElementById("modalDuration").value = "4 hrs";
        document.getElementById("modalOptionsCount").value = "5 options";
        document.getElementById("modalActive").checked = true;

        bindModalEvents();
        const modalEl = document.getElementById("homeServicePackageModal");
        if (modalEl) {
            modalEl.classList.remove("hidden");
            modalEl.style.removeProperty("display");
            if (window.bootstrap) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        }
    };

    function bindModalEvents() {
        const modalEl = document.getElementById("homeServicePackageModal");
        if (!modalEl || modalEl.dataset.eventsBound === "true") return;
        modalEl.dataset.eventsBound = "true";
        modalEl.addEventListener("hidden.bs.modal", () => {
            modalEl.classList.add("hidden");
            modalEl.style.setProperty("display", "none", "important");
            document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");
        });
    }

    window.openEditPackageModal = function(id) {
        const pkg = _allPackages.find(p => p.id === id);
        if (!pkg) return;

        document.getElementById("modalPackageId").value = pkg.id;
        document.getElementById("modalPackageTitle").textContent = `Edit Package: ${pkg.designation} - ${pkg.packageName}`;
        document.getElementById("modalCategory").value = pkg.category || "";
        document.getElementById("modalSubService").value = pkg.subService || "";
        document.getElementById("modalDesignation").value = pkg.designation || "";
        document.getElementById("modalPackageName").value = pkg.packageName || "";
        document.getElementById("modalPrice").value = pkg.price || 0;
        document.getElementById("modalPricePrefix").value = pkg.pricePrefix || "";
        document.getElementById("modalRating").value = pkg.rating || "4.7";
        document.getElementById("modalReviews").value = pkg.reviews || "10K+";
        document.getElementById("modalDuration").value = pkg.duration || "4 hrs";
        document.getElementById("modalOptionsCount").value = pkg.optionsCount || "5 options";
        document.getElementById("modalBadge").value = pkg.badge || "";
        document.getElementById("modalActive").checked = pkg.active !== false;

        const features = parseFeaturesList(pkg.features);
        document.getElementById("modalFeatures").value = features.join("\n");

        bindModalEvents();
        const modalEl = document.getElementById("homeServicePackageModal");
        if (modalEl) {
            modalEl.classList.remove("hidden");
            modalEl.style.removeProperty("display");
            if (window.bootstrap) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        }
    };

    window.savePackageModal = async function() {
        const id = document.getElementById("modalPackageId").value;
        const category = document.getElementById("modalCategory").value.trim();
        const subService = document.getElementById("modalSubService").value.trim();
        const designation = document.getElementById("modalDesignation").value.trim() || subService;
        const packageName = document.getElementById("modalPackageName").value.trim();
        const price = parseFloat(document.getElementById("modalPrice").value);
        const pricePrefix = document.getElementById("modalPricePrefix").value.trim();
        const rating = document.getElementById("modalRating").value.trim() || "4.7";
        const reviews = document.getElementById("modalReviews").value.trim() || "10K+";
        const duration = document.getElementById("modalDuration").value.trim() || "4 hrs";
        const optionsCount = document.getElementById("modalOptionsCount").value.trim() || "5 options";
        const badge = document.getElementById("modalBadge").value.trim();
        const features = document.getElementById("modalFeatures").value.trim();
        const active = document.getElementById("modalActive").checked;

        if (!category || !subService || !packageName || isNaN(price) || price < 0) {
            showToast("Please fill in all required fields (Category, Sub-Service, Package Name, and valid Price).", "error");
            return;
        }

        const payload = {
            category,
            subService,
            designation,
            packageName,
            price,
            pricePrefix: pricePrefix || null,
            rating,
            reviews,
            duration,
            optionsCount,
            badge: badge || null,
            features,
            active
        };

        const btn = document.getElementById("btnSavePackageModal");
        const originalText = btn ? btn.innerHTML : "Save";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;
        }

        try {
            const url = id ? `/api/admin/home-services/packages/${id}` : `/api/admin/home-services/packages`;
            const method = id ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "same-origin"
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned ${res.status}`);
            }

            const saved = await res.json();
            const modalEl = document.getElementById("homeServicePackageModal");
            if (modalEl) {
                if (window.bootstrap) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal?.hide();
                }
                modalEl.classList.add("hidden");
                modalEl.style.setProperty("display", "none", "important");
                document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
                document.body.classList.remove("modal-open");
                document.body.style.removeProperty("overflow");
                document.body.style.removeProperty("padding-right");
            }

            showToast(id ? `✓ Package #${saved.id} (${saved.packageName}) successfully updated!` : `✓ New Package #${saved.id} created successfully!`);

            try {
                localStorage.setItem("smartapartment_pricing_sync", String(Date.now()));
                window.dispatchEvent(new CustomEvent("home-services:pricing-updated", { detail: saved }));
            } catch (_) {}

            await loadAdminPackages();

            if (typeof window.syncHomeServicesPricing === "function") {
                window.syncHomeServicesPricing();
            }
        } catch (err) {
            console.error("Error saving package:", err);
            showToast("Error saving package: " + err.message, "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };

    window.deletePackageConfirm = async function(id, name) {
        if (!confirm(`Are you sure you want to deactivate package "${name}" (ID #${id})?\n\nResidents and customers will no longer see this package in booking options.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/home-services/packages/${id}`, {
                method: "DELETE",
                credentials: "same-origin"
            });
            if (!res.ok) throw new Error("Failed to deactivate package");
            showToast(`✓ Package #${id} deactivated.`);

            try {
                localStorage.setItem("smartapartment_pricing_sync", String(Date.now()));
                window.dispatchEvent(new CustomEvent("home-services:pricing-updated", { detail: { id, deactivated: true } }));
            } catch (_) {}

            await loadAdminPackages();
            if (typeof window.syncHomeServicesPricing === "function") {
                window.syncHomeServicesPricing();
            }
        } catch (err) {
            console.error("Error deleting package:", err);
            showToast("Failed to delete package: " + err.message, "error");
        }
    };

    window.resetPricingFilter = function() {
        _activeFilterCategory = "ALL";
        _activeSearchQuery = "";
        _activeSort = "DEFAULT";
        const catSelect = document.getElementById("pricingCategoryFilter");
        if (catSelect) catSelect.value = "ALL";
        const searchInput = document.getElementById("pricingSearchInput");
        if (searchInput) searchInput.value = "";
        const sortSelect = document.getElementById("pricingSortSelect");
        if (sortSelect) sortSelect.value = "DEFAULT";
        renderAdminPricingTable();
    };

    window.filterPricingTable = function() {
        const catSelect = document.getElementById("pricingCategoryFilter");
        if (catSelect) _activeFilterCategory = catSelect.value;
        const searchInput = document.getElementById("pricingSearchInput");
        if (searchInput) _activeSearchQuery = searchInput.value.trim();
        const sortSelect = document.getElementById("pricingSortSelect");
        if (sortSelect) _activeSort = sortSelect.value;
        renderAdminPricingTable();
    };

    window.resetToDefaultPricingCatalog = async function() {
        if (!confirm("Are you sure you want to verify/re-seed the default catalog prices? Existing custom packages will remain preserved.")) {
            return;
        }
        try {
            const res = await fetch("/api/admin/home-services/packages/reset-defaults", {
                method: "POST",
                credentials: "same-origin"
            });
            if (!res.ok) throw new Error("Reset failed");
            showToast("✓ Default service package catalog verified.");

            try {
                localStorage.setItem("smartapartment_pricing_sync", String(Date.now()));
                window.dispatchEvent(new CustomEvent("home-services:pricing-updated"));
            } catch (_) {}

            await loadAdminPackages();
            if (typeof window.syncHomeServicesPricing === "function") {
                window.syncHomeServicesPricing();
            }
        } catch (err) {
            showToast("Error: " + err.message, "error");
        }
    };

    // Public API
    window.loadAdminPackages = loadAdminPackages;

    // Auto-init if container exists
    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("service-pricing-panel") || document.getElementById("home-services-panel")) {
            loadAdminPackages();
        }
    });

    if (document.readyState !== "loading" && (document.getElementById("service-pricing-panel") || document.getElementById("home-services-panel"))) {
        loadAdminPackages();
    }
})();
