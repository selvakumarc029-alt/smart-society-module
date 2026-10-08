import re

ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"
ADMIN_JS_PATH = r"src/main/resources/static/propertydirect/js/admin-dashboard.js"
TARGET_ADMIN_JS_PATH = r"target/classes/static/propertydirect/js/admin-dashboard.js"

# 1. Update admin.html
with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# Update the metadata grids to minmax(240px, 1fr) so items have plenty of room
html = html.replace('minmax(200px, 1fr)', 'minmax(240px, 1fr)')
html = html.replace('minmax(180px, 1fr)', 'minmax(220px, 1fr)')
html = html.replace('minmax(190px, 1fr)', 'minmax(240px, 1fr)')

# Update modal definition with z-index:999999; and role dialog
old_modal_start = html.find('<div id="metadataDetailModal"')
if old_modal_start != -1:
    old_modal_end = html.find('<!-- PropertyDirect Unified Platform Admin Script -->', old_modal_start)
    new_modal_html = '''<div class="modal hidden" id="metadataDetailModal" role="dialog" aria-modal="true" aria-labelledby="metaModalTitle" style="z-index:999999;">
        <div class="modal-card" style="width:min(620px, 94vw) !important; max-height:88vh; overflow-y:auto; padding:28px 32px !important; border-radius:20px; box-shadow:0 25px 60px rgba(15,23,42,0.35); background:#ffffff;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div id="metaModalIconBadge" style="width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <!-- SVG injected by JS -->
                    </div>
                    <div>
                        <h2 id="metaModalTitle" style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0 0 2px 0;">Configure Catalog Item</h2>
                        <p id="metaModalSubtitle" style="font-size:0.82rem; color:#64748b; margin:0;">Platform metadata taxonomy specification.</p>
                    </div>
                </div>
                <button type="button" class="close" onclick="closeModal('metadataDetailModal')" aria-label="Close" style="width:34px; height:34px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:1.1rem; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s ease;">✕</button>
            </div>

            <form id="metadataDetailForm" onsubmit="submitMetadataDetail(event)">
                <input type="hidden" id="metaItemType" value="Category">

                <!-- Dynamic Form Fields injected via JS based on type -->
                <div id="metaDynamicFields" style="display:flex; flex-direction:column; gap:16px;">
                    <!-- Injected dynamically -->
                </div>

                <div class="pd-modal-actions" style="display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
                    <button type="button" onclick="closeModal('metadataDetailModal')" class="modal-cancel" style="padding:10px 18px; border-radius:12px; border:1px solid #cbd5e1; background:#ffffff; color:#475569; font-weight:700; font-size:0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" id="metaSubmitBtn" class="primary" style="padding:10px 24px; border-radius:12px; font-weight:750; font-size:0.85rem; color:#ffffff; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(15,23,42,0.2);">
                        Save & Publish Item
                    </button>
                </div>
            </form>
        </div>
    </div>

    '''
    html = html[:old_modal_start] + new_modal_html + html[old_modal_end:]
    print("Updated metadataDetailModal in admin.html with z-index:999999")

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

# 2. Update admin-dashboard.js
with open(ADMIN_JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# Replace white-space:nowrap; overflow:hidden; text-overflow:ellipsis; with word-wrap in metadata cards
js = js.replace('white-space:nowrap; overflow:hidden; text-overflow:ellipsis;', 'line-height:1.2; font-weight:750;')

# In openMetadataDetailModal, ensure modal display is set cleanly
js = js.replace(
'''        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.style.display = "grid";''',
'''        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";'''
)

with open(ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
with open(TARGET_ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)

print("Updated admin.html and admin-dashboard.js!")
