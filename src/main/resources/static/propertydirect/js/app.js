/*
 * The landing page currently uses the server-rendered PropertyDirect template.
 * Keep this legacy script free of demo inventory so it cannot reintroduce
 * listings that have not been approved in the backend.
 */
const listings = [];
/*
    {
        title: "2 BHK Apartment in Whitefield",
        city: "Bangalore",
        locality: "Whitefield",
        type: "Rent",
        price: "₹28,000",
        image: "/shared/images/apartment-living-1.webp",
        meta: ["2 BHK", "Semi Furnished", "Owner Listed"]
    },
    {
        title: "3 BHK Family Home in Adyar",
        city: "Chennai",
        locality: "Adyar",
        type: "Buy",
        price: "₹1.35 Cr",
        image: "/shared/images/apartment-living-2.webp",
        meta: ["3 BHK", "Ready to Move", "Zero Brokerage"]
    },
    {
        title: "Premium 3 BHK Apartment near Hitech City",
        city: "Hyderabad",
        locality: "Hitech City",
        type: "Premium",
        price: "₹85,000",
        image: "/shared/images/propertydirect-cinematic-1.webp",
        meta: ["3 BHK", "Fully Furnished", "Gated Society"]
    },
    {
        title: "1 BHK Studio in Powai",
        city: "Mumbai",
        locality: "Powai",
        type: "Rent",
        price: "₹42,000",
        image: "/shared/images/apartment-bedroom-1.webp",
        meta: ["1 BHK", "Furnished", "Pet Friendly"]
    },
    {
        title: "2 BHK Flat in Wakad",
        city: "Pune",
        locality: "Wakad",
        type: "Buy",
        price: "₹72 L",
        image: "/shared/images/propertydirect-cinematic-2.webp",
        meta: ["2 BHK", "New Project", "Owner Listed"]
    },
    {
        title: "Premium 4 BHK Apartment in Koramangala",
        city: "Bangalore",
        locality: "Koramangala",
        type: "Premium",
        price: "₹1.2 L",
        image: "/shared/images/apartment-living-2.webp",
        meta: ["4 BHK", "Luxury Apartment", "Gated Society"]
    }
]; */

const cityOptionsStorageKey = "propertydirect-city-options:v1";
const defaultCityOptions = ["Bangalore", "Chennai", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"];
let activeMode = "Buy";
let approvedLandingListings = [];

const modeViews = {
    Buy: {
        key: "buy",
        icon: "B",
        label: "Homes to own",
        title: "Find a home that is truly yours.",
        description: "Explore owner-listed apartments for sale, compare neighbourhoods and connect directly without brokerage.",
        browseLabel: "Browse Homes for Sale",
        searchLabel: "Search Homes to Buy",
        placeholder: "Search homes for sale, locality or landmark...",
        filters: ["Ready to Move", "New Project", "Owner Listed", "Gated Society"]
    },
    Rent: {
        key: "rent",
        icon: "R",
        label: "Move in sooner",
        title: "Rent directly. Settle in faster.",
        description: "Discover verified rental homes, speak with owners and schedule visits without agent calls or brokerage fees.",
        browseLabel: "Browse Rental Homes",
        searchLabel: "Search Homes to Rent",
        placeholder: "Search rental homes, locality or monthly budget...",
        filters: ["Furnished", "Semi Furnished", "Pet Friendly", "Owner Listed"]
    },
    Premium: {
        key: "premium",
        icon: "P",
        label: "Curated residences",
        title: "Exceptional homes, personally curated.",
        description: "Explore luxury apartments in sought-after neighbourhoods with priority support and guided owner connections.",
        browseLabel: "Explore Premium Homes",
        searchLabel: "Search Premium Homes",
        placeholder: "Search luxury homes, premium societies or landmarks...",
        filters: ["Luxury Apartment", "Fully Furnished", "Gated Society", "3 BHK"]
    }
};

const grid = document.getElementById("propertyGrid");
const toast = document.getElementById("toast");
const modal = document.getElementById("appModal");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalFields = document.getElementById("modalFields");
const dashboardLoginModal = document.getElementById("dashboardLoginModal");
const closeDashboardLoginModal = document.getElementById("closeDashboardLoginModal");
const submitDashboardLogin = document.getElementById("submitDashboardLogin");
const dashboardLoginTitle = document.getElementById("dashboardLoginTitle");
const dashboardLoginHelp = document.getElementById("dashboardLoginHelp");
const dashboardUsername = document.getElementById("dashboardUsername");
const dashboardPassword = document.getElementById("dashboardPassword");
const dashboardRegisterFields = document.getElementById("dashboardRegisterFields");
const dashboardRegisterName = document.getElementById("dashboardRegisterName");
const dashboardRegisterPhone = document.getElementById("dashboardRegisterPhone");
const dashboardRegisterEmail = document.getElementById("dashboardRegisterEmail");
const dashboardAuthHelper = document.getElementById("dashboardAuthHelper");
const propertyExperience = document.getElementById("propertyExperience");
const modeFilters = document.getElementById("modeFilters");
const localityInput = document.getElementById("locality");
const searchButton = document.getElementById("searchButton");

let pendingDashboardLogin = null;
let activeModalKind = "contact";
let dashboardAuthMode = "login";

function readPublishedListings() {
    return approvedLandingListings;
}

function writePublishedListings() { /* Approved listings are server-managed. */ }

function titleCasePlace(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function readCityOptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(cityOptionsStorageKey) || "[]");
        return [...new Set([...defaultCityOptions, ...saved].map(titleCasePlace).filter(Boolean))];
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
    document.querySelectorAll("#city, #listingCity").forEach(select => {
        const current = selectedCity || select.value;
        select.innerHTML = readCityOptions().map(city => `<option value="${city}">${city}</option>`).join("");
        if (current && ![...select.options].some(option => option.value === current)) {
            select.insertAdjacentHTML("beforeend", `<option value="${current}">${current}</option>`);
        }
        if (current) select.value = current;
    });
}

function publicPublishedListings() {
    return readPublishedListings().map((item) => ({
        title: escapeListingText(item.title || `${item.bhk || "2 BHK"} Apartment in ${item.locality || "Owner Listed"}`),
        city: escapeListingText(item.city || "Bangalore"),
        locality: escapeListingText(item.locality || "Owner Listed"),
        type: escapeListingText(item.type || "Rent"),
        price: escapeListingText(item.price || "Rs. 28,000"),
        image: safeListingImage(item.image),
        meta: [escapeListingText(item.bhk || "2 BHK"), escapeListingText(item.furnishing || "Semi Furnished"), "Owner Listed"]
    }));
}

function escapeListingText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);}
function safeListingImage(value){const url=String(value||"");return /^(\/|https:\/\/)/i.test(url)?escapeListingText(url):"/shared/images/apartment-living-1.webp";}

function allListings() {
    return publicPublishedListings();
}

function renderListings(items = allListings()) {
    if (!items.length) {
        grid.innerHTML = `<div class="empty-state" role="status"><h3>No approved properties are available yet</h3><p>New listings appear here after they are verified by the PropertyDirect team.</p></div>`;
        return;
    }
    grid.innerHTML = items.map((item, index) => `
        <article class="property-card">
            <div class="property-image property-image-${index % 4}">
                <img src="${item.image}" alt="${item.title}">
                <span class="listing-badge">${item.type === "Premium" ? "Curated" : "Owner listed"}</span>
                <button class="save-property" type="button" aria-label="Save ${item.title}">♡</button>
            </div>
            <div class="property-body">
                <h3>${item.title}</h3>
                <div class="meta">
                    <span>${item.city}</span>
                    <span>${item.locality}</span>
                    <span>${item.type}</span>
                </div>
                <div class="meta">${item.meta.map((m) => `<span>${m}</span>`).join("")}</div>
                <div class="price-row">
                    <span class="price">${item.price}</span>
                    <button class="ghost" data-contact="${item.title}">Contact Owner</button>
                </div>
            </div>
        </article>
    `).join("");
}

function gradient(index) {
    const colors = ["none"];
    return colors[index % colors.length];
}

function renderModeView(mode) {
    const view = modeViews[mode];
    if (!view) return;
    if (propertyExperience) propertyExperience.dataset.currentMode = view.key;
    if (searchButton) searchButton.textContent = view.searchLabel;
    if (localityInput) localityInput.placeholder = view.placeholder;
    if (modeFilters) modeFilters.innerHTML = view.filters.map(filter => `<button data-filter="${filter}">${filter}</button>`).join("");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function openModal(kind) {
    activeModalKind = kind;
    const copy = {
        login: ["Login", "Enter your details to continue."],
        post: ["Post Free Property Ad", "List your property and connect with verified tenants or buyers."],
        plan: ["Assisted Plans", "Get a dedicated property expert and faster matching alerts."],
        contact: ["Contact Owner", "Share your details to unlock owner contact information."]
    };
    const fields = {
        post: `
            <div class="form-grid post-property-grid">
                <label>Owner Name<input data-post-field="owner" placeholder="Your name"></label>
                <label>Phone<input data-post-field="phone" placeholder="Mobile number"></label>
                <label>Property Type<select data-post-field="propertyType"><option>Apartment for Rent</option><option>Apartment for Sale</option><option>Premium Apartment</option></select></label>
                <label>Apartment Type<select data-post-field="apartmentType"><option>Gated Society</option><option>Standalone Apartment</option><option>Villa</option><option>Studio</option><option>Builder Floor</option></select></label>
                <label>City / Town<input data-post-field="city" list="propertydirectCityOptions" placeholder="Example: Bargur"></label>
                <label>Locality / Society<input data-post-field="locality" placeholder="Locality or apartment society"></label>
                <label>BHK<select data-post-field="bhk"><option>1 BHK</option><option selected>2 BHK</option><option>3 BHK</option><option>4 BHK</option><option>5 BHK</option></select></label>
                <label>Expected Price<input data-post-field="price" placeholder="Example: Rs. 28,000"></label>
                <label>Deposit<input data-post-field="deposit" placeholder="Example: Rs. 1,00,000"></label>
                <label>Built-up Sqft<input data-post-field="sqft" placeholder="Example: 1,100 sqft"></label>
                <label>Furnishing<select data-post-field="furnishing"><option>Semi Furnished</option><option>Fully Furnished</option><option>Unfurnished</option></select></label>
                <label>Availability<select data-post-field="available"><option>Ready to Move</option><option>15 Days</option><option>30 Days</option><option>Under Construction</option></select></label>
                <label>Parking<select data-post-field="parking"><option>Bike Parking Car Parking</option><option>Car Parking</option><option>Bike Parking</option><option>No Parking</option></select></label>
                <label>Preferred Tenant<select data-post-field="tenant"><option>All</option><option>Family</option><option>Family / Bachelor</option><option>Company</option></select></label>
                <label>Property Photo<input data-post-field="image" type="file" accept="image/*"></label>
                <label class="post-notes-field">More Details<textarea data-post-field="notes" placeholder="Balcony, floor, water, lift, nearby landmark..."></textarea></label>
            </div>
            <datalist id="propertydirectCityOptions">${readCityOptions().map(city => `<option value="${city}"></option>`).join("")}</datalist>
        `,
        plan: `
            <label>Full Name<input placeholder="Your name"></label>
            <label>Mobile Number<input type="tel" placeholder="Mobile number"></label>
            <label>Email Address<input type="email" placeholder="Email address"></label>
            <label>Requirement<select><option>Buy Apartment</option><option>Rent Apartment</option><option>Premium Search</option></select></label>
            <label>Preferred City<input placeholder="City"></label>
            <label>Preferred Localities<input placeholder="Localities or landmarks"></label>
            <label>Budget Range<input placeholder="Minimum and maximum budget"></label>
            <label>Property Configuration<select><option>1 BHK</option><option>2 BHK</option><option>3 BHK</option><option>4+ BHK</option></select></label>
            <label>Target Move-in Date<input type="date"></label>
            <label>Assistance Notes<textarea placeholder="Property, visit, finance or documentation support required"></textarea></label>
        `,
        contact: `
            <label>Full Name<input placeholder="Your name"></label>
            <label>Mobile Number<input type="tel" placeholder="Mobile number"></label>
            <label>Email Address<input type="email" placeholder="Email address"></label>
            <label>Contact Purpose<select><option>Owner contact</option><option>Price negotiation</option><option>Property availability</option><option>Document clarification</option><option>Other</option></select></label>
            <label>Preferred Contact Time<input type="datetime-local"></label>
            <label>Current City<input placeholder="Your current city"></label>
            <label>Consent<select><option>Yes, I consent to owner contact</option><option>No</option></select></label>
            <label>Message to Owner<textarea placeholder="Introduce your requirement, move-in timeline and questions"></textarea></label>
        `
    };
    const [title, text] = copy[kind] || copy.login;
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalFields.innerHTML = fields[kind] || fields.contact;
    modal.classList.remove("hidden");
}

function readModalFieldValues() {
    return [...modalFields.querySelectorAll("input:not([type='file']), select, textarea")]
        .map(field => field.value?.trim())
        .filter(Boolean);
}

function readPostPropertyFields() {
    const values = {};
    modalFields.querySelectorAll("[data-post-field]").forEach(field => {
        values[field.dataset.postField] = field.type === "file" ? field.files?.[0] || null : field.value?.trim() || "";
    });
    return values;
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

async function publishModalProperty(values) {
    const fields = readPostPropertyFields();
    const propertyType = fields.propertyType || values[2] || "Apartment for Rent";
    const mode = String(propertyType || "").toLowerCase().includes("sale")
        ? "Buy"
        : String(propertyType || "").toLowerCase().includes("premium") ? "Premium" : "Rent";
    const city = titleCasePlace(fields.city || document.getElementById("city")?.value || "Bangalore");
    const locality = fields.locality || "Owner Listed";
    const bhk = fields.bhk || "2 BHK";
    const apartmentType = fields.apartmentType || "Gated Society";
    const price = fields.price || (mode === "Buy" ? "Rs. 75,00,000" : "Rs. 28,000");
    const uploadedImage = await readImageFile(fields.image);
    const title = `${mode === "Premium" ? "Premium " : ""}${bhk} Apartment in ${locality}`;
    const listing = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        city,
        locality,
        society: locality,
        type: mode,
        price,
        rent: Number(String(price).replace(/[^\d]/g, "") || 28000),
        maintenance: 0,
        deposit: fields.deposit || (mode === "Buy" ? "For Sale" : "Rs. 1,00,000"),
        sqft: fields.sqft || "1,100 sqft",
        bhk,
        furnishing: fields.furnishing || "Semi Furnished",
        available: fields.available || "Ready to Move",
        parking: fields.parking || "Bike Parking Car Parking",
        tenant: fields.tenant || "All",
        apartmentType,
        notes: fields.notes || "",
        owner: fields.owner || values[0] || "Owner",
        phone: fields.phone || values[1] || "",
        image: uploadedImage || (mode === "Premium" ? "/shared/images/propertydirect-cinematic-2.webp" : "/shared/images/apartment-living-1.webp"),
        status: "Live",
        publishedAt: new Date().toISOString()
    };
    const existing = readPublishedListings().filter(item => item.title !== listing.title);
    writePublishedListings([listing, ...existing]);
    saveCityOption(city);
    activeMode = mode;
    document.querySelectorAll(".tab").forEach(tab => {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    renderModeView(mode);
    renderListings(allListings().filter(item => item.type === mode));
    return listing;
}

function openDashboardLogin({ platform, role, target }) {
    pendingDashboardLogin = { platform, role: role || "customer", target };
    setDashboardAuthMode("login");
    if (dashboardUsername) dashboardUsername.value = "";
    if (dashboardPassword) dashboardPassword.value = "";
    if (dashboardRegisterName) dashboardRegisterName.value = "";
    if (dashboardRegisterPhone) dashboardRegisterPhone.value = "";
    if (dashboardRegisterEmail) dashboardRegisterEmail.value = "";
    dashboardLoginModal?.classList.remove("hidden");
    window.setTimeout(() => dashboardUsername?.focus(), 80);
}

function setDashboardAuthMode(mode) {
    dashboardAuthMode = mode === "register" ? "register" : "login";
    document.querySelectorAll("[data-auth-mode]").forEach(button => {
        const active = button.dataset.authMode === dashboardAuthMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    dashboardRegisterFields?.classList.toggle("hidden", dashboardAuthMode !== "register");
    if (dashboardLoginTitle) dashboardLoginTitle.textContent = dashboardAuthMode === "register" ? "Create Customer Account" : "Login";
    if (dashboardLoginHelp) {
        dashboardLoginHelp.textContent = dashboardAuthMode === "register"
            ? "Create your own PropertyDirect customer credentials and open your dashboard."
            : "Enter your credentials to open your workspace.";
    }
    if (submitDashboardLogin) submitDashboardLogin.textContent = dashboardAuthMode === "register" ? "Create Account" : "Login";
    if (dashboardAuthHelper) {
        dashboardAuthHelper.textContent = dashboardAuthMode === "register"
            ? "This creates customer access only. Admin and super admin access stays restricted."
            : "New customer? Choose Create Account to make your own credentials.";
    }
}

function inferPropertyDirectRole(username) {
    const value = String(username || "").toLowerCase();
    if (value.includes("superadmin")) return "superadmin";
    if (value.includes("agent")) return "agent";
    if (value.includes("vendor")) return "vendor";
    if (value.startsWith("admin") || value.includes("admin@")) return "admin";
    return pendingDashboardLogin?.role || "customer";
}

function propertyDirectDashboardTarget(role) {
    if (role === "superadmin") return "/propertydirect/dashboards/superadmin";
    if (role === "admin") return "/propertydirect/dashboards/admin";
    if (role === "agent") return "/propertydirect/dashboards/agent";
    if (role === "vendor") return "/propertydirect/dashboards/vendor";
    return "/propertydirect/dashboards/customer";
}

async function submitDashboardCredentials() {
    if (!pendingDashboardLogin) return;
    if (dashboardAuthMode === "register") {
        await submitPropertyDirectCustomerRegistration();
        return;
    }
    const resolvedRole = pendingDashboardLogin.platform === "propertydirect"
        ? inferPropertyDirectRole(dashboardUsername?.value)
        : pendingDashboardLogin.role;
    try {
        const response = await fetch("/api/auth/dashboard-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                platform: pendingDashboardLogin.platform,
                role: resolvedRole,
                username: dashboardUsername?.value || "",
                password: dashboardPassword?.value || ""
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showToast(data.message || data.error || "Invalid username or password");
            return;
        }
        dashboardLoginModal?.classList.add("hidden");
        window.location.href = pendingDashboardLogin.target || data.redirect || propertyDirectDashboardTarget(resolvedRole);
    } catch (error) {
        showToast("Login failed. Please try again.");
    }
}

async function submitPropertyDirectCustomerRegistration() {
    if (pendingDashboardLogin?.platform !== "propertydirect") {
        showToast("Customer registration is available for PropertyDirect only");
        return;
    }
    const payload = {
        name: dashboardRegisterName?.value || "",
        phone: dashboardRegisterPhone?.value || "",
        email: dashboardRegisterEmail?.value || "",
        username: dashboardUsername?.value || "",
        password: dashboardPassword?.value || ""
    };
    if (!payload.name.trim() || !payload.phone.trim() || !payload.email.trim() || !payload.username.trim() || !payload.password.trim()) {
        showToast("Fill all account details");
        return;
    }
    if (payload.password.length < 6) {
        showToast("Password must be at least 6 characters");
        return;
    }
    try {
        const response = await fetch("/api/auth/propertydirect/register-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showToast(data.message || "Could not create account");
            return;
        }
        localStorage.setItem("propertydirect-customer-profile:v1", JSON.stringify({
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            username: payload.username,
            createdAt: new Date().toISOString()
        }));
        dashboardLoginModal?.classList.add("hidden");
        showToast("Customer account created");
        window.location.href = data.redirect || "/propertydirect/dashboards/customer";
    } catch (error) {
        showToast("Registration failed. Please try again.");
    }
}

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((item) => {
            item.classList.remove("active");
            item.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        activeMode = tab.dataset.mode;
        renderModeView(activeMode);
        renderListings();
    });
});

document.getElementById("searchButton").addEventListener("click", () => {
    const city = document.getElementById("city").value.toLowerCase();
    const query = document.getElementById("locality").value.toLowerCase();
    const filtered = allListings().filter((item) => {
        const text = `${item.city} ${item.locality} ${item.title} ${item.meta.join(" ")}`.toLowerCase();
        return item.type === activeMode && text.includes(city) && (!query || text.includes(query));
    });
    renderListings(filtered);
    showToast(`${filtered.length} matching properties found`);
    window.setTimeout(() => {
        const params = new URLSearchParams({ city: document.getElementById("city").value, q: document.getElementById("locality").value, mode: activeMode });
        window.location.href = `/propertydirect/apartments?${params.toString()}`;
    }, 500);
});

localityInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchButton?.click();
});

document.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
        const filter = filterButton.dataset.filter.toLowerCase();
        const filtered = allListings().filter((item) => item.meta.join(" ").toLowerCase().includes(filter));
        document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button === filterButton));
        renderListings(filtered);
        showToast(`${filtered.length} ${filterButton.dataset.filter} homes found`);
        return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton?.dataset.action === "dashboard-login") {
        event.preventDefault();
        openDashboardLogin({ platform: "propertydirect", role: "customer", target: null });
        return;
    }

    const modalButton = event.target.closest("[data-open-modal]");
    if (modalButton) {
        event.preventDefault();
        openModal(modalButton.dataset.openModal);
        return;
    }

    const contactButton = event.target.closest("[data-contact]");
    if (contactButton) {
        openModal("contact");
        return;
    }

    const saveButton = event.target.closest(".save-property");
    if (saveButton) {
        saveButton.classList.toggle("saved");
        saveButton.textContent = saveButton.classList.contains("saved") ? "♥" : "♡";
        showToast(saveButton.classList.contains("saved") ? "Property saved" : "Property removed from saved list");
    }
});

document.getElementById("closeModal").addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("cancelModal")?.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
});
document.getElementById("modalSubmit").addEventListener("click", async () => {
    const values = readModalFieldValues();
    let published = null;
    if (activeModalKind === "post") published = await publishModalProperty(values);
    modal.classList.add("hidden");
    const first = values[0] ? ` for ${values[0]}` : "";
    const messages = {
        post: published ? `Property is live in PropertyDirect: ${published.title}` : `Property ad submitted${first}`,
        plan: `Assisted plan request submitted${first}`,
        contact: `Owner contact request submitted${first}`,
        login: `Login request submitted${first}`
    };
    showToast(messages[activeModalKind] || `Request submitted${first}`);
});
closeDashboardLoginModal?.addEventListener("click", () => dashboardLoginModal?.classList.add("hidden"));
document.getElementById("cancelDashboardLoginModal")?.addEventListener("click", () => dashboardLoginModal?.classList.add("hidden"));
dashboardLoginModal?.addEventListener("click", (event) => {
    if (event.target === dashboardLoginModal) dashboardLoginModal.classList.add("hidden");
});
document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => setDashboardAuthMode(button.dataset.authMode));
});
submitDashboardLogin?.addEventListener("click", submitDashboardCredentials);
dashboardPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitDashboardCredentials();
});
document.getElementById("resetListings").addEventListener("click", () => renderListings());
document.getElementById("menuButton").addEventListener("click", () => document.querySelector(".nav").classList.toggle("open"));

const requiredDashboardRole = new URLSearchParams(window.location.search).get("loginRequired");
if (requiredDashboardRole) {
    openDashboardLogin({ platform: "propertydirect" });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
}

hydrateCityDropdowns();
renderListings();
fetch("/api/property/listings", {headers:{Accept:"application/json"}}).then(r=>r.ok?r.json():[]).then(items=>{
    approvedLandingListings=items.map(x=>({id:x.id,title:x.title,society:x.society,locality:x.locality,city:x.city,type:String(x.listingType||"").toUpperCase()==="SALE"?"Buy":String(x.listingType||"").toUpperCase()==="RENT"?"Rent":"Premium",price:`Rs. ${x.price}`,bhk:x.bhk,furnishing:x.furnishing,image:x.imageUrl,notes:x.notes}));
    renderListings();
}).catch(()=>{ approvedLandingListings=[]; renderListings(); });

setupMotion();

function setupMotion() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = document.querySelectorAll(".section, .split-section, .owner-banner, .property-card");
    targets.forEach((target) => target.classList.add("reveal"));
    if (reducedMotion || !("IntersectionObserver" in window)) {
        targets.forEach((target) => target.classList.add("is-visible"));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    targets.forEach((target) => observer.observe(target));
}
