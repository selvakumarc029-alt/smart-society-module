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

            console.log('Navigating to http://localhost:8080/propertydirect/dashboards/admin ...');
            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin' });
            await new Promise(r => setTimeout(r, 2000));

            const panelsToTest = [
                'users',
                'verifications',
                'projects',
                'my-properties',
                'enquiries',
                'reports',
                'metadata',
                'content',
                'audit',
                'overview'
            ];

            const results = {};

            for (const panel of panelsToTest) {
                const res = await send('Runtime.evaluate', {
                    expression: `(() => {
                        const btn = document.querySelector('.sidebar-nav [data-panel="${panel}"]');
                        if (!btn) return { error: 'Button not found for ' + '${panel}' };
                        btn.click();
                        
                        const view = document.querySelector('[data-view="${panel}"]');
                        return {
                            btnActive: btn.classList.contains('active'),
                            viewFound: !!view,
                            viewHidden: view ? view.classList.contains('hidden') : null,
                            viewDisplay: view ? view.style.display : null,
                            hash: window.location.hash
                        };
                    })()`,
                    returnByValue: true
                });
                results[panel] = res.result.value;
            }

            console.log('Tab switching results:', JSON.stringify(results, null, 2));

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
