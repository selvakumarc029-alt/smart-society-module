import re

scrollbar_clean_css = """
/* -------------------------------------------------------------
   HIDE SIDEBAR VERTICAL SCROLLBAR LINE COMPLETELY
   Keeps scrollability while removing vertical scrollbar bar & arrows
   ------------------------------------------------------------- */
html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar),
html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar) :is(.sidebar-nav, nav, .nav, .sidebar-body),
html body.app-dashboard .sidebar-nav {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}

html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar)::-webkit-scrollbar,
html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar) :is(.sidebar-nav, nav, .nav, .sidebar-body)::-webkit-scrollbar,
html body.app-dashboard .sidebar-nav::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
    background: transparent !important;
}

html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar) :is(.sidebar-nav, nav, .nav)::-webkit-scrollbar-thumb,
html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar) :is(.sidebar-nav, nav, .nav)::-webkit-scrollbar-track,
html body.app-dashboard :is(.dash-sidebar, .sidebar, .vendor-sidebar, .agent-sidebar) :is(.sidebar-nav, nav, .nav)::-webkit-scrollbar-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
}
"""

# 1. Update dashboard-responsive.css
with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'r', encoding='utf-8') as f:
    resp = f.read()

# Replace scrollbar-width: thin on sidebar
resp = resp.replace('scrollbar-width: thin !important;', 'scrollbar-width: none !important;')
resp += scrollbar_clean_css

with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
with open('target/classes/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
print("Updated dashboard-responsive.css")

# 2. Update dashboard-polish.css
with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'r', encoding='utf-8') as f:
    polish = f.read()

polish = polish.replace('scrollbar-width: thin !important;', 'scrollbar-width: none !important;')
polish += scrollbar_clean_css

with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(polish)
with open('target/classes/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(polish)
print("Updated dashboard-polish.css")

# 3. Update dashboard-sidebar-final.css
with open('src/main/resources/static/shared/css/dashboard-sidebar-final.css', 'r', encoding='utf-8') as f:
    sidebar = f.read()

sidebar = sidebar.replace('scrollbar-width: thin !important;', 'scrollbar-width: none !important;')
sidebar += scrollbar_clean_css

with open('src/main/resources/static/shared/css/dashboard-sidebar-final.css', 'w', encoding='utf-8') as f:
    f.write(sidebar)
with open('target/classes/static/shared/css/dashboard-sidebar-final.css', 'w', encoding='utf-8') as f:
    f.write(sidebar)
print("Updated dashboard-sidebar-final.css")

# 4. Update admin.html
with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'r', encoding='utf-8') as f:
    admin_html = f.read()

admin_html = admin_html.replace('scrollbar-width: thin !important;', 'scrollbar-width: none !important;')

marker = "/* 1. Remove unwanted pseudo-element dots/circles from sidebar buttons */"
if marker in admin_html:
    admin_html = admin_html.replace(marker, scrollbar_clean_css + "\n        " + marker)

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
with open('target/classes/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
print("Updated admin.html in src and target")
