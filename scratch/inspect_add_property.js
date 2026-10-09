const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function inspect() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9481',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#add-property'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9481/json', res => {
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

        await new Promise(r => setTimeout(r, 1000));

        const res = await send('Runtime.evaluate', {
            expression: `(() => {
                const panel = document.querySelector('[data-view="add-property"]');
                const form = document.getElementById('postApartmentForm');
                const step2 = document.getElementById('addPropertyStep2');
                const btnStep1 = document.querySelector('.pd-form-step-btn');
                return {
                    panelRect: panel ? panel.getBoundingClientRect() : null,
                    formRect: form ? form.getBoundingClientRect() : null,
                    step2Rect: step2 ? step2.getBoundingClientRect() : null,
                    btnStep1Text: btnStep1 ? btnStep1.innerText : null
                };
            })()`,
            returnByValue: true
        });

        console.log('ADD PROPERTY INSPECTION:', res.result.value);

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/add_property_current.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Saved scratch/add_property_current.png');

        chrome.kill();
        process.exit(0);
    });
}

inspect().catch(err => {
    console.error(err);
    process.exit(1);
});
