const { spawn } = require('child_process');
const bridgeUpdate = require('./sfapiBridgeUpdate');

// Läuft als Kindprozess des Node-Agent, genau wie ptyManager.js es für CLI-Sessions tut — stirbt
// und startet mit dem Node-Agent-Prozess selbst (systemd Restart=on-failure deckt beide ab), kein
// eigener systemd-Service nötig. Bindet an 127.0.0.1:4001, identisch zum Port, den die Bridge auf
// dem Haupt-Dashboard-Server nutzt (siehe routes/gamestate.js dort) — kein Konfliktrisiko, weil
// jeder Node sein eigenes localhost hat.
let child = null;
let running = false;
let restarting = false;

function start() {
  if (!bridgeUpdate.state.installed || child) return;
  child = spawn(bridgeUpdate.BRIDGE_PATH, [], { stdio: 'inherit' });
  running = true;
  child.on('exit', () => {
    running = false;
    child = null;
    // Kurze Verzögerung gegen Crash-Loop-Spam, falls das Binär z. B. wegen falscher
    // CPU-Architektur sofort wieder abstürzt.
    if (!restarting) {
      restarting = true;
      setTimeout(() => { restarting = false; start(); }, 3000).unref();
    }
  });
}

function isRunning() {
  return running;
}

module.exports = { start, isRunning };
