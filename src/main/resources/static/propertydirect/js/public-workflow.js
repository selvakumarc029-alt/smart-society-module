/* Public property actions share the authenticated, server-backed workspace. */
(() => {
    'use strict';
    const chips=document.getElementById('aiPromptChips');
    if(chips) {
        if (!chips.children.length) {
            chips.replaceChildren(...[
                { label: '✨ 3 BHK below 80L', query: '3 BHK house in Chennai below 80 lakhs' },
                { label: '✨ 2 BHK under 50L', query: '2 BHK apartment near Chennai under 50 lakh with parking' },
                { label: '✨ Luxury Villa', query: 'Luxury Villa with swimming pool and gym' }
            ].map(item=>{
                const button=document.createElement('button');
                button.type='button';
                button.textContent=item.label;
                button.addEventListener('click',()=>{
                    const input = document.getElementById('listingSearch');
                    if (input) { input.value = item.query; document.getElementById('listingSearchButton')?.click(); }
                });
                return button;
            }));
        } else {
            chips.querySelectorAll('button').forEach(btn => {
                btn.style.cursor = 'pointer';
            });
        }
    }
    document.addEventListener('click', event => {
        const trigger=event.target.closest('[data-detail-action], .apartment-card [data-action], [data-open-modal="post"]');
        if(!trigger) return;
        const action=trigger.dataset.detailAction || trigger.dataset.action || 'post';
        if(!['shortlist','visit','report','post'].includes(action)) return;
        const card=trigger.closest('[data-listing-id]');
        const id=card?.dataset.listingId || new URLSearchParams(location.search).get('id');
        event.preventDefault();event.stopImmediatePropagation();
        if(action==='post') {location.assign('/propertydirect/workspace?tab=profile');return;}
        if(!id || !/^\d+$/.test(id)) return;
        const pending={listing:id,action:action==='owner'?'contact':action};
        sessionStorage.setItem('propertydirect:pendingAction',JSON.stringify(pending));
        location.assign(`/propertydirect/workspace?listing=${encodeURIComponent(id)}&action=${encodeURIComponent(pending.action)}`);
    },true);
})();
