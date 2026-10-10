(function(root){
    'use strict';
    function install(win){
        const original=win.fetch.bind(win);
        win.fetch=function(input,options={}){
            const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,win.location.href);
            const body=win.document.body;
            const society=body?.dataset.platform==='smartapartment';
            let token=null,role=null;
            try {token=win.sessionStorage.getItem('society_dashboard_token');role=win.sessionStorage.getItem('society_dashboard_role');}catch(_){}
            if(society&&token&&role===body.dataset.dashboardRole&&url.origin===win.location.origin&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/property')){
                const headers=new Headers(options.headers??(typeof input==='object'?input.headers:undefined));
                if(!headers.has('Authorization'))headers.set('Authorization','Bearer '+token);
                return original(input,{...options,headers});
            }
            return original(input,options);
        };
        win.document.addEventListener('click',event=>{
            if(!event.target.closest?.('a[href="/dashboards/logout"]'))return;
            for(const key of ['society_dashboard_token','society_dashboard_role','society_superadmin_token'])try{win.sessionStorage.removeItem(key);}catch(_){}
        });
    }
    if(typeof module!=='undefined'&&module.exports){module.exports={install};return;}
    install(root);
})(typeof window==='undefined'?globalThis:window);
