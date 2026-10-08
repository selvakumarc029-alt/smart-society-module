with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the style block starting at <!-- Smart Society Design Alignment: Gap Reduction...
start_marker = "<!-- Smart Society Design Alignment: Gap Reduction, Zero Unwanted Space & Sidebar Dots Fix -->"
end_marker = "</head>"

start_idx = html.find(start_marker)
end_idx = html.find(end_marker, start_idx)

assert start_idx != -1 and end_idx != -1, "Markers not found"

new_style_block = """<!-- Smart Society Design Alignment: Gap Reduction, Zero Unwanted Space & Sidebar Dots Fix -->
    <style>
        /* 1. Remove unwanted pseudo-element dots/circles from sidebar buttons */
        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button::before,
        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button::after {
            display: none !important;
            content: none !important;
        }

        /* 2. Sleek, unified Smart Society sidebar button layout */
        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button {
            display: flex !important;
            align-items: center !important;
            grid-template-columns: none !important;
            gap: 10px !important;
            height: 38px !important;
            min-height: 38px !important;
            padding: 8px 12px !important;
            margin: 0 0 2px 0 !important;
            font-size: 0.84rem !important;
            font-weight: 700 !important;
            border-radius: 10px !important;
            text-align: left !important;
            color: rgba(255, 255, 255, 0.78) !important;
            transition: all 0.18s ease !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button:hover:not(.active) {
            background: rgba(255, 255, 255, 0.08) !important;
            color: #ffffff !important;
            transform: none !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button.active {
            background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
            color: #ffffff !important;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35) !important;
            border: none !important;
            transform: none !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav button svg {
            flex-shrink: 0 !important;
            margin: 0 !important;
            opacity: 0.9 !important;
        }

        /* 3. Ensure sidebar scrolling & height fits all 12 navigation items without large bottom gap */
        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar {
            height: 100vh !important;
            height: 100dvh !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 0 10px 10px 10px !important;
            box-sizing: border-box !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow-y: auto !important;
            scrollbar-width: thin !important;
            padding: 10px 4px 6px 0 !important;
            margin-bottom: 0 !important;
            gap: 2px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-user-card {
            flex-shrink: 0 !important;
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            margin-top: auto !important;
            padding: 8px 12px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        /* 4. Desktop Header: Title on Left, Actions on Right, No Collisions, Zero Margins */
        @media (min-width: 901px) {
            html body.app-dashboard[data-platform="propertydirect"] .dash-header .dashboard-menu-toggle,
            html body.app-dashboard[data-platform="propertydirect"] .dashboard-menu-toggle {
                display: none !important;
            }
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-header {
            min-height: 70px !important;
            height: 70px !important;
            max-height: 70px !important;
            padding: 0 28px !important;
            margin: 0 !important;
            background: #ffffff !important;
            border-bottom: 1px solid #e2e8f0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            width: 100% !important;
            gap: 16px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-header > div:first-of-type {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            text-align: left !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-header .header-actions {
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-header h1,
        html body.app-dashboard[data-platform="propertydirect"] .dash-header #panelTitle {
            font-size: 1.35rem !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin: 2px 0 0 0 !important;
            line-height: 1.2 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-header .propertydirect-section-eyebrow {
            font-size: 0.72rem !important;
            letter-spacing: 0.08em !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            color: #64748b !important;
            margin: 0 !important;
        }

        /* 5. Eliminate unwanted vertical gaps across all dashboard panels */
        html body.app-dashboard[data-platform="propertydirect"] .dash-panel {
            padding: 16px 28px 24px 28px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-card {
            margin: 0 0 16px 0 !important;
            border-radius: 14px !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05) !important;
        }

        /* 6. Clean Table Card (No nested border gaps or double padding) */
        html body.app-dashboard[data-platform="propertydirect"] .dash-card:has(.dashboard-table-scroll),
        html body.app-dashboard[data-platform="propertydirect"] #subtabEnquiriesView,
        html body.app-dashboard[data-platform="propertydirect"] #subtabVisitsView {
            padding: 0 !important;
            overflow: hidden !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 14px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table {
            margin: 0 !important;
            border-collapse: collapse !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table th {
            padding: 10px 14px !important;
            font-size: 0.74rem !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            background: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table td {
            padding: 11px 14px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table td[colspan] {
            padding: 20px 14px !important;
            font-size: 0.85rem !important;
        }

        /* 7. Tight panel top row (no wrap collapse) */
        html body.app-dashboard[data-platform="propertydirect"] .dash-panel > div:first-child {
            margin-bottom: 12px !important;
        }
    </style>
    """

html = html[:start_idx] + new_style_block + html[end_idx:]

# Also update the Enquiries panel markup
old_enquiries_header = """            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:14px;">
                <div>
                    <h2 style="font-size:1.45rem; font-weight:800; color:#0f172a; margin:0 0 4px 0;">Customer Enquiries & Visit Tracking</h2>
                    <p style="font-size:0.88rem; color:#64748b; margin:0;">Track customer inquiries across properties and projects, respond to messages, and manage site visit appointments.</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button type="button" id="subtabEnquiriesBtn" class="pill-btn active" onclick="switchEnquirySubtab('enquiries')"
                        style="padding:8px 16px; border-radius:10px; font-weight:700; font-size:0.84rem; cursor:pointer; border:1px solid #cbd5e1; background:#0f172a; color:#ffffff;">
                        Customer Inquiries
                    </button>
                    <button type="button" id="subtabVisitsBtn" class="pill-btn" onclick="switchEnquirySubtab('visits')"
                        style="padding:8px 16px; border-radius:10px; font-weight:700; font-size:0.84rem; cursor:pointer; border:1px solid #cbd5e1; background:#ffffff; color:#334155;">
                        Scheduled Visits
                    </button>
                </div>
            </div>"""

new_enquiries_header = """            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                <div style="flex:1 1 340px; min-width:240px;">
                    <h2 style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0 0 2px 0; line-height:1.2;">Customer Enquiries &amp; Visit Tracking</h2>
                    <p style="font-size:0.84rem; color:#64748b; margin:0; line-height:1.35;">Track customer inquiries across properties and projects, respond to messages, and manage site visit appointments.</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <button type="button" id="subtabEnquiriesBtn" class="pill-btn active" onclick="switchEnquirySubtab('enquiries')"
                        style="padding:7px 16px; border-radius:10px; font-weight:700; font-size:0.82rem; cursor:pointer; border:1px solid #cbd5e1; background:#0f172a; color:#ffffff;">
                        Customer Inquiries
                    </button>
                    <button type="button" id="subtabVisitsBtn" class="pill-btn" onclick="switchEnquirySubtab('visits')"
                        style="padding:7px 16px; border-radius:10px; font-weight:700; font-size:0.82rem; cursor:pointer; border:1px solid #cbd5e1; background:#ffffff; color:#334155;">
                        Scheduled Visits
                    </button>
                </div>
            </div>"""

if old_enquiries_header in html:
    html = html.replace(old_enquiries_header, new_enquiries_header)
    print("Replaced enquiries header markup")
else:
    print("Enquiries header markup was already updated or not found")

with open('src/main/resources/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('target/classes/templates/propertydirect/dashboards/admin.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Saved admin.html to src and target!")
