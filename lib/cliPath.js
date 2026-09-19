// Wo die CLI liegt und aus welchem Verzeichnis sie läuft.
//
// Eine Stelle, weil es vier waren. `cliExec` rief sie auf, `ptyManager` startete
// sie im Terminal, `discoveryLogin` noch einmal für die Charaktersuche, und
// `cliUpdate` überschrieb die Datei beim Update - jeder mit demselben Pfad als
// Buchstabenfolge im eigenen Kopf. Solange alle vier gleich lauten, fällt das
// nicht auf. Ändert jemand eine davon, tauscht das Update die eine Datei aus,
// während das Dashboard weiter die andere aufruft, und die Version im Fenster
// ist danach eine andere als die, die spielt.
//
// Die beiden Umgebungsvariablen sind dieselben, die der Node-Agent seit jeher
// liest (`node-agent/lib/cliExec.js`). Ein Node-Only-Install liegt nicht
// zwangsläufig unter /opt/mercy, und ein Test gegen eine zweite Installation
// soll kein Patch an einer Konstante sein: ein Patch an einer Konstante landet
// früher oder später im Commit.
const CLI_PATH = process.env.MERCY_CLI_PATH || '/opt/mercy/mercy-cli-linux-x64';
const CWD = process.env.MERCY_CLI_CWD || '/opt/mercy';

module.exports = { CLI_PATH, CWD };
