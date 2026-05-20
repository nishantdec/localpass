[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Module: layout.py

The `layout.py` module defines the global, unified TUI layout template system for localpass. It provides a standardized double-bordered, full-screen frame with a dynamic header and a shortcut-parsed footer, framing every interface screen to ensure visual continuity and a premium keyboard-driven terminal aesthetic.

## Location
`localpass/ui/components/layout.py`

## UI Border Layout & Visual Structure
The container system draws a full-viewport terminal box utilizing double-line and single-line Box-Drawing characters. The standard layout has three distinct zones:
1. **Header Zone:** Left-aligned bright cyan title banner and right-aligned context-aware vault state (e.g., `LOCKED: NO` in bright green, `LOCKED: YES` in warning red, or screen overrides like `SETUP`).
2. **Body Zone:** Standardized viewport area containing the interactive inner screen elements, wrapped within double-line left/right vertical borders.
3. **Footer Zone:** A dark gray background toolbar displaying context shortcut guidelines with dynamic syntax highlighting (e.g., hotkeys colored in cyan, and actions in dark grey).

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║ [Title Banner]                                             [Locked Status]   ║
╟──────────────────────────────────────────────────────────────────────────────╢
║                                                                              ║
║                                                                              ║
║                             Interactive Viewport                             ║
║                                    (Body)                                    ║
║                                                                              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
 [Cyan]key[Gray]:Description     [Cyan]key[Gray]:Description
```

---

## Constants Reference
The layout uses dedicated Unicode Box-Drawing characters:
*   `BOX_TL` (`\u2554`): `╔` (Double-line Top-Left Corner)
*   `BOX_TR` (`\u2557`): `╗` (Double-line Top-Right Corner)
*   `BOX_BL` (`\u255a`): `╚` (Double-line Bottom-Left Corner)
*   `BOX_BR` (`\u255d`): `╝` (Double-line Bottom-Right Corner)
*   `BOX_H`  (`\u2550`): `═` (Double-line Horizontal Border Segment)
*   `BOX_V`  (`\u2551`): `║` (Double-line Vertical Border Segment)
*   `DIV_L`  (`\u255f`): `╟` (Double-to-Single Line Junction Left)
*   `DIV_R`  (`\u2562`): `╢` (Double-to-Single Line Junction Right)
*   `DIV_H`  (`\u2500`): `─` (Single-line Horizontal Divider)

---

## Dependencies
*   `prompt_toolkit.layout.containers.HSplit` — Vertical layout block stacker.
*   `prompt_toolkit.layout.containers.VSplit` — Horizontal layout block stacker.
*   `prompt_toolkit.layout.containers.Window` — Individual rendering viewport wrapper.
*   `prompt_toolkit.layout.containers.AnyContainer` — Generic prompt_toolkit layout type.
*   `prompt_toolkit.layout.controls.FormattedTextControl` — Styled text processor.
*   `localpass.ui.app.app_instance` — Session and vault status queries.

---

## Exports & Public Interface

### `create_screen_layout(title: str, body: AnyContainer, footer_text: str = "", right_header: str = "") -> AnyContainer`
Constructs the full screen surrounding wrapper using double-line border elements.

**Parameters:**
*   `title` (`str`): The primary screen header text, placed on the left side of the header. Colored in bright cyan (`fg:#00afff bold`).
*   `body` (`AnyContainer`): The primary interior prompt_toolkit container showing the main content of the screen.
*   *Optional* `footer_text` (`str`): A custom formatted string containing shortcuts separated by three spaces (e.g. `n:New   s:Search`). If provided, keyboard triggers (before the colon) are styled in cyan (`fg:#00afff`) and action labels in muted gray (`fg:#626262`). If empty, the footer row is excluded (`Window(height=0)`).
*   *Optional* `right_header` (`str`): An override value to put on the top-right header corner. If not supplied, defaults to checking the active vault session status (`"LOCKED: NO"` if vault data exists, otherwise `"LOCKED: YES"`).

**Returns:**
*   `AnyContainer`: A compiled `HSplit` layout stack representing the complete double-bordered frame structure.

**Called by:**
*   `localpass/ui/screens/unlock.py` (`build_unlock`)
*   `localpass/ui/screens/dashboard.py` (`build_dashboard`)
*   `localpass/ui/screens/entry_view.py` (`build_entry_view`)
*   `localpass/ui/screens/entry_edit.py` (`build_entry_edit`)
*   `localpass/ui/screens/entry_new.py` (`build_entry_new`)
*   `localpass/ui/screens/search.py` (`build_search`)
*   `localpass/ui/screens/settings.py` (`build_settings`)

**Calls:**
*   `prompt_toolkit.layout.containers.HSplit`
*   `prompt_toolkit.layout.containers.VSplit`
*   `prompt_toolkit.layout.containers.Window`
*   `prompt_toolkit.layout.controls.FormattedTextControl`
*   `localpass.ui.app.app_instance.vault_data`

---

## Core Internal Implementations

### Dynamic Header Rendering
The top header split layout contains a left window with the styled title and a right window containing the lock status.
```python
def get_header_text():
    return [("fg:#00afff bold", f" {title} ")]

def get_right_text():
    nonlocal right_header
    if not right_header:
        from localpass.ui.app import app_instance
        right_header = "LOCKED: NO" if app_instance.vault_data else "LOCKED: YES"
        
    if "NO" in right_header.upper() or right_header == "SETUP" or "NEW ENTRY" in right_header.upper() or "EDIT ENTRY" in right_header.upper():
        color = "fg:#5fff87" # Green-tinted for safe/active states
    else:
        color = "fg:#ff5f5f" # Warning Red for Locked state
        
    return [(color, f" {right_header} ")]
```

### Dynamic Footer Tokenizer
The footer parsing routine processes shortcuts using character splits on triple-space (`"   "`) separators:
```python
def get_footer_text():
    parts = footer_text.split("   ")
    styled = []
    for part in parts:
        if ":" in part:
            key, desc = part.split(":", 1)
            styled.append(("fg:#00afff", key))
            styled.append(("fg:#626262", f":{desc}   "))
        else:
            styled.append(("fg:#626262", f"{part}   "))
    return styled
```

---

## Working Code Example

Below is a complete, standalone example showcasing how to create and mount a custom body panel within the standard layout system:

```python
from prompt_toolkit.layout.containers import Window, HSplit
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.application import Application
from prompt_toolkit.layout import Layout
from localpass.ui.components.layout import create_screen_layout

# 1. Define custom screen content
body_content = HSplit([
    Window(
        content=FormattedTextControl([
            ("fg:#ffffff", "\n  Welcome to a Custom Developer Screen!\n\n"),
            ("class:accent", "  * This panel is safely wrapped within double borders.\n"),
            ("", "  * Hit Esc/q to return.\n")
        ]),
        height=5
    )
])

# 2. Build the wrapped container structure
wrapped_layout = create_screen_layout(
    title="DEV MONITOR",
    body=body_content,
    footer_text="q:Quit   r:Refresh   s:Save Settings",
    right_header="DEBUGGING ACTIVE"
)

# 3. Mount and initialize the prompt_toolkit application layout
layout = Layout(container=wrapped_layout)
app = Application(layout=layout, full_screen=True)

if __name__ == "__main__":
    # In practice, this is run inside the main loop context
    print("Screen Layout structure compiled successfully.")
```

---

## See Also
- [App](../app.md)
- [Dashboard Screen](../screens/dashboard.md)
- [Totp Display Component](totp-display.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*