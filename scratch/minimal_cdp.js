const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9463',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9463/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '1+1', returnByValue: true } }));
    });

    ws.addEventListener('message', (event) => {
        console.log('WS MESSAGE:', event.data);
        chrome.kill();
        process.exit(0);
    });
}
test();
