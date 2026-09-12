const registry = require('./accountsRegistry');
const { findDataDir, latestSnapshot, accountIdFor } = require('./data');
const statsDb = require('./statsDb');
const panelSettings = require('./panelSettings');

function collectOnce() {
  const dataDir = findDataDir();
  if (!dataDir) return;
  for (const profile of registry.list()) {
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

// Löscht Snapshots/Aktionen, die älter sind als die konfigurierte Aufbewahrungsdauer — ein
// direkter Aufruf über /api/panel-settings (Ändern der Einstellung) wirkt sofort, das hier ist
// nur das laufende Bereinigen für die Tage danach.
function pruneOnce() {
  try {
    const days = panelSettings.getStatsRetentionDays();
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
