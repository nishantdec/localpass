[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# localpass Extension Message Passing API Reference

This document maps all inter-process message passing channels defined within the browser extension.

Communication utilizes the `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` APIs to exchange structured objects between the **Popup context**, **Content Scripts**, and the background **Service Worker** (`background.js`).

---

## Security Context Validation

To prevent cross-extension resource hijacking or malicious web page injections, the Service Worker strictly validates the origin of every incoming runtime message before processing:

```javascript
function validateSender(sender) {
  // Only accept messages from this extension's own execution contexts
  return sender && sender.id === chrome.runtime.id;
}
```

Any message received from an external origin is ignored and returns a `null` response.

---

## Message Protocol Catalogue

---

### PING

**Direction:** `popup.js` -> `background.js` -> `local_server.py`

**Purpose:** Health check. Validates if the local Python server daemon is running and if the vault is unlocked.

**Sent by:** `popup.js` (line 493) in `registerView('entries', ...)` renderer logic.

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'PING'
});
```

**Handler location:** `background.js` lines 230–234
**Handler function:** `call('PING')` mapping to `/ping` (HTTP fallback) or standard Native host `PING` JSON message.

**Response Schema:**
```javascript
{
  "ok": true,          // true if unlocked and responsive, false otherwise
  "transport": "native" // "native" | "http"
}
```

**Response used by:** `popup.js` `registerView('entries', ...)` to render the "Vault is locked" or "Not Connected" overlay.

---

### GET_CREDENTIALS

**Direction:** `popup.js` / `content.js` -> `background.js` -> `local_server.py`

**Purpose:** Retrieves vault login entries matching a specified domain. Does not expose plaintext passwords.

**Sent by:**
- `popup.js` inside `registerView('entries', ...)` (line 498).
- `content.js` inside `injectNLButtons()` (line 405) and field focus hooks.

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'GET_CREDENTIALS',
  domain: 'github.com' // Normalized hostname without www.
});
```

**Handler location:** `background.js` lines 270–275
**Handler function:** `call('GET_CREDENTIALS', { domain: msg.domain })` mapping to `POST /credentials`.

**Response Schema:**
```javascript
{
  "entries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "GitHub",
      "username": "user@email.com",
      "type": "login",
      "has_totp": true,
      "url": "https://github.com",
      "preferred": true,
      "last_used": "2026-05-20T05:30:00Z"
    }
  ]
}
```
*Note: Always returns an array under `entries`. Returns `{ entries: [] }` on failure or match absence.*

**Response used by:** `popup.js` to build card lists, and `content.js` to draw inline autocomplete boxes.

---

### SEARCH

**Direction:** `popup.js` -> `background.js` -> `local_server.py`

**Purpose:** Executes a full-text search query across all logins, secure notes, and passkeys in the vault.

**Sent by:** `popup.js` inside `refreshCurrentView()` and search field event listeners (line 499).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'SEARCH',
  query: 'github' // String query matching fields
});
```

**Handler location:** `background.js` lines 276–281
**Handler function:** `call('SEARCH', { query: msg.query })` mapping to `POST /search`.

**Response Schema:**
```javascript
{
  "entries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "GitHub",
      "username": "user@email.com",
      "type": "login",
      "has_totp": true,
      "url": "https://github.com",
      "preferred": true,
      "last_used": "2026-05-20T05:30:00Z"
    }
  ]
}
```

**Response used by:** `popup.js` `renderSearchResults()` to refresh the dashboard list.

---

### GET_TOTP

**Direction:** `popup.js` -> `background.js` -> `local_server.py`

**Purpose:** Retrieves the current active TOTP token code and time remaining.

**Sent by:** `popup.js` inside the `nl-copy-totp-btn` click listener (line 326).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'GET_TOTP',
  id: '550e8400-e29b-41d4-a716-446655440000' // Target entry UUID
});
```

**Handler location:** `background.js` lines 282–285
**Handler function:** `call('GET_TOTP', { id: msg.id })` mapping to `POST /totp`.

**Response Schema:**
```javascript
{
  "code": "489201",
  "seconds_remaining": 18
}
```
*Note: Returns `null` if the entry has no TOTP configuration.*

**Response used by:** `popup.js` to copy the 6-digit passcode directly to the clipboard.

---

### COPY

**Direction:** `popup.js` -> `background.js` -> `local_server.py`

**Purpose:** Triggers the Python clipboard manager, copying the requested field value and scheduling a 15-second secure background erase thread.

**Sent by:** `popup.js` inside key/password copy event handlers (line 317).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'COPY',
  id: '550e8400-e29b-41d4-a716-446655440000',
  field: 'password' // "password" | "totp"
});
```

**Handler location:** `background.js` lines 286–290
**Handler function:** `call('COPY', { id: msg.id, field: msg.field })` mapping to `POST /copy`.

**Response Schema:**
```javascript
{
  "success": true
}
```

**Response used by:** `popup.js` to trigger UI visual success indicators.

---

### SAVE_ENTRY

**Direction:** `popup.js` / `content.js` -> `background.js` -> `local_server.py`

**Purpose:** Saves a newly configured login entry or secure note into the vault.

**Sent by:**
- `popup.js` inside `registerView('save', ...)` form submit callback.
- `content.js` inside the `showSavePrompt()` overlay dialog save action (line 276).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'SAVE_ENTRY',
  entry: {
    type: 'login',
    title: 'GitHub',
    username: 'user@email.com',
    password: 'secure_password_hunter2',
    url: 'https://github.com',
    totp_secret: 'optional_totp_seed',
    notes: 'Optional comments'
  }
});
```

**Handler location:** `background.js` lines 291–295
**Handler function:** `call('SAVE_ENTRY', { entry: msg.entry })` mapping to `POST /entries`.

**Response Schema:**
```javascript
{
  "success": true,
  "id": "new-entry-uuid"
}
```

**Response used by:** `popup.js` or `content.js` to display validation success indicators.

---

### GET_FILL

**Direction:** `popup.js` / `content.js` -> `background.js` -> `local_server.py`

**Purpose:** Fetches decrypted plaintext credentials (username and password) to perform direct autofilling.

**Sent by:**
- `popup.js` inside `.nl-fill-btn` click handlers (line 301).
- `content.js` inside the inline dropdown list selection handler (line 571).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'GET_FILL',
  id: '550e8400-e29b-41d4-a716-446655440000'
});
```

**Handler location:** `background.js` lines 297–300
**Handler function:** `call('GET_FILL', { id: msg.id })` mapping to `POST /fill`.

**Response Schema:**
```javascript
{
  "username": "user@email.com",
  "password": "plaintext_password_hunter2"
}
```

**Response used by:** `content.js` and `popup.js` to inject plaintext credentials into input fields.

---

### FILL_TAB

**Direction:** `popup.js` -> `background.js` -> `content.js`

**Purpose:** Command routed from the popup panel to active webpage content scripts, instructing them to perform field insertion.

**Sent by:** `popup.js` inside row-level fill buttons (line 303).

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'FILL_TAB',
  tabId: 1048, // Browser active tab identifier
  username: 'user@email.com',
  password: 'plaintext_password_hunter2'
});
```

**Handler location:** `background.js` lines 317–327
**Handler function:** Intercepts `FILL_TAB` and dispatches `FILL_FORM` to target tabs via `chrome.tabs.sendMessage()`.

**Response Schema:**
```javascript
{
  "ok": true
}
```

---

### FILL_FORM

**Direction:** `background.js` -> `content.js`

**Purpose:** Instructs the content script inside a specific tab to fill page fields.

**Sent by:** `background.js` inside `FILL_TAB` message routing (line 319).

**Request Schema:**
```javascript
chrome.tabs.sendMessage(tabId, {
  type: 'FILL_FORM',
  username: 'user@email.com',
  password: 'secure_password_hunter2'
});
```

**Handler location:** `content.js` lines 39–53
**Handler function:** `chrome.runtime.onMessage.addListener(...)`

**Response Schema:** No structured response returned. Execution is fire-and-forget.

**Action performed:** Calls `fillField(usernameField, msg.username)` and `fillField(passwordField, msg.password)`, then triggers `autoSubmitForm()` if enabled in extension settings.

---

### FILL_OTP

**Direction:** `popup.js` -> `background.js` -> `content.js`

**Purpose:** Directs the active content script to locate and fill 2FA verification code inputs.

**Sent by:** `popup.js` inside TOTP-only row quick-fill actions.

**Request Schema:**
```javascript
chrome.runtime.sendMessage({
  type: 'FILL_OTP',
  tabId: 1048,
  code: '489201'
});
```

**Handler location:** `content.js` lines 54–56
**Handler function:** `chrome.runtime.onMessage.addListener(...)`

**Response Schema:** No response. Content script executes `fillOTPForm(msg.code)`.

---

## See Also
- [Local Server Api](local-server-api.md)
- [Vault File Format](vault-file-format.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*