const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/templates/dashboards/society-admin.html','utf8');
const begin=source.indexOf('        window.handleAdminMaintSend = async function(e)');
const end=source.indexOf('        window.startAdminMaintRealtime',begin);
function harness(conversationId,response){
  const input={value:'Actual repair message'},alerts=[],calls=[];
  const scope={window:{},document:{getElementById:()=>input},activeAdminMaintChat:{conversationId,ticketNumber:'saved-ticket',ticketTitle:'Repair'},
    alert:message=>alerts.push(message),console,fetch:async(url,options)=>{calls.push({url,options});return response;},
    loadAdminMaintMessages:async()=>{},loadAdminMaintThreads:()=>{}};
  vm.runInNewContext(source.slice(begin,end),scope);
  return {scope,input,alerts,calls};
}
test('admin reply without a selected saved conversation makes no request',async()=>{
  const h=harness('',{ok:true});await h.scope.window.handleAdminMaintSend({preventDefault(){}});
  assert.equal(h.calls.length,0);assert.equal(h.input.value,'Actual repair message');assert.equal(h.alerts.length,1);
});
test('failed admin message persistence restores text and reports failure',async()=>{
  const h=harness('saved-conversation',{ok:false});await h.scope.window.handleAdminMaintSend({preventDefault(){}});
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'/api/chat/send');
  assert.equal(h.input.value,'Actual repair message');assert.match(h.alerts[0],/could not be saved/);
});
test('successful admin message persistence refreshes the saved conversation',async()=>{
  const h=harness('saved-conversation',{ok:true});let loaded;
  h.scope.loadAdminMaintMessages=async id=>{loaded=id;};await h.scope.window.handleAdminMaintSend({preventDefault(){}});
  assert.equal(loaded,'saved-conversation');assert.equal(h.input.value,'');assert.equal(h.alerts.length,0);
});
