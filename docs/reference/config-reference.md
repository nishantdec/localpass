[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](glossary.md)

---

# Configuration Reference Manual

This document provides a comprehensive configuration guide detailing every setting, property key, data type, default value, and validation constraint supported by the localpass TUI and local server engines.

---

## 1. Location of Configuration File

localpass persists its configurations as a raw UTF-8 encoded JSON file: `config.json`. The location depends on the host operating system:

*   **Windows (Standard)**:
    `C:\Users\<Username>\AppData\Roaming\localpass\config.json`
*   **Non-Windows (Fallback)**:
    `~/.config/localpass/config.json`

If the file does not exist on start, the application instantiates a fresh configuration block using the standard defaults.

---

## 2. Exhaustive Properties Schema

The following table documents every property mapped inside `config.json`:

| JSON Key | Data Type | Default Value | Description and Valid Bounds |
| :--- | :--- | :--- | :--- |
| `clipboard_clear_seconds` | `integer` | `15` | The delay in seconds before the clipboard contents are overwritten with an empty string. Valid bounds: `1` to `3600` seconds. |
| `theme` | `string` | `"dark"` | Visual styling configuration block loaded by the prompt_toolkit interface. Valid options: `"dark"`, `"light"`. |
| `auto_lock_enabled` | `boolean` | `false` | If `true`, enables active inactivity tracking. If no keystrokes are recorded within the defined timeout limit, the vault locks automatically. |
| `auto_lock_idle_minutes` | `integer` | `5` | The duration of keyboard inactivity in minutes before an automatic lock is triggered. Valid bounds: `1` to `1440` (24 hours). |
| `session_token_ttl_hours` | `integer` | `8` | Time-to-Live (TTL) in hours for session tokens. Exceeding this limit invalidates extension handshake authorization tokens. `0` disables expiry. |
| `extension_transport` | `string` | `"localhost_http"` | The protocol transport used to communicate with the extension service worker. Valid values: `"localhost_http"`, `"native_messaging"`. |
| `server_port` | `integer` | `27432` | The TCP port the background HTTP loopback REST server listens on. Valid bounds: `1024` to `65535`. |
| `max_backups` | `integer` | `5` | The maximum historical encrypted database backup files retained within the `/backups` subdirectory. Valid bounds: `0` (disabled) to `100`. |
| `auto_backup_on_save` | `boolean` | `true` | If `true`, creates a timestamped copy of the encrypted vault database inside the `/backups` directory on save. |
| `generator_defaults` | `object` / `null` | `null` | Pre-configured options populated by the password generator (e.g., character inclusion flags, desired length, complexity thresholds). |

---

## 3. Comprehensive Property Descriptions

### A. `clipboard_clear_seconds`
*   **Purpose**: Protects decrypted passwords from remaining in the OS clipboard where background processes can read them.
*   **Implementation**: When a username, password, or TOTP code is copied, localpass starts an asynchronous timer thread. When the timer expires, it overwrites the clipboard if it still contains the copied value.
*   **Security Recommendation**: Keep this value low (under 30 seconds) to minimize the exposure window.

### B. `auto_lock_enabled` and `auto_lock_idle_minutes`
*   **Purpose**: Protects credentials if the user leaves their physical machine unlocked and unattended.
*   **Implementation**: A background thread (`_idle_lock_loop`) runs continuously, comparing the monotonic system time against `_last_activity` (updated on every keystroke in `app.py`). If the difference exceeds `auto_lock_idle_minutes * 60`, `lock_vault()` is invoked, which:
    1. Zeroes key arrays in memory.
    2. Invalidates the active server session token.
    3. Stops the background server.
    4. Navigates the TUI back to the password unlock prompt.

### C. `session_token_ttl_hours`
*   **Purpose**: Limits the lifespan of the browser extension's authorization token.
*   **Implementation**: The token validation engine compares `time.monotonic() - issued_at` against `ttl_seconds`. If the limit is exceeded, the token is invalidated, forcing a new handshake.
*   **Security Recommendation**: Match this to standard user sessions (e.g. 8 to 12 hours) to ensure keys are periodically refreshed.

### D. `extension_transport` and `server_port`
*   **Purpose**: Configures communication between the browser extension and the core vault process.
*   **Options**:
    *   `"localhost_http"`: The background script starts a loopback daemon on `127.0.0.1:<server_port>`. This is widely compatible but exposes a port.
    *   `"native_messaging"`: Communication flows through standard input/output pipes managed by the browser. This eliminates the loopback port and is immune to DNS rebinding.

### E. `max_backups` and `auto_backup_on_save`
*   **Purpose**: Prevents data loss from database corruption or sudden power loss.
*   **Implementation**: On save, localpass copies the existing vault file to the `backups/` directory, appending a UTC timestamp to the name. If the total number of files exceeds `max_backups`, the oldest file is deleted.
*   **Security Property**: Backups remain fully encrypted with the active AES-256-GCM key derived from the master password.

---

## 4. Complete `config.json` Example

This is a complete, valid example of a `config.json` file showing all fields populated:

```json
{
  "clipboard_clear_seconds": 15,
  "theme": "dark",
  "auto_lock_enabled": true,
  "auto_lock_idle_minutes": 10,
  "session_token_ttl_hours": 8,
  "extension_transport": "localhost_http",
  "server_port": 27432,
  "max_backups": 5,
  "auto_backup_on_save": true,
  "generator_defaults": {
    "length": 20,
    "include_uppercase": true,
    "include_lowercase": true,
    "include_numbers": true,
    "include_symbols": true
  }
}
```

---

## See Also
- [Glossary](glossary.md)
- [File Index](file-index.md)
- [Function Index](function-index.md)
- [Keyboard Shortcuts](keyboard-shortcuts.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*