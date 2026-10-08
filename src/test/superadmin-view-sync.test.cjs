const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/templates/dashboards/superadmin.html','utf8');
const start=source.indexOf('let isSyncingSuperadminCards = false;');
const end=source.indexOf('setTimeout(window.syncSuperadminCardViews, 800);',start);
function harness(throws=false){
    const observers=[];const table={};let renders=0;
    class Observer{
        constructor(callback){this.callback=callback;this.active=false;this.pending=false;observers.push(this);}
        observe(source){this.source=source;this.active=true;}
        disconnect(){this.active=false;this.pending=false;}
    }
    function write(){observers.filter(o=>o.active&&o.source===table).forEach(o=>o.pending=true);}
    const window={syncSocietiesCardViews(){renders++;write();if(throws)throw new Error('render failure');}};
    const document={getElementById:()=>null,querySelector:selector=>selector==='table[data-table="societies"] tbody'?table:null};
    vm.runInNewContext(source.slice(start,end),{window,document,MutationObserver:Observer});
    function flush(){let batches=0;while(observers.some(o=>o.pending)){if(++batches>5)throw new Error('Observer feedback loop');for(const o of observers){if(o.pending){o.pending=false;o.callback();}}}return batches;}
    return {window,observers,write,flush,get renders(){return renders;}};
}
test('a source table change renders cards once without an observer feedback loop',()=>{
    const h=harness();h.write();assert.equal(h.flush(),1);assert.equal(h.renders,1);
    h.write();assert.equal(h.flush(),1);assert.equal(h.renders,2);
});
test('manual synchronization does not enqueue another source-table refresh',()=>{
    const h=harness();h.window.syncSuperadminCardViews();assert.equal(h.flush(),0);assert.equal(h.renders,1);
});
test('observers reconnect after a failed render so future changes are still detected',()=>{
    const h=harness(true);assert.throws(()=>h.window.syncSuperadminCardViews(),/render failure/);
    assert.equal(h.observers.filter(o=>o.active).length,1);h.write();assert.throws(()=>h.flush(),/render failure/);
});

test("JavaScript nested arrays do not become Thymeleaf inline expressions",()=>{assert.equal(source.includes("[["),false);});
