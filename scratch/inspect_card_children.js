const { spawn } = require('child_process');
const http = require('http');

async function inspect() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9341',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9341/json', res => {
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

            const res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const card = document.getElementById('subtabEnquiriesView');
                    if (!card) return 'card not found';
                    const children = Array.from(card.children).map(c => ({
                        tag: c.tagName,
                        className: c.className,
                        id: c.id,
                        rect: c.getBoundingClientRect(),
                        style: window.getComputedStyle(c).display
                    }));
                    const cs = window.getComputedStyle(card);
                    return JSON.stringify({
                        cardDisplay: cs.display,
                        cardFlexDirection: cs.flexDirection,
                        cardJustifyContent: cs.justifyContent,
                        cardAlignItems: cs.alignItems,
                        cardPadding: cs.padding,
                        children
                    }, null, 2);
                })()`
            });

            console.log(res.result.value);

            chrome.kill();
            process.exit(0);
        });
    } catch (e) {
        console.error('Error:', e);
        chrome.kill();
        process.exit(1);
    }
}
inspect();
