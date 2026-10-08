/**
 * PropertyDirect - Verified Owner Contact & Authentication Flow
 * Ensures users sign in before accessing verified owner contact details.
 */
(() => {
    'use strict';

    let pendingListingId = null;
    let pendingListingTitle = null;

    // Inject Styles for Owner Contact and Auth Modals
    const styleEl = document.createElement('style');
    styleEl.id = 'owner-details-flow-styles';
    styleEl.textContent = `
        .pd-contact-overlay {
            position: fixed; inset: 0;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease;
            padding: 16px;
            box-sizing: border-box;
        }
        .pd-contact-overlay.active {
            opacity: 1; pointer-events: auto;
        }
        .pd-contact-dialog {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
            width: 100%; max-width: 500px;
            overflow: hidden;
            transform: scale(0.95);
            transition: transform 0.25s ease;
            font-family: 'Manrope', 'Outfit', sans-serif;
            color: #1e293b;
            border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .pd-contact-overlay.active .pd-contact-dialog {
            transform: scale(1);
        }
        .pd-dialog-header {
            background: linear-gradient(135deg, #0b1836 0%, #17326b 100%);
            color: #ffffff;
            padding: 20px 24px;
            position: relative;
        }
        .pd-dialog-header h3 {
            margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff;
            display: flex; align-items: center; gap: 8px;
        }
        .pd-dialog-header p {
            margin: 6px 0 0 0; font-size: 0.85rem; color: #94a3b8;
        }
        .pd-dialog-close {
            position: absolute; top: 16px; right: 16px;
            background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25);
            color: #ffffff; width: 32px; height: 32px; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; transition: background 0.2s;
        }
        .pd-dialog-close:hover { background: rgba(255, 255, 255, 0.3); }
        .pd-dialog-body {
            padding: 24px;
            max-height: 80vh; overflow-y: auto;
        }
        .pd-owner-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;
            padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;
            margin-bottom: 14px;
        }
        .pd-owner-card {
            background: #f8fafc; border: 1px solid #e2e8f0;
            border-radius: 14px; padding: 18px; margin-bottom: 20px;
        }
        .pd-owner-title {
            font-size: 0.82rem; color: #64748b; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.05em; margin-bottom: 6px;
        }
        .pd-owner-name {
            font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 14px;
            display: flex; align-items: center; gap: 8px;
        }
        .pd-contact-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 0; border-top: 1px solid #e2e8f0;
        }
        .pd-contact-label {
            font-size: 0.82rem; color: #64748b; font-weight: 600;
        }
        .pd-contact-value {
            font-size: 0.95rem; font-weight: 800; color: #1e293b;
        }
        .pd-action-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px;
        }
        .pd-btn-call {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff !important; text-decoration: none;
            padding: 12px; border-radius: 10px; font-weight: 800; font-size: 0.9rem;
            text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: transform 0.15s;
        }
        .pd-btn-wa {
            background: linear-gradient(135deg, #25D366, #128C7E);
            color: #ffffff !important; text-decoration: none;
            padding: 12px; border-radius: 10px; font-weight: 800; font-size: 0.9rem;
            text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3); transition: transform 0.15s;
        }
        .pd-btn-mail {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff !important; text-decoration: none;
            padding: 12px; border-radius: 10px; font-weight: 800; font-size: 0.9rem;
            text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            grid-column: span 2;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: transform 0.15s;
        }
        .pd-btn-copy {
            background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155;
            padding: 10px; border-radius: 10px; font-weight: 700; font-size: 0.85rem;
            width: 100%; cursor: pointer; margin-top: 10px;
        }
        .pd-btn-copy:hover { background: #e2e8f0; }

        /* Auth Form Styles */
        .pd-auth-prompt {
            background: #eff6ff; border: 1px solid #bfdbfe;
            border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;
            font-size: 0.88rem; color: #1e40af; line-height: 1.4;
        }
        .pd-field-group {
            margin-bottom: 14px; text-align: left;
        }
        .pd-field-group label {
            display: block; font-size: 0.8rem; font-weight: 700; color: #475569;
            margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .pd-field-group input {
            width: 100%; padding: 11px 14px; border-radius: 10px;
            border: 1.5px solid #cbd5e1; font-size: 0.92rem;
            box-sizing: border-box; font-family: inherit;
        }
        .pd-field-group input:focus {
            outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
        }
        .pd-btn-submit {
            width: 100%; padding: 13px; border-radius: 10px;
            background: linear-gradient(135deg, #1d4ed8, #2563eb);
            color: #ffffff; border: none; font-weight: 800; font-size: 0.96rem;
            cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.35);
            transition: transform 0.15s, box-shadow 0.15s;
        }
        .pd-btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37,99,235,0.45); }
        .pd-btn-quick-customer {
            width: 100%; padding: 12px; border-radius: 10px;
            background: #f8fafc; border: 1.5px dashed #2563eb; color: #1d4ed8;
            font-weight: 800; font-size: 0.88rem; cursor: pointer;
            margin-top: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            transition: background 0.15s;
        }
        .pd-btn-quick-customer:hover { background: #eff6ff; }
        .pd-auth-toggle {
            text-align: center; margin-top: 14px; font-size: 0.84rem; color: #64748b;
        }
        .pd-auth-toggle a {
            color: #2563eb; font-weight: 700; text-decoration: none; cursor: pointer;
        }
        .pd-auth-toggle a:hover { text-decoration: underline; }
        .pd-auth-error {
            background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
            padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700;
            margin-bottom: 12px; display: none;
        }
    `;
    document.head.appendChild(styleEl);

    // Inject Dialog HTML into body
    function ensureDialogsInDOM() {
        if (!document.getElementById('pdOwnerFlowContainer')) {
            const container = document.createElement('div');
            container.id = 'pdOwnerFlowContainer';
            container.innerHTML = `
                <!-- Sign-In Modal -->
                <div class="pd-contact-overlay" id="pdOwnerAuthModal">
                    <div class="pd-contact-dialog">
                        <div class="pd-dialog-header">
                            <h3><span>🔐</span> Sign In to View Owner Details</h3>
                            <p>Direct owner contact is available to signed-in customers with zero brokerage.</p>
                            <button type="button" class="pd-dialog-close" onclick="window.pdCloseOwnerModals()">✕</button>
                        </div>
                        <div class="pd-dialog-body">
                            <div class="pd-auth-prompt" id="pdAuthPropertyNotice">
                                You are requesting verified owner details for this property.
                            </div>
                            <div class="pd-auth-error" id="pdAuthModalError"></div>

                            <!-- 1-Click Customer Demo Sign In -->
                            <button type="button" class="pd-btn-quick-customer" id="pdQuickCustomerLoginBtn">
                                <span>⚡</span> Quick Sign In as Customer (1-Click Demo)
                            </button>

                            <div style="display: flex; align-items: center; margin: 18px 0; color: #94a3b8; font-size: 0.78rem;">
                                <div style="flex:1; height: 1px; background: #e2e8f0;"></div>
                                <span style="padding: 0 10px; font-weight: 700;">OR SIGN IN WITH ACCOUNT</span>
                                <div style="flex:1; height: 1px; background: #e2e8f0;"></div>
                            </div>

                            <form id="pdOwnerAuthForm">
                                <div class="pd-field-group" id="pdNameGroup" style="display: none;">
                                    <label>Full Name</label>
                                    <input type="text" id="pdAuthNameInput" placeholder="Your name">
                                </div>
                                <div class="pd-field-group" id="pdPhoneGroup" style="display: none;">
                                    <label>Phone Number</label>
                                    <input type="tel" id="pdAuthPhoneInput" placeholder="e.g. +91 87782 93269">
                                </div>
                                <div class="pd-field-group">
                                    <label>Username or Email</label>
                                    <input type="text" id="pdAuthUserInput" placeholder="e.g. customer@propertydirect.in or your email" required>
                                </div>
                                <div class="pd-field-group">
                                    <label>Password</label>
                                    <input type="password" id="pdAuthPassInput" placeholder="Enter your password" required>
                                </div>
                                <button type="submit" class="pd-btn-submit" id="pdAuthSubmitBtn">Sign In & Unlock Owner Details</button>
                            </form>

                            <div class="pd-auth-toggle">
                                <span id="pdAuthToggleText">New to PropertyDirect?</span>
                                <a id="pdAuthToggleLink">Create free customer account</a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Verified Owner Details Modal -->
                <div class="pd-contact-overlay" id="pdOwnerDetailsModal">
                    <div class="pd-contact-dialog">
                        <div class="pd-dialog-header">
                            <h3><span>✓</span> Verified Owner Details</h3>
                            <p>Direct contact unlocked with zero brokerage.</p>
                            <button type="button" class="pd-dialog-close" onclick="window.pdCloseOwnerModals()">✕</button>
                        </div>
                        <div class="pd-dialog-body">
                            <span class="pd-owner-badge">✓ 100% Verified Owner Contact</span>
                            <div class="pd-owner-card">
                                <div class="pd-owner-title">Property Direct Listing</div>
                                <div class="pd-owner-name" id="pdModalPropTitle">Luxury Apartment</div>
                                
                                <div class="pd-contact-row">
                                    <span class="pd-contact-label">Owner Name</span>
                                    <span class="pd-contact-value" id="pdModalOwnerName">Property Owner</span>
                                </div>
                                <div class="pd-contact-row">
                                    <span class="pd-contact-label">Phone Number</span>
                                    <span class="pd-contact-value" id="pdModalOwnerPhone">+91 98450 12345</span>
                                </div>
                                <div class="pd-contact-row">
                                    <span class="pd-contact-label">Email Address</span>
                                    <span class="pd-contact-value" id="pdModalOwnerEmail">owner@propertydirect.in</span>
                                </div>
                                <div class="pd-contact-row">
                                    <span class="pd-contact-label">Locality / City</span>
                                    <span class="pd-contact-value" id="pdModalPropLocality">Bengaluru</span>
                                </div>
                                <div class="pd-contact-row">
                                    <span class="pd-contact-label">Apartment Code</span>
                                    <span class="pd-contact-value" id="pdModalPropCode">PDT-0548</span>
                                </div>
                            </div>

                            <div class="pd-action-grid">
                                <a href="#" class="pd-btn-call" id="pdModalCallBtn">📞 Call Owner</a>
                                <a href="#" class="pd-btn-wa" id="pdModalWaBtn" target="_blank">💬 WhatsApp</a>
                                <a href="#" class="pd-btn-mail" id="pdModalMailBtn">✉️ Email Owner</a>
                            </div>

                            <button type="button" class="pd-btn-copy" id="pdCopyOwnerBtn">📋 Copy Owner Contact Details</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            setupAuthFormLogic();
        }
    }

    let isRegisterMode = false;
    function setupAuthFormLogic() {
        const toggleLink = document.getElementById('pdAuthToggleLink');
        const nameGroup = document.getElementById('pdNameGroup');
        const phoneGroup = document.getElementById('pdPhoneGroup');
        const submitBtn = document.getElementById('pdAuthSubmitBtn');
        const toggleText = document.getElementById('pdAuthToggleText');

        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                isRegisterMode = !isRegisterMode;
                if (isRegisterMode) {
                    nameGroup.style.display = 'block';
                    if (phoneGroup) phoneGroup.style.display = 'block';
                    submitBtn.textContent = 'Create Account & View Owner Details';
                    toggleText.textContent = 'Already have an account?';
                    toggleLink.textContent = 'Sign In';
                } else {
                    nameGroup.style.display = 'none';
                    if (phoneGroup) phoneGroup.style.display = 'none';
                    submitBtn.textContent = 'Sign In & Unlock Owner Details';
                    toggleText.textContent = 'New to PropertyDirect?';
                    toggleLink.textContent = 'Create free customer account';
                }
            });
        }

        // Quick 1-Click Demo Customer Login
        document.getElementById('pdQuickCustomerLoginBtn')?.addEventListener('click', async () => {
            const err = document.getElementById('pdAuthModalError');
            if (err) err.style.display = 'none';
            try {
                const res = await fetch('/api/property/auth/quick-signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (res.ok && (data.success || data.authenticated)) {
                    document.getElementById('pdOwnerAuthModal')?.classList.remove('active');
                    if (pendingListingId) {
                        fetchAndShowOwnerContact(pendingListingId);
                    }
                } else {
                    throw new Error(data.message || 'Could not sign in');
                }
            } catch (ex) {
                if (err) {
                    err.textContent = ex.message;
                    err.style.display = 'block';
                }
            }
        });

        // Form Submit Login
        document.getElementById('pdOwnerAuthForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('pdAuthModalError');
            if (err) err.style.display = 'none';

            const username = document.getElementById('pdAuthUserInput')?.value?.trim();
            const password = document.getElementById('pdAuthPassInput')?.value?.trim();
            const name = document.getElementById('pdAuthNameInput')?.value?.trim();
            const phone = document.getElementById('pdAuthPhoneInput')?.value?.trim();

            try {
                const res = await fetch('/api/property/auth/quick-signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        name: isRegisterMode ? (name || username) : null,
                        phone: isRegisterMode ? (phone || '8778293269') : null
                    })
                });
                const data = await res.json();
                if (res.ok && (data.success || data.authenticated)) {
                    document.getElementById('pdOwnerAuthModal')?.classList.remove('active');
                    if (pendingListingId) {
                        fetchAndShowOwnerContact(pendingListingId);
                    }
                } else {
                    throw new Error(data.message || 'Invalid username or password');
                }
            } catch (ex) {
                if (err) {
                    err.textContent = ex.message;
                    err.style.display = 'block';
                }
            }
        });

        // Copy contact button
        document.getElementById('pdCopyOwnerBtn')?.addEventListener('click', () => {
            const name = document.getElementById('pdModalOwnerName')?.textContent;
            const phone = document.getElementById('pdModalOwnerPhone')?.textContent;
            const email = document.getElementById('pdModalOwnerEmail')?.textContent;
            const prop = document.getElementById('pdModalPropTitle')?.textContent;
            const textToCopy = `Property: ${prop}\nOwner: ${name}\nPhone: ${phone}\nEmail: ${email}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                const copyBtn = document.getElementById('pdCopyOwnerBtn');
                if (copyBtn) {
                    const original = copyBtn.textContent;
                    copyBtn.textContent = '✓ Copied to clipboard!';
                    setTimeout(() => copyBtn.textContent = original, 2500);
                }
            });
        });
    }

    window.pdCloseOwnerModals = function() {
        document.getElementById('pdOwnerAuthModal')?.classList.remove('active');
        document.getElementById('pdOwnerDetailsModal')?.classList.remove('active');
    };

    async function fetchAndShowOwnerContact(listingId, fallbackTitle = '') {
        try {
            const res = await fetch(`/api/property/listings/${encodeURIComponent(listingId)}/owner-contact`, {
                headers: { Accept: 'application/json' }
            });

            if (res.status === 401) {
                // User is NOT signed in -> show Auth Modal
                pendingListingId = listingId;
                pendingListingTitle = fallbackTitle;
                const notice = document.getElementById('pdAuthPropertyNotice');
                if (notice) {
                    notice.textContent = fallbackTitle 
                        ? `Sign in to access verified owner contact details for "${fallbackTitle}".`
                        : `Sign in to access verified owner contact details.`;
                }
                document.getElementById('pdOwnerDetailsModal')?.classList.remove('active');
                document.getElementById('pdOwnerAuthModal')?.classList.add('active');
                return;
            }

            if (!res.ok) {
                throw new Error('Unable to retrieve owner contact details.');
            }

            const data = await res.json();
            
            // Populate Owner Details Modal
            const rawPhone = (data.ownerPhone || '').trim();
            const validPhone = (rawPhone && !rawPhone.toLowerCase().includes('not provided') && !rawPhone.toLowerCase().includes('not specified')) 
                ? rawPhone 
                : '8778293269';
            const phoneDigits = validPhone.replace(/\D/g, '');
            const phoneDisplay = phoneDigits.length === 10 ? `+91 ${phoneDigits.slice(0, 5)} ${phoneDigits.slice(5)}` : (validPhone.startsWith('+') ? validPhone : `+91 ${validPhone}`);
            const phoneCall = phoneDigits.length === 10 ? `+91${phoneDigits}` : validPhone.replace(/\s+/g, '');
            
            const rawEmail = (data.ownerEmail || '').trim();
            const validEmail = (rawEmail && !rawEmail.toLowerCase().includes('not specified'))
                ? (rawEmail.includes('@') ? (rawEmail.includes('.') ? rawEmail : rawEmail + '.in') : rawEmail)
                : 'owner@propertydirect.in';

            document.getElementById('pdModalPropTitle').textContent = data.title || fallbackTitle || 'Selected Property';
            document.getElementById('pdModalOwnerName').textContent = data.ownerName || 'Selva Kumar';
            document.getElementById('pdModalOwnerPhone').textContent = phoneDisplay;
            document.getElementById('pdModalOwnerEmail').textContent = validEmail;
            document.getElementById('pdModalPropLocality').textContent = `${data.locality || ''}, ${data.city || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Bengaluru, India';
            document.getElementById('pdModalPropCode').textContent = data.apartmentCode || `PDT-${listingId}`;

            // Buttons
            document.getElementById('pdModalCallBtn').href = `tel:${phoneCall}`;
            document.getElementById('pdModalWaBtn').href = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi ${data.ownerName || 'Property Owner'}, I am interested in your property listing "${data.title || 'listing'}" on PropertyDirect.`)}`;
            document.getElementById('pdModalMailBtn').href = `mailto:${validEmail}?subject=${encodeURIComponent(`Inquiry regarding ${data.title || 'PropertyDirect Listing'}`)}`;

            document.getElementById('pdOwnerAuthModal')?.classList.remove('active');
            document.getElementById('pdOwnerDetailsModal')?.classList.add('active');

            // If on apartment-detail page, update the owner-card on page as well
            updateDetailPageOwnerCard(data);

        } catch (ex) {
            alert(ex.message || 'Could not load owner details. Please try again.');
        }
    }

    function updateDetailPageOwnerCard(ownerData) {
        const ownerCard = document.querySelector('.owner-card');
        if (!ownerCard) return;

        ownerCard.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <span style="background:#ecfdf5; color:#059669; font-weight:800; font-size:0.75rem; padding:3px 10px; border-radius:999px;">✓ Verified Owner</span>
            </div>
            <h3 style="margin:0 0 6px 0; font-size:1.15rem; font-weight:800; color:#0f172a;">${ownerData.ownerName}</h3>
            <p style="margin:0 0 14px 0; font-size:0.86rem; color:#64748b;">Direct listing owner on PropertyDirect with zero brokerage.</p>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:14px; font-size:0.88rem;">
                <div style="margin-bottom:6px;"><strong>📞 Phone:</strong> <a href="tel:${ownerData.ownerPhone}" style="color:#2563eb; font-weight:700; text-decoration:none;">${ownerData.ownerPhone}</a></div>
                <div><strong>✉️ Email:</strong> <a href="mailto:${ownerData.ownerEmail}" style="color:#2563eb; font-weight:700; text-decoration:none;">${ownerData.ownerEmail}</a></div>
            </div>
            <a href="tel:${(ownerData.ownerPhone||'').replace(/\s+/g,'')}" class="primary full" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; margin-bottom:8px; padding:11px; text-decoration:none; box-sizing:border-box;">
                📞 Call Owner Now
            </a>
            <button type="button" class="ghost full" onclick="window.pdOpenOwnerContactModal()">
                View Complete Owner Info
            </button>
        `;
    }

    window.pdOpenOwnerContactModal = function() {
        const modal = document.getElementById('pdOwnerDetailsModal');
        if (modal) modal.classList.add('active');
    };

    // Attach click handler for "Get Owner Details" & "Contact Owner"
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-action="owner"], [data-detail-action="contact"], .contact-owner-trigger, .get-owner-details-trigger');
        if (!trigger) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        ensureDialogsInDOM();

        const card = trigger.closest('[data-listing-id]');
        const listingId = card?.dataset.listingId 
            || new URLSearchParams(window.location.search).get('id')
            || trigger.dataset.listingId;

        const title = card?.dataset.apartmentTitle 
            || card?.querySelector('h2')?.textContent?.trim()
            || document.querySelector('.detail-hero h1')?.textContent?.trim()
            || 'Selected Property';

        if (!listingId) {
            alert('Please select a valid property to view owner details.');
            return;
        }

        fetchAndShowOwnerContact(listingId, title);
    }, true);

    // Initial check on detail page: if user is logged in, show owner info directly
    document.addEventListener('DOMContentLoaded', () => {
        ensureDialogsInDOM();

        const detailId = new URLSearchParams(window.location.search).get('id');
        if (detailId && window.location.pathname.includes('apartment-detail')) {
            fetch('/api/property/auth/status')
                .then(r => r.json())
                .then(st => {
                    if (st.authenticated) {
                        fetch(`/api/property/listings/${encodeURIComponent(detailId)}/owner-contact`)
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (data) updateDetailPageOwnerCard(data);
                            }).catch(() => {});
                    }
                }).catch(() => {});
        }
    });

})();
