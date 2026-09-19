// Deckt die eigene Event-Auswahl das ab, was gerade läuft?
//
// Eigenes Modul, weil hier die Aussage entsteht und sie sonst nur über einen
// echten Login mit Passwort prüfbar wäre.
//
// Der Hintergrund ist eine Falle, die an einem Tag zweimal zuschlug. Unter
// "Welche Events einen Pilz wert sind" gelten unangetastet fünf Events als
// pilzwürdig. Sobald jemand **irgendetwas** ankreuzt, **ersetzt** seine Auswahl
// diese Liste vollständig. Wer also Bier und Pilzernte ankreuzt, hat XP, Gold
// und Epische Quests damit stillschweigend ausgeschlossen, und an einem
// Gold-Event kauft sein Charakter kein Bier mehr. Das sieht aus wie ein
// kaputter Bot und ist einer, der genau das tut, was eingestellt wurde.

// Die Fünf, die ohne eigene Auswahl gelten. Dieselben Namen wie in der CLI.
const DEFAULT_WORTHWHILE = [
  'ExceptionalXPEvent',
  'GloriousGoldGalore',
  'EpicQuestExtravaganza',
  'OneBeerTwoBeerFreeBeer',
  'CrazyMushroomHarvest',
];

/**
 * Was gerade läuft, und was davon für diesen Charakter zählt.
 *
 * `active` sind die Namen aus `mercy-cli --status`, `chosen` ist
 * `worthwhile_events` aus der Konfiguration. Eine leere Auswahl bedeutet die
 * Standardliste, nicht "nichts" — das ist der Unterschied, um den es geht.
 */
function coverage(active, chosen, beerOnEvents) {
  const running = Array.isArray(active) ? active.filter(e => typeof e === 'string') : [];
  const picked = Array.isArray(chosen) ? chosen.filter(e => typeof e === 'string') : [];
  const usingDefaults = picked.length === 0;
  const counting = new Set(usingDefaults ? DEFAULT_WORTHWHILE : picked);
  const covered = running.filter(e => counting.has(e));
  const uncovered = running.filter(e => !counting.has(e));
  return {
    running,
    covered,
    uncovered,
    usingDefaults,
    // Ob an diesem Tag überhaupt die Event-Kaufmenge greift. Der Schalter ist
    // die zweite Bedingung: ohne ihn zählt keine Auswahl.
    beerAppliesToday: beerOnEvents !== false && covered.length > 0,
  };
}

module.exports = { coverage, DEFAULT_WORTHWHILE };
