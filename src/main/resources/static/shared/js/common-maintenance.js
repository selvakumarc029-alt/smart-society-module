(() => {
    "use strict";

    const body = document.body;
    const platform = body?.dataset.platform || "";
    const role = body?.dataset.dashboardRole || "";
    const isSmartSocietyResident = ["smartapartment", "smartsociety"].includes(platform) && role === "resident";
    const isPropertyDirectCustomer = platform === "propertydirect" && role === "customer";
    if (!isSmartSocietyResident && !isPropertyDirectCustomer) return;

    const sourcePlatform = isPropertyDirectCustomer ? "propertydirect" : "smartsociety";
    const escapeText = value => String(value ?? "—").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
    window.renderMaintenanceProgressRows = items => items.length ? items.map(ticket => {
        const done = ["RESOLVED", "CLOSED", "INVOICED"].includes(ticket.ticketStatus);
        const remaining = ticket.estimatedCompletionAt ? Math.ceil((new Date(ticket.estimatedCompletionAt) - Date.now()) / 60000) : null;
        const time = done ? `Completed ${ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString("en-IN") : ""}`
            : ticket.ticketStatus === "CANCELLED" ? "Cancelled"
            : ticket.ticketStatus === "ON_HOLD" ? "On hold · estimate will be updated"
            : remaining === null ? "Completion estimate pending" : remaining > 0 ? `About ${remaining} min remaining` : "Estimate elapsed · awaiting maintenance update";
        return `<tr><td><strong>${escapeText(ticket.ticketId || `#${ticket.id}`)}</strong></td><td>${escapeText(ticket.serviceType)}<br><small>${escapeText(ticket.description)}</small></td><td>${ticket.preferredAt ? escapeText(new Date(ticket.preferredAt).toLocaleString("en-IN")) : "Visit pending"}</td><td>${escapeText(ticket.serviceAddress)}</td><td>${escapeText(ticket.vendorName || "Awaiting technician")}<br><small>${escapeText(ticket.vendorNotes || "No work notes yet")}</small></td><td><span class="badge ${done ? "bg-success" : "bg-primary"}">${escapeText(ticket.workProgress || ticket.ticketStatus)}</span></td><td>${escapeText(time)}</td></tr>`;
    }).join("") : '<tr><td colspan="7">No service bookings yet.</td></tr>';
    const panelId = "services";
    const title = isPropertyDirectCustomer ? "Home services" : "Maintenance services";
    const subtitle = isPropertyDirectCustomer
        ? "Book verified home services for move-in, handover, inspection, repair, and cleaning."
        : "Book verified apartment maintenance services for your flat, common issues, and vendor repair tracking.";

    const catalogue = [
        {category:"Carpentry",name:"Door lock repair",rating:"4.82",reviews:"6.9K+",price:"Starts at Rs. 174",warranty:"60 days service warranty",options:"3 options",desc:"Lock alignment, latch tightening, handle fitting and minor wooden-door repair.",includes:"Inspection, lock fitting support, hinge tightening, latch/stopper adjustment.",excludes:"New lock body, handles, tower bolts or wooden replacement material."},
        {category:"Carpentry",name:"Furniture assembly",rating:"4.79",reviews:"4.1K+",price:"Starts at Rs. 290",warranty:"60 days service warranty",options:"5 options",desc:"Assembly support for beds, tables, wardrobes, shelves and modular furniture.",includes:"Basic assembly, tightening, alignment and stability check.",excludes:"Major cutting, polish, repainting or custom fabrication."},
        {category:"Plumbing",name:"Water leakage repair",rating:"4.84",reviews:"8.2K+",price:"Starts at Rs. 199",warranty:"30 days leak support",options:"4 options",desc:"Leak inspection for washroom, kitchen, balcony, basin and concealed line symptoms.",includes:"Leak diagnosis, minor washer/nozzle replacement and repair guidance.",excludes:"Tile breaking, concealed pipe replacement and spare material charges."},
        {category:"Electrical",name:"Switch, fan or light repair",rating:"4.81",reviews:"7.4K+",price:"Starts at Rs. 149",warranty:"30 days workmanship warranty",options:"6 options",desc:"Electrical inspection and repair for fixtures, fans, switches, sockets and MCB issues.",includes:"Basic troubleshooting, fitting, replacement support and safety check.",excludes:"New fixtures, wiring bundles, circuit rewiring and branded spare parts."},
        {category:"Cleaning",name:"Deep cleaning",rating:"4.76",reviews:"9.8K+",price:"Starts at Rs. 799",warranty:"Quality revisit support",options:"2 options",desc:"Move-in, bathroom, kitchen and full-home cleaning with checklist-based completion.",includes:"Surface cleaning, bathroom/kitchen cleaning, dusting and stain guidance.",excludes:"Pest control, sofa shampooing, high-risk exterior glass cleaning."},
        {category:"Painting",name:"Wall touch-up painting",rating:"4.73",reviews:"3.5K+",price:"Quote after inspection",warranty:"Vendor workmanship warranty",options:"Custom quote",desc:"Touch-up, damp-wall inspection, repaint quote and handover-ready wall correction.",includes:"Area assessment, paint requirement estimate and basic patch guidance.",excludes:"Paint material, putty, scaffolding and major seepage treatment."},
        {category:"Inspection",name:"Move-in inspection",rating:"4.80",reviews:"2.9K+",price:"Starts at Rs. 499",warranty:"Checklist report included",options:"2 options",desc:"Pre-move-in checklist for locks, plumbing, electrical, walls, fixtures and cleanliness.",includes:"Room-wise report, photos reference and issue summary.",excludes:"Repair cost, material cost and legal verification."},
        {category:"Handover",name:"Owner handover repair",rating:"4.77",reviews:"1.8K+",price:"Quote after inspection",warranty:"Completion proof included",options:"Custom quote",desc:"Repair request for owners before tenant move-in or after tenant move-out.",includes:"Issue capture, vendor assignment, status tracking and invoice reference.",excludes:"Unapproved extra work and third-party society permission fees."}
    ];

    function notify(message) {
        if (typeof showToast === "function") return showToast(message);
        let toast = document.getElementById("commonMaintenanceToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "commonMaintenanceToast";
            toast.className = "common-maintenance-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.remove(), 3200);
    }

    async function api(path, options = {}) {
        const response = await fetch(`/api/maintenance${path}`, {
            ...options,
            headers: {Accept:"application/json", ...(options.body ? {"Content-Type":"application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.detail || "Maintenance request could not be saved.");
        return payload;
    }

    function addStyles() {
        if (document.getElementById("commonMaintenanceStyles")) return;
        const style = document.createElement("style");
        style.id = "commonMaintenanceStyles";
        style.textContent = `
            .common-maintenance-shell{display:grid;gap:22px;font-family:inherit}
            .common-maintenance-hero{background:linear-gradient(135deg,#eff6ff,#fff7ed);border:1px solid #dbeafe;border-radius:24px;padding:24px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;box-shadow:0 18px 44px rgba(15,23,42,.08)}
            .common-maintenance-hero h3{margin:0 0 8px;font-size:clamp(1.45rem,2vw,2.05rem);font-weight:900;color:#0f172a}
            .common-maintenance-hero p{margin:0;color:#53627a;line-height:1.55}
            .common-maintenance-search{display:flex;gap:12px;align-items:center;margin-top:18px;flex-wrap:wrap}
            .common-maintenance-search input{min-width:min(420px,100%);flex:1;border:1px solid #cbd5e1;border-radius:16px;padding:13px 16px;font-weight:700;background:#fff;color:#0f172a}
            .common-maintenance-search button,.common-maintenance-card button,.common-maintenance-form button,.common-maintenance-table button{border:0;border-radius:14px;padding:12px 18px;font-weight:900;cursor:pointer;white-space:nowrap}
            .common-maintenance-primary{background:linear-gradient(135deg,#2557eb,#3b82f6);color:#fff;box-shadow:0 12px 26px rgba(37,99,235,.2)}
            .common-maintenance-secondary{background:#fff;color:#1d4ed8;border:1px solid #bfdbfe!important}
            .common-maintenance-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
            .common-maintenance-kpis article{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;display:grid;gap:4px;min-height:104px}
            .common-maintenance-kpis span{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900}
            .common-maintenance-kpis strong{font-size:1.45rem;color:#0f172a}
            .common-maintenance-kpis small{color:#64748b;font-weight:700}
            .common-maintenance-cats{display:flex;gap:10px;flex-wrap:wrap}
            .common-maintenance-cats button{border:1px solid #dbeafe;background:#fff;color:#1e3a8a;border-radius:999px;padding:10px 16px;font-weight:900}
            .common-maintenance-cats button.active{background:#2563eb;color:#fff;border-color:#2563eb}
            .common-maintenance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
            .common-maintenance-card{background:#fff;border:1px solid #dbe3ef;border-radius:20px;padding:18px;display:grid;gap:12px;box-shadow:0 14px 30px rgba(15,23,42,.06)}
            .common-maintenance-card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
            .common-maintenance-card h4{margin:0;font-size:1.05rem;font-weight:900;color:#0f172a}
            .common-maintenance-rating{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px;font-size:.78rem;font-weight:900;color:#334155;white-space:nowrap}
            .common-maintenance-card p{margin:0;color:#52637a;line-height:1.5}
            .common-maintenance-meta{display:flex;gap:8px;flex-wrap:wrap}
            .common-maintenance-meta span{border-radius:999px;background:#eff6ff;color:#1d4ed8;padding:6px 10px;font-size:.76rem;font-weight:900}
            .common-maintenance-meta span:nth-child(2){background:#fff7ed;color:#b45309}
            .common-maintenance-actions{display:flex;gap:10px;flex-wrap:wrap}
            .common-maintenance-form,.common-maintenance-table-card{background:#fff;border:1px solid #dbe3ef;border-radius:22px;padding:22px;box-shadow:0 14px 34px rgba(15,23,42,.06)}
            .common-maintenance-form h4,.common-maintenance-table-card h4{margin:0 0 6px;font-size:1.2rem;font-weight:900;color:#0f172a}
            .common-maintenance-form p,.common-maintenance-table-card p{margin:0 0 18px;color:#64748b}
            .common-maintenance-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
            .common-maintenance-fields label{display:grid;gap:6px;color:#334155;font-size:.82rem;font-weight:900}
            .common-maintenance-fields input,.common-maintenance-fields select,.common-maintenance-fields textarea{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:12px 14px;background:#fff;color:#0f172a;font-weight:700;box-sizing:border-box}
            .common-maintenance-fields textarea{min-height:96px;resize:vertical}
            .common-maintenance-wide{grid-column:1/-1}
            .common-maintenance-table-wrap{overflow:auto}
            .common-maintenance-table{width:100%;border-collapse:collapse;min-width:840px}
            .common-maintenance-table th{background:#f8fafc;color:#334155;text-align:left;font-size:.76rem;text-transform:uppercase;letter-spacing:.06em;padding:12px;border-bottom:1px solid #e2e8f0}
            .common-maintenance-table td{padding:13px 12px;border-bottom:1px solid #eef2f7;color:#334155;vertical-align:top}
            .common-maintenance-status{display:inline-flex;border-radius:999px;padding:6px 10px;background:#dbeafe;color:#1d4ed8;font-weight:900;font-size:.76rem}
            .common-maintenance-status.done{background:#dcfce7;color:#15803d}.common-maintenance-status.warn{background:#fef3c7;color:#b45309}
            .common-maintenance-toast{position:fixed;right:24px;top:24px;z-index:999999;background:#0f172a;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,.18);font-weight:800}
            @media(max-width:980px){.common-maintenance-hero,.common-maintenance-grid,.common-maintenance-kpis,.common-maintenance-fields{grid-template-columns:1fr}.common-maintenance-hero{align-items:start}}
        `;
        document.head.appendChild(style);
    }

    function ensureResidentSidebarAndPanel() {
        if (!isSmartSocietyResident) return;
        const nav = document.querySelector(".sidebar-nav");
        if (nav && !nav.querySelector(`[data-panel="${panelId}"]`)) {
            const link = document.createElement("a");
            link.href = `#${panelId}`;
            link.className = "nav-link btn btn-link text-start text-decoration-none";
            link.dataset.panel = panelId;
            link.innerHTML = '<i class="fa-solid fa-screwdriver-wrench me-2"></i> Carpentry & Home Services';
            nav.insertBefore(link, nav.querySelector('[data-panel="complaints"]') || nav.firstChild);
            link.addEventListener("click", event => {
                event.preventDefault();
                window.forceOpenPanel ? window.forceOpenPanel(panelId) : location.hash = panelId;
            });
        }
        const container = document.querySelector(".dashboard-container");
        if (container && !document.querySelector(`[data-view="${panelId}"]`)) {
            const section = document.createElement("section");
            section.className = "d-none animate__animated animate__fadeIn";
            section.dataset.view = panelId;
            container.appendChild(section);
        }
        if (window.dashboardTitles && !window.dashboardTitles[panelId]) window.dashboardTitles[panelId] = "Carpentry & Home Services";
    }

    function serviceCard(item, index) {
        return `<article class="common-maintenance-card" data-service-card data-category="${item.category}">
            <header><div><h4>${item.name}</h4><p>${item.desc}</p></div><span class="common-maintenance-rating">${item.rating} (${item.reviews})</span></header>
            <div class="common-maintenance-meta"><span>${item.price}</span><span>${item.options}</span><span>${item.warranty}</span></div>
            <div class="common-maintenance-actions"><button type="button" class="common-maintenance-primary" data-maintenance-select="${index}">Add</button><button type="button" class="common-maintenance-secondary" data-maintenance-detail="${index}">View details</button></div>
        </article>`;
    }

    function renderPanel() {
        const panel = document.querySelector(`[data-view="${panelId}"]`);
        if (!panel || panel.dataset.catalogueReady) return;
        if (panel.id === "nobrokerServicesSection" || panel.id === "customerNoBrokerServicesSection" || panel.querySelector("#nobrokerCategoryGrid") || panel.children.length) {
            panel.dataset.catalogueReady = "true";
            return;
        }
        panel.dataset.catalogueReady = "true";
        const categories = [...new Set(catalogue.map(item => item.category))];
        panel.innerHTML = `<div class="common-maintenance-shell">
            <section class="common-maintenance-hero"><div><h3>${title}</h3><p>${subtitle}</p><div class="common-maintenance-search"><input id="maintenanceSearch" type="search" placeholder="Search carpentry, plumbing, cleaning, painting, inspection..." autocomplete="off"><button type="button" class="common-maintenance-primary" data-maintenance-scroll-form>Book service</button></div></div><div class="common-maintenance-rating">4.79 trusted service rating</div></section>
            <section class="common-maintenance-kpis"><article><span>Categories</span><strong>8</strong><small>Repair, cleaning, inspection and handover</small></article><article><span>Warranty</span><strong>30-60 days</strong><small>Based on selected service</small></article><article><span>Vendor</span><strong>External</strong><small>Outside vendor can update status</small></article><article><span>Backend</span><strong>Live</strong><small>Saved in common maintenance tickets</small></article></section>
            <section><div class="common-maintenance-cats" id="maintenanceCategories"><button type="button" class="active" data-maintenance-category="All">All</button>${categories.map(cat => `<button type="button" data-maintenance-category="${cat}">${cat}</button>`).join("")}</div></section>
            <section class="common-maintenance-grid" id="maintenanceCatalogue">${catalogue.map(serviceCard).join("")}</section>
            <form class="common-maintenance-form" id="commonMaintenanceBookingForm"><h4>Book selected service</h4><p>Fill all details clearly so admin/vendor can validate, assign, and complete the work without confusion.</p><div class="common-maintenance-fields">
                <input type="hidden" name="selectedIndex" value="0">
                <label>Service category *<select name="serviceCategory" required>${categories.map(cat => `<option>${cat}</option>`).join("")}</select></label>
                <label>Service *<select name="serviceType" required>${catalogue.map(item => `<option>${item.name}</option>`).join("")}</select></label>
                <label>Selected option *<select name="serviceOption" required><option>Standard service visit</option><option>Repair only</option><option>Installation / replacement support</option><option>Inspection and quote</option><option>Move-in priority service</option></select></label>
                <label>${isPropertyDirectCustomer ? "Listing / property ID" : "Flat / apartment number"}<input name="targetReference" placeholder="${isPropertyDirectCustomer ? "e.g. PDT-2042 or listing ID" : "e.g. A-204"}"></label>
                <label>Contact person *<input name="requesterName" required maxlength="120" placeholder="Full name"></label>
                <label>Contact phone *<input name="requesterPhone" required type="tel" maxlength="10" inputmode="numeric" pattern="[6-9][0-9]{9}" title="Please enter a 10-digit mobile number" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10)" placeholder="10-digit mobile number"></label>
                <label>Email<input name="requesterEmail" type="email" maxlength="160" placeholder="name@example.com"></label>
                <label>Preferred date/time *<input name="preferredAt" required type="datetime-local"></label>
                <label>Alternate date/time<input name="alternateAt" type="datetime-local"></label>
                <label>Priority *<select name="priority" required><option>MEDIUM</option><option>LOW</option><option>HIGH</option><option>URGENT</option><option>EMERGENCY</option></select></label>
                <label>Access type *<select name="accessType" required><option>${isPropertyDirectCustomer ? "Customer will be present" : "Resident will be present"}</option><option>Security will provide access</option><option>Call before arrival</option><option>Keys with caretaker/owner</option></select></label>
                <label>Preferred contact *<select name="contactMethod" required><option>Phone</option><option>WhatsApp</option><option>Email</option><option>In-app notification</option></select></label>
                <label class="common-maintenance-wide">Service address *<textarea name="serviceAddress" required maxlength="600" placeholder="${isPropertyDirectCustomer ? "Full property address, landmark and city" : "Block, flat number, tower, floor and landmark inside society"}"></textarea></label>
                <label class="common-maintenance-wide">Detailed work requirement *<textarea name="description" required minlength="10" maxlength="3000" placeholder="Mention exact issue, room/location, existing condition, material/spare expectations, photos/reference, vendor instruction and expected outcome."></textarea></label>
                <label>Attachment / photo reference<input name="attachmentReference" maxlength="120" placeholder="Optional filename or shared reference"></label>
                <label>External vendor name<input name="vendorName" maxlength="120" placeholder="Outside vendor / preferred technician"></label>
                <label>Vendor phone<input name="vendorPhone" maxlength="40" placeholder="Optional"></label>
                <div class="common-maintenance-wide common-maintenance-actions"><button class="common-maintenance-primary" type="submit">Submit service request</button><button class="common-maintenance-secondary" type="reset">Clear form</button></div>
            </div></form>
            <section class="common-maintenance-table-card"><h4>${isPropertyDirectCustomer ? "Property service tickets" : "Apartment service tickets"}</h4><p>Work progress refreshes every 10 seconds. Completion times are maintenance estimates.</p><div class="common-maintenance-table-wrap"><table class="common-maintenance-table"><thead><tr><th>Ticket</th><th>Service</th><th>Schedule</th><th>Address</th><th>Technician / work notes</th><th>Status</th><th>Completion estimate</th></tr></thead><tbody id="commonMaintenanceRows"><tr><td colspan="7">Loading service tickets…</td></tr></tbody></table></div></section>
        </div>`;
    }

    function setDefaultDate() {
        const input = document.querySelector("#commonMaintenanceBookingForm [name='preferredAt']");
        if (!input || input.value) return;
        const future = new Date(Date.now() + 86400000);
        future.setHours(11, 0, 0, 0);
        future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
        input.value = future.toISOString().slice(0, 16);
    }

    function selectService(index, scroll = true) {
        const item = catalogue[index] || catalogue[0];
        const form = document.getElementById("commonMaintenanceBookingForm");
        if (!form) return;
        form.elements.selectedIndex.value = String(index);
        form.elements.serviceCategory.value = item.category;
        form.elements.serviceType.value = item.name;
        form.elements.description.value = `${item.desc}\n\nIncluded: ${item.includes}\nNot included: ${item.excludes}\nPrice: ${item.price}\nWarranty: ${item.warranty}`;
        if (scroll) form.scrollIntoView({behavior:"smooth", block:"start"});
    }

    function filterCatalogue(value) {
        const query = String(value || "All").trim().toLowerCase();
        document.querySelectorAll("[data-service-card]").forEach(card => {
            const show = query === "all" || card.dataset.category.toLowerCase() === query || card.textContent.toLowerCase().includes(query);
            card.style.display = show ? "" : "none";
        });
    }

    async function loadTickets() {
        const table = document.getElementById("commonMaintenanceRows");
        if (!table) return;
        const items = await api(`?sourcePlatform=${encodeURIComponent(sourcePlatform)}`);
        table.innerHTML = window.renderMaintenanceProgressRows(items);
    }

    async function submitBooking(form) {
        const values = Object.fromEntries(new FormData(form).entries());
        if (new Date(values.preferredAt).getTime() <= Date.now()) throw new Error("Choose a future visit date and time.");
        const item = catalogue[Number(values.selectedIndex)] || catalogue.find(entry => entry.name === values.serviceType) || catalogue[0];
        const targetNumber = Number(String(values.targetReference || "").replace(/\D/g, ""));
        const saved = await api("", {method:"POST", body:JSON.stringify({
            sourcePlatform, targetEntityType:isPropertyDirectCustomer ? "PROPERTY_LISTING" : "APARTMENT_UNIT",
            targetEntityId:Number.isFinite(targetNumber) && targetNumber > 0 ? targetNumber : null,
            requesterName:values.requesterName, requesterPhone:values.requesterPhone, requesterEmail:values.requesterEmail,
            serviceType:values.serviceType, serviceCategory:values.serviceCategory, serviceOption:values.serviceOption,
            priceLabel:form.dataset.cartPrice || item.price, warrantyLabel:item.warranty, title:`${values.serviceType} - ${values.targetReference || values.requesterName}`,
            description:values.description, serviceAddress:values.serviceAddress, priority:values.priority,
            preferredAt:values.preferredAt || null, alternateAt:values.alternateAt || null,
            vendorName:values.vendorName || "External vendor team", vendorPhone:values.vendorPhone,
            accessType:values.accessType, contactMethod:values.contactMethod, attachmentReference:values.attachmentReference,
            externalReference:values.targetReference
        })});
        form.reset();
        delete form.dataset.cartPrice;
        setDefaultDate();
        selectService(Number(values.selectedIndex) || 0);
        notify(`Service request #${saved.id} saved in backend.`);
        await loadTickets();
    }

    document.addEventListener("click", async event => {
        const select = event.target.closest("[data-maintenance-select]");
        const detail = event.target.closest("[data-maintenance-detail]");
        const cat = event.target.closest("[data-maintenance-category]");
        const resolve = event.target.closest("[data-maintenance-resolve]");
        if (select) { event.preventDefault(); selectService(Number(select.dataset.maintenanceSelect)); return; }
        if (detail) { event.preventDefault(); const item = catalogue[Number(detail.dataset.maintenanceDetail)] || catalogue[0]; notify(`${item.name}: ${item.includes} Not included: ${item.excludes}`); return; }
        if (cat) { event.preventDefault(); document.querySelectorAll("[data-maintenance-category]").forEach(btn => btn.classList.toggle("active", btn === cat)); filterCatalogue(cat.dataset.maintenanceCategory); return; }
        if (event.target.closest("[data-maintenance-scroll-form]")) { event.preventDefault(); document.getElementById("commonMaintenanceBookingForm")?.scrollIntoView({behavior:"smooth", block:"start"}); return; }
        if (resolve) {
            event.preventDefault();
            resolve.disabled = true;
            try {
                await api(`/${resolve.dataset.maintenanceResolve}/status`, {method:"PATCH", body:JSON.stringify({ticketStatus:"RESOLVED", vendorNotes:"Marked resolved from dashboard."})});
                notify("Ticket marked resolved and saved.");
                await loadTickets();
            } catch (error) { notify(error.message); resolve.disabled = false; }
        }
    }, true);

    document.addEventListener("submit", async event => {
        if (event.target?.id !== "commonMaintenanceBookingForm") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.target.reportValidity()) return;
        const submit = event.target.querySelector('[type="submit"]');
        if (submit.disabled) return;
        submit.disabled = true;
        try { await submitBooking(event.target); } catch (error) { notify(error.message); }
        finally { submit.disabled = false; }
    }, true);

    document.addEventListener("input", event => {
        if (event.target?.id === "maintenanceSearch") filterCatalogue(event.target.value || "All");
    });

    document.addEventListener("DOMContentLoaded", async () => {
        addStyles();
        ensureResidentSidebarAndPanel();
        renderPanel();
        setDefaultDate();
        selectService(0, false);
        try { await loadTickets(); } catch (error) { notify(error.message); }
        let refreshing = false;
        setInterval(async () => {
            if (document.hidden || refreshing) return;
            refreshing = true;
            try {
                await loadTickets();
                if (typeof window.loadNoBrokerMaintenanceTickets === "function") await window.loadNoBrokerMaintenanceTickets();
            } catch (_) { /* Keep the last confirmed snapshot when offline. */ }
            finally { refreshing = false; }
        }, 10000);
    });
})();
