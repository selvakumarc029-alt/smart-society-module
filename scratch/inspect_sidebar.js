const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9333',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9333/json', res => {
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
            await send('Emulation.setDeviceMetricsOverride', {
                width: 786,
                height: 498,
                deviceScaleFactor: 1,
                mobile: false
            });

            await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#enquiries' });
            await new Promise(r => setTimeout(r, 2000));

            const sidebarInspect = await send('Runtime.evaluate', {
                expression: `(() => {
                    const sidebar = document.querySelector('.dash-sidebar');
                    const nav = document.querySelector('.sidebar-nav');
                    const buttons = Array.from(nav ? nav.querySelectorAll('button') : []);
                    const userCard = document.querySelector('.sidebar-user-card');

                    return {
                        sidebarHeight: sidebar ? sidebar.offsetHeight : null,
                        sidebarOverflow: sidebar ? window.getComputedStyle(sidebar).overflow : null,
                        navHeight: nav ? nav.offsetHeight : null,
                        navScrollHeight: nav ? nav.scrollHeight : null,
                        navOverflowY: nav ? window.getComputedStyle(nav).overflowY : null,
                        totalButtons: buttons.length,
                        visibleButtons: buttons.map(b => ({
                            panel: b.dataset.panel,
                            text: b.innerText.trim().split('\\n')[0],
                            top: b.getBoundingClientRect().top,
                            bottom: b.getBoundingClientRect().bottom,
                            visibleInSidebar: b.getBoundingClientRect().bottom <= (userCard ? userCard.getBoundingClientRect().top : 500)
                        })),
                        userCardTop: userCard ? userCard.getBoundingClientRect().top : null
                    };
                })()`,
                returnByValue: true
            });

            console.log('Sidebar Geometry at 786x498:', JSON.stringify(sidebarInspect.result.value, null, 2));

            await new Promise(r => setTimeout(r, 500));
            chrome.kill();
            process.exit(0);
        });
    } catch (e) {
        console.error('Error:', e);
        chrome.kill();
        process.exit(1);
    }
}
test();
