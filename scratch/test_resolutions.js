const { spawn } = require('child_process');
const http = require('http');

async function checkWidth(w, h) {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=9489`,
        `--window-size=${w},${h}`,
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9489/json', res => {
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

    return new Promise((resolve) => {
        ws.addEventListener('open', async () => {
            const evalRes = await send('Runtime.evaluate', {
                expression: `(() => {
                    const grid = document.querySelector('[data-view="overview"] .dash-grid');
                    const cols = window.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
                    const card = grid.querySelector('article');
                    return {
                        windowWidth: window.innerWidth,
                        gridWidth: grid.getBoundingClientRect().width,
                        columns: cols,
                        cardWidth: card.getBoundingClientRect().width,
                        cardHeight: card.getBoundingClientRect().height
                    };
                })()`,
                returnByValue: true
            });
            console.log(`Resolution ${w}x${h}:`, evalRes.result.value);
            chrome.kill();
            resolve();
        });
    });
}

async function run() {
    await checkWidth(1366, 768);
    await checkWidth(1440, 900);
    await checkWidth(1920, 1080);
    process.exit(0);
}
run();
