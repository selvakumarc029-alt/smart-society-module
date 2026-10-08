ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"

with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

html = html.replace(
'''        #metadataDetailModal label {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
        }''',
'''        #metadataDetailModal label {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            text-align: left !important;
            gap: 4px !important;
        }'''
)

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("Updated label alignment in admin.html!")
