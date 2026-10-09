const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/main/resources/templates/propertydirect/dashboards/customer.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add id="headerBecomeOwnerBtn" to header button if not present
const oldHeaderBtn = '<button type="button" class="secondary" data-panel="become-owner" style="border:1px solid #10b981; color:#065f46; background:#ecfdf5; font-weight:800;">🏠 Apply for Owner Posting</button>';
const newHeaderBtn = '<button type="button" class="secondary" data-panel="become-owner" id="headerBecomeOwnerBtn" style="border:1px solid #10b981; color:#065f46; background:#ecfdf5; font-weight:800;">🏠 Apply for Owner Posting</button>';

if (content.includes(oldHeaderBtn)) {
  content = content.replace(oldHeaderBtn, newHeaderBtn);
  console.log('✓ Header button updated with ID');
}

// 2. Replace the become-owner section
const panelStartTag = '<!-- ================= BECOME PROPERTY OWNER PANEL ================= -->';
const panelEndTag = '<section class="dash-panel hidden" data-view="plans">';

const startIndex = content.indexOf(panelStartTag);
const endIndex = content.indexOf(panelEndTag);

if (startIndex !== -1 && endIndex !== -1) {
  const newPanelHtml = `<!-- ================= BECOME PROPERTY OWNER PANEL ================= -->
        <section class="dash-panel hidden" data-view="become-owner">
            <div class="dash-card become-owner-card" style="width:100%; box-sizing:border-box; padding:28px 32px; background:#ffffff; border-radius:18px; border:1px solid #e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                <!-- Card Header -->
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; border-bottom:1px solid #f1f5f9; padding-bottom:22px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color:#059669; display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow:0 2px 8px rgba(16,185,129,0.15); flex-shrink:0;">
                            🏠
                        </div>
                        <div>
                            <h2 style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0 0 4px 0; letter-spacing:-0.01em;">Apply to Become Property Owner</h2>
                            <p style="font-size:0.88rem; color:#64748b; margin:0; line-height:1.4;">Upgrade your customer account to list, sell, and rent properties directly with 100% verified zero brokerage.</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-size:0.78rem; font-weight:800; padding:6px 14px; border-radius:999px;">
                            <i class="fa-solid fa-shield-halved"></i> Direct Owner Verification Portal
                        </span>
                    </div>
                </div>

                <!-- Dynamic Application Status Card (Shown when application exists) -->
                <div id="ownerAppStatusCard" style="display:none; padding:22px 24px; border-radius:16px; margin-bottom:26px; border:1px solid #cbd5e1; background:#ffffff;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="width:38px; height:38px; border-radius:10px; background:#fef3c7; color:#b45309; display:inline-flex; align-items:center; justify-content:center; font-size:1.15rem;" id="ownerAppIcon">⏳</span>
                            <div>
                                <strong style="font-size:0.95rem; color:#0f172a; display:block;">Owner Posting Application</strong>
                                <span id="ownerAppSubmittedTime" style="font-size:0.76rem; color:#64748b;">Submitted to Platform Administrators</span>
                            </div>
                        </div>
                        <span id="ownerAppBadge" style="padding:6px 14px; border-radius:999px; font-size:0.8rem; font-weight:800;">—</span>
                    </div>
                    <p id="ownerAppMsg" style="font-size:0.88rem; color:#334155; margin:0 0 14px 0; line-height:1.5;"></p>
                    
                    <!-- Submitted Details Box -->
                    <div id="ownerAppDetailsBox" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px; margin-bottom:16px; font-size:0.84rem; color:#334155; line-height:1.5;">
                        <span style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:6px;">Verification Details Sent to Admin Dashboard:</span>
                        <div id="ownerAppNote" style="color:#0f172a; word-break:break-word; font-family:inherit;"></div>
                    </div>

                    <!-- 3-Step Verification Progress Indicator -->
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:16px; padding-top:16px; border-top:1px solid #f1f5f9; font-size:0.78rem; gap:8px;">
                        <div style="display:flex; align-items:center; gap:6px; color:#059669; font-weight:700;">
                            <i class="fa-solid fa-circle-check"></i> 1. Details Submitted
                        </div>
                        <div style="flex:1; height:2px; background:#a7f3d0; margin:0 8px;"></div>
                        <div id="stepAdminReview" style="display:flex; align-items:center; gap:6px; color:#d97706; font-weight:700;">
                            <i class="fa-solid fa-spinner fa-spin"></i> 2. Admin Reviewing
                        </div>
                        <div style="flex:1; height:2px; background:#e2e8f0; margin:0 8px;"></div>
                        <div id="stepVerified" style="display:flex; align-items:center; gap:6px; color:#94a3b8; font-weight:600;">
                            <i class="fa-regular fa-circle"></i> 3. Direct Posting Active
                        </div>
                    </div>

                    <!-- Actions -->
                    <div id="ownerAppActions" style="margin-top:18px; display:flex; justify-content:flex-end; gap:10px;">
                        <button type="button" id="editOwnerAppBtn" style="padding:9px 18px; border-radius:10px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-size:0.82rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-pen-to-square"></i> Edit / Update Details
                        </button>
                        <a id="goToOwnerDashboardLink" href="/propertydirect/dashboards/owner" style="display:none; padding:9px 20px; border-radius:10px; background:#059669; color:#ffffff; font-size:0.82rem; font-weight:800; text-decoration:none;">
                            Go to Property Owner Dashboard →
                        </a>
                    </div>
                </div>

                <!-- Structured Submission Form -->
                <form id="becomeOwnerForm" style="display:flex; flex-direction:column; gap:20px;">
                    <!-- Connected Account Strip -->
                    <div style="background:#f8fafc; padding:16px 20px; border-radius:14px; border:1px solid #e2e8f0;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                            <span style="font-size:0.74rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.06em;">Connected Customer Account</span>
                            <span style="background:#e0f2fe; color:#0369a1; font-size:0.74rem; font-weight:700; padding:3px 10px; border-radius:999px;">
                                <i class="fa-solid fa-user-check"></i> Customer Profile Active
                            </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:24px; flex-wrap:wrap; font-size:0.88rem; color:#0f172a;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-user" style="color:#94a3b8; font-size:0.85rem;"></i>
                                <strong id="custMeName">PropertyDirect Customer</strong>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; color:#475569;">
                                <i class="fa-solid fa-envelope" style="color:#94a3b8; font-size:0.85rem;"></i>
                                <span id="custMeEmail">customer@propertydirect.in</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; color:#475569;">
                                <i class="fa-solid fa-phone" style="color:#94a3b8; font-size:0.85rem;"></i>
                                <span id="custMePhone">8778293269</span>
                            </div>
                        </div>
                    </div>

                    <!-- Row 1: Property Type & Unit -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px;">
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:800; color:#334155; margin-bottom:6px;">
                                Property Type & Posting Intent *
                            </label>
                            <select id="ownerPropType" required style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; background:#ffffff; color:#0f172a; outline:none; height:46px;">
                                <option value="Residential Apartment (For Rent)">Residential Apartment (For Rent)</option>
                                <option value="Residential Apartment (For Sale)">Residential Apartment (For Sale)</option>
                                <option value="Independent House / Villa (For Rent)">Independent House / Villa (For Rent)</option>
                                <option value="Independent House / Villa (For Sale)">Independent House / Villa (For Sale)</option>
                                <option value="Residential Plot / Land (For Sale)">Residential Plot / Land (For Sale)</option>
                                <option value="Commercial Space / Office (Rent or Lease)">Commercial Space / Office (Rent or Lease)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:800; color:#334155; margin-bottom:6px;">
                                Unit / House Number & Building Name *
                            </label>
                            <input type="text" id="ownerPropUnit" required placeholder="e.g. Flat 402, Oakwood Heights, Tower B"
                                style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none; height:46px;">
                        </div>
                    </div>

                    <!-- Row 2: Locality & Document Type -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:18px;">
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:800; color:#334155; margin-bottom:6px;">
                                Locality, Area & City *
                            </label>
                            <input type="text" id="ownerPropLocality" required placeholder="e.g. Indiranagar, 100ft Road, Bengaluru - 560038"
                                style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none; height:46px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:800; color:#334155; margin-bottom:6px;">
                                Ownership Proof Document Type *
                            </label>
                            <select id="ownerDocType" required style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; background:#ffffff; color:#0f172a; outline:none; height:46px;">
                                <option value="Registered Sale Deed">Registered Sale Deed / Title Deed</option>
                                <option value="Property Tax / Khata Certificate">Property Tax Receipt / Khata (A-Khata / B-Khata)</option>
                                <option value="Electricity / Utility Bill">Electricity / BESCOM / Utility Consumer Bill</option>
                                <option value="Builder Allotment / Possession Letter">Builder Allotment Letter / Possession Certificate</option>
                                <option value="Encumbrance Certificate (EC)">Encumbrance Certificate (EC)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Row 3: Document Reference Number -->
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:800; color:#334155; margin-bottom:6px;">
                            Document / Registration Reference Number *
                        </label>
                        <input type="text" id="ownerDocRef" required placeholder="e.g. DOC-KA-BLR-2023-882194 or Utility Consumer ID: 4491028"
                            style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none; height:46px;">
                        <small style="color:#64748b; font-size:0.76rem; display:block; margin-top:4px;">
                            Platform administrators cross-reference this registration number during verification.
                        </small>
                    </div>

                    <!-- Row 4: Verification Notes & Declaration -->
                    <div>
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                            <label style="font-size:0.82rem; font-weight:800; color:#334155;">
                                Ownership Verification Notes & Declaration *
                            </label>
                            <span id="charCountBadge" style="font-size:0.75rem; color:#64748b; font-weight:700;">
                                0 / 20 chars min
                            </span>
                        </div>
                        <textarea id="ownerVerificationNotes" required rows="3"
                            placeholder="Confirm sole ownership, current occupancy status (vacant / tenant occupied), or specific notes for the verifying administrator..."
                            style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; resize:vertical; outline:none; font-family:inherit;"></textarea>
                        <small style="color:#64748b; font-size:0.76rem; display:block; margin-top:4px;">
                            Min. 20 characters required. Our platform administrators verify property documents to maintain a 100% verified, broker-free marketplace.
                        </small>
                    </div>

                    <!-- Row 5: Trust Note & Submit Button -->
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:18px; border-top:1px solid #f1f5f9; flex-wrap:wrap; gap:16px;">
                        <div style="display:flex; align-items:center; gap:10px; font-size:0.82rem; color:#475569;">
                            <div style="width:34px; height:34px; border-radius:50%; background:#ecfdf5; color:#059669; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <i class="fa-solid fa-check"></i>
                            </div>
                            <div>
                                <strong style="display:block; color:#0f172a;">Admin Review Queue</strong>
                                <span style="color:#64748b;">Submissions directly appear in the Admin Verifications table for immediate approval.</span>
                            </div>
                        </div>
                        <button type="submit" id="submitOwnerAppBtn" class="primary"
                            style="background:linear-gradient(135deg, #059669 0%, #047857 100%); color:#ffffff; padding:13px 28px; border-radius:12px; font-weight:800; font-size:0.92rem; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(5,150,105,0.25); display:inline-flex; align-items:center; gap:8px; transition:all 0.2s ease;">
                            <span>Submit Application for Admin Review</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </form>
            </div>
        </section>

        `;
  content = content.substring(0, startIndex) + newPanelHtml + content.substring(endIndex);
  console.log('✓ become-owner section updated');
} else {
  console.error('Failed to find panel tags:', { startIndex, endIndex });
}

// 3. Update tab switching script around switchTab
const oldSwitchBlock = `                var activeBtn = document.querySelector('.sidebar-nav [data-panel="' + panelId + '"]');
                var titleElem = document.getElementById("panelTitle");
                if (activeBtn && titleElem) {
                    var text = activeBtn.textContent.trim();
                    titleElem.textContent = text;
                }`;

const newSwitchBlock = `                var activeBtn = document.querySelector('.sidebar-nav [data-panel="' + panelId + '"]');
                var titleElem = document.getElementById("panelTitle");
                var eyebrowElem = document.querySelector(".dash-header .eyebrow");
                var headerOwnerBtn = document.getElementById("headerBecomeOwnerBtn") || document.querySelector('.header-actions button[data-panel="become-owner"]');

                if (panelId === "become-owner") {
                    if (titleElem) titleElem.textContent = "Become Property Owner";
                    if (eyebrowElem) eyebrowElem.textContent = "OWNER APPLICATION";
                    if (headerOwnerBtn) headerOwnerBtn.style.display = "none";
                } else {
                    if (headerOwnerBtn) headerOwnerBtn.style.display = "";
                    if (eyebrowElem) eyebrowElem.textContent = "CUSTOMER DASHBOARD";
                    if (activeBtn && titleElem) {
                        var text = activeBtn.textContent.trim();
                        titleElem.textContent = text;
                    }
                }`;

if (content.includes(oldSwitchBlock)) {
  content = content.replace(oldSwitchBlock, newSwitchBlock);
  console.log('✓ switchTab script updated');
} else {
  console.log('Note: oldSwitchBlock not found directly, checking normalized line endings...');
  const normContent = content.replace(/\r\n/g, '\n');
  const normOld = oldSwitchBlock.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, newSwitchBlock.replace(/\r\n/g, '\n'));
    console.log('✓ switchTab script updated via normalized matching');
  }
}

// 4. Update loadMe and form submit script
const oldScriptPattern = `        async function loadMe() {`;
const scriptStartIndex = content.indexOf(oldScriptPattern);
const scriptEndTag = `<!-- Script ensuring full-page vertical scrolling is always active on customer dashboard -->`;
const scriptEndIndex = content.indexOf(scriptEndTag);

if (scriptStartIndex !== -1 && scriptEndIndex !== -1) {
  const newScript = `        async function loadMe() {
            try {
                const res = await fetch('/api/property/portal/me', { headers: { 'Accept': 'application/json' } });
                if (!res.ok) return;
                const me = await res.json();
                if (document.getElementById('custMeName')) document.getElementById('custMeName').textContent = me.name || 'PropertyDirect Customer';
                if (document.getElementById('custMeEmail')) document.getElementById('custMeEmail').textContent = me.email || '';
                if (document.getElementById('custMePhone')) document.getElementById('custMePhone').textContent = me.phone || '';

                const appCard = document.getElementById('ownerAppStatusCard');
                const appBadge = document.getElementById('ownerAppBadge');
                const appMsg = document.getElementById('ownerAppMsg');
                const appNote = document.getElementById('ownerAppNote');
                const appTime = document.getElementById('ownerAppSubmittedTime');
                const appIcon = document.getElementById('ownerAppIcon');
                const stepAdmin = document.getElementById('stepAdminReview');
                const stepVerified = document.getElementById('stepVerified');
                const editBtn = document.getElementById('editOwnerAppBtn');
                const ownerLink = document.getElementById('goToOwnerDashboardLink');
                const form = document.getElementById('becomeOwnerForm');

                if (me.role === 'OWNER' || me.postingVerified) {
                    if (appCard) {
                        appCard.style.display = 'block';
                        appCard.style.background = '#ecfdf5';
                        appCard.style.borderColor = '#86efac';
                    }
                    if (appIcon) appIcon.textContent = '✓';
                    if (appBadge) {
                        appBadge.textContent = '✓ Verified Property Owner';
                        appBadge.style.background = '#dcfce7';
                        appBadge.style.color = '#15803d';
                        appBadge.style.border = '1px solid #86efac';
                    }
                    if (appTime) appTime.textContent = 'Active PropertyDirect Owner Account';
                    if (appMsg) appMsg.textContent = 'Congratulations! Your account is verified as an official Property Owner. You have direct listing and owner-dashboard privileges.';
                    if (stepAdmin) { stepAdmin.style.color = '#059669'; stepAdmin.innerHTML = '<i class="fa-solid fa-circle-check"></i> 2. Admin Verified'; }
                    if (stepVerified) { stepVerified.style.color = '#059669'; stepVerified.innerHTML = '<i class="fa-solid fa-circle-check"></i> 3. Active Access'; }
                    if (editBtn) editBtn.style.display = 'none';
                    if (ownerLink) ownerLink.style.display = 'inline-flex';
                    if (form) form.style.display = 'none';
                } else if (me.application) {
                    if (appCard) appCard.style.display = 'block';
                    const dec = (me.application.decision || 'PENDING').toUpperCase();
                    if (dec === 'PENDING') {
                        if (appCard) {
                            appCard.style.background = '#fffbeb';
                            appCard.style.borderColor = '#fde68a';
                        }
                        if (appIcon) appIcon.textContent = '⏳';
                        if (appBadge) {
                            appBadge.textContent = '⏳ Pending Admin Verification';
                            appBadge.style.background = '#fef3c7';
                            appBadge.style.color = '#b45309';
                            appBadge.style.border = '1px solid #fcd34d';
                        }
                        if (appTime) {
                            const dateStr = me.application.createdAt ? new Date(me.application.createdAt).toLocaleString() : 'Recently';
                            appTime.textContent = 'Submitted on ' + dateStr + ' · Awaiting Admin Verification';
                        }
                        if (appMsg) appMsg.textContent = 'Your application to become a verified Property Owner is actively in the Administrator review queue. Verification will automatically unlock owner privileges.';
                        if (appNote) appNote.textContent = me.application.verificationDetails || 'Application submitted.';
                        if (stepAdmin) { stepAdmin.style.color = '#d97706'; stepAdmin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 2. Admin Reviewing'; }
                        if (stepVerified) { stepVerified.style.color = '#94a3b8'; stepVerified.innerHTML = '<i class="fa-regular fa-circle"></i> 3. Direct Posting Active'; }
                        if (editBtn) editBtn.style.display = 'inline-flex';
                        if (ownerLink) ownerLink.style.display = 'none';
                        if (form) form.style.display = 'none';
                    } else if (dec === 'REJECTED') {
                        if (appCard) {
                            appCard.style.background = '#fef2f2';
                            appCard.style.borderColor = '#fca5a5';
                        }
                        if (appIcon) appIcon.textContent = '✕';
                        if (appBadge) {
                            appBadge.textContent = '✕ Revision Needed';
                            appBadge.style.background = '#fee2e2';
                            appBadge.style.color = '#b91c1c';
                            appBadge.style.border = '1px solid #fca5a5';
                        }
                        if (appMsg) appMsg.textContent = 'Administrator Review Feedback: ' + (me.application.reviewNote || 'Please update your details.');
                        if (appNote) appNote.textContent = 'Previous submission: ' + (me.application.verificationDetails || '');
                        if (editBtn) editBtn.style.display = 'none';
                        if (ownerLink) ownerLink.style.display = 'none';
                        if (form) form.style.display = 'flex';
                    }
                } else {
                    if (appCard) appCard.style.display = 'none';
                    if (form) form.style.display = 'flex';
                }
            } catch (e) {
                console.error('Error loading me:', e);
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            loadMe();

            // Live character counter for verification notes
            const notesEl = document.getElementById('ownerVerificationNotes');
            const charBadge = document.getElementById('charCountBadge');
            if (notesEl && charBadge) {
                notesEl.addEventListener('input', function() {
                    const len = notesEl.value.trim().length;
                    charBadge.textContent = len + ' / 20 chars min';
                    if (len >= 20) {
                        charBadge.style.color = '#059669';
                        charBadge.style.fontWeight = '800';
                    } else {
                        charBadge.style.color = '#b45309';
                        charBadge.style.fontWeight = '600';
                    }
                });
            }

            // Edit Application Details button handler
            const editBtn = document.getElementById('editOwnerAppBtn');
            if (editBtn) {
                editBtn.addEventListener('click', function() {
                    const form = document.getElementById('becomeOwnerForm');
                    if (form) {
                        form.style.display = 'flex';
                        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            const form = document.getElementById('becomeOwnerForm');
            if (form) {
                form.addEventListener('submit', async function(e) {
                    e.preventDefault();

                    const propType = document.getElementById('ownerPropType')?.value.trim() || 'Residential Apartment';
                    const propUnit = document.getElementById('ownerPropUnit')?.value.trim() || '';
                    const propLocality = document.getElementById('ownerPropLocality')?.value.trim() || '';
                    const docType = document.getElementById('ownerDocType')?.value.trim() || 'Registered Sale Deed';
                    const docRef = document.getElementById('ownerDocRef')?.value.trim() || '';
                    const notes = document.getElementById('ownerVerificationNotes')?.value.trim() || '';

                    if (!propUnit) {
                        alert('Please enter your property unit number and building / project name.');
                        document.getElementById('ownerPropUnit')?.focus();
                        return;
                    }
                    if (!propLocality) {
                        alert('Please enter your property locality / area.');
                        document.getElementById('ownerPropLocality')?.focus();
                        return;
                    }
                    if (!docRef) {
                        alert('Please enter your proof document reference number or utility ID.');
                        document.getElementById('ownerDocRef')?.focus();
                        return;
                    }
                    if (notes.length < 20) {
                        alert('Please provide at least 20 characters in the verification notes and declaration.');
                        document.getElementById('ownerVerificationNotes')?.focus();
                        return;
                    }

                    const combinedDetails = 'Property Type: ' + propType + ' | Unit/Building: ' + propUnit + ' | Location: ' + propLocality + ' | Proof Document: ' + docType + ' (Ref: ' + docRef + ') | Notes: ' + notes;

                    const btn = document.getElementById('submitOwnerAppBtn');
                    btn.disabled = true;
                    const originalBtnHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting to Admin Dashboard...';

                    try {
                        const res = await fetch('/api/property/portal/applications', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                            body: JSON.stringify({
                                role: 'OWNER',
                                registrationNumber: docRef,
                                verificationDetails: combinedDetails
                            })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || 'Unable to submit application.');

                        if (typeof showToast === 'function') {
                            showToast('✓ Your application has been submitted to the Admin Dashboard!');
                        } else {
                            alert('✓ Your application has been submitted to the Admin Dashboard! Administrators will review your details.');
                        }

                        await loadMe();
                        const appCard = document.getElementById('ownerAppStatusCard');
                        if (appCard) appCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch (err) {
                        alert(err.message || 'Error submitting application.');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalBtnHtml;
                    }
                });
            }
        });
    })();
    </script>

    `;
  content = content.substring(0, scriptStartIndex) + newScript + content.substring(scriptEndIndex);
  console.log('✓ loadMe and submit script updated');
} else {
  console.error('Failed to find script tags:', { scriptStartIndex, scriptEndIndex });
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Wrote updated customer.html to source');

// Also copy to target/classes so live Spring server sees it immediately
const targetPath = path.resolve('target/classes/templates/propertydirect/dashboards/customer.html');
if (fs.existsSync(path.dirname(targetPath))) {
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('✓ Copied updated customer.html to target/classes');
}
