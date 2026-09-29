const apartments = [
    {
        title: "Orchid Enclave",
        society: "Orchid Enclave",
        locality: "HSR Layout",
        city: "Bangalore",
        rent: 12000000,
        price: "₹ 1.2 Cr",
        maintenance: 4500,
        deposit: "₹5,00,000",
        sqft: "1,500 sqft",
        photo: "1/16 Photos",
        furnishing: "Fully Furnished",
        type: "3 BHK",
        tenant: "Family",
        available: "Ready to Move",
        parking: "Bike Parking Car Parking",
        apartmentType: "Gated Society",
        listingMode: "Buy",
        image: "/propertydirect/images/orchid_enclave.jpg",
        nearby: ["HSR Club", "Silk Board", "Agara Lake"]
    },
    {
        title: "The Belvedere",
        society: "The Belvedere",
        locality: "Bandra",
        city: "Mumbai",
        rent: 25000000,
        price: "₹ 2.5 Cr",
        maintenance: 8500,
        deposit: "₹10,00,000",
        sqft: "2,200 sqft",
        photo: "1/20 Photos",
        furnishing: "Fully Furnished",
        type: "4 BHK",
        tenant: "Family",
        available: "Ready to Move",
        parking: "Car Parking",
        apartmentType: "Gated Society",
        listingMode: "Buy",
        image: "/propertydirect/images/belvedere.jpg",
        nearby: ["Bandra Kurla Complex", "Carter Road", "Bandstand"]
    },
    {
        title: "Sunrise Heights",
        society: "Sunrise Heights",
        locality: "Kaikondrahalli",
        city: "Bangalore",
        rent: 6500000,
        price: "₹ 65 L",
        maintenance: 3000,
        deposit: "₹3,00,000",
        sqft: "1,350 sqft",
        photo: "1/12 Photos",
        furnishing: "Semi Furnished",
        type: "3 BHK",
        tenant: "Family",
        available: "Ready to Move",
        parking: "Bike Parking Car Parking",
        apartmentType: "Gated Society",
        listingMode: "Buy",
        image: "/propertydirect/images/sunrise_heights.jpg",
        nearby: ["Sarjapur Road", "HSR Layout", "Manipal Hospital"]
    },
    {
        title: "2 BHK Apartment in Manifest Heights",
        society: "Manifest Heights",
        locality: "Hebbal",
        city: "Bangalore",
        rent: 28000,
        price: "₹ 28,000 / mo",
        maintenance: 2400,
        deposit: "₹2,50,000",
        sqft: "1,080 sqft",
        photo: "1/14 Photos",
        furnishing: "Semi Furnished",
        type: "2 BHK",
        tenant: "Family / Bachelor",
        available: "Ready to Move",
        parking: "Bike Parking Car Parking",
        apartmentType: "Gated Society",
        listingMode: "Rent",
        image: "/propertydirect/images/orchid_enclave.jpg",
        nearby: ["Kempapura", "Coffee Board Park", "Ramaiah Hospital"]
    },
    {
        title: "3 BHK Apartment in Lake View Residency",
        society: "Lake View Residency",
        locality: "Bellandur",
        city: "Bangalore",
        rent: 50000,
        price: "₹ 50,000 / mo",
        maintenance: 3500,
        deposit: "₹2,50,000",
        sqft: "1,400 sqft",
        photo: "1/9 Photos",
        furnishing: "Semi Furnished",
        type: "3 BHK",
        tenant: "Company",
        available: "30 Days",
        parking: "Car Parking",
        apartmentType: "Gated Society",
        listingMode: "Rent",
        image: "/propertydirect/images/belvedere.jpg",
        nearby: ["Wells Fargo", "Marathahalli", "Kundalahalli"]
    },
    {
        title: "1 BHK Apartment in Rajaji Nagar",
        society: "Standalone Apartment",
        locality: "Rajaji Nagar",
        city: "Bangalore",
        rent: 25000,
        price: "₹ 25,000 / mo",
        maintenance: 0,
        deposit: "₹2,00,000",
        sqft: "850 sqft",
        photo: "1/14 Photos",
        furnishing: "Fully Furnished",
        type: "1 BHK",
        tenant: "All",
        available: "Ready to Move",
        parking: "Bike Parking",
        apartmentType: "Standalone Apartment",
        listingMode: "Rent",
        image: "/propertydirect/images/orchid_enclave.jpg",
        nearby: ["Metro Station", "Veeresh Cinemas", "Bank"]
    }
];

const publishedListingsStorageKey = "propertydirect-published-listings:v1";
const cityOptionsStorageKey = "propertydirect-city-options:v1";
const ownerContactRequestsStorageKey = "propertydirect-owner-contact-requests:v1";
const defaultCityOptions = ["Bangalore", "Chennai", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"];

const societyData = [
    ["Standalone Apartment", 172],
    ["Prestige City", 85],
    ["Sobha Dream Gardens", 66],
    ["Brigade El Dorado", 44],
    ["Nikoo Homes", 42],
    ["Greenview Towers", 21]
];

const results = document.getElementById("apartmentResults");
const resultCount = document.getElementById("resultCount");
const societyStrip = document.getElementById("societyStrip");
const toast = document.getElementById("toast");
const modal = document.getElementById("appModal");
const defaultCity = document.getElementById("listingCity")?.value || "Bangalore";
const defaultBudget = document.getElementById("budgetRange")?.value || "80000";
const defaultMinBudget = document.getElementById("minBudgetRange")?.value || "0";
let activeFilters = new Map();
let activeModalKind = "contact";
let activePostType = "rent";
let activeApartmentTitle = "Selected apartment";
let activeApartmentDetails = null;
let activeSearchMode = "";
let approvedDiscoveryLoaded = false;
let approvedDiscoveryListings = [];

function titleCasePlace(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function readPublishedListings() {
    let items = [];
    try {
        items = JSON.parse(localStorage.getItem(publishedListingsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(publishedListingsStorageKey);
        items = [];
    }

    const keys = ["pd_inventory_state", "propertydirect_inventory_states"];
    keys.forEach(k => {
        try {
            const stored = localStorage.getItem(k);
            if (stored) {
                const parsed = JSON.parse(stored);
                for (const key in parsed) {
                    const entry = parsed[key];
                    if (entry && !entry.deleted && !entry.hidden && !entry.rejected && !entry.sold) {
                        const existingIdx = items.findIndex(i => String(i.id).toLowerCase() === String(key).toLowerCase() || String(i.title).toLowerCase() === String(entry.title).toLowerCase());
                        const formatted = {
                            id: key,
                            title: entry.title || "Luxury Property",
                            price: entry.price || "₹1.45 Cr",
                            locality: entry.address || "Anna Nagar, Chennai",
                            city: "Chennai",
                            image: entry.image || "/propertydirect/assets/images/property-1.jpg",
                            video: entry.video || "https://www.w3schools.com/html/mov_bbb.mp4",
                            type: entry.tier || "Featured",
                            rent: Number(String(entry.price || "").replace(/[^\d]/g, "")) || 14500000
                        };
                        if (existingIdx >= 0) {
                            items[existingIdx] = Object.assign({}, items[existingIdx], formatted);
                        } else {
                            items.unshift(formatted);
                        }
                    }
                }
            }
        } catch(e) {}
    });

    return items;
}

function readCityOptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(cityOptionsStorageKey) || "[]");
        const postedCities = readPublishedListings().map(item => item.city).filter(Boolean);
        return [...new Set([...defaultCityOptions, ...saved, ...postedCities].map(titleCasePlace).filter(Boolean))];
    } catch {
        localStorage.removeItem(cityOptionsStorageKey);
        return defaultCityOptions;
    }
}

function saveCityOption(city) {
    const normalized = titleCasePlace(city);
    if (!normalized) return;
    const cities = readCityOptions();
    if (!cities.includes(normalized)) {
        localStorage.setItem(cityOptionsStorageKey, JSON.stringify([...cities, normalized]));
    }
    hydrateCityDropdowns(normalized);
}

function hydrateCityDropdowns(selectedCity = "") {
    document.querySelectorAll("#listingCity, #city").forEach(select => {
        const current = selectedCity || select.value || defaultCity;
        select.innerHTML = readCityOptions().map(city => `<option value="${city}">${city}</option>`).join("");
        if (current && ![...select.options].some(option => option.value === current)) {
            select.insertAdjacentHTML("beforeend", `<option value="${current}">${current}</option>`);
        }
        if (current) select.value = current;
    });
}

function publishedApartments() {
    return approvedDiscoveryListings.map((item) => ({
        id: item.id,
        isPublished: true,
        listingMode: item.type || "Rent",
        title: escapeApartmentText(item.title || `Property in ${item.locality || item.city || "your city"}`),
        society: escapeApartmentText(item.society || item.locality || "Owner Listed Apartment"),
        locality: escapeApartmentText(item.locality || "Owner Listed"),
        city: escapeApartmentText(item.city || "Not specified"),
        rent: Number(item.rent ?? item.price ?? 0),
        maintenance: Number(item.maintenance || 0),
        deposit: item.deposit == null ? "Not specified" : money(Number(item.deposit)),
        sqft: item.sqft || "Area not specified",
        photo: "Owner posted",
        furnishing: escapeApartmentText(item.furnishing || "Not specified"),
        type: escapeApartmentText(item.bhk || "Not specified"),
        tenant: "All",
        available: escapeApartmentText(item.available || "Confirm availability"),
        parking: escapeApartmentText(item.parking || "Not specified"),
        apartmentType: escapeApartmentText(item.apartmentType || "Apartment"),
        image: safeApartmentImage(item.image || item.imageUrl),
        video: item.video || item.videoUrl || "",
        imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
        bathrooms: item.bathrooms,
        address: item.address,
        pincode: item.pincode,
        description: item.description,
        nearby: [escapeApartmentText(item.amenities || "Amenities not specified"), "Direct contact"]
    }));
}

function escapeApartmentText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);}
function safeApartmentImage(value){const url=String(value||"");return /^(\/|https:\/\/)/i.test(url)?escapeApartmentText(url):"/shared/images/apartment-living-1.webp";}

function allApartments() {
    return publishedApartments();
}

function readOwnerContactRequests() {
    try {
        return JSON.parse(localStorage.getItem(ownerContactRequestsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(ownerContactRequestsStorageKey);
        return [];
    }
}

function saveOwnerContactRequest(request) {
    const existing = readOwnerContactRequests();
    localStorage.setItem(ownerContactRequestsStorageKey, JSON.stringify([request, ...existing].slice(0, 120)));
}

function money(value) {
    return `₹${value.toLocaleString("en-IN")}`;
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function renderSocieties() {
    if (!societyStrip) return;
    societyStrip.innerHTML = societyData.map(([name, count]) => `
        <button class="society-chip" data-society="${name}">
            <span class="society-chip-name">${name}</span>
            <span class="society-chip-count">${count}</span>
            <span class="society-chip-label">Apartments</span>
        </button>
    `).join("");
}

function getApartmentValue(apt, group) {
    const values = {
        bhk: apt.type,
        availability: apt.available,
        furnishing: apt.furnishing,
        parking: apt.parking,
        apartmentType: apt.apartmentType
    };
    return String(values[group] || "").toLowerCase();
}

function matchesGroupedFilters(apt) {
    return [...activeFilters.entries()].every(([group, values]) => {
        if (!values.size) return true;

        if (group === "bhk") {
            const aptTypeNum = String(apt.type || "").replace(/\D/g, "");
            return [...values].some(val => {
                const filterNum = String(val).replace(/\D/g, "");
                if (String(val).includes("+") && filterNum && aptTypeNum) return Number(aptTypeNum) >= Number(filterNum);
                return filterNum && aptTypeNum ? filterNum === aptTypeNum : String(apt.type || "").toLowerCase().includes(String(val).toLowerCase());
            });
        }

        if (group === "availability") {
            const aptAvail = String(apt.available || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("ready") || target.includes("immediate")) return aptAvail.includes("ready") || aptAvail.includes("immediate");
                if (target.includes("15")) return aptAvail.includes("15") || aptAvail.includes("immediate") || aptAvail.includes("ready");
                if (target.includes("30")) return aptAvail.includes("30") || aptAvail.includes("15") || aptAvail.includes("immediate") || aptAvail.includes("ready");
                return aptAvail.includes(target);
            });
        }

        if (group === "furnishing") {
            const aptFurn = String(apt.furnishing || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("full")) return aptFurn.includes("full");
                if (target.includes("semi")) return aptFurn.includes("semi");
                if (target.includes("unfurnished") || target.includes("none")) return aptFurn.includes("unfurnished") || aptFurn.includes("none");
                return aptFurn.includes(target);
            });
        }

        if (group === "parking") {
            const aptPark = String(apt.parking || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("bike") || target.includes("2")) return aptPark.includes("bike") || aptPark.includes("2");
                if (target.includes("car") || target.includes("4")) return aptPark.includes("car") || aptPark.includes("4");
                return aptPark.includes(target);
            });
        }

        const apartmentValue = getApartmentValue(apt, group);
        return [...values].some(value => apartmentValue.includes(String(value).toLowerCase()));
    });
}

function activeFilterCount() {
    return [...activeFilters.values()].reduce((total, values) => total + values.size, 0);
}

function updateFilterState(message = "") {
    document.querySelectorAll("[data-filter]").forEach(button => {
        const group = button.dataset.filterGroup || "general";
        const active = activeFilters.get(group)?.has(button.dataset.filter) || false;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    renderApartments();
    if (message) showToast(message);
}

function filteredApartments() {
    const query = (document.getElementById("listingSearch")?.value || "").toLowerCase().trim();
    const city = (document.getElementById("listingCity")?.value || "").toLowerCase().trim();
    const budget = Number(document.getElementById("budgetRange")?.value || 150000);
    const minBudget = Number(document.getElementById("minBudgetRange")?.value || 0);
    const mode = (activeSearchMode || "").toLowerCase().trim();

    return allApartments().filter((apt) => {
        const text = `${apt.title} ${apt.society} ${apt.locality} ${apt.city} ${apt.type} ${apt.listingMode || ""} ${apt.furnishing} ${apt.available} ${apt.parking} ${apt.apartmentType} ${apt.nearby?.join(" ") || ""}`.toLowerCase();
        const filtersOk = matchesGroupedFilters(apt);
        const queryOk = !query || text.includes(query);
        const cityOk = !city || String(apt.city || "").toLowerCase() === city || String(apt.locality || "").toLowerCase() === city;

        const modeOk = !mode || String(apt.listingMode || "").toLowerCase() === mode;
        const budgetOk = apt.rent >= minBudget && apt.rent <= budget;

        return cityOk && modeOk && budgetOk && filtersOk && queryOk;
    });
}

function matchingCityModeApartments() {
    return filteredApartments();
}

function renderApartments(items = filteredApartments()) {
    if (!results) return;
    updateListingContext(items.length);
    resultCount.textContent = items.length;
    if (!items.length) {
        results.innerHTML = `
            <article class="apartment-card empty-results">
                <h2>No apartments matched</h2>
                <p>Try removing one filter, increasing the budget, or changing the city/search keyword.</p>
                <button class="primary" type="button" id="emptyResetFilters">Reset Filters</button>
            </article>
        `;
        return;
    }
    results.innerHTML = items.map((apt, index) => {
        const rawSlug = `${apt.type || "2-BHK"}-${apt.apartmentType || "apartment"}-for-${(apt.listingMode || "rent").toLowerCase()}-in-${apt.locality || "central"}-${apt.city || "chennai"}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const detailUrl = `/propertydirect/apartment-detail?id=${encodeURIComponent(apt.id)}`;
        const bathroomsText = apt.bathrooms ? `${apt.bathrooms} Baths` : "Bathrooms not specified";
        const ownerAgentLabel = "Approved Owner / Builder Listing";
        return `
        <article class="apartment-card" data-listing-id="${apt.id}"
            data-apartment-title="${safeAttribute(apt.title)}"
            data-apartment-city="${safeAttribute(apt.city)}"
            data-apartment-locality="${safeAttribute(apt.locality)}"
            data-apartment-society="${safeAttribute(apt.society)}"
            data-apartment-rent="${safeAttribute(money(apt.rent))}"
            data-apartment-deposit="${safeAttribute(apt.deposit)}"
            data-apartment-sqft="${safeAttribute(apt.sqft)}"
            data-apartment-bhk="${safeAttribute(apt.type)}"
            data-apartment-furnishing="${safeAttribute(apt.furnishing)}"
            data-apartment-availability="${safeAttribute(apt.available)}"
            data-apartment-mode="${safeAttribute(apt.listingMode || activeSearchMode || "Rent")}">
            <div class="apt-photo" style="position: relative;">
                <img src="${apt.image}" alt="${apt.title} at ${apt.society}">
                <span>${apt.apartmentType || "Apartment"} · ${apt.available}</span>
                <span class="verified-badge" style="position: absolute; top: 12px; right: 12px; background: rgba(16, 185, 129, 0.95); color: #ffffff; font-weight: 800; font-size: 0.72rem; padding: 4px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 12px rgba(15,23,42,0.18); backdrop-filter: blur(4px);">✓ Verified Property</span>
                ${apt.video ? `<button type="button" onclick="event.stopPropagation(); if (typeof playPropertyVideo === 'function') playPropertyVideo('${apt.video}', '${safeAttribute(apt.title)}')" style="position: absolute; bottom: 12px; right: 12px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-weight: 800; font-size: 0.76rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.4); display: inline-flex; align-items: center; gap: 4px; z-index: 3;">Play Video Tour</button>` : ''}
            </div>
            <div class="apt-body">
                <div class="apt-title-row">
                    <div>
                        <h2><a href="${detailUrl}">${apt.title}</a></h2>
                        <p class="apt-address">📍 ${apt.society}, ${apt.locality}, ${apt.city}</p>
                    </div>
                    <button class="icon-action" data-action="shortlist" title="Save to Favourites"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>Save</span></button>
                </div>
                <div class="apt-price-grid">
                    <article><span>Price</span><strong>${money(apt.rent)}</strong></article>
                    <article><span>Area</span><strong>${apt.sqft}</strong></article>
                    <article><span>BHK / Baths</span><strong>${apt.type} | ${bathroomsText}</strong></article>
                </div>
                <div class="apt-facts">
                    <article><span>Type</span><strong>${apt.apartmentType || "Apartment"}</strong></article>
                    <article><span>Furnishing</span><strong>${apt.furnishing}</strong></article>
                    <article><span>Status</span><strong>${apt.available}</strong></article>
                    <article><span>Listed by</span><strong>${ownerAgentLabel}</strong></article>
                </div>
                <div class="apt-actions">
                    <a class="primary" href="${detailUrl}">View Details</a>
                    <button class="primary" data-action="owner">Get Details</button>
                    <button class="ghost" data-action="visit">Schedule Visit</button>
                    <button class="ghost" data-action="shortlist">♡ Save</button>
                </div>
            </div>
        </article>
    `; }).join("");
}

let leafletMapInstance = null;
let leafletMarkers = [];

function renderMapView() {
    const mapView = document.getElementById("mapView");
    if (!mapView) return;
    const items = matchingCityModeApartments();
    const city = document.getElementById("listingCity")?.value || defaultCity;
    
    mapView.innerHTML = `
        <div class="map-shell">
            <div class="map-sidebar">
                <div class="map-sidebar-head">
                    <h3>Apartments in ${city}</h3>
                    <span class="map-count">${items.length} locations mapped</span>
                </div>
                <div class="map-card-list">
                    ${items.map((apt, idx) => `
                        <div class="map-mini-card ${idx === 0 ? 'active' : ''}" data-map-pin="${idx}">
                            <img src="${apt.image}" alt="${apt.title}">
                            <div class="map-mini-info">
                                <strong>${money(apt.rent)}</strong>
                                <h4>${apt.type} in ${apt.locality}</h4>
                                <p>${apt.society}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="map-canvas-container" style="position: relative; height: 100%;">
                <div id="leafletMapContainer" style="width: 100%; height: 100%; z-index: 1;"></div>
            </div>
        </div>
    `;

    if (leafletMapInstance) {
        leafletMapInstance.remove();
        leafletMapInstance = null;
    }

    setTimeout(() => {
        const mapContainer = document.getElementById("leafletMapContainer");
        if (!mapContainer || typeof L === "undefined") return;

        const isMumbai = city.toLowerCase().includes("mumbai");
        const defaultLat = isMumbai ? 19.0760 : 12.9716;
        const defaultLng = isMumbai ? 72.8777 : 77.5946;

        leafletMapInstance = L.map("leafletMapContainer", {
            center: [defaultLat, defaultLng],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMapInstance);

        leafletMarkers = [];
        const bounds = [];

        const coordsMap = {
            "hebbal": [13.0358, 77.5970],
            "kaikondrahalli": [12.9121, 77.6747],
            "bellandur": [12.9304, 77.6784],
            "rajaji nagar": [12.9982, 77.5530],
            "sarjapur road": [12.9250, 77.6850],
            "koramangala": [12.9352, 77.6245],
            "indiranagar": [12.9784, 77.6408],
            "hsr layout": [12.9121, 77.6446],
            "whitefield": [12.9698, 77.7500],
            "bandra": [19.0596, 72.8295],
            "andheri": [19.1197, 72.8464]
        };

        items.forEach((apt, idx) => {
            const localityKey = String(apt.locality || "").toLowerCase();
            let baseCoord = coordsMap[localityKey];
            if (!baseCoord) {
                const angle = (idx / Math.max(1, items.length)) * 2 * Math.PI;
                const radius = 0.02 + (idx * 0.008);
                baseCoord = [defaultLat + Math.sin(angle) * radius, defaultLng + Math.cos(angle) * radius];
            }

            bounds.push(baseCoord);

            const customIcon = L.divIcon({
                className: "leaflet-price-badge-icon",
                html: `<div class="leaflet-price-badge ${idx === 0 ? "active" : ""}">${money(apt.rent)}</div>`,
                iconSize: [80, 30],
                iconAnchor: [40, 15]
            });

            const marker = L.marker(baseCoord, { icon: customIcon }).addTo(leafletMapInstance);

            marker.bindPopup(`
                <div style="font-family: 'Manrope', sans-serif; padding: 4px; max-width: 200px;">
                    <img src="${apt.image}" style="width:100%; height:90px; object-fit:cover; border-radius:8px; margin-bottom:6px;" alt="${apt.title}">
                    <strong style="color:#1d376c; font-size:1rem; display:block;">${money(apt.rent)}</strong>
                    <h4 style="font-size:0.82rem; margin:2px 0; color:#17223b;">${apt.title}</h4>
                    <p style="font-size:0.75rem; color:#64748b; margin:0;">${apt.society}</p>
                </div>
            `);

            leafletMarkers.push(marker);

            marker.on("click", () => {
                mapView.querySelectorAll(".map-mini-card").forEach(el => el.classList.remove("active"));
                const miniCard = mapView.querySelector(`.map-mini-card[data-map-pin="${idx}"]`);
                miniCard?.classList.add("active");
                miniCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
        });

        if (bounds.length > 0) {
            leafletMapInstance.fitBounds(bounds, { padding: [40, 40] });
        }
        leafletMapInstance.invalidateSize();
        
        // Update nearby properties when user moves or zooms map
        leafletMapInstance.on("moveend", () => {
            const center = leafletMapInstance.getCenter();
            const countEl = document.querySelector(".map-count");
            if (countEl) {
                countEl.textContent = `Showing properties near (${center.lat.toFixed(3)}, ${center.lng.toFixed(3)})`;
            }
            showToast("Map view updated: Showing nearby properties in viewport");
        });

        setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 250);
    }, 100);

    mapView.querySelectorAll(".map-mini-card").forEach(card => {
        card.addEventListener("click", () => {
            const idx = parseInt(card.dataset.mapPin, 10);
            mapView.querySelectorAll(".map-mini-card").forEach(el => el.classList.remove("active"));
            card.classList.add("active");
            if (leafletMarkers[idx] && leafletMapInstance) {
                leafletMarkers[idx].openPopup();
                leafletMapInstance.panTo(leafletMarkers[idx].getLatLng());
            }
        });
    });
}

function gradient(index) {
    return "none";
}

function contactFields() {
    return `
        <label>Full Name<input data-modal-field="name" placeholder="Your name"></label>
        <label>Mobile Number<input data-modal-field="phone" type="tel" placeholder="Mobile number"></label>
        <label>Email Address<input data-modal-field="email" type="email" placeholder="Email address"></label>
        <label>Contact Purpose<select data-modal-field="purpose"><option>Check availability</option><option>Schedule discussion</option><option>Negotiate price</option><option>Request documents</option><option>Other</option></select></label>
        <label>Preferred Contact Time<input data-modal-field="preferredTime" type="datetime-local"></label>
        <label>Move-in / Purchase Timeline<input data-modal-field="timeline" placeholder="Immediate, 30 days, 3 months..."></label>
        <label>Financing Status<select data-modal-field="financing"><option>Not applicable</option><option>Funds ready</option><option>Loan pre-approved</option><option>Loan assistance required</option></select></label>
        <label>Message to Owner<textarea data-modal-field="message" placeholder="Share your requirement and questions"></textarea></label>
    `;
}

function safeAttribute(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function detailsFromApartmentCard(card) {
    if (!card) {
        return {
            title: activeApartmentTitle,
            city: document.getElementById("listingCity")?.value || defaultCity,
            mode: activeSearchMode || "Rent"
        };
    }
    return {
        title: card.dataset.apartmentTitle || card.querySelector("h2")?.textContent.trim() || "Selected apartment",
        city: card.dataset.apartmentCity || document.getElementById("listingCity")?.value || defaultCity,
        locality: card.dataset.apartmentLocality || "",
        society: card.dataset.apartmentSociety || "",
        rent: card.dataset.apartmentRent || "",
        deposit: card.dataset.apartmentDeposit || "",
        sqft: card.dataset.apartmentSqft || "",
        bhk: card.dataset.apartmentBhk || "",
        furnishing: card.dataset.apartmentFurnishing || "",
        available: card.dataset.apartmentAvailability || "",
        mode: card.dataset.apartmentMode || activeSearchMode || "Rent"
    };
}

function actionFields(kind) {
    if (kind === "post") return postFields(activePostType);
    if (kind === "visit") {
        return `
            <label>Visitor Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Mobile Number<input data-modal-field="phone" type="tel" placeholder="Mobile number"></label>
            <label>Email Address<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Preferred Date<input data-modal-field="date" type="date"></label>
            <label>Start Time<input data-modal-field="time" type="time"></label>
            <label>Alternate Date<input data-modal-field="alternateDate" type="date"></label>
            <label>Visitor Count<input data-modal-field="visitorCount" type="number" min="1" value="1"></label>
            <label>Visit Mode<select data-modal-field="visitMode"><option>In-person</option><option>Video tour</option><option>Agent-assisted</option></select></label>
            <label>Vehicle Number<input data-modal-field="vehicle" placeholder="Optional"></label>
            <label>Questions / Access Instructions<textarea data-modal-field="instructions" placeholder="Parking, landmark, accessibility or property questions"></textarea></label>
        `;
    }
    if (kind === "photos") {
        return `
            <label>Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Email<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Rooms / Areas Required<input data-modal-field="request" placeholder="Bedroom, balcony, parking..."></label>
            <label>Preferred Format<select data-modal-field="format"><option>Photos</option><option>Walkthrough video</option><option>Both photos and video</option></select></label>
            <label>Additional Instructions<textarea data-modal-field="instructions" placeholder="Angles, fixtures or amenities to capture"></textarea></label>
        `;
    }
    if (kind === "report") {
        return `
            <label>Your Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Email<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Issue Type<select data-modal-field="issue"><option>Wrong price</option><option>Unavailable apartment</option><option>Incorrect photos</option><option>Duplicate listing</option></select></label>
            <label>Listing Reference<input data-modal-field="reference" placeholder="Property or listing reference"></label>
            <label>Evidence Reference<input data-modal-field="evidence" placeholder="Screenshot or document URL"></label>
            <label>Preferred Follow-up<select data-modal-field="followup"><option>Email</option><option>Phone</option><option>In-app</option></select></label>
            <label>Detailed Issue<textarea data-modal-field="details" placeholder="Explain what is incorrect and the expected correction"></textarea></label>
        `;
    }
    return contactFields();
}

function postFields(type = activePostType) {
    const typeLabel = {
        rent: "Apartment for Rent",
        sale: "Apartment for Sale",
        premium: "Premium Apartment"
    }[type] || "Apartment";
    return `
        <div class="post-type-tabs" role="tablist" aria-label="Property type">
            <button type="button" class="${type === "rent" ? "active" : ""}" data-post-type="rent" aria-pressed="${type === "rent"}"><span aria-hidden="true">🏠</span> Rent</button>
            <button type="button" class="${type === "sale" ? "active" : ""}" data-post-type="sale" aria-pressed="${type === "sale"}"><span aria-hidden="true">🏷️</span> Sale</button>
            <button type="button" class="${type === "premium" ? "active" : ""}" data-post-type="premium" aria-pressed="${type === "premium"}"><span aria-hidden="true">✨</span> Premium</button>
        </div>
        <div class="form-grid">
            <label>Owner Name<input data-modal-field="owner" placeholder="Owner name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Property Type<input data-modal-field="propertyType" value="${typeLabel}"></label>
            <label>City<input data-modal-field="city" value="${document.getElementById("listingCity")?.value || defaultCity}"></label>
            <label>Locality<input data-modal-field="locality" placeholder="Locality"></label>
            <label>Apartment / Society<input data-modal-field="society" placeholder="Society name"></label>
            <label>BHK<select data-modal-field="bhk"><option>1 BHK</option><option selected>2 BHK</option><option>3 BHK</option><option>4 BHK</option></select></label>
            <label>${type === "sale" ? "Expected Price" : "Monthly Rent"}<input data-modal-field="price" placeholder="${type === "sale" ? "₹72 L" : "₹28,000"}"></label>
            <label>Furnishing<select data-modal-field="furnishing"><option>Semi Furnished</option><option>Fully Furnished</option><option>Unfurnished</option></select></label>
            <label>Availability<select data-modal-field="available"><option>Ready to Move</option><option>15 Days</option><option>30 Days</option></select></label>
        </div>
    `;
}

function postFields(type = activePostType) {
    const typeLabel = {
        rent: "Apartment for Rent",
        sale: "Apartment for Sale",
        premium: "Premium Apartment"
    }[type] || "Apartment";
    return `
        <div class="post-type-tabs" role="tablist" aria-label="Property type">
            <button type="button" class="${type === "rent" ? "active" : ""}" data-post-type="rent" aria-pressed="${type === "rent"}">Rent</button>
            <button type="button" class="${type === "sale" ? "active" : ""}" data-post-type="sale" aria-pressed="${type === "sale"}">Sale</button>
            <button type="button" class="${type === "premium" ? "active" : ""}" data-post-type="premium" aria-pressed="${type === "premium"}">Premium</button>
        </div>
        <div class="form-grid">
            <label>Owner Name<input data-modal-field="owner" placeholder="Owner name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Property Type<input data-modal-field="propertyType" value="${typeLabel}"></label>
            <label>Apartment Type<select data-modal-field="apartmentType"><option>Gated Society</option><option>Standalone Apartment</option><option>Villa</option><option>Studio</option><option>Builder Floor</option></select></label>
            <label>City / Town<input data-modal-field="city" list="propertydirectCityOptions" value="${document.getElementById("listingCity")?.value || defaultCity}" placeholder="Example: Bargur"></label>
            <label>Locality<input data-modal-field="locality" placeholder="Locality"></label>
            <label>Apartment / Society<input data-modal-field="society" placeholder="Society name"></label>
            <label>BHK<select data-modal-field="bhk"><option>1 BHK</option><option selected>2 BHK</option><option>3 BHK</option><option>4 BHK</option><option>5 BHK</option></select></label>
            <label>${type === "sale" ? "Expected Price" : "Monthly Rent"}<input data-modal-field="price" placeholder="${type === "sale" ? "Rs. 72 L" : "Rs. 28,000"}"></label>
            <label>Deposit<input data-modal-field="deposit" placeholder="Example: Rs. 1,00,000"></label>
            <label>Built-up Sqft<input data-modal-field="sqft" placeholder="Example: 1,100 sqft"></label>
            <label>Furnishing<select data-modal-field="furnishing"><option>Semi Furnished</option><option>Fully Furnished</option><option>Unfurnished</option></select></label>
            <label>Availability<select data-modal-field="available"><option>Ready to Move</option><option>15 Days</option><option>30 Days</option><option>Under Construction</option></select></label>
            <label>Parking<select data-modal-field="parking"><option>Bike Parking Car Parking</option><option>Car Parking</option><option>Bike Parking</option><option>No Parking</option></select></label>
            <label>Preferred Tenant<select data-modal-field="tenant"><option>All</option><option>Family</option><option>Family / Bachelor</option><option>Company</option></select></label>
            <label>Property Photo<input data-modal-field="image" type="file" accept="image/*"></label>
            <label>More Details<textarea data-modal-field="notes" placeholder="Balcony, lift, water, nearby landmark..."></textarea></label>
        </div>
        <datalist id="propertydirectCityOptions">${readCityOptions().map(city => `<option value="${city}"></option>`).join("")}</datalist>
    `;
}

function setModalFields(kind) {
    const fields = document.getElementById("modalFields");
    if (!fields) return;
    fields.innerHTML = actionFields(kind);
}

function openModal(title, text, kind = "contact", source = null) {
    if (!modal) {
        showToast(text);
        return;
    }
    activeModalKind = kind;
    activeApartmentDetails = detailsFromApartmentCard(source?.closest?.(".apartment-card"));
    activeApartmentTitle = activeApartmentDetails.title || "Selected apartment";
    modal.dataset.modalKind = kind;
    const modalTitle = document.getElementById("modalTitle");
    modalTitle.innerHTML = kind === "post"
        ? `<span class="posting-title-icon" aria-hidden="true">＋</span><span>${title}</span>`
        : title;
    document.getElementById("modalText").textContent = text;
    setModalFields(kind);
    const submit = document.getElementById("modalSubmit");
    if (submit) submit.innerHTML = kind === "post" ? `<span aria-hidden="true">＋</span> Post Apartment` : "Submit";
    modal.classList.remove("hidden");
    modal.querySelector("[data-modal-field]")?.focus();
}

function actionMessage(action) {
    const map = {
        contact: ["Contact Verified Owner", "Share your details to unlock verified owner contact."],
        owner: ["Get Owner Details", "Share your details to unlock verified owner contact."],
        visit: ["Schedule Visit", "Choose a preferred visit time for this apartment."],
        photos: ["Request Photos", "We will notify the owner to upload more apartment photos."],
        report: ["Report Apartment", "Tell us what is incorrect in this apartment listing."],
        shortlist: ["Shortlisted", "Apartment added to your shortlist."],
        post: ["Post Apartment", "Choose Rent, Sale or Premium and add clear apartment details."]
    };
    return map[action] || ["Apartment Action", "Action completed."];
}

function resetApartmentSearch() {
    activeFilters = new Map();
    document.querySelectorAll(".filters button.active, [data-view-mode].active").forEach(btn => btn.classList.remove("active"));
    document.querySelector('[data-view-mode="list"]')?.classList.add("active");
    const city = document.getElementById("listingCity");
    const search = document.getElementById("listingSearch");
    const budget = document.getElementById("budgetRange");
    const minBudget = document.getElementById("minBudgetRange");
    if (city) city.value = defaultCity;
    if (search) search.value = "";
    if (budget) {
        budget.value = defaultBudget;
        document.getElementById("budgetValue").textContent = money(Number(defaultBudget));
    }
    if (minBudget) {
        minBudget.value = defaultMinBudget;
        document.getElementById("minBudgetValue").textContent = money(Number(defaultMinBudget));
    }
    document.getElementById("apartmentResults")?.classList.remove("hidden");
    document.getElementById("mapView")?.classList.add("hidden");
    updateFilterState("Filters reset");
}

function matchingCityModeApartments() {
    const city = (document.getElementById("listingCity")?.value || "").toLowerCase();
    return allApartments().filter((apt) => {
        const cityOk = !city || String(apt.city || "").toLowerCase() === city;
        const text = `${apt.title} ${apt.society} ${apt.locality} ${apt.city} ${apt.type} ${apt.listingMode || ""} ${apt.apartmentType || ""}`.toLowerCase();
        const modeOk = !activeSearchMode || apt.isPublished || String(apt.listingMode || "").toLowerCase().includes(activeSearchMode.toLowerCase()) || text.includes(activeSearchMode.toLowerCase());
        return cityOk && modeOk;
    });
}

function syncBudgetForCurrentSearch() {
    const budget = document.getElementById("budgetRange");
    if (!budget) return;
    const maxRent = matchingCityModeApartments().reduce((max, apt) => Math.max(max, Number(apt.rent || 0)), Number(defaultBudget));
    if (maxRent > Number(budget.max || 0)) budget.max = String(maxRent);
    if (maxRent > Number(budget.value || 0)) budget.value = String(maxRent);
    document.getElementById("budgetValue").textContent = money(Number(budget.value));
}

function updateListingContext(count = Number(resultCount?.textContent || 0)) {
    const city = document.getElementById("listingCity")?.value || "Selected city";
    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) breadcrumb.textContent = `Home / Apartments / ${city}${activeSearchMode ? ` / ${activeSearchMode}` : ""}`;
    const liveCount = document.getElementById("resultCount");
    if (liveCount) liveCount.textContent = String(count);
}

function readImageFile(file) {
    if (!file) return Promise.resolve("");
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

async function submitPostedApartment() {
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const imageFile = fields?.querySelector('[data-modal-field="image"]')?.files?.[0] || null;
    const bhk = read("bhk") || "2 BHK";
    const locality = read("locality") || "New Locality";
    const society = read("society") || "Owner Listed Apartment";
    const city = titleCasePlace(read("city") || defaultCity);
    const rawPrice = read("price").replace(/[^\d]/g, "");
    const rent = activePostType === "sale" ? Number(rawPrice || 7500000) : Number(rawPrice || 28000);
    const mode = activePostType === "sale" ? "Buy" : activePostType === "premium" ? "Premium" : "Rent";
    const uploadedImage = await readImageFile(imageFile);
    const postedApartment = {
        title: `${bhk} ${activePostType === "premium" ? "Premium Apartment" : "Apartment"} in ${locality}`,
        society,
        locality,
        city,
        rent,
        maintenance: 0,
        deposit: read("deposit") || (mode === "Buy" ? "For Sale" : "Rs. 1,00,000"),
        sqft: read("sqft") || "1,100 sqft",
        photo: uploadedImage ? "Uploaded Photo" : "New Listing",
        furnishing: read("furnishing") || "Semi Furnished",
        type: bhk,
        tenant: read("tenant") || "All",
        available: read("available") || "Ready to Move",
        parking: read("parking") || "Bike Parking Car Parking",
        apartmentType: read("apartmentType") || (mode === "Premium" ? "Gated Society" : "Standalone Apartment"),
        image: uploadedImage || (mode === "Premium" ? "/shared/images/propertydirect-cinematic-2.webp" : "/shared/images/apartment-living-1.webp"),
        nearby: [read("notes") || "Owner listed", "Direct contact", "No brokerage"]
    };
    apartments.unshift(postedApartment);
    const published = readPublishedListings().filter(item => item.title !== postedApartment.title);
    localStorage.setItem(publishedListingsStorageKey, JSON.stringify([{
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: postedApartment.title,
        society,
        locality,
        city,
        type: mode,
        price: read("price") || (mode === "Buy" ? "Rs. 75,00,000" : "Rs. 28,000"),
        rent,
        maintenance: 0,
        deposit: postedApartment.deposit,
        sqft: postedApartment.sqft,
        bhk,
        furnishing: postedApartment.furnishing,
        available: postedApartment.available,
        parking: postedApartment.parking,
        tenant: postedApartment.tenant,
        apartmentType: postedApartment.apartmentType,
        notes: read("notes") || "",
        image: postedApartment.image,
        status: "Live",
        publishedAt: new Date().toISOString()
    }, ...published].slice(0, 80)));
    saveCityOption(city);
    const citySelect = document.getElementById("listingCity");
    if (citySelect) citySelect.value = city;
    modal.classList.add("hidden");
    activeFilters = new Map();
    document.querySelectorAll(".filters button.active").forEach(btn => btn.classList.remove("active"));
    const search = document.getElementById("listingSearch");
    if (search) search.value = "";
    const budget = document.getElementById("budgetRange");
    if (budget && Number(budget.value) < rent) {
        budget.value = String(rent);
        document.getElementById("budgetValue").textContent = money(rent);
    }
    document.getElementById("apartmentResults")?.classList.remove("hidden");
    document.getElementById("mapView")?.classList.add("hidden");
    updateFilterState();
    showToast(`Apartment posted in ${city} and city dropdown updated`);
}

document.addEventListener("click", (event) => {
    const modalTrigger = event.target.closest("[data-open-modal]");
    if (modalTrigger) {
        event.preventDefault();
        const [title, text] = actionMessage(modalTrigger.dataset.openModal);
        openModal(title, text, modalTrigger.dataset.openModal);
        return;
    }

    const postType = event.target.closest("[data-post-type]");
    if (postType) {
        event.preventDefault();
        activePostType = postType.dataset.postType;
        setModalFields("post");
        modal.querySelectorAll("[data-post-type]").forEach(button => {
            const active = button.dataset.postType === activePostType;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        return;
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
        event.preventDefault();
        const group = filter.dataset.filterGroup || "general";
        const value = filter.dataset.filter;
        const values = activeFilters.get(group) || new Set();
        if (values.has(value)) values.delete(value);
        else values.add(value);
        if (values.size) activeFilters.set(group, values);
        else activeFilters.delete(group);
        updateFilterState(`${activeFilterCount()} filter${activeFilterCount() === 1 ? "" : "s"} applied`);
        return;
    }

    const society = event.target.closest("[data-society]");
    if (society) {
        document.getElementById("listingSearch").value = society.dataset.society;
        renderApartments();
        showToast(`Showing ${society.dataset.society}`);
    }

    if (window.location.pathname.includes("apartment-detail")) return;

    const action = event.target.closest("[data-action]")?.dataset.action || event.target.closest("[data-detail-action]")?.dataset.detailAction;
    if (action) {
        const [title, text] = actionMessage(action);
        if (action === "shortlist") {
            const btn = event.target.closest("button");
            const card = event.target.closest(".apartment-card") || document.querySelector(".detail-hero");
            const details = detailsFromApartmentCard(card);
            let saved = [];
            try { saved = JSON.parse(localStorage.getItem("propertydirect-saved-listings") || "[]"); } catch(e){}
            const index = saved.findIndex(item => item.title === details.title);
            if (index >= 0) {
                saved.splice(index, 1);
                btn?.classList.remove("active", "saved");
                showToast(`Removed ${details.title} from shortlist`);
            } else {
                saved.unshift({
                    title: details.title,
                    rent: details.rent,
                    locality: details.locality,
                    city: details.city,
                    society: details.society,
                    bhk: details.bhk,
                    sqft: details.sqft,
                    image: card?.querySelector("img")?.src || "/propertydirect/images/orchid_enclave.jpg"
                });
                btn?.classList.add("active", "saved");
                showToast(`Shortlisted ${details.title}`);
            }
            localStorage.setItem("propertydirect-saved-listings", JSON.stringify(saved));
        }
        else openModal(title, text, action === "post" ? "post" : action, event.target);
    }

    const searchModeBtn = event.target.closest("[data-search-mode]");
    if (searchModeBtn) {
        event.preventDefault();
        document.querySelectorAll("[data-search-mode]").forEach(b => b.classList.remove("active"));
        searchModeBtn.classList.add("active");
        activeSearchMode = searchModeBtn.dataset.searchMode;
        renderApartments();
        showToast(`Filtered by ${activeSearchMode.toUpperCase()}`);
    }

    const emptyReset = event.target.closest("#emptyResetFilters");
    if (emptyReset) {
        resetApartmentSearch();
    }
});

document.querySelectorAll(".view-toggle button[data-view-mode]").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".view-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const mode = btn.dataset.viewMode;
        const listView = document.getElementById("apartmentResults");
        const mapView = document.getElementById("mapView");
        const societyStrip = document.querySelector(".society-strip");

        if (mode === "map") {
            if (listView) listView.classList.add("hidden");
            if (societyStrip) societyStrip.classList.add("hidden");
            if (mapView) mapView.classList.remove("hidden");
            renderMapView();
            showToast("Switched to Interactive Map View");
        } else {
            if (mapView) mapView.classList.add("hidden");
            if (listView) listView.classList.remove("hidden");
            if (societyStrip) societyStrip.classList.remove("hidden");
            renderApartments();
            showToast("Switched to List View");
        }
    });
});

document.getElementById("listingSearchButton")?.addEventListener("click", () => {
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
    showToast("Apartment search updated");
});

document.getElementById("listingCity")?.addEventListener("change", () => {
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
    showToast(`Showing ${document.getElementById("listingCity")?.value || "selected city"} apartments`);
});

document.getElementById("listingSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.getElementById("listingSearchButton")?.click();
});

document.getElementById("clearFilters")?.addEventListener("click", () => {
    resetApartmentSearch();
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView();
});

document.getElementById("budgetRange")?.addEventListener("input", (event) => {
    const minimum = document.getElementById("minBudgetRange");
    if (minimum && Number(event.target.value) < Number(minimum.value)) minimum.value = event.target.value;
    document.getElementById("budgetValue").textContent = money(Number(event.target.value));
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
});

document.getElementById("minBudgetRange")?.addEventListener("input", (event) => {
    const maximum = document.getElementById("budgetRange");
    if (maximum && Number(event.target.value) > Number(maximum.value)) maximum.value = event.target.value;
    document.getElementById("minBudgetValue").textContent = money(Number(event.target.value));
    if (maximum) document.getElementById("budgetValue").textContent = money(Number(maximum.value));
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
});

document.getElementById("closeModal")?.addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("cancelModal")?.addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("modalSubmit")?.addEventListener("click", async () => {
    if (activeModalKind === "post") {
        await submitPostedApartment();
        return;
    }
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const first = read("name");
    if (activeModalKind === "owner" || activeModalKind === "contact") {
        if (!read("name") || !read("phone") || !read("email")) {
            showToast("Please enter name, phone and email");
            return;
        }
        const request = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: read("name"),
            phone: read("phone"),
            email: read("email"),
            apartment: activeApartmentDetails?.title || activeApartmentTitle,
            city: activeApartmentDetails?.city || document.getElementById("listingCity")?.value || defaultCity,
            locality: activeApartmentDetails?.locality || "",
            society: activeApartmentDetails?.society || "",
            rent: activeApartmentDetails?.rent || "",
            deposit: activeApartmentDetails?.deposit || "",
            sqft: activeApartmentDetails?.sqft || "",
            bhk: activeApartmentDetails?.bhk || "",
            furnishing: activeApartmentDetails?.furnishing || "",
            available: activeApartmentDetails?.available || "",
            mode: activeApartmentDetails?.mode || activeSearchMode || "Rent",
            status: "New",
            submittedAt: new Date().toISOString()
        };
        request.purpose=read("purpose");request.preferredTime=read("preferredTime");request.timeline=read("timeline");request.financing=read("financing");request.message=read("message");
        saveOwnerContactRequest(request);
        modal.classList.add("hidden");
        showToast(`Owner details request saved for ${request.apartment}`);
        return;
    }
    if (activeModalKind === "report") {
        submitApartmentReport({
            name: read("name"),
            phone: read("phone"),
            email: read("email"),
            apartment: activeApartmentTitle,
            issueType: read("issue"),
            details: read("details")
        });
        return;
    }
    modal.classList.add("hidden");
    const messages = {
        owner: "Owner details request submitted",
        contact: "Owner details request submitted",
        visit: "Visit request scheduled",
        photos: "Photo request sent to owner",
        report: "Listing report submitted"
    };
    showToast(`${messages[activeModalKind] || "Submitted successfully"}${first ? ` for ${first}` : ""}`);
});

async function submitApartmentReport(payload) {
    if (!payload.name || !payload.phone || !payload.email) {
        showToast("Please enter name, phone and email");
        return;
    }
    try {
        const response = await fetch("/api/mail/report-apartment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        modal.classList.add("hidden");
        showToast(data.message || `Report email sent to ${payload.email}`);
    } catch (error) {
        showToast("Unable to send report email. Please try again.");
    }
}

function applyUrlSearch() {
    const params = new URLSearchParams(window.location.search);
    const city = params.get("city");
    const query = params.get("q");
    const mode = params.get("mode") || params.get("type");
    if (mode) activeSearchMode = String(mode).toLowerCase();
    if (city) saveCityOption(city);
    if (city && document.getElementById("listingCity")) document.getElementById("listingCity").value = titleCasePlace(city);
    if (query && document.getElementById("listingSearch")) document.getElementById("listingSearch").value = query;
    syncBudgetForCurrentSearch();
    updateListingContext();
}

hydrateCityDropdowns();
applyUrlSearch();
renderSocieties();
updateFilterState();
async function loadPublicInventory() {
    const items=[];
    for(let page=0;;page++) {
        const response=await fetch(`/api/properties/public?page=${page}&size=100`,{headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error('Properties could not be loaded. Please try again.');
        const payload=await response.json();
        items.push(...(Array.isArray(payload)?payload:payload.content||[]));
        if(Array.isArray(payload)||!payload.hasNext) break;
    }
    return items;
}
if(results) results.innerHTML='<article class="apartment-card empty-results" role="status"><h2>Loading properties…</h2><p>Finding approved, available listings.</p></article>';
loadPublicInventory().then(items=>{
    const mapped=items.map(x=>({
        id:x.id,title:x.title,society:x.society,locality:x.locality,city:x.city,type:x.listingType,
        rent:Number(x.price||0),price:x.price,bhk:x.bhk,bathrooms:x.bathrooms,furnishing:x.furnishing,
        image:x.imageUrl,imageUrl:x.imageUrl,imageUrls:String(x.imageUrls||"").split(/\r?\n/).filter(Boolean),
        deposit:x.deposit,maintenance:x.maintenance,sqft:x.areaSqft?`${x.areaSqft.toLocaleString("en-IN")} sqft`:"Area on request",
        parking:x.parking,address:x.address,pincode:x.pincode,description:x.description,amenities:x.amenities,
        available:x.availableFrom?new Date(x.availableFrom).toLocaleDateString("en-IN"):"Confirm availability",
        apartmentType:x.propertyType||"Apartment"
    }));
    approvedDiscoveryListings = mapped;
    approvedDiscoveryLoaded = true;
    renderSocieties(); updateFilterState();
}).catch(error=>{
    approvedDiscoveryListings = [];
    approvedDiscoveryLoaded = true;
    if(results) results.innerHTML='<article class="apartment-card empty-results" role="alert"><h2>Properties could not be loaded</h2><p>Please retry. Your filters have been kept.</p><button class="primary" type="button" onclick="location.reload()">Try again</button></article>';
});
