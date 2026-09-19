// Welche Einstellungsänderung die CLI selbst machen kann, und welche nicht.
//
// Eigenes Modul, weil hier die interessante Entscheidung fällt und sie sonst
// nur über einen Routen-Handler samt Web-Schicht und echtem Login prüfbar
// wäre. `lib/` ist in diesem Projekt der Ort für solche Stücke.

/**
 * Teilt die gewünschten Änderungen in "das kann die CLI selbst" und "Datei".
 *
 * Herausgezogen, weil genau hier die interessante Entscheidung fällt und sie
 * sonst nur über einen echten Login mit Passwort prüfbar wäre.
 *
 * Der Dateiweg umgeht die Prüfung der CLI, ihre Bereichsgrenzen und ihr
 * Zurücklesen, und er kann sich mit einem laufenden Bot überschneiden, der
 * dieselbe Datei hält. Er ist deshalb der Rückfallweg, nicht der Normalfall.
 *
 * `settableNumbers` ist neu in der CLI: `--set` nahm lange nur Ja-Nein-Werte,
 * weshalb jede Zahl am Ende in der Datei landete. Fehlt das Feld, ist eine
 * ältere CLI installiert und alles verhält sich exakt wie vorher. Ein Dashboard,
 * das eine neuere CLI voraussetzt, wäre eines, das nach dem Update eines
 * anderen Projekts stehen bleibt.
 */
// Was die CLI an der Stelle eines Zugangsdatums ausgibt. Muss mit
// CREDENTIAL_FIELDS/HIDDEN in cli.rs uebereinstimmen; ein Test haelt das fest,
// soweit es von hier aus pruefbar ist.
const HIDDEN_MARKER = '(hidden: this field holds a credential)';

function splitUpdates(updates, config, settableList, settableNumbers) {
  const settable = new Set(settableList || []);
  const ranges = new Map(
    (settableNumbers || [])
      .filter(n => n && typeof n.key === 'string')
      .map(n => [n.key, { min: Number(n.min), max: Number(n.max) }]),
  );
  const allowedKeys = new Set(Object.keys(config || {}));
  const rejected = [];
  const settableUpdates = {};
  const fileUpdates = {};
  for (const key of Object.keys(updates || {})) {
    if (!allowedKeys.has(key)) { rejected.push(key); continue; }
    // Der Hinweis, den die CLI anstelle eines Zugangsdatums ausgibt, darf
    // nicht zurueckgeschrieben werden.
    //
    // Seit die CLI Webhook und Token nicht mehr im Klartext ausgibt, steht auf
    // der Einstellungsseite ein Hinweistext, wo vorher der Wert stand.
    // Speichert jemand die Seite, ohne das Feld anzufassen, kaeme dieser Text
    // zurueck und wuerde den echten Wert ueberschreiben: der Webhook waere weg
    // und niemand wuesste warum. Ein unveraendertes Feld ist keine Aenderung.
    if (updates[key] === HIDDEN_MARKER) { continue; }
    if (typeof config[key] !== typeof updates[key]) { rejected.push(key); continue; }
    const range = ranges.get(key);
    if (settable.has(key) && typeof updates[key] === 'boolean') {
      settableUpdates[key] = updates[key];
    } else if (range && Number.isInteger(updates[key])
      && updates[key] >= range.min && updates[key] <= range.max) {
      settableUpdates[key] = updates[key];
    } else {
      // Außerhalb des Bereichs bleibt es der Dateiweg: die CLI würde den Wert
      // ablehnen, und ein Speichern, das dabei kommentarlos nichts tut, wäre
      // schlimmer als eines, das den alten Weg nimmt.
      fileUpdates[key] = updates[key];
    }
  }
  return { settableUpdates, fileUpdates, rejected };
}

module.exports = { splitUpdates, HIDDEN_MARKER };
