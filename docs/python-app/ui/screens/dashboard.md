[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Dashboard Screen Specification (`dashboard.py`)

The `dashboard.py` module defines the primary console-interface screen rendered immediately after successful vault decryption. It operates as the command hub of the localpass Terminal User Interface (TUI), providing a master directory of operations, direct navigation keybindings, dynamic vault stats, and session locking functions.

---

## 1. Interface Layout & Visual Design

The dashboard layout features high-contrast typographic menu entries, subtle visual horizontal separators, and a bottom stats table. The screen width is aligned within the application's standard 60-character container grid.

### Styled ASCII Layout Representation
```
┌──────────────────────────────────────────────────────────┐
│ localpass                                   LOCKED: NO │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   [N]  New Entry       Add a new login, note or TOTP     │
│  ──────────────────────────────────────────────────────  │
│   [S]  Search          Find and view saved entries       │
│  ──────────────────────────────────────────────────────  │
│   [G]  Generate        Generate a secure password        │
│  ──────────────────────────────────────────────────────  │
│   [L]  Lock            Lock the vault and clear session  │
│  ──────────────────────────────────────────────────────  │
│   [T]  Settings        Configure auto-lock and clipboard │
│  ──────────────────────────────────────────────────────  │
│   [Q]  Quit            Exit localpass                  │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│   Vault entries     : 14                                 │
│   Last unlocked     : Just now                           │
│   Auto-backup       : Disabled                           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ n:New   s:Search   g:Generate   t:Settings   l:Lock  q:Quit│
└──────────────────────────────────────────────────────────┘
```

### Style Token Dictionary
*   **Active Keyboard Shortcuts (`key`):** `fg:#00afff bold` (Neon blue highlight)
*   **Menu Actions:** `fg:#ffffff bold` (High contrast pure white)
*   **Descriptions & Labels:** `fg:#626262` (Subtle medium gray)
*   **Dividers:** `char="\u2500"`, `style="fg:#333333"` (Dim horizontal separator)
*   **Main Section Separator:** `char="\u2500"`, `style="fg:#444444"` (Brighter dividing line)

---

## 2. Keyboard Action Matrix

keystrokes are captured globally on the screen's focus control:

| Keystroke | Bound Action | Destination Screen / Module Event |
| :--- | :--- | :--- |
| `n` or `N` | `New Entry` | Navigates to `build_entry_new()` |
| `s` or `S` | `Search` | Navigates to `build_search()` |
| `g` or `G` | `Generate` | Navigates to `build_generator()` |
| `l` or `L` | `Lock` | Resets `vault_data`, clears `session`, and calls `build_unlock()` |
| `t` or `T` | `Settings` | Navigates to `build_settings()` |
| `q`, `Q` or `escape` | `Quit` | Triggers immediate clean program shutdown (`app_instance.exit()`) |

---

## 3. Function & UI Helper Index

### `build_dashboard`
```python
def build_dashboard() -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Instantiates the dashboard's layout graph, registers local keybindings on a specialized hidden focus control, binds stats callbacks, and returns a fully assembled screen ready for rendering.
*   **Parameters:** None
*   **Returns:** `Container` - A composite container layout output from `create_screen_layout`.
*   **Caller Files:** 
    *   `localpass/ui/app.py` (Default target when loading is complete)
    *   `localpass/ui/screens/unlock.py` (Redirected to upon valid credentials input)
    *   `localpass/ui/screens/entry_new.py` (Returned to on save or cancel)
    *   `localpass/ui/screens/entry_view.py` (Returned to after deletion events)
    *   `localpass/ui/screens/generator.py` (Returned to on escape trigger)
    *   `localpass/ui/screens/settings.py` (Returned to on escape trigger)
    *   `localpass/ui/screens/search.py` (Returned to on escape trigger)
*   **Callee Functions:** 
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `prompt_toolkit.layout.containers.Window`
    *   `prompt_toolkit.layout.containers.HSplit`
    *   `prompt_toolkit.layout.controls.FormattedTextControl`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.dashboard import build_dashboard
    from localpass.ui.app import app_instance

    # Change active window view stack to render dashboard
    app_instance.set_screen(build_dashboard())
    ```

---

### `render_menu_row`
```python
def render_menu_row(key: str, action: str, desc: str) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Internal closure helper that builds a single menu list item styled row. Wraps text evaluation inside a dynamic layout text fetcher to conform to `prompt_toolkit` render cycles.
*   **Parameters:**
    *   `key` (`str`): Single character shortcut keyboard key label.
    *   `action` (`str`): Primary text command name.
    *   `desc` (`str`): Explanatory help string details.
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_dashboard` (internally during graph assembly)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

### `render_stat_row`
```python
def render_stat_row(label: str, value_func: Callable[[], Any]) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Internal closure helper generating formatted statistics metadata lines at the bottom of the screen. Utilizes lazily evaluated callback functions to display real-time variables.
*   **Parameters:**
    *   `label` (`str`): Statistics display title.
    *   `value_func` (`Callable[[], Any]`): Executable functional callback yielding the dynamic metric value.
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_dashboard` (internally during graph assembly)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

### `get_num_entries`
```python
def get_num_entries() -> int:
```
*   **Description:** Retrieves the current combined total number of encrypted elements in the vault (calculating logins + notes lengths). Safe against null pointers when no vault is loaded.
*   **Parameters:** None
*   **Returns:** `int` count of total credential sets.
*   **Caller Functions:** `build_dashboard` (internally for the "Vault entries" display field)
*   **Callee Functions:** None

---

## 4. Keybinding Execution Flow

```
+───────────────────+
| User presses Key  |
+─────────┬─────────+
          │
          ▼
   [Key Bindings]
   ├── "n"/"N"  ───────> Navigate to EntryNew screen
   ├── "s"/"S"  ───────> Navigate to Search screen
   ├── "g"/"G"  ───────> Navigate to Generator screen
   ├── "t"/"T"  ───────> Navigate to Settings screen
   ├── "q"/"Q"/Esc ────> Terminate process cleanly
   │
   └── "l"/"L" (Lock Vault Sequence)
          │
          ▼
     [Reset Session]
     ├── app_instance.vault_data = None
     └── app_instance.session.clear() (Erase crypt key from SecureBuffer RAM)
          │
          ▼
     [Redirect UI]
     └── Navigate back to Unlock screen with a clean canvas
```

---

## See Also
- [App](../app.md)
- [Unlock Screen](unlock.md)
- [Search Screen](search.md)
- [Layout Component](../components/layout.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*