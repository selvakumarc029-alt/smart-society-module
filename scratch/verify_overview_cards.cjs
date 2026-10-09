const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testOverviewCards() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9489',
        '--window-size=1366,1050',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9489/json', res => {
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
        await new Promise(r => setTimeout(r, 2000));

        // Scroll directly to the Actionable Notifications and Recent Activity section
        await send('Runtime.evaluate', {
            expression: `(() => {
                const notif = document.getElementById('overviewNotificationsList');
                if (notif) {
                    notif.scrollIntoView({ behavior: 'instant', block: 'start' });
                    window.scrollBy(0, -90);
                }
            })()`
        });

        await new Promise(r => setTimeout(r, 600));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/overview_activity_cards.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved scratch/overview_activity_cards.png');

        ws.close();
    } finally {
        chrome.kill();
    }
}

testOverviewCards();
