(() => {
  'use strict';
  if (document.body?.dataset.platform !== 'smartsociety' || document.body.dataset.dashboardRole !== 'admin') return;
  const blockButton = document.getElementById('occupancy-add-block');
  const flatButton = document.getElementById('occupancy-add-flat');
  if (!blockButton || !flatButton) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'occupancy-editor';
  dialog.setAttribute('aria-labelledby', 'occupancy-editor-title');
  dialog.innerHTML = `<form id="occupancy-editor-form">
    <header><h3 id="occupancy-editor-title"></h3><button type="button" data-editor-close aria-label="Close">×</button></header>
    <p id="occupancy-editor-description"></p>
    <div id="occupancy-block-fields"><label>Block name<input name="name" required maxlength="100" placeholder="e.g. Block B"></label><label>Total floors<input name="totalFloors" type="number" required min="1" max="200" value="1"></label></div>
    <div id="occupancy-flat-fields">
      <label>Block<select name="block" required><option value="">Select block</option></select></label>
      <label>Flat / room number<input name="unitNo" required maxlength="100" placeholder="e.g. B-101"></label>
      <label>Floor number<input name="floor" type="number" required min="0" max="200" value="0"><small>Use 0 for the ground floor.</small></label>
      <label>BHK / flat type<select name="unitType" required><option value="">Select type</option><option>Studio</option><option>1BHK</option><option>2BHK</option><option>3BHK</option><option>4BHK</option><option>Room</option><option>Other</option></select></label>
      <label>Occupancy<select name="occupancy" required><option value="AVAILABLE">Available</option><option value="OCCUPIED">Filled</option><option value="UNDER_MAINTENANCE">Under maintenance</option></select></label>
      <label>Owner / landlord name<input name="ownerName" required maxlength="150"></label>
      <label>Monthly maintenance (₹)<input name="monthlyMaintenance" type="number" min="0" step="0.01" value="0"></label>
    </div>
    <p id="occupancy-editor-message" role="status" aria-live="polite"></p>
    <footer><button type="button" class="btn btn-outline-secondary" data-editor-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></footer>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), message = dialog.querySelector('#occupancy-editor-message');
  const save = form.querySelector('[type="submit"]');
  const fields = name => form.elements.namedItem(name);
  let mode = 'block', opening = 0, saving = false;
  async function request(path, options = {}) {
    const response = await fetch(path, {credentials:'same-origin', ...options, headers:{Accept:'application/json','Content-Type':'application/json'}});
    if (response.redirected || response.status === 401) throw Error('Sign in with your society admin account to save records.');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.detail || data.message || data.error || 'Unable to save. Please try again.');
    return data;
  }
  async function open(kind) {
    if (dialog.open) return;
    mode = kind; const generation = ++opening;
    form.reset(); message.textContent = ''; save.disabled = kind === 'flat';
    dialog.querySelector('#occupancy-editor-title').textContent = kind === 'block' ? 'Add Block' : 'Add Flat / Room';
    dialog.querySelector('#occupancy-editor-description').textContent = kind === 'block' ? 'Create a block for this society, then add its flats or rooms.' : 'Register a flat or room in an existing society block. Use a unique number such as B-101.';
    for (const [id, active] of [['occupancy-block-fields',kind==='block'], ['occupancy-flat-fields',kind==='flat']]) {
      const group = dialog.querySelector('#'+id); group.hidden = !active;
      group.querySelectorAll('input,select').forEach(input => input.disabled = !active);
    }
    save.textContent = kind === 'block' ? 'Save Block' : 'Save Flat';
    dialog.showModal();
    if (kind === 'flat') {
      fields('block').replaceChildren(new Option('Loading blocks…', ''));
      try {
        const data = await request('/api/society/admin-insights/occupancy');
        if (generation !== opening || !dialog.open) return;
        fields('block').replaceChildren(new Option('Select block', ''));
        data.blocks.filter(block=>block.block!=='Unassigned block').forEach(block => fields('block').add(new Option(block.block,block.block)));
        if (fields('block').options.length === 1) throw Error('Add a block first, then add its flats or rooms.');
        save.disabled = false;
      } catch (error) { if (generation === opening && dialog.open) message.textContent = error.message; }
    }
  }
  blockButton.addEventListener('click', () => open('block'));
  flatButton.addEventListener('click', () => open('flat'));
  dialog.querySelectorAll('[data-editor-close]').forEach(button=>button.addEventListener('click',()=>{ if(!saving) dialog.close(); }));
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  dialog.addEventListener('keydown', event=>{if(event.key==='Escape')event.stopPropagation();});
  dialog.addEventListener('close',()=>opening++);
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(save.disabled || !form.reportValidity()) return;
    const value = name=>fields(name).value.trim();
    const payload = mode === 'block' ? {name:value('name'),totalFloors:Number(value('totalFloors'))} : {block:value('block'),unitNo:value('unitNo'),floor:Number(value('floor')),unitType:value('unitType'),occupancy:value('occupancy'),ownerName:value('ownerName'),monthlyMaintenance:Number(value('monthlyMaintenance')),ownerPhone:'',ownerEmail:'',parkingSlot:'',notes:''};
    if (mode==='block' ? !payload.name : !payload.unitNo || !payload.ownerName) { message.textContent='Complete the required fields.'; return; }
    saving=true; save.disabled=true; message.textContent='Saving…';
    try {
      await request(mode==='block'?'/api/society/admin-insights/blocks':'/api/society/apartments',{method:'POST',body:JSON.stringify(payload)});
      dialog.close();
      document.dispatchEvent(new CustomEvent('society:occupancyupdated'));
      if(typeof window.loadSocietyBackendData==='function') window.loadSocietyBackendData();
    } catch(error) { message.textContent=error.message; }
    finally { saving=false; save.disabled=false; }
  });
})();
