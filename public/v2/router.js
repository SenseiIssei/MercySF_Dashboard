import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error(t('v2.notAuthenticated'));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function injectStyleOnce(id, css) {
  if (document.getElementById('style-' + id)) return;
  const style = document.createElement('style');
  style.id = 'style-' + id;
  style.textContent = css;
  document.head.appendChild(style);
}

// routeParams wird von renderRoute() vor jedem mount() neu gesetzt (z. B. { nodeId } für die
// `#/node/<id>`-Route) — Seiten lesen es aus ctx.routeParams statt der Router müsste jedem
// page-Modul eine eigene Signatur geben.
const ctx = { fetchJSON, injectStyleOnce, routeParams: {} };

const PAGES = [
  { id: 'nodes-overview', label: 'v2.nodesOverviewLabel', icon: '🖧' },
];

// Ein Nav-Link pro bekanntem Node (dynamisch, da die Node-Liste sich ändern kann) — führt zur
// `node-detail`-Seite mit der jeweiligen Node-Id als Routenparameter.
let dynamicNodes = [];

async function loadDynamicNav() {
  try {
    dynamicNodes = await fetchJSON('/api/nodes');
  } catch (e) { /* best-effort — Sidebar zeigt dann nur die statischen Einträge */ }
  renderNav();
}

let currentUnmount = null;

function parseRoute(hash) {
  const clean = hash.replace(/^#\/?/, '') || 'nodes-overview';
  const nodeMatch = clean.match(/^node\/(.+)$/);
  if (nodeMatch) return { pageId: 'node-detail', params: { nodeId: decodeURIComponent(nodeMatch[1]) } };
  return { pageId: PAGES.some(p => p.id === clean) ? clean : 'nodes-overview', params: {} };
}

async function renderRoute() {
  const { pageId, params } = parseRoute(location.hash);
  ctx.routeParams = params;

  document.querySelectorAll('#v2-nav a').forEach(el => {
    el.classList.toggle('active', el.dataset.route === (params.nodeId ? `node/${params.nodeId}` : pageId));
  });

  const node = params.nodeId ? dynamicNodes.find(n => n.id === params.nodeId) : null;
  document.getElementById('v2-page-title').textContent = node
    ? node.name
    : t((PAGES.find(p => p.id === pageId) || PAGES[0]).label);

  const root = document.getElementById('v2-page-root');
  if (typeof currentUnmount === 'function') {
    try { currentUnmount(); } catch (e) { console.error(e); }
    currentUnmount = null;
  }
  root.innerHTML = '';

  try {
    const mod = await import(`/v2/pages/${pageId}.js`);
    const page = mod.default;
    const result = page.mount(root, ctx);
    if (typeof result === 'function') currentUnmount = result;
  } catch (err) {
    root.innerHTML = `<div class="v2-card"><p>${t('v2.pageLoadError', { page: pageId, message: err.message })}</p></div>`;
  }
}

function renderNav() {
  const nav = document.getElementById('v2-nav');
  const staticLinks = PAGES.map(p =>
    `<a data-route="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${t(p.label)}</a>`
  ).join('');
  const nodeLinks = dynamicNodes.map(n =>
    `<a data-route="node/${n.id}" href="#/node/${encodeURIComponent(n.id)}" class="v2-nav-node"><span>${n.isLocal ? '💻' : '🖥'}</span> ${escapeHtml(n.name)}</a>`
  ).join('');
  nav.innerHTML = staticLinks + (dynamicNodes.length ? '<hr class="v2-nav-divider" />' + nodeLinks : '');

  const { pageId, params } = parseRoute(location.hash);
  nav.querySelectorAll('a').forEach(el => {
    el.classList.toggle('active', el.dataset.route === (params.nodeId ? `node/${params.nodeId}` : pageId));
  });
}

function initThemeToggle() {
  const btn = document.getElementById('v2-theme-toggle-btn');
  if (!btn) return;
  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    btn.textContent = theme === 'light' ? '◑' : '◐';
  };
  apply(document.documentElement.getAttribute('data-theme') || 'dark');
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('mercy-theme', next);
    apply(next);
  });
}

function initLogout() {
  const btn = document.getElementById('v2-logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await fetchJSON('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* Session ist ohnehin ungültig/serverseitig weg — trotzdem weiterleiten */ }
    location.href = '/login.html';
  });
}

function initSwitchLink() {
  const link = document.getElementById('v2-switch-to-v1');
  if (!link) return;
  link.addEventListener('click', async (ev) => {
    ev.preventDefault();
    try {
      await fetchJSON('/api/panel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiVersion: 'v1' }),
      });
    } catch (e) { /* best-effort — trotzdem weiterleiten */ }
    location.href = '/';
  });
}

window.addEventListener('hashchange', renderRoute);
initThemeToggle();
initLogout();
initSwitchLink();
loadDynamicNav().then(renderRoute);
setInterval(loadDynamicNav, 30000);
