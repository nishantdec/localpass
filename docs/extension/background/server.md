[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# HTTP Server Fallback Client Routing (`server.md`)

## 1. Overview & Fallback Strategy
If Chrome Native Messaging is unavailable (e.g., registry values are missing, or the wrapper scripts fail), the localpass browser extension transitions to an HTTP communication mode. It interacts with the local Python TUI application's integrated REST service running at `http://127.0.0.1:27432`.

To allow components (like `content.js` or `popup.js`) to remain transport-agnostic, the background worker routes native command definitions (such as `GET_CREDENTIALS` or `SEARCH`) directly to REST API endpoints using an internal routing matrix.

---

## 2. API Routing Matrix
The following table outlines how the background script maps high-level unified commands to specific HTTP REST routes:

| Unified Message Type | HTTP Method | REST Route | JSON Request Body Structure |
| :--- | :--- | :--- | :--- |
| `PING` | `GET` | `/ping` | None |
| `GET_CREDENTIALS` | `POST` | `/credentials` | `{"domain": "example.com"}` |
| `SEARCH` | `POST` | `/search` | `{"query": "search-string"}` |
| `GET_TOTP` | `POST` | `/totp` | `{"id": "entry-uuid"}` |
| `COPY` | `POST` | `/copy` | `{"id": "entry-uuid", "field": "password\|totp"}` |
| `SAVE_ENTRY` | `POST` | `/entries` | Full Entry Object: `{"title": "...", "username": "...", ...}` |
| `GET_FILL` | `POST` | `/fill` | `{"id": "entry-uuid"}` |
| `GET_ENTRY` | `POST` | `/entry` | `{"id": "entry-uuid"}` |
| `UPDATE_ENTRY` | `POST` | `/entries/update` | Full Entry Object including `"id"` |
| `DELETE_ENTRY` | `POST` | `/entries/delete` | `{"id": "entry-uuid"}` |
| `GET_PASSKEYS` | `POST` | `/passkeys` | `{"rp_id": "example.com"}` |
| `PASSKEY_REGISTER` | `POST` | `/passkeys/register` | Passkey Options Object (Challenge, RP, User ID) |
| `PASSKEY_SIGN` | `POST` | `/passkeys/sign` | Assertion Challenge + Credential ID List |
| `INCREMENT_USAGE` | `POST` | `/increment_usage` | `{"id": "entry-uuid"}` |

---

## 3. Connection & Header Specifications
Every outgoing fallback request is configured with strict security headers and timeout rules:

*   **`Content-Type` Header:** Must be `"application/json"`.
*   **`X-NL-Token` Header:** Contains the cryptographically verified session token issued during the challenge-response handshake.
*   **Connection Timeout:** Employs a `3000ms` (3 seconds) network timeout limit using `AbortSignal.timeout(3000)` to prevent the service worker thread from hanging indefinitely if the desktop client goes offline.

---

## 4. Technical Function Reference

### `httpCall()`
Sends a serialized JSON payload to a specified REST path, including session headers, and handles HTTP `401` authentication token retries.
* **Signature:** `async function httpCall(method, path, body = null)`
* **Parameters:**
  - `method` (`string`): The HTTP Verb (`"GET"` or `"POST"`).
  - `path` (`string`): The server-relative REST endpoint path (e.g. `"/credentials"`).
  - `body` (`object | null`): Serialized JSON request body (or null for GET commands).
* **Returns:** `Promise<object | null>` (Parsed JSON response body or `null` if the request fails or times out).
* **Called By:**
  - `background.js` -> `call()`
* **Calls:**
  - `httpHandshake()`
  - `fetch()`
* **Working Example:**
  ```javascript
  // Querying vault entries via fallback REST routes
  const data = await httpCall("POST", "/credentials", { domain: "github.com" });
  if (data) {
    console.log("Matching Entries:", data.entries);
  }
  ```

---

## 5. Security & CSRF Defense
Localhost network ports are open to queries from other local processes or malicious scripts running on local web pages. To secure this channel, the local REST server enforces:
1. **Strict CORS Verification:** Rejects any query whose `Origin` header does not match the extension's specific URI (`chrome-extension://<id>`).
2. **Mandatory Header Token Validation:** Every REST route (excluding `/ping` and `/handshake`) immediately drops requests that lack a valid, active session token in the `X-NL-Token` header.
3. **Challenge Proofing:** Tokens are issued only through the secure challenge-response handshake `/handshake` route.

---

## See Also
- [Extension Overview](../overview.md)
- [Background](background.md)
- [Handshake](handshake.md)
- [Message Passing Api](../../api/message-passing-api.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*