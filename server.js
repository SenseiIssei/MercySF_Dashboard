const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { findDataDir, listAccounts, listRemoteAccounts, latestSnapshot, recentLogLines, isProcessRunning, accountIdFor } = require('./lib/data');
const logBuffer = require('./lib/logBuffer');
const authStore = require('./lib/authStore');
const sessionStore = require('./lib/sessionStore');
const accountsRegistry = require('./lib/accountsRegistry');
const ptyManager = require('./lib/ptyManager');
require('./lib/statsCollector');
require('./lib/telemetry');
require('./lib/marketplaceLinkSync');
require('./lib/randomizer');

const app = express();
const PORT = process.env.PORT || 8080;
// An welche Adresse gebunden wird. Voreinstellung wie bisher: alle Schnittstellen,
// weil das Dashboard normalerweise auf einem Server steht, den man von anderswo
// aufruft.
//
// `HOST=127.0.0.1` ist der Fall, für den das hier steht: ein Test auf einer
// Maschine, auf der auch etwas anderes läuft. Dann ist die Seite ausschließlich
// über einen SSH-Tunnel erreichbar und nicht aus dem Netz, und niemand muss dafür
// eine Firewall-Regel anfassen, die danach jemand wieder vergisst.
const HOST = process.env.HOST || '0.0.0.0';

// Welche Pfade ohne Anmeldung durchgehen, steht in lib/publicPaths.js: dort
// liest ein Test sie gegen das, was setup.html und login.html tatsächlich laden.
const { isPublicPath } = require('./lib/publicPaths');

function hasValidSession(req) {
  return sessionStore.isValid(sessionStore.readSessionCookie(req));
}

app.use((req, res, next) => {
  if (isPublicPath(req.path)) return next();

  if (req.path.startsWith('/api/')) {
    if (!hasValidSession(req)) return res.status(401).json({ error: 'Nicht angemeldet' });
    return next();
  }

  if (!authStore.hasAccess()) return res.redirect('/setup.html');
  if (!hasValidSession(req)) return res.redirect('/login.html');
  next();
});

const dashboardVersion = require('./package.json').version;

app.get('/api/status', (req, res) => {
  const dataDir = findDataDir();
  res.json({ dataDir, botRunning: isProcessRunning(), version: dashboardVersion });
});

function profileForAccountId(accountId) {
  return accountsRegistry.list().find(p =>
    p.server && p.characterName && accountIdFor(p.server, p.characterName) === accountId);
}

function characterClassFor(accountId) {
  const profile = profileForAccountId(accountId);
  return profile ? (profile.characterClass || null) : null;
}

function pausedFor(accountId) {
  const profile = profileForAccountId(accountId);
  return !!(profile && profile.pausedKeys && profile.pausedKeys.length);
}

app.get('/api/accounts', async (req, res) => {
  const dataDir = findDataDir();
  const localAccounts = dataDir ? listAccounts(dataDir).map(acc => ({
    ...acc,
    stats: latestSnapshot(dataDir, acc.id),
    currentActivity: logBuffer.getLastActivity(acc.charName),
    characterClass: characterClassFor(acc.id),
    paused: pausedFor(acc.id),
  })) : [];
  const remoteAccounts = await listRemoteAccounts();
  const remoteAccountsWithClass = remoteAccounts.map(acc => ({ ...acc, characterClass: characterClassFor(acc.id), paused: pausedFor(acc.id) }));
  res.json([...localAccounts, ...remoteAccountsWithClass]);
});

app.get('/api/account/:id/logs', (req, res) => {
  const dataDir = findDataDir();
  const acc = dataDir ? listAccounts(dataDir).find(a => a.id === req.params.id) : null;
  if (!acc) {
    // Kein lokaler Treffer — entweder unbekannter Account (404) oder einer, der auf einem Node
    // läuft: dessen PTY-Output läuft nicht durch den lokalen logBuffer, das Activity-Log bleibt
    // für Node-Accounts vorerst leer statt einen Fehler zu werfen.
    const profile = accountsRegistry.list().find(p => p.server && p.characterName && accountIdFor(p.server, p.characterName) === req.params.id);
    if (profile && profile.nodeId) return res.json([]);
    return res.status(404).json([]);
  }
  const fileLines = recentLogLines(dataDir, acc.charName);
  // Diese Linux-Builds der CLI schreiben keine Log-Dateien auf die Platte — Fallback auf
  // den Live-Ringpuffer aus dem PTY-Output der eingebauten Konsole (routes/console.js).
  const lines = fileLines.length ? fileLines : logBuffer.getRecentLines(acc.charName);
  res.json(lines);
});

app.use(express.static(path.join(__dirname, 'public')));

const certPath = process.env.SSL_CERT || '/opt/mercy/certs/cert.pem';
const keyPath = process.env.SSL_KEY || '/opt/mercy/certs/key.pem';
const useTls = fs.existsSync(certPath) && fs.existsSync(keyPath);

const httpServer = useTls
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);

const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.js')) continue;
    const name = file.replace(/\.js$/, '');
    const mod = require(path.join(routesDir, file));
    if (typeof mod === 'function') {
      app.use(`/api/${name}`, mod);
      console.log(`Mounted route module '${name}' at /api/${name}`);
    } else if (mod && typeof mod.attach === 'function') {
      mod.attach(httpServer, app);
      console.log(`Attached module '${name}'`);
    }
  }
}

// Startet Charaktere, die beim letzten Stop/Neustart noch als "gestartet" markiert waren,
// automatisch wieder — sonst müsste man nach jedem Server-/Dashboard-Neustart (Update, Reboot,
// Absturz) jeden Account manuell erneut anklicken. Läuft zeitversetzt statt alle auf einmal,
// damit nicht 20+ CLI-Prozesse gleichzeitig gegen den Spieleserver einloggen.
function restoreAutoStartedProfiles() {
  const toStart = accountsRegistry.list().filter(p => p.autoStart);
  toStart.forEach((profile, i) => {
    setTimeout(() => {
      console.log(`[autostart] starte ${profile.nickname || profile.id} (${i + 1}/${toStart.length})`);
      ptyManager.ensurePty(profile.id);
    }, i * 4000);
  });
  if (toStart.length) console.log(`[autostart] ${toStart.length} zuletzt laufende Charakter(e) werden gestaffelt neu gestartet`);
}

httpServer.listen(PORT, HOST, () => {
  console.log(`Mercy Dashboard (${useTls ? 'HTTPS' : 'HTTP'}) listening on ${HOST}:${PORT}`);
  console.log(`Resolved data dir: ${findDataDir() || '(none found yet)'}`);
  restoreAutoStartedProfiles();
});
