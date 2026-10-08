const { spawn } = require('child_process');
const http = require('http');

async function test() {
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

            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
            await new Promise(r => setTimeout(r, 2000));

            const scrollHeightDiag = await send('Runtime.evaluate', {
                expression: `(() => {
                    const docHeight = document.documentElement.scrollHeight;
                    const bodyHeight = document.body.scrollHeight;
                    const main = document.querySelector('.dash-main');
                    const mainHeight = main ? main.scrollHeight : null;

                    // Find all elements contributing to huge height
                    const tallElements = [];
                    document.querySelectorAll('*').forEach(el => {
                        const h = el.offsetHeight || el.scrollHeight;
                        const tag = el.tagName.toLowerCase();
                        const cls = el.className || '';
                        const id = el.id || '';
                        const view = el.dataset.view || '';
                        const display = window.getComputedStyle(el).display;
                        if (h > 600 && display !== 'none') {
                            tallElements.push({
                                tag, id, cls, view, display,
                                offsetHeight: el.offsetHeight,
                                scrollHeight: el.scrollHeight,
                                minHeight: window.getComputedStyle(el).minHeight
                            });
                        }
                    });

                    // Check which data-view sections are currently display != none
                    const visibleViews = [];
                    document.querySelectorAll('[data-view]').forEach(el => {
                        const disp = window.getComputedStyle(el).display;
                        if (disp !== 'none') {
                            visibleViews.push({
                                view: el.dataset.view,
                                display: disp,
                                height: el.offsetHeight,
                                hiddenClass: el.classList.contains('hidden')
                            });
                        }
                    });

                    return {
                        docHeight,
                        bodyHeight,
                        mainHeight,
                        visibleViews,
                        tallElements: tallElements.slice(0, 15)
                    };
                })()`,
                returnByValue: true
            });

            console.log('Scroll Height Diagnostics:', JSON.stringify(scrollHeightDiag.result.value, null, 2));

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
test();
