async function main() {
  const adminRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'propertydirect', role: 'admin', username: 'admin@propertydirect', password: 'admin123' })
  });
  const cookie = adminRes.headers.get('set-cookie');
  console.log('Admin login status:', adminRes.status);

  const custRes = await fetch('http://localhost:8080/api/property/portal/accounts', {
    headers: { 'Cookie': cookie }
  });
  console.log('Accounts status:', custRes.status);
  const data = await custRes.json();
  console.log('Accounts count:', data.length);
  for (const c of data) {
    console.log(`ID: ${c.id}, Username: ${c.username}, Email: ${c.email}, Role: ${c.role}, Name: ${c.name}, Status: ${c.status}, Verified: ${c.postingVerified}`);
  }
}

main().catch(console.error);
