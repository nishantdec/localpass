[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Settings Screen Specification (`settings.py`)

The `settings.py` module defines the configuration interface for the localpass TUI. It provides direct, interactive toggles for application parameters (such as Auto-Lock idle limits and Clipboard clean-up timeouts), displays read-only metrics about the active decrypted database file on disk, and persists changes instantly to the centralized `config.json` storage file.

---

## 1. Visual Presentation & Form Layout

The settings screen divides parameters into three visual categories: **Auto-Lock**, **Clipboard**, and **Vault**. It uses horizontal separator lines and applies custom background highlights to the currently active row.

### Styled ASCII Settings Screen Layout
```
  ┌────────────────────────────────────────────────────────┐
  │ localpass                                   SETTINGS │
  ├────────────────────────────────────────────────────────┤
  │                                                        │
  │   AUTO-LOCK                                            │
  │  ────────────────────────────────────────────────────  │
  │    Enabled                 [X]  Space/Enter to toggle  │  <-- Focused Toggle (bg:#003040)
  │    Idle timeout            15 minutes                  │
  │  ────────────────────────────────────────────────────  │
  │                                                        │
  │   CLIPBOARD                                            │
  │  ────────────────────────────────────────────────────  │
  │    Clear clipboard after   30 seconds                  │
  │  ────────────────────────────────────────────────────  │
  │                                                        │
  │   VAULT                                                │
  │  ────────────────────────────────────────────────────  │
  │    Vault location          ...North\.locker\vault.nlk  │
  │    Vault size              4.8 KB                      │
  │    Total entries           14                          │
  │  ────────────────────────────────────────────────────  │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

### Style Token Dictionary
*   **Active Row Highlight:** `bg:#003040` (Rich teal highlight background).
*   **Section Headers:** `fg:#ffffff bold` (High-contrast pure white bold).
*   **Active Configurations Values:** `fg:#00afff bold` (Vibrant blue highlights).
*   **Enabled / Active Status:** `fg:#5fff87` (Vibrant green indicator).
*   **Disabled / Warning Status:** `fg:#444444` (Dim gray labels).
*   **Borders & Lines:** `char="\u2500"`, `style="fg:#333333"` (Dim gray separators).

---

## 2. Configuration Options Mapping

### Idle Auto-Lock Timeouts (`IDLE_OPTIONS`)
Maps display labels to active auto-lock time triggers (stored in minutes):

```python
IDLE_OPTIONS = [
    ("Never", 0),
    ("1 minute", 1),
    ("5 minutes", 5),
    ("15 minutes", 15),
    ("30 minutes", 30),
    ("1 hour", 60),
]
```

### Clipboard Clear Timeouts (`CLIPBOARD_OPTIONS`)
Maps display labels to active clipboard-clearing time triggers (stored in seconds):

```python
CLIPBOARD_OPTIONS = [
    ("5 seconds", 5),
    ("10 seconds", 10),
    ("15 seconds", 15),
    ("30 seconds", 30),
    ("1 minute", 60),
    ("Never", 0),
]
```

---

## 3. Keyboard Shortcut Action Table

Keystrokes are captured globally across the settings screen layout:

| Keystroke | Active UI Scope / Context | Decoupled UI Action |
| :--- | :--- | :--- |
| `escape` | Global | Returns cleanly to the Dashboard screen (`build_dashboard()`). |
| `up` | Global | Moves active row highlight index upwards. |
| `down` or `tab` | Global | Moves active row highlight index downwards. |
| `space` or `enter` | Only on `autolock_enabled` row | Toggles the active boolean state, updating and saving configuration. |
| `right` | On dropdown rows | Increments option selection index, updating and saving configuration. |
| `left` | On dropdown rows | Decrements option selection index, updating and saving configuration. |

---

## 4. Technical Function Index

### `_find_option_idx`
```python
def _find_option_idx(options: list, value: Any) -> int:
```
*   **Description:** Iterates through options lists to locate a stored value, returning its index. Returns `0` if not found.
*   **Parameters:**
    *   `options` (`list`): List of tuples containing option mappings.
    *   `value` (`Any`): The active setting value loaded from the user configuration.
*   **Returns:** `int` matching index value.
*   **Caller Files:** `localpass/ui/screens/settings.py` (during screen state hydration)
*   **Callee Functions:** None
*   **Working Example:**
    ```python
    from localpass.ui.screens.settings import _find_option_idx, CLIPBOARD_OPTIONS
    idx = _find_option_idx(CLIPBOARD_OPTIONS, 15)
    print(f"Index: {idx}") # Yields 2
    ```

---

### `build_settings`
```python
def build_settings() -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Hydrates form states from the configuration manager, instantiates selection indexes, registers keybindings, defines visual row render builders, and packages the layout.
*   **Parameters:** None
*   **Returns:** `Container` - Screen layout wrapped via `create_screen_layout`.
*   **Caller Files:** `localpass/ui/screens/dashboard.py` (when setting command `t`/`T` is pressed)
*   **Callee Functions:** 
    *   `_find_option_idx`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `localpass.utils.paths.get_vault_path`
    *   `localpass.utils.paths.get_app_dir`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.settings import build_settings
    from localpass.ui.app import app_instance

    # Change active screen stack to settings panel
    app_instance.set_screen(build_settings())
    ```

---

### `section_header`
```python
def section_header(title: str) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** UI decorator helper creating visual section category headers.
*   **Parameters:**
    *   `title` (`str`): Section title.
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_settings`

---

### `render_row`
```python
def render_row(row_key: str) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Visual generator closure that formats settings entries with highlighting. It applies specific styling properties depending on row focus and status parameters.
*   **Parameters:**
    *   `row_key` (`str`): Stored configuration mapping string key (one of `ROWS`).
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_settings` (during layout tree construction)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

### `render_vault_info`
```python
def render_vault_info() -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Collects and formats local vault file metrics, performing byte conversion calculations, counting records, and truncating paths to prevent visual wrapping errors.
*   **Parameters:** None
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_settings` (during layout tree construction)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`, `os.path.getsize`

---

## 5. Directory Path Truncation Logic

To maintain neat, unwrapped boundaries within the 58-character constraints, the vault path display automatically truncates long folder chains down to a maximum of 50 characters, preserving the filename suffix:

```python
vault_path = get_vault_path()  # "C:\Users\North\.gemini\antigravity\scratch\vault.nlk"
vault_str = str(vault_path)
if len(vault_str) > 50:
    vault_str = "..." + vault_str[-47:]  # Truncates middle characters
```
This ensures high path resolution transparency without compromising terminal alignment layout integrity.

---

## See Also
- [App](../app.md)
- [Config](../../utils/config.md)
- [Config Reference](../../../reference/config-reference.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*