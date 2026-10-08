ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"

with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

left_align_css = '''
        #metadataDetailForm,
        #metaDynamicFields,
        #metadataDetailForm div,
        #metadataDetailForm label {
            text-align: left !important;
            justify-content: flex-start !important;
            align-items: center !important;
        }
        #metadataDetailModal label {
            display: flex !important;
            justify-content: flex-start !important;
            text-align: left !important;
            gap: 4px !important;
            width: 100% !important;
        }
'''

if "#metadataDetailForm div" not in html:
    head_close = html.find("</head>")
    if head_close != -1:
        html = html[:head_close] + "<style>" + left_align_css + "</style>\n" + html[head_close:]
        print("Injected left-align styles into <head> of admin.html.")

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("Synchronized label alignment!")
