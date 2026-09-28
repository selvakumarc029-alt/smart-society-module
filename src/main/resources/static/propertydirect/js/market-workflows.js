(() => {
    "use strict";
    const role = document.body.dataset.dashboardRole || "";
    const apiRoot = "/api/property";
    const pendingProperties = new Map();
    const ownerProperties = new Map();

    const currency = value => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
    const when = value => value ? new Date(value).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "—";

    function notify(message) {
        if (typeof showToast === "function") showToast(message);
        else if (typeof showAgentToast === "function") showAgentToast(message);
        else {
            const toast = document.getElementById("agentToast") || document.getElementById("toast");
            if (!toast) return;
            toast.textContent = message;
            toast.style.display = "block";
            toast.classList.remove("hidden");
            setTimeout(() => { toast.classList.add("hidden"); toast.style.display = "none"; }, 3600);
        }
    }

    async function api(path, options = {}) {
        const multipart = options.body instanceof FormData;
        const response = await fetch(`${apiRoot}${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body && !multipart ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) throw new Error("Please sign in with the required PropertyDirect role.");
        if (!response.ok) throw new Error(payload.message || payload.detail || "The operation could not be completed.");
        return payload;
    }

    async function absoluteApi(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) throw new Error("Please sign in with the required PropertyDirect role.");
        if (!response.ok) throw new Error(payload.message || payload.detail || "The operation could not be completed.");
        return payload;
    }

    const fields = form => {
        const data = new FormData(form);
        const obj = {};
        for (const [key, value] of data.entries()) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (Array.isArray(obj[key])) {
                    obj[key].push(value);
                } else {
                    obj[key] = [obj[key], value];
                }
            } else {
                obj[key] = value;
            }
        }
        const amenities = data.getAll("amenities").map(s => String(s).trim()).filter(Boolean);
        if (amenities.length > 0) {
            obj.amenities = amenities.join(", ");
        } else if (Array.isArray(obj.amenities)) {
            obj.amenities = obj.amenities.map(s => String(s).trim()).filter(Boolean).join(", ");
        }
        return obj;
    };

    function fillInput(formId, name, value) {
        const input = document.querySelector(`#${formId} [name="${name}"]`);
        if (input) input.value = value;
    }

    function openPanel(panel) {
        document.querySelector(`.sidebar-nav [data-panel="${panel}"]`)?.click();
    }

    function statusBadge(value) {
        const badge = document.createElement("span");
        const normalized = String(value).toUpperCase();
        badge.className = `status ${["VERIFIED", "APPROVED", "ACTIVE", "CONFIRMED", "COMPLETED"].includes(normalized) ? "active" : normalized === "REJECTED" ? "rejected" : "pending"}`;
        badge.textContent = value || "PENDING";
        return badge;
    }

    function cell(row, value) {
        const td = document.createElement("td");
        td.textContent = value ?? "—";
        row.appendChild(td);
        return td;
    }

    function actionButton(label, action, listingId) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.propertyApiAction = action;
        if (listingId !== undefined) button.dataset.listingId = listingId;
        return button;
    }

    function listingCard(listing) {
        const card = document.createElement("article");
        card.className = "dash-card";
        const title = document.createElement("h3"); title.textContent = [listing.apartmentCode, listing.title].filter(Boolean).join(" · ");
        const place = document.createElement("p"); place.textContent = `${listing.society} · ${listing.locality}, ${listing.city}`;
        const detail = document.createElement("p"); detail.textContent = `${listing.bhk} · ${listing.furnishing || "Furnishing not specified"} · ${listing.areaSqft ? `${listing.areaSqft} sqft` : "Area not specified"}`;
        const price = document.createElement("strong"); price.textContent = currency(listing.price);
        const verification = document.createElement("p"); verification.append("Verification: ", statusBadge(listing.verificationStatus));
        const actions = document.createElement("p");
        actions.append(actionButton("Shortlist", "shortlist", listing.id), " ", actionButton("Contact Owner", "prepare-contact", listing.id), " ", actionButton("Request Visit", "prepare-visit", listing.id));
        card.append(title, place, detail, price, verification, actions);
        return card;
    }

    async function searchListings(form = document.getElementById("propertySearchForm")) {
        if (!form) return [];
        const params = new URLSearchParams();
        Object.entries(fields(form)).forEach(([key, value]) => { if (value !== "") params.set(key, value); });
        const items = await api(`/listings?${params}`);
        const results = document.getElementById("propertySearchResults");
        if (results) {
            if (items.length) {
                results.replaceChildren(...items.map(listingCard));
            } else {
                const empty = document.createElement("p");
                empty.className = "empty-state";
                empty.textContent = "No approved properties match these filters yet.";
                results.replaceChildren(empty);
            }
        }
        const state = document.getElementById("searchResultState");
        if (state) state.textContent = `${items.length} matching propert${items.length === 1 ? "y" : "ies"}`;
        return items;
    }

    function updateStat(name, value) {
        const node = document.querySelector(`[data-property-stat="${name}"]`);
        if (node) node.textContent = value;
    }

    async function loadSaved() {
        const list = document.getElementById("savedPropertiesList");
        if (!list) return [];
        const items = await api("/saved");
        const rows = items.map(item => {
            const listing = item.listing;
            const row = document.createElement("li");
            const description = document.createElement("span");
            description.textContent = `${listing.title} · ${listing.locality} · ${currency(listing.price)}`;
            row.append(description, actionButton("Contact", "prepare-contact", listing.id), actionButton("Visit", "prepare-visit", listing.id), actionButton("Remove", "remove-shortlist", listing.id));
            return row;
        });
        if (!rows.length) { const empty = document.createElement("li"); empty.textContent = "No shortlisted properties yet. Use Search Properties to add one."; rows.push(empty); }
        list.replaceChildren(...rows);
        updateStat("saved", items.length);
        return items;
    }

    async function loadSavedSearches() {
        const body = document.getElementById("savedSearchesBody");
        if (!body) return [];
        const items = await api("/saved-searches");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            cell(row, item.name); cell(row, [item.locality, item.city].filter(Boolean).join(", ") || "Any area"); cell(row, item.listingType || "Any"); cell(row, item.bhk || "Any"); cell(row, `${item.minPrice ? currency(item.minPrice) : "Any"} – ${item.maxPrice ? currency(item.maxPrice) : "Any"}`);
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.alertsEnabled ? "ACTIVE" : "OFF"));
            const actions = cell(row, "");
            const checkBtn = document.createElement("button");
            checkBtn.type = "button";
            checkBtn.className = "btn-secondary small";
            checkBtn.style.padding = "4px 8px";
            checkBtn.style.fontSize = "0.75rem";
            checkBtn.style.cursor = "pointer";
            checkBtn.dataset.propertyApiAction = "check-search-matches";
            checkBtn.dataset.searchId = item.id;
            checkBtn.dataset.searchName = item.name;
            checkBtn.textContent = "Check Matches";
            actions.appendChild(checkBtn);
            return row;
        }));
        updateStat("searches", items.length);
        return items;
    }

    async function loadVisits() {
        const body = document.getElementById("propertyVisitsBody");
        if (!body) return [];
        const items = await api("/visits");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.listing?.title || `Listing ${item.listing?.id || ""}`); cell(row, when(item.scheduledAt));
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.visitStatus)); cell(row, item.notes || "—"); return row;
        }));
        updateStat("visits", items.length);
        return items;
    }

    async function loadOwnerVisits() {
        const body = document.getElementById("ownerVisitsBody") || document.getElementById("agentVisitsBody");
        if (!body) return [];
        let items = [];
        try {
            items = await api("/owner/visits");
        } catch (e) {
            console.warn("Could not load owner visits:", e);
            return [];
        }
        if (!items.length) {
            body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">No site visit requests received yet.</td></tr>`;
            return [];
        }
        const esc = s => s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
        body.innerHTML = items.map(item => {
            const timeStr = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "Scheduled";
            const badgeClass = item.visitStatus === "CONFIRMED" ? "active" : item.visitStatus === "CANCELLED" || item.visitStatus === "COMPLETED" ? "closed" : "pending";
            let actions = '';
            if (item.visitStatus === "REQUESTED") {
                actions = `
                    <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 0.78rem; background: #16a34a; color: #fff; border: none; border-radius: 6px; cursor: pointer;" data-property-api-action="confirm-visit" data-visit-id="${item.id}">Confirm</button>
                    <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.78rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer;" data-property-api-action="cancel-visit" data-visit-id="${item.id}">Decline</button>
                `;
            } else if (item.visitStatus === "CONFIRMED") {
                actions = `
                    <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 0.78rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;" data-property-api-action="complete-visit" data-visit-id="${item.id}">Completed</button>
                    <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.78rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;" data-property-api-action="cancel-visit" data-visit-id="${item.id}">Cancel</button>
                `;
            } else {
                actions = `<span style="color: #94a3b8; font-size: 0.8rem;">—</span>`;
            }
            return `<tr data-visit-id="${item.id}">
                <td><strong>${esc(item.apartmentCode || ('#' + item.listingId))}</strong><br><small style="color: #64748b;">${esc(item.listingTitle)} (${esc(item.locality || item.city)})</small></td>
                <td><strong>${esc(timeStr)}</strong></td>
                <td><strong>${esc(item.visitorName)}</strong><br><small style="color: #64748b;">${esc(item.visitorPhone)} · ${esc(item.visitorEmail)}</small></td>
                <td><small style="color: #475569; max-width: 180px; display: block;">${esc(item.notes || 'No extra notes')}</small></td>
                <td><span class="status-badge ${badgeClass}">${esc(item.visitStatus)}</span></td>
                <td><div style="display: flex; gap: 6px;">${actions}</div></td>
            </tr>`;
        }).join("");
        const stat = document.querySelector('[data-stat="owner-visits"]');
        if (stat) stat.textContent = items.length;
        return items;
    }

    async function loadServices() {
        const body = document.getElementById("propertyServicesBody");
        if (!body) return [];
        const items = await api("/services");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.serviceType); cell(row, when(item.preferredAt));
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.requestStatus)); cell(row, item.details || "—"); return row;
        }));
        updateStat("services", items.length);
        return items;
    }

    function setDefaultDates() {
        document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
            if (input.value) return;
            const future = new Date(Date.now() + 2 * 86400000); future.setHours(11, 0, 0, 0); future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
            input.value = future.toISOString().slice(0, 16);
        });
    }

    async function loadOwnerListings() {
        const body = document.getElementById("agentListingsBody") || document.getElementById("ownerListingsBody") || document.getElementById("vendorListingsBody");
        if (!body) return [];
        const items = await api("/my-listings");
        ownerProperties.clear(); items.forEach(item => ownerProperties.set(String(item.id), item));

        // Populate listing dropdown for lead recording form
        const leadSelect = document.getElementById("leadListingSelect");
        if (leadSelect) {
            const currentVal = leadSelect.value;
            leadSelect.innerHTML = '<option value="">Select a property listing...</option>' +
                items.map(l => `<option value="${l.id}">${l.apartmentCode ? l.apartmentCode + ' · ' : ''}${l.title} (${l.locality || l.city})</option>`).join('');
            if (currentVal) leadSelect.value = currentVal;
        }

        if (body.id === "agentListingsBody" || role === "agent") {
            if (!items.length) {
                body.innerHTML = `<tr>
                    <td colspan="7" style="text-align: center; padding: 40px 20px; color: #64748b;">
                        <strong style="color: #0f172a; font-size: 1rem; display: block; margin-bottom: 6px;">No Property Listings Yet</strong>
                        <span>You haven't posted any property listings yet. Click below to submit your first listing for Super Admin approval.</span><br><br>
                        <button class="btn-primary" type="button" onclick="switchTab('post-listing')">+ Submit First Property Listing</button>
                    </td>
                </tr>`;
            } else {
                const esc = s => s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
                body.innerHTML = items.map(item => {
                    const code = item.apartmentCode || `PD-${item.id}`;
                    const typeBhk = [item.bhk, item.propertyType || item.listingType].filter(Boolean).join(" · ");
                    const loc = [item.locality, item.city].filter(Boolean).join(", ");
                    const statusNorm = String(item.verificationStatus || item.status || "PENDING").toUpperCase();
                    let modBadge = '';
                    if (statusNorm === "APPROVED" || statusNorm === "VERIFIED" || statusNorm === "ACTIVE") {
                        modBadge = '<span style="color: #16a34a; font-weight: 700;">● Verified & Approved</span>';
                    } else if (statusNorm === "REJECTED") {
                        modBadge = `<span style="color: #dc2626; font-weight: 700;">● Rejected</span>${item.rejectionReason ? `<br><small style="color: #991b1b; display: block; max-width: 180px; font-size: 0.75rem;">${esc(item.rejectionReason)}</small>` : ''}`;
                    } else if (statusNorm === "CHANGES_REQUESTED") {
                        modBadge = `<span style="color: #ea580c; font-weight: 700;">● Changes Requested</span>${item.reviewNote ? `<br><small style="color: #c2410c; display: block; max-width: 180px; font-size: 0.75rem;">${esc(item.reviewNote)}</small>` : ''}`;
                    } else {
                        modBadge = '<span style="color: #d97706; font-weight: 700;">● Under Review</span>';
                    }
                    const portalBadge = `<span class="status-badge ${["APPROVED", "VERIFIED", "ACTIVE"].includes(statusNorm) ? "active" : statusNorm === "REJECTED" ? "closed" : "pending"}">${["APPROVED", "VERIFIED", "ACTIVE"].includes(statusNorm) ? "● Live on Portal" : statusNorm === "REJECTED" ? "● Offline / Rejected" : "● Pending Review"}</span>`;

                    let actionHtml = '<div style="display: flex; gap: 6px; flex-wrap: wrap;">';
                    if (["REJECTED", "CHANGES_REQUESTED"].includes(statusNorm)) {
                        actionHtml += `<button type="button" class="btn-primary" style="padding: 5px 10px; font-size: 0.78rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;" data-property-api-action="edit-resubmit-listing" data-listing-id="${item.id}">Edit & Resubmit</button>`;
                    }
                    actionHtml += `<button type="button" class="btn-secondary" style="padding: 5px 10px; font-size: 0.78rem; border-radius: 6px; cursor: pointer;" data-property-api-action="deactivate-listing" data-listing-id="${item.id}">Deactivate</button>`;
                    actionHtml += `<button type="button" style="padding: 5px 10px; font-size: 0.78rem; background: #0f172a; color: #fff; border: none; border-radius: 6px; cursor: pointer;" data-property-api-action="review-property" data-listing-id="${item.id}">Inspect</button>`;
                    actionHtml += '</div>';

                    return `<tr data-listing-id="${item.id}">
                        <td><strong>${esc(code)}</strong></td>
                        <td><strong>${esc(item.title || 'Untitled Property')}</strong><br><small style="color: #64748b;">${esc(loc)}</small></td>
                        <td>${esc(typeBhk)}</td>
                        <td><strong style="color: #16a34a;">${currency(item.price)}</strong></td>
                        <td>${modBadge}</td>
                        <td>${portalBadge}</td>
                        <td>${actionHtml}</td>
                    </tr>`;
                }).join("");
            }
        } else {
            body.replaceChildren(...items.map(item => {
                const row = document.createElement("tr"); cell(row, [item.apartmentCode, item.title].filter(Boolean).join(" · ")); cell(row, item.listingType); cell(row, currency(item.price));
                const status = cell(row, ""); status.appendChild(statusBadge(item.verificationStatus)); if (item.verificationStatus === "REJECTED" && item.rejectionReason) { const reason = document.createElement("small"); reason.className = "listing-rejection-reason"; reason.textContent = item.rejectionReason; status.appendChild(reason); } cell(row, item.viewCount || 0);
                const actions = cell(row, ""); if (["REJECTED", "CHANGES_REQUESTED"].includes(item.verificationStatus)) actions.appendChild(actionButton("Edit & Resubmit", "edit-resubmit-listing", item.id)); actions.appendChild(actionButton("Deactivate", "deactivate-listing", item.id));
                return row;
            }));
        }

        const stat = document.querySelector('[data-stat="live"]'); if (stat) stat.textContent = items.filter(item => item.status === "ACTIVE").length;
        const pendingStat = document.querySelector('[data-stat="pending"]'); if (pendingStat) pendingStat.textContent = items.filter(item => item.verificationStatus === "PENDING" || item.status === "PENDING_APPROVAL").length;

        const totalVal = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
        const totalEl = document.getElementById("agentTotalValue"); if (totalEl) totalEl.textContent = currency(totalVal);
        const avgEl = document.getElementById("agentAvgPrice"); if (avgEl) avgEl.textContent = currency(items.length ? Math.round(totalVal / items.length) : 0);

        return items;
    }

    async function loadAgentEnquiries() {
        const leadsBody = document.getElementById("agentLeadsBody");
        const overviewBody = document.getElementById("agentOverviewLeadsBody");
        if (!leadsBody && !overviewBody) return [];

        const items = await api("/agent/leads");

        const stat = document.querySelector('[data-stat="leads"]');
        if (stat) stat.textContent = items.length;

        const esc = s => s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
        const renderRow = (item, isOverview = false) => {
            const ref = item.leadRef || (`#LD-${item.id || 9000}`);
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", {day: "2-digit", month: "short", year: "numeric"}) : "Recent";
            const badgeClass = item.status === "Deal Closed" ? "closed" : item.status === "Negotiation" || item.status === "New Lead" ? "active" : "pending";
            return `<tr>
                <td><strong>${esc(ref)}</strong></td>
                <td><strong>${esc(item.name || item.clientName || 'Client')}</strong><br><small style="color: #64748b;">${esc(item.phone || '')} · ${esc(item.email || '')}</small></td>
                <td><strong>${esc(item.propertyTitle || 'PropertyDirect Listing')}</strong><br><small style="color: #64748b;">${esc(item.propertyLocation || 'Bengaluru')}</small></td>
                <td><strong>${esc(item.enquiryType || 'INQUIRY')}</strong><br><small style="color: #64748b;">${esc(item.message || '')}</small></td>
                ${isOverview ? '' : `<td>${dateStr}</td>`}
                <td><span class="status-badge ${badgeClass}">${esc(item.status || 'Active Lead')}</span></td>
                <td><button style="padding: 5px 12px; font-size: 0.78rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;" onclick="callAgentLead('${esc(item.name || item.clientName)}', '${esc(item.phone)}')">Call Lead</button></td>
            </tr>`;
        };

        if (leadsBody) leadsBody.innerHTML = items.length ? items.map(i => renderRow(i, false)).join("") : '<tr><td colspan="7">No leads received yet.</td></tr>';
        if (overviewBody) overviewBody.innerHTML = items.length ? items.slice(0, 4).map(i => renderRow(i, true)).join("") : '<tr><td colspan="6">No leads received yet.</td></tr>';

        return items;
    }

    function recordNewAgentLead(id, values) {
        let stored = [];
        try {
            stored = JSON.parse(localStorage.getItem("propertydirect_agent_leads") || "[]");
        } catch (e) { stored = []; }

        const listingItem = ownerProperties.get(String(values.listingId));
        const newLead = {
            id: id || Date.now(),
            leadRef: `#LD-${id || Math.floor(1000 + Math.random() * 9000)}`,
            name: values.name,
            phone: values.phone,
            email: values.email,
            propertyTitle: listingItem ? listingItem.title : `Listing #${values.listingId}`,
            propertyLocation: listingItem ? `${listingItem.locality}, ${listingItem.city}` : "Bengaluru",
            enquiryType: values.type || "PURCHASE",
            message: values.message || "New direct client lead",
            createdAt: new Date().toISOString(),
            status: "New Lead"
        };
        stored.unshift(newLead);
        localStorage.setItem("propertydirect_agent_leads", JSON.stringify(stored));
    }

    async function createOwnerListing(form) {
        const input = fields(form);
        const payload = {
            title: input.title,
            description: input.description || (input.title + " located in " + (input.locality || input.city || "")),
            society: input.society || input.locality,
            locality: input.locality,
            address: input.address || input.locality || input.city,
            city: input.city,
            pincode: input.pincode && /^[0-9]{6}$/.test(input.pincode) ? input.pincode : null,
            type: String(input.type || input.purpose || "").toUpperCase().includes("SALE") ? "SALE" : "RENT",
            propertyType: input.propertyType || "APARTMENT",
            price: Number(String(input.price || "").replace(/[^\d.]/g, "")),
            deposit: input.deposit ? Number(input.deposit) : null,
            maintenance: input.maintenance ? Number(input.maintenance) : null,
            areaSqft: input.areaSqft ? Number(input.areaSqft) : null,
            bhk: input.bhk,
            bathrooms: input.bathrooms ? Number(input.bathrooms) : null,
            furnishing: input.furnishing || null,
            parking: input.parking || null,
            availableFrom: input.availableFrom || null,
            amenities: Array.isArray(input.amenities) ? input.amenities.filter(Boolean).join(", ") : (input.amenities || null),
            imageUrl: null,
            latitude: input.latitude ? Number(input.latitude) : null,
            longitude: input.longitude ? Number(input.longitude) : null,
            notes: input.description || null
        };
        if (!payload.title || !payload.locality || !payload.city || !payload.price) throw new Error("Title, city, locality and a valid price are required.");
        if (form.dataset.editingId) {
            await api(`/listings/${form.dataset.editingId}/resubmit`, {method: "PATCH", body: JSON.stringify(payload)});
            delete form.dataset.editingId; form.reset(); const photosInput=form.querySelector('[name="photos"]'); if(photosInput) photosInput.required=true; const submit=form.querySelector('[data-property-api-action="publish-owner-listing"]'); if(submit) submit.textContent="Submit property for approval"; notify("Property updated and resubmitted. Your listing is pending Super Admin review."); await loadOwnerListings(); openPanel("listings"); return;
        }
        const photos = [...(form.querySelector('[name="photos"]')?.files || form.querySelector('#propertyPhotoInput')?.files || [])];
        if (!photos.length) throw new Error("Please upload at least one property photo.");
        if (photos.length > 10) throw new Error("Please upload no more than 10 property photos.");
        const body = new FormData(); body.append("listing", new Blob([JSON.stringify(payload)], {type: "application/json"})); photos.forEach(photo => body.append("photos", photo));
        await api("/listings/with-photos", {method: "POST", body});
        form.reset();
        const preview = document.getElementById("propertyPhotoPreview") || document.getElementById("photoPreviewContainer");
        preview?.replaceChildren();
        const count = document.getElementById("propertyPhotoCount");
        if (count) count.textContent = "No photos selected";
        const success = document.getElementById("propertySubmissionSuccess");
        if (success) {
            success.textContent = "Property submitted successfully! Your listing is pending Super Admin review.";
            success.classList.remove("hidden");
        }
        notify("Property submitted successfully! Your listing is pending Super Admin review.");
        await loadOwnerListings();
        openPanel("listings");
    }

    function editAndResubmit(id) {
        const item = ownerProperties.get(String(id));
        const form = document.getElementById("postApartmentForm");
        if (!item || !form) return;
        const values = {title:item.title, description:item.description || item.notes, society:item.society, propertyType:item.propertyType,
            type:item.listingType, bhk:item.bhk, bathrooms:item.bathrooms, areaSqft:item.areaSqft, city:item.city, locality:item.locality,
            address:item.address, pincode:item.pincode, latitude:item.latitude, longitude:item.longitude, price:item.price,
            deposit:item.deposit, maintenance:item.maintenance, availableFrom:item.availableFrom, furnishing:item.furnishing,
            parking:item.parking, amenities:item.amenities};
        Object.entries(values).forEach(([name, value]) => { if (form.elements[name] && value != null) form.elements[name].value = value; });
        if (item.amenities) {
            const selectedAmenities = String(item.amenities).split(",").map(s => s.trim().toLowerCase());
            form.querySelectorAll('[name="amenities"]').forEach(cb => {
                cb.checked = selectedAmenities.includes(cb.value.trim().toLowerCase());
            });
        }
        form.dataset.editingId = item.id;
        const photos = form.querySelector('[name="photos"]'); if (photos) photos.required = false;
        const button = form.querySelector('[data-property-api-action="publish-owner-listing"]'); if (button) button.textContent = "Save & Resubmit for Approval";
        const upload = form.querySelector(".property-photo-upload"); if (upload) upload.classList.add("optional-on-resubmit");
        openPanel("post-listing");
    }

    function ensureSuperadminGovernancePanel() {
        if (role !== "superadmin") return;
        const nav = document.querySelector(".sidebar-nav"); const main = document.querySelector("main.dash-main"); if (!nav || !main) return;
        if (!nav.querySelector('[data-panel="customers"]')) { const button = document.createElement("button"); button.type = "button"; button.dataset.panel = "customers"; button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path></svg><span>Customers & Approvals</span>'; nav.appendChild(button); }
        if (!main.querySelector('[data-view="customers"]')) {
            const section = document.createElement("section"); section.className = "dash-panel hidden"; section.dataset.view = "customers";
            section.innerHTML = '<div class="dash-card customer-governance-card"><div class="card-head"><div><h3>Super Admin Property Approval Portal</h3><p>Review every pending submission before it becomes visible in PropertyDirect search.</p></div><button class="primary small" type="button" data-property-api-action="refresh-governance">Refresh</button></div><div class="customer-governance-stats four"><article><span>Total listed</span><strong id="totalPropertyCount">0</strong><small>All property submissions</small></article><article><span>Pending approvals</span><strong id="pendingPropertyCount">0</strong><small>Waiting for review</small></article><article><span>Approved properties</span><strong id="approvedPropertyCount">0</strong><small>Visible publicly</small></article><article><span>Total users</span><strong id="registeredCustomerCount">0</strong><small>Registered customers</small></article></div><div class="governance-title"><h4>Pending property submissions</h4><span id="approvalTableState">Loading…</span></div><div class="dashboard-table-scroll"><table id="approvalMgmtTable" class="approval-data-table"><thead><tr><th>Property title & Ref ID</th><th>Submitter & Role</th><th>Location & Price</th><th>Photos & Specs</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody id="propertyApprovalRows"></tbody></table></div></div>';
            main.insertBefore(section, document.getElementById("dashboardModal") || null);
        }
        if (!document.getElementById("propertyReviewModal")) {
            const modal = document.createElement("div");
            modal.className = "property-review-modal hidden";
            modal.id = "propertyReviewModal";
            modal.setAttribute("data-property-review", "");
            modal.innerHTML = '<div class="property-review-dialog"><button class="property-review-close" type="button" data-property-api-action="close-property-review" aria-label="Close">×</button><div class="property-review-gallery"><img id="propertyReviewMainImage" alt="Property"><div id="propertyReviewThumbs"></div></div><div class="property-review-content"><span class="status pending">Pending approval</span><h3 id="propertyReviewTitle">Property review</h3><p id="propertyReviewOwner"></p><div class="property-review-specs" id="propertyReviewSpecs"></div><section><h4>Description</h4><p id="propertyReviewDescription"></p></section><section><h4>Location</h4><p id="propertyReviewLocation"></p></section><label class="approval-review-note">Review / rejection reason<textarea rows="3" maxlength="2000" data-review-note placeholder="Required when rejecting the property"></textarea></label><div class="property-review-actions"><button class="primary" type="button" data-property-api-action="approve-property">Approve property</button><button type="button" data-property-api-action="reject-property">Reject property</button></div></div></div>';
            document.body.appendChild(modal);
        }
    }

    async function loadSuperadminGovernance() {
        if (role !== "superadmin") return;
        try {
            const [summary, pending] = await Promise.all([
                api("/admin/summary").catch(() => ({})),
                absoluteApi("/api/admin/properties/pending").catch(() => [])
            ]);
            const items = Array.isArray(pending) ? pending : [];
            const pendingCount = items.length;

            const totalEl = document.getElementById("totalPropertyCount"); if (totalEl) totalEl.textContent = summary.totalListings ?? 0;
            const custEl = document.getElementById("registeredCustomerCount"); if (custEl) custEl.textContent = summary.registeredCustomers ?? 0;
            const pendEl = document.getElementById("pendingPropertyCount"); if (pendEl) pendEl.textContent = summary.pendingListings ?? pendingCount;
            const appEl = document.getElementById("approvedPropertyCount"); if (appEl) appEl.textContent = summary.approvedListings ?? 0;

            const superPendingMetric = document.getElementById("superadminPendingMetric");
            if (superPendingMetric) superPendingMetric.textContent = summary.pendingListings ?? pendingCount;

            const propMgmtPendingEl = document.getElementById("propertyMgmtPendingCount");
            if (propMgmtPendingEl) propMgmtPendingEl.textContent = summary.pendingListings ?? pendingCount;

            pendingProperties.clear();
            items.forEach(item => {
                pendingProperties.set(String(item.id), item);
                if (item.apartmentCode) pendingProperties.set(String(item.apartmentCode), item);
            });

            const esc = s => s ? String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
            const rows = document.getElementById("propertyApprovalRows") || document.querySelector("#approvalMgmtTable tbody");
            if (rows) {
                if (!items.length) {
                    rows.innerHTML = `<tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: #64748b; font-size: 0.95rem;">
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                <strong style="color: #0f172a;">Queue Clear!</strong>
                                <span>No submitted properties are currently waiting for Super Admin approval.</span>
                            </div>
                        </td>
                    </tr>`;
                } else {
                    rows.innerHTML = items.map(item => {
                        const photoCount = Array.isArray(item.images) ? item.images.length : (item.images ? 1 : 0);
                        const specs = [
                            item.bedrooms ? `${item.bedrooms} BHK` : "",
                            item.bathrooms ? `${item.bathrooms} Baths` : "",
                            item.propertyType || ""
                        ].filter(Boolean).join(" · ") || "Residential";
                        const loc = [item.locality, item.city].filter(Boolean).join(", ") || "Tamil Nadu";
                        const code = item.apartmentCode || `PD-${item.id}`;
                        return `<tr data-listing-id="${item.id}">
                            <td>
                                <div>
                                    <strong style="color: #0f172a;">${esc(item.title || 'Untitled Property')}</strong><br>
                                    <small style="color: #64748b;">
                                        <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${esc(code)}</code>
                                        · ${esc(item.locality || item.city || '')}
                                    </small>
                                </div>
                            </td>
                            <td>
                                <strong>${esc(item.ownerName || 'Direct Owner')}</strong><br>
                                <span class="status active" style="background: #eff6ff; color: #1d4ed8; font-size: 0.75rem; padding: 2px 6px; white-space: nowrap !important;">
                                    Direct Owner / Vendor
                                </span>
                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${esc(item.ownerEmail || '')}</div>
                            </td>
                            <td>
                                ${esc(loc)}<br>
                                <strong style="color: #16a34a; font-size: 0.95rem;">${currency(item.price)}</strong>
                            </td>
                            <td>
                                ${photoCount} Photo${photoCount === 1 ? '' : 's'} · ${item.areaSqFt ? item.areaSqFt + ' sqft' : 'Standard'}<br>
                                <small style="color: #64748b;">${esc(specs)}</small>
                            </td>
                            <td>${when(item.submittedAt)}</td>
                            <td style="white-space: nowrap !important;">
                                <span class="status pending" style="background: #fef3c7; color: #92400e; font-weight: 800; white-space: nowrap !important; display: inline-block !important;">Pending Review</span>
                            </td>
                            <td style="text-align: right; white-space: nowrap !important;">
                                <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center; white-space: nowrap !important;">
                                    <button type="button" style="padding: 5px 8px; font-size: 0.76rem; font-weight: 700; border-radius: 6px; background: #2563eb; color: #ffffff; border: none; cursor: pointer; white-space: nowrap !important;"
                                        data-property-api-action="approve-property" data-listing-id="${item.id}">Approve</button>
                                    <button type="button" style="padding: 5px 8px; font-size: 0.76rem; font-weight: 700; border-radius: 6px; background: #ef4444; color: #ffffff; border: none; cursor: pointer; white-space: nowrap !important;"
                                        data-property-api-action="reject-property" data-listing-id="${item.id}">Reject</button>
                                    <button type="button" style="padding: 5px 8px; font-size: 0.76rem; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff; border: none; cursor: pointer; white-space: nowrap !important;"
                                        data-property-api-action="review-property" data-listing-id="${item.id}">Inspect</button>
                                </div>
                            </td>
                        </tr>`;
                    }).join("");
                }
            }
            const state = document.getElementById("approvalTableState"); if (state) state.textContent = `${items.length} pending`;
            const queueSummary = document.getElementById("approvalQueueSummary");
            if (queueSummary) queueSummary.innerHTML = `Showing <strong>${items.length ? 1 : 0} to ${items.length}</strong> of <strong>${items.length} pending approval items</strong> in queue`;
            if (typeof filterPropertyApprovalTable === "function") {
                filterPropertyApprovalTable();
            }

            // Sync live pending queue into Full Property Inventory Management Console (#propertyMgmtTable)
            const mgmtTbody = document.querySelector("#propertyMgmtTable tbody");
            if (mgmtTbody) {
                mgmtTbody.querySelectorAll("tr[data-live-pending='true']").forEach(r => r.remove());
                mgmtTbody.querySelectorAll("tr").forEach(r => {
                    const code = r.querySelector(".prop-id, code")?.innerText || "";
                    if (code.includes("PD-3104")) r.remove();
                });

                if (items.length) {
                    const livePendingRowsHtml = items.map(item => {
                        const code = item.apartmentCode || `PD-${item.id}`;
                        const loc = [item.locality, item.city].filter(Boolean).join(", ") || "Tamil Nadu";
                        const price = `₹${Number(item.price || 0).toLocaleString("en-IN")}`;
                        return `<tr data-listing-id="${item.id}" data-live-pending="true">
                            <td>
                                <div>
                                    <strong class="prop-title" style="color: #0f172a;">${esc(item.title || 'Untitled Property')}</strong><br>
                                    <small style="color: #64748b;">
                                        <code class="prop-id" style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 700;">#${esc(code)}</code>
                                        · ${esc(loc)}
                                    </small>
                                </div>
                            </td>
                            <td>
                                <strong style="color: #0f172a;">${esc(item.ownerName || 'Direct Seller')}</strong><br>
                                <small style="color: #b45309; font-weight: 700;">${esc(item.ownerEmail || 'Direct Owner / Vendor')}</small>
                            </td>
                            <td>
                                <strong style="color: #2563eb; font-size: 0.95rem; font-weight: 800;">${price}</strong>
                            </td>
                            <td>
                                <select class="prop-tier-select" onchange="changePropertyTier(this, '${esc(code)}')"
                                    style="height: 30px; padding: 0 8px; border-radius: 6px; font-weight: 800; font-size: 0.78rem; background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; cursor: pointer; white-space: nowrap !important;">
                                    <option value="Standard" selected>Standard</option>
                                    <option value="Featured">Featured</option>
                                    <option value="Premium">Premium</option>
                                </select>
                            </td>
                            <td>
                                <span class="status pending prop-status" style="background: #fef3c7; color: #b45309; font-weight: 800; white-space: nowrap !important;">Pending Approval</span>
                            </td>
                            <td style="text-align: left;">
                                <div style="display: flex; gap: 6px; justify-content: flex-start; align-items: center; white-space: nowrap !important;">
                                    <button type="button"
                                        style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 800; border-radius: 6px; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; border: none; cursor: pointer; white-space: nowrap !important; display: inline-flex; align-items: center; justify-content: center;"
                                        onclick="approveQueueProperty(this, '${item.id}')">Approve</button>
                                    <button type="button"
                                        style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff; border: 1px solid #cbd5e1; cursor: pointer; white-space: nowrap !important; display: inline-flex; align-items: center; justify-content: center;"
                                        onclick="rejectQueueProperty(this, '${item.id}')">Reject</button>
                                    <button type="button"
                                        style="height: 30px; padding: 0 12px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; cursor: pointer; white-space: nowrap !important; display: inline-flex; align-items: center; justify-content: center;"
                                        onclick="openPropertyReview('${item.id}')">Inspect</button>
                                </div>
                            </td>
                        </tr>`;
                    }).join("");
                    mgmtTbody.insertAdjacentHTML("afterbegin", livePendingRowsHtml);
                }

                if (typeof updateInventoryCounts === "function") {
                    updateInventoryCounts();
                }
                if (typeof filterPropertyMgmtTable === "function") {
                    filterPropertyMgmtTable();
                }
            }
        } catch (err) {
            console.error("Super Admin approval queue load error:", err);
        }
    }

    function ensurePropertyReviewModal() {
        if (!document.getElementById("propertyReviewModal")) {
            const modal = document.createElement("div");
            modal.className = "property-review-modal hidden";
            modal.id = "propertyReviewModal";
            modal.setAttribute("data-property-review", "");
            modal.innerHTML = '<div class="property-review-dialog"><button class="property-review-close" type="button" data-property-api-action="close-property-review" aria-label="Close">×</button><div class="property-review-gallery"><img id="propertyReviewMainImage" alt="Property"><div id="propertyReviewThumbs"></div></div><div class="property-review-content"><span class="status pending">Property Inspection</span><h3 id="propertyReviewTitle">Property review</h3><p id="propertyReviewOwner"></p><div class="property-review-specs" id="propertyReviewSpecs"></div><section><h4>Description</h4><p id="propertyReviewDescription"></p></section><section><h4>Location</h4><p id="propertyReviewLocation"></p></section><label class="approval-review-note" id="propertyReviewNoteContainer">Super Admin review / rejection reason<textarea rows="3" maxlength="2000" data-review-note placeholder="Required when rejecting the property"></textarea></label><div class="property-review-actions" id="propertyReviewActions"><button class="primary" type="button" data-property-api-action="approve-property">Approve property</button><button type="button" data-property-api-action="reject-property">Reject property</button></div></div></div>';
            document.body.appendChild(modal);
        }
    }

    function openPropertyReview(id) {
        ensurePropertyReviewModal();
        const cleanId = String(id).replace(/^PD-|^PDT-/, "");
        const item = pendingProperties.get(String(cleanId)) || pendingProperties.get(String(id)) || ownerProperties.get(String(cleanId)) || ownerProperties.get(String(id));
        const modal = document.getElementById("propertyReviewModal");
        if (!modal) return;
        if (!item) {
            notify("Listing details not found in active records.");
            return;
        }
        modal.querySelector("#propertyReviewTitle").textContent = [item.apartmentCode || ('PD-' + item.id), item.title || "Untitled property"].filter(Boolean).join(" · ");
        modal.querySelector("#propertyReviewOwner").textContent = `${item.ownerName || "Direct Owner / Agent"} · ${item.ownerEmail || ""}`;
        const descEl = modal.querySelector("#propertyReviewDescription");
        if (descEl) descEl.textContent = item.description || item.notes || "No description supplied.";
        const locEl = modal.querySelector("#propertyReviewLocation");
        if (locEl) locEl.textContent = [item.address, item.locality, item.city, item.pincode || item.postalCode, item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : ""].filter(Boolean).join(" · ") || "Location Unspecified";
        const specs = modal.querySelector("#propertyReviewSpecs");
        if (specs) {
            specs.replaceChildren(...[
                ["Price", currency(item.price)], ["Deposit", item.deposit ? currency(item.deposit) : "—"], ["Maintenance", item.maintenance ? currency(item.maintenance) : "—"],
                ["Type", item.propertyType || item.listingType || "—"], ["Bedrooms / BHK", item.bhk || item.bedrooms || "—"], ["Area", item.areaSqft || item.areaSqFt ? `${item.areaSqft || item.areaSqFt} sq ft` : "—"],
                ["Furnishing", item.furnishing || "—"], ["Parking", item.parking || "—"], ["Available", item.availableFrom || "—"], ["Amenities", item.amenities || "—"], ["Moderation Status", item.verificationStatus || item.status || "PENDING"]
            ].map(([label, value]) => { const card = document.createElement("article"); const key = document.createElement("span"); key.textContent = label; const content = document.createElement("strong"); content.textContent = value; card.append(key, content); return card; }));
        }
        const mainImage = modal.querySelector("#propertyReviewMainImage");
        let images = Array.isArray(item.images) ? item.images : (item.images ? [item.images] : []);
        if (!images.length && item.imageUrls) {
            images = item.imageUrls.split(/\r?\n/).filter(Boolean);
        } else if (!images.length && item.imageUrl) {
            images = [item.imageUrl];
        }
        if (mainImage) mainImage.src = images[0] || "/favicon.svg";
        const thumbs = modal.querySelector("#propertyReviewThumbs");
        if (thumbs) {
            thumbs.replaceChildren(...images.map(url => { const image = document.createElement("img"); image.src = url; image.alt = "Property preview"; image.addEventListener("click", () => { if (mainImage) mainImage.src = url; }); return image; }));
        }

        const actContainer = modal.querySelector("#propertyReviewActions");
        const noteContainer = modal.querySelector("#propertyReviewNoteContainer");
        const noteEl = modal.querySelector("[data-review-note]");
        if (role !== "superadmin") {
            if (actContainer) actContainer.style.display = "none";
            if (noteContainer) {
                if (item.rejectionReason || item.reviewNote) {
                    noteContainer.style.display = "block";
                    if (noteEl) {
                        noteEl.value = item.rejectionReason || item.reviewNote || "";
                        noteEl.readOnly = true;
                    }
                } else {
                    noteContainer.style.display = "none";
                }
            }
        } else {
            if (actContainer) actContainer.style.display = "flex";
            if (noteContainer) {
                noteContainer.style.display = "block";
                if (noteEl) {
                    noteEl.value = "";
                    noteEl.readOnly = false;
                }
            }
            modal.querySelectorAll('[data-property-api-action="approve-property"], [data-property-api-action="reject-property"]').forEach(button => { button.dataset.listingId = item.id; });
        }

        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function closePropertyReview() {
        document.getElementById("propertyReviewModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    async function handle(button) {
        const action = button.dataset.propertyApiAction;
        const form = button.closest("form");
        if (form && !form.reportValidity()) return;
        button.disabled = true;
        try {
            if (action === "search") await searchListings(form);
            else if (action === "shortlist") { await api(`/saved/${button.dataset.listingId}`, {method: "POST"}); notify("Property added to your shortlist."); await loadSaved(); }
            else if (action === "remove-shortlist") { await api(`/saved/${button.dataset.listingId}`, {method: "DELETE"}); notify("Property removed from your shortlist."); await loadSaved(); }
            else if (action === "prepare-contact") { fillInput("ownerContactForm", "listingId", button.dataset.listingId); openPanel("contacts"); }
            else if (action === "prepare-visit") { fillInput("propertyVisitForm", "listingId", button.dataset.listingId); openPanel("visits"); }
            else if (action === "contact-owner") {
                const values = fields(form);
                const context = [values.message, values.budget && `Budget: ${values.budget}`, values.moveInDate && `Move-in / purchase date: ${values.moveInDate}`, values.occupants && `Occupants: ${values.occupants}`, values.contactMethod && `Preferred contact: ${values.contactMethod}`, values.callbackAt && `Callback time: ${values.callbackAt}`].filter(Boolean).join("\n");
                const payload = {listingId:Number(values.listingId), name:values.name, phone:values.phone, email:values.email, type:values.type || "GENERAL", message:context || values.message || "Client inquiry"};
                const result = await api("/enquiries", {method: "POST", body: JSON.stringify(payload)});
                document.getElementById("ownerContactState") && (document.getElementById("ownerContactState").textContent = `Enquiry #${result.id} submitted`);
                notify("Your enquiry has been sent to the property owner.");
            }
            else if (action === "record-agent-lead") {
                const values = fields(form);
                await api("/agent/leads", {method: "POST", body: JSON.stringify({listingId:Number(values.listingId), name:values.name, phone:values.phone, email:values.email, type:values.type, message:values.message})});
                notify("Client lead saved.");
                if (typeof closeAgentLeadModal === "function") closeAgentLeadModal();
                if (form) form.reset();
                await loadAgentEnquiries();
            }
            else if (action === "schedule-visit") {
                const values = fields(form);
                const notes = [values.notes, `Visitor: ${values.visitorName}`, `Phone: ${values.contactPhone}`, `Attendees: ${values.attendees}`, `Mode: ${values.visitMode}`, values.alternateAt && `Alternate time: ${values.alternateAt}`, values.meetingPoint && `Meeting point: ${values.meetingPoint}`, values.vehicleNumber && `Vehicle: ${values.vehicleNumber}`, `Broker involved: ${values.brokerInvolved}`].filter(Boolean).join("\n");
                await api("/visits", {method: "POST", body: JSON.stringify({listingId:Number(values.listingId), scheduledAt:values.scheduledAt, notes})}); notify("Site visit requested."); await loadVisits();
            }
            else if (action === "request-service") {
                const values = fields(form);
                const details = [values.details, `Contact: ${values.contactName} (${values.contactPhone})`, `Address: ${values.serviceAddress}`, `Urgency: ${values.urgency}`, values.alternateAt && `Alternate time: ${values.alternateAt}`, values.budget && `Budget: Rs. ${values.budget}`, `Access: ${values.accessType}`, `Preferred contact: ${values.contactMethod}`].filter(Boolean).join("\n");
                await api("/services", {method: "POST", body: JSON.stringify({listingId:values.listingId ? Number(values.listingId) : null, serviceType:values.serviceType, preferredAt:values.preferredAt, details})}); notify("Home service requested."); await loadServices();
            }
            else if (action === "support-ticket") {
                const values = fields(form);
                const saved = await persistWorkflowAction("support-ticket", button, values);
                const list = document.getElementById("supportTickets");
                const item = document.createElement("li");
                item.textContent = `${values.title} · ${values.category.replaceAll("_", " ")} · ${values.priority} · Ticket #${saved.id || "saved"}`;
                if (list) { if (list.children.length === 1 && list.firstElementChild.textContent.includes("No active")) list.replaceChildren(); list.prepend(item); }
                const state = document.getElementById("supportState"); if (state) state.textContent = `Ticket #${saved.id || "saved"} submitted`;
                form.reset(); setDefaultDates(); notify("Detailed support ticket saved and submitted.");
            }
            else if (action === "save-search") { const payload = fields(form); payload.minPrice = payload.minPrice ? Number(payload.minPrice) : null; payload.maxPrice = payload.maxPrice ? Number(payload.maxPrice) : null; payload.alertsEnabled = form.elements.alertsEnabled.checked; await api("/saved-searches", {method: "POST", body: JSON.stringify(payload)}); notify("Search criteria saved."); await loadSavedSearches(); }
            else if (action === "check-search-matches") {
                const searchId = button.dataset.searchId;
                const searchName = button.dataset.searchName || "Saved Search";
                const res = await api(`/saved-searches/${searchId}/matches`);
                if (!res.matchCount) {
                    notify(`No active properties match '${searchName}' right now. You will be alerted when a matching property is published!`);
                } else {
                    notify(`Found ${res.matchCount} active property listing(s) matching '${searchName}'!`);
                }
            }
            else if (action === "refresh-owner-visits") {
                notify("Refreshing site visit requests...");
                await loadOwnerVisits();
            }
            else if (action === "confirm-visit") {
                await api(`/visits/${button.dataset.visitId}/status`, {method: "PATCH", body: JSON.stringify({status: "CONFIRMED", notes: "Confirmed by property owner"})});
                notify("Visit confirmed. Customer notified by email.");
                await loadOwnerVisits();
            }
            else if (action === "cancel-visit") {
                const reason = window.prompt("Reason for declining or cancelling this visit:") || "Declined by property owner";
                await api(`/visits/${button.dataset.visitId}/status`, {method: "PATCH", body: JSON.stringify({status: "CANCELLED", notes: reason})});
                notify("Visit request declined. Customer notified.");
                await loadOwnerVisits();
            }
            else if (action === "complete-visit") {
                await api(`/visits/${button.dataset.visitId}/status`, {method: "PATCH", body: JSON.stringify({status: "COMPLETED", notes: "Site tour completed successfully"})});
                notify("Visit marked as completed.");
                await loadOwnerVisits();
            }
            else if (action === "verify-listing") { notify("Final publication approval is restricted to the Super Admin."); }
            else if (action === "deactivate-listing") { await api(`/listings/${button.dataset.listingId}`, {method: "DELETE"}); notify("Listing deactivated."); await loadOwnerListings(); }
            else if (action === "edit-resubmit-listing") editAndResubmit(button.dataset.listingId);
            else if (action === "publish-owner-listing") await createOwnerListing(form);
            else if (action === "refresh-governance") { notify("Refreshing approval queue..."); await loadSuperadminGovernance(); }
            else if (action === "review-property") openPropertyReview(button.dataset.listingId);
            else if (action === "close-property-review") closePropertyReview();
            else if (["approve-property", "request-property-changes", "reject-property"].includes(action)) {
                let note = button.closest("[data-property-review], .property-approval-card")?.querySelector("[data-review-note]")?.value?.trim() || "";
                const decision = action === "approve-property" ? "APPROVED" : action === "reject-property" ? "REJECTED" : "CHANGES_REQUESTED";
                const listingId = button.dataset.listingId || button.closest("[data-property-review]")?.dataset.listingId || document.getElementById("propertyReviewModal")?.querySelector("[data-property-api-action='approve-property']")?.dataset.listingId;
                if (!listingId) throw new Error("No listing ID associated with this action.");
                if (decision !== "APPROVED" && !note) {
                    const promptReason = window.prompt("Please provide a rejection reason for this property submission:");
                    if (!promptReason || !promptReason.trim()) {
                        notify("Rejection cancelled: a review reason is required.");
                        return;
                    }
                    note = promptReason.trim();
                }
                if (decision === "CHANGES_REQUESTED") await api(`/listings/${listingId}/verification`, {method: "PATCH", body: JSON.stringify({decision, note, reviewer: "PropertyDirect Super Admin"})});
                else await absoluteApi(`/api/admin/properties/${listingId}/status`, {method: "PATCH", body: JSON.stringify({status: decision, rejectionReason: note})});
                notify(decision === "APPROVED" ? "Property approved and published publicly to marketplace." : decision === "REJECTED" ? "Property submission rejected with reviewer feedback." : "Changes requested from the property owner.");
                closePropertyReview();
                await loadSuperadminGovernance();
            }
        } catch (error) { notify(error.message); }
        finally { button.disabled = false; }
    }

    document.addEventListener("click", event => {
        let button = event.target.closest("[data-property-api-action]");
        if (!button && event.target.closest('#propertySupportForm [data-action="support"]')) {
            button = event.target.closest('#propertySupportForm [data-action="support"]'); button.dataset.propertyApiAction = "support-ticket"; button.type = "submit";
        }
        if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation(); handle(button);
    }, true);

    document.addEventListener("submit", event => {
        if (event.submitter?.matches("[data-property-api-action]") || event.target.dataset.propertyApiForm === "true") {
            event.preventDefault();
        }
    }, true);

    document.addEventListener("DOMContentLoaded", async () => {
        const listingForm = document.getElementById("postApartmentForm");
        if (listingForm && !listingForm.elements.pincode) {
            const addressLabel = listingForm.elements.address?.closest("label");
            const pincodeLabel = document.createElement("label");
            pincodeLabel.innerHTML = 'Pincode<input name="pincode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6-digit pincode">';
            addressLabel?.insertAdjacentElement("afterend", pincodeLabel);
        }
        if (listingForm && !listingForm.elements.bathrooms) {
            const bedroomLabel = listingForm.elements.bhk?.closest("label");
            const bathroomLabel = document.createElement("label");
            bathroomLabel.innerHTML = 'Bathrooms<input name="bathrooms" type="number" min="1" max="20" required value="1">';
            bedroomLabel?.insertAdjacentElement("afterend", bathroomLabel);
        }
        if (listingForm && !document.getElementById("propertySubmissionSuccess")) {
            const success = document.createElement("p"); success.id = "propertySubmissionSuccess"; success.className = "property-submission-success hidden"; success.setAttribute("role", "status"); listingForm.appendChild(success);
        }
        const dropZone = listingForm?.querySelector(".property-photo-upload") || document.getElementById("photoDropzone");
        const photoInput = document.getElementById("propertyPhotoFiles") || document.getElementById("propertyPhotoInput") || listingForm?.querySelector('[name="photos"]');
        if (dropZone && photoInput) {
            dropZone.querySelector("span")?.insertAdjacentText("beforebegin", "Drag and drop images here, or click to browse. ");
            ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add("is-dragging"); }));
            ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }));
            dropZone.addEventListener("drop", event => {
                const transfer = new DataTransfer();
                [...event.dataTransfer.files].filter(file => file.type.startsWith("image/")).slice(0,10).forEach(file => transfer.items.add(file));
                photoInput.files = transfer.files;
                previewPropertyFiles([...photoInput.files]);
            });
        }
        setDefaultDates();
        try {
            if (role === "customer") await Promise.all([searchListings(), loadSaved(), loadSavedSearches(), loadVisits(), loadServices()]);
            else if (role === "vendor" || role === "agent" || role === "admin") {
                await Promise.all([loadOwnerListings(), loadAgentEnquiries(), loadOwnerVisits()]);
            }
            else if (role === "superadmin") { ensureSuperadminGovernancePanel(); await loadSuperadminGovernance(); }
            document.documentElement.dataset.propertyBackendConnected = "true";
        } catch (error) { console.error("PropertyDirect workflow hydration failed", error); notify(error.message); }
    });

    function previewPropertyFiles(files) {
        const count = document.getElementById("propertyPhotoCount");
        if (count) {
            count.textContent = `${files.length} of 10 photo${files.length === 1 ? "" : "s"} selected${files.length ? " — ready" : ""}`;
            count.classList.toggle("is-invalid", files.length > 10);
        }
        const preview = document.getElementById("propertyPhotoPreview") || document.getElementById("photoPreviewContainer");
        if (preview) {
            preview.replaceChildren(...files.slice(0, 10).map(file => {
                const img = document.createElement("img");
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                return img;
            }));
        }
    }
    document.addEventListener("change", event => {
        if (event.target.matches("#propertyPhotoFiles, #propertyPhotoInput, [name='photos']")) {
            previewPropertyFiles([...event.target.files]);
        }
    });

    document.addEventListener("click", event => {
        const tabBtn = event.target.closest('[data-panel]');
        if (!tabBtn) return;
        const panel = tabBtn.dataset.panel;
        if (["customers", "property-mgmt", "overview"].includes(panel) && role === "superadmin") {
            loadSuperadminGovernance();
        } else if (role === "agent" || role === "vendor") {
            if (panel === "listings") loadOwnerListings();
            else if (panel === "leads" || panel === "overview") loadAgentEnquiries();
            else if (panel === "tours" || panel === "visits") loadOwnerVisits();
        }
    });

    window.PropertyDirectMarketWorkflows = {
        loadSuperadminGovernance,
        openPropertyReview,
        closePropertyReview,
        loadOwnerListings,
        loadAgentEnquiries,
        loadOwnerVisits,
        createOwnerListing,
        recordNewAgentLead
    };
    window.openPropertyReview = openPropertyReview;
    window.closePropertyReview = closePropertyReview;
    window.loadSuperadminGovernance = loadSuperadminGovernance;
    window.loadOwnerListings = loadOwnerListings;
    window.loadAgentEnquiries = loadAgentEnquiries;
    window.loadOwnerVisits = loadOwnerVisits;
    window.recordNewAgentLead = recordNewAgentLead;
})();

