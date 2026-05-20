[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# New Entry Screen Specification (`entry_new.py`)

The `entry_new.py` module defines the terminal-based interactive creation form used to add a new credential set to the decrypted in-memory vault. It shares key layout paradigms with `entry_edit.py`, but includes unique logic to instantiate a new `LoginEntry` object, inject it into the vault array, and persist it to disk.

---

## 1. Interaction Paradigm & Navigation Flow

The screen is constructed dynamically with a clean input canvas, ready to receive new information. It features the same responsive blue-bordered visual indicators, password eye-masking controls, dynamic complexity meters, and keyboard shortcuts as the editor screen.

### Navigation Keybindings Matrix
*   **Navigate Between Inputs:** `tab` / `down` (focus next input) or `shift-tab` / `up` (focus previous input).
*   **Jump to Field (1-6):** Pressing key `1`-`6` when no inputs have focus moves cursor directly to:
    1. Title Field
    2. Username Field
    3. Password Field
    4. URL Field
    5. TOTP Secret Field
    6. Notes Field
*   **Password Generator Hotkey:** `Ctrl+G` (runs `generate_password()` from the generator utility to fill the password input with secure entropy).
*   **Masking Toggle:** `Ctrl+R` (toggles character masking `state['show_pass']`).
*   **Save Entry:** `Ctrl+S` (commits input parameters to disk).
*   **Cancel & Exit:** `escape` (discards all text inputs and returns to the dashboard).

---

## 2. Dynamic Input Fields & Style Bindings

All input elements utilize localized styling rules linked to user focus:

```python
title_field = TextArea(multiline=False)
user_field = TextArea(multiline=False)
pass_field = TextArea(multiline=False, password=Condition(lambda: not state['show_pass']))
url_field = TextArea(multiline=False)
totp_field = TextArea(multiline=False)
notes_field = TextArea()

for field in [title_field, user_field, pass_field, url_field, totp_field, notes_field]:
    field.window.style = lambda f=field: "fg:#ffffff" if app_instance.layout.has_focus(f) else "fg:#626262"
```

*   `title_field`: Single-line text input for entry title. Must not be empty to save.
*   `user_field`: Single-line text input for username.
*   `pass_field`: Single-line text input with mask support. Binds `Ctrl+G` (generate) and `Ctrl+R` (reveal).
*   `url_field`: Single-line text input for website address.
*   `totp_field`: Single-line text input for dynamic 2FA secret token seeds.
*   `notes_field`: Multi-line text block for freeform descriptions.

---

## 3. Function & Helper Index

### `build_entry_new`
```python
def build_entry_new() -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Instantiates clean text input buffers, binds layout highlight rules, configures form validation parameters, handles shortcut events, and returns the finished UI page.
*   **Parameters:** None
*   **Returns:** `Container` - High-fidelity composite screen layout compiled via `create_screen_layout`.
*   **Caller Files:** `localpass/ui/screens/dashboard.py` (when the new command shortcut `n`/`N` is typed)
*   **Callee Functions:** 
    *   `prompt_toolkit.widgets.TextArea`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `prompt_toolkit.filters.Condition`
    *   `localpass.core.entries.LoginEntry`
    *   `localpass.core.vault.save_vault`
    *   `localpass.utils.paths.get_vault_path`
    *   `localpass.core.generator.generate_password`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.entry_new import build_entry_new
    from localpass.ui.app import app_instance

    # Initialize blank input screen
    app_instance.set_screen(build_entry_new())
    ```

---

### `get_strength_bar`
```python
def get_strength_bar(password: str) -> tuple[str, str, str]:
```
*   **Description:** Measures input complexity and returns details regarding block layout, styling color tokens, and strength labels.
*   **Parameters:**
    *   `password` (`str`): The raw string contents of the password input.
*   **Returns:** `tuple[str, str, str]` - Consists of (visual progress bar, color style token, strength level text).
*   **Caller Functions:** `build_entry_new` (within password dynamic strength row rendering callback)
*   **Callee Functions:** `localpass.core.generator.evaluate_strength`

---

### `render_divider`
```python
def render_divider(field_above: Optional[TextArea], field_below: Optional[TextArea] = None) -> prompt_toolkit.layout.containers.Window:
```
*   **Description:** Renders dynamic borders between input boxes. The border changes color to `fg:#00afff` (highlighted blue) when the user focuses on either the input box above or below the border.
*   **Parameters:**
    *   `field_above` (`Optional[TextArea]`): Text input element sitting directly above the line.
    *   `field_below` (`Optional[TextArea]`): Text input element sitting directly below the line.
*   **Returns:** `Window` container.
*   **Caller Functions:** `build_entry_new`

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
*   **Returns:** `HSplit` container.
*   **Caller Functions:** `build_entry_new`

---

### `_is_field_focused`
```python
def _is_field_focused() -> bool:
```
*   **Description:** Performs check whether any text input on the form has active user focus. Used to determine if numeric key inputs (`1`-`6`) should be interpreted as field jump commands or raw text input characters.
*   **Parameters:** None
*   **Returns:** `bool` - `True` if any input is actively focused, otherwise `False`.
*   **Caller Functions:** `build_entry_new` (within numeric key shortcut callbacks)

---

## 4. Entry Ingress & Storage Lifecycle (Ctrl+S Save Flow)

```
[User triggers Ctrl+S]
         │
         ▼
[Check Field: Title] ──[Empty]──> [Abort & Return]
         │
     [Has Text]
         │
         ▼
[Instantiate LoginEntry Class]
└── entry = LoginEntry(
        title=title_field.text.strip(),
        username=user_field.text.strip(),
        password=pass_field.text,
        url=url_field.text.strip(),
        totp_secret=totp_field.text.strip() or None,
        notes=notes_field.text.strip(),
        type="login"
    )
         │
         ▼
[Append to Vault list]
└── app_instance.vault_data.logins.append(entry)
         │
         ▼
[Symmetric Vault Serialization]
└── save_vault(get_vault_path(), active_key, app_instance.vault_data)
         │
         ▼
[Transition Screen View]
└── Navigate back to Dashboard (build_dashboard())
```

---

## See Also
- [App](../app.md)
- [Dashboard Screen](dashboard.md)
- [Generator Screen](generator.md)
- [Entries](../../core/entries.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*