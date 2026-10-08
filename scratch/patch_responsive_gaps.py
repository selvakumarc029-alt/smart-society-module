with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix admin & customer header margin and panel margin-left
old1 = """html body.app-dashboard[data-platform="propertydirect"]:is([data-dashboard-role="admin"], [data-dashboard-role="customer"]) main.dash-main > .dash-header {
  width: 100% !important;
  max-width: 100% !important;
  height: 80px !important;
  min-height: 80px !important;
  max-height: 80px !important;
  margin: 0 0 24px 0 !important;
  padding: 0 28px !important;
  top: 0 !important;
  position: sticky !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
  border-radius: 0 !important;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04) !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}

html body.app-dashboard[data-platform="propertydirect"]:is([data-dashboard-role="admin"], [data-dashboard-role="customer"]) main.dash-main > .dash-panel {
  margin-left: 24px !important;
  width: calc(100% - 24px) !important;
  max-width: calc(100% - 24px) !important;
}"""

new1 = """html body.app-dashboard[data-platform="propertydirect"]:is([data-dashboard-role="admin"], [data-dashboard-role="customer"]) main.dash-main > .dash-header {
  width: 100% !important;
  max-width: 100% !important;
  height: 72px !important;
  min-height: 72px !important;
  max-height: 72px !important;
  margin: 0 !important;
  padding: 0 28px !important;
  top: 0 !important;
  position: sticky !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
  border-radius: 0 !important;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04) !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}

html body.app-dashboard[data-platform="propertydirect"]:is([data-dashboard-role="admin"], [data-dashboard-role="customer"]) main.dash-main > .dash-panel {
  margin-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  padding: 16px 28px 24px 28px !important;
}"""

assert old1 in content, "old1 not found"
content = content.replace(old1, new1)

# 2. Fix vendor & agent headers and panels
old2 = """html body[data-dashboard-role="vendor"] main.vendor-main > header.vendor-top {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 0 24px 0 !important;
  padding: 18px 32px !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-radius: 0 0 14px 0 !important;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}

html body[data-dashboard-role="vendor"] main.vendor-main > .vendor-panel {
  margin-left: 32px !important;
  width: calc(100% - 32px) !important;
  max-width: calc(100% - 32px) !important;
}"""

new2 = """html body[data-dashboard-role="vendor"] main.vendor-main > header.vendor-top {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 14px 28px !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-radius: 0 0 14px 0 !important;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}

html body[data-dashboard-role="vendor"] main.vendor-main > .vendor-panel {
  margin-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  padding: 16px 28px 24px 28px !important;
}"""

assert old2 in content, "old2 not found"
content = content.replace(old2, new2)

old3 = """html body[data-dashboard-role="agent"] main.agent-main > header.agent-header {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 0 24px 0 !important;
  padding: 18px 32px !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-radius: 0 0 14px 0 !important;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}

html body[data-dashboard-role="agent"] main.agent-main > .dash-panel {
  margin-left: 32px !important;"""

new3 = """html body[data-dashboard-role="agent"] main.agent-main > header.agent-header {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 14px 28px !important;
  border-left: 0 !important;
  border-top: 0 !important;
  border-right: 0 !important;
  border-radius: 0 0 14px 0 !important;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}

html body[data-dashboard-role="agent"] main.agent-main > .dash-panel {
  margin-left: 0 !important;"""

assert old3 in content, "old3 not found"
content = content.replace(old3, new3)

# 3. Fix sticky flush fallback
old4 = """/* Topbar Sticky Flush */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-header, .dash-main > .dash-header),
html body[data-dashboard-role="vendor"] :is(.vendor-top, .vendor-main > .vendor-top) {
  position: sticky !important;
  top: 0 !important;
  z-index: 1020 !important;
  height: 70px !important;
  min-height: 70px !important;
  max-height: 70px !important;
  margin: 0 0 24px 0 !important;
  padding: 0 32px !important;
  border: 0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
  border-radius: 0 !important;
  background: #ffffff !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  box-sizing: border-box !important;
}

/* Panels */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-panel, .dashboard-content),
html body[data-dashboard-role="vendor"] :is(.vendor-main > .dash-panel, .vendor-content) {
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 32px 40px 32px !important;
  box-sizing: border-box !important;
}"""

new4 = """/* Topbar Sticky Flush */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-header, .dash-main > .dash-header),
html body[data-dashboard-role="vendor"] :is(.vendor-top, .vendor-main > .vendor-top) {
  position: sticky !important;
  top: 0 !important;
  z-index: 1020 !important;
  height: 72px !important;
  min-height: 72px !important;
  max-height: 72px !important;
  margin: 0 !important;
  padding: 0 28px !important;
  border: 0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
  border-radius: 0 !important;
  background: #ffffff !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  box-sizing: border-box !important;
}

/* Panels */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-panel, .dashboard-content),
html body[data-dashboard-role="vendor"] :is(.vendor-main > .dash-panel, .vendor-content) {
  width: 100% !important;
  max-width: 100% !important;
  padding: 16px 28px 24px 28px !important;
  box-sizing: border-box !important;
}"""

assert old4 in content, "old4 not found"
content = content.replace(old4, new4)

with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(content)

with open('target/classes/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched dashboard-responsive.css in both src and target!")
