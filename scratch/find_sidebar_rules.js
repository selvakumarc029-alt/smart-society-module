async function test() {
  const listRes = await fetch('http://127.0.0.1:9222/json');
  const tabs = await listRes.json();
  let tab = tabs.find(t => t.type === 'page' && t.url.includes('admin'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const s = document.querySelector('.dash-sidebar');
        const rules = [];
        for (let sheet of document.styleSheets) {
          try {
            for (let r of sheet.cssRules) {
              if (r.selectorText && s.matches(r.selectorText)) {
                if (r.style.transform || r.style.width || r.style.position) {
                  rules.push({ selector: r.selectorText, transform: r.style.transform, width: r.style.width, pos: r.style.position, parentMedia: r.parentMedia ? r.parentMedia.mediaText : null, href: sheet.href });
                }
              }
            }
          } catch(e) {}
        }
        return rules;
      })()
    `,
    returnByValue: true
  });

  console.log('Matching Rules on Sidebar:', JSON.stringify(res.result.result.value, null, 2));
  ws.close();
  process.exit(0);
}
test();
