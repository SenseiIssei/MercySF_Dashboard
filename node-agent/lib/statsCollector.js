const profileStore = require('./profileStore');
const { findDataDir, latestSnapshot, accountIdFor } = require('./dataDir');
const statsDb = require('./statsDb');
const statsRetention = require('./statsRetention');

// Angepasste Kopie von MercySF_Dashboard/lib/statsCollector.js — läuft über profileStore statt
// accountsRegistry, sonst identisch: schreibt minütlich den aktuellsten Snapshot jedes Profils
// mit bekanntem Server+Charakter in die lokale stats.db.
function collectOnce() {
  const dataDir = findDataDir();
  if (!dataDir) return;
  for (const profile of profileStore.list()) {
    if (!profile.server || !profile.characterName) continue;
    const accountId = accountIdFor(profile.server, profile.characterName);
    const snapshot = latestSnapshot(dataDir, accountId);
    if (!snapshot) continue;
    try {
      statsDb.insertSnapshot(accountId, snapshot);
    } catch (err) {
      console.error('[statsCollector] Snapshot konnte nicht gespeichert werden:', err.message);
    }
  }
}

// Identische Ergänzung zu MercySF_Dashboard/lib/statsCollector.js — nutzt die zuletzt vom
// Dashboard gepushte Aufbewahrungsdauer (siehe statsRetention.js), damit die lokale stats.db
// auch bei getrenntem Dashboard weiter bereinigt wird.
function pruneOnce() {
  try {
    const days = statsRetention.getDays();
    const { deletedSnapshots, deletedActions } = statsDb.pruneOlderThan(days);
    if (deletedSnapshots || deletedActions) {
      console.log(`[statsCollector] ${deletedSnapshots} Snapshot(s) und ${deletedActions} Aktion(en) älter als ${days} Tage gelöscht`);
    }
  } catch (err) {
    console.error('[statsCollector] Bereinigung fehlgeschlagen:', err.message);
  }
}

collectOnce();
setInterval(collectOnce, 60 * 1000);
pruneOnce();
setInterval(pruneOnce, 24 * 60 * 60 * 1000);

module.exports = { collectOnce, pruneOnce };
