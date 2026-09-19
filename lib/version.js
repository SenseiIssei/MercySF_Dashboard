// Ist die eine Version neuer als die andere?
//
// Die Prüfung auf ein CLI-Update verglich nur Prüfsummen: eine andere Datei
// hiess "Update verfügbar". Anders ist aber nicht neuer. Wer eine CLI von Hand
// gebaut hat, weil er eine Änderung braucht, die noch nicht veröffentlicht
// ist, bekam ein Update angeboten, das ihn auf die veröffentlichte Fassung
// ZURÜCK setzt. Genau das ist passiert: 2.24.1 wurde durch 2.24.0 ersetzt,
// und danach kannte die CLI drei Befehle nicht mehr, die das Dashboard
// aufruft. Auf der Seite stand "CLI zu alt", was stimmte, und nach der
// Ursache suchte man an der falschen Stelle.

/** `"2.24.10"` wird zu `[2, 24, 10]`. Was nicht passt, wird null. */
function parseVersion(text) {
  const m = String(text ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * -1, 0 oder 1, wie ein Vergleich es gewohnt ist. `null`, wenn eine der beiden
 * keine Version ist: dann weiss niemand etwas, und der Aufrufer muss
 * entscheiden, statt zu raten.
 */
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Soll eine Installation dieser Version auf jene wechseln?
 *
 * Nur nach vorn. Sind beide gleich, gibt es nichts zu tun; ist die
 * angebotene älter, ist es ein Rückschritt und kein Update. Lässt sich eine
 * der beiden nicht lesen, bleibt es beim Prüfsummen-Vergleich des Aufrufers:
 * eine unbekannte Version ist kein Grund, ein echtes Update zu verstecken.
 */
function isUpgrade(current, offered) {
  const c = compareVersions(current, offered);
  if (c === null) return null;
  return c < 0;
}

module.exports = { parseVersion, compareVersions, isUpgrade };
