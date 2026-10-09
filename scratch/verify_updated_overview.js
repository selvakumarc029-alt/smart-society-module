const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testUpdated() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9495',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9495/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = msgId++;
            const handler = (evt) => {
                const data = JSON.parse(evt.data);
                if (data.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    ws.addEventListener('open', async () => {
        await send('Page.enable');
        await send('Runtime.enable');

        // Let the overview load data
        await new Promise(r => setTimeout(r, 1000));

        const evalRes = await send('Runtime.evaluate', {
            expression: `(() => {
                const grid = document.querySelector('[data-view="overview"] .dash-grid.overview-summary-grid');
                if (!grid) return { error: 'Grid not found' };
                const gridRect = grid.getBoundingClientRect();
                const articles = Array.from(grid.querySelectorAll('article'));
                const cardDetails = articles.map((a, i) => {
                    const rect = a.getBoundingClientRect();
                    const titleEl = a.querySelector('.stat-card-title');
                    const iconEl = a.querySelector('.stat-card-icon');
                    const strong = a.querySelector('strong');
                    const small = a.querySelector('small');
                    return {
                        index: i,
                        title: titleEl ? titleEl.innerText.trim() : '',
                        icon: iconEl ? iconEl.innerText.trim() : '',
                        number: strong ? strong.innerText.trim() : '',
                        subtitle: small ? small.innerText.trim() : '',
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top,
                        titleClientHeight: titleEl ? titleEl.clientHeight : 0,
                        titleScrollHeight: titleEl ? titleEl.scrollHeight : 0
                    };
                });
                return {
                    gridRect: { width: gridRect.width, height: gridRect.height, left: gridRect.left },
                    cardDetails
                };
            })()`,
            returnByValue: true
        });

        console.log('UPDATED EVAL RESULT:', JSON.stringify(evalRes.result.value, null, 2));

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/overview_after.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Screenshot saved to scratch/overview_after.png');

        chrome.kill();
        process.exit(0);
    });
}

testUpdated().catch(err => {
    console.error(err);
    process.exit(1);
});
