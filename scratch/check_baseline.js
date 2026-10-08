const { spawn } = require('child_process');
const http = require('http');

async function check() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new', '--remote-debugging-port=9346', '--disable-gpu', '--no-sandbox', 'about:blank'
    ]);
    await new Promise(r => setTimeout(r, 1500));
    const tabs = await new Promise(res => http.get('http://localhost:9346/json', r => {
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
        await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin' });
        await new Promise(r => setTimeout(r, 2000));

        const res = await send('Runtime.evaluate', {
            expression: `(() => {
                const b = document.querySelector(".dash-brand");
                const h = document.querySelector(".dash-header");
                const br = b ? b.getBoundingClientRect() : null;
                const hr = h ? h.getBoundingClientRect() : null;
                const bcs = b ? window.getComputedStyle(b) : null;
                const hcs = h ? window.getComputedStyle(h) : null;
                return JSON.stringify({
                    brand: { top: br.top, bottom: br.bottom, height: br.height, borderBottom: bcs.borderBottom },
                    header: { top: hr.top, bottom: hr.bottom, height: hr.height, borderBottom: hcs.borderBottom }
                }, null, 2);
            })()`
        });

        console.log(res.result.value);
        chrome.kill();
        process.exit(0);
    });
}
check();
