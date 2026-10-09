const { spawn } = require('child_process');
const http = require('http');

async function checkGaps() {
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
                const container = document.getElementById('overviewRecentActivity');
                const items = Array.from(document.querySelectorAll('.overview-activity-list-item'));
                return {
                    containerTag: container?.tagName,
                    containerClass: container?.className,
                    containerParentClass: container?.parentElement?.className,
                    containerParentStyle: container?.parentElement?.getAttribute('style'),
                    itemCount: items.length,
                    rects: items.slice(0, 3).map(it => {
                        const r = it.getBoundingClientRect();
                        return { top: r.top, bottom: r.bottom, height: r.height };
                    }),
                    item0OuterHTML: items[0]?.outerHTML.substring(0, 150),
                    containerOuterHTML: container?.outerHTML.substring(0, 200)
                };
            })()`,
            returnByValue: true
        });

        console.log('Gap check:', JSON.stringify(res.result?.value, null, 2));
        ws.close();
    } finally {
        chrome.kill();
    }
}

checkGaps();
