const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function capture(url, outPath) {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1400,900',
        '--disable-gpu',
        '--no-sandbox',
        url
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get(`http://localhost:${port}/json`, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((res) => {
                const id = msgId++;
                const h = (evt) => {
                    const data = JSON.parse(evt.data);
                    if (data.id === id) { ws.removeEventListener('message', h); res(data.result); }
                };
                ws.addEventListener('message', h);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await new Promise(r => ws.addEventListener('open', r));
        await send('Page.enable');
        await send('Runtime.enable');
        await new Promise(r => setTimeout(r, 2000));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log('Saved ' + outPath);
        ws.close();
    } finally {
        chrome.kill();
    }
}

async function run() {
    await capture('http://localhost:8080/propertydirect/dashboards/owner#overview', 'scratch/owner_dashboard_no_leads.png');
    await capture('http://localhost:8080/propertydirect/dashboards/admin#enquiries', 'scratch/admin_dashboard_client_leads.png');
}

run();
