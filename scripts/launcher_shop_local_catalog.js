'use strict';
// The installed renderer carries only the public catalog. Balances, ownership,
// equipped items and every transaction still come from the authenticated server.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { CATALOG } = require('../server/launcher-profile-shop');
const { releasedCharacterIds } = require('../server/launcher-crew-release');
assert(CATALOG.every(item=>!Object.hasOwn(item,'wallet')&&!Object.hasOwn(item,'owned')&&!Object.hasOwn(item,'equipped')), 'Only public catalog metadata may be embedded.');
assert(CATALOG.filter(item=>item.type==='room_character').every(item=>releasedCharacterIds.includes(item.id)), 'Reserved characters stay excluded until their release flag is enabled.');
const target = path.join(__dirname, '../desktop/launcher-profile-shop.js');
const start = '  // BEGIN GENERATED LOCAL SHOP CATALOG\n';
const end = '  // END GENERATED LOCAL SHOP CATALOG';
const generated = start + '  const LOCAL_SHOP_CATALOG = ' + JSON.stringify(CATALOG) + ';\n' + end;
const text = fs.readFileSync(target, 'utf8');
const match = text.match(/  \/\/ BEGIN GENERATED LOCAL SHOP CATALOG\r?\n[\s\S]*?  \/\/ END GENERATED LOCAL SHOP CATALOG/);
assert(match, 'local catalog generation markers exist');
if (process.argv.includes('--write')) {
  fs.writeFileSync(target, text.replace(match[0], generated));
  console.log('Generated ' + CATALOG.length + ' public catalog items from server authority.');
} else {
  assert.equal(match[0].replace(/\r\n/g, '\n'), generated, 'Local catalog must match current server CATALOG; run with --write.');
  console.log('PASS ' + CATALOG.length + ' exact public catalog items; no wallet or ownership data.');
}
