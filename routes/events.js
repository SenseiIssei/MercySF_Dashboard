// Welche Server-Events laufen, und zählen sie für diesen Charakter?
//
// Die zweite Hälfte der Frage ist die wichtige. Unter "Welche Events einen Pilz
// wert sind" gelten unangetastet fünf Events; sobald jemand eines ankreuzt,
// ERSETZT seine Auswahl diese Liste vollständig. Ein Charakter, der an einem
// Gold-Event kein Bier kauft, weil Gold aus seiner Auswahl gefallen ist, sieht
// aus wie ein kaputter Bot und tut genau das, was eingestellt wurde.
//
// An einem Tag wurde er zweimal dafür gehalten. Deshalb steht hier nicht nur,
// was läuft, sondern was davon greift.

const express = require('express');
const { findProfileByAccountId } = require('../lib/data');
const credentialStore = require('../lib/credentialStore');
const cli = require('../lib/cliExec');
const { coverage } = require('../lib/eventCoverage');

const router = express.Router();

// Die Antwort wird gespeichert, und zwar lange.
//
// Der Aufruf kostet zwei Logins ins Spiel, und ein Login ins Spiel nimmt dem
// laufenden Bot desselben Charakters die Sitzung weg. Die Uebersicht rief das
// im Fuenf-Sekunden-Takt auf: der Bot wurde zwoelfmal pro Minute hinausgeworfen
// und meldete sich jedes Mal neu an. Auf dem Bildschirm sah das nach einem
// kaputten Bot aus, und der Grund war die Seite, die ihm zuschaute.
//
// Zehn Minuten sind reichlich fuer eine Frage, deren Antwort sich hoechstens
// stuendlich aendert. Wer es genauer braucht, drueckt auf der Karte auf
// Aktualisieren, und das schickt refresh=1.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

router.get('/:accountId', async (req, res) => {
  const frisch = req.query.refresh === '1';
  const gemerkt = cache.get(req.params.accountId);
  if (!frisch && gemerkt && Date.now() - gemerkt.at < CACHE_MS) {
    return res.json({ ...gemerkt.data, cached: true, age: Math.round((Date.now() - gemerkt.at) / 1000) });
  }
  const profile = findProfileByAccountId(req.params.accountId);
  const password = profile && credentialStore.getPassword(profile.username);
  if (!profile || !password) {
    // Ohne gespeichertes Passwort lässt sich die CLI nicht nicht-interaktiv
    // aufrufen. Das ist kein Fehler, sondern eine Auskunft: die Karte soll das
    // sagen statt rot zu blinken.
    return res.json({ unavailable: true, reason: 'no-password' });
  }
  try {
    const [status, config] = await Promise.all([
      cli.runCli(cli.buildArgs(profile, ['--status']), { password }),
      cli.runCli(cli.buildArgs(profile, ['--config']), { password }),
    ]);
    // Ältere CLI-Versionen kennen das Feld noch nicht. Dann gibt es nichts zu
    // zeigen, und die Karte sagt warum, statt eine leere Liste als "es läuft
    // nichts" auszugeben — das wäre eine Aussage, die niemand geprüft hat.
    if (!Array.isArray(status.events)) {
      return res.json({ unavailable: true, reason: 'cli-too-old' });
    }
    const settings = (config && config.config) || {};
    const data = {
      ...coverage(status.events, settings.worthwhile_events, settings.beer_on_events),
      beerOnEvents: settings.beer_on_events !== false,
      beerEventAmount: settings.beer_event_amount,
    };
    cache.set(req.params.accountId, { at: Date.now(), data });
    res.json({ ...data, cached: false, age: 0 });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
