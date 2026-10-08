import re

# 1. Update admin-dashboard.js
with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

old_load_enq = """    async function loadEnquiries() {
        try {
            const res = await fetch('/api/property/portal/enquiries', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.enquiries = await res.json();
            renderEnquiriesTable();
        } catch (err) {
            console.error("Error loading enquiries:", err);
        }
    }"""

new_load_enq = """    async function loadEnquiries() {
        try {
            const res = await fetch('/api/property/portal/enquiries', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.enquiries = await res.json();
            renderEnquiriesTable();
        } catch (err) {
            console.error("Error loading enquiries:", err);
            const tbody = document.getElementById("enquiriesTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No customer inquiries found. (Status: ${escapeHtml(err.message || 'Ready')})</td></tr>`;
            }
        }
    }"""

assert old_load_enq in js_content, "old_load_enq not found"
js_content = js_content.replace(old_load_enq, new_load_enq)

old_load_vis = """    async function loadVisits() {
        try {
            const res = await fetch('/api/property/portal/visits', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.visits = await res.json();
            renderVisitsTable();
        } catch (err) {
            console.error("Error loading visits:", err);
        }
    }"""

new_load_vis = """    async function loadVisits() {
        try {
            const res = await fetch('/api/property/portal/visits', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.visits = await res.json();
            renderVisitsTable();
        } catch (err) {
            console.error("Error loading visits:", err);
            const tbody = document.getElementById("visitsTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No scheduled site visits found.</td></tr>`;
            }
        }
    }"""

assert old_load_vis in js_content, "old_load_vis not found"
js_content = js_content.replace(old_load_vis, new_load_vis)

# Also reduce padding in empty tables
js_content = js_content.replace(
    'padding:36px; color:#64748b; font-size:0.88rem;">No customer enquiries yet.',
    'padding:20px 14px; color:#64748b; font-size:0.85rem;">No customer enquiries yet.'
)
js_content = js_content.replace(
    'padding:36px; color:#64748b; font-size:0.88rem;">No site visits requested yet.',
    'padding:20px 14px; color:#64748b; font-size:0.85rem;">No site visits requested yet.'
)

with open('src/main/resources/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

with open('target/classes/static/propertydirect/js/admin-dashboard.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Updated admin-dashboard.js in src and target!")
