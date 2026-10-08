const { spawn } = require('child_process');
const http = require('http');

async function inspect() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9335',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9335/json', res => {
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

            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
            await new Promise(r => setTimeout(r, 2000));

            const res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const header = document.querySelector('.dash-header');
                    const panel = document.querySelector('[data-view="enquiries"]');
                    const title = document.getElementById('panelTitle');
                    const eyebrow = document.querySelector('.dash-header .propertydirect-section-eyebrow, .dash-header .eyebrow');
                    const titleRect = title ? title.getBoundingClientRect() : null;
                    const eyebrowRect = eyebrow ? eyebrow.getBoundingClientRect() : null;
                    const titleCs = title ? window.getComputedStyle(title) : null;
                    const eyebrowCs = eyebrow ? window.getComputedStyle(eyebrow) : null;

                    return JSON.stringify({
                        headerHtml: header ? header.outerHTML : null,
                        titlePos: titleRect ? {
                            left: titleRect.left,
                            top: titleRect.top,
                            width: titleRect.width,
                            height: titleRect.height,
                            position: titleCs.position,
                            margin: titleCs.margin
                        } : null,
                        eyebrowPos: eyebrowRect ? {
                            left: eyebrowRect.left,
                            top: eyebrowRect.top,
                            width: eyebrowRect.width,
                            height: eyebrowRect.height,
                            position: eyebrowCs.position,
                            margin: eyebrowCs.margin
                        } : null,
                        panelHtml: panel ? panel.querySelector('div:first-child').outerHTML : null
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
