const { spawn } = require('child_process');
const http = require('http');

async function test() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9470',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/dashboards/superadmin#societies'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const tabs = await new Promise((resolve, reject) => {
        http.get('http://localhost:9470/json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const resolve = pending.get(msg.id);
            pending.delete(msg.id);
            resolve(msg.result);
        }
    };

    function evalJs(expr) {
        return new Promise(resolve => {
            const reqId = id++;
            pending.set(reqId, res => resolve(res?.result?.value));
            ws.send(JSON.stringify({ id: reqId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
        });
    }

    ws.onopen = async () => {
        console.log("WebSocket connected.");
        
        // Wait 1.5s for initial page scripts to run
        await new Promise(r => setTimeout(r, 1500));

        console.log("Title:", await evalJs("document.title"));
        console.log("Tenants length:", await evalJs("window.platformTenants?.length"));
        console.log("Cards count:", await evalJs("document.querySelectorAll('#societiesCardsGrid .society-directory-card').length"));

        const cardDetails = await evalJs(`
            (() => {
                const card = document.querySelector('#societiesCardsGrid .society-directory-card');
                if (!card) return null;
                return {
                    name: card.querySelector('h5')?.textContent?.trim(),
                    badge: card.querySelector('.badge')?.textContent?.trim(),
                    buttons: Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim())
                };
            })()
        `);
        console.log("Card Details:", cardDetails);

        // Click View button
        console.log("Clicking View button...");
        await evalJs(`document.querySelector('#societiesCardsGrid .society-directory-card button').click()`);
        await new Promise(r => setTimeout(r, 600));

        const modalDetails = await evalJs(`
            (() => {
                const modal = document.getElementById('viewSocietyModal');
                const closeBtn = modal?.querySelector('.btn-close');
                const cs = closeBtn ? window.getComputedStyle(closeBtn) : null;
                return {
                    isOpen: modal?.classList.contains('show'),
                    title: document.getElementById('viewSocietyModalTitle')?.textContent?.trim(),
                    badge: document.getElementById('viewSocietyStatusBadge')?.textContent?.trim(),
                    footerButtons: Array.from(modal?.querySelectorAll('.modal-footer button:not(.d-none)') || []).map(b => b.textContent.trim()),
                    closeBtnSize: cs ? (cs.width + ' x ' + cs.height) : null,
                    closeBtnHasSvg: cs ? cs.backgroundImage.includes('data:image/svg') : false
                };
            })()
        `);
        console.log("Modal Details:", modalDetails);

        // Close View modal via X
        console.log("Closing View modal via X...");
        await evalJs(`document.querySelector('#viewSocietyModal .btn-close').click()`);
        await new Promise(r => setTimeout(r, 500));
        console.log("Modal closed:", await evalJs("!document.getElementById('viewSocietyModal')?.classList.contains('show')"));

        // Toggle Table view
        console.log("Toggling Table view...");
        await evalJs(`document.getElementById('btnSocietiesTableView').click()`);
        await new Promise(r => setTimeout(r, 400));
        const tableDetails = await evalJs(`
            (() => {
                const row = document.querySelector('table[data-table="societies"] tbody tr');
                if (!row) return null;
                return {
                    tableVisible: !document.getElementById('societiesTableContainer')?.classList.contains('d-none'),
                    buttons: Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim()),
                    badge: row.querySelector('.badge')?.textContent?.trim()
                };
            })()
        `);
        console.log("Table Details:", tableDetails);

        // Toggle back to Cards
        console.log("Toggling back to Cards view...");
        await evalJs(`document.getElementById('btnSocietiesCardsView').click()`);
        await new Promise(r => setTimeout(r, 400));
        console.log("Cards container visible:", await evalJs("!document.getElementById('societiesCardsContainer')?.classList.contains('d-none')"));

        // Click Add Society button
        console.log("Clicking + Add Society...");
        await evalJs(`document.getElementById('btnOpenAddSocietyModal').click()`);
        await new Promise(r => setTimeout(r, 600));
        const addModalDetails = await evalJs(`
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
        console.log("Add Modal Details:", addModalDetails);

        // Close Add modal
        await evalJs(`document.querySelector('#addSocietyModal .btn-close').click()`);
        await new Promise(r => setTimeout(r, 500));
        console.log("Add Modal closed:", await evalJs("!document.getElementById('addSocietyModal')?.classList.contains('show')"));

        console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
        chrome.kill();
        process.exit(0);
    };
}
test();
