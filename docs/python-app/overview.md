[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Module: main.py / Bootstrap Overview

The `main.py` entrypoint serves as the primary initialization script for the localpass application. It configures import namespaces, handles administrative CLI switches (such as database reset requests), constructs the initial TUI unlock screen viewport, and executes the application host event loop.

## Location
`localpass/main.py`

---

## Boot Sequence and Exception Handling Flow
Below is a process sequence flowchart showing the boot lifecycle of the localpass TUI application:

```text
       User Executed: 'python localpass/main.py'
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
      [--reset Flag?]            [Standard Boot]
            │                           │
            ├──► Prompt RESET           ├──► Resolve sys.path Namespace
            │    (Yes: delete files)    │
            │    (No: sys.exit)         ├──► Mount build_unlock() Screen
            │                           │
            ▼                           ▼
     [Start Client] ◄─────────────── [Run loop]
            │
            ▼
   app_instance.run() (TUI Loop Active)
```

---

## Command Line Interface Options

The application parser implements a standardized argument layout via `argparse`:

### `--reset`
Permanently deletes the active user vault database and settings configuration files from AppData, restoring localpass to fresh installation setup mode.

*   **Interactive Confirmation Required:** The terminal prompts the user with the warning: `"WARNING: This will permanently delete your entire vault and all passwords."`. The user must type exactly the uppercase word `"RESET"` in the terminal.
*   **Result:** If confirmed, `vault.nlk` and `config.json` are permanently deleted. If not confirmed, it prints `"Reset cancelled."` and exits without executing.

---

## Dependencies
*   `sys` — Configures module system search path parameters and handles terminations.
*   `os` — Physically deletes local files from AppData during reset sweeps.
*   `argparse` — Parses incoming terminal arguments.
*   `localpass.ui.app.app_instance` — The central application singleton context.
*   `localpass.utils.paths.get_vault_path` — Locates the encrypted database file.
*   `localpass.utils.paths.get_config_path` — Locates the config JSON settings file.
*   `localpass.ui.screens.unlock.build_unlock` — Builds the initial unlock screen container.

---

## Exports & Main Function Walkthrough

### `main() -> None`
Exposes the entry point parser and runtime execution context.

**Core Program Steps:**
1.  **Append Namespace Search Path:**
    Inserts parent paths to allow imports under the `localpass` module prefix:
    ```python
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ```
2.  **Evaluate CLI Flags:**
    Inspects command-line parameters. If `--reset` is present, it runs the interactive deletion confirmation loop.
3.  **Mount Initial Screen Viewport:**
    Sets the starting viewport to `build_unlock()` using the application host singleton:
    ```python
    app_instance.set_screen(build_unlock())
    ```
4.  **Execute Event Loop:**
    Runs the prompt_toolkit loop inside a try-catch block to handle system crashes gracefully:
    ```python
    try:
        app_instance.run()
    except Exception as e:
        print(f"Fatal error: {e}")
    ```

---

## Working Code Example

Below is a configuration displaying how the program arguments can be parsed or invoked programmatically during integration testing:

```python
import sys
import subprocess

def run_localpass_reset_dryrun():
    print("Testing bootstrap interface helper CLI outputs...")
    
    # Executes the python bootstrap check
    try:
        # Check standard helper menu
        result = subprocess.run(
            [sys.executable, "localpass/main.py", "--help"],
            capture_output=True,
            text=True,
            check=True
        )
        print("CLI Help Output:")
        print(result.stdout[:300]) # Prints first few lines of help output
    except Exception as e:
        print(f"Bootstrap help execution test failed: {e}")

if __name__ == "__main__":
    run_localpass_reset_dryrun()
```

---

## See Also
- [Auth](core/auth.md)
- [App](ui/app.md)
- [Local Server](server/local-server.md)
- [Host](native-host/host.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*