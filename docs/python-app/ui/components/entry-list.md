[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Entry List Component Specification (`entry_list.py`)

The `entry_list.py` module defines the primary reusable search result listing component for the localpass TUI. It encapsulates list presentation styles, scrollbar bindings, navigation controls (using `up`/`down` keys), entry formatting logic, and callback execution triggers when list items are selected.

---

## 1. Visual Presentation & Formatted Line Output

The `EntryList` component prints entries inside a grid layout exactly 60 characters wide. Selected items are styled with an inverted background to show which item is currently highlighted.

### Grid Column Alignment Specification
```
  [2 spaces] [Title (20 chars)] [2 spaces] [Username (25 chars)] [2 spaces] [TOTP Tag (6 chars)] [Padding]
```

### Visual Layout Diagram
```
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │   Personal Bank Logi  localpass_dev    [TOTP]        │  <-- Highlighted Row (list.selected reverse)
  │   Github Dev Account  north_coder                      │  <-- Standard Row (list.item)
  │   My Secret Server    root                             │
  │                                                        │
  └─────────────────────────────────▲──────────────────────┘
                                    │  <-- Scrollbar Margin (display_arrows=True)
```

### Style Class Configuration
*   **Active Highlighted Selection:** `"class:list.selected reverse"` (Inverts background and foreground colors).
*   **Default Listed Items:** `"class:list.item"` (Standard typography).
*   **Empty State Text:** `"class:muted"` (Dim gray label displaying `"  No entries found."`).

---

## 2. Interactive Navigation Keybindings

Navigation is handled directly within the component's internal control scope:

*   **Arrow Key `up`:** Decrements the selection pointer index: `self.selected_index = max(0, self.selected_index - 1)`.
*   **Arrow Key `down`:** Increments the selection pointer index: `self.selected_index = min(max(0, len(self.entries) - 1), self.selected_index + 1)`.
*   **Key `enter`:** Triggers the parent's selection callback: `self.on_select(self.entries[self.selected_index])`.

---

## 3. Class & Method Specifications

### `EntryList`
```python
class EntryList:
    def __init__(self, entries: List[Any], on_select: Callable[[Any], None]):
```
*   **Description:** Constructs an instance of the `EntryList` component, maps the inputs array, configures the internal `FormattedTextControl` with reactive closures, binds arrow shortcuts, and wraps the control inside a scrolling container window.
*   **Constructor Parameters:**
    *   `entries` (`List[Any]`): Core list of `Entry` object model references (such as `LoginEntry`).
    *   `on_select` (`Callable[[Any], None]`): Callback function executed when an entry is selected with the `enter` key.
*   **Instance Attributes:**
    *   `entries` (`List[Any]`): Active array reference.
    *   `on_select` (`Callable[[Any], None]`): Callback handler reference.
    *   `selected_index` (`int`): Cursor index pointer (0-indexed).
    *   `control` (`FormattedTextControl`): prompt_toolkit text rendering manager.
    *   `window` (`Window`): Screen container window configured with custom styles and scrollbars.
*   **Caller Files:** `localpass/ui/screens/search.py`
*   **Working Example:**
    ```python
    from localpass.ui.components.entry_list import EntryList
    from localpass.ui.screens.entry_view import build_entry_view
    from localpass.ui.app import app_instance

    def selection_handler(entry):
        # Open detailed credential inspector
        app_instance.set_screen(build_entry_view(entry))

    # Pull decrypted logins list and initialize list component
    entries = app_instance.vault_data.logins
    search_list = EntryList(entries, on_select=selection_handler)

    # Inject search_list.window into any HSplit/VSplit layouts
    ```

---

### `_get_formatted_text`
```python
def _get_formatted_text(self) -> List[tuple[str, str]]:
```
*   **Description:** Formats the active lists list into styled terminal tokens. Applies character padding to align columns, appends the `[TOTP]` flag if the entry has a TOTP secret, and renders a fallback message if the list is empty.
*   **Parameters:** None
*   **Returns:** `List[tuple[str, str]]` - Token array containing current style colors and text characters.
*   **Caller Functions:** `FormattedTextControl` layout render cycle
*   **Callee Functions:** None

---

### `_get_key_bindings`
```python
def _get_key_bindings(self) -> prompt_toolkit.key_binding.KeyBindings:
```
*   **Description:** Creates and returns a `KeyBindings` object mapping the `up`, `down`, and `enter` keys.
*   **Parameters:** None
*   **Returns:** `KeyBindings` mapped container.
*   **Caller Functions:** `__init__` (during control setup)
*   **Callee Functions:** `prompt_toolkit.key_binding.KeyBindings`

---

### `update_entries`
```python
def update_entries(self, entries: List[Any]) -> None:
```
*   **Description:** Updates the internal list reference to a new list (e.g. after search filtering), and adjusts the selected index to stay within the boundaries of the updated matches list.
*   **Parameters:**
    *   `entries` (`List[Any]`): A new list of entries.
*   **Returns:** None
*   **Caller Files:** `localpass/ui/screens/search.py`
*   **Callee Functions:** None
*   **Working Example:**
    ```python
    # After a user types to filter results:
    filtered_results = [e for e in all_entries if "bank" in e.title.lower()]
    search_list.update_entries(filtered_results)
    # The component immediately updates its contents and resets its cursor bounds safely
    ```

---

## See Also
- [App](../app.md)
- [Search Screen](../screens/search.md)
- [Dashboard Screen](../screens/dashboard.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*