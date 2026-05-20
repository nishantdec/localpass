[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Password Generator Screen Specification (`generator.py`)

The `generator.py` module defines the interactive, fully customizable cryptographically secure Password Generator interface. Designed for the localpass Terminal User Interface (TUI), it enables real-time adjustments of password length (8 to 128 characters), toggle controls for individual character classes (Uppercase, Lowercase, Numbers, Symbols), and specific character minimum bounds, while featuring automatic safety capping, persistence options, and clipboard integrations.

---

## 1. Visual Presentation & Console Layout

The screen is formatted to sit inside a 58-character centered grid. It features a bold double-line border box encapsulating the active password generation output, responsive backgrounds highlighting the selected row, and a progress summary at the bottom.

### Double-Line ASCII Display Layout
```
  ╔════════════════════════════════════════════════════════╗
  ║  Generated Password:                                   ║
  ║  a9!K#L2pQ9$zV7@xR4*yB8%m                              ║
  ╚════════════════════════════════════════════════════════╝
  ──────────────────────────────────────────────────────────
    [+/-]  Length      24          max:128  min:8
  ──────────────────────────────────────────────────────────
    [u]  Uppercase   [X]    Min: [+]  2  [-]  <-- Focused Row (bg:#003040)
    [l]  Lowercase   [X]    Min: [+]  2  [-]
    [n]  Numbers     [X]    Min: [+]  2  [-]
    [s]  Symbols     [X]    Min: [+]  1  [-]
  ──────────────────────────────────────────────────────────
    Guaranteed: 7 of 24 chars assigned
    Remaining:  17 filled randomly from 4 enabled class(es)
  ──────────────────────────────────────────────────────────
    [m]  Remember these settings  [X]
    Copied to clipboard!
```

### Aesthetic Styling Rules
*   **Double-Line Borders (`BOX_*`):** Uses custom box unicode symbols (`\u2554`, `\u2557`, `\u255a`, `\u255d`, `\u2550`, `\u2551`).
*   **Active Selection Row Background:** `bg:#003040` (Rich teal highlight background).
*   **Input shortcuts labels:** `fg:#00afff bold` (Vibrant blue highlights).
*   **Enabled / Active Status:** `fg:#5fff87` (Vibrant green indicator).
*   **Disabled / Warning Status:** `fg:#ff5f5f` (Soft red warning labels).

---

## 2. Character Classes Reference

Four distinct character classes are managed inside the module's localized state structures:

| Class Key | Display Name | Internal Source Character Set | Default Minimum |
| :--- | :--- | :--- | :--- |
| `u` / `U` | Uppercase | `string.ascii_uppercase` (`A-Z`) | `2` |
| `l` / `L` | Lowercase | `string.ascii_lowercase` (`a-z`) | `2` |
| `n` / `N` | Numbers | `string.digits` (`0-9`) | `2` |
| `s` / `S` | Symbols | `string.punctuation` (ASCII punctuation marks) | `1` |

---

## 3. Keyboard Matrix Reference

Keystrokes are captured globally across the layout via a hidden focus control:

| Keystroke | Bound Action | Functionality |
| :--- | :--- | :--- |
| `escape` | `Back` | Returns cleanly to the Dashboard screen (`build_dashboard()`). |
| `r` or `R` | `Regen` | Generates a fresh password using active settings. |
| `c` or `C` | `Copy` | Copies the current password text to the system clipboard. |
| `m` or `M` | `Remember` | Toggles persistence of generator settings to `config.json`. |
| `Ctrl+D` (`c-d` | `Reset` | Resets length, character selections, and minimum bounds to default states. |
| `+` or `=` | `Len Up` | Increments password length (maximum ceiling: `128`). |
| `-` or `_` | `Len Down` | Decrements password length (minimum floor: `8`). |
| `up` | `Navigate` | Moves active row highlight index upwards. |
| `down` | `Navigate` | Moves active row highlight index downwards. |
| `right` or `]` | `Min Up` | Increments character class minimum constraint on selected row (maximum: `9`). |
| `left` or `[` | `Min Down` | Decrements character class minimum constraint on selected row (minimum: `0`). |
| `u`, `l`, `n`, `s` | `Toggle` | Toggles matching class enable state. (Keys are case-insensitive). |

---

## 4. Technical Module Functions

### `_load_classes_from_config`
```python
def _load_classes_from_config() -> tuple[int, list[dict]]:
```
*   **Description:** Reads user preferences from `app_instance.config.generator_defaults`. Falls back to default constraints if configurations are uninitialized.
*   **Parameters:** None
*   **Returns:** `tuple[int, list[dict]]` - Tuple containing the target length and list of class settings dictionaries.
*   **Caller Files:** `localpass/ui/screens/generator.py` (during screen initialization)
*   **Callee Functions:** `app_instance.config`

---

### `_save_classes_to_config`
```python
def _save_classes_to_config(length: int, classes: list[dict]) -> None:
```
*   **Description:** Writes the active settings to configuration and saves it to disk.
*   **Parameters:**
    *   `length` (`int`): Target password length.
    *   `classes` (`list[dict]`): Active list of class configurations.
*   **Returns:** `None`
*   **Caller Files:** `localpass/ui/screens/generator.py` (within internal closures)
*   **Callee Functions:** `app_instance.config.save`

---

### `build_generator`
```python
def build_generator() -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Builds the interactive generator screen graph. Instantiates localized states, assigns reactive closures, maps control keybindings, and packages the layout.
*   **Parameters:** None
*   **Returns:** `Container` - High-fidelity composite screen layout compiled via `create_screen_layout`.
*   **Caller Files:** `localpass/ui/screens/dashboard.py` (when key `g`/`G` is pressed)
*   **Callee Functions:** 
    *   `_load_classes_from_config`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `localpass.core.generator.generate_password_with_minimums`
    *   `localpass.utils.clipboard.copy_to_clipboard`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.generator import build_generator
    from localpass.ui.app import app_instance

    # Transitions the UI layout to the generator terminal screen
    app_instance.set_screen(build_generator())
    ```

---

## 5. Constraint Capping & Generation Pipelines

### Safety Capping Algorithm (`enforce_caps`)
To prevent configuration errors (where the sum of the minimum characters requested is larger than the total password length), `enforce_caps()` runs a backward scan to decrease parameters to keep within limits:

```python
def enforce_caps():
    total = total_minimums()
    if total > state['length']:
        state['capped'] = True
        for c in reversed(classes):
            if c['enabled'] and c['minimum'] > 0:
                excess = total_minimums() - state['length']
                if excess <= 0:
                    break
                c['minimum'] -= min(c['minimum'], excess)
    else:
        state['capped'] = False
```

### Visual Process Flow Chart
```
[User modifies length/minimums/toggles]
                  │
                  ▼
         [Run: enforce_caps()]
                  │
        [Check: total_min > length]
        ├── [YES] ──> Mark state['capped'] = True
        │              └── Adjust bounds backwards (Symbols -> Numbers -> Lowercase -> Uppercase)
        └── [NO]  ──> Mark state['capped'] = False
                  │
                  ▼
    [Run: update_result() logic]
    ├── Invoke: generate_password_with_minimums()
    └── If remember active ──> Save settings to configuration file
                  │
                  ▼
         [Invalidate Screen]
         └── Trigger UI redraw cycle to render updated display
```

---

## See Also
- [Entries](../../core/entries.md)
- [Generator Ext](../../../extension/utils/generator.md)
- [Config Reference](../../../reference/config-reference.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*