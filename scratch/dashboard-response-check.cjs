const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const base='http://127.0.0.1:8081';
(async()=>{
 const report=[];
 for(const [role,path] of [['superadmin','superadmin'],['admin','society-admin'],['resident','resident'],['accountant','accountant'],['security','security'],['maintenance','maintenance'],['maintenance','maintenance-worker']]) {
  const login=await fetch(base+'/api/auth/dashboard-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'smartapartment',role,username:role+'@smartapartment',password:role+'123'})});assert.equal(login.status,200);
  const Cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  const response=await fetch(base+'/dashboards/'+path,{headers:{Cookie},redirect:'manual'});assert.equal(response.status,200,path);
  const html=await response.text();assert.match(html,/<\/html>/i);assert.doesNotMatch(html,/Whitelabel Error Page/);
  let scripts=0;
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
   if(/type=["'](?:application\/ld\+json|application\/json)["']/.test(m[1]))continue;
   const src=m[1].match(/\bsrc=["']([^"']+)["']/)?.[1];
   if(src?.startsWith('/')&&!src.startsWith('//')) { const r=await fetch(base+src.replaceAll('&amp;','&'),{headers:{Cookie},redirect:'manual'});assert.equal(r.status,200,src);new vm.Script(await r.text(),{filename:src});scripts++; }
   else if(!src&&m[2].trim()) {new vm.Script(m[2],{filename:path+' inline'});scripts++;}
  }
  if(path==='maintenance') {assert.match(html,/data-maintenance-asset-demo="true"/);assert.match(html,/maintenance-asset-demo.js/);}
  const item={dashboard:path,status:response.status,parsedScripts:scripts,buttons:(html.match(/<button\b/g)||[]).length};report.push(item);console.log(JSON.stringify(item));
 }
 fs.writeFileSync('scratch/dashboard-response-check.json',JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
