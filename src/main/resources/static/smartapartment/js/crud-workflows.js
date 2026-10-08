(function(root){
    'use strict';
    const field=(name,label,type='text',required=false,extra={})=>({name,label,type,required,...extra});
    const contact=[field('phone','Phone','tel'),field('address','Address'),field('emergencyContactName','Emergency contact'),field('emergencyContactPhone','Emergency phone','tel'),field('notes','Notes')];
    const schemas={
        apartments:{label:'Flats',fields:[field('unitNo','Flat number','text',true),field('ownerName','Owner name','text',true),field('occupancy','Occupancy','select',true,{options:['VACANT','OCCUPIED','UNDER_MAINTENANCE']}),field('block','Block','text',true),field('floor','Floor','number',true,{min:0,step:1}),field('unitType','Flat type','text',true),field('ownerPhone','Owner phone','tel'),field('ownerEmail','Owner email','email'),field('builtUpAreaSqFt','Area (sq.ft)','number',false,{min:0,step:1}),field('parkingSlot','Parking slot'),field('monthlyMaintenance','Monthly maintenance','number',false,{min:0,step:0.01}),field('possessionDate','Possession date','date'),field('notes','Notes','textarea',false,{max:1000})]},
        residents:{label:'Residents',account:true,fields:[field('name','Name','text',true),field('email','Login email','email',true,{immutable:true}),field('unitNo','Flat number','text',true),field('residentType','Resident type','select',true,{options:['OWNER','TENANT','FAMILY_MEMBER','FAMILY']}),field('moveInDate','Move-in date','date'),field('vehicleNumber','Vehicle number'),...contact,field('temporaryPassword','Initial password','password',true,{createOnly:true,minLength:8,max:72})]},
        'team-users':{label:'Society team',account:true,fields:[field('name','Name','text',true),field('email','Login email','email',true,{immutable:true}),field('role','Role','select',true,{immutable:true,options:['SECURITY_STAFF','MAINTENANCE_STAFF','ACCOUNTANT']}),field('designation','Designation','text',true),field('employeeId','Employee ID'),field('joiningDate','Joining date','date'),field('workShift','Work shift'),...contact,field('temporaryPassword','Initial password','password',true,{createOnly:true,minLength:8,max:72})]},
        amenities:{label:'Amenities',fields:[field('name','Name','text',true),field('capacity','Capacity','number',true,{min:1,step:1}),field('bookingFee','Booking fee','number',true,{min:0,step:0.01}),field('approvalRequired','Administrator approval required','checkbox')]},
        vendors:{label:'Vendors',fields:[field('name','Vendor name','text',true,{max:150}),field('category','Service category','text',true,{max:100}),field('phone','Phone','tel',true,{max:30}),field('email','Email','email',false,{max:150}),field('taxNumber','GST / tax number','text',false,{max:50})]},
        parking:{label:'Parking',fields:[field('slot','Slot number','text',true),field('unitNo','Flat number','text',true),field('vehicleNumber','Vehicle number'),field('vehicleType','Vehicle type')]},
        events:{label:'Events',fields:[field('title','Title','text',true),field('venue','Venue','text',true),field('startsAt','Start','datetime-local',true),field('endsAt','End','datetime-local',true),field('description','Description','textarea',false,{max:2000})]},
        documents:{label:'Documents',fields:[field('name','Name','text',true),field('category','Category','text',true),field('contentType','File type (e.g. application/pdf)','text',true),field('storageUrl','Document URL or local path','text',true)]}
    };
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function payload(resource,values,editing=false){
        const schema=schemas[resource];if(!schema)throw new Error('Unknown record category.');
        const result={};
        for(const f of schema.fields){
            if(editing&&(f.createOnly||f.immutable))continue;
            let value=values[f.name];
            if(f.type==='checkbox')value=value===true||value==='on'||value==='true';
            else if(f.type==='number'){
                if(value===''||value==null){if(f.required)throw new Error(`${f.label} is required.`);value=null;}
                else {value=Number(value);if(!Number.isFinite(value)||value<(f.min??0)||(f.step===1&&!Number.isInteger(value)))throw new Error(`Enter a valid ${f.label.toLowerCase()}.`);}
            }else{value=f.type==='password'?String(value??''):String(value??'').trim();if(f.required&&!value)throw new Error(`${f.label} is required.`);if(value.length>(f.max??255))throw new Error(`${f.label} is too long.`);if(f.minLength&&value.length<f.minLength)throw new Error(`${f.label} needs at least ${f.minLength} characters.`);if(f.options&&!f.options.includes(value))throw new Error(`Choose a valid ${f.label.toLowerCase()}.`);if(['date','datetime-local'].includes(f.type)&&!value)value=null;}
            result[f.name]=value;
        }
        return result;
    }
    async function request(url,method='GET',body,version,fetcher=root.fetch?.bind(root)){
        const headers={Accept:'application/json','Content-Type':'application/json'};
        if(version!==undefined)headers['If-Match']=String(version);
        const response=await fetcher(url,{method,credentials:'same-origin',headers,body:body===undefined?undefined:JSON.stringify(body)});
        const text=await response.text();let data=null;try{data=text?JSON.parse(text):response.status===204?{}:null;}catch(_){}
        if(response.redirected||response.status===401)throw new Error('Your session expired. Sign in again before saving.');
        if(!response.ok||data===null){const fields=data?.errors?Object.entries(data.errors).map(([name,message])=>`${name}: ${message}`).join('; '):'';throw new Error(fields||data?.message||data?.error||(response.status===403?'You do not have permission for this action.':'The operation could not be completed. Please retry.'));}
        return data;
    }
    if(typeof module!=='undefined'&&module.exports){module.exports={schemas,payload,request};return;}
    if(!root.document||document.body.dataset.platform==='propertydirect')return;
    const role=document.body.dataset.dashboardRole;
    root.smartCrudRequest=request;
    const api='/api/society/records/';
    async function refresh(){if(typeof root.loadSocietyBackendData==='function')await root.loadSocietyBackendData();if(typeof root.refreshAccountantRecords==='function')await root.refreshAccountantRecords();}
    function receipt(title,result){return {title,persisted:true,lines:[`<strong>Record reference:</strong> ${esc(result.id??'Saved')}`]};}
    root.performPersistedCrudAction=async function(action,button,values){
        if(role!=='admin')return null;
        const table=button.dataset.table||button.closest('table')?.dataset.table;
        let resource=null,data=null,method='POST',id=null;
        if(action==='add'&&table==='flats'){resource='apartments';data=root.flatPayload(values);}
        else if(action==='save'&&button.closest('table[data-table="flats"]')){resource='apartments';id=button.closest('tr')?.dataset.recordId;data=root.flatPayload(values,button.closest('tr'));method='PATCH';}
        else if(action==='add'&&table==='residents'){resource='residents';data={name:values[0],email:values[1],phone:values[2],unitNo:values[3],residentType:values[4],moveInDate:values[5]||null,vehicleNumber:values[6],address:values[7],emergencyContactName:values[8],emergencyContactPhone:values[9],notes:values[10],temporaryPassword:values[11]};}
        else if(action==='add'&&['security-users','maintenance-users','accountant-users'].includes(table)){resource='team-users';data={name:values[0],email:values[1],phone:values[2],role:{'security-users':'SECURITY_STAFF','maintenance-users':'MAINTENANCE_STAFF','accountant-users':'ACCOUNTANT'}[table],designation:values[3],employeeId:values[4],joiningDate:values[5]||null,workShift:values[6],address:values[7],emergencyContactName:values[8],emergencyContactPhone:values[9],notes:values[10],temporaryPassword:values[11]};}
        else if(action==='amenity-price-edit'){resource='amenities';id=button.dataset.amenityId;method='PATCH';data={name:values[0],capacity:values[1],bookingFee:values[2],approvalRequired:values[3]==='Yes'};}
        if(resource){
            let version;
            if(method==='PATCH'){if(!id)throw new Error('Refresh the list and select a saved record.');version=button.dataset.version??button.closest('tr')?.dataset.version;if(version===undefined||version==='undefined')throw new Error('Refresh the page before editing this record.');}
            const result=await request(api+resource+(id?'/'+encodeURIComponent(id):''),method,payload(resource,data,method==='PATCH'),version);
            await refresh();return receipt(method==='POST'?'Record created':'Record updated',result);
        }
        if(action==='add'&&table==='expenses'){
            const amount=Number(String(values[2]??'').replace(/[^\d.-]/g,''));if(!Number.isFinite(amount)||amount<=0)throw new Error('Enter a positive expense amount.');
            const result=await request('/api/society/finance/expenses','POST',{category:values[0],vendor:values[1],amount,date:new Date().toLocaleDateString('en-CA')});await refresh();return receipt('Expense recorded',result);
        }
        if(action==='add'&&['visitors','complaints'].includes(table)){
            const residents=await request('/api/society/residents');const unit=table==='visitors'?values[3]:values[1];const resident=residents.find(r=>r.unitNo===unit);if(!resident)throw new Error('Choose a flat with an active resident.');
            const data=table==='visitors'?{name:values[0],phone:values[1],email:values[2],residentId:resident.id,unitNo:unit,entryType:values[4],purpose:values[5],personsCount:Number(values[6]),expectedAt:values[7],vehicleNumber:values[8],idProofType:values[9],idProofNumber:values[10],photoReference:values[11],specialInstructions:values[12]}:{title:values[0],residentId:resident.id,category:values[2],subcategory:values[3],priority:values[4],incidentAt:values[5]||null,locationDetails:values[6],preferredContactMethod:values[7],reporterPhone:values[8],accessPermission:values[9]==='Yes',assignedTo:values[10]==='Unassigned'?'':values[10],attachmentReference:values[11],description:values[12]};
            const result=await request('/api/society/'+table,'POST',data);await refresh();return receipt('Record created',result);
        }
        if(action==='amenity-booking'){
            const names=['amenityId','residentId','startTime','endTime','eventType','eventPurpose','expectedGuests','childrenCount','vehicleCount','organizerName','organizerPhone','organizerEmail','setupStyle','equipmentRequired','cateringDetails','decorationDetails','accessibilityNeeds','vehicleDetails','paymentMethod','paymentReference','securityDeposit','depositStatus','emergencyContact','termsAccepted','specialInstructions'];
            const data=Object.fromEntries(names.map((name,index)=>[name,values[index]]));for(const key of ['amenityId','residentId','expectedGuests','childrenCount','vehicleCount','securityDeposit'])data[key]=Number(data[key]);data.termsAccepted=data.termsAccepted==='Yes';
            const result=await request('/api/society/bookings/admin','POST',data);await refresh();return receipt('Amenity booking recorded',result);
        }
        return null;
    };
    if(!['admin','accountant'].includes(role))return;
    let manager=null,editor=null,currentResource=role==='accountant'?'vendors':'apartments',records=[],loadGeneration=0;
    const pending=new Set();
    function dialog(title){const d=document.createElement('dialog');d.className='smart-record-dialog';d.setAttribute('aria-label',title);document.body.appendChild(d);d.addEventListener('close',()=>d.remove());return d;}
    function status(message){const target=manager?.querySelector('[data-record-status]');if(target)target.textContent=message;}
    async function load(){
        const generation=++loadGeneration,resource=currentResource;status('Loading records…');
        try{const data=await request(api+resource);if(generation!==loadGeneration||!manager?.isConnected)return false;if(!Array.isArray(data))throw new Error("The saved-record list could not be loaded. Please refresh.");records=data;render();status(`${records.length} saved record(s)`);return true;}catch(error){if(generation===loadGeneration){records=[];render();status(error.message);}return false;}
    }
    function render(){
        const body=manager?.querySelector('tbody');if(!body)return;
        const query=manager.querySelector('[data-record-search]').value.trim().toLowerCase();
        const rows=records.filter(record=>[record.name,record.ownerName,record.unitNo,record.title,record.slot,record.email,record.id].some(value=>String(value??'').toLowerCase().includes(query)));
        body.innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.name||r.unitNo||r.title||r.slot)}</strong><small class="d-block text-muted">#${esc(r.id)} · ${esc(r.email||r.ownerName||r.category||r.venue||r.unitNo||'')}</small></td><td>${esc(r.accountLocked?'Access locked':r.status||'ACTIVE')}</td><td class="text-end"><button type="button" class="btn btn-sm btn-outline-primary" data-record-edit="${r.id}">Edit</button> <button type="button" class="btn btn-sm btn-outline-danger" data-record-delete="${r.id}" ${schemas[currentResource].account&&r.status==='INACTIVE'?'disabled':''}>${schemas[currentResource].account?'Deactivate':'Delete'}</button></td></tr>`).join(''):'<tr><td colspan="3">No matching records.</td></tr>';
    }
    function openManager(){
        if(manager?.isConnected){manager.focus();return;}
        manager=dialog('Manage saved society records');
        manager.innerHTML=`<div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3"><h2 class="h5 mb-0">Manage saved records</h2><button type="button" class="btn btn-light" data-record-close>Close</button></div><div class="smart-record-toolbar"><label>Category<select class="form-select" data-record-resource>${Object.entries(schemas).filter(([key])=>role==='admin'||key==='vendors').map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select></label><label>Search<input class="form-control" type="search" data-record-search></label><button type="button" class="btn btn-outline-primary" data-record-refresh>Refresh</button><button type="button" class="btn btn-primary" data-record-create>Add record</button></div><p role="status" aria-live="polite" data-record-status></p><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Record</th><th>Status</th><th class="text-end">Actions</th></tr></thead><tbody></tbody></table></div>`;
        manager.querySelector('[data-record-resource]').value=currentResource;
        manager.querySelector('[data-record-resource]').onchange=e=>{currentResource=e.target.value;records=[];render();load();};
        manager.querySelector('[data-record-search]').oninput=render;
        manager.querySelector('[data-record-close]').onclick=()=>manager.close();
        manager.querySelector('[data-record-refresh]').onclick=load;
        manager.querySelector('[data-record-create]').onclick=()=>openEditor();
        manager.addEventListener('click',async event=>{
            const edit=event.target.closest('[data-record-edit]'),remove=event.target.closest('[data-record-delete]');
            if(edit){openEditor(records.find(r=>String(r.id)===edit.dataset.recordEdit));return;}
            if(!remove||remove.disabled)return;
            const record=records.find(r=>String(r.id)===remove.dataset.recordDelete),resource=currentResource;
            if(!record||!confirm(schemas[resource].account?'Deactivate this account? Login access will be disabled and history preserved.':'Delete this record? This cannot be undone.'))return;
            const key=resource+'/'+record.id;if(pending.has(key))return;pending.add(key);remove.disabled=true;
            try{const result=await request(api+key,'DELETE',undefined,record.version);await refresh().catch(()=>{});if(await load())status(result.message);}catch(error){status(error.message);}finally{pending.delete(key);if(remove.isConnected)remove.disabled=false;}
        });
        manager.showModal();load();
    }
    function openEditor(record){
        if(editor?.isConnected)return;
        const resource=currentResource,schema=schemas[resource],editing=Boolean(record),opener=document.activeElement;
        editor=dialog(editing?'Edit record':'Add record');
        editor.innerHTML=`<form><h2 class="h5 mb-3">${editing?'Edit':'Add'} · ${schema.label}</h2><div class="smart-record-fields">${schema.fields.filter(f=>!editing||!f.createOnly).map(f=>{
            const value=record?.[f.name]??'',readonly=editing&&f.immutable;
            const attrs=`name="${f.name}" ${f.required?'required':''} ${readonly?'disabled':''} maxlength="${f.max??255}" ${f.min!==undefined?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''} ${f.minLength?`minlength="${f.minLength}"`:''}`;
            const control=f.type==='select'?`<select class="form-select" ${attrs}>${f.options.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea class="form-control" ${attrs}>${esc(value)}</textarea>`:`<input class="${f.type==='checkbox'?'form-check-input':'form-control'}" type="${f.type}" ${attrs} ${f.type==='checkbox'?(value?'checked':''):`value="${esc(value)}"`} ${f.type==='password'?'autocomplete="new-password"':''}>`;
            return `<label>${esc(f.label)}${control}</label>`;
        }).join('')}</div>${schema.account&&editing?'<p class="small text-muted mt-3">Login email, role and password stay unchanged. Account deactivation preserves its history.</p>':''}<p role="alert" class="text-danger" data-record-error></p><div class="d-flex gap-2 justify-content-end mt-3"><button type="button" class="btn btn-light" data-record-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        const d=editor;d.addEventListener('close',()=>{editor=null;if(opener?.isConnected)opener.focus();});
        d.querySelector('[data-record-cancel]').onclick=()=>d.close();
        d.querySelector('form').onsubmit=async event=>{
            event.preventDefault();const form=event.target,save=form.querySelector('[type="submit"]');if(save.disabled||!form.reportValidity())return;
            save.disabled=true;d.querySelector('[data-record-cancel]').disabled=true;d.oncancel=e=>e.preventDefault();
            try{const result=await request(api+resource+(editing?'/'+record.id:''),editing?'PATCH':'POST',payload(resource,Object.fromEntries(new FormData(form)),editing),editing?record.version:undefined);d.close();await refresh().catch(()=>{});if(await load())status(`Record ${result.id??''} saved successfully.`);}
            catch(error){d.querySelector('[data-record-error]').textContent=error.message;}
            finally{save.disabled=false;d.querySelector('[data-record-cancel]').disabled=false;d.oncancel=null;}
        };d.showModal();
    }
    function init(){
        const container=role==='admin'?document.querySelector('[data-view="residents"] .card-header'):document.querySelector('[data-view="vendors"] .card-header');
        if(!container||container.querySelector('[data-record-manager]'))return;
        const button=document.createElement('button');button.type='button';button.className='btn btn-outline-primary btn-sm rounded-pill';button.dataset.recordManager='true';button.textContent=role==='admin'?'Manage saved records':'Manage vendors';button.onclick=openManager;container.appendChild(button);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='undefined'?globalThis:window);
