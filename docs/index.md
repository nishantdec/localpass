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

<!-- localpass Redesigned Hero Banner -->
<div class="lp-hero-banner">
  <h1 class="lp-hero-title">localpass Developer Portal</h1>
  <p class="lp-hero-subtitle">
    Explore the internal architecture, zero-knowledge security protocols, virtual passkey authenticators, and WebExtension integration schemas of localpass.
  </p>
  <div class="lp-hero-actions">
    <a href="https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md" class="lp-btn lp-btn-primary">Quick Start Guide</a>
    <a href="architecture/overview.md" class="lp-btn lp-btn-secondary">Explore Architecture</a>
  </div>
</div>

## System Architecture Overview

The `localpass` system consists of a sandboxed WebExtension running inside the browser that communicates via **Native Messaging (Stdio IPC)** with a background Python daemon. The daemon manages a local SQLite file encrypted using an envelope cryptosystem.

```mermaid
flowchart LR
    subgraph Browser ["Web Browser Boundary (Untrusted)"]
        ext["WebExtension Content & Popup UI"]
    end

    subgraph OS ["Local OS Environment (Secure)"]
        daemon["Python IPC Daemon Core"]
        vault[("Encrypted SQLCipher Envelope")]
    end

    ext <-->|Stdio Stream (JSON)| daemon
    daemon <-->|Argon2id + AES-256-GCM| vault

    style ext fill:#121214,stroke:#27272a,stroke-width:1px
    style daemon fill:#121214,stroke:#27272a,stroke-width:1px
    style vault fill:#121214,stroke:#06b6d4,stroke-width:2px
```

---

## Core Technical Spheres

<div class="lp-grid">
  
  <div class="lp-card" onclick="window.location.href='architecture/security-model.md';">
    <div class="lp-card-icon">🛡️</div>
    <h3 class="lp-card-title">Zero-Knowledge Vault</h3>
    <p class="lp-card-desc">
      Argon2id key derivation, memory scrubbing routines, and AES-256-GCM authenticated encryption envelopes.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='reference/passkey-status.md';">
    <div class="lp-card-icon">🔑</div>
    <h3 class="lp-card-title">Virtual FIDO2 Passkeys</h3>
    <p class="lp-card-desc">
      ECDSA P-256 credential generation, CBOR byte-packing structures, and WebAuthn attestation models.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='architecture/decisions.md';">
    <div class="lp-card-icon">🏗️</div>
    <h3 class="lp-card-title">Native Stdio IPC</h3>
    <p class="lp-card-desc">
      Standard input/output communication protocols, process boundaries, and message frame limits.
    </p>
  </div>

  <div class="lp-card" onclick="window.location.href='contributing/onboarding.md';">
    <div class="lp-card-icon">💻</div>
    <h3 class="lp-card-title">Contributor Onboarding</h3>
    <p class="lp-card-desc">
      Development setup guidelines, pre-commit quality gates, markdown style rules, and commit standards.
    </p>
  </div>

</div>

---

## Technical Portals Navigation

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-top: 2rem;">

  <div>
    <h3>🏗️ System Architecture</h3>
    <p style="font-size: 0.8rem; color: var(--md-default-fg-color--light); margin-bottom: 1rem;">Core security models, data flows, and design decisions.</p>
    <ul style="padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.8;">
      <li><a href="architecture/overview.md">System Overview</a> — Multi-layered architecture map</li>
      <li><a href="architecture/data-flow.md">Data Flow Architecture</a> — Ingress/egress state loops</li>
      <li><a href="architecture/security-model.md">Security Model</a> — Cryptographic threat boundaries</li>
      <li><a href="architecture/extension-architecture.md">Extension Internals</a> — DOM scanner heuristics</li>
      <li><a href="architecture/decisions.md">Design Decisions & ADRs</a> — Stdio, SQLite, SQLCipher</li>
    </ul>
  </div>

  <div>
    <h3>🐍 Python Daemon Core</h3>
    <p style="font-size: 0.8rem; color: var(--md-default-fg-color--light); margin-bottom: 1rem;">Key lifecycle, database adaptors, and backend engines.</p>
    <ul style="padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.8;">
      <li><a href="python-app/core/auth.md">Auth & KDF</a> — Master password key derivation</li>
      <li><a href="python-app/core/adapter.md">Vault Adapter</a> — Database interfaces</li>
      <li><a href="python-app/core/audit.md">Audit Service</a> — Tamper-evident hash chaining</li>
      <li><a href="python-app/core/domain_trust.md">Domain Engine</a> — Public Suffix List calculations</li>
      <li><a href="python-app/core/migrations.md">Schema Upgrades</a> — SQLite migration loops</li>
      <li><a href="python-app/core/totp.md">TOTP Engine</a> — RFC 6238 token generator</li>
    </ul>
  </div>

  <div>
    <h3>🌐 Browser Extension</h3>
    <p style="font-size: 0.8rem; color: var(--md-default-fg-color--light); margin-bottom: 1rem;">Manifest V3 background scripting and DOM autocomplete overlays.</p>
    <ul style="padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.8;">
      <li><a href="extension/overview.md">Extension Overview</a> — Manifest V3 architecture</li>
      <li><a href="extension/background/background.md">Background Worker</a> — Service worker loops</li>
      <li><a href="extension/content/dropdown.md">Inline Autocomplete</a> — Webpage field overlays</li>
      <li><a href="extension/popup/popup.md">Popup SPA Views</a> — Popup HTML/CSS layout tokens</li>
      <li><a href="extension/utils/bridge.md">Local Fetch Bridge</a> — Fetch bridges and timeouts</li>
    </ul>
  </div>

  <div>
    <h3>📖 Reference & Reference Logs</h3>
    <p style="font-size: 0.8rem; color: var(--md-default-fg-color--light); margin-bottom: 1rem;">API schema validation models, CLI functions, and lessons learned.</p>
    <ul style="padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.8;">
      <li><a href="api/local-server-api.md">Local Server Routes</a> — REST API endpoint schemas</li>
      <li><a href="api/message-passing-api.md">Chrome Messages</a> — Extension message schemas</li>
      <li><a href="api/vault-file-format.md">Vault File Format</a> — Vault JSON validation schema</li>
      <li><a href="reference/function-index.md">Function Index</a> — Core Python API signatures</li>
      <li><a href="troubleshooting/mistakes-lessons.md">Post-Mortem Logs</a> — Design pitfalls & bug fixes</li>
    </ul>
  </div>

</div>

---

*[Back to project root README](https://github.com/nishantdec/localpass/blob/main/README.md)* | *[Back to Top](#)*
