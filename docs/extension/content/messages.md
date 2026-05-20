[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Content Script DOM Event & Message Router (`messages.md`)

## 1. Overview
The Content Script (`content.js`) runs in an isolated sandbox. It cannot access variables or function endpoints inside the web page's JavaScript environment directly. However, it can access the webpage's DOM. 

To bridge this boundary (especially for passkeys, where page-level JavaScript API calls must be routed to the background service worker), the content script implements a **Dual-Sided Window Message Router**. This router listens for serialized page-level DOM messages, maps them to background extension requests, and returns structured API responses.

---

## 2. WebAuthn Message Routing
The following diagram details how passkey authentication packets flow through the message router across the isolated sandbox boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              WEB PAGE TAB                              │
│                                                                        │
│ ┌────────────────────────┐                    ┌──────────────────────┐ │
│ │  Main World Webpage    │                    │Isolated Content World│ │
│ │ (webauthn_interceptor) │                    │      (content.js)    │ │
│ └───────────┬────────────┘                    └───────────▲──────────┘ │
│             │                                             │            │
│             │ 1. window.postMessage                       │ 3. window. │
│             │    {source: "localpass-                   │    post    │
│             │     interceptor"}                           │    Message │
│             ▼                                             │            │
│       [ DOM Message Channel (window.postMessage) ]        │            │
│             │                                             │            │
│             └─────────────────────────────────────────────┘            │
│                                   │                                    │
│                                   ▼ 2. chrome.runtime.sendMessage      │
│                                                                        │
│                       ┌───────────────────────┐                        │
│                       │   Service Worker      │                        │
│                       │    background.js      │                        │
│                       └───────────────────────┘                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported Router Messages & Schemas

### 1. Webpage to Content Script (`localpass-interceptor`)
Sent by `webauthn_interceptor.js` when the webpage triggers a WebAuthn registration or assertion call.
*   **Payload Schema:**
    ```json
    {
      "source": "localpass-interceptor",
      "type": "WEBAUTHN_CREATE | WEBAUTHN_GET",
      "requestId": "unique-request-id-string",
      "rpId": "github.com",
      "rp": { "id": "github.com", "name": "GitHub" },
      "user": { "id": "base64-user-id", "name": "north" },
      "challenge": "base64url-challenge-string",
      "credentialIds": ["allow-credential-id-1"]
    }
    ```

### 2. Content Script to Webpage (`localpass-content`)
Returned by `content.js` to deliver the signature response or report user rejection.
*   **Payload Schema:**
    ```json
    {
      "source": "localpass-content",
      "requestId": "unique-request-id-string",
      "result": {
        "credential_id": "cred-id",
        "signature": "assertion-signature",
        "authenticator_data": "auth-data",
        "user_handle": "user-id"
      },
      "error": null
    }
    ```

---

## 4. Technical Function Reference

### `sendBg()`
A standardized communication wrapper that sends serialized messages to the background script and handles unexpected disconnections gracefully.
* **Signature:** `function sendBg(msg)`
* **Parameters:**
  - `msg` (`object`): The JSON message payload.
* **Returns:** `Promise<object | null>` (Response object from background worker, or `null` if the connection fails).
* **Called By:**
  - `content.js` -> forms, dropdowns, and message routers.
* **Calls:**
  - `chrome.runtime.sendMessage()`
* **Working Example:**
  ```javascript
  const res = await sendBg({ type: "GET_CREDENTIALS", domain: "google.com" });
  if (res) {
    console.log(res.entries);
  }
  ```

---

### `window.addEventListener("message")` Router
Listens for message events dispatched to the window container. It filters out external frames, validates message origins, and forwards requests to the background service worker.
* **Signature:** `window.addEventListener("message", async (event) => { ... })`
* **Parameters:**
  - `event` (`MessageEvent`): The DOM window message descriptor.
* **Working Example:**
  ```javascript
  // Triggered when a webpage interceptor dispatches an event
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (msg && msg.source === "localpass-interceptor") {
       // Sends packet to background worker, wait for signing, returns response
       const resp = await sendBg(msg);
       window.postMessage({ source: "localpass-content", requestId: msg.requestId, ... });
    }
  });
  ```

---

### `chrome.runtime.onMessage` Listener
Receives tab autofill requests dispatched from the background worker (such as filling credentials or inserting OTP values).
* **Signature:** `chrome.runtime.onMessage.addListener((msg) => { ... })`
* **Parameters:**
  - `msg` (`object`): The command payload from the service worker.
* **Working Example:**
  ```javascript
  // Listens for direct background instructions
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FILL_FORM") {
      fillLoginForm(msg.username, msg.password);
    }
  });
  ```

---

## See Also
- [Extension Overview](../overview.md)
- [Injector](injector.md)
- [Dropdown](dropdown.md)
- [Observer](observer.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*