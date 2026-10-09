const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testInteractions() {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,1100',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/owner#profile'
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
        await new Promise(r => setTimeout(r, 1500));

        // Test 1: Test toggle password visibility
        const toggleRes = await send('Runtime.evaluate', {
            expression: `(function() {
                const oldIn = document.getElementById('oldPasswordInput');
                const btn = oldIn.nextElementSibling;
                const typeBefore = oldIn.type;
                togglePasswordVisibility('oldPasswordInput', btn);
                const typeAfter = oldIn.type;
                togglePasswordVisibility('oldPasswordInput', btn);
                return { typeBefore, typeAfter, typeBack: oldIn.type };
            })()`,
            returnByValue: true
        });
        console.log('Toggle test:', toggleRes.result?.value);

        // Test 2: Test password submission
        const passRes = await send('Runtime.evaluate', {
            expression: `(function() {
                document.getElementById('oldPasswordInput').value = 'Current123';
                document.getElementById('newPasswordInput').value = 'NewSecret2026';
                document.getElementById('confirmPasswordInput').value = 'NewSecret2026';
                handleOwnerChangePassword();
                await new Promise(r => setTimeout(r, 600));
                return {
                    toastText: document.getElementById('ownerToast')?.textContent,
                    toastDisplay: document.getElementById('ownerToast')?.style.display
                };
            })()`,
            returnByValue: true
        });
        console.log('Password submit test:', passRes.result?.value);

        // Test 3: Test profile saving
        const profRes = await send('Runtime.evaluate', {
            expression: `(function() {
                document.getElementById('ownerPhoneInput').value = '+91 99000 88776';
                document.getElementById('ownerEmailInput').value = 'verified.owner@propertydirect.in';
                saveOwnerProfile();
                return {
                    sidebarPhoneEmail: document.getElementById('sidebarOwnerEmail')?.textContent,
                    toastText: document.getElementById('ownerToast')?.textContent,
                    storedProfile: localStorage.getItem('propertydirect_owner_profile')
                };
            })()`,
            returnByValue: true
        });
        console.log('Profile save test:', profRes.result?.value);

        ws.close();
    } finally {
        chrome.kill();
    }
}

testInteractions();
