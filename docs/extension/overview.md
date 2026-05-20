[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Browser Extension Architecture Overview

## 1. Introduction & Security Goals
The localpass Browser Extension is a Manifest V3 compliant security module that bridges the gap between web application interfaces (rendered in the browser) and the local desktop-bound secure password vault. It provides inline credential auto-fill, credential capture on submit, single-page vault dashboards, and secure WebAuthn/Passkey registration and authentication.

### Core Security Boundaries
- **No Direct Storage:** The extension operates statelessly in the browser with respect to permanent storage. Vault entries, raw master keys, and encryption credentials are never written to `chrome.storage.local`.
- **In-Memory Token Cache:** Authentication tokens issued by the desktop vault process are stored strictly in-memory in the service worker runtime. They expire after 8 hours or upon closing the browser.
- **Origin Separation:** Standard web applications cannot access any extension contexts or query localized loopback channels directly. Communication is routed through verified content script message bridges.

---

## 2. Manifest V3 Process Topology & Sandboxes
The extension is partitioned into four distinct execution environments, each running in a separate sandbox isolated by the browser's security architecture.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER WEB TAB RUNTIME                                  │
│                                                                                        │
│  ┌───────────────────────────────┐                  ┌──────────────────────────────┐  │
│  │    Main World Webpage         │                  │   Content Script Sandbox     │  │
│  │  (navigator.credentials)       │                  │                              │  │
│  │               │               │                  │    ┌────────────────────┐    │  │
│  │               │ window.post   │                  │    │     content.js     │    │  │
│  │               ▼ Message       │                  │    ├────────────────────┤    │  │
│  │    [ webauthn_interceptor ] ──┼─────────────────►│    │     detector.js    │    │  │
│  │                               │◄─────────────────┼────│     filler.js      │    │  │
│  └───────────────────────────────┘   window.post    │    └─────────┬──────────┘    │  │
│                                      Message        └──────────────┼───────────────┘  │
└────────────────────────────────────────────────────────────────────┼───────────────────┘
                                                                     │
                                                           chrome.   │
                                                           runtime.  │
                                                           sendMessage
                                                                     │
┌──────────────────────────────┐                   ┌─────────────────▼──────────────┐
│       POPUP UI CONTEXT       │                   │   BACKGROUND SERVICE WORKER    │
│                              │   chrome.runtime  │                                │
│    ┌──────────────────┐      │◄─────────────────►│    ┌─────────────────────┐     │
│    │     popup.js     │──────┼──────────────────►│    │    background.js    │     │
│    └──────────────────┘      │                   │    └──────────┬──────────┘     │
└──────────────────────────────┘                   └───────────────┼────────────────┘
                                                                   │
                                                   Native Messaging│ Or Localhost HTTP
                                                   (Stdio Pipes)   │ Fallback
                                                                   ▼
                                                       [ Desktop Vault Host ]
```

### Sandbox Profiles

#### A. Main World Webpage Sandbox
*   **Execution Scope:** Runs in the context of the page’s global execution scope. It has full access to the page’s JavaScript environment (`window`, `document`, and web APIs).
*   **Active Component:** `webauthn_interceptor.js` (Injected dynamically as a `<script>` node).
*   **Responsibility:** Overrides `navigator.credentials.create` and `navigator.credentials.get` to hook and redirect passkey requests.
*   **Isolation Security:** Direct variables inside this sandbox cannot access `chrome.runtime` APIs, preventing malicious websites from spoofing messages to the service worker.

#### B. Isolated Content Script Sandbox
*   **Execution Scope:** Isolated world running in parallel with the webpage. Can read/write page DOM but cannot see JavaScript objects or variables defined by the main world page.
*   **Active Components:** `content.js`, `utils/detector.js`, `utils/filler.js`.
*   **Responsibility:** Dynamically monitors the DOM using `MutationObserver`, positions locker buttons beside login fields, queries matching credentials from the background page, and injects form values.
*   **Communication:** Relies on `window.addEventListener("message")` to capture redirected calls from the webpage interceptor, and `chrome.runtime.sendMessage` to query the background worker.

#### C. Background Service Worker Sandbox
*   **Execution Scope:** The central execution node. Has access to all extension APIs, operates in a background thread, and wakes up dynamically on-demand.
*   **Active Component:** `background.js`.
*   **Responsibility:** Resolves transport protocols (Chrome Native Messaging vs. localhost HTTP), handles token authentication challenges, processes request schemas, and manages the passkey dialog popup window lifecycle.

#### D. Popup UI Context Sandbox
*   **Execution Scope:** Renders inside the extension popup container (`popup.html`).
*   **Active Components:** `popup.js`, `passkey_dialog.js`.
*   **Responsibility:** A dashboard interface allowing users to view, search, add, or update vault credentials manually, as well as confirm passkey interactions.

---

## 3. Communication Bridge & Message passing
To ensure strict security, no direct data queries are allowed between non-sandboxed environments. Data is systematically serialized and routed across the following boundaries:

```
[Webpage WebAuthn] ──► (DOM Message) ──► [Content Script] ──► (Extension IPC) ──► [Service Worker] ──► (Stdio/HTTP) ──► [Python Vault]
```

### Messaging Schema Definitions

#### 1. Runtime Extension Messages (Content/Popup to Background)
All messaging packets use strict type matching.
*   **Payload Example (`GET_CREDENTIALS`):**
    ```json
    {
      "type": "GET_CREDENTIALS",
      "domain": "github.com"
    }
    ```
*   **Response Payload:**
    ```json
    {
      "entries": [
        {
          "id": "c1f8a8db-002f-48d8-941f-82548cb459e9",
          "title": "GitHub Profile",
          "username": "localpass-dev",
          "type": "login",
          "has_totp": true,
          "url": "https://github.com"
        }
      ]
    }
    ```

---

## 4. Multi-Transport Strategy: Native vs. HTTP Fallback
The extension implements a fail-secure dual-transport architecture:

### Transport Selection Logic
1. **Primary Transport (Native Messaging):** On startup, `background.js` issues a test message to `com.localpass.host`. If successful, the extension binds to **Native Messaging** (standard input/output pipes).
2. **Secondary Transport (Hardened Localhost HTTP):** If Chrome Native Messaging is not installed or returns an error, the background service worker falls back to HTTP queries routed to `http://127.0.0.1:27432`.
3. **Hardened Security Features:**
   *   **Native Messaging:** Zero open listening ports, local sandboxed execution context, immune to network scanning.
   *   **Localhost HTTP:** Strict Origin validation checks, challenge-response token generation utilizing an HMAC verification process to prevent Cross-Site Request Forgery (CSRF).

---

## 5. Passkeys & WebAuthn Integration Architecture
localpass intercepts native browser WebAuthn behaviors, allowing the local vault to act as a hardware authenticator.

1. **API Hooking:** `webauthn_interceptor.js` replaces the browser's native `navigator.credentials.create` and `get` functions.
2. **Challenge Capture:** ArrayBuffer inputs (challenge, user IDs) are encoded to base64URL arrays and serialized into JSON objects.
3. **IPC Bridge:** PostMessage delivers the JSON payload to `content.js`, which wraps it in a `WEBAUTHN_CREATE` or `WEBAUTHN_GET` request for `background.js`.
4. **Interactive Consent Window:** `background.js` spawns a dedicated popup window (`popup/passkey_dialog.html`) rendering the selected credentials list and prompting for confirmation.
5. **Signing Operations:** Upon user confirmation, the challenge is signed by the desktop application via `PASSKEY_REGISTER` or `PASSKEY_SIGN` APIs.
6. **Object Rehydration:** The signed keys are serialized back into standard `PublicKeyCredential` response objects with authenticating signatures and returned to the web page via the callback promise.

---

## See Also
- [Extension Setup](setup.md)
- [Background](background/background.md)
- [Popup](popup/popup.md)
- [Bridge](utils/bridge.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*