/**
 * Popup controller — SPA router.
 * All server communication via chrome.runtime.sendMessage to background.js.
 * No direct fetch calls here. No bridge.js loaded here.
 */

const POPUP_DEBUG = false;

// ── Helpers ──────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function getCleanDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

/**
 * Extract the registered domain (last two labels) so that
 * accounts.google.com, maps.google.com, mail.google.com all reduce to google.com.
 */
function getBaseDomain(hostname) {
  if (!hostname) return '';
  const clean = hostname.replace(/^www\./, '');
  const parts = clean.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : clean;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a message to background.js and await response.
 * ALL server communication goes through this function.
 * @param {Object} msg
 * @returns {Promise<*>}
 */
function sendBg(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(r);
      });
    } catch { resolve(null); }
  });
}

// ── Navigation ───────────────────────────────────────

let viewStack = ['entries'];
let currentDomain = '';
let currentTab = null;
let _viewCleanup = null;  // cleanup fn called before leaving a view
let currentFolderFilter = 'all';
let currentTypeFilter = 'all';
let activeDynamicTitle = '';

const viewRenderers = {};

function registerView(name, fn) { viewRenderers[name] = fn; }

function updateHeaderTitle(view) {
  const titleEl = $('nl-title');
  if (!titleEl) return;
  
  if (activeDynamicTitle) {
    titleEl.textContent = activeDynamicTitle;
  } else {
    const viewTitles = {
      entries: 'Vault',
      search: 'Search',
      save: 'Save Entry',
      edit: 'Edit Entry',
      generator: 'Generator',
      settings: 'Settings',
      menu: 'Menu',
      detail: 'Entry Detail',
      autologin: 'Auto Login',
      'settings-appearance': 'Appearance',
      'settings-autofill': 'Autofill & Passkeys',
      'settings-about': 'About Extension'
    };
    titleEl.textContent = viewTitles[view] || 'Vault';
  }

  // Toggle search wrap visibility: only show in 'entries' (Vault) and 'search' views
  const searchWrap = $('nl-search-wrap');
  if (searchWrap) {
    if (view === 'entries' || view === 'search') {
      searchWrap.classList.remove('hidden');
    } else {
      searchWrap.classList.add('hidden');
    }
  }

  // Toggle new entry button visibility: only show in 'entries' view
  const newBtn = $('nl-new-entry-btn');
  if (newBtn) {
    if (view === 'entries') {
      newBtn.classList.remove('hidden');
    } else {
      newBtn.classList.add('hidden');
    }
  }
}

function navigateTo(name, params = {}) {
  if (_viewCleanup) { _viewCleanup(); _viewCleanup = null; }
  activeDynamicTitle = ''; // Reset activeDynamicTitle before view renderer runs
  viewStack.push(name);
  $('nl-content').innerHTML = '';
  if (viewRenderers[name]) viewRenderers[name](params);
  updateHeaderTitle(name);
  updateBackBar();
  updateBottomNav(name);
}

function navigateBack() {
  if (_viewCleanup) { _viewCleanup(); _viewCleanup = null; }
  activeDynamicTitle = ''; // Reset activeDynamicTitle before view renderer runs
  if (viewStack.length > 1) viewStack.pop();
  const prev = viewStack[viewStack.length - 1];
  $('nl-content').innerHTML = '';
  if (viewRenderers[prev]) viewRenderers[prev]({});
  updateHeaderTitle(prev);
  updateBackBar();
  updateBottomNav(prev);
}

function updateBackBar() {
  const bar = $('nl-back-bar');
  const hasPrev = viewStack.length > 1;
  bar.classList.toggle('hidden', !hasPrev);
  
  if (activeDynamicTitle) {
    $('nl-view-title').textContent = '';
    return;
  }

  const viewTitles = {
    search: 'Search',
    save: 'Save Entry',
    edit: 'Edit Entry',
    generator: 'Generator',
    settings: 'Settings',
    menu: 'Menu',
    detail: 'Entry Detail',
    'settings-appearance': 'Appearance',
    'settings-autofill': 'Autofill & Passkeys',
    'settings-about': 'About Extension'
  };
  $('nl-view-title').textContent = hasPrev
    ? (viewTitles[viewStack[viewStack.length - 1]] || '')
    : '';
}

function updateBottomNav(active) {
  const isFormView = active === 'save' || active === 'edit';
  $('nl-bottom-nav').classList.toggle('hidden', isFormView);
  $('nl-form-actions-bar').classList.toggle('hidden', !isFormView);

  document.querySelectorAll('.nl-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === active);
  });
}

function updateHeaderDomain(domain) {
  // Removed domain from header display
}

function updatePopupSizeClass(size) {
  document.documentElement.classList.remove('size-compact', 'size-default', 'size-wider', 'size-extra-wide');
  document.documentElement.classList.add('size-' + size.replace('_', '-'));
}

function updateThemeIcon(isLight) {
  const icon = $('nl-theme-icon');
  if (!icon) return;
  if (isLight) {
    icon.className = 'ph-duotone ph-sun';
  } else {
    icon.className = 'ph-duotone ph-moon';
  }
}

// SVG shorthand helpers for icon buttons
const SVG = {
  fill:     `<i class="ph-duotone ph-arrow-square-in"></i>`,
  user:     `<i class="ph-duotone ph-user"></i>`,
  key:      `<i class="ph-duotone ph-key"></i>`,
  clock:    `<i class="ph-duotone ph-clock"></i>`,
  edit:     `<i class="ph-duotone ph-pencil-simple"></i>`,
  external: `<i class="ph-duotone ph-arrow-square-out"></i>`,
  chevron:  `<i class="ph-duotone ph-caret-right"></i>`,
};

function renderNotConnected(msg) {
  $('nl-content').innerHTML = `
    <div class="nl-empty">
      <div class="nl-empty-icon">
        <i class="ph-duotone ph-warning-octagon" style="font-size:40px;color:var(--danger)"></i>
      </div>
      <div class="nl-empty-text">${escapeHtml(msg) || 'NorthLocker is not running or is locked.'}</div>
      <div class="nl-empty-hint">Start NorthLocker and unlock your vault first.</div>
      <button class="nl-btn nl-btn-primary" id="nl-retry-btn" style="margin-top:8px">Retry</button>
    </div>`;
  $('nl-retry-btn')?.addEventListener('click', () => navigateTo('entries', { domain: currentDomain }));
}

// ── Helper: build a single entry card row ─────────────
function getFaviconUrl(entryUrl) {
  if (!entryUrl) return null;
  try {
    const url = entryUrl.startsWith('http') ? entryUrl : 'https://' + entryUrl;
    return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=32`;
  } catch { return null; }
}

function makeEntryRow(entry) {
  const row = document.createElement('div');
  row.className = 'nl-entry-row';
  const letter = (entry.title || entry.username || '?')[0].toUpperCase();
  const colors = ['#4f8ef7','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
  const color  = colors[letter.charCodeAt(0) % colors.length];
  const favicon = getFaviconUrl(entry.url);

  // Polymorphic avatar rendering based on type
  let avatarInner = '';
  if (entry.type === 'card') {
    avatarInner = `<i class="ph-duotone ph-credit-card" style="font-size:16px;color:var(--accent)"></i>`;
  } else if (entry.type === 'identity') {
    avatarInner = `<i class="ph-duotone ph-identification-card" style="font-size:16px;color:var(--accent)"></i>`;
  } else if (entry.type === 'note') {
    avatarInner = `<i class="ph-duotone ph-file-text" style="font-size:16px;color:var(--accent)"></i>`;
  } else if (entry.type === 'ssh_key') {
    avatarInner = `<i class="ph-duotone ph-key" style="font-size:16px;color:var(--accent)"></i>`;
  } else if (entry.type === 'passkey') {
    avatarInner = `<i class="ph-duotone ph-fingerprint" style="font-size:16px;color:var(--accent)"></i>`;
  } else {
    avatarInner = favicon
      ? `<img src="${favicon}" alt="${letter}" width="20" height="20" style="object-fit:contain;display:block">`
      : `<span style="color:${color};font-size:15px;font-weight:700">${letter}</span>`;
  }

  // Type-specific badge
  let typeBadge = '';
  if (entry.type === 'card') typeBadge = `<span class="nl-badge" style="color:var(--accent);border-color:var(--accent);padding:0px 4px;font-size:7.5px">Card</span>`;
  else if (entry.type === 'identity') typeBadge = `<span class="nl-badge" style="color:var(--accent);border-color:var(--accent);padding:0px 4px;font-size:7.5px">Identity</span>`;
  else if (entry.type === 'note') typeBadge = `<span class="nl-badge" style="color:var(--text-muted);border-color:var(--border);padding:0px 4px;font-size:7.5px">Note</span>`;
  else if (entry.type === 'ssh_key') typeBadge = `<span class="nl-badge" style="color:var(--warning);border-color:var(--warning);padding:0px 4px;font-size:7.5px">SSH Key</span>`;
  else if (entry.type === 'passkey') typeBadge = `<span class="nl-badge" style="color:var(--success);border-color:var(--success);padding:0px 4px;font-size:7.5px">Passkey</span>`;

  // Type-specific subtext
  let subText = entry.username || '';
  if (entry.type === 'card') {
    const num = entry.password || '';
    subText = num ? '•••• ' + num.slice(-4) : 'Payment Card';
  } else if (entry.type === 'note') {
    subText = 'Secure Note';
  } else if (entry.type === 'ssh_key') {
    subText = 'SSH Keypair';
  }

  const hasFill = entry.type === 'login' || !entry.type;
  const hasUser = !!entry.username;
  const hasPass = !!entry.password && entry.type !== 'note';

  row.innerHTML = `
    <div class="nl-entry-avatar">
      ${avatarInner}
    </div>
    <div class="nl-entry-info" data-id="${escapeHtml(entry.id)}" style="cursor:pointer">
      <div style="display:flex;align-items:center;gap:6px">
        <div class="nl-entry-name">${escapeHtml(entry.title || entry.username || '(no title)')}</div>
        ${entry.preferred ? `<span class="nl-badge" style="color:var(--warning);border-color:var(--warning);padding:0px 4px;font-size:7.5px">Pref</span>` : ''}
        ${entry.has_totp ? `<span class="nl-badge" style="color:var(--accent);border-color:var(--accent);padding:0px 4px;font-size:7.5px">TOTP</span>` : ''}
        ${typeBadge}
      </div>
      <div class="nl-entry-sub">${escapeHtml(subText)}</div>
    </div>
    <div class="nl-entry-actions">
      ${hasFill ? `<button class="nl-action-btn nl-fill-btn" data-id="${escapeHtml(entry.id)}" title="Autofill">${SVG.fill}</button>` : ''}
      ${hasUser ? `<button class="nl-action-btn nl-copy-user-btn" data-id="${escapeHtml(entry.id)}" title="Copy">${SVG.user}</button>` : ''}
      ${hasPass ? `<button class="nl-action-btn nl-copy-btn" data-id="${escapeHtml(entry.id)}" title="Copy">${SVG.key}</button>` : ''}
      ${entry.has_totp ? `<button class="nl-action-btn totp nl-copy-totp-btn" data-id="${escapeHtml(entry.id)}" title="Copy TOTP">${SVG.clock}</button>` : ''}
      <button class="nl-action-btn nl-row-more-btn" data-id="${escapeHtml(entry.id)}" title="More actions"><i class="ph-duotone ph-dots-three-vertical"></i></button>
    </div>`;

  // Wire handlers
  row.querySelector('.nl-entry-info').addEventListener('click', () => navigateTo('detail', { id: entry.id }));
  
  if (hasFill) {
    row.querySelector('.nl-fill-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const f = await sendBg({ type: 'GET_FILL', id: entry.id });
      if (f && currentTab) { await sendBg({ type: 'FILL_TAB', tabId: currentTab.id, username: f.username, password: f.password }); window.close(); }
    });
  }

  if (hasUser) {
    row.querySelector('.nl-copy-user-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const f = await sendBg({ type: 'GET_FILL', id: entry.id });
      if (f?.username) { navigator.clipboard?.writeText(f.username).catch(()=>{}); }
      flashBtn(row.querySelector('.nl-copy-user-btn'));
    });
  }

  if (hasPass) {
    row.querySelector('.nl-copy-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sendBg({ type: 'COPY', id: entry.id, field: 'password' });
      flashBtn(row.querySelector('.nl-copy-btn'));
    });
  }

  row.querySelector('.nl-copy-totp-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const t = await sendBg({ type: 'GET_TOTP', id: entry.id });
    if (t?.code) navigator.clipboard?.writeText(t.code.replace(/\s/g,'')).catch(()=>{});
    flashBtn(row.querySelector('.nl-copy-totp-btn'));
  });

  row.querySelector('.nl-row-more-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showRowDropdown(row.querySelector('.nl-row-more-btn'), entry.id, row);
  });
  
  return row;
}

function flashBtn(btn) {
  if (!btn) return;
  btn.style.color = 'var(--success)';
  setTimeout(() => { btn.style.color = ''; }, 1500);
}

let activeDropdownEntryId = null;
let activeDropdownRow = null;

async function showRowDropdown(btn, id, row) {
  activeDropdownEntryId = id;
  activeDropdownRow = row;

  const { favorites = [], archived = [] } = await new Promise(resolve => {
    try { chrome.storage.local.get(['favorites', 'archived'], d => resolve(d || {})); }
    catch { resolve({}); }
  });

  const isFav = favorites.includes(id);
  const isArc = archived.includes(id);

  const favText = $('nl-row-drop-fav-text');
  const favIcon = $('nl-row-drop-fav-icon');
  const arcText = $('nl-row-drop-arc-text');
  const arcIcon = $('nl-row-drop-arc-icon');

  if (favText) favText.textContent = isFav ? 'Unfavorite' : 'Favorite';
  if (favIcon) favIcon.className = isFav ? 'ph-duotone ph-star' : 'ph-duotone ph-star';

  if (arcText) arcText.textContent = isArc ? 'Unarchive' : 'Archive';
  if (arcIcon) arcIcon.className = isArc ? 'ph-duotone ph-archive' : 'ph-duotone ph-archive';

  const rect = btn.getBoundingClientRect();
  const drop = $('nl-row-dropdown');
  if (drop) {
    drop.style.position = 'fixed';
    drop.style.top = `${rect.bottom + 4}px`;
    drop.style.left = `${rect.right - 140}px`;
    drop.classList.remove('hidden');
  }
}

async function toggleFavorite(id) {
  try {
    chrome.storage.local.get('favorites', (res) => {
      let favorites = res.favorites || [];
      if (favorites.includes(id)) {
        favorites = favorites.filter(favId => favId !== id);
      } else {
        favorites.push(id);
      }
      chrome.storage.local.set({ favorites }, () => {
        refreshCurrentView();
      });
    });
  } catch (e) {}
}

async function toggleArchive(id) {
  try {
    chrome.storage.local.get('archived', (res) => {
      let archived = res.archived || [];
      if (archived.includes(id)) {
        archived = archived.filter(arcId => arcId !== id);
      } else {
        archived.push(id);
      }
      chrome.storage.local.set({ archived }, () => {
        refreshCurrentView();
      });
    });
  } catch (e) {}
}

async function cloneEntry(id) {
  const details = await sendBg({ type: 'GET_ENTRY', id });
  const fill = await sendBg({ type: 'GET_FILL', id });
  if (!details) return;

  const newEntry = {
    title: (details.title || 'Untitled') + ' (Clone)',
    username: details.username || fill?.username || '',
    password: fill?.password || '',
    url: details.url || '',
    totp_secret: details.totp_secret || '',
    notes: details.notes || '',
    type: details.type || 'login'
  };

  const r = await sendBg({ type: 'SAVE_ENTRY', entry: newEntry });
  if (r && r.success) {
    refreshCurrentView();
  }
}

function deleteEntry(id) {
  const modal = $('nl-delete-modal');
  const cancelBtn = $('nl-delete-cancel-btn');
  const confirmBtn = $('nl-delete-confirm-btn');
  if (!modal || !cancelBtn || !confirmBtn) return;

  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    cancelBtn.removeEventListener('click', onCancel);
    confirmBtn.removeEventListener('click', onConfirm);
  };

  const onCancel = () => {
    cleanup();
  };

  const onConfirm = async () => {
    cleanup();
    await sendBg({ type: 'DELETE_ENTRY', id });
    const currentView = viewStack[viewStack.length - 1];
    if (currentView === 'detail') {
      navigateBack();
    } else {
      refreshCurrentView();
    }
  };

  cancelBtn.addEventListener('click', onCancel);
  confirmBtn.addEventListener('click', onConfirm);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup();
  });
}

function refreshCurrentView() {
  const currentView = viewStack[viewStack.length - 1];
  $('nl-content').innerHTML = '';
  if (viewRenderers[currentView]) {
    viewRenderers[currentView]({ domain: currentDomain });
  }
  const globalSearch = $('nl-global-search');
  if (currentView === 'search' && globalSearch) {
    globalSearch.dispatchEvent(new Event('input'));
  }
}

// ── VIEW: Entries ─────────────────────────────────────

registerView('entries', async ({ domain } = {}) => {
  const d = domain || currentDomain;
  // Skip domain matching for extension pages
  const isExtPage = !d || d.startsWith('chrome-extension') || d.startsWith('moz-extension') || d === 'newtab';
  const baseDomain = isExtPage ? '' : getBaseDomain(d);
  updateHeaderDomain(isExtPage ? '' : d);
  $('nl-content').innerHTML = '<div class="nl-empty nl-muted">Loading…</div>';

  const ping = await sendBg({ type: 'PING' });
  if (!ping || !ping.ok) { renderNotConnected('NorthLocker is not running or is locked.'); return; }

  // Always fetch all entries; also fetch domain-specific matches, plus user preferences (favorites/archived)
  const [domainRes, allRes, storageRes] = await Promise.all([
    baseDomain ? sendBg({ type: 'GET_CREDENTIALS', domain: baseDomain }) : Promise.resolve({ entries: [] }),
    sendBg({ type: 'SEARCH', query: '' }),
    new Promise(resolve => {
      try {
        chrome.storage.local.get(['favorites', 'archived', 'entryFolders'], d => resolve(d || {}));
      } catch {
        resolve({});
      }
    })
  ]);

  const favoritesList = storageRes.favorites || [];
  const archivedList  = storageRes.archived  || [];
  const entryFolders  = storageRes.entryFolders || {};
  const favIds = new Set(favoritesList);
  const arcIds = new Set(archivedList);

  // Dynamic Folder and Type filter function
  const filterFn = (e) => {
    // Type filtering
    if (currentTypeFilter !== 'all') {
      const t = e.type || 'login';
      if (currentTypeFilter === 'login') {
        if (t !== 'login') return false;
      } else {
        if (t !== currentTypeFilter) return false;
      }
    }
    // Folder filtering
    if (currentFolderFilter !== 'all') {
      const folder = entryFolders[e.id] || '';
      if (currentFolderFilter === 'none') {
        if (folder !== '') return false;
      } else {
        if (folder !== currentFolderFilter) return false;
      }
    }
    return true;
  };

  const domainEntries = (domainRes?.entries || []).filter(e => !arcIds.has(e.id) && filterFn(e));
  const allEntries    = (allRes?.entries || []).filter(e => !arcIds.has(e.id) && filterFn(e));

  // 1. Favorites
  const favoriteEntries = allEntries.filter(e => favIds.has(e.id));
  const favIdsSet = new Set(favoriteEntries.map(e => e.id));

  // 2. Suggestions (domain match, not favorited)
  const suggestionEntries = domainEntries.filter(e => !favIdsSet.has(e.id));
  const sugIdsSet = new Set(suggestionEntries.map(e => e.id));

  // 3. Other entries (not favorited, not suggestion)
  const otherEntries = allEntries.filter(e => !favIdsSet.has(e.id) && !sugIdsSet.has(e.id));

  $('nl-content').innerHTML = '';

  if (favoriteEntries.length === 0 && suggestionEntries.length === 0 && otherEntries.length === 0) {
    $('nl-content').innerHTML = `
      <div class="nl-empty">
        <div class="nl-empty-icon"><i class="ph-duotone ph-folder-simple-lock" style="font-size:40px;color:var(--border-light)"></i></div>
        <div class="nl-empty-text">Your vault is empty</div>
        <div class="nl-empty-hint">Click + New to add your first entry.</div>
      </div>`;
    return;
  }

  // Favorites section
  if (favoriteEntries.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'nl-section-header';
    sec.innerHTML = `<span class="nl-section-title">Favorites</span>
      <span class="nl-section-count">${favoriteEntries.length}</span>`;
    $('nl-content').appendChild(sec);
    favoriteEntries.forEach(e => $('nl-content').appendChild(makeEntryRow(e)));
  }

  // Autofill suggestions section
  if (suggestionEntries.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'nl-section-header';
    sec.innerHTML = `<span class="nl-section-title">Autofill suggestions</span>
      <span class="nl-section-count">${suggestionEntries.length}</span>`;
    $('nl-content').appendChild(sec);
    suggestionEntries.forEach(e => $('nl-content').appendChild(makeEntryRow(e)));
  }

  // All items section
  if (otherEntries.length > 0) {
    const sec2 = document.createElement('div');
    sec2.className = 'nl-section-header';
    sec2.innerHTML = `<span class="nl-section-title">All items</span>
      <span class="nl-section-count">${otherEntries.length}</span>`;
    $('nl-content').appendChild(sec2);
    otherEntries.forEach(e => $('nl-content').appendChild(makeEntryRow(e)));
  }
});

// ── VIEW: Search ──────────────────────────────────────

registerView('search', () => {
  $('nl-content').innerHTML = '<div class="nl-empty nl-muted">Searching…</div>';
  // Delegate to global search — focus it
  const globalSearch = $('nl-global-search');
  if (globalSearch) {
    setTimeout(() => globalSearch.focus(), 50);
    // Trigger search if something is already typed
    if (globalSearch.value.trim()) {
      globalSearch.dispatchEvent(new Event('input'));
    } else {
      // Show all entries
      sendBg({ type: 'SEARCH', query: '' }).then(r => {
        const entries = r?.entries || [];
        renderSearchResults(entries, '');
      });
    }
  }
});


// ── VIEW: Save Entry ──────────────────────────────────

registerView('save', async ({ prefill, type = 'login' } = {}) => {
  let tabTitle = prefill?.title || '';
  let tabUrl = prefill?.url || currentDomain || '';

  if (!tabTitle && currentTab) {
    tabTitle = (currentTab.title || '').substring(0, 40);
    tabUrl = tabUrl || currentTab.url || '';
  }

  // 1. Render dynamic form HTML based on type
  let formHtml = `<input type="hidden" id="nl-save-type" value="${escapeHtml(type)}">`;
  
  if (type === 'login') {
    formHtml += `
      <div class="nl-form-group">
        <label for="nl-save-title">Title</label>
        <input type="text" id="nl-save-title" value="${escapeHtml(tabTitle)}" autocomplete="off" required>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-username">Username</label>
        <input type="text" id="nl-save-username" value="${escapeHtml(prefill?.username || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label for="nl-save-password">Password</label>
        <div class="nl-password-row">
          <div style="position:relative;display:flex;align-items:center;flex:1">
            <input type="password" id="nl-save-password" value="${escapeHtml(prefill?.password || '')}" autocomplete="off" style="flex:1;padding-right:32px">
            <button type="button" id="nl-save-pass-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
          </div>
          <button type="button" id="nl-save-gen-btn" class="nl-btn nl-btn-sm">Gen</button>
        </div>
        <div class="nl-strength-bar" id="nl-save-strength-bar" style="width:0%"></div>
        <div class="nl-strength-label" id="nl-save-strength-label"></div>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-url">URL</label>
        <input type="text" id="nl-save-url" value="${escapeHtml(tabUrl)}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label for="nl-save-totp">TOTP Secret</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="nl-save-totp" value="${escapeHtml(prefill?.totp_secret || '')}" autocomplete="off" placeholder="optional" style="flex:1;padding-right:32px">
          <button type="button" id="nl-save-totp-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
    `;
  } else if (type === 'card') {
    formHtml += `
      <div class="nl-form-section-title" style="margin-top:12px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Item details</div>
      <div class="nl-form-group">
        <label for="nl-save-title">Item name (required)</label>
        <input type="text" id="nl-save-title" placeholder="e.g. Sapphire Preferred" autocomplete="off" required>
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Card details</div>
      <div class="nl-form-group">
        <label for="nl-save-username">Cardholder name</label>
        <input type="text" id="nl-save-username" placeholder="John Doe" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label for="nl-save-password">Number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="nl-save-password" placeholder="Card Number" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="nl-save-pass-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-brand">Brand</label>
        <select id="nl-save-brand" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
          <option value="">-- Select --</option>
          <option value="Visa">Visa</option>
          <option value="Mastercard">Mastercard</option>
          <option value="American Express">American Express</option>
          <option value="Discover">Discover</option>
          <option value="Diners Club">Diners Club</option>
          <option value="JCB">JCB</option>
        </select>
      </div>
      <div class="nl-form-group" style="display:flex;gap:10px">
        <div style="flex:1">
          <label for="nl-save-exp-month">Expiration month</label>
          <select id="nl-save-exp-month" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
            <option value="">-- Select --</option>
            ${Array.from({length:12}, (_,i)=>(i+1).toString().padStart(2,'0')).map(m=>`<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label for="nl-save-exp-year">Expiration year</label>
          <input type="text" id="nl-save-exp-year" placeholder="0" autocomplete="off" style="width:100%">
        </div>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-totp">Security code</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="nl-save-totp" placeholder="Security Code" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="nl-save-totp-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
    `;
  } else if (type === 'identity') {
    formHtml += `
      <div class="nl-form-section-title" style="margin-top:12px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Item details</div>
      <div class="nl-form-group">
        <label for="nl-save-title">Item name (required)</label>
        <input type="text" id="nl-save-title" placeholder="e.g. Personal Profile" autocomplete="off" required>
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Personal details</div>
      <div class="nl-form-group">
        <label for="nl-save-id-prefix">Title</label>
        <select id="nl-save-id-prefix" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
          <option value="">-- Select --</option>
          <option value="Mr.">Mr.</option>
          <option value="Ms.">Ms.</option>
          <option value="Mrs.">Mrs.</option>
          <option value="Dr.">Dr.</option>
        </select>
      </div>
      <div class="nl-form-group" style="display:flex;gap:10px">
        <div style="flex:1">
          <label for="nl-save-first-name">First name</label>
          <input type="text" id="nl-save-first-name" placeholder="John" autocomplete="off" style="width:100%">
        </div>
        <div style="flex:1">
          <label for="nl-save-middle-name">Middle name</label>
          <input type="text" id="nl-save-middle-name" placeholder="Adam" autocomplete="off" style="width:100%">
        </div>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-last-name">Last name</label>
        <input type="text" id="nl-save-last-name" placeholder="Doe" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label for="nl-save-username">Username</label>
        <input type="text" id="nl-save-username" placeholder="johndoe12" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label for="nl-save-company">Company</label>
        <input type="text" id="nl-save-company" placeholder="Acme Corp" autocomplete="off">
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Identification</div>
      <div class="nl-form-group">
        <label for="nl-save-ssn">Social Security number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="nl-save-ssn" placeholder="SSN" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="nl-save-ssn-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
      <div class="nl-form-group">
        <label for="nl-save-passport">Passport number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="nl-save-passport" placeholder="Passport Number" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="nl-save-passport-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
    `;
  } else if (type === 'note') {
    formHtml += `
      <div class="nl-form-group">
        <label for="nl-save-title">Title</label>
        <input type="text" id="nl-save-title" placeholder="e.g. WiFi Password / Secure Note" autocomplete="off" required>
      </div>
    `;
  }

  // Common Folder selector
  formHtml += `
    <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Additional options</div>
    <div class="nl-form-group">
      <label for="nl-save-folder">Folder</label>
      <select id="nl-save-folder" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
        <option value="">-- Select --</option>
      </select>
    </div>
    <div class="nl-form-group">
      <label for="nl-save-notes">${type === 'note' ? 'Secure Note Content' : 'Notes'}</label>
      <textarea id="nl-save-notes" placeholder="optional notes..." style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none;resize:vertical;min-height:60px">${escapeHtml(prefill?.notes || '')}</textarea>
    </div>
  `;

  let headerTitle = 'Login';
  if (type === 'card') headerTitle = 'Cards';
  else if (type === 'identity') headerTitle = 'Identity';
  else if (type === 'note') headerTitle = 'Notes';

  activeDynamicTitle = headerTitle;

  $('nl-content').innerHTML = `
    <form id="nl-save-form" style="padding: 14px">
      ${formHtml}
      <div class="nl-form-actions" style="margin-top:16px">
        <button type="submit" class="nl-btn nl-btn-primary" style="flex:1">Save Entry</button>
        <button type="button" class="nl-btn" id="nl-save-cancel">Cancel</button>
      </div>
    </form>
    <div id="nl-save-status" style="padding:6px 14px;font-size:11px"></div>`;

  // 2. Populate folders selector options
  const { folders = [] } = await new Promise(resolve => {
    try { chrome.storage.local.get('folders', d => resolve(d || {})); }
    catch { resolve({}); }
  });
  const folderSelect = $('nl-save-folder');
  if (folderSelect) {
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      folderSelect.appendChild(opt);
    });
  }

  // 3. Setup standard events for fields that are present
  $('nl-save-pass-toggle')?.addEventListener('click', () => {
    const el = $('nl-save-password');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('nl-save-pass-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('nl-save-totp-toggle')?.addEventListener('click', () => {
    const el = $('nl-save-totp');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('nl-save-totp-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('nl-save-ssn-toggle')?.addEventListener('click', () => {
    const el = $('nl-save-ssn');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('nl-save-ssn-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('nl-save-passport-toggle')?.addEventListener('click', () => {
    const el = $('nl-save-passport');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('nl-save-passport-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('nl-save-password')?.addEventListener('input', () => {
    if (type !== 'login') return; // only run strength meter on standard login password field
    const strength = calculateStrength($('nl-save-password').value);
    const info = getStrengthInfo(strength);
    const pcts = [0, 25, 60, 100];
    const colors = ['var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--success)'];
    const bar = $('nl-save-strength-bar');
    const lbl = $('nl-save-strength-label');
    if (bar) bar.style.width = pcts[strength] + '%';
    if (bar) bar.style.background = colors[strength];
    if (lbl) lbl.textContent = info.label;
    if (lbl) lbl.className = 'nl-strength-label ' + info.cls;
  });

  $('nl-save-gen-btn')?.addEventListener('click', async () => {
    const cfg = await loadGeneratorConfig();
    const r = generatePassword(cfg);
    const passInput = $('nl-save-password');
    if (passInput) {
      passInput.value = r.password;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // 4. Submission handler
  $('nl-save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const entry = {
      type,
      title: $('nl-save-title').value.trim()
    };

    if (!entry.title) {
      $('nl-save-status').innerHTML = '<span class="nl-error">[!] Title is required</span>';
      return;
    }

    if (type === 'login') {
      entry.username = $('nl-save-username').value.trim();
      entry.password = $('nl-save-password').value;
      entry.url = $('nl-save-url').value.trim();
      entry.totp_secret = $('nl-save-totp').value.trim() || null;
      entry.notes = $('nl-save-notes').value.trim();
    } else if (type === 'card') {
      entry.username = $('nl-save-username').value.trim(); // Cardholder Name
      entry.password = $('nl-save-password').value; // Card Number
      
      const brand = $('nl-save-brand').value;
      const exp_month = $('nl-save-exp-month').value;
      const exp_year = $('nl-save-exp-year').value.trim();
      const cvv = $('nl-save-totp').value;
      const notes = $('nl-save-notes').value.trim();
      
      entry.url = (exp_month && exp_year) ? `${exp_month}/${exp_year}` : '';
      entry.totp_secret = cvv || null;
      entry.notes = JSON.stringify({
        brand,
        exp_month,
        exp_year,
        cvv,
        notes
      });
    } else if (type === 'identity') {
      const title_prefix = $('nl-save-id-prefix').value;
      const first_name = $('nl-save-first-name').value.trim();
      const middle_name = $('nl-save-middle-name').value.trim();
      const last_name = $('nl-save-last-name').value.trim();
      const company = $('nl-save-company').value.trim();
      const ssn = $('nl-save-ssn').value;
      const passport = $('nl-save-passport').value;
      const notes = $('nl-save-notes').value.trim();
      
      entry.username = $('nl-save-username').value.trim(); // Username/Login
      entry.password = ssn || ''; // Map SSN to password column for security fallback
      entry.url = passport || ''; // Map Passport to url column for safety fallback
      entry.notes = JSON.stringify({
        title_prefix,
        first_name,
        middle_name,
        last_name,
        company,
        ssn,
        passport_number: passport,
        notes
      });
    } else if (type === 'note') {
      entry.notes = $('nl-save-notes').value.trim();
    }

    const r = await sendBg({ type: 'SAVE_ENTRY', entry });
    if (r && r.success) {
      // Save folder selection
      const selFolder = $('nl-save-folder')?.value || '';
      const { entryFolders = {} } = await new Promise(resolve => {
        try { chrome.storage.local.get('entryFolders', d => resolve(d || {})); }
        catch { resolve({}); }
      });
      
      const newId = r.id;
      if (newId) {
        if (selFolder) {
          entryFolders[newId] = selFolder;
        } else {
          delete entryFolders[newId];
        }
        await new Promise(resolve => chrome.storage.local.set({ entryFolders }, resolve));
      }

      $('nl-save-status').innerHTML = '<span class="nl-success">[+] Entry saved</span>';
      setTimeout(navigateBack, 1000);
    } else {
      $('nl-save-status').innerHTML = '<span class="nl-error">[!] Failed. Is NorthLocker running?</span>';
    }
  });

  $('nl-save-cancel').addEventListener('click', navigateBack);
});

// ── VIEW: Detail (View Login) ─────────────────────────

registerView('detail', async ({ id } = {}) => {
  if (!id) { navigateBack(); return; }
  $('nl-content').innerHTML = '<div class="nl-empty nl-muted">Loading…</div>';

  // Fetch entry details and fill data in parallel
  const [detailRes, fillRes] = await Promise.all([
    sendBg({ type: 'GET_ENTRY', id }),
    sendBg({ type: 'GET_FILL',  id }),
  ]);

  const details = detailRes?.entry || detailRes || {};
  const fill    = fillRes || {};

  const title    = details.title    || fill.username || id;
  const username = fill.username    || details.username || '';
  const password = fill.password    || '';
  const url      = details.url      || '';
  const notes    = details.notes    || '';
  const hasTotp  = !!details.has_totp;
  const type     = details.type     || 'login';

  let headerTitle = 'Login';
  if (type === 'card') headerTitle = 'Cards';
  else if (type === 'identity') headerTitle = 'Identity';
  else if (type === 'note') headerTitle = 'Notes';
  
  activeDynamicTitle = headerTitle;

  const letter = title[0]?.toUpperCase() || '?';
  const colors = ['#4f8ef7','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
  const color  = colors[letter.charCodeAt(0) % colors.length];
  const favicon = getFaviconUrl(url);

  let avatarInner = '';
  if (type === 'card') {
    avatarInner = `<i class="ph-duotone ph-credit-card" style="font-size:18px;color:var(--accent)"></i>`;
  } else if (type === 'identity') {
    avatarInner = `<i class="ph-duotone ph-identification-card" style="font-size:18px;color:var(--accent)"></i>`;
  } else if (type === 'note') {
    avatarInner = `<i class="ph-duotone ph-file-text" style="font-size:18px;color:var(--accent)"></i>`;
  } else if (type === 'ssh_key') {
    avatarInner = `<i class="ph-duotone ph-key" style="font-size:18px;color:var(--accent)"></i>`;
  } else if (type === 'passkey') {
    avatarInner = `<i class="ph-duotone ph-fingerprint" style="font-size:18px;color:var(--accent)"></i>`;
  } else {
    avatarInner = favicon
      ? `<img src="${favicon}" alt="${letter}"
             style="object-fit:contain;display:block;width:24px;height:24px"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <span style="display:none;color:${color};font-size:16px;font-weight:700">${letter}</span>`
      : `<span style="color:${color};font-size:16px;font-weight:700">${letter}</span>`;
  }

  // SVG icons used in this view
  const iCopy = `<i class="ph-duotone ph-copy"></i>`;
  const iEye  = `<i class="ph-duotone ph-eye"></i>`;
  const iEyeOff = `<i class="ph-duotone ph-eye-closed"></i>`;
  const iEdit = `<i class="ph-duotone ph-pencil-simple"></i>`;
  const iTrash = `<i class="ph-duotone ph-trash"></i>`;
  const iFill = `<i class="ph-duotone ph-arrow-square-in"></i>`;

  function flashGreen(btn) {
    if (!btn) return;
    btn.style.color = 'var(--success)';
    setTimeout(() => { btn.style.color = ''; }, 1500);
  }

  if (type === 'passkey') {
    $('nl-content').innerHTML = `
      <!-- Header card -->
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:var(--success);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px;font-weight:600">Passkey Credential</div>
        </div>
      </div>

      <!-- Passkey details section -->
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Passkey Details</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);overflow:hidden">

        <!-- Relying Party -->
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Relying Party</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;
                 text-overflow:ellipsis">${escapeHtml(details.rp_name || details.rp_id || 'Unknown')}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${escapeHtml(details.rp_id || '')}</div>
          </div>
        </div>

        <!-- Credential ID -->
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Credential ID</div>
            <div style="font-size:11px;font-family:monospace;color:var(--text-secondary);white-space:nowrap;overflow:hidden;
                 text-overflow:ellipsis" id="dv-cred-id">${escapeHtml(details.credential_id || '')}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-cred" title="Copy Credential ID">${iCopy}</button>
        </div>

        <!-- Protection -->
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Algorithm & Protection</div>
            <div style="font-size:13px;color:var(--text-primary)">ECDSA ES256 (P-256)</div>
            <div style="font-size:11px;color:var(--success);margin-top:2px;font-weight:600;display:flex;align-items:center;gap:4px">
              <i class="ph-bold ph-shield-check" style="font-size:12px"></i> Encrypted at Rest (AES-GCM)
            </div>
          </div>
        </div>

        <!-- Usage -->
        <div style="display:flex;align-items:center;padding:12px 14px;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Usage Statistics</div>
            <div style="font-size:13px;color:var(--text-primary)">Used <strong>${details.sign_count || 0}</strong> times</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Last Used: ${details.last_used ? new Date(details.last_used).toLocaleString() : 'Never'}</div>
          </div>
        </div>
      </div>

      <!-- Notes section -->
      ${notes ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Notes</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;font-size:12px;
           color:var(--text-secondary);line-height:1.5">${escapeHtml(notes)}</div>` : ''}

      <div style="height:60px"></div>
    `;

    $('dv-copy-cred')?.addEventListener('click', () => {
      if (details.credential_id) {
        navigator.clipboard?.writeText(details.credential_id).catch(() => {});
      }
      flashGreen($('dv-copy-cred'));
    });

  } else if (type === 'card') {
    let parsed = {};
    let actualNotes = notes;
    try {
      if (details.notes && details.notes.startsWith('{')) {
        parsed = JSON.parse(details.notes);
        actualNotes = parsed.notes || '';
      }
    } catch(e) {}

    const brand = parsed.brand || 'Payment Card';
    const cardholder = username || parsed.cardholder_name || '';
    const cardnum = password || '';
    const exp = url || '';
    const cvv = details.totp_secret || parsed.cvv || '';

    $('nl-content').innerHTML = `
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:var(--accent);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px;font-weight:600">${escapeHtml(brand)}</div>
        </div>
      </div>

      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Card Details</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);overflow:hidden">

        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Cardholder Name</div>
            <div style="font-size:13px;color:var(--text-primary)" id="dv-cardholder">${escapeHtml(cardholder || '(none)')}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-cardholder" title="Copy">${iCopy}</button>
        </div>

        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Card Number</div>
            <div style="font-size:13px;color:var(--text-primary);letter-spacing:2px" id="dv-cardnum">●●●●●●●●●●●●</div>
          </div>
          <button class="nl-action-btn" id="dv-eye-cardnum" title="Show">${iEye}</button>
          <button class="nl-action-btn" id="dv-copy-cardnum" title="Copy">${iCopy}</button>
        </div>

        <div style="display:flex;padding:12px 14px;gap:20px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Expiration Date</div>
            <div style="font-size:13px;color:var(--text-primary)">${escapeHtml(exp || '(none)')}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Security Code (CVV)</div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:13px;color:var(--text-primary)" id="dv-cvv">•••</div>
              <button class="nl-action-btn" id="dv-eye-cvv" title="Show" style="padding:0;width:auto;height:auto">${iEye}</button>
              <button class="nl-action-btn" id="dv-copy-cvv" title="Copy" style="padding:0;width:auto;height:auto">${iCopy}</button>
            </div>
          </div>
        </div>
      </div>

      ${actualNotes ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Notes</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;font-size:12px;
           color:var(--text-secondary);line-height:1.5">${escapeHtml(actualNotes)}</div>` : ''}

      <div style="height:60px"></div>
    `;

    $('dv-copy-cardholder').addEventListener('click', () => {
      if (cardholder) navigator.clipboard?.writeText(cardholder).catch(() => {});
      flashGreen($('dv-copy-cardholder'));
    });

    let cardVisible = false;
    $('dv-eye-cardnum').addEventListener('click', () => {
      cardVisible = !cardVisible;
      $('dv-cardnum').textContent = cardVisible ? cardnum : '●●●●●●●●●●●●';
      $('dv-cardnum').style.letterSpacing = cardVisible ? '0.5px' : '2px';
      $('dv-eye-cardnum').innerHTML = cardVisible ? iEyeOff : iEye;
    });

    $('dv-copy-cardnum').addEventListener('click', () => {
      if (cardnum) navigator.clipboard?.writeText(cardnum).catch(() => {});
      flashGreen($('dv-copy-cardnum'));
    });

    let cvvVisible = false;
    $('dv-eye-cvv').addEventListener('click', () => {
      cvvVisible = !cvvVisible;
      $('dv-cvv').textContent = cvvVisible ? (cvv || 'N/A') : '•••';
      $('dv-eye-cvv').innerHTML = cvvVisible ? iEyeOff : iEye;
    });

    $('dv-copy-cvv').addEventListener('click', () => {
      if (cvv) navigator.clipboard?.writeText(cvv).catch(() => {});
      flashGreen($('dv-copy-cvv'));
    });

  } else if (type === 'identity') {
    let parsed = {};
    let actualNotes = notes;
    try {
      if (details.notes && details.notes.startsWith('{')) {
        parsed = JSON.parse(details.notes);
        actualNotes = parsed.notes || '';
      }
    } catch(e) {}

    const first = parsed.first_name || '';
    const last = parsed.last_name || '';
    const middle = parsed.middle_name || '';
    const company = parsed.company || '';
    const ssn = parsed.ssn || password || '';
    const passport = parsed.passport_number || url || '';
    const id_user = username || '';

    let fullname = `${parsed.title_prefix || ''} ${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
    if (!fullname) fullname = title;

    $('nl-content').innerHTML = `
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(fullname)}</div>
          <div style="font-size:11px;color:var(--accent);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px;font-weight:600">Identity Profile</div>
        </div>
      </div>

      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Profile Details</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);overflow:hidden">

        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Full Name</div>
            <div style="font-size:13px;color:var(--text-primary)">${escapeHtml(fullname)}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-fullname" title="Copy">${iCopy}</button>
        </div>

        ${id_user ? `
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Username / Login</div>
            <div style="font-size:13px;color:var(--text-primary)">${escapeHtml(id_user)}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-login" title="Copy">${iCopy}</button>
        </div>` : ''}

        ${company ? `
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Company</div>
            <div style="font-size:13px;color:var(--text-primary)">${escapeHtml(company)}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-company" title="Copy">${iCopy}</button>
        </div>` : ''}

        ${ssn ? `
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Social Security Number</div>
            <div style="font-size:13px;color:var(--text-primary)" id="dv-ssn">•••••••••</div>
          </div>
          <button class="nl-action-btn" id="dv-eye-ssn" title="Show">${iEye}</button>
          <button class="nl-action-btn" id="dv-copy-ssn" title="Copy">${iCopy}</button>
        </div>` : ''}

        ${passport ? `
        <div style="display:flex;align-items:center;padding:12px 14px;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Passport Number</div>
            <div style="font-size:13px;color:var(--text-primary)" id="dv-passport">•••••••••</div>
          </div>
          <button class="nl-action-btn" id="dv-eye-passport" title="Show">${iEye}</button>
          <button class="nl-action-btn" id="dv-copy-passport" title="Copy">${iCopy}</button>
        </div>` : ''}
      </div>

      ${actualNotes ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Notes</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;font-size:12px;
           color:var(--text-secondary);line-height:1.5">${escapeHtml(actualNotes)}</div>` : ''}

      <div style="height:60px"></div>
    `;

    $('dv-copy-fullname')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(fullname).catch(() => {});
      flashGreen($('dv-copy-fullname'));
    });

    $('dv-copy-login')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(id_user).catch(() => {});
      flashGreen($('dv-copy-login'));
    });

    $('dv-copy-company')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(company).catch(() => {});
      flashGreen($('dv-copy-company'));
    });

    let ssnVisible = false;
    $('dv-eye-ssn')?.addEventListener('click', () => {
      ssnVisible = !ssnVisible;
      $('dv-ssn').textContent = ssnVisible ? ssn : '•••••••••';
      $('dv-eye-ssn').innerHTML = ssnVisible ? iEyeOff : iEye;
    });

    $('dv-copy-ssn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(ssn).catch(() => {});
      flashGreen($('dv-copy-ssn'));
    });

    let passportVisible = false;
    $('dv-eye-passport')?.addEventListener('click', () => {
      passportVisible = !passportVisible;
      $('dv-passport').textContent = passportVisible ? passport : '•••••••••';
      $('dv-eye-passport').innerHTML = passportVisible ? iEyeOff : iEye;
    });

    $('dv-copy-passport')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(passport).catch(() => {});
      flashGreen($('dv-copy-passport'));
    });

  } else if (type === 'note') {
    $('nl-content').innerHTML = `
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px;font-weight:600">Secure Note</div>
        </div>
      </div>

      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Secure Note Content</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;position:relative">
        <button class="nl-action-btn" id="dv-copy-note" title="Copy Note Content" style="position:absolute;right:8px;top:8px;z-index:2">${iCopy}</button>
        <pre style="margin:0;font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5;font-family:inherit" id="dv-note-text">${escapeHtml(notes || '(empty)')}</pre>
      </div>

      <div style="height:60px"></div>
    `;

    $('dv-copy-note').addEventListener('click', () => {
      if (notes) navigator.clipboard?.writeText(notes).catch(() => {});
      flashGreen($('dv-copy-note'));
    });

  } else if (type === 'ssh_key') {
    $('nl-content').innerHTML = `
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:var(--warning);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px;font-weight:600">SSH Keypair</div>
        </div>
      </div>

      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Keypair Details</div>
      
      <div style="margin:0 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;position:relative">
        <div style="font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Public Key</div>
        <button class="nl-action-btn" id="dv-copy-pubkey" title="Copy" style="position:absolute;right:8px;top:8px;z-index:2">${iCopy}</button>
        <textarea readonly id="dv-pubkey-txt" style="width:100%;box-sizing:border-box;background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:6px;font-size:10px;font-family:monospace;color:var(--text-primary);resize:none;height:50px;outline:none">${escapeHtml(username || '(empty)')}</textarea>
      </div>

      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;position:relative">
        <div style="font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Private Key</div>
        <div style="position:absolute;right:8px;top:8px;z-index:2;display:flex;gap:4px">
          <button class="nl-action-btn" id="dv-eye-privkey" title="Show">${iEye}</button>
          <button class="nl-action-btn" id="dv-copy-privkey" title="Copy">${iCopy}</button>
        </div>
        <textarea readonly id="dv-privkey-txt" style="width:100%;box-sizing:border-box;background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:6px;font-size:10px;font-family:monospace;color:var(--text-primary);resize:none;height:80px;outline:none;filter:blur(4px);transition:filter 0.2s"></textarea>
      </div>

      ${notes ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Notes</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;font-size:12px;
           color:var(--text-secondary);line-height:1.5">${escapeHtml(notes)}</div>` : ''}

      <div style="height:60px"></div>
    `;

    $('dv-copy-pubkey').addEventListener('click', () => {
      if (username) navigator.clipboard?.writeText(username).catch(() => {});
      flashGreen($('dv-copy-pubkey'));
    });

    const privKeyEl = $('dv-privkey-txt');
    if (privKeyEl) privKeyEl.value = password || '(empty)';

    let privVisible = false;
    $('dv-eye-privkey').addEventListener('click', () => {
      privVisible = !privVisible;
      privKeyEl.style.filter = privVisible ? 'none' : 'blur(4px)';
      $('dv-eye-privkey').innerHTML = privVisible ? iEyeOff : iEye;
    });

    $('dv-copy-privkey').addEventListener('click', () => {
      sendBg({ type: 'COPY', id, field: 'password' });
      flashGreen($('dv-copy-privkey'));
    });

  } else {
    $('nl-content').innerHTML = `
      <!-- Header card -->
      <div style="margin:14px 14px 10px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
             flex-shrink:0;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">${avatarInner}</div>
        <div style="min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;
               letter-spacing:0.5px">${escapeHtml(type)}</div>
        </div>
      </div>

      <!-- Login credentials section -->
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Login credentials</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);overflow:hidden">

        <!-- Username row -->
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:1px solid var(--border);gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Username</div>
            <div style="font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;
                 text-overflow:ellipsis" id="dv-username">${escapeHtml(username || '(none)')}</div>
          </div>
          <button class="nl-action-btn" id="dv-copy-user" title="Copy username">${iCopy}</button>
        </div>

        <!-- Password row -->
        <div style="display:flex;align-items:center;padding:12px 14px;
             border-bottom:${hasTotp ? '1px solid var(--border)' : 'none'};gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Password</div>
            <div style="font-size:14px;color:var(--text-primary);letter-spacing:2px;
                 word-break:break-all" id="dv-password">●●●●●●●●●●●●</div>
          </div>
          <button class="nl-action-btn" id="dv-eye" title="Show password">${iEye}</button>
          <button class="nl-action-btn" id="dv-copy-pass" title="Copy password">${iCopy}</button>
        </div>

        <!-- TOTP row (conditional) -->
        ${hasTotp ? `
        <div style="display:flex;align-items:center;padding:12px 14px;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                 letter-spacing:0.5px;margin-bottom:3px">Verification code (TOTP)</div>
            <div style="font-size:18px;font-weight:600;color:var(--accent);letter-spacing:4px;
                 font-family:monospace" id="dv-totp-code">------</div>
          </div>
          <span id="dv-totp-timer" style="font-size:10px;color:var(--text-muted);flex-shrink:0"></span>
          <button class="nl-action-btn totp" id="dv-copy-totp" title="Copy TOTP">${iCopy}</button>
        </div>` : ''}
      </div>

      <!-- URL section -->
      ${url ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Website</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);overflow:hidden">
        <div style="display:flex;align-items:center;padding:12px 14px;gap:10px">
          <div style="flex:1;font-size:12px;color:var(--accent);white-space:nowrap;overflow:hidden;
               text-overflow:ellipsis">${escapeHtml(url)}</div>
        </div>
      </div>` : ''}

      <!-- Notes section -->
      ${notes ? `
      <div style="margin:0 14px 10px;font-size:11px;font-weight:600;color:var(--text-muted);
           text-transform:uppercase;letter-spacing:0.7px">Notes</div>
      <div style="margin:0 14px 12px;background:var(--bg-card);border:1px solid var(--border);
           border-radius:var(--radius);padding:12px 14px;font-size:12px;
           color:var(--text-secondary);line-height:1.5">${escapeHtml(notes)}</div>` : ''}

      <div style="height:60px"></div>
    `;

    // ── Password reveal toggle ──
    let pwVisible = false;
    $('dv-eye').addEventListener('click', () => {
      pwVisible = !pwVisible;
      $('dv-password').textContent = pwVisible ? (password || '(empty)') : '●●●●●●●●●●●●';
      $('dv-password').style.letterSpacing = pwVisible ? '0.5px' : '2px';
      $('dv-eye').innerHTML = pwVisible ? iEyeOff : iEye;
      $('dv-eye').style.color = pwVisible ? 'var(--accent)' : '';
    });

    // ── Copy buttons ──
    $('dv-copy-user').addEventListener('click', () => {
      if (username) navigator.clipboard?.writeText(username).catch(() => {});
      flashGreen($('dv-copy-user'));
    });

    $('dv-copy-pass').addEventListener('click', () => {
      sendBg({ type: 'COPY', id, field: 'password' });
      flashGreen($('dv-copy-pass'));
    });

    // ── Live TOTP display ──
    if (hasTotp) {
      async function updateTotpDv() {
        const t = await sendBg({ type: 'GET_TOTP', id });
        const codeEl  = $('dv-totp-code');
        const timerEl = $('dv-totp-timer');
        if (!codeEl) { clearInterval(dvTotpInterval); return; }
        if (t?.code) {
          const raw = t.code.replace(/\s/g, '');
          codeEl.textContent = raw.length === 6
            ? raw.slice(0,3) + ' ' + raw.slice(3)
            : t.code;
          codeEl.style.color = (t.seconds_remaining <= 5) ? 'var(--warning)' : 'var(--accent)';
          if (timerEl) timerEl.textContent = t.seconds_remaining + 's';
        }
      }
      updateTotpDv();
      const dvTotpInterval = setInterval(updateTotpDv, 1000);
      _viewCleanup = () => clearInterval(dvTotpInterval);

      $('dv-copy-totp')?.addEventListener('click', async () => {
        const t = await sendBg({ type: 'GET_TOTP', id });
        if (t?.code) navigator.clipboard?.writeText(t.code.replace(/\s/g,'')).catch(()=>{});
        flashGreen($('dv-copy-totp'));
      });
    }
  }

  // ── Sticky bottom action bar ──
  const bar = document.createElement('div');
  bar.style.cssText = `
    position: sticky; bottom: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-surface); border-top: 1px solid var(--border);
  `;
  
  const hasFillButton = type === 'login';
  
  bar.innerHTML = `
    <div style="display:flex;gap:8px">
      ${type !== 'passkey' ? `
      <button class="nl-btn" id="dv-edit" style="display:flex;align-items:center;gap:5px">
        ${iEdit} <span>Edit</span>
      </button>
      ${hasFillButton ? `
      <button class="nl-btn nl-btn-primary" id="dv-fill">
        ${iFill} <span style="margin-left:4px">Fill</span>
      </button>
      ` : ''}
      ` : ''}
    </div>
    <button class="nl-action-btn nl-btn-danger" id="dv-delete" title="Delete entry"
      style="width:32px;height:32px;color:var(--danger)">${iTrash}</button>
  `;
  $('nl-content').appendChild(bar);

  if (type !== 'passkey') {
    if (hasFillButton) {
      $('dv-fill').addEventListener('click', async () => {
        const f = await sendBg({ type: 'GET_FILL', id });
        if (f && currentTab) {
          await sendBg({ type: 'FILL_TAB', tabId: currentTab.id, username: f.username, password: f.password });
          window.close();
        }
      });
    }
    $('dv-edit').addEventListener('click', () => navigateTo('edit', { id }));
  }

  // Delete with confirm modal
  $('dv-delete').addEventListener('click', () => {
    deleteEntry(id);
  });
});


// ── VIEW: Generator ───────────────────────────────────

registerView('generator', async ({ returnTo } = {}) => {
  const cfg = await loadGeneratorConfig();
  let current = { ...cfg };

  let activeTab = 'password';
  let generatedValue = '';

  $('nl-content').innerHTML = `
    <div class="nl-generator-view">
      <!-- Tabs -->
      <div class="nl-gen-tabs-container">
        <div class="nl-gen-tab active" id="nl-tab-pw">Password</div>
        <div class="nl-gen-tab" id="nl-tab-phrase">Passphrase</div>
        <div class="nl-gen-tab" id="nl-tab-user">Username</div>
      </div>

      <!-- Output Box -->
      <div class="nl-gen-output-card">
        <div class="nl-gen-output-text" id="nl-gen-out">Generating...</div>
        <div class="nl-gen-output-actions">
          <button class="nl-gen-output-btn" id="nl-gen-regen-btn" title="Regenerate">
            <i class="ph-duotone ph-arrows-clockwise"></i>
          </button>
          <button class="nl-gen-output-btn" id="nl-gen-copy-btn" title="Copy">
            <i class="ph-duotone ph-copy"></i>
          </button>
        </div>
      </div>

      <!-- Panels container -->
      <div id="nl-gen-panels">
        <!-- Password panel -->
        <div id="nl-panel-pw" class="nl-gen-panel">
          <div class="nl-form-group">
            <label for="nl-gen-len">Length</label>
            <input type="number" id="nl-gen-len" min="20" max="128" value="${current.length || 36}">
            <div style="font-size:10px;color:var(--text-muted)">Value must be between 20 and 128.</div>
          </div>

          <div class="nl-form-group">
            <label>Include Characters</label>
            <div class="nl-gen-checkbox-grid">
              <label class="nl-gen-checkbox-label">
                <input type="checkbox" id="nl-gen-opt-upper" ${current.uppercase !== false ? 'checked' : ''}>
                <i class="nl-checkbox-icon ph-duotone ${current.uppercase !== false ? 'ph-check-circle' : 'ph-circle'}"></i>
                <span>A-Z</span>
              </label>
              <label class="nl-gen-checkbox-label">
                <input type="checkbox" id="nl-gen-opt-lower" ${current.lowercase !== false ? 'checked' : ''}>
                <i class="nl-checkbox-icon ph-duotone ${current.lowercase !== false ? 'ph-check-circle' : 'ph-circle'}"></i>
                <span>a-z</span>
              </label>
              <label class="nl-gen-checkbox-label">
                <input type="checkbox" id="nl-gen-opt-digits" ${current.digits !== false ? 'checked' : ''}>
                <i class="nl-checkbox-icon ph-duotone ${current.digits !== false ? 'ph-check-circle' : 'ph-circle'}"></i>
                <span>0-9</span>
              </label>
              <label class="nl-gen-checkbox-label">
                <input type="checkbox" id="nl-gen-opt-symbols" ${current.symbols !== false ? 'checked' : ''}>
                <i class="nl-checkbox-icon ph-duotone ${current.symbols !== false ? 'ph-check-circle' : 'ph-circle'}"></i>
                <span>!@#$^*</span>
              </label>
            </div>
          </div>

          <div class="nl-form-group" style="display:flex;flex-direction:row;gap:12px;padding-top:0">
            <div style="flex:1;display:flex;flex-direction:column;gap:5px">
              <label for="nl-gen-opt-min-digits">Minimum numbers</label>
              <input type="number" id="nl-gen-opt-min-digits" min="0" max="20" value="${current.minDigits !== undefined ? current.minDigits : 0}">
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:5px">
              <label for="nl-gen-opt-min-symbols">Minimum special</label>
              <input type="number" id="nl-gen-opt-min-symbols" min="0" max="20" value="${current.minSymbols !== undefined ? current.minSymbols : 0}">
            </div>
          </div>
        </div>

        <!-- Passphrase panel -->
        <div id="nl-panel-phrase" class="nl-gen-panel" style="display:none">
          <div class="nl-form-group">
            <label for="nl-gen-phrase-words">Number of words</label>
            <input type="number" id="nl-gen-phrase-words" min="3" max="20" value="${current.numWords || 6}">
            <div style="font-size:10px;color:var(--text-muted)">Value must be between 3 and 20.</div>
          </div>

          <div class="nl-form-group">
            <label for="nl-gen-phrase-sep">Word separator</label>
            <input type="text" id="nl-gen-phrase-sep" value="${current.separator || '-'}">
          </div>

          <div class="nl-form-group" style="padding-top:0;display:flex;flex-direction:column;gap:10px">
            <label class="nl-gen-checkbox-label">
              <input type="checkbox" id="nl-gen-phrase-cap" ${current.capitalize ? 'checked' : ''}>
              <i class="nl-checkbox-icon ph-duotone ${current.capitalize ? 'ph-check-circle' : 'ph-circle'}"></i>
              <span>Capitalize words</span>
            </label>
            <label class="nl-gen-checkbox-label">
              <input type="checkbox" id="nl-gen-phrase-num" ${current.includeNumber ? 'checked' : ''}>
              <i class="nl-checkbox-icon ph-duotone ${current.includeNumber ? 'ph-check-circle' : 'ph-circle'}"></i>
              <span>Include random number</span>
            </label>
          </div>
        </div>

        <!-- Username panel -->
        <div id="nl-panel-user" class="nl-gen-panel" style="display:none">
          <div class="nl-form-group">
            <label for="nl-gen-user-type">Username Type</label>
            <select id="nl-gen-user-type" class="nl-gen-select">
              <option value="word" ${current.usernameType === 'word' ? 'selected' : ''}>Random word</option>
              <option value="char" ${current.usernameType === 'char' ? 'selected' : ''}>Random characters</option>
            </select>
          </div>

          <div class="nl-form-group" style="padding-top:0;display:flex;flex-direction:column;gap:10px">
            <label class="nl-gen-checkbox-label">
              <input type="checkbox" id="nl-gen-user-cap" ${current.usernameCapitalize ? 'checked' : ''}>
              <i class="nl-checkbox-icon ph-duotone ${current.usernameCapitalize ? 'ph-check-circle' : 'ph-circle'}"></i>
              <span>Capitalize</span>
            </label>
            <label class="nl-gen-checkbox-label">
              <input type="checkbox" id="nl-gen-user-num" ${current.usernameIncludeNumber ? 'checked' : ''}>
              <i class="nl-checkbox-icon ph-duotone ${current.usernameIncludeNumber ? 'ph-check-circle' : 'ph-circle'}"></i>
              <span>Include numbers</span>
            </label>
          </div>

          <!-- History Accordion -->
          <div class="nl-form-group">
            <div class="nl-gen-history-card">
              <div id="nl-gen-history-hdr" class="nl-gen-history-hdr">
                <span>Generator history</span>
                <i class="ph-duotone ph-caret-right" id="nl-gen-history-caret"></i>
              </div>
              <div id="nl-gen-history-list" class="nl-gen-history-list">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky footer actions (now non-sticky, scrolls naturally at the bottom of the content) -->
      <div class="nl-form-actions" style="margin-top: 10px">
        <button class="nl-btn" id="nl-gen-save-settings" style="flex:1">Remember settings</button>
        ${returnTo ? `<button class="nl-btn nl-btn-primary" id="nl-gen-use" style="flex:1">Use this</button>` : ''}
      </div>
    </div>`;

  function colorizePassword(password) {
    return password.split('').map(c => {
      if (/\d/.test(c)) {
        return `<span style="color:var(--accent); font-weight:700">${escapeHtml(c)}</span>`;
      } else if (/[^A-Za-z0-9]/.test(c)) {
        return `<span style="color:var(--danger); font-weight:700">${escapeHtml(c)}</span>`;
      } else {
        return `<span>${escapeHtml(c)}</span>`;
      }
    }).join('');
  }

  function colorizePassphrase(phrase, separator) {
    if (!separator) return escapeHtml(phrase);
    const escapedSep = escapeHtml(separator);
    const regex = new RegExp(separator.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    return phrase.replace(regex, `<span style="color:var(--danger);font-weight:700">${escapedSep}</span>`);
  }

  function regen() {
    if (activeTab === 'password') {
      const lenInput = parseInt($('nl-gen-len').value);
      const len = isNaN(lenInput) ? 36 : Math.max(20, Math.min(128, lenInput));
      const minDigitsInput = parseInt($('nl-gen-opt-min-digits').value);
      const minDigits = isNaN(minDigitsInput) ? 0 : Math.max(0, minDigitsInput);
      const minSymbolsInput = parseInt($('nl-gen-opt-min-symbols').value);
      const minSymbols = isNaN(minSymbolsInput) ? 0 : Math.max(0, minSymbolsInput);

      const r = generatePassword({
        length: len,
        uppercase: $('nl-gen-opt-upper').checked,
        lowercase: $('nl-gen-opt-lower').checked,
        digits: $('nl-gen-opt-digits').checked,
        symbols: $('nl-gen-opt-symbols').checked,
        minDigits: minDigits,
        minSymbols: minSymbols
      });
      generatedValue = r.password;
      $('nl-gen-out').innerHTML = colorizePassword(generatedValue);
    } else if (activeTab === 'passphrase') {
      const numWordsInput = parseInt($('nl-gen-phrase-words').value);
      const numWords = isNaN(numWordsInput) ? 6 : Math.max(3, Math.min(20, numWordsInput));
      const separator = $('nl-gen-phrase-sep').value || '-';
      generatedValue = generatePassphrase({
        numWords: numWords,
        separator: separator,
        capitalize: $('nl-gen-phrase-cap').checked,
        includeNumber: $('nl-gen-phrase-num').checked
      });
      $('nl-gen-out').innerHTML = colorizePassphrase(generatedValue, separator);
    } else {
      generatedValue = generateUsername({
        type: $('nl-gen-user-type').value,
        capitalize: $('nl-gen-user-cap').checked,
        includeNumber: $('nl-gen-user-num').checked
      });
      $('nl-gen-out').textContent = generatedValue;
    }
  }

  // Initial generation
  regen();

  // Tabs wiring
  const tabPw = $('nl-tab-pw');
  const tabPhrase = $('nl-tab-phrase');
  const tabUser = $('nl-tab-user');

  const panelPw = $('nl-panel-pw');
  const panelPhrase = $('nl-panel-phrase');
  const panelUser = $('nl-panel-user');

  function switchTab(tabName) {
    activeTab = tabName;
    [tabPw, tabPhrase, tabUser].forEach(btn => btn.classList.remove('active'));
    [panelPw, panelPhrase, panelUser].forEach(p => p.style.display = 'none');

    if (tabName === 'password') {
      tabPw.classList.add('active');
      panelPw.style.display = 'block';
    } else if (tabName === 'passphrase') {
      tabPhrase.classList.add('active');
      panelPhrase.style.display = 'block';
    } else {
      tabUser.classList.add('active');
      panelUser.style.display = 'block';
    }
    regen();
  }

  tabPw.addEventListener('click', () => switchTab('password'));
  tabPhrase.addEventListener('click', () => switchTab('passphrase'));
  tabUser.addEventListener('click', () => switchTab('username'));

  // Regen / Copy actions
  $('nl-gen-regen-btn').addEventListener('click', regen);
  $('nl-gen-copy-btn').addEventListener('click', async () => {
    if (generatedValue) {
      navigator.clipboard?.writeText(generatedValue).catch(() => {});
      await addToHistory(generatedValue, activeTab);
      
      const copyIcon = $('nl-gen-copy-btn').querySelector('i');
      copyIcon.className = 'ph-duotone ph-check';
      setTimeout(() => { copyIcon.className = 'ph-duotone ph-copy'; }, 1000);

      if (historyOpen) renderHistoryList();
    }
  });

  // Use this button
  if (returnTo && $('nl-gen-use')) {
    $('nl-gen-use').addEventListener('click', () => {
      window._nlGeneratedPassword = generatedValue;
      navigateBack();
      setTimeout(() => {
        if (activeTab === 'username') {
          const uf = returnTo === 'edit' ? $('ne-user') : $('nl-save-username');
          if (uf) {
            uf.value = window._nlGeneratedPassword;
            uf.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          const pf = returnTo === 'edit' ? $('ne-pass') : $('nl-save-password');
          if (pf) {
            pf.value = window._nlGeneratedPassword;
            pf.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        delete window._nlGeneratedPassword;
      }, 50);
    });
  }

  // Save Settings button
  $('nl-gen-save-settings').addEventListener('click', () => {
    const lenInput = parseInt($('nl-gen-len').value);
    const minDigitsInput = parseInt($('nl-gen-opt-min-digits').value);
    const minSymbolsInput = parseInt($('nl-gen-opt-min-symbols').value);
    const numWordsInput = parseInt($('nl-gen-phrase-words').value);

    const configToSave = {
      length: isNaN(lenInput) ? 36 : lenInput,
      uppercase: $('nl-gen-opt-upper').checked,
      lowercase: $('nl-gen-opt-lower').checked,
      digits: $('nl-gen-opt-digits').checked,
      symbols: $('nl-gen-opt-symbols').checked,
      minUpper: 2,
      minLower: 2,
      minDigits: isNaN(minDigitsInput) ? 0 : minDigitsInput,
      minSymbols: isNaN(minSymbolsInput) ? 0 : minSymbolsInput,
      numWords: isNaN(numWordsInput) ? 6 : numWordsInput,
      separator: $('nl-gen-phrase-sep').value || '-',
      capitalize: $('nl-gen-phrase-cap').checked,
      includeNumber: $('nl-gen-phrase-num').checked,
      usernameType: $('nl-gen-user-type').value,
      usernameCapitalize: $('nl-gen-user-cap').checked,
      usernameIncludeNumber: $('nl-gen-user-num').checked
    };
    saveGeneratorConfig(configToSave);
    const btn = $('nl-gen-save-settings');
    const orig = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => { if (btn) btn.textContent = orig; }, 1500);
  });

  // Watch inputs for instant regeneration
  const watchIds = [
    'nl-gen-len', 'nl-gen-opt-upper', 'nl-gen-opt-lower', 'nl-gen-opt-digits', 'nl-gen-opt-symbols',
    'nl-gen-opt-min-digits', 'nl-gen-opt-min-symbols', 'nl-gen-phrase-words', 'nl-gen-phrase-sep',
    'nl-gen-phrase-cap', 'nl-gen-phrase-num', 'nl-gen-user-type', 'nl-gen-user-cap', 'nl-gen-user-num'
  ];

  watchIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', regen);
    el.addEventListener('change', () => {
      if (el.type === 'checkbox') {
        const icon = el.parentNode?.querySelector('.nl-checkbox-icon');
        if (icon) {
          if (el.checked) {
            icon.className = 'nl-checkbox-icon ph-duotone ph-check-circle';
          } else {
            icon.className = 'nl-checkbox-icon ph-duotone ph-circle';
          }
        }
      }
      regen();
    });
  });

  // Explicit label click handler to prevent flakiness with hidden checkbox inputs
  document.querySelectorAll('.nl-gen-checkbox-label').forEach(label => {
    label.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = label.querySelector('input[type="checkbox"]');
      if (cb) {
        e.preventDefault();
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  // History Accordion
  let historyOpen = false;
  $('nl-gen-history-hdr').addEventListener('click', () => {
    historyOpen = !historyOpen;
    $('nl-gen-history-list').style.display = historyOpen ? 'block' : 'none';
    $('nl-gen-history-caret').style.transform = historyOpen ? 'rotate(90deg)' : 'none';
    if (historyOpen) renderHistoryList();
  });

  async function addToHistory(val, type) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get('generator_history', (d) => {
          let history = d?.generator_history || [];
          history = history.filter(x => x.value !== val);
          history.unshift({ value: val, type: type, timestamp: Date.now() });
          if (history.length > 10) history = history.slice(0, 10);
          chrome.storage.local.set({ generator_history: history }, () => resolve());
        });
      } catch (e) { resolve(); }
    });
  }

  function renderHistoryList() {
    chrome.storage.local.get('generator_history', (d) => {
      const history = d?.generator_history || [];
      const listEl = $('nl-gen-history-list');
      if (!listEl) return;
      if (history.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center">No history yet</div>';
        return;
      }
      listEl.innerHTML = history.map((item, idx) => `
        <div class="nl-history-row" style="display:flex;align-items:center;justify-content:between;padding:8px 14px;border-bottom:1px solid var(--border);gap:8px" data-idx="${idx}">
          <span style="font-family:var(--font);font-size:12px;color:var(--text-primary);word-break:break-all;flex:1;cursor:pointer" class="nl-history-val">${escapeHtml(item.value)}</span>
          <span style="font-size:9px;color:var(--text-muted);text-transform:uppercase">${escapeHtml(item.type)}</span>
          <button class="nl-history-copy-btn" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px" data-val="${escapeHtml(item.value)}">
            <i class="ph-duotone ph-copy"></i>
          </button>
        </div>
      `).join('');

      // Wire copy buttons
      listEl.querySelectorAll('.nl-history-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = btn.dataset.val;
          navigator.clipboard?.writeText(val).catch(()=>{});
          const icon = btn.querySelector('i');
          icon.className = 'ph-duotone ph-check';
          setTimeout(() => { icon.className = 'ph-duotone ph-copy'; }, 1000);
        });
      });

      // Clicking row value puts it in generator output box
      listEl.querySelectorAll('.nl-history-val').forEach(el => {
        el.addEventListener('click', () => {
          generatedValue = el.textContent;
          if (activeTab === 'password') {
            $('nl-gen-out').innerHTML = colorizePassword(generatedValue);
          } else if (activeTab === 'passphrase') {
            const separator = $('nl-gen-phrase-sep').value || '-';
            $('nl-gen-out').innerHTML = colorizePassphrase(generatedValue, separator);
          } else {
            $('nl-gen-out').textContent = generatedValue;
          }
        });
      });
    });
  }
});

// ── VIEW: Settings ────────────────────────────────────

registerView('settings', () => {
  $('nl-content').innerHTML = `
    <div class="nl-settings-menu">
      <div class="nl-menu-item" id="nl-set-go-appearance">
        <div class="nl-menu-item-left">
          <i class="ph-duotone ph-palette" style="font-size:20px"></i>
          <span>Appearance</span>
        </div>
        <i class="ph-bold ph-caret-right nl-menu-chevron"></i>
      </div>
      <div class="nl-menu-item" id="nl-set-go-autofill">
        <div class="nl-menu-item-left">
          <i class="ph-duotone ph-shield-check" style="font-size:20px"></i>
          <span>Autofill & Passkeys</span>
        </div>
        <i class="ph-bold ph-caret-right nl-menu-chevron"></i>
      </div>
      <div class="nl-menu-item" id="nl-set-go-about">
        <div class="nl-menu-item-left">
          <i class="ph-duotone ph-info" style="font-size:20px"></i>
          <span>About Extension</span>
        </div>
        <i class="ph-bold ph-caret-right nl-menu-chevron"></i>
      </div>
    </div>
  `;
  $('nl-set-go-appearance').addEventListener('click', () => navigateTo('settings-appearance'));
  $('nl-set-go-autofill').addEventListener('click', () => navigateTo('settings-autofill'));
  $('nl-set-go-about').addEventListener('click', () => navigateTo('settings-about'));
});

registerView('settings-appearance', async () => {
  $('nl-content').innerHTML = `
    <div class="nl-settings">
      <div class="nl-settings-section">
        <div class="nl-settings-heading">Theming</div>
        <div class="nl-settings-row">
          <span>Theme Mode</span>
          <div class="nl-settings-toggle-group">
            <span class="nl-settings-toggle" id="nl-set-dark">Dark</span>
            <span class="nl-settings-toggle" id="nl-set-light">Light</span>
          </div>
        </div>
        <div class="nl-settings-row">
          <span>Popup Window Size</span>
          <div class="nl-settings-toggle-group">
            <span class="nl-settings-toggle" id="nl-size-compact">Compact</span>
            <span class="nl-settings-toggle" id="nl-size-default">Default</span>
            <span class="nl-settings-toggle" id="nl-size-wider">Wider</span>
            <span class="nl-settings-toggle" id="nl-size-extrawide">Extra Wide</span>
          </div>
        </div>
      </div>
    </div>`;

  const isLight = document.documentElement.classList.contains('light');
  if (isLight) {
    $('nl-set-light').classList.add('on');
  } else {
    $('nl-set-dark').classList.add('on');
  }

  $('nl-set-dark').addEventListener('click', () => {
    document.documentElement.classList.remove('light');
    $('nl-set-dark').classList.add('on');
    $('nl-set-light').classList.remove('on');
    updateThemeIcon(false);
    try { chrome.storage.local.set({ theme: 'dark' }); } catch(e) {}
  });

  $('nl-set-light').addEventListener('click', () => {
    document.documentElement.classList.add('light');
    $('nl-set-light').classList.add('on');
    $('nl-set-dark').classList.remove('on');
    updateThemeIcon(true);
    try { chrome.storage.local.set({ theme: 'light' }); } catch(e) {}
  });

  // Popup size
  const activeSize = await new Promise(resolve => {
    try {
      chrome.storage.local.get('popup_size', d => resolve(d?.popup_size || 'default'));
    } catch {
      resolve('default');
    }
  });

  const sizeKeys = {
    compact: 'nl-size-compact',
    default: 'nl-size-default',
    wider: 'nl-size-wider',
    extra_wide: 'nl-size-extrawide'
  };

  $(sizeKeys[activeSize])?.classList.add('on');

  Object.entries(sizeKeys).forEach(([sizeVal, sizeId]) => {
    $(sizeId)?.addEventListener('click', () => {
      Object.values(sizeKeys).forEach(id => $(id)?.classList.remove('on'));
      $(sizeId)?.classList.add('on');
      updatePopupSizeClass(sizeVal);
      try { chrome.storage.local.set({ popup_size: sizeVal }); } catch(e) {}
    });
  });
});

registerView('settings-autofill', async () => {
  const settingsData = await new Promise(resolve => {
    try {
      chrome.storage.local.get([
        'auto_login',
        'passkey_enabled',
        'autofill_enabled',
        'intelligent_autofill_enabled',
        'require_click_autofill',
        'native_messaging_preferred',
        'trusted_domain_matching',
        'autofill_suggestions_enabled',
        'inline_overlay_enabled'
      ], res => {
        resolve({
          auto_login: !!res?.auto_login,
          passkey_enabled: res?.passkey_enabled !== false,
          autofill_enabled: res?.autofill_enabled !== false,
          intelligent_autofill_enabled: res?.intelligent_autofill_enabled !== false,
          require_click_autofill: !!res?.require_click_autofill,
          native_messaging_preferred: res?.native_messaging_preferred !== false,
          trusted_domain_matching: res?.trusted_domain_matching !== false,
          autofill_suggestions_enabled: res?.autofill_suggestions_enabled !== false,
          inline_overlay_enabled: res?.inline_overlay_enabled !== false
        });
      });
    } catch {
      resolve({
        auto_login: false,
        passkey_enabled: true,
        autofill_enabled: true,
        intelligent_autofill_enabled: true,
        require_click_autofill: false,
        native_messaging_preferred: true,
        trusted_domain_matching: true,
        autofill_suggestions_enabled: true,
        inline_overlay_enabled: true
      });
    }
  });

  const hasPermissions = await new Promise(resolve => {
    try {
      chrome.permissions.contains({
        permissions: ['privacy', 'webNavigation', 'contextMenus']
      }, resolve);
    } catch {
      resolve(false);
    }
  });

  const privacyStatus = await sendBg({ type: 'CHECK_PRIVACY_STATUS' });
  const isDefaultActive = hasPermissions && privacyStatus && privacyStatus.value === false;

  const pingRes = await sendBg({ type: 'PING' });
  const transportName = pingRes ? (pingRes.transport === 'native' ? 'Native Messaging' : 'Local Secure Bridge') : 'Disconnected';

  $('nl-content').innerHTML = `
    <div class="nl-settings" style="padding-bottom:24px;">
      
      <!-- System Status Dashboard -->
      <div class="nl-settings-section">
        <div class="nl-settings-heading">System Status</div>
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:12px; margin:0 16px 12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
            <span style="color:var(--text-secondary); font-weight:600;">Transport</span>
            <span style="font-weight:700; color:${pingRes && pingRes.ok ? 'var(--success)' : 'var(--danger)'};">${transportName}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
            <span style="color:var(--text-secondary); font-weight:600;">Browser Integration</span>
            <span style="font-weight:700; color:${isDefaultActive ? 'var(--success)' : 'var(--warning)'};">${isDefaultActive ? 'Autofill Active' : 'Setup Required'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
            <span style="color:var(--text-secondary); font-weight:600;">Passkey Support</span>
            <span style="font-weight:700; color:${settingsData.passkey_enabled ? 'var(--success)' : 'var(--text-muted)'};">${settingsData.passkey_enabled ? 'Ready' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <!-- Onboarding Callout Card -->
      ${!isDefaultActive ? `
      <div class="nl-settings-section">
        <div style="background:rgba(var(--accent-rgb), 0.08); border:1px solid var(--accent); border-radius:var(--radius); padding:14px; margin:0 16px 16px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:10px; align-items:start;">
            <i class="ph-duotone ph-shield-check" style="font-size:22px; color:var(--accent); flex-shrink:0; margin-top:2px;"></i>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-size:12px; font-weight:700; color:var(--text-primary);">Set as Default Password Manager</span>
              <span style="font-size:10.5px; color:var(--text-secondary); line-height:1.4;">Disable browser password prompts and configure preferred autofill permissions.</span>
            </div>
          </div>
          <button id="nl-make-default-btn" class="nl-btn nl-btn-primary" style="width:100%; padding:8px; font-size:11px; margin-top:4px;">Make Default Password Manager</button>
        </div>
      </div>
      ` : ''}

      <!-- Toggles List Section -->
      <div class="nl-settings-section">
        <div class="nl-settings-heading">Autofill Settings</div>
        
        <div class="nl-settings-row">
          <span>Enable Autofill Integration</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-autofill-enabled">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Autofill on page load</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-auto-login">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Enable Passkey Support (WebAuthn)</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-passkey-enabled">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Enable Intelligent Autofill</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-intelligent-autofill">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Require Click Before Autofill</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-require-click">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Use Native Messaging Preferred</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-native-messaging">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Trusted Domain Matching</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-trusted-domain">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Autofill Suggestions</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-autofill-suggestions">
            <span class="nl-slider"></span>
          </label>
        </div>

        <div class="nl-settings-row">
          <span>Enable Inline Autofill Overlay</span>
          <label class="nl-switch">
            <input type="checkbox" id="nl-set-inline-overlay">
            <span class="nl-slider"></span>
          </label>
        </div>

      </div>
    </div>`;

  // Bind settings listeners
  const bindToggle = (id, key, val) => {
    const el = $(id);
    if (!el) return;
    el.checked = val;
    el.addEventListener('change', () => {
      try {
        const obj = {};
        obj[key] = el.checked;
        chrome.storage.local.set(obj);
      } catch (_) {}
    });
  };

  bindToggle('nl-set-autofill-enabled', 'autofill_enabled', settingsData.autofill_enabled);
  bindToggle('nl-set-auto-login', 'auto_login', settingsData.auto_login);
  bindToggle('nl-set-passkey-enabled', 'passkey_enabled', settingsData.passkey_enabled);
  bindToggle('nl-set-intelligent-autofill', 'intelligent_autofill_enabled', settingsData.intelligent_autofill_enabled);
  bindToggle('nl-set-require-click', 'require_click_autofill', settingsData.require_click_autofill);
  bindToggle('nl-set-native-messaging', 'native_messaging_preferred', settingsData.native_messaging_preferred);
  bindToggle('nl-set-trusted-domain', 'trusted_domain_matching', settingsData.trusted_domain_matching);
  bindToggle('nl-set-autofill-suggestions', 'autofill_suggestions_enabled', settingsData.autofill_suggestions_enabled);
  bindToggle('nl-set-inline-overlay', 'inline_overlay_enabled', settingsData.inline_overlay_enabled);

  // Default password manager onboarding flow
  const makeDefaultBtn = $('nl-make-default-btn');
  if (makeDefaultBtn) {
    makeDefaultBtn.addEventListener('click', () => {
      const modal = $('nl-default-modal');
      if (modal) {
        modal.classList.remove('hidden');
        
        const cancelBtn = $('nl-default-cancel-btn');
        const confirmBtn = $('nl-default-confirm-btn');

        const cleanUp = () => {
          modal.classList.add('hidden');
        };

        cancelBtn.onclick = cleanUp;
        confirmBtn.onclick = () => {
          cleanUp();
          
          // Request permissions dynamically
          try {
            chrome.permissions.request({
              permissions: ['privacy', 'webNavigation', 'contextMenus']
            }, async (granted) => {
              if (granted) {
                // Disable browser native password prompt
                await sendBg({ type: 'DISABLE_NATIVE_AUTOFILL' });
                
                // Write back configurations
                chrome.storage.local.set({
                  autofill_enabled: true,
                  passkey_enabled: true
                });

                // Detect user's browser type and redirect to settings page if chrome or edge
                const ua = navigator.userAgent.toLowerCase();
                let url = 'chrome://password-manager/settings';
                if (ua.includes('edg/')) {
                  url = 'edge://settings/passwords';
                } else if (ua.includes('brave')) {
                  url = 'chrome://password-manager/settings';
                }
                
                try {
                  chrome.tabs.create({ url });
                } catch (_) {}
              }
              // Refresh view to show updated status
              navigateTo('settings-autofill');
            });
          } catch (e) {
            console.error('Permission request failed', e);
          }
        };
      }
    });
  }
});

registerView('settings-about', async () => {
  $('nl-content').innerHTML = `
    <div class="nl-settings">
      <div class="nl-settings-section">
        <div class="nl-settings-heading">Extension Information</div>
        <div class="nl-settings-row" style="cursor:default">
          <span>Version</span>
          <span class="nl-muted">v0.1.0</span>
        </div>
        <div class="nl-settings-row" style="cursor:default">
          <span>Server Address</span>
          <span class="nl-muted">127.0.0.1:27432</span>
        </div>
        <div class="nl-settings-row" style="cursor:default">
          <span>Backend Status</span>
          <span id="nl-set-status">Checking...</span>
        </div>
      </div>
    </div>`;

  const ping = await sendBg({ type: 'PING' });
  const statusEl = $('nl-set-status');
  if (statusEl) {
    statusEl.innerHTML = ping?.ok
      ? '<span class="nl-success">Connected</span>'
      : '<span class="nl-error">Not connected</span>';
  }
});

// ── VIEW: Edit Entry ──────────────────────────────────

registerView('edit', async ({ id } = {}) => {
  if (!id) { navigateBack(); return; }
  $('nl-content').innerHTML = '<div class="nl-empty nl-muted">Loading...</div>';

  const [details, fillData, storageRes] = await Promise.all([
    sendBg({ type: 'GET_ENTRY', id }),
    sendBg({ type: 'GET_FILL', id }),
    new Promise(resolve => {
      try { chrome.storage.local.get(['folders', 'entryFolders'], d => resolve(d || {})); }
      catch { resolve({}); }
    })
  ]);

  if (!details) {
    $('nl-content').innerHTML = '<div class="nl-empty nl-error">[!] Entry not found</div>';
    return;
  }

  const type = details.type || 'login';
  const folders = storageRes.folders || [];
  const entryFolders = storageRes.entryFolders || {};
  const currentFolder = entryFolders[id] || '';

  // Parse rich options from notes if available
  let parsed = {};
  let actualNotes = details.notes || '';
  try {
    if (details.notes && details.notes.startsWith('{')) {
      parsed = JSON.parse(details.notes);
      actualNotes = parsed.notes || '';
    }
  } catch(e) {}

  // 1. Render dynamic form HTML based on type
  let formHtml = `<input type="hidden" id="ne-type" value="${escapeHtml(type)}">`;
  
  if (type === 'login') {
    formHtml += `
      <div class="nl-form-group">
        <label>Title</label>
        <input type="text" id="ne-title" value="${escapeHtml(details.title || '')}" autocomplete="off" required>
      </div>
      <div class="nl-form-group">
        <label>Username</label>
        <input type="text" id="ne-user" value="${escapeHtml(details.username || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label>Password <span style="color:var(--text-muted);font-size:9px">(blank = keep current)</span></label>
        <div class="nl-password-row">
          <div style="position:relative;display:flex;align-items:center;flex:1">
            <input type="password" id="ne-pass" value="${escapeHtml(fillData?.password || '')}" autocomplete="off" style="flex:1;padding-right:32px">
            <button type="button" id="ne-pass-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
          </div>
          <button type="button" id="ne-gen-btn" class="nl-btn nl-btn-sm">Gen</button>
        </div>
        <div class="nl-strength-bar" id="ne-strength-bar" style="width:0%"></div>
        <div class="nl-strength-label" id="ne-strength-label"></div>
      </div>
      <div class="nl-form-group">
        <label>URL</label>
        <input type="text" id="ne-url" value="${escapeHtml(details.url || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label>TOTP Secret <span style="color:var(--text-muted);font-size:9px">(blank = keep current)</span></label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="ne-totp" autocomplete="off" style="flex:1;padding-right:32px"
            placeholder="${details.has_totp ? '(secret already set)' : 'optional'}">
          <button type="button" id="ne-totp-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
        ${details.has_totp ? `
        <label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer;
               font-size:11px;color:var(--text-muted);text-transform:none;letter-spacing:0">
          <input type="checkbox" id="ne-clear-totp"
            style="width:14px;height:14px;accent-color:var(--danger);cursor:pointer">
          Remove existing TOTP secret
        </label>` : ''}
      </div>
    `;
  } else if (type === 'card') {
    formHtml += `
      <div class="nl-form-section-title" style="margin-top:12px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Item details</div>
      <div class="nl-form-group">
        <label>Title</label>
        <input type="text" id="ne-title" value="${escapeHtml(details.title || '')}" autocomplete="off" required>
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Card details</div>
      <div class="nl-form-group">
        <label>Cardholder name</label>
        <input type="text" id="ne-user" value="${escapeHtml(details.username || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label>Number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="ne-pass" value="${escapeHtml(fillData?.password || '')}" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="ne-pass-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
      <div class="nl-form-group">
        <label>Brand</label>
        <select id="ne-brand" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
          <option value="">-- Select --</option>
          ${['Visa', 'Mastercard', 'American Express', 'Discover', 'Diners Club', 'JCB'].map(b => `<option value="${b}" ${parsed.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
      </div>
      <div class="nl-form-group" style="display:flex;gap:10px">
        <div style="flex:1">
          <label>Expiration month</label>
          <select id="ne-exp-month" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
            <option value="">-- Select --</option>
            ${Array.from({length:12}, (_,i)=>(i+1).toString().padStart(2,'0')).map(m => `<option value="${m}" ${parsed.exp_month === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label>Expiration year</label>
          <input type="text" id="ne-exp-year" value="${escapeHtml(parsed.exp_year || '')}" autocomplete="off" style="width:100%">
        </div>
      </div>
      <div class="nl-form-group">
        <label>Security code</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="ne-totp" value="${escapeHtml(details.totp_secret || parsed.cvv || '')}" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="ne-totp-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
    `;
  } else if (type === 'identity') {
    formHtml += `
      <div class="nl-form-section-title" style="margin-top:12px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Item details</div>
      <div class="nl-form-group">
        <label>Title</label>
        <input type="text" id="ne-title" value="${escapeHtml(details.title || '')}" autocomplete="off" required>
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Personal details</div>
      <div class="nl-form-group">
        <label>Title</label>
        <select id="ne-id-prefix" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
          <option value="">-- Select --</option>
          ${['Mr.', 'Ms.', 'Mrs.', 'Dr.'].map(p => `<option value="${p}" ${parsed.title_prefix === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="nl-form-group" style="display:flex;gap:10px">
        <div style="flex:1">
          <label>First name</label>
          <input type="text" id="ne-first-name" value="${escapeHtml(parsed.first_name || '')}" autocomplete="off" style="width:100%">
        </div>
        <div style="flex:1">
          <label>Middle name</label>
          <input type="text" id="ne-middle-name" value="${escapeHtml(parsed.middle_name || '')}" autocomplete="off" style="width:100%">
        </div>
      </div>
      <div class="nl-form-group">
        <label>Last name</label>
        <input type="text" id="ne-last-name" value="${escapeHtml(parsed.last_name || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label>Username</label>
        <input type="text" id="ne-user" value="${escapeHtml(details.username || '')}" autocomplete="off">
      </div>
      <div class="nl-form-group">
        <label>Company</label>
        <input type="text" id="ne-company" value="${escapeHtml(parsed.company || '')}" autocomplete="off">
      </div>

      <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Identification</div>
      <div class="nl-form-group">
        <label>Social Security number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="ne-ssn" value="${escapeHtml(fillData?.password || parsed.ssn || '')}" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="ne-ssn-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
      <div class="nl-form-group">
        <label>Passport number</label>
        <div style="position:relative;display:flex;align-items:center">
          <input type="password" id="ne-passport" value="${escapeHtml(details.url || parsed.passport_number || '')}" autocomplete="off" style="width:100%;padding-right:32px">
          <button type="button" id="ne-passport-toggle" class="nl-input-eye-btn" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--text-muted)"><i class="ph-duotone ph-eye-closed"></i></button>
        </div>
      </div>
    `;
  } else if (type === 'note') {
    formHtml += `
      <div class="nl-form-group">
        <label>Title</label>
        <input type="text" id="ne-title" value="${escapeHtml(details.title || '')}" autocomplete="off" required>
      </div>
    `;
  }

  // Common Folder selector
  formHtml += `
    <div class="nl-form-section-title" style="margin-top:16px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Additional options</div>
    <div class="nl-form-group">
      <label>Folder</label>
      <select id="ne-folder" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none">
        <option value="">-- Select --</option>
      </select>
    </div>
    <div class="nl-form-group">
      <label>${type === 'note' ? 'Secure Note Content' : 'Notes'}</label>
      <textarea id="ne-notes" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:12.5px;outline:none;resize:vertical;min-height:60px">${escapeHtml(actualNotes)}</textarea>
    </div>
  `;

  let headerTitle = 'Login';
  if (type === 'card') headerTitle = 'Cards';
  else if (type === 'identity') headerTitle = 'Identity';
  else if (type === 'note') headerTitle = 'Notes';

  activeDynamicTitle = headerTitle;

  $('nl-content').innerHTML = `
    <form id="nl-edit-form" style="padding: 14px">
      ${formHtml}
      <div class="nl-form-actions" style="margin-top:16px">
        <button type="submit" class="nl-btn nl-btn-primary" style="flex:1">Update Entry</button>
        <button type="button" class="nl-btn" id="ne-cancel">Cancel</button>
      </div>
    </form>
    <div id="ne-status" style="padding:6px 14px;font-size:11px"></div>`;

  // Populate folder dropdown
  const folderSelect = $('ne-folder');
  if (folderSelect) {
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      if (f === currentFolder) opt.selected = true;
      folderSelect.appendChild(opt);
    });
  }

  // Standard input events
  $('ne-pass-toggle')?.addEventListener('click', () => {
    const el = $('ne-pass');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('ne-pass-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('ne-totp-toggle')?.addEventListener('click', () => {
    const el = $('ne-totp');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('ne-totp-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('ne-ssn-toggle')?.addEventListener('click', () => {
    const el = $('ne-ssn');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('ne-ssn-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  $('ne-passport-toggle')?.addEventListener('click', () => {
    const el = $('ne-passport');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    $('ne-passport-toggle').innerHTML = isPass ? '<i class="ph-duotone ph-eye"></i>' : '<i class="ph-duotone ph-eye-closed"></i>';
  });

  // Live strength meter on edit password field
  $('ne-pass')?.addEventListener('input', () => {
    if (type !== 'login') return;
    const s = calculateStrength($('ne-pass').value);
    const info = getStrengthInfo(s);
    const pcts = [0, 25, 60, 100];
    const cols = ['var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--success)'];
    const bar = $('ne-strength-bar');
    const lbl = $('ne-strength-label');
    if (bar) bar.style.width = pcts[s] + '%';
    if (bar) bar.style.background = cols[s];
    if (lbl) lbl.textContent = info.label;
    if (lbl) lbl.className = 'nl-strength-label ' + info.cls;
  });

  // Trigger initial strength display if password was pre-filled
  if (type === 'login' && fillData?.password) $('ne-pass').dispatchEvent(new Event('input'));

  $('ne-gen-btn')?.addEventListener('click', async () => {
    const cfg = await loadGeneratorConfig();
    const r = generatePassword(cfg);
    const passInput = $('ne-pass');
    if (passInput) {
      passInput.value = r.password;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  $('nl-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const entry = {
      id,
      title: $('ne-title').value.trim(),
      type
    };

    if (!entry.title) {
      $('ne-status').innerHTML = '<span class="nl-error">[!] Title is required</span>';
      return;
    }

    if (type === 'login') {
      entry.username = $('ne-user').value.trim();
      entry.password = $('ne-pass').value;
      entry.url = $('ne-url').value.trim();
      entry.totp_secret = $('ne-clear-totp')?.checked ? '__REMOVE__' : $('ne-totp').value.trim();
      entry.notes = $('ne-notes').value;
    } else if (type === 'card') {
      entry.username = $('ne-user').value.trim();
      entry.password = $('ne-pass').value;
      
      const brand = $('ne-brand').value;
      const exp_month = $('ne-exp-month').value;
      const exp_year = $('ne-exp-year').value.trim();
      const cvv = $('ne-totp').value;
      const notes = $('ne-notes').value;
      
      entry.url = (exp_month && exp_year) ? `${exp_month}/${exp_year}` : '';
      entry.totp_secret = cvv || null;
      entry.notes = JSON.stringify({
        brand,
        exp_month,
        exp_year,
        cvv,
        notes
      });
    } else if (type === 'identity') {
      const title_prefix = $('ne-id-prefix').value;
      const first_name = $('ne-first-name').value.trim();
      const middle_name = $('ne-middle-name').value.trim();
      const last_name = $('ne-last-name').value.trim();
      const company = $('ne-company').value.trim();
      const ssn = $('ne-ssn').value;
      const passport = $('ne-passport').value;
      const notes = $('ne-notes').value;
      
      entry.username = $('ne-user').value.trim();
      entry.password = ssn || '';
      entry.url = passport || '';
      entry.notes = JSON.stringify({
        title_prefix,
        first_name,
        middle_name,
        last_name,
        company,
        ssn,
        passport_number: passport,
        notes
      });
    } else if (type === 'note') {
      entry.notes = $('ne-notes').value;
    }

    const r = await sendBg({ type: 'UPDATE_ENTRY', entry });
    if (r && r.success) {
      // Save folder selection
      const selFolder = $('ne-folder')?.value || '';
      const { entryFolders = {} } = await new Promise(resolve => {
        try { chrome.storage.local.get('entryFolders', d => resolve(d || {})); }
        catch { resolve({}); }
      });
      
      if (selFolder) {
        entryFolders[id] = selFolder;
      } else {
        delete entryFolders[id];
      }
      await new Promise(resolve => chrome.storage.local.set({ entryFolders }, resolve));

      $('ne-status').innerHTML = '<span class="nl-success">[✓] Entry updated</span>';
      setTimeout(navigateBack, 900);
    } else {
      $('ne-status').innerHTML = '<span class="nl-error">[!] Update failed. Is NorthLocker running?</span>';
    }
  });

  $('ne-cancel').addEventListener('click', navigateBack);

  // ── Live TOTP display (only if entry has a TOTP secret) ──
  if (details.has_totp) {
    // Inject a TOTP display row after the TOTP secret input
    const totpField = $('ne-totp');
    if (totpField) {
      const totpDisplay = document.createElement('div');
      totpDisplay.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: var(--bg-base);
        border-top: 1px solid var(--border);
      `;
      totpDisplay.innerHTML = `
        <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;
                     letter-spacing:0.5px;min-width:70px">Live Code</span>
        <span id="ne-live-code" style="font-size:18px;letter-spacing:4px;
               color:var(--accent);font-family:monospace">------</span>
        <span id="ne-live-timer" style="font-size:10px;color:var(--text-muted)"></span>
        <button type="button" id="ne-copy-live-totp" class="nl-btn nl-btn-sm nl-btn-totp"
          style="margin-left:auto">Copy</button>`;
      totpField.parentElement.after(totpDisplay);
    }

    async function refreshTotp() {
      const totp = await sendBg({ type: 'GET_TOTP', id });
      const codeEl  = $('ne-live-code');
      const timerEl = $('ne-live-timer');
      if (!codeEl) { clearInterval(totpInterval); return; }
      if (totp && totp.code) {
        codeEl.textContent  = totp.code;
        timerEl.textContent = `${totp.seconds_remaining}s`;
        // Turn warning colour in last 5 s
        codeEl.style.color = totp.seconds_remaining <= 5
          ? 'var(--warning)' : 'var(--accent)';
      }
    }

    refreshTotp();
    const totpInterval = setInterval(refreshTotp, 1000);
    _viewCleanup = () => clearInterval(totpInterval);

    $('ne-copy-live-totp')?.addEventListener('click', async () => {
      const totp = await sendBg({ type: 'GET_TOTP', id });
      if (totp?.code) {
        navigator.clipboard?.writeText(totp.code.replace(/\s/g, '')).catch(() => {});
        const btn = $('ne-copy-live-totp');
        if (btn) { const o = btn.textContent; btn.textContent = '✓'; setTimeout(() => { if (btn.isConnected) btn.textContent = o; }, 1500); }
      }
    });
  }
});

// ── VIEW: Auto Login Setup ────────────────────────────

registerView('autologin', async () => {
  // Load current settings
  const stored = await new Promise(resolve => {
    try {
      chrome.storage.local.get(
        ['auto_login', 'autofill_button', 'autofill_inline'],
        (d) => resolve(d || {})
      );
    } catch { resolve({}); }
  });

  const autoLogin    = stored.auto_login     !== false && !!stored.auto_login;
  const showButton   = stored.autofill_button  !== false;
  const showInline   = stored.autofill_inline  !== false;

  function toggleHtml(id, state) {
    return `<span class="nl-settings-toggle ${state ? 'on' : 'off'}" id="${id}">${state ? '[on]' : '[off]'}</span>`;
  }

  $('nl-content').innerHTML = `
    <div class="nl-settings">
      <div class="nl-settings-section">
        <div class="nl-settings-heading">Autofill Behaviour</div>
        <div class="nl-settings-row">
          <span>Auto-submit after fill</span>
          ${toggleHtml('al-auto-login', autoLogin)}
        </div>
        <div class="nl-settings-row">
          <span>Show NL button on fields</span>
          ${toggleHtml('al-show-btn', showButton)}
        </div>
        <div class="nl-settings-row">
          <span>Inline suggestion on focus</span>
          ${toggleHtml('al-show-inline', showInline)}
        </div>
      </div>
      <div class="nl-settings-section">
        <div class="nl-settings-heading">Disable Browser Password Manager</div>
        <div style="padding:6px 0;font-size:11px;color:var(--text-muted);line-height:1.7">
          To avoid conflicts with Chrome's built-in
          password manager:<br>
          <span style="color:var(--text-secondary)">
            1. Open
            <span id="al-open-settings" style="color:var(--accent);cursor:pointer">
              chrome://password-manager/settings
            </span><br>
            2. Turn off <strong>Offer to save passwords</strong><br>
            3. Turn off <strong>Sign in automatically</strong>
          </span>
        </div>
      </div>
    </div>`;

  // Toggle handlers
  function bindToggle(elId, storageKey, current) {
    const el = $(elId);
    if (!el) return;
    let val = current;
    el.addEventListener('click', () => {
      val = !val;
      el.textContent = val ? '[on]' : '[off]';
      el.className = val ? 'nl-settings-toggle on' : 'nl-settings-toggle off';
      try { chrome.storage.local.set({ [storageKey]: val }); } catch(e) {}
    });
  }

  bindToggle('al-auto-login',   'auto_login',      autoLogin);
  bindToggle('al-show-btn',     'autofill_button', showButton);
  bindToggle('al-show-inline',  'autofill_inline', showInline);

  // Open Chrome password settings in a new tab
  $('al-open-settings')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://password-manager/settings' });
  });
});

// ── VIEW: Menu ────────────────────────────────────────

registerView('menu', () => {
  $('nl-content').innerHTML = `
    <div class="nl-menu">
      <div class="nl-menu-item" id="nm-all">[#] All Entries</div>
      <div class="nl-menu-item" id="nm-generator">[G] Password Generator</div>
      <div class="nl-menu-item" id="nm-autologin">[A] Auto Login Setup</div>
      <div class="nl-menu-item" id="nm-settings">[=] Settings</div>
    </div>`;
  $('nm-all').addEventListener('click', () => navigateTo('search'));
  $('nm-generator').addEventListener('click', () => navigateTo('generator'));
  $('nm-autologin').addEventListener('click', () => navigateTo('autologin'));
  $('nm-settings').addEventListener('click', () => navigateTo('settings'));
});


// ── Folder & Type Filters & Modals ────────────────────

async function populateFolderFilterOptions() {
  const filterDropdown = $('nl-folder-filter-dropdown');
  if (!filterDropdown) return;
  
  // Clear any existing options
  filterDropdown.innerHTML = '';
  
  // 1. Add "All folders" option
  const allItem = document.createElement('div');
  allItem.className = `nl-filter-dropdown-item${currentFolderFilter === 'all' ? ' active' : ''}`;
  allItem.dataset.folder = 'all';
  allItem.innerHTML = `<i class="ph-duotone ph-squares-four"></i> All folders`;
  filterDropdown.appendChild(allItem);
  
  // 2. Add "No folder" option
  const noneItem = document.createElement('div');
  noneItem.className = `nl-filter-dropdown-item${currentFolderFilter === 'none' ? ' active' : ''}`;
  noneItem.dataset.folder = 'none';
  noneItem.innerHTML = `<i class="ph-duotone ph-folder"></i> Unassigned`;
  filterDropdown.appendChild(noneItem);

  const { folders = [] } = await new Promise(resolve => {
    try { chrome.storage.local.get('folders', d => resolve(d || {})); }
    catch { resolve({}); }
  });
  
  folders.forEach(f => {
    const item = document.createElement('div');
    item.className = `nl-filter-dropdown-item${currentFolderFilter === f ? ' active' : ''}`;
    item.dataset.folder = f;
    item.innerHTML = `<i class="ph-duotone ph-folder"></i> ${escapeHtml(f)}`;
    filterDropdown.appendChild(item);
  });
  
  // 3. Add divider and "Create folder..." option
  const divider = document.createElement('div');
  divider.className = 'nl-dropdown-divider';
  filterDropdown.appendChild(divider);
  
  const createItem = document.createElement('div');
  createItem.className = 'nl-filter-dropdown-item';
  createItem.dataset.folder = '__CREATE__';
  createItem.innerHTML = `<i class="ph-duotone ph-folder-plus"></i> Create folder...`;
  filterDropdown.appendChild(createItem);
  
  // Update label text
  const label = $('nl-folder-filter-label');
  if (label) {
    if (currentFolderFilter === 'all') label.textContent = 'All folders';
    else if (currentFolderFilter === 'none') label.textContent = 'Unassigned';
    else label.textContent = currentFolderFilter;
  }
}

function initializeFilters() {
  const folderWrap = $('nl-folder-filter-wrap');
  const folderDrop = $('nl-folder-filter-dropdown');
  const typeWrap = $('nl-type-filter-wrap');
  const typeDrop = $('nl-type-filter-dropdown');
  
  if (folderWrap && folderDrop) {
    populateFolderFilterOptions();
    
    folderWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      typeDrop?.classList.add('hidden'); // Close other dropdown
      folderDrop.classList.toggle('hidden');
    });
    
    folderDrop.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = e.target.closest('.nl-filter-dropdown-item');
      if (!item) return;
      
      const val = item.dataset.folder;
      folderDrop.classList.add('hidden');
      
      if (val === '__CREATE__') {
        // Show custom folder modal overlay
        const modal = $('nl-folder-modal');
        const input = $('nl-folder-name-input');
        if (modal && input) {
          input.value = '';
          modal.classList.remove('hidden');
          input.focus();
        }
      } else {
        currentFolderFilter = val;
        await populateFolderFilterOptions();
        
        // Refresh vault lists
        if (viewStack[viewStack.length - 1] === 'entries' && viewRenderers['entries']) {
          viewRenderers['entries']({ domain: currentDomain });
        }
      }
    });
  }
  
  if (typeWrap && typeDrop) {
    typeWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      folderDrop?.classList.add('hidden'); // Close other dropdown
      typeDrop.classList.toggle('hidden');
    });
    
    typeDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.nl-filter-dropdown-item');
      if (!item) return;
      
      const typeVal = item.dataset.type;
      currentTypeFilter = typeVal;
      typeDrop.classList.add('hidden');
      
      // Update active state in UI
      typeDrop.querySelectorAll('.nl-filter-dropdown-item').forEach(el => {
        el.classList.toggle('active', el.dataset.type === typeVal);
      });
      
      // Update label
      const label = $('nl-type-filter-label');
      if (label) {
        const textMap = {
          all: 'All types',
          login: 'Logins',
          card: 'Cards',
          identity: 'Identities',
          note: 'Notes',
          ssh_key: 'SSH keys',
          passkey: 'Passkeys'
        };
        label.textContent = textMap[typeVal] || 'Type';
      }
      
      // Refresh entries
      if (viewStack[viewStack.length - 1] === 'entries' && viewRenderers['entries']) {
        viewRenderers['entries']({ domain: currentDomain });
      }
    });
  }
  
  // Close filters when clicking anywhere else
  document.addEventListener('click', () => {
    folderDrop?.classList.add('hidden');
    typeDrop?.classList.add('hidden');
  });
}

function initializeFolderModal() {
  const modal = $('nl-folder-modal');
  const cancelBtn = $('nl-folder-cancel-btn');
  const submitBtn = $('nl-folder-confirm-btn');
  const input = $('nl-folder-name-input');
  
  if (!modal) return;
  
  cancelBtn?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  submitBtn?.addEventListener('click', async () => {
    const folderName = input?.value.trim();
    if (!folderName) return;
    
    const { folders = [] } = await new Promise(resolve => {
      try { chrome.storage.local.get('folders', d => resolve(d || {})); }
      catch { resolve({}); }
    });
    
    if (!folders.includes(folderName)) {
      folders.push(folderName);
      await new Promise(resolve => chrome.storage.local.set({ folders }, resolve));
    }
    
    modal.classList.add('hidden');
    
    // Repopulate options in entries filters and refresh entries
    await populateFolderFilterOptions();
    if (viewStack[viewStack.length - 1] === 'entries' && viewRenderers['entries']) {
      viewRenderers['entries']({ domain: currentDomain });
    }
  });
}

// ── Init ──────────────────────────────────────────────

async function init() {
  try {
    chrome.storage.local.get(['theme', 'popup_size'], (d) => {
      const theme = (d && d.theme) ? d.theme : 'light';
      const isLight = theme === 'light';
      document.documentElement.classList.toggle('light', isLight);
      updateThemeIcon(isLight);
      if (d && d.popup_size) {
        updatePopupSizeClass(d.popup_size);
      }
    });
  } catch(e) {}

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
    currentDomain = tab?.url ? getCleanDomain(tab.url) : '';
  } catch(e) {
    currentDomain = '';
    currentTab = null;
  }

  if (viewRenderers['entries']) viewRenderers['entries']({ domain: currentDomain });
  updateHeaderTitle('entries');
}

// ── Event listeners ───────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  init();
  initializeFilters();
  initializeFolderModal();

  // Sticky bottom action bar delegates
  $('nl-form-save-btn')?.addEventListener('click', () => {
    const form = $('nl-save-form') || $('nl-edit-form');
    if (form) {
      form.requestSubmit();
    }
  });

  $('nl-form-cancel-btn')?.addEventListener('click', () => {
    navigateBack();
  });

  // Theme toggle
  $('nl-theme-toggle').addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    updateThemeIcon(isLight);
    try { chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' }); } catch(e) {}
  });

  // Back button
  $('nl-back-btn').addEventListener('click', navigateBack);

  // "New" button → toggle dropdown
  const newBtn  = $('nl-new-entry-btn');
  const newDrop = $('nl-new-dropdown');
  newBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    newDrop?.classList.toggle('hidden');
  });
  newDrop?.querySelectorAll('.nl-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      newDrop.classList.add('hidden');
      const action = item.dataset.action;
      if (action === 'new-folder') {
        const modal = $('nl-folder-modal');
        const input = $('nl-folder-name-input');
        if (modal && input) {
          input.value = '';
          modal.classList.remove('hidden');
          input.focus();
        }
      } else if (action && action.startsWith('new-')) {
        const type = action.replace('new-', '');
        navigateTo('save', { type });
      }
    });
  });
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    newDrop?.classList.add('hidden');
    $('nl-row-dropdown')?.classList.add('hidden');
  });

  // Wire row dropdown item click listeners
  const rowDrop = $('nl-row-dropdown');
  rowDrop?.querySelectorAll('.nl-dropdown-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      rowDrop.classList.add('hidden');
      if (!activeDropdownEntryId) return;

      const action = item.dataset.action;
      if (action === 'autofill') {
        const f = await sendBg({ type: 'GET_FILL', id: activeDropdownEntryId });
        if (f && currentTab) {
          await sendBg({ type: 'FILL_TAB', tabId: currentTab.id, username: f.username, password: f.password });
          window.close();
        }
      } else if (action === 'favorite') {
        toggleFavorite(activeDropdownEntryId);
      } else if (action === 'edit') {
        navigateTo('edit', { id: activeDropdownEntryId });
      } else if (action === 'clone') {
        cloneEntry(activeDropdownEntryId);
      } else if (action === 'archive') {
        toggleArchive(activeDropdownEntryId);
      } else if (action === 'delete') {
        deleteEntry(activeDropdownEntryId);
      }
    });
  });

  // Global search bar — live search as you type
  const globalSearch = $('nl-global-search');
  const searchClear  = $('nl-search-clear');
  const searchWrap   = $('nl-search-wrap');
  let searchDebounce = null;

  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      searchClear?.classList.toggle('hidden', !q);
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(async () => {
        if (q) {
          // Show search results inline in content area
          if (!viewStack.includes('search')) {
            viewStack.push('search');
            updateHeaderTitle('search');
            updateBackBar();
            updateBottomNav('search');
          }
          const result = await sendBg({ type: 'SEARCH', query: q });
          const entries = result?.entries || [];
          renderSearchResults(entries, q);
        } else {
          // Return to entries
          viewStack = ['entries'];
          updateHeaderTitle('entries');
          updateBackBar();
          updateBottomNav('entries');
          if (viewRenderers['entries']) viewRenderers['entries']({ domain: currentDomain });
        }
      }, 280);
    });

    searchClear?.addEventListener('click', () => {
      globalSearch.value = '';
      searchClear.classList.add('hidden');
      viewStack = ['entries'];
      updateHeaderTitle('entries');
      updateBackBar();
      updateBottomNav('entries');
      if (viewRenderers['entries']) viewRenderers['entries']({ domain: currentDomain });
    });
  }

  // Bottom nav items
  document.querySelectorAll('.nl-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (globalSearch) { globalSearch.value = ''; searchClear?.classList.add('hidden'); }
      if (_viewCleanup) { _viewCleanup(); _viewCleanup = null; }
      viewStack = [view];
      updateHeaderTitle(view);
      $('nl-content').innerHTML = '';
      if (viewRenderers[view]) {
        viewRenderers[view](view === 'entries' ? { domain: currentDomain } : {});
      }
      updateBackBar();
      updateBottomNav(view);
    });
  });
});

/** Render search results using the new card layout */
function renderSearchResults(entries, query) {
  const container = $('nl-content');
  if (!container) return;
  container.innerHTML = '';

  if (!entries.length) {
    container.innerHTML = `<div class="nl-empty">
      <div class="nl-empty-text">No results for "${escapeHtml(query)}"</div>
    </div>`;
    return;
  }

  // Section header
  const sec = document.createElement('div');
  sec.className = 'nl-section-header';
  sec.innerHTML = `<span class="nl-section-title">Results</span>
    <span class="nl-section-count">${entries.length}</span>`;
  container.appendChild(sec);

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'nl-entry-row';
    const letter = (entry.title || entry.username || '?')[0].toUpperCase();
    const colors = ['#4f8ef7','#7c3aed','#059669','#dc2626','#d97706','#0891b2'];
    const color  = colors[letter.charCodeAt(0) % colors.length];
    const favicon = getFaviconUrl(entry.url);

    const avatarInner = favicon
      ? `<img src="${favicon}" alt="${letter}" width="20" height="20"
             style="object-fit:contain;display:block"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <span style="display:none;color:${color};font-size:15px;font-weight:600">${letter}</span>`
      : `<span style="color:${color};font-size:15px;font-weight:600">${letter}</span>`;

    row.innerHTML = `
      <div class="nl-entry-avatar">
        ${avatarInner}
      </div>
      <div class="nl-entry-info" data-id="${escapeHtml(entry.id)}" style="cursor:pointer">
        <div class="nl-entry-name">${escapeHtml(entry.title || entry.username || '(no title)')}</div>
        <div class="nl-entry-sub">${escapeHtml(entry.username || '')}</div>
      </div>
      <div class="nl-entry-actions">
        <button class="nl-action-btn nl-fill-btn" data-id="${escapeHtml(entry.id)}" title="Fill">${SVG.fill}</button>
        <button class="nl-action-btn nl-copy-btn" data-id="${escapeHtml(entry.id)}" title="Copy password">${SVG.key}</button>
        ${entry.has_totp ? `<button class="nl-action-btn totp nl-copy-totp-btn" data-id="${escapeHtml(entry.id)}" title="Copy TOTP">${SVG.clock}</button>` : ''}
        <button class="nl-action-btn nl-row-more-btn" data-id="${escapeHtml(entry.id)}" title="More actions"><i class="ph-duotone ph-dots-three-vertical"></i></button>
      </div>`;

    row.querySelector('.nl-entry-info').addEventListener('click', () => {
      navigateTo('detail', { id: entry.id });
    });
    row.querySelector('.nl-fill-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const fill = await sendBg({ type: 'GET_FILL', id: entry.id });
      if (fill && currentTab) {
        await sendBg({ type: 'FILL_TAB', tabId: currentTab.id, username: fill.username, password: fill.password });
        window.close();
      }
    });
    row.querySelector('.nl-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      sendBg({ type: 'COPY', id: entry.id, field: 'password' });
      flashBtn(row.querySelector('.nl-copy-btn'));
    });
    row.querySelector('.nl-copy-totp-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const t = await sendBg({ type: 'GET_TOTP', id: entry.id });
      if (t?.code) navigator.clipboard?.writeText(t.code.replace(/\s/g,'')).catch(()=>{});
      flashBtn(row.querySelector('.nl-copy-totp-btn'));
    });
    row.querySelector('.nl-row-more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showRowDropdown(row.querySelector('.nl-row-more-btn'), entry.id, row);
    });
    container.appendChild(row);
  });
}
