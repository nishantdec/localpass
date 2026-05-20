[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: clipboard.py

The `clipboard.py` module provides utility routines for placing decrypted sensitive credentials onto the system clipboard. It implements an automatic, secure teardown mechanism: spawning an asynchronous daemon thread that clears the clipboard after a configurable interval (defaulting to 15 seconds), but only if the user hasn't overwritten the clipboard with another value in the interim.

## Location
`localpass/utils/clipboard.py`

## Clipboard Security Lifecycle
Below is a timeline diagram of the clipboard auto-clear security protocol, demonstrating how preemptive manual copy overrides are safely preserved:

### Case 1: Standard Auto-Clear Timeline
```text
  t=0s                              t=15s
  User copies password              Timer expires
  [ Clipboard: "P@ssw0rd123" ] ───► [ Clipboard checked: Matches? YES ] ───► Cleared to [ "" ]
```

### Case 2: Preemptive Override Timeline
```text
  t=0s             t=5s                                  t=15s
  User copies pass User copies something else            Timer expires
  [ "P@ss123" ] ──► [ Clipboard: "Other public text" ] ──► [ Check: Matches "P@ss123"? NO ] ──► Preserved!
```

---

## Dependencies
*   `threading` — Spawns isolated asynchronous worker tasks.
*   `time` — Measures duration pauses using `time.sleep()`.
*   `pyperclip` — Native system clipboard integration library.

---

## Exports & Public Interface

### `copy_to_clipboard(text: str, clear_after_seconds: int = 15) -> None`
Places text content into the system clipboard and starts an automatic cleanup process.

**Parameters:**
*   `text` (`str`): The confidential plaintext (e.g. decrypted password, active TOTP token) to write to the clipboard.
*   `clear_after_seconds` (`int`, defaults to `15`): The number of seconds the data is allowed to reside in the clipboard. If set to `0` or less, the clipboard remains populated indefinitely (not recommended for security).

**Returns:**
*   `None`

**Called by:**
*   `localpass/ui/screens/entry_view.py` (`build_entry_view` - key shortcuts `p` and `t`)
*   `localpass/ui/components/entry_list.py` (`_handle_copy` method)
*   `server/local_server.py` (`_handle_copy` method)

**Calls:**
*   `pyperclip.copy`
*   `pyperclip.paste`
*   `threading.Thread`

---

## Core Internal Implementations

### Asynchronous Daemon Thread Executor
To ensure that clipboard clearing does not block the primary interactive UI thread or prevent clean application shutdown, the module utilizes a background daemon thread:

```python
def copy_to_clipboard(text: str, clear_after_seconds: int = 15) -> None:
    """Copies text to clipboard and spawns a daemon thread to clear it after a delay."""
    pyperclip.copy(text)
    
    if clear_after_seconds > 0:
        def clear_task():
            time.sleep(clear_after_seconds)
            # Only clear if the clipboard still contains what we copied.
            # This prevents clearing if the user copied something else in the meantime.
            try:
                if pyperclip.paste() == text:
                    pyperclip.copy("")
            except Exception:
                pass
                
        thread = threading.Thread(target=clear_task, daemon=True)
        thread.start()
```

---

## Technical Security Design Notes
1.  **Thread Safety & Integrity:** The `pyperclip.paste()` validation check protects user productivity. If the user copies something else (like an article snippet, link, or image filename) during the 15-second countdown, the check `pyperclip.paste() == text` fails, and the new copied data remains untouched.
2.  **Daemon Configuration:** `daemon=True` ensures the execution thread is instantly terminated by the OS when the parent localpass terminal app is closed. This prevents the process from dangling in the task manager background.
3.  **Exception Silencing:** The clearing loop wraps paste/copy operations inside an empty `except Exception:` block. This guards against system-level clipboard lock exceptions (e.g., when other applications are briefly capturing clipboard focus).

---

## Working Code Example

Below is a complete script demonstrating safe utilization and manual inspection of the clipboard helper:

```python
import time
import pyperclip
from localpass.utils.clipboard import copy_to_clipboard

if __name__ == "__main__":
    sensitive_data = "SuperSecretDeveloperPassword456"
    
    print("Writing sensitive data to clipboard with a 3-second auto-clear timer...")
    copy_to_clipboard(sensitive_data, clear_after_seconds=3)
    
    # 1. Verify it was written
    print(f"Current Clipboard Content: '{pyperclip.paste()}'")
    
    # 2. Wait for clear interval
    print("Waiting 4 seconds...")
    time.sleep(4)
    
    # 3. Verify it was cleared
    current = pyperclip.paste()
    if current == "":
        print("Success: Clipboard was safely cleared to an empty string!")
    else:
        print(f"Clipboard cleared failed. Active content remains: '{current}'")
```

---

## See Also
- [Config](config.md)
- [Paths](paths.md)
- [Architecture Overview](../../architecture/overview.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*