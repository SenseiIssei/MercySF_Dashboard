// Was die Modell-Route nach außen geben darf, und was niemals.
//
//     node --test lib/modelsRouteGuard.test.js
//
// Dieser Code ist öffentlich, und die Route spricht über Lizenzen. Beides
// zusammen heißt: durchreichen ist die falsche Voreinstellung. Fügt eine
// spätere CLI-Version dem Befehl ein Feld hinzu, wäre es mit `...data` sofort
// im Dashboard, ohne dass hier jemand etwas geändert hätte.
//
// Geprüft wird die Quelle statt des laufenden Servers, weil die Route Express
// nachzieht und die Regel auch dann gelten soll, wenn niemand die Abhängigkeiten
// installiert hat.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'routes', 'models.js'), 'utf8');

test('die Antwort wird aus einer Liste gebaut, nicht durchgereicht', () => {
  assert.ok(QUELLE.includes('const DURCHGEREICHT = ['), 'die Liste fehlt');
  assert.ok(
    QUELLE.includes('nurErlaubtes(await cli.runCli'),
    'die CLI-Antwort muss durch den Filter, bevor sie gespeichert wird',
  );
});

test('kein Feld auf der Liste trägt einen Schlüssel oder eine Adresse', () => {
  const liste = QUELLE.slice(
    QUELLE.indexOf('const DURCHGEREICHT = ['),
    QUELLE.indexOf('];', QUELLE.indexOf('const DURCHGEREICHT = [')),
  );
  // `licence_key_present` ist erlaubt und ist ein Ja-Nein. Ein Feld, das den
  // Schlüssel selbst trüge, hieße anders und dürfte hier nicht stehen.
  for (const verboten of ['license_key', 'licence_key\'', 'email', 'signature', 'secret', 'token']) {
    assert.ok(!liste.includes(verboten), `${verboten} darf nicht auf der Liste stehen`);
  }
  assert.ok(liste.includes('licence_key_present'), 'das Ja-Nein soll bleiben');
});

test('die Route ändert nichts, sie liest nur', () => {
  // Nichts an der Lizenz soll sich über das Dashboard anfassen lassen. Ein
  // POST, PUT oder DELETE hier wäre genau der Weg dorthin.
  for (const verb of ['router.post', 'router.put', 'router.delete', 'router.patch']) {
    assert.ok(!QUELLE.includes(verb), `${verb} gehört nicht in diese Route`);
  }
  assert.ok(QUELLE.includes("router.get('/'"), 'ein GET soll es geben');
});

test('die Meldung der CLI geht ins Log, nicht ins Netz', () => {
  // `runCli` hängt bei unerwarteter Ausgabe die ersten dreihundert Zeichen von
  // stdout an die Meldung. Bei einem Befehl, der über Lizenzen spricht, ist das
  // eine Tür, durch die eines Tages etwas geht, das hier nie stehen sollte.
  const antwortTeil = QUELLE.slice(QUELLE.indexOf('res.status(unsupported'));
  assert.ok(
    !antwortTeil.includes('err.message'),
    'die Antwort darf die CLI-Meldung nicht enthalten',
  );
  assert.ok(QUELLE.includes('console.error('), 'sie gehört stattdessen ins Server-Log');
});
