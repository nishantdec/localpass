import threading
import time
import pyperclip

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
