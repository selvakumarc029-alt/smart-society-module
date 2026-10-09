const { spawn } = require('child_process');
const http = require('http');

async function runTest() {
    console.log('--- Step 0: Ensure customer 34 is reset in database ---');
    const { execSync } = require('child_process');
    execSync('java -cp "scratch;C:/Users/Thiru T/.m2/repository/com/h2database/h2/2.3.232/h2-2.3.232.jar" scratch/ResetApp.java', { stdio: 'inherit' });

    console.log('\n--- Step 1: Customer Login & Form Fill via Browser Simulation ---');
    // First, let's test customer session login via HTTP
    const custLoginRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            platform: 'propertydirect',
            role: 'customer',
            username: 'customer@propertydirect',
            password: 'customer123'
        })
    });
    console.log('Customer login status:', custLoginRes.status);
    const custCookie = custLoginRes.headers.get('set-cookie');

    // Fetch customer dashboard HTML to ensure our template renders cleanly
    const custPageRes = await fetch('http://localhost:8080/propertydirect/dashboards/customer', {
        headers: { 'Cookie': custCookie }
    });
    console.log('Customer page status:', custPageRes.status);
    const pageHtml = await custPageRes.text();
    console.log('Contains become-owner-card:', pageHtml.includes('become-owner-card'));
    console.log('Contains ownerPropType:', pageHtml.includes('id="ownerPropType"'));
    console.log('Contains headerBecomeOwnerBtn:', pageHtml.includes('id="headerBecomeOwnerBtn"'));

    // Customer submits the application
    console.log('\n--- Step 2: Customer Submits Form ---');
    const propType = 'Residential Apartment (For Sale)';
    const propUnit = 'Flat 402, Oakwood Heights, Tower B';
    const propLocality = 'Indiranagar, Bengaluru - 560038';
    const docType = 'Registered Sale Deed';
    const docRef = 'DOC-KA-BLR-2023-882194';
    const notes = 'Sole registered owner with clear title and zero encumbrances. Submitting deed proof for direct listing privileges.';
    const combinedDetails = `Property Type: ${propType} | Unit/Building: ${propUnit} | Location: ${propLocality} | Proof Document: ${docType} (Ref: ${docRef}) | Notes: ${notes}`;

    const submitRes = await fetch('http://localhost:8080/api/property/portal/applications', {
        method: 'POST',
        headers: {
            'Cookie': custCookie,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            role: 'OWNER',
            registrationNumber: docRef,
            verificationDetails: combinedDetails
        })
    });
    console.log('Submit response status:', submitRes.status);
    const submitData = await submitRes.json();
    console.log('Submitted Application ID:', submitData.id);
    console.log('Submitted Decision:', submitData.decision);
    console.log('Submitted Verification Details:', submitData.verificationDetails);

    // Customer checks /api/property/portal/me
    console.log('\n--- Step 3: Customer Re-checks Profile (loadMe) ---');
    const meRes = await fetch('http://localhost:8080/api/property/portal/me', {
        headers: { 'Cookie': custCookie, 'Accept': 'application/json' }
    });
    const meData = await meRes.json();
    console.log('Customer me.application ID:', meData.application?.id);
    console.log('Customer me.application decision:', meData.application?.decision);

    // Admin checks the Verifications queue
    console.log('\n--- Step 4: Admin checks Applications Queue ---');
    const adminLoginRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            platform: 'propertydirect',
            role: 'admin',
            username: 'admin@propertydirect',
            password: 'admin123'
        })
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie');
    const adminAppsRes = await fetch('http://localhost:8080/api/property/portal/applications', {
        headers: { 'Cookie': adminCookie, 'Accept': 'application/json' }
    });
    const adminApps = await adminAppsRes.json();
    console.log('Admin applications count:', adminApps.length);
    const targetApp = adminApps.find(a => a.application?.id === submitData.id);
    if (targetApp) {
        console.log('✓ SUCCESS: Found submitted application in Admin Dashboard queue!');
        console.log('Applicant Name:', targetApp.account?.name);
        console.log('Applicant Email:', targetApp.account?.email);
        console.log('Applicant Phone:', targetApp.account?.phone);
        console.log('Requested Role:', targetApp.application?.requestedRole);
        console.log('Document Reg:', targetApp.application?.registrationNumber);
        console.log('Verification Details:', targetApp.application?.verificationDetails);
        console.log('Decision:', targetApp.application?.decision);
    } else {
        console.error('FAILED: Application not found in admin queue!');
    }
}

runTest().catch(console.error);
