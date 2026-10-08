const { spawn } = require('child_process');
const http = require('http');

async function inspect() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9337',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9337/json', res => {
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
            await send('CSS.enable');
            await send('DOM.enable');

            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
            await new Promise(r => setTimeout(r, 2000));

            const res = await send('Runtime.evaluate', {
                expression: `(() => {
                    const rules = [];
                    for (const sheet of document.styleSheets) {
                        try {
                            for (const rule of sheet.cssRules || []) {
                                if (rule.selectorText && (
                                    rule.selectorText.includes('.dash-header') ||
                                    rule.selectorText.includes('.dash-panel') ||
                                    rule.selectorText.includes('.dash-card') ||
                                    rule.selectorText.includes('.dashboard-menu-toggle')
                                )) {
                                    rules.push({
                                        sheet: sheet.href ? sheet.href.split('/').pop() : 'inline',
                                        selector: rule.selectorText,
                                        cssText: rule.cssText
                                    });
                                }
                            }
                        } catch(e) {}
                    }
                    return JSON.stringify(rules.filter(r => 
                        r.cssText.includes('margin') || r.cssText.includes('padding') || r.cssText.includes('height')
                    ), null, 2);
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
