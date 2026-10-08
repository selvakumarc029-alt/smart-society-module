const fs = require('fs');

async function run() {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    let tab = tabs.find(t => t.type === 'page' && t.url.includes('owner'));
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
    await send('Page.enable');

    // Switch to overview
    await send('Runtime.evaluate', { expression: `switchTab('overview')` });
    await new Promise(r => setTimeout(r, 600));
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/owner_overview_1440.png', Buffer.from(shot.result.data, 'base64'));
    console.log('Saved overview screenshot');

    // Switch to post-listing
    await send('Runtime.evaluate', { expression: `switchTab('post-listing')` });
    await new Promise(r => setTimeout(r, 600));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/owner_post_listing_1440.png', Buffer.from(shot.result.data, 'base64'));
    console.log('Saved post-listing screenshot');

    ws.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
