const assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
async function login(role){
 const response=await fetch(base+'/api/auth/dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'smartapartment',role,username:role+'@smartapartment',password:role+'123'})});
 assert.equal(response.status,200);
 return response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
}
(async()=>{
 const admin=await login('superadmin');
 const page=await fetch(base+'/dashboards/superadmin',{headers:{Cookie:admin}});const html=await page.text();
 assert.doesNotMatch(html,/updateSmartSocietyServiceRequestStatus|Quick status update:/);
 const denied=await fetch(base+'/api/society/service-tickets/0/status',{method:'PATCH',headers:{Cookie:admin,'Content-Type':'application/json'},body:JSON.stringify({ticketStatus:'RESOLVED',version:0})});assert.equal(denied.status,403);
 console.log('SuperAdmin has no status controls; worker endpoint rejects SuperAdmin (403).');
 const worker=await login('maintenance');
 const tickets=await fetch(base+'/api/society/service-tickets',{headers:{Cookie:worker}});assert.equal(tickets.status,200);assert.ok(Array.isArray(await tickets.json()));
 const workerPage=await fetch(base+'/dashboards/maintenance-worker',{headers:{Cookie:worker}});const workerHtml=await workerPage.text();assert.match(workerHtml,/workerServiceTickets/);assert.match(workerHtml,/worker-service-tickets.js/);
 console.log('Worker assigned-ticket endpoint and controls load (200).');
 const resident=await login('resident');const residentTickets=await fetch(base+'/api/maintenance?sourcePlatform=smartsociety',{headers:{Cookie:resident}});assert.equal(residentTickets.status,200);assert.ok(Array.isArray(await residentTickets.json()));
 console.log('Resident saved service-ticket view loads (200). No live ticket was changed by these checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
