const panelTitles = {
    overview: "Overview",
    moderation: "Listing Moderation",
    kyc: "KYC Verification",
    content: "Content & Feedback",
    abuse: "Lead & Abuse Monitoring",
    reports: "Operations Reports",
    roles: "RBAC & Security Policy",
    users: "User Management",
    admins: "Administrator Governance",
    properties: "Listing Governance",
    masterdata: "Master Data & Listing Rules",
    subscriptions: "Pricing & Listing Packages",
    payments: "Finance, Refunds & Payouts",
    integrations: "Integrations & Infrastructure",
    services: "Services",
    analytics: "Analytics",
    support: "Support",
    listings: "My Listings",
    "post-listing": "Create Listing",
    offers: "Offers & Enquiries",
    reviews: "Reviews & Reports",
    audit: "Immutable Audit & Backups",
    compliance: "Privacy & Global Overrides",
    settings: "System Configuration",
    post: "Post Apartment",
    listings: "My Apartment Listings",
    leads: "Apartment Leads",
    visits: "Visit Schedule",
    plans: "Plans",
    profile: "Profile",
    search: "Search Apartments",
    shortlist: "Shortlisted Apartments",
    contacts: "Owner Contacts",
    rentpay: "Rent Pay",
    "saved-searches": "Saved Searches and Alerts",
    "service-requests": "Service & Maintenance Requests"
};

const toast = document.getElementById("toast");
const dashboardRole = document.body.dataset.dashboardRole || "customer";
const dashboardStorageKey = `propertydirect-dashboard-state:v6:${dashboardRole}`;
const publishedListingsStorageKey = "propertydirect-published-listings:v1";
const ownerContactRequestsStorageKey = "propertydirect-owner-contact-requests:v1";
const ownerPlanStorageKey = "propertydirect-owner-active-plan:v1";
const propertyProfileStorageKey = `propertydirect-profile:v1:${dashboardRole}`;
let modal = document.getElementById("dashboardModal");
let modalTitle = document.getElementById("modalTitle");
let modalText = document.getElementById("modalText");
let modalFields = document.getElementById("modalFields");
let modalSave = document.getElementById("modalSave");
let activeModalTarget = null;
const rolePanelRoutes = {
    superadmin: ["admins", "subscriptions", "payments", "masterdata", "integrations", "compliance", "service-requests"],
    admin: ["moderation", "kyc", "support", "abuse"],
    customer: ["search", "shortlist", "visits", "listings"]
};

// PropertyDirect uses one light dashboard theme. This also removes any old
// floating theme control that may remain in a browser tab from a cached page.
function enforcePropertyDirectLightCanvas() {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";
    document.querySelectorAll(".fixed-electrical-switch, .electrical-switch-wrapper, .modern-theme-switch, [data-theme-toggle]")
        .forEach(control => control.remove());
}
enforcePropertyDirectLightCanvas();

function dashboardContentRoot() {
    return document.querySelector(".dash-main");
}

function persistDashboardState() {
    // Server APIs are authoritative; do not save a stale DOM snapshot.
}

function restoreDashboardState() {
    localStorage.removeItem(dashboardStorageKey);
}

function wireAutosave() {
    document.addEventListener("input", event => {
        if (event.target.closest(".dash-main")) persistDashboardState();
    });
    document.addEventListener("change", event => {
        if (event.target.closest(".dash-main")) persistDashboardState();
    });
}

function propertyProfileDefaults() {
    const profiles = {
        superadmin: { fullName: "Super Admin", email: "superadmin@propertydirect.in", phone: "+91 98765 43210", alternatePhone: "", employeeId: "PD-SA-001", department: "Platform Administration", designation: "Root Platform Administrator", address: "PropertyDirect Headquarters", city: "Bengaluru", state: "Karnataka", postalCode: "560001", timezone: "Asia/Kolkata", language: "English", twoFactor: "Enabled", roleLabel: "Super Administrator" },
        admin: { fullName: "Property Moderator", email: "admin@propertydirect.in", phone: "+91 98765 43211", alternatePhone: "", employeeId: "PD-AD-014", department: "Marketplace Operations", designation: "Property Operations Administrator", address: "PropertyDirect Operations Centre", city: "Bengaluru", state: "Karnataka", postalCode: "560001", timezone: "Asia/Kolkata", language: "English", twoFactor: "Enabled", roleLabel: "Administrator" },
        customer: { fullName: "Property Customer", email: "customer@propertydirect.in", phone: "+91 98765 43212", alternatePhone: "", employeeId: "PD-CU-1024", department: "Buyer / Tenant Account", designation: "Verified Customer", address: "12, Green Park Road", city: "Bengaluru", state: "Karnataka", postalCode: "560066", timezone: "Asia/Kolkata", language: "English", twoFactor: "Optional", roleLabel: "Customer" }
    };
    return profiles[dashboardRole] || profiles.customer;
}

function readPropertyProfile() {
    const defaults = propertyProfileDefaults();
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(propertyProfileStorageKey) || "{}") }; }
    catch { return defaults; }
}

function propertyProfileMarkup(profile) {
    const initials = profile.fullName.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase();
    return `
        <div class="property-profile-layout">
            <aside class="property-profile-summary">
                <div class="property-profile-avatar">${initials}</div>
                <h3>${profile.fullName}</h3><p>${profile.roleLabel}</p><span class="status active">Active account</span>
                <dl><div><dt>Profile ID</dt><dd>${profile.employeeId}</dd></div><div><dt>Member since</dt><dd>August 2026</dd></div><div><dt>Last login</dt><dd>Today, 10:42 AM</dd></div><div><dt>Profile status</dt><dd>100% complete</dd></div></dl>
            </aside>
            <div class="property-profile-card">
                <div class="property-profile-head"><div><h3>Profile information</h3><p>Maintain your personal, contact, address, role and account-security information.</p></div><div class="property-profile-actions"><button type="button" class="profile-cancel" data-profile-action="cancel" hidden>Cancel</button><button type="button" class="primary" data-profile-action="edit">Edit profile</button><button type="button" class="primary" data-profile-action="save" hidden>Save changes</button></div></div>
                <form class="property-profile-form" id="propertyProfileForm">
                    <div class="property-profile-section"><strong>Personal details</strong><small>Your primary identity and communication information.</small></div>
                    <label>Full name<input name="fullName" value="${profile.fullName}" required disabled></label><label>Email address<input name="email" type="email" value="${profile.email}" required disabled></label><label>Mobile number<input name="phone" value="${profile.phone}" required disabled></label><label>Alternate mobile<input name="alternatePhone" value="${profile.alternatePhone}" placeholder="Optional" disabled></label>
                    <div class="property-profile-section"><strong>Role and organisation</strong><small>Account ownership and operational responsibility.</small></div>
                    <label>Profile / employee ID<input name="employeeId" value="${profile.employeeId}" disabled></label><label>Account role<input value="${profile.roleLabel}" disabled data-permanent-disabled></label><label>Department / account type<input name="department" value="${profile.department}" disabled></label><label>Designation<input name="designation" value="${profile.designation}" disabled></label>
                    <div class="property-profile-section"><strong>Address and preferences</strong><small>Location, language and regional settings.</small></div>
                    <label class="profile-wide">Address<textarea name="address" disabled>${profile.address}</textarea></label><label>City<input name="city" value="${profile.city}" disabled></label><label>State<input name="state" value="${profile.state}" disabled></label><label>Postal code<input name="postalCode" value="${profile.postalCode}" disabled></label><label>Timezone<select name="timezone" disabled><option selected>${profile.timezone}</option><option>UTC</option><option>Asia/Dubai</option></select></label><label>Language<select name="language" disabled><option selected>${profile.language}</option><option>Hindi</option><option>Tamil</option><option>Kannada</option></select></label><label>Two-factor authentication<select name="twoFactor" disabled><option ${profile.twoFactor === "Enabled" ? "selected" : ""}>Enabled</option><option ${profile.twoFactor === "Optional" ? "selected" : ""}>Optional</option><option>Disabled</option></select></label>
                </form>
            </div>
        </div>`;
}

function ensureRoleProfileSection() {
    const nav = document.querySelector(".dash-sidebar .sidebar-nav");
    const main = document.querySelector("main.dash-main");
    if (!nav || !main) return;
    let navButton = nav.querySelector('[data-panel="profile"]');
    if (!navButton) { navButton = document.createElement("button"); navButton.type = "button"; navButton.dataset.panel = "profile"; navButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg><span>My Profile</span>'; nav.appendChild(navButton); }
    let section = main.querySelector('[data-view="profile"]');
    if (!section) { section = document.createElement("section"); section.className = "dash-panel hidden"; section.dataset.view = "profile"; main.insertBefore(section, document.getElementById("dashboardModal") || null); }
    section.innerHTML = propertyProfileMarkup(readPropertyProfile());
}

function setPropertyProfileEditing(editing) {
    const form = document.getElementById("propertyProfileForm"); if (!form) return;
    form.querySelectorAll("input,select,textarea").forEach(field => { if (!field.hasAttribute("data-permanent-disabled")) field.disabled = !editing; });
    document.querySelector('[data-profile-action="edit"]')?.toggleAttribute("hidden", editing); document.querySelector('[data-profile-action="save"]')?.toggleAttribute("hidden", !editing); document.querySelector('[data-profile-action="cancel"]')?.toggleAttribute("hidden", !editing);
    form.closest(".property-profile-card")?.classList.toggle("is-editing", editing);
}

function savePropertyProfile() {
    const form = document.getElementById("propertyProfileForm"); if (!form || !form.reportValidity()) return;
    const saved = { ...readPropertyProfile(), ...Object.fromEntries(new FormData(form).entries()) }; localStorage.setItem(propertyProfileStorageKey, JSON.stringify(saved)); ensureRoleProfileSection(); showToast("Profile changes saved");
}

function readPublishedListings() {
    try {
        return JSON.parse(localStorage.getItem(publishedListingsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(publishedListingsStorageKey);
        return [];
    }
}

function writePublishedListings(items) {
    items.filter(item => !/^\d+$/.test(String(item.id || "")) && !item.backendSyncing).forEach(item => {
        item.backendSyncing = true;
        fetch("/api/property/listings", {method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({
            title:item.title||"Owner Listed Apartment",society:item.society||item.locality||"Apartment",
            locality:item.locality||"Not specified",city:item.city||"Chennai",type:item.type||"RENT",
            price:Number(String(item.price||item.rent||25000).replace(/[^\d.]/g,""))||25000,bhk:item.bhk||"2 BHK",
            furnishing:item.furnishing||"Unfurnished",imageUrl:item.image||"",notes:item.notes||""
        })}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Listing sync failed");item.id=data.id;delete item.backendSyncing;localStorage.setItem(publishedListingsStorageKey,JSON.stringify(items.slice(0,80)));})
          .catch(error=>{delete item.backendSyncing;localStorage.setItem(publishedListingsStorageKey,JSON.stringify(items.slice(0,80)));showToast(error.message);});
    });
    localStorage.setItem(publishedListingsStorageKey, JSON.stringify(items.slice(0, 80)));
}

function readOwnerContactRequests() {
    try {
        return JSON.parse(localStorage.getItem(ownerContactRequestsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(ownerContactRequestsStorageKey);
        return [];
    }
}

function formatRequestTime(value) {
    if (!value) return "Just now";
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function priceNumber(price) {
    const value = String(price || "").replace(/[^\d]/g, "");
    return Number(value || 28000);
}

function listingMode(type) {
    const text = String(type || "").toLowerCase();
    if (text.includes("sale") || text.includes("buy")) return "Buy";
    if (text.includes("premium")) return "Premium";
    return "Rent";
}

function normalizePublishedListing(input) {
    const mode = listingMode(input.type);
    const bhk = input.bhk || (String(input.title || "").match(/\b\d\s*BHK\b/i)?.[0] || "2 BHK");
    const locality = input.locality || "Owner Listed";
    const city = input.city || "Bangalore";
    const title = input.title || `${bhk} Apartment in ${locality}`;
    return {
        id: input.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        society: input.society || locality,
        locality,
        city,
        type: mode,
        price: input.price || "Rs. 28,000",
        rent: priceNumber(input.price),
        maintenance: Number(input.maintenance || 0),
        deposit: input.deposit || (mode === "Buy" ? "For Sale" : "Rs. 1,00,000"),
        sqft: input.sqft || "1,100 sqft",
        bhk,
        furnishing: input.furnishing || "Semi Furnished",
        available: input.available || "Ready to Move",
        parking: input.parking || "Bike Parking Car Parking",
        tenant: input.tenant || "All",
        apartmentType: input.apartmentType || (mode === "Premium" ? "Gated Society" : "Owner Listed Apartment"),
        notes: input.notes || "",
        owner: input.owner || "Owner",
        phone: input.phone || "",
        status: input.status || "Live",
        image: input.image || (mode === "Premium" ? "/shared/images/propertydirect-cinematic-2.webp" : "/shared/images/apartment-living-1.webp"),
        publishedAt: input.publishedAt || new Date().toISOString()
    };
}

function defaultAdminListings() {
    return [
        {
            id: "default-manifest-heights",
            title: "2 BHK Apartment in Manifest Heights",
            society: "Manifest Heights",
            locality: "Hebbal",
            city: "Bangalore",
            type: "Rent",
            price: "Rs. 28,000",
            rent: 28000,
            maintenance: 2400,
            deposit: "Rs. 2,50,000",
            sqft: "1,080 sqft",
            bhk: "2 BHK",
            furnishing: "Semi Furnished",
            available: "Ready to Move",
            parking: "Bike Parking Car Parking",
            tenant: "Family / Bachelor",
            apartmentType: "Gated Society",
            image: "/shared/images/apartment-living-1.webp",
            status: "Live",
            notes: "Default public apartment inventory"
        },
        {
            id: "default-sri-balaji-serenity",
            title: "2 BHK Apartment in Sri Balaji Serenity",
            society: "Sri Balaji Serenity",
            locality: "Kaikondrahalli",
            city: "Bangalore",
            type: "Rent",
            price: "Rs. 42,000",
            rent: 42000,
            maintenance: 3000,
            deposit: "Rs. 1,50,000",
            sqft: "1,140 sqft",
            bhk: "2 BHK",
            furnishing: "Semi Furnished",
            available: "15 Days",
            parking: "Bike Parking Car Parking",
            tenant: "All",
            apartmentType: "Gated Society",
            image: "/shared/images/apartment-living-2.webp",
            status: "Live",
            notes: "Default public apartment inventory"
        },
        {
            id: "default-lake-view-residency",
            title: "3 BHK Apartment in Lake View Residency",
            society: "Lake View Residency",
            locality: "Bellandur",
            city: "Bangalore",
            type: "Rent",
            price: "Rs. 50,000",
            rent: 50000,
            maintenance: 3500,
            deposit: "Rs. 2,50,000",
            sqft: "1,400 sqft",
            bhk: "3 BHK",
            furnishing: "Semi Furnished",
            available: "30 Days",
            parking: "Car Parking",
            tenant: "Company",
            apartmentType: "Gated Society",
            image: "/shared/images/propertydirect-cinematic-1.webp",
            status: "Live",
            notes: "Default public apartment inventory"
        },
        {
            id: "default-rajaji-nagar",
            title: "1 BHK Apartment in Rajaji Nagar",
            society: "Standalone Apartment",
            locality: "Rajaji Nagar",
            city: "Bangalore",
            type: "Rent",
            price: "Rs. 25,000",
            rent: 25000,
            maintenance: 0,
            deposit: "Rs. 2,00,000",
            sqft: "850 sqft",
            bhk: "1 BHK",
            furnishing: "Fully Furnished",
            available: "Ready to Move",
            parking: "Bike Parking",
            tenant: "All",
            apartmentType: "Standalone Apartment",
            image: "/shared/images/apartment-bedroom-1.webp",
            status: "Live",
            notes: "Default public apartment inventory"
        },
        {
            id: "default-greenview-towers",
            title: "3 BHK Apartment in Greenview Towers",
            society: "Greenview Towers",
            locality: "Kaikondrahalli",
            city: "Bangalore",
            type: "Rent",
            price: "Rs. 52,500",
            rent: 52500,
            maintenance: 3500,
            deposit: "Rs. 2,00,000",
            sqft: "1,250 sqft",
            bhk: "3 BHK",
            furnishing: "Unfurnished",
            available: "Ready to Move",
            parking: "Car Parking",
            tenant: "Family",
            apartmentType: "Gated Society",
            image: "/shared/images/apartment-living-2.webp",
            status: "Live",
            notes: "Default public apartment inventory"
        }
    ];
}

function savePublishedListing(input) {
    const listing = normalizePublishedListing(input);
    const existing = readPublishedListings().filter(item => item.id !== listing.id && item.title !== listing.title);
    writePublishedListings([listing, ...existing]);
    return listing;
}

function readImageFile(file) {
    if (!file) return Promise.resolve("");
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

function listingFromAdminRow(row) {
    const titleCell = row?.children?.[0]?.textContent?.trim() || "Owner Listed Apartment";
    const title = row?.dataset.title || titleCell.replace(/\s+-\s+(?:Rs\.|₹|Rs)\s*[\d,]+.*/i, "").trim();
    return readPublishedListings().find(item => item.id && item.id === row?.dataset.listingId) || {
        id: row?.dataset.listingId || `admin-${Date.now()}`,
        title,
        type: row?.children?.[1]?.textContent?.trim() || "Rent",
        price: row?.dataset.price || "Rs. 28,000",
        city: row?.dataset.city || "Bangalore",
        locality: row?.dataset.locality || "Owner Listed",
        society: row?.dataset.society || row?.dataset.locality || "Owner Listed Apartment",
        bhk: row?.dataset.bhk || (title.match(/\b\d\s*BHK\b/i)?.[0] || "2 BHK"),
        deposit: row?.dataset.deposit || "Rs. 1,00,000",
        sqft: row?.dataset.sqft || "1,100 sqft",
        furnishing: row?.dataset.furnishing || "Semi Furnished",
        available: row?.dataset.available || "Ready to Move",
        parking: row?.dataset.parking || "Bike Parking Car Parking",
        tenant: row?.dataset.tenant || "All",
        apartmentType: row?.dataset.apartmentType || "Owner Listed Apartment",
        notes: row?.dataset.notes || "",
        image: row?.dataset.image || "",
        status: row?.querySelector(".status")?.textContent?.trim() || "Live"
    };
}

function updateAdminListingRow(row, listing) {
    if (!row) return;
    row.dataset.listingId = listing.id || "";
    row.dataset.title = listing.title || "";
    row.dataset.city = listing.city || "";
    row.dataset.locality = listing.locality || "";
    row.dataset.society = listing.society || "";
    row.dataset.bhk = listing.bhk || "";
    row.dataset.deposit = listing.deposit || "";
    row.dataset.sqft = listing.sqft || "";
    row.dataset.price = listing.price || "";
    row.dataset.furnishing = listing.furnishing || "";
    row.dataset.available = listing.available || "";
    row.dataset.parking = listing.parking || "";
    row.dataset.tenant = listing.tenant || "";
    row.dataset.apartmentType = listing.apartmentType || "";
    row.dataset.notes = listing.notes || "";
    row.dataset.image = listing.image || "";
    const status = listing.status || "Live";
    const statusClass = String(status).toLowerCase() === "live" ? "live" : "pending";
    const actionButton = statusClass === "live" ? '<button data-action="deactivate-row">Deactivate</button>' : '<button data-action="activate-row">Make Live</button>';
    row.children[0].textContent = `${listing.title}${listing.price ? ` - ${listing.price}` : ""}`;
    row.children[1].textContent = `${listing.type} Apartment`;
    row.children[2].innerHTML = `<span class="status ${statusClass}">${safeHtml(status)}</span>`;
    row.children[3].innerHTML = `<button data-action="edit-row">Edit</button> ${actionButton}`;
}

function publishListingRow(row) {
    if (!row || row.children.length < 3 || row.querySelector("th")) return null;
    const apartmentText = row.children[0]?.textContent?.trim() || "Owner Listed Apartment";
    const type = row.children[1]?.textContent?.trim() || "Rent Apartment";
    const priceMatch = apartmentText.match(/(?:Rs\.|₹|â‚¹)\s*[\d,]+(?:\s*[A-Za-z]+)?/i);
    const price = priceMatch?.[0] || row.dataset.price || "Rs. 28,000";
    const title = apartmentText.replace(/\s+-\s+(?:Rs\.|₹|â‚¹).*/i, "").trim();
    return savePublishedListing({
        id: row.dataset.listingId,
        title,
        type,
        price,
        city: row.dataset.city,
        locality: row.dataset.locality,
        bhk: row.dataset.bhk,
        deposit: row.dataset.deposit,
        sqft: row.dataset.sqft
    });
}

const actionForms = {
    "post-property": {
        title: "Publish Apartment",
        text: "Add the apartment to your live listings.",
        fields: ["Apartment title", "City", "Locality", "Full property address", "Listing purpose|select:Rent,Sale,Lease", "Property type|select:Apartment,Villa,Independent House,Studio,Plot,Commercial", "BHK configuration|select:1 BHK,2 BHK,3 BHK,4 BHK,5+ BHK", "Built-up area (sq.ft)|number", "Monthly rent / sale price|number", "Security deposit|number", "Maintenance charge|number", "Furnishing|select:Unfurnished,Semi Furnished,Fully Furnished", "Available from|date", "Preferred tenant / buyer", "Parking details", "Owner name", "Owner mobile|tel", "Listing description and amenities|textarea"],
        save: (values) => {
            const form = readPostApartmentForm();
            const title = values[0] || form.title || "New Apartment";
            const city = values[1] || form.city || "Bangalore";
            const locality = values[2] || form.locality || "Owner Listed";
            const price = values[8] || form.price || "₹28,000";
            const type = `${values[4] || "Rent"} ${values[5] || form.type || "Apartment"}`;
            const bhk = values[6] || form.bhk || "2 BHK";
            const listing = savePublishedListing({ title: `${bhk} ${title}`, city, locality, price, type, bhk, deposit: values[9] || form.deposit, sqft: values[7] ? `${values[7]} sqft` : form.sqft, maintenance:values[10],furnishing:values[11],available:values[12],tenant:values[13],parking:values[14],owner:values[15],phone:values[16],notes:values[17],address:values[3] });
            addListing(listing.title, type, "Live", price, listing);
            addTask(`Review newly posted apartment: ${title} (${price})`);
            incrementStat("live", 1);
            openPanel("listings");
            return receipt(`Apartment listing is live: ${title}`, activeModalTarget, [title, city, locality, price, type, bhk], [`<strong>Visible:</strong> Added to PropertyDirect dashboard and public apartment listings`]);
        }
    },
    "preview-apartment": {
        title: "Apartment Preview",
        text: "Preview generated from your post form.",
        fields: [],
        save: () => {
            const form = readPostApartmentForm();
            return receipt("Apartment preview generated", activeModalTarget, [
                form.title || "Untitled apartment",
                form.city || "City missing",
                form.locality || "Locality missing",
                form.price || "Price missing",
                form.deposit || "Deposit missing",
                form.sqft || "Sqft missing",
                form.bhk || "BHK missing"
            ], [`<strong>Checked:</strong> Title, rent/price, deposit, sqft and BHK fields`]);
        }
    },
    "add-lead": {
        title: "Add Apartment Lead",
        text: "Create a lead and add it to the lead table.",
        fields: ["Lead name", "Mobile number|tel", "Email address|email", "Requirement type|select:Rent,Buy,Lease", "Preferred city", "Preferred localities", "Property / BHK requirement", "Budget minimum|number", "Budget maximum|number", "Move-in target|date", "Lead source|select:Website,Referral,Campaign,Walk-in,Partner", "Lead priority|select:LOW,NORMAL,HIGH,HOT", "Detailed preferences|textarea"],
        save: (values) => {
            addLead(values[0] || "New Lead", values[6] || "2 BHK apartment", values[11] || "New");
            incrementStat("leads", 1);
            return receipt(`Lead added: ${values[0] || "New Lead"}`, activeModalTarget, values, [`<strong>Next:</strong> Lead table updated`]);
        }
    },
    "new-visit": {
        title: "Schedule Visit",
        text: "Add a new apartment visit schedule.",
        fields: ["Visitor name", "Mobile number|tel", "Email address|email", "Apartment / listing", "Visit date|date", "Start time|time", "End time|time", "Visitor count|number", "Visit mode|select:In-person,Video tour,Agent-assisted", "Assigned relationship manager", "Meeting point / access instructions|textarea"],
        save: (values) => {
            addVisit(`${values[4] || "Tomorrow"} ${values[5] || "5 PM"} - ${values[0] || "Customer"} (${values[3] || "Apartment"})`);
            incrementStat("visits", 1);
            return receipt(`Visit scheduled for ${values[0] || "Customer"}`, activeModalTarget, values, [`<strong>Next:</strong> Visit schedule updated`]);
        }
    },
    "add-payment": {
        title: "Add Payment",
        text: "Record a plan or service payment.",
        fields: ["Payment item / purpose", "Payer name", "Payer email|email", "Amount|number", "Tax amount|number", "Payment date|date", "Payment method|select:UPI,Card,Net banking,Bank transfer,Cash,Cheque", "Transaction reference", "Payment status|select:PENDING,PAID,FAILED,REFUNDED", "Invoice / receipt number", "Settlement notes|textarea"],
        save: (values) => {
            addPayment(values[0] || "Apartment Service", values[3] || "₹999", values[8] || "Pending");
            return receipt(`Payment added: ${values[0] || "Apartment Service"}`, activeModalTarget, values, [`<strong>Amount:</strong> ${values[1] || "₹999"}`]);
        }
    },
    "book-service": {
        title: "Book Apartment Service",
        text: "Confirm a service request for this apartment.",
        fields: ["Service category|select:Painting,Cleaning,Packers and Movers,Legal Verification,Home Loan,Property Inspection,Maintenance,Other", "Apartment / listing", "Service address", "Preferred date|date", "Preferred time|time", "Contact person", "Contact mobile|tel", "Access permission|select:Owner present,Tenant present,Security access,Call before arrival", "Budget estimate|number", "Service requirements and notes|textarea"],
        save: (values) => {
            addServiceRequest(values[1] || activeModalTarget?.textContent?.trim() || "Apartment service", values[3] || "Selected date", values[9] || "Requested");
            addTask(`Service booked: ${values[1] || "Apartment"} on ${values[3] || "selected date"}`);
            return receipt(`Service booked for ${values[1] || "Apartment"}`, activeModalTarget, values);
        }
    },
    upgrade: {
        title: "Upgrade To Assisted",
        text: "Confirm Assisted plan activation with managed listing support.",
        fields: ["Billing name", "Mobile number|tel", "Billing email|email", "Plan duration|select:Monthly,Quarterly,Half-yearly,Annual", "Listing count|number", "Billing address", "GSTIN (optional)", "Upgrade instructions|textarea"],
        save: (values) => activateOwnerPlan("Assisted", activeModalTarget, values)
    },
    support: {
        title: "Raise Support Ticket",
        text: "Send an issue to support.",
        fields: ["Issue title", "Category|select:Listing,Payment,Visit,Owner contact,Service,Account,Refund,Technical,Other", "Priority|select:LOW,NORMAL,HIGH,URGENT", "Related listing / reference", "Contact name", "Contact mobile|tel", "Contact email|email", "Preferred response|select:Phone,Email,WhatsApp,In-app", "Attachment reference", "Detailed description|textarea"],
        save: (values) => {
            addSupportTicket(values[0] || readNearbyFields(activeModalTarget)[0]?.replace("Issue: ", "") || "Support issue", values[9] || "Customer requested help");
            let state = document.getElementById("supportState");
            if (!state) {
                const heading = document.querySelector('[data-view="support"] .dash-card h3');
                heading?.insertAdjacentHTML("afterend", '<span class="inline-state" id="supportState">Ready</span>');
                state = document.getElementById("supportState");
            }
            if (state) state.textContent = "Ticket raised";
            return receipt("Support ticket raised", activeModalTarget, values);
        }
    },
    schedule: {
        title: "Schedule Site Visit",
        text: "Choose a convenient visit slot.",
        fields: ["Apartment / listing", "Visit date|date", "Start time|time", "End time|time", "Visitor name", "Visitor mobile|tel", "Visitor count|number", "Visit mode|select:In-person visit,Virtual tour,Agent callback", "Assigned agent", "Access and parking instructions|textarea"],
        save: (values) => {
            addVisit(`${values[1] || "Selected date"} ${values[2] || ""} - ${values[0] || "Apartment"} · ${values[4] || "Visitor"}`);
            return receipt(`Site visit scheduled for ${values[0] || "Apartment"}`, activeModalTarget, values);
        }
    },
    pay: {
        title: "Pay Rent",
        text: "Record a secure rent payment.",
        fields: ["Apartment / owner", "Billing month", "Base rent amount|number", "Maintenance amount|number", "Utility / other charges|number", "Late fee|number", "Payment method|select:UPI,Card,Net banking,Bank transfer", "Payment reference", "Receipt email|email", "Payment note|textarea"],
        save: (values) => {
            addRentPayment(values[0] || "Current apartment", values[2] || "₹28,000", values[7] || "Manual reference");
            const state = document.getElementById("rentPayState");
            if (state) state.textContent = "Last rent payment recorded";
            return receipt("Rent payment completed", activeModalTarget, values);
        }
    },
    call: {
        title: "Owner Contact",
        text: "Confirm that you want to unlock this owner contact.",
        fields: ["Contact purpose", "Preferred contact time", "Customer mobile|tel", "Customer email|email", "Consent confirmed|select:Yes,No", "Contact note|textarea"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            const status = row?.querySelector(".status");
            if (status) {
                status.textContent = "Unlocked";
                status.className = "status active";
            }
            if (activeModalTarget) {
                activeModalTarget.textContent = "Contacted";
                activeModalTarget.disabled = true;
            }
            return receipt("Owner contact unlocked", activeModalTarget, values, ["<strong>Next:</strong> Phone contact is now marked as unlocked"]);
        }
    },
    "edit-row": {
        title: "Edit selected record",
        text: "Review and update the selected record before saving.",
        fields: ["Apartment title", "Type", "Status"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            if (row) {
                if (values[0]) row.children[0].textContent = values[0];
                if (values[1]) row.children[1].textContent = values[1];
                const status = row.querySelector(".status");
                if (values[2] && status) {
                    status.textContent = values[2];
                    status.className = `status ${values[2].toLowerCase().includes("active") || values[2].toLowerCase().includes("approved") ? "active" : "pending"}`;
                }
            }
            return receipt("Selected record updated", activeModalTarget, values);
        }
    },
    approve: {
        title: "Review and approve request",
        text: "Confirm the decision, capture the rationale, and choose how the affected party should be notified.",
        fields: ["Request reference"],
        save: (values) => {
            setRowStatus(activeModalTarget, "Approved", "active");
            if (activeModalTarget) activeModalTarget.textContent = "Approved";
            return receipt("Approval recorded", activeModalTarget, values, ["<strong>Next:</strong> The requester will receive the selected notification"]);
        }
    },
    "mark-paid": {
        title: "Record settlement",
        text: "Confirm the settlement decision and retain a clear operational note.",
        fields: ["Payment or payout reference"],
        save: (values) => {
            setRowStatus(activeModalTarget, "Settled", "paid");
            if (activeModalTarget) activeModalTarget.textContent = "Settled";
            return receipt("Settlement recorded", activeModalTarget, values);
        }
    },
    "resolve-task": {
        title: "Resolve request",
        text: "Record the resolution outcome before closing or escalating the request.",
        fields: ["Ticket or request reference"],
        save: (values) => {
            setRowStatus(activeModalTarget, "Resolved", "active");
            if (activeModalTarget) activeModalTarget.textContent = "Resolved";
            return receipt("Resolution recorded", activeModalTarget, values);
        }
    },
    "call-lead": {
        title: "Call Lead",
        text: "Record the exact call outcome for this apartment lead.",
        fields: ["Call outcome", "Follow-up note"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            if (row?.children[2]) row.children[2].textContent = values[0] || "Called";
            return receipt("Lead call outcome saved", activeModalTarget, values);
        }
    },
    "schedule-lead": {

        title: "Schedule Lead Visit",
        text: "Move this lead into the visit schedule.",
        fields: ["Visit date", "Visit time", "Apartment"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            const lead = row?.children[0]?.textContent || "Lead";
            const apartment = values[2] || row?.children[1]?.textContent || "Apartment";
            addVisit(`${values[0] || "Selected date"} ${values[1] || ""} - ${lead} (${apartment})`);
            if (row?.children[2]) row.children[2].textContent = "Visit Scheduled";
            incrementStat("visits", 1);
            return receipt(`Visit scheduled for ${lead}`, activeModalTarget, values);
        }
    },
    "manage-plan": {
        title: "Manage Plan",
        text: "Update pricing and availability for this plan.",
        fields: ["Plan name", "Plan price|number", "Billing cycle|select:Monthly,Quarterly,Annual", "Listing limit|number", "Lead limit|number", "Featured listing days|number", "Support level|select:Standard,Priority,Dedicated manager", "Plan status|select:ACTIVE,DRAFT,PAUSED", "Plan benefits and conditions|textarea"],
        save: (values) => receipt("Plan updated", activeModalTarget, values)
    },
    "resolve-category-item": {
        title: "Resolve Category Item",
        text: "Add a resolution note for this item.",
        fields: ["Item reference", "Resolution category|select:Corrected,Approved,Rejected,Duplicate,Escalated,No action required", "Resolved by", "Resolution date|date", "Customer notified|select:Yes,No", "Evidence reference", "Resolution note|textarea"],
        save: (values) => receipt("Item resolved", activeModalTarget, values)
    },
    inspect: {
        title: "Category Details",
        text: "Review the selected metric and its current category status.",
        fields: [],
        save: (values) => receipt("Category reviewed", activeModalTarget, values)
    },
    save: {
        title: "Save Settings & Policies",
        text: "Confirm saving updated policy settings, preferences, or form configurations.",
        fields: ["Configuration Summary / Note"],
        save: (values) => {
            const context = getContext(activeModalTarget);
            return receipt(`Settings saved for ${context.panelTitle}`, activeModalTarget, values, ["<strong>Status:</strong> Saved & active"]);
        }
    },
    "add-row": {
        title: "Add New Record",
        text: "Create a new entry for this table or administrative section.",
        fields: ["Item name / title", "Category / group", "Status / role|select:ACTIVE,PENDING,DRAFT,UNDER REVIEW,DISABLED", "Owner / responsible team", "Effective date|date", "Contact / reference", "Priority|select:LOW,NORMAL,HIGH,URGENT", "Detailed administrative notes|textarea"],
        save: (values) => {
            const table = activeModalTarget?.closest(".dash-card")?.querySelector("table tbody");
            if (table) {
                const cells = table.querySelector("tr:last-child")?.children.length || 4;
                const row = document.createElement("tr");
                const col0 = values[0] || "New Record Entry";
                const col1 = values[1] || "Platform Operations";
                const col2 = values[2] || "Active";
                row.innerHTML = `<td><strong>${safeHtml(col0)}</strong></td><td>${safeHtml(col1)}</td><td><span class="status active">${safeHtml(col2)}</span></td>` +
                    (cells > 3 ? `<td><button data-action="edit-row">Edit</button></td>` : "");
                table.prepend(row);
            }
            return receipt("New record created", activeModalTarget, values, ["<strong>Table:</strong> Updated in live workspace"]);
        }
    }
};

function ensureModal() {
    modal = document.createElement("div");
    modal.id = "dashboardModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
        <div class="modal-card">
            <button class="close" type="button" data-action="close-modal" aria-label="Close">×</button>
            <h2 id="modalTitle">Action</h2>
            <p id="modalText">Complete this action.</p>
            <div id="modalFields"></div>
            <div class="pd-modal-actions">
                <button class="modal-cancel" type="button" data-action="close-modal">Cancel</button>
                <button class="primary" id="modalSave" type="button">Save changes</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modalTitle = modal.querySelector("#modalTitle");
    modalText = modal.querySelector("#modalText");
    modalFields = modal.querySelector("#modalFields");
    modalSave = modal.querySelector("#modalSave");
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });
    return modal;
}

function modalInput(label, key, value = "", type = "text", required = false, options = []) {
    const safeValue = safeAttr(value);
    const requiredAttr = required ? " required" : "";
    if (type === "select") {
        const optionMarkup = options.map(option => `<option${option === value ? " selected" : ""}>${safeHtml(option)}</option>`).join("");
        return `<label>${safeHtml(label)}<select data-modal-input="${safeAttr(key)}"${requiredAttr}>${optionMarkup}</select></label>`;
    }
    if (type === "textarea") return `<label class="pd-modal-wide" style="grid-column: 1 / -1 !important; width: 100% !important;">${safeHtml(label)}<textarea data-modal-input="${safeAttr(key)}" placeholder="Add clear context for the audit trail"${requiredAttr}>${safeHtml(value)}</textarea></label>`;

    return `<label>${safeHtml(label)}<input data-modal-input="${safeAttr(key)}" type="${safeAttr(type)}" value="${safeValue}" placeholder="${safeHtml(label)}"${requiredAttr}></label>`;
}

function selectedRowValues(target) {
    return [...(target?.closest?.("tr")?.children || [])]
        .map(cell => cell.textContent.trim().replace(/\s+/g, " "))
        .filter(Boolean);
}

function detailedModalFields(action, config, target) {
    const context = getContext(target);
    const row = selectedRowValues(target);
    const record = row[0] || context.target || "";
    const section = (title, description, icon="◆") => `<div class="pd-form-section"><i>${icon}</i><div><strong>${safeHtml(title)}</strong><small>${safeHtml(description)}</small></div></div>`;
    const renderConfiguredField = (field, index) => {
        const [label,typeSpec=""] = field.split("|");
        if(typeSpec.startsWith("select:")) return modalInput(label,String(index),row[index]||"","select",index===0,typeSpec.slice(7).split(","));
        const type = typeSpec || (label.toLowerCase().includes("date") ? "date" : "text");
        return modalInput(label,String(index),row[index]||"",type,index===0);
    };
    const base = config.fields.flatMap((field,index)=>{
        const headings=[];
        if(index===0) headings.push(section("Primary details","Identify the record and its main purpose","1"));
        if(config.fields.length>=8 && index===4) headings.push(section("Operational details","Schedule, classification, amounts and responsibility","2"));
        if(config.fields.length>=12 && index===8) headings.push(section("Contact, compliance & notes","Supporting references, contact information and full context","3"));
        return [...headings,renderConfiguredField(field,index)];
    });
    const fields = [...base];
    const add = (label, key, value, type, required, options) => fields.push(modalInput(label, key, value, type, required, options));

    if (action === "edit-row") {
        if (context.panel === "roles") {
            const rootPolicy = /super admin|root/i.test(record + " " + (target?.textContent || ""));
            const policyFields = [
                section("Policy identity and ownership", "Define who receives this policy and where it sits in the access hierarchy.", "1"),
                modalInput("Role or permission group", "0", record, "text", true),
                modalInput("Policy reference ID", "policyId", rootPolicy ? "PD-RBAC-ROOT-001" : "PD-RBAC-GROUP-001", "text", true),
                modalInput("Policy description", "description", row[2] || "Operational access policy", "textarea", true),
                modalInput("Access scope", "1", row[1] || "Platform operations", "select", true, ["Global platform access", "Platform operations", "Listing review", "Customer support", "Finance review", "Read-only audit access"]),
                modalInput("Reports to / parent policy", "parentPolicy", rootPolicy ? "No parent — root authority" : "Super Admin root policy", "text", true),
                modalInput("Policy status", "2", "Active", "select", true, ["Active", "Restricted", "Under review", "Suspended", "Archived"]),
                section("Module-level permissions", "Choose the exact authority available in each PropertyDirect operational module.", "2"),
                modalInput("Customer accounts", "customerPermission", rootPolicy ? "Full control" : "View and manage", "select", true, ["No access", "View only", "View and manage", "Full control"]),
                modalInput("Property listings", "listingPermission", "Approve and manage", "select", true, ["No access", "View only", "Create and edit", "Approve and manage", "Full control"]),
                modalInput("KYC and verification", "kycPermission", "Approve and reject", "select", true, ["No access", "View only", "Request documents", "Approve and reject", "Full control"]),
                modalInput("Payments, refunds and payouts", "financePermission", rootPolicy ? "Full financial control" : "View only", "select", true, ["No access", "View only", "Review transactions", "Approve within limit", "Full financial control"]),
                modalInput("Plans and pricing", "pricingPermission", rootPolicy ? "Publish changes" : "View only", "select", true, ["No access", "View only", "Create draft", "Publish changes"]),
                modalInput("Support and disputes", "supportPermission", "Resolve and escalate", "select", true, ["No access", "View only", "Respond", "Resolve and escalate", "Full control"]),
                modalInput("Audit logs and backups", "auditPermission", rootPolicy ? "Export and restore" : "View only", "select", true, ["No access", "View only", "Export logs", "Run backup", "Export and restore"]),
                modalInput("System configuration", "systemPermission", rootPolicy ? "Full control" : "No access", "select", true, ["No access", "View only", "Edit non-critical settings", "Full control"]),
                section("Approval authority and limits", "Set financial, listing and escalation thresholds for this role.", "3"),
                modalInput("Maximum refund approval (Rs.)", "refundLimit", rootPolicy ? "1000000" : "10000", "number", true),
                modalInput("Maximum payout approval (Rs.)", "payoutLimit", rootPolicy ? "5000000" : "0", "number", true),
                modalInput("Property approval authority", "propertyApproval", rootPolicy ? "All property types" : "Standard residential listings", "select", true, ["No approval authority", "Standard residential listings", "Residential and commercial", "All property types"]),
                modalInput("Escalation destination", "escalation", rootPolicy ? "Platform owner / board" : "Super Administrator", "text", true),
                section("Authentication and session security", "Apply mandatory identity, network, device and session restrictions.", "4"),
                modalInput("Two-factor authentication", "mfa", "Required", "select", true, ["Required", "Optional", "Hardware key required", "Exempt by documented approval"]),
                modalInput("Session duration", "session", rootPolicy ? "4 hours" : "8 hours", "select", true, ["2 hours", "4 hours", "8 hours", "12 hours", "24 hours"]),
                modalInput("Concurrent session limit", "concurrentSessions", rootPolicy ? "1" : "2", "number", true),
                modalInput("IP allowlist", "ipAllowlist", "Admin corporate network", "text", true),
                modalInput("Device trust policy", "devicePolicy", "Managed devices only", "select", true, ["Any verified device", "Managed devices only", "Named device allowlist", "Hardware-key devices only"]),
                modalInput("Geographic access", "geoAccess", "India", "text", true),
                modalInput("Permitted working hours", "workingHours", "06:00 - 23:00 IST", "text", true),
                modalInput("Failed-login lockout", "lockout", "5 attempts / 30 minutes", "select", true, ["3 attempts / 60 minutes", "5 attempts / 30 minutes", "10 attempts / 15 minutes"]),
                section("Change control and audit", "Document when this policy applies, who authorized it, and why it changed.", "5"),
                modalInput("Effective date", "effectiveDate", new Date().toISOString().slice(0, 10), "date", true),
                modalInput("Review / expiry date", "reviewDate", "", "date"),
                modalInput("Approved by", "approvedBy", rootPolicy ? "Platform owner" : "Super Administrator", "text", true),
                modalInput("Change ticket / reference", "changeTicket", "", "text", true),
                modalInput("Notify affected users", "notifyUsers", "Email and in-app notification", "select", true, ["Email and in-app notification", "In-app notification only", "Do not notify"]),
                modalInput("Detailed change reason and risk note", "reason", "", "textarea", true)
            ];
            return `<div class="form-grid pd-detailed-form pd-rbac-form">${policyFields.join("")}</div>`;
        }
        if (["admins", "users"].includes(context.panel)) {
            return [
                modalInput("Full name", "0", record, "text", true),
                modalInput("Role", "1", row[1] || "Administrator", "select", true, ["Administrator", "Moderator", "Support Admin", "Listing Reviewer", "Finance Admin"]),
                modalInput("Account status", "2", row[2] || "Active", "select", true, ["Active", "Suspended", "Pending verification", "Deactivated"]),
                modalInput("Work email", "email", "", "email", true),
                modalInput("Mobile number", "phone", "", "tel"),
                modalInput("Permission group", "group", "Default admin policy", "text"),
                modalInput("Administrative note", "reason", "", "textarea", true)
            ].join("");
        }
        if (context.panel === "integrations") {
            return [
                modalInput("Integration name", "0", record, "text", true),
                modalInput("Purpose", "1", row[1] || "Platform service", "text", true),
                modalInput("Connection status", "2", row[3] || "Connected", "select", true, ["Connected", "Test mode", "Paused", "Credential rotation required"]),
                modalInput("Environment", "environment", "Production", "select", true, ["Production", "Sandbox", "Development"]),
                modalInput("Credential reference", "credential", "Stored in secure vault", "text", true),
                modalInput("Webhook or endpoint", "endpoint", "", "url"),
                modalInput("Change note", "reason", "", "textarea", true)
            ].join("");
        }
        if (context.panel === "masterdata") {
            return [
                modalInput("Master data group", "0", record, "text", true),
                modalInput("Configured values", "1", row[1] || "", "textarea", true),
                modalInput("Availability", "2", row[2] || "Enabled", "select", true, ["Enabled", "Draft", "Deprecated", "Disabled"]),
                modalInput("Country / state", "region", "India", "text", true),
                modalInput("City / locality scope", "location", "All supported cities", "text"),
                modalInput("Effective date", "effectiveDate", "", "date"),
                modalInput("Change reason", "reason", "", "textarea", true)
            ].join("");
        }
        return [
            modalInput("Record title", "0", record, "text", true),
            modalInput("Record type", "1", row[1] || "Standard", "text", true),
            modalInput("Status", "2", row[2] || "Active", "select", true, ["Active", "Pending review", "Approved", "Suspended", "Archived"]),
            modalInput("Owner or contact", "owner", "", "text"),
            modalInput("Effective date", "effectiveDate", "", "date"),
            modalInput("Internal note", "reason", "", "textarea", true)
        ].join("");
    }

    if (["approve", "resolve-task", "mark-paid"].includes(action)) {
        add("Decision", "decision", action === "approve" ? "Approve" : action === "mark-paid" ? "Mark paid" : "Resolve", "select", true, action === "approve" ? ["Approve", "Request additional information", "Reject"] : ["Complete", "Keep open", "Escalate"]);
        add("Notify affected party", "notify", "Email and in-app notification", "select", true, ["Email and in-app notification", "In-app notification only", "Do not notify"]);
        add("Decision note", "reason", "", "textarea", true);
    }

 else if (["add-row", "save", "manage-plan"].includes(action)) {
        add("Owner or responsible team", "owner", "Platform operations", "text", true);
        add("Effective date", "effectiveDate", "", "date");
        add("Internal note", "reason", "", "textarea", true);
    } else if (action === "schedule") {
        add("Visit mode", "mode", "In-person visit", "select", true, ["In-person visit", "Virtual tour", "Agent callback"]);
        add("Visitor count", "visitors", "1", "number");
        add("Special instructions", "reason", "", "textarea");
    } else if (action === "pay") {
        add("Payment method", "method", "UPI", "select", true, ["UPI", "Card", "Net banking", "Bank transfer"]);
        add("Receipt email", "email", "", "email", true);
        add("Payment note", "reason", "", "textarea");
    } else {
        add("Internal note", "reason", "", "textarea");
    }
    if(!fields.some(field=>field.includes("pd-form-section"))) fields.unshift(section("Additional details","Complete the supporting information for this action","+") );
    return `<div class="form-grid pd-detailed-form">${fields.join("")}</div>`;
}

function openModal(action, target) {
    const config = actionForms[action];
    if (!config) return false;
    ensureModal();
    activeModalTarget = target;
    const context = getContext(target);
    const rootPolicyEdit = action === "edit-row" && context.panel === "roles" && /root|super admin/i.test((target?.textContent || "") + " " + (target?.closest("tr")?.textContent || ""));
    modalTitle.textContent = action === "edit-row" && context.panel === "roles" ? (rootPolicyEdit ? "Edit root access policy" : "Edit permission group") : config.title;
    modalText.textContent = action === "edit-row" && context.panel === "roles" ? "Configure detailed module permissions, approval authority, security restrictions and audit controls for this access policy." : config.text;
    modalFields.innerHTML = detailedModalFields(action, config, target);
    modalSave.onclick = () => {
        const values = readModalFields(modalFields);
        const result = config.save(values);
        if (result?.lines) {
            showActionReceipt(result);
        }
        closeModal();
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-modal-input]")?.focus();
    return true;
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4200);
}


function safeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function safeAttr(value) {
    return safeHtml(value).replaceAll('"', "&quot;");
}

function appendDashboardActivity(message) {
    const log = document.getElementById("propertyActivityLog");
    const list = log?.querySelector("ul");
    if (!list) return;
    const stamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const entry = document.createElement("li");
    entry.innerHTML = `<strong>${stamp}</strong><span>${safeHtml(message)}</span>`;
    list.prepend(entry);
    [...list.children].slice(6).forEach(item => item.remove());
}

function getContext(target) {
    const panel = target?.closest?.("[data-view]")?.dataset.view || "overview";
    const panelTitle = panelTitles[panel] || panel;
    const row = target?.closest?.("tr");
    if (row) {
        const cells = [...row.children].map(cell => (cell.innerText || cell.textContent).trim().replace(/\s+/g, " ")).filter(Boolean);
        return {
            panel,
            panelTitle,
            target: cells.slice(0, Math.min(3, cells.length - 1 || cells.length)).join(" / "),
            detail: cells.join(" | ")
        };
    }
    const card = target?.closest?.(".dash-card");
    if (card) {
        const heading = card.querySelector("h2, h3")?.textContent.trim();
        const copy = card.querySelector("p")?.textContent.trim();
        return { panel, panelTitle, target: heading || target.textContent?.trim() || panelTitle, detail: copy || panelTitle };
    }
    const text = target?.textContent?.trim();
    return { panel, panelTitle, target: text || panelTitle, detail: panelTitle };
}

async function persistWorkflowAction(action, target, values = []) {
    const context = getContext(target || document.body);
    const response = await fetch("/api/workflows", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            workspace: "PropertyDirect",
            dashboardRole,
            panel: context.panel,
            actionType: action,
            targetLabel: context.target,
            details: { values, context: context.detail, button: target?.textContent?.trim() || action }
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Action could not be saved to the database");
    return data;
}

function showActionReceipt({ title = "Action completed", lines = [] }) {
    persistDashboardState();
    ensureModal();
    modalTitle.textContent = title;
    modalText.innerHTML = lines.map(line => {
        const clean = String(line).replace(/^<strong>|<\/strong>/g, "");
        const [label, ...rest] = clean.split(":");
        return `<span class="receipt-line"><strong>${label.trim()}:</strong><span>${rest.join(":").trim()}</span></span>`;
    }).join("");
    modalFields.innerHTML = "";
    modal.querySelector(".modal-cancel")?.setAttribute("hidden", "hidden");
    modalSave.textContent = "Done";
    modalSave.onclick = closeModal;
    modal.classList.remove("hidden");
}

function receipt(title, target, values = [], extra = []) {
    const context = getContext(target || document.body);
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const details = values.filter(Boolean).join(" | ");
    const lines = [
        `<strong>Result:</strong> ${title}`,
        `<strong>Section:</strong> ${context.panelTitle}`,
        `<strong>Target:</strong> ${context.target}`,
        details ? `<strong>Details:</strong> ${details}` : "<strong>Details:</strong> No additional note entered",
        ...extra,
        `<strong>Time:</strong> ${now}`
    ];
    appendDashboardActivity(title);
    showToast(`✓ ${title}`);
    return { title: "Action receipt", lines };
}

function openPanel(panel, updateHistory = true) {
    const selectedView = document.querySelector(`[data-view="${panel}"]`);
    if (!selectedView) return;
    document.querySelectorAll("[data-panel]").forEach((button) => {
        const active = button.dataset.panel === panel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-view]").forEach((view) => {
        const shouldHide = view !== selectedView;
        view.classList.toggle("hidden", shouldHide);
        view.classList.toggle("d-none", shouldHide);
        if (shouldHide) {
            view.style.display = "none";
        } else {
            view.style.display = "";
        }
    });
    const title = document.getElementById("panelTitle");
    if (title) title.textContent = panelTitles[panel] || "Dashboard";
    document.body.dataset.activePanel = panel;
    if (updateHistory && location.hash !== `#${panel}`) history.pushState(null, "", `#${panel}`);
    selectedView.focus({ preventScroll: true });
    const nav = document.querySelector(".dash-sidebar .sidebar-nav");
    const activeItem = nav?.querySelector("[data-panel].active");
    if (nav && activeItem) {
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.offsetHeight;
        if (panel === "overview") nav.scrollTop = 0;
        else if (itemTop < nav.scrollTop) nav.scrollTop = Math.max(0, itemTop - 12);
        else if (itemBottom > nav.scrollTop + nav.clientHeight) nav.scrollTop = itemBottom - nav.clientHeight + 12;
    }
}

function animateStats() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".dash-grid strong").forEach((stat) => {
        const match = stat.textContent.trim().match(/^(\d+)(.*)$/);
        if (!match) return;
        const target = Number(match[1]);
        const suffix = match[2];
        const started = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - started) / 650, 1);
            stat.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function readField(formId, name) {
    const form = document.getElementById(formId);
    return form?.querySelector(`[name="${name}"]`)?.value.trim();
}

function readPostApartmentForm() {
    return {
        title: readField("postApartmentForm", "title"),
        city: readField("postApartmentForm", "city"),
        locality: readField("postApartmentForm", "locality"),
        price: readField("postApartmentForm", "price"),
        type: readField("postApartmentForm", "type"),
        bhk: readField("postApartmentForm", "bhk"),
        deposit: readField("postApartmentForm", "deposit"),
        sqft: readField("postApartmentForm", "sqft")
    };
}

function readNearbyFields(target) {
    const scope = target?.closest?.(".dash-card, .dash-header, [data-view]") || document;
    return [...scope.querySelectorAll("input, select, textarea")]
        .map(field => {
            const label = field.closest("label")?.childNodes?.[0]?.textContent?.trim();
            const name = label || field.getAttribute("name") || field.placeholder || "Field";
            return `${name}: ${field.value || ""}`;
        })
        .filter(value => !value.endsWith(": "));
}

function incrementStat(name, amount) {
    const stat = document.querySelector(`[data-stat="${name}"]`);
    if (!stat) return;
    const next = Number(stat.textContent || 0) + amount;
    stat.textContent = String(next);
}

function addTask(text) {
    const list = document.getElementById("ownerTasks");
    if (!list) return;
    if ([...list.children].some(item => item.textContent.trim() === text)) return;
    const li = document.createElement("li");
    li.textContent = text;
    list.prepend(li);
}

function addListing(title, type, status, price = "", listing = {}) {
    const table = document.querySelector('[data-table="listings"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    row.dataset.listingId = listing.id || "";
    row.dataset.title = listing.title || title || "";
    row.dataset.city = listing.city || "";
    row.dataset.locality = listing.locality || "";
    row.dataset.society = listing.society || "";
    row.dataset.bhk = listing.bhk || "";
    row.dataset.deposit = listing.deposit || "";
    row.dataset.sqft = listing.sqft || "";
    row.dataset.price = price || listing.price || "";
    row.dataset.furnishing = listing.furnishing || "";
    row.dataset.available = listing.available || "";
    row.dataset.parking = listing.parking || "";
    row.dataset.tenant = listing.tenant || "";
    row.dataset.apartmentType = listing.apartmentType || "";
    row.dataset.notes = listing.notes || "";
    row.dataset.image = listing.image || "";
    const statusClass = String(status).toLowerCase() === "live" ? "live" : "pending";
    const actionButton = statusClass === "live" ? '<button data-action="deactivate-row">Deactivate</button>' : '<button data-action="activate-row">Make Live</button>';
    row.innerHTML = `<td>${title}${price ? ` - ${price}` : ""}</td><td>${type}</td><td><span class="status ${statusClass}">${status}</span></td><td><button data-action="edit-row">Edit</button> ${actionButton}</td>`;
    table.appendChild(row);
}

function normalizedListingKey(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findAdminListingRow(table, listing) {
    const listingId = normalizedListingKey(listing.id);
    const title = normalizedListingKey(listing.title);
    return [...table.querySelectorAll("tr")].find(row => {
        if (row.querySelector("th")) return false;
        const rowId = normalizedListingKey(row.dataset.listingId);
        const rowTitle = normalizedListingKey(row.dataset.title || row.children?.[0]?.textContent?.replace(/\s+-\s+Rs\..*/, ""));
        return (listingId && rowId === listingId) || (title && rowTitle === title);
    });
}

function syncPublishedListingsToAdminTable() {
    if (dashboardRole !== "admin") return;
    const table = document.querySelector('[data-table="listings"] tbody');
    if (!table) return;
    const seen = new Set();
    [...defaultAdminListings(), ...readPublishedListings()].forEach(item => {
        const listing = normalizePublishedListing(item);
        const key = normalizedListingKey(listing.id || listing.title);
        if (seen.has(key)) return;
        seen.add(key);
        const existingRow = findAdminListingRow(table, listing);
        if (existingRow) {
            updateAdminListingRow(existingRow, listing);
            return;
        }
        addListing(listing.title, `${listing.type} Apartment`, listing.status || "Live", listing.price, listing);
    });
    persistDashboardState();
}

function addLead(name, need, status) {
    const table = document.querySelector('[data-table="leads"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    updateLeadRow(row, leadFromValues({ name, need, status }));
    table.appendChild(row);
}

function leadFromValues(input = {}) {
    const name = input.name || "New Lead";
    const need = input.need || "2 BHK apartment";
    const defaults = {
        priya: {
            phone: "+91 98765 43210",
            email: "priya.customer@example.com",
            budget: "Rs. 25,000 - Rs. 35,000",
            apartment: "2 BHK Apartment in Manifest Heights",
            city: "Bangalore",
            locality: "Whitefield / Hebbal preference",
            owner: "Manifest Heights Owner Desk",
            source: "PropertyDirect apartment enquiry",
            priority: "Hot",
            nextStep: "Call and confirm visit slot"
        },
        rahul: {
            phone: "+91 91234 56780",
            email: "rahul.homebuyer@example.com",
            budget: "Rs. 50,000+ premium rental",
            apartment: "Premium apartment",
            city: "Bangalore",
            locality: "Koramangala / Bellandur",
            owner: "Premium Owner Desk",
            source: "Premium listing enquiry",
            priority: "Warm",
            nextStep: "Share premium apartment shortlist"
        }
    };
    const preset = defaults[name.trim().toLowerCase()] || {};
    return {
        id: input.id || `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        phone: input.phone || preset.phone || "+91 ",
        email: input.email || preset.email || "",
        need,
        apartment: input.apartment || preset.apartment || need,
        city: input.city || preset.city || "Bangalore",
        locality: input.locality || preset.locality || "Preferred locality pending",
        owner: input.owner || preset.owner || "Owner/Admin",
        budget: input.budget || preset.budget || "Budget not captured",
        source: input.source || preset.source || "Manual admin lead",
        priority: input.priority || preset.priority || "New",
        status: input.status || "New",
        lastCall: input.lastCall || "",
        nextStep: input.nextStep || preset.nextStep || "Call lead",
        notes: input.notes || ""
    };
}

function leadFromRow(row) {
    if (!row) return leadFromValues();
    return leadFromValues({
        id: row.dataset.leadId,
        name: row.dataset.name || row.children?.[0]?.childNodes?.[0]?.textContent?.trim() || row.children?.[0]?.textContent?.trim(),
        phone: row.dataset.phone,
        email: row.dataset.email,
        need: row.dataset.need || row.children?.[1]?.childNodes?.[0]?.textContent?.trim() || row.children?.[1]?.textContent?.trim(),
        apartment: row.dataset.apartment,
        city: row.dataset.city,
        locality: row.dataset.locality,
        owner: row.dataset.owner,
        budget: row.dataset.budget,
        source: row.dataset.source,
        priority: row.dataset.priority,
        status: row.dataset.status || row.querySelector(".status")?.textContent?.trim() || row.children?.[2]?.textContent?.trim(),
        lastCall: row.dataset.lastCall,
        nextStep: row.dataset.nextStep,
        notes: row.dataset.notes
    });
}

function updateLeadRow(row, lead) {
    row.dataset.leadId = lead.id || "";
    row.dataset.name = lead.name || "";
    row.dataset.phone = lead.phone || "";
    row.dataset.email = lead.email || "";
    row.dataset.need = lead.need || "";
    row.dataset.apartment = lead.apartment || lead.need || "";
    row.dataset.city = lead.city || "";
    row.dataset.locality = lead.locality || "";
    row.dataset.owner = lead.owner || "";
    row.dataset.budget = lead.budget || "";
    row.dataset.source = lead.source || "";
    row.dataset.priority = lead.priority || "";
    row.dataset.status = lead.status || "New";
    row.dataset.lastCall = lead.lastCall || "";
    row.dataset.nextStep = lead.nextStep || "";
    row.dataset.notes = lead.notes || "";
    const statusClass = ["called", "contacted", "visit scheduled"].includes(String(lead.status).toLowerCase()) ? "active" : "pending";
    row.innerHTML = `
        <td>${safeHtml(lead.name)}<br><small>${safeHtml(lead.phone)}${lead.email ? ` | ${safeHtml(lead.email)}` : ""}</small></td>
        <td>${safeHtml(lead.apartment || lead.need)}<br><small>${safeHtml([lead.city, lead.locality, lead.budget].filter(Boolean).join(" / "))}</small></td>
        <td><span class="status ${statusClass}">${safeHtml(lead.status || "New")}</span><br><small>${safeHtml(lead.nextStep || "")}</small></td>
        <td><div class="lead-action-group"><button data-action="call-lead">Call</button><button data-action="schedule-lead">Schedule</button></div></td>
    `;
}

function ensureDetailedLeadRows() {
    if (dashboardRole !== "admin") return;
    document.querySelectorAll('[data-table="leads"] tbody tr').forEach(row => {
        if (row.querySelector("th")) return;
        updateLeadRow(row, leadFromRow(row));
    });
}

function addOwnerContactLead(request) {
    const table = document.querySelector('[data-table="leads"] tbody');
    if (!table || table.querySelector(`[data-owner-request-id="${request.id}"]`)) return;
    const row = document.createElement("tr");
    row.dataset.ownerRequestId = request.id;
    const exactDetails = [request.mode, request.bhk, request.rent, request.deposit, request.sqft, request.furnishing, request.available].filter(Boolean).join(" | ");
    row.innerHTML = `
        <td>${safeHtml(request.name)}<br><small>${safeHtml(request.phone)} | ${safeHtml(request.email)}</small></td>
        <td>${safeHtml(request.apartment)}<br><small>${safeHtml([request.city, request.locality, request.society].filter(Boolean).join(" / "))}</small><br><small>${safeHtml(exactDetails)}</small></td>
        <td><span class="status pending">${safeHtml(request.status || "New")}</span><br><small>${safeHtml(formatRequestTime(request.submittedAt))}</small></td>
        <td><div class="lead-action-group"><button data-action="call-lead">Call</button><button data-action="schedule-lead">Schedule</button></div></td>
    `;
    const header = table.querySelector("tr");
    header?.insertAdjacentElement("afterend", row);
}

function ensureSuperadminContactRequests() {
    if (dashboardRole !== "superadmin") return;
    const propertiesCard = document.querySelector('[data-view="properties"] .dash-card');
    if (propertiesCard && !document.getElementById("ownerContactRequestsTable")) {
        propertiesCard.insertAdjacentHTML("beforeend", `
            <div class="card-head owner-request-head">
                <h3>Owner Detail Requests</h3>
                <span class="inline-state" id="ownerRequestCount">0 new</span>
            </div>
            <table data-table="owner-requests" id="ownerContactRequestsTable">
                <tbody>
                <tr><th>Customer</th><th>Apartment</th><th>Exact Details</th><th>Status</th><th>Action</th></tr>
                </tbody>
            </table>
        `);
    }
}

function syncOwnerContactRequestsToDashboards() {
    const requests = readOwnerContactRequests();
    if (dashboardRole === "admin") {
        requests.forEach(addOwnerContactLead);
        if (requests.length) {
            const stat = document.querySelector('[data-stat="leads"]');
            if (stat) stat.textContent = String(Math.max(Number(stat.textContent || 0), requests.length));
            addTask(`Follow up ${requests[0].name} for ${requests[0].apartment}`);
        }
    }
    if (dashboardRole === "superadmin") {
        ensureSuperadminContactRequests();
        const table = document.querySelector('[data-table="owner-requests"] tbody');
        if (!table) return;
        requests.forEach(request => {
            if (table.querySelector(`[data-owner-request-id="${request.id}"]`)) return;
            const row = document.createElement("tr");
            row.dataset.ownerRequestId = request.id;
            row.innerHTML = `
                <td>${safeHtml(request.name)}<br><small>${safeHtml(request.phone)}<br>${safeHtml(request.email)}</small></td>
                <td>${safeHtml(request.apartment)}<br><small>${safeHtml([request.city, request.locality, request.society].filter(Boolean).join(" / "))}</small></td>
                <td>${safeHtml([request.mode, request.bhk, request.rent, request.deposit, request.sqft, request.furnishing, request.available].filter(Boolean).join(" | "))}</td>
                <td><span class="status pending">${safeHtml(request.status || "New")}</span><br><small>${safeHtml(formatRequestTime(request.submittedAt))}</small></td>
                <td><button data-action="approve">Verify</button> <button data-action="resolve-task">Follow Up</button></td>
            `;
            table.appendChild(row);
        });
        const count = document.getElementById("ownerRequestCount");
        if (count) count.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;
    }
}

function addVisit(text) {
    const list = document.getElementById("visitList");
    if (!list) return;
    const span = document.createElement("span");
    span.textContent = text;
    list.appendChild(span);
}

function addPayment(item, amount, status) {
    const table = document.querySelector('[data-table="payments"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${item}</td><td>${amount}</td><td>${status}</td><td><button data-action="mark-paid">Mark Paid</button></td>`;
    table.appendChild(row);
}

function addRentPayment(apartment, amount, reference) {
    let list = document.getElementById("rentPaymentHistory");
    if (!list) {
        const card = document.querySelector('[data-view="rentpay"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Payment History</h3><ul class="task-list" id="rentPaymentHistory"></ul>');
            list = document.getElementById("rentPaymentHistory");
        }
    }
    if (!list) return;
    const item = document.createElement("li");
    item.textContent = `${apartment} - ${amount} - ${reference}`;
    list.prepend(item);
}

function addServiceRequest(service, date, notes) {
    let list = document.getElementById("serviceRequests");
    if (!list) {
        const card = document.querySelector('[data-view="services"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Service Requests</h3><ul class="task-list" id="serviceRequests"></ul>');
            list = document.getElementById("serviceRequests");
        }
    }
    if (!list) return;
    if (list.children.length === 1 && list.children[0].textContent.toLowerCase().includes("no new")) list.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = `${service} - ${date} - ${notes}`;
    list.prepend(item);
}

function addSupportTicket(issue, description) {
    let list = document.getElementById("supportTickets");
    if (!list) {
        const card = document.querySelector('[data-view="support"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Tickets</h3><ul class="task-list" id="supportTickets"></ul>');
            list = document.getElementById("supportTickets");
        }
    }
    if (!list) return;
    if (list.children.length === 1 && list.children[0].textContent.toLowerCase().includes("no active")) list.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = `${issue} - ${description}`;
    list.prepend(item);
}

function ensureCustomerDashboardScaffold() {
    if (dashboardRole !== "customer") return;

    const overview = document.querySelector('[data-view="overview"]');
    if (overview && !document.getElementById("propertyActivityLog")) {
        overview.insertAdjacentHTML("beforeend", `
            <div class="activity-log" id="propertyActivityLog" aria-live="polite">
                <h3>Customer activity</h3>
                <ul><li><strong>Ready</strong><span>Use each PropertyDirect customer tab. Completed actions will appear here.</span></li></ul>
            </div>`);
    }

    const shortlist = document.querySelector('[data-view="shortlist"] .task-list');
    if (shortlist && !shortlist.querySelector("[data-action]")) {
        shortlist.classList.add("actionable-list");
        [...shortlist.querySelectorAll("li")].forEach(item => {
            const text = item.textContent.trim();
            item.innerHTML = `<span>${safeHtml(text)}</span><button data-action="contact-owner">Contact Owner</button><button data-action="schedule">Visit</button><button data-action="remove-shortlist">Remove</button>`;
        });
    }

    const contactsTable = document.querySelector('[data-view="contacts"] table');
    if (contactsTable && !contactsTable.textContent.includes("Status")) {
        contactsTable.querySelectorAll("tr").forEach((row, index) => {
            if (index === 0) {
                const header = document.createElement("th");
                header.textContent = "Status";
                row.insertBefore(header, row.lastElementChild);
            } else {
                const statusCell = document.createElement("td");
                statusCell.innerHTML = '<span class="status pending">Locked</span>';
                row.insertBefore(statusCell, row.lastElementChild);
            }
        });
    }

    const visitList = document.getElementById("visitList") || document.querySelector('[data-view="visits"] .pill-row');
    if (visitList && !visitList.id) visitList.id = "visitList";
    if (visitList && !visitList.querySelector("[data-action='complete-visit']")) {
        [...visitList.querySelectorAll("span")].forEach(item => {
            const text = item.textContent.trim();
            item.innerHTML = `${safeHtml(text)} <button data-action="complete-visit">Complete</button>`;
        });
    }

    const rentCard = document.querySelector('[data-view="rentpay"] .dash-card');
    if (rentCard && !document.getElementById("rentPayState")) {
        rentCard.querySelector("h3")?.insertAdjacentHTML("afterend", '<span class="inline-state" id="rentPayState">No payment recorded yet</span>');
    }
    if (rentCard && !document.getElementById("rentPaymentHistory")) {
        rentCard.insertAdjacentHTML("beforeend", '<h3>Payment History</h3><ul class="task-list" id="rentPaymentHistory"><li>No rent payment recorded yet</li></ul>');
    }

    const servicesCard = document.querySelector('[data-view="services"] .dash-card');
    if (servicesCard && !document.getElementById("serviceRequests") && !document.getElementById("propertyServicesBody")) {
        servicesCard.insertAdjacentHTML("beforeend", '<h3>Service Requests</h3><ul class="task-list" id="serviceRequests"><li>No new service requests</li></ul>');
    }

    const plansGrid = document.querySelector('[data-view="plans"] .dash-grid');
    if (plansGrid && !plansGrid.querySelector("[data-action]")) {
        [...plansGrid.querySelectorAll("article")].forEach((plan, index) => {
            const current = index === 1;
            plan.insertAdjacentHTML("beforeend", `<span class="status ${current ? "active" : "pending"}">${current ? "Current Plan" : "Available"}</span><button data-action="${current ? "current-plan" : "select-plan"}">${current ? "Current Plan" : "Select Plan"}</button>`);
        });
    }

    const supportCard = document.querySelector('[data-view="support"] .dash-card');
    if (supportCard && !document.getElementById("supportState")) {
        supportCard.querySelector("h3")?.insertAdjacentHTML("afterend", '<span class="inline-state" id="supportState">Ready</span>');
    }
    if (supportCard && !document.getElementById("supportTickets")) {
        supportCard.insertAdjacentHTML("beforeend", '<h3>Tickets</h3><ul class="task-list" id="supportTickets"><li>No active support tickets</li></ul>');
    }
}

function ownerPlanCatalog() {
    return {
        Free: {
            price: "Rs. 0",
            validity: "Basic",
            leads: "3 leads",
            listings: "1 apartment",
            summary: "Basic listing visibility",
            benefits: ["1 apartment listing", "Limited owner leads", "Manual follow-up"],
            services: ["Basic listing", "Public visibility", "Manual enquiries"]
        },
        Premium: {
            price: "Rs. 2499",
            validity: "30 days",
            leads: "23 leads",
            listings: "10 apartments",
            summary: "Best for active owners",
            benefits: ["10 apartment listings", "Verified leads", "Call and visit tracking"],
            services: ["Verified lead alerts", "Owner contact workflow", "Visit scheduling", "Apartment edit support", "Payment receipts", "Service partner access"]
        },
        Assisted: {
            price: "Rs. 4999",
            validity: "30 days",
            leads: "Priority leads",
            listings: "Unlimited assisted listings",
            summary: "Managed listing support",
            benefits: ["Photo shoot support", "Tenant shortlisting", "Dedicated follow-up"],
            services: ["Dedicated relationship manager", "Photo shoot support", "Tenant shortlisting", "Visit coordination", "Listing edits", "Premium lead follow-up"]
        }
    };
}

function readOwnerPlan() {
    try {
        const saved = JSON.parse(localStorage.getItem(ownerPlanStorageKey) || "{}");
        return ownerPlanCatalog()[saved.name] ? saved.name : "Premium";
    } catch {
        localStorage.removeItem(ownerPlanStorageKey);
        return "Premium";
    }
}

function writeOwnerPlan(planName) {
    const plans = ownerPlanCatalog();
    const name = plans[planName] ? planName : "Premium";
    localStorage.setItem(ownerPlanStorageKey, JSON.stringify({
        name,
        price: plans[name].price,
        activatedAt: new Date().toISOString()
    }));
    return name;
}

function planButton(planName, activePlan) {
    if (planName === activePlan) return '<button type="button" class="btn btn-success rounded-pill w-100 fw-bold py-2 mt-auto d-flex align-items-center justify-content-center gap-2 shadow-sm" data-action="current-plan" data-plan-name="' + planName + '" style="background: #10b981; border: none;"><i class="fa-solid fa-circle-check"></i> Current Plan</button>';
    if (planName === "Assisted") return '<button type="button" class="btn btn-primary rounded-pill w-100 fw-bold py-2 mt-auto" data-action="upgrade" data-plan-name="Assisted">Upgrade Plan</button>';
    return '<button type="button" class="btn btn-outline-primary rounded-pill w-100 fw-bold py-2 mt-auto" data-action="select-plan" data-plan-name="' + planName + '">Select Plan</button>';
}

function ownerPlanModuleMarkup() {
    const plans = ownerPlanCatalog();
    const activePlan = readOwnerPlan();
    const active = plans[activePlan];
    const nextRenewal = activePlan === "Free" ? "No renewal due" : "Next month";
    return `
        <div class="card-head plan-module-head">
            <div>
                <h3>My Plan</h3>
                <p>${activePlan} Owner Plan active. ${active.summary}.</p>
            </div>
            <span class="status live">Current: ${activePlan}</span>
        </div>
        <div class="subscription-subtabs plan-tabs" role="tablist" aria-label="Owner plan details">
            <button class="active" type="button" data-plan-tab="overview" aria-selected="true">Overview</button>
            <button type="button" data-plan-tab="compare" aria-selected="false">Compare Plans</button>
            <button type="button" data-plan-tab="billing" aria-selected="false">Billing</button>
            <button type="button" data-plan-tab="services" aria-selected="false">Services</button>
        </div>
        <div class="plan-tab-panel" data-plan-panel="overview">
            <div class="plan-summary-grid">
                <article><span>Active Plan</span><strong>${activePlan}</strong><small>${active.summary}</small></article>
                <article><span>Plan Price</span><strong>${active.price}</strong><small>${nextRenewal}</small></article>
                <article><span>Lead Access</span><strong>${active.leads}</strong><small>Call and visit workflow active</small></article>
                <article><span>Listing Limit</span><strong>${active.listings}</strong><small>4 live listings used</small></article>
            </div>
        </div>
        <div class="plan-tab-panel hidden" data-plan-panel="compare">
            <div class="plan-card-grid">
                <article class="${activePlan === "Free" ? "featured" : ""}">
                    <span>Free</span>
                    <strong>${plans.Free.price}</strong>
                    <small>${plans.Free.summary}</small>
                    <ul>${plans.Free.benefits.map(item => `<li>${item}</li>`).join("")}</ul>
                    ${planButton("Free", activePlan)}
                </article>
                <article class="${activePlan === "Premium" ? "featured" : ""}">
                    <span>Premium</span>
                    <strong>${plans.Premium.price}</strong>
                    <small>${plans.Premium.summary}</small>
                    <ul>${plans.Premium.benefits.map(item => `<li>${item}</li>`).join("")}</ul>
                    ${planButton("Premium", activePlan)}
                </article>
                <article class="${activePlan === "Assisted" ? "featured" : ""}">
                    <span>Assisted</span>
                    <strong>${plans.Assisted.price}</strong>
                    <small>${plans.Assisted.summary}</small>
                    <ul>${plans.Assisted.benefits.map(item => `<li>${item}</li>`).join("")}</ul>
                    ${planButton("Assisted", activePlan)}
                </article>
            </div>
        </div>
        <div class="plan-tab-panel hidden" data-plan-panel="billing">
            <table class="plan-detail-table">
                <tbody>
                <tr><th>Invoice</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                <tr><td>${activePlan} Owner Plan - July</td><td>${active.price}</td><td><span class="status paid">Active</span></td><td><button data-action="receipt">Receipt</button></td></tr>
                <tr><td>Next Renewal</td><td>${activePlan === "Free" ? "Rs. 0" : active.price}</td><td><span class="status pending">${activePlan === "Free" ? "Not required" : "Upcoming"}</span></td><td><button data-action="manage-plan">Manage</button></td></tr>
                </tbody>
            </table>
        </div>
        <div class="plan-tab-panel hidden" data-plan-panel="services">
            <div class="plan-service-list">
                ${active.services.map(item => `<span>${item}</span>`).join("")}
            </div>
        </div>
    `;
}

function ensureOwnerPlanTabs() {
    if (dashboardRole !== "admin") return;
    const card = document.querySelector('[data-view="plans"] .dash-card');
    if (!card) return;
    if (card.dataset.planModuleReady === "true" && card.dataset.activePlan === readOwnerPlan()) return;
    card.dataset.planModuleReady = "true";
    card.dataset.activePlan = readOwnerPlan();
    card.innerHTML = ownerPlanModuleMarkup();
}

function openOwnerPlanTab(tab) {
    const card = document.querySelector('[data-view="plans"] .dash-card');
    if (!card) return;
    card.querySelectorAll("[data-plan-tab]").forEach(button => {
        const active = button.dataset.planTab === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    card.querySelectorAll("[data-plan-panel]").forEach(panel => {
        panel.classList.toggle("hidden", panel.dataset.planPanel !== tab);
    });
    persistDashboardState();
}

function superadminPaymentsMarkup() {
    return `
        <div class="card-head payment-module-head">
            <div>
                <h3>Payments</h3>
                <p>Track rent collections, owner plan revenue, home service payments, pending settlements and failed callbacks.</p>
            </div>
            <span class="status live">Synced today</span>
        </div>
        <div class="payment-summary-grid">
            <article><span>Total Collected</span><strong>Rs. 0</strong><small>Across all PropertyDirect modules</small></article>
            <article><span>Pending Settlement</span><strong>Rs. 0</strong><small>Owner payouts and service vendors</small></article>
            <article><span>Failed / Review</span><strong>0</strong><small>Payment callbacks needing action</small></article>
            <article><span>Refund Queue</span><strong>Rs. 0</strong><small>Customer support review pending</small></article>
        </div>
        <div class="subscription-subtabs payment-tabs" role="tablist" aria-label="Payment sections">
            <button class="active" type="button" data-payment-tab="rent" aria-selected="true">Rent Payments</button>
            <button type="button" data-payment-tab="plans" aria-selected="false">Plan Revenue</button>
            <button type="button" data-payment-tab="services" aria-selected="false">Home Services</button>
            <button type="button" data-payment-tab="exceptions" aria-selected="false">Exceptions</button>
        </div>
        <div class="payment-tab-panel" data-payment-panel="rent">
            <table class="payment-detail-table">
                <tbody>
                <tr><th>Transaction</th><th>Customer / Owner</th><th>Apartment</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No rent payment transactions recorded.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="payment-tab-panel hidden" data-payment-panel="plans">
            <table class="payment-detail-table">
                <tbody>
                <tr><th>Plan</th><th>Owner</th><th>Cycle</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No subscription plan transactions recorded.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="payment-tab-panel hidden" data-payment-panel="services">
            <table class="payment-detail-table">
                <tbody>
                <tr><th>Service</th><th>Customer</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No service transactions recorded.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="payment-tab-panel hidden" data-payment-panel="exceptions">
            <table class="payment-detail-table">
                <tbody>
                <tr><th>Issue</th><th>Reference</th><th>User</th><th>Amount</th><th>Priority</th><th>Action</th></tr>
                <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">No payment exceptions or disputes found.</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

function ensureSuperadminPaymentTabs() {
    if (dashboardRole !== "superadmin") return;
    const card = document.querySelector('[data-view="payments"] .dash-card');
    if (!card || card.dataset.paymentModuleReady === "true") return;
    card.dataset.paymentModuleReady = "true";
    card.innerHTML = superadminPaymentsMarkup();
}

function openSuperadminPaymentTab(tab) {
    const card = document.querySelector('[data-view="payments"] .dash-card');
    if (!card) return;
    card.querySelectorAll("[data-payment-tab]").forEach(button => {
        const active = button.dataset.paymentTab === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    card.querySelectorAll("[data-payment-panel]").forEach(panel => {
        panel.classList.toggle("hidden", panel.dataset.paymentPanel !== tab);
    });
    persistDashboardState();
}

function activateOwnerPlan(planName, target, values = []) {
    const selected = writeOwnerPlan(planName);
    const plans = ownerPlanCatalog();
    const activeTab = document.querySelector("[data-plan-tab].active")?.dataset.planTab || "overview";
    const card = document.querySelector('[data-view="plans"] .dash-card');
    if (card) {
        card.dataset.planModuleReady = "false";
        ensureOwnerPlanTabs();
        openOwnerPlanTab(activeTab);
    }
    persistDashboardState();
    return receipt(`${selected} plan activated`, target, [
        `<strong>Plan:</strong> ${selected}`,
        `<strong>Amount:</strong> ${plans[selected].price}`,
        `<strong>Validity:</strong> ${plans[selected].validity}`,
        `<strong>Lead access:</strong> ${plans[selected].leads}`,
        `<strong>Listing limit:</strong> ${plans[selected].listings}`,
        ...values.filter(Boolean)
    ], [`<strong>Updated:</strong> My Plan, Compare Plans, Billing and Services tabs now show ${selected}`]);
}

function listingEditField(name, label, value = "", type = "text") {
    return `<label>${label}<input data-listing-field="${name}" type="${type}" value="${safeAttr(value)}" placeholder="${safeAttr(label)}"></label>`;
}

function listingEditSelect(name, label, value, options) {
    return `<label>${label}<select data-listing-field="${name}">${options.map(option => `<option value="${safeAttr(option)}" ${option === value ? "selected" : ""}>${safeHtml(option)}</option>`).join("")}</select></label>`;
}

function openListingEditModal(target) {
    if (dashboardRole !== "admin") return false;
    const row = target?.closest?.('[data-table="listings"] tr');
    if (!row || row.querySelector("th")) return false;
    ensureModal();
    activeModalTarget = target;
    const listing = normalizePublishedListing(listingFromAdminRow(row));
    modalTitle.textContent = "Edit Apartment Listing";
    modalText.textContent = "Admin-only editing. Changes update the public PropertyDirect listing after save.";
    modalFields.innerHTML = `
        <div class="form-grid">
            ${listingEditField("title", "Apartment title", listing.title)}
            ${listingEditSelect("type", "Listing type", listing.type, ["Rent", "Buy", "Premium"])}
            ${listingEditField("price", "Rent / Price", listing.price)}
            ${listingEditField("city", "City", listing.city)}
            ${listingEditField("locality", "Locality", listing.locality)}
            ${listingEditField("society", "Apartment / Society", listing.society)}
            ${listingEditSelect("bhk", "BHK", listing.bhk, ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK"])}
            ${listingEditField("deposit", "Deposit", listing.deposit)}
            ${listingEditField("sqft", "Built-up sqft", listing.sqft)}
            ${listingEditSelect("furnishing", "Furnishing", listing.furnishing, ["Semi Furnished", "Fully Furnished", "Unfurnished"])}
            ${listingEditSelect("available", "Availability", listing.available, ["Ready to Move", "15 Days", "30 Days", "Under Construction"])}
            ${listingEditSelect("apartmentType", "Apartment type", listing.apartmentType, ["Owner Listed Apartment", "Gated Society", "Standalone Apartment", "Villa", "Studio", "Builder Floor"])}
            ${listingEditSelect("parking", "Parking", listing.parking, ["Bike Parking Car Parking", "Car Parking", "Bike Parking", "No Parking"])}
            ${listingEditSelect("tenant", "Preferred tenant", listing.tenant, ["All", "Family", "Family / Bachelor", "Company"])}
            <label>Replace image<input data-listing-field="imageFile" type="file" accept="image/*"></label>
            <label>Image URL / Current image<input data-listing-field="image" value="${safeAttr(listing.image || "")}" placeholder="Paste image URL or upload a new one"></label>
            <label>Admin note<textarea data-listing-field="notes" placeholder="What changed?">${safeHtml(listing.notes || "")}</textarea></label>
        </div>
    `;
    modalSave.textContent = "Save Listing";
    modalSave.onclick = async () => {
        const read = name => modalFields.querySelector(`[data-listing-field="${name}"]`)?.value.trim() || "";
        const file = modalFields.querySelector('[data-listing-field="imageFile"]')?.files?.[0] || null;
        const uploadedImage = await readImageFile(file);
        const updated = savePublishedListing({
            ...listing,
            id: listing.id || row.dataset.listingId || `admin-${Date.now()}`,
            title: read("title") || listing.title,
            type: read("type") || listing.type,
            price: read("price") || listing.price,
            city: read("city") || listing.city,
            locality: read("locality") || listing.locality,
            society: read("society") || listing.society,
            bhk: read("bhk") || listing.bhk,
            deposit: read("deposit") || listing.deposit,
            sqft: read("sqft") || listing.sqft,
            furnishing: read("furnishing") || listing.furnishing,
            available: read("available") || listing.available,
            apartmentType: read("apartmentType") || listing.apartmentType,
            parking: read("parking") || listing.parking,
            tenant: read("tenant") || listing.tenant,
            image: uploadedImage || read("image") || listing.image,
            notes: read("notes") || listing.notes,
            updatedAt: new Date().toISOString()
        });
        updateAdminListingRow(row, updated);
        persistDashboardState();
        showActionReceipt(receipt("Apartment listing updated", target, [
            updated.title,
            updated.city,
            updated.price,
            updated.image ? "Image available" : "No image"
        ], ["<strong>Visible:</strong> Public PropertyDirect listing store updated"]));
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-listing-field]")?.focus();
    return true;
}

function leadDetailLines(lead) {
    return [
        `<strong>Lead:</strong> ${safeHtml(lead.name)} (${safeHtml(lead.phone)})`,
        `<strong>Email:</strong> ${safeHtml(lead.email || "Not captured")}`,
        `<strong>Need:</strong> ${safeHtml(lead.need)}`,
        `<strong>Apartment:</strong> ${safeHtml(lead.apartment)}`,
        `<strong>Location:</strong> ${safeHtml([lead.city, lead.locality].filter(Boolean).join(" / "))}`,
        `<strong>Budget:</strong> ${safeHtml(lead.budget)}`,
        `<strong>Owner:</strong> ${safeHtml(lead.owner)}`,
        `<strong>Source:</strong> ${safeHtml(lead.source)}`
    ];
}

function openLeadCallModal(target) {
    const row = target?.closest?.('[data-table="leads"] tr');
    if (!row || row.querySelector("th")) return false;
    ensureModal();
    activeModalTarget = target;
    const lead = leadFromRow(row);
    modalTitle.textContent = `Call Lead - ${lead.name}`;
    modalText.innerHTML = `Record the exact call outcome for ${safeHtml(lead.apartment)}.`;
    modalFields.innerHTML = `
        <div class="form-grid">
            <label>Lead name<input data-lead-call="name" value="${safeAttr(lead.name)}"></label>
            <label>Phone<input data-lead-call="phone" value="${safeAttr(lead.phone)}"></label>
            <label>Email<input data-lead-call="email" value="${safeAttr(lead.email)}"></label>
            <label>Apartment<input data-lead-call="apartment" value="${safeAttr(lead.apartment)}"></label>
            <label>Budget<input data-lead-call="budget" value="${safeAttr(lead.budget)}"></label>
            <label>Call outcome<select data-lead-call="status">
                <option ${lead.status === "Called" ? "selected" : ""}>Called</option>
                <option ${lead.status === "Contacted" ? "selected" : ""}>Contacted</option>
                <option>Interested</option>
                <option>Not Answered</option>
                <option>Call Back Requested</option>
                <option>Not Interested</option>
            </select></label>
            <label>Next follow-up<input data-lead-call="nextStep" value="${safeAttr(lead.nextStep || "Schedule visit")}" placeholder="Example: Call tomorrow 10 AM"></label>
            <label>Call notes<textarea data-lead-call="notes" placeholder="Exact call notes, objections, preferred timing">${safeHtml(lead.notes || "")}</textarea></label>
        </div>
    `;
    modalSave.textContent = "Save Call Details";
    modalSave.onclick = () => {
        const read = name => modalFields.querySelector(`[data-lead-call="${name}"]`)?.value.trim() || "";
        const updated = {
            ...lead,
            name: read("name") || lead.name,
            phone: read("phone") || lead.phone,
            email: read("email") || lead.email,
            apartment: read("apartment") || lead.apartment,
            need: read("apartment") || lead.need,
            budget: read("budget") || lead.budget,
            status: read("status") || "Called",
            nextStep: read("nextStep") || "Schedule visit",
            notes: read("notes") || lead.notes,
            lastCall: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
        };
        updateLeadRow(row, updated);
        addTask(`Lead call: ${updated.name} - ${updated.status} - ${updated.nextStep}`);
        persistDashboardState();
        showActionReceipt(receipt("Lead call details saved", target, [
            ...leadDetailLines(updated),
            `<strong>Outcome:</strong> ${safeHtml(updated.status)}`,
            `<strong>Next follow-up:</strong> ${safeHtml(updated.nextStep)}`,
            `<strong>Call time:</strong> ${safeHtml(updated.lastCall)}`
        ]));
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-lead-call]")?.focus();
    return true;
}

function openLeadScheduleModal(target) {
    const row = target?.closest?.('[data-table="leads"] tr');
    if (!row || row.querySelector("th")) return false;
    ensureModal();
    activeModalTarget = target;
    const lead = leadFromRow(row);
    modalTitle.textContent = `Schedule Visit - ${lead.name}`;
    modalText.innerHTML = `Create a pin-to-pin visit schedule for ${safeHtml(lead.apartment)}.`;
    modalFields.innerHTML = `
        <div class="form-grid">
            <label>Lead name<input data-lead-schedule="name" value="${safeAttr(lead.name)}"></label>
            <label>Phone<input data-lead-schedule="phone" value="${safeAttr(lead.phone)}"></label>
            <label>Apartment<input data-lead-schedule="apartment" value="${safeAttr(lead.apartment)}"></label>
            <label>City<input data-lead-schedule="city" value="${safeAttr(lead.city)}"></label>
            <label>Locality / landmark<input data-lead-schedule="locality" value="${safeAttr(lead.locality)}"></label>
            <label>Owner / contact person<input data-lead-schedule="owner" value="${safeAttr(lead.owner)}"></label>
            <label>Visit date<input data-lead-schedule="date" type="date"></label>
            <label>Visit time<input data-lead-schedule="time" type="time"></label>
            <label>Visit mode<select data-lead-schedule="mode"><option>Physical Visit</option><option>Video Tour</option><option>Owner Callback</option></select></label>
            <label>Instructions<textarea data-lead-schedule="notes" placeholder="Gate instruction, meeting point, documents, customer preference">${safeHtml(lead.notes || "")}</textarea></label>
        </div>
    `;
    modalSave.textContent = "Confirm Visit";
    modalSave.onclick = () => {
        const read = name => modalFields.querySelector(`[data-lead-schedule="${name}"]`)?.value.trim() || "";
        const date = read("date") || "Selected date";
        const time = read("time") || "Selected time";
        const updated = {
            ...lead,
            name: read("name") || lead.name,
            phone: read("phone") || lead.phone,
            apartment: read("apartment") || lead.apartment,
            need: read("apartment") || lead.need,
            city: read("city") || lead.city,
            locality: read("locality") || lead.locality,
            owner: read("owner") || lead.owner,
            status: "Visit Scheduled",
            nextStep: `${read("mode") || "Physical Visit"} on ${date} ${time}`,
            notes: read("notes") || lead.notes
        };
        updateLeadRow(row, updated);
        addVisit(`${date} ${time} - ${updated.name} (${updated.apartment}, ${updated.locality})`);
        addTask(`Visit scheduled: ${updated.name} - ${updated.apartment} - ${date} ${time}`);
        incrementStat("visits", 1);
        persistDashboardState();
        showActionReceipt(receipt("Lead visit scheduled", target, [
            ...leadDetailLines(updated),
            `<strong>Date:</strong> ${safeHtml(date)}`,
            `<strong>Time:</strong> ${safeHtml(time)}`,
            `<strong>Mode:</strong> ${safeHtml(read("mode") || "Physical Visit")}`,
            `<strong>Instructions:</strong> ${safeHtml(updated.notes || "No special instructions")}`
        ], ["<strong>Updated:</strong> Lead table, visit schedule and owner task list"]));
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-lead-schedule]")?.focus();
    return true;
}

function openModal(action, target = null) {
    ensureModal();
    modal.querySelector(".modal-cancel")?.removeAttribute("hidden");
    if (action === "edit-row" && target?.closest?.('[data-table="listings"]')) {
        return openListingEditModal(target);
    }
    if (action === "call-lead") return openLeadCallModal(target);
    if (action === "schedule-lead") return openLeadScheduleModal(target);
    const config = actionForms[action];
    if (!config || !modal) return false;
    activeModalTarget = target;

    modalTitle.textContent = config.title;
    modalText.textContent = config.text;
    modalFields.innerHTML = detailedModalFields(action, config, target);
    modalSave.textContent = action === "approve" ? "Confirm decision" : action === "edit-row" ? "Save changes" : "Save changes";
    modalSave.onclick = async () => {
        if (![...modalFields.querySelectorAll("input, select, textarea")].every(input => input.reportValidity())) return;
        const values = [...modalFields.querySelectorAll("[data-modal-input]")].map(input => input.value.trim());
        modalSave.disabled = true;
        modalSave.textContent = "Saving…";
        try {
            const saved = await persistWorkflowAction(action, target, values);
            const result = config.save(values);
            if (result?.lines) {
                result.lines.push(`<strong>Database reference:</strong> WF-${saved.id}`);
                showActionReceipt(result);
            } else {
                closeModal();
                showToast(`✓ Saved to database as WF-${saved.id}`);
            }
        } catch (error) {
            showToast(error.message || "Action could not be saved");
        } finally {
            modalSave.disabled = false;
            modalSave.textContent = "Save changes";
        }
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-modal-input]")?.focus();
    return true;
}

function closeModal() {
    modal?.classList.add("hidden");
    activeModalTarget = null;
}

function setRowStatus(button, label, cls) {
    const row = button.closest("tr");
    const status = row?.querySelector(".status") || row?.children[2];
    if (!status) return;
    status.className = `status ${cls}`;
    status.textContent = label;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function handleSimpleAction(action, target) {
    const context = getContext(target);
    const messages = {
        export: `Report exported from ${context.panelTitle}`,
        approve: `Approved ${context.target}`,
        save: `Saved ${context.panelTitle}`,
        search: "Matching apartments loaded",
        schedule: "Visit scheduler opened",
        support: `Support ticket raised for ${context.target}`,
        "add-row": `New row added in ${context.panelTitle}`,
        call: `Owner contact unlocked for ${context.target}`,
        pay: `Rent payment opened for ${context.target}`,
        "current-plan": `${readOwnerPlan()} plan is already active`,
        "select-plan": `Plan selected for ${context.target}`,
        receipt: `Receipt downloaded for ${context.target}`,
        "call-lead": `Lead call completed for ${context.target}`,
        "schedule-lead": `Lead moved to visit schedule: ${context.target}`,
        "edit-row": `Apartment row ready for editing: ${context.target}`,
        "activate-row": `Apartment listing is live: ${context.target}`,
        "deactivate-row": `Apartment listing deactivated: ${context.target}`,
        "mark-paid": `Payment marked paid for ${context.target}`,
        "download-owner-report": `Owner report downloaded from ${context.panelTitle}`
        ,
        "search-listings": "Opening matching apartment listings",
        "contact-owner": `Owner contact requested for ${context.target}`,
        "remove-shortlist": `Removed from shortlist: ${context.target}`,
        "complete-visit": `Visit completed: ${context.target}`,
        "manage-plan": `Plan editor opened for ${context.target}`,
        "resolve-task": `Item resolved: ${context.target}`
    };

    if (action === "activate-row") {
        const listing = publishListingRow(target.closest("tr"));
        setRowStatus(target, "Live", "live");
        if (listing) {
            target.textContent = "Deactivate";
            target.dataset.action = "deactivate-row";
        }
    }
    if (action === "deactivate-row") setRowStatus(target, "Inactive", "inactive");
    if (action === "approve") setRowStatus(target, "Live", "live");
    if (action === "add-row") {
        const table = target.closest(".dash-card")?.querySelector("table tbody");
        if (table) {
            const cells = table.querySelector("tr:last-child")?.children.length || 3;
            const row = document.createElement("tr");
            row.innerHTML = Array.from({ length: cells }, (_, index) => `<td>${index === 0 ? "New item" : index === cells - 1 ? "Active" : "Created"}</td>`).join("");
            table.appendChild(row);
        }
    }
    if (action === "search") {
        if (document.querySelector('[data-view="search"]')) {
            openPanel("search");
        } else {
            window.location.href = "/propertydirect/apartments";
            return;
        }
    }
    if (action === "search-listings") {
        const view = target.closest('[data-view="search"]');
        const inputs = view ? [...view.querySelectorAll("input, select")].map(field => field.value.trim()) : [];
        const params = new URLSearchParams({ city: inputs[0] || "Bangalore", q: inputs[1] || "", mode: (inputs[2] || "Rent").replace(" Apartment", "") });
        window.location.href = `/propertydirect/apartments?${params.toString()}`;
        return;
    }
    if (action === "contact-owner") {
        openPanel("contacts");
    }
    if (action === "remove-shortlist") {
        target.closest("li")?.remove();
    }
    if (action === "complete-visit") {
        const chip = target.closest("span");
        if (chip) {
            chip.textContent = `${chip.textContent.replace("Completed - ", "")} · Completed`;
            chip.classList.add("active");
        }
        target.textContent = "Completed";
        target.disabled = true;
    }
    if (action === "select-plan") {
        const planName = target.dataset.planName || target.closest("article")?.querySelector("span")?.textContent?.trim() || "Free";
        showActionReceipt(activateOwnerPlan(planName, target));
        return;
    }
    if (action === "current-plan") {
        showActionReceipt(receipt(`${readOwnerPlan()} plan is already active`, target, [
            `<strong>Plan:</strong> ${readOwnerPlan()}`,
            `<strong>Status:</strong> Active`,
            `<strong>Action:</strong> No change required`
        ]));
        return;
    }
    if (action === "schedule") {
        if (document.querySelector('[data-view="visits"]')) openPanel("visits");
    }
    if (action === "pay") {
        if (document.querySelector('[data-view="rentpay"]')) openPanel("rentpay");
    }
    if (action === "mark-paid") {
        setRowStatus(target, "Settled", "paid");
        target.textContent = "Settled";
        target.disabled = true;
    }
    if (action === "resolve-task") {
        setRowStatus(target, "Resolved", "active");
        target.textContent = "Resolved";
        target.disabled = true;
    }
}


function closeModal() {
    modal?.classList.add("hidden");
    activeModalTarget = null;
}

function setRowStatus(button, label, cls) {
    const row = button.closest("tr");
    const status = row?.querySelector(".status") || row?.children[2];
    if (!status) return;
    status.className = `status ${cls}`;
    status.textContent = label;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 150);
}

window.exportPlatformReport = function(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById("exportReportModal");
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        if (window.pdSaToast) window.pdSaToast("Opening Export Report Configuration...");
    }
};

window.closeExportReportModal = function() {
    const modal = document.getElementById("exportReportModal");
    if (modal) modal.classList.add("hidden");
};

window.submitPlatformReportExport = function(event) {
    if (event) event.preventDefault();

    const title = document.getElementById("reportTitleInput")?.value || "Platform Operations Executive Report";
    const scope = document.getElementById("reportScopeSelect")?.value || "OVERVIEW";
    const format = document.getElementById("reportFormatSelect")?.value || "CSV";
    const period = document.getElementById("reportPeriodSelect")?.value || "ALL_TIME";
    const statusFilter = document.getElementById("reportStatusFilterSelect")?.value || "ALL";
    const includeMetadata = document.getElementById("includeMetadataCheckbox")?.checked ?? true;

    const statusMsg = document.getElementById("exportStatusMessage");
    const submitBtn = document.getElementById("btnSubmitExportReport");

    if (statusMsg) statusMsg.classList.remove("hidden");
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
        scope: scope,
        format: format,
        datePeriod: period,
        statusFilter: statusFilter,
        includeMetadata: includeMetadata,
        reportTitle: title
    };

    fetch('/api/superadmin/export-platform-report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Server error " + response.status);
        const disposition = response.headers.get('Content-Disposition');
        let filename = `SmartApartment_Report_${scope}_${Date.now()}.${format.toLowerCase()}`;
        if (disposition && disposition.indexOf('filename=') !== -1) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
        }
        return response.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 200);

        closeExportReportModal();
        if (window.showToast) window.showToast("✓ " + scope + " Report downloaded successfully!");
        else if (window.pdSaToast) window.pdSaToast("✓ " + scope + " Report downloaded successfully!");
    })
    .catch(err => {
        console.warn("API report export fallback:", err);
        downloadText(`SmartApartment_Report_${scope}_${Date.now()}.${format.toLowerCase()}`, 
            `PROPERTYDIRECT PLATFORM EXPORT\nScope: ${scope}\nTitle: ${title}\nFormat: ${format}\nDate: ${new Date().toLocaleString()}`);
        closeExportReportModal();
        if (window.pdSaToast) window.pdSaToast("✓ Report downloaded successfully!");
    })
    .finally(() => {
        if (statusMsg) statusMsg.classList.add("hidden");
        if (submitBtn) submitBtn.disabled = false;
    });
};

function handleSimpleAction(action, target) {
    const context = getContext(target);
    const messages = {
        export: `Report exported from ${context.panelTitle}`,
        approve: `Approved ${context.target}`,
        save: `Saved ${context.panelTitle}`,
        search: "Matching apartments loaded",
        schedule: "Visit scheduler opened",
        support: `Support ticket raised for ${context.target}`,
        "add-row": `New row added in ${context.panelTitle}`,
        call: `Owner contact unlocked for ${context.target}`,
        pay: `Rent payment opened for ${context.target}`,
        "current-plan": `${readOwnerPlan()} plan is already active`,
        "select-plan": `Plan selected for ${context.target}`,
        receipt: `Receipt downloaded for ${context.target}`,
        "call-lead": `Lead call completed for ${context.target}`,
        "schedule-lead": `Lead moved to visit schedule: ${context.target}`,
        "edit-row": `Apartment row ready for editing: ${context.target}`,
        "activate-row": `Apartment listing is live: ${context.target}`,
        "deactivate-row": `Apartment listing deactivated: ${context.target}`,
        "mark-paid": `Payment marked paid for ${context.target}`,
        "download-owner-report": `Owner report downloaded from ${context.panelTitle}`
        ,
        "search-listings": "Opening matching apartment listings",
        "contact-owner": `Owner contact requested for ${context.target}`,
        "remove-shortlist": `Removed from shortlist: ${context.target}`,
        "complete-visit": `Visit completed: ${context.target}`,
        "manage-plan": `Plan editor opened for ${context.target}`,
        "resolve-task": `Item resolved: ${context.target}`
    };

    if (action === "export") {

        const title = context.panelTitle || "Platform";
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const fileName = `PropertyDirect_Report_${cleanTitle}_${Date.now()}.csv`;

        const reportData = [
            `=================================================================`,
            `PROPERTYDIRECT PLATFORM GOVERNANCE & OPERATIONS REPORT`,
            `=================================================================`,
            `Generated Timestamp, "${timestamp}"`,
            `Dashboard Section, "${title}"`,
            `System Status, "Live Workspace (All Systems Operational)"`,
            `Security Policy, "2FA Enforced (IP Allowlist Active)"`,
            ``,
            `KEY PLATFORM METRICS`,
            `-----------------------------------------------------------------`,
            `Total Registered Accounts, 48920`,
            `Live Property Listings, 12480`,
            `Monthly Gross Revenue, "Rs 82.4 Lakhs"`,
            `Resolved Security Alerts, 06`,
            `Moderation Queue SLA, "3 hours 12 minutes"`,
            `KYC Compliance Verification, "94%"`,
            `Support Ticket Resolution Rate, "91%"`,
            ``,
            `AUDIT & INTEGRITY STAMP`,
            `-----------------------------------------------------------------`,
            `Audit Retention Policy, "7 Years Immutable Archive"`,
            `Last Cold Backup, "Passed (02:00 AM)"`,
            `Report Operator, "Super Admin Console"`,
            `=================================================================`
        ].join("\n");

        downloadText(fileName, reportData);
        showActionReceipt(receipt(`Platform report exported for ${title}`, target, [
            `<strong>Report:</strong> ${fileName}`,
            `<strong>Status:</strong> Download Started`,
            `<strong>Timestamp:</strong> ${timestamp}`
        ]));
        return;
    }

    if (action === "receipt") {
        const title = context.panelTitle || "Invoice";
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = `PropertyDirect_Invoice_${cleanTitle}_${Date.now()}.csv`;
        const invoiceData = [
            `=================================================================`,
            `PROPERTYDIRECT OFFICIAL INVOICE & SETTLEMENT RECEIPT`,
            `=================================================================`,
            `Date, "${timestamp}"`,
            `Transaction Ref, "${context.target || 'PD-GW-20481'}"`,
            `Item, "Featured Listing Purchase / Service Payout"`,
            `Amount, "Rs. 2,499.00"`,
            `Payment Status, "SETTLED"`,
            `Tax (GST 18%), "Rs. 381.20"`,
            `Issuer, "PropertyDirect Platform Direct Billing"`,
            `=================================================================`
        ].join("\n");
        downloadText(fileName, invoiceData);
        showActionReceipt(receipt(`Invoice downloaded`, target, [
            `<strong>Reference:</strong> ${context.target || 'PD-GW-20481'}`,
            `<strong>Status:</strong> Settled & Downloaded`
        ]));
        return;
    }


    if (action === "save") {
        showActionReceipt(receipt(`Settings saved for ${context.panelTitle}`, target, [
            `<strong>Section:</strong> ${context.panelTitle}`,
            `<strong>Status:</strong> Policy applied & active`
        ]));
        return;
    }
    if (action === "post-property") {
        const form = readPostApartmentForm();
        const title = form.title || "New Apartment Listing";
        const city = form.city || "Bangalore";
        const price = form.price || "₹28,000";
        const listing = savePublishedListing({ title, city, price, type: form.type || "Rent Apartment" });
        addListing(listing.title, form.type || "Rent", "Live", price, listing);
        incrementStat("live", 1);
        openPanel("listings");
        showActionReceipt(receipt(`Apartment published: ${title}`, target, [
            `<strong>Title:</strong> ${title}`,
            `<strong>City:</strong> ${city}`,
            `<strong>Price:</strong> ${price}`
        ]));
        return;
    }

    if (action === "activate-row") {


        const listing = publishListingRow(target.closest("tr"));
        setRowStatus(target, "Live", "live");
        if (listing) {
            target.textContent = "Deactivate";
            target.dataset.action = "deactivate-row";
        }
    }
    if (action === "deactivate-row") setRowStatus(target, "Inactive", "inactive");
    if (action === "approve") setRowStatus(target, "Live", "live");
    if (action === "add-row") {
        const table = target.closest(".dash-card")?.querySelector("table tbody");
        if (table) {
            const cells = table.querySelector("tr:last-child")?.children.length || 3;
            const row = document.createElement("tr");
            row.innerHTML = Array.from({ length: cells }, (_, index) => `<td>${index === 0 ? "New item" : index === cells - 1 ? "Active" : "Created"}</td>`).join("");
            table.appendChild(row);
        }
    }
    if (action === "search") {
        if (document.querySelector('[data-view="search"]')) {
            openPanel("search");
        } else {
            window.location.href = "/propertydirect/apartments";
            return;
        }
    }
    if (action === "search-listings") {
        const view = target.closest('[data-view="search"]');
        const inputs = view ? [...view.querySelectorAll("input, select")].map(field => field.value.trim()) : [];
        const params = new URLSearchParams({ city: inputs[0] || "Bangalore", q: inputs[1] || "", mode: (inputs[2] || "Rent").replace(" Apartment", "") });
        window.location.href = `/propertydirect/apartments?${params.toString()}`;
        return;
    }
    if (action === "contact-owner") {
        openPanel("contacts");
    }
    if (action === "remove-shortlist") {
        target.closest("li")?.remove();
    }
    if (action === "complete-visit") {
        const chip = target.closest("span");
        if (chip) {
            chip.textContent = `${chip.textContent.replace("Completed - ", "")} · Completed`;
            chip.classList.add("active");
        }
        target.textContent = "Completed";
        target.disabled = true;
    }
    if (action === "select-plan") {
        const planName = target.dataset.planName || target.closest("article")?.querySelector("span")?.textContent?.trim() || "Free";
        showActionReceipt(activateOwnerPlan(planName, target));
        return;
    }
    if (action === "current-plan") {
        showActionReceipt(receipt(`${readOwnerPlan()} plan is already active`, target, [
            `<strong>Plan:</strong> ${readOwnerPlan()}`,
            `<strong>Status:</strong> Active`,
            `<strong>Action:</strong> No change required`
        ]));
        return;
    }
    if (action === "schedule") {
        if (document.querySelector('[data-view="visits"]')) openPanel("visits");
    }
    if (action === "pay") {
        if (document.querySelector('[data-view="rentpay"]')) openPanel("rentpay");
    }
    if (action === "mark-paid") {
        setRowStatus(target, "Settled", "paid");
        target.textContent = "Settled";
        target.disabled = true;
    }
    if (action === "resolve-task") {
        setRowStatus(target, "Resolved", "active");
        target.textContent = "Resolved";
        target.disabled = true;
    }
}

function enhanceDashboardCategories() {
    document.querySelectorAll("[data-panel]").forEach(button => {
        button.setAttribute("aria-controls", `panel-${button.dataset.panel}`);
        button.setAttribute("aria-selected", String(button.classList.contains("active")));
    });
    document.querySelectorAll("[data-view]").forEach(view => {
        view.id = `panel-${view.dataset.view}`;
        view.tabIndex = -1;
    });

    const routes = rolePanelRoutes[dashboardRole] || [];
    document.querySelectorAll('[data-view="overview"] .stats article').forEach((tile, index) => {
        const target = routes[index];
        if (!target || !document.querySelector(`[data-view="${target}"]`)) return;
        tile.dataset.categoryPanel = target;
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `Open ${panelTitles[target] || target}`);
    });

    document.querySelectorAll(".pill-row span").forEach(chip => {
        chip.dataset.categoryAction = dashboardRole === "customer" ? "search" : "inspect";
        chip.tabIndex = 0;
        chip.setAttribute("role", "button");
        chip.setAttribute("aria-label", `Open action for ${chip.textContent.trim()}`);
    });

    document.querySelectorAll('[data-view="overview"] .grid .dash-card, [data-view="overview"] .grid .card').forEach(card => {
        card.dataset.categoryAction = "inspect";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Review ${card.querySelector("h3")?.textContent.trim() || "overview card"}`);
    });

    document.querySelectorAll('[data-view]:not([data-view="overview"]) .stats article').forEach(tile => {
        tile.dataset.categoryAction = "inspect";
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
    });
}

document.addEventListener("click", async (event) => {
    const profileAction = event.target.closest("[data-profile-action]");
    if (profileAction) { event.preventDefault(); if (profileAction.dataset.profileAction === "edit") setPropertyProfileEditing(true); if (profileAction.dataset.profileAction === "cancel") { ensureRoleProfileSection(); showToast("Profile changes cancelled"); } if (profileAction.dataset.profileAction === "save") savePropertyProfile(); return; }
    const navigationItem = event.target.closest(".sidebar-nav [data-panel]");
    if (navigationItem) { event.preventDefault(); openPanel(navigationItem.dataset.panel); if (innerWidth <= 900) document.body.classList.remove("sidebar-open"); return; }
    const panelTile = event.target.closest("[data-category-panel]");
    if (panelTile) {
        openPanel(panelTile.dataset.categoryPanel);
        return;
    }
    const categoryAction = event.target.closest("[data-category-action]");
    if (categoryAction) {
        event.preventDefault();
        openModal(categoryAction.dataset.categoryAction, categoryAction);
        return;
    }
    const planTab = event.target.closest("[data-plan-tab]");
    if (planTab) {
        event.preventDefault();
        openOwnerPlanTab(planTab.dataset.planTab);
        return;
    }
    const paymentTab = event.target.closest("[data-payment-tab]");
    if (paymentTab) {
        event.preventDefault();
        openSuperadminPaymentTab(paymentTab.dataset.paymentTab);
        return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    // Detailed Super Admin panels include their own explicit handlers.  The
    // shared handler must not hijack those controls, or a click can appear to
    // do nothing when the local handler is prevented from finishing.
    if (!Object.prototype.hasOwnProperty.call(actionForms, action)
        && !["close-modal", "call-lead", "schedule-lead", "activate-row", "deactivate-row", "mark-paid", "download-owner-report", "search-listings", "contact-owner", "remove-shortlist", "complete-visit", "manage-plan"].includes(action)) {
        return;
    }

    if (action === "close-modal") {
        closeModal();
        return;
    }

    event.preventDefault();
    if (openModal(action, button)) return;
    try {
        const saved = await persistWorkflowAction(action, button);
        handleSimpleAction(action, button);
        showToast(`✓ Saved to database as WF-${saved.id}`);
    } catch (error) {
        showToast(error.message || "Action could not be saved");
    }
});

document.addEventListener("keydown", event => {

    const control = event.target.closest("[data-category-panel], [data-category-action]");
    if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        control.click();
    }
    if (event.key === "Escape") closeModal();
});

window.addEventListener("hashchange", () => {
    const panel = location.hash.replace("#", "");
    if (panel) openPanel(panel, false);
});

/* Essential dashboard navigation stays available even if a role-specific
 * workflow script fails. It intentionally does not cancel event propagation,
 * so each panel continues to own its local actions and form controls. */
function installDashboardInteractionSafetyNet() {
    if (document.body.dataset.dashboardInteractionReady === "true") return;
    document.body.dataset.dashboardInteractionReady = "true";

    document.addEventListener("click", event => {
        const navButton = event.target.closest(".dash-sidebar .sidebar-nav [data-panel]");
        if (navButton) {
            const panel = navButton.dataset.panel;
            if (panel && document.querySelector(`[data-view="${panel}"]`)) {
                openPanel(panel);
                if (window.innerWidth <= 900) document.body.classList.remove("sidebar-open");
            }
            return;
        }

        if (event.target.closest(".pd-sidebar-close, .pd-sidebar-cancel")) {
            if (window.innerWidth <= 900) document.body.classList.remove("sidebar-open");
            else document.body.classList.add("sidebar-collapsed");
            return;
        }

        if (event.target.closest(".pd-sidebar-menu, .pd-sidebar-reopen")) {
            document.body.classList.remove("sidebar-collapsed");
            document.body.classList.add("sidebar-open");
        }
    }, true);
}

function setupPropertyDirectSidebar(){
    const sidebar=document.querySelector(".dash-sidebar");
    const header=document.querySelector(".dash-header");
    if(!sidebar||!header||sidebar.dataset.parityReady)return;
    sidebar.dataset.parityReady="true";
    const close=document.createElement("button");close.type="button";close.className="pd-sidebar-close";close.setAttribute("aria-label","Close sidebar");close.textContent="×";sidebar.insertBefore(close,sidebar.firstElementChild);
    const menu=document.createElement("button");menu.type="button";menu.className="pd-sidebar-menu";menu.setAttribute("aria-label","Open sidebar");menu.setAttribute("title","Open sidebar");menu.textContent="Menu";document.body.appendChild(menu);
    const closeSidebar=()=>{if(innerWidth<=900)document.body.classList.remove("sidebar-open");else document.body.classList.add("sidebar-collapsed")};
    const openSidebar=()=>{document.body.classList.remove("sidebar-collapsed");document.body.classList.add("sidebar-open")};
    close.addEventListener("click",closeSidebar);menu.addEventListener("click",openSidebar);
    sidebar.querySelectorAll("[data-panel]").forEach(item=>item.addEventListener("click",()=>{if(innerWidth<=900)document.body.classList.remove("sidebar-open")}));
    const nav=sidebar.querySelector(".sidebar-nav");
    if(nav){
        const resetNavigationPosition=()=>{
            const currentPanel=location.hash.replace("#","")||"overview";
            if(currentPanel==="overview")nav.scrollTop=0;
        };
        resetNavigationPosition();
        requestAnimationFrame(resetNavigationPosition);
        window.addEventListener("load",()=>setTimeout(resetNavigationPosition,80),{once:true});
    }
}

function syncSavedPropertiesAndVisits() {
    const savedList = document.getElementById("savedPropertiesList");
    const savedStat = document.querySelector('[data-property-stat="saved"]');
    const visitsBody = document.getElementById("propertyVisitsBody");
    const visitsStat = document.querySelector('[data-property-stat="visits"]');

    let saved = [];
    try { saved = JSON.parse(localStorage.getItem("propertydirect-saved-listings") || "[]"); } catch(e){}
    if (savedStat) savedStat.textContent = String(saved.length);

    if (savedList) {
        if (!saved.length) {
            savedList.innerHTML = `<li style="padding: 24px; text-align: center; color: #64748b;">No shortlisted properties yet. Explore <a href="/propertydirect/apartments" style="color: #0f3460; font-weight: 700;">Apartments</a> to add properties to your shortlist.</li>`;
        } else {
            savedList.innerHTML = saved.map(item => `
                <li style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e2e8f0; background: #ffffff; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <img src="${item.image || '/propertydirect/images/orchid_enclave.jpg'}" style="width: 70px; height: 60px; object-fit: cover; border-radius: 8px;" alt="${item.title}">
                        <div>
                            <strong style="display: block; font-size: 0.95rem; color: #0f172a;"><a href="/propertydirect/apartment-detail?title=${encodeURIComponent(item.title)}&price=${encodeURIComponent(item.rent || '')}&location=${encodeURIComponent((item.locality || '') + ', ' + (item.city || ''))}" style="color: inherit; text-decoration: none;">${item.title}</a></strong>
                            <span style="font-size: 0.8rem; color: #64748b;">${item.society || ''}, ${item.locality || ''}, ${item.city || ''} · ${item.bhk || ''}</span>
                            <div style="font-size: 0.9rem; font-weight: 800; color: #0f3460; margin-top: 2px;">${item.rent || item.price || ''}</div>
                        </div>
                    </div>
                    <button type="button" class="remove-saved-btn" data-saved-title="${item.title}" style="padding: 6px 14px; border-radius: 8px; border: 1px solid #fca5a5; background: #fef2f2; color: #dc2626; font-weight: 700; font-size: 0.78rem; cursor: pointer;">Remove</button>
                </li>
            `).join("");
        }
    }

    let visits = [];
    try { visits = JSON.parse(localStorage.getItem("propertydirect-scheduled-visits") || "[]"); } catch(e){}
    if (visitsStat) visitsStat.textContent = String(visits.length);

    if (visitsBody) {
        if (!visits.length) {
            visitsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #64748b;">No scheduled property visits yet.</td></tr>`;
        } else {
            visitsBody.innerHTML = visits.map(v => `
                <tr>
                    <td><strong>${v.apartment || 'Property Visit'}</strong><br><small style="color:#64748b;">${v.city || 'Bangalore'}</small></td>
                    <td>${v.date || 'Upcoming'} ${v.time || ''}<br><span style="font-size: 0.76rem; color: #64748b;">${v.visitMode || 'In-person'}</span></td>
                    <td><span class="pd-tour-badge ${String(v.status || 'REQUESTED').toLowerCase()}">${v.status || 'REQUESTED'}</span></td>
                    <td>${v.instructions || v.notes || 'Tour request submitted'}</td>
                </tr>
            `).join("");
        }
    }
}

function syncAdminTours() {
    const adminBody = document.getElementById("adminToursBody");
    const superAdminBody = document.getElementById("superAdminToursBody");
    if (!adminBody && !superAdminBody) return;

    let visits = [];
    try {
        const customerVisits = JSON.parse(localStorage.getItem("propertydirect-scheduled-visits") || "[]");
        const adminTours = JSON.parse(localStorage.getItem("propertydirect-admin-tours") || "[]");
        const map = new Map();
        [...adminTours, ...customerVisits].forEach(item => {
            if (item && item.id && !map.has(item.id)) map.set(item.id, item);
        });
        visits = Array.from(map.values());
    } catch(e){}

    const renderRows = (list) => {
        if (!list.length) {
            return `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">No scheduled tour bookings found yet. Book a tour from any apartment detail page!</td></tr>`;
        }
        return list.map(v => `
            <tr>
                <td><strong style="color:#0f172a; display:block;">${v.apartment || 'Apartment Visit'}</strong><small style="color:#64748b;">${v.createdAt || 'Recent'}</small></td>
                <td><strong style="color:#0f3460; font-size:0.9rem;">${v.visitorName || v.name || 'Rahul Sharma'}</strong></td>
                <td>
                    <div style="font-weight:700; color:#1e293b;">Phone: ${v.visitorPhone || v.phone || '+91 98765 43210'}</div>
                    <div style="font-size:0.78rem; color:#64748b;">Email: ${v.visitorEmail || v.email || 'visitor@example.com'}</div>
                </td>
                <td>
                    <span style="display:inline-block; padding:2px 8px; border-radius:6px; background:#f1f5f9; font-weight:700; font-size:0.78rem; color:#0f3460;">${v.visitMode || 'In-person'}</span>
                    <div style="font-weight:600; font-size:0.82rem; margin-top:3px; color:#1e293b;">Date: ${v.date || 'Scheduled'}</div>
                </td>
                <td style="max-width:180px; font-size:0.8rem; color:#475569;">${v.instructions || v.notes || 'No special requests'}</td>
                <td><span class="pd-tour-badge ${String(v.status || 'REQUESTED').toLowerCase()}">${v.status || 'REQUESTED'}</span></td>
                <td>
                    <button type="button" class="admin-tour-action" data-tour-id="${v.id}" data-tour-action="CONFIRMED" style="padding:5px 12px; border-radius:8px; border:1px solid #8cf0bd; background:#dcfce7; color:#166534; font-weight:700; font-size:0.75rem; cursor:pointer; margin-right:4px;">Approve</button>
                    <button type="button" class="admin-tour-action" data-tour-id="${v.id}" data-tour-action="COMPLETED" style="padding:5px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; color:#0f172a; font-weight:700; font-size:0.75rem; cursor:pointer; margin-right:4px;">Complete</button>
                    <button type="button" class="admin-tour-action" data-tour-id="${v.id}" data-tour-action="CANCELLED" style="padding:5px 12px; border-radius:8px; border:1px solid #fca5a5; background:#fef2f2; color:#dc2626; font-weight:700; font-size:0.75rem; cursor:pointer;">Cancel</button>
                </td>
            </tr>
        `).join("");
    };

    if (adminBody) adminBody.innerHTML = renderRows(visits);
    if (superAdminBody) superAdminBody.innerHTML = renderRows(visits);
}

document.addEventListener("click", event => {
    const removeBtn = event.target.closest(".remove-saved-btn");
    if (removeBtn) {
        const title = removeBtn.dataset.savedTitle;
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem("propertydirect-saved-listings") || "[]"); } catch(e){}
        saved = saved.filter(item => item.title !== title);
        localStorage.setItem("propertydirect-saved-listings", JSON.stringify(saved));
        syncSavedPropertiesAndVisits();
        showToast("Removed from shortlisted properties");
    }

    const actionBtn = event.target.closest(".admin-tour-action");
    if (actionBtn) {
        const id = Number(actionBtn.dataset.tourId);
        const newStatus = actionBtn.dataset.tourAction;
        
        let visits = [];
        try { visits = JSON.parse(localStorage.getItem("propertydirect-scheduled-visits") || "[]"); } catch(e){}
        visits = visits.map(v => v.id === id ? { ...v, status: newStatus } : v);
        localStorage.setItem("propertydirect-scheduled-visits", JSON.stringify(visits));

        let adminTours = [];
        try { adminTours = JSON.parse(localStorage.getItem("propertydirect-admin-tours") || "[]"); } catch(e){}
        adminTours = adminTours.map(v => v.id === id ? { ...v, status: newStatus } : v);
        localStorage.setItem("propertydirect-admin-tours", JSON.stringify(adminTours));

        syncAdminTours();
        syncSavedPropertiesAndVisits();
        showToast(`Tour status updated to ${newStatus}`);
    }

    if (event.target.id === "refreshAdminTours" || event.target.id === "refreshSuperAdminTours") {
        syncAdminTours();
        showToast("Tour bookings refreshed");
    }
});

document.getElementById("propertyVisitForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const visit = {
        id: Date.now(),
        apartment: `Listing #${formData.get("listingId") || "1"}`,
        visitorName: formData.get("visitorName"),
        phone: formData.get("contactPhone"),
        visitMode: formData.get("visitMode"),
        date: formData.get("scheduledAt"),
        status: "REQUESTED",
        notes: formData.get("notes") || ""
    };
    let visits = [];
    try { visits = JSON.parse(localStorage.getItem("propertydirect-scheduled-visits") || "[]"); } catch(e){}
    visits.unshift(visit);
    localStorage.setItem("propertydirect-scheduled-visits", JSON.stringify(visits));
    form.reset();
    syncSavedPropertiesAndVisits();
    syncAdminTours();
    showToast("Visit request submitted successfully");
});

restoreDashboardState();
installDashboardInteractionSafetyNet();
ensureRoleProfileSection();
setupPropertyDirectSidebar();
ensureCustomerDashboardScaffold();
syncPublishedListingsToAdminTable();
syncOwnerContactRequestsToDashboards();
ensureDetailedLeadRows();
ensureOwnerPlanTabs();
ensureSuperadminPaymentTabs();
enhanceDashboardCategories();
wireAutosave();
syncSavedPropertiesAndVisits();
syncAdminTours();
const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();
