const { spawn } = require('child_process');
const http = require('http');

async function run() {
    console.log("Starting Chrome...");
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9444',
        '--disable-gpu',
        '--no-sandbox',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const tabs = await new Promise((resolve, reject) => {
            http.get('http://localhost:9444/json', res => {
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

            console.log('Navigating to http://localhost:8080/dashboards/superadmin#societies ...');
            await send('Page.navigate', { url: 'http://localhost:8080/dashboards/superadmin#societies' });
            await new Promise(r => setTimeout(r, 2500));

            // Check what buttons exist on the societies section
            const evalResult = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const results = {};
                        results.location = window.location.href;
                        results.activePanel = document.querySelector('.superadmin-view-panel:not(.d-none)')?.dataset.view;
                        results.tenantsLength = window.platformTenants?.length;
                        results.cardsCount = document.querySelectorAll('#societiesCardsGrid .society-directory-card').length;
                        results.tableRowsCount = document.querySelectorAll('table[data-table="societies"] tbody tr').length;
                        
                        const firstCard = document.querySelector('#societiesCardsGrid .society-directory-card');
                        if (firstCard) {
                            results.cardTitle = firstCard.querySelector('h5')?.textContent;
                            results.cardButtons = Array.from(firstCard.querySelectorAll('button')).map(b => ({
                                text: b.textContent.trim(),
                                onclick: b.getAttribute('onclick'),
                                class: b.className
                            }));
                        }

                        results.addSocietyBtn = Boolean(document.getElementById('btnOpenAddSocietyModal'));
                        results.btnCards = Boolean(document.getElementById('btnSocietiesCardsView'));
                        results.btnTable = Boolean(document.getElementById('btnSocietiesTableView'));
                        results.noticeBtn = Boolean(document.getElementById('btnOpenPlatformNoticeModal'));

                        return results;
                    })()
                `,
                returnByValue: true
            });

            console.log("Evaluation result:", JSON.stringify(evalResult.result.value, null, 2));

            // Now test clicking "View" button on card
            const viewClickResult = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const viewBtn = document.querySelector('#societiesCardsGrid .society-directory-card button');
                        if (!viewBtn) return "No view button found";
                        try {
                            viewBtn.click();
                            const modal = document.getElementById('viewSocietyModal');
                            return {
                                clicked: true,
                                modalVisible: modal ? (window.getComputedStyle(modal).display !== 'none' || modal.classList.contains('show')) : false,
                                modalTitle: document.getElementById('viewSocietyModalTitle')?.textContent,
                                modalBodyName: document.getElementById('viewSocietyName')?.textContent
                            };
                        } catch(e) {
                            return { error: e.message, stack: e.stack };
                        }
                    })()
                `,
                returnByValue: true
            });
            console.log("View click result:", JSON.stringify(viewClickResult.result.value, null, 2));

            await new Promise(r => setTimeout(r, 1000));

            // Capture screenshot of View modal
            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            require('fs').writeFileSync('scratch/societies_view_test.png', Buffer.from(screenshot.data, 'base64'));
            console.log("Screenshot saved to scratch/societies_view_test.png");

            ws.close();
            chrome.kill();
            process.exit(0);
        });

    } catch (e) {
        console.error("Error:", e);
        chrome.kill();
        process.exit(1);
    }
}

run();
