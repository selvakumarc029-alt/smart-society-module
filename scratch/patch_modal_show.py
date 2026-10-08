import re

ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"
ADMIN_JS_PATH = r"src/main/resources/static/propertydirect/js/admin-dashboard.js"
TARGET_ADMIN_JS_PATH = r"target/classes/static/propertydirect/js/admin-dashboard.js"

# 1. Patch admin.html CSS
with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

modal_css = '''
        /* Ensure Metadata Detail Modal activates with backdrop blur */
        #metadataDetailModal.show,
        #metadataDetailModal.active {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            pointer-events: auto !important;
            visibility: visible !important;
            z-index: 999999 !important;
            position: fixed !important;
            inset: 0 !important;
            background: rgba(15, 23, 42, 0.65) !important;
            backdrop-filter: blur(6px) !important;
        }
        #metadataDetailModal:not(.show):not(.active),
        #metadataDetailModal.hidden {
            display: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
            z-index: -9999 !important;
        }
'''

if "#metadataDetailModal.show" not in html:
    head_close = html.find("</head>")
    if head_close != -1:
        html = html[:head_close] + "<style>" + modal_css + "</style>\n" + html[head_close:]
        print("Injected modal active CSS into <head> of admin.html.")

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

# 2. Patch admin-dashboard.js
with open(ADMIN_JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# Update openMetadataDetailModal to add active and show
js = js.replace(
'''        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";''',
'''        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.classList.add("active");
        modal.classList.add("show");
        modal.style.display = "flex";'''
)

# Update closeModal helper to remove active and show
js = js.replace(
'''    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.style.display = "none";
        }
    };''',
'''    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("active");
            modal.classList.remove("show");
            modal.style.display = "none";
        }
    };'''
)

with open(ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
with open(TARGET_ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)

print("Synchronized admin.html and admin-dashboard.js with modal active/show classes!")
