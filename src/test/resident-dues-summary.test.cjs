const test = require('node:test');
const assert = require('node:assert/strict');
const summary = require('../main/resources/static/smartapartment/js/resident-dues-summary.js');
test('dues total includes all outstanding invoices and excludes paid or cancelled invoices', () => {
  const result = summary([{totalAmount:2500,paymentStatus:'UNPAID',dueDate:'2026-09-15'}, {totalAmount:3600,paymentStatus:'OVERDUE',dueDate:'2026-08-25'}, {totalAmount:900,paymentStatus:'PAID'}, {totalAmount:400,paymentStatus:'CANCELLED'}]);
  assert.equal(result.amount,6100); assert.equal(result.count,2); assert.equal(result.dueDate,'2026-08-25');
});
test('empty invoice list is zero; failed loading is unavailable', () => {
  assert.equal(summary([]).amount,0); assert.equal(summary(null),null);
});