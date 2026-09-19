// Kann man die Seiten, die man vor der Anmeldung sieht, überhaupt ansehen?
//
//     node --test lib/publicPaths.test.js
//
// `/style.css` fehlte in der Liste. Eine Anfrage danach lief in die
// Weiterleitung auf die Anmeldung, der Browser bekam HTML statt CSS, und damit
// war keine Farbe, keine Schrift und kein Rahmen definiert: unsichtbare
// Eingabefelder, ein leerer Knopf, ein Kästchen statt des Symbols.
//
// Nichts daran schlug fehl. Der Server antwortete mit 302, der Browser folgte,
// und wer sich einmal angemeldet hatte, hatte die Datei im Zwischenspeicher und
// sah nie etwas davon. Kaputt war die Seite ausschließlich für den, der sie zum
// ersten Mal sieht, also für jeden neuen Benutzer.
//
// Deshalb steht hier kein Test auf eine Liste von Pfaden, sondern ein
// Abgleich: was die beiden Seiten laden, muss durchgelassen werden.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { isPublicPath, PUBLIC_PAGE_PATHS } = require('./publicPaths');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SEITEN = ['setup.html', 'login.html'];

// Alles, was die Seite von diesem Server lädt. Fremde Adressen (Schriften von
// Google) gehen nicht durch diesen Server und stehen deshalb nicht zur Debatte.
function eigeneVerweise(html) {
  const treffer = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map(m => m[1]);
  return [...new Set(treffer)];
}

for (const datei of SEITEN) {
  test(`${datei} kann alles laden, was sie lädt`, () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, datei), 'utf8');
    const verweise = eigeneVerweise(html);
    assert.ok(verweise.length > 0, `${datei} lädt nichts von diesem Server, das ist unplausibel`);
    for (const v of verweise) {
      assert.ok(isPublicPath(v), `${datei} lädt ${v}, aber das landet in der Weiterleitung auf die Anmeldung`);
    }
  });

  test(`${datei} existiert und ist selbst öffentlich`, () => {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, datei)), `${datei} fehlt`);
    assert.ok(isPublicPath(`/${datei}`), `/${datei} ist nicht öffentlich, dann sieht sie niemand`);
  });
}

test('das Stylesheet ist öffentlich und liegt auch da', () => {
  // Der Fall, um den es ging. Beides zusammen, weil ein Eintrag in der Liste
  // für eine Datei, die es nicht gibt, genauso aussieht.
  assert.ok(PUBLIC_PAGE_PATHS.has('/style.css'));
  assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'style.css')));
});

test('die Liste bleibt eine Liste und wird kein Scheunentor', () => {
  // Der billige Weg, den Fehler oben zu beheben, wäre ein Präfix gewesen, das
  // alles Statische durchlässt. Dann hinge die Frage, ob eine neue Datei
  // Daten enthält, an dem, der sie anlegt.
  for (const p of ['/', '/index.html', '/api/accounts', '/api/models', '/v2/index.html']) {
    assert.equal(isPublicPath(p), false, `${p} darf ohne Anmeldung nicht durchgehen`);
  }
});

test('der Server benutzt genau diese Liste', () => {
  // Ohne das hier könnte server.js seine eigene Kopie führen, und der Test
  // oben prüfte eine Liste, nach der niemand fragt.
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /require\('\.\/lib\/publicPaths'\)/);
  assert.match(src, /isPublicPath\(req\.path\)/);
  assert.doesNotMatch(src, /const PUBLIC_PAGE_PATHS = new Set/);
});
