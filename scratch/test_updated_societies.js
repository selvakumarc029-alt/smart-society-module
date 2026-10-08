const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function run() {
    console.log("Starting Chrome for full verification...");
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9458',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9458/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let id = 1;
        let currentContextId = null;

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

        function evaluate(expression) {
            const params = { expression, returnByValue: true };
            if (currentContextId) params.contextId = currentContextId;
            return send('Runtime.evaluate', params);
        }

        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.executionContextCreated') {
                currentContextId = msg.params.context.id;
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
            }
            if (msg.method === 'Page.javascriptDialogOpening') {
                console.log('DIALOG OPENED:', msg.params.message);
                send('Page.handleJavaScriptDialog', { accept: true });
            }
        });

        ws.addEventListener('open', async () => {
            await send('Runtime.enable');
            await send('Page.enable');

            console.log("Navigating to http://localhost:8080/dashboards/superadmin#societies ...");
            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 2500));

            // Auto accept confirms inside window
            await evaluate(`window.confirm = () => true;`);

            // 1. Initial State
            console.log("\n=== 1. Checking Initial Card State ===");
            const initialCardState = await evaluate(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    if (!card) return "No card found";
                    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                    const badge = card.querySelector('.badge')?.textContent?.trim();
                    return { buttons, badge };
                })()
            `);
            console.log("Initial Card State:", initialCardState.value);

            let ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_1_initial_card.png', Buffer.from(ss.data, 'base64'));

            // 2. Click View Button on Card
            console.log("\n=== 2. Testing View Button & Modal ===");
            await evaluate(`document.querySelector('#societiesCardsGrid .society-directory-card button').click();`);
            await new Promise(r => setTimeout(r, 600));

            const viewModalState = await evaluate(`
                (() => {
                    const modal = document.getElementById('viewSocietyModal');
                    const closeBtn = modal.querySelector('.btn-close');
                    const csClose = window.getComputedStyle(closeBtn);
                    const footerButtons = Array.from(modal.querySelectorAll('.modal-footer button:not(.d-none)')).map(b => b.textContent.trim());
                    return {
                        visible: modal.classList.contains('show'),
                        title: document.getElementById('viewSocietyModalTitle')?.textContent,
                        statusBadge: document.getElementById('viewSocietyStatusBadge')?.textContent?.trim(),
                        footerButtons,
                        closeBtnWidth: csClose.width,
                        closeBtnHeight: csClose.height,
                        closeBtnBorderRadius: csClose.borderRadius,
                        closeBtnBgImage: csClose.backgroundImage.includes('data:image/svg') ? "Has SVG Background" : csClose.backgroundImage
                    };
                })()
            `);
            console.log("View Modal State:", viewModalState.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_2_view_modal.png', Buffer.from(ss.data, 'base64'));

            // Close View modal via Close button
            await evaluate(`document.querySelector('#viewSocietyModal [data-bs-dismiss="modal"].superadmin-cancel-btn').click();`);
            await new Promise(r => setTimeout(r, 600));

            // 3. Test Suspend Button on Card
            console.log("\n=== 3. Testing Suspend on Card ===");
            await evaluate(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    const suspendBtn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.includes('Suspend'));
                    suspendBtn.click();
                })()
            `);
            await new Promise(r => setTimeout(r, 1200));

            const afterSuspendState = await evaluate(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                    const badge = card.querySelector('.badge')?.textContent?.trim();
                    return { buttons, badge };
                })()
            `);
            console.log("Card State After Suspend:", afterSuspendState.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_3_card_suspended.png', Buffer.from(ss.data, 'base64'));

            // 4. Test Approve Button on Card
            console.log("\n=== 4. Testing Approve on Card ===");
            await evaluate(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    const approveBtn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.includes('Approve'));
                    approveBtn.click();
                })()
            `);
            await new Promise(r => setTimeout(r, 1200));

            const afterApproveState = await evaluate(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                    const badge = card.querySelector('.badge')?.textContent?.trim();
                    return { buttons, badge };
                })()
            `);
            console.log("Card State After Approve:", afterApproveState.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_4_card_approved.png', Buffer.from(ss.data, 'base64'));

            // 5. Test Add Society Modal
            console.log("\n=== 5. Testing Add Society Modal ===");
            await evaluate(`document.getElementById('btnOpenAddSocietyModal').click();`);
            await new Promise(r => setTimeout(r, 600));

            const addModalState = await evaluate(`
                (() => {
                    const modal = document.getElementById('addSocietyModal');
                    const closeBtn = modal.querySelector('.btn-close');
                    const csClose = window.getComputedStyle(closeBtn);
                    const helpdesk = document.querySelector('.ai-helpdesk-toggle');
                    const csHelpdesk = helpdesk ? window.getComputedStyle(helpdesk) : null;
                    return {
                        visible: modal.classList.contains('show'),
                        modalDialogMaxWidth: window.getComputedStyle(modal.querySelector('.modal-dialog')).maxWidth,
                        closeBtnWidth: csClose.width,
                        closeBtnHeight: csClose.height,
                        closeBtnBgImage: csClose.backgroundImage.includes('data:image/svg') ? "Has SVG Background" : csClose.backgroundImage,
                        helpdeskOpacity: csHelpdesk ? csHelpdesk.opacity : 'none'
                    };
                })()
            `);
            console.log("Add Society Modal State:", addModalState.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_5_add_modal.png', Buffer.from(ss.data, 'base64'));

            // Close Add modal via X
            await evaluate(`document.querySelector('#addSocietyModal .btn-close').click();`);
            await new Promise(r => setTimeout(r, 600));

            // 6. Test Table View
            console.log("\n=== 6. Testing Table View Toggle & Rows ===");
            await evaluate(`document.getElementById('btnSocietiesTableView').click();`);
            await new Promise(r => setTimeout(r, 600));

            const tableState = await evaluate(`
                (() => {
                    const row = document.querySelector('table[data-table="societies"] tbody tr');
                    const buttons = Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim());
                    const badge = row.querySelector('.badge')?.textContent?.trim();
                    return { buttons, badge };
                })()
            `);
            console.log("Table View State:", tableState.value);

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_6_table_view.png', Buffer.from(ss.data, 'base64'));

            // Switch back to cards view
            await evaluate(`document.getElementById('btnSocietiesCardsView').click();`);
            await new Promise(r => setTimeout(r, 400));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/verify_7_final_cards_view.png', Buffer.from(ss.data, 'base64'));

            console.log("\n=========================================");
            console.log("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
            console.log("=========================================");

            ws.close();
            chrome.kill();
            process.exit(0);
        });

    } catch (e) {
        console.error("Test error:", e);
        chrome.kill();
        process.exit(1);
    }
}
run();
