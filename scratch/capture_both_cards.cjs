const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function captureOverviewCards() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9492',
        '--window-size=1366,1050',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9492/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                const handler = (evt) => {
                    const data = JSON.parse(evt.data);
                    if (data.id === id) {
                        ws.removeEventListener('message', handler);
                        resolve(data.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await new Promise((resolve) => ws.addEventListener('open', resolve));
        await send('Page.enable');
        await send('Runtime.enable');
        await new Promise(r => setTimeout(r, 1800));

        await send('Runtime.evaluate', {
            expression: `(() => {
                document.documentElement.scrollTop = 460;
                document.body.scrollTop = 460;
                window.scrollTo(0, 460);
            })()`
        });

        await new Promise(r => setTimeout(r, 600));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/overview_both_cards_view.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved scratch/overview_both_cards_view.png');

        ws.close();
    } finally {
        chrome.kill();
    }
}

captureOverviewCards();
