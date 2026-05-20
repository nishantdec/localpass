[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Native Messaging Host Manifest Installer (`manifest_installer.py`)

## 1. Overview
The `manifest_installer.py` module is responsible for registering the Chrome Native Messaging host (`com.localpass.host`) with the host operating system and any installed Chromium-based web browsers. 

Web browsers enforce strict security rules around Native Messaging. An extension cannot launch an arbitrary executable directly. Instead, the browser must query the operating system's registry (Windows) or specific filesystem paths (macOS and Linux) for a **Native Messaging Host Manifest** JSON file that defines:
1. The unique name of the native messaging host (`com.localpass.host`).
2. The absolute path to a launcher script or binary.
3. The allowed origins (Chrome Extension IDs) authorized to interact with the host.

---

## 2. Installation Architecture Across Platforms
The registration process varies by operating system:

```
                  ┌──────────────────────────────┐
                  │   manifest_installer.py      │
                  └──────────────┬───────────────┘
                                 │
                   Check OS (platform.system())
                                 │
         ┌───────────────────────┼──────────────────────┐
         ▼                       ▼                      ▼
    [ Windows ]               [ macOS ]              [ Linux ]
  HKCU Registry          ~/Library/Application/  ~/.config/google-chrome/
  com.localpass.host   Google/Chrome/...       NativeMessagingHosts/...
```

### Path & Registry Details
*   **Windows:** Writes the manifest JSON to the local app data path, then creates string values (`REG_SZ`) mapping `com.localpass.host` to that manifest's absolute path under the following Current User registry branches:
    -   `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.localpass.host`
    -   `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.localpass.host`
    -   `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.localpass.host`
*   **macOS:** Writes the manifest JSON directly to:
    `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.localpass.host.json`
*   **Linux:** Writes the manifest JSON directly to:
    `~/.config/google-chrome/NativeMessagingHosts/com.localpass.host.json`

---

## 3. The Launcher Script
Because the native messaging host runs in Python, the browser must trigger the Python interpreter with the correct module path. The installer writes an OS-specific wrapper script to avoid absolute path mismatches:

### Windows (`localpass_host.bat`)
```batch
@echo off
"C:\Path\To\python.exe" -m localpass.native_host.host
```

### macOS / Linux (`localpass_host.sh`)
```bash
#!/bin/bash
exec "/Path/To/python" -m localpass.native_host.host
```
*Note: The installer automatically grants executable permissions (`chmod 0o755`) to the shell script on Unix platforms.*

---

## 4. Module Function Reference

### `get_host_script_path()`
Calculates the location where the launcher wrapper script should be created.
* **Signature:** `def get_host_script_path() -> Path`
* **Returns:** `pathlib.Path` pointing to the target wrapper script (either `.bat` or `.sh`).
* **Called By:** 
  - `localpass/native_host/manifest_installer.py` -> `install()`
* **Calls:**
  - `localpass.utils.paths.get_native_host_dir()`
  - `platform.system()`
* **Working Example:**
  ```python
  from pathlib import Path
  path = get_host_script_path()
  print(path) # Output: C:\Users\North\AppData\Local\localpass\native_host\localpass_host.bat
  ```

---

### `get_manifest_content()`
Builds the native messaging configuration dictionary that complies with Chrome security schemas.
* **Signature:** `def get_manifest_content(extension_id: str, host_script: Path) -> dict`
* **Parameters:**
  - `extension_id` (`str`): The 32-character browser extension ID (e.g., `abcdefghijklmnopqrstuvwxyz012345`).
  - `host_script` (`Path`): The absolute path to the OS-specific launcher wrapper script.
* **Returns:** `dict` (Formatted manifest dictionary).
* **Called By:**
  - `localpass/native_host/manifest_installer.py` -> `install()`
* **Working Example:**
  ```python
  from pathlib import Path
  manifest = get_manifest_content("mbkjgnh...dfg", Path("C:/launcher.bat"))
  print(manifest)
  # Output:
  # {
  #   "name": "com.localpass.host",
  #   "description": "localpass Native Messaging Host",
  #   "path": "C:\\launcher.bat",
  #   "type": "stdio",
  #   "allowed_origins": ["chrome-extension://mbkjgnh...dfg/"]
  # }
  ```

---

### `write_host_script()`
Writes the launcher batch script or bash file to the filesystem, configuring proper environment paths and permissions.
* **Signature:** `def write_host_script(host_script: Path) -> None`
* **Parameters:**
  - `host_script` (`Path`): The path where the launcher script should be written.
* **Returns:** `None`
* **Called By:**
  - `localpass/native_host/manifest_installer.py` -> `install()`
* **Calls:**
  - `sys.executable`
  - `pathlib.Path.write_text()`
  - `pathlib.Path.chmod()` (macOS/Linux only)

---

### `install_windows()`
Registers the native messaging host under the Windows registry keys for Chrome, Edge, and Brave.
* **Signature:** `def install_windows(manifest: dict) -> bool`
* **Parameters:**
  - `manifest` (`dict`): The manifest structure to write.
* **Returns:** `bool` (`True` if successfully registered, `False` otherwise).
* **Called By:**
  - `localpass/native_host/manifest_installer.py` -> `install()`
* **Calls:**
  - `winreg.CreateKey()`
  - `winreg.SetValueEx()`
  - `winreg.CloseKey()`

---

### `install_macos()`
Writes the manifest structure directly to the current user's Library folder.
* **Signature:** `def install_macos(manifest: dict) -> bool`
* **Parameters:**
  - `manifest` (`dict`): The manifest structure to write.
* **Returns:** `bool` (`True` if successfully written, `False` otherwise).
* **Called By:**
  - `localpass/native_host/manifest_installer.py` -> `install()`

---

### `install_linux()`
Writes the manifest structure directly to the user's config directory.
* **Signature:** `def install_linux(manifest: dict) -> bool`
* **Parameters:**
  - `manifest` (`dict`): The manifest structure to write.
* **Returns:** `bool` (`True` if successfully written, `False` otherwise).
* **Called By:**
  - `localpass/native_host/manifest_installer.py` -> `install()`

---

### `install()`
Unified installer coordinator that generates launcher scripts, validates platform requirements, and registers the manifest.
* **Signature:** `def install(extension_id: str) -> bool`
* **Parameters:**
  - `extension_id` (`str`): The browser extension identifier string.
* **Returns:** `bool` (`True` on complete success, `False` on any registry or write error).
* **Called By:**
  - `localpass/main.py` (via `--install-native-host` command line argument).
* **Calls:**
  - `get_host_script_path()`
  - `write_host_script()`
  - `get_manifest_content()`
  - `install_windows()` / `install_macos()` / `install_linux()`

---

### `uninstall()`
Uninstalls the native messaging host registry keys (on Windows) to clean up system state.
* **Signature:** `def uninstall() -> None`
* **Parameters:** None.
* **Returns:** None.
* **Called By:**
  - Developer uninstall scripts or system cleanup tools.
* **Calls:**
  - `winreg.DeleteKey()` (on Windows)

---

## 5. Shell Command CLI Usage
The manifest installer is triggered from the command-line interface:

### Installing the Host
```bash
python -m localpass --install-native-host --extension-id <extension_id>
```

### Uninstalling the Host
Currently uninstallation cleans up registry references on Windows:
```python
# Programmatic uninstall
from localpass.native_host.manifest_installer import uninstall
uninstall()
```

---

## 6. Manifest Template Schema

```json
{
  "name": "com.localpass.host",
  "description": "localpass Native Messaging Host",
  "path": "C:\\Users\\North\\AppData\\Local\\localpass\\native_host\\localpass_host.bat",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://mbkjgnh...dfg/"
  ]
}
```
* **`name`**: The string identifier required by the browser's `chrome.runtime.sendNativeMessage` calls. Must match registry key folder name.
* **`path`**: The absolute location of the wrapper script.
* **`type`**: The standard communication type, which must be `"stdio"`.
* **`allowed_origins`**: Array of chrome-extension URIs allowed to interact. If an origin is not matching, Chrome rejects runtime connection requests.

---

## See Also
- [Host](host.md)
- [Background](../../extension/background/background.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*