const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

// Kopie des Musters aus cliUpdate.js im selben Verzeichnis — dort steht die ausführliche
// Begründung für MD5-Vergleich + tmp-Download-dann-rename. Unterschied: die Binärdateien liegen
// nicht bei einem Drittanbieter (mercysf.app, für die CLI), sondern als GitHub-Release-Assets
// dieses Repos, siehe Task 1 im Implementierungsplan.
const BRIDGE_PATH = process.env.MERCY_SFAPI_BRIDGE_PATH || '/opt/mercy/mercy-sfapi-bridge';
const RELEASE_BASE = 'https://github.com/dandulox/MercySF_Dashboard/releases/latest/download';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function downloadUrlForArch(arch) {
  return arch === 'arm64'
    ? `${RELEASE_BASE}/mercy-sfapi-bridge-linux-arm64`
    : `${RELEASE_BASE}/mercy-sfapi-bridge-linux-x64`;
}

const DOWNLOAD_URL = downloadUrlForArch(os.arch());

const state = {
  checking: false,
  applying: false,
  updateAvailable: false,
  installed: fs.existsSync(BRIDGE_PATH),
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

// GitHub folgt bei /releases/latest/download/... mit einem 302 auf die echte Asset-URL — Node's
// https.get folgt Redirects nicht automatisch, daher hier von Hand (max. 5 Hops, wie curl -L).
function downloadToTemp(destDir, url = DOWNLOAD_URL, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(destDir || os.tmpdir(), `.mercy-sfapi-bridge-download-${Date.now()}`);
    const file = fs.createWriteStream(tmpPath);
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        file.close();
        fs.unlink(tmpPath, () => {});
        resolve(downloadToTemp(destDir, res.headers.location, redirectsLeft - 1));
        return;
      }
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

async function checkForUpdate() {
  if (state.checking) return state;
  state.checking = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp();
    const remoteHash = await md5OfFile(tmpPath);
    const currentHash = fs.existsSync(BRIDGE_PATH) ? await md5OfFile(BRIDGE_PATH) : null;
    state.remoteHash = remoteHash;
    state.currentHash = currentHash;
    state.updateAvailable = currentHash !== null && currentHash !== remoteHash;
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
  const firstInstall = !fs.existsSync(BRIDGE_PATH);
  if (!firstInstall && !state.updateAvailable) throw new Error('Kein Update verfügbar');
  state.applying = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp(path.dirname(BRIDGE_PATH));
    const freshHash = await md5OfFile(tmpPath);
    if (state.remoteHash && freshHash !== state.remoteHash) {
      throw new Error('Heruntergeladene Datei weicht vom zuletzt geprüften Stand ab, breche ab');
    }
    if (fs.existsSync(BRIDGE_PATH)) {
      fs.copyFileSync(BRIDGE_PATH, `${BRIDGE_PATH}.bak`);
    }
    try {
      fs.renameSync(tmpPath, BRIDGE_PATH);
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      fs.copyFileSync(tmpPath, BRIDGE_PATH);
      fs.unlinkSync(tmpPath);
    }
    fs.chmodSync(BRIDGE_PATH, 0o755);
    tmpPath = null;
    state.installed = true;
    state.updateAvailable = false;
    state.currentHash = freshHash;
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
// unref(): a pending 24h interval must not keep the process (or a `node --test` run that merely
// requires this module) alive — same reasoning would apply to cliUpdate.js's identical interval,
// just not yet hit there because no test file requires it directly.
setInterval(checkForUpdate, CHECK_INTERVAL_MS).unref();

module.exports = { state, checkForUpdate, applyUpdate, BRIDGE_PATH, DOWNLOAD_URL, downloadUrlForArch };
