const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:8081';
async function signIn(role) {
  const r = await fetch(base + '/api/auth/dashboard-login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({platform:'smartapartment', role, username:role+'@smartapartment', password:role+'123'})
  });
  assert.equal(r.status, 200);
  return {Cookie: r.headers.getSetCookie().map(s => s.split(';')[0]).join('; ')};
}
(async () => {
  const admin = await signIn('admin'), superadmin = await signIn('superadmin');
  const response = await fetch(base + '/dashboards/society-admin', {headers: admin});
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const view of ['amenities','billing-rules','home-services','polls','assets','expenses'])
    assert.doesNotMatch(html, new RegExp('data-(?:view|panel)="'+view+'"'));
  assert.match(html, /id="staffForm"/);
  assert.match(html, /id="adminInvoiceFlat"/);
  assert.match(html, /id="adminInvoiceUnitType"/);
  assert.match(html, /workspace-alignment\.css\?v=20261008-admin-layout-v6/);
  const css = await fetch(base + '/smartapartment/css/workspace-alignment.css?v=20261008-admin-layout-v6');
  assert.equal(css.status, 200);
  const styles = await css.text();
  assert.match(styles, /#staffForm[^}]+grid-template-columns:repeat\(12/);
  assert.match(styles, /background:#15803d/);
  assert.match(styles, /background:#1d4ed8/);
  assert.equal((await fetch(base+'/api/admin/home-services/packages',{headers:admin,redirect:'manual'})).status,403);
  assert.equal((await fetch(base+'/api/admin/home-services/packages',{headers:superadmin})).status,200);
  const superHtml=await (await fetch(base+'/dashboards/superadmin',{headers:superadmin})).text();
  assert.match(superHtml,/data-view="home-services"/);
  assert.match(superHtml,/home-services-pricing-admin\.js/);
  const result={adminDashboard:200,removedPanels:6,staffForm:true,flatBhkSelection:true,newStylesServed:true,adminPricingEditor:403,superadminPricingEditor:200};
  fs.writeFileSync('scratch/admin-visible-change-check.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
