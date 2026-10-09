const { spawn } = require('child_process');
const http = require('http');

async function testClick() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9499',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9499/json', res => {
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

        // Click on the Customers card (index 3)
        const clickResult = await send('Runtime.evaluate', {
            expression: `(() => {
                const customerCard = document.querySelector('[data-view="overview"] .overview-summary-grid article:nth-child(4)');
                if (!customerCard) return { error: 'Card not found' };
                customerCard.click();
                return {
                    activePanel: document.querySelector('.dash-panel:not(.hidden)')?.getAttribute('data-view'),
                    hash: window.location.hash
                };
            })()`,
            returnByValue: true
        });

        console.log('CLICK RESULT:', clickResult.result.value);
        chrome.kill();
        process.exit(0);
    });
}

testClick();
