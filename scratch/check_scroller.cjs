const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function checkScroller() {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,1100',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
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

        const res = await send('Runtime.evaluate', {
            expression: `(function() {
                document.body.scrollTop = 760;
                document.documentElement.scrollTop = 760;
                const card = document.getElementById('overviewRecentActivity')?.closest('.dash-card');
                return {
                    bodyScroll: document.body.scrollTop,
                    cardTop: card?.getBoundingClientRect().top
                };
            })()`,
            returnByValue: true
        });

        console.log('Scroller:', res.result?.value);
        await new Promise(r => setTimeout(r, 800));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/admin_activity_perfect_card.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved');
        ws.close();
    } finally {
        chrome.kill();
    }
}

checkScroller();
