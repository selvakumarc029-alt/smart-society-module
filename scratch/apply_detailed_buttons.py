import re
import os

ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"
ADMIN_JS_PATH = r"src/main/resources/static/propertydirect/js/admin-dashboard.js"
TARGET_ADMIN_JS_PATH = r"target/classes/static/propertydirect/js/admin-dashboard.js"

print("--- Updating admin-dashboard.js ---")
with open(ADMIN_JS_PATH, "r", encoding="utf-8", errors="replace") as f:
    js_content = f.read()

new_js_section_8 = '''    // 8. CATEGORIES, AMENITIES & LOCATIONS METADATA
    // -------------------------------------------------------------
    const CATEGORY_TAGS = {
        'APARTMENT': 'High-Rise Living',
        'VILLA': 'Gated Community',
        'COMMERCIAL': 'Commercial Grade',
        'PLOT': 'Investment Land',
        'STUDIO': 'Compact Urban',
        'PENTHOUSE': 'Ultra-Luxury Tier',
        'OFFICE': 'Grade-A Workspace'
    };

    const AMENITY_GROUPS = {
        'Swimming Pool': 'Sports & Wellness',
        'Gym': 'Fitness & Health',
        'Clubhouse': 'Leisure & Social',
        'Power Backup': '24/7 Essentials',
        'Covered Parking': 'Convenience',
        '24/7 Security': 'Safety & Surveillance',
        'Lift': 'Infrastructure',
        'EV Charging': 'Green & Eco',
        'Children Play Area': 'Family Friendly',
        'Jogging Track': 'Wellness & Outdoor'
    };

    const LOCATION_TIERS = {
        'Bangalore': 'Tier 1 Metro \u2022 Tech Capital',
        'Bengaluru': 'Tier 1 Metro \u2022 Tech Capital',
        'Mumbai': 'Tier 1 Metro \u2022 Financial Center',
        'Delhi NCR': 'Tier 1 Metro \u2022 Capital Region',
        'Chennai': 'Tier 1 Metro \u2022 Industrial & IT Hub',
        'Hyderabad': 'Tier 1 Metro \u2022 High Growth Tech',
        'Pune': 'Tier 2 Metro \u2022 Education & IT',
        'Kolkata': 'Tier 1 Metro \u2022 Eastern Gateway',
        'Ahmedabad': 'Tier 2 Metro \u2022 Commerce Center',
        'Coimbatore': 'Tier 2 Growth \u2022 Manufacturing & IT',
        'Kochi': 'Tier 2 Growth \u2022 Port & Tourism'
    };

    function getCategoryTag(name) {
        const upper = (name || '').toUpperCase();
        for (const [k, v] of Object.entries(CATEGORY_TAGS)) {
            if (upper.includes(k)) return v;
        }
        return 'Specialized Category';
    }

    function getAmenityGroup(name) {
        for (const [k, v] of Object.entries(AMENITY_GROUPS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Standard Facility';
    }

    function getLocationTier(name) {
        for (const [k, v] of Object.entries(LOCATION_TIERS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Target Growth Market';
    }

    async function loadMetadata() {
        try {
            const res = await fetch('/api/property/portal/admin/metadata', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            state.metadata = await res.json();
            renderMetadataSection();
            renderFeaturedSection();
        } catch (err) {
            console.error("Error loading metadata:", err);
        }
    }

    function renderMetadataSection() {
        if (!state.metadata) return;
        const cats = state.metadata.categories || {};
        const amenities = state.metadata.amenities || {};
        const locations = state.metadata.locations || {};

        // Update Button Count Badges
        const catBadge = document.getElementById("metaCatBadge");
        if (catBadge) catBadge.textContent = Object.keys(cats).length + " Types";

        const amenBadge = document.getElementById("metaAmenBadge");
        if (amenBadge) amenBadge.textContent = Object.keys(amenities).length + " Items";

        const locBadge = document.getElementById("metaLocBadge");
        if (locBadge) locBadge.textContent = Object.keys(locations).length + " Cities";

        // 1. Categories Grid
        const catContainer = document.getElementById("metaCategoriesGrid");
        if (catContainer) {
            const catEntries = Object.entries(cats);
            if (catEntries.length === 0) {
                catContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No categories configured yet.</div>';
            } else {
                catContainer.innerHTML = catEntries.map(([name, count]) => {
                    const tag = getCategoryTag(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#64748b; font-weight:600;">${tag}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#eff6ff; color:#2563eb;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Category', '${escapeHtml(name)}')" title="Remove Category" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">\u2715</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 2. Amenities Grid
        const amenContainer = document.getElementById("metaAmenitiesGrid");
        if (amenContainer) {
            const amenEntries = Object.entries(amenities);
            if (amenEntries.length === 0) {
                amenContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No amenities configured yet.</div>';
            } else {
                amenContainer.innerHTML = amenEntries.map(([name, count]) => {
                    const group = getAmenityGroup(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.86rem; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#059669; font-weight:700;">${group}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#475569;">${count}</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Amenity', '${escapeHtml(name)}')" title="Remove Amenity" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">\u2715</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 3. Locations Grid
        const locContainer = document.getElementById("metaLocationsGrid");
        if (locContainer) {
            const locEntries = Object.entries(locations);
            if (locEntries.length === 0) {
                locContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No cities configured yet.</div>';
            } else {
                locContainer.innerHTML = locEntries.map(([name, count]) => {
                    const tier = getLocationTier(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#fff7ed; color:#ea580c; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#ea580c; font-weight:700;">${tier}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f8fafc; color:#334155; border:1px solid #e2e8f0;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Location', '${escapeHtml(name)}')" title="Remove City" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">\u2715</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    }

    // Comprehensive Metadata Creation Modal
    window.openMetadataDetailModal = function (type) {
        const modal = document.getElementById("metadataDetailModal");
        if (!modal) {
            console.error("Modal #metadataDetailModal not found");
            return;
        }

        const iconBadge = document.getElementById("metaModalIconBadge");
        const titleEl = document.getElementById("metaModalTitle");
        const subtitleEl = document.getElementById("metaModalSubtitle");
        const typeInput = document.getElementById("metaItemType");
        const fieldsContainer = document.getElementById("metaDynamicFields");
        const submitBtn = document.getElementById("metaSubmitBtn");

        typeInput.value = type;

        if (type === 'Category') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>';
            iconBadge.style.background = '#eff6ff';
            iconBadge.style.color = '#2563eb';
            titleEl.textContent = 'Add Property Category';
            subtitleEl.textContent = 'Configure architectural property taxonomy, code slug, and search filter specifications.';
            submitBtn.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Duplex Penthouse, Serviced Studio, Gated Villa" required
                        oninput="document.getElementById('metaCategorySlug').value = this.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')"
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Taxonomy Code / Slug</label>
                        <input id="metaCategorySlug" type="text" placeholder="e.g. DUPLEX_PENTHOUSE"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; font-family:monospace; background:#f8fafc; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Classification Group</label>
                        <select id="metaCategoryGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Residential">Residential Living</option>
                            <option value="Commercial">Commercial Real Estate</option>
                            <option value="Industrial">Industrial & Warehousing</option>
                            <option value="Land">Plot & Development Land</option>
                            <option value="Hospitality">Farmhouse & Resort Living</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Description & Guidelines</label>
                    <textarea id="metaCategoryDesc" rows="2" placeholder="Brief criteria for properties qualifying under this category..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaCategoryFeatured" checked style="width:16px; height:16px; accent-color:#2563eb; cursor:pointer;">
                    <label for="metaCategoryFeatured" style="font-size:0.82rem; color:#1e40af; font-weight:680; cursor:pointer; margin:0;">
                        Feature on search filter bar and buyer explore drawer
                    </label>
                </div>
            `;
        } else if (type === 'Amenity') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
            iconBadge.style.background = '#ecfdf5';
            iconBadge.style.color = '#059669';
            titleEl.textContent = 'Add Platform Amenity';
            subtitleEl.textContent = 'Register a standardized amenity for listing checklists, amenities filter, and compliance audits.';
            submitBtn.style.background = 'linear-gradient(135deg, #065f46 0%, #059669 100%)';

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Infinity Rooftop Pool, EV Fast Charger, Padel Court" required
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Group</label>
                        <select id="metaAmenityGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Sports & Fitness">Sports & Wellness</option>
                            <option value="Security & Safety">Security & Surveillance</option>
                            <option value="Green & Eco">Green Living & Eco</option>
                            <option value="Leisure & Clubhouse">Leisure & Clubhouse</option>
                            <option value="Smart Automation">Smart Home Automation</option>
                            <option value="Convenience">Convenience & Essentials</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Specification Tier</label>
                        <select id="metaAmenityTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Standard">Standard Facility</option>
                            <option value="Premium">Premium Upgrade</option>
                            <option value="Ultra-Luxury">Ultra-Luxury Signature</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Verification Guidelines</label>
                    <textarea id="metaAmenityGuidelines" rows="2" placeholder="e.g. Must support 22kW fast charging with dedicated parking bay..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#ecfdf5; border:1px solid #a7f3d0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaAmenityHighlight" checked style="width:16px; height:16px; accent-color:#059669; cursor:pointer;">
                    <label for="metaAmenityHighlight" style="font-size:0.82rem; color:#065f46; font-weight:680; cursor:pointer; margin:0;">
                        Include in quick search checklist and highlight on property cards
                    </label>
                </div>
            `;
        } else if (type === 'Location') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
            iconBadge.style.background = '#fff7ed';
            iconBadge.style.color = '#ea580c';
            titleEl.textContent = 'Add Market City / Location';
            subtitleEl.textContent = 'Expand regional platform operations, market benchmark rates, and locality clusters.';
            submitBtn.style.background = 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)';

            fieldsContainer.innerHTML = `
                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">City / Urban Center <span style="color:#ef4444;">*</span></label>
                        <input id="metaItemNameInput" type="text" placeholder="e.g. Coimbatore, Hyderabad, Pune" required
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">State / Province</label>
                        <input id="metaLocationState" type="text" placeholder="e.g. Tamil Nadu, Telangana"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Market Tier</label>
                        <select id="metaLocationTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Tier 1 Metro">Tier 1 Metro Capital</option>
                            <option value="Tier 2 Growth Hub">Tier 2 High-Growth Hub</option>
                            <option value="Emerging Corridor">Emerging Industrial Corridor</option>
                            <option value="Destination">Destination / Vacation Retreat</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Benchmark Rate (\u20b9/sq.ft)</label>
                        <input id="metaLocationRate" type="text" placeholder="e.g. \u20b9 5,500 - 11,000 / sq.ft"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Key Micro-Markets & Localities</label>
                    <input id="metaLocationLocalities" type="text" placeholder="Comma-separated: RS Puram, Peelamedu, Gandhipuram, Saravanampatti"
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#fff7ed; border:1px solid #fed7aa; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaLocationActive" checked style="width:16px; height:16px; accent-color:#ea580c; cursor:pointer;">
                    <label for="metaLocationActive" style="font-size:0.82rem; color:#9a3412; font-weight:680; cursor:pointer; margin:0;">
                        Open for public listings and buyer location filters immediately
                    </label>
                </div>
            `;
        }

        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.style.display = "grid";
        setTimeout(() => {
            const input = document.getElementById("metaItemNameInput");
            if (input) input.focus();
        }, 80);
    };

    window.submitMetadataDetail = async function (e) {
        if (e) e.preventDefault();
        const type = document.getElementById("metaItemType").value;
        const nameInput = document.getElementById("metaItemNameInput");
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            showToast("Please enter a valid item name", true);
            return;
        }

        const submitBtn = document.getElementById("metaSubmitBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Publishing to Platform...";
        }

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=ADD`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add item');

            // Optimistic update in state
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
'''

start_idx = js_content.find("// 8. CATEGORIES, AMENITIES & LOCATIONS METADATA")
end_idx = js_content.find("// 9. FEATURED LISTINGS & PUBLIC CONTENT")

if start_idx != -1 and end_idx != -1:
    js_content = js_content[:start_idx] + new_js_section_8 + "\n" + js_content[end_idx:]
    with open(ADMIN_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    with open(TARGET_ADMIN_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    print("Section 8 replaced cleanly in admin-dashboard.js!")
else:
    print(f"Indices: start={start_idx}, end={end_idx}")

print("--- Updating admin.html ---")
with open(ADMIN_HTML_PATH, "r", encoding="utf-8", errors="replace") as f:
    html_content = f.read()

# Replace the button block in admin.html with modern, high-detail styling and count badges
old_buttons_start = html_content.find('<div class="metadata-action-buttons"')
old_buttons_end = html_content.find('<!-- Categories Card -->', old_buttons_start)

if old_buttons_start != -1 and old_buttons_end != -1:
    new_buttons_block = '''<div class="metadata-action-buttons" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <!-- Add Category Button -->
                    <button type="button" onclick="openMetadataDetailModal('Category')" id="btnAddCategoryMeta" class="btn-meta-action btn-meta-category"
                        style="display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:14px; background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color:#ffffff; font-weight:750; font-size:0.86rem; cursor:pointer; border:1px solid rgba(255,255,255,0.22); box-shadow:0 6px 18px rgba(37,99,235,0.3); transition:all 0.22s cubic-bezier(0.4, 0, 0.2, 1);">
                        <span style="width:26px; height:26px; border-radius:8px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
                        </span>
                        <span>+ Add Category</span>
                        <span id="metaCatBadge" style="padding:2px 7px; border-radius:999px; background:rgba(255,255,255,0.22); font-size:0.72rem; font-weight:700;">Catalog</span>
                    </button>

                    <!-- Add Amenity Button -->
                    <button type="button" onclick="openMetadataDetailModal('Amenity')" id="btnAddAmenityMeta" class="btn-meta-action btn-meta-amenity"
                        style="display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:14px; background:linear-gradient(135deg, #065f46 0%, #059669 100%); color:#ffffff; font-weight:750; font-size:0.86rem; cursor:pointer; border:1px solid rgba(255,255,255,0.22); box-shadow:0 6px 18px rgba(5,150,105,0.3); transition:all 0.22s cubic-bezier(0.4, 0, 0.2, 1);">
                        <span style="width:26px; height:26px; border-radius:8px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                        </span>
                        <span>+ Add Amenity</span>
                        <span id="metaAmenBadge" style="padding:2px 7px; border-radius:999px; background:rgba(255,255,255,0.22); font-size:0.72rem; font-weight:700;">Catalog</span>
                    </button>

                    <!-- Add Location Button -->
                    <button type="button" onclick="openMetadataDetailModal('Location')" id="btnAddLocationMeta" class="btn-meta-action btn-meta-location"
                        style="display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:14px; background:linear-gradient(135deg, #9a3412 0%, #ea580c 100%); color:#ffffff; font-weight:750; font-size:0.86rem; cursor:pointer; border:1px solid rgba(255,255,255,0.22); box-shadow:0 6px 18px rgba(234,88,12,0.3); transition:all 0.22s cubic-bezier(0.4, 0, 0.2, 1);">
                        <span style="width:26px; height:26px; border-radius:8px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </span>
                        <span>+ Add Location</span>
                        <span id="metaLocBadge" style="padding:2px 7px; border-radius:999px; background:rgba(255,255,255,0.22); font-size:0.72rem; font-weight:700;">Catalog</span>
                    </button>
                </div>
            </div>

            '''
    html_content = html_content[:old_buttons_start] + new_buttons_block + html_content[old_buttons_end:]
    print("Replaced metadata buttons block cleanly in admin.html.")
else:
    print("Could not find metadata action buttons block in admin.html!")

# Ensure CSS for the buttons has hover effects
button_css = '''
        /* Detailed Metadata Buttons & Catalog Styles */
        .btn-meta-action {
            position: relative;
            outline: none;
            letter-spacing: 0.01em;
        }
        .btn-meta-action:hover {
            transform: translateY(-2px);
        }
        .btn-meta-action:active {
            transform: translateY(0) scale(0.98);
        }
        .btn-meta-category:hover {
            box-shadow: 0 8px 24px rgba(37,99,235,0.45) !important;
            filter: brightness(1.05);
        }
        .btn-meta-amenity:hover {
            box-shadow: 0 8px 24px rgba(5,150,105,0.45) !important;
            filter: brightness(1.05);
        }
        .btn-meta-location:hover {
            box-shadow: 0 8px 24px rgba(234,88,12,0.45) !important;
            filter: brightness(1.05);
        }
        .meta-detail-grid-item:hover {
            border-color: #cbd5e1 !important;
            box-shadow: 0 4px 14px rgba(15,23,42,0.06) !important;
            transform: translateY(-1px);
        }
        .meta-del-btn:hover {
            background: #fee2e2 !important;
            color: #b91c1c !important;
            transform: scale(1.1);
        }
'''

if ".btn-meta-action" not in html_content:
    head_close = html_content.find("</head>")
    if head_close != -1:
        html_content = html_content[:head_close] + "<style>" + button_css + "</style>\n" + html_content[head_close:]
        print("Injected button_css into <head> of admin.html.")
else:
    print("Button CSS already present or partially present.")

# Check and update the modal HTML
modal_markup = '''
    <!-- ================= DETAILED METADATA CREATOR MODAL ================= -->
    <div id="metadataDetailModal" class="modal hidden" style="display:none;">
        <div class="modal-card" style="width:min(600px, 94vw); max-height:calc(100vh - 40px); border-radius:20px; box-shadow:0 25px 60px rgba(15,23,42,0.3); padding:28px 32px; background:#ffffff;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div id="metaModalIconBadge" style="width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <!-- SVG injected by openMetadataDetailModal -->
                    </div>
                    <div>
                        <h2 id="metaModalTitle" style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0 0 2px 0;">Configure Catalog Item</h2>
                        <p id="metaModalSubtitle" style="font-size:0.82rem; color:#64748b; margin:0;">Platform metadata taxonomy specification.</p>
                    </div>
                </div>
                <button type="button" class="close" onclick="closeModal('metadataDetailModal')" aria-label="Close" style="width:34px; height:34px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:1.1rem; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s ease;">\u2715</button>
            </div>

            <form id="metadataDetailForm" onsubmit="submitMetadataDetail(event)">
                <input type="hidden" id="metaItemType" value="Category">

                <!-- Dynamic Form Fields injected via JS based on type -->
                <div id="metaDynamicFields" style="display:flex; flex-direction:column; gap:16px;">
                    <!-- Injected dynamically -->
                </div>

                <div class="pd-modal-actions" style="display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
                    <button type="button" onclick="closeModal('metadataDetailModal')" class="modal-cancel" style="padding:10px 18px; border-radius:12px; border:1px solid #cbd5e1; background:#ffffff; color:#475569; font-weight:700; font-size:0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" id="metaSubmitBtn" class="primary" style="padding:10px 24px; border-radius:12px; font-weight:750; font-size:0.85rem; color:#ffffff; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(15,23,42,0.2);">
                        Save & Publish Item
                    </button>
                </div>
            </form>
        </div>
    </div>
'''

modal_idx = html_content.find('<div id="metadataDetailModal"')
if modal_idx != -1:
    modal_end = html_content.find('<!-- PropertyDirect Unified Platform Admin Script -->', modal_idx)
    if modal_end != -1:
        html_content = html_content[:modal_idx] + modal_markup + "\n" + html_content[modal_end:]
        print("Replaced metadataDetailModal markup cleanly.")
else:
    body_close = html_content.find("</body>")
    if body_close != -1:
        html_content = html_content[:body_close] + modal_markup + "\n" + html_content[body_close:]
        print("Injected metadataDetailModal before </body>.")

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_content)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_content)

print("admin.html synchronized.")
