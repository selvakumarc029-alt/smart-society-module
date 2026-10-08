const { spawn } = require('child_process');
const http = require('http');

async function run() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9445',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9445/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

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
            await send('Runtime.enable');
            await send('Page.enable');
            await send('Log.enable');

            ws.addEventListener('message', (event) => {
                const msg = JSON.parse(event.data);
                if (msg.method === 'Runtime.consoleAPICalled') {
                    console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
                }
                if (msg.method === 'Log.entryAdded') {
                    console.log('LOG:', msg.params.entry.text);
                }
            });

            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 2500));

            const modalCheck = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const m = document.getElementById('viewSocietyModal');
                        return {
                            exists: !!m,
                            classes: m.className,
                            styleDisplay: m.style.display,
                            computedDisplay: window.getComputedStyle(m).display,
                            computedVisibility: window.getComputedStyle(m).visibility,
                            computedOpacity: window.getComputedStyle(m).opacity,
                            computedZIndex: window.getComputedStyle(m).zIndex
                        };
                    })()
                `,
                returnByValue: true
            });
            console.log("Before click:", modalCheck.result.value);

            // Now click View
            await send('Runtime.evaluate', {
                expression: `
                    document.querySelector('#societiesCardsGrid .society-directory-card button').click();
                `
            });

            await new Promise(r => setTimeout(r, 600));

            const afterClick = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const m = document.getElementById('viewSocietyModal');
                        const backdrop = document.querySelector('.modal-backdrop');
                        return {
                            classes: m.className,
                            styleDisplay: m.style.display,
                            computedDisplay: window.getComputedStyle(m).display,
                            computedVisibility: window.getComputedStyle(m).visibility,
                            computedOpacity: window.getComputedStyle(m).opacity,
                            computedZIndex: window.getComputedStyle(m).zIndex,
                            hasBackdrop: !!backdrop,
                            backdropClasses: backdrop?.className,
                            backdropZIndex: backdrop ? window.getComputedStyle(backdrop).zIndex : null
                        };
                    })()
                `,
                returnByValue: true
            });
            console.log("After click (600ms):", afterClick.result.value);

            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            require('fs').writeFileSync('scratch/societies_after_view_click.png', Buffer.from(screenshot.data, 'base64'));
            console.log("Screenshot scratch/societies_after_view_click.png saved.");

            ws.close();
            chrome.kill();
            process.exit(0);
        });
    } catch(e) {
        console.error(e);
        chrome.kill();
        process.exit(1);
    }
}
run();
