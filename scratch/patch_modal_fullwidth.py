import re

ADMIN_HTML_PATH = r"src/main/resources/templates/propertydirect/dashboards/admin.html"
TARGET_ADMIN_HTML_PATH = r"target/classes/templates/propertydirect/dashboards/admin.html"

with open(ADMIN_HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# Replace the previous block with clean stretch rules
html = re.sub(r'/\* Ensure Metadata Detail Modal activates with backdrop blur \*/.*?#metadataDetailModal label \{[^}]+\}', '''/* Ensure Metadata Detail Modal activates with backdrop blur */
        #metadataDetailModal.show,
        #metadataDetailModal.active {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            pointer-events: auto !important;
            visibility: visible !important;
            z-index: 999999 !important;
            position: fixed !important;
            inset: 0 !important;
            background: rgba(15, 23, 42, 0.65) !important;
            backdrop-filter: blur(6px) !important;
        }
        #metadataDetailModal:not(.show):not(.active),
        #metadataDetailModal.hidden {
            display: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
            z-index: -9999 !important;
        }
        #metadataDetailModal .modal-card {
            text-align: left !important;
        }
        #metadataDetailModal form,
        #metaDynamicFields {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
            width: 100% !important;
            text-align: left !important;
        }
        #metaDynamicFields > div {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            text-align: left !important;
        }
        #metaDynamicFields label {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            text-align: left !important;
            gap: 4px !important;
            margin-bottom: 6px !important;
            font-size: 0.82rem !important;
            font-weight: 750 !important;
            color: #334155 !important;
            width: 100% !important;
        }
        #metaDynamicFields input:not([type="checkbox"]),
        #metaDynamicFields textarea,
        #metaDynamicFields select {
            width: 100% !important;
            box-sizing: border-box !important;
        }
        #metadataDetailModal input[type="checkbox"] {
            width: 20px !important;
            min-width: 20px !important;
            max-width: 20px !important;
            height: 20px !important;
            min-height: 20px !important;
            margin: 0 !important;
            flex-shrink: 0 !important;
            cursor: pointer !important;
        }''', html, flags=re.DOTALL)

with open(ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
with open(TARGET_ADMIN_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("Updated modal field width and alignment styles!")
