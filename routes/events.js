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

router.get('/:accountId', async (req, res) => {
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
    res.json({
      ...coverage(status.events, settings.worthwhile_events, settings.beer_on_events),
      beerOnEvents: settings.beer_on_events !== false,
      beerEventAmount: settings.beer_event_amount,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
