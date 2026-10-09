const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const source=require('node:fs').readFileSync('src/main/resources/static/smartapartment/js/home-services-pricing-admin.js','utf8');
const start=source.indexOf('    async function loadAdminPackages()');
const code=source.slice(start,source.indexOf('    function updateCatalogKpis()',start));
function setup(response){
 const grid={innerHTML:''};let rendered=0;
 const ctx={document:{getElementById:()=>grid},fetch:async()=>response,escapeHtml:s=>s,console:{error(){}},renderAdminCategoryCards:()=>rendered++,updateCatalogKpis(){},_activeModalCategoryKey:null};
 vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,grid,rendered:()=>rendered};
}
test('login redirect never attempts to parse HTML as JSON',async()=>{
 let parsed=false;const h=setup({ok:true,redirected:true,json:async()=>{parsed=true;throw Error('HTML');}});
 await h.ctx.loadAdminPackages();assert.equal(parsed,false);assert.match(h.grid.innerHTML,/Sign out and sign in again/);
});
test('non-JSON response has a readable error',async()=>{
 const h=setup({ok:true,headers:{get:()=> 'text/html'}});await h.ctx.loadAdminPackages();assert.match(h.grid.innerHTML,/unexpected response/);
});
test('valid live package array renders the catalogue',async()=>{
 const h=setup({ok:true,headers:{get:()=> 'application/json'},json:async()=>[{id:1,price:299}]});await h.ctx.loadAdminPackages();assert.equal(h.rendered(),1);
});
