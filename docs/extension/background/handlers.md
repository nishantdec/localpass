[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Background Event & IPC Message Handlers (`handlers.md`)

## 1. Overview
The Background Service Worker coordinates IPC messages sent from the extension's content scripts (`content.js`) and popup dashboard (`popup.js`). It acts as a gatekeeper, verifying caller origins, validating message structures, executing background commands via the active transport layer, and managing browser-level resources (such as window interfaces and privacy options).

---

## 2. Inbound Message Security Verification
Before dispatching any inbound message, the service worker runs security checks:

```
[ Inbound Message ]
        │
  validateSender()? ──────► [No] ──► Reject / Return Null
        │
  [Yes] │
        ▼
  ALLOWED_TYPES.has()? ───► [No] ──► Reject / Return Null
        │
  [Yes] │
        ▼
  (Dispatch Handler Case)
```

### Verification Rules
*   **Sender Context Validation (`validateSender`):** Verifies that the sender's origin ID matches the extension's own unique extension ID (`sender.id === chrome.runtime.id`). This prevents external web applications or other extensions from forging messages.
*   **Schema Whitelisting (`ALLOWED_TYPES`):** Messages are blocked unless their `type` is present in the `ALLOWED_TYPES` whitelist set.

---

## 3. WebAuthn/Passkey Authorization Sequence
The background worker orchestrates the secure lifecycle for WebAuthn passkey operations. This sequence includes mapping dynamic tab variables and spawning user consent popups:

```
[ Web Page WebAuthn API Call ]
             │
             ▼ (PostMessage)
      [ Content Script ]
             │
             ▼ (chrome.runtime.sendMessage)
[ Service Worker (background.js) ]
  1. Add request to pendingWebAuthn map
  2. chrome.windows.create()
             │
             ▼
┌──────────────────────────────────────┐
│     Interactive Consent Popup        │
│    (popup/passkey_dialog.html)       │
│                                      │
│  A. Requests context:                │
│     PASSKEY_DIALOG_READY             │
│                                      │
│  B. User confirms:                   │
│     PASSKEY_DIALOG_CONFIRM           │
└──────────────────┬───────────────────┘
                   │
                   ▼
  1. Call Python Vault: PASSKEY_SIGN
  2. chrome.windows.remove()
  3. Resolve original WebAuthn promise
```

---

## 4. Handler Specifications

### 1. `PING`
* **Input Payload:** `{ "type": "PING" }`
* **Action:** Pings the active transport to check the locking status.
* **Response:** `{ "ok": true, "transport": "native" }`

### 2. `GET_CREDENTIALS`
* **Input Payload:** `{ "type": "GET_CREDENTIALS", "domain": "github.com" }`
* **Action:** Calls `/credentials` or the native host to pull credentials matching the domain.
* **Response:** `{ "entries": [...] }`

### 3. `SEARCH`
* **Input Payload:** `{ "type": "SEARCH", "query": "google" }`
* **Action:** Searches the vault database for entries matching the query.
* **Response:** `{ "entries": [...] }`

### 4. `GET_TOTP`
* **Input Payload:** `{ "type": "GET_TOTP", "id": "uuid" }`
* **Action:** Generates a 6-digit TOTP code for the specified credential.
* **Response:** `{ "ok": true, "code": "123456", "seconds_remaining": 22 }`

### 5. `SAVE_ENTRY`
* **Input Payload:** `{ "type": "SAVE_ENTRY", "entry": { ... } }`
* **Action:** Saves a new entry to the vault.
* **Response:** `{ "ok": true, "id": "new-uuid" }`

### 6. `FILL_TAB`
* **Input Payload:** `{ "type": "FILL_TAB", "tabId": 12, "username": "north", "password": "pwd" }`
* **Action:** Routes an internal `FILL_FORM` command directly to a target tab.
* **Response:** `{ "ok": true }`

### 7. `WEBAUTHN_CREATE` / `WEBAUTHN_GET`
* **Input Payload:** `{ "type": "WEBAUTHN_GET", "rpId": "github.com", "challenge": "base64", ... }`
* **Action:** Caches the request in `pendingWebAuthn` and opens the confirmation popup.
* **Response:** (Asynchronous) Authenticators credential signature blocks.

### 8. `PASSKEY_DIALOG_READY`
* **Input Payload:** `{ "type": "PASSKEY_DIALOG_READY", "requestId": "req-123" }`
* **Action:** Delivers the cached challenge data and any matching passkeys to the consent dialog.
* **Response:** Challenge parameters and credential list.

### 9. `PASSKEY_DIALOG_CONFIRM`
* **Input Payload:** `{ "type": "PASSKEY_DIALOG_CONFIRM", "requestId": "req-123", "selectedCredentialId": "cred-12" }`
* **Action:** Submits the challenge to the vault for signing, returns the signature, and closes the popup.
* **Response:** `{ "success": true }`

---

## 5. Technical Function Reference

### `validateSender()`
Validates that incoming messages originate from the extension's own execution contexts.
* **Signature:** `function validateSender(sender)`
* **Parameters:**
  - `sender` (`chrome.runtime.MessageSender`): The runtime message sender descriptor.
* **Returns:** `boolean` (`True` if the message is from a trusted extension context).
* **Called By:**
  - `background.js` -> `chrome.runtime.onMessage.addListener()`
* **Working Example:**
  ```javascript
  const isValid = validateSender(sender);
  if (!isValid) return sendResponse(null);
  ```

---

### `chrome.windows.onRemoved` Listener
Listens for window close events. If the user closes the Passkey Dialog popup manually by clicking the "X" button, this listener catches the event, removes the request from the pending map, and rejects the promise with a `NotAllowedError`.
* **Signature:** `chrome.windows.onRemoved.addListener(windowId)`
* **Parameters:**
  - `windowId` (`number`): The ID of the closed window.
* **Working Example:**
  ```javascript
  // Triggered automatically when a window is closed
  chrome.windows.onRemoved.addListener((windowId) => {
    // Rejects pending operations for that window
  });
  ```

---

## See Also
- [Extension Overview](../overview.md)
- [Background](background.md)
- [Handshake](handshake.md)
- [Server Client](server.md)
- [Message Passing Api](../../api/message-passing-api.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*