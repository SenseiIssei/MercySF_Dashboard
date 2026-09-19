// Die Anzeigen, die auch die Anwendung selbst zeichnet.
//
// Die CLI beantwortet sie seit 2.24.2 unter `--view <name>`, und zwar mit
// genau den Funktionen, aus denen die Anwendung ihre Seiten baut. Darum geht
// es bei der Sache: eine Zahl, die hier ein zweites Mal ausgerechnet wuerde,
// waere frueher oder spaeter eine andere als die im Programm, und dann streiten
// zwei Fenster derselben Installation. Die negative Gesundheit im legendaeren
// Verlies war genau so entstanden.
//
// Jeder Abruf kostet einen Login ins Spiel, und ein Login nimmt dem laufenden
// Bot desselben Charakters die Sitzung weg. Deshalb wird gespeichert, und
// deshalb darf keine Seite das im Takt aufrufen.

const express = require('express');
const { findProfileByAccountId } = require('../lib/data');
const credentialStore = require('../lib/credentialStore');
const cli = require('../lib/cliExec');

const router = express.Router();

// Zwei Minuten. Kuerzer als die Event-Karte, weil sich ein Verlies-Lauf
// waehrend man zuschaut aendert, und laenger als ein Seitenaufbau, damit
// Hin- und Herklicken nicht jedes Mal einen Login kostet.
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map();

// Der Katalog aendert sich nur mit der CLI.
const KATALOG_MS = 60 * 60 * 1000;
let katalog = null;

router.get('/', async (req, res) => {
  if (katalog && Date.now() - katalog.at < KATALOG_MS) {
    return res.json({ views: katalog.data, cached: true });
  }
  try {
    // Ohne Konto und ohne Passwort: `--views` liest nur den eigenen Katalog.
    const data = await cli.runCli(['--views'], { timeoutMs: 20000 });
    katalog = { at: Date.now(), data: data.views || [] };
    res.json({ views: katalog.data, cached: false });
  } catch (err) {
    const zuAlt = /Ungültiger CLI-Aufruf|unknown option|no view called/i.test(err.message);
    if (!zuAlt) console.error('[views] Katalog nicht lesbar:', err.message);
    res.status(zuAlt ? 200 : 502).json({
      views: [],
      unsupported: zuAlt,
      error: zuAlt ? undefined : 'Der Katalog konnte nicht gelesen werden. Der Grund steht im Server-Log.',
    });
  }
});

router.get('/:accountId/:name', async (req, res) => {
  const { accountId, name } = req.params;
  // Der Name geht als Argument an ein Programm. Nur das, was ein Name sein
  // kann, kommt durch; die CLI prueft ihn danach noch einmal gegen ihren
  // eigenen Katalog.
  if (!/^[a-z_]{1,40}$/.test(name)) {
    return res.status(400).json({ error: 'Kein gültiger Name einer Anzeige' });
  }

  const profile = findProfileByAccountId(accountId);
  const password = profile && credentialStore.getPassword(profile.username);
  if (!profile || !password) {
    return res.json({ unavailable: true, reason: 'no-password' });
  }

  const schluessel = `${accountId}|${name}`;
  const frisch = req.query.refresh === '1';
  const gemerkt = cache.get(schluessel);
  if (!frisch && gemerkt && Date.now() - gemerkt.at < CACHE_MS) {
    return res.json({ ...gemerkt.data, cached: true, age: Math.round((Date.now() - gemerkt.at) / 1000) });
  }

  try {
    const antwort = await cli.readCli(cli.buildArgs(profile, ['--view', name]), {
      password,
      timeoutMs: 60000,
    });
    const data = { view: antwort.view || name, data: antwort.data ?? null };
    cache.set(schluessel, { at: Date.now(), data });
    res.json({ ...data, cached: false, age: 0 });
  } catch (err) {
    // Eine aeltere CLI kennt weder --view noch diesen Namen. Das ist eine
    // Auskunft und kein Ausfall: die Karte soll es sagen statt rot zu blinken.
    const zuAlt = /Ungültiger CLI-Aufruf|unknown option|no view called/i.test(err.message);
    if (!zuAlt) console.error(`[views] ${name} fehlgeschlagen:`, err.message);
    res.status(zuAlt ? 200 : 502).json({
      unavailable: true,
      reason: zuAlt ? 'cli-too-old' : 'error',
    });
  }
});

module.exports = router;
