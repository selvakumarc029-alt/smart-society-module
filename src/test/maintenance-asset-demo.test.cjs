const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/maintenance-asset-demo.js','utf8');
function harness(platform='smartapartment') {
    let click, dialog, appends=0;
    const nodes={};
    for(const selector of ['[data-cancel]','form','[data-error]','[data-asset-name]','[name="servicedOn"]','[name="nextDue"]']) nodes[selector]={value:'',textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
    const classes=new Set();
    const row={cells:[{textContent:'Lift <A>'},{},{},{textContent:'2026-07-15'},{textContent:'2026-08-15',classList:{remove:c=>classes.delete(c),add:c=>classes.add(c)}}]};
    const button={disabled:false,closest:()=>row,focus(){this.focused=true;}};
    const window={addEventListener(type,fn){click=fn;},showToast(){}};
    const document={body:{dataset:{platform},appendChild(){appends++;}},querySelector:()=>button,createElement(){dialog={open:false,listeners:{},setAttribute(){},querySelector:s=>nodes[s],addEventListener(t,fn){this.listeners[t]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close();}};return dialog;}};
    vm.runInNewContext(source,{document,window,Date,Number});
    function open(){click({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});}
    return {open,nodes,row,button,get dialog(){return dialog;},get appends(){return appends;},get handler(){return click;}};
}
test('demo service opens without changing the row, cancellation preserves dates and restores focus',()=>{
    const h=harness();h.open();assert.equal(h.dialog.open,true);assert.equal(h.row.cells[3].textContent,'2026-07-15');assert.equal(h.nodes['[data-asset-name]'].textContent,'Lift <A>');
    h.nodes['[data-cancel]'].listeners.click();assert.equal(h.dialog.open,false);assert.equal(h.row.cells[4].textContent,'2026-08-15');assert.equal(h.button.focused,true);
});
test('demo save updates dates and keeps Log Service available for repeated use',()=>{
    const h=harness();h.open();const serviced=h.nodes['[name="servicedOn"]'].value,next=h.nodes['[name="nextDue"]'].value;
    h.nodes.form.listeners.submit({preventDefault(){}});assert.equal(h.row.cells[3].textContent,serviced);assert.equal(h.row.cells[4].textContent,next);assert.equal(h.button.textContent,'Log Service');assert.equal(h.dialog.open,false);
    h.open();assert.equal(h.dialog.open,true);assert.equal(h.appends,1);
});
test('invalid or future service dates keep the demo form open and leave original dates untouched',()=>{
    for(const [service,next] of [['2026-02-30','2099-01-01'],['2099-01-01','2099-02-01'],['2026-01-01','2025-01-01']]) {
        const h=harness();h.open();h.nodes['[name="servicedOn"]'].value=service;h.nodes['[name="nextDue"]'].value=next;
        h.nodes.form.listeners.submit({preventDefault(){}});assert.equal(h.dialog.open,true);assert.ok(h.nodes['[data-error]'].textContent);assert.equal(h.row.cells[3].textContent,'2026-07-15');
    }
});
test('asset demo installs no handler on PropertyDirect',()=>{assert.equal(harness('propertydirect').handler,undefined);});
test('normal dashboard clearing preserves only the explicitly marked maintenance asset demo',()=>{
    const dashboard=fs.readFileSync('src/main/resources/static/smartapartment/js/dashboard.js','utf8');
    const start=dashboard.indexOf('function removeStaticDashboardOperationalData()');
    const end=dashboard.indexOf('\nremoveStaticDashboardOperationalData();',start);
    const demo={dataset:{maintenanceAssetDemo:'true'},innerHTML:'Demo lift'};
    const real={dataset:{},innerHTML:'Old sample',closest:()=>({querySelectorAll:()=>[1,2]})};
    vm.runInNewContext(dashboard.slice(start,end)+'\nremoveStaticDashboardOperationalData();',{document:{querySelectorAll:s=>s==='[data-view] table tbody'?[demo,real]:[]}});
    assert.equal(demo.innerHTML,'Demo lift');assert.match(real.innerHTML,/No records available/);
});
