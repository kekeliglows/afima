const assert = require('assert');
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'js', 'utils', 'notifications.js');
assert.ok(fs.existsSync(targetPath), 'Le fichier js/utils/notifications.js est manquant.');

const source = fs.readFileSync(targetPath, 'utf8');
assert.ok(source.includes('initNotifBell'), 'Le module doit exposer initNotifBell.');
assert.ok(source.includes('window.Notifications'), 'Le module doit exposer l’objet Notifications.');

console.log('Notifications tests passed');
