# localpass Documentation

> Complete documentation for the localpass password manager.
> Terminal app + browser extension. Fully offline. Zero knowledge.

---

## Quick Navigation

| I want to... | Go to |
|---|---|
| Get it running fast | [Quick Start](../QUICKSTART.md) |
| Understand how it works | [Architecture Overview](architecture/overview.md) |
| See how encryption works | [Security Model](architecture/security-model.md) |
| Use the browser extension | [Extension Setup](extension/setup.md) |
| Add a new feature | [Developer Guides](guides/adding-a-new-view.md) |
| Debug a problem | [Debugging Guide](guides/debugging.md) |
| Look up a function | [Function Index](reference/function-index.md) |
| Understand a term | [Glossary](reference/glossary.md) |

---

## Terminal App

![TUI Dashboard](../assets/screenshots/terminal/tui-03-dashboard.png)

| Section | Description |
|---|---|
| [Overview](python-app/overview.md) | What the Python app does |
| [Auth & Encryption](python-app/core/auth.md) | Master password and key derivation |
| [Vault](python-app/core/vault.md) | How the vault file works |
| [Entries](python-app/core/entries.md) | Credential data model |
| [TOTP](python-app/core/totp.md) | Two-factor code generation |
| [Generator](python-app/core/generator.md) | Password generator logic |
| [Unlock Screen](python-app/ui/screens/unlock.md) | First screen |
| [Dashboard](python-app/ui/screens/dashboard.md) | Main menu |
| [Search](python-app/ui/screens/search.md) | Find entries |
| [Settings](python-app/ui/screens/settings.md) | Configuration |

---

## Browser Extension

![Extension Vault](../assets/screenshots/extension/ext-01-vault-entries.png)

| Section | Description |
|---|---|
| [Overview](extension/overview.md) | What the extension does |
| [Setup Guide](extension/setup.md) | How to install and load |
| [Background Service](extension/background/background.md) | Service worker |
| [Autofill](extension/content/injector.md) | How field filling works |
| [Popup Views](extension/popup/popup.md) | All popup screens |
| [Entries View](extension/popup/views/entries.md) | Main vault view |
| [Generator View](extension/popup/views/generator-view.md) | Generator in popup |

---

## API Reference

| Section | Description |
|---|---|
| [Local Server API](api/local-server-api.md) | All HTTP endpoints |
| [Message Passing API](api/message-passing-api.md) | Chrome messages |
| [Vault File Format](api/vault-file-format.md) | Binary format spec |

---

## Architecture

| Section | Description |
|---|---|
| [System Overview](architecture/overview.md) | Full system map |
| [Data Flow](architecture/data-flow.md) | How data moves |
| [Security Model](architecture/security-model.md) | Encryption details |
| [System Diagram](architecture/diagrams/system-overview.md) | ASCII diagram |
| [Autofill Flow](architecture/diagrams/autofill-flow.md) | Fill sequence |

---

## Developer Guides

| Guide | Description |
|---|---|
| [Add a New View](guides/adding-a-new-view.md) | New popup screen |
| [Add an Entry Type](guides/adding-a-new-entry-type.md) | New credential type |
| [Add an Endpoint](guides/adding-a-new-endpoint.md) | New server route |
| [Debugging](guides/debugging.md) | Debug every layer |
| [Build as EXE](guides/building-exe.md) | PyInstaller packaging |
| [Future Features](guides/future-features.md) | Planned work |

---

## Reference

| Reference | Description |
|---|---|
| [File Index](reference/file-index.md) | Every file explained |
| [Function Index](reference/function-index.md) | Every function |
| [Keyboard Shortcuts](reference/keyboard-shortcuts.md) | All keybinds |
| [Config Reference](reference/config-reference.md) | config.json fields |
| [Glossary](reference/glossary.md) | Terms and definitions |

---

*[Back to project root README](../README.md)*
