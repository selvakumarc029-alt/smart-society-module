const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
const core = require('../main/resources/static/smartapartment/js/accountant-button-workflows.js');
const charges = {batchMonth:'February 2028',batchDueDate:'15-Feb-2028',batchBaseRate:'1.35',batchWaterRate:'3.50',batchPowerFee:'253',batchSinkingFee:'150',batchRepairFee:'100',batchParkingFee:'100',batchGstRate:'18'};

test('itemized batch uses the selected period, leap-year dates, charges and split GST',()=>{
    const result=core.billingPayload(charges,'2028-02-01');
    assert.equal(result.month,'2028-02'); assert.equal(result.periodStart,'2028-02-01'); assert.equal(result.periodEnd,'2028-02-29'); assert.equal(result.dueDate,'2028-02-15');
    assert.equal(result.baseRatePerSqFt,1.35); assert.equal(result.waterRatePerUnit,3.5);assert.equal(result.cgstRate,9);assert.equal(result.sgstRate,9);
});
test('billing rejects malformed periods, negative charges and dates before the period',()=>{
    assert.throws(()=>core.billingPayload({...charges,batchMonth:'Tomorrow'},'2028-02-01'),/billing month/);
    assert.throws(()=>core.billingPayload({...charges,batchBaseRate:'-1'},'2028-02-01'),/non-negative/);
    assert.throws(()=>core.billingPayload({...charges,batchGstRate:'NaN'},'2028-02-01'),/non-negative/);
    assert.throws(()=>core.billingPayload({...charges,batchDueDate:'2028-01-01'},'2028-02-01'),/before/);
    assert.throws(()=>core.dateValue('31-Feb-2028'),/valid due date/);
    assert.throws(()=>core.dateValue('2028-02-31'),/valid due date/);
    assert.throws(()=>core.dateValue('2028-13-01'),/valid due date/);
    assert.equal(core.dateValue('2028-02-29'),'2028-02-29');
});
test('ledger CSV preserves rows, quotes and newlines while neutralizing formulas',()=>{
    assert.equal(core.csv([['Vendor','Amount'],['A, "B"\nC',123],['=HYPERLINK("bad")',0]]),'\uFEFF"Vendor","Amount"\r\n"A, ""B""\nC","123"\r\n"\'=HYPERLINK(""bad"")","0"');
});

function interactionHarness(platform='smartapartment'){
    const listeners={window:{},document:{}};const timers=[];const notices=[];
    const document={body:{dataset:{platform},classList:{contains:()=>true},matches:()=>platform==='propertydirect'},readyState:'loading',addEventListener:(type,fn,options)=>{(listeners.document[type]??=[]).push({fn,options});},querySelectorAll:()=>[],createElement:()=>({dataset:{},setAttribute(){},textContent:''})};
    const window={document,openActionModal(){},addEventListener:(type,fn,options)=>{(listeners.window[type]??=[]).push({fn,options});}};
    const context={window,document,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},fetch:async()=>{notices.push('saved');return {ok:true,json:async()=>({})};}};
    vm.runInNewContext(fs.readFileSync(path.join(root,'src/main/resources/static/smartapartment/js/button-interactions.js'),'utf8'),context);
    return {window,document,listeners,timers,notices,context};
}
test('opening an existing action modal does not trigger the legacy workflow save bridge',async()=>{
    const h=interactionHarness();
    vm.runInNewContext(fs.readFileSync(path.join(root,'src/main/resources/static/smartapartment/js/dashboard-controls.js'),'utf8'),h.context);
    const button={dataset:{action:'add'},disabled:false,closest:()=>null,matches:()=>false};
    const event={target:{closest:()=>button},preventDefault(){}};
    h.listeners.window.click[0].fn(event);
    await h.listeners.document.click.find(item=>item.options===true).fn(event);
    assert.deepEqual(h.notices,[]); assert.equal(button.dataset.smartPersisting,'true');
    h.timers.forEach(fn=>fn());assert.equal(button.dataset.smartPersisting,undefined);
});
test('PropertyDirect does not register SmartApartment button handlers',()=>{
    const h=interactionHarness('propertydirect');assert.deepEqual(h.listeners.window,{});assert.deepEqual(h.listeners.document,{});
});
function demoButton(title){
    const attrs={};const status={textContent:''};
    const button={title,dataset:{},classList:{toggle(){},remove(){}},getAttribute:name=>attrs[name],setAttribute:(name,value)=>{attrs[name]=value;},closest:()=>null};
    const modal={id:'waVoiceCallModal',style:{display:'flex'},querySelector:()=>status,querySelectorAll:()=>[button]};
    const event={target:{closest:selector=>selector==='button'?button:selector.includes('waVoiceCallModal')?modal:null}};
    return {button,modal,status,event,attrs};
}
test('demo microphone, speaker and camera buttons toggle and announce their state',()=>{
    for(const [title,expected] of [['Mute Microphone','Microphone muted in demo.'],['Speaker','Demo speaker on.'],['Camera Switch','Rear camera selected in demo.']]){
        const h=interactionHarness();const d=demoButton(title);const click=h.listeners.document.click[0].fn;
        click(d.event);assert.equal(d.attrs['aria-pressed'],'true');assert.equal(d.status.textContent,expected);
        click(d.event);assert.equal(d.attrs['aria-pressed'],'false');
    }
});
test('Escape closes the existing demo and resets its controls',()=>{
    const h=interactionHarness();const d=demoButton('Mute Microphone');h.listeners.document.click[0].fn(d.event);
    let closed=0;h.window.endVoiceCall=()=>{closed++;d.modal.style.display='none';};h.document.querySelectorAll=()=>[d.modal];
    h.listeners.document.keydown[0].fn({key:'Escape'});assert.equal(closed,1);assert.equal(d.attrs['aria-pressed'],'false');assert.equal(d.status.textContent,'');
});
test('homepage feature buttons select the matching existing preview control',()=>{
    for(const [label,index] of [['Notice board',1],['Complaints',4],['Online payment',3],['Visitor updates',2],['Maintenance bills',3],['Digital receipts',3]]){
        const h=interactionHarness();let selected=-1;const feature={textContent:label,setAttribute(){}};
        h.document.querySelectorAll=selector=>selector==='#phoneDots button'?Array.from({length:5},(_,i)=>({click:()=>{selected=i;}})):[feature];
        h.document.getElementById=()=>({scrollIntoView(){}});
        h.listeners.document.click[0].fn({target:{closest:selector=>selector==='.showcase-badges button'?feature:null}});
        assert.equal(selected,index);
    }
});
test('all non-PropertyDirect dashboard and public inline scripts parse',()=>{
    const directories=['dashboards','resident','terms'];
    const pages=['index.html','maintenance-feedback.html',...directories.flatMap(dir=>fs.readdirSync(path.join(root,'src/main/resources/templates',dir)).filter(name=>name.endsWith('.html')).map(name=>dir+'/'+name))];
    for(const page of pages){const html=fs.readFileSync(path.join(root,'src/main/resources/templates',page),'utf8');for(const [,attributes,script]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|application\/ld\+json/.test(attributes)||!script.trim())continue;new vm.Script(script,{filename:page});}}
});
