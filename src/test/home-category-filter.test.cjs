const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = require('node:fs').readFileSync('src/main/resources/static/smartapartment/js/home-services-pricing-admin.js', 'utf8');
const start = source.indexOf('    let _currentFilterType');
const code = source.slice(start, source.indexOf('    function renderAdminCategoryCards()', start));
const keys = ['home-cleaning','packers-movers','painting-waterproofing','rental-legal','electrician-plumber-carpenter','interior-renovation','appliance-repair','pest-control'];
test('category groups hide all unrelated cards and All restores them', () => {
 const classes = () => ({add(){},remove(){}});
 const cards = keys.map(key => ({dataset:{catKey:key,catTitle:key},classList:classes(),hidden:false}));
 const count = {};
 const context = {window:{}, document:{querySelectorAll:selector=>selector.includes('adminCategoryCardsGrid')?cards:[],getElementById:()=>count}};
 vm.createContext(context); vm.runInContext(code, context);
 for (const [group, expected] of [['cleaning',keys.slice(0,3)],['repairs',[keys[4],keys[6],keys[7]]],['legal-interior',[keys[3],keys[5]]],['all',keys]]) {
  context.window.setActiveFilterPill(null,group);
  assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.dataset.catKey),expected);
 }
 context.window.filterAdminCategories('interior');
 assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.dataset.catKey),['interior-renovation']);
});
