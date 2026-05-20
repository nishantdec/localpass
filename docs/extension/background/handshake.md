[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Extension Session Handshake Management (`handshake.md`)

## 1. Overview
To establish trust between the sandboxed browser extension and the local localpass desktop application, a secure **Session Handshake Protocol** is executed. The handshake issues a cryptographically secure, time-bound session token that enables authorized API requests.

The handshake logic supports both the **Native Messaging** transport and the fallback **Localhost HTTP** transport, adopting strict cryptographic challenge-response constraints for the network-exposed HTTP fallback.

---

## 2. Handshake Protocol Flows

### Flow A: Native Messaging Handshake (Implicit Trust)
Since Chrome Native Messaging is local-only, stdio-piped, and immune to remote intercept, the browser extension trusts the Native Messaging Host implicitly.

```
[ Browser Extension ]                         [ Native Host (host.py) ]
          │                                              │
          │ ─── 1. Send: {type: "HANDSHAKE"} ──────────► │
          │                                              │
          │ ◄─── 2. Resp: {ok: true, token: "..."} ──────│ (TUI imports Session.issue_token)
          │                                              │
```

---

### Flow B: Fallback Localhost HTTP Handshake (Zero-Trust Challenge-Response)
To defend against Cross-Site Request Forgery (CSRF) or DNS rebinding over local network loops, the HTTP handshake operates under a zero-trust challenge-response model. The extension will not trust or cache the issued token unless the localhost server proves knowledge of the shared session key by returning a valid HMAC response.

```
[ Browser Extension ]                         [ Localhost HTTP Server ]
          │                                              │
          │ ─── 1. Generate: 32-Byte Secure Nonce ─────► │
          │      Send: POST /handshake                   │
          │      {"challenge": "32-byte-hex-nonce"}      │
          │                                              │
          │                                       Computes HMAC:
          │                                       HMAC-SHA256(token, nonce)
          │                                              │
          │ ◄─── 2. Resp: {"token": "...",               │
          │                "response": "computed-hmac"}  │
          │                                              │
          │ Verify Response HMAC!                        │
          ▼ (Trust established)                          │
```

---

## 3. Core Function Reference

### `nativeHandshake()`
Requests a fresh session token from the native host.
* **Signature:** `async function nativeHandshake()`
* **Parameters:** None.
* **Returns:** `Promise<string | null>` (The session token string on success, `null` if the vault is locked).
* **Called By:**
  - `background.js` -> `nativeCall()`
* **Calls:**
  - `nativeSend()`
* **Working Example:**
  ```javascript
  const token = await nativeHandshake();
  if (token) {
    console.log("Authorized Native Session:", token);
  }
  ```

---

### `httpHandshake()`
Initiates a secure, challenge-response authenticated handshake over local loopback HTTP.
* **Signature:** `async function httpHandshake()`
* **Parameters:** None.
* **Returns:** `Promise<string | null>` (The session token string on success, `null` if verification fails or connection times out).
* **Called By:**
  - `background.js` -> `httpCall()`
* **Calls:**
  - `randomHex()`
  - `fetch()`
* **Working Example:**
  ```javascript
  const token = await httpHandshake();
  if (token) {
    console.log("Authorized Secure HTTP Session:", token);
  }
  ```

---

### `randomHex()`
Generates a cryptographically secure random hexadecimal string utilizing browser Web Crypto APIs.
* **Signature:** `function randomHex(bytes)`
* **Parameters:**
  - `bytes` (`number`): The quantity of random bytes to generate.
* **Returns:** `string` (Hexadecimal representation, twice the length of `bytes`).
* **Called By:**
  - `background.js` -> `httpHandshake()`
* **Calls:**
  - `crypto.getRandomValues()`
* **Working Example:**
  ```javascript
  const nonce = randomHex(32);
  console.log(nonce); // Output: "d4e21a6f...f088" (64 character string)
  ```

---

## 4. Token Invalidation and Automatic Retry
The extension background script monitors token authorization states proactively. If an API request encounters an expired token or receives an unauthorized error, it attempts a transparent token refresh:

```
                  [ Extension Request Sent ]
                              │
                    Does API Return 401 /
                    "unauthorized"?
                              │
               ┌──────────────┴──────────────┐
               ▼ Yes                         ▼ No
      [ Clear Token Cache ]           [ Process Data ]
               │
      [ Trigger Handshake ]
               │
    Re-attempt Original Call
```
* **Native Invalidation:** If `nativeCall()` receives `{ error: "unauthorized" }`, it sets `_token = null` and automatically triggers a new `nativeHandshake()` execution before retrying.
* **HTTP Invalidation:** If `httpCall()` catches an HTTP Status Code `401`, it invalidates the current cached token, performs an `httpHandshake()`, sets the new token header, and retries the HTTP route exactly once.

---

## See Also
- [Extension Overview](../overview.md)
- [Background](background.md)
- [Server Client](server.md)
- [Message Passing Api](../../api/message-passing-api.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*