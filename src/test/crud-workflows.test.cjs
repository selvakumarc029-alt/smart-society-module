const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../main/resources/static/smartapartment/js/crud-workflows.js');
const reply=(status,body,redirected=false)=>({status,ok:status>=200&&status<300,redirected,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
test('record requests preserve optimistic versions and support an empty successful delete',async()=>{
    let captured;const result=await core.request('/record/1','DELETE',undefined,'3-2',async(url,options)=>{captured=options;return reply(204,'');});
    assert.deepEqual(result,{});assert.equal(captured.headers['If-Match'],'3-2');assert.equal(captured.credentials,'same-origin');
});
test('session redirects, malformed responses and validation errors never count as a successful save',async()=>{
    for(const response of [reply(200,'<html>Login</html>',true),reply(200,'<html>Error</html>'),reply(200,''),reply(409,{message:'Record changed'}),reply(400,{errors:{name:'must not be blank'}})]){
        await assert.rejects(()=>core.request('/records','POST',{},undefined,async()=>response));
    }
});
test('forms preserve zero values, reject invalid numbers and do not overwrite account credentials on edit',()=>{
    const flat={unitNo:'A-01',ownerName:'Owner',occupancy:'VACANT',block:'A',floor:'0',unitType:'2BHK'};
    assert.equal(core.payload('apartments',flat).floor,0);
    assert.equal(core.payload('apartments',flat).monthlyMaintenance,null);
    assert.throws(()=>core.payload('apartments',{...flat,floor:'1.5'}),/valid floor/);
    assert.throws(()=>core.payload('apartments',{...flat,monthlyMaintenance:'-10'}),/valid monthly/);
    const resident=core.payload('residents',{name:'Person',unitNo:'A-01',residentType:'TENANT',email:'altered@example.com',temporaryPassword:'secret'},true);
    assert.equal(resident.email,undefined);assert.equal(resident.temporaryPassword,undefined);
    assert.equal(core.payload('residents',{name:'Person',email:'person@example.com',unitNo:'A-01',residentType:'TENANT',temporaryPassword:' password123 '}).temporaryPassword,' password123 ');
});
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/dashboard.js','utf8');
const submit=source.slice(source.indexOf('async function submitActionModal()'),source.indexOf('\nfunction enhanceDashboardCategories()'));
function modalHarness(performAction){
    const save={disabled:false,textContent:'Confirm'},toasts=[],receipts=[],audit=[];
    const modal={classList:{contains:()=>false},querySelector:selector=>selector==='#dashboardActionSave'?save:selector==='#dashboardActionTitle'?{textContent:'Resident'}:{querySelector:()=>null},querySelectorAll:()=>[{type:'password',value:' secret123 '}]};
    const context={activeAction:{action:'add',button:{dataset:{table:'residents'},closest:()=>null}},dashboardRole:'admin',window:{validateRequiredScope:()=>true},ensureActionModal:()=>modal,performAction,
        showToast:value=>toasts.push(value),showActionReceipt:r=>receipts.push(r),persistWorkflowAction:async(...args)=>{audit.push(args);return{id:1};}};
    vm.createContext(context);vm.runInContext(submit,context);return{context,save,toasts,receipts,audit};
}
test('failed persistence leaves the form open, keeps input and creates no success receipt or workflow log',async()=>{
    const h=modalHarness(async()=>{throw new Error('Email already exists');});await h.context.submitActionModal();
    assert.ok(h.context.activeAction);assert.equal(h.save.disabled,false);assert.deepEqual(h.receipts,[]);assert.deepEqual(h.audit,[]);assert.deepEqual(h.toasts,['Email already exists']);
});
test('saving waits for the domain request and blocks a second submit while it is pending',async()=>{
    let resolve,calls=0;const operation=new Promise(r=>resolve=r);const h=modalHarness(async()=>{calls++;return operation;});
    const pending=h.context.submitActionModal();await h.context.submitActionModal();assert.equal(calls,1);assert.equal(h.save.disabled,true);assert.equal(h.receipts.length,0);
    resolve({title:'Saved',persisted:true,lines:['Record #7']});await pending;
    assert.equal(h.context.activeAction,null);assert.equal(h.save.disabled,false);assert.equal(h.receipts.length,1);assert.equal(h.audit.length,0);
});
test('PropertyDirect does not receive the CRUD module or management controls',()=>{
    const context={window:{},document:{body:{dataset:{platform:'propertydirect'}}}};context.window.document=context.document;
    vm.runInNewContext(fs.readFileSync('src/main/resources/static/smartapartment/js/crud-workflows.js','utf8'),context);
    assert.equal(context.window.smartCrudRequest,undefined);assert.equal(context.window.performPersistedCrudAction,undefined);
});
test('failed admin payment never changes the invoice status or offers a receipt',async()=>{
    const code=source.slice(source.indexOf('async function performAction('),source.indexOf('\nasync function submitActionModal()'));
    let mutations=0,statusChanges=0;
    const row={dataset:{recordId:'7'}},button={dataset:{},textContent:'Mark Paid',closest:()=>row};
    const context={dashboardRole:'admin',window:{},getContext:()=>({panel:'billing'}),buttonLabel:b=>b.textContent,performControlQueueAction:()=>null,
        billingRowData:()=>({flat:'A-01',month:'2026-10'}),mutateSociety:async()=>{mutations++;throw Error('Payment reference already used');},setStatus:()=>statusChanges++};
    vm.createContext(context);vm.runInContext(code,context);
    await assert.rejects(()=>context.performAction('pay',button,['BANK_TRANSFER','TX-7']),/already used/);
    assert.equal(mutations,1);assert.equal(statusChanges,0);assert.equal(button.textContent,'Mark Paid');
    await assert.rejects(()=>context.performAction('pay',button,['BANK_TRANSFER','']),/verified transaction/);
    assert.equal(mutations,1);
});
