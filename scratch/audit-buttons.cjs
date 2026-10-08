const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const templates = path.join(root, 'src/main/resources/templates');
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const js = files(path.join(root,'src/main/resources/static')).filter(f=>f.endsWith('.js')&&!f.includes('propertydirect'));
const sources = js.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const report=[];
for(const file of files(templates).filter(f=>f.endsWith('.html')&&!f.includes('propertydirect'))) {
 const source=fs.readFileSync(file,'utf8');
 const code=sources+'\n'+[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
 const buttons=[...source.matchAll(/<button\b([^>]*?)>([\s\S]*?)<\/button>/gi)];
 const rows=buttons.map(m=>{
  const attrs=Object.fromEntries([...m[1].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(a=>[a[1],a[3]]));
  const label=m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const calls=[...(attrs.onclick||'').matchAll(/(?:window\.)?\b([\w$]+)\s*\(/g)].map(c=>c[1]).filter(c=>!['if','getElementById','querySelector','closest','print','open','confirm','alert','reload','includes','getAttribute','setAttribute','add','remove','toggle'].includes(c));
  const missing=calls.filter(name=>!new RegExp('(?:function\\s+'+name+'\\b|(?:window\\.)?'+name+'\\s*=|(?:const|let|var)\\s+'+name+'\\b)').test(code));
  const idMention=attrs.id && code.includes(attrs.id);
  const contract=Object.keys(attrs).some(k=>k.startsWith('data-'))||attrs.onclick||idMention||attrs.type==='submit'||attrs.type==='reset';
  return {line:source.slice(0,m.index).split('\n').length,label,attrs,missing,unwired:!contract};
 });
 report.push({file:path.relative(root,file),count:rows.length,missing:rows.filter(r=>r.missing.length),unwired:rows.filter(r=>r.unwired)});
}
fs.writeFileSync(path.join(__dirname,'button-audit.json'),JSON.stringify(report,null,2));
for(const r of report.filter(r=>r.count)) console.log(JSON.stringify(r));
