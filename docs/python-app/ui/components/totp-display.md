[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Module: totp_display.py

The `totp_display.py` component provides a dynamic rendering window for Time-Based One-Time Passwords (TOTP). It automatically calculates and shows the current active code, a visual progress count-down bar, and the next two sequential codes (in 30s and 60s) to give users comfortable leeway when copying passwords near step boundaries.

## Location
`localpass/ui/components/totp_display.py`

## Visual Design & ASCII Layout
The TOTP display renders as a high-fidelity visual card showing active states and dynamic indicators:

### Active State Rendering
```text
  TOTP CODES
  Current  : 592813    [======-----]  16s left
  In 30s   : 928401
  In 60s   : 104839
```

### Empty/Inactive State Rendering
```text
  No TOTP secret available.
```

---

## Dependencies
*   `prompt_toolkit.layout.containers.Window` — Single layout window.
*   `prompt_toolkit.layout.controls.FormattedTextControl` — Renders the styled dynamic string blocks.
*   `typing.Callable` — Type definition for the data supplier callback.
*   `typing.Tuple` — Type definition for the returned data tuple.

---

## Exports & Public Interface

### `create_totp_display(get_totp_data: Callable[[], Tuple[str, str, str, int] | None]) -> Window`
Creates a dedicated prompt_toolkit text window designed specifically for displaying real-time rolling TOTP data.

**Parameters:**
*   `get_totp_data` (`Callable[[], Tuple[str, str, str, int] | None]`): An external data callback function that returns either:
    *   A 4-element `Tuple` containing:
        1.  `current` (`str`): The current 6-digit or 8-digit OTP string.
        2.  `in_30` (`str`): The anticipated OTP code for the next 30-second epoch.
        3.  `in_60` (`str`): The anticipated OTP code for the 60-second epoch.
        4.  `remaining` (`int`): The integer seconds (0 to 30) before the current epoch expires.
    *   `None`: If no valid TOTP seed secret exists in the active entry.

**Returns:**
*   `Window`: A prompt_toolkit `Window` control configured with a fixed `height=6` containing the custom dynamic formatter.

**Called by:**
*   `localpass/ui/screens/entry_view.py` (`build_entry_view`)

**Calls:**
*   `prompt_toolkit.layout.containers.Window`
*   `prompt_toolkit.layout.controls.FormattedTextControl`

---

## Core Internal Implementations

### Dynamic Text Formatter and Progress Bar Calculation
The interior logic updates reactively every time the terminal invalidates the window layout:
```python
def _get_text():
    data = get_totp_data()
    if not data:
        return [("class:muted", "  No TOTP secret available.\n")]
        
    current, in_30, in_60, remaining = data
    
    # Calculate progress bar length (total 11 chars as per mockup [====-------])
    total_bars = 11
    # remaining is out of 30
    filled = int((remaining / 30.0) * total_bars)
    empty = total_bars - filled
    bar = f"[{'=' * filled}{'-' * empty}]"
    
    lines = [
        ("class:accent bold", "  TOTP CODES\n"),
        ("", f"  Current  : "),
        ("class:success bold", f"{current}    "),
        ("class:accent", f"{bar}  {remaining}s left\n"),
        ("", f"  In 30s   : {in_30}\n"),
        ("", f"  In 60s   : {in_60}\n")
    ]
    return lines
```

---

## Working Code Example

Below is a complete, standalone example demonstrating how to integrate the `totp_display` component with a dummy data generator:

```python
from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.application import Application
from prompt_toolkit.layout import Layout
from localpass.ui.components.totp_display import create_totp_display

# 1. Define a dummy TOTP provider callback simulating a live generator
def mock_totp_provider():
    # Simulates a rolling timer showing 18 seconds remaining
    current_code = "839401"
    next_code_30s = "120493"
    next_code_60s = "749201"
    seconds_left = 18
    return (current_code, next_code_30s, next_code_60s, seconds_left)

# 2. Build the display component
totp_panel = create_totp_display(get_totp_data=mock_totp_provider)

# 3. Mount and launch inside a basic layout container
wrapped_layout = HSplit([totp_panel])
layout = Layout(container=wrapped_layout)
app = Application(layout=layout, full_screen=False)

if __name__ == "__main__":
    print("TOTP display window successfully initialized.")
```

---

## See Also
- [App](../app.md)
- [Entry View Screen](../screens/entry-view.md)
- [Totp](../../core/totp.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*