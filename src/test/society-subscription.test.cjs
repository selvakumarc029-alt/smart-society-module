const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/main/resources/static/smartapartment/js/dashboard.js', 'utf8');
const start = source.indexOf('function renderSocietySubscription(');
const nextFunction = source.slice(start + 1).search(/\n(?:async )?function /);
const render = source.slice(start, start + 1 + nextFunction);
function run(data) {
  const nodes = new Map();
  const context = {document: {getElementById: id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); }, querySelector: () => null}};
  vm.createContext(context); vm.runInContext(render, context); context.renderSocietySubscription(data);
  return nodes;
}
test('assigned plan displays both dates without an expiry warning', () => {
  const nodes = run({planName: 'Diamond', status: 'ACTIVE', startedOn: '2026-10-07', renewsOn: '2026-11-07', expiryState: 'CURRENT'});
  assert.match(nodes.get('saasStartDate').textContent, /07.*Oct.*2026/);
  assert.match(nodes.get('saasEndDate').textContent, /07.*Nov.*2026/);
  assert.equal(nodes.get('saasExpiryNotice').hidden, true);
});
test('expiring plan shows remaining days and superadmin alert', () => {
  const nodes = run({status: 'ACTIVE', renewsOn: '2026-10-12', expiryState: 'EXPIRING', daysRemaining: 3});
  assert.equal(nodes.get('saasExpiryNotice').hidden, false);
  assert.match(nodes.get('saasExpiryNotice').textContent, /3 days remaining.*superadmin/);
});
test('expired plan cannot appear active and missing dates are explicit', () => {
  const nodes = run({status: 'ACTIVE', expiryState: 'EXPIRED'});
  assert.equal(nodes.get('saasPlanStatus').textContent, 'Expired');
  assert.equal(nodes.get('saasHeroStatus').textContent, 'Subscription expired');
  assert.equal(nodes.get('saasStartDate').textContent, 'Not recorded');
  assert.equal(nodes.get('saasEndDate').textContent, 'Not scheduled');
});
