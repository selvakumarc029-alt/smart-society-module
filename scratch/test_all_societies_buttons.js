const { spawn } = require('child_process');
const http = require('http');

async function run() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9447',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9447/json', res => {
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

            ws.addEventListener('message', (event) => {
                const msg = JSON.parse(event.data);
                if (msg.method === 'Runtime.consoleAPICalled') {
                    console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
                }
            });

            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 2500));

            // Test 1: Toggle Table
            console.log("\n--- TEST 1: Click Table Toggle ---");
            const toggleTableRes = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        document.getElementById('btnSocietiesTableView').click();
                        const cardsHidden = document.getElementById('societiesCardsContainer').classList.contains('d-none');
                        const tableVisible = !document.getElementById('societiesTableContainer').classList.contains('d-none');
                        return { cardsHidden, tableVisible };
                    })()
                `,
                returnByValue: true
            });
            console.log("Toggle Table:", toggleTableRes.result.value);

            // Test 2: Toggle back to Cards
            console.log("\n--- TEST 2: Click Cards Toggle ---");
            const toggleCardsRes = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        document.getElementById('btnSocietiesCardsView').click();
                        const cardsVisible = !document.getElementById('societiesCardsContainer').classList.contains('d-none');
                        const tableHidden = document.getElementById('societiesTableContainer').classList.contains('d-none');
                        return { cardsVisible, tableHidden };
                    })()
                `,
                returnByValue: true
            });
            console.log("Toggle Cards:", toggleCardsRes.result.value);

            // Test 3: Click Suspend on the card
            console.log("\n--- TEST 3: Click Suspend on Card ---");
            const suspendRes = await send('Runtime.evaluate', {
                expression: `
                    (async () => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        const suspendBtn = card.querySelectorAll('button')[2]; // View, Approve, Suspend
                        console.log("Suspend button text:", suspendBtn?.textContent?.trim());
                        suspendBtn.click();
                        // wait 1000ms for network request
                        await new Promise(r => setTimeout(r, 1200));
                        const tenant = (window.platformTenants || []).find(t => String(t.id) === '2');
                        const toast = document.querySelector('.toast, .alert, [role="alert"]')?.textContent;
                        return {
                            tenantApproved: tenant?.approved,
                            cardBadgeText: card.querySelector('.badge')?.textContent?.trim()
                        };
                    })()
                `,
                awaitPromise: true,
                returnByValue: true
            });
            console.log("Suspend result:", suspendRes.result.value);

            // Test 4: Click Approve on the card
            console.log("\n--- TEST 4: Click Approve on Card ---");
            const approveRes = await send('Runtime.evaluate', {
                expression: `
                    (async () => {
                        const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                        const approveBtn = card.querySelectorAll('button')[1]; // View, Approve, Suspend
                        console.log("Approve button text:", approveBtn?.textContent?.trim());
                        approveBtn.click();
                        await new Promise(r => setTimeout(r, 1200));
                        const tenant = (window.platformTenants || []).find(t => String(t.id) === '2');
                        return {
                            tenantApproved: tenant?.approved,
                            cardBadgeText: card.querySelector('.badge')?.textContent?.trim()
                        };
                    })()
                `,
                awaitPromise: true,
                returnByValue: true
            });
            console.log("Approve result:", approveRes.result.value);

            // Test 5: Open View modal and test its buttons
            console.log("\n--- TEST 5: Open View Modal and test Suspend/Approve inside modal ---");
            const modalActionsRes = await send('Runtime.evaluate', {
                expression: `
                    (async () => {
                        const viewBtn = document.querySelector('#societiesCardsGrid .society-directory-card button');
                        viewBtn.click();
                        await new Promise(r => setTimeout(r, 600));
                        const modal = document.getElementById('viewSocietyModal');
                        const btnApprove = document.getElementById('btnModalApproveSociety');
                        const btnSuspend = document.getElementById('btnModalSuspendSociety');
                        
                        console.log("Modal opened. Clicking Modal Suspend button...");
                        btnSuspend.click();
                        await new Promise(r => setTimeout(r, 1200));
                        const statusBadge = document.getElementById('viewSocietyStatusBadge')?.textContent?.trim();
                        const approvedText = document.getElementById('viewSocietyApprovedText')?.textContent?.trim();

                        console.log("Now clicking Modal Approve button...");
                        btnApprove.click();
                        await new Promise(r => setTimeout(r, 1200));
                        const statusBadgeAfter = document.getElementById('viewSocietyStatusBadge')?.textContent?.trim();

                        return {
                            statusBadgeAfterSuspend: statusBadge,
                            statusBadgeAfterApprove: statusBadgeAfter
                        };
                    })()
                `,
                awaitPromise: true,
                returnByValue: true
            });
            console.log("Modal actions result:", modalActionsRes.result.value);

            // Test 6: Check Send Platform Notice button
            console.log("\n--- TEST 6: Check Send Platform Notice button ---");
            const noticeBtnRes = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const btn = document.getElementById('btnOpenPlatformNoticeModal');
                        btn.click();
                        const noticeModal = document.getElementById('platformNoticeModal');
                        return {
                            exists: !!noticeModal,
                            visible: noticeModal?.classList.contains('show') || window.getComputedStyle(noticeModal).display !== 'none'
                        };
                    })()
                `,
                returnByValue: true
            });
            console.log("Send Platform Notice modal:", noticeBtnRes.result.value);

            ws.close();
            chrome.kill();
            process.exit(0);
        });
    } catch(e) {
        console.error(e);
        chrome.kill();
        process.exit(1);
    }
}
run();
