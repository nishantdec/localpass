[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Search Screen Specification (`search.py`)

The `search.py` module defines the interactive search terminal for the localpass TUI. It provides a real-time filter interface that searches the combined list of vault logins and notes, updating results instantly as keys are typed, and using keyboard controls to select and view credentials.

---

## 1. Visual Layout & Interactive Elements

The search layout features a prominent text input field at the top, a horizontal dividing line, and a scrollable results list at the bottom. The search input displays a dynamic command-line arrow prompt prefix that highlights when the field is active.

### Styled ASCII Terminal Diagram
```
  ┌────────────────────────────────────────────────────────┐
  │ SEARCH                                                 │
  ├────────────────────────────────────────────────────────┤
  │                                                        │
  │   > [ bank_                                         ]  │  <-- Focused Text Input
  │                                                        │
  │  ────────────────────────────────────────────────────  │  <-- Separator (fg:#333333)
  │                                                        │
  │    My Bank Login       north_dev         [TOTP]        │  <-- Highlighted Result
  │    Bank of America     boadeveloper                    │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

### Style Token Configuration
*   **Active Cursor Prefix:** `fg:#00afff` (Neon blue dynamic indicator `  > `)
*   **Inactive Cursor Prefix:** `fg:#626262` (Subtle gray indicator `  > `)
*   **Active Text Input Content:** `fg:#ffffff` (High-contrast pure white text)
*   **Inactive Text Input Content:** `fg:#626262` (Medium gray text)

---

## 2. Keyboard Control Mapping

Keystrokes are captured globally across the search screen's container layouts:

| Keystroke | Active UI Scope / Context | Decoupled UI Action |
| :--- | :--- | :--- |
| `escape` | Global | Returns cleanly to the Dashboard screen (`build_dashboard()`). |
| `tab` | Global | Toggles active layout focus between the search text box and the results list. |
| `enter` | Only when `search_field` is focused | Jumps focus down to the first item in the results list container. |
| `enter` | Only when `entry_list` has focus | Opens the highlighted credential record via `build_entry_view(entry)`. |

---

## 3. Technical Function Reference

### `build_search`
```python
def build_search() -> prompt_toolkit.layout.containers.Container:
```
*   **Description:** Constructs the search viewport, fetches active vault elements, binds keyboard shortcuts, maps the real-time search string filters, and returns the assembled TUI screen.
*   **Parameters:** None
*   **Returns:** `Container` - Screen layout wrapped via `create_screen_layout`.
*   **Caller Files:** `localpass/ui/screens/dashboard.py` (when search command `s`/`S` is pressed)
*   **Callee Functions:** 
    *   `prompt_toolkit.widgets.TextArea`
    *   `prompt_toolkit.key_binding.KeyBindings`
    *   `prompt_toolkit.filters.Condition`
    *   `localpass.ui.components.entry_list.EntryList`
    *   `localpass.ui.components.layout.create_screen_layout`
*   **Working Example:**
    ```python
    from localpass.ui.screens.search import build_search
    from localpass.ui.app import app_instance

    # Open search panel
    app_instance.set_screen(build_search())
    ```

---

### `on_select`
```python
def on_select(entry: Any) -> None:
```
*   **Description:** Internal callback invoked when an entry is selected from the results list. Safely redirects the user to the detailed credential view.
*   **Parameters:**
    *   `entry` (`Any`): The active selected `Entry` object model instance.
*   **Returns:** None
*   **Caller Functions:** `EntryList` (when `enter` is pressed on a listed entry)
*   **Callee Functions:** `localpass.ui.screens.entry_view.build_entry_view`

---

### `on_text_changed`
```python
def on_text_changed(buff: prompt_toolkit.buffer.Buffer) -> None:
```
*   **Description:** Real-time character listener hook bound to the search text box. Matches inputs against entry fields, and updates the results view instantly.
*   **Parameters:**
    *   `buff` (`Buffer`): The prompt_toolkit buffer object containing active text strings.
*   **Returns:** None
*   **Caller Functions:** `prompt_toolkit.widgets.TextArea` (triggered on every keystroke input event)
*   **Callee Functions:** `EntryList.update_entries`

---

### `get_prompt`
```python
def get_prompt() -> list[tuple[str, str]]:
```
*   **Description:** Dynamic visual decorator helper that sets the prefix prompt style based on input focus.
*   **Parameters:** None
*   **Returns:** `list[tuple[str, str]]` - Token array containing current style colors and text characters.
*   **Caller Functions:** `TextArea` layout render cycle
*   **Callee Functions:** `prompt_toolkit.layout.Layout.has_focus`

---

## 4. Search Filter & Ingress Logic

```
[User presses key in search box]
               │
               ▼
   [on_text_changed Trigger]
               │
               ▼
[Extract lowercase query string]
 ├── If empty   ──> Keep raw master entries array (logins + notes)
 └── If text    ──> Filter list matching:
                      query in entry.title (case-insensitive) OR
                      query in entry.username (case-insensitive, safe getattr check)
               │
               ▼
[Trigger list update: entry_list.update_entries(filtered)]
               │
               ▼
[Selected Index Validation]
 └── Automatically caps index to max length bounds of new matches
               │
               ▼
[Force repaint cycle to update TUI results viewport]
```

---

## See Also
- [App](../app.md)
- [Dashboard Screen](dashboard.md)
- [Entry View Screen](entry-view.md)
- [Entry List Component](../components/entry-list.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*