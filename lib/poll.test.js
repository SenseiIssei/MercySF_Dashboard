// Ruht der Takt, wenn niemand hinschaut?
//
//     node --test lib/poll.test.js
//
// Die Seite fragte alle fünf Sekunden nach, auch wenn der Tab im Hintergrund
// lag. Das kostet an beiden Enden, und auf einem schwachen Gerät ist es der
// Unterschied zwischen "läuft nebenbei" und "der Lüfter geht an".
//
// Der Test prüft zwei Dinge: das Modul selbst, in einem nachgebauten Dokument,
// und dass keine Seite wieder an `setInterval` vorbei taktet. Das zweite ist
// das wichtigere: eine vergessene Stelle sieht im Code völlig richtig aus.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');

/** Das Modul einmal ausführen, mit einem Dokument, das wir steuern. */
async function ladePoll(dokument) {
  const quelle = fs.readFileSync(path.join(PUBLIC, 'lib', 'poll.js'), 'utf8')
    .replace(/^export /gm, '');
  const fabrik = new Function('document', 'setInterval', 'clearInterval', 'console',
    `${quelle}; return { pollWhileVisible };`);
  return fabrik(dokument, dokument.__setInterval, dokument.__clearInterval, console);
}

function nachgebautesDokument({ hidden = false } = {}) {
  const hoerer = new Map();
  let laufend = 0;
  const timers = new Map();
  let id = 0;
  return {
    hidden,
    addEventListener: (typ, fn) => hoerer.set(typ, fn),
    removeEventListener: typ => hoerer.delete(typ),
    __feuern: typ => hoerer.get(typ) && hoerer.get(typ)(),
    __setInterval: (fn, ms) => { id += 1; timers.set(id, { fn, ms }); laufend += 1; return id; },
    __clearInterval: t => { if (timers.delete(t)) laufend -= 1; },
    get __laufend() { return laufend; },
    __ticken: () => [...timers.values()].forEach(t => t.fn()),
  };
}

test('sichtbar: der Takt läuft', async () => {
  const doc = nachgebautesDokument({ hidden: false });
  const { pollWhileVisible } = await ladePoll(doc);
  let n = 0;
  pollWhileVisible(() => { n += 1; }, 5000);
  assert.equal(doc.__laufend, 1);
  doc.__ticken();
  assert.equal(n, 1);
});

test('versteckt: gar kein Takt', async () => {
  const doc = nachgebautesDokument({ hidden: true });
  const { pollWhileVisible } = await ladePoll(doc);
  let n = 0;
  pollWhileVisible(() => { n += 1; }, 5000);
  assert.equal(doc.__laufend, 0, 'im Hintergrund darf nichts takten');
  assert.equal(n, 0);
});

test('weggeschaut hält an, zurückgeschaut fragt sofort', async () => {
  const doc = nachgebautesDokument({ hidden: false });
  const { pollWhileVisible } = await ladePoll(doc);
  let n = 0;
  pollWhileVisible(() => { n += 1; }, 5000);

  doc.hidden = true;
  doc.__feuern('visibilitychange');
  assert.equal(doc.__laufend, 0, 'der Takt muss anhalten');

  doc.hidden = false;
  doc.__feuern('visibilitychange');
  assert.equal(n, 1, 'beim Zurückkommen wird sofort einmal gefragt');
  assert.equal(doc.__laufend, 1, 'und danach wieder getaktet');
});

test('beendet heißt beendet, auch der Zuhörer', async () => {
  const doc = nachgebautesDokument();
  const { pollWhileVisible } = await ladePoll(doc);
  const stop = pollWhileVisible(() => {}, 1000);
  stop();
  assert.equal(doc.__laufend, 0);
  doc.hidden = false;
  doc.__feuern('visibilitychange');
  assert.equal(doc.__laufend, 0, 'nach dem Beenden darf nichts wieder anlaufen');
});

test('keine Seite taktet an dem Modul vorbei', () => {
  const dateien = [];
  (function sammeln(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) sammeln(p);
      else if (p.endsWith('.js') && !p.endsWith('poll.js')) dateien.push(p);
    }
  })(PUBLIC);

  const schuldige = [];
  for (const f of dateien) {
    const code = fs.readFileSync(f, 'utf8')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // `setTimeout` bleibt erlaubt: ein einzelner späterer Aufruf ist kein Takt.
    if (/setInterval\s*\(/.test(code)) schuldige.push(path.relative(PUBLIC, f));
  }
  assert.deepEqual(schuldige, [],
    `diese Seiten takten weiter, auch wenn niemand hinschaut: ${schuldige.join(', ')}`);
});
