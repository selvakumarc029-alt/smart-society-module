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
        return {
          tag: s.outerHTML.substring(0, 300),
          classes: Array.from(document.body.classList),
          windowInnerWidth: window.innerWidth,
          windowOuterWidth: window.outerWidth
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Sidebar info:', JSON.stringify(res.result.result.value, null, 2));
  ws.close();
  process.exit(0);
}
test();
