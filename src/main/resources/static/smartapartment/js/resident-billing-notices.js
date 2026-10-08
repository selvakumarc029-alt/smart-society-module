(() => {
  'use strict';
  if(!['smartapartment','smartsociety'].includes(document.body?.dataset.platform)||document.body.dataset.dashboardRole!=='resident')return;
  document.addEventListener('DOMContentLoaded',()=>{
    const billing=document.querySelector('[data-view="billing"]');if(!billing)return;
    const section=document.createElement('section');section.className='card p-4 mb-4';section.setAttribute('aria-label','Billing notices');
    const heading=document.createElement('h3');heading.textContent='Billing notices';const status=document.createElement('p');status.setAttribute('role','status');const list=document.createElement('div');section.append(heading,status,list);billing.prepend(section);let busy=false;
    async function refresh(){if(busy||document.hidden||billing.classList.contains('d-none'))return;busy=true;
      try{const response=await fetch('/api/society/operations/notifications',{credentials:'same-origin',headers:{Accept:'application/json'}});if(response.redirected||!response.ok)throw Error('Unable to load billing notices.');const items=await response.json();if(!Array.isArray(items))throw Error('Unable to load billing notices.');
        list.replaceChildren();const notices=items.filter(n=>['DUE_REMINDER','RENT_CHANGE'].includes(n.type));status.textContent=notices.length?'Notices sent to your resident account.':'No billing notices.';
        notices.forEach(n=>{const article=document.createElement('article');article.className='border rounded-3 p-3 mb-3';const title=document.createElement('h4');title.textContent=n.title;const message=document.createElement('p');message.textContent=n.message;const date=document.createElement('small');date.textContent=n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):'';article.append(title,message,date);
          if(!n.readStatus){const button=document.createElement('button');button.type='button';button.className='btn btn-outline-primary ms-3';button.textContent='Mark as read';button.addEventListener('click',async()=>{button.disabled=true;try{const r=await fetch(`/api/society/operations/notifications/${n.id}/read`,{method:'PATCH',credentials:'same-origin'});if(!r.ok||r.redirected)throw Error('Could not mark this notice as read.');button.remove();}catch(error){status.textContent=error.message;button.disabled=false;}});article.append(button);}list.append(article);
        });
      }catch(error){status.textContent=error.message;}finally{busy=false;}
    }
    window.addEventListener('hashchange',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);refresh();
  });
})();
