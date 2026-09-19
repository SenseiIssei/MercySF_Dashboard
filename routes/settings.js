const express = require('express');
const path = require('path');
const fs = require('fs');
const { findDataDir, findProfileByAccountId } = require('../lib/data');
const { splitUpdates } = require('../lib/settingsSplit');
const settingsDefaults = require('../lib/settingsDefaults');
const credentialStore = require('../lib/credentialStore');
const cli = require('../lib/cliExec');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

function remoteNodeFor(profile) {
  if (!profile || !profile.nodeId) return null;
  return nodeRegistry.get(profile.nodeId);
}

function characterFilePath(accountId) {
  const dataDir = findDataDir();
  if (!dataDir) { const e = new Error('Kein Datenverzeichnis gefunden'); e.status = 404; throw e; }
  return path.join(dataDir, 'characters', `${accountId}.json`);
}

function readFile(accountId) {
  const filePath = characterFilePath(accountId);
  if (!fs.existsSync(filePath)) { const e = new Error('Keine Einstellungen für diesen Account'); e.status = 404; throw e; }
  try {
    return { filePath, settings: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (e) {
    const err = new Error('Einstellungen konnten nicht gelesen werden');
    err.status = 500;
    throw err;
  }
}

// Schreibt die Felder, für die die CLI keinen --set-Weg anbietet, direkt in die Config-Datei.
// Fehlt die Datei noch (die CLI legt sie für einen Charakter erst an, wenn sie selbst etwas
// daran ändert), wird sie aus der eben gelesenen CLI-Vollkonfiguration erzeugt, statt das
// Speichern mit "Keine Einstellungen für diesen Account" abzubrechen — der vollständige,
// gültige Stand ist an dieser Stelle bekannt, es fehlt nur die Datei auf der Platte. Gleiches
// Vorgehen wie beim Anwenden einer Vorlage (routes/settings-templates.js).
function writeFileUpdates(accountId, fileUpdates, cliConfig) {
  const filePath = characterFilePath(accountId);
  let current;
  if (fs.existsSync(filePath)) {
    ({ settings: current } = readFile(accountId));
  } else {
    current = { ...cliConfig };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  Object.assign(current, fileUpdates);
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
}

// Die CLI-Config-Datei bleibt weiterhin der Fallback, wenn für den Account kein Passwort
// gespeichert ist (reine Konsolen-Logins ohne Autofill) — ohne Passwort können wir die CLI
// nicht nicht-interaktiv aufrufen, also bleibt es bei direktem Datei-Zugriff wie bisher.
router.get('/:accountId', async (req, res) => {
  const profile = findProfileByAccountId(req.params.accountId);
  const node = remoteNodeFor(profile);
  if (node) {
    try {
      const result = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/settings`, { timeoutMs: 15000 });
      settingsDefaults.learnFrom(result.config);
      return res.json(result.config);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  const password = profile && credentialStore.getPassword(profile.username);

  if (profile && password) {
    try {
      const result = await cli.runCli(cli.buildArgs(profile, ['--config']), { password });
      settingsDefaults.learnFrom(result.config);
      return res.json(result.config);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  try {
    const { settings } = readFile(req.params.accountId);
    settingsDefaults.learnFrom(settings);
    res.json(settings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:accountId', express.json(), async (req, res) => {
  const updates = req.body || {};
  const profile = findProfileByAccountId(req.params.accountId);
  const node = remoteNodeFor(profile);
  if (node) {
    try {
      const merged = await nodeClient.call(node, `/profiles/${encodeURIComponent(profile.id)}/settings`, { method: 'PUT', body: updates, timeoutMs: 15000 });
      settingsDefaults.learnFrom(merged);
      return res.json(merged);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }

  const password = profile && credentialStore.getPassword(profile.username);

  if (profile && password) {
    try {
      const current = await cli.runCli(cli.buildArgs(profile, ['--config']), { password });
      const config = current.config;
      const { settableUpdates, fileUpdates, rejected } =
        splitUpdates(updates, config, current.settable, current.settable_numbers);
      if (rejected.length) {
        return res.status(400).json({ error: `Unbekannte oder typinkompatible Felder: ${rejected.join(', ')}` });
      }

      const merged = { ...config };

      // Offiziell unterstützter Weg für die von der CLI selbst als "settable" gemeldeten
      // auto_*-Schalter — läuft über einen echten Login-Roundtrip statt die Config-Datei direkt
      // anzufassen.
      if (Object.keys(settableUpdates).length) {
        const setArgs = [];
        for (const [key, value] of Object.entries(settableUpdates)) setArgs.push('--set', `${key}=${value}`);
        const result = await cli.runCli(cli.buildArgs(profile, ['--config', ...setArgs]), { password });
        for (const change of result.changed || []) merged[change.key] = change.to;
      }

      // Für alles, was die CLI weiterhin nicht selbst setzen kann — Texte, Zahlen
      // außerhalb ihrer Bereiche, Booleans außerhalb der settable-Liste — bleibt
      // der direkte Datei-Zugriff der Fallback.
      if (Object.keys(fileUpdates).length) {
        writeFileUpdates(req.params.accountId, fileUpdates, config);
        Object.assign(merged, fileUpdates);
      }

      settingsDefaults.learnFrom(merged);
      return res.json(merged);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
  }

  try {
    const { filePath, settings: current } = readFile(req.params.accountId);
    const allowedKeys = new Set(Object.keys(current));
    const rejected = [];
    for (const key of Object.keys(updates)) {
      if (!allowedKeys.has(key)) { rejected.push(key); continue; }
      if (typeof current[key] !== typeof updates[key]) { rejected.push(key); continue; }
      current[key] = updates[key];
    }
    if (rejected.length) {
      return res.status(400).json({ error: `Unbekannte oder typinkompatible Felder: ${rejected.join(', ')}` });
    }
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
    settingsDefaults.learnFrom(current);
    res.json(current);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
