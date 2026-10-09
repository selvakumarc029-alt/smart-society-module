const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function capture(url, outPath) {
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,1100',
        '--disable-gpu',
        '--no-sandbox',
        url
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

        // Evaluate state and fill some test values to verify interaction
        const evalRes = await send('Runtime.evaluate', {
            expression: `(function() {
                const phone = document.getElementById('ownerPhoneInput');
                const altPhone = document.getElementById('ownerAltPhoneInput');
                const oldPass = document.getElementById('oldPasswordInput');
                const newPass = document.getElementById('newPasswordInput');
                const confirmPass = document.getElementById('confirmPasswordInput');
                
                if (newPass) {
                    newPass.value = 'Secret@2026';
                    checkPasswordStrength('Secret@2026');
                }
                if (confirmPass) {
                    confirmPass.value = 'Secret@2026';
                    checkPasswordMatch();
                }
                if (altPhone) {
                    altPhone.value = '+91 98450 99887';
                }

                return {
                    hasPhone: !!phone,
                    phoneVal: phone ? phone.value : null,
                    hasAltPhone: !!altPhone,
                    hasOldPass: !!oldPass,
                    hasNewPass: !!newPass,
                    hasConfirmPass: !!confirmPass,
                    strengthLabel: document.getElementById('passwordStrengthLabel')?.textContent,
                    matchMsg: document.getElementById('passwordMatchMessage')?.textContent
                };
            })()`,
            returnByValue: true
        });

        console.log('DOM Evaluation Result:', JSON.stringify(evalRes.result?.value, null, 2));

        await new Promise(r => setTimeout(r, 800));

        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log('Saved screenshot to: ' + outPath);
        ws.close();
    } finally {
        chrome.kill();
    }
}

async function run() {
    await capture('http://localhost:8080/propertydirect/dashboards/owner#profile', 'scratch/owner_profile_dashboard.png');
}

run();
