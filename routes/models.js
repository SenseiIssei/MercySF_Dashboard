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

/**
 * Was von der CLI-Antwort nach außen darf, und nichts sonst.
 *
 * Eine Liste statt `...data`, und der Grund ist die Richtung, in die dieser
 * Code wächst: fügt eine spätere CLI-Version dem Befehl ein Feld hinzu, wäre es
 * mit dem Durchreichen sofort im Dashboard, ohne dass hier jemand etwas
 * geändert hätte. Bei einem Befehl, der über Lizenzen spricht, ist das die
 * falsche Voreinstellung.
 *
 * `licence_key_present` ist deshalb ein Ja-Nein und kein Schlüssel, und der
 * Schlüssel selbst steht auf keiner Liste, auf keiner Seite und in keiner
 * Antwort. Das Dashboard reicht die Auskunft durch und kann an der Lizenz
 * nichts ändern: es gibt hier nur ein GET.
 */
const DURCHGEREICHT = [
  'licence_key_present',
  'tier',
  'supporter',
  'bundle_received',
  'bundle_version',
  'models',
  'measured_settings',
  'next',
];

function nurErlaubtes(data) {
  const out = {};
  for (const key of DURCHGEREICHT) {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
  }
  return out;
}

router.get('/', async (req, res) => {
  const fresh = req.query.refresh === '1';
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) {
    return res.json({ ...cached.data, cached: true });
  }
  try {
    // Ohne Passwort: `--models` braucht weder Konto noch Login und steigt aus,
    // bevor eines gelesen würde.
    const data = nurErlaubtes(await cli.runCli(['--models'], { timeoutMs: 30000 }));
    cached = { at: Date.now(), data };
    res.json({ ...data, cached: false });
  } catch (err) {
    // Eine ältere CLI kennt `--models` noch nicht und beendet sich mit einem
    // Syntaxfehler. Das ist kein Ausfall des Dashboards, sondern eine Auskunft:
    // die Karte soll "diese CLI kann das noch nicht" zeigen und nicht rot
    // blinken.
    const unsupported = /Ungültiger CLI-Aufruf|unknown option/i.test(err.message);
    // Die Meldung der CLI geht ins Server-Log, nicht ins Netz.
    //
    // `runCli` hängt bei unerwarteter Ausgabe die ersten dreihundert Zeichen von
    // stdout an die Meldung. Bei jedem anderen Befehl wäre das eine Hilfe; bei
    // einem, der über Lizenzen spricht, ist es eine Tür, durch die eines Tages
    // etwas geht, das hier nie stehen sollte. Wer den Grund braucht, hat Zugriff
    // auf den Server; wer nur die Seite sieht, braucht ihn nicht.
    if (!unsupported) console.error('[models] CLI-Aufruf fehlgeschlagen:', err.message);
    res.status(unsupported ? 200 : 502).json({
      unsupported,
      next: unsupported
        ? 'Diese CLI-Version kennt --models noch nicht. Ein CLI-Update bringt die Auskunft.'
        : 'Die CLI konnte nicht nach den Modellen gefragt werden. Der Grund steht im Server-Log.',
    });
  }
});

module.exports = router;
