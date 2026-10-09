const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function capture(url, outPath) {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,1100',
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

        // Inspect styles
        const inspectRes = await send('Runtime.evaluate', {
            expression: `(function() {
                const card = document.getElementById('overviewRecentActivity')?.closest('.dash-card');
                const list = document.getElementById('overviewRecentActivity');
                const item = document.querySelector('.overview-activity-list-item');
                return {
                    cardStyles: card ? {
                        border: window.getComputedStyle(card).border,
                        background: window.getComputedStyle(card).background,
                        padding: window.getComputedStyle(card).padding,
                        boxShadow: window.getComputedStyle(card).boxShadow
                    } : null,
                    listStyles: list ? {
                        display: window.getComputedStyle(list).display,
                        flexDirection: window.getComputedStyle(list).flexDirection,
                        gap: window.getComputedStyle(list).gap,
                        border: window.getComputedStyle(list).border,
                        borderRadius: window.getComputedStyle(list).borderRadius
                    } : null,
                    itemStyles: item ? {
                        border: window.getComputedStyle(item).border,
                        borderRadius: window.getComputedStyle(item).borderRadius,
                        background: window.getComputedStyle(item).background,
                        padding: window.getComputedStyle(item).padding
                    } : null
                };
            })()`,
            returnByValue: true
        });
        console.log('Inspection:', JSON.stringify(inspectRes.result?.value, null, 2));

        // Scroll so the entire card is visible in viewport
        await send('Runtime.evaluate', {
            expression: `(function() {
                const el = document.getElementById('overviewRecentActivity')?.closest('.dash-card');
                if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
            })()`
        });

        await new Promise(r => setTimeout(r, 1000));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log('Saved screenshot to: ' + outPath);
        ws.close();
    } finally {
        chrome.kill();
    }
}

async function run() {
    await capture('http://localhost:8080/propertydirect/dashboards/admin#overview', 'scratch/admin_recent_activity_single_card.png');
}

run();
