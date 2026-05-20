[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Background Service Worker (`background.js`)

## 1. Overview & Service Worker Lifecycle
The Background Service Worker (`background.js`) acts as the persistent orchestrator of the localpass extension. Under Chrome's Manifest V3 standard, the background page is replaced by a stateless **Service Worker** that does not run permanently in the background. Instead, it runs inside an isolated browser thread that wakes up on-demand to process events and suspends execution when idle.

### State & Lifecycle Sequence Diagram
```
    [ Extension Startup / Event Triggered ]
                     │
                     ▼
             (Wakes Up / Load JS)
                     │
                     ▼
          ┌──────────────────────┐
          │   detectTransport()  │
          └──────────┬───────────┘
                     │
         Determines Transport Mode
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   ['native']                 ['http']
(com.localpass.host)   (127.0.0.1:27432)
         │                       │
         └───────────┬───────────┘
                     │
           Ready to Route Messages
                     │
                     ▼
       (Processing Event Callback)
                     │
                     ▼
            (Goes Idle / Suspend)
```

---

## 2. In-Memory Transport State
To prevent credential theft, the service worker keeps all transport parameters in temporary local memory. Closing the browser or suspending the service worker completely clears these references.
*   **`_transport`** (`'detecting' | 'native' | 'http'`): Holds the active transport channel state.
*   **`_token`** (`string | null`): In-memory session key authorized for secure queries.
*   **`_tokenTs`** (`number`): Millisecond timestamp indicating when the current token was issued.
*   **`TOKEN_MAX_AGE_MS`** (`8 * 60 * 60 * 1000`): Absolute maximum lifetime threshold (8 hours) for issued tokens before forcing a handshake refresh.

---

## 3. Core Function Reference

### `detectTransport()`
Queries the host registry for the presence of the Chrome Native Messaging host. If it responds to a loopback query, the native transport is adopted. Otherwise, the extension falls back to localhost HTTP.
* **Signature:** `async function detectTransport()`
* **Parameters:** None.
* **Returns:** `Promise<void>`
* **Called By:**
  - `localpass-extension/background.js` -> `call()`
* **Calls:**
  - `nativeSend()`
* **Working Example:**
  ```javascript
  await detectTransport();
  console.log(_transport); // Output: 'native' (or 'http')
  ```

---

### `call()`
Unified high-level API wrapper that transparently routes requests to the active transport backend (Native Messaging vs. Localhost HTTP). If Native Messaging encounters an authorization error, it falls back to HTTP automatically.
* **Signature:** `async function call(type, extra = {})`
* **Parameters:**
  - `type` (`string`): The message category (e.g. `"GET_CREDENTIALS"`).
  - `extra` (`object`): Payload options mapped to database queries.
* **Returns:** `Promise<object | null>` (Response dictionary or null on failure).
* **Called By:**
  - `background.js` -> runtime message dispatcher
* **Calls:**
  - `nativeCall()`
  - `httpCall()`
  - `detectTransport()`
* **Working Example:**
  ```javascript
  const res = await call("GET_CREDENTIALS", { domain: "google.com" });
  if (res) {
    console.log(res.entries);
  }
  ```

---

### `dbg()`
Helper console logging utility toggled via a global `DEBUG` configuration variable.
* **Signature:** `function dbg(...a)`
* **Parameters:**
  - `...a` (`any[]`): Log messages to display in the extension inspect console.
* **Returns:** `void`
* **Working Example:**
  ```javascript
  dbg("Transport channel bound successfully");
  ```

---

## See Also
- [Extension Overview](../overview.md)
- [Handshake](handshake.md)
- [Server Client](server.md)
- [Message Passing Api](../../api/message-passing-api.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*