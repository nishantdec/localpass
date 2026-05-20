[Home](README.md) •
[Docs Index](docs/index.md) •
[Quick Start](QUICKSTART.md) •
[Glossary](docs/reference/glossary.md)

---

# Project Release Ledger: `docs/CHANGELOG.md`

All notable changes to the **localpass** password manager are documented in this ledger. This project adheres to **Semantic Versioning** (`MAJOR.MINOR.PATCH`).

---

## [3.0.0] - 2026-05-19

This major release introduces browser passkey credentials, native host IPC structures, and envelope signing to enhance security.

### 🚀 Added
*   **WebAuthn / FIDO2 Passkeys:** Added the `PasskeyEntry` schema, enabling support for standard authentication transports, AAGUID identifiers, signature counters, and PEM private key storage.
*   **Cryptographic Envelope Signatures:** Implemented a SHA-256 HMAC payload signature in the outer JSON wrapper to detect and prevent unauthorized manual vault tampering.
*   **Stable Vault Identifiers:** Added stable `vault_id` UUIDs inside payloads to maintain consistent vault tracking across multiple writes.
*   **Native Messaging Bridge:** Created a background WebExtension native messaging bridge (`localpass_host.exe`) that operates via secure STDIO pipes, eliminating the need to expose local ports.

### 🔒 Changed
*   **Phishing Prevention Heuristics:** Upgraded frontend domain trust calculations to use `tldextract` for registered domains (eTLD+1), preventing phishing attacks that exploit public suffixes (such as `github.io`).
*   **Dependency Injection Refactoring:** Decoupled `VaultAdapter` and server components from global application singletons, making the codebase easier to test.
*   **Enhanced Challenge Handshake:** The fallback localhost HTTP handshake now requires a challenge nonce with HMAC verification, preventing unauthenticated token extraction.

---

## [2.0.0] - 2025-10-12

This release migrates the underlying vault format from legacy binary targets to structured JSON, improving extensibility.

### 🚀 Added
*   **Structured JSON Envelope:** Migrated vault persistence from legacy binary files (`NLLK`) to human-readable, cryptographically protected JSON envelope files containing clear salt, rounds, and ciphertext properties.
*   **Rotational Backups:** Implemented automatic rotation of the last 5 encrypted vault backups on every save to prevent data loss during compile steps.
*   **Configuration Profiles:** Added config profiles in `config.json` to allow developers to customize lockout timers, preferred TUI color palettes, and default generator profiles.

### 🔒 Changed
*   **Key Derivation Upgrades:** Shifted from standard PBKDF2 key derivation to Argon2id key derivation using customizable memory and time parameters to resist GPU-based brute-force attacks.

---

## [1.0.0] - 2024-04-05

This is the initial release of localpass.

### 🚀 Added
*   **Terminal User Interface Dashboard:** Built a terminal dashboard using `prompt_toolkit`, featuring a keyboard-driven layout, search indexes, and clear, formatted lists.
*   **Core Vault Encryption:** Implemented secure AES-256-GCM block encryption, ensuring all fields (passwords, usernames, URLs, and notes) are encrypted.
*   **TOTP Verification Engine:** Created a local verification generator to compute 6-digit TOTP codes on the fly.
*   **Secure Clipboard Manager:** Added clipboard synchronization that automatically clears copied credentials after 30 seconds to prevent shoulder surfing.

---

## See Also
- [Architecture Overview](docs/architecture/overview.md)
- [Debugging](docs/guides/debugging.md)
- [Glossary](docs/reference/glossary.md)

---
*[Back to Docs Index](docs/index.md) •
[Back to Top](#)*