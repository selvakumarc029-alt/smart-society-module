# -*- coding: utf-8 -*-

path = 'src/main/resources/templates/propertydirect/dashboards/admin.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = '        /* 4. Eliminate unwanted vertical gaps across all dashboard panels */'
replacement = """        html body.app-dashboard[data-platform="propertydirect"] .dash-header h1,
        html body.app-dashboard[data-platform="propertydirect"] .dash-header #panelTitle {
            font-size: 1.35rem !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
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

        /* 4. Eliminate unwanted vertical gaps across all dashboard panels */"""

if target in text:
    text = text.replace(target, replacement, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

import shutil
shutil.copyfile(path, 'target/classes/templates/propertydirect/dashboards/admin.html')
print('Updated header typography and copied to target/classes!')
