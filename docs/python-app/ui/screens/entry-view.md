[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Entry View Screen Specification (`entry_view.py`)

The `entry_view.py` module defines the detailed inspection view for individual vault entries. It acts as the primary access terminal for reading credentials, copying usernames, passwords, or TOTP codes to the system clipboard (with auto-clear parameters), initiating editing sessions, deleting records, and driving real-time asynchronous background rendering updates for dynamic TOTP progress wheels.

---

## 1. Interaction Keys & Keyboard Actions

Keystrokes are captured globally on a hidden focused window widget:

| Keystroke | UI Label / Hint | Cryptographic & System Actions |
| :--- | :--- | :--- |
| `u` or `U` | `Copy User` | Copies the username value to the clipboard. Clears after configuration limits. |
| `c` or `C` | `Copy Pass` | Copies the plaintext password value to the clipboard. Clears after configuration limits. |
| `t` or `T` | `Copy TOTP` | Generates and copies the active 6-digit TOTP string (no spaces) to the clipboard. |
| `e` or `E` | `Edit` | Cleans up the TOTP task loop and transitions to `build_entry_edit(entry)`. |
| `d` or `D` | `Delete` | Removes the active record from the vault list, saves the vault file, and returns to Dashboard. |
| `escape` | `Back` | Cleans up the TOTP task loop and returns to the search view. |

---

## 2. Dynamic Asynchronous TOTP Engine

When a viewed entry contains a `totp_secret`, the screen automatically creates a background event task:

```
[Entry has totp_secret]
         │
         ▼
[create_totp_display] ──> Hydrate initial OTP and time-remaining values
         │
         ▼
[Spawn update_totp task] (asyncio.create_task)
   │
   ├─> Loop:
   │    ├── asyncio.sleep(1) (Idle wait)
   │    ├── app_instance.application.invalidate() (Force prompt_toolkit redraw)
   │    └── Repeat
   │
   ▼
[Task Registration]
└── Registered under app_instance.totp_task to prevent memory leaks
```

> [!IMPORTANT]
> **Memory Leak Prevention:** If a user exits the screen (by pressing `escape`, `e` or `d`), the application **MUST** call `cleanup_task()`. This helper synchronously cancels the `totp_task` loop to prevent background timers from running indefinitely and causing memory leaks or terminal crash exceptions.

---

## 3. Function & Helper Reference

### `build_entry_view`
```python
def build_entry_view(entry: Any) -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Constructs the read-only inspection grid representing a single `Entry`, initializes clipboard triggers, registers screen-level navigation keybindings, starts the async TOTP loop if needed, and returns the compiled screen.
*   **Parameters:**
    *   `entry` (`Any`): The active `Entry` object model instance being inspected (such as `LoginEntry`).
*   **Returns:** `Container` - Screen layout wrapped via `create_screen_layout`.
*   **Caller Files:** 
    *   `localpass/ui/screens/search.py` (When a search result item is clicked or selected with `enter`)
    *   `localpass/ui/screens/entry_edit.py` (When editing is committed via `Ctrl+S` or cancelled via `escape`)
*   **Callee Functions:** 
    *   `prompt_toolkit.layout.containers.Window`
    *   `prompt_toolkit.layout.containers.HSplit`
    *   `prompt_toolkit.layout.containers.VSplit`
    *   `prompt_toolkit.layout.controls.FormattedTextControl`
    *   `localpass.ui.components.totp_display.create_totp_display`
    *   `localpass.core.totp.get_totp_info`
    *   `localpass.utils.clipboard.copy_to_clipboard`
    *   `localpass.ui.components.layout.create_screen_layout`
    *   `asyncio.create_task`
*   **Working Example:**
    ```python
    from localpass.ui.screens.entry_view import build_entry_view
    from localpass.ui.app import app_instance

    # Fetch login entry and navigate to inspector view
    login = app_instance.vault_data.logins[0]
    app_instance.set_screen(build_entry_view(login))
    ```

---

### `cleanup_task`
```python
def cleanup_task() -> None:
```
*   **Description:** Performs clean-up operations before transitioning away from the screen. Safely cancels the active async TOTP background wheel update thread loop.
*   **Parameters:** None
*   **Returns:** None
*   **Caller Functions:** `build_entry_view` (internally within key bindings for `escape`, `e`/`E`, and `d`/`D`)
*   **Callee Functions:** `asyncio.Task.cancel`

---

### `render_row`
```python
def render_row(label: str, value_str: str, key_hint: str = "") -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Renders a aligned metadata details row, dynamically outputting custom key action highlights. Masking is automatically applied to password values prior to printing.
*   **Parameters:**
    *   `label` (`str`): Section title.
    *   `value_str` (`str`): Plaintext parameter value.
    *   `key_hint` (`str`): Keyboard action shortcut tip (e.g. `"u"` or `"c"`).
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_entry_view` (internally during row construction)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

### `render_msg`
```python
def render_msg() -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Closed visual container block that displays green status feedback text when credentials have been copied to the clipboard.
*   **Parameters:** None
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_entry_view`
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

## 4. Deletion Pipeline Diagram

```
[User triggers Deletion Key 'D']
               │
               ▼
[Scan Active Vault Lists for Entry Reference]
 ├── If entry in logins  ──> remove from logins list
 └── If entry in notes   ──> remove from notes list
               │
               ▼
   [Erase Primary Storage]
   └── save_vault(get_vault_path(), active_key, app_instance.vault_data)
               │
               ▼
  [Erase Background Event Loops]
  └── cleanup_task() (Cancel TOTP async timer)
               │
               ▼
    [Route UI Navigation]
    └── Navigate back to Dashboard screen (build_dashboard())
```

---

## See Also
- [App](../app.md)
- [Dashboard Screen](dashboard.md)
- [Entry Edit Screen](entry-edit.md)
- [Totp Display Component](../components/totp-display.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*