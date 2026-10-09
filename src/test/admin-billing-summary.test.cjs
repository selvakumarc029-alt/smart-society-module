const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/main/resources/static/smartapartment/js/dashboard.js', 'utf8');
const extract = name => source.slice(source.indexOf(`function ${name}(`), source.indexOf('\nfunction ', source.indexOf(`function ${name}(`) + 1));
test('billing totals distinguish unpaid invoices and retain currency decimals', () => {
  const rows = [['Rs. 2,500.50', 'UNPAID'], ['Rs. 600.25', 'PAID'], ['₹100.00', 'PENDING']].map(([amount, status]) => ({children: [{}, {}, {textContent: amount}], querySelector: () => ({textContent: status})}));
  const values = [{}, {}, {}];
  const view = {querySelectorAll: selector => selector === '.billing-stats strong' ? values : rows};
  const context = {document: {querySelector: () => view}};
  vm.createContext(context);
  vm.runInContext(['moneyNumber', 'formatRs', 'updateBillingStats'].map(extract).join('\n'), context);
  context.updateBillingStats();
  assert.equal(values[0].textContent, 'Rs. 3,200.75');
  assert.equal(values[1].textContent, 'Rs. 600.25');
  assert.equal(values[2].textContent, 'Rs. 2,600.5');
});
