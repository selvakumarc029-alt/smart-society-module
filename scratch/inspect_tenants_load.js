const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9471',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9471/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    function send(expr) {
        return new Promise(resolve => {
            const reqId = id++;
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id === reqId) {
                    ws.removeEventListener('message', handler);
                    resolve(msg.result?.result?.value);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: reqId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
        });
    }

    ws.addEventListener('open', async () => {
        console.log("Hash:", await send("window.location.hash"));
        console.log("Active Panel:", await send("document.querySelector('section:not(.d-none)')?.dataset.view"));
        console.log("Has loadPlatformBackendData:", await send("typeof loadPlatformBackendData"));
        
        // Call loadPlatformBackendData
        console.log("Calling loadPlatformBackendData...");
        await send("loadPlatformBackendData()");
        await new Promise(r => setTimeout(r, 1000));

        console.log("Tenants length:", await send("window.platformTenants?.length"));
        console.log("Cards count:", await send("document.querySelectorAll('#societiesCardsGrid .society-directory-card').length"));
        console.log("First card title:", await send("document.querySelector('#societiesCardsGrid .society-directory-card h5')?.textContent?.trim()"));
        console.log("First card badge:", await send("document.querySelector('#societiesCardsGrid .society-directory-card .badge')?.textContent?.trim()"));
        console.log("First card buttons:", await send("Array.from(document.querySelectorAll('#societiesCardsGrid .society-directory-card button')).map(b => b.textContent.trim())"));

        chrome.kill();
        process.exit(0);
    });
}
test();
