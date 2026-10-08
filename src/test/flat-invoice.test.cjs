const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const template=fs.readFileSync('src/main/resources/templates/dashboards/society-admin.html','utf8');
const script=[...template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('function handleAdminItemizedSubmit'))[1];
function form(scope='flat',ok=true){
 const fields={},calls=[],toasts=[];const values={adminInvoiceScope:scope,adminInvoiceFlat:'15',adminInvoiceUnitType:'2BHK',adminBatchMonth:'2026-10',adminBatchDueDate:'2026-10-20',adminSimpleAmount:'2800',adminInvoicePrefix:'SS-MNT'};
 const element=id=>fields[id]??=( {value:values[id]??'0',style:{display:'flex'},textContent:'',innerHTML:'',disabled:false});
 const submit={disabled:false,innerHTML:''};
 const context={document:{getElementById:element},window:{},Date,showToast:text=>toasts.push(text),loadSocietyBackendData:async()=>{},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok,json:async()=>ok?{count:1,month:'2026-10'}:{detail:'An invoice already exists for this flat and month.'}};}};
 vm.createContext(context);vm.runInContext(script,context);
 return {context,fields,calls,toasts,element,submit,run:()=>context.handleAdminItemizedSubmit({preventDefault(){},target:{reportValidity:()=>true,querySelector:()=>submit}})};
}
test('single-flat form sends the actual selected apartment and BHK without using batch endpoint',async()=>{
 const app=form();await app.run();assert.equal(app.calls.length,1);assert.equal(app.calls[0].url,'/api/billing/generate-for-flat');assert.equal(app.calls[0].body.apartmentId,15);assert.equal(app.calls[0].body.unitType,'2BHK');assert.equal(app.calls[0].body.otherCharges,2800);assert.equal(app.element('adminItemizedModal').style.display,'none');
});
test('empty flat selection sends no invoice request',async()=>{const app=form();app.element('adminInvoiceFlat').value='';await app.run();assert.equal(app.calls.length,0);assert.match(app.element('adminInvoiceSelectionMessage').textContent,/Select/);});
test('explicit batch action remains a separate endpoint without a single flat target',async()=>{const app=form('batch');await app.run();assert.equal(app.calls[0].url,'/api/billing/generate-detailed');assert.equal(app.calls[0].body.apartmentId,undefined);});
test('failed or duplicate generation keeps the editor open and restores the submit button',async()=>{const app=form('flat',false);await app.run();assert.equal(app.element('adminItemizedModal').style.display,'flex');assert.match(app.toasts[0],/already exists/);assert.equal(app.submit.disabled,false);});
test('busy submit cannot create duplicate requests',async()=>{const app=form();app.submit.disabled=true;await app.run();assert.equal(app.calls.length,0);});
test('invoice selector and resident refresh never initialize on PropertyDirect',()=>{for(const name of ['admin-invoice-selection','resident-billing-refresh'])vm.runInNewContext(fs.readFileSync(`src/main/resources/static/smartapartment/js/${name}.js`,'utf8'),{document:{body:{dataset:{platform:'propertydirect',dashboardRole:'admin'}}}});});
function selector(ok=true){
 const fields={},handlers={},submit={};
 const get=id=>fields[id]??={value:'',style:{},options:[],replaceChildren(item){this.options=[item];this.value='';},add(item){this.options.push(item);},addEventListener(name,fn){handlers[id+':'+name]=fn;},querySelector:()=>submit};
 const context={document:{body:{dataset:{platform:'smartapartment',dashboardRole:'admin'}},getElementById:get,addEventListener:(name,fn)=>handlers[name]=fn},window:{},Date,Option:class{constructor(text,value){this.text=text;this.value=value;}},fetch:async()=>({ok,json:async()=>[{id:1,unitNo:'101',type:'1 BHK',block:'A',monthlyMaintenance:1500},{id:2,unitNo:'102',type:'2BHK',block:'A',monthlyMaintenance:2500}]})};
 vm.runInNewContext(fs.readFileSync('src/main/resources/static/smartapartment/js/admin-invoice-selection.js','utf8'),context);handlers.DOMContentLoaded();return {get,handlers,submit,context};
}
test('BHK filtering only offers flats of the selected type and fills their stored maintenance fee',async()=>{
 const app=selector();await app.context.window.loadAdminInvoiceFlats();app.get('adminInvoiceUnitType').value='1BHK';app.handlers['adminInvoiceUnitType:change']();assert.equal(app.get('adminInvoiceFlat').options.length,2);assert.equal(app.get('adminInvoiceFlat').options[1].value,'1');app.get('adminInvoiceFlat').value='1';app.handlers['adminInvoiceFlat:change']();assert.equal(app.get('adminSimpleAmount').value,1500);
});
test('failed loading disables invoice generation rather than falling back to all flats',async()=>{
 const app=selector(false);await app.context.window.loadAdminInvoiceFlats();assert.equal(app.submit.disabled,true);assert.match(app.get('adminInvoiceSelectionMessage').textContent,/Unable to load/);assert.equal(app.get('adminInvoiceScope').value,'flat');
});
