const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function capture() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9333',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9333/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let id = 1;
        function send(method, params = {}) {
            return new Promise((resolve) => {
                const reqId = id++;
                const handler = (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        ws.addEventListener('open', async () => {
            await send('Runtime.enable');
            await send('Page.enable');
            await send('Emulation.setDeviceMetricsOverride', {
                width: 1024,
                height: 600,
                deviceScaleFactor: 1,
                mobile: false
            });

            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
            await new Promise(r => setTimeout(r, 2000));

            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/admin_enquiries_fixed.png', Buffer.from(screenshot.data, 'base64'));
            console.log('Saved screenshot to scratch/admin_enquiries_fixed.png');

            await new Promise(r => setTimeout(r, 500));
            chrome.kill();
            process.exit(0);
        });
    } catch (e) {
        console.error('Error:', e);
        chrome.kill();
        process.exit(1);
    }
}
capture();
