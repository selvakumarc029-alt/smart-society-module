const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testClick() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9455',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9455/json', res => {
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
                width: 1280,
                height: 720,
                deviceScaleFactor: 1,
                mobile: false
            });

            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/maintenance-worker' });
            await new Promise(r => setTimeout(r, 1500));

            // Click the command center link
            await send('Runtime.evaluate', {
                expression: `
                    const link = document.querySelector('a[data-panel="command"]');
                    if (link) link.click();
                `
            });
            await new Promise(r => setTimeout(r, 1000));

            const evalRes = await send('Runtime.evaluate', {
                expression: `({
                    url: window.location.href,
                    title: document.getElementById('title')?.textContent,
                    commandVisible: !document.getElementById('viewCommand')?.classList.contains('d-none'),
                    dutyVisible: !document.getElementById('viewDuty')?.classList.contains('d-none')
                })`,
                returnByValue: true
            });
            console.log('Eval Result:', evalRes.result.value);

            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/command_center_view.png', Buffer.from(screenshot.data, 'base64'));
            console.log('Saved scratch/command_center_view.png');

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
testClick();
