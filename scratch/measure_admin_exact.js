const fs = require('fs');

async function run() {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    let tab = tabs.find(t => t.type === 'page' && t.url.includes('admin'));
    if (!tab) tab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
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
    await send('Runtime.enable');

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const brand = document.querySelector('.dash-brand');
          const header = document.querySelector('.dash-header');
          const sidebar = document.querySelector('.dash-sidebar');
          const nav = document.querySelector('.sidebar-nav');
          const userCard = document.querySelector('.sidebar-user-card');
          const panel = document.querySelector('[data-view="verifications"]');
          const card = panel ? panel.querySelector('.dash-card') : null;
          const table = panel ? panel.querySelector('table') : null;

          function m(el) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            return {
              x: r.x, y: r.y, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
              width: r.width, height: r.height,
              borderBottom: cs.borderBottom,
              position: cs.position
            };
          }

          return {
            brand: m(brand),
            header: m(header),
            sidebar: m(sidebar),
            nav: m(nav),
            userCard: m(userCard),
            panel: m(panel),
            card: m(card),
            table: m(table)
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Real measurements:', JSON.stringify(evalRes.result.value, null, 2));
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
