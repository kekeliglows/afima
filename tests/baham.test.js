const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptPath = path.join(__dirname, '..', 'js', 'utils', 'baham.js');
const source = fs.readFileSync(scriptPath, 'utf8');

const context = {
  window: {},
  console,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  String,
  Array,
};
context.window = context;
context.global = context;
vm.createContext(context);
vm.runInContext(source, context);
const Baham = context.window.Baham;

function setPath(pathname) {
  context.window.location = { pathname };
}

setPath('/html/catalogue.html');
const firstReply = Baham.chat('je veux vendre');
assert.ok(firstReply.toLowerCase().includes('vendre') || firstReply.toLowerCase().includes('produit'));

const followUpReply = Baham.chat('et ensuite ?');
assert.ok(followUpReply.toLowerCase().includes('suite') || followUpReply.toLowerCase().includes('prochaine') || followUpReply.toLowerCase().includes('suivant'));

setPath('/html/panier.html');
const pageReply = Baham.chat('aide');
assert.ok(pageReply.toLowerCase().includes('panier') || pageReply.toLowerCase().includes('commande'));

const dynamicReply = Baham.chat('Je veux savoir comment vérifier mes ventes sur le dashboard');
assert.ok(dynamicReply.toLowerCase().includes('dashboard') || dynamicReply.toLowerCase().includes('ventes') || dynamicReply.toLowerCase().includes('produits'));

console.log('Baham tests passed');
