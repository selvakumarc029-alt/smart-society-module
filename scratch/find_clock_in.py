import re

with open('src/main/resources/templates/dashboards/maintenance.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'Clock In', text, re.IGNORECASE)
if m:
    start = max(0, m.start() - 300)
    end = min(len(text), m.end() + 1000)
    print("FOUND AT:", m.start())
    print(text[start:end])
else:
    print("NOT FOUND")
