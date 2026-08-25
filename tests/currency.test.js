const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptPath = path.join(__dirname, '..', 'js', 'utils', 'currency.js');
const source = fs.readFileSync(scriptPath, 'utf8');

const context = {
  window: {},
  console,
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] ?? null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; }
  },
  navigator: { language: 'fr-FR' },
  Intl,
  Math,
  Number,
  String,
  Date
};
context.window = context;
context.global = context;
vm.createContext(context);
vm.runInContext(source, context);
const Currency = context.window.Currency;

assert.strictEqual(Currency.convertPrice(100, 'EUR', 'EUR'), 100);
assert.strictEqual(Currency.convertPrice(100, 'EUR', 'XOF'), 65596);
assert.ok(Math.abs(Currency.convertPrice(100, 'XOF', 'EUR') - 0.15) < 0.01);
assert.strictEqual(Currency.getProductCurrencyCode({ price_currency: 'USD' }), 'USD');

console.log('Currency tests passed');
