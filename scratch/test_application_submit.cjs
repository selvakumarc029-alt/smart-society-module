async function testApplicationFlow() {
  console.log('1. Logging in as customer...');
  const loginRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'propertydirect',
      role: 'customer',
      username: 'customer@propertydirect',
      password: 'customer123'
    })
  });
  console.log('Customer login status:', loginRes.status);
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Cookie received:', !!cookie);

  console.log('\n2. Checking /api/property/portal/me...');
  const meRes = await fetch('http://localhost:8080/api/property/portal/me', {
    headers: { 'Cookie': cookie, 'Accept': 'application/json' }
  });
  console.log('Me status:', meRes.status);
  const meData = await meRes.json();
  console.log('Me data:', meData);

  console.log('\n3. Submitting application as customer...');
  const details = 'Property Type: 2 BHK Apartment | Location: Flat 402, Oakwood Heights, Indiranagar, Bengaluru | Proof: Registered Sale Deed No. KA-BLR-2024-8891 | Direct Owner Application';
  const appRes = await fetch('http://localhost:8080/api/property/portal/applications', {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      role: 'OWNER',
      verificationDetails: details
    })
  });
  console.log('App submit status:', appRes.status);
  const appData = await appRes.json();
  console.log('App submit result:', appData);

  console.log('\n4. Admin checks applications queue...');
  const adminRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'propertydirect',
      role: 'admin',
      username: 'admin@propertydirect',
      password: 'admin123'
    })
  });
  const adminCookie = adminRes.headers.get('set-cookie');
  const adminAppsRes = await fetch('http://localhost:8080/api/property/portal/applications', {
    headers: { 'Cookie': adminCookie, 'Accept': 'application/json' }
  });
  const adminApps = await adminAppsRes.json();
  console.log('Admin saw apps count:', adminApps.length);
  console.log('Admin app 0:', JSON.stringify(adminApps[0], null, 2));
}

testApplicationFlow().catch(console.error);
