// Werden die Platzhalter in den Texten überhaupt ersetzt?
//
//     node --test lib/i18nPlaceholders.test.js
//
// `t()` ersetzt `{{name}}`, nicht `{name}`. Wer die einfache Schreibweise
// nimmt, bekommt keinen Fehler, sondern den Platzhalter als Text: auf der
// Übersicht stand "aktiv, Bundle {version}" und "{kind}, aus {samples}
// Kämpfen". Auf dem Bildschirm sieht das aus, als sei die Seite kaputt, und
// im Code sieht es richtig aus.
//
// Der Test prüft beides: die Schreibweise in den Wörterbüchern, und dass jeder
// Platzhalter, den ein Text erwartet, beim Aufruf auch mitgegeben wird.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I18N_DIR = path.join(__dirname, '..', 'public', 'lib', 'i18n');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function eintraege(datei) {
  const src = fs.readFileSync(path.join(I18N_DIR, datei), 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/^\s*'([^']+)':\s*(?:'([^']*)'|"([^"]*)"),/gm)) {
    out.set(m[1], m[2] ?? m[3] ?? '');
  }
  return out;
}

const EINFACH = /(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/;

for (const datei of ['de.js', 'en.js']) {
  test(`${datei} benutzt überall die doppelte Schreibweise`, () => {
    const schlecht = [];
    for (const [k, v] of eintraege(datei)) {
      if (EINFACH.test(v)) schlecht.push(`${k}: ${v}`);
    }
    assert.deepEqual(schlecht, [], `diese Texte zeigen ihren Platzhalter statt eines Werts:\n  ${schlecht.join('\n  ')}`);
  });
}

test('beide Sprachen erwarten dieselben Platzhalter', () => {
  // Ein Text, der auf Deutsch {{count}} hat und auf Englisch nicht, zeigt in
  // einer der beiden Sprachen eine Lücke, wo eine Zahl stehen sollte.
  const de = eintraege('de.js');
  const en = eintraege('en.js');
  const namen = v => [...v.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)].map(m => m[1]).sort();
  for (const [k, v] of de) {
    if (!en.has(k)) continue;
    assert.deepEqual(namen(v), namen(en.get(k)), `${k} erwartet in den beiden Sprachen Verschiedenes`);
  }
});

test('was ein Text erwartet, gibt der Aufruf auch mit', () => {
  // Nur die Aufrufe, bei denen Schlüssel und Werte beide im Quelltext stehen.
  // Alles andere lässt sich von außen nicht entscheiden.
  const de = eintraege('de.js');
  const dateien = [];
  (function sammeln(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) sammeln(p);
      else if (p.endsWith('.js') && !p.includes(path.join('lib', 'i18n'))) dateien.push(p);
    }
  })(PUBLIC_DIR);

  const fehler = [];
  for (const f of dateien) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'\s*,\s*\{([^}]*)\}\s*\)/g)) {
      const [, key, argumente] = m;
      if (!de.has(key)) continue;
      const erwartet = [...de.get(key).matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)].map(x => x[1]);
      for (const name of erwartet) {
        // Auch die Kurzschreibweise zählt: `{ secs }` übergibt `secs`.
        if (!new RegExp(`(^|[\\s,{])${name}\\s*(:|,|$)`).test(argumente.trim())) {
          fehler.push(`${path.relative(PUBLIC_DIR, f)}: t('${key}') erwartet {{${name}}}, bekommt es aber nicht`);
        }
      }
    }
  }
  assert.deepEqual(fehler, [], fehler.join('\n'));
});

test('die Modell-Karte sagt den Grund selbst, statt den Satz der CLI durchzureichen', () => {
  // Der Satz der CLI ist englisch. Stand er auf der Seite, war die halbe Karte
  // deutsch und die andere Hälfte nicht.
  const src = fs.readFileSync(path.join(PUBLIC_DIR, 'pages', 'overview.js'), 'utf8');
  assert.match(src, /function nextSentence\(m\)/);
  assert.doesNotMatch(src, /next\.textContent = m\.next \|\| ''/);
  const de = eintraege('de.js');
  for (const k of ['models.nextNoLicence', 'models.nextNoSupporter', 'models.nextNoBundle', 'models.nextHere']) {
    assert.ok(de.has(k), `${k} fehlt`);
  }
});
