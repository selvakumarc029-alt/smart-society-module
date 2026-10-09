const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9486',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#add-property'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((res, rej) => http.get('http://localhost:9486/json', r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej));

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

        await new Promise((resolve) => ws.addEventListener('open', resolve));
        await send('Page.enable');
        await send('Runtime.enable');
        await new Promise(r => setTimeout(r, 1500));

        const debugRes = await send('Runtime.evaluate', {
            expression: `(() => {
                const fn = window.goToAddPropertyStep ? window.goToAddPropertyStep.toString() : 'NONE';
                const el1 = document.getElementById("wizardStepPane1");
                const el2 = document.getElementById("wizardStepPane2");
                let err = null;
                try {
                    window.goToAddPropertyStep(2);
                } catch(e) {
                    err = e.message;
                }
                return {
                    fnCode: fn,
                    el1Found: !!el1,
                    el2Found: !!el2,
                    el1DisplayAfter: el1 ? el1.style.display : null,
                    el2DisplayAfter: el2 ? el2.style.display : null,
                    error: err
                };
            })()`,
            returnByValue: true
        });

        console.log('DEBUG RESULT:', JSON.stringify(debugRes.result.value, null, 2));

        ws.close();
    } finally {
        chrome.kill();
    }
}
test();
