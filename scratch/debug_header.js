const fs = require('fs');

async function run() {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    let tab = tabs.find(t => t.type === 'page' && t.url.includes('owner'));
    if (!tab) tab = tabs.find(t => t.type === 'page');
    console.log('Selected tab URL:', tab ? tab.url : 'none');
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
          const header = document.querySelector('.owner-header');
          if (!header) return { error: 'no owner-header found', url: location.href };
          const cs = window.getComputedStyle(header);
          const r = header.getBoundingClientRect();
          return {
            url: location.href,
            windowWidth: window.innerWidth,
            header: {
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
              display: cs.display,
              flexDirection: cs.flexDirection,
              flexWrap: cs.flexWrap,
              justifyContent: cs.justifyContent,
              alignItems: cs.alignItems
            },
            firstDiv: (() => {
              const d = header.children[0];
              const dr = d.getBoundingClientRect();
              const dcs = window.getComputedStyle(d);
              return { x: Math.round(dr.x), y: Math.round(dr.y), width: Math.round(dr.width), height: Math.round(dr.height), flex: dcs.flex };
            })(),
            secondDiv: (() => {
              const d = header.children[1];
              const dr = d.getBoundingClientRect();
              const dcs = window.getComputedStyle(d);
              return { x: Math.round(dr.x), y: Math.round(dr.y), width: Math.round(dr.width), height: Math.round(dr.height), flex: dcs.flex };
            })()
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Result:', JSON.stringify(evalRes, null, 2));
    ws.close();
  } catch (e) {
    console.error(e);
  }
}

run();
