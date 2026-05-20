[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: paths.py

The `paths.py` utility module manages path resolution and directory construction for the localpass ecosystem. It isolates platform-dependent directory layouts, ensuring consistent path derivation across different operating systems. This centralizes the locations of credentials, backups, native host scripts, logs, and stable device identifiers.

## Location
`localpass/utils/paths.py`

---

## Directory Structure Specification

localpass groups all configuration, vault metadata, logs, and backup files under a single, central directory.

### Windows (Standard Installation)
On Windows platforms, files are located within the `APPDATA` directory:
```text
C:\Users\<Username>\AppData\Roaming\localpass\
├── backups\                    # Rotational encrypted backups directory
│   ├── vault.nlk.20260519120000
│   └── ...
├── native_host\                # Chrome Native Messaging binary & manifest components
│   ├── com.localpass.host.json
│   └── host.bat
├── vault.nlk                   # The main encrypted credential vault file
├── config.json                 # User-facing JSON settings file
├── audit.log                   # Plaintext local application security audit ledger
└── device.id                   # Plaintext stable machine UUID identifier
```

### macOS / Linux (Standard Fallback)
On non-Windows systems, localpass falls back to standard user home directory locations:
```text
/home/<Username>/.config/localpass/
├── backups/
├── native_host/
├── vault.nlk
├── config.json
├── audit.log
└── device.id
```

---

## Dependencies
*   `os` — Reads environmental indicators.
*   `uuid` — Generates stable v4 universally unique identifiers.
*   `pathlib` — Modern, object-oriented filesystem path resolution.

---

## Exports & Public Interface

### `get_app_dir() -> pathlib.Path`
Resolves the active user's environment to establish the absolute path of the localpass workspace folder, creating it if it does not exist.

*   **Returns:** `pathlib.Path` — Absolute path to the resolved AppData directory.
*   **Called by:** Internally by all other path resolvers in this module.

### `get_vault_path() -> pathlib.Path`
Resolves the file path of the encrypted database.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/vault.nlk`.
*   **Called by:** `localpass/main.py`, `localpass/core/entries.py`

### `get_config_path() -> pathlib.Path`
Resolves the file path of the settings file.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/config.json`.
*   **Called by:** `localpass/utils/config.py`

### `get_backup_dir() -> pathlib.Path`
Resolves the path to the backups directory, creating it recursively if it does not exist.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/backups/`.
*   **Called by:** `localpass/core/recovery.py`

### `get_audit_log_path() -> pathlib.Path`
Resolves the file path of the plaintext local security audit log.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/audit.log`.
*   **Called by:** `localpass/core/audit.py`

### `get_device_id_path() -> pathlib.Path`
Resolves the location of the stable machine ID identifier file.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/device.id`.
*   **Called by:** Internally by `get_device_id()`.

### `get_device_id() -> str`
Retrieves a stable, machine-local universally unique identifier. If no device identity is established on the local machine, the routine generates a new UUIDv4, persists it in plaintext inside `device.id` for future sessions, and returns it.

*   **Returns:** `str` — 36-character hexadecimal UUID format.
*   **Called by:** `localpass/core/auth.py`

### `get_native_host_dir() -> pathlib.Path`
Resolves the location where Google Chrome/Chromium native messaging manifests and host runner scripts are placed, creating the folder if it does not exist.

*   **Returns:** `pathlib.Path` — pointing to `.../localpass/native_host/`.
*   **Called by:** `localpass/native_host/manifest_installer.py`

---

## Core Internal Implementations

### Stable Machine Identification
The device ID resolver reads from or writes to the persistent local filesystem. Because this identity is machine-specific but not cryptographically sensitive, it is stored in plaintext:

```python
def get_device_id() -> str:
    """
    Returns a stable, machine-local device identifier.
    Generated once on first run, stored in plaintext (not sensitive).
    """
    id_path = get_device_id_path()
    if id_path.exists():
        try:
            return id_path.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    device_id = str(uuid.uuid4())
    try:
        id_path.write_text(device_id, encoding="utf-8")
    except Exception:
        pass
    return device_id
```

---

## Working Code Example

Below is a complete test harness showcasing how to import path resolvers and verify local directory existence and permissions:

```python
import os
from localpass.utils.paths import (
    get_app_dir,
    get_vault_path,
    get_config_path,
    get_device_id
)

if __name__ == "__main__":
    print("=== localpass Path Diagnostics ===")
    
    # 1. Base app directory
    app_dir = get_app_dir()
    print(f"Target Base Directory: {app_dir}")
    print(f"Exists on disk?       {app_dir.exists()}")
    
    # 2. Key files
    print(f"Vault Database Path:  {get_vault_path()}")
    print(f"Config Settings Path: {get_config_path()}")
    
    # 3. Dynamic machine ID
    dev_id = get_device_id()
    print(f"Machine Unique ID:    {dev_id}")
    
    # 4. Permissions check
    if os.access(app_dir, os.W_OK):
        print("Status: Write permissions VERIFIED on AppData directory.")
    else:
        print("ERROR: Write permissions DENIED on AppData directory.")
```

---

## See Also
- [Clipboard](clipboard.md)
- [Config](config.md)
- [Architecture Overview](../../architecture/overview.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*