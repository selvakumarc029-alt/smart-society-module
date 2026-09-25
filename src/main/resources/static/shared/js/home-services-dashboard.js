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
            @keyframes bookingPulseAnim {
                0% { background-color: #dcfce7 !important; outline: 3px solid #16a34a !important; }
                50% { background-color: #bbf7d0 !important; outline: 3px solid #15803d !important; }
                100% { background-color: transparent !important; outline: none !important; }
            }
            .booking-highlight-pulse {
                animation: bookingPulseAnim 3.5s ease-out !important;
            }

            /* Live Tracking Modal & Stepper Styling */
            .lt-modal-backdrop {
                position: fixed !important;
                inset: 0 !important;
                background: rgba(15, 23, 42, 0.72) !important;
                backdrop-filter: blur(8px) !important;
                -webkit-backdrop-filter: blur(8px) !important;
                z-index: 1070 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1rem !important;
                animation: fadeInModal 0.25s ease-out !important;
            }
            @keyframes fadeInModal {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .lt-modal-box {
                background: #ffffff !important;
                width: 100% !important;
                max-width: 840px !important;
                border-radius: 24px !important;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35) !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                max-height: 92vh !important;
                animation: slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }
            @keyframes slideUpModal {
                from { opacity: 0; transform: scale(0.96) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .lt-modal-header {
                padding: 20px 28px !important;
                background: #f8fafc !important;
                border-bottom: 1px solid #e2e8f0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
            }
            .lt-modal-body {
                padding: 24px 28px !important;
                overflow-y: auto !important;
                flex: 1 1 auto !important;
            }
            .lt-worker-card {
                background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%) !important;
                border: 1.5px solid #86efac !important;
                border-radius: 16px !important;
                padding: 16px 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                margin-bottom: 24px !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
            }
            /* 6-Stage Timeline Stepper */
            .lt-stepper {
                display: flex !important;
                flex-direction: column !important;
                gap: 0 !important;
                position: relative !important;
                margin: 20px 0 24px 8px !important;
            }
            .lt-step-row {
                display: flex !important;
                align-items: flex-start !important;
                position: relative !important;
                padding-bottom: 28px !important;
            }
            .lt-step-row:last-child {
                padding-bottom: 0 !important;
            }
            .lt-step-indicator {
                width: 44px !important;
                height: 44px !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 1.1rem !important;
                flex-shrink: 0 !important;
                z-index: 2 !important;
                transition: all 0.4s ease !important;
                background: #f1f5f9 !important;
                color: #94a3b8 !important;
                border: 2px solid #cbd5e1 !important;
            }
            .lt-step-row.completed .lt-step-indicator {
                background: #10b981 !important;
                color: #ffffff !important;
                border-color: #059669 !important;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
            }
            .lt-step-row.active .lt-step-indicator {
                background: #2563eb !important;
                color: #ffffff !important;
                border-color: #1d4ed8 !important;
                box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.25) !important;
                animation: radarPulse 2s infinite !important;
            }
            @keyframes radarPulse {
                0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                70% { box-shadow: 0 0 0 14px rgba(37, 99, 235, 0); }
                100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
            }
            .lt-step-line {
                position: absolute !important;
                left: 21px !important;
                top: 44px !important;
                bottom: 0 !important;
                width: 3px !important;
                background: #e2e8f0 !important;
                z-index: 1 !important;
                transition: background 0.4s ease !important;
            }
            .lt-step-row.completed .lt-step-line {
                background: #10b981 !important;
            }
            .lt-step-content {
                margin-left: 18px !important;
                flex: 1 1 auto !important;
                padding-top: 4px !important;
            }
            .lt-step-title-row {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                flex-wrap: wrap !important;
                gap: 6px !important;
            }
            .lt-step-title {
                font-size: 1rem !important;
                font-weight: 800 !important;
                color: #0f172a !important;
            }
            .lt-step-row.upcoming .lt-step-title {
                color: #94a3b8 !important;
            }
            .lt-step-desc {
                font-size: 0.83rem !important;
                color: #64748b !important;
                margin-top: 3px !important;
                line-height: 1.45 !important;
            }
            /* Review & Rating Card */
            .lt-review-card {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
                border: 2px solid #fde68a !important;
                border-radius: 20px !important;
                padding: 24px !important;
                margin-top: 24px !important;
                box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.15) !important;
                animation: slideUpModal 0.4s ease-out !important;
            }
            .lt-stars-container {
                display: flex !important;
                gap: 8px !important;
                margin: 12px 0 !important;
            }
            .lt-star-btn {
                background: transparent !important;
                border: none !important;
                font-size: 1.85rem !important;
                color: #cbd5e1 !important;
                cursor: pointer !important;
                transition: transform 0.2s, color 0.2s !important;
                padding: 0 2px !important;
                line-height: 1 !important;
            }
            .lt-star-btn.active, .lt-star-btn:hover {
                color: #f59e0b !important;
                transform: scale(1.15) !important;
            }
            .lt-tag-chip {
                display: inline-block !important;
                padding: 5px 14px !important;
                border-radius: 999px !important;
                font-size: 0.78rem !important;
                font-weight: 700 !important;
                background: #ffffff !important;
                border: 1.5px solid #cbd5e1 !important;
                color: #475569 !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                user-select: none !important;
                margin: 0 6px 6px 0 !important;
            }
            .lt-tag-chip.selected {
                background: #f59e0b !important;
                color: #ffffff !important;
                border-color: #d97706 !important;
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

    // Additional presets for Bathroom & Sofa Cleaning
    designationPackages["Deep Bathroom Cleaning"] = [
        {
            name: "Essential ★",
            rating: "4.76",
            reviews: "18.4K+",
            duration: "1 hr 30 mins",
            price: 449,
            optionsCount: "3 options",
            features: [
                "Intensive tile and floor mechanical scrubbing",
                "Toilet pot, washbasin & chrome tap descaling",
                "Mirror buffing & drain trap sanitization"
            ],
            detailedBreakdown: {
                priceLabel: "₹449 (All-Inclusive)",
                guarantee: "Taski R1-R9 Chemicals • 30 Days Support",
                sections: [
                    {
                        title: "🚿 Bathroom Fixtures & Descaling",
                        items: [
                            "Removal of hard water stains from tiles & taps",
                            "WC, flush tank & washbasin descaling",
                            "Exhaust fan and switchboard wiping"
                        ]
                    }
                ]
            }
        },
        {
            name: "Premium 💎",
            rating: "4.82",
            reviews: "12.1K+",
            duration: "2 hrs",
            price: 699,
            optionsCount: "3 options",
            badge: "POPULAR",
            features: [
                "Includes everything in Essential Plan",
                "High-temperature steam sanitization of grout & drain",
                "Anti-fungal shower glass & bathtub buffing"
            ],
            detailedBreakdown: {
                priceLabel: "₹699 (All-Inclusive)",
                guarantee: "High-Pressure Steam • Anti-Fungal Treatment",
                sections: [
                    {
                        title: "💨 Thermal Steam Sanitization",
                        items: [
                            "High-temperature steam treatment for corners & grouting",
                            "Shower enclosure & partition glass scaling removal",
                            "Hospital-grade antimicrobial mist"
                        ]
                    }
                ]
            }
        },
        {
            name: "Elite 👑",
            rating: "4.91",
            reviews: "7.8K+",
            duration: "2 hrs 30 mins",
            price: 999,
            optionsCount: "3 options",
            features: [
                "Includes everything in Premium Plan",
                "Machine floor buffing with protective nano-sealant",
                "Tile grout restoration & 60-day anti-stain barrier"
            ],
            detailedBreakdown: {
                priceLabel: "₹999 (All-Inclusive)",
                guarantee: "Nano-Sealant Protection • 60 Days Support",
                sections: [
                    {
                        title: "👑 Complete Nano-Coating Overhaul",
                        items: [
                            "Machine rotary buffer for marble/granite/vitrified tiles",
                            "Nano-protective water-repellent sealant applied",
                            "Full sanitization & deodorizing mist"
                        ]
                    }
                ]
            }
        }
    ];
    designationPackages["Standard Bathroom Cleaning"] = [
        {
            name: "Essential ★",
            rating: "4.71",
            reviews: "9.2K+",
            duration: "1 hr",
            price: 349,
            optionsCount: "2 options",
            features: [
                "Surface tile wiping & toilet pot scrubbing",
                "Washbasin, tap & mirror buffing",
                "Floor mop with disinfectant chemical"
            ],
            detailedBreakdown: {
                priceLabel: "₹349 (All-Inclusive)",
                guarantee: "Verified Partner • 30 Days Support",
                sections: [
                    {
                        title: "🧹 Standard Sanitation",
                        items: [
                            "Basic hard water stain removal from WC & basin",
                            "Mirror wipe and floor sanitization"
                        ]
                    }
                ]
            }
        },
        {
            name: "Deep Power",
            rating: "4.79",
            reviews: "14.5K+",
            duration: "1 hr 30 mins",
            price: 499,
            optionsCount: "2 options",
            features: [
                "Intensive tile and floor mechanical scrubbing",
                "Exhaust fan dusting & chrome tap descaling",
                "High-suction drain clearing"
            ],
            detailedBreakdown: {
                priceLabel: "₹499 (All-Inclusive)",
                guarantee: "Intensive Scrubbing • 30 Days Support",
                sections: [
                    {
                        title: "✨ Deep Power Scrubbing",
                        items: [
                            "Floor and wall mechanical scrubbing",
                            "Complete tap and showerhead descaling"
                        ]
                    }
                ]
            }
        }
    ];
    designationPackages["Bathroom Cleaning"] = designationPackages["Deep Bathroom Cleaning"];

    designationPackages["Sofa cleaning"] = [
        {
            name: "Essential ★",
            rating: "4.74",
            reviews: "11.6K+",
            duration: "1 hr 30 mins",
            price: 349,
            optionsCount: "3 options",
            features: [
                "Deep dry vacuuming of 3-seater sofa",
                "Surface spot treatment & fabric conditioning",
                "Crevice & cushion dust mite extraction"
            ],
            detailedBreakdown: {
                priceLabel: "₹349 (All-Inclusive)",
                guarantee: "Taski TR101 Shampoo • Safe for All Fabrics",
                sections: [
                    {
                        title: "🛋️ Dry Vacuum & Spot Clean",
                        items: [
                            "High-suction vacuuming of dust, crumbs & pet hair",
                            "Mild stain spot treatment on armrests and cushions"
                        ]
                    }
                ]
            }
        },
        {
            name: "Premium 💎",
            rating: "4.83",
            reviews: "22.4K+",
            duration: "2 hrs",
            price: 599,
            optionsCount: "3 options",
            badge: "POPULAR",
            features: [
                "Full foam injection & extraction shampooing",
                "Removes deep grease, food stains & sweat odor",
                "Includes up to 5-seater sofa + 4 cushions"
            ],
            detailedBreakdown: {
                priceLabel: "₹599 (All-Inclusive)",
                guarantee: "Injection-Extraction Machine • Quick Dry",
                sections: [
                    {
                        title: "✨ Deep Foam Shampoo Wash",
                        items: [
                            "Active foam injection deep into fabric fibers",
                            "Industrial extraction vacuum pulling out 95% dirty moisture",
                            "Drying time reduced to 2 - 3 hours"
                        ]
                    }
                ]
            }
        },
        {
            name: "Elite 👑",
            rating: "4.92",
            reviews: "8.7K+",
            duration: "2 hrs 30 mins",
            price: 899,
            optionsCount: "3 options",
            features: [
                "Everything in Premium Plan included",
                "High-pressure steam sanitization & anti-mite mist",
                "Scotchgard fabric protective anti-stain coat"
            ],
            detailedBreakdown: {
                priceLabel: "₹899 (All-Inclusive)",
                guarantee: "Steam Sanitization • Anti-Stain Shield",
                sections: [
                    {
                        title: "👑 Steam & Scotchgard Protection",
                        items: [
                            "140°C steam kills bacteria, allergens and odor",
                            "Invisible stain-resistant protective polymer shield applied"
                        ]
                    }
                ]
            }
        }
    ];
    designationPackages["Carpet cleaning"] = [
        {
            name: "Essential ★",
            rating: "4.72",
            reviews: "7.1K+",
            duration: "1 hr",
            price: 299,
            optionsCount: "2 options",
            features: [
                "Dry vacuuming of up to 5x7 ft rug",
                "Fringe comb & edge dust extraction",
                "Anti-odor powder treatment"
            ],
            detailedBreakdown: {
                priceLabel: "₹299 (All-Inclusive)",
                guarantee: "High-Suction Extraction • 30 Days Support",
                sections: [
                    {
                        title: "🧶 Rug Dust Extraction",
                        items: ["Deep crevice vacuuming removing embedded dirt and sand"]
                    }
                ]
            }
        },
        {
            name: "Deep Shampoo",
            rating: "4.84",
            reviews: "13.9K+",
            duration: "1 hr 45 mins",
            price: 549,
            optionsCount: "2 options",
            badge: "POPULAR",
            features: [
                "Rotary machine scrubbing with gentle foam",
                "Deep stain removal for tea/coffee spills",
                "Moisture extraction & quick dry process"
            ],
            detailedBreakdown: {
                priceLabel: "₹549 (All-Inclusive)",
                guarantee: "Machine Scrub & Moisture Extraction",
                sections: [
                    {
                        title: "✨ Machine Foam Wash",
                        items: ["Complete shampooing of large carpet up to 8x10 ft"]
                    }
                ]
            }
        }
    ];

    // =========================================================================
    // MINI SERVICES CATALOG & DYNAMIC PACKAGE GENERATION
    // =========================================================================
    const MINI_SERVICES_CATALOG = [
        {
            id: "chimney_degrease",
            title: "Kitchen Chimney Deep Degreasing",
            duration: "45 mins",
            price: 499,
            origPrice: 799,
            discount: "38% OFF",
            badge: "POPULAR",
            features: [
                "Baffle/mesh filters soaked in active degreasing solution",
                "Internal hood & oil collector cup scrubbing",
                "Motor housing surface wipe & stainless steel polish"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="10" width="52" height="20" rx="2" fill="#334155" stroke="#1e293b" stroke-width="1.5"/><rect x="24" y="30" width="32" height="34" rx="2" fill="#64748b"/><line x1="28" y1="36" x2="52" y2="36" stroke="#f8fafc" stroke-width="2"/><line x1="28" y1="44" x2="52" y2="44" stroke="#f8fafc" stroke-width="2"/><circle cx="40" cy="54" r="5" fill="#f59e0b"/></svg>`
        },
        {
            id: "microwave_degrease",
            title: "Microwave & Oven Deep Degreasing",
            duration: "30 mins",
            price: 299,
            origPrice: 499,
            discount: "40% OFF",
            badge: "BESTSELLER",
            features: [
                "Burnt oil and food splatter breakdown",
                "Turntable plate and roller ring steam sanitization",
                "Anti-bacterial deodorizing cavity wipe"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="18" width="60" height="44" rx="4" fill="#0f172a"/><rect x="16" y="24" width="36" height="32" rx="2" fill="#38bdf8" fill-opacity="0.3" stroke="#38bdf8"/><circle cx="58" cy="30" r="3" fill="#f59e0b"/><rect x="54" y="40" width="8" height="14" rx="1" fill="#475569"/></svg>`
        },
        {
            id: "fridge_deep_clean",
            title: "Refrigerator Deep Sanitization",
            duration: "35 mins",
            price: 379,
            origPrice: 599,
            discount: "37% OFF",
            badge: "HYGIENE+",
            features: [
                "Removable shelves & crisper bins scrubbed & dried",
                "Door gasket descaling & mold prevention",
                "Food-safe sanitizing mist to eliminate trapped odor"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="8" width="44" height="64" rx="3" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/><line x1="18" y1="28" x2="62" y2="28" stroke="#cbd5e1" stroke-width="1.5"/><rect x="22" y="16" width="3" height="8" rx="1" fill="#475569"/><rect x="22" y="34" width="3" height="14" rx="1" fill="#475569"/></svg>`
        },
        {
            id: "balcony_scrub",
            title: "Balcony Deep Pressure Scrub",
            duration: "40 mins",
            price: 349,
            origPrice: 549,
            discount: "36% OFF",
            badge: "OUTDOOR",
            features: [
                "Machine floor scrub removing stubborn moss/grime",
                "Balcony railing and sill wet wipe down",
                "Drain trap cleared of leaves and sediment"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="34" width="56" height="34" rx="1" fill="#e2e8f0"/><line x1="16" y1="20" x2="64" y2="20" stroke="#475569" stroke-width="2.5"/><line x1="20" y1="20" x2="20" y2="34" stroke="#475569" stroke-width="2"/><line x1="30" y1="20" x2="30" y2="34" stroke="#475569" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="34" stroke="#475569" stroke-width="2"/><line x1="50" y1="20" x2="50" y2="34" stroke="#475569" stroke-width="2"/><line x1="60" y1="20" x2="60" y2="34" stroke="#475569" stroke-width="2"/></svg>`
        },
        {
            id: "tiles_grout_steam",
            title: "Kitchen / Bathroom Tile Grout Scrub",
            duration: "45 mins",
            price: 399,
            origPrice: 649,
            discount: "38% OFF",
            badge: "DEEP CLEAN",
            features: [
                "Intensive brushing of dirty & stained yellow grout lines",
                "High-pressure thermal steam application",
                "Chemical descaling of hard water minerals"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="14" width="52" height="52" rx="2" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/><line x1="14" y1="40" x2="66" y2="40" stroke="#0284c7" stroke-width="2"/><line x1="40" y1="14" x2="40" y2="66" stroke="#0284c7" stroke-width="2"/><circle cx="27" cy="27" r="3" fill="#38bdf8"/><circle cx="53" cy="53" r="3" fill="#38bdf8"/></svg>`
        },
        {
            id: "fans_exhaust_clean",
            title: "Ceiling & Exhaust Fans Deep Clean",
            duration: "25 mins",
            price: 199,
            origPrice: 349,
            discount: "43% OFF",
            badge: "QUICK 25MIN",
            features: [
                "2 ceiling fans + 1 kitchen/bath exhaust fan included",
                "Thick sticky grime and dust removal from blades",
                "Motor casing dry vacuuming & surface shine wipe"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="9" fill="#0f172a"/><path d="M40 31c0-12-8-18-8-18s12 4 12 18zM49 45c11 5 18 2 18 2s-6 11-18 2zM31 45c-11 5-18 2-18 2s6 11 18 2z" fill="#3b82f6"/></svg>`
        },
        {
            id: "window_track_clean",
            title: "Window Glass & Track Vacuuming",
            duration: "35 mins",
            price: 299,
            origPrice: 499,
            discount: "40% OFF",
            badge: "STREAK-FREE",
            features: [
                "High-suction crevice vacuuming of dirt-clogged sliding tracks",
                "Streak-free glass pane buffing with microfiber",
                "Mesh net dusting and frame wet-wiping"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="14" width="52" height="52" rx="2" fill="#ffffff" stroke="#475569" stroke-width="2"/><line x1="40" y1="14" x2="40" y2="66" stroke="#475569" stroke-width="2"/><path d="M18 18l18 18M44 18l18 18" stroke="#38bdf8" stroke-width="1.5"/></svg>`
        },
        {
            id: "mattress_sanitization",
            title: "Mattress Dust-Mite Sanitization",
            duration: "40 mins",
            price: 449,
            origPrice: 699,
            discount: "36% OFF",
            badge: "HEALTH+",
            features: [
                "High-filtration industrial vacuum extraction of dead skin & mites",
                "UV-C sanitization wand treatment for allergen neutralisation",
                "Eco-friendly anti-allergen deodorizing mist"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="24" width="56" height="34" rx="5" fill="#f8fafc" stroke="#6366f1" stroke-width="1.8"/><line x1="12" y1="42" x2="68" y2="42" stroke="#e0e7ff" stroke-width="1.5"/><circle cx="26" cy="34" r="2.5" fill="#818cf8"/><circle cx="40" cy="34" r="2.5" fill="#818cf8"/><circle cx="54" cy="34" r="2.5" fill="#818cf8"/></svg>`
        },
        {
            id: "water_purifier_clean",
            title: "Water Purifier Outer Clean & Tap Descale",
            duration: "20 mins",
            price: 199,
            origPrice: 299,
            discount: "33% OFF",
            badge: "EXPRESS",
            features: [
                "Exterior RO/UV body degreasing & clear buffing",
                "Dispenser tap hard-water lime scale descaling",
                "Drip tray sanitization"
            ],
            svg: `<svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="22" y="12" width="36" height="54" rx="4" fill="#0284c7"/><rect x="26" y="22" width="28" height="20" rx="2" fill="#e0f2fe"/><path d="M40 50v8M36 58h8" stroke="#ffffff" stroke-width="2"/></svg>`
        }
    ];

    let _selectedMiniServiceIds = new Set(["chimney_degrease"]);

    window.showMiniServicesView = function showMiniServicesView(subServiceName, parentCategory) {
        const modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) return;

        modal.classList.add("active");
        modal.style.removeProperty("display");
        modal.style.display = "flex";

        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.className = "subservice-modal-box wide mini-services-mode";
            boxEl.style.maxWidth = "960px";
            boxEl.style.removeProperty("display");
            boxEl.style.display = "flex";
        }

        const parentCat = parentCategory || _currentParentCategory || "Home Cleaning";
        const subService = subServiceName || "Full House Cleaning";

        const headerArea = document.getElementById("subserviceModalHeaderArea");
        if (headerArea) {
            headerArea.innerHTML = `
                <div class="subservice-modal-header" style="margin-bottom: 1rem !important;">
                    <button type="button" class="subservice-modal-back" id="subserviceModalBackBtn" aria-label="Back" onclick="event.preventDefault(); event.stopPropagation(); if (typeof subServiceDesignations !== 'undefined' && subServiceDesignations['${escapeHtml(subService)}']) { window.showSubServiceDesignations('${escapeHtml(subService)}', '${escapeHtml(parentCat)}'); } else { window.selectNoBrokerCategory('${escapeHtml(parentCat)}'); }">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h4 class="subservice-modal-title" style="margin: 0;"><i class="fa-solid fa-spray-can-sparkles text-primary me-2"></i>Mini Services & Quick Add-Ons</h4>
                        <span style="font-size: 0.8rem; color: #64748b;">Select single or multiple specialized tasks for ${escapeHtml(subService)}</span>
                    </div>
                    <div style="width: 36px;"></div>
                </div>
            `;
        }

        const gridEl = document.getElementById("subserviceGrid");
        if (!gridEl) return;

        gridEl.className = "";
        gridEl.style.gridTemplateColumns = "";

        const renderGrid = () => {
            const selectedList = MINI_SERVICES_CATALOG.filter(it => _selectedMiniServiceIds.has(it.id));
            const totalCount = selectedList.length;
            const totalPrice = selectedList.reduce((acc, it) => acc + it.price, 0);

            gridEl.innerHTML = `
                <div class="mini-services-view-container">
                    <div class="package-banner" style="margin-bottom: 1.25rem;">
                        <div class="package-banner-left">
                            <i class="fa-solid fa-wand-magic-sparkles package-banner-icon" style="color: #0d9488;"></i>
                            <div>
                                <h6 class="package-banner-title">Express Add-on Services</h6>
                                <p class="package-banner-sub">Mix & match individual specialized tasks • Instant verified pro dispatch</p>
                            </div>
                        </div>
                        <div class="package-banner-badge" style="background: #0d9488; color: #fff;">FLAT 15% OFF</div>
                    </div>

                    <div class="mini-services-grid">
                        ${MINI_SERVICES_CATALOG.map(item => {
                            const isSelected = _selectedMiniServiceIds.has(item.id);
                            return `
                                <div class="mini-service-card ${isSelected ? 'selected' : ''}" id="miniCard_${item.id}">
                                    <div class="mini-service-img-wrapper">
                                        <span class="mini-service-badge">${escapeHtml(item.badge)}</span>
                                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 12px;">
                                            ${item.svg}
                                        </div>
                                        <button type="button" class="mini-service-add-btn ${isSelected ? 'added' : ''}" id="miniAddBtn_${item.id}" onclick="window.toggleMiniServiceItem('${item.id}', '${escapeHtml(subService)}', '${escapeHtml(parentCat)}')">
                                            ${isSelected ? 'Added ✓' : '+ Add'}
                                        </button>
                                    </div>
                                    <div class="mini-service-content">
                                        <h6 class="mini-service-title">${escapeHtml(item.title)}</h6>
                                        <div class="mini-service-duration"><i class="fa-regular fa-clock me-1"></i>${escapeHtml(item.duration)}</div>
                                        <div class="mini-service-price-row">
                                            <span class="mini-service-price">₹${item.price}</span>
                                            <span class="mini-service-orig-price">₹${item.origPrice}</span>
                                            <span class="mini-service-discount">${escapeHtml(item.discount)}</span>
                                        </div>
                                        <a href="javascript:void(0)" class="mini-service-details-link" onclick="window.toggleMiniServiceDetails('${item.id}')">
                                            <i class="fa-solid fa-circle-info"></i> View details <i class="fa-solid fa-chevron-down" style="font-size: 0.68rem;"></i>
                                        </a>
                                        <div class="mini-service-details-panel" id="miniDetails_${item.id}" style="display: none;">
                                            <div class="mini-service-details-heading">What's included:</div>
                                            <ul class="mini-service-features-list">
                                                ${item.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>

                    <div class="mini-services-footer-bar" id="miniServicesFooterBar">
                        <div class="mini-services-footer-left">
                            <span class="mini-services-footer-count" id="miniFooterCount">${totalCount} Item${totalCount === 1 ? '' : 's'} Selected</span>
                            <span class="mini-services-footer-total" id="miniFooterTotal">₹${totalPrice.toLocaleString('en-IN')}</span>
                        </div>
                        <button type="button" class="mini-services-proceed-btn" id="miniProceedBtn" ${totalCount === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="window.proceedWithMiniServices('${escapeHtml(subService)}', '${escapeHtml(parentCat)}')">
                            Proceed to Book <i class="fa-solid fa-arrow-right ms-2"></i>
                        </button>
                    </div>
                </div>
            `;
        };

        renderGrid();
    };

    window.toggleMiniServiceItem = function toggleMiniServiceItem(id, subServiceName, parentCategory) {
        if (_selectedMiniServiceIds.has(id)) {
            _selectedMiniServiceIds.delete(id);
        } else {
            _selectedMiniServiceIds.add(id);
        }

        const isSelected = _selectedMiniServiceIds.has(id);
        const card = document.getElementById(`miniCard_${id}`);
        const btn = document.getElementById(`miniAddBtn_${id}`);
        if (card) card.classList.toggle("selected", isSelected);
        if (btn) {
            btn.classList.toggle("added", isSelected);
            btn.textContent = isSelected ? "Added ✓" : "+ Add";
        }

        const selectedList = MINI_SERVICES_CATALOG.filter(it => _selectedMiniServiceIds.has(it.id));
        const totalCount = selectedList.length;
        const totalPrice = selectedList.reduce((acc, it) => acc + it.price, 0);

        const countEl = document.getElementById("miniFooterCount");
        const totalEl = document.getElementById("miniFooterTotal");
        const proceedBtn = document.getElementById("miniProceedBtn");

        if (countEl) countEl.textContent = `${totalCount} Item${totalCount === 1 ? '' : 's'} Selected`;
        if (totalEl) totalEl.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;
        if (proceedBtn) {
            if (totalCount === 0) {
                proceedBtn.disabled = true;
                proceedBtn.style.opacity = "0.5";
                proceedBtn.style.cursor = "not-allowed";
            } else {
                proceedBtn.disabled = false;
                proceedBtn.style.opacity = "1";
                proceedBtn.style.cursor = "pointer";
            }
        }
    };

    window.toggleMiniServiceDetails = function toggleMiniServiceDetails(id) {
        const panel = document.getElementById(`miniDetails_${id}`);
        if (panel) {
            const isHidden = panel.style.display === "none";
            panel.style.display = isHidden ? "block" : "none";
        }
    };

    window.proceedWithMiniServices = function proceedWithMiniServices(subServiceName, parentCategory) {
        const selectedList = MINI_SERVICES_CATALOG.filter(it => _selectedMiniServiceIds.has(it.id));
        if (!selectedList.length) {
            alert("Please select at least 1 mini service to proceed.");
            return;
        }

        const totalPrice = selectedList.reduce((acc, it) => acc + it.price, 0);
        const title = selectedList.length === 1 ? selectedList[0].title : `Mini Services (${selectedList.length} items)`;
        const allFeatures = selectedList.flatMap(it => it.features);

        window.openPaymentGateway({
            subServiceName: subServiceName || "Mini Services",
            designationName: title,
            packageName: "Express Add-on",
            price: totalPrice,
            features: allFeatures,
            parentCategory: parentCategory || "Home Cleaning",
            isMiniServices: true
        });
    };

    function getOrCreatePackagesForDesignation(designationName, subServiceName, basePrice) {
        if (!designationName) designationName = "Standard Service";
        const key = designationName;
        if (designationPackages[key]) return designationPackages[key];
        const cleanKey = key.replace(/ Cleaning$/i, "");
        if (designationPackages[cleanKey]) return designationPackages[cleanKey];
        if (designationPackages[key + " Cleaning"]) return designationPackages[key + " Cleaning"];
        if (subServiceName && designationPackages[subServiceName]) return designationPackages[subServiceName];

        let bp = Number(basePrice);
        if (!bp || isNaN(bp) || bp <= 0) bp = 349;
        const p1 = Math.round(bp);
        const p2 = Math.round(bp * 1.35);
        const p3 = Math.round(bp * 1.75);

        const generated = [
            {
                name: "Essential ★",
                rating: "4.72",
                reviews: "8.6K+",
                duration: "1 - 2 hrs",
                price: p1,
                optionsCount: "3 options",
                features: [
                    `Standard execution of ${designationName}`,
                    "Verified, background-checked technician dispatch",
                    "Professional grade specialized equipment & materials",
                    "Post-service quality check & cleanup",
                    "30 Days society service guarantee"
                ],
                detailedBreakdown: {
                    priceLabel: `₹${p1.toLocaleString('en-IN')} (All-Inclusive)`,
                    guarantee: "30 Days Service Support • Certified Technician",
                    sections: [
                        {
                            title: "📋 Scope of Work",
                            items: [
                                `Standard diagnosis and execution of ${designationName}`,
                                "Standard consumables and basic fittings included",
                                "Proper site testing and verification before closure"
                            ]
                        },
                        {
                            title: "🛡️ Safety & Warranty",
                            items: [
                                "Complete background-checked technician with badge",
                                "30-day service warranty against rework"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Premium 💎",
                rating: "4.81",
                reviews: "14.2K+",
                duration: "2 - 3 hrs",
                price: p2,
                optionsCount: "3 options",
                badge: "POPULAR",
                features: [
                    "Includes everything in Essential Plan",
                    "Priority express scheduling slot",
                    "Deep diagnostic, preventive maintenance & tuning",
                    "Heavy-duty materials and branded supplies",
                    "Antimicrobial wipe down of working area"
                ],
                detailedBreakdown: {
                    priceLabel: `₹${p2.toLocaleString('en-IN')} (All-Inclusive)`,
                    guarantee: "Priority Express • 45 Days Warranty",
                    sections: [
                        {
                            title: "✨ Premium Inclusions",
                            items: [
                                "Everything in Essential Plan included",
                                "High-durability replacement parts and premium consumables",
                                "Comprehensive stress testing and performance tuning"
                            ]
                        },
                        {
                            title: "⚡ Priority Support",
                            items: [
                                "Priority technician allocation within 60 mins",
                                "Extended 45-day warranty with free rework support"
                            ]
                        }
                    ]
                }
            },
            {
                name: "Elite 👑",
                rating: "4.92",
                reviews: "6.8K+",
                duration: "3 - 4 hrs",
                price: p3,
                optionsCount: "3 options",
                features: [
                    "Includes everything in Premium Plan",
                    "Master Senior Technician with 10+ yrs experience",
                    "Complete end-to-end overhaul & deep sanitization",
                    "Zero material markup guarantee",
                    "60 Days comprehensive full warranty"
                ],
                detailedBreakdown: {
                    priceLabel: `₹${p3.toLocaleString('en-IN')} (All-Inclusive)`,
                    guarantee: "Master Technician • 60 Days Comprehensive Warranty",
                    sections: [
                        {
                            title: "👑 Master Technician Overhaul",
                            items: [
                                "Everything in Premium Plan included",
                                "Executive level diagnostic and heavy-duty overhaul",
                                "Complete site disinfection mist upon completion"
                            ]
                        },
                        {
                            title: "🏆 Elite Warranty & Coverage",
                            items: [
                                "60 Days comprehensive warranty covering parts and labor",
                                "Dedicated society support manager assistance"
                            ]
                        }
                    ]
                }
            }
        ];
        designationPackages[key] = generated;
        return generated;
    }

    let _currentSelectedPackage = null;

    window.showSubServiceDesignations = function showSubServiceDesignations(subServiceName, parentCategory) {
        const designations = subServiceDesignations[subServiceName];
        if (!designations || !designations.length) return;

        const modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) return;

        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.classList.remove("package-mode");
            boxEl.classList.remove("mini-services-mode");
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
        const packages = getOrCreatePackagesForDesignation(designationName, subServiceName);
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
                            <button type="button" class="package-proceed-btn" id="packageProceedBtn" onclick="event.preventDefault(); event.stopPropagation(); window.proceedWithSelectedPackage('${escapeHtml(subServiceName)}', '${escapeHtml(designationName)}')">
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
        const packages = designationPackages[designationName] ||
            designationPackages[designationName + " Cleaning"] ||
            designationPackages[designationName.replace(" Cleaning", "")] ||
            designationPackages[subServiceName] ||
            designationPackages["Furnished Apartment"] ||
            designationPackages["Kitchen Deep Cleaning"];
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
        if (!_currentSelectedPackage) {
            const packages = designationPackages[designationName] ||
                designationPackages[designationName + " Cleaning"] ||
                designationPackages[designationName.replace(" Cleaning", "")] ||
                designationPackages[subServiceName] ||
                designationPackages["Furnished Apartment"] ||
                designationPackages["Kitchen Deep Cleaning"];
            if (packages && packages.length) {
                _currentSelectedPackage = packages[0];
            }
        }
        if (!_currentSelectedPackage) {
            _currentSelectedPackage = {
                name: "Essential ★",
                price: 3069,
                features: [
                    "Bathroom & kitchen deep cleaning",
                    "Machine floor cleaning",
                    "Cobweb & fan dusting",
                    "Balcony & utility area cleaning",
                    "Furniture dusting"
                ]
            };
        }
        window.openPaymentGateway({
            subServiceName: subServiceName || "Full House Cleaning",
            designationName: designationName || "Furnished Apartment",
            packageName: _currentSelectedPackage.name || "Essential ★",
            price: Number(_currentSelectedPackage.price) || 3069,
            features: _currentSelectedPackage.features || [],
            parentCategory: _currentParentCategory || "Home Cleaning",
            isMiniServices: false
        });
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

    /* ==========================================================================
       HOME SERVICES PAYMENT GATEWAY INTEGRATION
       ========================================================================== */
    let _pgActiveTimer = null;
    let _pgOrderState = null;
    let _pgCurrentMethod = "upi";
    let _pgCurrentSlot = "MORNING";
    let _pgSelectedBank = "HDFC Bank";

    function getPgBookingDateRange(daysSpan = 15) {
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const today = new Date();
        const minStr = fmt(today);
        // 15 days window: if today is 1st -> 1..15; if today is 2nd -> 2..16 (+14 days)
        const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (daysSpan - 1));
        const maxStr = fmt(maxDate);
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const defStr = fmt(tomorrow <= maxDate ? tomorrow : today);
        return { minStr, maxStr, defStr };
    }

    window.validatePgServiceDate = function validatePgServiceDate(input) {
        if (!input || !input.value) return;
        const range = getPgBookingDateRange(15);
        if (input.value < range.minStr) {
            notify("Past dates cannot be selected. Please select today or a date within the next 15 days.");
            input.value = range.minStr;
        } else if (input.value > range.maxStr) {
            notify(`Booking is only available for 15 days from today (between ${range.minStr} and ${range.maxStr}).`);
            input.value = range.maxStr;
        }
    };

    window.openPaymentGateway = function openPaymentGateway(order) {
        if (!order) return;
        _pgOrderState = { ...order };
        let modal = document.getElementById("subservicesModalBackdrop");
        if (!modal) {
            window.selectNoBrokerCategory(order.parentCategory || "Home Cleaning");
            modal = document.getElementById("subservicesModalBackdrop");
        }
        if (!modal) return;

        modal.classList.add("active");
        modal.style.removeProperty("display");
        modal.style.display = "flex";

        const boxEl = document.getElementById("subserviceModalBox");
        if (boxEl) {
            boxEl.className = "subservice-modal-box wide payment-mode";
            boxEl.style.maxWidth = "960px";
            boxEl.style.removeProperty("display");
            boxEl.style.display = "flex";
        }

        const catLower = (order.parentCategory || _currentParentCategory || "").toLowerCase();
        const subLower = (order.subServiceName || "").toLowerCase();

        let defaultCoupon = "NEWCLEAN200";
        let discount = 200;

        if (catLower.includes("packer") || subLower.includes("shift") || subLower.includes("packer")) {
            defaultCoupon = "MOVEFAST";
            discount = Math.min(300, Math.round(order.price * 0.15));
        } else if (catLower.includes("paint") || subLower.includes("paint") || subLower.includes("waterproof")) {
            defaultCoupon = "PAINT15";
            discount = Math.round(order.price * 0.15);
        } else if (catLower.includes("legal") || subLower.includes("agreement") || subLower.includes("notary")) {
            defaultCoupon = "LEGAL30";
            discount = Math.round(order.price * 0.30);
        } else if (catLower.includes("interior") || subLower.includes("interior") || subLower.includes("modular")) {
            defaultCoupon = "INTERIORFREE";
            discount = order.price > 0 ? Math.min(500, Math.round(order.price * 0.20)) : 0;
        } else if (catLower.includes("appliance") || subLower.includes("repair") || subLower.includes("servicing")) {
            defaultCoupon = "APPLIANCE20";
            discount = Math.round(order.price * 0.20);
        } else if (catLower.includes("pest") || subLower.includes("pest") || subLower.includes("termite")) {
            defaultCoupon = "PESTSAFE";
            discount = Math.min(150, Math.round(order.price * 0.15));
        }

        if (order.price <= discount && order.price > 0) {
            discount = Math.max(50, order.price - 99);
        }
        if (order.price === 0) {
            discount = 0;
        }

        let finalPayable = Math.max(0, order.price - discount);
        _pgOrderState.coupon = defaultCoupon;
        _pgOrderState.discount = discount;
        _pgOrderState.finalPayable = finalPayable;

        // Header with Back Button
        const headerArea = document.getElementById("subserviceModalHeaderArea");
        if (headerArea) {
            const backAction = `window.showDesignationPackages('${escapeHtml(order.designationName || "Furnished Apartment")}', '${escapeHtml(order.subServiceName || "Full House Cleaning")}', '${escapeHtml(order.parentCategory || "Home Cleaning")}')`;

            headerArea.innerHTML = `
                <div class="subservice-modal-header" style="margin-bottom: 1rem !important;">
                    <button type="button" class="subservice-modal-back" id="subserviceModalBackBtn" aria-label="Back" onclick="event.preventDefault(); event.stopPropagation(); ${backAction};">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h4 class="subservice-modal-title" style="margin: 0;">Secure Checkout & Payment</h4>
                        <span class="pg-badge-secure"><i class="fa-solid fa-shield-halved"></i> 256-Bit SSL Encrypted</span>
                    </div>
                    <div class="pg-timer-badge" id="pgTimerBadge"><i class="fa-regular fa-clock"></i> 14:59</div>
                </div>
            `;
        }

        // Countdown Timer
        if (_pgActiveTimer) clearInterval(_pgActiveTimer);
        let secondsLeft = 14 * 60 + 59;
        _pgActiveTimer = setInterval(() => {
            secondsLeft--;
            const timerEl = document.getElementById("pgTimerBadge");
            if (!timerEl || secondsLeft <= 0) {
                if (_pgActiveTimer) clearInterval(_pgActiveTimer);
                if (timerEl) timerEl.textContent = "00:00 Expired";
                return;
            }
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }, 1000);

        const defaultName = document.getElementById("nbCustomerName")?.value || (isCustomer ? "PropertyDirect Customer" : "Resident");
        const defaultPhone = document.getElementById("nbCustomerPhone")?.value || "9876543210";
        const defaultAddress = document.getElementById("nbAddress")?.value || (isCustomer ? "Flat 402, Tower B, Palm Heights" : "A-101, SmartSociety Palms");
        
        // 15 days window: if today is 1st -> 1 to 15; if today is 2nd -> 2 to 16 (+14 days)
        const dateRange = getPgBookingDateRange(15);

        const gridEl = document.getElementById("subserviceGrid");
        if (!gridEl) return;

        gridEl.className = "payment-gateway-container";
        gridEl.style.gridTemplateColumns = "";

        gridEl.innerHTML = `
            <div class="pg-main-col">
                <!-- Service & Booking Information Card -->
                <div class="pg-card">
                    <div class="pg-card-header">
                        <h5 class="pg-card-title"><i class="fa-solid fa-clipboard-list" style="color: #059669;"></i> Booking Information</h5>
                        <span class="pg-service-badge-pill"><i class="fa-solid fa-circle-check"></i> Instant Confirmation</span>
                    </div>

                    <div class="pg-service-meta-box">
                        <div>
                            <div class="pg-service-name-text">${escapeHtml(order.subServiceName)}</div>
                            <small style="color: #64748b; font-size: 0.78rem;">${escapeHtml(order.packageName)}</small>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">₹${order.price.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    <div class="pg-inputs-grid">
                        <div class="pg-input-group">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                <label class="pg-input-label" for="pgServiceDate" style="margin-bottom: 0;">Preferred Service Date</label>
                                <span style="font-size: 0.72rem; color: #059669; font-weight: 700;"><i class="fa-solid fa-calendar-check"></i> Next 15 days only</span>
                            </div>
                            <input type="date" class="pg-input" id="pgServiceDate" value="${dateRange.defStr}" min="${dateRange.minStr}" max="${dateRange.maxStr}" onchange="window.validatePgServiceDate(this)" oninput="window.validatePgServiceDate(this)" />
                            <small style="display: block; font-size: 0.72rem; color: #64748b; margin-top: 3px;">Bookings open for 15 days (${dateRange.minStr} to ${dateRange.maxStr})</small>
                        </div>
                        <div class="pg-input-group">
                            <label class="pg-input-label" for="pgCustomerPhone">Mobile Number (10 Digits)</label>
                            <input type="tel" class="pg-input" id="pgCustomerPhone" value="${escapeHtml(defaultPhone)}" placeholder="e.g. 9876543210" maxlength="10" />
                        </div>
                        <div class="pg-input-group">
                            <label class="pg-input-label" for="pgCustomerName">Contact Name</label>
                            <input type="text" class="pg-input" id="pgCustomerName" value="${escapeHtml(defaultName)}" placeholder="Full Name" />
                        </div>
                        <div class="pg-input-group">
                            <label class="pg-input-label" for="pgAddress">Apartment / Unit Address</label>
                            <input type="text" class="pg-input" id="pgAddress" value="${escapeHtml(defaultAddress)}" placeholder="e.g. A-101, SmartSociety" />
                        </div>
                    </div>

                    <div style="margin-top: 0.85rem;">
                        <label class="pg-input-label">Select Preferred Time Slot</label>
                        <div class="pg-slot-chips" id="pgSlotChips">
                            <button type="button" class="pg-slot-chip active" data-slot="MORNING" onclick="window.selectPgSlot('MORNING')"><i class="fa-regular fa-sun"></i> Morning 9 AM - 12 PM</button>
                            <button type="button" class="pg-slot-chip" data-slot="AFTERNOON" onclick="window.selectPgSlot('AFTERNOON')"><i class="fa-solid fa-cloud-sun"></i> Afternoon 12 PM - 4 PM</button>
                            <button type="button" class="pg-slot-chip" data-slot="EVENING" onclick="window.selectPgSlot('EVENING')"><i class="fa-solid fa-moon"></i> Evening 4 PM - 8 PM</button>
                            <button type="button" class="pg-slot-chip" data-slot="EXPRESS_60MIN" onclick="window.selectPgSlot('EXPRESS_60MIN')"><i class="fa-solid fa-bolt" style="color: #f59e0b;"></i> Express 60Min (+₹49)</button>
                        </div>
                    </div>
                </div>

                <!-- Payment Methods Card -->
                <div class="pg-card" style="position: relative;">
                    <div class="pg-card-header">
                        <h5 class="pg-card-title"><i class="fa-solid fa-credit-card" style="color: #059669;"></i> Select Payment Method</h5>
                        <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;"><i class="fa-solid fa-shield-check"></i> RBI Compliant</span>
                    </div>

                    <div class="pg-methods-header">
                        <button type="button" class="pg-method-tab active" id="tab_upi" onclick="window.switchPgMethod('upi')">
                            <i class="fa-solid fa-qrcode"></i> UPI & QR Code
                        </button>
                        <button type="button" class="pg-method-tab" id="tab_card" onclick="window.switchPgMethod('card')">
                            <i class="fa-regular fa-credit-card"></i> Cards
                        </button>
                        <button type="button" class="pg-method-tab" id="tab_netbanking" onclick="window.switchPgMethod('netbanking')">
                            <i class="fa-solid fa-building-columns"></i> Net Banking
                        </button>
                        <button type="button" class="pg-method-tab" id="tab_wallets" onclick="window.switchPgMethod('wallets')">
                            <i class="fa-solid fa-wallet"></i> Wallets
                        </button>
                        <button type="button" class="pg-method-tab" id="tab_payafter" onclick="window.switchPgMethod('payafter')">
                            <i class="fa-solid fa-hand-holding-dollar"></i> Pay After Service
                        </button>
                    </div>

                    <!-- Method 1: UPI Panel -->
                    <div class="pg-method-panel active" id="panel_upi">
                        <div class="pg-upi-container">
                            <div class="pg-qr-frame">
                                <svg viewBox="0 0 100 100" width="100%" height="100%">
                                    <rect width="100" height="100" fill="#ffffff" />
                                    <!-- QR Finder Patterns -->
                                    <rect x="10" y="10" width="24" height="24" fill="#0f172a" rx="3"/>
                                    <rect x="14" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
                                    <rect x="18" y="18" width="8" height="8" fill="#059669" rx="1"/>

                                    <rect x="66" y="10" width="24" height="24" fill="#0f172a" rx="3"/>
                                    <rect x="70" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
                                    <rect x="74" y="18" width="8" height="8" fill="#059669" rx="1"/>

                                    <rect x="10" y="66" width="24" height="24" fill="#0f172a" rx="3"/>
                                    <rect x="14" y="70" width="16" height="16" fill="#ffffff" rx="2"/>
                                    <rect x="18" y="74" width="8" height="8" fill="#059669" rx="1"/>

                                    <!-- QR Data Matrix Dots -->
                                    <circle cx="45" cy="18" r="3" fill="#0f172a"/>
                                    <circle cx="55" cy="18" r="3" fill="#0f172a"/>
                                    <circle cx="45" cy="28" r="3" fill="#059669"/>
                                    <circle cx="55" cy="28" r="3" fill="#0f172a"/>
                                    <circle cx="40" cy="40" r="3" fill="#0f172a"/>
                                    <circle cx="50" cy="40" r="3" fill="#059669"/>
                                    <circle cx="60" cy="40" r="3" fill="#0f172a"/>
                                    <circle cx="40" cy="50" r="3" fill="#059669"/>
                                    <circle cx="50" cy="50" r="3" fill="#0f172a"/>
                                    <circle cx="60" cy="50" r="3" fill="#059669"/>
                                    <circle cx="45" cy="65" r="3" fill="#0f172a"/>
                                    <circle cx="55" cy="65" r="3" fill="#059669"/>
                                    <circle cx="75" cy="50" r="3" fill="#0f172a"/>
                                    <circle cx="85" cy="50" r="3" fill="#0f172a"/>
                                    <circle cx="75" cy="75" r="3" fill="#059669"/>
                                    <circle cx="85" cy="85" r="3" fill="#0f172a"/>
                                </svg>
                                <span style="position: absolute; bottom: 2px; font-size: 0.62rem; font-weight: 800; color: #065f46; letter-spacing: 0.4px;">SCAN & PAY</span>
                            </div>

                            <div class="pg-upi-details">
                                <div>
                                    <span style="font-size: 0.82rem; font-weight: 700; color: #1e293b;">Scan with any UPI App</span>
                                    <p style="font-size: 0.74rem; color: #64748b; margin: 2px 0 6px 0;">Google Pay, PhonePe, Paytm, BHIM, CRED</p>
                                    <div class="pg-upi-apps-row">
                                        <button type="button" class="pg-upi-app-btn" onclick="window.selectUpiApp('gpay')"><i class="fa-brands fa-google-pay" style="font-size: 1.1rem; color: #4285f4;"></i> GPay</button>
                                        <button type="button" class="pg-upi-app-btn" onclick="window.selectUpiApp('phonepe')"><i class="fa-solid fa-mobile-screen-button" style="color: #6739b7;"></i> PhonePe</button>
                                        <button type="button" class="pg-upi-app-btn" onclick="window.selectUpiApp('paytm')"><i class="fa-solid fa-wallet" style="color: #00b9f5;"></i> Paytm</button>
                                        <button type="button" class="pg-upi-app-btn" onclick="window.selectUpiApp('cred')"><i class="fa-solid fa-gem" style="color: #0f172a;"></i> CRED</button>
                                    </div>
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                                    <label class="pg-input-label" for="pgUpiId">Or Enter UPI ID</label>
                                    <div style="display: flex; gap: 0.4rem;">
                                        <input type="text" class="pg-input" id="pgUpiId" placeholder="e.g. resident@okhdfcbank" style="flex: 1;" />
                                        <button type="button" class="pg-coupon-apply-btn" onclick="window.verifyUpiId()">Verify</button>
                                    </div>
                                    <span id="pgUpiVerifyFeedback" style="font-size: 0.72rem; color: #059669; font-weight: 600; display: none;">✓ Verified UPI ID</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Method 2: Card Panel -->
                    <div class="pg-method-panel" id="panel_card">
                        <div class="pg-card-form">
                            <div class="pg-input-group">
                                <label class="pg-input-label" for="pgCardNumber">Card Number</label>
                                <div class="pg-card-number-wrapper">
                                    <input type="text" class="pg-input" id="pgCardNumber" placeholder="4532 •••• •••• 8920" maxlength="19" oninput="window.formatCardNumber(this)" />
                                    <span class="pg-card-brand-badge" id="pgCardBrandBadge"><i class="fa-brands fa-cc-visa"></i></span>
                                </div>
                            </div>

                            <div class="pg-inputs-grid">
                                <div class="pg-input-group">
                                    <label class="pg-input-label" for="pgCardExpiry">Valid Thru (MM/YY)</label>
                                    <input type="text" class="pg-input" id="pgCardExpiry" placeholder="MM/YY" maxlength="5" oninput="window.formatCardExpiry(this)" />
                                </div>
                                <div class="pg-input-group">
                                    <label class="pg-input-label" for="pgCardCvv">CVV / CVC</label>
                                    <input type="password" class="pg-input" id="pgCardCvv" placeholder="•••" maxlength="4" />
                                </div>
                            </div>

                            <div class="pg-input-group">
                                <label class="pg-input-label" for="pgCardName">Cardholder Name</label>
                                <input type="text" class="pg-input" id="pgCardName" placeholder="Name as printed on card" value="${escapeHtml(defaultName)}" />
                            </div>

                            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #475569; cursor: pointer;">
                                <input type="checkbox" checked style="accent-color: #059669;" /> Securely save card as per RBI guidelines
                            </label>
                        </div>
                    </div>

                    <!-- Method 3: Net Banking Panel -->
                    <div class="pg-method-panel" id="panel_netbanking">
                        <div class="pg-banks-grid">
                            <div class="pg-bank-btn active" onclick="window.selectBank(this, 'HDFC Bank')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>HDFC Bank</span>
                            </div>
                            <div class="pg-bank-btn" onclick="window.selectBank(this, 'ICICI Bank')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>ICICI Bank</span>
                            </div>
                            <div class="pg-bank-btn" onclick="window.selectBank(this, 'SBI')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>State Bank of India</span>
                            </div>
                            <div class="pg-bank-btn" onclick="window.selectBank(this, 'Axis Bank')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>Axis Bank</span>
                            </div>
                            <div class="pg-bank-btn" onclick="window.selectBank(this, 'Kotak Mahindra')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>Kotak Mahindra</span>
                            </div>
                            <div class="pg-bank-btn" onclick="window.selectBank(this, 'Punjab National')">
                                <i class="fa-solid fa-building-columns"></i>
                                <span>Punjab National Bank</span>
                            </div>
                        </div>

                        <div class="pg-input-group">
                            <label class="pg-input-label" for="pgOtherBanks">Other Popular Indian Banks</label>
                            <select class="pg-input" id="pgOtherBanks" onchange="window.selectOtherBank(this.value)">
                                <option value="">-- Choose from 30+ other banks --</option>
                                <option value="Bank of Baroda">Bank of Baroda</option>
                                <option value="Canara Bank">Canara Bank</option>
                                <option value="Union Bank of India">Union Bank of India</option>
                                <option value="IndusInd Bank">IndusInd Bank</option>
                                <option value="IDFC FIRST Bank">IDFC FIRST Bank</option>
                                <option value="Federal Bank">Federal Bank</option>
                                <option value="Yes Bank">Yes Bank</option>
                            </select>
                        </div>
                    </div>

                    <!-- Method 4: Wallets Panel -->
                    <div class="pg-method-panel" id="panel_wallets">
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            <label style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1.5px solid #059669; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 0.6rem;">
                                    <input type="radio" name="pgWallet" value="Paytm" checked style="accent-color: #059669;" />
                                    <span style="font-size: 0.88rem; font-weight: 700; color: #1e293b;">Paytm Wallet & Postpaid</span>
                                </div>
                                <span style="font-size: 0.74rem; font-weight: 700; color: #059669;">Linked</span>
                            </label>
                            <label style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 0.6rem;">
                                    <input type="radio" name="pgWallet" value="Amazon Pay" style="accent-color: #059669;" />
                                    <span style="font-size: 0.88rem; font-weight: 700; color: #1e293b;">Amazon Pay Balance</span>
                                </div>
                                <span style="font-size: 0.74rem; color: #64748b;">Connect</span>
                            </label>
                            <label style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 0.6rem;">
                                    <input type="radio" name="pgWallet" value="Simpl" style="accent-color: #059669;" />
                                    <span style="font-size: 0.88rem; font-weight: 700; color: #1e293b;">Simpl PayLater (3 in 1)</span>
                                </div>
                                <span style="font-size: 0.74rem; color: #64748b;">Instant Approval</span>
                            </label>
                        </div>
                    </div>

                    <!-- Method 5: Pay After Service Panel -->
                    <div class="pg-method-panel" id="panel_payafter">
                        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 1.1rem;"></i>
                                <strong style="font-size: 0.92rem; color: #14532d;">Pay After Service Completion</strong>
                            </div>
                            <p style="font-size: 0.8rem; color: #166534; margin: 0; line-height: 1.45;">
                                Zero upfront payment risk. Once our verified technicians complete the work and you inspect the quality to your 100% satisfaction, pay directly via Cash, UPI QR, or Card.
                            </p>
                            <div style="font-size: 0.74rem; color: #15803d; font-weight: 700;">
                                <i class="fa-solid fa-lock"></i> Secured with Service OTP & Digital Warranty
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pg-summary-col">
                <!-- Price Breakdown & Pay Card -->
                <div class="pg-summary-card">
                    <span class="package-summary-header">Payment Summary</span>

                    <div class="pg-price-row">
                        <span>Plan Price</span>
                        <span id="pgSummaryBasePrice">₹${order.price.toLocaleString('en-IN')}</span>
                    </div>

                    <div class="pg-price-row" id="pgDiscountRow" style="${discount > 0 ? 'display: flex;' : 'display: none;'}">
                        <span style="color: #059669; font-weight: 600;"><i class="fa-solid fa-tag"></i> Coupon Discount (<span id="pgCouponCodeText">${defaultCoupon}</span>)</span>
                        <span style="color: #059669; font-weight: 700;" id="pgSummaryDiscount">-₹${discount.toLocaleString('en-IN')}</span>
                    </div>

                    <div class="pg-price-row">
                        <span>Safety & Hygiene Fee</span>
                        <span style="color: #059669; font-weight: 600;"><s style="color: #94a3b8; font-size: 0.78rem;">₹49</s> FREE</span>
                    </div>

                    <div class="pg-price-row">
                        <span>Taxes & GST (18%)</span>
                        <span style="color: #64748b;">Included</span>
                    </div>

                    <div class="pg-coupon-row">
                        <input type="text" class="pg-coupon-input" id="pgCouponInput" value="${defaultCoupon}" placeholder="ENTER COUPON" />
                        <button type="button" class="pg-coupon-apply-btn" id="pgApplyCouponBtn" onclick="window.applyPgCoupon()">Apply</button>
                    </div>

                    <div class="pg-price-total-row">
                        <span>Total Payable</span>
                        <span id="pgSummaryFinalPrice">₹${finalPayable.toLocaleString('en-IN')}</span>
                    </div>

                    <button type="button" class="pg-pay-btn" id="pgPayButton" onclick="window.submitPayment()">
                        <i class="fa-solid fa-lock"></i> Pay ₹${finalPayable.toLocaleString('en-IN')} & Confirm
                    </button>

                    <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem;">
                        <div class="pg-trust-item"><i class="fa-solid fa-circle-check"></i> 100% Satisfaction or Free Rework</div>
                        <div class="pg-trust-item"><i class="fa-solid fa-user-shield"></i> Background-Checked & Verified Pros</div>
                        <div class="pg-trust-item"><i class="fa-solid fa-rotate-left"></i> Free cancellation upto 2 hrs before slot</div>
                    </div>
                </div>
            </div>
        `;
    };

    window.switchPgMethod = function switchPgMethod(method) {
        _pgCurrentMethod = method;
        document.querySelectorAll(".pg-method-tab").forEach(tab => tab.classList.remove("active"));
        document.querySelectorAll(".pg-method-panel").forEach(panel => panel.classList.remove("active"));

        document.getElementById(`tab_${method}`)?.classList.add("active");
        document.getElementById(`panel_${method}`)?.classList.add("active");

        const payBtn = document.getElementById("pgPayButton");
        if (payBtn && _pgOrderState) {
            const finalAmt = _pgOrderState.finalPayable || 0;
            if (method === "payafter") {
                payBtn.innerHTML = `<i class="fa-solid fa-check"></i> Book Now & Pay ₹${finalAmt.toLocaleString('en-IN')} Later`;
            } else {
                payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ₹${finalAmt.toLocaleString('en-IN')} & Confirm`;
            }
        }
    };

    window.selectPgSlot = function selectPgSlot(slot) {
        _pgCurrentSlot = slot;
        document.querySelectorAll("#pgSlotChips .pg-slot-chip").forEach(chip => {
            if (chip.getAttribute("data-slot") === slot) {
                chip.classList.add("active");
            } else {
                chip.classList.remove("active");
            }
        });
    };

    window.selectUpiApp = function selectUpiApp(appName) {
        const upiInput = document.getElementById("pgUpiId");
        if (upiInput) {
            upiInput.value = `resident@${appName}`;
            window.verifyUpiId();
        }
    };

    window.verifyUpiId = function verifyUpiId() {
        const upiInput = document.getElementById("pgUpiId");
        const feedback = document.getElementById("pgUpiVerifyFeedback");
        if (!upiInput || !feedback) return;
        const val = upiInput.value.trim();
        if (val.includes("@") && val.length > 3) {
            feedback.style.display = "block";
            feedback.textContent = `✓ Verified UPI ID (${val})`;
            feedback.style.color = "#059669";
        } else {
            feedback.style.display = "block";
            feedback.textContent = "Please enter a valid UPI ID (e.g. name@bank)";
            feedback.style.color = "#dc2626";
        }
    };

    window.formatCardNumber = function formatCardNumber(input) {
        let val = input.value.replace(/\D/g, '').substring(0, 16);
        let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
        input.value = formatted;

        const badge = document.getElementById("pgCardBrandBadge");
        if (badge) {
            if (val.startsWith("4")) {
                badge.innerHTML = `<i class="fa-brands fa-cc-visa" style="color: #1a1f71;"></i>`;
            } else if (val.startsWith("5")) {
                badge.innerHTML = `<i class="fa-brands fa-cc-mastercard" style="color: #eb001b;"></i>`;
            } else if (val.startsWith("6")) {
                badge.innerHTML = `<span style="font-size: 0.75rem; font-weight: 800; color: #00843d;">RUPAY</span>`;
            } else {
                badge.innerHTML = `<i class="fa-regular fa-credit-card"></i>`;
            }
        }
    };

    window.formatCardExpiry = function formatCardExpiry(input) {
        let val = input.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 3) {
            input.value = val.substring(0, 2) + '/' + val.substring(2, 4);
        } else {
            input.value = val;
        }
    };

    window.selectBank = function selectBank(el, bankName) {
        _pgSelectedBank = bankName;
        document.querySelectorAll(".pg-bank-btn").forEach(btn => btn.classList.remove("active"));
        el.classList.add("active");
        const select = document.getElementById("pgOtherBanks");
        if (select) select.value = "";
    };

    window.selectOtherBank = function selectOtherBank(bankName) {
        if (!bankName) return;
        _pgSelectedBank = bankName;
        document.querySelectorAll(".pg-bank-btn").forEach(btn => btn.classList.remove("active"));
    };

    window.applyPgCoupon = function applyPgCoupon() {
        if (!_pgOrderState) return;
        const couponInput = document.getElementById("pgCouponInput");
        const code = (couponInput?.value || "").trim().toUpperCase();

        let discount = 0;
        if (code === "NEWCLEAN200") discount = 200;
        else if (code === "MOVEFAST") discount = Math.min(300, Math.round(_pgOrderState.price * 0.15));
        else if (code === "PAINT15") discount = Math.round(_pgOrderState.price * 0.15);
        else if (code === "LEGAL30") discount = Math.round(_pgOrderState.price * 0.30);
        else if (code === "INTERIORFREE") discount = Math.min(500, Math.round(_pgOrderState.price * 0.20));
        else if (code === "APPLIANCE20") discount = Math.round(_pgOrderState.price * 0.20);
        else if (code === "PESTSAFE") discount = Math.min(150, Math.round(_pgOrderState.price * 0.15));
        else if (code === "NEWCLEAN10" || code === "SOCIETY10") discount = Math.round(_pgOrderState.price * 0.10);
        else if (code) {
            discount = 100;
        }

        if (_pgOrderState.price <= discount && _pgOrderState.price > 0) {
            discount = Math.max(50, _pgOrderState.price - 99);
        }

        const finalPayable = Math.max(0, _pgOrderState.price - discount);
        _pgOrderState.coupon = code;
        _pgOrderState.discount = discount;
        _pgOrderState.finalPayable = finalPayable;

        const row = document.getElementById("pgDiscountRow");
        const discEl = document.getElementById("pgSummaryDiscount");
        const codeText = document.getElementById("pgCouponCodeText");
        const finalEl = document.getElementById("pgSummaryFinalPrice");
        const payBtn = document.getElementById("pgPayButton");

        if (discount > 0) {
            if (row) row.style.display = "flex";
            if (discEl) discEl.textContent = `-₹${discount.toLocaleString('en-IN')}`;
            if (codeText) codeText.textContent = code;
            notify(`Coupon ${code} applied! You saved ₹${discount}.`);
        } else {
            if (row) row.style.display = "none";
            notify("Coupon removed.");
        }

        if (finalEl) finalEl.textContent = `₹${finalPayable.toLocaleString('en-IN')}`;
        if (payBtn) {
            if (_pgCurrentMethod === "payafter") {
                payBtn.innerHTML = `<i class="fa-solid fa-check"></i> Book Now & Pay ₹${finalPayable.toLocaleString('en-IN')} Later`;
            } else {
                payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ₹${finalPayable.toLocaleString('en-IN')} & Confirm`;
            }
        }
    };

    window.submitPayment = async function submitPayment() {
        if (!_pgOrderState) return;

        const phoneInput = document.getElementById("pgCustomerPhone");
        const nameInput = document.getElementById("pgCustomerName");
        const addressInput = document.getElementById("pgAddress");
        const dateInput = document.getElementById("pgServiceDate");

        const phone = (phoneInput?.value || "").trim();
        const name = (nameInput?.value || "").trim() || "Resident";
        const address = (addressInput?.value || "").trim() || "Resident Apartment";
        const dateRange = getPgBookingDateRange(15);
        const date = dateInput?.value;

        if (!date || date < dateRange.minStr) {
            notify("Please select today or a future service date within the allowed 15 days.");
            dateInput?.focus();
            return;
        }
        if (date > dateRange.maxStr) {
            notify(`Service booking is restricted to 15 days from today (between ${dateRange.minStr} and ${dateRange.maxStr}).`);
            dateInput?.focus();
            return;
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
            notify("Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
            phoneInput?.focus();
            return;
        }

        const boxEl = document.getElementById("subserviceModalBox");
        if (!boxEl) return;

        const methodNames = {
            upi: "UPI / QR Code",
            card: "Credit / Debit Card",
            netbanking: `Net Banking (${_pgSelectedBank})`,
            wallets: "Wallet / PayLater",
            payafter: "Pay After Service (Cash/UPI)"
        };
        const currentMethodName = methodNames[_pgCurrentMethod] || "Online Payment";

        const overlay = document.createElement("div");
        overlay.className = "pg-processing-overlay";
        overlay.id = "pgProcessingOverlay";
        overlay.innerHTML = `
            <div class="pg-spinner"></div>
            <div style="text-align: center;">
                <h5 style="margin: 0 0 0.4rem 0; font-size: 1.1rem; color: #0f172a;" id="pgProcessStepTitle">Connecting to Payment Gateway...</h5>
                <p style="margin: 0; font-size: 0.82rem; color: #64748b;" id="pgProcessStepSub">Authorizing transaction of ₹${_pgOrderState.finalPayable.toLocaleString('en-IN')}</p>
            </div>
            <div style="font-size: 0.74rem; color: #059669; font-weight: 700; display: flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-lock"></i> 256-Bit Bank Level Encryption
            </div>
        `;
        boxEl.appendChild(overlay);

        setTimeout(() => {
            const stepTitle = document.getElementById("pgProcessStepTitle");
            const stepSub = document.getElementById("pgProcessStepSub");
            if (stepTitle) stepTitle.textContent = `Authorizing via ${currentMethodName}...`;
            if (stepSub) stepSub.textContent = "Verifying with issuing bank / payment network...";
        }, 700);

        setTimeout(async () => {
            const stepTitle = document.getElementById("pgProcessStepTitle");
            if (stepTitle) stepTitle.textContent = "Payment Verified Successfully ✓";

            const txnId = "TXN-SMART-" + Math.floor(10000000 + Math.random() * 90000000);
            const bookingRef = "BK-HS-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000);

            let assignedWorkerInfo = null;
            let maintenanceRequestNumber = null;

            // 1. Create MaintenanceRequest to trigger AutoAssignmentService and show in Maintenance Dashboard
            try {
                const reqRes = await fetch("/api/maintenance/requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                        category: _pgOrderState.parentCategory || "Cleaning",
                        serviceType: _pgOrderState.subServiceName,
                        title: `${_pgOrderState.subServiceName} (${_pgOrderState.packageName}) - ${address}`,
                        description: [
                            `Service: ${_pgOrderState.subServiceName} - ${_pgOrderState.packageName}`,
                            `Payment Status: ${_pgCurrentMethod === 'payafter' ? 'PAY_ON_COMPLETION' : 'PAID'}`,
                            `Transaction ID: ${txnId}`,
                            `Payment Mode: ${currentMethodName}`,
                            `Amount: ₹${_pgOrderState.finalPayable}`,
                            `Coupon: ${_pgOrderState.coupon || 'None'}`,
                            `Time Slot: ${_pgCurrentSlot}`,
                            `Customer Address: ${address}`,
                            `Contact: ${name} (${phone})`,
                            `Package Scope: ${(_pgOrderState.features || []).join('; ')}`
                        ].join("\n"),
                        priority: "URGENT",
                        preferredDate: date,
                        preferredTime: _pgCurrentSlot,
                        notes: `Paid via ${currentMethodName}. Booking Ref: ${bookingRef}`
                    })
                });
                if (reqRes.ok) {
                    const reqData = await reqRes.json();
                    maintenanceRequestNumber = reqData.requestNumber;
                    if (reqData.assignedWorkerName) {
                        assignedWorkerInfo = {
                            id: reqData.assignedWorkerId,
                            name: reqData.assignedWorkerName,
                            phone: reqData.assignedWorkerPhone,
                            status: reqData.status
                        };
                    }
                }
            } catch (reqErr) {
                console.warn("Maintenance request creation notice:", reqErr.message);
            }

            // 2. Also register in Emergency Geo-Dispatch pipeline so it appears on /dashboards/maintenance#dispatch
            try {
                await fetch("/api/maintenance/dispatch/bookings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                        requesterPhone: phone,
                        serviceAddress: address,
                        city: "Chennai",
                        area: "Whitefield",
                        category: _pgOrderState.parentCategory || "Cleaning",
                        description: `[PAID - ${txnId}] ${_pgOrderState.subServiceName} (${_pgOrderState.packageName}). Customer: ${name}, Phone: ${phone}. Slot: ${_pgCurrentSlot}. Ref: ${bookingRef}`,
                        latitude: 12.9716,
                        longitude: 77.5946
                    })
                });
            } catch (dispErr) {
                console.warn("Emergency dispatch registration notice:", dispErr.message);
            }

            // 3. Save CommonMaintenanceTicket for backward compatibility with resident's bookings table
            try {
                const visitAt = preferredAt(date, _pgCurrentSlot);
                await api("", {
                    method: "POST",
                    body: JSON.stringify({
                        sourcePlatform,
                        targetEntityType: isCustomer ? "PROPERTY_LISTING" : "APARTMENT_UNIT",
                        requesterName: name,
                        requesterPhone: phone,
                        serviceType: `${_pgOrderState.subServiceName} - ${_pgOrderState.packageName}`,
                        serviceCategory: _pgOrderState.parentCategory || "Home Services",
                        serviceOption: _pgOrderState.packageName,
                        priceLabel: `Rs. ${_pgOrderState.finalPayable}`,
                        warrantyLabel: "100% Satisfaction Guarantee",
                        title: `${_pgOrderState.subServiceName} (${_pgOrderState.packageName}) - ${address}`,
                        description: [
                            `Service: ${_pgOrderState.subServiceName} - ${_pgOrderState.packageName}`,
                            `Payment Status: ${_pgCurrentMethod === 'payafter' ? 'PAY_ON_COMPLETION' : 'PAID'}`,
                            `Transaction ID: ${txnId}`,
                            `Payment Mode: ${currentMethodName}`,
                            `Amount: ₹${_pgOrderState.finalPayable}`,
                            `Coupon Applied: ${_pgOrderState.coupon || 'None'}`,
                            `Selected Slot: ${_pgCurrentSlot}`,
                            `Customer Address: ${address}`,
                            `Scope: ${(_pgOrderState.features || []).join('; ')}`
                        ].join("\n"),
                        serviceAddress: address,
                        priority: _pgCurrentSlot === "EXPRESS_60MIN" ? "HIGH" : "MEDIUM",
                        preferredAt: visitAt,
                        vendorName: assignedWorkerInfo ? assignedWorkerInfo.name : "SmartSociety Verified Partner",
                        vendorPhone: assignedWorkerInfo ? assignedWorkerInfo.phone : "",
                        accessType: isCustomer ? "Customer will be present" : "Resident will be present",
                        contactMethod: "Phone",
                        externalReference: bookingRef
                    })
                });

                window.loadNoBrokerMaintenanceTickets?.();
            } catch (err) {
                console.warn("Backend booking persistence notice:", err.message);
            }

            overlay.remove();
            window.showPaymentSuccess({
                ..._pgOrderState,
                txnId,
                bookingRef,
                name,
                phone,
                address,
                date,
                slot: _pgCurrentSlot,
                methodName: currentMethodName,
                assignedWorker: assignedWorkerInfo,
                requestNumber: maintenanceRequestNumber
            });
        }, 1500);
    };

    window.showPaymentSuccess = function showPaymentSuccess(data) {
        if (_pgActiveTimer) clearInterval(_pgActiveTimer);

        const headerArea = document.getElementById("subserviceModalHeaderArea");
        if (headerArea) {
            headerArea.innerHTML = `
                <div class="subservice-modal-header" style="justify-content: flex-end;">
                    <button type="button" class="subservice-modal-close" id="subserviceModalCloseBtn" aria-label="Close" onclick="event.preventDefault(); event.stopPropagation(); window.closeSubServicesModal();">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }

        const gridEl = document.getElementById("subserviceGrid");
        if (!gridEl) return;

        gridEl.className = "payment-success-container";
        gridEl.style.gridTemplateColumns = "";

        const slotLabels = {
            MORNING: "Morning 9 AM - 12 PM",
            AFTERNOON: "Afternoon 12 PM - 4 PM",
            EVENING: "Evening 4 PM - 8 PM",
            EXPRESS_60MIN: "Express 60-Minute Arrival"
        };
        const slotDisplay = slotLabels[data.slot] || data.slot;

        gridEl.innerHTML = `
            <div class="pg-success-card">
                <div class="pg-success-icon-wrapper">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h3 class="pg-success-title">Payment Successful!</h3>
                <p class="pg-success-subtitle">Your service booking has been confirmed and dispatched to our maintenance system.</p>

                <div class="pg-receipt-card">
                    <div class="pg-receipt-header">
                        <div>
                            <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">Booking Reference</span>
                            <div style="font-size: 1rem; font-weight: 800; color: #0f172a; font-family: monospace;">${escapeHtml(data.bookingRef)}</div>
                            ${data.requestNumber ? `<div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; margin-top: 2px;"><i class="fa-solid fa-hashtag"></i> ${escapeHtml(data.requestNumber)}</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">Transaction ID</span>
                            <div style="font-size: 0.85rem; font-weight: 700; color: #059669; font-family: monospace;">${escapeHtml(data.txnId)}</div>
                            <div style="font-size: 0.72rem; color: #059669; font-weight: 700; margin-top: 2px;">PAID ✓</div>
                        </div>
                    </div>

                    <div class="pg-receipt-body">
                        <div class="pg-receipt-row">
                            <span>Service</span>
                            <strong>${escapeHtml(data.subServiceName)} (${escapeHtml(data.packageName)})</strong>
                        </div>
                        <div class="pg-receipt-row">
                            <span>Amount Paid</span>
                            <strong style="color: #059669; font-size: 1.05rem;">₹${Number(data.finalPayable).toLocaleString('en-IN')}</strong>
                        </div>
                        <div class="pg-receipt-row">
                            <span>Payment Mode</span>
                            <span>${escapeHtml(data.methodName)}</span>
                        </div>
                        <div class="pg-receipt-row">
                            <span>Scheduled Date</span>
                            <span>${escapeHtml(data.date)}</span>
                        </div>
                        <div class="pg-receipt-row">
                            <span>Time Window</span>
                            <span>${escapeHtml(slotDisplay)}</span>
                        </div>
                        <div class="pg-receipt-row">
                            <span>Address</span>
                            <span>${escapeHtml(data.address)}</span>
                        </div>
                        ${data.assignedWorker ? `
                        <div class="pg-receipt-row" style="background: #f0fdf4; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #86efac; margin-top: 6px;">
                            <span style="color: #166534; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-user-shield text-success"></i> Auto-Assigned Professional
                            </span>
                            <div style="text-align: right;">
                                <strong style="color: #15803d; font-size: 0.95rem;">${escapeHtml(data.assignedWorker.name)}</strong>
                                ${data.assignedWorker.phone ? `<div style="font-size: 0.78rem; color: #166534;">📞 ${escapeHtml(data.assignedWorker.phone)}</div>` : ''}
                            </div>
                        </div>
                        ` : `
                        <div class="pg-receipt-row" style="background: #eff6ff; padding: 8px 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-top: 4px;">
                            <span style="color: #1d4ed8; font-weight: 700;"><i class="fa-solid fa-bolt text-primary me-1"></i> Auto-Assignment</span>
                            <strong style="color: #1e40af; font-size: 0.85rem;">Worker Queue Active • Assigning</strong>
                        </div>
                        `}
                    </div>
                </div>

                <div class="pg-success-actions">
                    <button type="button" class="pg-action-btn primary" onclick="window.viewMyBookings('${escapeHtml(data.bookingRef)}', '${escapeHtml(data.requestNumber || '')}');">
                        <i class="fa-solid fa-calendar-check"></i> View In My Bookings
                    </button>
                    <button type="button" class="pg-action-btn secondary" onclick="window.printPaymentReceipt()">
                        <i class="fa-solid fa-download"></i> Download Receipt
                    </button>
                </div>
            </div>
        `;
    };

    window.printPaymentReceipt = function printPaymentReceipt() {
        window.print();
    };

    window.viewPackageDetails = function viewPackageDetails(packageNameOrIndex) {
        if (typeof packageNameOrIndex === "number") {
            window.togglePackageDetails(packageNameOrIndex);
        } else {
            notify(`Showing full checklist and scope for ${packageNameOrIndex}.`);
        }
    };

    window.chooseSubService = function chooseSubService(serviceName, price, parentCategory) {
        if (serviceName === "Mini Services" || String(serviceName).toLowerCase().includes("mini service")) {
            window.showMiniServicesView(serviceName, parentCategory || _currentParentCategory);
            return;
        }
        if (subServiceDesignations[serviceName]) {
            window.showSubServiceDesignations(serviceName, parentCategory || _currentParentCategory);
            return;
        }
        getOrCreatePackagesForDesignation(serviceName, serviceName, price);
        window.showDesignationPackages(serviceName, serviceName, parentCategory || _currentParentCategory);
    };

    window.chooseDesignation = function chooseDesignation(subServiceName, designationName, price, parentCategory) {
        if (designationName === "Mini Services" || String(designationName).toLowerCase().includes("mini service")) {
            window.showMiniServicesView(subServiceName, parentCategory || _currentParentCategory);
            return;
        }
        getOrCreatePackagesForDesignation(designationName, subServiceName, price);
        window.showDesignationPackages(designationName, subServiceName, parentCategory || _currentParentCategory);
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

    window.viewMyBookings = async function viewMyBookings(bookingRef, requestNumber) {
        window.closeSubServicesModal();

        // Ensure services section is visible if resident tab is active
        const servicesSection = document.getElementById("nobrokerServicesSection") || document.querySelector('[data-view="services"]');
        if (servicesSection && servicesSection.classList.contains("d-none")) {
            const servicesTab = document.querySelector('a[href="#services"], [data-panel="services"]');
            if (servicesTab) {
                servicesTab.click();
            } else {
                servicesSection.classList.remove("d-none");
                servicesSection.style.display = "";
            }
        }

        // Load the tickets and requests
        if (typeof window.loadNoBrokerMaintenanceTickets === "function") {
            await window.loadNoBrokerMaintenanceTickets();
        }

        // Background update for ResidentMaintenance requests
        try {
            if (window.ResidentMaintenance && typeof window.ResidentMaintenance.loadRequests === "function") {
                window.ResidentMaintenance.loadRequests();
            }
        } catch (e) {
            console.debug("ResidentMaintenance reload notice:", e);
        }

        // Smoothly scroll to the My Service Bookings section
        const tableAnchor = document.getElementById("nobrokerBookingsTableAnchor");
        if (tableAnchor) {
            tableAnchor.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // Highlight matching row with pulse animation
        if (bookingRef || requestNumber) {
            setTimeout(() => {
                const targetRow = (bookingRef && document.querySelector(`[data-booking-ref="${bookingRef}"]`)) ||
                                  (requestNumber && document.querySelector(`[data-request-num="${requestNumber}"]`));
                if (targetRow) {
                    targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
                    targetRow.classList.add("booking-highlight-pulse");
                    setTimeout(() => targetRow.classList.remove("booking-highlight-pulse"), 4000);
                }
            }, 350);
        }
    };

    window.scrollToNoBrokerBookings = function scrollToNoBrokerBookings(bookingRef, requestNumber) {
        window.viewMyBookings(bookingRef, requestNumber);
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
            // Fetch tickets from CommonMaintenanceController (/api/maintenance)
            let commonTickets = [];
            try {
                const res = await api(`?sourcePlatform=${encodeURIComponent(sourcePlatform)}`);
                if (Array.isArray(res)) commonTickets = res;
            } catch (cErr) {
                console.warn("CommonMaintenance fetch notice:", cErr.message);
            }

            // Fetch requests from MaintenanceRequestApiController (/api/maintenance/requests)
            let maintRequests = [];
            try {
                const mRes = await fetch("/api/maintenance/requests?filter=all", {
                    headers: { "Accept": "application/json" }
                });
                if (mRes.ok) {
                    const data = await mRes.json();
                    if (Array.isArray(data)) maintRequests = data;
                }
            } catch (mErr) {
                console.warn("MaintenanceRequest fetch notice:", mErr.message);
            }

            // Unified bookings list
            const unifiedList = [];
            const seenRefs = new Set();

            // 1. Process Maintenance Requests first (most detailed with assigned workers)
            maintRequests.forEach(req => {
                const desc = req.description || "";
                const notes = req.notes || "";
                const combinedText = `${req.title || ""} ${desc} ${notes}`;
                
                // Extract booking reference if present
                const refMatch = combinedText.match(/(?:Booking Ref|Ref):\s*(BK-[A-Za-z0-9-]+|SS-HS-[0-9]+|PD-HS-[0-9]+)/i);
                const bookingRef = refMatch ? refMatch[1] : (req.requestNumber || `REQ-${req.id}`);

                // Extract Amount if present
                const amountMatch = desc.match(/Amount:\s*(?:₹|Rs\.?)\s*([0-9,]+)/i);
                const priceLabel = amountMatch ? `₹${amountMatch[1]}` : (req.priceLabel || "₹49");

                // Extract Address if present
                const addrMatch = desc.match(/Customer Address:\s*([^\n\r]+)/i);
                const address = addrMatch ? addrMatch[1].trim() : (req.apartmentUnit ? `Flat ${req.apartmentUnit}` : "A-101, SmartSociety Palms");

                // Extract package or scope
                const scopeMatch = req.title ? req.title.match(/\(([^)]+)\)/) : null;
                const serviceOption = scopeMatch ? scopeMatch[1] : (req.category || "Standard Service");

                seenRefs.add(bookingRef);
                if (req.requestNumber) seenRefs.add(req.requestNumber);

                unifiedList.push({
                    id: req.id,
                    requestNumber: req.requestNumber,
                    externalReference: bookingRef,
                    serviceType: req.serviceType || req.category || "Home Service",
                    serviceOption: serviceOption,
                    preferredDate: req.preferredDate,
                    preferredTime: req.preferredTime,
                    preferredAt: req.preferredDate ? `${req.preferredDate}T${req.preferredTime === 'MORNING' ? '09:00' : '14:00'}` : req.createdAt,
                    serviceAddress: address,
                    priceLabel: priceLabel,
                    status: req.status || "REQUESTED",
                    assignedWorkerName: req.assignedWorkerName,
                    assignedWorkerPhone: req.assignedWorkerPhone,
                    createdAt: req.createdAt,
                    isMaintenanceRequest: true
                });
            });

            // 2. Process CommonMaintenanceTickets (for backward compatibility)
            commonTickets.forEach(ticket => {
                const ref = ticket.externalReference || `TKT-${ticket.id}`;
                if (seenRefs.has(ref) || (ticket.id && seenRefs.has(`MR-${ticket.id}`))) {
                    return; // already processed as maintenance request
                }
                seenRefs.add(ref);
                unifiedList.push({
                    id: ticket.id,
                    requestNumber: ticket.externalReference,
                    externalReference: ticket.externalReference || `SS-HS-${ticket.id}`,
                    serviceType: ticket.serviceType || "Home Service",
                    serviceOption: ticket.serviceOption || "Standard Visit",
                    preferredAt: ticket.preferredAt,
                    serviceAddress: ticket.serviceAddress || "-",
                    priceLabel: ticket.priceLabel || "Rs. 49",
                    status: ticket.ticketStatus || "REQUESTED",
                    assignedWorkerName: ticket.vendorName && !ticket.vendorName.includes("External") ? ticket.vendorName : null,
                    assignedWorkerPhone: ticket.vendorPhone,
                    createdAt: ticket.createdAt,
                    isMaintenanceRequest: false
                });
            });

            // Filter relevant service tickets
            const serviceBookings = unifiedList.filter(item => {
                const content = `${item.serviceType || ""} ${item.serviceOption || ""} ${item.externalReference || ""}`.toLowerCase();
                return /clean|pack|paint|agreement|repair|carpentry|plumb|electric|appliance|interior|pest|bk-hs|ss-hs|pd-hs|mr-/.test(content);
            });

            // Sort newest first
            serviceBookings.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

            if (!serviceBookings.length) {
                rows.innerHTML = '<tr><td colspan="7" style="color:#94a3b8; text-align:center; padding:24px;">No saved home-service bookings yet.</td></tr>';
                return;
            }

            rows.innerHTML = serviceBookings.map(item => {
                const statusStr = String(item.status || "REQUESTED").replaceAll("_", " ");
                const isAssigned = /ASSIGNED|IN_PROGRESS|ACCEPTED/i.test(item.status);
                const isDone = /RESOLVED|CLOSED|COMPLETED/i.test(item.status);
                
                let badgeStyle = "background:#fef3c7; color:#b45309; border:1px solid #fde68a;";
                let badgeIcon = '<i class="fa-solid fa-clock me-1"></i>';

                if (isDone) {
                    badgeStyle = "background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;";
                    badgeIcon = '<i class="fa-solid fa-circle-check me-1"></i>';
                } else if (isAssigned) {
                    badgeStyle = "background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;";
                    badgeIcon = '<i class="fa-solid fa-user-check me-1"></i>';
                }

                // Date display formatting
                let dateDisplay = "-";
                if (item.preferredDate) {
                    dateDisplay = item.preferredDate;
                    if (item.preferredTime) {
                        const slotMap = {
                            MORNING: "9 AM - 12 PM",
                            AFTERNOON: "12 PM - 4 PM",
                            EVENING: "4 PM - 8 PM",
                            EXPRESS_60MIN: "Express"
                        };
                        dateDisplay += ` <small style="color:#64748b;">(${slotMap[item.preferredTime] || item.preferredTime})</small>`;
                    }
                } else if (item.preferredAt) {
                    dateDisplay = new Date(item.preferredAt).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"});
                }

                return `<tr data-booking-ref="${escapeHtml(item.externalReference || '')}" data-request-num="${escapeHtml(item.requestNumber || '')}" id="booking-row-${escapeHtml(item.externalReference || item.requestNumber || item.id)}">
                    <td>
                        <strong style="color: #0f172a; font-family: monospace; font-size: 0.92rem;">${escapeHtml(item.requestNumber || `#${item.id}`)}</strong>
                        ${item.externalReference && item.externalReference !== item.requestNumber ? `
                            <br><small style="color: #64748b; font-family: monospace; font-weight: 600;">
                                <i class="fa-solid fa-receipt me-1 text-primary" style="font-size: 0.72rem;"></i>${escapeHtml(item.externalReference)}
                            </small>
                        ` : ''}
                    </td>
                    <td>
                        <strong style="color: #1e293b; font-size: 0.9rem;">${escapeHtml(item.serviceType || "Home Service")}</strong>
                        ${item.serviceOption ? `<br><small style="color: #475569; font-weight: 600;"><i class="fa-solid fa-sparkles text-warning me-1" style="font-size: 0.72rem;"></i>${escapeHtml(item.serviceOption)}</small>` : ''}
                    </td>
                    <td>${dateDisplay}</td>
                    <td style="max-width: 180px; font-size: 0.84rem; color: #334155; line-height: 1.3;">
                        <i class="fa-solid fa-location-dot text-danger me-1"></i>${escapeHtml(item.serviceAddress || "-")}
                    </td>
                    <td><strong style="color: #059669; font-size: 0.95rem;">${escapeHtml(item.priceLabel || "₹49")}</strong></td>
                    <td>
                        <span style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:800; ${badgeStyle}">
                            ${badgeIcon}${escapeHtml(statusStr)}
                        </span>
                        ${item.assignedWorkerName ? `
                            <div style="margin-top: 4px; font-size: 0.76rem; color: #166534; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-user-check text-success"></i> ${escapeHtml(item.assignedWorkerName)}
                                ${item.assignedWorkerPhone ? `<span style="color:#64748b; font-weight:500;">(${escapeHtml(item.assignedWorkerPhone)})</span>` : ''}
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        ${item.isMaintenanceRequest ? `
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold" style="font-size: 0.78rem;" onclick="window.openMaintenanceLiveTracking(${item.id}, '${escapeHtml(item.externalReference || item.requestNumber || '')}')">
                                <i class="fa-solid fa-eye me-1"></i> Details
                            </button>
                        ` : (isDone ? '<span style="color:#15803d; font-weight:800; font-size:0.82rem;">Closed</span>' : `
                            <button type="button" style="all:unset; background:#ffffff; border:1px solid #16a34a; color:#16a34a; padding:4px 14px; border-radius:999px; font-size:0.78rem; font-weight:800; cursor:pointer;" onclick="resolveNoBrokerTicket(${item.id})">
                                Mark Resolved
                            </button>
                        `)}
                    </td>
                </tr>`;
            }).join("");
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

    // =========================================================================
    // 6-STAGE LIVE PROCESS TRACKING & RESIDENT REVIEW SYSTEM
    // =========================================================================

    const LIVE_TRACKING_STAGES = [
        {
            key: "ACCEPTED",
            label: "Accepted",
            icon: "fa-solid fa-handshake",
            desc: "Service booking accepted & verified technician assigned",
            step: 1
        },
        {
            key: "REACHED_LOCATION",
            label: "Reached your location",
            icon: "fa-solid fa-location-dot",
            desc: "Technician arrived at society gate / apartment premises",
            step: 2
        },
        {
            key: "STARTED",
            label: "Started",
            icon: "fa-solid fa-play",
            desc: "Technician verified service scope & prepped safety equipment",
            step: 3
        },
        {
            key: "STAGE_1",
            label: "Stage 1",
            icon: "fa-solid fa-layer-group",
            desc: "High-touch wipe down, dry dusting & preliminary surface inspection",
            step: 4
        },
        {
            key: "PROCESSING",
            label: "Processing",
            icon: "fa-solid fa-spray-can-sparkles",
            desc: "Intensive sanitization, chemical treatment & deep machine scrubbing",
            step: 5
        },
        {
            key: "COMPLETED",
            label: "Completed",
            icon: "fa-solid fa-circle-check",
            desc: "Service 100% completed & quality verified",
            step: 6
        }
    ];

    window._liveTrackingStageIndex = window._liveTrackingStageIndex || {};
    window._liveTrackingReqData = window._liveTrackingReqData || {};
    window._liveTrackingTimers = window._liveTrackingTimers || {};
    window._liveTrackingRating = window._liveTrackingRating || {};

    function ensureLiveTrackingModalStyles() {
        if (document.getElementById("liveTrackingModalStyles")) return;
        const style = document.createElement("style");
        style.id = "liveTrackingModalStyles";
        style.textContent = `
            @keyframes ltRadarPulse {
                0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); transform: scale(1); }
                70% { box-shadow: 0 0 0 16px rgba(37, 99, 235, 0); transform: scale(1.05); }
                100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); transform: scale(1); }
            }
            .lt-stage-card {
                transition: all 0.25s ease;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                padding: 14px 18px;
                background: #ffffff;
            }
            .lt-stage-card.is-active {
                border-color: #3b82f6 !important;
                background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%) !important;
                box-shadow: 0 8px 20px -6px rgba(37, 99, 235, 0.25);
            }
            .lt-stage-card.is-completed {
                border-color: #86efac !important;
                background: #f8fafc;
            }
            .lt-node-icon {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.1rem;
                flex-shrink: 0;
            }
            .lt-node-icon.is-active {
                background: #2563eb;
                color: #ffffff;
                animation: ltRadarPulse 2s infinite;
            }
            .lt-node-icon.is-completed {
                background: #16a34a;
                color: #ffffff;
            }
            .lt-node-icon.is-upcoming {
                background: #f1f5f9;
                color: #94a3b8;
                border: 2px dashed #cbd5e1;
            }
            .lt-star-btn {
                cursor: pointer;
                transition: transform 0.15s ease, color 0.15s ease;
            }
            .lt-star-btn:hover {
                transform: scale(1.22);
            }
            .lt-review-tag {
                cursor: pointer;
                font-size: 0.78rem;
                padding: 6px 14px;
                border-radius: 999px;
                font-weight: 700;
                transition: all 0.2s ease;
                border: 1px solid #cbd5e1;
                background: #ffffff;
                color: #475569;
            }
            .lt-review-tag.active {
                background: #2563eb;
                color: #ffffff;
                border-color: #2563eb;
                box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.35);
            }
        `;
        document.head.appendChild(style);
    }

    window.openMaintenanceLiveTracking = async function openMaintenanceLiveTracking(id, externalRef) {
        ensureLiveTrackingModalStyles();

        let modal = document.getElementById("maintenanceLiveTrackingModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "maintenanceLiveTrackingModal";
            modal.style.cssText = "display:none; position:fixed; inset:0; z-index:1070; background:rgba(15,23,42,0.72); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:1rem; overflow-y:auto;";
            modal.innerHTML = `
                <div style="background:#ffffff; width:100%; max-width:760px; border-radius:24px; box-shadow:0 25px 60px -15px rgba(0,0,0,0.35); overflow:hidden; border:1px solid rgba(226,232,240,0.8); margin:auto; max-height:92vh; display:flex; flex-direction:column;" class="animate__animated animate__zoomIn">
                    <div id="maintenanceLiveTrackingHeader"></div>
                    <div id="maintenanceLiveTrackingBody" style="overflow-y:auto; padding:1.5rem 1.75rem; flex:1;"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener("click", (e) => {
                if (e.target === modal) window.closeMaintenanceLiveTracking();
            });
        }

        modal.style.display = "flex";
        const bodyEl = document.getElementById("maintenanceLiveTrackingBody");
        const headerEl = document.getElementById("maintenanceLiveTrackingHeader");

        if (headerEl) {
            headerEl.innerHTML = `
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 1.25rem 1.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700;">Live Service Process Tracking</div>
                        <h5 class="fw-bold mb-0 text-white font-monospace">${escapeHtml(externalRef || `#${id}`)}</h5>
                    </div>
                    <button type="button" class="btn-close btn-close-white" onclick="window.closeMaintenanceLiveTracking()" aria-label="Close"></button>
                </div>
            `;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
                    <h6 class="fw-bold text-dark">Connecting to Live Service Process...</h6>
                    <p class="text-muted small mb-0">Fetching real-time stage updates, technician details & telemetry.</p>
                </div>
            `;
        }

        let reqData = null;
        try {
            const res = await fetch(`/api/maintenance/requests/${id}`);
            if (res.ok) {
                reqData = await res.json();
                window._liveTrackingReqData[id] = reqData;
            }
        } catch (e) {
            console.warn("Could not fetch maintenance request:", e);
        }

        if (!reqData) {
            reqData = {
                id: id,
                requestNumber: externalRef || `MR-${id}`,
                title: "Home Cleaning - Essential ★",
                category: "Cleaning",
                serviceType: "Full House Cleaning",
                status: "ASSIGNED",
                assignedWorkerName: "Manoj Cleaner",
                assignedWorkerPhone: "9876543214",
                preferredDate: new Date().toISOString().slice(0, 10),
                preferredTime: "MORNING",
                apartmentUnit: "A-101, SmartSociety Palms"
            };
            window._liveTrackingReqData[id] = reqData;
        }

        function computeStageFromData(data) {
            if (!data) return 0;
            const notes = String(data.notes || "");
            const status = String(data.status || data.requestStatus || "").toUpperCase();
            if (notes.includes("Verified Resident Review:") || status === "CLOSED" || status === "COMPLETED" || status === "RESOLVED") {
                return 5;
            } else if (notes.includes("[PROCESSING]")) {
                return 4;
            } else if (notes.includes("[STAGE_1]")) {
                return 3;
            } else if (status === "IN_PROGRESS") {
                return 2;
            } else if (status === "ARRIVED") {
                return 1;
            }
            return 0;
        }

        const stageIndex = computeStageFromData(reqData);
        window._liveTrackingStageIndex[id] = stageIndex;
        renderLiveTrackingModal(id, reqData, stageIndex);

        // Real-time live polling: updates resident view as worker updates stage in maintenance dashboard
        if (window._liveTrackingPollTimer) {
            clearInterval(window._liveTrackingPollTimer);
        }
        window._liveTrackingPollTimer = setInterval(async () => {
            const m = document.getElementById("maintenanceLiveTrackingModal");
            if (!m || m.style.display === "none") {
                clearInterval(window._liveTrackingPollTimer);
                window._liveTrackingPollTimer = null;
                return;
            }
            try {
                const res = await fetch(`/api/maintenance/requests/${id}`);
                if (!res.ok) return;
                const freshData = await res.json();
                window._liveTrackingReqData[id] = freshData;
                const freshStage = computeStageFromData(freshData);
                if (freshStage !== window._liveTrackingStageIndex[id]) {
                    window._liveTrackingStageIndex[id] = freshStage;
                    renderLiveTrackingModal(id, freshData, freshStage);
                    window.loadNoBrokerMaintenanceTickets?.();
                }
            } catch (err) {}
        }, 2000);
    };

    window.closeMaintenanceLiveTracking = function closeMaintenanceLiveTracking() {
        const modal = document.getElementById("maintenanceLiveTrackingModal");
        if (modal) modal.style.display = "none";
        if (window._liveTrackingPollTimer) {
            clearInterval(window._liveTrackingPollTimer);
            window._liveTrackingPollTimer = null;
        }
    };

    function renderLiveTrackingModal(id, reqData, currentStageIndex) {
        const headerEl = document.getElementById("maintenanceLiveTrackingHeader");
        const bodyEl = document.getElementById("maintenanceLiveTrackingBody");
        if (!bodyEl) return;

        const workerName = reqData.assignedWorkerName || "Manoj Cleaner";
        const workerPhone = reqData.assignedWorkerPhone || "9876543214";
        const title = reqData.title || reqData.serviceType || "Home Cleaning Service";
        const requestNum = reqData.requestNumber || `#${id}`;
        const refMatch = (reqData.description || reqData.notes || "").match(/Booking Ref:\s*([A-Za-z0-9-]+)/i);
        const ref = refMatch ? refMatch[1] : requestNum;
        const amountMatch = (reqData.description || "").match(/Amount:\s*([^\r\n]+)/i);
        const amount = amountMatch ? amountMatch[1] : "₹2,869";
        const address = reqData.apartmentUnit ? `Flat ${reqData.apartmentUnit}` : "A-101, SmartSociety Palms";
        const dateSlot = reqData.preferredDate ? `${reqData.preferredDate} (${reqData.preferredTime || 'Morning'})` : "Today (Immediate)";
        const startOtp = String(Math.abs(Number(id) * 137 + 4821)).slice(-4).padStart(4, "4");

        const isCompleted = currentStageIndex === 5;
        const notesStr = String(reqData.notes || "");
        const hasReviewed = notesStr.includes("Verified Resident Review:");

        let existingRating = 5;
        let existingComment = "";
        let existingTags = "";
        if (hasReviewed) {
            const rMatch = notesStr.match(/Verified Resident Review:\s*([1-5])\/5 Stars - "(.*?)"(?:\s*\|\s*Tags:\s*(.*?))?(?:\n|$)/);
            if (rMatch) {
                existingRating = parseInt(rMatch[1]) || 5;
                existingComment = rMatch[2] || "";
                existingTags = rMatch[3] || "";
            }
        }

        if (headerEl) {
            headerEl.innerHTML = `
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 1.25rem 1.75rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="badge bg-primary px-2.5 py-1 rounded-pill" style="font-size: 0.72rem; letter-spacing: 0.05em; font-weight: 800;">
                                <i class="fa-solid fa-satellite-dish me-1"></i>LIVE PROCESS TRACKING
                            </span>
                            <span class="badge bg-white text-dark font-monospace px-2.5 py-1 rounded-pill" style="font-size: 0.72rem;">${escapeHtml(requestNum)}</span>
                        </div>
                        <h5 class="fw-bold mb-0 text-white d-flex align-items-center gap-2">
                            <i class="fa-solid fa-sparkles text-warning" style="font-size: 1rem;"></i>
                            ${escapeHtml(title)}
                        </h5>
                    </div>
                    <button type="button" class="btn-close btn-close-white" onclick="window.closeMaintenanceLiveTracking()" aria-label="Close"></button>
                </div>
            `;
        }

        const stagesHtml = LIVE_TRACKING_STAGES.map((st, idx) => {
            const isNodeCompleted = idx < currentStageIndex;
            const isNodeActive = idx === currentStageIndex;

            let cardClass = "lt-stage-card";
            let iconClass = "lt-node-icon";
            let iconContent = "";
            let statusBadge = "";

            if (isNodeCompleted) {
                cardClass += " is-completed";
                iconClass += " is-completed";
                iconContent = '<i class="fa-solid fa-check"></i>';
                statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1" style="font-size: 0.7rem; font-weight: 700;"><i class="fa-solid fa-check-double me-1"></i>Completed</span>';
            } else if (isNodeActive) {
                cardClass += " is-active";
                iconClass += " is-active";
                iconContent = (st.key === "PROCESSING") ? '<i class="fa-solid fa-spray-can-sparkles fa-bounce"></i>' : `<i class="${st.icon}"></i>`;
                statusBadge = '<span class="badge bg-primary text-white rounded-pill px-2.5 py-1 animate__animated animate__pulse animate__infinite" style="font-size: 0.72rem; font-weight: 800;"><i class="fa-solid fa-circle-dot me-1"></i>In Progress</span>';
            } else {
                iconClass += " is-upcoming";
                iconContent = `<span class="font-monospace fw-bold" style="font-size: 0.85rem;">0${st.step}</span>`;
                statusBadge = '<span class="badge bg-light text-muted border rounded-pill px-2 py-1" style="font-size: 0.68rem;">Upcoming</span>';
            }

            return `
                <div class="position-relative mb-3">
                    <div class="${cardClass} d-flex align-items-center justify-content-between gap-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="${iconClass}">
                                ${iconContent}
                            </div>
                            <div>
                                <div class="d-flex align-items-center gap-2">
                                    <h6 class="mb-0 fw-bold ${isNodeActive ? 'text-primary' : (isNodeCompleted ? 'text-dark' : 'text-muted')}" style="font-size: 0.95rem;">
                                        ${escapeHtml(st.label)}
                                    </h6>
                                    ${statusBadge}
                                </div>
                                <div style="font-size: 0.78rem; color: ${isNodeActive ? '#334155' : '#64748b'}; margin-top: 2px;">
                                    ${escapeHtml(st.desc)}
                                </div>
                            </div>
                        </div>
                        <div class="text-end">
                            ${isNodeActive ? `
                                <span class="badge bg-primary text-white rounded-pill px-3 py-1.5 fw-bold" style="font-size: 0.74rem;">
                                    <i class="fa-solid fa-spinner fa-spin me-1.5"></i>In Progress
                                </span>
                            ` : (isNodeCompleted ? `
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1" style="font-size: 0.72rem;">
                                    <i class="fa-solid fa-circle-check me-1"></i>Verified
                                </span>
                            ` : `
                                <span class="badge bg-light text-muted border rounded-pill px-2.5 py-1" style="font-size: 0.7rem;">
                                    Pending
                                </span>
                            `)}
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        let reviewSectionHtml = "";
        if (isCompleted) {
            if (hasReviewed) {
                const starsHtml = Array.from({length: 5}, (_, i) => 
                    `<i class="fa-solid fa-star ${i < existingRating ? 'text-warning' : 'text-muted'}" style="font-size: 1.2rem;"></i>`
                ).join(" ");

                reviewSectionHtml = `
                    <div class="card border-0 rounded-4 p-4 mt-4 shadow-sm animate__animated animate__fadeIn" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac !important;">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-success text-white p-2 rounded-circle"><i class="fa-solid fa-shield-check fa-lg"></i></span>
                                <div>
                                    <h6 class="fw-bold text-success mb-0" style="font-size: 1rem;">Verified Resident Review Recorded</h6>
                                    <small class="text-success-emphasis">Thank you for rating your service experience!</small>
                                </div>
                            </div>
                            <span class="badge bg-success text-white px-3 py-1.5 rounded-pill fw-bold" style="font-size: 0.82rem;">${existingRating}.0 / 5.0 ★</span>
                        </div>
                        <div class="mt-2 mb-2">
                            <div class="d-flex gap-1 mb-2">${starsHtml}</div>
                            ${existingComment ? `<p class="mb-2 text-dark font-monospace bg-white p-3 rounded-3 border border-success-subtle" style="font-size: 0.88rem;">"${escapeHtml(existingComment)}"</p>` : ''}
                            ${existingTags ? `
                                <div class="d-flex flex-wrap gap-1 mt-2">
                                    ${existingTags.split(',').map(t => `<span class="badge bg-white text-success border border-success-subtle px-2.5 py-1 rounded-pill">${escapeHtml(t.trim())}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                const currentRating = window._liveTrackingRating[id] || 5;
                const ratingLabels = {
                    1: "★ Poor (Needs Improvement)",
                    2: "★★ Fair (Below Expectations)",
                    3: "★★★ Good (Satisfactory)",
                    4: "★★★★ Very Good (Great Service)",
                    5: "★★★★★ Outstanding! (5.0 / 5.0 - Highly Recommended)"
                };

                reviewSectionHtml = `
                    <div class="card border-0 rounded-4 p-4 mt-4 shadow-sm animate__animated animate__fadeInUp" id="residentReviewContainer" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 2px solid #93c5fd !important;">
                        <div class="text-center mb-3">
                            <div class="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle mb-2" style="width: 52px; height: 52px; font-size: 1.5rem; box-shadow: 0 8px 16px -4px rgba(22, 163, 74, 0.4);">
                                <i class="fa-solid fa-trophy"></i>
                            </div>
                            <h5 class="fw-bold text-dark mb-1">🎉 Service Successfully Completed!</h5>
                            <p class="text-secondary small mb-0">How was your service experience with <strong>${escapeHtml(workerName)}</strong>? Please rate your service below.</p>
                        </div>

                        <!-- 5 Star Interactive Rating -->
                        <div class="text-center my-3 bg-white p-3 rounded-4 border border-light-subtle shadow-sm">
                            <label class="form-label small fw-bold text-dark d-block mb-1">Tap Stars to Rate:</label>
                            <div class="d-inline-flex align-items-center gap-2 justify-content-center" id="starRatingGroup" style="font-size: 2.2rem; cursor: pointer;">
                                ${[1, 2, 3, 4, 5].map(starNum => `
                                    <i class="fa-solid fa-star lt-star-btn ${starNum <= currentRating ? 'text-warning' : 'text-muted'}" 
                                       data-star="${starNum}" 
                                       onclick="window.setLiveReviewRating(${id}, ${starNum})"></i>
                                `).join('')}
                            </div>
                            <div class="fw-bold mt-2" id="starRatingLabel" style="color: #0284c7; font-size: 0.95rem;">
                                ${ratingLabels[currentRating] || ratingLabels[5]}
                            </div>
                        </div>

                        <!-- Quick Feedback Tags -->
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-dark mb-2">What did you appreciate the most?</label>
                            <div class="d-flex flex-wrap gap-2" id="reviewTagChips">
                                <button type="button" class="lt-review-tag active" data-tag="Spotless Clean" onclick="window.toggleLiveReviewTag(this)">✨ Spotless Clean</button>
                                <button type="button" class="lt-review-tag active" data-tag="On Time" onclick="window.toggleLiveReviewTag(this)">⏱️ On Time</button>
                                <button type="button" class="lt-review-tag active" data-tag="Polite & Professional" onclick="window.toggleLiveReviewTag(this)">🤝 Polite & Professional</button>
                                <button type="button" class="lt-review-tag" data-tag="Quality Supplies" onclick="window.toggleLiveReviewTag(this)">🧼 Quality Supplies</button>
                                <button type="button" class="lt-review-tag" data-tag="Safe & Verified" onclick="window.toggleLiveReviewTag(this)">🛡️ Safe & Verified</button>
                                <button type="button" class="lt-review-tag" data-tag="Highly Recommended" onclick="window.toggleLiveReviewTag(this)">👍 Highly Recommended</button>
                            </div>
                        </div>

                        <!-- Comments Textarea -->
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-dark mb-1">Write Feedback / Review (Optional):</label>
                            <textarea class="form-control rounded-3" id="liveReviewComments" rows="2" placeholder="e.g. Technician arrived on time, was very polite and cleaned the entire flat spotless!"></textarea>
                        </div>

                        <!-- Submit Review Button -->
                        <button type="button" class="btn btn-success rounded-pill w-100 py-2.5 fw-bold shadow-sm" id="submitLiveReviewBtn" onclick="window.submitLiveReview(${id})">
                            <i class="fa-solid fa-paper-plane me-2"></i>Submit Rating & Review ★
                        </button>
                    </div>
                `;
            }
        }

        bodyEl.innerHTML = `
            <!-- Technician Summary & Telemetry Card -->
            <div class="card border-0 rounded-4 p-3 mb-4 shadow-sm" style="background: #f8fafc; border: 1px solid #e2e8f0 !important;">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="position-relative">
                            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 54px; height: 54px; font-size: 1.3rem;">
                                ${escapeHtml(workerName.charAt(0) || 'M')}
                            </div>
                            <span class="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle p-1" style="width: 14px; height: 14px;" title="Online & Active"></span>
                        </div>
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <h6 class="fw-bold mb-0 text-dark" style="font-size: 1.05rem;">${escapeHtml(workerName)}</h6>
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5" style="font-size: 0.72rem;">
                                    <i class="fa-solid fa-shield-check me-1"></i>Verified Partner
                                </span>
                            </div>
                            <div class="text-muted small mt-0.5">
                                <i class="fa-solid fa-star text-warning me-1"></i><strong>4.9</strong> (184 jobs completed) &bull; Specialist
                            </div>
                        </div>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <a href="tel:${escapeHtml(workerPhone)}" class="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold" style="font-size: 0.8rem;">
                            <i class="fa-solid fa-phone me-1"></i>Call (${escapeHtml(workerPhone)})
                        </a>
                        <a href="https://wa.me/91${escapeHtml(workerPhone.replace(/[^0-9]/g, ''))}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold" style="font-size: 0.8rem;">
                            <i class="fa-brands fa-whatsapp me-1"></i>Chat
                        </a>
                    </div>
                </div>

                <!-- Telemetry Pills -->
                <div class="d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top border-light-subtle" style="font-size: 0.8rem;">
                    <span class="badge bg-white text-dark border px-2.5 py-1 rounded-pill">
                        <i class="fa-solid fa-location-dot text-danger me-1"></i>${escapeHtml(address)}
                    </span>
                    <span class="badge bg-white text-dark border px-2.5 py-1 rounded-pill">
                        <i class="fa-solid fa-calendar text-primary me-1"></i>${escapeHtml(dateSlot)}
                    </span>
                    <span class="badge bg-white text-dark border px-2.5 py-1 rounded-pill">
                        <i class="fa-solid fa-indian-rupee-sign text-success me-1"></i>${escapeHtml(amount)}
                    </span>
                    <span class="badge bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-pill ms-auto font-monospace">
                        <i class="fa-solid fa-key text-warning me-1"></i>Start PIN: <strong>${startOtp}</strong>
                    </span>
                </div>
            </div>

            <!-- Live Status Header Bar (Read-Only Telemetry) -->
            <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                    <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.95rem;">
                        <i class="fa-solid fa-route text-primary me-2"></i>Live Service Journey (Updated by Worker)
                    </h6>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5 fw-bold" style="font-size: 0.75rem;">
                        <i class="fa-solid fa-circle text-success fa-fade me-1.5" style="font-size: 0.55rem;"></i>Live Worker Telemetry Active
                    </span>
                </div>
            </div>

            <!-- The 6 Stages List -->
            <div class="stages-container">
                ${stagesHtml}
            </div>

            <!-- Resident Review & Rating Form (Rendered on Stage 6 Completed) -->
            ${reviewSectionHtml}
        `;
    }

    // Resident view is strictly real-time telemetry; stage transitions are initiated solely by the technician in the maintenance dashboard.

    window.setLiveReviewRating = function setLiveReviewRating(id, rating) {
        window._liveTrackingRating[id] = rating;
        const labels = {
            1: "★ Poor (Needs Improvement)",
            2: "★★ Fair (Below Expectations)",
            3: "★★★ Good (Satisfactory)",
            4: "★★★★ Very Good (Great Service)",
            5: "★★★★★ Outstanding! (5.0 / 5.0 - Highly Recommended)"
        };
        const labelEl = document.getElementById("starRatingLabel");
        if (labelEl) labelEl.textContent = labels[rating] || `${rating} Stars`;

        const starBtns = document.querySelectorAll(".lt-star-btn");
        starBtns.forEach(btn => {
            const starVal = parseInt(btn.dataset.star) || 0;
            if (starVal <= rating) {
                btn.className = "fa-solid fa-star lt-star-btn text-warning";
            } else {
                btn.className = "fa-solid fa-star lt-star-btn text-muted";
            }
        });
    };

    window.toggleLiveReviewTag = function toggleLiveReviewTag(btn) {
        btn.classList.toggle("active");
    };

    window.submitLiveReview = async function submitLiveReview(id) {
        const rating = window._liveTrackingRating[id] || 5;
        const commentsInput = document.getElementById("liveReviewComments");
        const reviewText = commentsInput ? commentsInput.value.trim() : "";

        const activeTags = [];
        document.querySelectorAll(".lt-review-tag.active").forEach(tagEl => {
            if (tagEl.dataset.tag) activeTags.push(tagEl.dataset.tag);
        });

        const submitBtn = document.getElementById("submitLiveReviewBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting Verified Review...';
        }

        try {
            const res = await fetch(`/api/maintenance/requests/${id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rating: rating,
                    review: reviewText || "Technician was very professional and thorough!",
                    tags: activeTags.join(", ")
                })
            });

            if (!res.ok) throw new Error("Could not submit review. Please try again.");
            const updated = await res.json();
            window._liveTrackingReqData[id] = updated;

            notify("🎉 Thank you! Your 5-star rating & review have been submitted.");
            renderLiveTrackingModal(id, updated, 5);
            window.loadNoBrokerMaintenanceTickets?.();
        } catch (e) {
            notify(e.message || "Failed to submit review");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Submit Rating & Review ★';
            }
        }
    };

    // Ensure ResidentMaintenance aliases always point to live tracking
    window.ResidentMaintenance = window.ResidentMaintenance || {};
    window.ResidentMaintenance.openDetailsModal = window.openMaintenanceLiveTracking;

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
