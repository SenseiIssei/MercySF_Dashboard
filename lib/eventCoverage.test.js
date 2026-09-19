// Deckt die Event-Auswahl ab, was läuft?
//
//     node --test lib/eventCoverage.test.js
//
// Die Falle dahinter schlug an einem Tag zweimal zu und sieht beide Male wie
// ein kaputter Bot aus: eine eigene Auswahl ERSETZT die Standardliste, statt
// sie zu ergänzen. Wer zwei Events ankreuzt, hat drei ausgeschlossen, ohne es
// zu merken, und an einem dieser drei kauft sein Charakter kein Bier mehr.

const test = require('node:test');
const assert = require('node:assert/strict');

const { coverage, DEFAULT_WORTHWHILE } = require('./eventCoverage');

test('ohne eigene Auswahl gelten die fünf Standard-Events', () => {
  const r = coverage(['GloriousGoldGalore', 'WitchesDance'], [], true);
  assert.equal(r.usingDefaults, true);
  assert.deepEqual(r.covered, ['GloriousGoldGalore']);
  assert.deepEqual(r.uncovered, ['WitchesDance']);
  assert.equal(r.beerAppliesToday, true);
});

test('eine eigene Auswahl ersetzt die Standardliste, sie ergänzt sie nicht', () => {
  // Genau der Fall aus dem Screenshot: Bier und Pilzernte angekreuzt, Gold
  // läuft. Gold war vorher dabei und ist es jetzt nicht mehr.
  const r = coverage(
    ['GloriousGoldGalore'],
    ['OneBeerTwoBeerFreeBeer', 'CrazyMushroomHarvest'],
    true,
  );
  assert.equal(r.usingDefaults, false);
  assert.deepEqual(r.covered, []);
  assert.deepEqual(r.uncovered, ['GloriousGoldGalore']);
  assert.equal(r.beerAppliesToday, false, 'und deshalb kauft er kein Bier');
});

test('deckt die Auswahl das laufende Event ab, greift sie', () => {
  const r = coverage(['OneBeerTwoBeerFreeBeer'], ['OneBeerTwoBeerFreeBeer'], true);
  assert.deepEqual(r.covered, ['OneBeerTwoBeerFreeBeer']);
  assert.equal(r.beerAppliesToday, true);
});

test('ohne den Schalter zählt keine Auswahl', () => {
  // Zwei Bedingungen, und nur eine davon steht in der Event-Liste. Ein
  // Charakter mit perfekter Auswahl und ausgeschaltetem Schalter sieht genauso
  // aus wie einer mit falscher Auswahl.
  const r = coverage(['OneBeerTwoBeerFreeBeer'], ['OneBeerTwoBeerFreeBeer'], false);
  assert.deepEqual(r.covered, ['OneBeerTwoBeerFreeBeer'], 'abgedeckt ist es trotzdem');
  assert.equal(r.beerAppliesToday, false, 'wirksam aber nicht');
});

test('läuft nichts, ist auch nichts abgedeckt', () => {
  const r = coverage([], [], true);
  assert.deepEqual(r.running, []);
  assert.deepEqual(r.covered, []);
  assert.equal(r.beerAppliesToday, false);
});

test('die Standardliste ist die der CLI, fünf Einträge', () => {
  // Sie steht hier und in der CLI. Weicht eine ab, ist die Aussage auf der
  // Seite falsch, ohne dass irgendwo etwas fehlschlägt.
  assert.equal(DEFAULT_WORTHWHILE.length, 5);
  for (const e of ['ExceptionalXPEvent', 'GloriousGoldGalore', 'EpicQuestExtravaganza',
    'OneBeerTwoBeerFreeBeer', 'CrazyMushroomHarvest']) {
    assert.ok(DEFAULT_WORTHWHILE.includes(e), `${e} fehlt in der Standardliste`);
  }
});

test('Unsinn in den Eingaben wird übergangen, nicht geglaubt', () => {
  const r = coverage(['GloriousGoldGalore', null, 42], [undefined, 'OneBeerTwoBeerFreeBeer'], true);
  assert.deepEqual(r.running, ['GloriousGoldGalore']);
  assert.deepEqual(r.uncovered, ['GloriousGoldGalore']);
});

test('fehlende Angaben sind keine leere Auswahl', () => {
  // `undefined` heißt "nicht gefragt" und nicht "nichts angekreuzt". Beides auf
  // die Standardliste zu schicken ist hier richtig, weil eine fehlende Auswahl
  // in der Konfiguration genau das bedeutet.
  const r = coverage(['GloriousGoldGalore'], undefined, undefined);
  assert.equal(r.usingDefaults, true);
  assert.deepEqual(r.covered, ['GloriousGoldGalore']);
  assert.equal(r.beerAppliesToday, true);
});
