const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9466',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9466/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const reqId = id++;
            pending.set(reqId, { resolve, reject });
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(JSON.stringify(msg.error)));
            else resolve(msg.result);
        }
    });

    ws.addEventListener('open', async () => {
        console.log("WS Opened. Evaluating expression...");
        const res = await send('Runtime.evaluate', {
            expression: `
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    if (!card) return "No card found";
                    const title = card.querySelector('h5')?.textContent?.trim();
                    const badge = card.querySelector('.badge')?.textContent?.trim();
                    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                    return { title, badge, buttons };
                })()
            `,
            returnByValue: true
        });

        console.log("Card Info Evaluated:", res.result.value);

        // Click view
        console.log("Clicking View button...");
        await send('Runtime.evaluate', {
            expression: `document.querySelector('#societiesCardsGrid .society-directory-card button').click();`
        });
        await new Promise(r => setTimeout(r, 600));

        const modalRes = await send('Runtime.evaluate', {
            expression: `
                (() => {
                    const modal = document.getElementById('viewSocietyModal');
                    const closeBtn = modal.querySelector('.btn-close');
                    const cs = window.getComputedStyle(closeBtn);
                    const footerButtons = Array.from(modal.querySelectorAll('.modal-footer button:not(.d-none)')).map(b => b.textContent.trim());
                    return {
                        visible: modal.classList.contains('show'),
                        title: document.getElementById('viewSocietyModalTitle')?.textContent?.trim(),
                        statusBadge: document.getElementById('viewSocietyStatusBadge')?.textContent?.trim(),
                        footerButtons,
                        closeBtnSize: cs.width + ' x ' + cs.height,
                        hasSvgBg: cs.backgroundImage.includes('data:image/svg')
                    };
                })()
            `,
            returnByValue: true
        });
        console.log("Modal Info Evaluated:", modalRes.result.value);

        chrome.kill();
        process.exit(0);
    });
}
test();
