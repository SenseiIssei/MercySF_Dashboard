// Kommen die gelernten Modelle bei dieser Installation überhaupt an?
//
// Die Modelle hängen an einer Supporter-Lizenz und werden vom Server geholt, und
// die Kette kann an drei Stellen reißen, von denen man von außen nur die letzte
// sieht. Ohne Lizenzdatei wird das Bundle nie angefordert, nichts schlägt fehl,
// und der Bot fährt still auf den schlichten Algorithmen weiter. Genau das lief
// auf einer Flotte wochenlang unbemerkt.
//
// Deshalb steht hier nicht nur ein Ja oder Nein, sondern welches Tor zu ist.
// Die CLI beantwortet das selbst mit `--models`, ohne Konto und ohne Passwort.

const express = require('express');
const cli = require('../lib/cliExec');

const router = express.Router();

// Der Aufruf holt das Bundle über das Netz, also wird die Antwort kurz gehalten.
// Kurz, weil die Frage "ist es jetzt da" nach einer Lizenzänderung sofort neu
// beantwortet werden soll und nicht erst nach einer Viertelstunde.
const CACHE_MS = 60_000;
let cached = null;

router.get('/', async (req, res) => {
  const fresh = req.query.refresh === '1';
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) {
    return res.json({ ...cached.data, cached: true });
  }
  try {
    // Ohne Passwort: `--models` braucht weder Konto noch Login und steigt aus,
    // bevor eines gelesen würde.
    const data = await cli.runCli(['--models'], { timeoutMs: 30000 });
    cached = { at: Date.now(), data };
    res.json({ ...data, cached: false });
  } catch (err) {
    // Eine ältere CLI kennt `--models` noch nicht und beendet sich mit einem
    // Syntaxfehler. Das ist kein Ausfall des Dashboards, sondern eine Auskunft:
    // die Karte soll "diese CLI kann das noch nicht" zeigen und nicht rot
    // blinken.
    const unsupported = /Ungültiger CLI-Aufruf|unknown option/i.test(err.message);
    res.status(unsupported ? 200 : 502).json({
      unsupported,
      error: err.message,
      next: unsupported
        ? 'Diese CLI-Version kennt --models noch nicht. Ein CLI-Update bringt die Auskunft.'
        : err.message,
    });
  }
});

module.exports = router;
