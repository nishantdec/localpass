[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: config.py

The `config.py` module defines the dataclass schema and I/O serialization methods for user-facing persistent configurations in localpass. These parameters determine clipboards, graphical themes, local web server ports, auto-locking criteria, and password generator characteristics. Config options are serialized into an indented JSON file located directly in the platform-specific application directory.

## Location
`localpass/utils/config.py`

---

## Configuration Parameter Reference

Below are the default properties defined inside the `Config` dataclass:

| Field Name | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `clipboard_clear_seconds` | `int` | `15` | The duration in seconds that copied secrets remain on the clipboard before clear. |
| `theme` | `str` | `"dark"` | UI theme designation. The terminal app currently utilizes a premium default dark styling palette. |
| `auto_lock_enabled` | `bool` | `False` | Toggle to automatically lock the vault after a designated period of keyboard/focus inactivity. |
| `auto_lock_idle_minutes`| `int` | `5` | Inactivity limit in minutes before the vault is auto-locked. |
| `session_token_ttl_hours`| `int` | `8` | Expiry duration in hours for web extension loopback session tokens. `0` disables expiration. |
| `extension_transport` | `str` | `"localhost_http"` | Extension bridge transport mechanism. Values: `"native_messaging"` (recommended) or `"localhost_http"`. |
| `server_port` | `int` | `27432` | Local TCP port for the loopback server (active only when `extension_transport` is `"localhost_http"`). |
| `max_backups` | `int` | `5` | The maximum count of automatic vault backups kept in rotation. |
| `auto_backup_on_save` | `bool` | `True` | Automatically triggers a copy of the vault file before overwriting contents during save. |
| `generator_defaults` | `dict \| None`| `None` | Optional default configuration settings for the password generator (e.g., length, symbol requirements). |

---

## File Schema & Physical Location
*   **Windows Path:** `C:\Users\<Username>\AppData\Roaming\localpass\config.json`
*   **Linux/Mac Path:** `~/.config/localpass/config.json`

### Example `config.json` File Content
```json
{
  "clipboard_clear_seconds": 15,
  "theme": "dark",
  "auto_lock_enabled": true,
  "auto_lock_idle_minutes": 10,
  "session_token_ttl_hours": 8,
  "extension_transport": "native_messaging",
  "server_port": 27432,
  "max_backups": 5,
  "auto_backup_on_save": true,
  "generator_defaults": {
    "length": 16,
    "include_uppercase": true,
    "include_numbers": true,
    "include_symbols": false
  }
}
```

---

## Dependencies
*   `json` — Built-in JSON serialization.
*   `dataclasses` — Defines `dataclass`, `field`, and `asdict` bindings.
*   `localpass.utils.paths.get_config_path` — Dynamically resolves target storage file path.

---

## Exports & Public Interface

### `Config` [Dataclass]

#### `Config.load() -> Config` [Class Method]
Attempts to load the user's config file from disk. If the file is missing, empty, or structurally corrupted, it gracefully catches the error and returns a new default configuration instance.

*   **Returns:** `Config` — A populated or default dataclass instance.
*   **Called by:** `localpass/ui/app.py` (`__init__`), `server/local_server.py`, `localpass/ui/screens/settings.py`

#### `Config.save() -> None` [Instance Method]
Serializes the current state of the dataclass to the standard configuration file using two-space indentation. If `generator_defaults` is `None`, the key is completely stripped from the JSON block on save.

*   **Returns:** `None`
*   **Called by:** `localpass/ui/screens/settings.py` (`_save_settings`)

#### `Config.auto_lock_label() -> str` [Instance Method]
Generates a reader-friendly textual description of the auto-lock configuration for TUI menu display.

*   **Returns:** `str` (e.g., `"Disabled"`, `"Locks after 20 min idle"`, or `"Locks after 2h idle"`)
*   **Called by:** `localpass/ui/screens/settings.py`

#### `@property session_token_ttl_seconds -> int` [Instance Property]
Converts the configuration's hour-based TTL parameter to seconds.

*   **Returns:** `int`
*   **Called by:** `server/local_server.py`, `localpass/core/auth.py`

---

## Core Internal Implementations

### Defending Against Key Mapping Failures
The config loader includes custom filtering to prevent runtime failures if an older or corrupted configuration contains extra keys that do not map to the dataclass fields:

```python
@classmethod
def load(cls) -> "Config":
    path = get_config_path()
    if not path.exists():
        return cls()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        scalar_keys = {
            "clipboard_clear_seconds",
            "theme",
            "auto_lock_enabled",
            "auto_lock_idle_minutes",
            "session_token_ttl_hours",
            "extension_transport",
            "server_port",
            "max_backups",
            "auto_backup_on_save",
        }
        kwargs = {k: v for k, v in data.items() if k in scalar_keys}
        instance = cls(**kwargs)
        if "generator_defaults" in data and isinstance(data["generator_defaults"], dict):
            instance.generator_defaults = data["generator_defaults"]
        return instance
    except Exception:
        # Fallback to defaults on file access error or corrupted JSON structures
        return cls()
```

---

## Working Code Example

Below is a complete script demonstrating configuration creation, loading, value manipulation, and serialization:

```python
from localpass.utils.config import Config

if __name__ == "__main__":
    # 1. Instantiate default configurations
    cfg = Config()
    print(f"Default Clipboard Clear Timer: {cfg.clipboard_clear_seconds} seconds")
    
    # 2. Modify specific options
    cfg.auto_lock_enabled = True
    cfg.auto_lock_idle_minutes = 90
    cfg.extension_transport = "native_messaging"
    
    # 3. Check automatic label generation
    print(f"Auto-Lock Display Text: '{cfg.auto_lock_label()}'")
    
    # 4. Check session token conversion
    print(f"Token TTL: {cfg.session_token_ttl_hours}h = {cfg.session_token_ttl_seconds} seconds")
    
    # 5. Save changes to local config path
    try:
        cfg.save()
        print("Configuration successfully written to AppData.")
    except Exception as e:
        print(f"Save failed: {e}")
```

---

## See Also
- [Clipboard](clipboard.md)
- [Paths](paths.md)
- [Architecture Overview](../../architecture/overview.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*