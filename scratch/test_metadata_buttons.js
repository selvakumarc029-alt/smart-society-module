const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testMetadata() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new', '--remote-debugging-port=9348', '--disable-gpu', '--no-sandbox', 'about:blank'
    ]);
    await new Promise(r => setTimeout(r, 1500));
    const tabs = await new Promise(res => http.get('http://localhost:9348/json', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }));
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
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1100,
            height: 700,
            deviceScaleFactor: 1,
            mobile: false
        });

        await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#metadata' });
        await new Promise(r => setTimeout(r, 2000));

        // 1. Capture metadata page with the 3 upgraded buttons
        const ss1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/metadata_buttons_upgraded.png', Buffer.from(ss1.data, 'base64'));
        console.log('Saved scratch/metadata_buttons_upgraded.png');

        // 2. Click + Add Category
        await send('Runtime.evaluate', {
            expression: `document.getElementById('btnAddCategoryMeta').click();`
        });
        await new Promise(r => setTimeout(r, 600));

        const ss2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/modal_add_category_detail.png', Buffer.from(ss2.data, 'base64'));
        console.log('Saved scratch/modal_add_category_detail.png');

        // 3. Close modal & Click + Add Amenity
        await send('Runtime.evaluate', {
            expression: `closeModal('metadataDetailModal'); document.getElementById('btnAddAmenityMeta').click();`
        });
        await new Promise(r => setTimeout(r, 600));

        const ss3 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/modal_add_amenity_detail.png', Buffer.from(ss3.data, 'base64'));
        console.log('Saved scratch/modal_add_amenity_detail.png');

        // 4. Close modal & Click + Add Location
        await send('Runtime.evaluate', {
            expression: `closeModal('metadataDetailModal'); document.getElementById('btnAddLocationMeta').click();`
        });
        await new Promise(r => setTimeout(r, 600));

        const ss4 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/modal_add_location_detail.png', Buffer.from(ss4.data, 'base64'));
        console.log('Saved scratch/modal_add_location_detail.png');

        chrome.kill();
        process.exit(0);
    });
}
testMetadata();
