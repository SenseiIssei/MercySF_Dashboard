const fs = require('fs');
const path = require('path');

// Globale (nicht pro Account) Panel-Einstellungen — Abfrage-Intervall für die
// sf-api-Bridge (Ausrüstung/Spielstand) und die UI-Sprache. Bewusst nur vordefinierte
// Intervalle erlaubt statt freier Eingabe, um versehentlich zu aggressive Abfrage-Raten
// (Ban-Risiko) zu vermeiden.
const FILE_PATH = path.join(__dirname, '..', 'data', 'panel-settings.json');

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // bisheriges festes Verhalten

const PRESETS = {
  default: { label: 'Standard (alle 10 Minuten)', ms: DEFAULT_INTERVAL_MS },
  hourly: { label: '1x pro Stunde', ms: 60 * 60 * 1000 },
  daily: { label: '1x pro Tag', ms: 24 * 60 * 60 * 1000 },
};

const LANGUAGES = new Set(['de', 'en']);

const UI_VERSIONS = new Set(['v1', 'v2']);

const DEFAULT_STATS_RETENTION_DAYS = 28;
const STATS_RETENTION_DAYS = new Set([7, 14, 28, 90]);

function readFile() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

function getPresetKey() {
  const data = readFile();
  return PRESETS[data.gamestatePollPreset] ? data.gamestatePollPreset : 'default';
}

function getIntervalMs() {
  return PRESETS[getPresetKey()].ms;
}

function setPreset(presetKey) {
  if (!PRESETS[presetKey]) {
    throw new Error(`Unbekanntes Intervall-Preset: ${presetKey}`);
  }
  const data = readFile();
  data.gamestatePollPreset = presetKey;
  writeFile(data);
  return presetKey;
}

function getLanguage() {
  const data = readFile();
  return LANGUAGES.has(data.language) ? data.language : null;
}

function setLanguage(lang) {
  if (!LANGUAGES.has(lang)) {
    throw new Error(`Unbekannte Sprache: ${lang}`);
  }
  const data = readFile();
  data.language = lang;
  writeFile(data);
  return lang;
}

function getUiVersion() {
  const data = readFile();
  return UI_VERSIONS.has(data.uiVersion) ? data.uiVersion : 'v1';
}

function setUiVersion(version) {
  if (!UI_VERSIONS.has(version)) {
    throw new Error(`Unbekannte UI-Version: ${version}`);
  }
  const data = readFile();
  data.uiVersion = version;
  writeFile(data);
  return version;
}

function getStatsRetentionDays() {
  const data = readFile();
  return STATS_RETENTION_DAYS.has(data.statsRetentionDays) ? data.statsRetentionDays : DEFAULT_STATS_RETENTION_DAYS;
}

function setStatsRetentionDays(days) {
  if (!STATS_RETENTION_DAYS.has(days)) {
    throw new Error(`Unbekannte Aufbewahrungsdauer: ${days}`);
  }
  const data = readFile();
  data.statsRetentionDays = days;
  writeFile(data);
  return days;
}

module.exports = {
  PRESETS, getPresetKey, getIntervalMs, setPreset, getLanguage, setLanguage, getUiVersion, setUiVersion,
  STATS_RETENTION_DAYS, getStatsRetentionDays, setStatsRetentionDays,
};
