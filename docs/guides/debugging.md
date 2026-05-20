[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Comprehensive Troubleshooting and Debugging Guide

This guide provides technical diagnostic workflows, logs locations, manual cryptographic validation scripts, system-wide curl commands, and common error resolution protocols across all application layers of localpass.

---

## Layer 1: Python TUI Diagnostics

### A. Enabling Verbose Logging
To troubleshoot core state shifts, key derivation, or database synchronization errors, you can enable runtime file logging. Add the following initialization block at the very top of `localpass/main.py` before the UI is instantiated:

```python
import logging
import os

# Ensure the AppData target folder exists
log_dir = os.path.join(os.environ.get("APPDATA", ""), "localpass")
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    filename=os.path.join(log_dir, 'localpass_debug.log'),
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d) - %(message)s'
)

logging.info("localpass Debug Logging successfully initialized.")
```

Once added, the system writes active diagnostic markers to:
`C:\Users\<Username>\AppData\Roaming\localpass\localpass_debug.log`

### B. Manually Testing Vault Decryption
If the application crashes or states that a valid Master Password is "Invalid", you can run a standalone Python script to bypass the UI layer and verify the vault's physical integrity. Save and run the following script inside the workspace `<appDataDir>\brain\951c8a35-142b-44d7-a67c-f9704aa50c26/scratch/test_decrypt.py`:

```python
import os
import json
from localpass.core.auth import derive_key
from localpass.core.vault import load_vault

# Define path configurations
appdata_dir = os.path.join(os.environ.get("APPDATA", ""), "localpass")
vault_path = os.path.join(appdata_dir, "vault.nlk")

# Retrieve metadata headers to extract salt
if not os.path.exists(vault_path):
    print(f"Error: Vault file not found at {vault_path}")
    exit(1)

with open(vault_path, "rb") as f:
    header = f.read(33)  # magic(4) + version(1) + salt(16) + nonce(12)
    magic = header[0:4]
    version = header[4:5]
    salt_bytes = header[5:21]
    nonce_bytes = header[21:33]

print(f"Magic bytes: {magic}")
print(f"Schema Version: {int.from_bytes(version, 'big')}")
print(f"Salt (hex): {salt_bytes.hex()}")
print(f"Nonce (hex): {nonce_bytes.hex()}")

# Manual Password Verification
password = input("Enter master password to test decrypt: ")
try:
    # Derive encryption key using Argon2id parameters
    key = derive_key(password, salt_bytes)
    print(f"Derived Key (hex): {key.hex()}")

    # Decrypt and unpack database records
    entries = load_vault(vault_path, key)
    print("\n--- DECRYPTION SUCCESSFUL ---")
    print(f"Total Entries Loaded: {len(entries)}")
    print(json.dumps(entries, indent=2))
except Exception as e:
    print("\n--- DECRYPTION FAILED ---")
    print(f"Exception Type: {type(e).__name__}")
    print(f"Error Message: {str(e)}")
```

### C. Common Python Errors & Exact Fixes

#### 1. "Invalid master password"
*   **Cause 1**: The user typed the incorrect password sequence.
*   **Cause 2**: The vault file binary headers or trailing GCM authentication tag have been corrupted, causing AES-GCM verification (`tag` check) to fail during decryption.
*   **Fix**: Check the size of the `vault.nlk` file. If the file is 0 bytes or lacks the binary `NLLK` magic header, it is unrecoverable. Run the following command to reset and instantiate a fresh schema database:
    ```powershell
    python localpass/main.py --reset
    ```

#### 2. "Module not found: prompt_toolkit"
*   **Cause**: The current environment has missing dependencies or pip packages were loaded into a separate global path.
*   **Fix**: Force install standard dependencies within user libraries:
    ```powershell
    pip install -r requirements.txt --break-system-packages
    ```

---

## Layer 2: Local HTTP Server Diagnostics

The daemon server runs as an independent thread listening on loopback port `27432`. You can run testing routines using Curl to ensure operations proceed accurately.

### A. Testing API Endpoints via Curl

#### 1. Server Ping (Health Check)
*   **Command**:
    ```bash
    curl -s http://127.0.0.1:27432/ping
    ```
*   **Expected Output (Unlocked)**:
    ```json
    { "status": "ok", "locked": false }
    ```

#### 2. Session Handshake
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/handshake \
      -H "Content-Type: application/json" \
      -d '{"challenge":"8f898ab7ce58c281df6bb6fa076c48ee8a89b708cfbe28c89b70e7e4812fce0a"}'
    ```
*   **Expected Output**:
    ```json
    {
      "token": "d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0",
      "response": "4a7fb880b91e921d7b00ca32cfb5bc78ea1fbe4d9ee756c8ab7e01d1cfbe29a2"
    }
    ```

#### 3. Match Credentials by Domain (Replace `TOKEN` with token from handshake)
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/credentials \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"domain": "github.com"}'
    ```
*   **Expected Output**: An array containing matching entry summaries (passwords excluded):
    ```json
    [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "GitHub",
        "username": "user@email.com",
        "type": "login",
        "has_totp": true
      }
    ]
    ```

#### 4. Live Vault Index Search
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/search \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"query": "Git"}'
    ```
*   **Expected Output**: An array of search matches.

#### 5. Save/Update Vault Entry
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/entries \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"title":"GitLab","username":"gituser","password":"securepassword","url":"https://gitlab.com"}'
    ```
*   **Expected Output**:
    ```json
    { "status": "success", "id": "uuid-string-here" }
    ```

#### 6. Request TOTP Code Generation
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/totp \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
    ```
*   **Expected Output**:
    ```json
    { "totp": "123456", "time_remaining": 22 }
    ```

#### 7. Copy Plaintext Value to Clipboard
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/copy \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"id": "550e8400-e29b-41d4-a716-446655440000", "field": "password"}'
    ```
*   **Expected Output**:
    ```json
    { "status": "copied" }
    ```

#### 8. Retrieve Decrypted Form Autofill Values
*   **Command**:
    ```bash
    curl -s -X POST http://127.0.0.1:27432/fill \
      -H "Content-Type: application/json" \
      -H "X-NL-Token: d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0" \
      -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
    ```
*   **Expected Output**:
    ```json
    {
      "username": "user@email.com",
      "password": "securepassword"
    }
    ```

---

## Layer 3: Browser Extension Debugging

### A. Open Extension DevTools (Service Worker)
1. Launch Google Chrome or Edge.
2. In the URL address bar, enter `chrome://extensions` and press Enter.
3. Locate the **localpass** extension card.
4. Click the blue link labeled **service worker** next to "Inspect views".
5. This launches a dedicated Chrome DevTools panel capturing all operations inside `background.js` and `handlers.js`.

### B. Open Popup Context DevTools
1. Click the puzzle icon in Chrome and click the localpass extension to display its popup.
2. Right-click anywhere inside the open extension popup container.
3. Click **Inspect** in the context menu.
4. This launches a DevTools window targeting `popup.html`, enabling console logging inspection for `popup.js`.

### C. Open Content Script Console
1. Open any standard web page (e.g. `https://github.com/login`).
2. Press **F12** or right-click the page and select **Inspect** to load DevTools.
3. Navigate to the **Console** tab.
4. In the console's runtime execution context dropdown (usually showing `top` near the filter bar), select the **localpass** item.
5. You can now inspect execution paths and errors belonging to `injector.js`, `dropdown.js`, and `filler.js`.

---

## Common Extension Errors & Resolutions

### 1. Popup Renders Blank with no entries
*   **Step 1**: Open the Popup DevTools Console.
*   **Step 2**: Check for active errors stating `sendMessage: Could not establish connection. Receiving end does not exist`.
*   **Common Cause**: The background service worker has failed to load or has crashed.
*   **Fix**: Check `chrome://extensions` for background errors. Verify that `background.js` imports core scripts correctly via `importScripts()` declarations at the top of the file.

### 2. "checkConnection is not defined"
*   **Cause**: The module script `bridge.js` was imported inside the HTML context of `popup.html`.
*   **Fix**: Remove `<script src="../utils/bridge.js"></script>` from `popup.html`. `bridge.js` is designed to be injected strictly as a content script via `manifest.json`.

### 3. Inline Cyan Button does not appear on password inputs
*   **Step 1**: Open the Content Script console on the web page.
*   **Step 2**: Inspect console output for messages from `injector.js`.
*   **Common Cause**: The password form elements were loaded or injected dynamically using JavaScript after `injector.js` completed its initial execution.
*   **Fix**: Verify that `observer.js` is running. Ensure the `MutationObserver` registers DOM additions correctly and calls the injection routine when new input elements are added to the document.

### 4. Input Fields are not populated on React or SPA sites
*   **Cause**: SPA frameworks like React override standard input setter prototypes. Directly setting `input.value = decryptedPassword` updates the DOM, but React's virtual DOM is unaware of the modification, causing the value to disappear when clicking Submit.
*   **Fix**: Ensure `filler.js` uses native prototype setters to override the framework-level wrappers:
    ```javascript
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeSetter.call(inputElement, plaintextString);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    ```

---

## See Also
- [Replicating The System](replicating-the-system.md)
- [Adding A New View](adding-a-new-view.md)
- [Adding A New Endpoint](adding-a-new-endpoint.md)
- [Building Exe](building-exe.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*