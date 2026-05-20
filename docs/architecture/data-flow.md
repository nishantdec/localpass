[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Data Flow Architecture and Lifecycle Specification

This document details the data-flow pathways, validation checks, and state transitions that govern credential ingress, egress, and session lifecycles within the localpass ecosystem.

---

## 1. Credential Ingress Flow (Saving and Encryption)

Ingress refers to creating or updating records via the TUI form or the local HTTP API (`POST /entries`).

```text
  [User Form / API Input]
             │
             ▼
  ┌────────────────────────────────────────────────────────┐
  │                   1. Schema Validation                 │
  │  - Maps input fields to LoginEntry or NoteEntry.       │
  │  - Validates constraints (Title length, URL syntax).   │
  │  - Automatically generates stable record UUID4.        │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │            2. Serialization & Normalization            │
  │  - Normalizes target URLs (extracts canonical domain).  │
  │  - Deserializes and packages model fields into dict.   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                 3. Memory Context Lock                 │
  │  - Retrives active AES key from SessionManager.        │
  │  - Serializes in-memory VaultPayload object to JSON.   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                 4. Symmetric Encryption                │
  │  - Generates unique, high-entropy 12-byte Nonce.       │
  │  - Encrypts JSON using AES-256-GCM (appends 16B tag).  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │             5. Packaging & Integrity Signature         │
  │  - Computes secondary HMAC-SHA256 of the ciphertext.   │
  │  - Assembles envelope with salt, nonce, and hash tags. │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │               6. Atomic Writing Protocol               │
  │  - Copies existing vault to timestamped backup path.   │
  │  - Writes new envelope to temporary file (.tmp).       │
  │  - Atomic replacement replaces old vault.nlk on disk.  │
  └────────────────────────────────────────────────────────┘
```

### Ingress Verification Pipeline
1.  **Field Validation**: Forms verify that the Title is not blank and that the URL (if provided) can be normalized.
2.  **Domain Normalization**: The `DomainTrustService` extracts the registered eTLD+1 domain (e.g. converting `https://sub.github.co.uk/login` to `github.co.uk`) to populate `canonical_domain` and `match_domains`.
3.  **Atomic Integrity Write**: The `_write_atomic` function guarantees that if a write is interrupted by a system crash or power outage, the original `vault.nlk` remains uncorrupted, and no half-written states persist.

---

## 2. Credential Egress Flow (Retrieval and Decryption)

Egress refers to retrieving, decrypting, and matching records to fill forms in the browser extension.

```text
  [Extension focusin event triggers GET_CREDENTIALS]
                          │
                          ▼
  ┌────────────────────────────────────────────────────────┐
  │             1. Phishing-Resistant Query                │
  │  - Extract request domain (e.g., "github.com").        │
  │  - Verify X-NL-Token headers against active session.   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                2. InMemory Decryption                  │
  │  - If vault is locked, returns 401.                    │
  │  - Queries cached payload inside the Python engine.   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │              3. Domain Matching Algorithm              │
  │  - Strict check: Matches request domain to canonical   │
  │    domain or entry URL.                                │
  │  - Fallback check: Checks if request domain matches the│
  │    entry's title if no strict match is found.          │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                 4. Redacted In-Transit Data            │
  │  - Returns matching entries array to background SW.    │
  │  - Plaintext passwords and TOTP secrets are excluded.  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  [User clicks "Fill" in popup -> Requests POST /fill]
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │              5. Decryption & Form Autofill             │
  │  - Decrypts password string for selected record only.  │
  │  - Relays plaintext to content script via secure tab   │
  │    messaging. Injected using native prototype setters. │
  └────────────────────────────────────────────────────────┘
```

### Egress Cryptographic Constraints
*   **Decoupled Fields**: The `/credentials` endpoint used by the popup and content script never returns plaintext passwords. It only returns metadata: titles, usernames, database record IDs, and a boolean indicating if a TOTP secret is configured.
*   **Isolated Decryption**: The `/fill` endpoint decrys and returns the password string for *only* the specific record selected by the user.

---

## 3. Session Lifecycle and State Transitions

localpass uses a finite state machine inside `SessionManager` and `localpassApp` to manage transitions between locked and unlocked states.

```text
              ┌──────────────────────────┐
              │      LOCKED STATE        │ <────────────────────────┐
              │  - Session Key = None    │                          │
              │  - Local Server = Stopped│                          │
              └─────────────┬────────────┘                          │
                            │                                       │
                    Correct Master Password                         │
                    Key derived via Argon2id                        │
                            │                                       │
                            ▼                                       │
              ┌──────────────────────────┐                          │
              │     UNLOCKED STATE       │                          │
              │  - Key cached in         │                          │
              │    SecureBuffer          │                          │
              │  - Local Server = Running│                          │
              └─────────────┬────────────┘                          │
                            │                                       │
                    Any Lock Trigger:                               │
                    - Inactivity Timer Expired                      │
                    - User pressed 'L' in TUI                       │
                    - System shutdown / exit                        │
                    - 5 continuous failed API requests              │
                            │                                       │
                            └───────────────────────────────────────┘
```

### State Cleaning Mechanisms
*   **Idle Lock Event**: The inactivity monitor in `app.py` periodically checks `time.monotonic() - last_activity`. If it exceeds the threshold, `lock_vault()` is triggered.
*   **Memory Sanitization**: During locking, `SessionManager` invokes `ctypes.memset` to immediately zero the key bytes.
*   **Token Invalidation**: The server session token is deleted, and the TCP listener port is closed immediately, blocking any further extension requests.

---

## See Also
- [Architecture Overview](overview.md)
- [Security Model](security-model.md)
- [Extension Architecture](extension-architecture.md)
- [System Overview Diagram](diagrams/system-overview.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*