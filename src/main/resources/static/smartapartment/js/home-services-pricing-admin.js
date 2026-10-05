/**
 * Home Services & Package Pricing Admin Management Module (Resident Dashboard Model)
 * Displays service categories in the exact same card grid model as the resident dashboard,
 * with direct inline price editing and full package management per category.
 */
(() => {
    "use strict";

    let _allPackages = [];
    let _activeModalCategoryKey = null;

    const CORE_CATEGORIES = [
        {
            key: "home-cleaning",
            title: "Home Cleaning",
            subtitle: "Bathroom, Kitchen, Deep Clean",
            icon: "fa-solid fa-house-chimney",
            circleClass: "service-circle-red",
            badgeClass: "badge-discount-red",
            defaultBadge: "Starts ₹499",
            defaultPrice: 499,
            dbCategories: ["Home Cleaning", "Kitchen Cleaning", "Bathroom Cleaning"]
        },
        {
            key: "packers-movers",
            title: "Packers & Movers",
            subtitle: "Intercity & Local Shifting",
            icon: "fa-solid fa-truck-fast",
            circleClass: "service-circle-blue",
            badgeClass: "badge-discount-blue",
            defaultBadge: "Starts ₹999",
            defaultPrice: 999,
            dbCategories: ["Packers & Movers"]
        },
        {
            key: "painting-waterproofing",
            title: "Painting & Waterproofing",
            subtitle: "Full Home & Touchup Painting",
            icon: "fa-solid fa-paint-roller",
            circleClass: "service-circle-yellow",
            badgeClass: "badge-discount-yellow",
            defaultBadge: "Starts ₹399",
            defaultPrice: 399,
            dbCategories: ["Painting"]
        },
        {
            key: "rental-legal",
            title: "Rental & Legal Agreement",
            subtitle: "Doorstep Delivery & E-Stamp",
            icon: "fa-solid fa-file-signature",
            circleClass: "service-circle-cyan",
            badgeClass: "badge-discount-cyan",
            defaultBadge: "Starts ₹299",
            defaultPrice: 299,
            dbCategories: ["Rental & Legal Agreement"]
        },
        {
            key: "electrician-plumber-carpenter",
            title: "Electrician, Plumber & Carpenter",
            subtitle: "Door Lock, Drill, Taps & Wiring",
            icon: "fa-solid fa-screwdriver-wrench",
            circleClass: "service-circle-green",
            badgeClass: "badge-discount-green",
            defaultBadge: "Starts ₹49",
            defaultPrice: 49,
            dbCategories: ["Plumbing", "Electrical", "Carpentry"]
        },
        {
            key: "interior-renovation",
            title: "Interior & Renovation",
            subtitle: "Full Home 3D Design & Modular Work",
            icon: "fa-solid fa-couch",
            circleClass: "service-circle-purple",
            badgeClass: "badge-discount-purple",
            defaultBadge: "Free Consult",
            defaultPrice: 0,
            dbCategories: ["Interior & Renovation"]
        },
        {
            key: "ac-appliance",
            title: "AC & Appliance Repair",
            subtitle: "AC Gas Refill, Washing Machine, Fridge",
            icon: "fa-solid fa-snowflake",
            circleClass: "service-circle-teal",
            badgeClass: "badge-discount-teal",
            defaultBadge: "Starts ₹399",
            defaultPrice: 399,
            dbCategories: ["Appliance Repair"]
        },
        {
            key: "pest-control",
            title: "Pest Control",
            subtitle: "Cockroach, Termite & Bed Bug Treatment",
            icon: "fa-solid fa-shield-virus",
            circleClass: "service-circle-rose",
            badgeClass: "badge-discount-rose",
            defaultBadge: "Starts ₹299",
            defaultPrice: 299,
            dbCategories: ["Pest Control"]
        }
    ];

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

    function getEffectiveCategoryPrice(cat) {
        const saved = localStorage.getItem("smartapartment_cat_price_" + cat.key);
        if (saved && !isNaN(Number(saved))) return Number(saved);

        const matching = _allPackages.filter(p =>
            cat.dbCategories.some(c => c.toLowerCase() === (p.category || "").toLowerCase()) && p.active !== false
        );
        if (matching.length) {
            const prices = matching.map(p => Number(p.price) || 0).filter(pr => pr > 0);
            if (prices.length) return Math.min(...prices);
        }
        return cat.defaultPrice;
    }

    async function loadAdminPackages() {
        const grid = document.getElementById("adminCategoryCardsGrid");
        if (grid) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-primary" role="status" style="width: 2rem; height: 2rem;"></div>
                    <div class="text-muted small mt-2">Loading live service pricing...</div>
                </div>`;
        }

        try {
            const res = await fetch("/api/admin/home-services/packages", { credentials: "same-origin" });
            if (!res.ok) throw new Error("Failed to load packages (" + res.status + ")");
            _allPackages = await res.json();
            renderAdminCategoryCards();
            if (_activeModalCategoryKey) {
                const cat = CORE_CATEGORIES.find(c => c.key === _activeModalCategoryKey);
                if (cat) renderCatModalTable(cat);
            }
        } catch (err) {
            console.error("Error loading admin packages:", err);
            if (grid) {
                grid.innerHTML = `
                    <div class="col-12 text-center py-5 text-danger">
                        <i class="fa-solid fa-triangle-exclamation fs-3 mb-2"></i>
                        <div class="fw-bold">Unable to load live package prices</div>
                        <div class="small text-muted mb-3">${escapeHtml(err.message)}</div>
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.loadAdminPackages()">
                            <i class="fa-solid fa-rotate me-1"></i> Retry
                        </button>
                    </div>`;
            }
        }
    }

    function renderAdminCategoryCards() {
        const grid = document.getElementById("adminCategoryCardsGrid");
        if (!grid) return;

        grid.innerHTML = CORE_CATEGORIES.map(cat => {
            const currentPrice = getEffectiveCategoryPrice(cat);
            const matchingPkgs = _allPackages.filter(p =>
                cat.dbCategories.some(c => c.toLowerCase() === (p.category || "").toLowerCase())
            );
            const pkgCount = matchingPkgs.length;
            const badgeText = currentPrice > 0 ? `Starts ₹${currentPrice}` : cat.defaultBadge;

            return `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="card border rounded-4 text-center p-3 h-100 service-category-card position-relative bg-white shadow-xs">
                        <div class="service-icon-wrapper">
                            <div class="service-icon-circle ${cat.circleClass}">
                                <i class="${cat.icon}"></i>
                            </div>
                            <span class="badge rounded-pill fw-bold service-cat-badge ${cat.badgeClass}" id="catBadge_${cat.key}">${escapeHtml(badgeText)}</span>
                        </div>
                        <h6 class="fw-bold service-card-title mt-2 mb-1">${escapeHtml(cat.title)}</h6>
                        <span class="service-card-subtitle text-muted mb-2">${escapeHtml(cat.subtitle)}</span>

                        <!-- Price Display & Quick Edit Section -->
                        <div class="admin-price-control-wrapper mt-auto pt-2 border-top w-100">
                            <!-- View mode -->
                            <div class="d-flex align-items-center justify-content-between" id="catPriceRow_${cat.key}">
                                <div class="text-start">
                                    <span class="text-muted d-block" style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">Starting Rate</span>
                                    <strong class="fs-6 text-primary fw-bold" id="catPriceVal_${cat.key}">₹${currentPrice}</strong>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold" onclick="window.startEditCategoryPrice('${cat.key}')" title="Edit Price">
                                    <i class="fa-solid fa-pen-to-square me-1"></i> Edit Price
                                </button>
                            </div>
                            
                            <!-- Inline Edit Mode (Hidden initially) -->
                            <div class="d-none align-items-center justify-content-between gap-1 mt-1" id="catPriceEdit_${cat.key}">
                                <div class="input-group input-group-sm" style="max-width: 100px;">
                                    <span class="input-group-text px-1.5 py-0 bg-white text-primary fw-bold">₹</span>
                                    <input type="number" class="form-control form-control-sm px-1 fw-bold text-center" id="catPriceInput_${cat.key}" value="${currentPrice}" min="0" step="1" onkeydown="if(event.key==='Enter') window.saveCategoryPrice('${cat.key}'); else if(event.key==='Escape') window.cancelEditCategoryPrice('${cat.key}');">
                                </div>
                                <div class="d-flex align-items-center gap-1">
                                    <button type="button" class="btn btn-sm btn-success rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="window.saveCategoryPrice('${cat.key}')" title="Save Price">
                                        <i class="fa-solid fa-check" style="font-size: 0.72rem;"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 26px; height: 26px;" onclick="window.cancelEditCategoryPrice('${cat.key}')" title="Cancel">
                                        <i class="fa-solid fa-xmark" style="font-size: 0.72rem;"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Manage Packages Link -->
                            <div class="mt-2 text-center">
                                <button type="button" class="btn btn-link btn-sm p-0 text-muted text-decoration-none" style="font-size: 0.73rem;" onclick="window.openCategoryPackagesModal('${cat.key}')">
                                    <i class="fa-solid fa-sliders me-1 text-primary"></i> Manage Packages (${pkgCount}) <i class="fa-solid fa-chevron-right ms-0.5" style="font-size: 0.6rem;"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join("");
    }

    window.startEditCategoryPrice = function(catKey) {
        const row = document.getElementById("catPriceRow_" + catKey);
        const edit = document.getElementById("catPriceEdit_" + catKey);
        const input = document.getElementById("catPriceInput_" + catKey);
        if (row && edit) {
            row.classList.add("d-none");
            row.classList.remove("d-flex");
            edit.classList.remove("d-none");
            edit.classList.add("d-flex");
            if (input) {
                input.focus();
                input.select();
            }
        }
    };

    window.cancelEditCategoryPrice = function(catKey) {
        const row = document.getElementById("catPriceRow_" + catKey);
        const edit = document.getElementById("catPriceEdit_" + catKey);
        if (row && edit) {
            edit.classList.add("d-none");
            edit.classList.remove("d-flex");
            row.classList.remove("d-none");
            row.classList.add("d-flex");
        }
    };

    window.saveCategoryPrice = async function(catKey) {
        const input = document.getElementById("catPriceInput_" + catKey);
        if (!input) return;
        const newPrice = Number(input.value);
        if (isNaN(newPrice) || newPrice < 0) {
            showToast("Please enter a valid price.", "error");
            return;
        }

        const cat = CORE_CATEGORIES.find(c => c.key === catKey);
        if (!cat) return;

        localStorage.setItem("smartapartment_cat_price_" + catKey, String(newPrice));

        // Update lowest price package in DB if available
        const matchingPkgs = _allPackages.filter(p =>
            cat.dbCategories.some(c => c.toLowerCase() === (p.category || "").toLowerCase())
        );
        if (matchingPkgs.length) {
            matchingPkgs.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
            const basePkg = matchingPkgs[0];
            try {
                await fetch(`/api/admin/home-services/packages/${basePkg.id}/price`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ price: newPrice }),
                    credentials: "same-origin"
                });
                basePkg.price = newPrice;
            } catch (err) {
                console.warn("Could not patch package in database, stored in localStorage:", err);
            }
        }

        // Update UI
        const valEl = document.getElementById("catPriceVal_" + catKey);
        if (valEl) valEl.textContent = "₹" + newPrice;

        const badgeEl = document.getElementById("catBadge_" + catKey);
        if (badgeEl) badgeEl.textContent = newPrice > 0 ? "Starts ₹" + newPrice : "Free Consult";

        window.cancelEditCategoryPrice(catKey);
        showToast(`✓ ${cat.title} starting price updated to ₹${newPrice}! Synced with resident dashboard.`);

        try {
            localStorage.setItem("smartapartment_pricing_sync", String(Date.now()));
            window.dispatchEvent(new CustomEvent("home-services:pricing-updated", { detail: { categoryKey: catKey, price: newPrice } }));
        } catch (_) {}
    };

    window.openCategoryPackagesModal = function(catKey) {
        const cat = CORE_CATEGORIES.find(c => c.key === catKey);
        if (!cat) return;

        _activeModalCategoryKey = catKey;
        const modalEl = document.getElementById("categoryPackagesModal");
        if (!modalEl) return;

        const titleEl = document.getElementById("catModalTitle");
        const subtitleEl = document.getElementById("catModalSubtitle");
        const iconWrapper = document.getElementById("catModalIconWrapper");
        const iconEl = document.getElementById("catModalIcon");

        if (titleEl) titleEl.textContent = cat.title + " Packages";
        if (subtitleEl) subtitleEl.textContent = "Manage individual package prices for " + cat.title;
        if (iconWrapper) iconWrapper.className = "service-icon-circle " + cat.circleClass;
        if (iconEl) iconEl.className = cat.icon;

        renderCatModalTable(cat);

        if (window.bootstrap) {
            new bootstrap.Modal(modalEl).show();
        } else {
            modalEl.style.display = "block";
            modalEl.classList.add("show");
        }
    };

    function renderCatModalTable(cat) {
        const tbody = document.getElementById("catModalTableBody");
        if (!tbody) return;

        const matchingPkgs = _allPackages.filter(p =>
            cat.dbCategories.some(c => c.toLowerCase() === (p.category || "").toLowerCase())
        );

        if (!matchingPkgs.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        No sub-packages found for ${escapeHtml(cat.title)}. You can add a new package below.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = matchingPkgs.map(pkg => {
            const priceFormatted = Number(pkg.price || 0).toLocaleString("en-IN");
            return `
                <tr id="modalPkgRow_${pkg.id}">
                    <td>
                        <strong class="text-dark d-block">${escapeHtml(pkg.packageName)}</strong>
                        <small class="text-muted">${escapeHtml(pkg.subService || "")}</small>
                    </td>
                    <td>
                        <span class="text-muted small">${escapeHtml(pkg.designation || pkg.features || "Standard service")}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1.5" id="pkgPriceDisp_${pkg.id}">
                            <strong class="text-primary fs-6">₹${priceFormatted}</strong>
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-circle p-0" style="width: 24px; height: 24px;" onclick="window.startEditPkgPrice(${pkg.id}, ${pkg.price})" title="Edit Price">
                                <i class="fa-solid fa-pen" style="font-size: 0.65rem;"></i>
                            </button>
                        </div>
                        <div class="d-none align-items-center gap-1" id="pkgPriceEdit_${pkg.id}">
                            <input type="number" class="form-control form-control-sm px-1 text-center fw-bold" id="pkgPriceInput_${pkg.id}" value="${pkg.price}" style="max-width: 80px;" min="0" step="1">
                            <button type="button" class="btn btn-sm btn-success rounded-circle p-0" style="width: 24px; height: 24px;" onclick="window.savePkgPrice(${pkg.id})">
                                <i class="fa-solid fa-check" style="font-size: 0.65rem;"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light border rounded-circle p-0" style="width: 24px; height: 24px;" onclick="window.cancelEditPkgPrice(${pkg.id})">
                                <i class="fa-solid fa-xmark" style="font-size: 0.65rem;"></i>
                            </button>
                        </div>
                    </td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-0.5" style="font-size: 0.72rem;" onclick="window.deletePackageConfirm(${pkg.id}, '${escapeHtml(pkg.packageName)}')">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>`;
        }).join("");
    }

    window.startEditPkgPrice = function(id, price) {
        const disp = document.getElementById("pkgPriceDisp_" + id);
        const edit = document.getElementById("pkgPriceEdit_" + id);
        const input = document.getElementById("pkgPriceInput_" + id);
        if (disp && edit) {
            disp.classList.add("d-none");
            disp.classList.remove("d-flex");
            edit.classList.remove("d-none");
            edit.classList.add("d-flex");
            if (input) {
                input.focus();
                input.select();
            }
        }
    };

    window.cancelEditPkgPrice = function(id) {
        const disp = document.getElementById("pkgPriceDisp_" + id);
        const edit = document.getElementById("pkgPriceEdit_" + id);
        if (disp && edit) {
            edit.classList.add("d-none");
            edit.classList.remove("d-flex");
            disp.classList.remove("d-none");
            disp.classList.add("d-flex");
        }
    };

    window.savePkgPrice = async function(id) {
        const input = document.getElementById("pkgPriceInput_" + id);
        if (!input) return;
        const newPrice = Number(input.value);
        if (isNaN(newPrice) || newPrice < 0) {
            showToast("Please enter a valid price.", "error");
            return;
        }

        try {
            const res = await fetch(`/api/admin/home-services/packages/${id}/price`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price: newPrice }),
                credentials: "same-origin"
            });
            if (!res.ok) throw new Error("Server error " + res.status);
            const updated = await res.json();
            
            const pkg = _allPackages.find(p => p.id === id);
            if (pkg) pkg.price = newPrice;

            showToast(`✓ Package #${id} price updated to ₹${newPrice}!`);
            renderAdminCategoryCards();
            if (_activeModalCategoryKey) {
                const cat = CORE_CATEGORIES.find(c => c.key === _activeModalCategoryKey);
                if (cat) renderCatModalTable(cat);
            }
        } catch (err) {
            showToast("Failed to save price: " + err.message, "error");
        }
    };

    window.deletePackageConfirm = async function(id, name) {
        if (!confirm(`Are you sure you want to deactivate package "${name}" (ID #${id})?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/home-services/packages/${id}`, {
                method: "DELETE",
                credentials: "same-origin"
            });
            if (!res.ok) throw new Error("Failed to deactivate package");
            showToast(`✓ Package #${id} deactivated.`);
            await loadAdminPackages();
        } catch (err) {
            showToast("Failed to delete package: " + err.message, "error");
        }
    };

    window.resetToDefaultPricingCatalog = async function() {
        if (!confirm("Are you sure you want to reset all service categories and package pricing to platform defaults?")) {
            return;
        }

        try {
            const res = await fetch("/api/admin/home-services/packages/reset-defaults", {
                method: "POST",
                credentials: "same-origin"
            });
            if (!res.ok) throw new Error("Failed to reset defaults");

            CORE_CATEGORIES.forEach(c => {
                localStorage.removeItem("smartapartment_cat_price_" + c.key);
            });

            showToast("✓ All service categories and packages reset to platform defaults!");
            await loadAdminPackages();
        } catch (err) {
            showToast("Error resetting defaults: " + err.message, "error");
        }
    };

    window.openAddPackageModal = function() {
        const modalEl = document.getElementById("homeServicePackageModal");
        if (!modalEl) {
            showToast("Add Package modal is available in package details view.", "info");
            return;
        }
        if (window.bootstrap) {
            new bootstrap.Modal(modalEl).show();
        } else {
            modalEl.style.display = "block";
            modalEl.classList.add("show");
        }
    };

    window.openAddPackageForCategoryModal = function() {
        if (!_activeModalCategoryKey) return;
        const cat = CORE_CATEGORIES.find(c => c.key === _activeModalCategoryKey);
        window.openAddPackageModal();
        const catInput = document.getElementById("modalCategory");
        if (catInput && cat) {
            catInput.value = cat.dbCategories[0];
        }
    };

    // Public API
    window.loadAdminPackages = loadAdminPackages;

    // Auto-init
    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("home-services-panel") || document.getElementById("service-pricing-panel")) {
            loadAdminPackages();
        }
    });

    if (document.readyState !== "loading" && (document.getElementById("home-services-panel") || document.getElementById("service-pricing-panel"))) {
        loadAdminPackages();
    }
})();
