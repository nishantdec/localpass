from prompt_toolkit.layout.containers import Window
from prompt_toolkit.layout.controls import FormattedTextControl
from typing import Callable, Tuple

def create_totp_display(get_totp_data: Callable[[], Tuple[str, str, str, int] | None]) -> Window:
    """Creates a window that displays TOTP information."""
    
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

    return Window(
        content=FormattedTextControl(_get_text),
        height=6
    )
