(() => {
    "use strict";

    const body = document.body;
    const platform = body?.dataset.platform || "";
    const role = body?.dataset.dashboardRole || "";
    const isResident = ["smartapartment", "smartsociety"].includes(platform) && role === "resident";
    const isCustomer = platform === "propertydirect" && role === "customer";
    if (!isResident && !isCustomer) return;

    const preferredSectionId = isResident ? "nobrokerServicesSection" : "customerNoBrokerServicesSection";
    const sourcePlatform = isCustomer ? "propertydirect" : "smartsociety";
    const bookingPrefix = isCustomer ? "PD-HS" : "SS-HS";

    const serviceOptions = [
        ["Home Cleaning", 499, "Home Cleaning", "Bathroom, kitchen, sofa and full-home cleaning"],
        ["Bathroom Cleaning", 399, "Home Cleaning", "Tiles, floor, WC, basin, exhaust and fittings cleaning"],
        ["Kitchen Cleaning", 499, "Home Cleaning", "Oil, chimney exterior, cabinets, platform and sink cleaning"],
        ["Premium Cleaning", 799, "Home Cleaning", "Move-in or deep-clean checklist with quality recheck"],
        ["Sofa Cleaning", 349, "Home Cleaning", "Fabric sofa shampooing and stain inspection"],
        ["Packers & Movers", 999, "Packers & Movers", "Local and intercity shifting quote request"],
        ["Painting & Waterproofing", 399, "Painting", "Wall touch-up, repainting and damp inspection"],
        ["Rental & Legal Agreement", 299, "Legal Agreement", "Rental or sale agreement draft and doorstep workflow"],
        ["Electrician, Plumber & Carpenter", 49, "Home Repairs", "General repair inspection and job estimate"],
        ["Tap Repair", 199, "Plumbing", "Tap leakage, washer, nozzle and fitting inspection"],
        ["Switch Board Repair", 149, "Electrical", "Switch, socket, light or fan repair inspection"],
        ["Cupboard Hinge", 179, "Carpentry", "Hinge, handle, drawer channel and cupboard alignment"],
        ["Geyser Repair", 299, "Appliance Repair", "Geyser inspection, heating issue and connection check"],
        ["Fan Repair", 199, "Electrical", "Fan regulator, noise, wobble or wiring inspection"],
        ["AC & Appliance Repair", 399, "Appliance Repair", "AC service, refrigerator and washing machine repair request"],
        ["Interior & Renovation", 0, "Interior and Renovation", "Design consultation and custom estimate"],
        ["Pest Control & Sanitization", 299, "Pest Control", "Cockroach, termite, bed bug and herbal treatment request"],
        ["Drill & Hang", 99, "Carpentry", "Wall drilling, mirror, shelf, frame and curtain fitting"],
        ["Door & Lock Fitting", 149, "Carpentry", "Door lock repair, replacement and alignment"],
        ["Furniture Assembly", 299, "Carpentry", "Bed, wardrobe, table, chair and modular furniture assembly"]
    ];

    const faqs = [
        ["How do I book a service?", "Select a service, fill contact/address details, choose a date and submit. The ticket is saved in the backend."],
        ["Who fulfills the service?", "The physical work is handled by verified external home-service technicians."],
        ["Are material charges included?", "No. Labour/inspection pricing is indicative. Spare parts, hardware and extra work require vendor confirmation."],
        ["Can I track the booking after refresh?", "Yes. Submitted bookings reload from the backend in the My Bookings table."],
        ["Can a ticket be closed?", "Yes. Click Mark Resolved once the work is completed and verified."]
    ];

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));

    function notify(message) {
        if (typeof window.showToast === "function") return window.showToast(message);
        alert(message);
    }

    function serviceMeta(service) {
        const item = serviceOptions.find(([name]) => name === service) || serviceOptions.find(([name]) => String(service).includes(name));
        const name = item?.[0] || service || "Home Service";
        const price = Number(item?.[1] ?? 49);
        const category = item?.[2] || "Home Services";
        return {
            category,
            option: item?.[3] || "Standard service visit",
            warranty: category === "Carpentry" || category === "Home Repairs" ? "30 days workmanship support" : "Vendor confirmation required",
            priceLabel: price === 0 ? "Quote after inspection" : `Starts at Rs. ${price}`,
            price
        };
    }

    function commonCategory(category) {
        if (/clean/i.test(category)) return "Cleaning";
        if (/paint/i.test(category)) return "Painting";
        if (/plumb/i.test(category)) return "Plumbing";
        if (/electric/i.test(category)) return "Electrical";
        if (/inspection|interior|agreement|packers|pest|handover/i.test(category)) return "Inspection";
        return "Carpentry";
    }

    function upsertServiceOptions() {
        const select = document.getElementById("nbSelectedService");
        if (!select) return;
        serviceOptions.forEach(([name, price]) => {
            const value = `${name}|${price}`;
            let option = Array.from(select.options).find(item => item.value.split("|")[0] === name);
            if (!option) {
                option = new Option(`${name} (${price === 0 ? "Quote after inspection" : `Starts Rs. ${price}`})`, value);
                select.add(option);
            } else {
                option.value = value;
            }
        });
    }

    function addStyles() {
        if (document.getElementById("homeServicesDashboardStyles")) return;
        const style = document.createElement("style");
        style.id = "homeServicesDashboardStyles";
        style.textContent = `
            [data-home-services-root] {
                display: flex !important;
                flex-direction: column !important;
                gap: 24px !important;
                margin: 0 0 40px 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
                color: #0f172a !important;
            }
            [data-home-services-root] * {
                box-sizing: border-box !important;
            }

            .hs-mainbar {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 20px !important;
                padding: 16px 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 20px !important;
                box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04) !important;
                width: 100% !important;
            }
            .hs-mainbar-title {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                white-space: nowrap !important;
            }
            .hs-city-tag {
                font-size: 0.76rem !important;
                font-weight: 800 !important;
                background: #fef2f2 !important;
                color: #dc2626 !important;
                padding: 4px 12px !important;
                border-radius: 999px !important;
                border: 1px solid #fecaca !important;
            }
            .hs-mainbar-search {
                flex: 1 !important;
                max-width: 540px !important;
                position: relative !important;
            }
            .hs-mainbar-search input {
                width: 100% !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 999px !important;
                padding: 11px 20px 11px 42px !important;
                font-size: 0.88rem !important;
                font-weight: 600 !important;
                color: #0f172a !important;
                background: #f8fafc !important;
                outline: none !important;
                transition: all 0.2s ease !important;
                box-shadow: none !important;
            }
            .hs-mainbar-search input:focus {
                background: #ffffff !important;
                border-color: #2563eb !important;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
            }
            .hs-mainbar-search-icon {
                position: absolute !important;
                left: 16px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                color: #94a3b8 !important;
                font-size: 0.9rem !important;
                pointer-events: none !important;
            }
            .hs-mainbar-btn {
                all: unset !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                color: #ffffff !important;
                border-radius: 999px !important;
                padding: 10px 22px !important;
                font-size: 0.85rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25) !important;
                transition: all 0.2s ease !important;
                white-space: nowrap !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .hs-mainbar-btn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35) !important;
            }

            .hs-strip {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 20px !important;
                padding: 24px !important;
                box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04) !important;
                width: 100% !important;
            }
            .hs-strip-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 20px !important;
            }
            .hs-strip-title {
                margin: 0 !important;
                font-size: 1.15rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                letter-spacing: -0.01em !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }

            .hs-category-grid {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 16px !important;
                width: 100% !important;
            }
            .hs-category-card {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 16px !important;
                padding: 20px !important;
                text-align: left !important;
                cursor: pointer !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 145px !important;
                height: 100% !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            .hs-category-card:hover {
                border-color: #2563eb !important;
                transform: translateY(-3px) !important;
                box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12) !important;
                background: #ffffff !important;
            }
            .hs-category-card-top {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                margin-bottom: 12px !important;
            }
            .hs-category-icon-badge {
                width: 44px !important;
                height: 44px !important;
                border-radius: 12px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 1.15rem !important;
                flex-shrink: 0 !important;
            }
            .hs-price-pill {
                font-size: 0.74rem !important;
                font-weight: 800 !important;
                background: #f8fafc !important;
                color: #475569 !important;
                border: 1px solid #e2e8f0 !important;
                padding: 3px 10px !important;
                border-radius: 999px !important;
                white-space: nowrap !important;
            }
            .hs-category-card h6 {
                margin: 0 0 4px 0 !important;
                font-size: 0.96rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                line-height: 1.35 !important;
            }
            .hs-category-card p {
                margin: 0 !important;
                font-size: 0.8rem !important;
                color: #64748b !important;
                font-weight: 500 !important;
                line-height: 1.4 !important;
            }

            .hs-quick-row {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 18px !important;
                width: 100% !important;
            }
            .hs-offer-card {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 18px !important;
                padding: 22px !important;
                box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 160px !important;
                position: relative !important;
                overflow: hidden !important;
                width: 100% !important;
            }
            .hs-offer-card::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 4px !important;
                background: linear-gradient(90deg, #2563eb, #3b82f6) !important;
            }
            .hs-offer-card:nth-child(2)::before {
                background: linear-gradient(90deg, #d97706, #f59e0b) !important;
            }
            .hs-offer-card:nth-child(3)::before {
                background: linear-gradient(90deg, #10b981, #059669) !important;
            }
            .hs-offer-card strong {
                font-size: 1.05rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                display: block !important;
                margin-bottom: 6px !important;
            }
            .hs-offer-card span {
                font-size: 0.83rem !important;
                color: #64748b !important;
                line-height: 1.5 !important;
                display: block !important;
                margin-bottom: 16px !important;
            }
            .hs-offer-card button {
                all: unset !important;
                align-self: flex-start !important;
                background: #0f172a !important;
                color: #ffffff !important;
                border-radius: 10px !important;
                padding: 8px 18px !important;
                font-size: 0.82rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                display: inline-block !important;
            }
            .hs-offer-card button:hover {
                background: #2563eb !important;
                transform: translateY(-1px) !important;
            }

            .hs-service-pills {
                display: grid !important;
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                gap: 12px !important;
                width: 100% !important;
            }
            .hs-pill-btn {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 14px !important;
                padding: 14px 16px !important;
                text-align: left !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 6px rgba(15, 23, 42, 0.02) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-height: 76px !important;
                margin: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            .hs-pill-btn:hover {
                border-color: #2563eb !important;
                background: #f0f7ff !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 16px rgba(37, 99, 235, 0.1) !important;
            }
            .hs-pill-title {
                font-size: 0.88rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                margin-bottom: 6px !important;
                line-height: 1.3 !important;
            }
            .hs-pill-price {
                font-size: 0.76rem !important;
                font-weight: 800 !important;
                color: #2563eb !important;
                background: #eff6ff !important;
                padding: 2px 8px !important;
                border-radius: 6px !important;
                display: inline-block !important;
                align-self: flex-start !important;
            }

            .hs-table {
                width: 100% !important;
                border-collapse: separate !important;
                border-spacing: 0 !important;
            }
            .hs-table th {
                background: #f8fafc !important;
                color: #475569 !important;
                font-size: 0.78rem !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                padding: 12px 16px !important;
                border-bottom: 2px solid #e2e8f0 !important;
            }
            .hs-table td {
                padding: 14px 16px !important;
                border-bottom: 1px solid #f1f5f9 !important;
                font-size: 0.88rem !important;
                color: #334155 !important;
            }
            .hs-table tr:last-child td {
                border-bottom: none !important;
            }

            .hs-form-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 16px !important;
                width: 100% !important;
            }
            .hs-form-group {
                display: flex !important;
                flex-direction: column !important;
                gap: 6px !important;
            }
            .hs-form-group.full-width {
                grid-column: span 2 !important;
            }
            .hs-form-label {
                font-size: 0.82rem !important;
                font-weight: 800 !important;
                color: #334155 !important;
            }
            .hs-form-control {
                width: 100% !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 12px !important;
                padding: 11px 14px !important;
                font-size: 0.88rem !important;
                font-weight: 600 !important;
                color: #0f172a !important;
                background: #ffffff !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
            }
            .hs-form-control:focus {
                border-color: #2563eb !important;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
            }
            .hs-submit-btn {
                all: unset !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                color: #ffffff !important;
                border-radius: 12px !important;
                padding: 13px 28px !important;
                font-size: 0.9rem !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25) !important;
                transition: all 0.2s ease !important;
                text-align: center !important;
                display: inline-block !important;
            }
            .hs-submit-btn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35) !important;
            }

            .hs-faq-list details {
                border-bottom: 1px solid #f1f5f9 !important;
                padding: 14px 0 !important;
            }
            .hs-faq-list details:last-child {
                border-bottom: none !important;
            }
            .hs-faq-list summary {
                font-size: 0.95rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
                cursor: pointer !important;
                user-select: none !important;
            }
            .hs-faq-list p {
                margin: 10px 0 0 0 !important;
                font-size: 0.86rem !important;
                color: #64748b !important;
                line-height: 1.55 !important;
            }

            @media (max-width: 1200px) {
                .hs-category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                .hs-service-pills { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            }
            @media (max-width: 820px) {
                .hs-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .hs-quick-row { grid-template-columns: 1fr !important; }
                .hs-service-pills { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .hs-form-grid { grid-template-columns: 1fr !important; }
                .hs-form-group.full-width { grid-column: span 1 !important; }
                .hs-mainbar { flex-direction: column !important; align-items: stretch !important; }
                .hs-mainbar-search { max-width: 100% !important; }
            }
            @media (max-width: 520px) {
                .hs-category-grid { grid-template-columns: 1fr !important; }
                .hs-service-pills { grid-template-columns: 1fr !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function serviceIconSvg(label) {
        const name = String(label || "").toLowerCase();
        if (/clean|bathroom|kitchen|sofa/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"/><path d="M7 21V9l5-5 5 5v12"/><path d="M9 14h6"/><path d="M10 17h4"/></svg>';
        if (/pack|mover|shift/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="6" width="12" height="9" rx="2"/><path d="M14 9h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
        if (/paint|water/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h11v5H4z"/><path d="M15 9h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-5"/><path d="M8 12v8"/><path d="M6 20h4"/></svg>';
        if (/agreement|legal|tenant/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/></svg>';
        if (/electric|plumber|carpenter|repair|tap|switch|fan|drill|door|lock|cupboard|furniture/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14.5 5.5l4 4"/><path d="M4 20l6.5-6.5"/><path d="M13 4l7 7-5 5-7-7z"/><path d="M5 19l-1 1"/></svg>';
        if (/interior|renovation/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 13h16v7H4z"/><path d="M7 13V8a3 3 0 0 1 6 0v5"/><path d="M17 13V9"/><path d="M6 20v2M18 20v2"/></svg>';
        if (/ac|appliance|geyser/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="8" rx="2"/><path d="M7 16h10"/><path d="M8 20h8"/><path d="M7 8h.01M11 8h6"/></svg>';
        if (/pest|sanit/.test(name)) return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 3v4M6 11h12M6 15h12M4 9l3 2M20 9l-3 2M4 18l3-2M20 18l-3-2"/></svg>';
        return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>';
    }

    function repairLegacyNoBrokerIcons() {
        document.querySelectorAll(".nobroker-cat-item .rounded-circle").forEach(iconBox => {
            const card = iconBox.closest(".nobroker-cat-item");
            const label = card?.querySelector("h6")?.textContent || card?.textContent || "";
            iconBox.innerHTML = serviceIconSvg(label);
            iconBox.style.background = "#ffffff";
            iconBox.style.border = "1px solid #e2e8f0";
            iconBox.style.color = getComputedStyle(iconBox).color || "#2563eb";
        });
        document.querySelectorAll("#carpentryCatalogue .rounded-circle, #carpentryCatalogue .nb-service-thumb, #carpentryCatalogue [class*='thumb']").forEach(iconBox => {
            const label = iconBox.closest("[data-service-name], .card, .service-card, .nb-service-card")?.textContent || "";
            if (!iconBox.querySelector("svg")) iconBox.innerHTML = serviceIconSvg(label);
            iconBox.style.display = "inline-flex";
            iconBox.style.alignItems = "center";
            iconBox.style.justifyContent = "center";
            iconBox.style.background = "#ffffff";
            iconBox.style.border = "1px solid #e2e8f0";
            iconBox.style.color = "#2563eb";
        });
    }

    function findSection() {
        return document.getElementById(preferredSectionId) || document.querySelector('[data-view="services"]');
    }

    function homeServicesMarkup() {
        return `
            <div data-home-services-root id="homeServicesDashboardModern">
                <section class="hs-strip" id="nobrokerBookingsTableAnchor">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">My Service Bookings</h5>
                        <button type="button" class="hs-mainbar-btn" style="padding: 6px 16px; font-size: 0.8rem;" onclick="loadNoBrokerMaintenanceTickets()">Refresh</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="hs-table">
                            <thead>
                                <tr>
                                    <th>Ticket #</th>
                                    <th>Service Type</th>
                                    <th>Schedule Date</th>
                                    <th>Address</th>
                                    <th>Estimated Price</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="noBrokerMaintenanceRows">
                                <tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">Loading service bookings...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="hs-strip">
                    <div class="hs-strip-header">
                        <h5 class="hs-strip-title">Frequently Asked Questions</h5>
                    </div>
                    <div class="hs-faq-list">
                        ${faqs.map(([q, a]) => `
                            <details>
                                <summary>${escapeHtml(q)}</summary>
                                <p>${escapeHtml(a)}</p>
                            </details>
                        `).join("")}
                    </div>
                </section>
            </div>
        `;
    }

    function enhanceSection() {
        const section = findSection();
        if (!section) return;
        addStyles();
        upsertServiceOptions();

        const markup = homeServicesMarkup();
        const existingModernHub = section.querySelector("#homeServicesDashboardModern");
        const hasLegacyNoBrokerContent = Boolean(
            section.querySelector("#carpentryCatalogue, .nobroker-cat-item, .nb-service-thumb, [data-nb-service]")
        );

        if (hasLegacyNoBrokerContent) {
            if (existingModernHub) {
                existingModernHub.outerHTML = markup;
            } else {
                section.insertAdjacentHTML("beforeend", markup);
            }
        } else {
            section.innerHTML = markup;
        }
        section.dataset.homeServicesEnhanced = "true";
        repairLegacyNoBrokerIcons();
    }

    window.noBrokerServiceMeta = serviceMeta;

    window.selectNoBrokerService = function selectNoBrokerService(serviceName, price) {
        const parts = String(serviceName || "").split("|");
        const name = parts[0] || "General Inspection";
        const finalPrice = Number(price ?? parts[1] ?? serviceMeta(name).price ?? 49);
        const select = document.getElementById("nbSelectedService");
        if (select) {
            upsertServiceOptions();
            const value = `${name}|${Number.isFinite(finalPrice) ? finalPrice : 49}`;
            let option = Array.from(select.options).find(item => item.value.split("|")[0] === name);
            if (!option) {
                option = new Option(`${name} (${finalPrice === 0 ? "Quote after inspection" : `Starts Rs. ${finalPrice}`})`, value);
                select.add(option);
            }
            option.value = value;
            select.value = value;
            window.updateNoBrokerCheckoutPrice?.();
        }
        const notes = document.getElementById("nbNotes");
        const meta = serviceMeta(name);
        if (notes && !notes.value.trim()) {
            notes.value = `${meta.option}\nMaterial/spare charges to be confirmed by the assigned vendor.`;
        }
        (document.getElementById("nobrokerBookingFormAnchor") || select)?.scrollIntoView({behavior: "smooth", block: "start"});
        notify(`Selected service: ${name}`);
    };

    const categorySubServices = {
        "Home Cleaning": [
            { name: "Full House Cleaning", service: "Home Cleaning", price: 499, icon: "fa-solid fa-house-chimney-window", color: "#4338ca", bg: "#e0e7ff" },
            { name: "Kitchen Cleaning", service: "Kitchen Cleaning", price: 499, icon: "fa-solid fa-kitchen-set", color: "#ea580c", bg: "#ffedd5", badge: "Trending" },
            { name: "Sofa Cleaning", service: "Sofa Cleaning", price: 349, icon: "fa-solid fa-couch", color: "#7c3aed", bg: "#f3e8ff" },
            { name: "Bathroom Cleaning", service: "Bathroom Cleaning", price: 399, icon: "fa-solid fa-toilet", color: "#0284c7", bg: "#e0f2fe" }
        ],
        "Packers & Movers": [
            { name: "Within City Shifting", service: "Packers & Movers", price: 799, icon: "fa-solid fa-truck-ramp-box", color: "#2563eb", bg: "#eff6ff", badge: "Popular" },
            { name: "Intercity Shifting", service: "Packers & Movers", price: 1499, icon: "fa-solid fa-route", color: "#0284c7", bg: "#e0f2fe" },
            { name: "Vehicle Shifting", service: "Packers & Movers", price: 1199, icon: "fa-solid fa-car-side", color: "#0d9488", bg: "#f0fdfa" },
            { name: "House Shifting (Full)", service: "Packers & Movers", price: 999, icon: "fa-solid fa-truck-fast", color: "#6366f1", bg: "#eef2ff" }
        ],
        "Painting & Waterproofing": [
            { name: "Full Home Painting", service: "Painting & Waterproofing", price: 999, icon: "fa-solid fa-brush", color: "#d97706", bg: "#fffbeb", badge: "Trending" },
            { name: "Touchup & Single Wall", service: "Painting & Waterproofing", price: 399, icon: "fa-solid fa-paint-roller", color: "#b45309", bg: "#fef3c7" },
            { name: "Waterproofing & Damp", service: "Painting & Waterproofing", price: 499, icon: "fa-solid fa-droplet-slash", color: "#0284c7", bg: "#e0f2fe" },
            { name: "Wood & Metal Polish", service: "Painting & Waterproofing", price: 349, icon: "fa-solid fa-fill-drip", color: "#7c3aed", bg: "#f3e8ff" }
        ],
        "Rental & Legal Agreement": [
            { name: "Rental Agreement", service: "Rental & Legal Agreement", price: 299, icon: "fa-solid fa-file-contract", color: "#0284c7", bg: "#f0f9ff", badge: "Instant" },
            { name: "Sale Agreement Draft", service: "Rental & Legal Agreement", price: 499, icon: "fa-solid fa-file-signature", color: "#0ea5e9", bg: "#e0f2fe" },
            { name: "Police Verification", service: "Rental & Legal Agreement", price: 199, icon: "fa-solid fa-user-shield", color: "#10b981", bg: "#f0fdf4" },
            { name: "E-Stamp & Notary", service: "Rental & Legal Agreement", price: 399, icon: "fa-solid fa-stamp", color: "#6366f1", bg: "#eef2ff" }
        ],
        "Electrician, Plumber & Carpenter": [
            { name: "Electrical Repairs", service: "Switch Board Repair", price: 149, icon: "fa-solid fa-bolt", color: "#f59e0b", bg: "#fffbeb", badge: "Express 60Min" },
            { name: "Plumbing & Tap Leakage", service: "Tap Repair", price: 199, icon: "fa-solid fa-faucet-drip", color: "#0284c7", bg: "#eff6ff" },
            { name: "Carpenter & Door Lock", service: "Door & Lock Fitting", price: 149, icon: "fa-solid fa-lock", color: "#8b5cf6", bg: "#faf5ff" },
            { name: "Drill & Wall Hang", service: "Drill & Hang", price: 99, icon: "fa-solid fa-hammer", color: "#10b981", bg: "#f0fdf4" }
        ],
        "Interior & Renovation": [
            { name: "Full Home 3D Design", service: "Interior & Renovation", price: 0, icon: "fa-solid fa-compass-drafting", color: "#7c3aed", bg: "#f3e8ff", badge: "Free Consult" },
            { name: "Modular Kitchen", service: "Interior & Renovation", price: 0, icon: "fa-solid fa-kitchen-set", color: "#db2777", bg: "#fdf2f8" },
            { name: "Wardrobes & Storage", service: "Interior & Renovation", price: 0, icon: "fa-solid fa-cubes-stacked", color: "#4f46e5", bg: "#eef2ff" },
            { name: "Space Optimization", service: "Interior & Renovation", price: 0, icon: "fa-solid fa-couch", color: "#8b5cf6", bg: "#faf5ff" }
        ],
        "AC & Appliance Repair": [
            { name: "AC Gas Refill & Service", service: "AC & Appliance Repair", price: 499, icon: "fa-solid fa-wind", color: "#0d9488", bg: "#f0fdfa", badge: "Popular" },
            { name: "Washing Machine Repair", service: "AC & Appliance Repair", price: 299, icon: "fa-solid fa-soap", color: "#3b82f6", bg: "#eff6ff" },
            { name: "Refrigerator Servicing", service: "AC & Appliance Repair", price: 349, icon: "fa-solid fa-box", color: "#10b981", bg: "#f0fdf4" },
            { name: "Geyser Repair", service: "Geyser Repair", price: 299, icon: "fa-solid fa-fire", color: "#f97316", bg: "#fff7ed" }
        ],
        "Pest Control & Sanitization": [
            { name: "Cockroach & Ant Control", service: "Pest Control & Sanitization", price: 299, icon: "fa-solid fa-bug", color: "#e11d48", bg: "#fff1f2", badge: "Herbal & Safe" },
            { name: "Termite Treatment", service: "Pest Control & Sanitization", price: 599, icon: "fa-solid fa-tree", color: "#b45309", bg: "#fef3c7" },
            { name: "Bed Bug Treatment", service: "Pest Control & Sanitization", price: 499, icon: "fa-solid fa-bed", color: "#7c3aed", bg: "#f3e8ff" },
            { name: "Full Home Disinfection", service: "Pest Control & Sanitization", price: 399, icon: "fa-solid fa-shield-virus", color: "#059669", bg: "#ecfdf5" }
        ]
    };

        const subServiceDesignations = {
        "Full House Cleaning": [
            {
                name: "Furnished Apartment",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="8" width="52" height="66" rx="4" fill="#e8ded1" stroke="#d5c7b5" stroke-width="1.5"/>
  <rect x="18" y="12" width="44" height="62" rx="2" fill="#d9cdbc"/>
  <path d="M12 11h56v3H12z" fill="#dfd2c0"/>
  <path d="M10 8h60v3H10z" fill="#ece3d6"/>
  <rect x="22" y="16" width="36" height="58" fill="#fcf6ed"/>
  <ellipse cx="34" cy="26" rx="4" ry="5.5" fill="#f59e0b" stroke="#d97706" stroke-width="0.8"/>
  <circle cx="34" cy="38" r="3.5" fill="#f97316" stroke="#c2410c" stroke-width="0.8"/>
  <rect x="30" y="47" width="22" height="12" rx="3" fill="#64748b"/>
  <rect x="33" y="44" width="7" height="6" rx="1.5" fill="#fbbf24"/>
  <path d="M46 36l3 7h-6z" fill="#fde047"/>
  <line x1="47.5" y1="43" x2="47.5" y2="52" stroke="#475569" stroke-width="1"/>
  <rect x="12" y="55" width="56" height="18" rx="1" fill="#bae6fd" fill-opacity="0.55" stroke="#7dd3fc" stroke-width="1"/>
  <rect x="10" y="53" width="60" height="2.5" rx="1" fill="#cbd5e1"/>
  <line x1="16" y1="55" x2="16" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="32" y1="55" x2="32" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="48" y1="55" x2="48" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="64" y1="55" x2="64" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Unfurnished Apartment",
                price: 1199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="8" width="52" height="66" rx="4" fill="#e8ded1" stroke="#d5c7b5" stroke-width="1.5"/>
  <rect x="18" y="12" width="44" height="62" rx="2" fill="#d9cdbc"/>
  <path d="M12 11h56v3H12z" fill="#dfd2c0"/>
  <path d="M10 8h60v3H10z" fill="#ece3d6"/>
  <rect x="22" y="16" width="36" height="58" fill="#e6f4f1"/>
  <path d="M22 56l10-6h16l10 6" stroke="#99d5cf" stroke-width="1"/>
  <rect x="32" y="24" width="16" height="26" rx="1" fill="#cbe9e4" stroke="#99d5cf" stroke-width="0.8"/>
  <rect x="23" y="18" width="6" height="42" fill="#ffffff" fill-opacity="0.85" stroke="#cbd5e1" stroke-width="0.8"/>
  <rect x="51" y="18" width="6" height="42" fill="#ffffff" fill-opacity="0.85" stroke="#cbd5e1" stroke-width="0.8"/>
  <rect x="12" y="55" width="56" height="18" rx="1" fill="#bae6fd" fill-opacity="0.55" stroke="#7dd3fc" stroke-width="1"/>
  <rect x="10" y="53" width="60" height="2.5" rx="1" fill="#cbd5e1"/>
  <line x1="16" y1="55" x2="16" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="32" y1="55" x2="32" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="48" y1="55" x2="48" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="64" y1="55" x2="64" y2="73" stroke="#94a3b8" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Furnished Villa",
                price: 2499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M12 12h56v62H12z" fill="#ece6dc"/>
  <path d="M10 10h60v4H10z" fill="#ded5c7"/>
  <path d="M20 74V34a20 20 0 0140 0v40H20z" fill="#f8fafc"/>
  <path d="M18 74V33a22 22 0 0144 0v41" stroke="#d5c8b7" stroke-width="2"/>
  <path d="M20 34l8 6v34h-8V34z" fill="#2d2218"/>
  <path d="M60 34l-8 6v34h8V34z" fill="#2d2218"/>
  <path d="M28 40h-2v34h2V40z" fill="#423427"/>
  <rect x="34" y="32" width="12" height="15" rx="1" fill="#1e293b" stroke="#e2e8f0" stroke-width="0.8"/>
  <circle cx="40" cy="38" r="3" fill="#f59e0b"/>
  <rect x="33" y="55" width="14" height="2" fill="#78350f"/>
  <line x1="35" y1="57" x2="35" y2="67" stroke="#78350f" stroke-width="1"/>
  <line x1="45" y1="57" x2="45" y2="67" stroke="#78350f" stroke-width="1"/>
  <circle cx="40" cy="52" r="2.5" fill="#10b981"/>
  <path d="M28 66l6 8h12l6-8H28z" fill="#e2e8f0" fill-opacity="0.6"/>
</svg>`
            },
            {
                name: "Unfurnished Villa",
                price: 1999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M12 12h56v62H12z" fill="#ece6dc"/>
  <path d="M10 10h60v4H10z" fill="#ded5c7"/>
  <path d="M20 74V34a20 20 0 0140 0v40H20z" fill="#f8fafc"/>
  <path d="M18 74V33a22 22 0 0144 0v41" stroke="#d5c8b7" stroke-width="2"/>
  <path d="M20 34l8 6v34h-8V34z" fill="#2d2218"/>
  <path d="M60 34l-8 6v34h8V34z" fill="#2d2218"/>
  <path d="M28 40h-2v34h2V40z" fill="#423427"/>
  <line x1="40" y1="24" x2="40" y2="46" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="2 2"/>
  <path d="M28 58l6-6h12l6 6H28z" fill="#f1f5f9"/>
  <path d="M28 66l6 8h12l6-8H28z" fill="#ffffff"/>
  <path d="M34 52v12h12V52" stroke="#cbd5e1" stroke-width="1"/>
</svg>`
            },
            {
                name: "Book by Room",
                price: 399,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="33" y="10" width="14" height="18" rx="1.5" fill="#fdfbf7" stroke="#d4c3b3" stroke-width="1.2"/>
  <rect x="36" y="13" width="8" height="12" fill="#e8ded1"/>
  <rect x="22" y="30" width="36" height="14" rx="2" fill="#c69a72" stroke="#b0845c" stroke-width="1"/>
  <rect x="24" y="36" width="14" height="8" rx="2.5" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="42" y="36" width="14" height="8" rx="2.5" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="20" y="42" width="40" height="22" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <rect x="20" y="54" width="40" height="8" fill="#e2e8f0"/>
  <line x1="22" y1="64" x2="20" y2="70" stroke="#b0845c" stroke-width="2" stroke-linecap="round"/>
  <line x1="58" y1="64" x2="60" y2="70" stroke="#b0845c" stroke-width="2" stroke-linecap="round"/>
  <rect x="8" y="46" width="10" height="12" rx="1.5" fill="#c69a72" stroke="#b0845c" stroke-width="0.8"/>
  <line x1="13" y1="46" x2="13" y2="39" stroke="#334155" stroke-width="1.2"/>
  <path d="M10 39h6l-1-4h-4z" fill="#475569"/>
  <rect x="62" y="46" width="10" height="12" rx="1.5" fill="#c69a72" stroke="#b0845c" stroke-width="0.8"/>
  <line x1="67" y1="46" x2="67" y2="39" stroke="#334155" stroke-width="1.2"/>
  <path d="M64 39h6l-1-4h-4z" fill="#475569"/>
</svg>`
            },
            {
                name: "Mini Services",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="16" width="44" height="48" rx="2" fill="#9a4d33" stroke="#7e3b23" stroke-width="1.5"/>
  <rect x="22" y="20" width="36" height="40" rx="1" fill="#7e3b23"/>
  <rect x="24" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="41" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="24" y="41" width="15" height="17" fill="#bae6fd"/>
  <rect x="41" y="41" width="15" height="17" fill="#bae6fd"/>
  <path d="M26 24l8 13M43 24l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <path d="M26 43l8 13M43 43l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <rect x="15" y="64" width="50" height="4" rx="1.5" fill="#b45a3c" stroke="#7e3b23" stroke-width="1"/>
</svg>`
            }
        ],
        "Kitchen Cleaning": [
            {
                name: "Occupied Kitchen Cleaning",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="8" width="48" height="24" rx="1.5" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1.2"/>
  <line x1="40" y1="8" x2="40" y2="32" stroke="#c8b7a3" stroke-width="1.2"/>
  <line x1="16" y1="20" x2="64" y2="20" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="10" y="8" width="6" height="24" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="64" y="8" width="6" height="24" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="20" y="11" width="4" height="7" rx="1" fill="#b45309"/>
  <rect x="26" y="11" width="4" height="7" rx="1" fill="#ea580c"/>
  <rect x="32" y="11" width="4" height="7" rx="1" fill="#d97706"/>
  <rect x="44" y="11" width="4" height="7" rx="1" fill="#b45309"/>
  <rect x="50" y="11" width="4" height="7" rx="1" fill="#ea580c"/>
  <rect x="56" y="11" width="4" height="7" rx="1" fill="#d97706"/>
  <rect x="20" y="23" width="4" height="7" rx="1" fill="#d97706"/>
  <rect x="26" y="23" width="4" height="7" rx="1" fill="#b45309"/>
  <rect x="32" y="23" width="4" height="7" rx="1" fill="#ea580c"/>
  <rect x="44" y="23" width="4" height="7" rx="1" fill="#d97706"/>
  <rect x="50" y="23" width="4" height="7" rx="1" fill="#b45309"/>
  <rect x="56" y="23" width="4" height="7" rx="1" fill="#ea580c"/>
  <rect x="14" y="32" width="52" height="12" fill="#f8fafc"/>
  <path d="M30 44v-7a3 3 0 016 0v2" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="39" y="37" width="6" height="7" rx="1.5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.8"/>
  <rect x="40" y="35.5" width="4" height="1.5" rx="0.5" fill="#475569"/>
  <path d="M45 38.5h2a1.5 1.5 0 011.5 1.5v2A1.5 1.5 0 0147 43.5h-2" stroke="#475569" stroke-width="0.8"/>
  <rect x="21" y="38" width="4" height="6" rx="1" fill="#ea580c"/>
  <ellipse cx="25" cy="43" rx="3" ry="1.5" fill="#f59e0b"/>
  <rect x="57" y="39" width="3" height="5" rx="0.8" fill="#b45309"/>
  <rect x="14" y="44" width="52" height="2" fill="#334155"/>
  <rect x="14" y="46" width="36" height="24" fill="#c68a4c" stroke="#b07538" stroke-width="1"/>
  <line x1="26" y1="46" x2="26" y2="70" stroke="#b07538" stroke-width="1"/>
  <line x1="38" y1="46" x2="38" y2="70" stroke="#b07538" stroke-width="1"/>
  <rect x="28" y="44" width="10" height="2" fill="#94a3b8"/>
  <rect x="50" y="44" width="16" height="26" rx="1" fill="#78716c" stroke="#57534e" stroke-width="1"/>
  <rect x="52" y="46" width="12" height="3" fill="#44403c"/>
  <circle cx="54" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <circle cx="58" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <circle cx="62" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <rect x="52" y="52" width="12" height="12" rx="1" fill="#292524" stroke="#44403c" stroke-width="0.8"/>
  <line x1="53" y1="50" x2="63" y2="50" stroke="#a8a29e" stroke-width="1" stroke-linecap="round"/>
</svg>`
            },
            {
                name: "Empty Kitchen Cleaning",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="8" width="48" height="24" rx="1.5" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1.2"/>
  <line x1="40" y1="8" x2="40" y2="32" stroke="#c8b7a3" stroke-width="1.2"/>
  <line x1="16" y1="20" x2="64" y2="20" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="10" y="8" width="6" height="24" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="64" y="8" width="6" height="24" fill="#dfcfbd" stroke="#c8b7a3" stroke-width="1"/>
  <rect x="14" y="32" width="52" height="12" fill="#f8fafc"/>
  <path d="M36 44v-7a3 3 0 016 0v2" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="14" y="44" width="52" height="2" fill="#334155"/>
  <rect x="14" y="46" width="36" height="24" fill="#c68a4c" stroke="#b07538" stroke-width="1"/>
  <line x1="26" y1="46" x2="26" y2="70" stroke="#b07538" stroke-width="1"/>
  <line x1="38" y1="46" x2="38" y2="70" stroke="#b07538" stroke-width="1"/>
  <rect x="34" y="44" width="10" height="2" fill="#94a3b8"/>
  <rect x="50" y="44" width="16" height="26" rx="1" fill="#78716c" stroke="#57534e" stroke-width="1"/>
  <rect x="52" y="46" width="12" height="3" fill="#44403c"/>
  <circle cx="54" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <circle cx="58" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <circle cx="62" cy="47.5" r="0.8" fill="#d6d3d1"/>
  <rect x="52" y="52" width="12" height="12" rx="1" fill="#292524" stroke="#44403c" stroke-width="0.8"/>
  <line x1="53" y1="50" x2="63" y2="50" stroke="#a8a29e" stroke-width="1" stroke-linecap="round"/>
</svg>`
            },
            {
                name: "Mini Services",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="16" width="44" height="48" rx="2" fill="#9a4d33" stroke="#7e3b23" stroke-width="1.5"/>
  <rect x="22" y="20" width="36" height="40" rx="1" fill="#7e3b23"/>
  <rect x="24" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="41" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="24" y="41" width="15" height="17" fill="#bae6fd"/>
  <rect x="41" y="41" width="15" height="17" fill="#bae6fd"/>
  <path d="M26 24l8 13M43 24l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <path d="M26 43l8 13M43 43l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <rect x="15" y="64" width="50" height="4" rx="1.5" fill="#b45a3c" stroke="#7e3b23" stroke-width="1"/>
</svg>`
            }
        ],
        "Sofa Cleaning": [
            {
                name: "Sofa cleaning",
                price: 349,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M18 57l-1.5 9h3l1-9h-2.5z" fill="#422e1e"/>
  <path d="M62 57l1.5 9h-3l-1-9h2.5z" fill="#422e1e"/>
  <path d="M26 58l-0.5 7h2.5l0.5-7h-2.5z" fill="#2d1e14"/>
  <path d="M54 58l0.5 7h-2.5l-0.5-7h2.5z" fill="#2d1e14"/>
  <rect x="14" y="52" width="52" height="7" rx="2" fill="#d0c0ad" stroke="#baa893" stroke-width="0.8"/>
  <rect x="18" y="44" width="21.5" height="10" rx="3" fill="#ebdcd0" stroke="#d5c3b1" stroke-width="1"/>
  <rect x="40.5" y="44" width="21.5" height="10" rx="3" fill="#ebdcd0" stroke="#d5c3b1" stroke-width="1"/>
  <rect x="19" y="27" width="20.5" height="19" rx="3.5" fill="#dfcebf" stroke="#cbb8a7" stroke-width="1"/>
  <rect x="40.5" y="27" width="20.5" height="19" rx="3.5" fill="#dfcebf" stroke="#cbb8a7" stroke-width="1"/>
  <line x1="29" y1="34" x2="29" y2="38" stroke="#baa694" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="51" y1="34" x2="51" y2="38" stroke="#baa694" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="13" y="36" width="6.5" height="19" rx="3" fill="#d5c3b1" stroke="#baa893" stroke-width="1"/>
  <rect x="60.5" y="36" width="6.5" height="19" rx="3" fill="#d5c3b1" stroke="#baa893" stroke-width="1"/>
</svg>`
            },
            {
                name: "Carpet cleaning",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M12 25h3M12 29h3M12 33h3M12 37h3M12 41h3M12 45h3M12 49h3M12 53h3M12 57h3" stroke="#e0c29e" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M65 25h3M65 29h3M65 33h3M65 37h3M65 41h3M65 45h3M65 49h3M65 53h3M65 57h3" stroke="#e0c29e" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="15" y="22" width="50" height="38" rx="4" fill="#d99859" stroke="#be7d3f" stroke-width="1.2"/>
  <rect x="19" y="26" width="42" height="30" rx="2" fill="#c98647" stroke="#ad6d31" stroke-width="1"/>
  <rect x="22" y="29" width="36" height="24" rx="1.5" fill="#dd9f63"/>
  <circle cx="40" cy="41" r="7" fill="#4d5d33" fill-opacity="0.75"/>
  <circle cx="40" cy="41" r="3" fill="#d99859"/>
  <path d="M40 31l2 4h-4zM40 51l2-4h-4zM30 41l4 2v-4zM50 41l-4 2v-4z" fill="#4d5d33"/>
  <circle cx="34" cy="35" r="1.5" fill="#4d5d33"/>
  <circle cx="46" cy="35" r="1.5" fill="#4d5d33"/>
  <circle cx="34" cy="47" r="1.5" fill="#4d5d33"/>
  <circle cx="46" cy="47" r="1.5" fill="#4d5d33"/>
</svg>`
            },
            {
                name: "Mini Services",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="16" width="44" height="48" rx="2" fill="#9a4d33" stroke="#7e3b23" stroke-width="1.5"/>
  <rect x="22" y="20" width="36" height="40" rx="1" fill="#7e3b23"/>
  <rect x="24" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="41" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="24" y="41" width="15" height="17" fill="#bae6fd"/>
  <rect x="41" y="41" width="15" height="17" fill="#bae6fd"/>
  <path d="M26 24l8 13M43 24l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <path d="M26 43l8 13M43 43l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <rect x="15" y="64" width="50" height="4" rx="1.5" fill="#b45a3c" stroke="#7e3b23" stroke-width="1"/>
</svg>`
            }
        ],
        "Bathroom Cleaning": [
            {
                name: "Deep Bathroom Cleaning",
                price: 449,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="10" width="52" height="58" rx="2" fill="#f0f9ff" stroke="#e0f2fe" stroke-width="1"/>
  <line x1="14" y1="28" x2="66" y2="28" stroke="#e0f2fe" stroke-width="0.8"/>
  <line x1="14" y1="46" x2="66" y2="46" stroke="#e0f2fe" stroke-width="0.8"/>
  <line x1="32" y1="10" x2="32" y2="46" stroke="#e0f2fe" stroke-width="0.8"/>
  <line x1="48" y1="10" x2="48" y2="46" stroke="#e0f2fe" stroke-width="0.8"/>
  <rect x="18" y="14" width="16" height="22" rx="2" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2"/>
  <rect x="20" y="16" width="12" height="18" rx="1" fill="#bae6fd"/>
  <path d="M22 18l6 14" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <rect x="16" y="38" width="20" height="12" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
  <path d="M25 38v-5a2 2 0 014 0v1.5" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="18" y="50" width="16" height="14" rx="1" fill="#94a3b8" stroke="#64748b" stroke-width="0.8"/>
  <rect x="44" y="24" width="18" height="22" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <rect x="50" y="26" width="6" height="2.5" rx="1" fill="#94a3b8"/>
  <ellipse cx="53" cy="50" rx="11" ry="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <ellipse cx="53" cy="49" rx="8" ry="5.5" fill="#f1f5f9"/>
  <path d="M47 54l1 13h10l1-13" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <path d="M37 18l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5 1.5-3.5z" fill="#38bdf8"/>
  <path d="M58 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" fill="#facc15"/>
  <path d="M38 52l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="#38bdf8"/>
</svg>`
            },
            {
                name: "Standard Bathroom Cleaning",
                price: 349,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="10" width="52" height="58" rx="2" fill="#f8fafc" stroke="#f1f5f9" stroke-width="1"/>
  <line x1="14" y1="28" x2="66" y2="28" stroke="#f1f5f9" stroke-width="0.8"/>
  <line x1="14" y1="46" x2="66" y2="46" stroke="#f1f5f9" stroke-width="0.8"/>
  <line x1="38" y1="10" x2="38" y2="46" stroke="#f1f5f9" stroke-width="0.8"/>
  <rect x="19" y="16" width="15" height="20" rx="1.5" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1"/>
  <rect x="21" y="18" width="11" height="16" rx="1" fill="#f1f5f9"/>
  <rect x="17" y="38" width="19" height="10" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
  <path d="M25 38v-4a2 2 0 014 0v1" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M23 48l1 16h7l1-16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <rect x="45" y="26" width="16" height="20" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <rect x="50" y="28" width="6" height="2" rx="1" fill="#94a3b8"/>
  <ellipse cx="53" cy="50" rx="10" ry="7.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
  <path d="M48 54l1 13h8l1-13" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
</svg>`
            },
            {
                name: "Mini Services",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="16" width="44" height="48" rx="2" fill="#9a4d33" stroke="#7e3b23" stroke-width="1.5"/>
  <rect x="22" y="20" width="36" height="40" rx="1" fill="#7e3b23"/>
  <rect x="24" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="41" y="22" width="15" height="17" fill="#e0f2fe"/>
  <rect x="24" y="41" width="15" height="17" fill="#bae6fd"/>
  <rect x="41" y="41" width="15" height="17" fill="#bae6fd"/>
  <path d="M26 24l8 13M43 24l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <path d="M26 43l8 13M43 43l8 13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.8"/>
  <rect x="15" y="64" width="50" height="4" rx="1.5" fill="#b45a3c" stroke="#7e3b23" stroke-width="1"/>
</svg>`
            }
        ],
        "Within City Shifting": [
            {
                name: "1 RK / Studio",
                price: 799,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="30" width="34" height="26" rx="2" fill="#3b82f6" stroke="#2563eb" stroke-width="1.2"/>
  <rect x="18" y="34" width="12" height="10" rx="1" fill="#d97706"/>
  <rect x="32" y="34" width="12" height="10" rx="1" fill="#b45309"/>
  <path d="M48 36h14l6 10v10h-20V36z" fill="#60a5fa" stroke="#2563eb" stroke-width="1.2"/>
  <path d="M52 39h8l4 7h-12v-7z" fill="#e0f2fe"/>
  <circle cx="26" cy="56" r="6" fill="#1e293b"/>
  <circle cx="26" cy="56" r="2.5" fill="#94a3b8"/>
  <circle cx="58" cy="56" r="6" fill="#1e293b"/>
  <circle cx="58" cy="56" r="2.5" fill="#94a3b8"/>
  <rect x="24" y="24" width="14" height="6" rx="1" fill="#f59e0b"/>
</svg>`
            },
            {
                name: "1 BHK Shifting",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="12" y="24" width="38" height="32" rx="2" fill="#2563eb" stroke="#1d4ed8" stroke-width="1.2"/>
  <path d="M12 24h38v8H12z" fill="#1d4ed8"/>
  <line x1="25" y1="32" x2="25" y2="56" stroke="#1d4ed8" stroke-width="1"/>
  <line x1="38" y1="32" x2="38" y2="56" stroke="#1d4ed8" stroke-width="1"/>
  <path d="M50 34h14l6 11v11H50V34z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1.2"/>
  <path d="M54 37h8l4 8h-12v-8z" fill="#e0f2fe"/>
  <circle cx="24" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="24" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="60" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="60" cy="56" r="2.5" fill="#cbd5e1"/>
</svg>`
            },
            {
                name: "2 BHK Shifting",
                price: 2499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="10" y="20" width="44" height="36" rx="2" fill="#1d4ed8" stroke="#1e40af" stroke-width="1.2"/>
  <rect x="14" y="24" width="36" height="4" fill="#60a5fa"/>
  <line x1="16" y1="32" x2="48" y2="32" stroke="#60a5fa" stroke-width="1" stroke-dasharray="3 3"/>
  <path d="M54 32h14l6 12v12H54V32z" fill="#2563eb" stroke="#1e40af" stroke-width="1.2"/>
  <path d="M58 35h8l4 9h-12v-9z" fill="#e0f2fe"/>
  <circle cx="22" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="22" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="36" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="36" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="64" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="64" cy="56" r="2.5" fill="#cbd5e1"/>
</svg>`
            },
            {
                name: "3+ BHK / Villa",
                price: 3999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="8" y="16" width="48" height="40" rx="3" fill="#1e3a8a" stroke="#172554" stroke-width="1.2"/>
  <rect x="12" y="20" width="40" height="4" fill="#3b82f6"/>
  <rect x="14" y="28" width="16" height="12" rx="1" fill="#d97706"/>
  <rect x="34" y="28" width="16" height="12" rx="1" fill="#2563eb"/>
  <path d="M56 30h14l6 13v13H56V30z" fill="#1d4ed8" stroke="#172554" stroke-width="1.2"/>
  <path d="M60 33h8l4 10h-12v-10z" fill="#e0f2fe"/>
  <circle cx="18" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="18" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="30" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="30" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="44" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="44" cy="56" r="2.5" fill="#cbd5e1"/>
  <circle cx="66" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="66" cy="56" r="2.5" fill="#cbd5e1"/>
</svg>`
            }
        ],
        "Intercity Shifting": [
            {
                name: "Dedicated Truck",
                price: 4999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="10" y="22" width="44" height="34" rx="2" fill="#0284c7" stroke="#0369a1" stroke-width="1.2"/>
  <path d="M54 34h14l6 11v11H54V34z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2"/>
  <circle cx="24" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="60" cy="56" r="6.5" fill="#0f172a"/>
  <path d="M28 14l4 8h-8z" fill="#ef4444"/>
  <circle cx="30" cy="18" r="1.5" fill="#ffffff"/>
</svg>`
            },
            {
                name: "Shared Truck (Part Load)",
                price: 1999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="12" y="24" width="40" height="32" rx="2" fill="#0ea5e9" stroke="#0284c7" stroke-width="1.2"/>
  <line x1="32" y1="24" x2="32" y2="56" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3"/>
  <path d="M52 36h14l6 10v10H52V36z" fill="#7dd3fc"/>
  <circle cx="24" cy="56" r="6" fill="#0f172a"/>
  <circle cx="60" cy="56" r="6" fill="#0f172a"/>
</svg>`
            },
            {
                name: "Packing & Loading Only",
                price: 999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="32" width="22" height="24" rx="2" fill="#d97706" stroke="#b45309" stroke-width="1.2"/>
  <line x1="29" y1="32" x2="29" y2="56" stroke="#b45309" stroke-width="1"/>
  <rect x="36" y="24" width="20" height="20" rx="2" fill="#f59e0b" stroke="#d97706" stroke-width="1.2"/>
  <line x1="46" y1="24" x2="46" y2="44" stroke="#d97706" stroke-width="1"/>
  <path d="M14 56h48" stroke="#64748b" stroke-width="2"/>
</svg>`
            }
        ],
        "Vehicle Shifting": [
            {
                name: "Two Wheeler / Bike",
                price: 1199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <circle cx="24" cy="52" r="10" fill="#0f172a" stroke="#0d9488" stroke-width="2"/>
  <circle cx="24" cy="52" r="4" fill="#cbd5e1"/>
  <circle cx="56" cy="52" r="10" fill="#0f172a" stroke="#0d9488" stroke-width="2"/>
  <circle cx="56" cy="52" r="4" fill="#cbd5e1"/>
  <path d="M24 52l12-14h14l6 14" stroke="#14b8a6" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 38l6-10h8" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="36" y="32" width="12" height="6" rx="2" fill="#f43f5e"/>
</svg>`
            },
            {
                name: "Four Wheeler / Car",
                price: 2999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M14 46l6-14h40l6 14h6v12h-6a8 8 0 01-16 0H30a8 8 0 01-16 0H8V46h6z" fill="#0f766e" stroke="#115e59" stroke-width="1.2"/>
  <path d="M24 35h14v9H20l4-9zM42 35h14l4 9H42v-9z" fill="#ccfbf1"/>
  <circle cx="22" cy="58" r="6" fill="#0f172a"/>
  <circle cx="58" cy="58" r="6" fill="#0f172a"/>
</svg>`
            },
            {
                name: "Multiple Vehicles",
                price: 3999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="10" y="16" width="52" height="40" rx="3" fill="#134e4a" stroke="#0f766e" stroke-width="1.2"/>
  <line x1="10" y1="36" x2="62" y2="36" stroke="#2dd4bf" stroke-width="1.5"/>
  <rect x="16" y="24" width="18" height="8" rx="2" fill="#2dd4bf"/>
  <rect x="40" y="24" width="18" height="8" rx="2" fill="#5eead4"/>
  <rect x="16" y="42" width="18" height="8" rx="2" fill="#14b8a6"/>
  <rect x="40" y="42" width="18" height="8" rx="2" fill="#0d9488"/>
  <circle cx="20" cy="58" r="5" fill="#0f172a"/>
  <circle cx="56" cy="58" r="5" fill="#0f172a"/>
</svg>`
            }
        ],
        "House Shifting (Full)": [
            {
                name: "Full Service Move",
                price: 3499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="10" y="20" width="44" height="36" rx="2" fill="#6366f1" stroke="#4f46e5" stroke-width="1.2"/>
  <path d="M54 32h14l6 12v12H54V32z" fill="#818cf8"/>
  <circle cx="22" cy="56" r="6.5" fill="#0f172a"/>
  <circle cx="60" cy="56" r="6.5" fill="#0f172a"/>
  <path d="M28 26h8v8h-8zM40 26h8v8h-8z" fill="#e0e7ff"/>
</svg>`
            },
            {
                name: "Standard Move",
                price: 2199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="12" y="26" width="40" height="30" rx="2" fill="#4f46e5"/>
  <path d="M52 36h14l6 10v10H52V36z" fill="#6366f1"/>
  <circle cx="24" cy="56" r="6" fill="#0f172a"/>
  <circle cx="60" cy="56" r="6" fill="#0f172a"/>
</svg>`
            },
            {
                name: "Mini Tempo Shifting",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="34" width="30" height="22" rx="2" fill="#4338ca"/>
  <path d="M46 38h12l5 9v9H46V38z" fill="#818cf8"/>
  <circle cx="28" cy="56" r="5.5" fill="#0f172a"/>
  <circle cx="56" cy="56" r="5.5" fill="#0f172a"/>
</svg>`
            }
        ],
        "Full Home Painting": [
            {
                name: "1 BHK Full Painting",
                price: 4999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M20 34L40 18l20 16v32H20V34z" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <rect x="32" y="44" width="16" height="22" fill="#d97706"/>
  <rect x="48" y="26" width="18" height="8" rx="2" fill="#f59e0b"/>
  <path d="M57 34v12" stroke="#78350f" stroke-width="2"/>
</svg>`
            },
            {
                name: "2 BHK Full Painting",
                price: 8999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M14 36L32 20l18 16v30H14V36z" fill="#fef3c7" stroke="#d97706" stroke-width="1.2"/>
  <path d="M38 32l16-14 16 14v34H38V32z" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.2"/>
  <circle cx="54" cy="46" r="8" fill="#f59e0b"/>
</svg>`
            },
            {
                name: "3 BHK Full Painting",
                price: 13999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="12" y="24" width="56" height="42" rx="2" fill="#fffbeb" stroke="#b45309" stroke-width="1.5"/>
  <rect x="18" y="32" width="12" height="14" fill="#fef3c7" stroke="#d97706"/>
  <rect x="34" y="32" width="12" height="14" fill="#fef3c7" stroke="#d97706"/>
  <rect x="50" y="32" width="12" height="14" fill="#fef3c7" stroke="#d97706"/>
  <rect x="30" y="14" width="20" height="7" rx="2" fill="#ea580c"/>
</svg>`
            },
            {
                name: "Villa Painting",
                price: 19999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M16 32L40 12l24 20v34H16V32z" fill="#fff7ed" stroke="#c2410c" stroke-width="1.5"/>
  <rect x="24" y="38" width="10" height="12" fill="#fed7aa"/>
  <rect x="46" y="38" width="10" height="12" fill="#fed7aa"/>
  <rect x="34" y="46" width="12" height="20" fill="#9a3412"/>
</svg>`
            }
        ],
        "Touchup & Single Wall": [
            {
                name: "Single Accent Wall",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="14" width="48" height="52" rx="2" fill="#0d9488" stroke="#0f766e" stroke-width="1.2"/>
  <path d="M16 26l48 24M16 42l36 24M28 14l36 24" stroke="#5eead4" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Room Touchup & Putty",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="16" width="52" height="50" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <path d="M30 40l14-14 8 8-14 14z" fill="#64748b"/>
  <path d="M42 46l8 12h-6l-6-8z" fill="#334155"/>
</svg>`
            },
            {
                name: "Crack & Seepage Patch",
                price: 399,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="16" width="52" height="50" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <path d="M36 20l6 14-8 12 10 16" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`
            }
        ],
        "Waterproofing & Damp": [
            {
                name: "Terrace Waterproofing",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M10 36L40 18l30 18v10H10V36z" fill="#0284c7"/>
  <rect x="14" y="46" width="52" height="20" fill="#38bdf8"/>
  <path d="M26 12l2 4M40 10l2 4M54 12l2 4" stroke="#0284c7" stroke-width="2"/>
</svg>`
            },
            {
                name: "Bathroom Seepage Proofing",
                price: 999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="16" width="48" height="50" rx="2" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>
  <line x1="16" y1="32" x2="64" y2="32" stroke="#0284c7" stroke-width="1"/>
  <line x1="16" y1="48" x2="64" y2="48" stroke="#0284c7" stroke-width="1"/>
  <line x1="32" y1="16" x2="32" y2="66" stroke="#0284c7" stroke-width="1"/>
  <line x1="48" y1="16" x2="48" y2="66" stroke="#0284c7" stroke-width="1"/>
  <circle cx="40" cy="40" r="4" fill="#0ea5e9"/>
</svg>`
            },
            {
                name: "Wall Dampness Treatment",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="14" width="52" height="52" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  <path d="M14 44q13-6 26 0t26 0v22H14V44z" fill="#0284c7" fill-opacity="0.4"/>
</svg>`
            }
        ],
        "Wood & Metal Polish": [
            {
                name: "Door & Window Polish",
                price: 499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="22" y="12" width="36" height="54" rx="2" fill="#854d0e" stroke="#713f12" stroke-width="1.5"/>
  <rect x="26" y="16" width="12" height="20" fill="#a16207"/>
  <rect x="42" y="16" width="12" height="20" fill="#a16207"/>
  <circle cx="50" cy="42" r="2" fill="#facc15"/>
</svg>`
            },
            {
                name: "Furniture PU Polish",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="32" width="48" height="12" rx="2" fill="#713f12"/>
  <path d="M20 44v22M60 44v22M32 44v22M48 44v22" stroke="#713f12" stroke-width="2.5"/>
</svg>`
            },
            {
                name: "Metal Gate & Grille Enamel",
                price: 599,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="16" width="48" height="50" rx="2" fill="#334155" stroke="#1e293b" stroke-width="1.5"/>
  <path d="M24 16v50M32 16v50M40 16v50M48 16v50M56 16v50" stroke="#0f172a" stroke-width="1.5"/>
  <circle cx="40" cy="30" r="4" stroke="#facc15" stroke-width="1.5"/>
</svg>`
            }
        ],
        "Rental Agreement": [
            {
                name: "Biometric E-Registration",
                price: 499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="12" width="44" height="56" rx="3" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
  <circle cx="40" cy="36" r="12" stroke="#0284c7" stroke-width="2"/>
  <circle cx="40" cy="36" r="6" stroke="#0ea5e9" stroke-width="1.5"/>
  <path d="M30 54h20" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
</svg>`
            },
            {
                name: "Standard Digital Agreement",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="10" width="40" height="58" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="26" y1="20" x2="54" y2="20" stroke="#94a3b8" stroke-width="2"/>
  <line x1="26" y1="28" x2="54" y2="28" stroke="#94a3b8" stroke-width="2"/>
  <line x1="26" y1="36" x2="44" y2="36" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="46" cy="52" r="6" fill="#ef4444"/>
</svg>`
            },
            {
                name: "Commercial Lease Draft",
                price: 999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="20" width="30" height="46" fill="#0369a1"/>
  <rect x="36" y="12" width="30" height="54" fill="#0284c7"/>
  <rect x="42" y="20" width="6" height="8" fill="#e0f2fe"/>
  <rect x="52" y="20" width="6" height="8" fill="#e0f2fe"/>
  <rect x="42" y="34" width="6" height="8" fill="#e0f2fe"/>
  <rect x="52" y="34" width="6" height="8" fill="#e0f2fe"/>
</svg>`
            }
        ],
        "Sale Agreement Draft": [
            {
                name: "Flat / Apartment Sale Draft",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="10" width="40" height="58" rx="2" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
  <rect x="28" y="20" width="24" height="24" fill="#e0f2fe" stroke="#0284c7"/>
  <path d="M26 52h28" stroke="#f59e0b" stroke-width="2"/>
</svg>`
            },
            {
                name: "Plot / Land Sale Draft",
                price: 1999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="14" width="52" height="52" rx="2" fill="#ecfdf5" stroke="#059669" stroke-width="1.5"/>
  <line x1="14" y1="40" x2="66" y2="40" stroke="#059669" stroke-width="1.5"/>
  <line x1="40" y1="14" x2="40" y2="66" stroke="#059669" stroke-width="1.5"/>
  <circle cx="27" cy="27" r="3" fill="#10b981"/>
</svg>`
            },
            {
                name: "Legal Review & Opinion",
                price: 999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M40 14v48M22 28h36" stroke="#7c3aed" stroke-width="2.5"/>
  <path d="M22 28l-6 16h12l-6-16zM58 28l-6 16h12l-6-16z" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.2"/>
</svg>`
            }
        ],
        "Police Verification": [
            {
                name: "Tenant Police Verification",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M40 12l22 8v20c0 14-22 24-22 24S18 54 18 40V20l22-8z" fill="#1e40af" stroke="#1d4ed8" stroke-width="1.5"/>
  <circle cx="40" cy="34" r="7" fill="#ffffff"/>
  <path d="M30 48c0-5 5-8 10-8s10 3 10 8" fill="#ffffff"/>
</svg>`
            },
            {
                name: "Domestic Staff Verification",
                price: 249,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="14" width="44" height="54" rx="3" fill="#ffffff" stroke="#047857" stroke-width="1.5"/>
  <circle cx="40" cy="32" r="8" fill="#047857"/>
  <path d="M28 50c0-6 6-9 12-9s12 3 12 9" fill="#047857"/>
  <circle cx="52" cy="20" r="5" fill="#10b981"/>
  <path d="M49 20l2 2 4-4" stroke="#ffffff" stroke-width="1.2"/>
</svg>`
            }
        ],
        "E-Stamp & Notary": [
            {
                name: "Notarized Affidavit",
                price: 399,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="10" width="40" height="58" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <circle cx="40" cy="46" r="10" fill="#dc2626"/>
  <circle cx="40" cy="46" r="6" fill="#f59e0b"/>
  <line x1="26" y1="20" x2="54" y2="20" stroke="#94a3b8" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Power of Attorney (PoA)",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M24 30l16-16 10 10-16 16z" fill="#475569"/>
  <rect x="42" y="32" width="16" height="28" rx="2" fill="#64748b"/>
</svg>`
            },
            {
                name: "E-Stamp Paper Delivery",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="12" width="44" height="56" rx="2" fill="#ffffff" stroke="#6366f1" stroke-width="1.5"/>
  <rect x="22" y="16" width="36" height="14" fill="#e0e7ff"/>
  <rect x="26" y="38" width="12" height="12" fill="#1e293b"/>
</svg>`
            }
        ],
        "Electrical Repairs": [
            {
                name: "Switch & Socket Fix",
                price: 99,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="20" width="44" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="24" y="28" width="12" height="24" rx="2" fill="#f1f5f9" stroke="#94a3b8"/>
  <circle cx="46" cy="34" r="2.5" fill="#1e293b"/>
  <circle cx="54" cy="34" r="2.5" fill="#1e293b"/>
  <circle cx="50" cy="44" r="3" fill="#1e293b"/>
</svg>`
            },
            {
                name: "Ceiling Fan Service",
                price: 149,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <circle cx="40" cy="40" r="8" fill="#d97706"/>
  <path d="M40 32C40 18 30 14 30 14s2 10 10 18z" fill="#f59e0b"/>
  <path d="M34 46C22 52 16 46 16 46s8-6 18-6z" fill="#f59e0b"/>
  <path d="M46 46C58 52 64 46 64 46s-8-6-18-6z" fill="#f59e0b"/>
</svg>`
            },
            {
                name: "MCB & Tripping Repair",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="22" y="16" width="36" height="50" rx="3" fill="#ffffff" stroke="#ea580c" stroke-width="1.5"/>
  <rect x="30" y="24" width="8" height="16" fill="#ea580c"/>
  <rect x="42" y="32" width="8" height="16" fill="#1e293b"/>
</svg>`
            },
            {
                name: "Complete Wiring Inspection",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="22" y="18" width="36" height="46" rx="4" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/>
  <rect x="28" y="26" width="24" height="14" fill="#1e293b"/>
  <circle cx="40" cy="50" r="5" fill="#ffffff"/>
</svg>`
            }
        ],
        "Plumbing & Tap Leakage": [
            {
                name: "Tap & Shower Leakage",
                price: 149,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M22 36h20v6H22z" fill="#0284c7"/>
  <path d="M36 36v-12a4 4 0 018 0v18" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
  <circle cx="44" cy="50" r="3" fill="#38bdf8"/>
</svg>`
            },
            {
                name: "Pipe Blockage & Drain Clean",
                price: 249,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M26 18v24a8 8 0 0016 0V18" stroke="#0369a1" stroke-width="6" stroke-linecap="round"/>
  <circle cx="34" cy="42" r="4" fill="#ef4444"/>
</svg>`
            },
            {
                name: "Flush Tank & Commode Fix",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="28" y="16" width="24" height="24" rx="2" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
  <ellipse cx="40" cy="52" rx="12" ry="8" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Water Motor / Pump Repair",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="30" width="32" height="24" rx="3" fill="#075985"/>
  <circle cx="36" cy="42" r="8" fill="#0284c7"/>
  <path d="M52 38h12v8H52z" fill="#0369a1"/>
</svg>`
            }
        ],
        "Carpenter & Door Lock": [
            {
                name: "Main Door Lock Replacement",
                price: 249,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="26" y="18" width="28" height="46" rx="3" fill="#ca8a04" stroke="#a16207" stroke-width="1.5"/>
  <circle cx="40" cy="34" r="5" fill="#1e293b"/>
  <path d="M38 38h4v12h-4z" fill="#1e293b"/>
</svg>`
            },
            {
                name: "Door Hinge & Latches Fix",
                price: 149,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="28" y="18" width="24" height="46" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <circle cx="34" cy="26" r="2" fill="#1e293b"/>
  <circle cx="46" cy="26" r="2" fill="#1e293b"/>
  <circle cx="34" cy="56" r="2" fill="#1e293b"/>
  <circle cx="46" cy="56" r="2" fill="#1e293b"/>
</svg>`
            },
            {
                name: "Wardrobe Drawer & Handle",
                price: 129,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="24" width="44" height="34" rx="2" fill="#854d0e"/>
  <rect x="30" y="38" width="20" height="4" rx="2" fill="#facc15"/>
</svg>`
            },
            {
                name: "Custom Wood Shelf Cutting",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="40" width="52" height="8" fill="#b45309"/>
  <path d="M32 20l16 16-4 4-16-16z" fill="#64748b"/>
</svg>`
            }
        ],
        "Drill & Wall Hang": [
            {
                name: "TV Wall Mounting",
                price: 199,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="22" width="52" height="32" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
  <rect x="18" y="26" width="44" height="24" fill="#3b82f6"/>
  <line x1="40" y1="54" x2="40" y2="64" stroke="#64748b" stroke-width="3"/>
</svg>`
            },
            {
                name: "Curtain Rods & Mirror",
                price: 99,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <line x1="12" y1="18" x2="68" y2="18" stroke="#64748b" stroke-width="3"/>
  <rect x="24" y="26" width="32" height="40" rx="3" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Paintings & Photo Frames",
                price: 79,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="20" width="40" height="42" rx="2" fill="#ffffff" stroke="#d97706" stroke-width="2"/>
  <circle cx="34" cy="34" r="4" fill="#f59e0b"/>
  <path d="M24 54l10-12 8 8 10-14 8 18H24z" fill="#10b981"/>
</svg>`
            },
            {
                name: "Bathroom Accessories Fitting",
                price: 149,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <line x1="16" y1="28" x2="64" y2="28" stroke="#94a3b8" stroke-width="3"/>
  <rect x="22" y="34" width="36" height="22" rx="2" fill="#e2e8f0"/>
</svg>`
            }
        ],
        "Full Home 3D Design": [
            {
                name: "3D Living & Bed Interior",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M40 16L66 30v26L40 70 14 56V30l26-14z" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.5"/>
  <path d="M40 16v54M14 30l26 14 26-14" stroke="#7c3aed" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Modern Luxury Theme",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M40 12v16M28 28h24" stroke="#f59e0b" stroke-width="1.5"/>
  <circle cx="32" cy="38" r="4" fill="#f59e0b"/>
  <circle cx="48" cy="38" r="4" fill="#f59e0b"/>
  <circle cx="40" cy="46" r="5" fill="#fbbf24"/>
</svg>`
            },
            {
                name: "Space Planning & Blueprint",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="14" width="48" height="52" rx="2" fill="#1e3a8a" stroke="#3b82f6" stroke-width="1.5"/>
  <line x1="16" y1="36" x2="64" y2="36" stroke="#93c5fd" stroke-width="1"/>
  <line x1="38" y1="14" x2="38" y2="66" stroke="#93c5fd" stroke-width="1"/>
</svg>`
            }
        ],
        "Modular Kitchen": [
            {
                name: "L-Shaped Modular Kitchen",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="24" width="48" height="14" fill="#db2777"/>
  <rect x="16" y="38" width="16" height="28" fill="#be185d"/>
</svg>`
            },
            {
                name: "U-Shaped Modular Kitchen",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="24" width="48" height="12" fill="#db2777"/>
  <rect x="16" y="36" width="14" height="30" fill="#be185d"/>
  <rect x="50" y="36" width="14" height="30" fill="#be185d"/>
</svg>`
            },
            {
                name: "Parallel Kitchen Renovation",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="20" width="16" height="46" fill="#db2777"/>
  <rect x="50" y="20" width="16" height="46" fill="#be185d"/>
</svg>`
            }
        ],
        "Wardrobes & Storage": [
            {
                name: "Sliding Wardrobes",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="14" width="48" height="54" rx="2" fill="#4f46e5" stroke="#3730a3" stroke-width="1.5"/>
  <line x1="40" y1="14" x2="40" y2="68" stroke="#ffffff" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Walk-in Closet Design",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="14" width="20" height="54" fill="#4338ca"/>
  <rect x="46" y="14" width="20" height="54" fill="#4338ca"/>
  <line x1="34" y1="24" x2="46" y2="24" stroke="#818cf8" stroke-width="2"/>
</svg>`
            },
            {
                name: "TV Entertainment Unit",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="20" width="52" height="32" fill="#c7d2fe"/>
  <rect x="14" y="54" width="52" height="12" fill="#3730a3"/>
</svg>`
            }
        ],
        "Space Optimization": [
            {
                name: "Study & WFH Setup",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="36" width="48" height="6" fill="#8b5cf6"/>
  <rect x="30" y="20" width="20" height="14" fill="#334155"/>
  <path d="M22 42v24M58 42v24" stroke="#8b5cf6" stroke-width="2.5"/>
</svg>`
            },
            {
                name: "Balcony Deck & Garden",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="44" width="52" height="22" fill="#059669"/>
  <circle cx="28" cy="34" r="6" fill="#10b981"/>
  <circle cx="52" cy="34" r="6" fill="#10b981"/>
</svg>`
            },
            {
                name: "False Ceiling & Lighting",
                price: 0,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="12" y="14" width="56" height="18" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <circle cx="24" cy="23" r="3" fill="#f59e0b"/>
  <circle cx="40" cy="23" r="3" fill="#f59e0b"/>
  <circle cx="56" cy="23" r="3" fill="#f59e0b"/>
</svg>`
            }
        ],
        "AC Gas Refill & Service": [
            {
                name: "Split AC Foam Jet Service",
                price: 499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="14" y="24" width="52" height="22" rx="3" fill="#ffffff" stroke="#0d9488" stroke-width="1.5"/>
  <line x1="18" y1="38" x2="62" y2="38" stroke="#0d9488" stroke-width="1.5"/>
  <path d="M30 48l4 10M40 48l4 10M50 48l4 10" stroke="#14b8a6" stroke-width="2"/>
</svg>`
            },
            {
                name: "AC Gas Leakage Fix & Refill",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="28" y="20" width="24" height="42" rx="6" fill="#0f766e" stroke="#115e59" stroke-width="1.5"/>
  <circle cx="40" cy="32" r="5" fill="#ffffff"/>
  <path d="M38 14h4v6h-4z" fill="#cbd5e1"/>
</svg>`
            },
            {
                name: "AC Installation",
                price: 699,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="20" width="48" height="34" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
  <circle cx="40" cy="37" r="10" fill="#94a3b8"/>
</svg>`
            },
            {
                name: "PCB / Compressor Repair",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="20" width="40" height="42" rx="2" fill="#134e4a" stroke="#2dd4bf" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="4" fill="#facc15"/>
  <rect x="40" y="40" width="12" height="12" fill="#5eead4"/>
</svg>`
            }
        ],
        "Washing Machine Repair": [
            {
                name: "Front Load Washing Machine",
                price: 349,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="16" width="44" height="52" rx="4" fill="#ffffff" stroke="#2563eb" stroke-width="1.5"/>
  <circle cx="40" cy="44" r="14" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <circle cx="40" cy="44" r="8" fill="#93c5fd"/>
  <circle cx="28" cy="24" r="2.5" fill="#3b82f6"/>
</svg>`
            },
            {
                name: "Top Load Washing Machine",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="18" width="40" height="50" rx="3" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.5"/>
  <rect x="26" y="24" width="28" height="12" rx="2" fill="#bfdbfe"/>
</svg>`
            },
            {
                name: "Drum & Spin Noise Issue",
                price: 249,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <circle cx="40" cy="40" r="20" fill="#eff6ff" stroke="#1e40af" stroke-width="2"/>
  <circle cx="40" cy="40" r="10" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 4"/>
</svg>`
            }
        ],
        "Refrigerator Servicing": [
            {
                name: "Single Door Refrigerator",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="24" y="12" width="32" height="58" rx="4" fill="#ffffff" stroke="#10b981" stroke-width="1.5"/>
  <line x1="24" y1="32" x2="56" y2="32" stroke="#10b981" stroke-width="1"/>
  <rect x="28" y="22" width="3" height="10" rx="1" fill="#059669"/>
</svg>`
            },
            {
                name: "Double Door / Frost Free",
                price: 399,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="22" y="10" width="36" height="60" rx="4" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
  <line x1="22" y1="28" x2="58" y2="28" stroke="#059669" stroke-width="1.5"/>
  <rect x="26" y="16" width="3" height="8" rx="1" fill="#047857"/>
  <rect x="26" y="34" width="3" height="14" rx="1" fill="#047857"/>
</svg>`
            },
            {
                name: "Cooling Coil & Gas Charging",
                price: 999,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="18" width="40" height="46" rx="2" fill="#ecfdf5" stroke="#047857" stroke-width="1.2"/>
  <path d="M26 26h28M26 34h28M26 42h28M26 50h28" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
</svg>`
            }
        ],
        "Geyser Repair": [
            {
                name: "Instant Water Geyser",
                price: 249,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="28" y="18" width="24" height="42" rx="4" fill="#ffffff" stroke="#ea580c" stroke-width="1.5"/>
  <circle cx="40" cy="32" r="4" fill="#ea580c"/>
  <path d="M36 48v8M44 48v8" stroke="#ea580c" stroke-width="2"/>
</svg>`
            },
            {
                name: "Storage Geyser Element",
                price: 349,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="24" y="14" width="32" height="48" rx="8" fill="#ffffff" stroke="#c2410c" stroke-width="1.5"/>
  <path d="M34 32v12M46 32v12" stroke="#f97316" stroke-width="2"/>
</svg>`
            },
            {
                name: "Thermostat & Leakage",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <circle cx="40" cy="38" r="16" fill="#ffffff" stroke="#9a3412" stroke-width="2"/>
  <path d="M40 38l6-6" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round"/>
</svg>`
            }
        ],
        "Cockroach & Ant Control": [
            {
                name: "Kitchen & Drain Gel",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M20 54l24-24 6 6-24 24z" fill="#e11d48"/>
  <circle cx="56" cy="22" r="3" fill="#fb7185"/>
  <circle cx="64" cy="28" r="2.5" fill="#fb7185"/>
</svg>`
            },
            {
                name: "Full Home Herbal Spray",
                price: 499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="26" y="24" width="28" height="40" rx="4" fill="#be123c"/>
  <path d="M40 24v-8h10" stroke="#be123c" stroke-width="2"/>
</svg>`
            },
            {
                name: "1-Year Warranty Protection",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M40 12l22 8v22c0 14-22 24-22 24S18 56 18 42V20l22-8z" fill="#9f1239"/>
  <circle cx="40" cy="36" r="6" fill="#facc15"/>
</svg>`
            }
        ],
        "Termite Treatment": [
            {
                name: "Drill-Fill-Seal Protection",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="26" width="34" height="20" fill="#b45309"/>
  <path d="M52 36h14" stroke="#78350f" stroke-width="3"/>
</svg>`
            },
            {
                name: "Wooden Wardrobe Shield",
                price: 599,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="14" width="40" height="54" rx="2" fill="#92400e"/>
  <line x1="40" y1="14" x2="40" y2="68" stroke="#ffffff" stroke-width="1.5"/>
</svg>`
            },
            {
                name: "Pre-Construction Barrier",
                price: 1499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <path d="M12 48h56v16H12z" fill="#78350f"/>
  <path d="M20 48L40 28l20 20" stroke="#b45309" stroke-width="2"/>
</svg>`
            }
        ],
        "Bed Bug Treatment": [
            {
                name: "Single Room Bed Bug Eradication",
                price: 499,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="16" y="32" width="48" height="28" rx="3" fill="#7c3aed"/>
  <path d="M22 24v8M58 24v8" stroke="#a78bfa" stroke-width="2"/>
</svg>`
            },
            {
                name: "Full Home 2-Visit Treatment",
                price: 899,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="18" y="14" width="44" height="52" rx="3" fill="#ffffff" stroke="#6d28d9" stroke-width="1.5"/>
  <rect x="26" y="24" width="10" height="10" fill="#7c3aed"/>
  <rect x="44" y="24" width="10" height="10" fill="#a78bfa"/>
</svg>`
            }
        ],
        "Full Home Disinfection": [
            {
                name: "Hospital-Grade Cold Fogging",
                price: 399,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <rect x="20" y="30" width="34" height="28" rx="4" fill="#059669"/>
  <path d="M54 38c8-4 12 0 16-2" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>
</svg>`
            },
            {
                name: "High-Touch Surface Sanitization",
                price: 299,
                svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="40" cy="67" rx="26" ry="3.5" fill="#0f172a" fill-opacity="0.1"/>
  <circle cx="36" cy="36" r="14" fill="#10b981"/>
  <path d="M44 44l16 16" stroke="#047857" stroke-width="3" stroke-linecap="round"/>
</svg>`
            }
        ]
    };

window.closeSubServicesModal = function closeSubServicesModal() {
        const modal = document.getElementById("subservicesModalBackdrop");
        if (modal) {
            modal.classList.remove("active");
            modal.style.setProperty("display", "none", "important");
            modal.style.display = "none";
        }
    };

    // Close modal on Escape key or any click on close button (Capture phase ensures it always fires)
    if (!window._subserviceEventsBound) {
        window._subserviceEventsBound = true;
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") window.closeSubServicesModal();
        });
        document.addEventListener("click", (e) => {
            if (e.target && (e.target.closest(".subservice-modal-close") || e.target.id === "subserviceModalCloseBtn")) {
                e.preventDefault();
                e.stopPropagation();
                window.closeSubServicesModal();
            }
        }, true); // Capture phase!
    }

    let _currentParentCategory = "Home Cleaning";

    window.selectNoBrokerCategory = function selectNoBrokerCategory(category, price) {
        _currentParentCategory = category || "Home Cleaning";
        const subList = categorySubServices[category];
        if (!subList || !subList.length) {
            const match = serviceOptions.find(([, , itemCategory]) => itemCategory === category) || serviceOptions.find(([name]) => name === category) || [category, price || 49];
            window.selectNoBrokerService(`${match[0]}|${price ?? match[1]}`);
            return;
        }

        let modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "subservicesModalBackdrop";
            modal.className = "subservice-modal-backdrop";
            modal.onclick = (e) => {
                if (e.target === modal) window.closeSubServicesModal();
            };
            modal.innerHTML = `
                <div class="subservice-modal-box" id="subserviceModalBox" onclick="event.stopPropagation()">
                    <button type="button" class="subservice-modal-close" id="subserviceModalCloseBtn" aria-label="Close" onclick="event.preventDefault(); event.stopPropagation(); window.closeSubServicesModal();">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div id="subserviceModalHeaderArea">
                        <h4 class="subservice-modal-title" id="subserviceModalTitle">Home Cleaning</h4>
                    </div>
                    <div class="subservice-grid" id="subserviceGrid"></div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            const closeBtn = modal.querySelector(".subservice-modal-close");
            if (closeBtn) {
                closeBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.closeSubServicesModal();
                };
            }
            modal.onclick = (e) => {
                if (e.target === modal) window.closeSubServicesModal();
            };
        }

        // Reset box width for category view
        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.classList.remove("wide");
            boxEl.classList.remove("package-mode");
            boxEl.style.maxWidth = "";
        }

        const headerArea = document.getElementById("subserviceModalHeaderArea");
        if (headerArea) {
            headerArea.innerHTML = `<h4 class="subservice-modal-title" id="subserviceModalTitle">${category}</h4>`;
        }

        const gridEl = document.getElementById("subserviceGrid");
        if (gridEl) {
            gridEl.className = "subservice-grid";
            gridEl.style.gridTemplateColumns = "";
            gridEl.innerHTML = subList.map(item => `
                <div class="subservice-item" onclick="window.chooseSubService('${item.name}', ${item.price}, '${category}')">
                    <div class="subservice-circle-wrapper">
                        ${item.badge ? `<span class="subservice-badge">${item.badge}</span>` : ""}
                        <div class="subservice-circle" style="background: ${item.bg || '#f8fafc'}; color: ${item.color || '#3b82f6'}; border: 1.5px solid ${item.bg ? item.color + '33' : '#e2e8f0'};">
                            <i class="${item.icon}"></i>
                        </div>
                    </div>
                    <span class="subservice-label">${item.name}</span>
                    <span class="subservice-price">${item.price === 0 ? 'Free Consult' : 'Starts ₹' + item.price}</span>
                </div>
            `).join("");
        }

        modal.classList.add("active");
        modal.style.setProperty("display", "flex", "important");
        modal.style.display = "flex";
    };

    const designationPackages = {
        "Occupied Kitchen Cleaning": [
            {
                name: "Essential ★",
                rating: "4.74",
                reviews: "5.6K+",
                duration: "3 hrs",
                price: 1459,
                optionsCount: "2 options",
                features: [
                    "Degreasing of kitchen tiles, floor & slab, gas stove / hob",
                    "Sink & under-the-sink, exhaust & fan dusting",
                    "Kitchen floors, windows & switchboard fixtures cleaning",
                    "Utensil removal / rearrangement not included",
                    "Cabinet cleaning - exterior only"
                ],
                detailedBreakdown: {
                    priceLabel: "₹1,459 (All-Inclusive)",
                    guarantee: "30 Days Service Support • Eco-Friendly Degreasers",
                    sections: [
                        {
                            title: "🍳 Slabs, Stove & Backsplash",
                            items: [
                                "Deep degreasing of kitchen tiles, floor & slab",
                                "Gas stove / hob burn mark & oil residue scrubbing",
                                "Stainless steel sink descaling & drain trap clearing"
                            ]
                        },
                        {
                            title: "🪟 Windows, Fans & Fixtures",
                            items: [
                                "Exhaust fan & ceiling fan oil removal & dusting",
                                "Kitchen windows, sliding tracks & switchboard wipe down",
                                "Under-the-sink area intensive scrubbing & disinfection"
                            ]
                        },
                        {
                            title: "🚪 Cabinets & Scope Limits",
                            items: [
                                "Cabinet cleaning - exterior surface wiping & degreasing only",
                                "Utensil removal / rearrangement not included in Essential plan",
                                "Machine floor scrubbing with active degreasing chemical"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Power Steam",
                rating: "4.77",
                reviews: "6.4K+",
                duration: "3 hrs",
                price: 1959,
                optionsCount: "2 options",
                features: [
                    "High-pressure steam degreasing of kitchen tiles, slabs & gas stove / hob",
                    "Sink & under the sink, exhaust & fan dusting",
                    "Kitchen floors, windows & switchboard fixtures cleaning",
                    "Utensil removal / rearrangement included",
                    "Cabinet cleaning - exterior & interior"
                ],
                detailedBreakdown: {
                    priceLabel: "₹1,959 (All-Inclusive)",
                    guarantee: "30 Days Service Support • High-Pressure Steam Disinfection",
                    sections: [
                        {
                            title: "💨 High-Pressure Steam Degreasing",
                            items: [
                                "140°C pressurized steam degreasing of tiles, slabs & gas stove/hob",
                                "Deep removal of stubborn oil grime from chimney filters & corners",
                                "Sink & under the sink high-temperature sanitization"
                            ]
                        },
                        {
                            title: "🚪 Full Cabinet Interior & Exterior",
                            items: [
                                "Utensils safely removed and neatly rearranged after cleaning",
                                "Interior shelf sanitization & exterior cabinet degreasing",
                                "Hinges, drawer channels & handle detailed steam wipe"
                            ]
                        },
                        {
                            title: "✨ Floors & Fixtures",
                            items: [
                                "Kitchen floor mechanical scrubbing with hot steam treatment",
                                "Exhaust fan, ceiling fan, windows & switchboards cleaned"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Eco-Smart 🌱",
                rating: "4.72",
                reviews: "2K+",
                duration: "2 hrs 30 mins",
                price: 2009,
                optionsCount: "2 options",
                badge: "ECO-SAFE",
                thumbnail: "/smartapartment/img/kitchen-cleaner-eco.jpg",
                features: [
                    "Odourless eco-smart deep cleaning",
                    "High-pressure steam + active foam degreases tiles, slabs & gas stove/hob without fumes",
                    "Includes all of Power Steam cleaning (sink, cabinets, utensils, exhaust & more)"
                ],
                detailedBreakdown: {
                    priceLabel: "₹2,009 (All-Inclusive)",
                    guarantee: "100% Eco-Safe • Zero Toxic Fumes • Kid & Pet Friendly",
                    sections: [
                        {
                            title: "🌱 Odourless Eco-Smart Technology",
                            items: [
                                "100% plant-based, non-toxic & fume-free active degreasing foam",
                                "Safe for food preparation zones, children & pets",
                                "Zero harsh chemical odor or residue"
                            ]
                        },
                        {
                            title: "💨 Steam + Active Foam Action",
                            items: [
                                "High-pressure steam + active foam degreases tiles, slabs & gas stove/hob without fumes",
                                "Includes all of Power Steam cleaning (sink, cabinets, utensils, exhaust & more)",
                                "Complete utensil removal, interior shelf wipe & safe replacement"
                            ]
                        },
                        {
                            title: "🛡️ Disinfection & Protection",
                            items: [
                                "Food-contact safe antimicrobial mist spray",
                                "Drain trap & sink organic enzymes anti-clog treatment",
                                "Stainless steel & granite polishing"
                            ]
                        }
                    ]
                }
            }
        ],
        "Empty Kitchen Cleaning": [
            {
                name: "Essential ★",
                rating: "4.75",
                reviews: "4K+",
                duration: "2 hrs 30 mins",
                price: 849,
                optionsCount: "2 options",
                features: [
                    "Degreasing of kitchen tiles, slabs & gas stove / hob",
                    "Sink & under-the-sink, exhaust & fan dusting",
                    "Kitchen floors, windows & switchboard fixtures cleaning",
                    "Utensil removal / rearrangement not included",
                    "Cabinet cleaning - exterior only"
                ],
                detailedBreakdown: {
                    priceLabel: "₹849 (All-Inclusive)",
                    guarantee: "30 Days Service Support • Eco Degreasing",
                    sections: [
                        {
                            title: "🍳 Tiles, Slabs & Gas Stove",
                            items: [
                                "Degreasing of kitchen tiles, slabs & gas stove / hob",
                                "Sink & under-the-sink, exhaust & fan dusting",
                                "Countertop and wall backsplash oil residue scrubbing"
                            ]
                        },
                        {
                            title: "🪟 Windows, Floors & Fixtures",
                            items: [
                                "Kitchen floors, windows & switchboard fixtures cleaning",
                                "Cabinet cleaning - exterior surface wiping only",
                                "Exhaust fan deep cleaning"
                            ]
                        },
                        {
                            title: "⚠️ Scope Limits",
                            items: [
                                "Utensil removal / rearrangement not included in Essential plan",
                                "Cabinet interior cleaning not included"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Power Steam",
                rating: "4.74",
                reviews: "3.3K+",
                duration: "2 hrs 30 mins",
                price: 949,
                optionsCount: "2 options",
                features: [
                    "High-pressure steam degreasing of kitchen tiles, slabs & gas stove / hob",
                    "Sink & under-the-sink, exhaust & fan dusting",
                    "Kitchen floors, windows & switchboard fixtures cleaning",
                    "Utensil removal / rearrangement not included",
                    "Cabinet cleaning - exterior only"
                ],
                detailedBreakdown: {
                    priceLabel: "₹949 (All-Inclusive)",
                    guarantee: "30 Days Service Support • 140°C High-Pressure Steam",
                    sections: [
                        {
                            title: "💨 High-Pressure Steam Degreasing",
                            items: [
                                "High-pressure steam degreasing of kitchen tiles, slabs & gas stove / hob",
                                "Thermal dissolution of hardened grease on tiles, slabs and stove burners",
                                "Sanitization of sink & drain traps with high heat"
                            ]
                        },
                        {
                            title: "🪟 Dusting & Fixtures Cleaning",
                            items: [
                                "Sink & under-the-sink, exhaust & fan dusting",
                                "Kitchen floors, windows & switchboard fixtures cleaning",
                                "Cabinet cleaning - exterior only"
                            ]
                        },
                        {
                            title: "⚠️ Scope Limits",
                            items: [
                                "Utensil removal / rearrangement not included",
                                "Cabinet interior cleaning not included"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Fridge Cleaning",
                rating: "4.75",
                reviews: "22K+",
                duration: "30 mins",
                price: 379,
                pricePrefix: "Starts at",
                optionsCount: "2 options",
                thumbnail: "/smartapartment/img/fridge-cleaning-thumb.jpg",
                features: [
                    "Removing and placing back all food items",
                    "Interior trays & shelf deep sanitization",
                    "Exterior door, gasket & handle degreasing"
                ],
                detailedBreakdown: {
                    priceLabel: "Starts at ₹379 (Single Door / Double Door)",
                    guarantee: "Food-Safe Sanitization • Anti-Bacterial Odour Removal",
                    sections: [
                        {
                            title: "🧊 Food Removal & Interior Deep Clean",
                            items: [
                                "Removing and placing back all food items safely",
                                "Removable trays, vegetable crispers & door racks scrubbed and dried",
                                "Anti-bacterial wipe down to eradicate odor-causing bacteria"
                            ]
                        },
                        {
                            title: "🚪 Exterior, Handle & Gaskets",
                            items: [
                                "Door rubber gasket descaling and mold prevention wipe",
                                "Exterior surface, handle & top degreasing"
                            ]
                        }
                    ]
                }
            }
        ],
        "Empty Kitchen": null, // Assigned right after designationPackages declaration
        "Furnished Apartment": [
            {
                name: "Essential ★",
                rating: "4.7",
                reviews: "38.2K+",
                duration: "4 hrs",
                price: 3069,
                optionsCount: "5 options",
                features: [
                    "Bathroom & kitchen deep cleaning",
                    "Machine floor cleaning",
                    "Cobweb & fan dusting",
                    "Balcony & utility area cleaning",
                    "Furniture dusting"
                ],
                detailedBreakdown: {
                    priceLabel: "₹3,069 (All-Inclusive)",
                    guarantee: "30 Days Service Support • Eco-Friendly Chemicals",
                    sections: [
                        {
                            title: "🛋️ Living & Bedrooms Deep Clean",
                            items: [
                                "Single-disc machine floor scrubbing & dry buffing",
                                "Ceiling fans, switchboards & lighting fixtures dusted & wiped",
                                "Dry vacuuming and dusting of sofa, mattresses, beds & tables",
                                "Cobweb removal & wall dusting up to ceiling"
                            ]
                        },
                        {
                            title: "🍳 Kitchen Deep Clean",
                            items: [
                                "Countertops, sink & backsplash tiles degreased & scrubbed",
                                "Gas stove & chimney exterior degreasing",
                                "Floor mechanical scrubbing & oil stain removal"
                            ]
                        },
                        {
                            title: "🚿 Bathroom Scrubbing",
                            items: [
                                "Wall tiles scrubbing & hard water stain descaling",
                                "WC, washbasin, taps & shower head descaling",
                                "Floor disinfection, drain trap clearing & mirror buffing"
                            ]
                        },
                        {
                            title: "🌿 Balcony & Utility",
                            items: [
                                "Railing wiping & floor scrubbing",
                                "Utility area washing & cobweb clearing"
                            ]
                        },
                        {
                            title: "🧪 Equipment & Inclusions",
                            items: [
                                "Diversey Taski eco-certified cleaning agents",
                                "Single-disc rotary floor scrubber & high-suction vacuum"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Premium 💎",
                rating: "4.7",
                reviews: "21.6K+",
                duration: "4 hrs",
                price: 3379,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Essential Plan",
                    "Cupboard cleaning (interior + exterior, if empty)",
                    "Cabinets interior with utensil removal"
                ],
                detailedBreakdown: {
                    priceLabel: "₹3,379 (All-Inclusive)",
                    guarantee: "30 Days Service Support • Verified Pro Team",
                    sections: [
                        {
                            title: "✨ Everything in Essential Plan Included",
                            items: [
                                "All machine floor scrubbing, bathroom descaling & balcony washing"
                            ]
                        },
                        {
                            title: "🚪 Cupboard & Wardrobe Interiors",
                            items: [
                                "Interior vacuuming, wiping & sanitization (if empty)",
                                "Exterior polish of cupboard doors, mirrors & metal handles",
                                "Drawer channels & shelf edges detailed cleaning"
                            ]
                        },
                        {
                            title: "🍳 Modular Kitchen Interiors",
                            items: [
                                "Utensils safely removed, interior cabinet shelves degreased & wiped",
                                "Chimney mesh filter degreasing & exterior hood wiping",
                                "Microwave, refrigerator exterior & appliance sanitization"
                            ]
                        },
                        {
                            title: "🪟 Windows & Glass Panes",
                            items: [
                                "Streak-free glass pane cleaning with anti-static solution",
                                "Window sill & sliding track vacuuming & wiping"
                            ]
                        },
                        {
                            title: "🧪 Heavy-Duty Equipment & Steam",
                            items: [
                                "Single-disc floor buffer, industrial vacuum & steam descaler",
                                "Diversey Taski R1-R9 professional chemical kit"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Elite 👑",
                rating: "4.69",
                reviews: "12.8K+",
                duration: "4 hrs 30 mins",
                price: 4119,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Premium plan",
                    "Sofa, carpet & mattress shampooing"
                ],
                detailedBreakdown: {
                    priceLabel: "₹4,119 (All-Inclusive)",
                    guarantee: "30 Days Service Support • Complete Shampoo & Sanitization",
                    sections: [
                        {
                            title: "💎 Everything in Premium & Essential Included",
                            items: [
                                "Full machine floor buffing, bathroom descaling & cupboard interiors",
                                "Kitchen cabinet interior degreasing & appliance wipe down"
                            ]
                        },
                        {
                            title: "🛋️ Sofa & Fabric Shampooing",
                            items: [
                                "Deep foam shampooing for 5-seater fabric/leather sofa",
                                "Injection-extraction vacuuming for deep stain, spill & dust extraction",
                                "Crevice vacuuming & fabric conditioning"
                            ]
                        },
                        {
                            title: "🛏️ Mattress & Carpet Treatment",
                            items: [
                                "Master bedroom mattress anti-allergen & dust-mite extraction",
                                "Living room rug/carpet deep vacuuming & foam wash"
                            ]
                        },
                        {
                            title: "🛡️ Full Home Antimicrobial Mist Sanitization",
                            items: [
                                "Hospital-grade antimicrobial mist spray across all rooms",
                                "Odor elimination & high-touch surface disinfection"
                            ]
                        },
                        {
                            title: "🧪 Advanced Equipment Suite",
                            items: [
                                "Injection-extraction upholstery shampooing machine",
                                "Rotary single-disc buffer & high-pressure steam generator"
                            ]
                        }
                    ]
                }
            }
        ],
        "Unfurnished Apartment": [
            {
                name: "Essential ★",
                rating: "4.7",
                reviews: "14.2K+",
                duration: "3 hrs 30 mins",
                price: 2399,
                optionsCount: "5 options",
                features: [
                    "Full floor scrubbing & machine cleaning",
                    "Complete bathroom & kitchen descaling",
                    "Balcony, utility & window dusting"
                ],
                detailedBreakdown: {
                    priceLabel: "₹2,399 (All-Inclusive)",
                    guarantee: "Move-in Ready • 30 Days Quality Support",
                    sections: [
                        {
                            title: "🏢 Mechanical Floor Scrubbing",
                            items: [
                                "Complete single-disc mechanical floor scrubbing across all rooms",
                                "Baseboard & skirting board stain removal"
                            ]
                        },
                        {
                            title: "🚿 Bathroom & Kitchen Descaling",
                            items: [
                                "Intensive tile scrubbing & hard water removal",
                                "Sink, basin, toilet pot descaling & floor disinfection"
                            ]
                        },
                        {
                            title: "🌿 Balcony & Windows",
                            items: [
                                "Balcony floor wash, railing dusting & window glass wipe"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Premium 💎",
                rating: "4.72",
                reviews: "8.4K+",
                duration: "4 hrs",
                price: 2799,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Essential Plan",
                    "Wall spot cleaning & switchboard wipe",
                    "Doors, grills & exhaust fan degreasing"
                ],
                detailedBreakdown: {
                    priceLabel: "₹2,799 (All-Inclusive)",
                    guarantee: "Move-in Ready • Deep Degreasing",
                    sections: [
                        {
                            title: "✨ Everything in Essential Plan Included",
                            items: [
                                "Complete floor mechanical scrubbing & bathroom descaling"
                            ]
                        },
                        {
                            title: "🚪 Walls, Doors & Grills",
                            items: [
                                "Wall spot cleaning & switchboard damp wiping",
                                "Doors, doorframes & balcony grills deep wipe",
                                "Exhaust fan & ventilator degreasing"
                            ]
                        },
                        {
                            title: "🪟 Windows & Channels",
                            items: [
                                "Window tracks, mesh & sliding glass pane descaling"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Elite 👑",
                rating: "4.75",
                reviews: "5.1K+",
                duration: "4 hrs 30 mins",
                price: 3499,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Premium plan",
                    "Full house sanitization & pesticide spray",
                    "Glass facade & window mesh wash"
                ],
                detailedBreakdown: {
                    priceLabel: "₹3,499 (All-Inclusive)",
                    guarantee: "Move-in Ready • Full Sanitization",
                    sections: [
                        {
                            title: "💎 Everything in Premium Plan Included",
                            items: [
                                "All floor scrubbing, wall spots, doors & window tracks"
                            ]
                        },
                        {
                            title: "🛡️ Full House Sanitization & Pest Barrier",
                            items: [
                                "Antimicrobial mist spray across all rooms",
                                "Pesticide barrier spray for cockroaches & ants"
                            ]
                        },
                        {
                            title: "🪟 Glass Facade & Window Mesh Wash",
                            items: [
                                "External window mesh wash & sliding glass buffing",
                                "Drain & trap high-temperature steam sanitization"
                            ]
                        }
                    ]
                }
            }
        ],
        "Furnished Villa": [
            {
                name: "Essential ★",
                rating: "4.8",
                reviews: "9.1K+",
                duration: "5 hrs",
                price: 4999,
                optionsCount: "5 options",
                features: [
                    "Multi-floor deep floor scrubbing",
                    "Kitchen & bathrooms intensive cleaning",
                    "Balconies, terrace & utility washing"
                ],
                detailedBreakdown: {
                    priceLabel: "₹4,999 (All-Inclusive)",
                    guarantee: "Multi-Floor Villa Deep Clean • 30 Days Support",
                    sections: [
                        {
                            title: "🏰 Multi-Floor Scrubbing",
                            items: [
                                "Multi-floor single-disc rotary buffer scrubbing across all floors",
                                "Staircase dusting, banister wiping & cobweb removal"
                            ]
                        },
                        {
                            title: "🚿 Multiple Bathrooms & Kitchen",
                            items: [
                                "All bathrooms intensive tile scrubbing & descaling",
                                "Main kitchen & pantry counters, sink & tiles scrubbing"
                            ]
                        },
                        {
                            title: "🌿 Balconies & Terrace",
                            items: [
                                "Terrace, balconies & utility areas mechanical wash"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Premium 💎",
                rating: "4.82",
                reviews: "6.3K+",
                duration: "6 hrs",
                price: 5799,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Essential Plan",
                    "Cupboard & wardrobe interior sanitization",
                    "Kitchen cabinet interior degreasing"
                ],
                detailedBreakdown: {
                    priceLabel: "₹5,799 (All-Inclusive)",
                    guarantee: "Multi-Floor Villa • Full Interior Scope",
                    sections: [
                        {
                            title: "✨ Everything in Essential Plan Included",
                            items: [
                                "All multi-floor rotary buffer scrubbing, bathrooms & terrace wash"
                            ]
                        },
                        {
                            title: "🚪 Cupboard & Wardrobe Interiors",
                            items: [
                                "All bedroom wardrobes & cupboard interior sanitization (if empty)",
                                "Exterior woodwork & mirror polishing"
                            ]
                        },
                        {
                            title: "🍳 Kitchen & Pantry Cabinets",
                            items: [
                                "Kitchen cabinet interior degreasing & shelf wipe",
                                "Refrigerator & oven exterior sanitization"
                            ]
                        },
                        {
                            title: "🪟 Windows & High Ceilings",
                            items: [
                                "High window panes, sliding glass & track vacuuming"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Elite 👑",
                rating: "4.85",
                reviews: "4.2K+",
                duration: "7 hrs",
                price: 6999,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Premium plan",
                    "Complete sofa, carpet & upholstery shampooing",
                    "Outdoor patio pressure wash"
                ],
                detailedBreakdown: {
                    priceLabel: "₹6,999 (All-Inclusive)",
                    guarantee: "Multi-Floor Villa • Complete Upholstery & Sanitization",
                    sections: [
                        {
                            title: "💎 Everything in Premium Plan Included",
                            items: [
                                "Complete multi-floor scrubbing, cabinet interiors & high windows"
                            ]
                        },
                        {
                            title: "🛋️ Upholstery & Carpet Shampooing",
                            items: [
                                "7-seater sofa + dining chairs upholstery shampooing",
                                "Living room & lounge carpet deep foam extraction",
                                "Master bedroom mattress anti-dust-mite treatment"
                            ]
                        },
                        {
                            title: "🌿 Outdoor Patio & Pressure Wash",
                            items: [
                                "High-pressure water jet wash for patio, porch & driveway"
                            ]
                        },
                        {
                            title: "🛡️ Whole Villa Antimicrobial Mist",
                            items: [
                                "Hospital-grade antimicrobial mist across all floors & rooms"
                            ]
                        }
                    ]
                }
            }
        ],
        "Unfurnished Villa": [
            {
                name: "Essential ★",
                rating: "4.75",
                reviews: "5.2K+",
                duration: "4 hrs 30 mins",
                price: 3999,
                optionsCount: "5 options",
                features: [
                    "Complete multi-floor mechanical floor scrubbing",
                    "Kitchen, pantry & all bathroom descaling",
                    "Terrace, porch & boundary wall dusting"
                ],
                detailedBreakdown: {
                    priceLabel: "₹3,999 (All-Inclusive)",
                    guarantee: "Villa Move-in Clean • 30 Days Support",
                    sections: [
                        {
                            title: "🏰 Multi-Floor Floor Scrubbing",
                            items: [
                                "Complete mechanical floor scrubbing across all rooms & staircases",
                                "Pantry & kitchen heavy scrubbing"
                            ]
                        },
                        {
                            title: "🚿 All Bathrooms Descaling",
                            items: [
                                "Complete tile scrubbing, WC, basin & shower descaling"
                            ]
                        },
                        {
                            title: "🌿 Terrace & Porch",
                            items: [
                                "Terrace, porch & boundary wall dusting & dry clearing"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Premium 💎",
                rating: "4.78",
                reviews: "3.8K+",
                duration: "5 hrs 30 mins",
                price: 4699,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Essential Plan",
                    "Glass panes, sliding doors & window channels",
                    "Switchboards, lighting fixtures & ceiling fans"
                ],
                detailedBreakdown: {
                    priceLabel: "₹4,699 (All-Inclusive)",
                    guarantee: "Villa Move-in Clean • Windows & Grills",
                    sections: [
                        {
                            title: "✨ Everything in Essential Plan Included",
                            items: [
                                "All multi-floor mechanical floor scrubbing & bathroom descaling"
                            ]
                        },
                        {
                            title: "🪟 Large Glass Panes & Sliding Doors",
                            items: [
                                "All large glass panes, sliding doors & window channels cleaned"
                            ]
                        },
                        {
                            title: "🚪 Doors, Switchboards & Fixtures",
                            items: [
                                "Switchboards, lighting fixtures, ceiling fans & stair railings",
                                "Door frame & grill degreasing"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Elite 👑",
                rating: "4.82",
                reviews: "2.9K+",
                duration: "6 hrs 30 mins",
                price: 5699,
                optionsCount: "5 options",
                features: [
                    "Includes everything in Premium plan",
                    "Full villa disinfection & pest barrier spray",
                    "High-pressure wash for driveway & railings"
                ],
                detailedBreakdown: {
                    priceLabel: "₹5,699 (All-Inclusive)",
                    guarantee: "Villa Move-in Clean • High Pressure & Disinfection",
                    sections: [
                        {
                            title: "💎 Everything in Premium Plan Included",
                            items: [
                                "All floor scrubbing, large windows, fixtures & door frames"
                            ]
                        },
                        {
                            title: "🛡️ Full Villa Disinfection & Pest Barrier",
                            items: [
                                "Full villa disinfection spray & pest barrier treatment"
                            ]
                        },
                        {
                            title: "🚗 Driveway & Porch High-Pressure Wash",
                            items: [
                                "High-pressure water jet washing for driveway, porch & railings",
                                "Drain & trap high-temperature steam sanitization"
                            ]
                        }
                    ]
                }
            }
        ]
    };
    designationPackages["Empty Kitchen"] = designationPackages["Empty Kitchen Cleaning"];
    designationPackages["Occupied Kitchen"] = designationPackages["Occupied Kitchen Cleaning"];

    let _currentSelectedPackage = null;

    window.showSubServiceDesignations = function showSubServiceDesignations(subServiceName, parentCategory) {
        const designations = subServiceDesignations[subServiceName];
        if (!designations || !designations.length) return;

        const modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) return;

        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.classList.remove("package-mode");
            boxEl.classList.add("wide");
            if (designations.length === 3) {
                boxEl.style.maxWidth = "560px";
            } else {
                boxEl.style.maxWidth = "660px";
            }
        }

        const headerArea = document.getElementById("subserviceModalHeaderArea");
        if (headerArea) {
            headerArea.innerHTML = `
                <div class="subservice-modal-header">
                    <button type="button" class="subservice-modal-back" id="subserviceModalBackBtn" aria-label="Back" onclick="event.preventDefault(); event.stopPropagation(); window.selectNoBrokerCategory('${parentCategory || _currentParentCategory}');">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h4 class="subservice-modal-title" style="margin: 0;">${subServiceName}</h4>
                    <div style="width: 36px;"></div>
                </div>
            `;
        }

        const gridEl = document.getElementById("subserviceGrid");
        if (gridEl) {
            gridEl.className = "designation-grid";
            if (designations.length === 3) {
                gridEl.style.gridTemplateColumns = "repeat(3, 1fr)";
            } else {
                gridEl.style.gridTemplateColumns = "";
            }
            gridEl.innerHTML = designations.map(d => `
                <div class="designation-item" onclick="window.chooseDesignation('${subServiceName}', '${d.name}', ${d.price}, '${parentCategory || _currentParentCategory}')">
                    <div class="designation-illustration">
                        ${d.svg}
                    </div>
                    <span class="designation-label">${d.name}</span>
                    <span class="designation-price">${d.price === 0 ? 'Free Consult' : 'Starts ₹' + d.price}</span>
                </div>
            `).join("");
        }
    };

    window.showDesignationPackages = function showDesignationPackages(designationName, subServiceName, parentCategory) {
        const packages = designationPackages[designationName];
        if (!packages || !packages.length) return;

        const modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) return;

        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.className = "subservice-modal-box wide package-mode";
            boxEl.style.maxWidth = "820px";
        }

        const headerArea = document.getElementById("subserviceModalHeaderArea");
        let modalTitle = designationName;
        if (designationName === "Empty Kitchen" || designationName === "Empty Kitchen Cleaning") {
            modalTitle = "Empty Kitchen Cleaning";
        } else if (designationName === "Occupied Kitchen" || designationName === "Occupied Kitchen Cleaning") {
            modalTitle = "Occupied Kitchen Cleaning";
        } else if (!designationName.toLowerCase().includes(subServiceName.toLowerCase())) {
            modalTitle = `${subServiceName} - ${designationName}`;
        }

        if (headerArea) {
            headerArea.innerHTML = `
                <div class="subservice-modal-header" style="margin-bottom: 1rem !important;">
                    <button type="button" class="subservice-modal-back" id="subserviceModalBackBtn" aria-label="Back" onclick="event.preventDefault(); event.stopPropagation(); window.showSubServiceDesignations('${subServiceName}', '${parentCategory || _currentParentCategory}');">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h4 class="subservice-modal-title" style="margin: 0;">${modalTitle}</h4>
                    <div style="width: 36px;"></div>
                </div>
            `;
        }

        // Default selected package to first or second
        _currentSelectedPackage = packages[0];

        const gridEl = document.getElementById("subserviceGrid");
        if (gridEl) {
            gridEl.className = "";
            gridEl.style.gridTemplateColumns = "";
            gridEl.innerHTML = `
                <div class="package-view-container">
                    <div class="package-main-col">
                        <div class="package-banner">
                            <div class="package-banner-left">
                                <i class="fa-solid fa-tags package-banner-icon"></i>
                                <div>
                                    <h6 class="package-banner-title">FLAT ₹200 off For New Users</h6>
                                    <p class="package-banner-sub">Applicable on Essential, Premium & Elite packages</p>
                                </div>
                            </div>
                            <div class="package-banner-badge">CODE: NEWCLEAN200</div>
                        </div>

                        <div class="package-list">
                            ${packages.map((pkg, idx) => `
                                <div class="package-card" id="packageCard_${idx}">
                                    <div class="package-info-col">
                                        <h5 class="package-card-title">${escapeHtml(pkg.name)}</h5>
                                        <div class="package-meta">
                                            <span class="package-rating"><i class="fa-solid fa-star" style="color: #f59e0b; font-size: 0.8rem;"></i> ${pkg.rating} (${pkg.reviews})</span>
                                            <span>•</span>
                                            <span><i class="fa-regular fa-clock" style="font-size: 0.78rem;"></i> ${pkg.duration}</span>
                                        </div>
                                        <div class="package-price">${pkg.pricePrefix ? `<span style="font-size: 0.82rem; font-weight: 500; color: #64748b; margin-right: 4px;">${escapeHtml(pkg.pricePrefix)}</span>` : ""}₹${pkg.price.toLocaleString('en-IN')}</div>
                                        <ul class="package-features">
                                            ${pkg.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
                                        </ul>
                                        <a href="javascript:void(0)" class="package-details-link" id="packageDetailsLink_${idx}" onclick="window.togglePackageDetails(${idx})">View details <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i></a>

                                        <div class="package-expanded-details" id="packageDetails_${idx}" style="display: none;">
                                            <div class="package-details-title-row">
                                                <span class="package-details-title-text"><i class="fa-solid fa-clipboard-check" style="color: #059669;"></i> Scope & Details for ${escapeHtml(pkg.name)}</span>
                                                <span class="package-details-price-tag">${pkg.detailedBreakdown?.priceLabel || `₹${pkg.price.toLocaleString('en-IN')}`}</span>
                                            </div>
                                            <div class="package-details-sections">
                                                ${(pkg.detailedBreakdown?.sections || []).map(sec => `
                                                    <div class="package-detail-card">
                                                        <div class="package-detail-card-head">${escapeHtml(sec.title)}</div>
                                                        <ul class="package-detail-card-list">
                                                            ${sec.items.map(it => `<li>${escapeHtml(it)}</li>`).join("")}
                                                        </ul>
                                                    </div>
                                                `).join("")}
                                            </div>
                                            ${pkg.detailedBreakdown?.guarantee ? `
                                                <div class="package-detail-guarantee">
                                                    <i class="fa-solid fa-shield-check"></i> ${escapeHtml(pkg.detailedBreakdown.guarantee)}
                                                </div>
                                            ` : ""}
                                        </div>
                                    </div>
                                    <div class="package-action-col">
                                        ${pkg.thumbnail ? `
                                            <div class="package-thumb-card">
                                                ${pkg.badge ? `<span class="package-thumb-badge">${escapeHtml(pkg.badge)}</span>` : ""}
                                                <img src="${pkg.thumbnail}" alt="${escapeHtml(pkg.name)}" />
                                            </div>
                                        ` : ""}
                                        <button type="button" class="package-add-btn ${_currentSelectedPackage?.name === pkg.name ? 'added' : ''}" id="pkgAddBtn_${idx}" onclick="window.onPackageAddClick(${idx}, '${escapeHtml(designationName)}', '${escapeHtml(subServiceName)}')">
                                            ${_currentSelectedPackage?.name === pkg.name ? 'Added ✓' : 'Add'}
                                        </button>
                                        ${pkg.optionsCount ? `<span class="package-options-text">${escapeHtml(pkg.optionsCount)}</span>` : ""}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <div class="package-summary-col">
                        <div class="package-summary-card">
                            <span class="package-summary-header">Total Amount</span>
                            <div class="package-summary-title" id="summarySelectedPlanTitle">${modalTitle} - ${_currentSelectedPackage.name}</div>
                            <div class="package-summary-price" id="summarySelectedPrice">₹${_currentSelectedPackage.price.toLocaleString('en-IN')}</div>
                            <button type="button" class="package-proceed-btn" id="packageProceedBtn" onclick="window.proceedWithSelectedPackage('${escapeHtml(subServiceName)}', '${escapeHtml(designationName)}')">
                                Proceed <i class="fa-solid fa-arrow-right"></i>
                            </button>
                            <div class="package-trust-points">
                                <div class="package-trust-item"><i class="fa-solid fa-circle-check"></i> Trained & Verified Cleaning Team</div>
                                <div class="package-trust-item"><i class="fa-solid fa-shield-halved"></i> 100% Satisfaction Guarantee</div>
                                <div class="package-trust-item"><i class="fa-solid fa-spray-can-sparkles"></i> Eco-friendly & Safe Chemicals</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    window.togglePackageDetails = function togglePackageDetails(idx) {
        const card = document.getElementById(`packageCard_${idx}`);
        if (!card) return;
        const detailsEl = document.getElementById(`packageDetails_${idx}`);
        const linkEl = document.getElementById(`packageDetailsLink_${idx}`);
        if (!detailsEl) return;

        const isExpanded = detailsEl.style.display === "block";
        if (isExpanded) {
            detailsEl.style.display = "none";
            card.classList.remove("expanded");
            if (linkEl) {
                linkEl.innerHTML = `View details <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem;"></i>`;
            }
        } else {
            detailsEl.style.display = "block";
            card.classList.add("expanded");
            if (linkEl) {
                linkEl.innerHTML = `Hide details <i class="fa-solid fa-chevron-up" style="font-size: 0.7rem;"></i>`;
            }
        }
    };

    window.onPackageAddClick = function onPackageAddClick(packageIndex, designationName, subServiceName) {
        const packages = designationPackages[designationName];
        if (!packages || !packages[packageIndex]) return;

        const pkg = packages[packageIndex];
        _currentSelectedPackage = pkg;

        packages.forEach((_, idx) => {
            const btn = document.getElementById(`pkgAddBtn_${idx}`);
            if (btn) {
                if (idx === packageIndex) {
                    btn.classList.add("added");
                    btn.textContent = "Added ✓";
                } else {
                    btn.classList.remove("added");
                    btn.textContent = "Add";
                }
            }
        });

        let displayTitle = designationName;
        if (designationName === "Empty Kitchen" || designationName === "Empty Kitchen Cleaning") {
            displayTitle = "Empty Kitchen Cleaning";
        } else if (designationName === "Occupied Kitchen" || designationName === "Occupied Kitchen Cleaning") {
            displayTitle = "Occupied Kitchen Cleaning";
        } else if (subServiceName && !designationName.toLowerCase().includes(subServiceName.toLowerCase())) {
            displayTitle = `${subServiceName} - ${designationName}`;
        }

        const titleEl = document.getElementById("summarySelectedPlanTitle");
        if (titleEl) titleEl.textContent = `${displayTitle} - ${pkg.name}`;

        const priceEl = document.getElementById("summarySelectedPrice");
        if (priceEl) priceEl.textContent = `₹${pkg.price.toLocaleString('en-IN')}`;
    };

    window.proceedWithSelectedPackage = function proceedWithSelectedPackage(subServiceName, designationName) {
        if (!_currentSelectedPackage) return;
        window.selectPackage(subServiceName, designationName, _currentSelectedPackage.name, _currentSelectedPackage.price, _currentSelectedPackage.features);
    };

    window.selectPackage = function selectPackage(subServiceName, designationName, packageName, price, features) {
        window.closeSubServicesModal();
        let displayDesignation = designationName;
        if (designationName === "Empty Kitchen" || designationName === "Empty Kitchen Cleaning") {
            displayDesignation = "Empty Kitchen Cleaning";
        } else if (designationName === "Occupied Kitchen" || designationName === "Occupied Kitchen Cleaning") {
            displayDesignation = "Occupied Kitchen Cleaning";
        }
        const serviceFullName = displayDesignation.toLowerCase().includes(subServiceName.toLowerCase())
            ? `${displayDesignation} (${packageName})`
            : `${subServiceName} - ${displayDesignation} (${packageName})`;
        window.selectNoBrokerService(`${serviceFullName}|${price}`);

        const notes = document.getElementById("nbNotes");
        if (notes) {
            notes.value = `Selected Plan: ${packageName} (₹${price.toLocaleString('en-IN')})\nPackage Scope:\n- ${(features || []).join("\n- ")}\nMaterial/spare charges to be confirmed by assigned vendor.`;
        }
    };

    window.viewPackageDetails = function viewPackageDetails(packageNameOrIndex) {
        if (typeof packageNameOrIndex === "number") {
            window.togglePackageDetails(packageNameOrIndex);
        } else {
            notify(`Showing full checklist and scope for ${packageNameOrIndex}.`);
        }
    };

    window.chooseSubService = function chooseSubService(serviceName, price, parentCategory) {
        if (subServiceDesignations[serviceName]) {
            window.showSubServiceDesignations(serviceName, parentCategory || _currentParentCategory);
            return;
        }
        window.closeSubServicesModal();
        window.selectNoBrokerService(`${serviceName}|${price}`);
    };

    window.chooseDesignation = function chooseDesignation(subServiceName, designationName, price, parentCategory) {
        const pkgKey = designationPackages[designationName] ? designationName :
            (designationPackages[designationName + " Cleaning"] ? designationName + " Cleaning" :
            (designationPackages[designationName.replace(" Cleaning", "")] ? designationName.replace(" Cleaning", "") : null));

        if (pkgKey) {
            window.showDesignationPackages(pkgKey, subServiceName, parentCategory || _currentParentCategory);
            return;
        }
        window.closeSubServicesModal();
        window.selectNoBrokerService(`${subServiceName} - ${designationName}|${price}`);
    };

    window.filterNoBrokerServices = function filterNoBrokerServices(value) {
        const query = String(value || "").trim().toLowerCase();
        document.querySelectorAll(`.hs-category-card, .hs-pill-btn, .hs-offer-card`).forEach(item => {
            const keywords = `${item.textContent || ""}`.toLowerCase();
            item.style.display = !query || keywords.includes(query) ? "" : "none";
        });
    };

    window.scrollToNoBrokerBookingForm = function scrollToNoBrokerBookingForm() {
        document.getElementById("nobrokerBookingFormAnchor")?.scrollIntoView({behavior: "smooth", block: "start"});
    };

    window.scrollToNoBrokerBookings = function scrollToNoBrokerBookings() {
        document.getElementById("nobrokerBookingsTableAnchor")?.scrollIntoView({behavior: "smooth", block: "start"});
    };

    const originalVip = window.applyNoBrokerVipPass;
    window.applyNoBrokerVipPass = function applyNoBrokerVipPass() {
        originalVip?.();
        notify("VIP pass applied. Inspection fee waiver is shown in the booking summary.");
    };

    async function api(path, options = {}) {
        const response = await fetch(`/api/maintenance${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.detail || "Unable to save service booking.");
        return payload;
    }

    function preferredAt(date, slot) {
        const time = slot === "MORNING" ? "09:00" : slot === "AFTERNOON" ? "12:00" : slot === "EVENING" ? "16:00" : "10:00";
        return `${date}T${time}`;
    }

    window.handleNoBrokerSubmit = async function handleNoBrokerSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const selectedValue = document.getElementById("nbSelectedService")?.value || "General Inspection|49";
        const [service, price = "49"] = selectedValue.split("|");
        const meta = serviceMeta(service);
        const date = document.getElementById("nbServiceDate")?.value;
        const slot = document.getElementById("nbServiceSlot")?.value || "EXPRESS_60MIN";
        const name = document.getElementById("nbCustomerName")?.value || (isCustomer ? "Customer" : "Resident");
        const phone = document.getElementById("nbCustomerPhone")?.value || "";
        const address = document.getElementById("nbAddress")?.value || "";
        const notes = document.getElementById("nbNotes")?.value || "";
        const submit = form.querySelector('[type="submit"]');

        if (!/^[6-9]\d{9}$/.test(phone.trim())) {
            notify("Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
            const phoneInput = document.getElementById("nbCustomerPhone");
            if (phoneInput) {
                phoneInput.focus();
                phoneInput.select();
            }
            return;
        }

        const visitAt = preferredAt(date, slot);
        if (new Date(visitAt).getTime() <= Date.now()) {
            notify("Choose a future service date and time.");
            return;
        }
        submit.disabled = true;
        try {
            const reference = `${bookingPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
            const saved = await api("", {
                method: "POST",
                body: JSON.stringify({
                    sourcePlatform,
                    targetEntityType: isCustomer ? "PROPERTY_LISTING" : "APARTMENT_UNIT",
                    requesterName: name,
                    requesterPhone: phone,
                    serviceType: service,
                    serviceCategory: meta.category,
                    serviceOption: meta.option,
                    priceLabel: Number(price) === 0 ? "Quote after inspection" : `Rs. ${price}`,
                    warrantyLabel: meta.warranty,
                    title: `${service} - ${address || name}`,
                    description: [
                        `${isCustomer ? "PropertyDirect customer" : "SmartSociety resident"} home-service booking`,
                        `Selected slot: ${slot}`,
                        `Starting price / inspection fee: Rs. ${price}`,
                        meta.option && `Scope: ${meta.option}`,
                        notes && `Instructions: ${notes}`,
                        "Material, spare and extra labour charges require vendor confirmation before work starts."
                    ].filter(Boolean).join("\n"),
                    serviceAddress: address,
                    priority: slot === "EXPRESS_60MIN" ? "HIGH" : "MEDIUM",
                    preferredAt: visitAt,
                    vendorName: "External home-service vendor",
                    vendorPhone: "",
                    accessType: isCustomer ? "Customer will be present" : "Resident will be present",
                    contactMethod: "Phone",
                    externalReference: reference
                })
            });
            form.reset();
            setDefaultDate();
            window.updateNoBrokerCheckoutPrice?.();
            await window.loadNoBrokerMaintenanceTickets?.();
            notify(`Service booking #${saved.id} saved. Reference: ${reference}`);
        } catch (error) {
            notify(error.message);
        } finally {
            submit.disabled = false;
        }
    };

    window.loadNoBrokerMaintenanceTickets = async function loadNoBrokerMaintenanceTickets() {
        const rows = document.getElementById("noBrokerMaintenanceRows");
        if (!rows) return;
        try {
            const tickets = await api(`?sourcePlatform=${encodeURIComponent(sourcePlatform)}`);
            const serviceTickets = tickets.filter(ticket => {
                const content = `${ticket.serviceCategory || ""} ${ticket.serviceType || ""} ${ticket.externalReference || ""}`.toLowerCase();
                return /home|clean|pack|paint|agreement|repair|carpentry|plumb|electric|appliance|interior|pest|ss-hs|pd-hs|nb-crp/.test(content);
            });
            rows.innerHTML = serviceTickets.length ? serviceTickets.map(ticket => {
                const status = String(ticket.ticketStatus || "REQUESTED").replaceAll("_", " ");
                const done = /RESOLVED|CLOSED/i.test(status);
                const badgeStyle = done ? "background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;" : "background:#fef3c7; color:#b45309; border:1px solid #fde68a;";
                return `<tr>
                    <td><strong>#${ticket.id}</strong><br><small style="color:#64748b;">${escapeHtml(ticket.externalReference || "Service booking")}</small></td>
                    <td><strong>${escapeHtml(ticket.serviceType || "Home service")}</strong><br><small style="color:#64748b;">${escapeHtml(ticket.serviceOption || "Standard visit")}</small></td>
                    <td>${ticket.preferredAt ? new Date(ticket.preferredAt).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "-"}</td>
                    <td>${escapeHtml(ticket.serviceAddress || "-")}</td>
                    <td>${escapeHtml(ticket.priceLabel || "Rs. 49")}</td>
                    <td><span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:800; ${badgeStyle}">${escapeHtml(status)}</span></td>
                    <td>${done ? '<span style="color:#15803d; font-weight:800; font-size:0.82rem;">Closed</span>' : `<button type="button" style="all:unset; background:#ffffff; border:1px solid #16a34a; color:#16a34a; padding:4px 14px; border-radius:999px; font-size:0.78rem; font-weight:800; cursor:pointer;" onclick="resolveNoBrokerTicket(${ticket.id})">Mark Resolved</button>`}</td>
                </tr>`;
            }).join("") : '<tr><td colspan="7" style="color:#94a3b8; text-align:center; padding:24px;">No saved home-service bookings yet.</td></tr>';
        } catch (error) {
            rows.innerHTML = `<tr><td colspan="7" style="color:#dc2626; text-align:center; padding:24px;">${escapeHtml(error.message)}</td></tr>`;
        }
    };

    window.resolveNoBrokerTicket = async function resolveNoBrokerTicket(id) {
        try {
            await api(`/${id}/status`, {method: "PATCH", body: JSON.stringify({ticketStatus: "RESOLVED", vendorNotes: "Marked resolved from dashboard."})});
            notify("Service ticket marked resolved and saved.");
            await window.loadNoBrokerMaintenanceTickets?.();
        } catch (error) {
            notify(error.message);
        }
    };

    function setDefaultDate() {
        const dateInput = document.getElementById("nbServiceDate");
        if (!dateInput) return;
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        dateInput.min = tomorrow;
        if (!dateInput.value || dateInput.value < tomorrow) dateInput.value = tomorrow;
    }

    document.addEventListener("click", event => {
        const action = event.target.closest("[data-hs-book]");
        const offer = event.target.closest("[data-hs-offer]");
        const bookings = event.target.closest("[data-hs-bookings]");
        if (action) {
            event.preventDefault();
            window.selectNoBrokerService(action.dataset.hsBook);
        }
        if (offer) {
            event.preventDefault();
            window.applyNoBrokerVipPass?.();
        }
        if (bookings) {
            event.preventDefault();
            window.scrollToNoBrokerBookings?.();
        }
    }, true);

    document.addEventListener("input", event => {
        if (event.target?.id === "hsDashboardSearch") window.filterNoBrokerServices(event.target.value);
        if (event.target?.id === "nbCustomerPhone" || event.target?.name === "requesterPhone") {
            event.target.value = event.target.value.replace(/[^0-9]/g, "").slice(0, 10);
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        enhanceSection();
        repairLegacyNoBrokerIcons();
        setDefaultDate();
        window.updateNoBrokerCheckoutPrice?.();
        window.loadNoBrokerMaintenanceTickets?.();
        setTimeout(() => {
            enhanceSection();
            repairLegacyNoBrokerIcons();
        }, 250);
    });

    if (document.readyState !== "loading") {
        enhanceSection();
        repairLegacyNoBrokerIcons();
        setDefaultDate();
        window.updateNoBrokerCheckoutPrice?.();
        window.loadNoBrokerMaintenanceTickets?.();
        setTimeout(() => {
            enhanceSection();
            repairLegacyNoBrokerIcons();
        }, 250);
    }
})();
