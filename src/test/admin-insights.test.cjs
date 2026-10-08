const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/admin-insights.js','utf8');
class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.dataset={};this.disabled=false;this.handlers={};this.classList={toggle(){},contains(){return false;}};}
  append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;} add(option){this.children.push(option);}
  addEventListener(event,handler){this.handlers[event]=handler;} reportValidity(){return true;} contains(){return false;}
  querySelector(){return this.submit ||= new Node('button');} reset(){this.value='';} click(){this.clicked=true;}
}
function harness(platform='smartsociety',role='admin'){
  const nodes=new Map(),callbacks=[],calls=[];const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const document={body:{dataset:{platform,dashboardRole:role}},hidden:false,activeElement:null,getElementById:get,createElement:tag=>new Node(tag),querySelector(){return null;},querySelectorAll(){return [];},addEventListener:(type,fn)=>{if(type==='DOMContentLoaded')callbacks.push(fn);}};
  const context={document,console,Option:class{constructor(label,value){this.textContent=label;this.value=value;}},setInterval(){},setTimeout(){},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},Blob,window:{addEventListener(){}},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,redirected:false,json:async()=>({})};}};
  context.globalThis=context;
  const instrumented=source.replace(/\}\)\(\);\s*$/,'globalThis.insightsTest={cache,occupancy,billing,load,rentSelection};})();');
  vm.runInNewContext(instrumented,context);return {context,get,callbacks,calls};
}
test('PropertyDirect and other roles do not attach Admin feature controls',()=>{
  for(const [platform,role] of [['propertydirect','admin'],['smartsociety','resident']]){const h=harness(platform,role);assert.equal(h.callbacks.length,0);assert.equal(h.context.insightsTest,undefined);}
});
test('block and status filters show each flat once and calculate filtered totals',()=>{
  const h=harness(),f=h.context.insightsTest;
  f.cache.occupancy={blocks:[{block:'A',total:2,filled:1,available:1,unavailable:0,tenants:2,residents:2}],flats:[{id:1,block:'A',unitNo:'A101',type:'1BHK',floor:1,status:'Filled',tenants:2,residents:2,occupants:['One','Two']},{id:2,block:'A',unitNo:'A102',type:'2BHK',floor:1,status:'Available',tenants:0,residents:0,occupants:[]}]};
  h.get('insights-block').value='A';h.get('insights-occupancy-status').value='Available';f.occupancy();
  assert.equal(h.get('insights-flat-rows').children.length,1);assert.equal(h.get('insights-flat-rows').children[0].children[1].textContent,'A102');
  assert.equal(h.get('insights-occupancy-metrics').children[2].children[1].textContent,1);
});
test('billing refresh preserves an unsaved rent baseline and uses server balances',()=>{
  const h=harness(),f=h.context.insightsTest;f.cache.billing={pending:200,overdue:100,flats:[],rents:[]};f.cache.occupancy={flats:[]};
  h.get('insights-rent-form').dataset.dirty='true';h.get('insights-rent-current').value='9000';f.billing();
  assert.equal(h.get('insights-rent-current').value,'9000');assert.match(h.get('insights-billing-metrics').children[0].children[1].textContent,/200/);
});
test('notice button targets the row flat, blocks repeated clicks and restores on failure',async()=>{
  const h=harness();h.callbacks[0]();const button=new Node('button');button.dataset.noticeFlat='17';
  let resolve;h.context.fetch=(path,options)=>{h.calls.push({path,options});return new Promise(r=>resolve=r);};
  const handler=h.get('insights-dues-rows').handlers.click,event={target:{closest:()=>button}};
  const pending=handler(event);assert.equal(button.disabled,true);await handler(event);assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/society/admin-insights/dues/17/notice');
  resolve({ok:false,redirected:false,json:async()=>({message:'No pending dues'})});await pending;assert.equal(button.disabled,false);assert.equal(h.get('insights-billing-message').textContent,'No pending dues');
});
test('invalid date range sends no maintenance request',async()=>{
  const h=harness();h.get('insights-maintenance-start').value='2026-10-10';h.get('insights-maintenance-end').value='2026-10-01';
  await h.context.insightsTest.load('maintenance');assert.equal(h.calls.length,0);assert.match(h.get('insights-maintenance-message').textContent,/31 days/);
});
