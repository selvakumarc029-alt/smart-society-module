const fs = require('fs');

async function run() {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    console.log('Open tabs:', tabs.length);
    let tab = tabs.find(t => t.type === 'page');
    if (!tab) {
      console.log('No page tab found, creating one...');
      const newRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:8080/propertydirect/dashboards/owner');
      tab = await newRes.json();
    }

    console.log('Using tab:', tab.webSocketDebuggerUrl);
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
    console.log('Connected to CDP');

    await send('Page.enable');
    await send('Runtime.enable');

    // Navigate to owner dashboard
    await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/owner' });
    await new Promise(r => setTimeout(r, 2000));

    // Switch tab to leads and evaluate metrics
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof switchTab === 'function') {
            switchTab('leads');
          }
          const sidebar = document.querySelector('.owner-sidebar');
          const main = document.querySelector('.owner-main');
          const header = document.querySelector('.owner-header');
          const headerTitle = header ? header.querySelector('#panelTitle') : null;
          const addBtn = header ? header.querySelector('button.btn-primary') : null;
          
          const panel = document.querySelector('[data-view="leads"]');
          const card = panel ? panel.querySelector('.dash-card') : null;
          const cardHead = card ? card.querySelector('.card-head') : null;
          const cardTitle = cardHead ? cardHead.querySelector('h3') : null;
          const recordBtn = cardHead ? cardHead.querySelector('button.btn-primary') : null;
          
          const thFirst = card ? card.querySelector('th:first-child') : null;
          const thLast = card ? card.querySelector('th:last-child') : null;

          function getMetrics(el) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            return {
              x: Math.round(r.x),
              y: Math.round(r.y),
              left: Math.round(r.left),
              right: Math.round(r.right),
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              width: Math.round(r.width),
              height: Math.round(r.height),
              paddingLeft: cs.paddingLeft,
              paddingRight: cs.paddingRight,
              paddingTop: cs.paddingTop,
              paddingBottom: cs.paddingBottom,
              alignItems: cs.alignItems,
              alignSelf: cs.alignSelf
            };
          }

          return {
            sidebar: getMetrics(sidebar),
            main: getMetrics(main),
            header: getMetrics(header),
            headerTitle: getMetrics(headerTitle),
            addBtn: getMetrics(addBtn),
            panel: getMetrics(panel),
            card: getMetrics(card),
            cardHead: getMetrics(cardHead),
            cardTitle: getMetrics(cardTitle),
            recordBtn: getMetrics(recordBtn),
            thFirst: getMetrics(thFirst),
            thLast: getMetrics(thLast)
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Metrics result:', JSON.stringify(evalRes.result.value, null, 2));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.result && shot.result.data) {
      fs.writeFileSync('scratch/owner_leads_aligned.png', Buffer.from(shot.result.data, 'base64'));
      console.log('Saved screenshot to scratch/owner_leads_aligned.png');
    }

    ws.close();
  } catch (err) {
    console.error('Error in measurement script:', err);
  }
}

run();
