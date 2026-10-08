# -*- coding: utf-8 -*-

html_path = 'src/main/resources/templates/propertydirect/dashboards/admin.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

style_snippet = """    <!-- Smart Society Design Alignment: Gap Reduction, Zero Unwanted Space & Sidebar Dots Fix -->
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
            height: 40px !important;
            min-height: 40px !important;
            padding: 8px 14px !important;
            margin: 0 0 3px 0 !important;
            font-size: 0.85rem !important;
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
            padding: 0 12px 14px 12px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-nav {
            flex: 1 1 auto !important;
            overflow-y: auto !important;
            scrollbar-width: thin !important;
            padding-right: 4px !important;
            margin-bottom: 8px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-sidebar .sidebar-user-card {
            flex-shrink: 0 !important;
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            margin-top: auto !important;
            padding-top: 10px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        /* 4. Eliminate unwanted vertical gaps across all dashboard panels */
        html body.app-dashboard[data-platform="propertydirect"] .dash-header {
            min-height: 72px !important;
            height: 72px !important;
            max-height: 72px !important;
            padding: 0 28px !important;
            margin: 0 0 6px 0 !important;
            background: #ffffff !important;
            border-bottom: 1px solid #e2e8f0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-panel {
            padding: 16px 28px 32px 28px !important;
            margin: 0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dash-card {
            margin: 0 0 18px 0 !important;
            border-radius: 14px !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05) !important;
        }

        /* 5. Tighter title rows and controls (no excessive wrap gaps) */
        html body.app-dashboard[data-platform="propertydirect"] .dash-panel > div:first-child {
            margin-bottom: 14px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll {
            margin: 0 !important;
            padding: 0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table {
            margin: 0 !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table th {
            padding: 10px 14px !important;
            font-size: 0.74rem !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            background: #f8fafc !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table td {
            padding: 12px 14px !important;
        }

        html body.app-dashboard[data-platform="propertydirect"] .dashboard-table-scroll table td[colspan] {
            padding: 24px 16px !important;
        }
    </style>
</head>"""

target = "</head>"
assert target in content, "</head> not found in admin.html"
content = content.replace(target, style_snippet, 1)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)

# Copy to target/classes
import shutil
shutil.copyfile(html_path, 'target/classes/templates/propertydirect/dashboards/admin.html')
print("Successfully applied Smart Society gap reduction and sidebar styling!")
