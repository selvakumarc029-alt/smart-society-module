const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/Thiru T/.gemini/antigravity-ide/brain/3749b293-06bd-4ac4-b73e-fd0fdf66647e';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function run() {
    const chromeProc = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9450',
        '--user-data-dir=' + path.join(__dirname, 'chrome-temp-profile-debug'),
        '--no-first-run',
        '--window-size=1400,900'
    ]);

    await sleep(2500);

    try {
        const res = await fetch('http://localhost:9450/json/list');
        const list = await res.json();
        const target = list.find(t => t.type === 'page');
        const ws = new WebSocket(target.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('[BROWSER CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description));
            }
            if (data.method === 'Runtime.exceptionThrown') {
                console.error('[BROWSER EXCEPTION]', data.params.exceptionDetails);
            }
            if (data.id && pending.has(data.id)) {
                pending.get(data.id)(data);
            }
        };

        await new Promise((resolve) => ws.onopen = resolve);

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const reqId = id++;
                pending.set(reqId, resolve);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');

        const loginRes = await fetch('http://localhost:8080/api/auth/dashboard-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: 'propertydirect',
                role: 'admin',
                username: 'admin@propertydirect',
                password: 'admin123'
            })
        });
        const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
        for (const c of cookies) {
            if (!c) continue;
            const match = c.match(/([^=]+)=([^;]+)/);
            if (match) {
                await send('Network.setCookie', {
                    name: match[1].trim(),
                    value: match[2].trim(),
                    domain: 'localhost',
                    path: '/'
                });
            }
        }

        await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#metadata' });
        await sleep(3000);

        const checkRes = await send('Runtime.evaluate', {
            expression: `
                (() => {
                    const btn = document.getElementById('btnAddCategoryMeta');
                    console.log('Button exists:', !!btn);
                    if (btn) btn.click();
                    const m = document.getElementById('metadataDetailModal');
                    console.log('Modal exists:', !!m);
                    if (!m) return 'No modal';
                    const cs = window.getComputedStyle(m);
                    return {
                        className: m.className,
                        display: cs.display,
                        visibility: cs.visibility,
                        zIndex: cs.zIndex,
                        opacity: cs.opacity,
                        rect: {
                            top: m.getBoundingClientRect().top,
                            left: m.getBoundingClientRect().left,
                            width: m.getBoundingClientRect().width,
                            height: m.getBoundingClientRect().height
                        }
                    };
                })()
            `,
            returnByValue: true
        });

        console.log("Evaluation result:", JSON.stringify(checkRes, null, 2));

        await sleep(1000);
        let shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_add_category_debug.png'), Buffer.from(shot.result.data, 'base64'));
        console.log("Saved modal_add_category_debug.png");

        ws.close();
    } catch (e) {
        console.error("Debug script error:", e);
    } finally {
        chromeProc.kill('SIGKILL');
    }
}

run();
