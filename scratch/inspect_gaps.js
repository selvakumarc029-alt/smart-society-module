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

            const inspectResult = await send('Runtime.evaluate', {
                expression: `(() => {
                    const panel = document.querySelector('[data-view="enquiries"]');
                    const header = document.querySelector('.dash-header');
                    const titleRow = panel ? panel.children[0] : null;
                    const subtabView = document.getElementById('subtabEnquiriesView');
                    const tableScroll = subtabView ? subtabView.querySelector('.dashboard-table-scroll') : null;
                    const table = subtabView ? subtabView.querySelector('table') : null;
                    const tbody = document.getElementById('enquiriesTableBody');

                    const getBox = el => el ? {
                        rect: el.getBoundingClientRect(),
                        marginTop: window.getComputedStyle(el).marginTop,
                        marginBottom: window.getComputedStyle(el).marginBottom,
                        paddingTop: window.getComputedStyle(el).paddingTop,
                        paddingBottom: window.getComputedStyle(el).paddingBottom,
                        minHeight: window.getComputedStyle(el).minHeight,
                        height: window.getComputedStyle(el).height
                    } : null;

                    return {
                        panel: getBox(panel),
                        header: getBox(header),
                        titleRow: getBox(titleRow),
                        subtabView: getBox(subtabView),
                        tableScroll: getBox(tableScroll),
                        tbody: getBox(tbody)
                    };
                })()`,
                returnByValue: true
            });

            console.log('Computed Geometry:', JSON.stringify(inspectResult.result.value, null, 2));

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
