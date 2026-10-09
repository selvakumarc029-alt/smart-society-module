const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = require('node:fs').readFileSync('src/main/resources/static/smartapartment/js/dashboard.js','utf8');
const start = source.indexOf('async function performAction(');
const end = source.slice(start + 1).search(/\n(?:async )?function /);
const action = source.slice(start, start + 1 + end);
const button = {closest: () => ({children:[{}, {textContent:'1234567890 · resident@example.com'}]})};
function setup(fetch) {
 const context = {dashboardRole:'admin',getContext:()=>({panel:'residents'}),fetch};
 vm.createContext(context); vm.runInContext(action,context); return context;
}
test('Notify saves a trimmed message for the selected account and skips generic workflow receipts',async()=>{
 let payload; const context=setup(async(url,options)=>{assert.equal(url,'/api/society/admin-insights/resident-notifications');payload=JSON.parse(options.body);return {ok:true,json:async()=>({sent:true})};});
 const receipt=await context.performAction('notify',button,['  Check your society inbox.  ']);
 assert.deepEqual(payload,{email:'resident@example.com',message:'Check your society inbox.'}); assert.equal(receipt.persisted,true);
});
test('Notify rejects empty messages without sending',async()=>{
 const context=setup(()=>{throw Error('Must not send');});
 await assert.rejects(context.performAction('notify',button,['  ']),/Enter a message/);
});
test('server failures produce no success receipt',async()=>{
 const context=setup(async()=>({ok:false,json:async()=>({message:'Recipient was not found in this society'})}));
 await assert.rejects(context.performAction('notify',button,['Hello']),/Recipient was not found/);
});
