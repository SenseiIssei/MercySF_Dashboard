import { t } from '/lib/i18n.js';

/*
 * Der Marktplatz von Mercy SF.
 *
 * Diese Seite hat bis September 2026 die Pinnwand des ursprünglichen Autors
 * dieses Forks abgefragt (data.poslab.cc). Wer hier nach Konfigurationen sah,
 * fand die eines anderen Projekts, und die Einträge, die die Anwendung selbst
 * anbietet, waren nirgends zu sehen.
 *
 * Gefragt wird jetzt derselbe Server wie in der Anwendung, und zwar über
 * `/api/market` auf diesem Dashboard. Warum nicht direkt aus dem Browser: eine
 * Anfrage quer über die Domänengrenze hängt an einer CORS-Regel auf einem
 * fremden Server, und wer durchreicht, entscheidet, was durchgeht. Siehe
 * routes/market.js.
 *
 * Bewertet wird hier nicht. Eine Stimme gehört zu einem Konto, das Konto liegt
 * in der Anwendung, und ein Dashboard, das für ein Konto abstimmt, das es nicht
 * kennt, wäre genau die Vermischung, die hier nirgends stattfinden soll. Die
 * Zustimmung der anderen steht da, als Zahl.
 */
export default {
  id: 'marketplace',
  label: 'Marktplatz',
  icon: '🌐',
  mount(container, ctx) {
    const css = `
      .marketplace-page .marketplace-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .marketplace-page .marketplace-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .marketplace-page .marketplace-filters input[type="text"], .marketplace-page .marketplace-filters select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; width: auto; }
      .marketplace-page #marketplace-status { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .marketplace-page .marketplace-empty { color: var(--muted); font-size: 12.5px; }
      .marketplace-page .marketplace-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
      .marketplace-page .marketplace-tile { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--panel); cursor: pointer; text-align: left; }
      .marketplace-page .marketplace-tile:hover { border-color: var(--accent); }
      .marketplace-page .marketplace-tile-title { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
      .marketplace-page .marketplace-tile-meta { font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px; }
      .marketplace-page .marketplace-mush { color: var(--yellow, #e3b341); }
      .marketplace-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .marketplace-modal { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto; position: relative; }
      .marketplace-modal-close { position: absolute; top: 12px; right: 14px; background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; line-height: 1; padding: 0; }
      .marketplace-modal-close:hover { color: var(--text); }
      .marketplace-modal-title { font-weight: 600; font-size: 15px; margin: 0 0 10px; padding-right: 24px; }
      .marketplace-modal-desc { font-size: 12.5px; color: var(--text); white-space: pre-wrap; margin-bottom: 12px; line-height: 1.4; }
      .marketplace-modal-meta { font-size: 11.5px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
      .marketplace-modal-meta .marketplace-tag { display: inline-block; background: var(--panel-2); border-radius: 10px; padding: 1px 8px; font-size: 10.5px; margin-right: 4px; }
      .marketplace-modal-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
      .marketplace-modal .marketplace-warn { font-size: 11.5px; color: var(--yellow, #e3b341); margin-bottom: 10px; line-height: 1.4; }
    `;
    ctx.injectStyleOnce('marketplace', css);

    const wrap = document.createElement('div');
    wrap.className = 'marketplace-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('settings.marketplaceTitle')}</h1>
      <div class="marketplace-desc">${t('settings.marketplaceDesc')}</div>
      <div class="marketplace-filters">
        <input type="text" id="marketplace-search" placeholder="${t('settings.marketplaceSearchPlaceholder')}">
        <select id="marketplace-class-filter"></select>
        <select id="marketplace-sort">
          <option value="top">${t('settings.marketplaceSortTop')}</option>
          <option value="new">${t('settings.marketplaceSortNew')}</option>
          <option value="downloads">${t('settings.marketplaceSortDownloads')}</option>
        </select>
      </div>
      <div id="marketplace-status"></div>
      <div id="marketplace-list" class="marketplace-grid"></div>
    `;
    container.appendChild(wrap);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    let klassenGeladen = false;
    let eintraege = [];

    async function loadMarketplace() {
      const listEl = wrap.querySelector('#marketplace-list');
      const status = wrap.querySelector('#marketplace-status');
      const sort = wrap.querySelector('#marketplace-sort').value;

      try {
        const data = await ctx.fetchJSON(`/api/market/list?sort=${encodeURIComponent(sort)}`);
        eintraege = Array.isArray(data.entries) ? data.entries : [];
      } catch (err) {
        status.textContent = t('settings.marketplaceLoadError', { message: err.message });
        return;
      }
      status.textContent = '';

      if (!klassenGeladen) {
        const classSelect = wrap.querySelector('#marketplace-class-filter');
        const klassen = [...new Set(eintraege.map(e => e.class).filter(Boolean))].sort();
        classSelect.innerHTML = `<option value="">${t('settings.marketplaceClassAll')}</option>` +
          klassen.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        klassenGeladen = true;
      }

      zeichne();
    }

    // Suche und Klassenfilter laufen hier und nicht auf dem Server: die Liste
    // ist kurz, und ein Tastendruck soll keine Anfrage über zwei Rechner
    // auslösen.
    function zeichne() {
      const listEl = wrap.querySelector('#marketplace-list');
      const q = wrap.querySelector('#marketplace-search').value.trim().toLowerCase();
      const klasse = wrap.querySelector('#marketplace-class-filter').value;

      const gezeigt = eintraege.filter(e => {
        if (klasse && e.class !== klasse) return false;
        if (!q) return true;
        return `${e.name} ${e.description} ${e.author || ''}`.toLowerCase().includes(q);
      });

      listEl.innerHTML = gezeigt.length
        ? gezeigt.map(e => `
          <button type="button" class="marketplace-tile" data-id="${e.id}">
            <div class="marketplace-tile-title">${escapeHtml(e.name)}</div>
            <div class="marketplace-tile-meta">
              ${e.class ? `<span>${escapeHtml(e.class)}</span>` : ''}
              ${e.app_version ? `<span>v${escapeHtml(e.app_version)}</span>` : ''}
              <span>▲ ${Number(e.upvotes) || 0}</span>
              <span>${t('settings.marketplaceDownloadsLabel', { count: Number(e.downloads) || 0 })}</span>
              ${e.uses_mushrooms ? `<span class="marketplace-mush">${t('settings.marketplaceSpendsMushrooms')}</span>` : ''}
            </div>
          </button>
        `).join('')
        : `<div class="marketplace-empty">${t('settings.marketplaceEmpty')}</div>`;

      listEl.querySelectorAll('.marketplace-tile').forEach(tileEl => {
        tileEl.addEventListener('click', () => {
          const e = gezeigt.find(x => String(x.id) === tileEl.dataset.id);
          if (e) openDetailModal(e);
        });
      });
    }

    function openDetailModal(item) {
      document.querySelectorAll('.marketplace-modal-backdrop').forEach(el => el.remove());

      const pilze = Array.isArray(item.mushroom_features) ? item.mushroom_features : [];
      const backdrop = document.createElement('div');
      backdrop.className = 'marketplace-modal-backdrop';
      backdrop.innerHTML = `
        <div class="marketplace-modal">
          <button class="marketplace-modal-close" aria-label="${t('settings.marketplaceCloseBtn')}">×</button>
          <div class="marketplace-modal-title">${escapeHtml(item.name)}</div>
          <div class="marketplace-modal-meta">
            ${item.class ? `<span class="marketplace-tag">${escapeHtml(item.class)}</span>` : ''}
            ${item.app_version ? `<span class="marketplace-tag">v${escapeHtml(item.app_version)}</span>` : ''}
            <span>▲ ${Number(item.upvotes) || 0} / ▼ ${Number(item.downvotes) || 0}</span>
            <span>${t('settings.marketplaceDownloadsLabel', { count: Number(item.downloads) || 0 })}</span>
            ${item.author ? `<span>${escapeHtml(item.author)}</span>` : ''}
          </div>
          <div class="marketplace-modal-desc">${item.description ? escapeHtml(item.description) : t('settings.marketplaceNoDescription')}</div>
          ${item.uses_mushrooms ? `
            <div class="marketplace-warn">
              ${t('settings.marketplaceMushroomWarning')}
              ${pilze.length ? `<br>${pilze.map(f => escapeHtml(f.label + (f.value === undefined ? '' : `: ${f.value}`))).join('<br>')}` : ''}
            </div>` : ''}
          <div class="marketplace-modal-actions">
            <button class="btn-secondary" data-action="import" style="width:auto;padding:6px 14px;font-size:12px;margin-left:auto;">${t('settings.marketplaceImportBtn')}</button>
          </div>
        </div>
      `;

      function close() { backdrop.remove(); document.removeEventListener('keydown', onKeydown); }
      function onKeydown(e) { if (e.key === 'Escape') close(); }

      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      backdrop.querySelector('.marketplace-modal-close').addEventListener('click', close);
      document.addEventListener('keydown', onKeydown);

      backdrop.querySelector('[data-action="import"]').addEventListener('click', async () => {
        const statusEl = wrap.querySelector('#marketplace-status');
        statusEl.textContent = t('settings.marketplaceImporting');
        try {
          const data = await ctx.fetchJSON(`/api/market/config/${encodeURIComponent(item.id)}`);
          if (!data || typeof data.config !== 'object' || data.config === null) {
            throw new Error(t('settings.marketplaceNoSettings'));
          }
          await ctx.fetchJSON('/api/settings-templates/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: data.name, settings: data.config }),
          });
          statusEl.textContent = t('settings.marketplaceImported', { name: data.name });
          close();
        } catch (err) {
          statusEl.textContent = t('settings.marketplaceLoadError', { message: err.message });
        }
      });

      document.body.appendChild(backdrop);
    }

    wrap.querySelector('#marketplace-sort').addEventListener('change', () => loadMarketplace());
    wrap.querySelector('#marketplace-search').addEventListener('input', () => zeichne());
    wrap.querySelector('#marketplace-class-filter').addEventListener('change', () => zeichne());

    loadMarketplace();

    return () => {};
  },
};
