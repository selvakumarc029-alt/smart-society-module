const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/gate-management.js','utf8');
function harness(data,platform='smartsociety') {
 const listeners={};const nodes={gateManagementPanel:{},gateRows:{replaceChildren(){},innerHTML:''},gateGuardCards:{innerHTML:''},gateAssignmentStatus:{}};let dialog;
 vm.runInNewContext(source,{document:{body:{dataset:{dashboardRole:'admin',platform},appendChild(d){dialog=d;}},addEventListener(type,fn){(listeners[type]??=[]).push(fn);},getElementById(id){return nodes[id];},createElement(){return {style:{},querySelector(){return {};},showModal(){this.open=true;}};}},window:{},location:{hash:'#overview'},setInterval(){},fetch:async path=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>path.endsWith('gate-guards')?data:[]})});
 return {nodes,listeners,get dialog(){return dialog;},async load(){for(const fn of listeners.DOMContentLoaded||[])await fn();},click(){for(const fn of listeners.click||[])fn({target:{closest(selector){return selector==='[data-guard-details]'?{dataset:{guardGate:'2',guardDetails:'7'}}:null;}}});}};
}
test('cards show gate and presence; details include phone and escaped profile values',async()=>{
 const h=harness([{id:2,gateNumber:'Gate 2',gateName:'East',status:'ACTIVE',guards:[{id:7,name:'Guard <script>',phone:'9876543210',presence:'Signed in at gate',signedInAt:'2026-10-09T06:00:00Z',employeeId:'SEC-7'}]}]);await h.load();
 assert.match(h.nodes.gateGuardCards.innerHTML,/Gate 2/);assert.match(h.nodes.gateGuardCards.innerHTML,/Signed in at gate/);assert.match(h.nodes.gateGuardCards.innerHTML,/Guard &lt;script&gt;/);h.click();assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/9876543210/);assert.match(h.dialog.innerHTML,/SEC-7/);assert.match(h.dialog.innerHTML,/Emergency phone/);assert.match(h.dialog.innerHTML,/Not recorded/);
});
test('unstaffed gates do not invent a present guard',async()=>{const h=harness([{id:2,gateNumber:'Gate 2',guards:[]}]);await h.load();assert.match(h.nodes.gateGuardCards.innerHTML,/No guard assigned or signed in/);});
test('feature does not mount in PropertyDirect',async()=>{const h=harness([],'propertydirect');assert.equal(Object.keys(h.listeners).length,0);});
