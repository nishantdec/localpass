[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Chrome Native Messaging Host (`host.py`)

## 1. Overview
The Native Messaging Host is a secure communication endpoint designed to run as a local background process launched by WebExtensions (specifically Chrome, Edge, and Brave). It implements the **Chrome Native Messaging Protocol** to allow direct, secure, bi-directional communication between the sandboxed browser extension and the local localpass desktop/TUI application.

Unlike localhost HTTP servers, native messaging does not open any TCP port. Communication is strictly routed through standard input (`stdin`) and standard output (`stdout`) pipes managed directly by the browser process. This provides strong immunity against DNS rebinding attacks, SSRF, local port scanning, and cross-site scripting (XSS) origin bypasses.

---

## 2. Chrome Native Messaging Protocol Spec
Communication consists of length-prefixed JSON messages.
- **Byte Ordering:** Little-Endian (LE)
- **Prefix:** A 4-byte unsigned 32-bit integer (`uint32`) representing the size of the JSON-serialized payload in bytes.
- **Payload:** A UTF-8 encoded JSON string of the exact length specified by the prefix.
- **Maximum Buffer Limit:** Implements a strict sanity cap of `1,048,576 bytes` (1MB) to prevent buffer overflow attacks.

### Wire Format Layout
```
+-----------------------------------+-----------------------------------+
|  Length Prefix (4 Bytes, LE uint) |       JSON Payload (UTF-8)        |
+-----------------------------------+-----------------------------------+
| 0x1A 0x00 0x00 0x00               | {"type":"PING"}                   |
+-----------------------------------+-----------------------------------+
```

---

## 3. Architecture & Data Flow
The native host establishes a loop that continuously reads length-prefixed messages from `sys.stdin.buffer`, processes them via a synchronous dispatch function, and writes length-prefixed responses back to `sys.stdout.buffer`.

### Data Flow Diagram
```
  [ Browser Extension ]
            │
      (Stdio Pipes)
            │
            ▼
┌──────────────────────────────────────┐
│        host.py (run loop)            │
│ ┌──────────────────────────────────┐ │
│ │          _read_message()         │ │
│ └─────────────────┬────────────────┘ │
│                   │ msg (dict)       │
│                   ▼                  │
│ ┌──────────────────────────────────┐ │
│ │             _dispatch()          │ │
│ │  ┌────────────────────────────┐  │ │
│ │  │      Session & Tokens      │  │ │
│ │  │      (Challenge/Verify)    │  │ │
│ │  └──────────────┬─────────────┘  │ │
│ │                 │ Validated      │ │
│ │                 ▼                │ │
│ │  ┌────────────────────────────┐  │ │
│ │  │        VaultAdapter        │  │ │
│ │  └──────────────┬─────────────┘  │ │
│ │                 │ Operation      │ │
│ │                 ▼                │ │
│ │  ┌────────────────────────────┐  │ │
│ │  │      JSON Data Return      │  │ │
│ │  └──────────────┬─────────────┘  │ │
│ └─────────────────┼────────────────┘ │
│                   │ resp (dict)      │
│                   ▼                  │
│ ┌──────────────────────────────────┐ │
│ │         _write_message()         │ │
│ └─────────────────┬────────────────┘ │
└───────────────────┼──────────────────┘
                    │
              (Stdio Pipes)
                    │
                    ▼
          [ Browser Extension ]
```

---

## 4. Host Session Security Model
The host process maintains local state utilizing the private singleton class `_HostState`. 

1. **Active Integration:** If launched within the desktop application context (e.g., spawned concurrently), it tries to import `app_instance` from `localpass.ui.app`.
2. **Session Sharing:** If the TUI has already unlocked the vault, the native host reads the memory references of the active `VaultAdapter` and security `session` dynamically, generating single-use cryptographically secure session tokens for the browser extension.
3. **Authorization Lifespan:** Once a browser handshake is verified, all standard requests require a matching dynamic token. A token is verified via `_state.validate_token(token)`.

---

## 5. Module Functions and Classes Reference

### `_read_message()`
Reads a single message from the stdin stream, validating length constraints and parsing the JSON payload.
* **Signature:** `def _read_message() -> Optional[dict]`
* **Parameters:** None.
* **Returns:** 
  - `dict` on successful read, parsing, and boundary checks.
  - `None` if data is incomplete, the stream closes, or the size exceeds the 1MB cap.
* **Called By:** 
  - `localpass/native_host/host.py` -> `run()`
* **Calls:**
  - `sys.stdin.buffer.read()`
  - `struct.unpack()`
  - `json.loads()`
* **Working Example:**
  ```python
  # Simulating reading from standard input
  import io, sys, struct, json
  sys.stdin = io.BytesIO(struct.pack("<I", 17) + b'{"type":"PING"}')
  msg = _read_message()
  print(msg) # Output: {'type': 'PING'}
  ```

---

### `_write_message()`
Writes a single dictionary payload to stdout, prefixing it with the 4-byte little-endian length descriptor and flushing the buffer.
* **Signature:** `def _write_message(data: dict) -> None`
* **Parameters:**
  - `data` (`dict`): The payload dictionary to write.
* **Returns:** `None`
* **Called By:** 
  - `localpass/native_host/host.py` -> `run()`
* **Calls:**
  - `json.dumps()`
  - `struct.pack()`
  - `sys.stdout.buffer.write()`
  - `sys.stdout.buffer.flush()`
* **Working Example:**
  ```python
  import sys
  data = {"ok": True, "locked": False}
  _write_message(data)
  # Standard output receives: \x1d\x00\x00\x00{"ok":true,"locked":false}
  ```

---

### Class `_HostState`
Maintains the vault adapter, session context, and authorized API tokens for the duration of the host runtime process.

#### Methods & Properties

##### `__init__()`
Initializes empty session variables.
* **Signature:** `def __init__(self)`
* **Parameters:** None.
* **Returns:** None.

##### `_ensure_loaded()`
Attempts to connect to an existing unlocked localpass vault session by linking to the running TUI `app_instance`.
* **Signature:** `def _ensure_loaded(self) -> bool`
* **Returns:** `True` if successfully bound to an active unlocked vault session, `False` otherwise.
* **Calls:**
  - `localpass.ui.app.app_instance`
  - `localpass.core.adapter.VaultAdapter`
  - `Session.issue_token()`

##### `locked`
Checks whether the vault is locked or missing an active adapter connection.
* **Signature:** `@property def locked(self) -> bool`
* **Returns:** `bool` (`True` if locked/unbound, `False` if unlocked).

##### `validate_token()`
Validates a session token issued by the core application session.
* **Signature:** `def validate_token(self, token: str) -> bool`
* **Parameters:**
  - `token` (`str`): The authentication token to validate.
* **Returns:** `bool` (`True` if authorized, `False` if invalid or expired).

##### `issue_token()`
Generates a new secure session token.
* **Signature:** `def issue_token(self) -> Optional[str]`
* **Returns:** `Optional[str]` (Active API token or `None` if vault locked).

---

### `_dispatch()`
Routes incoming JSON commands to their respective `VaultAdapter` actions and handles authentication verification.
* **Signature:** `def _dispatch(msg: dict) -> dict`
* **Parameters:**
  - `msg` (`dict`): The parsed request packet from the browser extension.
* **Returns:** `dict` (Response envelope JSON structure).
* **Called By:**
  - `localpass/native_host/host.py` -> `run()`
* **Calls:**
  - `_HostState.validate_token()`
  - `VaultAdapter.find_by_domain()`
  - `VaultAdapter.search()`
  - `VaultAdapter.get_entry()`
  - `VaultAdapter.generate_totp()`
  - `VaultAdapter.create_entry()`
  - `VaultAdapter.update_entry()`
  - `VaultAdapter.delete_entry()`
  - `VaultAdapter.increment_usage()`
  - `VaultAdapter.find_passkeys()`
  - `VaultAdapter.create_passkey()`
  - `VaultAdapter.sign_passkey()`
  - `VaultAdapter.copy_to_clipboard()`

---

### `run()`
Starts the infinite native messaging polling loop, pulling messages from stdin, running them through the dispatcher, and writing back responses.
* **Signature:** `def run() -> None`
* **Parameters:** None.
* **Returns:** `None` (Exits when stdin is closed).
* **Called By:** 
  - Core entry point: `python -m localpass.native_host.host`
* **Calls:**
  - `_read_message()`
  - `_dispatch()`
  - `_write_message()`

---

## 6. Supported Message Schemas (API Handlers)

### 1. `PING`
Verify host status. Does not require token.
* **Request:**
  ```json
  {
    "type": "PING",
    "id": 1
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "locked": false,
    "id": 1
  }
  ```

---

### 2. `HANDSHAKE`
Initiate authorization session and fetch token.
* **Request:**
  ```json
  {
    "type": "HANDSHAKE",
    "id": 2
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "token": "4a1b3c8f9d0e12345678abcdef",
    "id": 2
  }
  ```

---

### 3. `GET_CREDENTIALS`
Fetch credentials associated with a domain. Requires valid token.
* **Request:**
  ```json
  {
    "type": "GET_CREDENTIALS",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "domain": "google.com",
    "id": 3
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "entries": [
      {
        "id": "entry-uuid-8899-aabb",
        "title": "Google Login",
        "username": "north@gmail.com",
        "type": "login",
        "has_totp": true,
        "url": "https://accounts.google.com",
        "preferred": true,
        "last_used": 1716200000.0
      }
    ],
    "id": 3
  }
  ```

---

### 4. `GET_FILL`
Retrieve full credentials (including decrypted password) for dynamic form autofill.
* **Request:**
  ```json
  {
    "type": "GET_FILL",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "id": "entry-uuid-8899-aabb",
    "id_req": 4
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "username": "north@gmail.com",
    "password": "SuperSecurePassword123!",
    "id": 4
  }
  ```

---

### 5. `GET_TOTP`
Generates a current TOTP code for the specified entry.
* **Request:**
  ```json
  {
    "type": "GET_TOTP",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "id": "entry-uuid-8899-aabb",
    "id": 5
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "code": "489210",
    "seconds_remaining": 14,
    "id": 5
  }
  ```

---

### 6. `SAVE_ENTRY`
Creates a new login credential in the active vault.
* **Request:**
  ```json
  {
    "type": "SAVE_ENTRY",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "entry": {
      "title": "Github Profile",
      "username": "localpass-dev",
      "password": "SecurePassword998",
      "url": "https://github.com",
      "type": "login",
      "totp_secret": "JBSWY3DPEHPK3PXP"
    },
    "id": 6
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "id": "new-entry-uuid-1122",
    "id": 6
  }
  ```

---

### 7. `PASSKEY_REGISTER`
Registers a new passkey credential linked with dynamic WebAuthn calls.
* **Request:**
  ```json
  {
    "type": "PASSKEY_REGISTER",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "rp_id": "github.com",
    "rp_name": "GitHub Inc",
    "user_id_b64": "dXNlci1pZC1ub3J0aA==",
    "user_name": "north",
    "challenge_b64": "M2M4ZjlkMGUxMjM0NTY3OA==",
    "id": 7
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "credential": {
      "credential_id": "cred-id-b64-string",
      "public_key_cbor": "cbor-hex-string",
      "attestation_object": "attestation-hex-string",
      "authenticator_data": "auth-data-hex-string"
    },
    "id": 7
  }
  ```

---

### 8. `PASSKEY_SIGN`
Signs an assertion challenge for login verification.
* **Request:**
  ```json
  {
    "type": "PASSKEY_SIGN",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "rp_id": "github.com",
    "challenge_b64": "M2M4ZjlkMGUxMjM0NTY3OA==",
    "credential_ids": ["cred-id-b64-string"],
    "id": 8
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "assertion": {
      "credential_id": "cred-id-b64-string",
      "signature": "sig-hex-string",
      "authenticator_data": "auth-data-hex-string",
      "user_handle": "user-id-b64-string"
    },
    "id": 8
  }
  ```

---

### 9. `COPY`
Copies selected credential data to the desktop clipboard.
* **Request:**
  ```json
  {
    "type": "COPY",
    "token": "4a1b3c8f9d0e12345678abcdef",
    "id": "entry-uuid-8899-aabb",
    "field": "password",
    "id": 9
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "id": 9
  }
  ```

---

## See Also
- [Manifest Installer](manifest-installer.md)
- [Background](../../extension/background/background.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*