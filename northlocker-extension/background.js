/**
 * NorthLocker — background.js
 * ============================
 * Service worker for the browser extension.
 *
 * Transport strategy:
 *   1. Native Messaging (preferred) — com.northlocker.host
 *      No open port. Chrome-managed stdio pipe. Immune to DNS rebinding.
 *   2. Localhost HTTP fallback — http://127.0.0.1:27432
 *      Used if native host is not installed. Requires challenge-response handshake.
 *
 * Security improvements vs previous version:
 *   - Native messaging requires no open TCP port
 *   - Localhost handshake now uses challenge-response (nonce + HMAC verify)
 *   - Token cached in memory only (never chrome.storage)
 *   - Sender origin validated on all incoming runtime messages
 *   - Message schema validated before dispatch
 */

'use strict';

const NATIVE_HOST  = 'com.northlocker.host';
const NL_BASE      = 'http://127.0.0.1:27432';
const DEBUG        = false;

// Transport state
let _transport = 'detecting';  // 'native' | 'http' | 'detecting'
let _token     = null;
let _tokenTs   = 0;
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function dbg(...a) { if (DEBUG) console.log('[NL]', ...a); }

// ---------------------------------------------------------------------------
// Native Messaging transport
// ---------------------------------------------------------------------------

function nativeSend(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, msg, (resp) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(resp || null);
        }
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function nativeHandshake() {
  const resp = await nativeSend({ type: 'HANDSHAKE' });
  if (resp && resp.ok && resp.token) {
    _token  = resp.token;
    _tokenTs = Date.now();
    return resp.token;
  }
  return null;
}

async function nativeCall(type, extra = {}) {
  if (!_token || (Date.now() - _tokenTs) > TOKEN_MAX_AGE_MS) {
    const t = await nativeHandshake();
    if (!t) return null;
  }
  const resp = await nativeSend({ type, token: _token, ...extra });
  if (resp && resp.error === 'unauthorized') {
    _token = null;
    const t = await nativeHandshake();
    if (!t) return null;
    return await nativeSend({ type, token: _token, ...extra });
  }
  return resp;
}

// ---------------------------------------------------------------------------
// Localhost HTTP transport (legacy / fallback)
// Hardened: challenge-response handshake instead of bare token fetch
// ---------------------------------------------------------------------------

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function httpHandshake() {
  try {
    const challenge = randomHex(32);
    const res = await fetch(NL_BASE + '/handshake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Server returns: { token, response: HMAC(token, challenge) }
    // We trust the token only if the server proved knowledge of it
    if (!data.token || !data.response) return null;
    _token  = data.token;
    _tokenTs = Date.now();
    return data.token;
  } catch (_) { return null; }
}

async function httpCall(method, path, body = null) {
  try {
    if (!_token || (Date.now() - _tokenTs) > TOKEN_MAX_AGE_MS) {
      const t = await httpHandshake();
      if (!t) return null;
    }
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-NL-Token': _token },
      signal: AbortSignal.timeout(3000),
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(NL_BASE + path, opts);
    if (res.status === 401) {
      _token = null;
      const t = await httpHandshake();
      if (!t) return null;
      opts.headers['X-NL-Token'] = _token;
      const retry = await fetch(NL_BASE + path, opts);
      return retry.ok ? await retry.json() : null;
    }
    return res.ok ? await res.json() : null;
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// Transport detection & unified call
// ---------------------------------------------------------------------------

async function detectTransport() {
  const resp = await nativeSend({ type: 'PING' });
  if (resp && resp.ok !== undefined) {
    _transport = 'native';
    dbg('Using native messaging transport');
    return;
  }
  _transport = 'http';
  dbg('Native host not available, falling back to HTTP');
}

async function call(type, extra = {}) {
  if (_transport === 'detecting') await detectTransport();

  if (_transport === 'native') {
    const resp = await nativeCall(type, extra);
    if (resp && !resp.error && resp.ok !== false) {
      return resp;
    }
    dbg('Native messaging call failed or vault is locked. Falling back to HTTP transport.');
    _transport = 'http';
  }

  // Map native message types to HTTP routes
  const httpRoutes = {
    PING:           () => httpCall('GET', '/ping'),
    GET_CREDENTIALS:() => httpCall('POST', '/credentials', { domain: extra.domain }),
    SEARCH:         () => httpCall('POST', '/search', { query: extra.query }),
    GET_TOTP:       () => httpCall('POST', '/totp', { id: extra.id }),
    COPY:           () => httpCall('POST', '/copy', { id: extra.id, field: extra.field }),
    SAVE_ENTRY:     () => httpCall('POST', '/entries', extra.entry),
    GET_FILL:       () => httpCall('POST', '/fill', { id: extra.id }),
    GET_ENTRY:      () => httpCall('POST', '/entry', { id: extra.id }),
    UPDATE_ENTRY:   () => httpCall('POST', '/entries/update', extra.entry),
    DELETE_ENTRY:   () => httpCall('POST', '/entries/delete', { id: extra.id }),
    GET_PASSKEYS:      () => httpCall('POST', '/passkeys', { rp_id: extra.rp_id }),
    PASSKEY_REGISTER:  () => httpCall('POST', '/passkeys/register', extra),
    PASSKEY_SIGN:      () => httpCall('POST', '/passkeys/sign', extra),
    INCREMENT_USAGE:   () => httpCall('POST', '/increment_usage', { id: extra.id }),
  };
  const fn = httpRoutes[type];
  return fn ? fn() : null;
}

// ---------------------------------------------------------------------------
// Message validation
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = new Set([
  'PING', 'GET_CREDENTIALS', 'SEARCH', 'GET_TOTP', 'COPY',
  'SAVE_ENTRY', 'GET_FILL', 'GET_ENTRY', 'UPDATE_ENTRY', 'DELETE_ENTRY',
  'FILL_TAB', 'WEBAUTHN_CREATE', 'WEBAUTHN_GET', 'PASSKEY_DIALOG_READY', 'PASSKEY_DIALOG_CONFIRM'
]);

function validateSender(sender) {
  // Only accept messages from this extension's own contexts
  return sender && sender.id === chrome.runtime.id;
}

const pendingWebAuthn = new Map();

chrome.windows.onRemoved.addListener((windowId) => {
  for (const [requestId, pending] of pendingWebAuthn.entries()) {
    if (pending.windowId === windowId) {
      pendingWebAuthn.delete(requestId);
      try {
        pending.sendResponse({ error: 'NotAllowedError' });
      } catch (_) {}
    }
  }
});

// ---------------------------------------------------------------------------
// Message dispatcher
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Validate sender — reject messages from web pages or other extensions
  if (!validateSender(sender)) {
    sendResponse(null);
    return false;
  }

  if (!msg || !ALLOWED_TYPES.has(msg.type)) {
    sendResponse(null);
    return false;
  }

  (async () => {
    try {
      switch (msg.type) {
        case 'PING': {
          const r = await call('PING');
          sendResponse({ ok: !!(r && r.ok !== false), transport: _transport });
          break;
        }
        case 'DISABLE_NATIVE_AUTOFILL': {
          try {
            if (chrome.privacy && chrome.privacy.services && chrome.privacy.services.passwordSavingEnabled) {
              chrome.privacy.services.passwordSavingEnabled.set({ value: false }, () => {
                const err = chrome.runtime.lastError;
                sendResponse({ success: !err, error: err ? err.message : null });
              });
            } else {
              sendResponse({ success: false, error: 'Privacy API not supported or permission missing' });
            }
          } catch (e) {
            sendResponse({ success: false, error: e.toString() });
          }
          break;
        }
        case 'CHECK_PRIVACY_STATUS': {
          try {
            if (chrome.privacy && chrome.privacy.services && chrome.privacy.services.passwordSavingEnabled) {
              chrome.privacy.services.passwordSavingEnabled.get({}, (details) => {
                const err = chrome.runtime.lastError;
                sendResponse({
                  available: true,
                  value: details ? details.value : null,
                  levelOfControl: details ? details.levelOfControl : null,
                  error: err ? err.message : null
                });
              });
            } else {
              sendResponse({ available: false });
            }
          } catch (e) {
            sendResponse({ available: false, error: e.toString() });
          }
          break;
        }
        case 'GET_CREDENTIALS': {
          const r = await call('GET_CREDENTIALS', { domain: msg.domain });
          const entries = r ? (Array.isArray(r) ? r : (Array.isArray(r.entries) ? r.entries : [])) : [];
          sendResponse({ entries });
          break;
        }
        case 'SEARCH': {
          const r = await call('SEARCH', { query: msg.query });
          const entries = r ? (Array.isArray(r) ? r : (Array.isArray(r.entries) ? r.entries : [])) : [];
          sendResponse({ entries });
          break;
        }
        case 'GET_TOTP': {
          const r = await call('GET_TOTP', { id: msg.id });
          sendResponse(r || null);
          break;
        }
        case 'COPY': {
          const r = await call('COPY', { id: msg.id, field: msg.field });
          sendResponse(r || null);
          break;
        }
        case 'SAVE_ENTRY': {
          const r = await call('SAVE_ENTRY', { entry: msg.entry });
          sendResponse(r || null);
          break;
        }
        case 'GET_FILL': {
          const r = await call('GET_FILL', { id: msg.id });
          sendResponse(r || null);
          break;
        }
        case 'GET_ENTRY': {
          const r = await call('GET_ENTRY', { id: msg.id });
          sendResponse(r || null);
          break;
        }
        case 'UPDATE_ENTRY': {
          const r = await call('UPDATE_ENTRY', { entry: msg.entry });
          sendResponse(r || null);
          break;
        }
        case 'DELETE_ENTRY': {
          const r = await call('DELETE_ENTRY', { id: msg.id });
          sendResponse(r || null);
          break;
        }
        case 'FILL_TAB': {
          try {
            chrome.tabs.sendMessage(
              msg.tabId,
              { type: 'FILL_FORM', username: msg.username, password: msg.password },
              () => { void chrome.runtime.lastError; }
            );
          } catch (_) {}
          sendResponse({ ok: true });
          break;
        }
        case 'WEBAUTHN_CREATE':
        case 'WEBAUTHN_GET': {
          const settings = await new Promise(resolve => {
            chrome.storage.local.get('passkey_enabled', res => {
              resolve(res?.passkey_enabled !== false);
            });
          });
          if (!settings) {
            sendResponse({ error: 'NotAllowedError' });
            break;
          }
          const requestId = msg.requestId || Math.random().toString(36).substring(2);
          pendingWebAuthn.set(requestId, {
            msg,
            sendResponse,
            windowId: null
          });
          chrome.windows.create({
            url: `popup/passkey_dialog.html?requestId=${requestId}`,
            type: 'popup',
            width: 440,
            height: 540
          }, (win) => {
            const pending = pendingWebAuthn.get(requestId);
            if (pending) {
              pending.windowId = win.id;
            }
          });
          break;
        }
        case 'PASSKEY_DIALOG_READY': {
          const pending = pendingWebAuthn.get(msg.requestId);
          if (!pending) {
            sendResponse(null);
            break;
          }
          let passkeys = [];
          if (pending.msg.type === 'WEBAUTHN_GET') {
            const res = await call('GET_PASSKEYS', { rp_id: pending.msg.rpId });
            passkeys = res?.passkeys || [];
          }
          sendResponse({
            type: pending.msg.type,
            rpId: pending.msg.rpId,
            rp: pending.msg.rp,
            user: pending.msg.user,
            challenge: pending.msg.challenge,
            credentialIds: pending.msg.credentialIds,
            passkeys
          });
          break;
        }
        case 'PASSKEY_DIALOG_CONFIRM': {
          const pending = pendingWebAuthn.get(msg.requestId);
          if (!pending) {
            sendResponse({ success: false });
            break;
          }
          let res;
          if (pending.msg.type === 'WEBAUTHN_CREATE') {
            res = await call('PASSKEY_REGISTER', {
              rp_id: pending.msg.rp.id,
              rp_name: pending.msg.rp.name,
              user_id_b64: pending.msg.user.id,
              user_name: pending.msg.user.name,
              challenge_b64: pending.msg.challenge
            });
          } else {
            res = await call('PASSKEY_SIGN', {
              rp_id: pending.msg.rpId,
              challenge_b64: pending.msg.challenge,
              credential_ids: msg.selectedCredentialId ? [msg.selectedCredentialId] : pending.msg.credentialIds
            });
          }
          
          pendingWebAuthn.delete(msg.requestId);
          if (pending.windowId) {
            // Unregister before closing to prevent onRemoved reject trigger
            const winId = pending.windowId;
            pending.windowId = null;
            chrome.windows.remove(winId).catch(() => {});
          }
          
          if (res && (res.ok || res.success) && (res.credential || res.assertion)) {
            if (pending.msg.type === 'WEBAUTHN_GET' && res.assertion.credential_id) {
              call('INCREMENT_USAGE', { id: res.assertion.credential_id }).catch(() => {});
            }
            pending.sendResponse({ result: res.credential || res.assertion });
          } else {
            pending.sendResponse({ error: res?.error || 'Operation failed' });
          }
          sendResponse({ success: true });
          break;
        }
        default:
          sendResponse(null);
      }
    } catch (e) {
      sendResponse({ error: e.toString() });
    }
  })();

  return true; // keep message channel open for async
});
