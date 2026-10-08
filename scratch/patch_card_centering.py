with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'r', encoding='utf-8') as f:
    content = f.read()

old_rule = """html body.app-dashboard[data-platform="propertydirect"] :is(.dash-card, .metric-card, .stats-card, .summary-card, .kpi-card, article),
html body[data-dashboard-role="vendor"] :is(.dash-card, .metric-card, .stats-card, .summary-card, .kpi-card, article) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 118px;
  overflow: hidden !important;
}"""

new_rule = """html body.app-dashboard[data-platform="propertydirect"] :is(.dash-grid, .stats-grid, .metric-grid, .summary-grid, .kpi-grid) > :is(.dash-card, .metric-card, .stats-card, .summary-card, .kpi-card, article),
html body[data-dashboard-role="vendor"] :is(.vendor-grid, .stats-grid, .metric-grid, .summary-grid, .kpi-grid) > :is(.dash-card, .metric-card, .stats-card, .summary-card, .kpi-card, article) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 118px;
  overflow: hidden !important;
}

/* Dedicated Table and Content Card Reset - Never Vertically Centered with Gap */
html body.app-dashboard[data-platform="propertydirect"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)),
html body[data-dashboard-role="vendor"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)) {
  display: block !important;
  justify-content: flex-start !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}

html body.app-dashboard[data-platform="propertydirect"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)) .dashboard-table-scroll,
html body[data-dashboard-role="vendor"] :is(.dash-card:has(.dashboard-table-scroll), .dash-card.table-card, .dash-card:has(table)) .dashboard-table-scroll {
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  width: 100% !important;
}"""

assert old_rule in content, "old_rule not found"
content = content.replace(old_rule, new_rule)

with open('src/main/resources/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(content)

with open('target/classes/static/propertydirect/css/dashboard-responsive.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully replaced line 1519 rule in src and target!")
