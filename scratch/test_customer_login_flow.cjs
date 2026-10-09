const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testCustomerLogin() {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect'
    ]);

    await new Promise(r => setTimeout(r, 2500));

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

        // Step 1: Open Login modal and fill credentials
        await send('Runtime.evaluate', {
            expression: `(function() {
                window.openPropertyDirectLoginModal();
                const u = document.getElementById('pdLoginUsername');
                const p = document.getElementById('pdLoginPassword');
                if (u) u.value = 'customer@propertydirect';
                if (p) p.value = 'customer123';
                const f = document.getElementById('pdLoginForm');
                if (f) {
                    const submitBtn = f.querySelector('button[type="submit"]');
                    submitBtn.click();
                }
            })()`
        });

        // Step 2: Wait for navigation
        await new Promise(r => setTimeout(r, 3500));

        // Step 3: Get current URL and page details
        const urlRes = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                href: window.location.href,
                title: document.title,
                name: document.getElementById('custMeName')?.textContent || '',
                roleBadge: document.getElementById('custRoleBadge')?.textContent || document.querySelector('.dash-badge')?.textContent || ''
            })`,
            returnByValue: true
        });

        console.log('Page after login redirect:', urlRes.result.value);

        // Step 4: Capture screenshot
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('c:\\smart-society-module-main\\scratch\\customer_dashboard_after_login.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Saved screenshot to scratch/customer_dashboard_after_login.png');

        ws.close();
    } finally {
        chrome.kill();
    }
}

testCustomerLogin().catch(console.error);
