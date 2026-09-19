// Was jemand sehen darf, der noch nicht angemeldet ist.
//
// Genau zwei Seiten und das, was diese beiden Seiten zum Anzeigen brauchen.
// Alles andere läuft in die Weiterleitung auf die Anmeldung.
//
// Die Liste steht in einem eigenen Modul, weil sie sonst nur im Serverstart
// existiert und niemand sie prüfen kann, ohne den Server zu starten. Der Test
// daneben liest die beiden HTML-Dateien und vergleicht, was sie laden, mit dem,
// was hier steht.
//
// Warum das nötig war: `/style.css` fehlte. Eine Anfrage danach lief in die
// Weiterleitung, der Browser bekam HTML statt CSS, und damit war keine einzige
// Farbe und keine Schrift definiert. Die Setup-Seite sah aus wie ein Formular
// aus dem Jahr 1996: unsichtbare Eingabefelder, ein leerer Knopf, ein Kästchen
// statt des Symbols.
//
// Auffallen konnte das kaum: wer sich einmal angemeldet hat, hat die Datei im
// Browser-Zwischenspeicher, und ab da sieht die Seite für ihn immer richtig
// aus. Kaputt ist sie nur für den, der sie zum ersten Mal sieht.
const PUBLIC_PAGE_PATHS = new Set([
  '/setup.html',
  '/login.html',
  '/setup.js',
  '/login.js',
  // Enthält keine Daten, nur Aussehen. Ohne sie sind die beiden Seiten
  // unbenutzbar, und zwar ausgerechnet beim ersten Besuch.
  '/style.css',
]);

// Gemeinsame statische Bausteine (i18n-Wörterbücher, kleine Helfer im Browser,
// keine Daten), die login.js und setup.js als Module laden. Ohne diesen Präfix
// bekämen sie HTML statt JavaScript, und der Browser weigert sich, das
// auszuführen.
const PUBLIC_PATH_PREFIXES = ['/lib/'];

const PUBLIC_API_PREFIXES = [
  '/api/auth/status',
  '/api/auth/setup',
  '/api/auth/login',
  '/api/auth/reset',
];

function isPublicPath(pathname) {
  return (
    PUBLIC_PAGE_PATHS.has(pathname) ||
    PUBLIC_PATH_PREFIXES.some(p => pathname.startsWith(p)) ||
    PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))
  );
}

module.exports = { PUBLIC_PAGE_PATHS, PUBLIC_PATH_PREFIXES, PUBLIC_API_PREFIXES, isPublicPath };
