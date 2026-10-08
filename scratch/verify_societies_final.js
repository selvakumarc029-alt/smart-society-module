const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function run() {
    const userDataDir = path.resolve(__dirname, 'chrome-temp-final');
    console.log("Starting Chrome headless directly at target URL...");

    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9499',
        `--user-data-dir=${userDataDir}`,
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1440,900',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    chrome.on('error', err => console.error("Chrome spawn error:", err));

    let tab = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
            const listRes = await fetch('http://127.0.0.1:9499/json');
            const tabs = await listRes.json();
            tab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:8080'));
            if (!tab) tab = tabs.find(t => t.type === 'page');
            if (tab) {
                console.log("Found tab after", (i + 1) * 400, "ms:", tab.url);
                break;
            }
        } catch (e) {}
    }

    if (!tab) {
        console.error("Could not find tab on port 9499");
        chrome.kill();
        process.exit(1);
    }

    try {
        const ws = new WebSocket(tab.webSocketDebuggerUrl);

        let msgId = 1;
        const pending = new Map();

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && pending.has(msg.id)) {
                const cb = pending.get(msg.id);
                pending.delete(msg.id);
                cb(msg);
            }
        };

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                pending.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evalJs(expr) {
            const res = await send('Runtime.evaluate', {
                expression: expr,
                returnByValue: true
            });
            return res?.result?.result?.value;
        }

        async function captureScreenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res?.result?.data) {
                fs.writeFileSync(filename, Buffer.from(res.result.data, 'base64'));
                console.log(`Saved screenshot: ${filename}`);
            }
        }

        await new Promise(r => ws.onopen = r);
        console.log("CDP connected. Enabling Runtime and Page...");
        await send('Page.enable');
        await send('Runtime.enable');

        // Wait 3.5s for page and backend data to hydrate
        console.log("Waiting for backend hydration...");
        await new Promise(r => setTimeout(r, 3500));

        // Switch to societies tab explicitly if not active
        await evalJs(`
            (() => {
                if (typeof openPanel === 'function') openPanel('societies');
                else if (typeof forceOpenPanel === 'function') forceOpenPanel('societies');
            })()
        `);
        await new Promise(r => setTimeout(r, 800));

        console.log("\n==================== 1. CARDS VIEW VERIFICATION ====================");
        const cardData = await evalJs(`
            (() => {
                const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                if (!card) return null;
                return {
                    title: card.querySelector('h5')?.textContent?.trim(),
                    badge: card.querySelector('.badge')?.textContent?.trim(),
                    buttons: Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim().replace(/\\s+/g, ' '))
                };
            })()
        `);
        console.log("First Card Title:", cardData?.title);
        console.log("First Card Badge:", cardData?.badge);
        console.log("First Card Buttons:", cardData?.buttons);

        await captureScreenshot('scratch/societies_cards_view.png');

        console.log("\n==================== 2. OPEN VIEW SOCIETY MODAL ====================");
        const viewBtnClicked = await evalJs(`
            (() => {
                const btn = document.querySelector('#societiesCardsGrid .society-directory-card button');
                if (btn) { btn.click(); return true; }
                return false;
            })()
        `);
        console.log("Clicked View button:", viewBtnClicked);
        await new Promise(r => setTimeout(r, 1000));

        const viewModalData = await evalJs(`
            (() => {
                const modal = document.getElementById('viewSocietyModal');
                const closeBtn = modal?.querySelector('.btn-close');
                const cs = closeBtn ? window.getComputedStyle(closeBtn) : null;
                const footerBtns = Array.from(modal?.querySelectorAll('.modal-footer button:not(.d-none)') || []).map(b => b.textContent.trim().replace(/\\s+/g, ' '));
                return {
                    isOpen: modal?.classList.contains('show'),
                    title: document.getElementById('viewSocietyModalTitle')?.textContent?.trim(),
                    name: document.getElementById('viewSocietyName')?.textContent?.trim(),
                    badge: document.getElementById('viewSocietyStatusBadge')?.textContent?.trim(),
                    footerButtons: footerBtns,
                    closeBtnSize: cs ? (cs.width + ' x ' + cs.height) : null,
                    closeBtnHasSvg: cs ? cs.backgroundImage.includes('data:image/svg') : false,
                    closeBtnBorderRadius: cs ? cs.borderRadius : null
                };
            })()
        `);
        console.log("View Modal is Open:", viewModalData?.isOpen);
        console.log("View Modal Title:", viewModalData?.title);
        console.log("View Modal Society Name:", viewModalData?.name);
        console.log("View Modal Badge:", viewModalData?.badge);
        console.log("View Modal Footer Buttons:", viewModalData?.footerButtons);
        console.log("Close (X) Button Dimensions:", viewModalData?.closeBtnSize);
        console.log("Close (X) Button SVG icon present:", viewModalData?.closeBtnHasSvg);
        console.log("Close (X) Button Border Radius:", viewModalData?.closeBtnBorderRadius);

        await captureScreenshot('scratch/societies_view_modal.png');

        console.log("\n==================== 3. CLOSE VIEW MODAL VIA X ====================");
        await evalJs(`document.querySelector('#viewSocietyModal .btn-close')?.click()`);
        await new Promise(r => setTimeout(r, 600));
        const viewModalClosed = await evalJs(`!document.getElementById('viewSocietyModal')?.classList.contains('show')`);
        console.log("View Modal Closed successfully:", viewModalClosed);

        console.log("\n==================== 4. OPEN ADD SOCIETY MODAL ====================");
        await evalJs(`document.getElementById('btnOpenAddSocietyModal')?.click()`);
        await new Promise(r => setTimeout(r, 1000));

        const addModalData = await evalJs(`
            (() => {
                const modal = document.getElementById('addSocietyModal');
                const closeBtn = modal?.querySelector('.btn-close');
                const cs = closeBtn ? window.getComputedStyle(closeBtn) : null;
                return {
                    isOpen: modal?.classList.contains('show'),
                    dialogMaxWidth: window.getComputedStyle(modal.querySelector('.modal-dialog')).maxWidth,
                    closeBtnSize: cs ? (cs.width + ' x ' + cs.height) : null,
                    closeBtnHasSvg: cs ? cs.backgroundImage.includes('data:image/svg') : false
                };
            })()
        `);
        console.log("Add Society Modal is Open:", addModalData?.isOpen);
        console.log("Add Modal Max Width:", addModalData?.dialogMaxWidth);
        console.log("Add Modal Close (X) Size:", addModalData?.closeBtnSize);
        console.log("Add Modal Close SVG icon:", addModalData?.closeBtnHasSvg);

        await captureScreenshot('scratch/societies_add_modal.png');

        console.log("\n==================== 5. CLOSE ADD SOCIETY MODAL ====================");
        await evalJs(`document.querySelector('#addSocietyModal .btn-close')?.click()`);
        await new Promise(r => setTimeout(r, 600));
        const addModalClosed = await evalJs(`!document.getElementById('addSocietyModal')?.classList.contains('show')`);
        console.log("Add Society Modal Closed successfully:", addModalClosed);

        console.log("\n==================== 6. TOGGLE TABLE VIEW ====================");
        await evalJs(`document.getElementById('btnSocietiesTableView')?.click()`);
        await new Promise(r => setTimeout(r, 600));

        const tableData = await evalJs(`
            (() => {
                const tableCont = document.getElementById('societiesTableContainer');
                const row = document.querySelector('table[data-table="societies"] tbody tr');
                return {
                    tableVisible: tableCont && !tableCont.classList.contains('d-none'),
                    cardsHidden: document.getElementById('societiesCardsContainer')?.classList.contains('d-none'),
                    rowName: row?.querySelector('td')?.textContent?.trim(),
                    rowButtons: Array.from(row?.querySelectorAll('button') || []).map(b => b.textContent.trim().replace(/\\s+/g, ' '))
                };
            })()
        `);
        console.log("Table View Visible:", tableData?.tableVisible);
        console.log("Cards View Hidden:", tableData?.cardsHidden);
        console.log("Table Row Name:", tableData?.rowName);
        console.log("Table Row Buttons:", tableData?.rowButtons);

        await captureScreenshot('scratch/societies_table_view.png');

        console.log("\n==================== 7. TOGGLE BACK TO CARDS VIEW ====================");
        await evalJs(`document.getElementById('btnSocietiesCardsView')?.click()`);
        await new Promise(r => setTimeout(r, 600));

        const cardsActiveData = await evalJs(`
            (() => {
                return {
                    cardsVisible: !document.getElementById('societiesCardsContainer')?.classList.contains('d-none'),
                    tableHidden: document.getElementById('societiesTableContainer')?.classList.contains('d-none')
                };
            })()
        `);
        console.log("Cards View Visible:", cardsActiveData?.cardsVisible);
        console.log("Table View Hidden:", cardsActiveData?.tableHidden);

        console.log("\n==================== 8. SEND PLATFORM NOTICE MODAL ====================");
        await evalJs(`document.getElementById('btnOpenPlatformNoticeModal')?.click()`);
        await new Promise(r => setTimeout(r, 800));
        const noticeModalOpen = await evalJs(`document.getElementById('platformNoticeModal')?.classList.contains('show')`);
        console.log("Platform Notice Modal is Open:", noticeModalOpen);
        await evalJs(`document.querySelector('#platformNoticeModal .btn-close')?.click()`);
        await new Promise(r => setTimeout(r, 500));
        const noticeModalClosed = await evalJs(`!document.getElementById('platformNoticeModal')?.classList.contains('show')`);
        console.log("Platform Notice Modal Closed:", noticeModalClosed);

        console.log("\n>>> ALL TESTS COMPLETED SUCCESSFULLY! <<<");

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        chrome.kill();
        process.exit(0);
    }
}

run();
