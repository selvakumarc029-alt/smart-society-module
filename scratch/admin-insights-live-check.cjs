const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base='http://127.0.0.1:8081';
async function login(role){const r=await fetch(base+'/api/auth/dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'smartapartment',role,username:role+'@smartapartment',password:role+'123'})});assert.equal(r.status,200);return {Cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
(async()=>{
  const admin=await login('admin');const r=await fetch(base+'/dashboards/society-admin',{headers:admin});assert.equal(r.status,200);const html=await r.text();
  for(const view of ['occupancy','maintenance-overview','security-access']){assert.match(html,new RegExp('data-view="'+view+'"'));assert.match(html,new RegExp('data-panel="'+view+'"'));}
  assert.match(html,/id="admin-billing-overview"/);assert.match(html,/id="insights-rent-form"/);assert.match(html,/id="insights-rent-reset"/);assert.match(html,/admin-insights\.css/);assert.match(html,/admin-insights\.js/);
  for(const view of ['amenities','billing-rules','home-services','polls','assets','expenses'])assert.doesNotMatch(html,new RegExp('data-(?:view|panel)="'+view+'"'));
  const report={dashboard:200,pages:3,billingOverview:true};
  for(const name of ['occupancy','maintenance','security','billing']){const response=await fetch(base+'/api/society/admin-insights/'+name,{headers:admin});assert.equal(response.status,200,name);const data=await response.json();assert.equal(typeof data,'object');report[name]=200;}
  for(const asset of ['js/admin-insights.js','js/resident-billing-notices.js','css/admin-insights.css']){const response=await fetch(base+'/smartapartment/'+asset,{headers:admin});assert.equal(response.status,200,asset);if(asset.endsWith('.js'))new vm.Script(await response.text());}
  const resident=await login('resident');assert.equal((await fetch(base+'/api/society/admin-insights/billing',{headers:resident,redirect:'manual'})).status,403);
  const residentHtml=await (await fetch(base+'/dashboards/resident',{headers:resident})).text();assert.match(residentHtml,/resident-billing-notices\.js/);
  const notices=await fetch(base+'/api/society/operations/notifications',{headers:resident});assert.equal(notices.status,200);assert.ok(Array.isArray(await notices.json()));
  const security=await login('security');assert.equal((await fetch(base+'/dashboards/security',{headers:security})).status,200);
  const logs=await (await fetch(base+'/api/society/admin-insights/security',{headers:admin})).json();assert.ok(logs.sessions.some(s=>s.name));
  assert.ok((await fetch(base+'/dashboards/logout',{headers:security,redirect:'manual'})).status>=300);
  const ended=await (await fetch(base+'/api/society/admin-insights/security',{headers:admin})).json();assert.ok(ended.sessions.some(s=>s.endReason==='SIGNED_OUT'));
  report.residentAccess=403;report.residentNotices=200;report.securityLoginLogout=true;
  fs.writeFileSync('scratch/admin-insights-live-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
