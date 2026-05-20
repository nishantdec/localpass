[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: app.py

The `app.py` module defines the primary application host controller (`localpassApp`) for the localpass terminal client. It acts as the central engine coordinating the terminal user interface lifecycle, background threads, local loopback servers, inactivity timing controls, and security session locks.

## Location
`localpass/ui/app.py`

---

## Architectural Interaction Topology
Below is a process boundary block diagram displaying how the main host application coordinates the key manager systems:

```text
                     ┌──────────────────────────────────┐
                     │          localpassApp          │
                     └────────────────┬─────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│SessionManager│              │prompt_toolkit│              │ HTTPServer   │
│ (Memory KDF) │              │(TUI Engine)  │              │(local_server)│
└───────┬──────┘              └──────┬───────┘              └──────┬───────┘
        │                            │                             │
        ▼                            ▼                             ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ctypes.memset │              │ Idle Monitor │              │ JSON REST    │
│ zero-wipe key│              │ (Auto-Lock)  │              │  Interceptors│
└──────────────┘              └──────────────┘              └──────────────┘
```

---

## Dependencies
*   `time` — Tracks keypress timestamps and thread loop sleeps.
*   `threading` — Spawns background threads for the HTTP server and the inactivity auto-locker.
*   `prompt_toolkit.application.Application` — Main UI loop processor.
*   `prompt_toolkit.layout.Layout` — Top-level viewport tree manager.
*   `prompt_toolkit.layout.containers.HSplit` — Primary vertical container holder.
*   `prompt_toolkit.styles.Style` — Visual style mappings.
*   `prompt_toolkit.key_binding.KeyBindings` — Application-wide keybindings.
*   `localpass.core.auth.SessionManager` — Core session security database.
*   `localpass.core.entries.VaultPayload` — Vault item structure mappings.
*   `localpass.core.audit.get_audit_service` — Application activity ledger.
*   `localpass.utils.config.Config` — Standardized settings profiles.

---

## Exports & Public Interface

### `class localpassApp`
The host class coordinating application state, settings loading, TUI rendering, servers, and inactivity sweeps.

#### Core Attributes
*   `session` (`SessionManager`): Manages cryptography key memory, active tokens, and challenge nonces.
*   `vault_data` (`Optional[VaultPayload]`): The loaded plaintext vault payload in memory. Set to `None` when locked.
*   `config` (`Config`): Current persistent configuration settings loaded on startup.
*   `_last_activity` (`float`): Millisecond clock value of the last registered user keypress.
*   `_idle_lock_thread` (`Optional[Thread]`): Background thread running the inactivity monitor.
*   `server` (`Optional[localpassServer]`): The active loopback HTTP web server bridge instance.
*   `root_container` (`HSplit`): The root prompt_toolkit container.
*   `layout` (`Layout`): Central rendering layout tree.
*   `style` (`Style`): Core styling sheet for TUI colors.
*   `application` (`Application`): prompt_toolkit host engine instance.

---

## Methods Catalog

### `__init__()`
Instantiates helper objects, styling lists, keybinding controllers, and configures the `before_key_press` hook to catch user interactions and update activity timestamps. It also registers a session callback to stop the loopback server when the session is locked.
*   **Signature:** `def __init__(self)`
*   **Called by:** Automatically on instantiation of the global singleton.

### `_on_key_activity(_sender=None)`
Event callback triggered before any keypress is dispatched to the active widget.
*   **Signature:** `def _on_key_activity(self, _sender=None)`
*   **Called by:** prompt_toolkit key processor hook.

### `set_screen(screen_container)`
Swaps the active layout screen container inside the root viewport. It shifts cursor focus to the new container and invalidates the application layout to force a redraw.
*   **Signature:** `def set_screen(self, screen_container: AnyContainer)`
*   **Called by:** `localpass/main.py`, `localpass/ui/screens/unlock.py`, `localpass/ui/screens/dashboard.py`, `localpass/ui/screens/settings.py`, `localpass/ui/screens/search.py`

### `_make_adapter() -> VaultAdapter`
Constructs a new DI `VaultAdapter` passing active session instances and a lambda pointing to `self.vault_data` to decouple persistence logic from UI contexts.
*   **Signature:** `def _make_adapter(self) -> VaultAdapter`
*   **Called by:** `start_server`

### `start_server()`
Spawns the standard local TCP loopback listener inside a background thread. If an server is already running, it is stopped first.
*   **Signature:** `def start_server(self) -> None`
*   **Called by:** `localpass/ui/screens/unlock.py` on successful master password authentication.

### `_on_session_locked(reason="")`
Callback triggered by the `SessionManager` when the session is locked. Ensures the TCP server stops.
*   **Signature:** `def _on_session_locked(self, reason: str = "") -> None`
*   **Called by:** `SessionManager` callback pipeline.

### `lock_vault(reason="")`
Closes the active vault: sets `vault_data` to `None`, instructs `SessionManager` to wipe memory buffers, stops the server, logs the event, and swaps the display viewport to the unlock screen.
*   **Signature:** `def lock_vault(self, reason: str = "") -> None`
*   **Called by:** `_do_idle_lock`, settings forms, and key shortcut triggers.

### `exit()`
Performs graceful teardown: stops server, wipes key memory, and exits the prompt_toolkit event loop.
*   **Signature:** `def exit(self) -> None`
*   **Called by:** global navigation handlers.

### `start_idle_timer()`
Spawns the background monitor thread `idle-lock`.
*   **Signature:** `def start_idle_timer(self) -> None`
*   **Called by:** `run`

### `_idle_lock_loop()`
Main loop of the `idle-lock` monitor thread. Sleeps in 10-second intervals. If `auto_lock_enabled` is active, a vault is loaded, and the duration since `_last_activity` exceeds the config threshold, it requests an auto-lock.
*   **Signature:** `def _idle_lock_loop(self) -> None`
*   **Called by:** background monitor thread launcher.

### `_do_idle_lock()`
Performs the actual lock action within the UI loop thread to maintain thread safety.
*   **Signature:** `def _do_idle_lock(self) -> None`
*   **Called by:** `_idle_lock_loop` via `call_soon_threadsafe`.

### `run()`
Main runner that launches the background inactivity thread and begins prompt_toolkit loop execution.
*   **Signature:** `def run(self) -> Any`
*   **Called by:** `localpass/main.py` entrypoint.

---

## Global Singleton Export
The module exports a global application instance to manage central state:
```python
app_instance = localpassApp()
```
Importing `app_instance` gives screens access to the active vault payload, configurations, and screen navigation systems.

---

## Core Internal Implementations

### Thread-Safe UI Callback (Background-to-UI Synchronization)
Because the inactivity monitor runs on a background daemon thread, it cannot directly modify UI layouts or trigger key clearing without causing synchronization bugs or deadlocks. It uses the prompt_toolkit event loop's thread-safe queue:

```python
def _idle_lock_loop(self):
    while True:
        time.sleep(10)
        if not self.application.is_running:
            break
        if not self.config.auto_lock_enabled:
            continue
        if self.vault_data is None:
            continue
        idle_limit = self.config.auto_lock_idle_minutes * 60
        if idle_limit <= 0:
            continue
        if (time.monotonic() - self._last_activity) >= idle_limit:
            try:
                # Dispatches lock execution safely to the UI loop
                self.application.loop.call_soon_threadsafe(self._do_idle_lock)
            except Exception:
                pass
```

---

## Working Code Example

Below is a configuration script displaying how a developer can import the global application singleton and simulate runtime interactions:

```python
import time
from localpass.ui.app import app_instance

if __name__ == "__main__":
    print("=== App Instance Mock Diagnostics ===")
    
    # 1. Inspect Default Properties
    print(f"Active server? {app_instance.server is not None}")
    print(f"Vault data loaded? {app_instance.vault_data is not None}")
    
    # 2. Simulate User Keyboard Activity
    print("Simulating user keyboard activity...")
    app_instance._on_key_activity()
    t1 = app_instance._last_activity
    print(f"Timestamp updated: {t1}")
    
    # 3. Verify activity time delta
    time.sleep(1.5)
    delta = time.monotonic() - app_instance._last_activity
    print(f"Inactivity duration: {delta:.2f} seconds")
```

---

## See Also
- [Dashboard Screen](screens/dashboard.md)
- [Layout Component](components/layout.md)
- [Architecture Overview](../../architecture/overview.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*