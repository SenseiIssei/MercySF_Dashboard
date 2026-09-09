import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function accountStatusLabel(acc) {
  if (acc.running) return acc.currentActivity ? acc.currentActivity : t('v2.accountRunning');
  return t('v2.accountStopped');
}

export default {
  id: 'nodes-overview',
  label: 'v2.nodesOverviewLabel',
  icon: '🖧',
  mount(container, ctx) {
    ctx.injectStyleOnce('nodes-overview', `
      .v2-node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
      .v2-stat-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
      .v2-stat-chip {
        display: flex; align-items: center; gap: 5px; background: var(--panel-2); border: 1px solid var(--border);
        border-radius: var(--radius-md); padding: 5px 10px; font-size: 12px; color: var(--text);
      }
      .v2-stat-chip .v2-stat-icon { font-size: 12px; }
      .v2-version-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
      .v2-version-pill {
        display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 9px;
        border-radius: 20px; border: 1px solid var(--border); color: var(--muted);
      }
      .v2-version-pill.warn { color: var(--yellow); border-color: var(--yellow); }
      .v2-version-pill.ok { color: var(--green); border-color: var(--green); }
    `);

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="v2-node-grid" id="v2-node-grid"><div class="v2-empty">${t('v2.loading')}</div></div>`;
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
        grid.innerHTML = `<div class="v2-empty">${t('v2.loadError', { message: escapeHtml(err.message) })}</div>`;
        return;
      }
      if (!nodes.length) {
        grid.innerHTML = `<div class="v2-empty">${t('v2.noNodesPaired')}</div>`;
        return;
      }

      const [vpnTargets, vpnProfiles] = await Promise.all([
        ctx.fetchJSON('/api/vpn/targets').catch(() => []),
        ctx.fetchJSON('/api/vpn/profiles').catch(() => []),
      ]);
      const vpnByTarget = new Map(vpnTargets.map(vt => [vt.targetId, vt]));
      const vpnProfileLabels = new Map(vpnProfiles.map(p => [p.id, p.label]));

      // De-dup by account id: a backend quirk can list the same character twice (once from the
      // local listing, once from the remote/node listing) when it ran locally and was later
      // reassigned to a node. Prefer the node-assigned entry as the more current one.
      const accountsById = new Map();
      accounts.forEach(acc => {
        const existing = accountsById.get(acc.id);
        if (!existing || (acc.nodeId && !existing.nodeId)) accountsById.set(acc.id, acc);
      });
      const dedupedAccounts = [...accountsById.values()];

      const accountsByNode = new Map();
      dedupedAccounts.forEach(acc => {
        const key = acc.nodeId || null;
        if (!accountsByNode.has(key)) accountsByNode.set(key, []);
        accountsByNode.get(key).push(acc);
      });

      grid.innerHTML = nodes.map(n => {
        const vpn = vpnByTarget.get(n.id);
        const vpnConnected = !!vpn?.lastStatus?.connected;
        const vpnProfileLabel = vpn?.vpnProfileId ? vpnProfileLabels.get(vpn.vpnProfileId) : null;
        const vpnBadgeText = vpnConnected
          ? (vpnProfileLabel ? `${t('v2.vpnActive')}: ${escapeHtml(vpnProfileLabel)}` : t('v2.vpnActive'))
          : t('v2.vpnInactive');
        const nodeAccounts = accountsByNode.get(n.isLocal ? null : n.id) || [];
        return `
          <div class="v2-card" data-id="${n.id}">
            <div class="v2-card-header">
              <div class="v2-card-title">
                <span class="v2-dot" data-role="dot"></span>
                ${escapeHtml(n.name)}
              </div>
              <span class="v2-badge${vpnConnected ? ' vpn-active' : ''}">${vpnBadgeText}</span>
            </div>
            <div class="v2-stat-row" data-role="metrics">${t('v2.loadingUtilization')}</div>
            <div class="v2-version-row" data-role="version"></div>
            <div data-role="accounts">
              ${nodeAccounts.length
                ? nodeAccounts.map(acc => `
                  <div class="v2-account-row">
                    <span class="v2-dot ${acc.running ? 'online' : 'offline'}"></span>
                    <span class="char-name">${escapeHtml(acc.charName)}</span>
                    <span class="v2-account-activity">${escapeHtml(accountStatusLabel(acc))}</span>
                  </div>
                `).join('')
                : `<div class="v2-empty">${t('v2.noAccountsOnNode')}</div>`}
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

      // System-Stats + Update-Status pro Node, best-effort — getrennte Zeilen statt einer
      // einzigen `·`-verketteten Textzeile: Auslastung als kompakte Chips, Versionsstatus als
      // eigene Pill-Reihe darunter.
      nodes.forEach(n => {
        const card = grid.querySelector(`.v2-card[data-id="${n.id}"]`);
        if (!card) return;
        const metricsEl = card.querySelector('[data-role="metrics"]');
        const versionEl = card.querySelector('[data-role="version"]');
        Promise.all([
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/system/stats`).catch(() => null),
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/cli/status`).catch(() => null),
          ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/self-update/status`).catch(() => null),
        ]).then(([stats, cli, agent]) => {
          if (!metricsEl || !versionEl) return;
          if (stats) {
            const load = (stats.loadAvg && stats.loadAvg[0] != null) ? stats.loadAvg[0].toFixed(2) : '?';
            metricsEl.innerHTML = `
              <span class="v2-stat-chip"><span class="v2-stat-icon">🧠</span>${t('v2.statsLoad', { load, cores: stats.cpuCount })}</span>
              <span class="v2-stat-chip"><span class="v2-stat-icon">💾</span>${t('v2.statsRam', { percent: stats.memUsedPercent })}</span>
              <span class="v2-stat-chip"><span class="v2-stat-icon">⏱</span>${escapeHtml(fmtUptime(stats.uptimeSec))}</span>
            `;
          } else {
            metricsEl.innerHTML = `<span class="v2-stat-chip">${t('v2.statsUnavailable')}</span>`;
          }
          const pills = [];
          if (cli) pills.push(`<span class="v2-version-pill ${cli.updateAvailable ? 'warn' : 'ok'}">CLI · ${cli.updateAvailable ? t('v2.cliUpdateAvailable') : t('v2.cliUpToDate')}</span>`);
          if (agent) pills.push(`<span class="v2-version-pill ${agent.updateAvailable ? 'warn' : 'ok'}">Node-Agent · ${agent.updateAvailable ? t('v2.agentUpdateAvailable') : t('v2.agentUpToDate')}</span>`);
          versionEl.innerHTML = pills.join('');
        });
      });
    }

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  },
};
