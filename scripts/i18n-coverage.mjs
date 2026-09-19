// Wie viel von der Oberfläche steht in welcher Sprache?
//
//     node scripts/i18n-coverage.mjs           Übersicht
//     node scripts/i18n-coverage.mjs fr        was auf Französisch noch fehlt
//
// Englisch ist die Quelle: jeder Schlüssel, den en.js hat, ist ein Text, den
// jemand sehen kann. Fehlt er in einer Sprache, zeigt die Seite den englischen
// Satz. Das ist eine Lücke und kein Fehler, aber eine, die man sehen können
// muss, sonst wird sie nie gefüllt.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "lib", "i18n");

async function load(lang) {
  const mod = await import(`file://${path.join(dir, `${lang}.js`)}`);
  return mod.default;
}

const alle = fs.readdirSync(dir)
  .filter(f => f.endsWith(".js") && !f.endsWith(".test.js"))
  .map(f => f.replace(/\.js$/, ""))
  .sort();

const en = await load("en");
const keys = Object.keys(en);
const nur = process.argv[2];

if (nur) {
  const dict = await load(nur);
  const fehlend = keys.filter(k => !(k in dict));
  console.log(`${nur}: ${keys.length - fehlend.length} von ${keys.length} übersetzt, ${fehlend.length} offen\n`);
  for (const k of fehlend) console.log(`  '${k}': ${JSON.stringify(en[k])},`);
  process.exit(0);
}

console.log(`Quelle: en.js mit ${keys.length} Texten\n`);
for (const lang of alle) {
  if (lang === "en") continue;
  const dict = await load(lang);
  const da = keys.filter(k => k in dict).length;
  const fremd = Object.keys(dict).filter(k => !(k in en));
  const anteil = Math.round((da / keys.length) * 100);
  const balken = "#".repeat(Math.round(anteil / 5)).padEnd(20, ".");
  console.log(`  ${lang}  ${balken} ${String(anteil).padStart(3)}%  ${da}/${keys.length}` +
    (fremd.length ? `  (${fremd.length} Schlüssel, die es in en.js nicht gibt: ${fremd.slice(0, 3).join(", ")})` : ""));
}
console.log(`\nWas in einer Sprache fehlt, fällt auf Englisch zurück.`);
console.log(`Die offenen Texte einer Sprache auflisten: node scripts/i18n-coverage.mjs <code>`);
