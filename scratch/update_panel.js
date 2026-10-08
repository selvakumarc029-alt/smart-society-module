const fs = require('fs');

const panelHtml = `                <!-- Home Services & Pricing CRUD Management Panel (Resident Dashboard Card Model) -->
                <section class="d-none animate__animated animate__fadeIn" data-view="home-services" id="home-services-panel" data-alt-view="service-pricing">
                    <link rel="stylesheet" href="/smartapartment/css/service-category-cards.css?v=20261005-v1">
                    <style>
                        .admin-service-card {
                            background: #ffffff !important;
                            border: 1px solid #e2e8f0 !important;
                            border-radius: 16px !important;
                            padding: 1.15rem 0.85rem 0.95rem !important;
                            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02) !important;
                            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
                            position: relative !important;
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: center !important;
                            text-align: center !important;
                            height: 100% !important;
                        }
                        .admin-service-card:hover {
                            transform: translateY(-3px) !important;
                            box-shadow: 0 10px 22px -4px rgba(15, 23, 42, 0.1), 0 4px 8px -2px rgba(15, 23, 42, 0.04) !important;
                            border-color: #93c5fd !important;
                        }
                        .admin-price-badge-box {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 8px 12px;
                            width: 100%;
                            margin-top: auto;
                        }
                    </style>

                    <!-- Top Header matching Resident Dashboard style -->
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                        <div>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill small fw-semibold">
                                <i class="fa-solid fa-screwdriver-wrench me-1"></i> Live Pricing Control
                            </span>
                            <h4 class="fw-bold mb-0 mt-2 text-dark">
                                Home Services &amp; Pricing Management
                            </h4>
                            <p class="text-muted small mb-0 mt-1">
                                Edit starting rates and service packages. Updates reflect instantly across the resident dashboard.
                            </p>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button type="button" class="btn btn-outline-primary rounded-pill btn-sm px-3 fw-bold shadow-xs" onclick="window.loadAdminPackages()">
                                <i class="fa-solid fa-rotate me-1"></i> Refresh
                            </button>
                            <button type="button" class="btn btn-outline-secondary rounded-pill btn-sm px-3 fw-bold shadow-xs" onclick="window.resetToDefaultPricingCatalog()">
                                <i class="fa-solid fa-arrow-rotate-left me-1"></i> Reset Defaults
                            </button>
                            <button type="button" class="btn btn-primary rounded-pill btn-sm px-3 fw-bold shadow-xs" onclick="window.openAddPackageModal()">
                                <i class="fa-solid fa-plus me-1"></i> Add Custom Package
                            </button>
                        </div>
                    </div>

                    <!-- 8 Core Service Categories Grid (Card View - EXACT SAME as Resident Dashboard) -->
                    <div class="row g-2 g-md-3 mb-4" id="adminCategoryCardsGrid">
                        <div class="col-12 text-center py-5">
                            <div class="spinner-border text-primary" role="status"></div>
                            <div class="text-muted small mt-2">Loading live service categories...</div>
                        </div>
                    </div>

                    <!-- Category Packages Modal for editing sub-packages -->
                    <div class="modal fade" id="categoryPackagesModal" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered modal-lg">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0 pb-0 px-4 pt-4">
                                    <div class="d-flex align-items-center gap-3">
                                        <div id="catModalIconWrapper" class="service-icon-circle service-circle-red" style="width: 44px; height: 44px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                            <i id="catModalIcon" class="fa-solid fa-house-chimney"></i>
                                        </div>
                                        <div>
                                            <h5 class="modal-title fw-bold text-dark mb-0" id="catModalTitle">Category Packages</h5>
                                            <span class="text-muted small" id="catModalSubtitle">Manage individual packages and rates</span>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body px-4 py-3">
                                    <div class="table-responsive">
                                        <table class="table table-hover align-middle mb-0" style="font-size: 0.88rem;">
                                            <thead class="table-light">
                                                <tr>
                                                    <th>Package</th>
                                                    <th>Scope / Details</th>
                                                    <th style="width: 150px;">Live Price (₹)</th>
                                                    <th style="width: 120px;" class="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody id="catModalTableBody">
                                                <!-- Rows injected by JS -->
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex justify-content-between">
                                    <button type="button" class="btn btn-outline-primary rounded-pill btn-sm px-3 fw-bold" onclick="window.openAddPackageForCategoryModal()">
                                        <i class="fa-solid fa-plus me-1"></i> Add Package to Category
                                    </button>
                                    <button type="button" class="btn btn-secondary rounded-pill btn-sm px-4 fw-bold" data-bs-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>`;

['src/main/resources/templates/dashboards/society-admin.html', 'src/main/resources/templates/dashboards/superadmin.html'].forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    const startMarker = '<section class="d-none animate__animated animate__fadeIn" data-view="home-services" id="home-services-panel"';
    const endMarker = '</section>';
    
    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) {
        console.error('Start marker not found in ' + filePath);
        return;
    }
    
    const endIdx = content.indexOf(endMarker, startIdx);
    if (endIdx === -1) {
        console.error('End marker not found in ' + filePath);
        return;
    }
    
    const fullEndIdx = endIdx + endMarker.length;
    const before = content.substring(0, startIdx);
    const after = content.substring(fullEndIdx);
    
    fs.writeFileSync(filePath, before + panelHtml + after, 'utf8');
    console.log('Successfully updated ' + filePath);
});
