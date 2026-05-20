[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Developer Blueprint: Replicating the localpass System

This guide is an exhaustive, production-grade, self-contained engineering specification. It is designed to enable a junior developer or a basic 1-billion parameter language model to completely replicate, extend, or rewrite the localpass password manager from scratch in any language without referencing the original source code.

---

## 1. System Decomposition & Topology

localpass is composed of three decoupled core layers:
1. **The Python Backend & Cryptography Core:** Keyboard-driven Terminal User Interface (TUI) built on `prompt_toolkit`, local secure file vault administration, and session management.
2. **The Local Loopback Server & Native Messaging Host:** Communication bridges. Serves as a secure local HTTP REST server (`127.0.0.1:27432`) and a Native Messaging standard I/O pipe host registered with the OS.
3. **The WebExtension (Manifest V3):** Injects lock icon buttons into web input forms, hooks standard browser WebAuthn API calls to intercept and sign passkey requests, and coordinates autofills.

### 1.1 Process Architecture Diagram
```
                  +----------------------------------------------+
                  |               BROWSER SANDBOX                |
                  |                                              |
                  |  +-------------+       +------------------+  |
                  |  |  Popup UI   |       |  Content Script  |  |
                  |  |  (popup.js) |       |   (content.js)   |  |
                  |  +-------------+       +------------------+  |
                  |         ^                       ^            |
                  |         | chrome.runtime        | DOM        |
                  |         v                       v            |
                  |  +----------------------------------------+  |
                  |  |    Background Service Worker (SW)      |  |
                  |  |           (background.js)              |  |
                  |  +----------------------------------------+  |
                  +--------------------|-------------------------+
                                       |
                     Native Messaging  |  Local Loopback
                     (Stdio Pipes)     |  HTTP REST (fallback)
                                       v
                  +----------------------------------------------+
                  |               OPERATING SYSTEM               |
                  |                                              |
                  |       +------------------------------+       |
                  |       |     Native Message Host      |       |
                  |       |          (host.py)           |       |
                  |       +------------------------------+       |
                  |                      ^                       |
                  |                      | Stdio Pipes           |
                  |                      v                       |
                  |       +------------------------------+       |
                  |       |      Local HTTP Server       |       |
                  |       |      (local_server.py)       |       |
                  |       +------------------------------+       |
                  |                      ^                       |
                  |                      | Python Runtime        |
                  |                      v                       |
                  |       +------------------------------+       |
                  |       |      Core Cryptography       |       |
                  |       |     (vault.py / auth.py)     |       |
                  |       +------------------------------+       |
                  +----------------------------------------------+
```

### 1.2 Communication Channels
*   **Standard I/O Pipes (Native Messaging):** Preferred channel. Fully isolated, immune to DNS rebinding or network attacks. Messages are prefixed with a 4-byte native byte-order integer length header.
*   **Local HTTP REST API:** Legacy/Fallback channel. Binds to `127.0.0.1:27432`. Requires a transient `session_token` header (`X-NL-Token`) obtained via a secure cryptographic challenge-response handshake to prevent DNS rebinding or unauthorized website access.

---

## 2. Vault Storage & Cryptography Specification

### 2.1 The Cryptographic Envelope (JSON V3 Schema)
The vault file is saved as a single JSON file. It uses an authenticated encryption envelope pattern:
```json
{
  "schema_version": 1,
  "vault_id": "8a329d20-b472-4e89-a292-10cfbe9a4921",
  "version": 3,
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "kdf_params": {
    "time_cost": 3,
    "memory_cost": 65536,
    "parallelism": 2,
    "hash_len": 32
  },
  "device_id": "f83a45c0-1123-49d9-bb99-31294819ca11",
  "created_at": "2026-05-20T11:07:38Z",
  "updated_at": "2026-05-20T11:07:38Z",
  "nonce": "12-byte-base64-nonce==",
  "salt": "16-byte-base64-salt==",
  "payload_hash": "64-char-hex-hmac-sha256-signature",
  "payload": "base64-encoded-encrypted-ciphertext=="
}
```

### 2.2 Key Derivation Pipeline (Argon2id)
1.  **Inputs:** Master Password (`string`), Salt (`16 bytes`, generated via `os.urandom()`).
2.  **KDF Formula:**
    $$\text{derived\_key} = \text{Argon2id}(\text{password}, \text{salt}, \text{time\_cost}=3, \text{memory\_cost}=65536, \text{parallelism}=2, \text{hash\_len}=32)$$
3.  The derived 32-byte key is stored in memory inside a `SecureBuffer` context manager.

### 2.3 Secure Memory Zeroing & SecureBuffer
To prevent sensitive keys/passwords from persisting in the memory heap (subject to swap files or cold-boot dumps):
1.  **Zero-out Utility:** Directly overwrite the byte array in memory using Python's `ctypes` library to bypass Python's immutable/garbage collection behavior:
    ```python
    import ctypes
    def zero_bytes(buf: bytearray) -> None:
        if not buf:
            return
        # Locate internal address of bytearray buffer and overwrite with zeros
        ctypes.memset(ctypes.c_void_p.from_buffer(buf), 0, len(buf))
    ```
2.  **SecureBuffer Implementation:**
    ```python
    class SecureBuffer:
        def __init__(self, data: bytes):
            self.buf = bytearray(data)
        def __enter__(self) -> bytearray:
            return self.buf
        def __exit__(self, exc_type, exc_val, exc_tb):
            zero_bytes(self.buf)
    ```

### 2.4 Envelope Encryption & Decryption (AES-256-GCM)
*   **Encryption Process:**
    1.  Generate a secure random 12-byte initialization vector (`nonce`) via a CSPRNG (`os.urandom(12)`).
    2.  Serialize the vault payload (JSON list of login records, card records, identity records, note records, passkeys) to UTF-8 bytes.
    3.  Encrypt the plaintext bytes using AES-256-GCM. This yields: `ciphertext` + `16-byte GCM authentication tag`.
    4.  Concatenate `ciphertext` and `tag` into a single binary block: `ciphertext_block = ciphertext + tag`.
    5.  Compute the payload integrity signature:
        $$\text{payload\_hash} = \text{HMAC-SHA256}(\text{key}=\text{derived\_key}, \text{msg}=\text{ciphertext\_block})$$
    6.  Encode `nonce`, `salt`, and `ciphertext_block` to Base64 strings and write them into the JSON envelope.
*   **Decryption Process:**
    1.  Parse the JSON envelope. Extract Base64 fields and decode them to raw bytes.
    2.  Re-compute the HMAC-SHA256 over the retrieved `ciphertext_block` using the derived key.
    3.  Perform a constant-time comparison (`hmac.compare_digest`) between the computed hash and the envelope's `payload_hash` to detect data tampering before invoking the GCM decryption routine.
    4.  Decrypt the `ciphertext_block` using AES-256-GCM with the 12-byte `nonce`. If the GCM tag validation fails or tampering is detected, raise an integrity error.

---

## 3. Communication Protocols Specification

### 3.1 Native Messaging Transport
The WebExtension and local backend communicate via standard I/O pipes using Chrome's Native Messaging API:
1.  **Registry Integration:** A manifest JSON file (`com.localpass.host.json`) is registered in the OS Registry under `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.localpass.host`.
2.  **Standard I/O Serialization:** The browser spawns the native host script (`host.py`) as a background subprocess. All messages are exchanged via standard I/O stream pipes.
3.  **Data Framing:** Each message is prefixed with a 4-byte, native byte-order integer specifying the length of the following JSON string:
    $$\text{Message Frame} = [\text{4-byte length header}] + [\text{JSON string bytes}]$$
    ```python
    import sys
    import struct
    import json

    def read_message():
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            sys.exit(0)
        message_length = struct.unpack('@I', raw_length)[0]
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)

    def write_message(message_dict):
        content = json.dumps(message_dict).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('@I', len(content)))
        sys.stdout.buffer.write(content)
        sys.stdout.buffer.flush()
    ```

### 3.2 Challenge-Response Handshake Protocol
To authenticate the WebExtension against the local loopback server (`127.0.0.1:27432`) without exposing static master keys, a challenge-response handshake is executed on connection initialization:

```
Extension (background.js)                    Local Server (local_server.py)
       |                                                    |
       |----- 1. POST /handshake { challenge: "hex32" } --->|
       |                                                    |
       |                                                    |-- Derive handshake:
       |                                                    |   resp_sig = HMAC-SHA256(vault_key, "hex32")
       |                                                    |   Generate session token:
       |                                                    |   session_token = hex(urandom(32))
       |                                                    |
       |<---- 2. Returns { token, response: resp_sig } -----|
       |                                                    |
       |-- 3. Verifies response:                            |
       |   Computes local HMAC signature                    |
       |   If matches, registers session_token              |
       |                                                    |
```

1.  The extension generates a cryptographically secure 32-byte random challenge hex string (`challenge`).
2.  The extension posts the challenge to `/handshake`.
3.  The Python local server extracts the challenge, computes an HMAC-SHA256 signature using the derived `vault_key` as the key, and returns:
    $$\text{response\_signature} = \text{HMAC-SHA256}(\text{key}=\text{vault\_key}, \text{msg}=\text{challenge})$$
    Along with this signature, the server generates and returns a temporary `session_token` string.
4.  The extension computes the expected signature locally. If they match, the extension stores the `session_token` in memory.
5.  All subsequent HTTP requests must include the header `X-NL-Token: <session_token>`. The server verifies this token against its memory store on every call.

---

## 4. Complete Python Backend Architecture

The core python codebase manages the vault operations, TOTP key computations, biometric and passkey credentials.

### 4.1 Vault Module (`vault.py`)
Provides the database interfaces.
*   **Key Functions:**
    *   `load_vault(path: str, master_password: str) -> dict`: Reads, verifies HMAC, GCM-decrypts, and returns the list of vault records.
    *   `save_vault(path: str, key: bytes, payload: dict) -> None`: GCM-encrypts, HMAC-signs, and writes the updated envelope JSON to the path.
    *   `init_vault(path: str, master_password: str) -> None`: Creates a brand new vault envelope with random UUID and device ID, derived master key, and empty payload.
*   **Internal State:** Uses context manager `SecureBuffer` to wrap the key securely and wipe it when garbage collected.

### 4.2 Auth Module (`auth.py`)
Manages active sessions.
*   **SessionManager Class:**
    *   `set_key(key: bytes, unlock_method: str) -> None`: Stores the derived vault key inside a `SecureBuffer` and saves the current unlock method ('password' | 'biometric').
    *   `get_key() -> Optional[bytes]`: Retrieves the active key.
    *   `issue_token() -> str`: Generates a cryptographically strong session token.
    *   `validate_token(token: str) -> bool`: Checks token existence and validates expiration (8 hours).
    *   `lock(reason: str) -> None`: Zeros the vault key, invalidates the active session token, and fires any registered callbacks.

### 4.3 Entries Module (`entries.py`)
Defines the polymorphic database schemas for each vault item. Each entry has: `id` (UUIDv4), `type` ('login' | 'card' | 'identity' | 'note' | 'passkey' | 'ssh_key'), `title`, `folder_id` (optional), `favorite` (boolean), `archived` (boolean), `created_at`, `updated_at`, `usage_count`, `notes`.
*   **Item Fields:**
    *   `login`: `username`, `password`, `url`, `totp_secret`.
    *   `card`: `cardholder_name`, `brand`, `password` (used for credit card number), `cvv`, `expiry_month`, `expiry_year`, `pin`.
    *   `identity`: `first_name`, `last_name`, `username` (email), `password` (social security number/ID), `phone`, `address`, `company`.
    *   `note`: `notes` (large encrypted text).
    *   `passkey`: `rp_id` (relying party domain), `user_id` (base64url), `user_name`, `credential_id` (base64url), `private_key_pem` (PKCS#8 RSA/ECC).

### 4.4 Passkey Module (`passkey.py`)
Handles local WebAuthn keypair operations.
*   **Registration (`PASSKEY_REGISTER`):**
    *   Generates a cryptographically secure RSA-2048 private/public keypair.
    *   Saves the private key inside the vault as a `PEM` string under a newly created `passkey` entry.
    *   Constructs a standard CBOR/Base64URL `attestationObject` containing the public key in COSE format.
    *   Returns the `credential_id` (unique random identifier) and public key credential details.
*   **Authentication Signing (`PASSKEY_SIGN`):**
    *   Retrieves the stored PEM private key.
    *   Constructs `clientDataJSON` and `authenticatorData`.
    *   Signs the hash of these parameters using standard `RSASSA-PKCS1-v1_5` with SHA-256:
        $$\text{Signature} = \text{RSASSA-PKCS1-v1_5}(\text{private_key}, \text{clientDataJSON} + \text{authenticatorData})$$
    *   Returns the signature and authenticated assertion block back to the caller.

### 4.5 Domain Trust Module (`domain_trust.py`)
Analyzes credentials autofill origins to prevent phishing attacks.
*   **Domain Matching Rules:**
    *   Extracts the base domain (e.g. `google.com` from `accounts.google.com` and `mail.google.com`).
    *   Compares the requesting site origin with the saved `url` origin of the credential.
    *   Runs a Levenshtein distance check on domain strings to detect lookalike phishing websites (e.g. `g00gle.com` or `paypa1.com` vs `google.com` or `paypal.com`) and issues warning alerts in the popup.

### 4.6 Security Audit Module (`audit.py`)
Performs client-side vulnerability scans on vault contents.
*   **Vulnerability Detection:**
    *   **Weak Passwords:** Flags passwords with length < 10 characters or lacking uppercase, lowercase, numbers, or symbols.
    *   **Reused Passwords:** Computes hashes of all passwords and flags entries that share identical credential values.
    *   **Leaked Domains:** (Optionally) Queries secure local lists or k-Anonymity APIs (like HaveIBeenPwned) using SHA-1 prefixes to check if saved accounts are compromised.

---

## 5. WebExtension Service Worker & Content Script

### 5.1 Service Worker (`background.js`)
Manages background routing, connection states, and standard native standard I/O pipe fallback managers.
1.  **Unified Transport Call Interface:**
    ```javascript
    async function call(type, extra = {}) {
      if (_transport === 'detecting') await detectTransport();
      if (_transport === 'native') {
        const resp = await nativeCall(type, extra);
        if (resp && !resp.error) return resp;
        _transport = 'http'; // fallback
      }
      return await httpCall(type, extra);
    }
    ```
2.  **Sender Origin Validation:**
    ```javascript
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      // Validate sender to prevent malicious external web page messages
      if (!sender || sender.id !== chrome.runtime.id) {
        sendResponse(null);
        return false;
      }
      // Async dispatch logic
      handleMessage(msg, sendResponse);
      return true; // keep channel open
    });
    ```
3.  **Disable Browser Built-in Password Manager:**
    To avoid overlapping bubbles and UI conflicts:
    ```javascript
    chrome.privacy.services.passwordSavingEnabled.set({ value: false });
    ```

### 5.2 Heuristic Form Detector (`detector.js`)
Locates login forms, username, password, and OTP fields.
*   **Rules Checklist:**
    *   `findPasswordField()`: Finds the first visible `input[type="password"]` that has visible layout bounds (width & height > 0).
    *   `findUsernameField()`: Searches in priority order:
        1.  `input[type="email"]`
        2.  `input[type="text"][autocomplete*="username" i]`
        3.  `input[type="text"][autocomplete*="email" i]`
        4.  `input[type="text"][name*="user" i]`
        5.  `input[type="text"][id*="user" i]`
        6.  First visible `input[type="text"]` within the same form bounds.
    *   `findOTPField()`: Detects visible `input[autocomplete="one-time-code"]`, `input[inputmode="numeric"][maxlength="6"]`, or input IDs containing `otp`/`totp`.

### 5.3 Framework-Reactive Autofill Engine (`filler.js`)
Directly setting `element.value = "val"` fails on pages built with modern frameworks (React, Vue, Angular) because it bypasses virtual DOM state binding. To ensure compliance, the filler hooks the native prototype descriptor setters:
```javascript
function fillField(fieldElement, valueText) {
  if (!fieldElement) return;
  fieldElement.focus();
  
  // 1. Hook the native setter of the HTMLInputElement prototype
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  
  // 2. Call the native setter in the context of the target field
  nativeInputSetter.call(fieldElement, valueText);
  
  // 3. Dispatch standard DOM events to trigger the framework's internal reactive bindings
  fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
  fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
  fieldElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  fieldElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}
```

### 5.4 MutationObserver with Debounce
To inject inline buttons inside dynamic Single Page Applications (SPAs) where login forms are rendered asynchronously:
1.  Initialize a `MutationObserver` on `document.body` watching `childList` and `subtree` changes.
2.  If input elements are added to the DOM, trigger a debounced `400ms` call to `injectNLButtons()`:
    ```javascript
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectNLButtons, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ```
3.  `injectNLButtons()` places absolute floating icon buttons over the input fields. It positions them inside the right edge of input fields by reading `field.getBoundingClientRect()` and adding scroll/resize event repositioning listeners.

---

## 6. WebAuthn Passkey Interceptor (`webauthn_interceptor.js`)

To handle browser credentials registration and sign-in operations locally:
1.  **Page Injection:** The script `webauthn_interceptor.js` is injected into the page's `MAIN` execution world context using the extension manifest or dynamic injection APIs:
    ```json
    "content_scripts": [
      {
        "matches": ["<all_urls>"],
        "js": ["utils/detector.js", "utils/filler.js", "content.js"],
        "run_at": "document_start"
      }
    ]
    ```
    *Note:* The main interceptor is injected programmatically at the top of content script:
    ```javascript
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('utils/webauthn_interceptor.js');
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    ```
2.  **API Hooking:**
    ```javascript
    const originalCreate = window.navigator.credentials.create.bind(window.navigator.credentials);
    const originalGet = window.navigator.credentials.get.bind(window.navigator.credentials);

    window.navigator.credentials.create = function(options) {
      if (options && options.publicKey) {
        return handlePasskeyRegistration(options);
      }
      return originalCreate(options);
    };

    window.navigator.credentials.get = function(options) {
      if (options && options.publicKey) {
        return handlePasskeyAssertion(options);
      }
      return originalGet(options);
    };
    ```
3.  **Bidirectional ArrayBuffer-to-Base64URL Serialization:**
    ```javascript
    function arrayBufferToBase64URL(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    function base64URLToArrayBuffer(base64url) {
      let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
    ```
4.  **Credential Object Reconstruction:**
    Upon receiving the signing assertion from the Python backend through the background script (`popup/passkey_dialog.html`), reconstruct the standard FIDO2 `PublicKeyCredential` object:
    ```javascript
    const responseObj = Object.create(AuthenticatorAssertionResponse.prototype);
    Object.defineProperty(responseObj, 'clientDataJSON', { value: clientDataJSON_Buffer, enumerable: true });
    Object.defineProperty(responseObj, 'authenticatorData', { value: authenticatorData_Buffer, enumerable: true });
    Object.defineProperty(responseObj, 'signature', { value: signature_Buffer, enumerable: true });
    Object.defineProperty(responseObj, 'userHandle', { value: userHandle_Buffer, enumerable: true });

    const credentialObj = Object.create(PublicKeyCredential.prototype);
    Object.defineProperty(credentialObj, 'id', { value: res.credential_id, enumerable: true });
    Object.defineProperty(credentialObj, 'rawId', { value: rawId_Buffer, enumerable: true });
    Object.defineProperty(credentialObj, 'type', { value: "public-key", enumerable: true });
    Object.defineProperty(credentialObj, 'response', { value: responseObj, enumerable: true });
    ```

---

## 7. Popup Single Page Application & Beautiful UI System

The extension's user interface is a fast, offline-first dashboard running inside `popup.html`.

### 7.1 Aesthetic Specs
*   **Font Typography:** Uses Inter as the primary typeface for modern readability, fallback to system-ui.
*   **Theme Variables (Dark & Light Harmonies):**
    ```css
    :root {
      --bg-app: #13141a;
      --bg-card: #1c1e28;
      --text-primary: #ffffff;
      --text-muted: #858b9f;
      --border: #2a2c3a;
      --accent: #3b72e8;
      --danger: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --radius: 6px;
    }
    .light-theme {
      --bg-app: #f4f5f8;
      --bg-card: #ffffff;
      --text-primary: #12131a;
      --text-muted: #626575;
      --border: #e1e3eb;
      --accent: #3b72e8;
    }
    ```
*   **Transitions & Micro-animations:** Hover transitions (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`) and fade-in/slide-up keyframes (`@keyframes nlFadeIn`) are applied on cards, dropdown menus, and confirmation modals.

### 7.2 Single Page Application State & Router (`popup.js`)
*   **Routing Stack:** Tracks views inside `viewStack = ['entries']`.
*   **Navigation API:**
    *   `navigateTo(name: string, params: object)`: Cleanly invokes `_viewCleanup()` callbacks, empties the container, runs `viewRenderers[name](params)`, and pushes `name` onto `viewStack`.
    *   `navigateBack()`: Pops the active view and re-renders the previous stack entry.
*   **Global Variables:**
    *   `currentFolderFilter` ('all' | folder UUID)
    *   `currentTypeFilter` ('all' | 'login' | 'card' | 'identity' | 'note')
    *   `currentDomain` (active tab registered domain string)

### 7.3 Exhaustive Popup Views Reference

#### 1. The Entries View (Vault Dashboard)
*   **Layout Elements:** Header title, New Entry primary button, search bar wrap, type/folder filter selector pill tags, list container.
*   **Functional Mechanics:**
    *   Sends a `GET_CREDENTIALS` query to `background.js` with the active browser domain to retrieve matching domain entries.
    *   Lists matched domain suggestions at the top of the feed as high-priority cards.
    *   Lists remaining vault items under "All Entries", sorted alphabetically.
    *   Applies a real-time keypress filter on the search bar input.
    *   Implements Folder/Type dropdown selections to narrow down listings in real-time.
*   **Row Card Context Menus (Clicking vertical dot icon):**
    *   Triggers absolute-positioned dropdown row (`#nl-row-dropdown`) with actions: **Autofill** (submits message directly to content.js), **Favorite** (toggles preference binary value), **Edit** (navigates to Edit Form), **Clone** (creates duplicate entry with a '-copy' suffix), **Archive** (toggles visibility in active dashboard list), **Delete** (opens `#nl-delete-modal` confirmation).

#### 2. The Detail View (Vault Card Info)
*   **Layout Elements:** Full field sections (Title, Folder, Domain, Username/Card Number, Password, Notes, TOTP Code).
*   **Functional Mechanics:**
    *   Fetches dynamic OTP codes and maps them to a secure real-time visual progress wheel count indicator (counts down from 30s before rotating key value).
    *   Passes passwords behind a hidden character mask (`••••••••`) which toggles to raw string upon clicking an eye-icon button.
    *   Clicking adjacent clipboard icon buttons copies field values directly to clipboard without displaying sensitive strings.

#### 3. The Save & Edit View Form Layers
*   **Layout Elements:** Polymorphic inputs based on type selector value ('login' | 'card' | 'identity' | 'note').
*   **Fields Validation Matrix:**
    *   *Login:* Username (length > 0), Password (non-empty), Title (non-empty).
    *   *Card:* Cardholder name, Card Number (validated using Luhn/Mod10 formula), Expiry Month (1-12), Expiry Year (4 digits), CVV (3-4 digits).
*   **Mechanics:**
    *   Clicking **Save** verifies all required inputs, posts a `SAVE_ENTRY` message, triggers a loading spinner, displays a green success checkmark on success, and navigates back to the main entries view.

#### 4. The Password/Passphrase Generator View
*   **Layout Elements:** Slider for length bounds (8-64), checkboxes (uppercase, lowercase, digits, symbols), selection toggle (Password vs Passphrase), password strength indicator bar.
*   **Offline-First Generator (`generator.js`):**
    *   Uses secure cryptographically secure random values via the Web Crypto API (`crypto.getRandomValues`) and rejection sampling to avoid modulo bias during character selections.
    *   Features a standard Fisher-Yates shuffle engine to mix up derived strings before returning the generated password:
        ```javascript
        for (let i = result.length - 1; i > 0; i--) {
          const arr = new Uint32Array(1);
          crypto.getRandomValues(arr);
          const j = arr[0] % (i + 1);
          [result[i], result[j]] = [result[j], result[i]];
        }
        ```
    *   *Passphrase Sub-engine:* Selects words from a hardcoded 500-word secure dictionary array, formats capitalization, and appends a secure numeric digit at a randomized index position.

#### 5. The Settings View
*   **Layout Elements:** Settings list divided into sub-panels (Appearance, Autofill, Backup/Export, About).
*   **Sub-panels Specs:**
    *   *Appearance:* Toggle theme (Dark / Light themes, persisted via `chrome.storage.local`), choose popup width class (Compact: 360px, Default: 400px, Wider: 500px, Extra-Wide: 600px).
    *   *Autofill & Passkeys:* Check privacy control states, toggle "Make localpass Default Manager" which configures browser password privacy settings, toggle passkey hooks.
    *   *Backup & Export:* Encrypted backups module. Clicking Export downloads the raw JSON vault envelope to disk.

---

## 8. Step-by-Step System Replication Checklist

Follow this linear schedule to write a fully compatible, optimized duplicate (or a far superior variant) of localpass:

### Phase 1: Local Cryptography Module
- [ ] Write an Argon2id key derivation module that supports configurable cost parameters.
- [ ] Create an AES-256-GCM envelope encrypt/decrypt class that returns base64 strings.
- [ ] Write an HMAC-SHA256 integrity check utility to verify envelopes before decryption.
- [ ] Implement `SecureBuffer` and memory zeroing utilizing `ctypes` or language equivalents to scrub passwords/keys from RAM immediately after use.

### Phase 2: Host Daemon & IPC Pipes
- [ ] Create a background daemon process (in Python, Rust, Go, or Node).
- [ ] Implement standard I/O streams (`stdin` / `stdout`) structured messaging: read the 4-byte length prefix, parse the incoming JSON string, and output JSON payloads framed with the same 4-byte prefix.
- [ ] Set up registry records pointing to the daemon manifest so Google Chrome/Edge/Brave can locate and spawn it as an OS host.

### Phase 3: Loopback Server API (Fallback)
- [ ] Build a local HTTP REST server binding to `127.0.0.1:27432`.
- [ ] Implement a challenge-response handshake route (`POST /handshake`) that signs challenges using the derived vault key.
- [ ] Implement REST endpoints: `/ping`, `/credentials` (domain matching), `/fill`, `/totp`, and `/passkeys`. Keep route handlers state-independent.

### Phase 4: WebExtension Service Worker (`background.js`)
- [ ] Implement a Manifest V3 `background.js` worker.
- [ ] Create a connection manager that detects standard native standard I/O pipe transports and falls back to HTTP REST challenge-responses.
- [ ] Implement a whitelisted message router with strict extension-only origin validation (`sender.id === chrome.runtime.id`).

### Phase 5: content Script & Form Filler
- [ ] Write a content script that injects inline, themed action buttons inside detected username and password input fields.
- [ ] Set up a `MutationObserver` with a `400ms` debounce timer to monitor dynamic SPA element additions.
- [ ] Implement a reactive input filler that calls prototype descriptors and dispatches `input` and `change` events.

### Phase 6: WebAuthn Passkey Interceptor
- [ ] Create a script that hooks `window.navigator.credentials.create` and `window.navigator.credentials.get`.
- [ ] Implement bidirectional Base64URL-to-ArrayBuffer mapping.
- [ ] Build a passkey selection modal panel (`passkey_dialog.html`) that handles interactive registrations and signings.

### Phase 7: Single Page Application (SPA) Popup UI
- [ ] Write `popup.html`, `popup.css`, and `popup.js` containing the state variable model, custom themes, and SPA routing.
- [ ] Implement all functional views: Entries Dashboard (with matched domains on top), Detail View, Save/Edit dynamic forms, and settings.
- [ ] Add the password generator utilizing rejection sampling and Fisher-Yates shuffles.

---

## 9. Architecting a Superior Password Manager

To build a product far superior to localpass, implement the following architectural enhancements:

1.  **SQLCipher Database Storage:** Instead of loading/saving a single JSON envelope to disk on every single change (which is computationally expensive and prone to write-interrupt database corruption), use an encrypted SQLite database via **SQLCipher** for faster row-level writes, ACID compliance, and incremental updates.
2.  **WebAssembly-compiled Cryptography:** Compile native cryptographic libraries (like OpenSSL or libsodium) to **WebAssembly (WASM)**. Run this WASM binary inside the extension sandbox. This enables key derivation (Argon2id) and decryption to happen locally in the browser worker threads at native speeds even if the native host daemon is not installed, eliminating the need for unencrypted localhost HTTP REST API fallbacks.
3.  **End-to-End Zero-Knowledge Cloud Sync:** Implement secure end-to-end sync with cloud backends (like AWS S3, Dropbox, or WebDAV) using standard envelope architectures. The cloud server only sees encrypted, signed blobs, preserving zero-knowledge security guarantees.
4.  **Local Biometric Integrations (Windows Hello / Touch ID):** Utilize native OS APIs to execute TouchID/Windows Hello authentication directly within the browser (via FIDO2 WebAuthn keys) to unlock the master key without prompting the user to type long passwords on every browser session.

---

## See Also
- [Debugging](debugging.md)
- [Adding A New View](adding-a-new-view.md)
- [Adding A New Endpoint](adding-a-new-endpoint.md)
- [Building Exe](building-exe.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*