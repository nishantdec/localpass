[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Guide: Adding a New Screen to the TUI Application

This developer guide provides a step-by-step tutorial on how to design, implement, and mount a new screen (view container) in the localpass terminal application. To illustrate, we will walk through building a custom **Backup Manager Screen** (`BackupManagerScreen`) that displays automatically generated vault backup files, lets the user trigger a new backup manually, or restores the vault from an older snapshot.

---

## Step 1: Design the Screen Layout

All screens in localpass are wrapped in the standard double-line border framework defined in the layout components.

Create a new file `localpass/ui/screens/backups.py` and import the required container and control structures from `prompt_toolkit`:

```python
from prompt_toolkit.layout.containers import HSplit, VSplit, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.widgets import Button, Frame

from localpass.ui.app import app_instance
from localpass.ui.components.layout import create_screen_layout
from localpass.core.recovery import BackupService # Example backup backend
```

---

## Step 2: Implement Widgets & Content Controls

Inside `backups.py`, define a builder function `build_backups()` that constructs the interior UI components. Use `HSplit` to stack vertical sections:

```python
def build_backups():
    # 1. Fetch the list of active backup files from the service
    backup_service = BackupService(app_instance.config)
    backups_list = backup_service.list_backups() # Returns a list of filenames/timestamps
    
    selected_index = 0

    # 2. Dynamic content formatter for rendering the list of backups
    def get_list_text():
        if not backups_list:
            return [("class:muted", "  No backups found in AppData.\n")]
            
        lines = []
        for idx, backup in enumerate(backups_list):
            prefix = " > " if idx == selected_index else "   "
            style = "class:success bold" if idx == selected_index else ""
            lines.append((style, f"{prefix}{backup['filename']} ({backup['size_bytes']} bytes) - {backup['created_at']}\n"))
        return lines

    # 3. Create a viewport window for the backup files list
    list_window = Window(
        content=FormattedTextControl(get_list_text),
        height=10
    )
    
    # 4. Formulate the help and status panels
    info_panel = Window(
        content=FormattedTextControl([
            ("class:accent bold", "  BACKUP MANAGER\n"),
            ("", "  Select a snapshot from the list below and press [Enter] to restore,\n"),
            ("", "  or press [b] to trigger a fresh manual backup backup.\n\n")
        ]),
        height=4
    )
    
    body_container = HSplit([
        info_panel,
        Frame(list_window, title="Available Backups"),
    ])
```

---

## Step 3: Map Keyboard Bindings

Screens in localpass are keyboard-driven. We map arrow keys to navigate lists, character keys to trigger actions, and escape/quit keys to navigate away:

```python
    kb = KeyBindings()

    # Navigate up the backup list
    @kb.add("up")
    def _up(event):
        nonlocal selected_index
        if selected_index > 0:
            selected_index -= 1
            app_instance.application.invalidate()

    # Navigate down the backup list
    @kb.add("down")
    def _down(event):
        nonlocal selected_index
        if selected_index < len(backups_list) - 1:
            selected_index += 1
            app_instance.application.invalidate()

    # Exit and return to the main dashboard
    @kb.add("escape")
    @kb.add("q")
    def _exit(event):
        from localpass.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())

    # Trigger manual backup creation
    @kb.add("b")
    def _create_backup(event):
        backup_service.create_manual_backup(app_instance.vault_data)
        # Refresh the list
        nonlocal backups_list
        backups_list = backup_service.list_backups()
        app_instance.application.invalidate()

    # Restore the selected backup
    @kb.add("enter")
    def _restore(event):
        if backups_list:
            selected_backup = backups_list[selected_index]
            backup_service.restore_backup(selected_backup["path"])
            # Navigate back to the unlock screen to re-authenticate the restored vault
            app_instance.lock_vault("Vault restored successfully. Please log in.")
```

---

## Step 4: Wrap and Mount the Layout

Wrap the body container and keybindings in our global layout frame, and return it:

```python
    # 5. Compile into the global layout frame
    wrapped_screen = create_screen_layout(
        title="BACKUP MANAGEMENT",
        body=body_container,
        footer_text="↑/↓:Navigate   b:Create Backup   Enter:Restore   q:Dashboard",
        right_header="LOCKED: NO"
    )

    # Attach keybindings directly to the body container window so they only fire on this screen
    # In prompt_toolkit, containers or windows can receive focused keybindings.
    list_window.key_bindings = kb

    return wrapped_screen
```

---

## Step 5: Prevent Memory Leaks on Screen Exit

> [!CAUTION]
> **MEMORY LEAK WARNING:** If your screen runs active background threads, polling loops, or asynchronous tasks (like rolling TOTP counters or dynamic clock updates), they **must** be stopped when navigating away from the screen. Failing to do so keeps the screen objects alive in memory and leaks resources.

If your view implements background loops, structure a cleanup method and invoke it before shifting focus:

```python
# Example of background task cleanup on exit:
class DynamicMonitoringScreen:
    def __init__(self):
        self.active = True
        self.monitor_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.monitor_thread.start()

    def _poll_loop(self):
        while self.active:
            time.sleep(1)
            # Fetch status updates...

    def cleanup_and_exit(self):
        # 1. Stop background processing loops before exit
        self.active = False
        # 2. Shift application viewport
        from localpass.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())
```

---

## Step 6: Register the Screen in the Dashboard

To navigate to our new Backup Manager screen, add a keybinding trigger in `localpass/ui/screens/dashboard.py`:

```python
# Open localpass/ui/screens/dashboard.py
# Inside build_dashboard() keybindings setup:

@kb.add("b")
def _go_to_backups(event):
    from localpass.ui.screens.backups import build_backups
    app_instance.set_screen(build_backups())
```
Also update the dashboard's footer text configuration to display the new option to the user:
```python
footer_text="n:New   s:Search   b:Backups   ,:Settings   q:Lock & Exit"
```

---

## See Also
- [Replicating The System](replicating-the-system.md)
- [Debugging](debugging.md)
- [Adding A New Endpoint](adding-a-new-endpoint.md)
- [Building Exe](building-exe.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*