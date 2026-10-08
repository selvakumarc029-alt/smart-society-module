const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('c:/smart-society-module-main/src/main/resources/static/propertydirect/js/apartments.js');
let code = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings to \n for consistent replacement
const originalHasCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Update defaultCityOptions & defaultCity & defaultBudget
code = code.replace(
    'const defaultCityOptions = ["Bangalore", "Chennai", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"];',
    'const defaultCityOptions = ["All Cities", "Bengaluru", "Bangalore", "Chennai", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"];'
);

code = code.replace(
    'const defaultCity = document.getElementById("listingCity")?.value || "Bangalore";',
    'const defaultCity = "";'
);

code = code.replace(
    'const defaultBudget = document.getElementById("budgetRange")?.value || "80000";',
    'const defaultBudget = document.getElementById("budgetRange")?.value || "250000";'
);

// 2. City and mode helpers
const oldCityHelpers = `function readCityOptions() {
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
        select.innerHTML = readCityOptions().map(city => \`<option value="\${city}">\${city}</option>\`).join("");
        if (current && ![...select.options].some(option => option.value === current)) {
            select.insertAdjacentHTML("beforeend", \`<option value="\${current}">\${current}</option>\`);
        }
        if (current) select.value = current;
    });
}

function publishedApartments() {
    return approvedDiscoveryListings.map((item) => ({
        id: item.id,
        isPublished: true,
        listingMode: item.type || "Rent",
        title: escapeApartmentText(item.title || \`Property in \${item.locality || item.city || "your city"}\`),
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
}`;

const newCityHelpers = `function isSameCity(aptCity, filterCity) {
    if (!filterCity) return true;
    const f = String(filterCity).trim().toLowerCase();
    if (!f || f === "all" || f === "all cities") return true;
    const a = String(aptCity || "").trim().toLowerCase();
    if (!a) return false;
    if (a === f) return true;

    const isBlr = (s) => s.includes("bangalore") || s.includes("bengaluru");
    if (isBlr(a) && isBlr(f)) return true;

    const isChn = (s) => s.includes("chennai") || s.includes("madras");
    if (isChn(a) && isChn(f)) return true;

    const isMum = (s) => s.includes("mumbai") || s.includes("bombay");
    if (isMum(a) && isMum(f)) return true;

    return a.includes(f) || f.includes(a);
}

function isSameMode(aptMode, filterMode) {
    if (!filterMode) return true;
    const f = String(filterMode).trim().toLowerCase();
    if (!f || f === "all" || f === "all listings") return true;
    const a = String(aptMode || "").trim().toLowerCase();
    if (!a) return true;

    const isRental = (m) => m.includes("rent") || m.includes("lease");
    if (isRental(f)) return isRental(a);

    const isBuy = (m) => m.includes("buy") || m.includes("sale") || m.includes("sell");
    if (isBuy(f)) return isBuy(a);

    return a.includes(f) || f.includes(a);
}

function readCityOptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(cityOptionsStorageKey) || "[]");
        const inventoryCities = (approvedDiscoveryListings || []).map(item => item.city).filter(Boolean);
        const postedCities = readPublishedListings().map(item => item.city).filter(Boolean);
        const raw = ["All Cities", ...defaultCityOptions, ...inventoryCities, ...saved, ...postedCities];
        return [...new Set(raw.map(titleCasePlace).filter(Boolean))];
    } catch {
        localStorage.removeItem(cityOptionsStorageKey);
        return defaultCityOptions;
    }
}

function saveCityOption(city) {
    const normalized = titleCasePlace(city);
    if (!normalized || normalized.toLowerCase() === "all cities") return;
    const cities = readCityOptions();
    if (!cities.includes(normalized)) {
        localStorage.setItem(cityOptionsStorageKey, JSON.stringify([...cities, normalized]));
    }
    hydrateCityDropdowns(normalized);
}

function hydrateCityDropdowns(selectedCity = "") {
    document.querySelectorAll("#listingCity, #city").forEach(select => {
        const current = selectedCity !== "" ? selectedCity : (select.value || "");
        const cities = readCityOptions();
        select.innerHTML = cities.map(city => {
            const isAll = city.toLowerCase() === "all cities";
            const val = isAll ? "" : city;
            const label = (city.toLowerCase() === "bangalore" || city.toLowerCase() === "bengaluru") ? "Bangalore / Bengaluru" : city;
            return \`<option value="\${val}">\${label}</option>\`;
        }).join("");
        if (current && ![...select.options].some(option => option.value.toLowerCase() === current.toLowerCase())) {
            select.insertAdjacentHTML("beforeend", \`<option value="\${current}">\${current}</option>\`);
        }
        if (current) {
            select.value = (current.toLowerCase() === "all cities") ? "" : current;
        } else {
            select.value = "";
        }
    });
}

function publishedApartments() {
    return approvedDiscoveryListings.map((item) => ({
        id: item.id,
        isPublished: true,
        listingMode: item.listingMode || item.listingType || item.type || "Rent",
        title: escapeApartmentText(item.title || \`Property in \${item.locality || item.city || "your city"}\`),
        society: escapeApartmentText(item.society || item.locality || "Owner Listed Apartment"),
        locality: escapeApartmentText(item.locality || "Owner Listed"),
        city: escapeApartmentText(item.city || "Not specified"),
        rent: Number(item.rent ?? item.price ?? 0),
        price: Number(item.price ?? item.rent ?? 0),
        maintenance: Number(item.maintenance || 0),
        deposit: item.deposit == null ? "Not specified" : money(Number(item.deposit)),
        sqft: item.sqft || (item.areaSqft ? \`\${Number(item.areaSqft).toLocaleString("en-IN")} sqft\` : "Area not specified"),
        photo: "Owner posted",
        furnishing: escapeApartmentText(item.furnishing || "Not specified"),
        type: escapeApartmentText(item.bhk || (item.bedrooms ? \`\${item.bedrooms} BHK\` : "2 BHK")),
        bhk: escapeApartmentText(item.bhk || (item.bedrooms ? \`\${item.bedrooms} BHK\` : "2 BHK")),
        tenant: "All",
        available: escapeApartmentText(item.available || "Ready to Move"),
        constructionStatus: escapeApartmentText(item.constructionStatus || "Ready to Move"),
        parking: escapeApartmentText(item.parking || "Not specified"),
        apartmentType: escapeApartmentText(item.propertyType || item.apartmentType || "Apartment"),
        propertyType: escapeApartmentText(item.propertyType || item.apartmentType || "Apartment"),
        image: safeApartmentImage(item.image || item.imageUrl),
        video: item.video || item.videoUrl || "",
        imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
        bathrooms: item.bathrooms,
        address: item.address,
        pincode: item.pincode,
        description: item.description,
        amenities: item.amenities || "",
        nearby: [escapeApartmentText(item.amenities || "Amenities not specified"), "Direct contact"]
    }));
}`;

if (!code.includes(oldCityHelpers)) {
    console.error('Could not find oldCityHelpers');
    process.exit(1);
}
code = code.replace(oldCityHelpers, newCityHelpers);

// 3. Filters block
const oldFiltersBlock = `function getApartmentValue(apt, group) {
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
            const aptTypeNum = String(apt.type || "").replace(/\\D/g, "");
            return [...values].some(val => {
                const filterNum = String(val).replace(/\\D/g, "");
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
        const text = \`\${apt.title} \${apt.society} \${apt.locality} \${apt.city} \${apt.type} \${apt.listingMode || ""} \${apt.furnishing} \${apt.available} \${apt.parking} \${apt.apartmentType} \${apt.nearby?.join(" ") || ""}\`.toLowerCase();
        const filtersOk = matchesGroupedFilters(apt);
        const queryOk = !query || text.includes(query);
        const cityOk = !city || String(apt.city || "").toLowerCase() === city || String(apt.locality || "").toLowerCase() === city;

        const modeOk = !mode || String(apt.listingMode || "").toLowerCase() === mode;
        const budgetOk = apt.rent >= minBudget && apt.rent <= budget;

        return cityOk && modeOk && budgetOk && filtersOk && queryOk;
    });
}`;

const newFiltersBlock = `function getApartmentValue(apt, group) {
    const values = {
        bhk: apt.bhk || apt.type,
        mode: apt.listingMode || apt.type,
        propertyType: apt.apartmentType || apt.propertyType,
        apartmentType: apt.apartmentType || apt.propertyType,
        availability: apt.available,
        furnishing: apt.furnishing,
        parking: apt.parking,
        bathrooms: apt.bathrooms,
        amenities: apt.amenities || apt.nearby?.join(" ")
    };
    return String(values[group] || "").toLowerCase();
}

function matchesGroupedFilters(apt) {
    return [...activeFilters.entries()].every(([group, values]) => {
        if (!values.size) return true;

        if (group === "mode") {
            return [...values].some(val => isSameMode(apt.listingMode || apt.type, val));
        }

        if (group === "propertyType") {
            const aptType = String(apt.apartmentType || apt.propertyType || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                return aptType.includes(target) || target.includes(aptType);
            });
        }

        if (group === "bhk") {
            const aptTypeNum = String(apt.bhk || apt.type || "").replace(/\\D/g, "");
            return [...values].some(val => {
                const filterNum = String(val).replace(/\\D/g, "");
                if (String(val).includes("+") && filterNum && aptTypeNum) return Number(aptTypeNum) >= Number(filterNum);
                return filterNum && aptTypeNum ? filterNum === aptTypeNum : String(apt.type || "").toLowerCase().includes(String(val).toLowerCase());
            });
        }

        if (group === "bathrooms") {
            const aptBaths = Number(apt.bathrooms || 0);
            return [...values].some(val => {
                const target = String(val).replace(/\\D/g, "");
                if (String(val).includes("+") && target) return aptBaths >= Number(target);
                return target ? aptBaths === Number(target) : true;
            });
        }

        if (group === "availability") {
            const aptAvail = String(apt.available || apt.constructionStatus || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("ready") || target.includes("immediate")) return aptAvail.includes("ready") || aptAvail.includes("immediate");
                if (target.includes("under") || target.includes("construction")) return aptAvail.includes("under") || aptAvail.includes("construction");
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

        if (group === "amenities") {
            const aptAmenities = \`\${apt.amenities || ""} \${apt.parking || ""} \${apt.nearby?.join(" ") || ""}\`.toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("security")) return aptAmenities.includes("security") || aptAmenities.includes("gated");
                if (target.includes("pool")) return aptAmenities.includes("pool") || aptAmenities.includes("swimming");
                return aptAmenities.includes(target);
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
        if (group === "mode") {
            const bVal = (button.dataset.filter || "").toLowerCase();
            const active = Boolean(activeSearchMode && isSameMode(bVal, activeSearchMode));
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
            return;
        }
        const active = activeFilters.get(group)?.has(button.dataset.filter) || false;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    renderApartments();
    if (message) showToast(message);
}

function filteredApartments() {
    const searchInput = document.getElementById("listingSearch");
    const query = (searchInput?.value || "").toLowerCase().trim();
    const citySelect = document.getElementById("listingCity");
    const city = (citySelect?.value || "").toLowerCase().trim();
    const budgetEl = document.getElementById("budgetRange");
    const minBudgetEl = document.getElementById("minBudgetRange");
    const budget = Number(budgetEl?.value || 250000);
    const maxBudgetRange = Number(budgetEl?.max || 250000);
    const minBudget = Number(minBudgetEl?.value || 0);
    const mode = (activeSearchMode || "").toLowerCase().trim();

    return allApartments().filter((apt) => {
        const text = \`\${apt.title} \${apt.society} \${apt.locality} \${apt.city} \${apt.bhk || apt.type} \${apt.listingMode || ""} \${apt.furnishing} \${apt.available} \${apt.parking} \${apt.apartmentType || apt.propertyType} \${apt.amenities || ""} \${apt.nearby?.join(" ") || ""}\`.toLowerCase();
        const filtersOk = matchesGroupedFilters(apt);
        const queryOk = !query || text.includes(query);
        const cityOk = isSameCity(apt.city, city) || isSameCity(apt.locality, city);
        const modeOk = isSameMode(apt.listingMode || apt.type, mode);

        let budgetOk = true;
        const aptPrice = Number(apt.rent ?? apt.price ?? 0);
        const isAptSale = isSameMode(apt.listingMode || apt.type, "buy");
        const isSearchRent = mode === "rent" || mode === "lease";
        const isSearchBuy = mode === "buy" || mode === "sale";

        if (isSearchRent) {
            budgetOk = aptPrice >= minBudget && (budget >= maxBudgetRange || aptPrice <= budget);
        } else if (isSearchBuy) {
            if (minBudget > 0) budgetOk = aptPrice >= minBudget;
            if (budget < maxBudgetRange && budget > 500000) budgetOk = budgetOk && aptPrice <= budget;
        } else {
            if (isAptSale) {
                budgetOk = minBudget > 0 ? aptPrice >= minBudget : true;
            } else {
                budgetOk = aptPrice >= minBudget && (budget >= maxBudgetRange || aptPrice <= budget);
            }
        }

        return cityOk && modeOk && budgetOk && filtersOk && queryOk;
    });
}`;

if (!code.includes(oldFiltersBlock)) {
    console.error('Could not find oldFiltersBlock');
    process.exit(1);
}
code = code.replace(oldFiltersBlock, newFiltersBlock);

// 4. Update updateListingContext
const oldUpdateContext = `function updateListingContext(count = Number(resultCount?.textContent || 0)) {
    const city = document.getElementById("listingCity")?.value || "Selected city";
    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) breadcrumb.textContent = \`Home / Apartments / \${city}\${activeSearchMode ? \` / \${activeSearchMode}\` : ""}\`;
    const liveCount = document.getElementById("resultCount");
    if (liveCount) liveCount.textContent = String(count);
}`;

const newUpdateContext = `function updateListingContext(count = Number(resultCount?.textContent || 0)) {
    const city = document.getElementById("listingCity")?.value || "";
    const cityLabel = city && city.toLowerCase() !== "all cities" ? city : "All Cities";
    const breadcrumb = document.querySelector(".breadcrumb");
    const modeLabel = activeSearchMode ? \` / \${activeSearchMode}\` : "";
    if (breadcrumb) breadcrumb.textContent = \`Home / Apartments / \${cityLabel}\${modeLabel}\`;
    const liveCount = document.getElementById("resultCount");
    if (liveCount) liveCount.textContent = String(count);
}`;

if (!code.includes(oldUpdateContext)) {
    console.error('Could not find oldUpdateContext');
    process.exit(1);
}
code = code.replace(oldUpdateContext, newUpdateContext);

// 5. Update resetApartmentSearch
const oldReset = `function resetApartmentSearch() {
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
}`;

const newReset = `function resetApartmentSearch() {
    activeFilters = new Map();
    activeSearchMode = "";
    document.querySelectorAll(".filters button.active, [data-view-mode].active").forEach(btn => btn.classList.remove("active"));
    document.querySelector('[data-view-mode="list"]')?.classList.add("active");
    document.querySelectorAll("[data-search-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.searchMode === "");
    });
    const city = document.getElementById("listingCity");
    const search = document.getElementById("listingSearch");
    const budget = document.getElementById("budgetRange");
    const minBudget = document.getElementById("minBudgetRange");
    if (city) city.value = "";
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
}`;

if (!code.includes(oldReset)) {
    console.error('Could not find oldReset');
    process.exit(1);
}
code = code.replace(oldReset, newReset);

// 6. Update searchMode and filter click event listener
const oldFilterClick = `    const filter = event.target.closest("[data-filter]");
    if (filter) {
        event.preventDefault();
        const group = filter.dataset.filterGroup || "general";
        const value = filter.dataset.filter;
        const values = activeFilters.get(group) || new Set();
        if (values.has(value)) values.delete(value);
        else values.add(value);
        if (values.size) activeFilters.set(group, values);
        else activeFilters.delete(group);
        updateFilterState(\`\${activeFilterCount()} filter\${activeFilterCount() === 1 ? "" : "s"} applied\`);
        return;
    }`;

const newFilterClick = `    const filter = event.target.closest("[data-filter]");
    if (filter) {
        event.preventDefault();
        const group = filter.dataset.filterGroup || "general";
        const value = filter.dataset.filter;

        if (group === "mode") {
            const targetMode = value.toLowerCase();
            activeSearchMode = (activeSearchMode === targetMode) ? "" : targetMode;
            document.querySelectorAll("[data-search-mode]").forEach(b => {
                b.classList.toggle("active", (b.dataset.searchMode || "") === activeSearchMode);
            });
            document.querySelectorAll('[data-filter-group="mode"]').forEach(b => {
                const bVal = (b.dataset.filter || "").toLowerCase();
                const isActive = activeSearchMode && isSameMode(bVal, activeSearchMode);
                b.classList.toggle("active", Boolean(isActive));
                b.setAttribute("aria-pressed", String(Boolean(isActive)));
            });
            renderApartments();
            showToast(activeSearchMode ? \`Showing \${activeSearchMode.toUpperCase()} properties\` : "Showing all listings");
            return;
        }

        const values = activeFilters.get(group) || new Set();
        if (values.has(value)) values.delete(value);
        else values.add(value);
        if (values.size) activeFilters.set(group, values);
        else activeFilters.delete(group);
        updateFilterState(\`\${activeFilterCount()} filter\${activeFilterCount() === 1 ? "" : "s"} applied\`);
        return;
    }`;

if (!code.includes(oldFilterClick)) {
    console.error('Could not find oldFilterClick');
    process.exit(1);
}
code = code.replace(oldFilterClick, newFilterClick);

const oldSearchModeClick = `    const searchModeBtn = event.target.closest("[data-search-mode]");
    if (searchModeBtn) {
        event.preventDefault();
        document.querySelectorAll("[data-search-mode]").forEach(b => b.classList.remove("active"));
        searchModeBtn.classList.add("active");
        activeSearchMode = searchModeBtn.dataset.searchMode;
        renderApartments();
        showToast(\`Filtered by \${activeSearchMode.toUpperCase()}\`);
    }`;

const newSearchModeClick = `    const searchModeBtn = event.target.closest("[data-search-mode]");
    if (searchModeBtn) {
        event.preventDefault();
        document.querySelectorAll("[data-search-mode]").forEach(b => b.classList.remove("active"));
        searchModeBtn.classList.add("active");
        activeSearchMode = searchModeBtn.dataset.searchMode || "";
        
        document.querySelectorAll('[data-filter-group="mode"]').forEach(b => {
            const bVal = (b.dataset.filter || "").toLowerCase();
            const isActive = activeSearchMode && isSameMode(bVal, activeSearchMode);
            b.classList.toggle("active", Boolean(isActive));
            b.setAttribute("aria-pressed", String(Boolean(isActive)));
        });

        renderApartments();
        showToast(activeSearchMode ? \`Filtered by \${activeSearchMode.toUpperCase()}\` : "Showing all listings");
    }`;

if (!code.includes(oldSearchModeClick)) {
    console.error('Could not find oldSearchModeClick');
    process.exit(1);
}
code = code.replace(oldSearchModeClick, newSearchModeClick);

// 7. Update loadPublicInventory block at bottom
const oldLoadBlock = `loadPublicInventory().then(items=>{
    const mapped=items.map(x=>({
        id:x.id,title:x.title,society:x.society,locality:x.locality,city:x.city,type:x.listingType,
        rent:Number(x.price||0),price:x.price,bhk:x.bhk,bathrooms:x.bathrooms,furnishing:x.furnishing,
        image:x.imageUrl,imageUrl:x.imageUrl,imageUrls:String(x.imageUrls||"").split(/\\r?\\n/).filter(Boolean),
        deposit:x.deposit,maintenance:x.maintenance,sqft:x.areaSqft?\`\${x.areaSqft.toLocaleString("en-IN")} sqft\`:"Area on request",
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
});`;

const newLoadBlock = `function updateSocietiesFromListings() {
    const counts = {};
    (approvedDiscoveryListings || []).forEach(apt => {
        const soc = apt.society || apt.locality;
        if (soc && soc !== "Owner Listed Apartment" && soc !== "Approved Society") {
            counts[soc] = (counts[soc] || 0) + 1;
        }
    });
    societyData.length = 0;
    Object.entries(counts).forEach(([k, v]) => societyData.push([k, v]));
}

loadPublicInventory().then(items => {
    const mapped = items.map(x => ({
        id: x.id,
        title: x.title,
        society: x.society || x.locality || "Approved Society",
        locality: x.locality || x.city || "Direct Listing",
        city: x.city,
        listingMode: x.listingType || "Rent",
        listingType: x.listingType || "Rent",
        type: x.listingType || "Rent",
        rent: Number(x.price || 0),
        price: Number(x.price || 0),
        bhk: x.bhk || (x.bedrooms ? \`\${x.bedrooms} BHK\` : "2 BHK"),
        bedrooms: x.bedrooms,
        bathrooms: x.bathrooms,
        furnishing: x.furnishing,
        image: x.imageUrl,
        imageUrl: x.imageUrl,
        imageUrls: String(x.imageUrls || "").split(/\\r?\\n/).filter(Boolean),
        video: x.videoUrl,
        videoUrl: x.videoUrl,
        deposit: x.deposit,
        maintenance: x.maintenance,
        areaSqft: x.areaSqft,
        sqft: x.areaSqft ? \`\${Number(x.areaSqft).toLocaleString("en-IN")} sqft\` : "Area on request",
        parking: x.parking,
        address: x.address,
        pincode: x.pincode,
        description: x.description,
        amenities: x.amenities,
        available: x.availableFrom ? new Date(x.availableFrom).toLocaleDateString("en-IN") : (x.constructionStatus || "Ready to Move"),
        constructionStatus: x.constructionStatus || "Ready to Move",
        propertyType: x.propertyType || "Apartment",
        apartmentType: x.propertyType || "Apartment"
    }));
    approvedDiscoveryListings = mapped;
    approvedDiscoveryLoaded = true;

    [...new Set(mapped.map(x => x.city).filter(Boolean))].forEach(c => saveCityOption(c));
    hydrateCityDropdowns(document.getElementById("listingCity")?.value || "");
    updateSocietiesFromListings();
    syncBudgetForCurrentSearch();
    renderSocieties();
    updateFilterState();
}).catch(error => {
    approvedDiscoveryListings = [];
    approvedDiscoveryLoaded = true;
    if (results) results.innerHTML = '<article class="apartment-card empty-results" role="alert"><h2>Properties could not be loaded</h2><p>Please retry. Your filters have been kept.</p><button class="primary" type="button" onclick="location.reload()">Try again</button></article>';
});`;

if (!code.includes(oldLoadBlock)) {
    console.error('Could not find oldLoadBlock');
    process.exit(1);
}
code = code.replace(oldLoadBlock, newLoadBlock);

if (originalHasCRLF) {
    code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully updated apartments.js');
