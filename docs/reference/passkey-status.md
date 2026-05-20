---
title: "Passkey Implementation & FIDO2 Status"
description: "Detailed technical specifications, byte-packing schemas, and current implementation status for FIDO2/WebAuthn passkeys."
related_docs:
  - "docs/architecture/overview.md"
  - "docs/api/message-passing-api.md"
  - "docs/python-app/core/passkey.md"
codebase_files:
  - "northlocker/core/passkey.py"
  - "northlocker-extension/utils/webauthn_interceptor.js"
ai_context:
  component: "Passkey Authenticator"
  boundary: "FIDO2 Compliance"
---

[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# WebAuthn Passkeys & FIDO2 Implementation Specs

This document defines the cryptographic parameters, byte-level schemas, and implementation status for FIDO2-compliant virtual passkeys inside the `localpass` ecosystem.

---

## 1. Current Implementation Status {#implementation-status}

`localpass` provides a software-based FIDO2 WebAuthn virtual authenticator. This allows users to store, manage, and sign WebAuthn assertions (passkeys) directly inside their encrypted vault, fully decoupled from specialized physical USB keys.

| Feature | Support Level | Implementation Notes |
| :--- | :--- | :--- |
| **Virtual Authenticator** | Full Support | Injected main-world interceptor hooks browser native credentials requests. |
| **Symmetric Key Algorithm** | ECDSA (P-256) | Relies on the cryptography library for Curve P-256 / SHA-256 signing. |
| **Credential Storage** | Vault Encrypted | Stored as `PasskeyEntry` schema types inside the `.nlk` envelope. |
| **CBOR Encoding** | Software Attestation | Standard COSE key structure format for relying parties. |
| **Replay Protection** | Sign Counters | Maintains Big-Endian 4-byte monotonic signature counters. |
| **Hardware Binding** | Planned (Roadmap) | Future binding to TPM (Windows Hello) or Secure Enclave (macOS). |

---

## 2. Main-World WebAuthn Interceptor (`webauthn_interceptor.js`) {#interceptor}

Because Chrome extension content scripts run in isolated execution environments (isolated worlds), they cannot hook standard DOM properties like `navigator.credentials.create` and `navigator.credentials.get`. 

To solve this, `localpass` dynamically injects an interceptor script directly into the **MAIN** world context:

```javascript
// interceptor code injection snippet
const script = document.createElement('script');
script.src = chrome.runtime.getURL('utils/webauthn_interceptor.js');
(document.head || document.documentElement).appendChild(script);
```

The interceptor replaces the browser's native WebAuthn handlers. When a webpage initiates a passkey query, the interceptor captures the challenge details, serializes binary ArrayBuffers to Base64URL strings, forwards the query to `content.js` via a standard `window.postMessage` bridge, and returns a reconstructed FIDO2 `PublicKeyCredential` object once signed.

---

## 3. Cryptographic Byte-Packing & CBOR Schemas {#byte-packing}

During the passkey registration phase (`navigator.credentials.create`), the Python service worker compiles a standard FIDO2 attestation structure. 

### Big-Endian Authenticator Data structure (`authData`):
The `authData` payload is a binary structure packed with exact byte limits:
*   **Bytes 0-31**: Relying Party Identifier Hash (`rpIdHash`) — SHA-256 hash of the domain name (e.g. `github.com`).
*   **Byte 32**: User Flags — `0x01` (User Present - UP), `0x04` (User Verified - UV).
*   **Bytes 33-36**: Monotonic Sign Counter — 4-byte unsigned integer in Big-Endian representation.
*   **Bytes 37-52**: AAGUID — Authenticator Attestation Globally Unique Identifier (set to all zeroes).
*   **Bytes 53-54**: Credential ID Length (`L`) — 2-byte big-endian unsigned short.
*   **Bytes 55 to (55 + L)**: Unique Credential ID string.
*   **Remaining Bytes**: Public Key encoded in standard COSE CBOR format.

### COSE Public Key Format (P-256):
The ECDSA public key is mapped as a standard CBOR dictionary with these keys:
*   **`1`**: Key Type (Set to `2` for Elliptic Curve Key type).
*   **`3`**: Signature Algorithm (Set to `-7` for ECDSA with SHA-256).
*   **`-1`**: Elliptic Curve (Set to `1` for NIST curve P-256).
*   **`-2`**: X Coordinate (32-byte binary string representing the Elliptic Curve X coordinate).
*   **`-3`**: Y Coordinate (32-byte binary string representing the Elliptic Curve Y coordinate).

---

## 4. Passkey Validation and Assertions {#passkey-assertions}

When logging in with an existing passkey (`navigator.credentials.get`), the Python backend loads the stored private key from the vault, signs the challenge, and increments the signature counter to prevent replay attacks:

$$\text{Counter}_{t} = \text{Counter}_{t-1} + 1$$

The resulting assertion signature is built by hashing the challenge and concatenating it with the authenticator data, then signing the complete sequence using ECDSA.

---

## 5. Technical Roadmap {#passkey-roadmap}

*   **TPM Binding (v3.5)**: Integrate Windows Hello TPM key storage via PyWinRT APIs. This will make the passkey private key physically hardware-bound to the user's specific laptop.
*   **Syncable Key Exporters**: Safe backup exports mapping FIDO2 keys using client-side derived GCM envelopes.
*   **Hybrid Bluetooth Transport**: Enable using localpass passkeys to sign logins on nearby mobile devices via Bluetooth Low Energy (BLE) channels.

---

## See Also
*   [Core Passkey Service Documentation](../python-app/core/passkey.md)
*   [Message Passing Protocols](../api/message-passing-api.md)
*   [WebAuthn Interceptor Internals](https://github.com/nishantdec/localpass/blob/main/northlocker-extension/utils/webauthn_interceptor.js)
*   [Glossary Reference](../reference/glossary.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*
