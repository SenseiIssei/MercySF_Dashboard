const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const ptyManager = require('./ptyManager');
const { execFile } = require('child_process');
const { isUpgrade } = require('./version');

const { CLI_PATH } = require('./cliPath');
// The on-disk filename stays "...-x64" regardless of actual CPU architecture (see install.sh),
// but the REFERENCE file this compares against must match the arch actually installed — os.arch()
// returns 'arm64' on 64-bit ARM (Raspberry Pi etc.), matching the URL suffix install.sh uses.
// Without this, checkForUpdate() compared an ARM64 binary's hash against the x64 download and
// found an "update" (different file, not a different version) on every single check.
const DOWNLOAD_URL = os.arch() === 'arm64'
  ? 'https://mercysf.app/downloads/mercy-cli-linux-arm64'
  : 'https://mercysf.app/downloads/mercy-cli-linux-x64';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const state = {
  checking: false,
  currentVersion: null,
  remoteVersion: null,
  isDowngrade: false,
  applying: false,
  updateAvailable: false,
  currentHash: null,
  remoteHash: null,
  lastCheckedAt: null,
  lastError: null,
};

function md5OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// destDir default (os.tmpdir(), meist /tmp) reicht zum bloßen Prüfen/Hashen. Für den tatsächlichen
// Austausch (applyUpdate) muss der Download im selben Verzeichnis wie CLI_PATH landen, sonst
// schlägt das abschließende renameSync mit EXDEV fehl, wenn /tmp ein anderes Dateisystem ist
// als /opt (z. B. tmpfs in manchen Container-Setups).
function downloadToTemp(destDir) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(destDir || os.tmpdir(), `.mercy-cli-download-${Date.now()}`);
    const file = fs.createWriteStream(tmpPath);
    https.get(DOWNLOAD_URL, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(tmpPath, () => {});
        reject(new Error(`Download fehlgeschlagen: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(tmpPath)));
    }).on('error', err => {
      file.close();
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

/**
 * Die Version, die eine Datei von sich selbst behauptet.
 *
 * Über `--version`, weil das der einzige Weg ist, der ohne Konto auskommt und
 * keine Sekunde dauert. Antwortet die Datei nicht so, wie sie soll, ist das
 * kein Fehler: dann weiss man es eben nicht, und der Aufrufer faellt auf den
 * Vergleich der Pruefsummen zurueck.
 */
function versionOf(datei) {
  return new Promise(resolve => {
    execFile(datei, ['--version'], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(String(stdout).trim()).version || null);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function checkForUpdate() {
  if (state.checking) return state;
  state.checking = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp();
    const remoteHash = await md5OfFile(tmpPath);
    const currentHash = fs.existsSync(CLI_PATH) ? await md5OfFile(CLI_PATH) : null;
    state.remoteHash = remoteHash;
    state.currentHash = currentHash;

    // Anders ist nicht neuer.
    //
    // Vorher entschied allein die Pruefsumme, und eine selbst gebaute CLI sah
    // damit aus wie eine veraltete. Angeboten wurde dann ein "Update", das auf
    // die veroeffentlichte Fassung ZURUECK setzt. Genau das ist passiert:
    // 2.24.1 wurde durch 2.24.0 ersetzt, und danach fehlten drei Befehle, die
    // das Dashboard aufruft.
    fs.chmodSync(tmpPath, 0o755);
    const [current, offered] = await Promise.all([
      fs.existsSync(CLI_PATH) ? versionOf(CLI_PATH) : null,
      versionOf(tmpPath),
    ]);
    state.currentVersion = current;
    state.remoteVersion = offered;
    const vorwaerts = isUpgrade(current, offered);
    state.updateAvailable = currentHash !== null
      && currentHash !== remoteHash
      // Kennt eine der beiden Seiten ihre Version nicht, bleibt es beim alten
      // Verhalten: eine unbekannte Version soll kein echtes Update verstecken.
      && (vorwaerts === null || vorwaerts === true);
    state.isDowngrade = vorwaerts === false;
    state.lastCheckedAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
    state.checking = false;
  }
  return state;
}

async function applyUpdate() {
  if (state.applying) throw new Error('Update läuft bereits');
  if (!state.updateAvailable) throw new Error('Kein Update verfügbar');
  state.applying = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp(path.dirname(CLI_PATH));
    const freshHash = await md5OfFile(tmpPath);
    if (freshHash !== state.remoteHash) {
      throw new Error('Heruntergeladene Datei weicht vom zuletzt geprüften Stand ab, breche ab');
    }
    if (fs.existsSync(CLI_PATH)) {
      fs.copyFileSync(CLI_PATH, `${CLI_PATH}.bak`);
    }
    try {
      fs.renameSync(tmpPath, CLI_PATH);
    } catch (err) {
      // Fallback, falls Download- und Zielverzeichnis doch auf unterschiedlichen Dateisystemen
      // liegen (rename() kann nicht über Geräte-/Mount-Grenzen hinweg, copy+unlink schon).
      if (err.code !== 'EXDEV') throw err;
      fs.copyFileSync(tmpPath, CLI_PATH);
      fs.unlinkSync(tmpPath);
    }
    fs.chmodSync(CLI_PATH, 0o755);
    tmpPath = null;
    // Nur Sessions neu starten, die gerade tatsächlich laufen (ptyManager.listActiveIds) —
    // startet keine dormanten Account-Profile, die noch nie eine Konsole geöffnet hatten.
    for (const id of ptyManager.listActiveIds()) ptyManager.restartPty(id);
    state.updateAvailable = false;
    state.currentHash = state.remoteHash;
    state.lastError = null;
    return state.currentHash;
  } catch (err) {
    state.lastError = err.message;
    throw err;
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
    state.applying = false;
  }
}

checkForUpdate();
setInterval(checkForUpdate, CHECK_INTERVAL_MS);

module.exports = { state, checkForUpdate, applyUpdate, CLI_PATH, DOWNLOAD_URL };
