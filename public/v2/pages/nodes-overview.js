function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function accountStatusLabel(acc) {
  if (acc.running) return acc.currentActivity ? acc.currentActivity : 'Läuft';
  return 'Gestoppt';
}

export default {
  id: 'nodes-overview',
  label: 'Node-Übersicht',
  icon: '🖧',
  mount(container, ctx) {
    ctx.injectStyleOnce('nodes-overview', `
      .v2-node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    `);

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="v2-node-grid" id="v2-node-grid"><div class="v2-empty">Lade…</div></div>`;
    container.appendChild(wrap);

    async function load() {
      const grid = wrap.querySelector('#v2-node-grid');
      let nodes, accounts;
      try {
        [nodes, accounts] = await Promise.all([
          ctx.fetchJSON('/api/nodes'),
          ctx.fetchJSON('/api/accounts'),
        ]);
      } catch (err) {
        grid.innerHTML = `<div class="v2-empty">Fehler beim Laden: ${escapeHtml(err.message)}</div>`;
        return;
      }
      if (!nodes.length) {
        grid.innerHTML = `<div class="v2-empty">Noch keine Nodes gepairt.</div>`;
        return;
      }

      const vpnTargets = await ctx.fetchJSON('/api/vpn/targets').catch(() => []);
      const vpnByTarget = new Map(vpnTargets.map(vt => [vt.targetId, vt]));

      const accountsByNode = new Map();
      accounts.forEach(acc => {
        const key = acc.nodeId || null;
        if (!accountsByNode.has(key)) accountsByNode.set(key, []);
        accountsByNode.get(key).push(acc);
      });

      grid.innerHTML = nodes.map(n => {
        const vpn = vpnByTarget.get(n.id);
        const vpnConnected = !!vpn?.lastStatus?.connected;
        const nodeAccounts = accountsByNode.get(n.isLocal ? null : n.id) || [];
        return `
          <div class="v2-card" data-id="${n.id}">
            <div class="v2-card-header">
              <div class="v2-card-title">
                <span class="v2-dot" data-role="dot"></span>
                ${escapeHtml(n.name)}
              </div>
              <span class="v2-badge${vpnConnected ? ' vpn-active' : ''}">${vpnConnected ? 'VPN aktiv' : 'VPN inaktiv'}</span>
            </div>
            <div class="v2-metrics" data-role="metrics">Lade Auslastung…</div>
            <div data-role="accounts">
              ${nodeAccounts.length
                ? nodeAccounts.map(acc => `
                  <div class="v2-account-row">
                    <span class="v2-dot ${acc.running ? 'online' : 'offline'}"></span>
                    <span class="char-name">${escapeHtml(acc.charName)}</span>
                    <span class="v2-account-activity">${escapeHtml(accountStatusLabel(acc))}</span>
                  </div>
                `).join('')
                : '<div class="v2-empty">Keine Accounts auf diesem Node.</div>'}
            </div>
          </div>
        `;
      }).join('');

      // Live-Ping pro Node-Karte, unabhängig vom restlichen Rendering.
      nodes.forEach(n => {
        ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/ping`, { method: 'POST' })
          .then(result => {
            const dot = grid.querySelector(`.v2-card[data-id="${n.id}"] [data-role="dot"]`);
            if (dot) dot.className = 'v2-dot ' + (result.online ? 'online' : 'offline');
          })
          .catch(() => {});
      });

      // System-Stats + Update-Status pro Node, best-effort.
      nodes.forEach(n => {
        const metricsEl = grid.querySelector(`.v2-card[data-id="${n.id}"] [data-role="metrics"]`);
        Promise.all([
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/system/stats`).catch(() => null),
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/cli/status`).catch(() => null),
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/self-update/status`).catch(() => null),
        ]).then(([stats, cli, agent]) => {
          const parts = [];
          if (stats) {
            const load = (stats.loadAvg && stats.loadAvg[0] != null) ? stats.loadAvg[0].toFixed(2) : '?';
            parts.push(`🧠 Load ${load} (${stats.cpuCount} Kerne)`);
            parts.push(`💾 RAM ${stats.memUsedPercent}%`);
            parts.push(`⏱ ${fmtUptime(stats.uptimeSec)}`);
          } else {
            parts.push('Auslastung nicht verfügbar');
          }
          if (cli) parts.push(cli.updateAvailable ? '⚠ CLI-Update verfügbar' : '✓ CLI aktuell');
          if (agent) parts.push(agent.updateAvailable ? '⚠ Node-Agent-Update verfügbar' : '✓ Node-Agent aktuell');
          metricsEl.textContent = parts.join(' · ');
        });
      });
    }

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  },
};
