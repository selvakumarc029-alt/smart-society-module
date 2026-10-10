(() => {
  'use strict';
  if (!['smartapartment','smartsociety'].includes(document.body?.dataset.platform) || document.body.dataset.dashboardRole !== 'admin') return;
  const root='/api/society/admin-insights', cache={}, busy=new Set();
  const $=id=>document.getElementById(id);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const currency=n=>Number(n||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});
  const when=value=>value?new Date(value).toLocaleString('en-IN'):'—';
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const duration=n=>`${Math.floor(Number(n||0)/60)}h ${Number(n||0)%60}m`;
  async function api(path,options={}) {
    const response=await fetch(root+path,{credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},...options});
    const data=await response.json().catch(()=>({}));
    if(response.redirected||response.status===401)throw Error('Sign in with your society admin account to load saved records.');
    if(response.status===403)throw Error('Your account does not have access to these society admin records.');
    if(response.status===404)throw Error('This dashboard API is unavailable. Restart the Smart Society server with the latest build.');
    if(!response.ok)throw Error(data.detail||data.message||data.error||'Unable to load data. Try Refresh again.');
    return data;
  }
  function message(kind,text,error=false){const n=$(`insights-${kind}-message`);if(n){n.textContent=text;n.classList.toggle('text-danger',error);}}
  function table(id,rows,columns,action) {
    const body=$(id);body.replaceChildren();
    if(!rows.length){const tr=el('tr'),td=el('td','No records for this selection.','text-muted text-center py-4');td.colSpan=columns.length+(action?1:0);tr.append(td);body.append(tr);return;}
    rows.forEach(row=>{const tr=el('tr');columns.forEach(fn=>tr.append(el('td',fn(row)??'—')));if(action){const td=el('td');td.append(action(row));tr.append(td);}body.append(tr);});
  }
  function metrics(id,items){const box=$(id);box.replaceChildren();items.forEach(([label,value])=>{const article=el('article',null,'insights-metric');article.append(el('span',label),el('strong',value));box.append(article);});}
  function fillSelect(select,options,placeholder){const value=select.value;select.replaceChildren(new Option(placeholder,''));options.forEach(([label,id])=>select.add(new Option(label,String(id))));if(options.some(([,id])=>String(id)===value))select.value=value;}
  function occupancy(){
    const data=cache.occupancy;if(!data)return;
    const block=$('insights-block').value,status=$('insights-occupancy-status').value,search=$('insights-flat-search').value.trim().toLowerCase();
    const rows=data.flats.filter(r=>(!block||r.block===block)&&(!status||r.status===status)&&(!search||`${r.unitNo} ${r.occupants.join(' ')} ${r.type||''}`.toLowerCase().includes(search)));
    metrics('insights-occupancy-metrics',[['Total tenants',rows.reduce((n,r)=>n+Number(r.tenants),0)],['Filled flats',rows.filter(r=>r.status==='Filled').length],['Available flats',rows.filter(r=>r.status==='Available').length],['Total registered flats',rows.length]]);
    table('insights-block-rows',data.blocks.filter(r=>!block||r.block===block),[r=>r.block,r=>r.total,r=>r.filled,r=>r.available,r=>r.unavailable,r=>r.tenants,r=>r.residents]);
    table('insights-flat-rows',rows,[r=>r.block,r=>r.unitNo,r=>r.type,r=>r.floor,r=>r.status,r=>r.tenants,r=>r.occupants.join(', ')||'No active residents']);
    cache.occupancyExport=rows;
  }
  function maintenance(){
    const d=cache.maintenance;
    metrics('insights-maintenance-metrics',[['Maintenance workers',d.workers],['Attendance records',d.attendance.filter(r=>r.checkIn).length],['Checkouts',d.attendance.filter(r=>r.checkOut).length],['Break time',duration(d.attendance.reduce((n,r)=>n+r.breakMinutes,0))]]);
    table('insights-maintenance-rows',d.attendance,[r=>r.name,r=>r.date,r=>when(r.checkIn),r=>when(r.checkOut),r=>r.status,r=>`${duration(r.breakMinutes)} (${r.breakCount} breaks)`,r=>duration(r.workingMinutes),r=>r.notes]);
    table('insights-work-report-rows',d.reports,[r=>r.reference,r=>r.worker,r=>r.title,r=>r.flat,r=>r.status,r=>r.notes||'No report note recorded',r=>when(r.updatedAt)]);
  }
  function security(){const d=cache.security;metrics('insights-security-metrics',[['Recorded logins',d.sessions.length],['Signed out',d.sessions.filter(r=>r.endReason==='SIGNED_OUT').length],['Sessions without recorded end',d.sessions.filter(r=>!r.logout).length]]);
    table('insights-security-rows',d.sessions,[r=>r.name,r=>when(r.login),r=>when(r.logout),r=>r.endReason==='SIGNED_OUT'?'Signed out':r.endReason==='SESSION_ENDED'?'Session ended / expired':'No logout recorded']);
    table('insights-security-duty-rows',d.attendance,[r=>r.name,r=>r.date,r=>when(r.checkIn),r=>when(r.checkOut)]);
  }
  function billing(){const d=cache.billing;
    metrics('insights-billing-metrics',[['Pending maintenance dues',currency(d.pending)],['Overdue amount',currency(d.overdue)],['Flats with pending dues',d.flats.length]]);
    table('insights-dues-rows',d.flats,[r=>r.block,r=>r.unitNo,r=>currency(r.pending),r=>currency(r.overdue),r=>r.invoices.map(i=>`${i.reference||i.month}: ${currency(i.amount)} · Due ${i.dueDate||'not set'}`).join('\n')],r=>{const button=el('button','Send dues notice','btn btn-outline-primary');button.type='button';button.dataset.noticeFlat=r.apartmentId;return button;});
    table('insights-rent-rows',d.rents,[r=>r.unitNo,r=>r.landlord,r=>currency(r.previousRent),r=>currency(r.monthlyRent),r=>r.effectiveDate,r=>r.effectiveDate>localDate()?'Scheduled':'Effective',r=>r.notes]);
    if($('insights-rent-form').dataset.dirty!=='true'){
      const rentFlat=$('insights-rent-flat');if(cache.occupancy)fillSelect(rentFlat,cache.occupancy.flats.map(f=>[`${f.block} · ${f.unitNo} · ${f.type||'Type not set'}`,f.id]),'Select flat');
      rentSelection();
    }
  }
  function rentSelection(){const id=Number($('insights-rent-flat').value);const latest=cache.billing?.rents.find(r=>r.apartmentId===id);const flat=cache.occupancy?.flats.find(f=>f.id===id);
    $('insights-rent-current').readOnly=!!latest;$('insights-rent-current').value=latest?latest.monthlyRent:'';$('insights-landlord').value=latest?.landlord||flat?.landlord||'';
    $('insights-rent-form').dataset.latestId=latest?.id||'';
  }
  async function load(kind,automatic=false){
    if(busy.has(kind))return;busy.add(kind);
    const refresh=document.querySelector(`[data-insights-refresh="${kind}"]`);if(refresh)refresh.disabled=true;
    if(!automatic)message(kind,'Loading saved records…');
    try{
      let query='';if(['maintenance','security'].includes(kind)){const start=$(`insights-${kind}-start`),end=$(`insights-${kind}-end`);if(!start.reportValidity()||!end.reportValidity())return;if(end.value<start.value||Math.round((new Date(end.value)-new Date(start.value))/86400000)>30)throw Error('Choose a date range of up to 31 days.');query=`?start=${start.value}&end=${end.value}`;}
      cache[kind]=await api('/'+kind+query);
      if(kind==='occupancy'){fillSelect($('insights-block'),cache.occupancy.blocks.map(r=>[r.block,r.block]),'All blocks');occupancy();if(cache.billing)billing();}
      else if(kind==='billing'){if(!cache.occupancy)cache.occupancy=await api('/occupancy');billing();}
      else if(kind==='maintenance')maintenance();else security();
      message(kind,'Updated '+new Date().toLocaleTimeString('en-IN'));
    }catch(error){message(kind,error.message,true);}finally{busy.delete(kind);if(refresh)refresh.disabled=false;}
  }
  function download(kind){const rows=kind==='occupancy'?cache.occupancyExport:kind==='maintenance'?cache.maintenance?.attendance:kind==='reports'?cache.maintenance?.reports:kind==='security'?cache.security?.sessions:cache.billing?.flats;
    if(!rows?.length){message(kind==='reports'?'maintenance':kind,'There are no records to export.',true);return;}
    const cols=kind==='occupancy'?['block','unitNo','type','floor','status','tenants','residents']:kind==='maintenance'?['name','date','checkIn','checkOut','status','breakMinutes','breakCount','workingMinutes','notes']:kind==='reports'?['reference','worker','title','flat','status','notes','updatedAt']:kind==='security'?['name','login','logout','endReason']:['block','unitNo','pending','overdue'];
    const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
    const csv='\ufeff'+[cols,...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download=`society-${kind}-${localDate()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    for(const kind of ['maintenance','security'])for(const suffix of ['start','end'])$(`insights-${kind}-${suffix}`).value=localDate();
    $('insights-rent-date').min=localDate();$('insights-rent-date').value=localDate();
    ['insights-block','insights-occupancy-status'].forEach(id=>$(id).addEventListener('change',occupancy));$('insights-flat-search').addEventListener('input',occupancy);$('insights-rent-flat').addEventListener('change',()=>{rentSelection();$('insights-rent-new').value='';$('insights-rent-note').value='';});
    $('insights-rent-form').addEventListener('input',()=>{$('insights-rent-form').dataset.dirty='true';});
    $('insights-rent-reset').addEventListener('click',()=>{const form=$('insights-rent-form');form.reset();form.dataset.dirty='false';$('insights-rent-date').value=localDate();load('billing');});
    document.querySelectorAll('[data-insights-refresh]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.insightsRefresh)));
    document.querySelectorAll('[data-insights-export]').forEach(b=>b.addEventListener('click',()=>download(b.dataset.insightsExport)));
    document.querySelectorAll('[data-insights-date-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();load(form.dataset.insightsDateForm);}));
    $('insights-dues-rows').addEventListener('click',async event=>{
      const b=event.target.closest('[data-notice-flat]');if(!b||b.disabled)return;
      const label=b.textContent;
      let feedback=b.parentElement?.querySelector('[data-notice-feedback]');
      if(!feedback&&b.parentElement){feedback=el('div',null,'small mt-2');feedback.dataset.noticeFeedback='true';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');b.parentElement.append(feedback);}
      const report=(text,error=false)=>{message('billing',text,error);if(feedback){feedback.textContent=text;feedback.classList.toggle('text-danger',error);feedback.classList.toggle('text-success',!error);}};
      b.disabled=true;b.textContent='Sending…';report('Sending a notice to this flat’s residents…');
      try{const result=await api(`/dues/${b.dataset.noticeFlat}/notice`,{method:'POST'});report(result.message||'Dues notice sent.');}
      catch(error){report(error.message,true);}
      finally{b.disabled=false;b.textContent=label;}
    });
    $('insights-rent-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled||!form.reportValidity())return;const id=$('insights-rent-flat').value;if(!id)return;
      const data={currentRent:Number($('insights-rent-current').value),newRent:Number($('insights-rent-new').value),effectiveDate:$('insights-rent-date').value,landlordName:$('insights-landlord').value.trim(),notes:$('insights-rent-note').value.trim(),expectedLatestId:form.dataset.latestId?Number(form.dataset.latestId):null};
      if(data.newRent<=data.currentRent){message('billing','New rent must be greater than current rent.',true);return;}
      button.disabled=true;try{const result=await api('/rents/'+id,{method:'POST',body:JSON.stringify(data)});form.reset();form.dataset.dirty='false';$('insights-rent-date').value=localDate();await load('billing');message('billing',result.message);}catch(error){message('billing',error.message,true);}finally{button.disabled=false;}
    });
    const panelKind={'occupancy':'occupancy','maintenance-overview':'maintenance','security-access':'security','billing':'billing'};
    function visible(){for(const [panel,kind] of Object.entries(panelKind)){const node=document.querySelector(`[data-view="${panel}"]`);if(node&&!node.classList.contains('d-none')&&!node.hidden)return kind;}}
    document.addEventListener('society:panelchange',event=>{const kind=panelKind[event.detail.panel];if(kind)load(kind);});
    document.addEventListener('society:occupancyupdated',()=>load('occupancy'));
    window.addEventListener('hashchange',()=>{const kind=visible();if(kind)load(kind);});const kind=visible();if(kind)load(kind);
    setInterval(()=>{if(!document.hidden){const kind=visible();if(kind&&!$('insights-rent-form').contains(document.activeElement))load(kind,true);}},30000);
  });
})();
