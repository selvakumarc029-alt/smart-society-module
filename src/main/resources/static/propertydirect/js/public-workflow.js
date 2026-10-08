/* Public property actions share the authenticated, server-backed workspace. */
(() => {
    'use strict';
    const chips=document.getElementById('aiPromptChips');
    if(chips) {
        chips.replaceChildren(...['2 BHK','3 BHK','Villa'].map(query=>{
            const button=document.createElement('button');button.type='button';button.textContent=query;
            button.addEventListener('click',()=>{document.getElementById('listingSearch').value=query;document.getElementById('listingSearchButton').click();});
            return button;
        }));
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
