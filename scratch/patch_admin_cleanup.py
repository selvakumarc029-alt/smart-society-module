# -*- coding: utf-8 -*-
import re

html_path = 'src/main/resources/templates/propertydirect/dashboards/admin.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update sidebar nav buttons to have explicit type="button" and onclick="switchTabAndFilter(this.dataset.panel); return false;"
sidebar_old = """        <nav class="sidebar-nav" aria-label="Platform Admin sections">
            <button class="active" data-panel="overview">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Overview & Metrics
            </button>
            <button data-panel="users" style="position:relative;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Customer Directory
                <span id="sidebarUserCountBadge" style="margin-left:auto; background:rgba(59,130,246,0.25); color:#60a5fa; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800;">0</span>
            </button>
            <button data-panel="verifications">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Owner & Builder Verification
                <span id="sidebarPendingAppsBadge" style="margin-left:auto; background:rgba(245,158,11,0.25); color:#fbbf24; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button data-panel="projects">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line></svg>
                Builder Projects & Units
            </button>
            <button data-panel="my-properties">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Property Inventory & Queue
                <span id="sidebarPendingListingsBadge" style="margin-left:auto; background:rgba(239,68,68,0.25); color:#f87171; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button data-panel="enquiries">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Enquiries & Visit Tracking
            </button>
            <button data-panel="reports">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Reports & Complaints
                <span id="sidebarOpenReportsBadge" style="margin-left:auto; background:rgba(239,68,68,0.25); color:#f87171; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button data-panel="metadata">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Categories & Locations
            </button>
            <button data-panel="content">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Featured & Content
            </button>
            <button data-panel="audit">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Notifications & Audit
            </button>
            <button data-panel="add-property">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Post Listing on Behalf
            </button>
            <button data-panel="profile">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Admin Profile
            </button>
        </nav>"""

sidebar_new = """        <nav class="sidebar-nav" aria-label="Platform Admin sections">
            <button class="active" type="button" data-panel="overview" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('overview');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Overview & Metrics
            </button>
            <button type="button" data-panel="users" style="position:relative;" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('users');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Customer Directory
                <span id="sidebarUserCountBadge" style="margin-left:auto; background:rgba(59,130,246,0.25); color:#60a5fa; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800;">0</span>
            </button>
            <button type="button" data-panel="verifications" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('verifications');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Owner & Builder Verification
                <span id="sidebarPendingAppsBadge" style="margin-left:auto; background:rgba(245,158,11,0.25); color:#fbbf24; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button type="button" data-panel="projects" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('projects');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line></svg>
                Builder Projects & Units
            </button>
            <button type="button" data-panel="my-properties" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('my-properties');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Property Inventory & Queue
                <span id="sidebarPendingListingsBadge" style="margin-left:auto; background:rgba(239,68,68,0.25); color:#f87171; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button type="button" data-panel="enquiries" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('enquiries');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Enquiries & Visit Tracking
            </button>
            <button type="button" data-panel="reports" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('reports');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Reports & Complaints
                <span id="sidebarOpenReportsBadge" style="margin-left:auto; background:rgba(239,68,68,0.25); color:#f87171; font-size:0.72rem; padding:2px 7px; border-radius:10px; font-weight:800; display:none;">0</span>
            </button>
            <button type="button" data-panel="metadata" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('metadata');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Categories & Locations
            </button>
            <button type="button" data-panel="content" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('content');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Featured & Content
            </button>
            <button type="button" data-panel="audit" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('audit');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Notifications & Audit
            </button>
            <button type="button" data-panel="add-property" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('add-property');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Post Listing on Behalf
            </button>
            <button type="button" data-panel="profile" onclick="if(window.switchTabAndFilter){window.switchTabAndFilter('profile');}return false;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Admin Profile
            </button>
        </nav>"""

assert sidebar_old in content, "sidebar_old not found in admin.html"
content = content.replace(sidebar_old, sidebar_new)

# 2. Update lines 3353-3405 forwarder script
switch_script_old = """    <script>
        document.addEventListener("DOMContentLoaded", function () {
            function switchTab(panelId) {
                if (!panelId) return;

                document.querySelectorAll("[data-panel]").forEach(function (btn) {
                    if (btn.dataset.panel === panelId) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });

                document.querySelectorAll("[data-view]").forEach(function (view) {
                    if (view.dataset.view === panelId) {
                        view.classList.remove("hidden");
                        view.style.display = "block";
                    } else {
                        view.classList.add("hidden");
                        view.style.display = "none";
                    }
                });

                var activeBtn = document.querySelector('.sidebar-nav [data-panel="' + panelId + '"]');
                var titleElem = document.getElementById("panelTitle");
                if (activeBtn && titleElem) {
                    var text = activeBtn.textContent.trim();
                    titleElem.textContent = text;
                }

                if (history.pushState) {
                    history.pushState(null, null, '#' + panelId);
                } else {
                    location.hash = '#' + panelId;
                }
            }

            document.addEventListener("click", function (e) {
                var target = e.target.closest("[data-panel]");
                if (target) {
                    e.preventDefault();
                    switchTab(target.dataset.panel);
                }
            });

            var initialHash = window.location.hash.replace("#", "");
            if (initialHash && document.querySelector('[data-view="' + initialHash + '"]')) {
                switchTab(initialHash);
            } else {
                switchTab("overview");
            }
        });
    </script>"""

switch_script_new = """    <script>
        window.switchTab = function(panelId, filterOptions) {
            if (window.switchTabAndFilter) {
                window.switchTabAndFilter(panelId, filterOptions);
            }
        };
        document.addEventListener("click", function (e) {
            var target = e.target.closest("[data-panel]");
            if (target && target.dataset && target.dataset.panel) {
                if (window.switchTabAndFilter) {
                    e.preventDefault();
                    window.switchTabAndFilter(target.dataset.panel);
                }
            }
        });
    </script>"""

assert switch_script_old in content, "switch_script_old not found in admin.html"
content = content.replace(switch_script_old, switch_script_new)

# 3. Rename older duplicate panels
content = content.replace(
    '<section class="dash-panel hidden pd-reports-panel" data-view="reports">',
    '<section class="dash-panel hidden pd-reports-panel" data-view="legacy-analytics">'
)
content = content.replace(
    '<section class="dash-panel hidden" data-view="content">\n            <div class="dash-card">\n                <div class="card-head">\n                    <div>\n                        <h3>Content & feedback',
    '<section class="dash-panel hidden" data-view="legacy-content">\n            <div class="dash-card">\n                <div class="card-head">\n                    <div>\n                        <h3>Content & feedback'
)
content = content.replace(
    '<section class="dash-panel hidden" data-view="profile">\n            <div class="dash-card">\n                <div class="card-head">\n                    <div>\n                        <h3>Moderator profile & notification preferences',
    '<section class="dash-panel hidden" data-view="legacy-profile">\n            <div class="dash-card">\n                <div class="card-head">\n                    <div>\n                        <h3>Moderator profile & notification preferences'
)

# 4. Remove the broken duplicate script at lines 3612-4077
# Finding the block starting with "<!-- PropertyDirect User Management & Account Verification Engine -->"
marker_start = "    <!-- PropertyDirect User Management & Account Verification Engine -->"
marker_end = "    <!-- Modal: Review Seller Application -->"

pos_start = content.find(marker_start)
pos_end = content.find(marker_end)
assert pos_start != -1 and pos_end != -1 and pos_start < pos_end, "Script marker block not found!"

content = content[:pos_start] + content[pos_end:]

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("admin.html patched successfully!")
