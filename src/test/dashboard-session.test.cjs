const {test}=require('node:test');
const assert=require('node:assert/strict');
const {install}=require('../main/resources/static/smartapartment/js/dashboard-session.js');
function setup(platform='smartapartment',role='admin'){
    const calls=[],saved=new Map([['society_dashboard_token','signed-token'],['society_dashboard_role','admin']]),listeners={};
    const win={fetch:async(...args)=>calls.push(args),location:{href:'http://localhost:8080/dashboards/society-admin',origin:'http://localhost:8080'},sessionStorage:{getItem:key=>saved.get(key),removeItem:key=>saved.delete(key)},document:{body:{dataset:{platform,dashboardRole:role}},addEventListener:(event,fn)=>listeners[event]=fn}};
    install(win);return {win,calls,saved,listeners};
}
test('society API calls retain their method and payload and use the signed identity of this tab',async()=>{
    const h=setup();await h.win.fetch('/api/society/records/vendors',{method:'PATCH',body:'{}',headers:{'If-Match':'4'}});
    assert.equal(h.calls[0][1].headers.get('Authorization'),'Bearer signed-token');
    assert.equal(h.calls[0][1].headers.get('If-Match'),'4');assert.equal(h.calls[0][1].method,'PATCH');assert.equal(h.calls[0][1].body,'{}');
});
test('tokens are never forwarded to external hosts, PropertyDirect or another dashboard role',async()=>{
    for(const [platform,role,path] of [['smartapartment','admin','https://other.example/api/society/me'],['propertydirect','admin','/api/society/me'],['smartapartment','resident','/api/society/me'],['smartapartment','admin','/api/property/listings']]){
        const h=setup(platform,role);await h.win.fetch(path);assert.equal(h.calls[0][1].headers,undefined);
    }
});
test('explicit bearer authentication is preserved and logout clears tab credentials',async()=>{
    const h=setup();await h.win.fetch('/api/society/me',{headers:{Authorization:'Bearer explicit'}});assert.equal(h.calls[0][1].headers.get('Authorization'),'Bearer explicit');
    h.listeners.click({target:{closest:()=>true}});assert.equal(h.saved.size,0);
});
