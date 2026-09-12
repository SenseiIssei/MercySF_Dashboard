const fs = require('fs');
const path = require('path');

// Eigene, kleine Datei statt eines vollen panelSettings.js-Äquivalents — der Node-Agent hat nur
// diesen einen konfigurierbaren Wert. Wird vom Dashboard per POST /stats-retention gepusht,
// sobald die Aufbewahrungsdauer dort geändert wird (siehe routes/panel-settings.js), damit ein
// Node auch bei getrenntem Netzwerk seine eigene stats.db nach der zuletzt bekannten Vorgabe
// bereinigt.
const FILE_PATH = path.join(__dirname, '..', 'data', 'stats-retention.json');

const DEFAULT_DAYS = 28;
const ALLOWED_DAYS = new Set([7, 14, 28, 90]);

function getDays() {
  if (!fs.existsSync(FILE_PATH)) return DEFAULT_DAYS;
  try {
    const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    return ALLOWED_DAYS.has(data.days) ? data.days : DEFAULT_DAYS;
  } catch (e) {
    return DEFAULT_DAYS;
  }
}

function setDays(days) {
  if (!ALLOWED_DAYS.has(days)) {
    throw new Error(`Unbekannte Aufbewahrungsdauer: ${days}`);
  }
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify({ days }));
  return days;
}

module.exports = { getDays, setDays, ALLOWED_DAYS };
