const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'data', 'panel-settings.json');
const backup = fs.existsSync(FILE_PATH) ? fs.readFileSync(FILE_PATH, 'utf8') : null;
test.after(() => {
  if (backup !== null) fs.writeFileSync(FILE_PATH, backup);
  else fs.rmSync(FILE_PATH, { force: true });
});

const panelSettings = require('./panelSettings');

test('getUiVersion defaults to v1', () => {
  fs.rmSync(FILE_PATH, { force: true });
  assert.equal(panelSettings.getUiVersion(), 'v1');
});

test('setUiVersion persists a valid value and getUiVersion reflects it', () => {
  assert.equal(panelSettings.setUiVersion('v2'), 'v2');
  assert.equal(panelSettings.getUiVersion(), 'v2');
});

test('setUiVersion rejects an unknown value', () => {
  assert.throws(() => panelSettings.setUiVersion('v3'), /Unbekannte UI-Version/);
});
