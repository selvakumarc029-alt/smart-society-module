async function test() {
  const listRes = await fetch('http://127.0.0.1:9222/json');
  const tabs = await listRes.json();
  let tab = tabs.find(t => t.type === 'page' && t.url.includes('admin'));
  if (!tab) tab = tabs.find(t => t.type === 'page');
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const b = document.querySelector('.dash-brand');
        const h = document.querySelector('.dash-header');
        const s = document.querySelector('.dash-sidebar');
        const nav = document.querySelector('.sidebar-nav');
        const u = document.querySelector('.sidebar-user-card');
        const p = document.querySelector('[data-view="verifications"]');
        const card = p ? p.querySelector('.dash-card') : null;
        const main = document.querySelector('.dash-main');

        return {
          brand: b ? { y: b.getBoundingClientRect().y, bottom: b.getBoundingClientRect().bottom, height: b.getBoundingClientRect().height } : null,
          header: h ? { y: h.getBoundingClientRect().y, bottom: h.getBoundingClientRect().bottom, height: h.getBoundingClientRect().height } : null,
          sidebar: s ? { x: s.getBoundingClientRect().x, width: s.getBoundingClientRect().width, height: s.getBoundingClientRect().height } : null,
          main: main ? { x: main.getBoundingClientRect().x, width: main.getBoundingClientRect().width, padding: window.getComputedStyle(main).padding } : null,
          nav: nav ? { height: nav.getBoundingClientRect().height, scrollHeight: nav.scrollHeight } : null,
          userCard: u ? { y: u.getBoundingClientRect().y, height: u.getBoundingClientRect().height, pos: window.getComputedStyle(u).position } : null,
          card: card ? { x: card.getBoundingClientRect().x, y: card.getBoundingClientRect().y, width: card.getBoundingClientRect().width, padding: window.getComputedStyle(card).padding } : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('MEASUREMENTS AT 1440x900:', JSON.stringify(res.result.result.value, null, 2));
  ws.close();
  process.exit(0);
}
test();
