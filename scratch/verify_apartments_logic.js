const http = require('http');

async function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function verifyLogic() {
    const apiData = await getJson('http://localhost:8080/api/properties/public?page=0&size=100');
    const items = apiData.content || [];

    // Helper functions as defined in apartments.js
    function isSameCity(aptCity, filterCity) {
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

    const mapped = items.map(x => ({
        id: x.id,
        title: x.title,
        society: x.society || x.locality || "Approved Society",
        locality: x.locality || x.city || "Direct Listing",
        city: x.city,
        listingMode: x.listingType || "Rent",
        rent: Number(x.price || 0),
        price: Number(x.price || 0),
        bhk: x.bhk || (x.bedrooms ? `${x.bedrooms} BHK` : "2 BHK"),
        propertyType: x.propertyType || "Apartment",
        apartmentType: x.propertyType || "Apartment"
    }));

    function testFilter(city, mode, budget = 250000, minBudget = 0) {
        return mapped.filter(apt => {
            const cityOk = isSameCity(apt.city, city) || isSameCity(apt.locality, city);
            const modeOk = isSameMode(apt.listingMode, mode);
            let budgetOk = true;
            const aptPrice = Number(apt.rent ?? apt.price ?? 0);
            const isAptSale = isSameMode(apt.listingMode, "buy");
            const isSearchRent = mode === "rent" || mode === "lease";
            const isSearchBuy = mode === "buy" || mode === "sale";

            if (isSearchRent) {
                budgetOk = aptPrice >= minBudget && (budget >= 250000 || aptPrice <= budget);
            } else if (isSearchBuy) {
                if (minBudget > 0) budgetOk = aptPrice >= minBudget;
                if (budget < 250000 && budget > 500000) budgetOk = budgetOk && aptPrice <= budget;
            } else {
                if (isAptSale) {
                    budgetOk = minBudget > 0 ? aptPrice >= minBudget : true;
                } else {
                    budgetOk = aptPrice >= minBudget && (budget >= 250000 || aptPrice <= budget);
                }
            }
            return cityOk && modeOk && budgetOk;
        });
    }

    console.log('--- TEST SCENARIOS ---');
    console.log('1. Default page load (city="", mode=""):', testFilter("", "").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('2. User clicks "Rent" tab (city="", mode="rent"):', testFilter("", "rent").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('3. User clicks "Lease" tab (city="", mode="lease"):', testFilter("", "lease").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('4. User clicks "Buy" tab (city="", mode="buy"):', testFilter("", "buy").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('5. User selects "Bangalore" in dropdown:', testFilter("Bangalore", "").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('6. User selects "Bengaluru" in dropdown:', testFilter("Bengaluru", "").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
    console.log('7. User selects "Bangalore" + "Lease":', testFilter("Bangalore", "lease").map(p => `[${p.id}] ${p.title} (${p.listingMode})`));
}

verifyLogic().catch(console.error);
