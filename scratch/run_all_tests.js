const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9465',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9465/json', res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });

        const pageTab = tabs.find(t => t.type === 'page');
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        let id = 1;
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                const handler = (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === reqId) {
                        ws.removeEventListener('message', handler);
                        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
                        else resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        async function evalJs(expr) {
            const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
            return res?.result?.value;
        }

        ws.addEventListener('open', async () => {
            console.log("\n--- STEP 1: Inspecting Society Card ---");
            const cardData = await evalJs(`
                (() => {
                    const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                    if (!card) return "No card found";
                    const title = card.querySelector('h5')?.textContent?.trim();
                    const badge = card.querySelector('.badge')?.textContent?.trim();
                    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                    return { title, badge, buttons };
                })()
            `);
            console.log("Card Data:", JSON.stringify(cardData));

            let ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step1_card.png', Buffer.from(ss.data, 'base64'));
            console.log("Screenshot step1_card.png saved.");

            console.log("\n--- STEP 2: Clicking View Button ---");
            await evalJs(`
                document.querySelector('#societiesCardsGrid .society-directory-card button').click();
            `);
            await new Promise(r => setTimeout(r, 600));

            const modalData = await evalJs(`
                (() => {
                    const modal = document.getElementById('viewSocietyModal');
                    const closeBtn = modal.querySelector('.btn-close');
                    const cs = window.getComputedStyle(closeBtn);
                    const footerBtns = Array.from(modal.querySelectorAll('.modal-footer button:not(.d-none)')).map(b => b.textContent.trim());
                    return {
                        visible: modal.classList.contains('show'),
                        title: document.getElementById('viewSocietyModalTitle')?.textContent?.trim(),
                        statusBadge: document.getElementById('viewSocietyStatusBadge')?.textContent?.trim(),
                        footerBtns,
                        closeBtnSize: cs.width + ' x ' + cs.height,
                        closeBtnBorderRadius: cs.borderRadius,
                        hasSvgBg: cs.backgroundImage.includes('data:image/svg')
                    };
                })()
            `);
            console.log("View Modal Data:", JSON.stringify(modalData));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step2_view_modal.png', Buffer.from(ss.data, 'base64'));
            console.log("Screenshot step2_view_modal.png saved.");

            // Close View Modal
            console.log("\n--- Closing View Modal ---");
            await evalJs(`
                document.querySelector('#viewSocietyModal .btn-close').click();
            `);
            await new Promise(r => setTimeout(r, 600));

            console.log("\n--- STEP 3: Testing Suspend Button on Card ---");
            const suspendResult = await evalJs(`
                new Promise(async (resolve) => {
                    await window.triggerSocietyAction('2', 'suspend-society');
                    setTimeout(() => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        const badge = card.querySelector('.badge')?.textContent?.trim();
                        const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                        resolve({ badge, buttons });
                    }, 800);
                })
            `);
            console.log("After Suspend:", JSON.stringify(suspendResult));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step3_suspended.png', Buffer.from(ss.data, 'base64'));

            console.log("\n--- STEP 4: Testing Approve Button on Card ---");
            const approveResult = await evalJs(`
                new Promise(async (resolve) => {
                    await window.triggerSocietyAction('2', 'approve-society');
                    setTimeout(() => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        const badge = card.querySelector('.badge')?.textContent?.trim();
                        const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
                        resolve({ badge, buttons });
                    }, 800);
                })
            `);
            console.log("After Approve:", JSON.stringify(approveResult));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step4_approved.png', Buffer.from(ss.data, 'base64'));

            console.log("\n--- STEP 5: Testing Add Society Modal ---");
            await evalJs(`document.getElementById('btnOpenAddSocietyModal').click();`);
            await new Promise(r => setTimeout(r, 600));

            const addModalData = await evalJs(`
                (() => {
                    const modal = document.getElementById('addSocietyModal');
                    const closeBtn = modal.querySelector('.btn-close');
                    const cs = window.getComputedStyle(closeBtn);
                    const dialogCs = window.getComputedStyle(modal.querySelector('.modal-dialog'));
                    return {
                        visible: modal.classList.contains('show'),
                        dialogMaxWidth: dialogCs.maxWidth,
                        closeBtnSize: cs.width + ' x ' + cs.height,
                        hasSvgBg: cs.backgroundImage.includes('data:image/svg')
                    };
                })()
            `);
            console.log("Add Society Modal Data:", JSON.stringify(addModalData));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step5_add_modal.png', Buffer.from(ss.data, 'base64'));

            // Close Add modal
            await evalJs(`document.querySelector('#addSocietyModal .btn-close').click();`);
            await new Promise(r => setTimeout(r, 600));

            console.log("\n--- STEP 6: Testing Table View Toggle ---");
            await evalJs(`document.getElementById('btnSocietiesTableView').click();`);
            await new Promise(r => setTimeout(r, 500));

            const tableData = await evalJs(`
                (() => {
                    const row = document.querySelector('table[data-table="societies"] tbody tr');
                    const buttons = Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim());
                    const badge = row.querySelector('.badge')?.textContent?.trim();
                    return { buttons, badge };
                })()
            `);
            console.log("Table View Data:", JSON.stringify(tableData));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step6_table_view.png', Buffer.from(ss.data, 'base64'));

            // Switch back to cards
            await evalJs(`document.getElementById('btnSocietiesCardsView').click();`);
            await new Promise(r => setTimeout(r, 400));

            ss = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('scratch/step7_final_cards.png', Buffer.from(ss.data, 'base64'));

            console.log("\nSUCCESS: All steps executed cleanly!");
            ws.close();
            chrome.kill();
            process.exit(0);
        });

    } catch (e) {
        console.error("Test Error:", e);
        chrome.kill();
        process.exit(1);
    }
}

test();
