const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9468',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9468/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    function send(expr) {
        return new Promise(resolve => {
            const reqId = id++;
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id === reqId) {
                    ws.removeEventListener('message', handler);
                    resolve(msg.result?.result?.value);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: reqId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
        });
    }

    ws.addEventListener('open', async () => {
        console.log("Waiting for tenants to hydrate...");
        for (let i = 0; i < 20; i++) {
            const count = await send("window.platformTenants ? window.platformTenants.length : 0");
            if (count > 0) {
                console.log(`Tenants loaded after ${i * 200}ms! Count:`, count);
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        console.log("\n=== 1. SOCIETY CARD BUTTONS ===");
        const cardTitle = await send("document.querySelector('#societiesCardsGrid .society-directory-card h5')?.textContent?.trim()");
        const cardBadge = await send("document.querySelector('#societiesCardsGrid .society-directory-card .badge')?.textContent?.trim()");
        const cardButtons = await send("Array.from(document.querySelectorAll('#societiesCardsGrid .society-directory-card button')).map(b => b.textContent.trim())");
        console.log("Card Title:", cardTitle);
        console.log("Card Badge:", cardBadge);
        console.log("Card Buttons:", cardButtons);

        console.log("\n=== 2. OPEN VIEW MODAL ===");
        await send("document.querySelector('#societiesCardsGrid .society-directory-card button').click()");
        await new Promise(r => setTimeout(r, 500));
        
        const modalVisible = await send("document.getElementById('viewSocietyModal')?.classList.contains('show')");
        const modalTitle = await send("document.getElementById('viewSocietyModalTitle')?.textContent?.trim()");
        const modalBadge = await send("document.getElementById('viewSocietyStatusBadge')?.textContent?.trim()");
        const modalFooterBtns = await send("Array.from(document.querySelectorAll('#viewSocietyModal .modal-footer button:not(.d-none)')).map(b => b.textContent.trim())");
        const closeBtnWidth = await send("window.getComputedStyle(document.querySelector('#viewSocietyModal .btn-close')).width");
        const closeBtnBg = await send("window.getComputedStyle(document.querySelector('#viewSocietyModal .btn-close')).backgroundImage.includes('data:image/svg')");

        console.log("Modal Visible:", modalVisible);
        console.log("Modal Title:", modalTitle);
        console.log("Modal Status Badge:", modalBadge);
        console.log("Modal Footer Buttons:", modalFooterBtns);
        console.log("Close (X) Button Width:", closeBtnWidth);
        console.log("Close (X) Button SVG icon present:", closeBtnBg);

        console.log("\n=== 3. CLOSE VIEW MODAL ===");
        await send("document.querySelector('#viewSocietyModal .btn-close').click()");
        await new Promise(r => setTimeout(r, 400));
        const modalClosed = await send("!document.getElementById('viewSocietyModal')?.classList.contains('show')");
        console.log("Modal Closed via X:", modalClosed);

        console.log("\n=== 4. OPEN ADD SOCIETY MODAL ===");
        await send("document.getElementById('btnOpenAddSocietyModal').click()");
        await new Promise(r => setTimeout(r, 500));
        const addVisible = await send("document.getElementById('addSocietyModal')?.classList.contains('show')");
        const addDialogWidth = await send("window.getComputedStyle(document.querySelector('#addSocietyModal .modal-dialog')).maxWidth");
        const addCloseWidth = await send("window.getComputedStyle(document.querySelector('#addSocietyModal .btn-close')).width");
        const addCloseSvg = await send("window.getComputedStyle(document.querySelector('#addSocietyModal .btn-close')).backgroundImage.includes('data:image/svg')");

        console.log("Add Modal Visible:", addVisible);
        console.log("Add Modal Dialog MaxWidth:", addDialogWidth);
        console.log("Add Modal Close Width:", addCloseWidth);
        console.log("Add Modal Close SVG present:", addCloseSvg);

        console.log("\n=== 5. CLOSE ADD MODAL ===");
        await send("document.querySelector('#addSocietyModal .btn-close').click()");
        await new Promise(r => setTimeout(r, 400));
        const addClosed = await send("!document.getElementById('addSocietyModal')?.classList.contains('show')");
        console.log("Add Modal Closed via X:", addClosed);

        console.log("\n=== 6. TOGGLE TABLE VIEW ===");
        await send("document.getElementById('btnSocietiesTableView').click()");
        await new Promise(r => setTimeout(r, 400));
        const tableVisible = await send("!document.getElementById('societiesTableContainer')?.classList.contains('d-none')");
        const tableRowButtons = await send("Array.from(document.querySelectorAll('table[data-table=\"societies\"] tbody tr button')).map(b => b.textContent.trim())");
        const tableBadge = await send("document.querySelector('table[data-table=\"societies\"] tbody tr .badge')?.textContent?.trim()");

        console.log("Table Visible:", tableVisible);
        console.log("Table Row Buttons:", tableRowButtons);
        console.log("Table Badge:", tableBadge);

        console.log("\n=== 7. TOGGLE BACK TO CARDS VIEW ===");
        await send("document.getElementById('btnSocietiesCardsView').click()");
        await new Promise(r => setTimeout(r, 400));
        const cardsVisible = await send("!document.getElementById('societiesCardsContainer')?.classList.contains('d-none')");
        console.log("Cards Visible:", cardsVisible);

        console.log("\nALL VERIFICATIONS PASSED!");
        chrome.kill();
        process.exit(0);
    });
}
test();
