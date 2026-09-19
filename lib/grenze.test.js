// Was darf über die Grenze zur CLI, und was nicht?
//
//     node --test lib/grenze.test.js
//
// Der Quelltext dieses Dashboards ist öffentlich, die Installation ist es
// nicht. Alles, was das Dashboard über Lizenzen, Konten und Zugangsdaten
// erfährt, erfährt es durch die CLI, und alles, was es dort hineinreicht, geht
// als Argument an ein Programm. Diese beiden Richtungen sind die Grenze, und
// eine Grenze, die nur auf einer Seite geprüft wird, ist eine halbe.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cli = require('./cliExec');
const { splitUpdates, HIDDEN_MARKER } = require('./settingsSplit');

test('ein Profilname kann keinen Schalter einschleusen', () => {
  // Hieße ein Profil `--update`, stünde an der Stelle des Namens ein Befehl.
  for (const boese of ['--update', '--set', '-x', '--all', '']) {
    assert.throws(
      () => cli.buildArgs({ username: boese, characterName: 'Held' }, ['--status']),
      /kein gültiger Wert/,
      `${JSON.stringify(boese)} kam durch`,
    );
    assert.throws(
      () => cli.buildArgs({ username: 'jemand', characterName: boese }, ['--status']),
      /kein gültiger Wert/,
      `${JSON.stringify(boese)} kam als Charaktername durch`,
    );
  }
});

test('gewöhnliche Namen gehen weiterhin durch', () => {
  const args = cli.buildArgs({ username: 'TestAccount626', characterName: 'MercyWorld20' }, ['--status']);
  assert.deepEqual(args, ['--user', 'TestAccount626', '--character', 'MercyWorld20', '--status']);
});

test('die Ausgabe der CLI steht in keiner Fehlermeldung', () => {
  // Von der Fehlermeldung aus geht es über mehr als sechzig Stellen direkt in
  // eine HTTP-Antwort. In der Ausgabe von --config steht die halbe
  // Konfiguration, in der von --view der halbe Spielstand.
  const src = fs.readFileSync(path.join(__dirname, 'cliExec.js'), 'utf8');
  assert.doesNotMatch(src, /Unerwartete CLI-Ausgabe: \$\{stdout/);
  assert.match(src, /Der Grund steht im Server-Log/);
  assert.match(src, /console\.error\('\[cli\]/);
});

test('der Hinweis anstelle eines Zugangsdatums wird nicht zurückgeschrieben', () => {
  // Sonst überschreibt ein Speichern der Einstellungsseite den echten Webhook
  // mit dem Hinweistext, und niemand weiß hinterher, warum nichts mehr ankommt.
  const config = { notify_discord_webhook: 'https://discord.com/api/webhooks/1/echt', auto_arena: true };
  const r = splitUpdates(
    { notify_discord_webhook: HIDDEN_MARKER, auto_arena: false },
    config,
    ['auto_arena'],
    [],
  );
  assert.deepEqual(r.fileUpdates, {}, 'der Hinweistext wäre in die Datei geschrieben worden');
  assert.deepEqual(r.settableUpdates, { auto_arena: false }, 'die echte Änderung muss durchgehen');
  assert.deepEqual(r.rejected, []);
});

test('ein echter neuer Webhook geht weiterhin durch', () => {
  // Schreiben ist nicht das Problem: wer schreibt, kennt den Wert schon.
  const config = { notify_discord_webhook: 'alt' };
  const r = splitUpdates({ notify_discord_webhook: 'https://discord.com/api/webhooks/2/neu' }, config, [], []);
  assert.equal(r.fileUpdates.notify_discord_webhook, 'https://discord.com/api/webhooks/2/neu');
});

test('keine Route gibt den Lizenzschlüssel heraus', () => {
  // Dieselbe Prüfung wie in modelsRouteGuard.test.js, aber über alle Routen:
  // ein neues Feld auf einer neuen Route ist genau der Weg, auf dem so etwas
  // wieder hinausginge.
  const dir = path.join(__dirname, '..', 'routes');
  const verboten = /\b(license_key|licence_key|recoveryPhrase|aesKey|credentialStore\.getPassword\(\s*\)\s*)\b/;
  for (const datei of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, datei), 'utf8');
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // `auth.js` gibt den Wiederherstellungsschlüssel genau einmal aus, beim
    // Anlegen des Zugangs, und das ist der Sinn der Sache.
    if (datei === 'auth.js') continue;
    assert.doesNotMatch(code, verboten, `${datei} reicht etwas heraus, das drinbleiben sollte`);
  }
});

test('das Passwort steht in keinem Argument', () => {
  // Argumente einer Kommandozeile kann auf derselben Maschine jeder Prozess
  // lesen. Deshalb hat die CLI kein --password, und deshalb darf hier keines
  // gebaut werden.
  const src = fs.readFileSync(path.join(__dirname, 'cliExec.js'), 'utf8');
  assert.doesNotMatch(src, /'--password'/);
  assert.match(src, /--password-stdin/);
  assert.match(src, /proc\.stdin\.write\(password/);
});
