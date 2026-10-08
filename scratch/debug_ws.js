const { spawn } = require('child_process');
const http = require('http');

async function run() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9457',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9457/json', res => {
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
                console.log(`[SEND id=${reqId}] ${method}`);
                const handler = (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === reqId) {
                        console.log(`[RECV id=${reqId}]`, msg.error ? msg.error : 'success');
                        ws.removeEventListener('message', handler);
                        resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            if (!msg.id) {
                console.log('[EVENT]', msg.method, msg.params);
            }
        });

        ws.addEventListener('open', async () => {
            await send('Runtime.enable');
            await send('Page.enable');

            console.log("Navigating...");
            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 3000));

            console.log("Evaluating...");
            const res = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        return card ? card.innerHTML.substring(0, 100) : "No card";
                    })()
                `,
                returnByValue: true
            });
            console.log("Result:", res);

            ws.close();
            chrome.kill();
            process.exit(0);
        });

    } catch (e) {
        console.error(e);
        chrome.kill();
        process.exit(1);
    }
}
run();
