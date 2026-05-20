[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Edit Entry Screen Specification (`entry_edit.py`)

The `entry_edit.py` module defines the terminal-based interactive editor view for updating existing credential sets within the decrypted vault. It leverages a fully form-oriented layout using `prompt_toolkit` text inputs, dynamic visual border highlight styles responsive to field focus, password complexity visual indicators, CSPRNG password generation, and direct keystroke navigation.

---

## 1. Visual Form Layout & Dynamic Border Styling

The screen wraps inputs in a vertical block layout exactly 58 characters wide, leaving padding to fill out standard width limits. Horizontal divider bars act as visual bounding boxes, lighting up in vibrant blue when adjacent inputs gain focus.

### Form Diagram & Interactive Behavior
```
  +--------------------------------------------------------+
  |  Title                                                 |
  |  > [ My Bank Login                                  ]  |
  +--------------------------------------------------------+
  |  Username                                              |
  |  > [ north_dev                                       ]  |
  +────────────────────────────────────────────────────────+  <-- Dim Divider (fg:#333333)
  |  Password                   Ctrl+G: Gen  Ctrl+R: Show  |
  |  > [ *************                                  ]  |  <-- Focused Row
  |  Strength: STRONG       ███████████████░░░░░            |  <-- Dynamic Indicator
  +────────────────────────────────────────────────────────+  <-- Highlighted (fg:#00afff)
  |  URL                                                   |
  |  > [ https://mybank.com                              ]  |
  +--------------------------------------------------------+
```

### Style Token Specification
*   **Active Input Field:** `fg:#ffffff` (Bright white text value)
*   **Inactive Input Field:** `fg:#626262` (Medium gray value)
*   **Active Row Border & Label:** `fg:#00afff bold` (Highlighted blue border line and label text)
*   **Inactive Row Border:** `fg:#333333` (Dim gray border line)
*   **Helper Hints:** `fg:#626262`

---

## 2. Password Strength Indicator Logic

The password complexity meter visualizes security strength by mapping values extracted from `evaluate_strength()` to character blocks (`\u2588` = solid block, `\u2591` = light shaded grid):

| Strength Category | Active Block Width | Display Color | Evaluated Text |
| :--- | :--- | :--- | :--- |
| `None` (Empty) | `░░░░░░░░░░░░░░░░░░░░` (0 solid) | `fg:#626262` | `NONE` |
| `Weak` | `█████░░░░░░░░░░░░░░░` (5 solid) | `fg:#ff5f5f` (Soft red) | `WEAK` |
| `Fair` | `██████████░░░░░░░░░░` (10 solid) | `fg:#ffff5f` (Soft yellow) | `FAIR` |
| `Strong` | `███████████████░░░░░` (15 solid) | `fg:#00afff` (Soft blue) | `STRONG` |
| `Very Strong` | `████████████████████` (20 solid) | `fg:#5fff87` (Soft green) | `VERY STRONG` |

---

## 3. Keyboard Shortcut Action Table

Keyboard shortcuts are active across all fields, with key binds configured inside a localized `KeyBindings` graph:

| Keystroke | Scope / Context | Decoupled UI Handler Action |
| :--- | :--- | :--- |
| `escape` | Global | Discards changes, returns to the View screen (`build_entry_view(entry)`) |
| `Ctrl+S` (`c-s`) | Global | Validates title; copies state parameters, saves vault file, and redirects back to View |
| `Ctrl+G` (`c-g`) | Only on `pass_field` focus | Replaces input content with a CSPRNG-generated password |
| `Ctrl+R` (`c-r`) | Only on `pass_field` focus | Toggles the boolean state `show_pass`, masking/unmasking password |
| `tab` or `down` | Global | Focuses next logical interactive field (`app.layout.focus_next()`) |
| `s-tab` or `up` | Global | Focuses previous logical interactive field (`app.layout.focus_previous()`) |
| `1` through `6` | When no text inputs have focus | Jumps focus to: 1.Title, 2.Username, 3.Password, 4.URL, 5.TOTP, 6.Notes |

---

## 4. Technical Function Index

### `build_entry_edit`
```python
def build_entry_edit(entry: Any) -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Creates a customizable edit page, maps data from the target `Entry` object into individual form inputs, assigns dynamic style evaluators, registers keyboard shortcuts, and returns the assembled screen container.
*   **Parameters:**
    *   `entry` (`Any`): The active `Entry` object model instance (such as `LoginEntry`).
*   **Returns:** `Container` - Form layout parsed through the master screen decorator.
*   **Caller Files:** `localpass/ui/screens/entry_view.py` (when the edit command `e`/`E` is typed)
*   **Callee Functions:** 
    *   `prompt_toolkit.widgets.TextArea`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `prompt_toolkit.filters.Condition`
    *   `localpass.core.vault.save_vault`
    *   `localpass.utils.paths.get_vault_path`
    *   `localpass.core.generator.generate_password`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.entry_edit import build_entry_edit
    from localpass.ui.app import app_instance

    # Pull active entry from list and initialize editor
    active_entry = app_instance.vault_data.logins[0]
    app_instance.set_screen(build_entry_edit(active_entry))
    ```

---

### `get_strength_bar`
```python
def get_strength_bar(password: str) -> tuple[str, str, str]:
```
*   **Description:** Evaluates password safety parameters and returns details regarding block layout, styling color tokens, and strength labels.
*   **Parameters:**
    *   `password` (`str`): The raw string contents of the password input.
*   **Returns:** `tuple[str, str, str]` - Consists of (visual progress bar, color style token, strength level text).
*   **Caller Functions:** `build_entry_edit` (within password dynamic strength row rendering callback)
*   **Callee Functions:** `localpass.core.generator.evaluate_strength`

---

### `render_divider`
```python
def render_divider(field_above: Optional[TextArea], field_below: Optional[TextArea] = None) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Constructs dynamic borders styled with highlighting. The border changes color to `fg:#00afff` (highlighted blue) when the user focuses on either the input box above or below the border.
*   **Parameters:**
    *   `field_above` (`Optional[TextArea]`): Text input element sitting directly above the line.
    *   `field_below` (`Optional[TextArea]`): Text input element sitting directly below the line.
*   **Returns:** `Window` container containing the styled border line.
*   **Caller Functions:** `build_entry_edit` (during visual graph initialization)
*   **Callee Functions:** `prompt_toolkit.layout.containers.Window`, `prompt_toolkit.layout.controls.FormattedTextControl`

---

### `render_field_body`
```python
def render_field_body(label: str, field: TextArea, is_password: bool = False) -> prompt_toolkit.layout.containers.HSplit:
```
*   **Description:** Wraps input boxes with label tags and custom prompt markers. Automatically appends password helpers and complexity bars if the field is flagged as a password.
*   **Parameters:**
    *   `label` (`str`): The title header label text for the row.
    *   `field` (`TextArea`): The actual input widget.
    *   `is_password` (`bool`): Flag denoting password-specific validation and shortcuts.
*   **Returns:** `HSplit` container containing label, inputs, and optional progress indicators.
*   **Caller Functions:** `build_entry_edit`
*   **Callee Functions:** `prompt_toolkit.layout.containers.HSplit`, `prompt_toolkit.layout.containers.VSplit`, `prompt_toolkit.layout.containers.DynamicContainer`

---

### `_is_field_focused`
```python
def _is_field_focused() -> bool:
```
*   **Description:** Performs check whether any text input on the form has active user focus. Used to determine if numeric key inputs (`1`-`6`) should be interpreted as field jump commands or raw text input characters.
*   **Parameters:** None
*   **Returns:** `bool` - `True` if any input is actively focused, otherwise `False`.
*   **Caller Functions:** `build_entry_edit` (within numeric key shortcut callbacks)
*   **Callee Functions:** `prompt_toolkit.layout.Layout.has_focus`

---

## 5. Persistence Workflow (Ctrl+S Save)

```
[User triggers Ctrl+S]
         │
         ▼
[Check Field: Title] ──[Empty]──> [Abort & Return]
         │
     [Has Text]
         │
         ▼
[Copy Form Values to Entry Object]
├── title      = title_field.text.strip()
├── username   = user_field.text.strip()
├── password   = pass_field.text
├── url        = url_field.text.strip()
├── totp_secret = totp_field.text.strip() or None
└── notes      = notes_field.text.strip()
         │
         ▼
[Update Object Metadata]
└── entry.update_timestamp() (Calculates current UTC ISO-8601 timestamp)
         │
         ▼
[Symmetric Vault Serialization]
└── save_vault(get_vault_path(), active_key, app_instance.vault_data)
         │
         ▼
[Transition Screen View]
└── Navigate back to Entry View Screen (build_entry_view(entry))
```

---

## See Also
- [App](../app.md)
- [Entry View Screen](entry-view.md)
- [Generator Screen](generator.md)
- [Settings Screen](settings.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*