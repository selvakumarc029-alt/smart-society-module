const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function test() {
    console.log("Spawning Chrome directly with URL...");
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9462',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9462/json', res => {
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

            console.log("Checking Initial Card Buttons...");
            const cardInfo = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                        const badge = card.querySelector('.badge')?.textContent?.trim();
                        return { buttons, badge };
                    })()
                `,
                returnByValue: true
            });
            console.log("1. Card State:", cardInfo.result.value);

            let ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/direct_1_card.png', Buffer.from(ss.data, 'base64'));

            // Click View button
            console.log("Clicking View button...");
            await send('Runtime.evaluate', {
                expression: `document.querySelector('#societiesCardsGrid .society-directory-card button').click();`
            });
            await new Promise(r => setTimeout(r, 600));

            const viewInfo = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const modal = document.getElementById('viewSocietyModal');
                        const closeBtn = modal.querySelector('.btn-close');
                        const csClose = window.getComputedStyle(closeBtn);
                        const footerButtons = Array.from(modal.querySelectorAll('.modal-footer button:not(.d-none)')).map(b => b.textContent.trim());
                        return {
                            visible: modal.classList.contains('show'),
                            footerButtons,
                            closeWidth: csClose.width,
                            closeHeight: csClose.height,
                            closeBorderRadius: csClose.borderRadius,
                            closeBg: csClose.background
                        };
                    })()
                `,
                returnByValue: true
            });
            console.log("2. View Modal Info:", viewInfo.result.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/direct_2_view_modal.png', Buffer.from(ss.data, 'base64'));

            // Close View modal
            console.log("Closing View modal...");
            await send('Runtime.evaluate', {
                expression: `document.querySelector('#viewSocietyModal [data-bs-dismiss="modal"].superadmin-cancel-btn').click();`
            });
            await new Promise(r => setTimeout(r, 600));

            // Click Add Society button
            console.log("Clicking Add Society button...");
            await send('Runtime.evaluate', {
                expression: `document.getElementById('btnOpenAddSocietyModal').click();`
            });
            await new Promise(r => setTimeout(r, 600));

            const addInfo = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const modal = document.getElementById('addSocietyModal');
                        const closeBtn = modal.querySelector('.btn-close');
                        const csClose = window.getComputedStyle(closeBtn);
                        return {
                            visible: modal.classList.contains('show'),
                            dialogWidth: window.getComputedStyle(modal.querySelector('.modal-dialog')).maxWidth,
                            closeWidth: csClose.width,
                            closeHeight: csClose.height
                        };
                    })()
                `,
                returnByValue: true
            });
            console.log("3. Add Modal Info:", addInfo.result.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/direct_3_add_modal.png', Buffer.from(ss.data, 'base64'));

            // Close Add modal
            console.log("Closing Add modal...");
            await send('Runtime.evaluate', {
                expression: `document.querySelector('#addSocietyModal .btn-close').click();`
            });
            await new Promise(r => setTimeout(r, 600));

            // Switch to Table View
            console.log("Switching to Table View...");
            await send('Runtime.evaluate', {
                expression: `document.getElementById('btnSocietiesTableView').click();`
            });
            await new Promise(r => setTimeout(r, 500));

            const tableInfo = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const row = document.querySelector('table[data-table="societies"] tbody tr');
                        const buttons = Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim());
                        const badge = row.querySelector('.badge')?.textContent?.trim();
                        return { buttons, badge };
                    })()
                `,
                returnByValue: true
            });
            console.log("4. Table Row Info:", tableInfo.result.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/direct_4_table.png', Buffer.from(ss.data, 'base64'));

            // Switch back to Cards View
            console.log("Switching back to Cards View...");
            await send('Runtime.evaluate', {
                expression: `document.getElementById('btnSocietiesCardsView').click();`
            });
            await new Promise(r => setTimeout(r, 500));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/direct_5_cards.png', Buffer.from(ss.data, 'base64'));

            console.log("SUCCESS! All checks finished.");
            ws.close();
            chrome.kill();
            process.exit(0);
        });

    } catch(e) {
        console.error("Error:", e);
        chrome.kill();
        process.exit(1);
    }
}
test();
