async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('Nicht angemeldet');
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

const ctx = { fetchJSON, injectStyleOnce };

const PAGES = [
  { id: 'nodes-overview', label: 'Node-Übersicht', icon: '🖧' },
];

let currentUnmount = null;

async function renderRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'nodes-overview';
  const pageMeta = PAGES.find(p => p.id === hash) || PAGES[0];

  document.querySelectorAll('#v2-nav a').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageMeta.id);
  });
  document.getElementById('v2-page-title').textContent = pageMeta.label;

  const root = document.getElementById('v2-page-root');
  if (typeof currentUnmount === 'function') {
    try { currentUnmount(); } catch (e) { console.error(e); }
    currentUnmount = null;
  }
  root.innerHTML = '';

  try {
    const mod = await import(`/v2/pages/${pageMeta.id}.js`);
    const page = mod.default;
    const result = page.mount(root, ctx);
    if (typeof result === 'function') currentUnmount = result;
  } catch (err) {
    root.innerHTML = `<div class="v2-card"><p>Fehler beim Laden von "${pageMeta.id}": ${err.message}</p></div>`;
  }
}

function renderNav() {
  const nav = document.getElementById('v2-nav');
  nav.innerHTML = PAGES.map(p =>
    `<a data-page="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${p.label}</a>`
  ).join('');
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
    await fetchJSON('/api/auth/logout', { method: 'POST' });
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
renderNav();
renderRoute();
