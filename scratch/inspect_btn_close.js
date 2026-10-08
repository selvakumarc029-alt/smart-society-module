const { spawn } = require('child_process');
const http = require('http');

async function run() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9448',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9448/json', res => {
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
            await new Promise(r => setTimeout(r, 2000));

            const styles = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const btn = document.querySelector('#viewSocietyModal .btn-close');
                        if (!btn) return "Not found";
                        const cs = window.getComputedStyle(btn);
                        return {
                            width: cs.width,
                            height: cs.height,
                            padding: cs.padding,
                            background: cs.background,
                            backgroundImage: cs.backgroundImage,
                            backgroundColor: cs.backgroundColor,
                            borderRadius: cs.borderRadius,
                            border: cs.border,
                            boxSizing: cs.boxSizing
                        };
                    })()
                `,
                returnByValue: true
            });

            console.log("Computed styles of #viewSocietyModal .btn-close:", JSON.stringify(styles.result.value, null, 2));

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
