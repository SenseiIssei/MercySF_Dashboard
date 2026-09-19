// Der Marktplatz von Mercy SF, durchgereicht.
//
// Die Seite hat bis hierher direkt `https://data.poslab.cc/api/marketplace`
// abgefragt. Das ist die Pinnwand des ursprünglichen Autors dieses Forks, nicht
// die von Mercy SF: wer im Dashboard nach Konfigurationen sah, fand die eines
// anderen Projekts, und die Einträge, die die Anwendung selbst anbietet, waren
// nirgends zu sehen.
//
// Gefragt wird jetzt der Server, den auch die Anwendung fragt, und zwar von
// hier aus und nicht aus dem Browser. Zwei Gründe:
//
//   1. Der Browser müsste sonst quer über die Domänengrenze fragen, und das
//      hängt an einer CORS-Regel auf einem Server, der uns nicht gehört.
//   2. Wer etwas durchreicht, entscheidet, was durchgeht. Hier geht nur die
//      Liste durch und die Einstellungen eines Eintrags, nichts zu Lizenzen,
//      Konten oder Token. Das ist dieselbe Grenze, die `lib/cliExec.js` zieht.
//
// Nichts wird geschrieben. Wer eine Konfiguration übernehmen will, schickt sie
// durch `/api/settings-templates/import`, und das prüft sie dort.

const express = require('express');

const router = express.Router();

const MARKT = process.env.MERCY_MARKET_URL || 'https://mercysf.app/api/marketplace';

// Zwei Minuten. Die Pinnwand ändert sich in Tagen, nicht in Sekunden, und ein
// Dashboard mit dreizehn offenen Tabs soll den Server nicht dreizehnmal fragen.
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map();

async function hole(pfad) {
  const nun = Date.now();
  const gemerkt = cache.get(pfad);
  if (gemerkt && nun - gemerkt.at < CACHE_MS) return gemerkt.data;

  // Ein Zeitlimit, damit eine hängende Anfrage nicht die Seite hängen lässt.
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), 15000);
  try {
    const antwort = await fetch(`${MARKT}${pfad}`, {
      signal: abbruch.signal,
      headers: { Accept: 'application/json' },
    });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const data = await antwort.json();
    cache.set(pfad, { at: nun, data });
    return data;
  } finally {
    clearTimeout(wecker);
  }
}

router.get('/list', async (req, res) => {
  // Nur die Sortierung geht weiter, und nur als eines von vier Wörtern. Was
  // ein Browser schickt, gehört nicht ungeprüft in eine fremde Adresse.
  const erlaubt = ['top', 'new', 'downloads', 'least'];
  const sort = erlaubt.includes(String(req.query.sort)) ? String(req.query.sort) : 'top';
  try {
    const data = await hole(`/list?sort=${sort}`);
    res.json({ entries: Array.isArray(data?.entries) ? data.entries : [], sort });
  } catch (err) {
    console.error('[markt] Liste nicht erreichbar:', err.message);
    res.status(502).json({
      entries: [],
      error: 'Der Marktplatz war nicht erreichbar. Der Grund steht im Server-Log.',
    });
  }
});

router.get('/config/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Keine gültige Nummer' });
  }
  try {
    res.json(await hole(`/config/${id}`));
  } catch (err) {
    console.error('[markt] Eintrag nicht erreichbar:', err.message);
    res.status(502).json({ error: 'Der Eintrag war nicht abrufbar.' });
  }
});

module.exports = router;
