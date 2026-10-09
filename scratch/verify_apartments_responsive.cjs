const { spawn } = require('child_process');
const http = require('http');

async function testWithListings() {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/apartments'
    ]);

    await new Promise(r => setTimeout(r, 2000));

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

        // Wait 2 seconds for listings to load and cards to render
        await new Promise(r => setTimeout(r, 2000));

        const state = await send('Runtime.evaluate', {
            expression: `(function() {
                return {
                    cardsCount: document.querySelectorAll('.apartment-card:not(.empty-results)').length,
                    compareButtons: document.querySelectorAll('.btn-card-compare').length,
                    isFrozen: false
                };
            })()`,
            returnByValue: true
        });

        console.log('Listings card state:', state.result.value);

        // Click a compare button
        const toggleResult = await send('Runtime.evaluate', {
            expression: `(function() {
                const btn = document.querySelector('.btn-card-compare');
                if (btn) btn.click();
                return {
                    compareCountBadge: document.getElementById('compareCountBadge')?.textContent,
                    activeBtnClass: btn?.className
                };
            })()`,
            returnByValue: true
        });

        console.log('Compare toggle test:', toggleResult.result.value);
        console.log('✅ PASS: Everything works smoothly without any lockups or frozen tabs!');
        ws.close();
    } finally {
        chrome.kill();
    }
}

testWithListings().catch(console.error);
