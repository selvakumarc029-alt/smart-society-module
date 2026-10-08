import re

# 1. Update dashboard-responsive.css
with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'r', encoding='utf-8') as f:
    resp = f.read()

# Replace 80px brand height with 72px
resp = re.sub(
    r'(html body\.app-dashboard\[data-platform="propertydirect"\] \.dash-brand\s*\{\s*height:\s*)80px(\s*!important;\s*min-height:\s*)80px(\s*!important;\s*max-height:\s*)80px',
    r'\g<1>72px\g<2>72px\g<3>72px',
    resp
)

resp = re.sub(
    r'(html body\.app-dashboard\[data-platform="propertydirect"\] \.dash-sidebar \.dash-brand,\s*html body\.app-dashboard\[data-platform="propertydirect"\] \.dash-brand\s*\{\s*height:\s*)80px(\s*!important;\s*min-height:\s*)80px(\s*!important;\s*max-height:\s*)80px',
    r'\g<1>72px\g<2>72px\g<3>72px',
    resp
)

resp = resp.replace('--dashboard-topbar-height: 80px !important;', '--dashboard-topbar-height: 72px !important;')

with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
with open('target/classes/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(resp)
print("Updated dashboard-responsive.css")

# 2. Update dashboard-polish.css
with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'r', encoding='utf-8') as f:
    polish = f.read()

polish = re.sub(
    r'(html body\.app-dashboard\[data-platform="propertydirect"\] \.dash-brand\s*\{\s*height:\s*)80px(\s*!important;\s*min-height:\s*)80px(\s*!important;\s*max-height:\s*)80px',
    r'\g<1>72px\g<2>72px\g<3>72px',
    polish
)
polish = polish.replace('--dashboard-topbar-height: 80px !important;', '--dashboard-topbar-height: 72px !important;')

with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(polish)
with open('target/classes/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(polish)
print("Updated dashboard-polish.css")

# 3. Update dashboard-sidebar-final.css
with open('src/main/resources/static/shared/css/dashboard-sidebar-final.css', 'r', encoding='utf-8') as f:
    sidebar = f.read()

sidebar = sidebar.replace('--dashboard-topbar-height: 82px !important;', '--dashboard-topbar-height: 72px !important;')
sidebar = sidebar.replace('--dashboard-topbar-height: 80px !important;', '--dashboard-topbar-height: 72px !important;')

with open('src/main/resources/static/shared/css/dashboard-sidebar-final.css', 'w', encoding='utf-8') as f:
    f.write(sidebar)
with open('target/classes/static/shared/css/dashboard-sidebar-final.css', 'w', encoding='utf-8') as f:
    f.write(sidebar)
print("Updated dashboard-sidebar-final.css")

# 4. Update admin.html style section
with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'r', encoding='utf-8') as f:
    admin_html = f.read()

# Add explicit seamless alignment guarantee in admin.html
guarantee = """        /* Exact Seamless Horizontal Baseline Alignment (72px) between Brand & Header */
        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .dash-brand,
        html body.app-dashboard[data-platform="propertydirect"] .dash-brand {
            height: 72px !important;
            min-height: 72px !important;
            max-height: 72px !important;
            box-sizing: border-box !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            margin: 0 !important;
            padding: 0 16px !important;
            display: flex !important;
            align-items: center !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] main.dash-main > .dash-header,
        html body.app-dashboard[data-platform="propertydirect"] .dash-header {
            height: 72px !important;
            min-height: 72px !important;
            max-height: 72px !important;
            box-sizing: border-box !important;
            border-bottom: 1px solid #e2e8f0 !important;
            margin: 0 !important;
            padding: 0 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
        }"""

if "/* Exact Seamless Horizontal Baseline Alignment (72px) between Brand & Header */" not in admin_html:
    admin_html = admin_html.replace(
        "/* 4. Desktop Header: Title on Left, Actions on Right, No Collisions, Zero Margins */",
        guarantee + "\n\n        /* 4. Desktop Header: Title on Left, Actions on Right, No Collisions, Zero Margins */"
    )

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
with open('target/classes/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
print("Updated admin.html in src and target")
