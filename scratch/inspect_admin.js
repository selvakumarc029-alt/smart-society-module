const fs = require('fs');

async function run() {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    let tab = tabs.find(t => t.type === 'page');
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
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#verifications' });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to verifications tab if needed
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof switchTab === 'function') switchTab('verifications');
          else if (typeof showTab === 'function') showTab('verifications');
        })()
      `
    });

    await new Promise(r => setTimeout(r, 500));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const sidebar = document.querySelector('.dash-sidebar, .sidebar');
          const brand = document.querySelector('.dash-brand, .sidebar-header, .brand');
          const nav = document.querySelector('.sidebar-nav, nav');
          const lastNavBtn = nav ? nav.lastElementChild : null;
          const userCard = document.querySelector('.sidebar-user-card, .user-card, .logout-row, .sidebar-footer');
          const logoutBtn = document.querySelector('.sidebar-logout-btn, button[onclick*="logout"], a[href*="logout"]');
          
          const header = document.querySelector('.dash-header');
          const headerTitle = header ? header.querySelector('h1, #panelTitle') : null;
          const headerActions = header ? header.querySelector('.header-actions') : null;
          
          const main = document.querySelector('.dash-main, main');
          const activePanel = document.querySelector('.dash-panel:not(.hidden):not([hidden])');
          const card = activePanel ? activePanel.querySelector('.dash-card, .card, article') : null;
          const cardHead = card ? card.querySelector('.card-head, .section-header') : null;
          const cardTitle = card ? card.querySelector('h2, h3, h4') : null;
          const cardBtn = card ? card.querySelector('button') : null;
          const table = card ? card.querySelector('table') : null;
          const thFirst = table ? table.querySelector('th:first-child') : null;
          const thLast = table ? table.querySelector('th:last-child') : null;

          function getM(el) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            return {
              tag: el.tagName,
              className: el.className,
              x: Math.round(r.x),
              y: Math.round(r.y),
              left: Math.round(r.left),
              right: Math.round(r.right),
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              width: Math.round(r.width),
              height: Math.round(r.height),
              padding: cs.padding,
              margin: cs.margin,
              border: cs.borderBottom,
              overflow: cs.overflowY
            };
          }

          return {
            sidebar: getM(sidebar),
            brand: getM(brand),
            nav: getM(nav),
            lastNavBtn: getM(lastNavBtn),
            userCard: getM(userCard),
            logoutBtn: getM(logoutBtn),
            header: getM(header),
            headerTitle: getM(headerTitle),
            headerActions: getM(headerActions),
            main: getM(main),
            activePanel: getM(activePanel),
            card: getM(card),
            cardHead: getM(cardHead),
            cardTitle: getM(cardTitle),
            cardBtn: getM(cardBtn),
            table: getM(table),
            thFirst: getM(thFirst),
            thLast: getM(thLast)
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Admin Layout Metrics:', JSON.stringify(evalRes.result.value, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.result && shot.result.data) {
      fs.writeFileSync('scratch/admin_verifications_current.png', Buffer.from(shot.result.data, 'base64'));
      console.log('Saved screenshot to scratch/admin_verifications_current.png');
    }

    ws.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
