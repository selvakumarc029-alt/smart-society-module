(() => {
    'use strict';
    const $ = selector => document.querySelector(selector);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const money = value => value == null ? 'Not specified' : new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
    const date = value => value ? new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
    const state = {me:null,page:'overview',listings:[],projects:[],accounts:[],applications:[],enquiries:[],visits:[],reports:[],saved:[],searches:[],audit:[],busy:false};
    const isAdmin = () => ['ADMIN','SUPERADMIN'].includes(state.me?.role);
    const isSeller = () => ['OWNER','BUILDER'].includes(state.me?.role);
    const canPost = () => isAdmin() || isSeller() && state.me.postingVerified;
    let noticeTimer;

    async function api(path, options = {}) {
        const response = await fetch(path.startsWith('/api/') ? path : `/api/property/portal${path}`, {
            credentials:'same-origin', ...options,
            headers: {Accept:'application/json', ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...options.headers}
        });
        const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(payload.errors ? Object.values(payload.errors).join('. ') : payload.message || `Request failed (${response.status})`);
            error.status = response.status; throw error;
        }
        return payload;
    }
    const send = (path, body, method='POST') => api(path,{method,body:JSON.stringify(body)});
    function notify(message,error=false) {
        const notice=$('#workspaceNotice'); notice.textContent=message; notice.hidden=false; notice.classList.toggle('error',error);
        clearTimeout(noticeTimer); noticeTimer=setTimeout(() => {notice.hidden=true;},6500);
    }
    function badge(value) {
        const cls=['APPROVED','ACTIVE','CONFIRMED','COMPLETED','RESPONDED','RESOLVED'].includes(value)?'good':['REJECTED','SUSPENDED','CANCELLED'].includes(value)?'bad':['PENDING','PENDING_APPROVAL','REQUESTED','OPEN'].includes(value)?'pending':'';
        return `<span class="badge ${cls}">${esc((value || 'NEW').replaceAll('_',' '))}</span>`;
    }
    function button(label,action,id='',kind='secondary') {return `<button type="button" class="${kind}" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;}
    function empty(title,description='New records will appear here when they are saved.') {return `<div class="state-card"><h2>${esc(title)}</h2><p>${esc(description)}</p></div>`;}
    function panel(title,body,actions='',description='') {return `<section class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div><div class="actions">${actions}</div></div>${body}</section>`;}
    function table(headers,rows) {return `<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
    function openDialog(title,body) {$('#dialogTitle').textContent=title; $('#dialogBody').innerHTML=body; if(!$('#workspaceDialog').open) $('#workspaceDialog').showModal();}
    function closeDialog() {$('#workspaceDialog').close();}
    function input(label,name,value='',type='text',extra='',full=false) {return `<label class="${full?'full':''}">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;}
    function select(label,name,options,value='',extra='') {return `<label>${esc(label)}<select name="${name}" ${extra}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('')}</select></label>`;}
    function textarea(label,name,value='',extra='') {return `<label class="full">${esc(label)}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;}
    const formActions = (label='Save') => `<div class="form-actions"><button type="submit" class="primary">${label}</button></div>`;

    function navigation() {
        const items=[['overview','Overview']];
        if(isAdmin() || isSeller() || state.listings.length) items.push(['listings','Property inventory']);
        if(isAdmin() || state.me.role==='BUILDER') items.push(['projects','Projects & units']);
        if(isAdmin()) items.push(['people','Registered customers'],['verification','Owner & builder verification']);
        items.push(['enquiries','Enquiries'],['visits','Site visits']);
        if(state.me.id) items.push(['saved','Saved properties'],['searches','Saved searches']);
        items.push(['reports','Property reports']);
        if(isAdmin()) items.push(['activity','Activity history']);
        if(state.me.id) items.push(['profile','Profile & posting access']);
        $('#workspaceNav').innerHTML=items.map(([page,label])=>`<button type="button" data-page="${page}" class="${page===state.page?'active':''}" ${page===state.page?'aria-current="page"':''}>${label}</button>`).join('');
        $('#pageTitle').textContent=items.find(([key])=>key===state.page)?.[1] || 'My workspace';
        $('#accountName').textContent=state.me.name; $('#accountRole').textContent=state.me.role.replace('SUPERADMIN','Super Admin');
        $('#accountAvatar').textContent=state.me.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
    }

    async function load() {
        if(state.busy) return; state.busy=true; $('#refreshWorkspace').disabled=true;
        try {
            state.me=await api('/me');
            const paths={listings:'/listings',projects:'/projects',enquiries:'/enquiries',visits:'/visits',reports:'/reports'};
            if(isAdmin()) Object.assign(paths,{accounts:'/accounts',applications:'/applications',audit:'/audit'});
            if(state.me.id) Object.assign(paths,{saved:'/api/property/saved',searches:'/api/property/saved-searches'});
            const entries=Object.entries(paths);
            const values=await Promise.all(entries.map(([,path])=>api(path)));
            entries.forEach(([key],index)=>{state[key]=values[index];});
            navigation(); render();
        } catch(error) {
            if(error.status===401) {
                $('#workspaceContent').innerHTML=empty('Sign in to your workspace','Your properties, enquiries and visits are available after you sign in.')+`<p class="actions"><a class="primary" href="/propertydirect?loginRequired=true">Sign in or register</a><a class="secondary" href="/propertydirect/apartments">Continue browsing</a></p>`;
                const params=new URLSearchParams(location.search);
                if(params.get('listing')) sessionStorage.setItem('propertydirect:pendingAction',JSON.stringify({listing:params.get('listing'),action:params.get('action')||'contact'}));
            } else {
                $('#workspaceContent').innerHTML=empty('Could not load this workspace',error.message)+button('Try again','reload');
                notify(error.message,true);
            }
        } finally {state.busy=false;$('#refreshWorkspace').disabled=false;}
    }

    function render() {
        const renderers={overview:overview,listings:listingPage,projects:projectPage,people:peoplePage,verification:verificationPage,enquiries:enquiryPage,visits:visitPage,saved:savedPage,searches:searchPage,reports:reportPage,activity:activityPage,profile:profilePage};
        $('#workspaceContent').innerHTML=(renderers[state.page] || overview)();
    }
    function overview() {
        const pending=state.listings.filter(l=>l.verificationStatus==='PENDING').length;
        const stats=isAdmin() ? [['Registered accounts',state.accounts.length,'people'],['Awaiting verification',state.applications.filter(x=>x.application.decision==='PENDING').length,'verification'],['Pending properties',pending,'listings'],['Open reports',state.reports.filter(r=>r.status==='OPEN').length,'reports']] :
            [['Saved properties',state.saved.length,'saved'],['Enquiries',state.enquiries.length,'enquiries'],['Upcoming visits',state.visits.filter(v=>!['CANCELLED','COMPLETED'].includes(v.visitStatus)&&new Date(v.scheduledAt)>new Date()).length,'visits'],['My listings',state.listings.length,'listings']];
        return `<div class="intro-card"><p class="eyebrow">WELCOME BACK</p><h2>${esc(state.me.name)}, everything in one place.</h2><p>${isAdmin()?'Review new accounts, verify owners and builders, and publish accurate properties with a recorded review history.':isSeller()?'Manage your property availability, customer enquiries and upcoming site visits.':'Discover a home, keep your shortlist together and follow every enquiry and visit.'}</p><div class="actions"><a class="primary" href="/propertydirect/apartments">Explore properties</a>${canPost()?button('Add a property','new-listing','','secondary'):!isAdmin()?button('Apply to post properties','go-profile'):''}</div></div>
            <div class="stats">${stats.map(([label,value,page])=>`<button class="stat" data-page="${page}"><span>${label}</span><strong>${value}</strong><small>View records →</small></button>`).join('')}</div>
            ${!isAdmin()&&state.me.application?panel('Posting application',`<p>${badge(state.me.application.decision)} ${esc(state.me.application.requestedRole)}</p><p class="muted">${esc(state.me.application.reviewNote||'Your details are awaiting administrator review. You can continue using your customer account.')}</p>`):''}
            ${panel('Recent enquiries',state.enquiries.length?enquiryCards(state.enquiries.slice(0,3)):empty('No enquiries yet','Enquiries you send or receive will appear here.'))}`;
    }
    function listingPage() {
        return panel('Property inventory',state.listings.length?table(['Property','Owner / unit','Price','Status','Actions'],state.listings.map(l=>`<tr data-search-row><td><strong>${esc(l.title)}</strong><small>${esc(l.apartmentCode)} · ${esc(l.locality)}, ${esc(l.city)}</small>${l.reviewNote?`<small>Review: ${esc(l.reviewNote)}</small>`:''}${l.rejectionReason?`<small style="color:#b91c1c;font-weight:600;">Rejection Reason: ${esc(l.rejectionReason)}</small>`:''}</td><td>${esc(state.accounts.find(a=>a.id===l.ownerId)?.name || 'Your account')}<small>${esc([l.tower,l.unitNumber].filter(Boolean).join(' / '))}</small></td><td>${money(l.price)}<small>${esc(l.listingType)}</small></td><td>${badge(l.status)}<small>${esc(l.verificationStatus)}</small></td><td><div class="actions">${button('Inspect','inspect',l.id)}${button('History','listing-history',l.id)}${canPost()?button('Edit','edit-listing',l.id)+button('Photos','photos',l.id):''}${isAdmin()&&l.status==='PENDING_APPROVAL'?button('Review','review-listing',l.id,'primary'):''}${canPost()&&['DRAFT','REJECTED','INACTIVE'].includes(l.status)?button('Submit','submit-listing',l.id,'primary'):''}${l.status==='ACTIVE'?button('Availability','availability',l.id)+ (isAdmin()?button(l.featured?'Unfeature':'Feature','feature',l.id):''):''}</div></td></tr>`)):empty('No properties submitted','Create a property draft after your posting account is verified.'),`<input class="search-input" type="search" data-filter-table placeholder="Search properties…" aria-label="Search properties">${canPost()?button('Add property','new-listing','','primary'):''}`);
    }
    function listingForm(listing={}) {
        const owners=state.accounts.filter(a=>a.postingVerified&&a.status==='ACTIVE'&&['OWNER','BUILDER'].includes(a.role));
        const currentOwner=listing.ownerId || (!isAdmin()?state.me.id:'');
        return `<form data-form="listing" data-id="${listing.id||''}" class="form-grid"><p class="form-note full">${listing.id?'Editing an approved listing sends it back for review. Existing photos are retained.':'Drafts stay private. Submit a complete property with photos for administrator approval.'}</p>
            ${isAdmin()?select('Actual owner or builder','ownerId',[['','Select verified account'],...owners.map(a=>[a.id,`${a.name} · ${a.role}`])],currentOwner,`required ${listing.id?'disabled':''}`):''}
            ${select('Builder project (optional)','projectId',[['','Standalone property'],...state.projects.map(p=>[p.id,p.name])],listing.projectId||'')}
            ${input('Tower / building','tower',listing.tower||'','text','maxlength="80"')}${input('Unit number','unitNumber',listing.unitNumber||'','text','maxlength="80"')}
            ${input('Property title','title',listing.title||'','text','required maxlength="200"',true)}
            ${select('Purpose','type',['BUY','RENT','LEASE'],listing.listingType||'RENT','required')}
            ${select('Property type','propertyType',['Apartment','Villa','Independent House','Builder Floor','Plot','Office','Shop'],listing.propertyType||'Apartment','required')}
            ${input('Project / society name','society',listing.society||'','text','required maxlength="200"')}${input('Locality','locality',listing.locality||'','text','required maxlength="160"')}
            ${input('City','city',listing.city||'','text','required maxlength="120"')}${input('Pincode','pincode',listing.pincode||'','text','required pattern="[0-9]{6}" maxlength="6"')}
            ${input('Address','address',listing.address||'','text','required maxlength="1000"',true)}
            ${input('Price / monthly rent (₹)','price',listing.price??'','number','required min="1" step="0.01"')}${input('Security deposit (₹)','deposit',listing.deposit??0,'number','min="0" step="0.01"')}
            ${input('Maintenance charges (₹)','maintenance',listing.maintenance??0,'number','min="0" step="0.01"')}${input('Area (sq ft)','areaSqft',listing.areaSqft??'','number','required min="1"')}
            ${select('Bedrooms','bhk',['Studio','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK'],listing.bhk||'2 BHK','required')}${input('Bathrooms','bathrooms',listing.bathrooms??1,'number','required min="1" max="20"')}
            ${select('Furnishing','furnishing',['Unfurnished','Semi Furnished','Fully Furnished'],listing.furnishing||'Unfurnished')}${select('Parking','parking',['None','One space','Two spaces','More than two'],listing.parking||'None')}
            ${input('Available from','availableFrom',listing.availableFrom||'','date')}${input('Amenities (comma separated)','amenities',listing.amenities||'','text','maxlength="2000"')}
            ${input('Latitude (optional)','latitude',listing.latitude??'','number','min="-90" max="90" step="any"')}${input('Longitude (optional)','longitude',listing.longitude??'','number','min="-180" max="180" step="any"')}
            ${textarea('Description','description',listing.description||'','required maxlength="4000"')}
            ${!listing.id?'<label class="full">Property photos · JPEG, PNG or WebP (up to 10)<input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp"></label>':''}
            <div class="form-actions"><button type="submit" class="secondary" name="intent" value="DRAFT">Save draft</button><button type="submit" class="primary" name="intent" value="SUBMIT">Submit for review</button></div></form>`;
    }
    function projectPage() {
        const cards=state.projects.map(p=>{
            const units=state.listings.filter(l=>l.projectId===p.id);
            return `<article class="record-card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.city)} · ${esc(p.constructionStatus)} · Registration: ${esc(p.registrationNumber)}</p><p>${esc(p.description||'')}</p><div class="actions">${badge(`${units.length} UNITS`)}${badge(`${units.filter(l=>l.status==='ACTIVE').length} AVAILABLE`)}${badge(`${units.filter(l=>['SOLD','RENTED'].includes(l.status)).length} CLOSED`)}${canPost()?button('Edit project','edit-project',p.id):''}</div>${units.length?`<p class="small">${units.map(l=>`${esc(l.tower)} / ${esc(l.unitNumber)} — ${esc(l.status)}`).join('<br>')}</p>`:''}</article>`;
        }).join('');
        return panel('Builder projects',cards||empty('No projects yet','Create a project, then attach each property to a tower and unit number.'),canPost()?button('Add project','new-project','','primary'):'');
    }
    function peoplePage() {
        return panel('Registered accounts',table(['ID','Customer / User','Contact Details','Role','Registration Date','Account Status','Verification Status','Actions'],state.accounts.map(a=>`<tr data-search-row><td><strong>#USR-${a.id}</strong></td><td><strong>${esc(a.name)}</strong>${a.companyName?`<br><small>🏢 ${esc(a.companyName)}</small>`:''}</td><td><a href="mailto:${esc(a.email)}">${esc(a.email)}</a><br><small><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></small></td><td>${badge(a.role)}</td><td>${date(a.registeredAt)}</td><td>${badge(a.status)}</td><td><span class="badge ${a.postingVerified?'good':a.applicationDecision==='PENDING'?'pending':''}">${a.postingVerified?'✓ Posting Verified':a.applicationDecision==='PENDING'?'⏳ Pending Review':'Standard Customer'}</span></td><td><div class="actions">${button('Inspect','inspect-account',a.id)}${!['ADMIN','SUPERADMIN'].includes(a.role)?button(a.status==='ACTIVE'?'Suspend':'Reactivate','account-status',a.id):''}${button(a.postingVerified?'Revoke Post':'Approve Post','toggle-posting',a.id,'primary')}</div></td></tr>`)), '<div class="table-tools"><input class="search-input" type="search" data-filter-table placeholder="Search name, email, phone or role…" aria-label="Search accounts"></div>','All customer, owner, builder and admin accounts stored permanently in the database. Passwords and hashes are strictly protected and never displayed.');
    }
    function verificationPage() {
        return panel('Owner and builder verification',state.applications.length?state.applications.map(({application:a,account:c})=>`<article class="record-card"><div class="panel-head"><div><h3>${esc(c.name)} · ${esc(a.requestedRole)}</h3><p>${esc(c.email)} · ${esc(c.phone)}</p></div>${badge(a.decision)}</div><p><strong>${esc(a.companyName||'Individual property owner')}</strong><br>Registration / reference: ${esc(a.registrationNumber||'Provided below')}</p><p>${esc(a.verificationDetails)}</p>${a.reviewNote?`<p class="reply-box">${esc(a.reviewNote)}</p>`:''}${a.decision==='PENDING'?button('Review application','review-application',a.id,'primary'):''}</article>`).join(''):empty('No verification requests'));
    }
    function enquiryCards(items) {
        return items.map(({enquiry:e,listingTitle,canReply})=>`<article class="record-card"><div class="panel-head"><div><h3>${esc(listingTitle)}</h3><p>#${e.id} · ${date(e.createdAt)}</p></div>${badge(e.status)}</div><p><strong>${esc(e.name)}</strong> · ${esc(e.email)} · ${esc(e.phone)}</p><p>${esc(e.message)}</p>${e.reply?`<div class="reply-box"><strong>Response</strong><p>${esc(e.reply)}</p><small>${date(e.repliedAt)}</small></div>`:''}${canReply?`<p>${button('Reply','reply',e.id,'primary')}</p>`:''}</article>`).join('');
    }
    function enquiryPage() {return panel('Property enquiries',state.enquiries.length?enquiryCards(state.enquiries):empty('No enquiries yet'));}
    function visitPage() {
        return panel('Site visits',state.visits.length?table(['Property','Scheduled time','Status','Actions'],state.visits.map(v=>{
            const owner=isAdmin() || v.listing.ownerId===state.me.id;
            const open=!['COMPLETED','CANCELLED'].includes(v.visitStatus);
            return `<tr><td><strong>${esc(v.listing.title)}</strong><small>${esc(v.notes||'')}</small></td><td>${date(v.scheduledAt)}</td><td>${badge(v.visitStatus)}</td><td><div class="actions">${open?button('Reschedule','reschedule',v.id)+button('Cancel','cancel-visit',v.id,'danger'):''}${owner&&open?button('Confirm','confirm-visit',v.id,'primary'):''}${owner&&v.visitStatus==='CONFIRMED'&&new Date(v.scheduledAt)<=new Date()?button('Complete','complete-visit',v.id):''}</div></td></tr>`;
        })):empty('No site visits','Request a visit from a published property to get started.'));
    }
    function savedPage() {
        return panel('Your shortlist',state.saved.length?`<div class="property-grid">${state.saved.map(s=>{const l=s.listing;return `<article class="property-tile">${l.imageUrl?`<img src="${esc(l.imageUrl)}" alt="${esc(l.title)}">`:''}<div class="tile-body">${badge(l.status)}<h3>${esc(l.title)}</h3><p>${esc(l.locality)}, ${esc(l.city)}</p><div class="price">${money(l.price)}</div><div class="actions"><a class="primary" href="/propertydirect/apartment-detail?id=${l.id}">View property</a>${button('Remove','unsave',l.id)}</div></div></article>`;}).join('')}</div>`:empty('Your shortlist is empty','Save properties while browsing to compare them here.'));
    }
    function searchPage() {
        return panel('Saved searches',state.searches.length?state.searches.map(s=>`<article class="record-card"><h3>${esc(s.name)}</h3><p>${esc(s.city||'Any city')} · ${esc(s.listingType||'Any purpose')} · ${esc(s.bhk||'Any bedrooms')}</p><p class="muted">${s.alertsEnabled?'Match alerts enabled':'Alerts disabled'}</p>${button('Find matches','search-matches',s.id,'primary')}</article>`).join(''):empty('No saved searches'),button('Save a search','new-search','','primary'));
    }
    function reportPage() {return panel('Property reports',state.reports.length?state.reports.map(r=>`<article class="record-card"><div class="panel-head"><h3>Property #${r.listingId} · Report #${r.id}</h3>${badge(r.status)}</div><p>${esc(r.reason)}</p>${r.resolution?`<p class="reply-box">${esc(r.resolution)}</p>`:''}${isAdmin()&&r.status==='OPEN'?button('Resolve report','resolve-report',r.id,'primary'):''}</article>`).join(''):empty('No reports','Reports submitted from property pages appear here.'));}
    function activityPage() {return panel('Activity history',state.audit.length?table(['Time','Action','Record','Performed by','Details'],state.audit.map(a=>`<tr><td>${date(a.createdAt)}</td><td>${esc(a.action.replaceAll('_',' '))}</td><td>${esc(a.targetType)} #${a.targetId}</td><td>${esc(a.actor)}</td><td>${esc(a.detail)}</td></tr>`)):empty('No recorded activity yet'));}
    function profilePage() {
        return panel('Your profile & search preferences',`<form data-form="profile" class="form-grid">
            ${input('Full name','name',state.me.name,'text','required maxlength="120"')}
            ${input('Phone','phone',state.me.phone,'tel','required pattern="[0-9+() -]{7,20}"')}
            ${input('Preferred City','preferredCity',state.me.preferredCity||'')}
            ${input('Preferred Locality','preferredLocality',state.me.preferredLocality||'')}
            ${select('Preferred Purpose','preferredListingType',[['','Any purpose'],['BUY','Buy / Sale'],['RENT','Rent'],['LEASE','Lease']],state.me.preferredListingType||'')}
            ${select('Preferred Property Type','preferredPropertyType',[['','Any type'],['APARTMENT','Apartment'],['VILLA','Villa'],['PLOT','Plot'],['COMMERCIAL','Commercial']],state.me.preferredPropertyType||'')}
            ${select('Preferred Bedrooms','preferredBhk',[['','Any BHK'],['1 BHK','1 BHK'],['2 BHK','2 BHK'],['3 BHK','3 BHK'],['4+ BHK','4+ BHK']],state.me.preferredBhk||'')}
            ${input('Min Budget (₹)','budgetMin',state.me.budgetMin||'','number','min="0"')}
            ${input('Max Budget (₹)','budgetMax',state.me.budgetMax||'','number','min="0"')}
            ${select('Email Match Alerts','emailAlertsEnabled',[['true','Receive email alerts for matching properties'],['false','Do not send email alerts']],String(state.me.emailAlertsEnabled!==false))}
            <p class="form-note full">Registered email: ${esc(state.me.email)}</p>
            ${formActions('Save profile & preferences')}
        </form>`)+
            panel('Apply for posting access',state.me.postingVerified?`<p>${badge('APPROVED')} Your ${esc(state.me.role.toLowerCase())} posting access is verified.</p>`:state.me.application?.decision==='PENDING'?`<p>${badge('PENDING')} Your ${esc(state.me.application.requestedRole.toLowerCase())} application is awaiting review.</p>`:`<form data-form="application" class="form-grid"><p class="form-note full">Owners post their own properties. Builders post their own projects and units. An administrator will check these details before approving posting access.</p>${select('Apply as','role',['OWNER','BUILDER'],'OWNER','required')}${input('Company name (required for builders)','companyName','','text','maxlength="160"')}${input('Registration / verification reference','registrationNumber','','text','maxlength="160"')}${textarea('Ownership or company verification details','verificationDetails','','required minlength="20" maxlength="2000"')}${state.me.application?.reviewNote?`<p class="form-note full">Previous review: ${esc(state.me.application.reviewNote)}</p>`:''}${formActions('Submit application')}</form>`);
    }

    async function showPropertyAction(id,action) {
        const listing=await api(`/api/property/listings/${encodeURIComponent(id)}`);
        if(action==='shortlist') {await send(`/api/property/saved/${id}`,{});notify('Property saved to your shortlist.');await load();return;}
        const heading=action==='visit'?'Request a site visit':action==='report'?'Report this property':'Send an enquiry';
        let fields=`<p class="form-note full">${esc(listing.title)} · ${esc(listing.locality)}, ${esc(listing.city)}</p>`;
        if(action==='visit') fields+=input('Preferred date and time','scheduledAt','','datetime-local','required')+textarea('Visit notes','notes','','maxlength="1000"');
        else if(action==='report') fields+=textarea('What is incorrect or misleading?','reason','','required minlength="10" maxlength="2000"');
        else fields+=input('Name','name',state.me.name,'text','required maxlength="120"')+input('Phone','phone',state.me.phone,'tel','required')+input('Email','email',state.me.email,'email','required')+select('Purpose','type',['GENERAL','PURCHASE','RENTAL','LEASE'])+textarea('Your enquiry','message','','required maxlength="2000"');
        openDialog(heading,`<form data-form="public-action" data-id="${id}" data-kind="${action}" class="form-grid">${fields}${formActions(heading)}</form>`);
    }

    document.addEventListener('click',async event=>{
        const nav=event.target.closest('[data-page]');
        if(nav) {state.page=nav.dataset.page;navigation();render();document.body.classList.remove('nav-open');$('#toggleNav').setAttribute('aria-expanded','false');return;}
        const target=event.target.closest('[data-action]'); if(!target) return;
        const {action,id}=target.dataset;
        target.disabled=true;
        try {
            const listing=state.listings.find(l=>String(l.id)===id);
            if(action==='reload') await load();
            else if(action==='go-profile') {state.page='profile';navigation();render();}
            else if(action==='new-listing'||action==='edit-listing') openDialog(action==='new-listing'?'New property':'Edit property',listingForm(listing));
            else if(action==='photos') openDialog('Add property photos',`<form data-form="photos" data-id="${id}" class="form-grid"><p class="form-note full">New photos on a published property return it for review. Maximum 10 photos per property.</p><label class="full">Select photos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></label>${formActions('Upload photos')}</form>`);
            else if(action==='inspect') openDialog(listing.title,`<div class="gallery">${String(listing.imageUrls||'').split('\n').filter(Boolean).map(url=>`<img src="${esc(url)}" alt="Property photo">`).join('')}</div><div class="details-grid">${Object.entries({Purpose:listing.listingType,Price:money(listing.price),Address:listing.address,City:listing.city,Locality:listing.locality,Area:listing.areaSqft,Bedrooms:listing.bhk,Bathrooms:listing.bathrooms,Furnishing:listing.furnishing,Parking:listing.parking,Amenities:listing.amenities,Availability:listing.availableFrom}).map(([k,v])=>`<div><small>${k}</small><strong>${esc(v||'Not specified')}</strong></div>`).join('')}</div><p style="margin-top:20px;white-space:pre-wrap">${esc(listing.description)}</p>`);
            else if(action==='listing-history') {
                const history = await api(`/listings/${id}/history`);
                openDialog(`Change & Review History · ${listing.title}`, history && history.length ? `
                    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
                        ${history.map(h=>`
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:6px;padding:12px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <strong style="color:#0f172a;">${esc(h.action)}</strong>
                                    <small style="color:#64748b;">${date(h.createdAt)}</small>
                                </div>
                                <div style="margin-top:4px;color:#334155;font-size:0.9rem;">${esc(h.detail || 'Status updated')}</div>
                                <small style="color:#94a3b8;margin-top:6px;display:block;">Recorded by: ${esc(h.actor || 'System')}</small>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p style="padding:16px;">No history records found for this property.</p>');
            }
            else if(action==='review-listing'||action==='review-application') openDialog('Review submission',`<form data-form="review" data-kind="${action}" data-id="${id}" class="form-grid">${select('Decision','decision',action==='review-listing'?['APPROVED','CHANGES_REQUESTED','REJECTED']:['APPROVED','REJECTED'])}${textarea('Verification result / reason','note','','required maxlength="2000"')}${formActions('Record decision')}</form>`);
            else if(action==='submit-listing') {await send(`/listings/${id}/status`,{decision:'SUBMIT'},'PATCH');notify('Property submitted for review.');await load();}
            else if(action==='availability') openDialog('Update availability',`<form data-form="availability" data-id="${id}" class="form-grid">${select('New status','decision',['SOLD','RENTED','INACTIVE'])}${textarea('Note','note','','maxlength="2000"')}${formActions('Update availability')}</form>`);
            else if(action==='feature') {await api(`/listings/${id}/featured?featured=${!listing.featured}`,{method:'PATCH'});notify('Featured status updated.');await load();}
            else if(action==='inspect-account') {
                const a=state.accounts.find(c=>String(c.id)===id);
                if(!a) return;
                const details={
                    'User ID': `#USR-${a.id}`,
                    'Full Name': a.name,
                    'Username': a.username,
                    'Email Address': a.email,
                    'Phone Number': a.phone,
                    'Platform Role': a.role,
                    'Account Status': a.status,
                    'Posting Permission': a.postingVerified ? 'Verified & Granted' : 'Standard / Unverified',
                    'Registration Date': date(a.registeredAt),
                    ...(a.companyName ? {'Company Name': a.companyName} : {}),
                    ...(a.registrationNumber ? {'RERA / Registration': a.registrationNumber} : {}),
                    ...(a.verificationDetails ? {'Verification Details': a.verificationDetails} : {}),
                    ...(a.applicationDecision ? {'Application Status': a.applicationDecision} : {}),
                    ...(a.reviewNote ? {'Review Note': a.reviewNote} : {})
                };
                openDialog(`Account Profile · ${a.name}`, `<div class="details-grid">${Object.entries(details).map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v||'None')}</strong></div>`).join('')}</div><p class="form-note full" style="margin-top:16px;">🔒 Passwords and cryptographic credentials are encrypted (BCrypt) and strictly withheld from view to protect privacy.</p><div class="actions" style="margin-top:16px;">${!['ADMIN','SUPERADMIN'].includes(a.role)?button(a.status==='ACTIVE'?'Suspend Account':'Reactivate Account','account-status',a.id):''}${button(a.postingVerified?'Revoke Posting Permission':'Grant Posting Permission','toggle-posting',a.id,'primary')}</div>`);
            }
            else if(action==='toggle-posting') {
                const a=state.accounts.find(c=>String(c.id)===id);
                if(!a) return;
                await api(`/accounts/${id}/posting-permission?verified=${!a.postingVerified}`,{method:'PATCH'});
                notify(`Posting permission ${!a.postingVerified?'granted':'revoked'} for ${a.name}.`);
                closeDialog();
                await load();
            }
            else if(action==='account-status') {const a=state.accounts.find(c=>String(c.id)===id);openDialog(`${a.status==='ACTIVE'?'Suspend':'Reactivate'} ${a.name}`,`<form data-form="account-status" data-id="${id}" class="form-grid"><input type="hidden" name="status" value="${a.status==='ACTIVE'?'SUSPENDED':'ACTIVE'}">${textarea('Reason','note','','required maxlength="2000"')}${formActions('Confirm account status')}</form>`);}
            else if(action==='new-project'||action==='edit-project') {
                const p=state.projects.find(project=>String(project.id)===id)||{};
                openDialog(p.id?'Edit builder project':'New builder project',`<form data-form="project" data-id="${p.id||''}" class="form-grid">${isAdmin()&&!p.id?select('Verified builder','builderId',[['','Select builder'],...state.accounts.filter(a=>a.role==='BUILDER'&&a.postingVerified&&a.status==='ACTIVE').map(a=>[a.id,a.name])],'','required'):''}${input('Project name','name',p.name||'','text','required maxlength="160"')}${input('City','city',p.city||'','text','required maxlength="120"')}${input('Project registration reference','registrationNumber',p.registrationNumber||'','text','required maxlength="160"')}${select('Construction status','constructionStatus',['Ready to Move','Under Construction','Planned'],p.constructionStatus||'Ready to Move')}${textarea('Project description','description',p.description||'','maxlength="2000"')}${formActions(p.id?'Save project':'Create project')}</form>`);
            }
            else if(action==='reply'||action==='resolve-report') openDialog(action==='reply'?'Reply to enquiry':'Resolve property report',`<form data-form="reply" data-kind="${action}" data-id="${id}" class="form-grid">${textarea(action==='reply'?'Response to customer':'Resolution details','reply','','required maxlength="2000"')}${formActions('Save response')}</form>`);
            else if(action==='reschedule') openDialog('Propose a new visit time',`<form data-form="reschedule" data-id="${id}" class="form-grid">${input('New date and time','scheduledAt','','datetime-local','required')}${formActions('Request new time')}</form>`);
            else if(['confirm-visit','cancel-visit','complete-visit'].includes(action)) {await send(`/visits/${id}`,{status:{'confirm-visit':'CONFIRMED','cancel-visit':'CANCELLED','complete-visit':'COMPLETED'}[action]},'PATCH');notify('Visit updated.');await load();}
            else if(action==='unsave') {await api(`/api/property/saved/${id}`,{method:'DELETE'});notify('Removed from shortlist.');await load();}
            else if(action==='new-search') openDialog('Save a property search',`<form data-form="search" class="form-grid">${input('Search name','name','','text','required')}${input('City','city')}${input('Locality','locality')}${select('Purpose','type',[['','Any purpose'],'BUY','RENT','LEASE'])}${select('Bedrooms','bhk',[['','Any bedrooms'],'1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK'])}${input('Minimum price (₹)','minPrice','','number','min="0"')}${input('Maximum price (₹)','maxPrice','','number','min="0"')}${select('Match alerts','alertsEnabled',[['true','Enabled'],['false','Disabled']])}${formActions('Save search')}</form>`);
            else if(action==='search-matches') {const result=await api(`/api/property/saved-searches/${id}/matches`);openDialog(`${result.matchCount} matching properties`,result.matches.length?result.matches.map(l=>`<article class="record-card"><h3>${esc(l.title)}</h3><p>${money(l.price)} · ${esc(l.locality)}, ${esc(l.city)}</p><a class="primary" href="/propertydirect/apartment-detail?id=${l.id}">View property</a></article>`).join(''):empty('No matches yet'));}
        } catch(error){notify(error.message,true);} finally{target.disabled=false;}
    });

    document.addEventListener('submit',async event=>{
        const form=event.target.closest('[data-form]');if(!form) return;event.preventDefault();
        if(!form.reportValidity()) return;
        const submit=event.submitter;const values=Object.fromEntries(new FormData(form));const kind=form.dataset.form,id=form.dataset.id;
        if(form.dataset.saving==='true') return;form.dataset.saving='true';if(submit) submit.disabled=true;
        try {
            if(kind==='profile') {
                const payload={...values};
                payload.budgetMin=values.budgetMin?Number(values.budgetMin):null;
                payload.budgetMax=values.budgetMax?Number(values.budgetMax):null;
                payload.emailAlertsEnabled=values.emailAlertsEnabled==='true';
                await send('/profile',payload,'PATCH');
            }
            else if(kind==='application') await send('/applications',values);
            else if(kind==='listing') {
                const listing={...values};['price','deposit','maintenance','areaSqft','bathrooms','latitude','longitude'].forEach(key=>{listing[key]=values[key]===''||values[key]==null?null:Number(values[key]);});
                listing.availableFrom=values.availableFrom||null;delete listing.photos;
                const payload={listing,ownerId:values.ownerId?Number(values.ownerId):null,projectId:values.projectId?Number(values.projectId):null,tower:values.tower,unitNumber:values.unitNumber,intent:submit?.value||'DRAFT'};
                if(id) await send(`/listings/${id}`,payload,'PUT');
                else {const data=new FormData();data.append('property',JSON.stringify(payload));[...form.elements.photos.files].forEach(file=>data.append('photos',file));await api('/listings',{method:'POST',body:data});}
            }
            else if(kind==='photos') {const data=new FormData();[...form.elements.photos.files].forEach(file=>data.append('photos',file));await api(`/listings/${id}/photos`,{method:'POST',body:data});}
            else if(kind==='review') await send(form.dataset.kind==='review-listing'?`/listings/${id}/status`:`/applications/${id}`,values,'PATCH');
            else if(kind==='availability') await send(`/listings/${id}/status`,values,'PATCH');
            else if(kind==='account-status') await send(`/accounts/${id}`,values,'PATCH');
            else if(kind==='project') await send(id?`/projects/${id}`:'/projects',{...values,builderId:values.builderId?Number(values.builderId):null},id?'PUT':'POST');
            else if(kind==='reply') await send(form.dataset.kind==='reply'?`/enquiries/${id}/reply`:`/reports/${id}`,values,'PATCH');
            else if(kind==='reschedule') await send(`/visits/${id}`,{status:'REQUESTED',scheduledAt:values.scheduledAt},'PATCH');
            else if(kind==='search') {const min=values.minPrice?Number(values.minPrice):null,max=values.maxPrice?Number(values.maxPrice):null;if(min!==null&&max!==null&&min>max) throw new Error('Maximum price must be greater than minimum price.');await send('/api/property/saved-searches',{...values,minPrice:min,maxPrice:max,alertsEnabled:values.alertsEnabled==='true'});}
            else if(kind==='public-action') {
                const action=form.dataset.kind;
                await send(action==='visit'?'/api/property/visits':action==='report'?'/reports':'/api/property/enquiries',{...values,listingId:Number(id)});
            }
            closeDialog();notify(kind==='public-action'?'Your request was saved and is visible in the relevant dashboards.':'Changes saved successfully.');await load();
        }catch(error){notify(error.message,true);}finally{delete form.dataset.saving;if(submit) submit.disabled=false;}
    });
    document.addEventListener('input',event=>{
        if(event.target.matches('[data-filter-table]')) {const q=event.target.value.toLowerCase();$('#workspaceContent').querySelectorAll('[data-search-row]').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(q);});}
        if(event.target.matches('[name="ownerId"]')) {
            const project=event.target.form.elements.projectId;
            const options=state.projects.filter(p=>String(p.builderId)===event.target.value);
            project.innerHTML='<option value="">Standalone property</option>'+options.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
        }
    });
    $('#refreshWorkspace').addEventListener('click',load);$('#closeDialog').addEventListener('click',closeDialog);
    $('#toggleNav').addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');$('#toggleNav').setAttribute('aria-expanded',String(open));});
    $('#workspaceDialog').addEventListener('click',event=>{if(event.target===$('#workspaceDialog')) {const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) closeDialog();}});
    async function start() {
        const initialTab=new URLSearchParams(location.search).get('tab');
        if(initialTab==='profile') state.page='profile';
        await load(); if(!state.me) return;
        let pending;try {pending=JSON.parse(sessionStorage.getItem('propertydirect:pendingAction')||'null');}catch(_){pending=null;}
        const params=new URLSearchParams(location.search);const id=params.get('listing')||pending?.listing,action=params.get('action')||pending?.action||'contact';
        if(id && /^\d+$/.test(String(id)) && ['contact','owner','visit','shortlist','report'].includes(action)) {
            sessionStorage.removeItem('propertydirect:pendingAction');history.replaceState(null,'','/propertydirect/workspace');
            try {await showPropertyAction(id,action);}catch(error){notify(error.message,true);}
        }
    }
    start();
    setInterval(()=>{if(!document.hidden && !$('#workspaceDialog').open && ['overview','people','verification'].includes(state.page) && !$('#workspaceContent').querySelector('input:focus')) load();},15000);
})();
