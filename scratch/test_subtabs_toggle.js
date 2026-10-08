const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testSubtabs() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new', '--remote-debugging-port=9347', '--disable-gpu', '--no-sandbox', 'about:blank'
    ]);
    await new Promise(r => setTimeout(r, 1500));
    const tabs = await new Promise(res => http.get('http://localhost:9347/json', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }));
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
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1024,
            height: 600,
            deviceScaleFactor: 1,
            mobile: false
        });

        await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
        await new Promise(r => setTimeout(r, 2000));

        // State 1: Default Enquiries subtab
        const state1 = await send('Runtime.evaluate', {
            expression: `(() => {
                const enq = document.getElementById("subtabEnquiriesView");
                const vis = document.getElementById("subtabVisitsView");
                return {
                    enqDisplay: enq ? window.getComputedStyle(enq).display : null,
                    visDisplay: vis ? window.getComputedStyle(vis).display : null
                };
            })()`,
            returnByValue: true
        });
        console.log('State 1 (Default - Enquiries active):', state1.result.value);

        const ss1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/subtab_enquiries_only.png', Buffer.from(ss1.data, 'base64'));

        // Click Scheduled Visits
        await send('Runtime.evaluate', {
            expression: `document.getElementById('subtabVisitsBtn').click();`
        });
        await new Promise(r => setTimeout(r, 500));

        const state2 = await send('Runtime.evaluate', {
            expression: `(() => {
                const enq = document.getElementById("subtabEnquiriesView");
                const vis = document.getElementById("subtabVisitsView");
                return {
                    enqDisplay: enq ? window.getComputedStyle(enq).display : null,
                    visDisplay: vis ? window.getComputedStyle(vis).display : null
                };
            })()`,
            returnByValue: true
        });
        console.log('State 2 (After clicking Visits):', state2.result.value);

        const ss2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/subtab_visits_only.png', Buffer.from(ss2.data, 'base64'));

        chrome.kill();
        process.exit(0);
    });
}
testSubtabs();
