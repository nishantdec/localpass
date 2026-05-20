---
title: "localpass Documentation"
description: "Master landing portal for the localpass password manager and authenticator developer documentation."
related_docs:
  - "README.md"
  - "QUICKSTART.md"
codebase_files: []
ai_context:
  component: "Documentation Gateway"
  boundary: "User Interface"
---

<!-- localpass Hero Banner -->
<div class="lp-hero-banner">
  <h1 class="lp-hero-title">localpass Documentation</h1>
  <p class="lp-hero-subtitle">
    The developer portal for localpass. A zero-knowledge, offline-first, phishing-resistant local password manager and WebExtension virtual passkey authenticator.
  </p>
  <a href="../QUICKSTART.md" class="md-button md-button--primary" style="margin-right: 10px;">Quick Start Guide</a>
  <a href="architecture/overview.md" class="md-button">Explore Architecture</a>
</div>

<!-- Modern Feature Grid -->
<div class="lp-grid">
  
  <div class="lp-card" onclick="window.location.href='architecture/security-model.md';">
    <div class="lp-card-icon">🛡️</div>
    <h3 class="lp-card-title">Zero Knowledge Security</h3>
    <p class="lp-card-desc">
      Explore our envelope cryptosystem leveraging Argon2id key derivation and AES-256-GCM authenticated encryption.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='reference/passkey-status.md';">
    <div class="lp-card-icon">🔑</div>
    <h3 class="lp-card-title">FIDO2 Virtual Passkeys</h3>
    <p class="lp-card-desc">
      Detailed specifications of our ECDSA P-256 CBOR byte-packing virtual authenticators and attestation structures.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='architecture/decisions.md';">
    <div class="lp-card-icon">🏗️</div>
    <h3 class="lp-card-title">Native Stdio IPC</h3>
    <p class="lp-card-desc">
      Read about our process boundaries, trust boundaries, and why we transitioned from TCP port sockets to standard I/O pipes.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='troubleshooting/mistakes-lessons.md';">
    <div class="lp-card-icon">📓</div>
    <h3 class="lp-card-title">Post-Mortem Logs</h3>
    <p class="lp-card-desc">
      Lessons learned from React state bypasses, ctypes memory scrubbing races, and MutationObserver infinite loops.
    </p>
  </div>

</div>

---

## Technical Portals Navigation

### System Architecture
| Section | Description |
|---|---|
| [System Overview](architecture/overview.md) | Full multi-layered system map and AppData locations |
| [Data Flow Architecture](architecture/data-flow.md) | Ingress/egress pipelines, schemas, and state loops |
| [Security Model](architecture/security-model.md) | Cryptographic security model and threat analysis |
| [Extension Internals](architecture/extension-architecture.md) | DOM scanner heuristics, MutationObservers, and element value set overrides |
| [Design Decisions & Flows](architecture/decisions.md) | Detailed process post-mortems and Mermaid flowcharts |

---

### Python Daemon Core
| Section | Description |
|---|---|
| [Auth & KDF](python-app/core/auth.md) | Master password KDF key-lifecycle and memory scrubbing |
| [Vault Adapter](python-app/core/adapter.md) | Stateless decoupling bridge separating endpoints from SQLite disk envelopes |
| [Audit Service](python-app/core/audit.md) | Thread-safe, tamper-evident transaction log hash-chaining |
| [Domain Engine](python-app/core/domain_trust.md) | Phishing-resistant Public Suffix List (PSL) trust calculations |
| [Schema Upgrades](python-app/core/migrations.md) | Schema version migration pipelines maintaining backward compatibility |
| [TOTP Engine](python-app/core/totp.md) | RFC 6238-compliant TOTP codes generation |

---

### Browser Extension WebExtension
| Section | Description |
|---|---|
| [Extension Overview](extension/overview.md) | Manifest V3 sandboxed environment layout |
| [Background Worker](extension/background/background.md) | Background lifecycle service worker loops |
| [Inline Autocomplete](extension/content/dropdown.md) | Webpage form overlays and framework value filling |
| [Popup SPA views](extension/popup/popup.md) | Single Page Application popup UI design tokens and views css |
| [Local Client Fetch Bridge](extension/utils/bridge.md) | Localhost fetch bridges, security parameters, and timeouts |

---

### API & Reference Directory
| Section | Description |
|---|---|
| [Local Server Routes](api/local-server-api.md) | Comprehensive catalog of HTTP challenge-response REST routes |
| [Chrome Messages](api/message-passing-api.md) | Runtime message structures and schemas |
| [Vault File Format](api/vault-file-format.md) | Plaintext JSON schema validation models |
| [Function Index](reference/function-index.md) | Exact signatures and return formats for core backend functions |
| [Contribute Onboarding](contributing/onboarding.md) | Quality gates, markdown linting, pre-commits, and convention guides |

---

*[Back to project root README](https://github.com/nishantdec/localpass/blob/main/README.md)*

---
*[Back to Top](#)*
