const { spawn } = require('child_process');
const http = require('http');

async function verifyContactsLayout() {
    console.log('Testing customer dashboard contacts view layout...');
    const port = Math.floor(9200 + Math.random() * 500);
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1440,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/propertydirect/dashboards/customer#contacts'
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

        await new Promise(r => setTimeout(r, 1000));

        const layoutCheck = await send('Runtime.evaluate', {
            expression: `(function() {
                const panel = document.querySelector('[data-view="contacts"]');
                const card = panel?.querySelector('.dash-card');
                const cardHead = card?.querySelector('.card-head');
                const title = cardHead?.querySelector('h3');
                const badge = cardHead?.querySelector('.inline-state');
                const form = document.getElementById('ownerContactForm');
                const sections = form?.querySelectorAll('.property-form-section');
                const inputs = form?.querySelectorAll('input, select, textarea');
                const submitBtn = form?.querySelector('button[type="submit"]');

                const cardHeadRect = cardHead?.getBoundingClientRect();
                const formRect = form?.getBoundingClientRect();
                const titleRect = title?.getBoundingClientRect();
                const badgeRect = badge?.getBoundingClientRect();
                const btnRect = submitBtn?.getBoundingClientRect();

                return {
                    panelVisible: panel && !panel.classList.contains('hidden') && window.getComputedStyle(panel).display !== 'none',
                    cardWidth: cardRect => card?.getBoundingClientRect().width,
                    cardHead: {
                        top: cardHeadRect?.top,
                        bottom: cardHeadRect?.bottom,
                        height: cardHeadRect?.height
                    },
                    title: {
                        text: title?.textContent,
                        top: titleRect?.top,
                        left: titleRect?.left
                    },
                    badge: {
                        text: badge?.textContent,
                        top: badgeRect?.top,
                        right: badgeRect?.right
                    },
                    form: {
                        top: formRect?.top,
                        width: formRect?.width,
                        isBelowCardHead: formRect?.top >= (cardHeadRect?.bottom || 0)
                    },
                    sectionsCount: sections?.length,
                    inputsCount: inputs?.length,
                    submitBtnTop: btnRect?.top,
                    submitBtnWidth: btnRect?.width
                };
            })()`,
            returnByValue: true
        });

        console.log('Layout Verification Result:');
        console.log(JSON.stringify(layoutCheck.result.value, null, 2));

        const r = layoutCheck.result.value;
        if (r.form.isBelowCardHead) {
            console.log('✅ PASS: Form is cleanly positioned BELOW the card-head (NO overlapping)!');
        } else {
            console.error('❌ FAIL: Form is still overlapping with card-head!');
        }

        ws.close();
    } finally {
        chrome.kill();
    }
}

verifyContactsLayout().catch(console.error);
