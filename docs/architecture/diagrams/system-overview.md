[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# localpass Complete System Architecture

This document details the architectural layout, security boundaries, component interactions, and data flow pathways of localpass.

## System Topology Diagram

The diagram below represents the complete system boundary, runtime execution contexts, and inter-process communication (IPC) interfaces on the host operating system.

```text
localpass - COMPLETE SYSTEM ARCHITECTURE
┌─────────────────────────────────────────────────────────────┐
│                       USER'S WINDOWS PC                      │
│                                                             │
│  ┌────────────────────────────┐                             │
│  │   localpass PYTHON APP   │                             │
│  │   (Windows Terminal / PS7) │                             │
│  │                            │                             │
│  │  main.py                   │                             │
│  │    └─ ui/app.py            │                             │
│  │         ├─ screens/        │                             │
│  │         │   ├─ unlock.py   │                             │
│  │         │   ├─ dashboard   │                             │
│  │         │   ├─ search      │                             │
│  │         │   ├─ entry_new   │                             │
│  │         │   ├─ entry_edit  │                             │
│  │         │   ├─ entry_view  │                             │
│  │         │   ├─ generator   │                             │
│  │         │   └─ settings    │                             │
│  │         └─ components/     │                             │
│  │                            │                             │
│  │  core/                     │                             │
│  │    ├─ auth.py  (Argon2id)  │                             │
│  │    ├─ vault.py (AES-GCM)   │                             │
│  │    ├─ entries.py           │                             │
│  │    ├─ totp.py  (pyotp)     │                             │
│  │    └─ generator.py         │                             │
│  │                            │                             │
│  │  server/local_server.py    │◄──── HTTP 127.0.0.1:27432  │
│  │  (daemon thread)           │                             │
│  └────────────────────────────┘                             │
│              │                          │                   │
│              │ reads/writes             │ HTTP localhost     │
│              ▼                          ▼                   │
│  ┌─────────────────────┐   ┌──────────────────────────┐    │
│  │  AppData/Roaming/   │   │  CHROME / EDGE BROWSER   │    │
│  │  localpass/       │   │                          │    │
│  │  ├─ vault.nlk       │   │  ┌────────────────────┐  │    │
│  │  │  (AES-256-GCM)   │   │  │  NL EXTENSION      │  │    │
│  │  └─ config.json     │   │  │                    │  │    │
│  └─────────────────────┘   │  │  background.js     │  │    │
│                             │  │  (service worker)  │  │    │
│                             │  │    ├─ handshake.js │  │    │
│                             │  │    ├─ server.js    │  │    │
│                             │  │    └─ handlers.js  │  │    │
│                             │  │                    │  │    │
│                             │  │  popup/            │  │    │
│                             │  │    ├─ popup.js     │  │    │
│                             │  │    └─ views/*.js   │  │    │
│                             │  │                    │  │    │
│                             │  │  content scripts   │  │    │
│                             │  │  (every webpage)   │  │    │
│                             │  │    ├─ injector.js  │  │    │
│                             │  │    ├─ dropdown.js  │  │    │
│                             │  │    ├─ filler.js    │  │    │
│                             │  │    └─ observer.js  │  │    │
│                             │  └────────────────────┘  │    │
│                             └──────────────────────────┘    │
│                                                             │
│  SECURITY BOUNDARY: Nothing leaves this box.               │
│  No internet calls. No telemetry. No cloud sync.           │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. localpass Python Application (TUI & Core Engine)
The core logic of localpass is written in Python 3.11+ and runs as a local console application using the `prompt_toolkit` library for terminal layout. It contains the following modules:
*   **main.py**: Initiates the TUI application, parses optional command-line flags, and kicks off the event loop.
*   **ui/app.py**: Governs the application lifecycle, holds state variables (such as active screens, vault handle, unlocked master key in memory), and handles global keybindings.
*   **ui/screens/**: Modular view panels rendered sequentially by push/pop on the screen stack:
    *   `unlock.py`: Validates Master Password, performs key derivation, and boots the local server.
    *   `dashboard.py`: Displays entries count, security health checks, and lists key shortcuts.
    *   `search.py`: Live search indexing against decrypted entry records.
    *   `entry_new.py` & `entry_edit.py`: Form capture validation interface for new/modified entries.
    *   `entry_view.py`: Displays credential details, decrypted passwords, and dynamic TOTP tokens.
    *   `generator.py`: Generates custom pseudorandom passwords based on character set filters.
    *   `settings.py`: Configures system autolock durations, backup destinations, and security options.
*   **core/auth.py**: Responsible for Master Password validation and key derivation utilizing memory-hard `Argon2id` hashing algorithms.
*   **core/vault.py**: Encapsulates all operations on the encrypted physical storage (`vault.nlk`). It implements high-entropy key generation and authenticated `AES-256-GCM` encryption/decryption of vault data blocks.
*   **core/entries.py**: Manages deserialization, updates, queries, deletions, and updates of the JSON structure containing accounts, logs, configuration options, and credential objects.
*   **core/totp.py**: Operates raw base32-secret parsing and generates RFC 6238 compliant 6-digit Time-based One-Time Passwords via `pyotp`.
*   **core/generator.py**: Generates high-entropy passwords with explicit bounds on uppercase, lowercase, numbers, and special symbol weights.
*   **server/local_server.py**: Spawns a background thread listening strictly on loopback interface `127.0.0.1:27432`. It handles incoming extension commands, processes CORS validation, performs session handshakes, and serves credential queries.

### 2. Physical File Storage System (AppData)
All state data is kept local to the user's hard drive inside `C:\Users\<Username>\AppData\Roaming\localpass\`:
*   `vault.nlk`: The active vault binary containing salt parameters, initialization vector nonces, and an AES-256-GCM encrypted block representing the user's credential entries.
*   `config.json`: Unencrypted metadata containing application configuration fields (e.g. system autolock durations, last-run directory, backup toggle flags).

### 3. Browser Extension Components
The extension acts as the bridge between the browser DOM page layout and the local Python service daemon.
*   **background.js (Service Worker)**: Maintains state, handles incoming API routing messages, conducts the primary secure cryptographic handshake with the Python local server, and issues requests to endpoints.
    *   `handshake.js`: Conducts secure handshake to retrieve and keep session token validation.
    *   `server.js`: Handles API wrapper calls using fetch methods targeting loopback server interfaces.
    *   `handlers.js`: Decodes and processes runtime extension message signals (`chrome.runtime.sendMessage`).
*   **popup/ (Popup Context)**: The dropdown HTML and JS script bundle executed when clicking the extension icon. It requests domain matching credentials via message channels and renders matching targets.
*   **Content Scripts**: Modular Javascript modules injected directly into every open webpage:
    *   `injector.js`: Identifies username and password inputs, injects the inline cyan `NL Button` next to targeted fields.
    *   `dropdown.js`: Controls rendering of the inline credential suggestion interface.
    *   `filler.js`: Bypasses React and SPA framework state bindings using prototype setters to safely drop values.
    *   `observer.js`: Leverages `MutationObserver` APIs to track DOM adjustments and re-inject buttons when forms dynamically change.

---

## Inter-Process Communication (IPC) & Security Boundaries

1. **Terminal TUI -> AppData Storage**: Reads/writes binary packets containing active keys and vault records. High-entropy key derivation happens completely offline inside Python heap structures.
2. **Extension Service Worker -> Python Local Server**: Communication happens over HTTP REST requests to `127.0.0.1:27432`. All requests targeting data-sensitive APIs require the inclusion of a cryptographically random 32-byte hexadecimal session token (`X-NL-Token`) in request headers, which is exchanged during extension launch.
3. **Loopback Only Isolation**: The server strictly binds to the loopback interface IP `127.0.0.1`. Attempts to bind to wide interface scopes (like `0.0.0.0`) are actively blocked, shielding the interface from network exposure even on public/shared Wi-Fi.
4. **Zero Knowledge Local Cloud Isolation**: No data telemetry, analytics, or backup synchronization calls are ever established outside the user's physical machine boundary. All credentials remain completely local, encrypted using `Argon2id` + `AES-256-GCM` cryptographic architectures.

---

## See Also
- [Autofill Flow Diagram](autofill-flow.md)
- [Vault Encryption Diagram](vault-encryption.md)
- [Extension Communication Diagram](extension-communication.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*