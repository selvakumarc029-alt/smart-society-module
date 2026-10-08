import re

ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"
ADMIN_JS_PATH = r"src/main/resources/static/propertydirect/js/admin-dashboard.js"
TARGET_ADMIN_JS_PATH = r"target/classes/static/propertydirect/js/admin-dashboard.js"

# 1. Update admin.html CSS
with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

checkbox_fix_css = '''
        #metadataDetailModal input[type="checkbox"] {
            width: 20px !important;
            min-width: 20px !important;
            max-width: 20px !important;
            height: 20px !important;
            min-height: 20px !important;
            margin: 0 !important;
            flex-shrink: 0 !important;
            cursor: pointer !important;
        }
        #metadataDetailModal label {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
'''

if "#metadataDetailModal input[type=\"checkbox\"]" not in html:
    head_close = html.find("</head>")
    if head_close != -1:
        html = html[:head_close] + "<style>" + checkbox_fix_css + "</style>\n" + html[head_close:]
        print("Injected checkbox & label styles into <head> of admin.html.")

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

# 2. Update admin-dashboard.js with !important on submit button background and inline label spans
with open(ADMIN_JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# Make submit button background !important
js = js.replace(
    "submitBtn.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';",
    "submitBtn.style.setProperty('background', 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', 'important');"
)
js = js.replace(
    "submitBtn.style.background = 'linear-gradient(135deg, #065f46 0%, #059669 100%)';",
    "submitBtn.style.setProperty('background', 'linear-gradient(135deg, #065f46 0%, #059669 100%)', 'important');"
)
js = js.replace(
    "submitBtn.style.background = 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)';",
    "submitBtn.style.setProperty('background', 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)', 'important');"
)

with open(ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
with open(TARGET_ADMIN_JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)

print("Synchronized polish improvements to admin.html and admin-dashboard.js!")
