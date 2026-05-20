[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Extension Communication Channels and Messaging Architecture

This document details the multi-process communication channels, API boundaries, and messaging topologies that govern the localpass Manifest V3 browser extension and its interaction with the host operating system.

---

## 1. Complete Communication Flow Diagram

The following ASCII diagram illustrates the internal and external communication interfaces of the browser extension, highlighting security boundaries and runtime contexts.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CHROME / EDGE BROWSER SANDBOX                             │
│                                                                                        │
│   ┌──────────────────────────┐                                                         │
│   │    WEBPAGE DOM CONTEXT   │                                                         │
│   │  (e.g., github.com/login)│                                                         │
│   └────────────┬─────────────┘                                                         │
│                │                                                                       │
│     Main World │ window.postMessage() (JSON Serialized ArrayBuffers)                   │
│     Injection  │ (WebAuthn Passkey Interceptions / Credential Assertions)              │
│                ▼                                                                       │
│   ┌──────────────────────────┐                                                         │
│   │    WEBAUTHN INTERCEPTOR  │                                                         │
│   │ (webauthn_interceptor.js)│                                                         │
│   └────────────┬─────────────┘                                                         │
│                │                                                                       │
│   Direct DOM   │ read/write form inputs                                                │
│   Interactions │ (Heuristic element scanning)                                          │
│                ▼                                                                       │
│   ┌──────────────────────────┐             chrome.runtime.sendMessage()                │
│   │      CONTENT SCRIPT      │ ──────────────────────────────────────┐                 │
│   │       (content.js)       │ <──────────────────────────────┐      │ (GET_CREDENTIALS│
│   └──────────────────────────┘      chrome.tabs.sendMessage() │      │  GET_FILL)      │
│                                       (FILL_FORM, FILL_OTP)   │      │                 │
│                                                               │      ▼                 │
│   ┌──────────────────────────┐             chrome.runtime.sendMessage()                │
│   │     EXTENSION POPUP      │ ──────────────────────────────────────┼─> ┌──────────┐  │
│   │   (popup.html / .js)     │ <──────────────────────────────┐      │   │          │  │
│   └──────────────────────────┘         Response Callbacks     │      │   │          │  │
│                                                               │      │   │          │  │
└───────────────────────────────────────────────────────────────┼──────┼───┤  BACK-  │──┘
                                                                │      │   │  GROUND  │
┌───────────────────────────────────────────────────────────────┼──────┼───┤ SERVICE  │──┐
│                            OPERATING SYSTEM BOUNDARY          │      │   │  WORKER  │  │
│                                                               │      │   │ (back-   │  │
│   ┌──────────────────────────┐   HTTP POST / JSON / CORS      │      │   │ ground.js)  │
│   │    LOCAL DAEMON SERVER   │ <──────────────────────────────┼──────┘   │          │  │
│   │    (local_server.py)     │ ───────────────────────────────┼────────> │          │  │
│   │    [127.0.0.1:27432]     │      Transient Header:         │          └────┬─────┘  │
│   └──────────────────────────┘      X-NL-Token Session        │               │        │
│                                                               │               │        │
│                                                               │               │        │
│   ┌──────────────────────────┐   Native Messaging Protocol    │               │        │
│   │   NATIVE MESSAGE HOST    │ <──────────────────────────────┘               │        │
│   │        (host.py)         │ ───────────────────────────────────────────────┘        │
│   │     (Stdio Pipes)        │     Length Prefixed Stdin/Stdout Stream                 │
│   └──────────────────────────┘                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Channel Descriptions and API Specifications

### A. WebAuthn Interceptor $\leftrightarrow$ Content Script (DOM Boundary Bridge)
*   **Context Isolation**: Content scripts run in an isolated execution environment, meaning they have access to the page's DOM but cannot access the window-level variables or object prototypes of the host webpage.
*   **Injection Mechanic**: `webauthn_interceptor.js` is injected directly into the "main world" of the host page by creating a `<script>` tag in the DOM. This allows it to wrap `navigator.credentials.create` and `navigator.credentials.get` to intercept passkey creation and unlock assertions.
*   **Data Serialization**: Since direct memory references cannot cross the context boundary, communication is handled via JSON serialized strings sent over `window.postMessage()`:
    *   **Binary Handling**: WebAuthn payloads rely heavily on `ArrayBuffer` objects (e.g. challenge bytes, signature hashes). The interceptor serializes these into **Base64URL** strings before transmission to prevent string encoding corruption, and the content script deserializes them back to byte arrays.

### B. Content Script $\leftrightarrow$ Background Service Worker
*   **Direction 1 (Content $\rightarrow$ Background)**:
    *   **Method**: `chrome.runtime.sendMessage(payload, callback)`
    *   **Types**: `GET_CREDENTIALS` (extracts matching accounts summary for the active domain), `GET_FILL` (requests decryption of the password for a selected record).
*   **Direction 2 (Background $\rightarrow$ Content)**:
    *   **Method**: `chrome.tabs.sendMessage(tabId, message)`
    *   **Types**: `FILL_FORM` (transfers decrypted plaintext username and password for DOM injection), `FILL_OTP` (transfers generated 6-digit TOTP token).

### C. Extension Popup $\leftrightarrow$ Background Service Worker
*   **Lifecycle**: The popup's execution context is transient; it is destroyed the instant the user clicks outside the popup window. Consequently, the popup cannot maintain a persistent socket connection or challenge handshake state with the Python server.
*   **Mechanism**: The popup delegates all data-sensitive tasks to the persistent background service worker using `chrome.runtime.sendMessage()`:
    *   **Queries**: The popup requests active vault searches (`SEARCH`), TOTP generations (`GET_TOTP`), clipboard copies (`COPY`), and entry creations (`SAVE_ENTRY`).
    *   **Sync**: The background script manages the handshake, stores the session token, and relays responses back to the popup's callback handlers.

### D. Background Service Worker $\leftrightarrow$ Native Message Host (`host.py`)
*   **Protocol**: WebExtension standard Native Messaging.
*   **Execution**: Chrome/Edge launches `host.py` as a child process using the system path configured in the registry.
*   **Communication**: Standard input (`stdin`) and standard output (`stdout`) pipes.
*   **Data Framing**: Every message is prefixed with a 4-byte native byte-order integer specifying the length of the following JSON string:
    ```text
    +-------------------------+-------------------------------+
    | Length Header (4 bytes) | JSON Payload String (N bytes) |
    +-------------------------+-------------------------------+
    ```
*   **Security Advantage**: Fully offline, immune to network snooping, and bypasses local firewall policies.

### E. Background Service Worker $\leftrightarrow$ Local Daemon Server (`local_server.py`)
*   **Protocol**: HTTP/1.1 REST over local loopback (`127.0.0.1:27432`).
*   **Authentication**: Enforced on all data endpoints via the `X-NL-Token` header.
*   **CORS Checks**: The local server validates the `Origin` header of the HTTP request to ensure it matches the unique Chrome/Edge extension identifier, rejecting requests from standard websites.

---

## See Also
- [System Overview Diagram](system-overview.md)
- [Autofill Flow Diagram](autofill-flow.md)
- [Vault Encryption Diagram](vault-encryption.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*