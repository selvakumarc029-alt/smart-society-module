with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'r', encoding='utf-8') as f:
    resp = f.read()

old_resp = """/* Dedicated Table and Content Card Reset - Never Vertically Centered with Gap */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)),
html body[data-dashboard-role="vendor"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)) {
  display: block !important;
  justify-content: flex-start !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}"""

new_resp = """/* Dedicated Table and Content Card Reset - Never Vertically Centered with Gap */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)):not(.hidden):not([hidden]),
html body[data-dashboard-role="vendor"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)):not(.hidden):not([hidden]) {
  display: block;
  justify-content: flex-start !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}

html body.app-dashboard[data-platform="propertydirect"] #subtabEnquiriesView.hidden,
html body.app-dashboard[data-platform="propertydirect"] #subtabVisitsView.hidden,
html body.app-dashboard[data-platform="propertydirect"] #subtabEnquiriesView[hidden],
html body.app-dashboard[data-platform="propertydirect"] #subtabVisitsView[hidden] {
  display: none !important;
}"""

assert old_resp in resp, "old_resp not found"
resp = resp.replace(old_resp, new_resp)

with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
with open('target/classes/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
print("Updated dashboard-responsive.css")

# 2. Update admin-dashboard.js
with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_js = """    window.switchEnquirySubtab = function (subtab) {
        const enqSection = document.getElementById("subtabEnquiriesView");
        const visSection = document.getElementById("subtabVisitsView");
        const btnEnq = document.getElementById("subtabEnquiriesBtn");
        const btnVis = document.getElementById("subtabVisitsBtn");

        if (subtab === 'visits') {
            if (enqSection) enqSection.style.display = 'none';
            if (visSection) visSection.style.display = 'block';
            if (btnEnq) btnEnq.className = 'pill-btn';
            if (btnVis) btnVis.className = 'pill-btn active';
            loadVisits();
        } else {
            if (enqSection) enqSection.style.display = 'block';
            if (visSection) visSection.style.display = 'none';
            if (btnEnq) btnEnq.className = 'pill-btn active';
            if (btnVis) btnVis.className = 'pill-btn';
            loadEnquiries();
        }
    };"""

new_js = """    window.switchEnquirySubtab = function (subtab) {
        const enqSection = document.getElementById("subtabEnquiriesView");
        const visSection = document.getElementById("subtabVisitsView");
        const btnEnq = document.getElementById("subtabEnquiriesBtn");
        const btnVis = document.getElementById("subtabVisitsBtn");

        if (subtab === 'visits') {
            if (enqSection) {
                enqSection.classList.add('hidden');
                enqSection.hidden = true;
                enqSection.style.setProperty('display', 'none', 'important');
            }
            if (visSection) {
                visSection.classList.remove('hidden');
                visSection.hidden = false;
                visSection.style.setProperty('display', 'block', 'important');
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn';
                btnEnq.style.background = '#ffffff';
                btnEnq.style.color = '#334155';
            }
            if (btnVis) {
                btnVis.className = 'pill-btn active';
                btnVis.style.background = '#0f172a';
                btnVis.style.color = '#ffffff';
            }
            loadVisits();
        } else {
            if (visSection) {
                visSection.classList.add('hidden');
                visSection.hidden = true;
                visSection.style.setProperty('display', 'none', 'important');
            }
            if (enqSection) {
                enqSection.classList.remove('hidden');
                enqSection.hidden = false;
                enqSection.style.setProperty('display', 'block', 'important');
            }
            if (btnVis) {
                btnVis.className = 'pill-btn';
                btnVis.style.background = '#ffffff';
                btnVis.style.color = '#334155';
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn active';
                btnEnq.style.background = '#0f172a';
                btnEnq.style.color = '#ffffff';
            }
            loadEnquiries();
        }
    };"""

assert old_js in js, "old_js not found"
js = js.replace(old_js, new_js)

with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js)
with open('target/classes/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated admin-dashboard.js")

# 3. Update admin.html markup
with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'r', encoding='utf-8') as f:
    admin_html = f.read()

old_visits_markup = '<div id="subtabVisitsView" class="dash-card table-card" style="display:none; padding:0; overflow:hidden; border-radius:14px; border:1px solid #e2e8f0; background:#ffffff;">'
new_visits_markup = '<div id="subtabVisitsView" class="dash-card table-card hidden" hidden style="display:none !important; padding:0; overflow:hidden; border-radius:14px; border:1px solid #e2e8f0; background:#ffffff;">'

if old_visits_markup in admin_html:
    admin_html = admin_html.replace(old_visits_markup, new_visits_markup)
    print("Updated subtabVisitsView markup")

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
with open('target/classes/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
print("Updated admin.html")
