const http = require('http');

async function testFetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function run() {
    console.log('Testing http://localhost:8080/propertydirect/apartments ...');
    const htmlRes = await testFetch('http://localhost:8080/propertydirect/apartments');
    console.log('HTML status:', htmlRes.status);
    console.log('Contains "All Cities":', htmlRes.data.includes('<option value="">All Cities</option>'));
    console.log('Contains All Listings active:', htmlRes.data.includes('class="pd-mode-tab active" data-search-mode=""'));
    console.log('Contains new script tag:', htmlRes.data.includes('/propertydirect/js/apartments.js?v=20261008-admin-approved-sync-v1'));

    console.log('\nTesting http://localhost:8080/propertydirect/js/apartments.js?v=20261008-admin-approved-sync-v1 ...');
    const jsRes = await testFetch('http://localhost:8080/propertydirect/js/apartments.js?v=20261008-admin-approved-sync-v1');
    console.log('JS status:', jsRes.status);
    console.log('Contains isSameCity:', jsRes.data.includes('isSameCity'));
    console.log('Contains isSameMode:', jsRes.data.includes('isSameMode'));

    console.log('\nTesting http://localhost:8080/api/properties/public?page=0&size=100 ...');
    const apiRes = await testFetch('http://localhost:8080/api/properties/public?page=0&size=100');
    console.log('API status:', apiRes.status);
    const apiData = JSON.parse(apiRes.data);
    const properties = apiData.content || [];
    console.log(`Approved properties returned from backend: ${properties.length}`);
    properties.forEach(p => {
        console.log(`- ID ${p.id}: "${p.title}" | City: ${p.city} | Type: ${p.listingType} | Status: ${p.status} | Verification: ${p.verificationStatus} | Price: ₹${p.price}`);
    });
}

run().catch(console.error);
