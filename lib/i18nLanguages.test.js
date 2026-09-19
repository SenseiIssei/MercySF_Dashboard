// Halten die zehn Sprachdateien zusammen?
//
//     node --test lib/i18nLanguages.test.js
//
// Eine Übersetzung kann auf drei Arten kaputtgehen, und keine davon fällt beim
// Benutzen sofort auf: ein Schlüssel, den es in der Quelle nicht mehr gibt
// (dann ist die Übersetzung tot), ein Platzhalter, der anders heisst (dann
// steht auf der Seite eine Lücke, wo eine Zahl stehen sollte), und eine
// Sprache, die in der Liste fehlt (dann kann sie niemand auswählen).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'public', 'lib', 'i18n');

function parse(datei) {
  const src = fs.readFileSync(path.join(DIR, datei), 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/^\s*'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),/gm)) {
    out.set(m[1], (m[2] ?? m[3] ?? '').replace(/\\'/g, "'"));
  }
  return out;
}

const SPRACHEN = ['en', 'de', 'cs', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh'];
const en = parse('en.js');

test('jede Sprache der Liste hat auch eine Datei', () => {
  const src = fs.readFileSync(path.join(DIR, '..', 'i18n.js'), 'utf8');
  const gelistet = [...src.matchAll(/\{\s*code:\s*'([a-z]{2})'/g)].map(m => m[1]);
  assert.deepEqual(gelistet.sort(), [...SPRACHEN].sort(), 'Liste und Dateien laufen auseinander');
  for (const lang of SPRACHEN) {
    assert.ok(fs.existsSync(path.join(DIR, `${lang}.js`)), `${lang}.js fehlt`);
    assert.match(src, new RegExp(`import ${lang} from './i18n/${lang}\\.js'`), `${lang} wird nicht geladen`);
  }
});

test('keine Sprache übersetzt etwas, das es nicht mehr gibt', () => {
  for (const lang of SPRACHEN) {
    if (lang === 'en') continue;
    const tot = [...parse(`${lang}.js`).keys()].filter(k => !en.has(k));
    assert.deepEqual(tot, [], `${lang}.js übersetzt Schlüssel, die en.js nicht kennt: ${tot.join(', ')}`);
  }
});

test('die Platzhalter sind überall dieselben', () => {
  const namen = s => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort().join(',');
  for (const lang of SPRACHEN) {
    if (lang === 'en') continue;
    for (const [k, v] of parse(`${lang}.js`)) {
      assert.equal(namen(v), namen(en.get(k)), `${lang}.js: ${k} erwartet andere Platzhalter als en.js`);
    }
  }
});

test('was übersetzt ist, ist nicht leer', () => {
  for (const lang of SPRACHEN) {
    for (const [k, v] of parse(`${lang}.js`)) {
      assert.notEqual(v.trim(), '', `${lang}.js: ${k} ist leer, das zeigt eine leere Stelle statt Englisch`);
    }
  }
});

test('keine Seite entscheidet mehr nach "ist es Englisch?"', () => {
  // Bei zwei Sprachen war `getLanguage() === 'en' ? en : de` dasselbe wie
  // "Deutsch oder Englisch". Bei zehn bekommt damit jeder, der weder
  // Deutsch noch Englisch spricht, deutsche Beschriftungen, und Deutsch ist
  // für ihn keine Rückfallsprache.
  const dir = path.join(__dirname, '..', 'public');
  const dateien = [];
  (function sammeln(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) sammeln(p);
      else if (p.endsWith('.js') && !p.includes(path.join('lib', 'i18n'))) dateien.push(p);
    }
  })(dir);
  for (const f of dateien) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(src, /getLanguage\(\)\s*===\s*'en'\s*\?/,
      `${path.relative(dir, f)} fragt "ist es Englisch?" statt "ist es Deutsch?"`);
    assert.doesNotMatch(src, /toLocale\w*\(\s*'de-DE'/,
      `${path.relative(dir, f)} formatiert fest auf Deutsch`);
  }
});
