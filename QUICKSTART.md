[Home](README.md) •
[Docs Index](docs/index.md) •
[Quick Start](QUICKSTART.md) •
[Glossary](docs/reference/glossary.md)

---

# localpass Quick Start Guide

This guide gets your localpass vault client and browser extension set up, integrated, and running on Windows in less than five minutes.

---

## Technical Prerequisites

Before beginning, ensure your host environment meets the minimum version and system requirements:

| Requirement | Minimum Version | Check Command |
| :--- | :--- | :--- |
| **Python** | 3.11+ | `python --version` |
| **pip** | 23.0+ | `pip --version` |
| **Windows** | 10 or 11 | Press `Win + R`, type `winver`, press Enter |
| **Chrome / Edge** | Any recent version | Go to `Settings` -> `About` |
| **Git** | Any version | `git --version` |

---

## Setup Steps

### Step 1: Clone the Repository
Open a PowerShell terminal and clone the repository to your local development workspace:

```powershell
git clone https://github.com/nishantdec/localpass.git
cd localpass
```

### Step 2: Install Python Dependencies
Install the required cryptographical and interface packages. If you are using global system environments, include the system break flag:

```powershell
pip install -r requirements.txt --break-system-packages
```

**Expected Console Output**:
```text
Collecting prompt-toolkit (from -r requirements.txt)
Collecting cryptography (from -r requirements.txt)
Collecting argon2-cffi (from -r requirements.txt)
Collecting pyotp (from -r requirements.txt)
Successfully installed prompt-toolkit cryptography argon2-cffi pyotp
```

### Step 3: Run the Vault Client & Initialize Master Password
Boot up the main terminal interface. Because no vault database (`vault.nlk`) exists yet, localpass automatically initiates its secure setup wizard:

```powershell
python localpass/main.py
```

**Visual On-Screen Flow**:
1. A full-screen terminal interface (TUI) opens.
2. The system prompts: `Welcome to localpass! Create a Master Password.`
3. Type a strong, memorable Master Password (a minimum of 16 characters is highly recommended).
4. Retype the Master Password to confirm.
5. The system derives the key, generates your new encrypted `vault.nlk` file on disk, and opens the main dashboard: `Vault: 0 entries`.
6. Leave this terminal open and running. Unlocking the TUI automatically fires up the background loopback HTTP server at `127.0.0.1:27432`.

### Step 4: Load the Unpacked Browser Extension
1. Open your Google Chrome or Microsoft Edge browser.
2. Navigate to the extensions manager page:
   *   Chrome: `chrome://extensions`
   *   Edge: `edge://extensions`
3. Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. Click the **Load unpacked** button in the top-left menu.
5. In the file explorer dialog, navigate to your cloned project directory, select the `localpass-extension` folder, and click **Select Folder**.
6. Pin the **localpass** extension icon to your browser toolbar by clicking the puzzle piece icon and toggling the pin/eye symbol.

### Step 5: Verify Extension Connection
1. Ensure the Python terminal app is running and stays unlocked on the dashboard.
2. Click the **localpass (NL)** icon in your browser toolbar.
3. The popup interface should load instantly, showing the localpass header, active domain matching, and a green connected state indicator.
4. *Troubleshooting Note*: If the popup says `localpass is not running`, ensure your terminal client has not autolocked and is actively running on the dashboard screen.

### Step 6: Create and Autofill Your First Entry
1. In the open Python terminal client, press `N` (or select the New Entry button) to create a new record.
2. Fill in the field forms:
   *   **Title**: `GitHub`
   *   **Username**: `user@email.com`
   *   **Password**: `your-secure-password-here`
   *   **URL**: `https://github.com`
3. Press `Ctrl + S` to encrypt and commit the record to your physical database disk layout.
4. Now, open your browser and navigate to `https://github.com/login`.
5. Click the email/username input field. The inline cyan **NL Dropdown** suggestion box will appear beneath the field.
6. Click the matching `user@email.com` option in the dropdown list.
7. localpass decrypts the credentials via the loopback daemon and fills the form instantly.

---

## Common First-Run Errors and Fixes

### Error 1: `externally-managed-environment`
*   **Cause**: You are attempting to run a global pip install command on a modern Debian/Ubuntu-derived Python system or a Windows environment enforcing strict package boundaries.
*   **Fix**: Pass the `--break-system-packages` flag as shown in Step 2:
    ```powershell
    pip install -r requirements.txt --break-system-packages
    ```
    *Alternative Fix*: Create and activate a localized Python virtual environment:
    ```powershell
    python -m venv venv
    .\venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    ```

### Error 2: `OSError: [Errno 98] Address already in use`
*   **Cause**: Another instance of the localpass background HTTP server is already running or another software application is occupying TCP port `27432`.
*   **Fix**: Find and terminate the blocking process using PowerShell commands:
    ```powershell
    Get-NetTCPConnection -LocalPort 27432 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
    ```

### Error 3: Popup shows "localpass is not running"
*   **Cause**: The local server is either not running, or the Chrome extension is blocked from communicating with loopback addresses.
*   **Fix 1**: Ensure your Python terminal window is open, is on the dashboard screen, and has not autolocked.
*   **Fix 2**: Check your browser network/adblocker settings. Ensure local loopback address access (`127.0.0.1`) has not been globally disabled or blacklisted.

---

## See Also
- [Architecture Overview](docs/architecture/overview.md)
- [Debugging](docs/guides/debugging.md)
- [Glossary](docs/reference/glossary.md)

---
*[Back to Docs Index](docs/index.md) •
[Back to Top](#)*