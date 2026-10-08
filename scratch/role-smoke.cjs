const base = process.argv[2] || 'http://127.0.0.1:8081';
async function check(role, path) {
    const name = role === 'admin' ? 'admin' : role;
    const login = await fetch(base + '/api/auth/dashboard-login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({platform:'smartapartment',role,username:name+'@smartapartment',password:name+'123'})
    });
    console.log(JSON.stringify({role,check:'login',status:login.status}));
    if (!login.ok) return;
    const Cookie = login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    const response = await fetch(base + path,{headers:{Cookie},redirect:'manual'});
    console.log(JSON.stringify({role,check:path,status:response.status}));
    if (role === 'accountant') {
        for (const path of ['/api/society/bills','/api/society/finance/payments','/api/society/finance/expenses','/api/society/operations/vendors','/api/society/residents']) {
            const data = await fetch(base + path,{headers:{Cookie},redirect:'manual'});
            const payload = await data.json().catch(()=>null);
            console.log(JSON.stringify({role,check:path,status:data.status,isArray:Array.isArray(payload)}));
        }
    }
    if (role === 'accountant' || role === 'resident') {
        // An empty body cannot pass @Valid; this verifies routing and role guards without creating a vendor.
        const validation = await fetch(base + '/api/society/accounting/vendors',{
            method:'POST',headers:{Cookie,'Content-Type':'application/json'},body:'{}'
        });
        // Bean validation runs before method-level authorization, so this is only a validation check.
        console.log(JSON.stringify({role,check:'vendor empty-input validation',status:validation.status,expected:400}));
    }
}
(async()=>{
    for (const [role,path] of [['accountant','accountant'],['resident','resident'],['admin','society-admin'],['security','security'],['maintenance','maintenance'],['superadmin','superadmin']]) {
        await check(role, '/dashboards/'+path);
    }
})().catch(error=>{console.error(error.cause?.code||error.message);process.exitCode=1;});
