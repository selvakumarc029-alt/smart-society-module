const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/static/smartapartment/js/dashboard-interface.js','utf8');
function setup(){
 const events={},frames=[],scrolls=[],container={scrollTop:450},scrollingElement={scrollTop:500};let active='overview';
 const document={readyState:'complete',body:{dataset:{platform:'smartapartment',dashboardRole:'superadmin'}},scrollingElement,querySelectorAll:()=>[],querySelector:s=>s==='main .topbar'?null:s.startsWith('[data-view]')?{dataset:{view:active}}:container};
 const window={location:{hash:'#overview'},addEventListener:(t,fn)=>events[t]=fn,scrollTo:options=>scrolls.push(options)};
 vm.runInNewContext(source,{document,window,Set,requestAnimationFrame:fn=>frames.push(fn)});
 return{events,frames,scrolls,container,scrollingElement,select:panel=>active=panel};
}
test('switching panels starts at the heading and coalesces click/hash navigation',()=>{
 const h=setup();h.events.click({target:{closest:()=>({})}});h.events.hashchange();assert.equal(h.frames.length,1);h.select('access-roles');h.frames.shift()();assert.equal(h.scrolls.length,1);assert.equal(h.scrolls[0].top,0);assert.equal(h.container.scrollTop,0);assert.equal(h.scrollingElement.scrollTop,0);
});
test('same-panel buttons and unrelated controls preserve the scroll position',()=>{
 const h=setup();h.events.click({target:{closest:()=>null}});assert.equal(h.frames.length,0);h.events.click({target:{closest:()=>({})}});h.frames.shift()();assert.equal(h.scrolls.length,0);assert.equal(h.container.scrollTop,450);
});
test('role dialog Close falls back correctly when Bootstrap has no instance',()=>{
 const template=fs.readFileSync('src/main/resources/templates/dashboards/superadmin.html','utf8');
 const start=template.indexOf('            const closeRolePolicyModal = () => {');
 const end=template.indexOf('            document.querySelectorAll("[data-role-policy-close]")',start);
 const classes=new Set(['show']);const bodyClasses=new Set(['role-policy-editor-open']);const attributes=new Map([['aria-modal','true']]);
 const modal={style:{display:'block'},classList:{remove:c=>classes.delete(c)},setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
 const scope={rolePolicyModal:modal,document:{body:{classList:{remove:c=>bodyClasses.delete(c)}}},bootstrap:{Modal:{getInstance:()=>null}}};
 vm.runInNewContext(template.slice(start,end)+'this.close=closeRolePolicyModal;',scope);scope.close();
 assert.equal(modal.style.display,'none');assert.equal(classes.has('show'),false);assert.equal(bodyClasses.size,0);assert.equal(attributes.get('aria-hidden'),'true');assert.equal(attributes.has('aria-modal'),false);
});
