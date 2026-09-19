// Ein Takt, der ruht, solange niemand hinschaut.
//
// Die Seite fragte alle fünf Sekunden nach, auch wenn der Tab im Hintergrund
// lag oder das Telefon in der Tasche. Das kostet an beiden Enden: der Browser
// rechnet und funkt, der Server beantwortet Anfragen, die niemand liest, und
// auf einem schwachen Gerät ist genau das der Unterschied zwischen "läuft
// nebenbei" und "der Lüfter geht an".
//
// `document.hidden` beantwortet die Frage, ob jemand hinschaut, seit es
// Browser mit Tabs gibt. Beim Zurückkommen wird sofort einmal abgefragt, damit
// die Seite nicht erst nach einem Takt aufwacht.
//
// Eine eigene kleine Datei, weil vier Seiten dasselbe brauchen und ein
// Vergessen an einer davon nicht auffällt: es sieht ja alles richtig aus.

/**
 * Ruft `fn` im Abstand von `ms` auf, solange die Seite sichtbar ist.
 *
 * Gibt eine Funktion zurück, die den Takt beendet, wie `clearInterval`.
 */
export function pollWhileVisible(fn, ms, { runNow = false } = {}) {
  let timer = null;

  const laufen = () => {
    if (timer !== null) return;
    timer = setInterval(fn, ms);
  };
  const ruhen = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const beiSichtbarkeit = () => {
    if (document.hidden) {
      ruhen();
    } else {
      // Zuerst einmal fragen, dann wieder takten: sonst zeigt die Seite beim
      // Zurückkommen bis zu einem vollen Takt lang alte Zahlen.
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
      laufen();
    }
  };

  document.addEventListener('visibilitychange', beiSichtbarkeit);
  if (runNow) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }
  if (!document.hidden) laufen();

  return () => {
    document.removeEventListener('visibilitychange', beiSichtbarkeit);
    ruhen();
  };
}
