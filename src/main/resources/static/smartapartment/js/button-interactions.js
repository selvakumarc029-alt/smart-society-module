(function () {
    'use strict';
    if (document.body?.dataset.platform === 'propertydirect') return;

    // The existing action modal records its workflow on confirmation. Do not let
    // the older capture bridge also save an action when merely opening that modal.
    window.addEventListener('click', function (event) {
        const button = event.target.closest?.('button[data-action]');
        if (!button || button.disabled || button.closest('form, .modal, .dropdown-menu')
            || typeof window.openActionModal !== 'function' || button.dataset.smartPersisting === 'true') return;
        const previous = button.dataset.smartPersisting;
        button.dataset.smartPersisting = 'true';
        setTimeout(function () {
            if (previous === undefined) delete button.dataset.smartPersisting;
            else button.dataset.smartPersisting = previous;
        }, 0);
    }, true);

    const demoSelectors = '#waVoiceCallModal, #waVideoCallModal';
    function resetDemo(modal) {
        modal.querySelectorAll('[data-demo-control]').forEach(button => {
            button.setAttribute('aria-pressed','false'); button.classList.remove('active');
            if (button.dataset.demoControl === 'microphone') { button.title='Mute Microphone'; button.setAttribute('aria-label',button.title); }
            if (button.dataset.demoControl === 'camera') { button.title='Camera Switch'; button.setAttribute('aria-label','Switch demo camera'); }
            if (button.dataset.demoControl === 'speaker') button.setAttribute('aria-label','Turn demo speaker on');
        });
        const status=modal.querySelector('[data-demo-status]'); if(status)status.textContent='';
    }
    function updateDemo(button, modal) {
        let control=button.dataset.demoControl;
        if (!control) {
            control=/microphone/i.test(button.title) ? 'microphone' : /speaker/i.test(button.title) ? 'speaker' : /camera/i.test(button.title) ? 'camera' : '';
            if (!control) return;
            button.dataset.demoControl=control;
        }
        const pressed=button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed',String(pressed)); button.classList.toggle('active',pressed);
        let message='';
        if(control==='microphone'){button.title=pressed?'Unmute Microphone':'Mute Microphone';button.setAttribute('aria-label',button.title);message=pressed?'Microphone muted in demo.':'Microphone unmuted in demo.';}
        if(control==='speaker'){button.setAttribute('aria-label',pressed?'Turn demo speaker off':'Turn demo speaker on');message=pressed?'Demo speaker on.':'Demo speaker off.';}
        if(control==='camera'){button.setAttribute('aria-label',pressed?'Switch demo to front camera':'Switch demo to rear camera');message=pressed?'Rear camera selected in demo.':'Front camera selected in demo.';}
        let status=modal.querySelector('[data-demo-status]');
        if(!status){status=document.createElement('p');status.dataset.demoStatus='true';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.className='small text-center text-white mt-2';modal.firstElementChild.appendChild(status);}
        status.textContent=message;
    }
    document.addEventListener('click',function(event){
        const button=event.target.closest?.('button');
        const modal=event.target.closest?.(demoSelectors);
        if(modal && event.target===modal){const close=modal.id==='waVoiceCallModal'?window.endVoiceCall:window.endVideoCall;if(typeof close==='function')close();resetDemo(modal);return;}
        if(button && modal){
            if(/endVoiceCall|endVideoCall/.test(button.getAttribute('onclick')||'')){resetDemo(modal);return;}
            if(/microphone|speaker|camera/i.test(button.title) || button.dataset.demoControl)updateDemo(button,modal);
        }
        const feature=event.target.closest?.('.showcase-badges button');
        if(!feature)return;
        const label=feature.textContent.toLowerCase();
        const index=/complaint/.test(label)?4:/visitor/.test(label)?2:/payment|bills|receipts/.test(label)?3:1;
        const dot=document.querySelectorAll('#phoneDots button')[index];
        if(!dot)return;
        dot.click();
        document.querySelectorAll('.showcase-badges button').forEach(item=>item.setAttribute('aria-pressed',String(item===feature)));
        document.getElementById('phoneCarousel')?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    });
    document.addEventListener('keydown',function(event){
        if(event.key!=='Escape')return;
        document.querySelectorAll(demoSelectors).forEach(modal=>{if(modal.style.display==='none')return;const close=modal.id==='waVoiceCallModal'?window.endVoiceCall:window.endVideoCall;if(typeof close==='function')close();resetDemo(modal);});
    });
    function init(){
        document.querySelectorAll(`${demoSelectors}`).forEach(modal=>modal.querySelectorAll('button[title]').forEach(button=>{button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','false');}));
        document.querySelectorAll('.showcase-badges button').forEach(button=>button.setAttribute('aria-pressed','false'));
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
