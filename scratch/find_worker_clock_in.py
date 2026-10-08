import re

with open('src/main/resources/templates/dashboards/maintenance.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'function workerClockIn', text) or re.search(r'window\.workerClockIn', text)
if m:
    start = max(0, m.start() - 200)
    end = min(len(text), m.end() + 2500)
    print("FOUND AT:", m.start())
    print(text[start:end])
else:
    print("NOT FOUND")
