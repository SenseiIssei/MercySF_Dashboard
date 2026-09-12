const express = require('express');
const panelSettings = require('../lib/panelSettings');
const statsDb = require('../lib/statsDb');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    current: panelSettings.getPresetKey(),
    presets: Object.entries(panelSettings.PRESETS).map(([key, p]) => ({ key, label: p.label, ms: p.ms })),
    language: panelSettings.getLanguage(),
    uiVersion: panelSettings.getUiVersion(),
    statsRetentionDays: panelSettings.getStatsRetentionDays(),
    statsRetentionOptions: [...panelSettings.STATS_RETENTION_DAYS].sort((a, b) => a - b),
  });
});

// Pusht die neue Aufbewahrungsdauer best-effort an jeden gepairten Node — jeder Node führt seine
// eigene stats.db (siehe node-agent/lib/statsDb.js) und muss sie selbst bereinigen, ein
// nicht erreichbarer Node darf die Einstellung fürs Dashboard und die übrigen Nodes nicht blockieren.
async function propagateRetentionToNodes(days) {
  const nodes = nodeRegistry.list();
  await Promise.all(nodes.map(node =>
    nodeClient.call(node, '/stats-retention', { method: 'POST', body: { days }, timeoutMs: 8000 }).catch(() => {})
  ));
}

router.post('/', express.json(), async (req, res) => {
  const { preset, language, uiVersion, statsRetentionDays } = req.body || {};
  try {
    const result = { ok: true };
    if (preset !== undefined) result.current = panelSettings.setPreset(preset);
    if (language !== undefined) result.language = panelSettings.setLanguage(language);
    if (uiVersion !== undefined) result.uiVersion = panelSettings.setUiVersion(uiVersion);
    if (statsRetentionDays !== undefined) {
      result.statsRetentionDays = panelSettings.setStatsRetentionDays(Number(statsRetentionDays));
      result.pruned = statsDb.pruneOlderThan(result.statsRetentionDays);
      propagateRetentionToNodes(result.statsRetentionDays); // best-effort, nicht abwarten
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
