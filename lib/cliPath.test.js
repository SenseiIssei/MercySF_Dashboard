// Ruft und ersetzt jeder dieselbe Datei?
//
//     node --test lib/cliPath.test.js
//
// Der Pfad zur CLI stand an vier Stellen als Buchstabenfolge. Solange alle vier
// gleich lauten, merkt niemand etwas. Weichen sie ab, überschreibt das Update
// die eine Datei, während das Dashboard weiter die andere startet, und die
// Versionsnummer im Fenster gehört zu einer Binärdatei, die niemand aufruft.
//
// Deshalb steht hier kein Test auf den Pfad selbst, sondern auf die Anzahl der
// Stellen, an denen er entstehen kann: eine.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LIB = __dirname;
const QUELLE = 'cliPath.js';

// `data.js` nennt /opt/mercy/data als einen von mehreren Orten, an denen Daten
// liegen können. Das ist kein CLI-Pfad und gehört nicht hierher.
const AUSGENOMMEN = new Set([QUELLE, 'data.js']);

function dateien() {
  return fs.readdirSync(LIB).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
}

test('den Pfad zur CLI schreibt genau eine Datei aus', () => {
  const schuldige = [];
  for (const f of dateien()) {
    if (AUSGENOMMEN.has(f)) continue;
    const src = fs.readFileSync(path.join(LIB, f), 'utf8');
    // Nur Code, keine Kommentare: in einem Kommentar darf der Pfad stehen,
    // dort ruft ihn niemand auf.
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/mercy-cli-linux-x64/.test(code) || /cwd:\s*'\/opt\/mercy'/.test(code)) schuldige.push(f);
  }
  assert.deepEqual(schuldige, [], `diese Dateien verdrahten den CLI-Pfad selbst: ${schuldige.join(', ')}`);
});

test('wer die CLI startet, nimmt sie aus cliPath', () => {
  // Die vier, um die es geht. Kommt eine fünfte dazu, die die CLI startet, und
  // sie holt den Pfad woanders her, schlägt der Test darüber an.
  for (const f of ['cliExec.js', 'cliUpdate.js', 'ptyManager.js', 'discoveryLogin.js']) {
    const src = fs.readFileSync(path.join(LIB, f), 'utf8');
    assert.match(src, /require\('\.\/cliPath'\)/, `${f} holt den Pfad nicht aus cliPath`);
  }
});

test('ohne Umgebungsvariablen bleibt es die Standard-Installation', () => {
  // Der Sinn der Variablen ist ein Test gegen eine zweite Installation, nicht
  // eine Änderung für alle anderen. Wer nichts setzt, bekommt genau das, was
  // vorher hier stand.
  const alt = { p: process.env.MERCY_CLI_PATH, c: process.env.MERCY_CLI_CWD };
  delete process.env.MERCY_CLI_PATH;
  delete process.env.MERCY_CLI_CWD;
  delete require.cache[require.resolve('./cliPath')];
  try {
    const { CLI_PATH, CWD } = require('./cliPath');
    assert.equal(CLI_PATH, '/opt/mercy/mercy-cli-linux-x64');
    assert.equal(CWD, '/opt/mercy');
  } finally {
    if (alt.p !== undefined) process.env.MERCY_CLI_PATH = alt.p;
    if (alt.c !== undefined) process.env.MERCY_CLI_CWD = alt.c;
    delete require.cache[require.resolve('./cliPath')];
  }
});

test('gesetzte Umgebungsvariablen gelten', () => {
  const alt = { p: process.env.MERCY_CLI_PATH, c: process.env.MERCY_CLI_CWD };
  process.env.MERCY_CLI_PATH = '/tmp/woanders/mercy-cli';
  process.env.MERCY_CLI_CWD = '/tmp/woanders';
  delete require.cache[require.resolve('./cliPath')];
  try {
    const { CLI_PATH, CWD } = require('./cliPath');
    assert.equal(CLI_PATH, '/tmp/woanders/mercy-cli');
    assert.equal(CWD, '/tmp/woanders');
  } finally {
    if (alt.p === undefined) delete process.env.MERCY_CLI_PATH; else process.env.MERCY_CLI_PATH = alt.p;
    if (alt.c === undefined) delete process.env.MERCY_CLI_CWD; else process.env.MERCY_CLI_CWD = alt.c;
    delete require.cache[require.resolve('./cliPath')];
  }
});

test('die Bindeadresse ist einstellbar und bleibt sonst, wie sie war', () => {
  // `HOST=127.0.0.1` ist der Unterschied zwischen "nur über einen SSH-Tunnel
  // erreichbar" und "aus dem Netz erreichbar". Ein Test darauf, weil ein
  // zurückgedrehtes `'0.0.0.0'` im listen-Aufruf sonst nichts kaputt macht,
  // was auffiele: die Seite läuft ja.
  const src = fs.readFileSync(path.join(LIB, '..', 'server.js'), 'utf8');
  assert.match(src, /const HOST = process\.env\.HOST \|\| '0\.0\.0\.0'/);
  assert.match(src, /httpServer\.listen\(PORT, HOST,/);
  assert.doesNotMatch(src, /listen\(PORT, '0\.0\.0\.0'/);
});
