[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# System Architecture Overview

This document provides a comprehensive systems overview of localpass. It details the boundaries, decoupled processes, local-first storage designs, and component relationships that form the foundation of this secure password manager.

---

## 1. Process Separation and Structural Topology

localpass is designed as a secure, local-first system with decoupled components. It runs entirely within the user's local operating system environment and does not rely on external cloud interfaces.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTIVE BOUNDARY                     │
│                                                                        │
│  ┌───────────────────────────┐         ┌────────────────────────────┐  │
│  │   WINDOWS TERMINAL TUI    │         │      CHROME / EDGE         │  │
│  │     (prompt_toolkit)      │         │   (Manifest V3 Extension)  │  │
│  │  main.py -> ui/app.py     │         │   popup.js -> content.js   │  │
│  └─────────────┬─────────────┘         └─────────────┬──────────────┘  │
│                │                                     │                 │
└────────────────┼─────────────────────────────────────┼─────────────────┘
                 │                                     │
┌────────────────┼─────────────────────────────────────┼─────────────────┐
│                │ READ/WRITE                          │ HTTP API        │
│                ▼                                     ▼                 │
│  ┌───────────────────────────┐         ┌────────────────────────────┐  │
│  │   APPDATA SECURE FILES    │ <────── │    BACKGROUND DAEMON       │  │
│  │   (Roaming/localpass/)  │         │    (local_server.py)       │  │
│  │   - vault.nlk (AES-GCM)   │         │    [127.0.0.1:27432]       │  │
│  │   - config.json           │         └────────────────────────────┘  │
│  │   - audit.log             │                                         │
│  └───────────────────────────┘                                         │
│                                                                        │
│                       LOCAL OPERATING SYSTEM BOUNDARY                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decoupled Process Components

localpass divides its operations across three primary systems:

### A. The Core Interactive TUI Client
*   **Engine**: Built in Python 3.11+ using the `prompt_toolkit` asynchronous rendering engine.
*   **Execution**: Runs as a single process inside the Windows Console host, PowerShell 7, or Windows Terminal.
*   **Roles**:
    *   Generates cryptographic salts and derives primary master keys.
    *   Loads, decrypts, and updates the secure vault structure.
    *   Provides user forms to view, search, add, edit, and delete credentials.
    *   Wipes sensitive key materials from memory on autolock or exit.

### B. The Background Server Daemon
*   **Engine**: Multi-threaded Python HTTP/1.1 socket server.
*   **Execution**: Spawns as a background daemon thread managed by `app.py` when the TUI is successfully unlocked. It is terminated instantly when the TUI locks.
*   **Interface**: Listens on local loopback socket `127.0.0.1:27432`.
*   **Roles**:
*   Exposes secure endpoints to the browser extension (see [docs/api/local-server-api.md](../api/local-server-api.md)).
*   Performs domain matching and retrieves credentials safely.
*   Generates real-time 6-digit TOTP codes for autofill.

### C. The Browser Extension Sandbox
*   **Engine**: Chromium Manifest V3 WebExtension.
*   **Execution**: Runs in isolated contexts managed by the browser engine (Popup SPA UI, persistent background service worker, and webpage content scripts).
*   **Roles**:
*   Scans webpage inputs for email/password fields (see [docs/architecture/extension-architecture.md](extension-architecture.md)).
*   Injects visual suggestion dropdowns and autofills form inputs.
*   Intercepts browser WebAuthn API calls to enable passkey creation and sign authentication assertions locally.

---

## 3. Physical AppData Directory Structures

All persistent files are saved locally within the user's roaming application directory:
`C:\Users\<Username>\AppData\Roaming\localpass\`

The directory contains the following structural components:

```text
C:\Users\<Username>\AppData\Roaming\localpass\
 ├── vault.nlk           <-- Encrypted vault envelope database (AES-256-GCM)
 ├── config.json         <-- Plaintext user settings (Autolock, Theme, Clipboard clear)
 ├── device.id           <-- Stable, machine-local UUID used for backup metadata
 ├── audit.log           <-- Chronological audit history (Logins, Unlocks, Backups)
 └── backups/            <-- Directory containing timestamped encrypted vault copies
      ├── vault_20260520T110000Z.nlk
      └── vault_20260520T111500Z.nlk
```

### Storage Components and Formats
1.  **`vault.nlk`**: The main database file. It packages KDF parameters, random salts, initialization vectors, and the encrypted credential payload into an authenticated JSON envelope (see [docs/api/vault-file-format.md](../api/vault-file-format.md)).
2.  **`config.json`**: Plaintext settings for TUI styling, autolock, and clipboard clearing (see [docs/reference/config-reference.md](../reference/config-reference.md)).
3.  **`device.id`**: A stable, machine-local UUID generated on first run. It is used to associate backups with specific devices.
4.  **`audit.log`**: A chronological record of security-sensitive actions (e.g. unlocks, failed authentication attempts, backup creation). It does not store passwords or secrets.
5.  **`backups/`**: Stores timestamped copies of the encrypted vault database. If a backup is corrupted, historical copies can be recovered.

---

## 4. Key Cross-References & Navigation

To drill down into specific areas of the system architecture, refer to these dedicated technical resources:

*   **Autofill Sequence Flow**: [docs/architecture/diagrams/autofill-flow.md](diagrams/autofill-flow.md) - Details the messaging flow from webpage field focus events to DOM input value injection.
*   **Cryptographic Design**: [docs/architecture/security-model.md](security-model.md) - Details KDF Argon2id parameters, AES-GCM tags, and ctypes memory-zeroing strategies.
*   **Local HTTP API Reference**: [docs/api/local-server-api.md](../api/local-server-api.md) - Documents loopback server endpoints, request/response formats, and security policies.
*   **Browser WebExtension Internals**: [docs/architecture/extension-architecture.md](extension-architecture.md) - Explains DOM scans, MutationObservers, and prototype setters used to bypass React state bindings.

---

## See Also
- [Security Model](security-model.md)
- [Data Flow](data-flow.md)
- [Extension Architecture](extension-architecture.md)
- [System Overview Diagram](diagrams/system-overview.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*