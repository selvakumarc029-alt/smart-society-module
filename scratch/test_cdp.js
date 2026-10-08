const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/Thiru T/.gemini/antigravity-ide/brain/3749b293-06bd-4ac4-b73e-fd0fdf66647e';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function run() {
    console.log("1. Starting Chrome headless with remote debugging port 9455...");
    const chromeProc = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9455',
        '--user-data-dir=' + path.join(__dirname, 'chrome-temp-profile-final'),
        '--no-first-run',
        '--window-size=1400,900'
    ]);

    await sleep(2500);

    try {
        const res = await fetch('http://localhost:9455/json/list');
        const list = await res.json();
        const target = list.find(t => t.type === 'page');
        const ws = new WebSocket(target.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
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

        // Authenticate admin session
        console.log("2. Authenticating admin session via API...");
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

        console.log("3. Navigating to Admin Metadata Panel...");
        await send('Page.navigate', { url: 'http://localhost:8080/propertydirect/dashboards/admin#metadata' });
        await sleep(3000);

        // Screenshot 1: Metadata Overview with the 3 upgraded buttons
        console.log("4. Capturing screenshot of metadata panel with 3 upgraded buttons...");
        let shot1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'metadata_buttons_panel.png'), Buffer.from(shot1.result.data, 'base64'));
        console.log("Saved metadata_buttons_panel.png");

        // Click Add Category button
        console.log("5. Clicking Add Category button...");
        await send('Runtime.evaluate', {
            expression: `
                const btn = document.getElementById('btnAddCategoryMeta');
                if (btn) btn.click();
            `
        });
        await sleep(1000);

        let shotCat = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_add_category.png'), Buffer.from(shotCat.result.data, 'base64'));
        console.log("Saved modal_add_category.png");

        // Close modal and Click Add Amenity
        console.log("6. Clicking Add Amenity button...");
        await send('Runtime.evaluate', {
            expression: `
                closeModal('metadataDetailModal');
                setTimeout(() => {
                    const btn = document.getElementById('btnAddAmenityMeta');
                    if (btn) btn.click();
                }, 300);
            `
        });
        await sleep(1000);

        let shotAmen = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_add_amenity.png'), Buffer.from(shotAmen.result.data, 'base64'));
        console.log("Saved modal_add_amenity.png");

        // Close modal and Click Add Location
        console.log("7. Clicking Add Location button...");
        await send('Runtime.evaluate', {
            expression: `
                closeModal('metadataDetailModal');
                setTimeout(() => {
                    const btn = document.getElementById('btnAddLocationMeta');
                    if (btn) btn.click();
                }, 300);
            `
        });
        await sleep(1000);

        let shotLoc = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'modal_add_location.png'), Buffer.from(shotLoc.result.data, 'base64'));
        console.log("Saved modal_add_location.png");

        ws.close();
        console.log("ALL 4 SCREENSHOTS CAPTURED SUCCESSFULLY!");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        chromeProc.kill('SIGKILL');
    }
}

run();
