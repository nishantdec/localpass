const DEBUG = false;
const NL_PORT = 27432;

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const nlIconBase64 = "data:image/png;base64,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";

// Guard: skip extension pages
if (window.location.protocol === 'chrome-extension:') {
  throw new Error('skip');
}

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

/** Extract registered domain: maps.google.com -> google.com */
function getBaseDomain() {
  const hostname = window.location.hostname.replace(/^www\./, '');
  const parts = hostname.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

// Listen for fill messages from popup via background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILL_FORM') {
    const { usernameField, passwordField } = findLoginForm();
    if (usernameField && msg.username) fillField(usernameField, msg.username);
    if (passwordField && msg.password) fillField(passwordField, msg.password);

    // Auto-submit if the user has enabled it
    try {
      chrome.storage.local.get('auto_login', (d) => {
        if (d && d.auto_login) {
          setTimeout(autoSubmitForm, 600);
        }
      });
    } catch (e) { }
  }
  if (msg.type === 'FILL_OTP') {
    fillOTPForm(msg.code);
  }
});

/**
 * Find and click the first visible submit button on the page.
 * Tries specific selectors in priority order.
 */
function autoSubmitForm() {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:not([type="button"]):not([type="reset"])',
    '[role="button"]',
  ];
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll(sel));
    for (const el of els) {
      if (isFieldVisible(el)) {
        el.click();
        return;
      }
    }
  }
}

// ── Credential save prompt ────────────────────────────
// Intercept manual form submissions and AJAX login requests to offer to save credentials.

let lastTypedUsername = '';
let lastTypedPassword = '';

document.addEventListener('input', (e) => {
  if (e.target && e.target.tagName === 'INPUT') {
    const input = e.target;
    if (input.type === 'password') {
      lastTypedPassword = input.value;
    } else if (input.type === 'email' || input.type === 'text') {
      const { usernameField } = findLoginForm();
      if (input === usernameField) {
        lastTypedUsername = input.value;
      }
    }
  }
});

async function triggerSaveDetection() {
  setTimeout(async () => {
    const { usernameField, passwordField } = findLoginForm();
    const username = (usernameField ? usernameField.value : lastTypedUsername).trim();
    const password = passwordField ? passwordField.value : lastTypedPassword;
    
    if (!password || password.length < 4) return;
    
    const domain = getBaseDomain();
    const result = await sendBg({ type: 'GET_CREDENTIALS', domain });
    const entries = result?.entries || [];
    
    // Check if this credentials set is already saved in the vault
    const alreadySaved = entries.some(e => 
      (e.username && e.username.trim().toLowerCase() === username.toLowerCase()) && 
      (e.password === password)
    );
    
    if (alreadySaved) return;
    
    showSavePrompt(username, password, entries, window.location.hostname.replace(/^www\./, ''));
  }, 150);
}

// Intercept form elements standard submit
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form || form.dataset.nlSubmit) return;
  await triggerSaveDetection();
}, true);

// Watch submit buttons, custom SPA next/login buttons, and Enter key presses
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button, input[type="submit"], input[type="button"], a[role="button"]');
  if (btn) {
    const text = (btn.innerText || btn.value || '').trim().toLowerCase();
    const isLikelySubmit = btn.type === 'submit' || /log\s*in|sign\s*in|submit|continue|next/i.test(text);
    if (isLikelySubmit) {
      await triggerSaveDetection();
    }
  }
});

document.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    await triggerSaveDetection();
  }
});

function showSavePrompt(username, password, entries, domain) {
  document.getElementById('nl-save-prompt')?.remove();

  const prompt = document.createElement('div');
  prompt.id = 'nl-save-prompt';
  prompt.setAttribute('data-nl-prompt', 'true');
  prompt.style.cssText = `
    position: fixed;
    top: 16px; right: 16px;
    width: 320px;
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid #c4c9dd;
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    font-size: 12px;
    color: #0b0c10;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    animation: nlFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Append entry css animation once
  if (!document.getElementById('nl-prompt-style')) {
    const style = document.createElement('style');
    style.id = 'nl-prompt-style';
    style.textContent = `
      @keyframes nlFadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Header / Title row
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
  
  const title = document.createElement('div');
  title.style.cssText = 'display: flex; align-items: center; gap: 8px; font-weight: 700; color: #0b0c10;';
  title.innerHTML = `
    <span style="background: #3b72e8; color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; letter-spacing: 0.5px;">NL</span>
    <span>Save to NorthLocker?</span>
  `;
  
  const dismissBtn = document.createElement('button');
  dismissBtn.innerHTML = '&times;';
  dismissBtn.style.cssText = 'background: none; border: none; font-size: 16px; color: #5e637a; cursor: pointer; padding: 0 4px; line-height: 1;';
  
  header.appendChild(title);
  header.appendChild(dismissBtn);

  // Body row
  const body = document.createElement('div');
  body.style.cssText = 'color: #5e637a; font-size: 11.5px;';
  body.textContent = `Would you like to save credentials for ${username || domain}?`;

  // Entry selector dropdown
  const select = document.createElement('select');
  select.style.cssText = `
    width: 100%;
    font-family: inherit; font-size: 11.5px;
    background: #ffffff; color: #0b0c10;
    border: 1px solid #c4c9dd;
    padding: 6px 10px; border-radius: 6px; outline: none;
    cursor: pointer;
  `;

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Save as new entry';
  select.appendChild(newOpt);

  entries.forEach(entry => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = `Update: ${entry.username || entry.title || entry.id}`;
    select.appendChild(opt);
  });

  // Actions row
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = `
    background: #3b72e8; border: none; color: #ffffff;
    font-family: inherit; font-size: 11.5px; font-weight: 700;
    padding: 6px 16px; border-radius: 6px;
    cursor: pointer; transition: all 0.15s ease;
  `;
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#2a5fd4'; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = '#3b72e8'; });

  actions.appendChild(saveBtn);

  // Status label
  const status = document.createElement('span');
  status.style.cssText = `font-size: 11px; font-weight: 700; align-self: center; margin-right: auto;`;

  const footerRow = document.createElement('div');
  footerRow.style.cssText = 'display: flex; align-items: center; width: 100%;';
  footerRow.appendChild(status);
  footerRow.appendChild(actions);

  prompt.appendChild(header);
  prompt.appendChild(body);
  prompt.appendChild(select);
  prompt.appendChild(footerRow);
  
  document.body.appendChild(prompt);

  // Auto-dismiss after 15 s
  const autoDismiss = setTimeout(() => prompt.remove(), 15000);

  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = '...';
    saveBtn.disabled = true;
    const selectedId = select.value;
    let r;
    if (selectedId === '__new__') {
      r = await sendBg({
        type: 'SAVE_ENTRY',
        entry: {
          type: 'login',
          title: document.title ? document.title.slice(0, 40) : domain,
          username,
          password,
          url: window.location.origin,
          totp_secret: null,
          notes: '',
        }
      });
    } else {
      r = await sendBg({
        type: 'UPDATE_ENTRY',
        entry: { id: selectedId, username, password }
      });
    }
    clearTimeout(autoDismiss);
    if (r && (r.success || r.id)) {
      status.textContent = '✓ Saved';
      status.style.color = '#16a34a';
      setTimeout(() => prompt.remove(), 1200);
    } else {
      status.textContent = '✗ Failed';
      status.style.color = '#dc2626';
      saveBtn.textContent = 'Retry';
      saveBtn.disabled = false;
    }
  });

  dismissBtn.addEventListener('click', () => {
    clearTimeout(autoDismiss);
    prompt.remove();
  });
}

// Selectors for fields that should get an NL button
const NL_FIELD_SELECTORS = [
  'input[type="password"]',
  'input[type="email"]',
  'input[type="text"][autocomplete*="username" i]',
  'input[type="text"][autocomplete*="email" i]',
  'input[type="text"][name*="user" i]',
  'input[type="text"][name*="email" i]',
  'input[type="text"][id*="user" i]',
  'input[type="text"][id*="email" i]',
];

// Inject NL button next to login-related fields (password AND username/email)
function injectNLButtons() {
  try {
    chrome.storage.local.get(['theme'], (d) => {
      const theme = (d && d.theme) ? d.theme : 'light';
      const isDark = theme === 'dark';

      // Collect all matching fields, deduplicated
      const seen = new Set();
      const fields = NL_FIELD_SELECTORS.flatMap(sel =>
        Array.from(document.querySelectorAll(sel))
      ).filter(f => {
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      });

      fields.forEach(field => {
        if (field.dataset.nlInjected) return;
        if (!isFieldVisible(field)) return;
        field.dataset.nlInjected = 'true';

        const btn = document.createElement('button');
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor"><path d="M208,88H176V56a48,48,0,0,0-96,0V88H48a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104A16,16,0,0,0,208,88Zm-80,88a16,16,0,1,1,16-16A16,16,0,0,1,128,176Zm32-88H96V56a32,32,0,0,1,64,0Z"></path></svg>`;
        btn.setAttribute('type', 'button');
        btn.setAttribute('tabindex', '-1');
        btn.setAttribute('aria-label', 'Fill with NorthLocker');
        btn.setAttribute('data-nl-button', 'true');
        btn.style.cssText = `
          position: fixed;
          width: 22px;
          height: 22px;
          background: ${isDark ? '#232535' : '#ffffff'};
          border: 1px solid ${isDark ? '#2a2c3a' : '#dcdfe6'};
          border-radius: 4px;
          cursor: pointer;
          z-index: 2147483646;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          opacity: 0.6;
          color: ${isDark ? '#a0a5b5' : '#626675'};
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        btn.addEventListener('mouseenter', () => {
          btn.style.opacity = '1';
          btn.style.color = '#3b72e8';
          btn.style.borderColor = '#3b72e8';
          btn.style.transform = 'scale(1.05)';
          btn.style.boxShadow = '0 0 8px rgba(59, 114, 232, 0.25)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.opacity = '0.6';
          btn.style.color = isDark ? '#a0a5b5' : '#626675';
          btn.style.borderColor = isDark ? '#2a2c3a' : '#dcdfe6';
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        });

        function positionBtn() {
          const rect = field.getBoundingClientRect();
          if (rect.width === 0) { btn.style.display = 'none'; return; }
          btn.style.display = 'flex';
          btn.style.top = (rect.top + rect.height / 2 - 11) + 'px';
          btn.style.left = (rect.right - 32) + 'px';
        }

        positionBtn();
        document.body.appendChild(btn);

        window.addEventListener('scroll', positionBtn, { passive: true });
        window.addEventListener('resize', positionBtn, { passive: true });

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const result = await sendBg({ type: 'GET_CREDENTIALS', domain: getBaseDomain() });
          const entries = result ? result.entries : [];
          showInlineDropdown(field, entries);
        });

        field.addEventListener('focus', async () => {
          const result = await sendBg({ type: 'GET_CREDENTIALS', domain: getBaseDomain() });
          const entries = result ? result.entries : [];
          showInlineDropdown(field, entries);
        });

        field.addEventListener('input', async () => {
          const result = await sendBg({ type: 'GET_CREDENTIALS', domain: getBaseDomain() });
          const entries = result ? result.entries : [];
          showInlineDropdown(field, entries);
        });
      });
    });
  } catch(e) {}
}

async function showInlineDropdown(field, entries) {
  removeDropdown();
  if (!entries || entries.length === 0) return;

  // Filter entries dynamically based on field type and user input
  const val = field.value.trim().toLowerCase();
  const { usernameField } = findLoginForm();
  const typedUsername = usernameField ? usernameField.value.trim().toLowerCase() : '';

  let filteredEntries = entries;

  if (field.type === 'password') {
    // On password field, if username has a typed value, only suggest entries matching that username
    if (typedUsername) {
      filteredEntries = entries.filter(e => 
        (e.username && e.username.trim().toLowerCase() === typedUsername)
      );
    }
  } else {
    // On username/email field, filter suggestions matching what they typed
    if (val) {
      filteredEntries = entries.filter(e => 
        (e.username && e.username.toLowerCase().includes(val)) ||
        (e.title && e.title.toLowerCase().includes(val))
      );
    }
  }

  if (filteredEntries.length === 0) {
    return;
  }

  const themeSetting = await new Promise(resolve => {
    try {
      chrome.storage.local.get(['theme'], (d) => {
        resolve((d && d.theme) ? d.theme : 'light');
      });
    } catch (_) {
      resolve('light');
    }
  });
  const isDark = themeSetting === 'dark';
  const rect = field.getBoundingClientRect();
  const dropdown = document.createElement('div');
  dropdown.setAttribute('data-nl-dropdown', 'true');
  dropdown.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 6}px;
    left: ${rect.left}px;
    min-width: ${Math.max(rect.width, 280)}px;
    max-width: 360px;
    max-height: 280px;
    overflow-y: auto;
    background: ${isDark ? '#161720' : '#ffffff'};
    border: 1px solid ${isDark ? '#2a2c3a' : '#e1e3eb'};
    border-radius: 8px;
    box-shadow: ${isDark ? '0 10px 30px rgba(0, 0, 0, 0.5)' : '0 10px 30px rgba(0, 0, 0, 0.08)'};
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    color: ${isDark ? '#ffffff' : '#1e1e24'};
    padding: 6px 0;
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Prevent clicks inside dropdown from immediately closing it due to the document listener
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  const domain = getBaseDomain();
  for (const entry of filteredEntries) {
    const row = document.createElement('div');
    row.style.cssText = `
      padding: 8px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#edf0f5'};
      transition: all 0.12s ease;
      background: ${isDark ? '#161720' : '#ffffff'};
    `;

    const initial = entry.username ? entry.username.charAt(0).toUpperCase() : (entry.title ? entry.title.charAt(0).toUpperCase() : 'L');
    let domainToUse = domain;
    if (entry.url) {
      try {
        const urlObj = new URL(entry.url);
        domainToUse = urlObj.hostname.replace(/^www\./, '');
      } catch (_) {}
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domainToUse}&sz=32`;
    const isPasskey = entry.type === 'passkey' || entry.passkey_enabled === true || entry.credential_id;

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
        <!-- Favicon -->
        <div style="width: 26px; height: 26px; border-radius: 4px; background: ${isDark ? '#232535' : '#f0f1f5'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid ${isDark ? '#2a2c3a' : '#e1e3eb'};">
          <img src="${faviconUrl}" style="width: 15px; height: 15px; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <span style="display: none; align-items: center; justify-content: center; font-weight: 600; font-size: 11px; color: ${isDark ? '#b5bcce' : '#626675'};">${escapeHtml(initial)}</span>
        </div>
        
        <!-- Details -->
        <div style="display: flex; flex-direction: column; overflow: hidden; gap: 2px;">
          <span style="font-size: 12.5px; font-weight: 600; color: ${isDark ? '#ffffff' : '#1e1e24'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(entry.title || domainToUse)}
          </span>
          <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: ${isDark ? '#a0a5b5' : '#626675'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor" style="opacity: 0.7; flex-shrink: 0;"><path d="M128,128A64,64,0,1,0,64,64,64.07,64.07,0,0,0,128,128Zm0-112a48,48,0,1,1-48,48A48.05,48.05,0,0,1,128,16Zm0,128a96.11,96.11,0,0,0-96,96,8,8,0,0,0,16,0,80,80,0,0,1,160,0,8,8,0,0,0,16,0,96.11,96.11,0,0,0-96-96Z"></path></svg>
            <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(entry.username || '(no username)')}</span>
          </div>
        </div>
      </div>
      
      <!-- Right Side Fill Action -->
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        ${isPasskey ? `
          <span style="font-size: 8px; color: #3b72e8; background: rgba(59, 114, 232, 0.1); font-weight: 800; text-transform: uppercase; padding: 2px 5px; border-radius: 3px; letter-spacing: 0.3px; margin-right: 4px;">
            Passkey
          </span>
        ` : ''}
        <button class="nl-fill-icon-btn" style="background: none; border: none; padding: 4px; cursor: pointer; color: ${isDark ? '#00afff' : '#3b72e8'}; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">
          <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M224,104a8,8,0,0,1-16,0V59.31l-66.34,66.35a8,8,0,0,1-11.32-11.32L196.69,48H152a8,8,0,0,1,0-16h72a8,8,0,0,1,8,8ZM136,80a8,8,0,0,0-8,8V208H48V128h72a8,8,0,0,0,0-16H48a16,16,0,0,0-16,16v80a16,16,0,0,0,16,16h80a16,16,0,0,0,16-16V88A8,8,0,0,0,136,80Z"></path></svg>
        </button>
      </div>
    `;

    row.addEventListener('mouseenter', () => {
      row.style.background = isDark ? '#1e202e' : '#f4f6fa';
      const fillBtn = row.querySelector('.nl-fill-icon-btn');
      if (fillBtn) {
        fillBtn.style.transform = 'scale(1.1)';
      }
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = isDark ? '#161720' : '#ffffff';
      const fillBtn = row.querySelector('.nl-fill-icon-btn');
      if (fillBtn) {
        fillBtn.style.transform = 'scale(1)';
      }
    });

    row.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      const fillData = await sendBg({ type: 'GET_FILL', id: entry.id });
      if (fillData) {
        const { usernameField, passwordField } = findLoginForm();
        const isPasswordField = field.type === 'password';

        if (isPasswordField) {
          if (usernameField && fillData.username) fillField(usernameField, fillData.username);
          fillField(field, fillData.password || '');
        } else {
          fillField(field, fillData.username || '');
          if (passwordField && fillData.password) fillField(passwordField, fillData.password);
        }
      }
      removeDropdown();
    });

    dropdown.appendChild(row);
  }

  if (dropdown.lastChild) dropdown.lastChild.style.borderBottom = 'none';

  document.body.appendChild(dropdown);
  requestAnimationFrame(() => {
    dropdown.style.opacity = '1';
    dropdown.style.transform = 'translateY(0) scale(1)';
  });

  setTimeout(() => {
    document.addEventListener('click', removeDropdown, { once: true });
  }, 0);
}

function removeDropdown() {
  document.querySelectorAll('[data-nl-dropdown="true"]').forEach(el => el.remove());
}

// MutationObserver with debounce to catch dynamic forms
let debounceTimer = null;
const observer = new MutationObserver((mutations) => {
  let shouldRecheck = false;
  const loginInputTypes = new Set(['password', 'email', 'text']);
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if the added node IS or CONTAINS a login input
        const isInput = node.tagName === 'INPUT' && loginInputTypes.has(node.type);
        const hasInput = node.querySelector && (
          node.querySelector('input[type="password"]') ||
          node.querySelector('input[type="email"]') ||
          node.querySelector('input[type="text"]')
        );
        if (isInput || hasInput) {
          shouldRecheck = true;
          break;
        }
      }
    }
    if (shouldRecheck) break;
  }
  if (shouldRecheck) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectNLButtons, 400);
  }
});


if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
  injectNLButtons();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      injectNLButtons();
    }
  });
}

// Scroll/resize repositioning
let scrollRafId = null;
window.addEventListener('scroll', () => {
  if (scrollRafId) return;
  scrollRafId = requestAnimationFrame(() => {
    document.querySelectorAll('[data-nl-button="true"]').forEach(btn => {
      const field = [...document.querySelectorAll('input[type="password"]')]
        .find(f => f.dataset.nlInjected && f.getBoundingClientRect);
      // Reposition is handled by positionBtn closure inside injectNLButtons
    });
    scrollRafId = null;
  });
}, { passive: true });

// WebAuthn / Passkey Message Bridge
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg && msg.source === "northlocker-interceptor") {
    if (msg.type === "WEBAUTHN_CREATE" || msg.type === "WEBAUTHN_GET") {
      const resp = await sendBg({
        type: msg.type,
        rpId: msg.rpId,
        rp: msg.rp,
        user: msg.user,
        challenge: msg.challenge,
        credentialIds: msg.credentialIds
      });
      window.postMessage({
        source: "northlocker-content",
        requestId: msg.requestId,
        result: resp ? resp.result : null,
        error: resp ? resp.error : "NotAllowedError"
      }, "*");
    }
  }
});
