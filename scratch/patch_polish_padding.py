with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'r', encoding='utf-8') as f:
    content = f.read()

old_polish = """        html body.app-dashboard[data-platform="propertydirect"] .dash-panel {
            padding: 24px 32px 48px 32px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }"""

new_polish = """        html body.app-dashboard[data-platform="propertydirect"] .dash-panel {
            padding: 16px 28px 24px 28px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }"""

if old_polish in content:
    content = content.replace(old_polish, new_polish)
    print("Found and replaced old_polish")
else:
    # try normalized
    import re
    content = re.sub(
        r'html body\.app-dashboard\[data-platform="propertydirect"\] \.dash-panel\s*\{\s*padding:\s*24px 32px 48px(?: 32px)? !important;',
        'html body.app-dashboard[data-platform="propertydirect"] .dash-panel {\n            padding: 16px 28px 24px 28px !important;',
        content
    )
    print("Regex replaced polish padding")

with open('src/main/resources/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(content)

with open('target/classes/static/propertydirect/css/dashboard-polish.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved dashboard-polish.css to src and target!")
