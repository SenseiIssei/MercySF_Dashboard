// Ist ein Rückschritt ein Update?
//
//     node --test lib/version.test.js
//
// Er war einer. Die Prüfung verglich Prüfsummen, und eine andere Datei hiess
// "Update verfügbar". Eine selbst gebaute 2.24.1 sah damit aus wie etwas
// Veraltetes, und ein Klick setzte die Installation auf die veröffentlichte
// 2.24.0 zurück. Danach fehlten drei Befehle, die das Dashboard aufruft, auf
// der Seite stand "CLI zu alt", und das war sogar richtig.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseVersion, compareVersions, isUpgrade } = require('./version');

test('Versionen werden der Reihe nach verglichen, nicht als Text', () => {
  // Als Text wäre "2.24.9" grösser als "2.24.10", und genau an so einer
  // Stelle fällt es erst in einem halben Jahr auf.
  assert.equal(compareVersions('2.24.9', '2.24.10'), -1);
  assert.equal(compareVersions('2.24.10', '2.24.9'), 1);
  assert.equal(compareVersions('2.24.1', '2.24.1'), 0);
  assert.equal(compareVersions('3.0.0', '2.99.99'), 1);
  assert.equal(compareVersions('v2.24.1', '2.24.1'), 0);
});

test('was keine Version ist, gibt null statt einer Behauptung', () => {
  assert.equal(compareVersions('', '2.24.1'), null);
  assert.equal(compareVersions('irgendwas', '2.24.1'), null);
  assert.equal(compareVersions('2.24.1', null), null);
  assert.equal(parseVersion('2.24'), null);
  assert.deepEqual(parseVersion('2.24.1-rc1'), [2, 24, 1]);
});

test('nur vorwärts ist ein Update', () => {
  assert.equal(isUpgrade('2.24.0', '2.24.1'), true);
  assert.equal(isUpgrade('2.24.1', '2.24.0'), false, 'das ist der Fall, um den es geht');
  assert.equal(isUpgrade('2.24.1', '2.24.1'), false);
});

test('bei unbekannter Version entscheidet weiter die Prüfsumme', () => {
  // Ein Rückfall auf das alte Verhalten, nicht auf ein Verbot: eine CLI, die
  // ihre Version nicht sagt, soll ein echtes Update nicht verstecken.
  assert.equal(isUpgrade(null, '2.24.1'), null);
  assert.equal(isUpgrade('2.24.1', null), null);
});

test('die Prüfung benutzt das auch', () => {
  // Ohne das hier wäre version.js ein Modul, das niemand aufruft, und der
  // Test darüber eine Zusage über nichts.
  const src = fs.readFileSync(path.join(__dirname, 'cliUpdate.js'), 'utf8');
  assert.match(src, /require\('\.\/version'\)/);
  assert.match(src, /isUpgrade\(current, offered\)/);
  assert.match(src, /state\.updateAvailable = currentHash !== null/);
  // Und die Version der angebotenen Datei wird wirklich gelesen, nicht geraten.
  assert.match(src, /versionOf\(tmpPath\)/);
});
