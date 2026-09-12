import { t } from '/lib/i18n.js';
import { escapeHtml, fmtUptime, fmtMinutesAsTime, currentOrNextWindow, statsTooltipRows, formatPlanBlocks } from '/v2/lib/format.js';

function accountStatusLabel(acc) {
  if (acc.paused) return t('v2.accountPaused');
  if (acc.running) return acc.currentActivity ? acc.currentActivity : t('v2.accountRunning');
  return t('v2.accountStopped');
}

function charNameWithTooltip(acc) {
  const rows = statsTooltipRows(acc, t);
  return `
    <span class="v2-char-tooltip-wrap">
      <span class="char-name">${escapeHtml(acc.charName)}</span>
      <span class="v2-char-tooltip">
        ${rows.map(([label, value]) => `<div class="v2-char-tooltip-row"><span>${escapeHtml(label)}</span>${value ? `<span>${escapeHtml(value)}</span>` : ''}</div>`).join('')}
        <div class="v2-char-tooltip-blocks" data-role="randomizer-blocks"></div>
      </span>
    </span>
  `;
}

function randomizerBlocksHtml(blocks) {
  if (!blocks.length) return '';
  return `
    <div class="v2-char-tooltip-blocks-title">${t('v2.tooltipPlannedToday')}</div>
    ${blocks.map(b => `<div class="v2-char-tooltip-row"><span>${escapeHtml(b)}</span></div>`).join('')}
  `;
}

function randomizerText(window) {
  if (!window) return '—';
  const time = fmtMinutesAsTime(window.active ? window.end : window.start);
  return t(window.active ? 'v2.randomizerActiveUntil' : 'v2.randomizerNextAt', { time });
}

export default {
  id: 'node-detail',
  label: 'v2.nodeDetailLabel',
  icon: '🖥',
  mount(container, ctx) {
    ctx.injectStyleOnce('node-detail', `
      .v2-detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .v2-detail-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px; }
      .v2-detail-stat {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px;
      }
      .v2-detail-stat-label { font-size: 11px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
      .v2-detail-stat-value { font-size: 18px; font-weight: 700; }
      .v2-detail-table { width: 100%; border-collapse: collapse; }
      .v2-detail-table th { text-align: left; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; padding: 8px 10px; border-bottom: 1px solid var(--border); }
      .v2-detail-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
      .v2-detail-table tr:last-child td { border-bottom: none; }
      .v2-update-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .v2-update-row .label { width: 100px; color: var(--muted); font-size: 12.5px; }
    `);

    const nodeId = ctx.routeParams?.nodeId;
    const wrap = document.createElement('div');
    if (!nodeId) {
      wrap.innerHTML = `<div class="v2-empty">${t('v2.noNodeSelected')}</div>`;
      container.appendChild(wrap);
      return () => {};
    }
    wrap.innerHTML = `<div class="v2-empty">${t('v2.loading')}</div>`;
    container.appendChild(wrap);

    async function load() {
      let node, accounts;
      try {
        const [nodes, allAccounts] = await Promise.all([
          ctx.fetchJSON('/api/nodes'),
          ctx.fetchJSON('/api/accounts'),
        ]);
        node = nodes.find(n => n.id === nodeId);
        if (!node) {
          wrap.innerHTML = `<div class="v2-empty">${t('v2.noNodeSelected')}</div>`;
          return;
        }
        const byId = new Map();
        allAccounts.forEach(acc => {
          const existing = byId.get(acc.id);
          if (!existing || (acc.nodeId && !existing.nodeId)) byId.set(acc.id, acc);
        });
        accounts = [...byId.values()].filter(acc => (node.isLocal ? !acc.nodeId : acc.nodeId === node.id));
      } catch (err) {
        wrap.innerHTML = `<div class="v2-empty">${t('v2.loadError', { message: escapeHtml(err.message) })}</div>`;
        return;
      }

      const [vpnTargets, vpnProfiles, randomizerConfigs, randomizerSettings, stats] = await Promise.all([
        ctx.fetchJSON('/api/vpn/targets').catch(() => []),
        ctx.fetchJSON('/api/vpn/profiles').catch(() => []),
        ctx.fetchJSON('/api/randomizer/configs').catch(() => ({})),
        ctx.fetchJSON('/api/randomizer/settings').catch(() => ({})),
        ctx.fetchJSON(`/api/nodes/${encodeURIComponent(nodeId)}/system/stats`).catch(() => null),
      ]);
      const vpn = vpnTargets.find(vt => vt.targetId === nodeId);
      const vpnConnected = !!vpn?.lastStatus?.connected;
      const vpnProfileLabel = vpn?.vpnProfileId ? vpnProfiles.find(p => p.id === vpn.vpnProfileId)?.label : null;

      const statCards = [
        { label: t('v2.detailStatAccounts'), value: String(accounts.length) },
        stats
          ? { label: t('v2.detailStatLoad'), value: (stats.loadAvg && stats.loadAvg[0] != null) ? `${stats.loadAvg[0].toFixed(2)} / ${stats.cpuCount}` : '?' }
          : { label: t('v2.detailStatLoad'), value: '—' },
        stats ? { label: t('v2.detailStatRam'), value: `${stats.memUsedPercent}%` } : { label: t('v2.detailStatRam'), value: '—' },
        stats ? { label: t('v2.detailStatUptime'), value: fmtUptime(stats.uptimeSec) } : { label: t('v2.detailStatUptime'), value: '—' },
      ];

      wrap.innerHTML = `
        <div class="v2-detail-header">
          <span class="v2-dot ${node.lastStatus === 'online' ? 'online' : 'offline'}"></span>
          <span class="v2-badge${vpnConnected ? ' vpn-active' : ''}">${vpnConnected ? `${t('v2.vpnActive')}${vpnProfileLabel ? ': ' + escapeHtml(vpnProfileLabel) : ''}` : t('v2.vpnInactive')}</span>
        </div>
        <div class="v2-detail-stats">
          ${statCards.map(s => `
            <div class="v2-detail-stat">
              <div class="v2-detail-stat-label">${escapeHtml(s.label)}</div>
              <div class="v2-detail-stat-value">${escapeHtml(s.value)}</div>
            </div>
          `).join('')}
        </div>
        <div class="v2-card">
          <div class="v2-card-title" style="margin-bottom:14px;">${t('v2.detailUpdatesTitle')}</div>
          <div class="v2-update-row"><span class="label">CLI</span><span data-role="cli-status">${t('v2.loading')}</span></div>
          <div class="v2-update-row"><span class="label">Node-Agent</span><span data-role="agent-status">${t('v2.loading')}</span></div>
        </div>
        <div class="v2-card">
          <div class="v2-card-title" style="margin-bottom:14px;">${t('v2.detailAccountsTitle')}</div>
          ${accounts.length ? `
            <table class="v2-detail-table">
              <thead><tr>
                <th></th><th>${t('v2.detailColChar')}</th><th>${t('v2.detailColStatus')}</th>
                <th>${t('v2.detailColRandomizer')}</th><th></th>
              </tr></thead>
              <tbody>
                ${accounts.map(acc => `
                  <tr data-profile-id="${escapeHtml(acc.profileId || '')}" data-username="${escapeHtml(acc.username || '')}">
                    <td><span class="v2-dot ${acc.running ? 'online' : 'offline'}"></span></td>
                    <td>${charNameWithTooltip(acc)}</td>
                    <td>${escapeHtml(accountStatusLabel(acc))}</td>
                    <td data-role="randomizer">—</td>
                    <td>
                      <span class="v2-account-actions">
                        <button data-action="start" title="${t('v2.actionStart')}" ${acc.running ? 'disabled' : ''}>▶</button>
                        <button data-action="pause" title="${t('v2.actionPause')}" ${(!acc.running || acc.paused) ? 'disabled' : ''}>⏸</button>
                        <button data-action="stop" title="${t('v2.actionStop')}" ${!acc.running ? 'disabled' : ''}>■</button>
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<div class="v2-empty">${t('v2.noAccountsOnNode')}</div>`}
        </div>
      `;

      wrap.querySelectorAll('tr[data-profile-id]').forEach(row => {
        const profileId = row.dataset.profileId;
        if (!profileId) return;
        const nameEl = row.querySelector('.char-name');
        if (nameEl) {
          nameEl.style.cursor = 'pointer';
          nameEl.addEventListener('click', () => { location.hash = `#/char/${encodeURIComponent(profileId)}`; });
        }
        row.querySelectorAll('.v2-account-actions button').forEach(btn => {
          btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const endpoint = action === 'pause' ? 'pause' : action === 'stop' ? 'stop' : 'start';
            row.querySelectorAll('button').forEach(b => { b.disabled = true; });
            try {
              await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(profileId)}/${endpoint}`, { method: 'POST' });
              await load();
            } catch (err) {
              alert(t('v2.actionFailed', { message: err.message }));
              row.querySelectorAll('button').forEach(b => { b.disabled = false; });
            }
          });
        });
      });

      accounts.forEach(acc => {
        if (!acc.username || !randomizerConfigs[acc.username]?.enabled) return;
        ctx.fetchJSON(`/api/randomizer/plan/${encodeURIComponent(acc.username)}`)
          .then(({ plan }) => {
            const row = wrap.querySelector(`tr[data-username="${CSS.escape(acc.username)}"]`);
            if (!row) return;
            const textEl = row.querySelector('[data-role="randomizer"]');
            if (textEl) textEl.textContent = randomizerText(currentOrNextWindow(plan, randomizerSettings.stadtwacheDurationMin));
            const blocksEl = row.querySelector('[data-role="randomizer-blocks"]');
            if (blocksEl) blocksEl.innerHTML = randomizerBlocksHtml(formatPlanBlocks(plan, randomizerSettings.stadtwacheDurationMin, t));
          })
          .catch(() => {});
      });

      function wireUpdateStatus(statusPath, role, versionLabel) {
        const el = wrap.querySelector(`[data-role="${role}"]`);
        ctx.fetchJSON(`/api/nodes/${encodeURIComponent(nodeId)}${statusPath}`)
          .then(status => {
            if (!el) return;
            if (status.updateAvailable) el.innerHTML = `<span class="v2-version-pill warn">${t('v2.cliUpdateAvailable')}</span>`;
            else el.innerHTML = `<span class="v2-version-pill ok">${escapeHtml(versionLabel(status))}</span>`;
          })
          .catch(() => { if (el) el.textContent = t('v2.statsUnavailable'); });
      }
      wireUpdateStatus('/cli/status', 'cli-status', s => s.currentHash ? s.currentHash.slice(0, 8) : t('v2.cliUpToDate'));
      wireUpdateStatus('/self-update/status', 'agent-status', s => s.currentVersion || t('v2.agentUpToDate'));

      ctx.fetchJSON(`/api/nodes/${encodeURIComponent(nodeId)}/ping`, { method: 'POST' })
        .then(result => {
          const dot = wrap.querySelector('.v2-detail-header .v2-dot');
          if (dot) dot.className = 'v2-dot ' + (result.online ? 'online' : 'offline');
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  },
};
