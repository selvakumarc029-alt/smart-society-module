const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testWizard() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9487',
        '--window-size=1366,768',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/admin#add-property'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9487/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        if (!pageTab) throw new Error('No page tab found');

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

        await new Promise((resolve) => ws.addEventListener('open', resolve));
        await send('Page.enable');
        await send('Runtime.enable');
        await new Promise(r => setTimeout(r, 1500));

        // 1. STEP 1
        console.log('Capturing Step 1...');
        const shot1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step1_clean.png', Buffer.from(shot1.data, 'base64'));

        // Fill Step 1 required fields & go to Step 2
        await send('Runtime.evaluate', {
            expression: `(() => {
                const ownerSel = document.getElementById('adminOwnerSelect');
                if (ownerSel && ownerSel.options.length > 1) {
                    ownerSel.selectedIndex = 1;
                    ownerSel.dispatchEvent(new Event('change'));
                }
                const titleInp = document.querySelector('[name="title"]');
                if (titleInp) titleInp.value = "Grand 3 BHK Luxury Villa in Anna Nagar";
                window.validateAndGoToStep(2);
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        // 2. STEP 2
        console.log('Capturing Step 2...');
        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step2_clean.png', Buffer.from(shot2.data, 'base64'));

        // Check Step 2 fields and go to Step 3
        await send('Runtime.evaluate', {
            expression: `(() => {
                const addr = document.querySelector('[name="address"]');
                if (addr) addr.value = "14, 2nd Avenue, Anna Nagar West";
                window.validateAndGoToStep(3);
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        // 3. STEP 3
        console.log('Capturing Step 3...');
        const shot3 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step3_clean.png', Buffer.from(shot3.data, 'base64'));

        // Go to Step 4 (Amenities)
        await send('Runtime.evaluate', {
            expression: `(() => {
                window.validateAndGoToStep(4);
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        // 4. STEP 4
        console.log('Capturing Step 4...');
        const shot4 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step4_clean.png', Buffer.from(shot4.data, 'base64'));

        // Go to Step 5 (Photos)
        await send('Runtime.evaluate', {
            expression: `(() => {
                window.validateAndGoToStep(5);
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        // 5. STEP 5
        console.log('Capturing Step 5...');
        const shot5 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step5_clean.png', Buffer.from(shot5.data, 'base64'));

        // Go to Step 6 (Review & Publish)
        await send('Runtime.evaluate', {
            expression: `(() => {
                window.validateAndGoToStep(6);
            })()`
        });
        await new Promise(r => setTimeout(r, 600));

        // 6. STEP 6
        console.log('Capturing Step 6...');
        const shot6 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('scratch/wizard_step6_clean.png', Buffer.from(shot6.data, 'base64'));

        console.log('All 6 wizard step screenshots captured successfully!');
        ws.close();
    } finally {
        chrome.kill();
    }
}

testWizard();
