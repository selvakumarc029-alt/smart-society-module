const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testContentRemoval() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9482',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#content'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9482/json', res => {
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

    ws.addEventListener('open', async () => {
        await send('Page.enable');
        await send('Runtime.enable');

        await new Promise(r => setTimeout(r, 1500));

        const evalRes = await send('Runtime.evaluate', {
            expression: `(() => {
                const contentBtn = document.querySelector('.sidebar-nav [data-panel="content"]');
                const contentSection = document.querySelector('[data-view="content"]');
                const sidebarButtons = Array.from(document.querySelectorAll('.sidebar-nav button')).map(b => b.innerText.trim().split('\\n')[0]);
                const activePanel = document.querySelector('.dash-panel:not(.hidden)')?.getAttribute('data-view');
                const currentHash = window.location.hash;
                return {
                    contentBtnExists: !!contentBtn,
                    contentSectionExists: !!contentSection,
                    sidebarButtons,
                    activePanel,
                    currentHash
                };
            })()`,
            returnByValue: true
        });

        console.log('CONTENT REMOVAL VERIFICATION RESULT:', JSON.stringify(evalRes.result.value, null, 2));

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/sidebar_after_content_removal.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Saved scratch/sidebar_after_content_removal.png');

        chrome.kill();
        process.exit(0);
    });
}

testContentRemoval().catch(err => {
    console.error(err);
    process.exit(1);
});
