const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9666',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9666/json', res => {
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

        const consoleLogs = [];
        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.consoleAPICalled') {
                consoleLogs.push(msg.params.args.map(a => a.value || a.description).join(' '));
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                consoleLogs.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails));
            }
        });

        ws.addEventListener('open', async () => {
            await send('Runtime.enable');
            await send('Page.enable');
            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#subscriptions' });
            await new Promise(r => setTimeout(r, 3000));

            const evalResult = await send('Runtime.evaluate', {
                expression: `
                    JSON.stringify({
                        cardsCount: document.getElementById('subscriptionPlanCards')?.children.length,
                        firstCardHTML: document.getElementById('subscriptionPlanCards')?.firstElementChild?.outerHTML.substring(0, 300),
                        hasRenderFunc: typeof window.renderSubscriptionCatalogue,
                        platformPlansCount: window.platformPlans?.length,
                        platformPlans: window.platformPlans?.map(p => ({ id: p.id, name: p.name, price: p.monthlyPrice }))
                    })
                `
            });

            console.log('Eval Result:', evalResult.result.value);
            console.log('Console logs:', consoleLogs);

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
