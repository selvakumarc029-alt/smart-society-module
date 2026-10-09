const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/admin-occupancy-editor.js','utf8');
function app(platform='smartsociety') {
  const nodes=new Map(),calls=[],events=[];
  const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,handlers:{},options:[],addEventListener(t,f){this.handlers[t]=f;},replaceChildren(o){this.options=[o];},add(o){this.options.push(o);},querySelectorAll(){return [];}});return nodes.get(id);};
  const save=get('save'),form=get('form');form.elements={namedItem:get};form.reportValidity=()=>true;form.reset=()=>{};form.querySelector=()=>save;
  const dialog=get('dialog');dialog.setAttribute=()=>{};dialog.querySelector=s=>s==='form'?form:get(s.replace('#',''));dialog.querySelectorAll=()=>[];dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.handlers.close?.();};
  const context={document:{body:{dataset:{platform,dashboardRole:'admin'},append(){}},getElementById:get,createElement:()=>dialog,dispatchEvent:e=>events.push(e.type)},window:{},CustomEvent:class{constructor(type){this.type=type;}},Option:class{constructor(text,value){this.text=text;this.value=value;}},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,status:200,json:async()=>({blocks:[{block:'Block A'}]})};}};
  vm.runInNewContext(source,context);
  return {get,calls,events,dialog,context,submit:()=>form.handlers.submit({preventDefault(){}})};
}
test('block save uses tenant-scoped endpoint, trims names and refreshes occupancy',async()=>{
 const h=app();await h.get('occupancy-add-block').handlers.click();h.get('name').value=' Block B ';h.get('totalFloors').value='5';await h.submit();
 assert.equal(h.calls[0].path,'/api/society/admin-insights/blocks');assert.deepEqual(JSON.parse(h.calls[0].options.body),{name:'Block B',totalFloors:5});assert.equal(h.dialog.open,false);assert.deepEqual(h.events,['society:occupancyupdated']);
});
test('flat save includes block and room number and stays on the apartment endpoint',async()=>{
 const h=app();await h.get('occupancy-add-flat').handlers.click();for(const [key,value] of Object.entries({block:'Block A',unitNo:'A-101',floor:'1',unitType:'Room',occupancy:'AVAILABLE',ownerName:'Owner',monthlyMaintenance:'1500.25'}))h.get(key).value=value;
 await h.submit();assert.equal(h.calls[1].path,'/api/society/apartments');const payload=JSON.parse(h.calls[1].options.body);assert.equal(payload.unitNo,'A-101');assert.equal(payload.block,'Block A');assert.equal(payload.monthlyMaintenance,1500.25);assert.equal(h.dialog.open,false);
});
test('failed save retains the dialog and re-enables Save',async()=>{
 const h=app();await h.get('occupancy-add-block').handlers.click();h.get('name').value='Block A';h.get('totalFloors').value='3';h.context.fetch=async()=>({ok:false,status:409,json:async()=>({detail:'A block with this name already exists.'})});
 await h.submit();assert.equal(h.dialog.open,true);assert.equal(h.get('save').disabled,false);assert.match(h.get('occupancy-editor-message').textContent,/already exists/);assert.equal(h.events.length,0);
});
test('PropertyDirect does not initialize occupancy editor',()=>{const h=app('propertydirect');assert.equal(h.get('occupancy-add-block').handlers.click,undefined);});
