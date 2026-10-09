const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testWithCounts() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9498',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#overview'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9498/json', res => {
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

        // Call loadOverview directly and wait
        await send('Runtime.evaluate', {
            expression: 'if (typeof loadOverview === "function") { loadOverview(); }'
        });

        await new Promise(r => setTimeout(r, 2500));

        const countsRes = await send('Runtime.evaluate', {
            expression: `(() => {
                return {
                    pendingApprovals: document.getElementById('overviewPendingApprovals')?.innerText,
                    pendingVerifications: document.getElementById('overviewPendingVerifications')?.innerText,
                    activeProperties: document.getElementById('overviewActiveProperties')?.innerText,
                    totalUsers: document.getElementById('overviewTotalUsers')?.innerText,
                    totalEnquiries: document.getElementById('overviewTotalEnquiries')?.innerText,
                    scheduledVisits: document.getElementById('overviewScheduledVisits')?.innerText,
                    openReports: document.getElementById('overviewOpenReports')?.innerText,
                    totalAudit: document.getElementById('overviewTotalAudit')?.innerText
                };
            })()`,
            returnByValue: true
        });

        console.log('LIVE COUNTS POPULATED:', countsRes.result.value);

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/overview_populated.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Saved scratch/overview_populated.png');

        chrome.kill();
        process.exit(0);
    });
}

testWithCounts();
