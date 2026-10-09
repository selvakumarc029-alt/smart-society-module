const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/main/resources/templates/propertydirect/dashboards/customer.html');
let content = fs.readFileSync(filePath, 'utf8');

// Target the broken contacts panel
const brokenSnippet = `<section class="dash-panel hidden" data-view="contacts">
            <div class="dash-card">
                <div class="card-head">
                    <div>
                        <h3>Contact Property Owner</h3>
                        <p>Share complete contact, budget and move-in requirements so the owner can respond accurately.
                        </p>
                    </div><span class="inline-state" id="ownerContactState">Choose a listing from search or
                        shortli                <form class="form-grid detailed-property-form" id="ownerContactForm">`;

const fixedContactsPanel = `<section class="dash-panel hidden" data-view="contacts">
            <div class="dash-card">
                <div class="card-head">
                    <div>
                        <h3>Contact Property Owner</h3>
                        <p style="margin:4px 0 0 0; color:#64748b; font-size:0.84rem;">Share complete contact, budget and move-in requirements so the owner can respond accurately.</p>
                    </div>
                    <span class="inline-state" id="ownerContactState">Choose a listing from search or shortlist</span>
                </div>

                <form class="form-grid detailed-property-form" id="ownerContactForm">
                    <div class="property-form-section">
                        <strong>Property and Requester Information</strong>
                        <small>Required identity and target listing reference.</small>
                    </div>
                    
                    <div class="profile-wide" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:18px 20px;">
                        <label><span>Listing ID *</span><input name="listingId" type="number" min="1" placeholder="e.g. 101" required></label>
                        <label><span>Your Full Name *</span><input name="name" id="contactOwnerName" maxlength="100" placeholder="Full name" required></label>
                        <label><span>Phone Number *</span><input name="phone" id="contactOwnerPhone" type="tel" pattern="[0-9+ ]{7,20}" placeholder="+91 98765 43210" required></label>
                        <label><span>Email Address *</span><input name="email" id="contactOwnerEmail" type="email" placeholder="you@domain.com" required></label>
                    </div>
                    
                    <div class="property-form-section">
                        <strong>Requirement & Preferences</strong>
                        <small>Specify your purpose, budget range and callback preference.</small>
                    </div>

                    <div class="profile-wide" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:18px 20px;">
                        <label><span>Request Type *</span><select name="type" required>
                            <option value="OWNER_CONTACT">Owner direct contact</option>
                            <option value="PRICE_DISCUSSION">Price negotiation</option>
                            <option value="DOCUMENT_QUERY">Title deed & verification query</option>
                            <option value="AVAILABILITY_QUERY">Possession / availability query</option>
                        </select></label>
                        <label><span>Expected Move-in / Purchase Date</span><input name="moveInDate" type="date"></label>
                        <label><span>Budget Range</span><input name="budget" placeholder="e.g. ₹25,000–30,000 / month"></label>
                        <label><span>Preferred Contact Method</span><select name="contactMethod">
                            <option>Phone call</option>
                            <option>WhatsApp</option>
                            <option>Email</option>
                            <option>In-app response</option>
                        </select></label>
                        <label><span>Preferred Callback Time</span><input name="callbackAt" type="datetime-local"></label>
                        <label><span>Occupants / Family Size</span><input name="occupants" type="number" min="1" max="50" placeholder="e.g. 3"></label>
                    </div>
                    
                    <label class="profile-wide">
                        <span>Detailed Message *</span>
                        <textarea name="message" minlength="10" maxlength="1500" required placeholder="Describe your requirement, questions and specific conditions for the owner..."></textarea>
                    </label>
                    <div class="profile-wide" style="margin-top:6px;">
                        <label class="checkbox-label" style="margin-top:0;">
                            <input name="contactConsent" type="checkbox" required>
                            <span>I consent to sharing these contact details with the verified property owner. *</span>
                        </label>
                    </div>
                    <button class="primary profile-wide" data-property-api-action="contact-owner" type="submit">
                        Send Detailed Enquiry
                    </button>
                </form>
            </div>
        </section>`;

// Normalize for replacement
const normContent = content.replace(/\r\n/g, '\n');
const normBroken = brokenSnippet.replace(/\r\n/g, '\n');
const normFixed = fixedContactsPanel.replace(/\r\n/g, '\n');

if (normContent.includes(normBroken)) {
    console.log('✓ Found brokenSnippet directly');
    const startIdx = normContent.indexOf(normBroken);
    const endTag = '</section>';
    const endIdx = normContent.indexOf(endTag, startIdx) + endTag.length;
    
    let updated = normContent.substring(0, startIdx) + normFixed + normContent.substring(endIdx);
    
    // Also add auto-fill to loadMe
    const autoFillCode = `
                // Auto-fill contact owner form with current profile
                if (document.getElementById('contactOwnerName') && !document.getElementById('contactOwnerName').value && me.name) {
                    document.getElementById('contactOwnerName').value = me.name;
                }
                if (document.getElementById('contactOwnerPhone') && !document.getElementById('contactOwnerPhone').value && me.phone) {
                    document.getElementById('contactOwnerPhone').value = me.phone;
                }
                if (document.getElementById('contactOwnerEmail') && !document.getElementById('contactOwnerEmail').value && me.email) {
                    document.getElementById('contactOwnerEmail').value = me.email;
                }
    `;
    
    if (updated.includes('const appCard = document.getElementById(\'ownerAppStatusCard\');')) {
        updated = updated.replace(
            'const appCard = document.getElementById(\'ownerAppStatusCard\');',
            autoFillCode + '\n                const appCard = document.getElementById(\'ownerAppStatusCard\');'
        );
        console.log('✓ Injected autoFillCode into loadMe');
    }

    if (content.includes('\r\n')) {
        updated = updated.replace(/\n/g, '\r\n');
    }

    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('✓ Wrote updated customer.html to source');

    const targetPath = path.resolve('target/classes/templates/propertydirect/dashboards/customer.html');
    if (fs.existsSync(path.dirname(targetPath))) {
        fs.writeFileSync(targetPath, updated, 'utf8');
        console.log('✓ Copied updated customer.html to target');
    }
} else {
    console.error('❌ Could not find brokenSnippet. Searching by indices...');
    const startIdx = normContent.indexOf('<section class="dash-panel hidden" data-view="contacts">');
    const endTag = '</section>';
    const endIdx = normContent.indexOf(endTag, startIdx) + endTag.length;
    console.log('Indices:', startIdx, endIdx);
    if (startIdx !== -1 && endIdx !== -1) {
        let updated = normContent.substring(0, startIdx) + normFixed + normContent.substring(endIdx);
        if (content.includes('\r\n')) {
            updated = updated.replace(/\n/g, '\r\n');
        }
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log('✓ Wrote updated customer.html to source via indices');
        const targetPath = path.resolve('target/classes/templates/propertydirect/dashboards/customer.html');
        if (fs.existsSync(path.dirname(targetPath))) {
            fs.writeFileSync(targetPath, updated, 'utf8');
            console.log('✓ Copied updated customer.html to target');
        }
    }
}
