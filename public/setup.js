import { t, initI18nLocal, setLanguageLocal, getLanguage, onLanguageChange, LANGUAGES } from '/lib/i18n.js';

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function addPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggled) return;
    input.dataset.toggled = '1';
    const wrap = document.createElement('div');
    wrap.className = 'password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="glyph"><path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>';
    btn.setAttribute('aria-label', t('common.showPassword'));
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="glyph"><path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20 20 4"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="glyph"><path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>';
    });
    wrap.appendChild(btn);
  });
}

function initCopyButtons(root = document) {
  root.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetEl = document.getElementById(btn.dataset.copyTarget);
      if (!targetEl) return;
      try {
        await navigator.clipboard.writeText(targetEl.textContent);
        const original = btn.textContent;
        btn.textContent = t('common.copied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (e) {
        btn.textContent = t('common.copyError');
      }
    });
  });
}


/**
 * Die Sprachwahl als Liste statt als Umschalter.
 *
 * Es waren zwei Sprachen und ein Knopf, der zwischen ihnen hin und her
 * sprang. Bei zehn ist das kein Knopf mehr, sondern ein Ratespiel.
 */
function buildLanguagePicker(el, current, onPick) {
  el.innerHTML = '';
  const select = document.createElement('select');
  select.className = 'lang-select';
  select.setAttribute('aria-label', 'Language');
  for (const { code, name } of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    if (code === current) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => onPick(select.value));
  el.appendChild(select);
  return select;
}

function initLangToggle() {
  const el = document.getElementById('lang-toggle-btn');
  if (!el) return;
  const select = buildLanguagePicker(el, getLanguage(), setLanguageLocal);
  onLanguageChange(lang => { select.value = lang; });
}

async function init() {
  initI18nLocal();
  initLangToggle();
  const status = await fetchJSON('/api/auth/status');
  if (status.hasAccess) {
    location.href = '/login.html';
    return;
  }
  document.getElementById('setup-form').addEventListener('submit', onSubmit);
  addPasswordToggles();
}

async function onSubmit(ev) {
  ev.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const errorEl = document.getElementById('setup-error');
  errorEl.hidden = true;

  if (password !== password2) {
    errorEl.textContent = t('common.passwordMismatch');
    errorEl.hidden = false;
    return;
  }

  try {
    const result = await fetchJSON('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    showSecrets(result.aesKey, result.recoveryPhrase);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function showSecrets(aesKey, recoveryPhrase) {
  const card = document.getElementById('card');
  const wordGridHtml = recoveryPhrase.map((w, i) =>
    `<div class="word-chip"><span class="word-index">${i + 1}</span>${escapeHtml(w)}</div>`
  ).join('');

  card.innerHTML = `
    <div class="auth-header">
      <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="auth-icon-mark"><circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M17 12v3"/><path d="M20 12v2"/></svg></div>
      <div>
        <h1 class="auth-title">${t('setup.doneTitle')}</h1>
        <p class="auth-subtitle">${t('setup.doneSubtitle')}</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.aesKeyTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="aes-key">${t('common.copyBtn')}</button>
      </div>
      <div class="secret-value" id="aes-key">${escapeHtml(aesKey)}</div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.recoveryTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">${t('common.copyBtn')}</button>
      </div>
      <div class="word-grid">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner no-print">
      <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="glyph"><path d="M12 4 2.8 20h18.4Z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg></span>
      <span>${t('setup.warning')}</span>
    </div>

    <button type="button" class="btn-secondary no-print" id="print-btn">${t('setup.printBtn')}</button>

    <div class="confirm-row no-print">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">${t('setup.confirmSaved')}</label>
    </div>
    <button type="button" class="btn-primary-lg no-print" id="continue-btn" disabled style="margin-top:14px;">${t('setup.continueToDashboard')}</button>
  `;

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/';
  });
  initCopyButtons(card);
}

init();
