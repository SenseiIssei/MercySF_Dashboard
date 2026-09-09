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
