export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Randomizer-Pläne (routes/randomizer.js `GET /plan/:username`) geben Zeiten als Minuten seit
// Mitternacht (lokale Zeit der konfigurierten Zeitzone) — hier nur fürs Anzeigen in HH:MM
// umgerechnet, keine Zeitzonen-Konvertierung nötig, da der Randomizer bereits in "Minuten des
// konfigurierten Tages" rechnet und der Browser dieselbe Uhrzeit anzeigen soll wie der Server.
export function fmtMinutesAsTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Kompakte "Feinstatistik"-Box fürs Hover-Tooltip auf einem Charakternamen — nutzt den
// analytics-Snapshot, den `/api/accounts` bereits pro Account mitliefert (`acc.stats`), keine
// zusätzliche Anfrage nötig.
export function statsTooltipRows(acc, t) {
  const s = acc.stats;
  if (!s) return [[t('v2.tooltipNoData'), '']];
  const rows = [];
  if (s.level != null) rows.push([t('v2.tooltipLevel'), String(s.level)]);
  if (acc.characterClass) rows.push([t('v2.tooltipClass'), acc.characterClass]);
  if (s.experience != null) rows.push([t('v2.tooltipExperience'), s.experience.toLocaleString('de-DE')]);
  if (s.silver != null) rows.push([t('v2.tooltipSilver'), s.silver.toLocaleString('de-DE')]);
  if (s.honor != null) rows.push([t('v2.tooltipHonor'), s.honor.toLocaleString('de-DE')]);
  if (s.rank != null) rows.push([t('v2.tooltipRank'), String(s.rank)]);
  if (s.mushrooms != null) rows.push([t('v2.tooltipMushrooms'), String(s.mushrooms)]);
  return rows.length ? rows : [[t('v2.tooltipNoData'), '']];
}

// Alle für heute geplanten Zeitfenster eines Accounts (Blöcke + Stadtwache-Pulse), sortiert und
// als "HH:MM–HH:MM"-Strings formatiert — für die vollständige Tagesübersicht im Hover-Tooltip,
// nicht nur das aktuelle/nächste Fenster wie currentOrNextWindow().
export function formatPlanBlocks(plan, stadtwacheDurationMin = 5, t = null) {
  if (!plan) return [];
  const windows = [
    ...(plan.blocks || []).map(b => ({ start: b.start, end: b.end })),
    ...(plan.stadtwache || []).map(s => ({ start: s.at, end: s.at + stadtwacheDurationMin, stadtwache: true })),
  ].sort((a, b) => a.start - b.start);
  const stadtwacheLabel = t ? t('v2.tooltipStadtwache') : 'Stadtwache';
  return windows.map(w => `${fmtMinutesAsTime(w.start)}–${fmtMinutesAsTime(w.end)}${w.stadtwache ? ` (${stadtwacheLabel})` : ''}`);
}

// Findet aus einem Randomizer-Tagesplan (Blöcke + Stadtwache-Pulse) das gerade laufende Fenster
// oder, falls keins läuft, das nächste anstehende — für eine kompakte Anzeige pro Account.
// Rückgabe: { active: bool, start, end } in Minuten, oder null wenn für heute nichts (mehr)
// geplant ist.
export function currentOrNextWindow(plan, stadtwacheDurationMin = 5) {
  if (!plan) return null;
  const now = nowMinutes();
  const windows = [
    ...(plan.blocks || []).map(b => ({ start: b.start, end: b.end })),
    ...(plan.stadtwache || []).map(s => ({ start: s.at, end: s.at + stadtwacheDurationMin })),
  ].sort((a, b) => a.start - b.start);

  const active = windows.find(w => w.start <= now && now < w.end);
  if (active) return { active: true, ...active };
  const next = windows.find(w => w.start > now);
  if (next) return { active: false, ...next };
  return null;
}
