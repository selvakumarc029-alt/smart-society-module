const { spawn } = require('child_process');
const http = require('http');

async function debugCSS() {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,1100',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get(`http://localhost:${port}/json`, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((res) => {
                const id = msgId++;
                const h = (evt) => {
                    const data = JSON.parse(evt.data);
                    if (data.id === id) { ws.removeEventListener('message', h); res(data.result); }
                };
                ws.addEventListener('message', h);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await new Promise(r => ws.addEventListener('open', r));
        await send('Page.enable');
        await send('Runtime.enable');
        await new Promise(r => setTimeout(r, 2000));

        const res = await send('Runtime.evaluate', {
            expression: `(function() {
                const card = document.getElementById('overviewRecentActivity')?.closest('.dash-card');
                if (!card) return 'No card found';
                
                const rules = [];
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule.selectorText && card.matches(rule.selectorText)) {
                                rules.push({
                                    sheet: sheet.href,
                                    selector: rule.selectorText,
                                    cssText: rule.cssText
                                });
                            }
                        }
                    } catch(e) {}
                }
                return {
                    rules,
                    computed: {
                        border: window.getComputedStyle(card).border,
                        background: window.getComputedStyle(card).background,
                        boxShadow: window.getComputedStyle(card).boxShadow,
                        padding: window.getComputedStyle(card).padding,
                        borderRadius: window.getComputedStyle(card).borderRadius
                    }
                };
            })()`,
            returnByValue: true
        });

        console.log('Card Rules:', JSON.stringify(res.result?.value, null, 2));
        ws.close();
    } finally {
        chrome.kill();
    }
}

debugCSS();
