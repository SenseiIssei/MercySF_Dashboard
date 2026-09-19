import de from './i18n/de.js';
import en from './i18n/en.js';
import cs from './i18n/cs.js';
import es from './i18n/es.js';
import fr from './i18n/fr.js';
import it from './i18n/it.js';
import ja from './i18n/ja.js';
import pl from './i18n/pl.js';
import ru from './i18n/ru.js';
import zh from './i18n/zh.js';

const DICTS = { en, de, cs, es, fr, it, ja, pl, ru, zh };

/**
 * Die Sprachen, jede unter ihrem eigenen Namen.
 *
 * Unter dem eigenen Namen und nicht unter dem deutschen oder englischen: wer
 * eine Oberflaeche in einer Sprache sucht, die er nicht lesen kann, findet
 * "Tschechisch" nicht, "Cestina" aber schon. Und keine Flaggen: eine Flagge ist
 * ein Land und keine Sprache.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'cs', name: 'Čeština' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
];
const STORAGE_KEY = 'mercy-lang';

let activeLang = 'en';
const listeners = new Set();

// Englisch ist die Voreinstellung, und jede Sprache, die der Browser meldet und
// die es hier gibt, gewinnt dagegen. Frueher gab es nur zwei, und alles ausser
// Deutsch landete auf Englisch; seit es zehn sind, waere das eine Seite in der
// falschen Sprache fuer jemanden, dessen Sprache danebenliegt.
function detectBrowserLang() {
  const raw = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return DICTS[raw] ? raw : 'en';
}

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce(
    (acc, key) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key])),
    str
  );
}

export function t(key, vars) {
  const dict = DICTS[activeLang] || DICTS.en;
  const raw = dict[key] ?? DICTS.en[key] ?? key;
  return interpolate(raw, vars);
}

export function getLanguage() {
  return activeLang;
}

export function onLanguageChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

function applyLang(lang) {
  activeLang = DICTS[lang] ? lang : 'en';
  document.documentElement.setAttribute('lang', activeLang);
  applyTranslations(document);
  listeners.forEach(cb => cb(activeLang));
}

export async function initI18nAuthenticated(fetchJSON) {
  let lang = null;
  try {
    const data = await fetchJSON('/api/panel-settings');
    lang = data.language || null;
  } catch (e) { /* server not reachable yet — fall back below */ }

  if (!lang) {
    lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
    try {
      await fetchJSON('/api/panel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
    } catch (e) { /* non-fatal — language still applies locally this session */ }
  }
  applyLang(lang);
}

export async function setLanguageAuthenticated(lang, fetchJSON) {
  applyLang(lang);
  await fetchJSON('/api/panel-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang }),
  });
}

export function initI18nLocal() {
  const lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
  applyLang(lang);
}

export function setLanguageLocal(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  applyLang(lang);
}
