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

            const inspect = await send('Runtime.evaluate', {
                expression: `(() => {
                    const view = document.getElementById('subtabEnquiriesView');
                    const scroll = view ? view.querySelector('.dashboard-table-scroll') : null;
                    const table = view ? view.querySelector('table') : null;
                    const thead = table ? table.querySelector('thead') : null;
                    const th = thead ? thead.querySelector('th') : null;
                    const tbody = table ? table.querySelector('tbody') : null;
                    const td = tbody ? tbody.querySelector('td') : null;

                    const styleOf = el => el ? {
                        height: el.offsetHeight,
                        minHeight: window.getComputedStyle(el).minHeight,
                        maxHeight: window.getComputedStyle(el).maxHeight,
                        padding: window.getComputedStyle(el).padding,
                        margin: window.getComputedStyle(el).margin,
                        lineHeight: window.getComputedStyle(el).lineHeight,
                        verticalAlign: window.getComputedStyle(el).verticalAlign
                    } : null;

                    return {
                        view: styleOf(view),
                        scroll: styleOf(scroll),
                        table: styleOf(table),
                        thead: styleOf(thead),
                        th: styleOf(th),
                        tbody: styleOf(tbody),
                        td: styleOf(td)
                    };
                })()`,
                returnByValue: true
            });

            console.log('Table Styles:', JSON.stringify(inspect.result.value, null, 2));

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
