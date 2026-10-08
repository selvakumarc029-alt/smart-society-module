const { spawn } = require('child_process');
const http = require('http');

async function inspect() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9334',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9334/json', res => {
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
                    const panel = document.querySelector('[data-view="enquiries"]');
                    const header = document.querySelector('.dash-header');
                    const headerFirstDiv = header ? header.querySelector('div:first-child') : null;
                    const headerActions = header ? header.querySelector('.header-actions') : null;
                    const panelHeaderDiv = panel ? panel.querySelector('div:first-child') : null;
                    const subtabView = document.getElementById('subtabEnquiriesView');

                    const getMetrics = (el, name) => {
                        if (!el) return { name, exists: false };
                        const r = el.getBoundingClientRect();
                        const cs = window.getComputedStyle(el);
                        return {
                            name,
                            top: r.top,
                            bottom: r.bottom,
                            left: r.left,
                            right: r.right,
                            width: r.width,
                            height: r.height,
                            marginTop: cs.marginTop,
                            marginBottom: cs.marginBottom,
                            paddingTop: cs.paddingTop,
                            paddingBottom: cs.paddingBottom,
                            display: cs.display,
                            position: cs.position
                        };
                    };

                    return JSON.stringify({
                        header: getMetrics(header, 'header'),
                        headerFirstDiv: getMetrics(headerFirstDiv, 'headerFirstDiv'),
                        headerActions: getMetrics(headerActions, 'headerActions'),
                        panel: getMetrics(panel, 'panel'),
                        panelHeaderDiv: getMetrics(panelHeaderDiv, 'panelHeaderDiv'),
                        subtabView: getMetrics(subtabView, 'subtabView')
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
