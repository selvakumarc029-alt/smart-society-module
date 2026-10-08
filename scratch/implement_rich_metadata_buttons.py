import re

# ==============================================================================
# 1. UPDATE src/main/resources/templates/propertydirect/dashboards/admin.html
# ==============================================================================

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'r', encoding='utf-8') as f:
    admin_html = f.read()

# Replace the 3 buttons in the metadata panel
old_meta_buttons = """                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" onclick="addMetadataItem('Category')" class="small" style="padding:8px 14px; border-radius:10px; background:#0f172a; color:#ffffff; font-weight:700; cursor:pointer; border:none;">
                        ＋ Add Category
                    </button>
                    <button type="button" onclick="addMetadataItem('Amenity')" class="small" style="padding:8px 14px; border-radius:10px; background:#0f172a; color:#ffffff; font-weight:700; cursor:pointer; border:none;">
                        ＋ Add Amenity
                    </button>
                    <button type="button" onclick="addMetadataItem('Location')" class="small" style="padding:8px 14px; border-radius:10px; background:#0f172a; color:#ffffff; font-weight:700; cursor:pointer; border:none;">
                        ＋ Add Location
                    </button>
                </div>"""

new_meta_buttons = """                <div class="metadata-action-buttons" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <!-- Add Category Button -->
                    <button type="button" onclick="openMetadataDetailModal('Category')" id="btnAddCategoryMeta" class="btn-meta-action btn-meta-category"
                        style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color:#ffffff; font-weight:750; font-size:0.84rem; cursor:pointer; border:1px solid rgba(255,255,255,0.18); box-shadow:0 4px 14px rgba(37,99,235,0.25); transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
                        ＋ Add Category
                    </button>

                    <!-- Add Amenity Button -->
                    <button type="button" onclick="openMetadataDetailModal('Amenity')" id="btnAddAmenityMeta" class="btn-meta-action btn-meta-amenity"
                        style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; background:linear-gradient(135deg, #065f46 0%, #059669 100%); color:#ffffff; font-weight:750; font-size:0.84rem; cursor:pointer; border:1px solid rgba(255,255,255,0.18); box-shadow:0 4px 14px rgba(5,150,105,0.25); transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                        ＋ Add Amenity
                    </button>

                    <!-- Add Location Button -->
                    <button type="button" onclick="openMetadataDetailModal('Location')" id="btnAddLocationMeta" class="btn-meta-action btn-meta-location"
                        style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; background:linear-gradient(135deg, #9a3412 0%, #ea580c 100%); color:#ffffff; font-weight:750; font-size:0.84rem; cursor:pointer; border:1px solid rgba(255,255,255,0.18); box-shadow:0 4px 14px rgba(234,88,12,0.25); transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ＋ Add Location
                    </button>
                </div>"""

assert old_meta_buttons in admin_html, "old_meta_buttons not found in admin.html"
admin_html = admin_html.replace(old_meta_buttons, new_meta_buttons)

# Add CSS styles for the buttons and modal in <head>
meta_css = """
        /* Detailed Metadata Buttons and Interactive Modal */
        .btn-meta-category:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 22px rgba(37, 99, 235, 0.4) !important;
        }
        .btn-meta-amenity:hover {
            background: linear-gradient(135deg, #047857 0%, #065f46 100%) !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 22px rgba(5, 150, 105, 0.4) !important;
        }
        .btn-meta-location:hover {
            background: linear-gradient(135deg, #c2410c 0%, #9a3412 100%) !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 22px rgba(234, 88, 12, 0.4) !important;
        }
        .btn-meta-action:active {
            transform: translateY(0) scale(0.98) !important;
        }

        .meta-detail-grid-item {
            padding: 14px 18px !important;
            border-radius: 14px !important;
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
            transition: all 0.2s ease !important;
        }
        .meta-detail-grid-item:hover {
            border-color: #cbd5e1 !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07) !important;
            transform: translateY(-1px) !important;
        }
        .meta-del-btn {
            background: transparent !important;
            border: none !important;
            color: #94a3b8 !important;
            cursor: pointer !important;
            padding: 4px 6px !important;
            border-radius: 6px !important;
            font-size: 0.85rem !important;
            line-height: 1 !important;
            transition: all 0.15s ease !important;
        }
        .meta-del-btn:hover {
            background: #fee2e2 !important;
            color: #ef4444 !important;
        }
"""

if ".btn-meta-category:hover" not in admin_html:
    admin_html = admin_html.replace("</head>", meta_css + "\n</head>")

# Add the detailed modal before </body>
modal_markup = """
    <!-- ================= DETAILED METADATA CREATOR MODAL ================= -->
    <div id="metadataDetailModal" class="modal hidden" style="display:none;">
        <div class="modal-card" style="width:min(580px, 94vw); max-height:calc(100vh - 40px); border-radius:20px; box-shadow:0 25px 60px rgba(15,23,42,0.3); padding:28px 32px; background:#ffffff;">
            <button type="button" class="close" onclick="closeModal('metadataDetailModal')">✕</button>
            
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:8px;">
                <div id="metaModalIconBadge" style="width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.45rem; background:#eff6ff; color:#2563eb; flex-shrink:0; box-shadow:0 2px 8px rgba(37,99,235,0.15);">
                    🏢
                </div>
                <div>
                    <h2 id="metaModalTitle" style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0 0 2px 0;">Add New Property Category</h2>
                    <p id="metaModalSubtitle" style="font-size:0.82rem; color:#64748b; margin:0;">Configure taxonomy type for search filtering and listing categorization.</p>
                </div>
            </div>

            <form id="metadataDetailForm" onsubmit="submitMetadataDetail(event)" style="margin-top:18px;">
                <input type="hidden" id="metaItemType" value="Category">

                <!-- Dynamic Form Fields injected via JS based on type -->
                <div id="metaDynamicFields" style="display:flex; flex-direction:column; gap:16px;">
                    <!-- Injected dynamically -->
                </div>

                <div class="pd-modal-actions" style="display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
                    <button type="button" onclick="closeModal('metadataDetailModal')" class="modal-cancel">Cancel</button>
                    <button type="submit" id="metaSubmitBtn" class="primary" style="padding:10px 24px; border-radius:12px; font-weight:750; font-size:0.85rem;">
                        Save &amp; Publish Item
                    </button>
                </div>
            </form>
        </div>
    </div>
"""

if "id=\"metadataDetailModal\"" not in admin_html:
    admin_html = admin_html.replace("<!-- PropertyDirect Unified Platform Admin Script -->", modal_markup + "\n<!-- PropertyDirect Unified Platform Admin Script -->")

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
with open('target/classes/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)

print("Updated admin.html in src and target!")


# ==============================================================================
# 2. UPDATE src/main/resources/static/propertydirect/js/admin-dashboard.js
# ==============================================================================

with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Replace renderMetadataSection and addMetadataItem with full rich modal & rendering system
old_metadata_js_start = js_content.find("function renderMetadataSection()")
old_metadata_js_end = js_content.find("// 9. FEATURED LISTINGS & PUBLIC CONTENT", old_metadata_js_start)

assert old_metadata_js_start != -1 and old_metadata_js_end != -1, "metadata JS section not found"

new_metadata_js = """function renderMetadataSection() {
        if (!state.metadata) return;
        const cats = state.metadata.categories || {};
        const amenities = state.metadata.amenities || {};
        const locations = state.metadata.locations || {};

        // 1. Categories Grid
        const catContainer = document.getElementById("metaCategoriesGrid");
        if (catContainer) {
            catContainer.innerHTML = Object.entries(cats).map(([name, count]) => {
                const icon = getCategoryIcon(name);
                const tag = getCategoryTag(name);
                return `
                    <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:1.3rem; flex-shrink:0;">${icon}</span>
                            <div style="min-width:0;">
                                <strong style="display:block; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                <span style="font-size:0.72rem; color:#64748b; font-weight:600;">${tag}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <span style="padding:3px 9px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#eff6ff; color:#2563eb;">${count} listings</span>
                            <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Category', '${escapeHtml(name)}')" title="Remove Category">✕</button>
                        </div>
                    </div>`;
            }).join('');
        }

        // 2. Amenities Grid
        const amenContainer = document.getElementById("metaAmenitiesGrid");
        if (amenContainer) {
            amenContainer.innerHTML = Object.entries(amenities).map(([name, count]) => {
                const icon = getAmenityIcon(name);
                const group = getAmenityGroup(name);
                return `
                    <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:1.25rem; flex-shrink:0;">${icon}</span>
                            <div style="min-width:0;">
                                <strong style="display:block; font-size:0.86rem; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                <span style="font-size:0.72rem; color:#059669; font-weight:700;">${group}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <span style="padding:3px 8px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#475569;">${count}</span>
                            <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Amenity', '${escapeHtml(name)}')" title="Remove Amenity">✕</button>
                        </div>
                    </div>`;
            }).join('');
        }

        // 3. Locations Grid
        const locContainer = document.getElementById("metaLocationsGrid");
        if (locContainer) {
            locContainer.innerHTML = Object.entries(locations).map(([name, count]) => {
                const tier = getLocationTier(name);
                return `
                    <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:1.3rem; flex-shrink:0;">📍</span>
                            <div style="min-width:0;">
                                <strong style="display:block; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                <span style="font-size:0.72rem; color:#ea580c; font-weight:700;">${tier}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <span style="padding:3px 9px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#ecfdf5; color:#047857;">${count} active</span>
                            <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Location', '${escapeHtml(name)}')" title="Remove Location">✕</button>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // Helper classification icon/group lookups
    function getCategoryIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('villa') || n.includes('house')) return '🏡';
        if (n.includes('commercial') || n.includes('office') || n.includes('retail')) return '🏬';
        if (n.includes('penthouse')) return '🏰';
        if (n.includes('plot') || n.includes('land')) return '🏗️';
        if (n.includes('resort') || n.includes('beach') || n.includes('farm')) return '🏖️';
        if (n.includes('studio') || n.includes('suite')) return '🛋️';
        return '🏢';
    }

    function getCategoryTag(name) {
        const n = name.toLowerCase();
        if (n.includes('commercial') || n.includes('retail')) return 'Commercial Asset';
        if (n.includes('plot') || n.includes('land')) return 'Open Land Parcel';
        if (n.includes('villa') || n.includes('penthouse')) return 'Luxury Residential';
        return 'Standard Residential';
    }

    function getAmenityIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('pool') || n.includes('swim')) return '🏊‍♂️';
        if (n.includes('gym') || n.includes('fitness')) return '🏋️';
        if (n.includes('club')) return '🛎️';
        if (n.includes('security') || n.includes('cctv')) return '🛡️';
        if (n.includes('ev') || n.includes('charg')) return '⚡';
        if (n.includes('park') || n.includes('garden') || n.includes('jog')) return '🌿';
        if (n.includes('play') || n.includes('court') || n.includes('sport')) return '🎾';
        if (n.includes('power') || n.includes('generator')) return '🔋';
        if (n.includes('parking')) return '🅿️';
        return '✨';
    }

    function getAmenityGroup(name) {
        const n = name.toLowerCase();
        if (n.includes('pool') || n.includes('club') || n.includes('play')) return 'Recreation & Leisure';
        if (n.includes('gym') || n.includes('jog') || n.includes('court')) return 'Health & Sports';
        if (n.includes('security') || n.includes('cctv') || n.includes('fire')) return 'Safety & Security';
        if (n.includes('ev') || n.includes('rain') || n.includes('power')) return 'Eco & Infrastructure';
        return 'Resident Convenience';
    }

    function getLocationTier(name) {
        const n = name.toLowerCase();
        if (['bengaluru', 'mumbai', 'delhi ncr', 'hyderabad', 'chennai', 'kolkata'].includes(n)) return 'Tier 1 Metro';
        if (['pune', 'ahmedabad', 'kochi', 'chandigarh', 'jaipur', 'lucknow'].includes(n)) return 'Tier 2 Growth Hub';
        return 'Regional Real Estate Market';
    }

    // =============================================================
    // DETAILED METADATA MODAL LOGIC (Category, Amenity, Location)
    // =============================================================

    window.openMetadataDetailModal = function (type) {
        const modal = document.getElementById("metadataDetailModal");
        if (!modal) {
            // fallback to prompt if modal container not found
            addMetadataItem(type);
            return;
        }

        const iconBadge = document.getElementById("metaModalIconBadge");
        const titleEl = document.getElementById("metaModalTitle");
        const subtitleEl = document.getElementById("metaModalSubtitle");
        const typeInput = document.getElementById("metaItemType");
        const fieldsContainer = document.getElementById("metaDynamicFields");

        typeInput.value = type;

        if (type === 'Category') {
            iconBadge.textContent = '🏢';
            iconBadge.style.background = '#eff6ff';
            iconBadge.style.color = '#2563eb';
            titleEl.textContent = 'Add New Property Category';
            subtitleEl.textContent = 'Define a new taxonomy category for search filters, listing forms, and inventory metrics.';

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                        Category Name <span style="color:#ef4444;">*</span>
                    </label>
                    <input type="text" id="metaInputName" placeholder="e.g. Duplex Penthouse, Luxury Villa, Studio Suite" required
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600;"
                        oninput="document.getElementById('metaInputCode').value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '_')">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Category Code (Slug)
                        </label>
                        <input type="text" id="metaInputCode" placeholder="AUTO_GENERATED" readonly
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:0.84rem; font-family:monospace; font-weight:700;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Classification
                        </label>
                        <select id="metaInputClass" style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600; background:#ffffff;">
                            <option value="Residential">Residential Living</option>
                            <option value="Commercial">Commercial Office / Retail</option>
                            <option value="Industrial">Industrial & Warehousing</option>
                            <option value="Plot">Open Land / Plot Parcel</option>
                            <option value="Speciality">Speciality & Hospitality</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                        Category Description
                    </label>
                    <textarea id="metaInputDesc" placeholder="Briefly describe property configurations, buyer demographics, and specifications for this category..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem; min-height:65px; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaInputHighlight" checked style="width:17px; height:17px; accent-color:#2563eb; cursor:pointer;">
                    <label for="metaInputHighlight" style="font-size:0.82rem; font-weight:700; color:#334155; cursor:pointer; margin:0;">
                        Feature as Quick-Filter on Public PropertyDirect Search Bar
                    </label>
                </div>
            `;
        } else if (type === 'Amenity') {
            iconBadge.textContent = '✨';
            iconBadge.style.background = '#ecfdf5';
            iconBadge.style.color = '#059669';
            titleEl.textContent = 'Add Platform Standard Amenity';
            subtitleEl.textContent = 'Configure standard amenities for builder projects, verified owner listings, and buyer filters.';

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                        Amenity Name <span style="color:#ef4444;">*</span>
                    </label>
                    <input type="text" id="metaInputName" placeholder="e.g. Rooftop Infinity Pool, Smart EV Charging Hub, 24/7 Concierge" required
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Amenity Category Group
                        </label>
                        <select id="metaInputClass" style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600; background:#ffffff;">
                            <option value="Recreation & Leisure">🏊 Recreation & Leisure</option>
                            <option value="Health & Sports">🏋️ Health & Sports</option>
                            <option value="Safety & Security">🛡️ Safety & Security</option>
                            <option value="Eco & Green">⚡ Eco & Green Energy</option>
                            <option value="Convenience">🛎️ Convenience & Tech</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Specification Tier
                        </label>
                        <select id="metaInputTier" style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600; background:#ffffff;">
                            <option value="Standard">Standard Facility</option>
                            <option value="Premium">Premium Lifestyle Offering</option>
                            <option value="Ultra-Luxury">Ultra-Luxury Signature</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                        Specification Notes & Guidelines
                    </label>
                    <textarea id="metaInputDesc" placeholder="e.g. Minimum specifications for builder projects claiming this amenity..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem; min-height:65px; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaInputHighlight" checked style="width:17px; height:17px; accent-color:#059669; cursor:pointer;">
                    <label for="metaInputHighlight" style="font-size:0.82rem; font-weight:700; color:#334155; cursor:pointer; margin:0;">
                        Include in Quick Search Checklist on Customer Browsing Page
                    </label>
                </div>
            `;
        } else if (type === 'Location') {
            iconBadge.textContent = '📍';
            iconBadge.style.background = '#fff7ed';
            iconBadge.style.color = '#ea580c';
            titleEl.textContent = 'Add Supported City / Region';
            subtitleEl.textContent = 'Expand PropertyDirect coverage to new metropolitan markets and emerging residential corridors.';

            fieldsContainer.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            City / Metro Name <span style="color:#ef4444;">*</span>
                        </label>
                        <input type="text" id="metaInputName" placeholder="e.g. Kochi, Chandigarh, Jaipur" required
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            State / Province <span style="color:#ef4444;">*</span>
                        </label>
                        <input type="text" id="metaInputState" placeholder="e.g. Kerala, Punjab, Rajasthan" required
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Market Classification Tier
                        </label>
                        <select id="metaInputTier" style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600; background:#ffffff;">
                            <option value="Tier 1 Metro">Tier 1 Metro (Prime Economic Center)</option>
                            <option value="Tier 2 Growth Hub" selected>Tier 2 Growth Hub (Emerging Market)</option>
                            <option value="Destination Corridor">Vacation / Coastal Hub</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                            Est. Price Range (₹/sq.ft)
                        </label>
                        <input type="text" id="metaInputPriceRange" placeholder="e.g. ₹5,500 – ₹12,000 / sq.ft"
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.86rem; font-weight:600;">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">
                        Prominent Localities & Micro-Markets
                    </label>
                    <textarea id="metaInputDesc" placeholder="e.g. Kakkanad, Marine Drive, Edappally, Panampilly Nagar (comma separated)..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.85rem; min-height:65px; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaInputHighlight" checked style="width:17px; height:17px; accent-color:#ea580c; cursor:pointer;">
                    <label for="metaInputHighlight" style="font-size:0.82rem; font-weight:700; color:#334155; cursor:pointer; margin:0;">
                        Enable Immediate Property Postings & Builder Projects in this Location
                    </label>
                </div>
            `;
        }

        modal.classList.remove("hidden");
        modal.style.display = "flex";
        const inputName = document.getElementById("metaInputName");
        if (inputName) inputName.focus();
    };

    window.submitMetadataDetail = async function (e) {
        e.preventDefault();
        const type = document.getElementById("metaItemType").value;
        const nameInput = document.getElementById("metaInputName");
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            alert(`Please enter a valid ${type} name.`);
            return;
        }

        const submitBtn = document.getElementById("metaSubmitBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=ADD`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update metadata');

            // Optimistically add to state.metadata so it reflects instantly
            if (state.metadata) {
                if (type === 'Category') {
                    state.metadata.categories = state.metadata.categories || {};
                    state.metadata.categories[name] = 0;
                } else if (type === 'Amenity') {
                    state.metadata.amenities = state.metadata.amenities || {};
                    state.metadata.amenities[name] = 0;
                } else if (type === 'Location') {
                    state.metadata.locations = state.metadata.locations || {};
                    state.metadata.locations[name] = 0;
                }
                renderMetadataSection();
            }

            closeModal('metadataDetailModal');
            showToast(`${type} '${name}' successfully configured and published to platform catalog!`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save & Publish Item';
            }
        }
    };

    window.removeMetadataItem = async function (type, name) {
        if (!confirm(`Are you sure you want to remove ${type} '${name}' from platform catalog?`)) return;

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=REMOVE`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to remove item');

            if (state.metadata) {
                if (type === 'Category' && state.metadata.categories) delete state.metadata.categories[name];
                if (type === 'Amenity' && state.metadata.amenities) delete state.metadata.amenities[name];
                if (type === 'Location' && state.metadata.locations) delete state.metadata.locations[name];
                renderMetadataSection();
            }

            showToast(`${type} '${name}' removed from catalog.`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // Backwards compatibility alias
    window.addMetadataItem = function (type) {
        window.openMetadataDetailModal(type);
    };

    """

js_content = js_content[:old_metadata_js_start] + new_metadata_js + js_content[old_metadata_js_end:]

with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js_content)
with open('target/classes/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Updated admin-dashboard.js in src and target!")
