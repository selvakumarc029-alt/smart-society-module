const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/main/resources/static/smartapartment/js/worker-service-tickets.js', 'utf8');
function setup(platform = 'smartapartment', role = 'maintenance-worker') {
    const handlers = {}, calls = [], message = {}, container = {};
    const ticket = {id:11, version:3, ticketCode:'TCK-11', title:'Repair <socket>', ticketStatus:'REQUESTED'};
    let fail = false;
    const document = {body:{dataset:{platform,dashboardRole:role}},hidden:false,
        addEventListener:(name,fn)=>handlers[name]=fn,
        getElementById:id=>id==='workerServiceTickets'?container:message};
    vm.runInNewContext(source, {document, setInterval:()=>{}, fetch:async(url,options)=>{
        calls.push({url,options});
        return {ok:!fail, json:async()=>fail?{detail:'Ticket changed. Refresh.'}:options.method?{...ticket,ticketStatus:JSON.parse(options.body).ticketStatus}:[ticket]};
    }});
    const click = (status='IN_PROGRESS') => handlers.click({target:{closest:selector=>selector.includes('refresh')?null:{dataset:{serviceTicket:'11',serviceStatus:status},disabled:false}}});
    return {handlers,calls,message,container,click,setFail:value=>fail=value};
}
test('assigned ticket controls save version and refresh the displayed status from the server response',async()=>{
    const app=setup();await app.handlers.DOMContentLoaded();
    // The DOMContentLoaded callback starts the asynchronous load.
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(app.container.innerHTML,/Repair &lt;socket&gt;/);
    await app.click();
    const request=app.calls.at(-1);
    assert.equal(request.url,'/api/society/service-tickets/11/status');
    assert.deepEqual(JSON.parse(request.options.body),{ticketStatus:'IN_PROGRESS',version:3});
    assert.match(app.container.innerHTML,/IN PROGRESS/);
    assert.match(app.message.textContent,/Status saved/);
});
test('failed save retains the last confirmed status and reports the server error',async()=>{
    const app=setup();app.handlers.DOMContentLoaded();await new Promise(resolve=>setImmediate(resolve));app.setFail(true);
    await app.click('RESOLVED');
    assert.match(app.container.innerHTML,/>PENDING</);
    assert.equal(app.message.textContent,'Ticket changed. Refresh.');
    assert.equal(app.message.className,'small text-danger');
});
test('superadmin and PropertyDirect never receive worker controls or requests',()=>{
    for(const [platform,role] of [['smartapartment','superadmin'],['propertydirect','maintenance-worker']]) {
        const app=setup(platform,role);assert.equal(Object.keys(app.handlers).length,0);assert.equal(app.calls.length,0);
    }
});
test('SuperAdmin no longer renders status editing actions',()=>{
    const template=fs.readFileSync('src/main/resources/templates/dashboards/superadmin.html','utf8');
    assert.doesNotMatch(template,/updateSmartSocietyServiceRequestStatus|Quick status update:/);
    assert.doesNotMatch(template,/data-worker-ticket-action/);
});
