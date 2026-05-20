[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Unlock & Setup Screen Specification (`unlock.py`)

The `unlock.py` module defines the authentication gateway and first-run initialization portal of the localpass TUI. It operates in two separate modes depending on the presence of the primary vault file (`vault.nlk`): **Setup Mode** (governing master password configuration, quality checking, and initialization) and **Unlock Mode** (governing key derivation, envelope decryption, audit logger tracking, and automatic brute-force defensive termination).

---

## 1. Gateway Interfaces & Graphic Design Layouts

The screen uses centered input underlines that highlight to show active field focus, custom typographic layouts, and warnings that shift to alert colors under failure constraints.

### A. Unlock Interface Layout
```
  ┌────────────────────────────────────────────────────────┐
  │ localpass                                LOCKED: YES │
  ├────────────────────────────────────────────────────────┤
  │                                                        │
  │   Enter your master password to unlock the vault.      │
  │                                                        │
  │   Password                                             │
  │   > [ **************                                ]  │
  │   ──────────────────────────────────────────────       │  <-- Focus Blue (fg:#00afff)
  │                                                        │
  │     Attempts remaining: 5                              │
  │     Auto-lock: 15 minutes                              │
  │                                                        │
  │   [!] Invalid master password. (4 attempts left)       │  <-- Red Warning Label
  │                                                        │
  ├────────────────────────────────────────────────────────┤
  │ Ctrl+R:Show/Hide   Enter:Unlock   ESC:Quit             │
  └────────────────────────────────────────────────────────┘
```

### B. Setup Interface Layout
```
  ┌────────────────────────────────────────────────────────┐
  │ localpass                                      SETUP │
  ├────────────────────────────────────────────────────────┤
  │   Create a master password to encrypt your vault.      │
  │   This password cannot be recovered if lost.           │
  │                                                        │
  │   Password                                             │
  │   > [ my_secret_pass                                ]  │
  │   ──────────────────────────────────────────────       │  <-- Focus Underline
  │   Confirm Password                                     │
  │   > [ my_secret_pass                                ]  │
  │   ──────────────────────────────────────────────       │
  │                                                        │
  │     Strength: [Strong] ███████████████░░░░░            │  <-- Complexity Bar
  │                                                        │
  ├────────────────────────────────────────────────────────┤
  │ Ctrl+R:Show/Hide   Tab:Next   Enter:Submit   ESC:Quit  │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic State & Operational Modes

Upon screen hydration, `build_unlock` evaluates system presence parameters:

```python
vault_path = get_vault_path()
setup_mode = not os.path.exists(vault_path)
```

### Setup Mode Specifications
*   **Password Length Ceiling:** Master password inputs must contain a minimum of `8` characters.
*   **Password Confirmation matching:** `password_field` and `confirm_field` string values must match exactly.
*   **Cryptographic Actions:** Generates a new file via `init_vault`, stores key in session buffer, hydratess vault payload structure via `load_vault`, and starts the background server integration daemon.
*   **Audit Logger Event:** Emits `AuditEvent.VAULT_CREATED` to the ledger.

### Unlock Mode Specifications
*   **Decryption Execution:** Derives Argon2id key, decrypts GCM payload, starts background server, and redirects to Dashboard.
*   **Audit Logger Event:** Emits `AuditEvent.VAULT_UNLOCKED` upon success.
*   **Brute-Force Shield Limits:** Allows a maximum of **5 failed entry attempts** globally tracking within the active session.
    *   Failed decryption raises `InvalidMasterPassword`.
    *   Session logs the failure, increments active tallies, and fires `AuditEvent.UNLOCK_FAILED`.
    *   If remaining attempts reach `0`, the TUI instantly terminates process execution (`app_instance.exit()`) to prevent automated dictionary memory-dumping attacks.
    *   Visual warnings regarding attempts turn red (`fg:#ff5f5f`) if remaining attempts fall to `2` or below.

---

## 3. Keyboard Matrix Reference

Keystrokes are captured globally across the form layout:

| Keystroke | Active UI Scope / Context | Decoupled UI Action |
| :--- | :--- | :--- |
| `escape` or `Ctrl+C` | Global | Terminates the application cleanly (`app_instance.exit()`). |
| `tab` | Global | Focuses next logical input input. |
| `shift-tab` | Global | Focuses previous logical input input. |
| `Ctrl+R` (`c-r`) | On `password_field` focus | Toggles character masking `state['show_pass']` to show/hide text. |
| `Ctrl+R` (`c-r`) | On `confirm_field` focus | Toggles character masking `state['show_confirm']` to show/hide text. |
| `enter` | On `password_field` focus | In Setup Mode: Moves focus to `confirm_field`. In Unlock Mode: Submits password. |
| `enter` | On `confirm_field` focus | Submits password and initiates setup vault routines. |

---

## 4. Technical Function Reference

### `build_unlock`
```python
def build_unlock(lock_message: str = "") -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Constructs the gateway authentication interface, binds UI controls, manages validation states, starts the loopback server on success, and handles session limits.
*   **Parameters:**
    *   `lock_message` (`str`): Optional informational alert message displayed on the form (e.g. from idle autolock events).
*   **Returns:** `Container` - Screen layout wrapped via `create_screen_layout`.
*   **Caller Files:** 
    *   `localpass/ui/app.py` (Default start window screen if vault is locked or missing)
    *   `localpass/ui/screens/dashboard.py` (Redirected back to this screen when locking the vault)
*   **Callee Functions:** 
    *   `prompt_toolkit.widgets.TextArea`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `prompt_toolkit.filters.Condition`
    *   `localpass.core.vault.load_vault`
    *   `localpass.core.vault.init_vault`
    *   `localpass.core.vault.get_vault_key`
    *   `localpass.core.audit.get_audit_service`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.unlock import build_unlock
    from localpass.ui.app import app_instance

    # Forces visual lockdown redirect, printing autolock log reason
    app_instance.set_screen(build_unlock("Vault locked due to user inactivity."))
    ```

---

### `_store_session_key`
```python
def _store_session_key(password: str) -> None:
```
*   **Description:** Synchronously derives the master symmetric key and writes it directly to the application's RAM session secure buffer. Clears the password value from the TextArea buffer.
*   **Parameters:**
    *   `password` (`str`): Master password string value.
*   **Returns:** None
*   **Caller Functions:** `attempt_unlock`
*   **Callee Functions:** `localpass.core.vault.get_vault_key`, `localpass.ui.app.App.session.set_key`

---

### `attempt_unlock`
```python
def attempt_unlock() -> None:
```
*   **Description:** Decoupled execution closure governing the validation logic. Handles either the setup or unlock process flows depending on active modes, raising errors or driving transitions.
*   **Parameters:** None
*   **Returns:** None
*   **Caller Functions:** Keyboard event binders (when `enter` is triggered on final inputs)
*   **Callee Functions:** `init_vault`, `_store_session_key`, `load_vault`, `app_instance.start_server`, `AuditService.log`, `asyncio.create_task`

---

### `get_strength_bar`
```python
def get_strength_bar(password: str) -> tuple[str, str]:
```
*   **Description:** Helper evaluating input complexity and returning details regarding block layout and styling color tokens.
*   **Parameters:**
    *   `password` (`str`): The raw string contents of the password input.
*   **Returns:** `tuple[str, str]` - Consists of (visual progress bar, color style token).
*   **Caller Functions:** `build_unlock` (during visual graph initialization in setup mode)
*   **Callee Functions:** `localpass.core.generator.evaluate_strength`

---

### `handle_success`
```python
async def handle_success(msg: str) -> None:
```
*   **Description:** Asynchronous routing helper that displays green confirmation text for 0.8 seconds before redirecting the UI to the Dashboard.
*   **Parameters:**
    *   `msg` (`str`): Success message text to print.
*   **Returns:** None
*   **Caller Functions:** `attempt_unlock` (via `asyncio.create_task` on success)
*   **Callee Functions:** `asyncio.sleep`, `localpass.ui.screens.dashboard.build_dashboard`

---

## 5. Security Architecture: Password Scrubbing & Session Storage

To prevent sensitive password data from remaining in process memory, localpass applies immediate scrubbing actions upon key derivation:

```python
def _store_session_key(password: str):
    # Derive key and register in secure memory buffer
    key = get_vault_key(vault_path, password)
    app_instance.session.set_key(key)
    
    # Zero-out the plaintext password string from prompt_toolkit's TextArea document buffer
    try:
        password_field.document = password_field.document.__class__('')
    except Exception:
        pass
```
This forces Python garbage collections to release references to raw input character sequences as quickly as possible.

---

## See Also
- [App](../app.md)
- [Dashboard Screen](dashboard.md)
- [Auth](../../core/auth.md)
- [Glossary](../../../reference/glossary.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*