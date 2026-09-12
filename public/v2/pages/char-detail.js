import { t } from '/lib/i18n.js';
import { escapeHtml, fmt, toGold, fmtDuration, fmtMinutesAsTime, currentOrNextWindow, formatPlanBlocks, statsTooltipRows } from '/v2/lib/format.js';

const TABS = ['equipment', 'guild', 'tavern', 'mail'];

function accountStatusLabel(acc) {
  if (acc.paused) return t('v2.accountPaused');
  if (acc.running) return acc.currentActivity ? acc.currentActivity : t('v2.accountRunning');
  return t('v2.accountStopped');
}

function renderEquipment(items) {
  if (!items.length) return `<div class="v2-empty">${t('overview.noEquipmentFound')}</div>`;
  return `<div class="v2-equip-grid">${items.map(item => `
    <div class="v2-equip-slot">
      <div class="v2-equip-slot-name">${escapeHtml(item.slot)}</div>
      <div class="v2-equip-slot-type">${escapeHtml(item.itemType)}</div>
      <div class="v2-equip-slot-attrs">${Object.entries(item.attributes).map(([k, v]) => `${escapeHtml(k)}: ${v}`).join('<br>') || '—'}</div>
      <div class="v2-equip-slot-meta">${t('overview.qualityLabel', { quality: item.itemQuality, upgrade: item.upgradeCount })}</div>
    </div>`).join('')}</div>`;
}

function renderGuildMemberRows(members) {
  return members.map(m => `
    <div class="v2-guild-member-row">
      <span>${escapeHtml(m.name)}</span>
      <span style="color:var(--muted);">Lvl ${m.level} · ${escapeHtml(m.guildRank)}</span>
    </div>`).join('');
}

function renderGuild(guild) {
  if (!guild) return `<div class="v2-empty">${t('overview.noGuildMember')}</div>`;
  const VISIBLE = 8;
  const hiddenCount = Math.max(0, guild.members.length - VISIBLE);
  return `
    <div style="margin-bottom:10px;"><strong>${escapeHtml(guild.name)}</strong> · ${t('analytics.honorLabel')} ${fmt(guild.honor)} · ${t('overview.colRank')} ${guild.rank} · ${guild.memberCount} ${t('overview.membersLabel')}</div>
    <div id="v2-guild-member-list">${renderGuildMemberRows(guild.members.slice(0, VISIBLE))}</div>
    ${hiddenCount > 0 ? `<button type="button" class="v2-link-btn" id="v2-guild-show-all-btn">${t('overview.showMoreMembers', { count: hiddenCount })}</button>` : ''}
  `;
}

function renderTavern(tavern) {
  const action = escapeHtml((tavern.currentAction || '').split(' ')[0] || '—');
  const aluPct = tavern.adventurePointsMax
    ? Math.max(0, Math.min(100, Math.round((tavern.adventurePoints / tavern.adventurePointsMax) * 100)))
    : 0;
  return `
    <div class="v2-alu-bar-wrap">
      <div class="v2-alu-bar-label"><span>${t('overview.adventureLust')}</span><span>${tavern.adventurePoints}/${tavern.adventurePointsMax}</span></div>
      <div class="v2-alu-bar-track"><div class="v2-alu-bar-fill" style="width:${aluPct}%"></div></div>
    </div>
    <div style="margin:10px 0;">🍺 ${tavern.beerDrunk}/${tavern.beerMax} · ${t('overview.tavernActionLabel', { action })}</div>
    ${tavern.quests.map(q => `
      <div class="v2-tavern-quest-row">
        <span>${escapeHtml(q.location)}</span>
        <span style="color:var(--muted);">${fmt(toGold(q.baseSilver))} Gold · ${fmt(q.baseExperience)} XP · ${fmtDuration(q.baseLengthSec, t)}</span>
      </div>`).join('')}
  `;
}

function renderMail(mail) {
  if (!mail.recent.length) return `<div class="v2-empty">${t('overview.mailboxEmpty', { cap: mail.inboxCapacity })}</div>`;
  return `
    <div style="margin-bottom:10px;color:var(--muted);font-size:12.5px;">${t('overview.mailSummary', { unread: mail.unreadCount, count: mail.recent.length, cap: mail.inboxCapacity })}</div>
    ${mail.recent.map(entry => `
      <div class="v2-mail-row${entry.read ? '' : ' unread'}">
        <span>${escapeHtml(entry.title || t('overview.noSubject'))}</span>
        <span style="color:var(--muted);">${t('overview.mailFrom', { from: escapeHtml(entry.from) })} · ${new Date(entry.date).toLocaleString('de-DE')}</span>
      </div>`).join('')}
  `;
}

export default {
  id: 'char-detail',
  label: 'v2.charDetailLabel',
  icon: '🧙',
  mount(container, ctx) {
    ctx.injectStyleOnce('char-detail', `
      .v2-char-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
      .v2-char-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
      .v2-char-tabs button {
        border: none; background: none; color: var(--muted); padding: 9px 16px; font-size: 13px; cursor: pointer;
        border-bottom: 2px solid transparent; margin-bottom: -1px;
      }
      .v2-char-tabs button.active { color: var(--text); border-bottom-color: var(--accent); }
      .v2-equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .v2-equip-slot { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; }
      .v2-equip-slot-name { font-size: 10.5px; color: var(--muted); text-transform: uppercase; }
      .v2-equip-slot-type { font-size: 12.5px; font-weight: 600; margin: 2px 0 6px; }
      .v2-equip-slot-attrs { font-size: 11px; color: var(--text); line-height: 1.5; }
      .v2-equip-slot-meta { font-size: 10.5px; color: var(--muted); margin-top: 6px; }
      .v2-guild-member-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
      .v2-link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 12px; padding: 8px 0 0; }
      .v2-alu-bar-wrap { margin-bottom: 4px; }
      .v2-alu-bar-label { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); margin-bottom: 4px; }
      .v2-alu-bar-track { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; }
      .v2-alu-bar-fill { height: 100%; background: var(--accent); }
      .v2-tavern-quest-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
      .v2-mail-row { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
      .v2-mail-row.unread span:first-child { font-weight: 700; }
    `);

    const profileId = ctx.routeParams?.profileId;
    const wrap = document.createElement('div');
    if (!profileId) {
      wrap.innerHTML = `<div class="v2-empty">${t('v2.noCharSelected')}</div>`;
      container.appendChild(wrap);
      return () => {};
    }
    wrap.innerHTML = `<div class="v2-empty">${t('v2.loading')}</div>`;
    container.appendChild(wrap);

    let activeTab = 'equipment';

    async function load() {
      let accounts, node;
      try {
        [accounts] = await Promise.all([ctx.fetchJSON('/api/accounts')]);
      } catch (err) {
        wrap.innerHTML = `<div class="v2-empty">${t('v2.loadError', { message: escapeHtml(err.message) })}</div>`;
        return;
      }
      const acc = accounts.find(a => a.profileId === profileId);
      if (!acc) {
        wrap.innerHTML = `<div class="v2-empty">${t('v2.noCharSelected')}</div>`;
        return;
      }
      document.getElementById('v2-page-title').textContent = acc.charName;

      const [randomizerConfigs, randomizerSettings, nodes] = await Promise.all([
        ctx.fetchJSON('/api/randomizer/configs').catch(() => ({})),
        ctx.fetchJSON('/api/randomizer/settings').catch(() => ({})),
        ctx.fetchJSON('/api/nodes').catch(() => []),
      ]);
      node = acc.nodeId ? nodes.find(n => n.id === acc.nodeId) : nodes.find(n => n.isLocal);

      const statRows = statsTooltipRows(acc, t);

      wrap.innerHTML = `
        <div class="v2-char-header">
          <span class="v2-dot ${acc.running ? 'online' : 'offline'}"></span>
          <strong style="font-size:15px;">${escapeHtml(accountStatusLabel(acc))}</strong>
          ${node ? `<span class="v2-account-node-badge" data-node-id="${escapeHtml(node.id)}" style="cursor:pointer;color:var(--accent);font-size:12px;">${node.isLocal ? '💻' : '🖥'} ${escapeHtml(node.name)}</span>` : ''}
          <span data-role="randomizer" style="margin-left:auto;"></span>
          <span class="v2-account-actions">
            <button data-action="start" title="${t('v2.actionStart')}" ${acc.running ? 'disabled' : ''}>▶</button>
            <button data-action="pause" title="${t('v2.actionPause')}" ${(!acc.running || acc.paused) ? 'disabled' : ''}>⏸</button>
            <button data-action="stop" title="${t('v2.actionStop')}" ${!acc.running ? 'disabled' : ''}>■</button>
          </span>
        </div>
        <div class="v2-stat-row">
          ${statRows.map(([label, value]) => value ? `<span class="v2-stat-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>` : '').join('')}
        </div>
        <div class="v2-char-tooltip-blocks" data-role="randomizer-blocks" style="margin-bottom:16px;"></div>
        <div class="v2-char-tabs">
          <button data-tab="equipment">${t('overview.equipmentTitle')}</button>
          <button data-tab="guild">${t('overview.guildTitle')}</button>
          <button data-tab="tavern">${t('overview.tavernTitle')}</button>
          <button data-tab="mail">${t('overview.mailTitle')}</button>
        </div>
        <div class="v2-card" id="v2-char-tab-content">${t('v2.loading')}</div>
      `;

      wrap.querySelector('.v2-account-node-badge')?.addEventListener('click', (e) => {
        location.hash = `#/node/${encodeURIComponent(e.currentTarget.dataset.nodeId)}`;
      });

      wrap.querySelectorAll('.v2-account-actions button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const endpoint = action === 'pause' ? 'pause' : action === 'stop' ? 'stop' : 'start';
          wrap.querySelectorAll('.v2-account-actions button').forEach(b => { b.disabled = true; });
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(profileId)}/${endpoint}`, { method: 'POST' });
            await load();
          } catch (err) {
            alert(t('v2.actionFailed', { message: err.message }));
          }
        });
      });

      function selectTab(tabId) {
        activeTab = tabId;
        wrap.querySelectorAll('.v2-char-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        loadGameState();
      }
      wrap.querySelectorAll('.v2-char-tabs button').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
      selectTab(activeTab);

      let gameState = null;
      async function loadGameState() {
        const content = wrap.querySelector('#v2-char-tab-content');
        if (!content) return;
        if (!gameState) {
          content.innerHTML = t('overview.loadingEllipsis');
          try {
            gameState = await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(profileId)}`);
          } catch (err) {
            content.innerHTML = `<div class="v2-empty">${t('v2.loadError', { message: escapeHtml(err.message) })}</div>`;
            return;
          }
        }
        if (activeTab === 'equipment') content.innerHTML = renderEquipment(gameState.equipment);
        else if (activeTab === 'guild') content.innerHTML = renderGuild(gameState.guild);
        else if (activeTab === 'tavern') content.innerHTML = renderTavern(gameState.tavern);
        else if (activeTab === 'mail') content.innerHTML = renderMail(gameState.mail);
        const showAllBtn = content.querySelector('#v2-guild-show-all-btn');
        if (showAllBtn) {
          showAllBtn.addEventListener('click', () => {
            content.querySelector('#v2-guild-member-list').innerHTML = renderGuildMemberRows(gameState.guild.members);
            showAllBtn.remove();
          });
        }
      }

      if (acc.username && randomizerConfigs[acc.username]?.enabled) {
        ctx.fetchJSON(`/api/randomizer/plan/${encodeURIComponent(acc.username)}`)
          .then(({ plan }) => {
            const badgeEl = wrap.querySelector('[data-role="randomizer"]');
            const window = currentOrNextWindow(plan, randomizerSettings.stadtwacheDurationMin);
            if (badgeEl && window) {
              const time = fmtMinutesAsTime(window.active ? window.end : window.start);
              badgeEl.innerHTML = `<span class="v2-randomizer-badge${window.active ? ' active' : ''}">🎲 ${t(window.active ? 'v2.randomizerActiveUntil' : 'v2.randomizerNextAt', { time })}</span>`;
            }
            const blocksEl = wrap.querySelector('[data-role="randomizer-blocks"]');
            const blocks = formatPlanBlocks(plan, randomizerSettings.stadtwacheDurationMin, t);
            if (blocksEl && blocks.length) {
              blocksEl.innerHTML = `<div class="v2-char-tooltip-blocks-title">${t('v2.tooltipPlannedToday')}</div>${blocks.map(b => `<div>${escapeHtml(b)}</div>`).join('')}`;
            }
          })
          .catch(() => {});
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  },
};
