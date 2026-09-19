// Welche Änderung über die CLI geht und welche in die Datei.
//
//     node --test lib/settingsSplit.test.js
//
// Der Dateiweg umgeht die Prüfung der CLI, ihre Bereichsgrenzen und ihr
// Zurücklesen, und er kann sich mit einem laufenden Bot überschneiden, der
// dieselbe Datei hält. Er ist der Rückfallweg, nicht der Normalfall, und jede
// Änderung, die die CLI selbst machen kann, soll sie auch selbst machen.
//
// Die Fälle hier sind alle still: eine Zahl, die fälschlich in die Datei geht,
// wird gespeichert und sieht richtig aus. Eine Zahl, die fälschlich an die CLI
// geht, wird von ihr abgelehnt und das Speichern tut kommentarlos nichts.

const test = require('node:test');
const assert = require('node:assert/strict');

const { splitUpdates } = require('./settingsSplit');

// So sieht die Antwort der CLI auf `--config` aus, auf die Felder gekürzt,
// um die es hier geht.
const CONFIG = {
  auto_quest: true,
  auto_arena: false,
  beer_event_amount: 0,
  poll_interval_secs: 60,
  quest_priority: 'Smart',
};
const SETTABLE = ['auto_quest', 'auto_arena'];
const NUMBERS = [
  { key: 'beer_event_amount', min: 0, max: 100 },
  { key: 'poll_interval_secs', min: 30, max: 3600 },
];

test('Schalter gehen über die CLI, wie bisher', () => {
  const { settableUpdates, fileUpdates, rejected } =
    splitUpdates({ auto_quest: false }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(settableUpdates, { auto_quest: false });
  assert.deepEqual(fileUpdates, {});
  assert.deepEqual(rejected, []);
});

test('Zahlen im erlaubten Bereich gehen jetzt auch über die CLI', () => {
  const { settableUpdates, fileUpdates } =
    splitUpdates({ beer_event_amount: 11 }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(settableUpdates, { beer_event_amount: 11 });
  assert.deepEqual(fileUpdates, {}, 'die Datei wird dafür nicht mehr angefasst');
});

test('die Grenzen selbst sind noch drin', () => {
  const unten = splitUpdates({ poll_interval_secs: 30 }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(unten.settableUpdates, { poll_interval_secs: 30 });
  const oben = splitUpdates({ poll_interval_secs: 3600 }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(oben.settableUpdates, { poll_interval_secs: 3600 });
});

test('außerhalb des Bereichs bleibt es der Dateiweg', () => {
  // Die CLI würde den Wert ablehnen. Ein Speichern, das dabei kommentarlos
  // nichts tut, wäre schlimmer als eines, das den alten Weg nimmt.
  const { settableUpdates, fileUpdates } =
    splitUpdates({ poll_interval_secs: 5 }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(settableUpdates, {});
  assert.deepEqual(fileUpdates, { poll_interval_secs: 5 });
});

test('eine ältere CLI ohne settable_numbers verhält sich exakt wie vorher', () => {
  // Das Feld fehlt, also kann die CLI keine Zahlen. Alles läuft über die Datei,
  // wie vor dieser Änderung. Ein Dashboard, das eine neuere CLI voraussetzt,
  // wäre eines, das nach dem Update eines anderen Projekts stehen bleibt.
  const { settableUpdates, fileUpdates } =
    splitUpdates({ auto_quest: false, beer_event_amount: 11 }, CONFIG, SETTABLE, undefined);
  assert.deepEqual(settableUpdates, { auto_quest: false });
  assert.deepEqual(fileUpdates, { beer_event_amount: 11 });
});

test('Texte bleiben der Datei vorbehalten', () => {
  const { settableUpdates, fileUpdates } =
    splitUpdates({ quest_priority: 'Xp' }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(settableUpdates, {});
  assert.deepEqual(fileUpdates, { quest_priority: 'Xp' });
});

test('unbekannte Felder und Typwechsel werden abgelehnt, nicht geschrieben', () => {
  const { rejected, settableUpdates, fileUpdates } = splitUpdates(
    { gibtesnicht: 1, auto_quest: 'ja', beer_event_amount: 'viel' },
    CONFIG,
    SETTABLE,
    NUMBERS,
  );
  assert.deepEqual(rejected.sort(), ['auto_quest', 'beer_event_amount', 'gibtesnicht']);
  assert.deepEqual(settableUpdates, {});
  assert.deepEqual(fileUpdates, {});
});

test('eine Kommazahl geht nicht an die CLI, die nimmt nur ganze', () => {
  const { settableUpdates, fileUpdates } =
    splitUpdates({ beer_event_amount: 11.5 }, CONFIG, SETTABLE, NUMBERS);
  assert.deepEqual(settableUpdates, {});
  assert.deepEqual(fileUpdates, { beer_event_amount: 11.5 });
});

test('kaputte Einträge in settable_numbers werden übergangen, nicht geglaubt', () => {
  const { settableUpdates, fileUpdates } = splitUpdates(
    { beer_event_amount: 11 },
    CONFIG,
    SETTABLE,
    [null, { min: 0, max: 5 }, 'unsinn'],
  );
  assert.deepEqual(settableUpdates, {});
  assert.deepEqual(fileUpdates, { beer_event_amount: 11 });
});
