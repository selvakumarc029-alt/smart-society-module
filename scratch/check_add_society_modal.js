const { spawn } = require('child_process');
const http = require('http');

async function run() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9446',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9446/json', res => {
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

            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 2500));

            // Click Add Society button
            console.log("Clicking #btnOpenAddSocietyModal...");
            await send('Runtime.evaluate', {
                expression: `
                    document.getElementById('btnOpenAddSocietyModal').click();
                `
            });

            await new Promise(r => setTimeout(r, 600));

            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            require('fs').writeFileSync('scratch/societies_add_modal_test.png', Buffer.from(screenshot.data, 'base64'));
            console.log("Screenshot scratch/societies_add_modal_test.png saved.");

            ws.close();
            chrome.kill();
            process.exit(0);
        });
    } catch(e) {
        console.error(e);
        chrome.kill();
        process.exit(1);
    }
}
run();
