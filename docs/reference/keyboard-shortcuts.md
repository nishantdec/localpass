[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](glossary.md)

---

# Terminal TUI Keyboard Bindings Reference

This document provides the complete, authoritative reference guide for all keyboard bindings, key controls, and focus navigation controls used to operate the localpass Terminal User Interface (TUI).

---

## 1. Global Navigation Controls

These shortcuts are mapped universally across the entire application interface, except where explicitly overridden by text entry fields or modal overlays.

| Key / Binding | Action | Application Behavior |
| :--- | :--- | :--- |
| **`Tab`** | Focus Next Field | Shifts the active cursor focus to the next logical focusable component or input field. |
| **`Shift + Tab`** | Focus Previous Field | Shifts the active cursor focus to the previous focusable component or input field. |
| **`Enter`** | Activate/Select | Triggers the focused button action, submits the active form focus, or opens the selected list row. |
| **`ESC`** | Back / Cancel | Cancels the current screen or modal form and returns the user to the previous view context. |

---

## 2. Screen-Specific Keyboard Bindings

### A. Unlock Screen
This screen acts as the initial authorization gate for the vault file. It operates in **Unlock Mode** (if a vault already exists) or **Setup Mode** (if initializing a new vault).

| Key / Binding | Mode Scope | Action | Functional Details |
| :--- | :--- | :--- | :--- |
| **`Enter`** | Unlock Mode | Submit Password | Triggers `attempt_unlock()` to verify key derivation and load the vault. |
| **`Enter`** | Setup Mode | Next / Submit | If focused on Password, moves focus to Confirm Password. If focused on Confirm, submits. |
| **`Ctrl + R`** | Both | Toggle Visibility | Toggles between masked input characters (`*`) and plaintext visibility of the password fields. |
| **`ESC`** or **`Ctrl + C`** | Both | Quit | Immediately terminates the application process. |

---

### B. Dashboard Screen
The primary hub displayed immediately after unlocking the vault database.

| Key / Binding | Action | Target Function Call |
| :--- | :--- | :--- |
| **`N`** or **`n`** | Open New Entry | Loads `build_entry_new()` input screen to create a Login, Note, or TOTP entry. |
| **`S`** or **`s`** | Open Search Screen | Loads `build_search()` to search, view, and inspect saved entries. |
| **`G`** or **`g`** | Open Generator | Loads `build_generator()` password helper screen. |
| **`L`** or **`l`** | Lock Vault | Invokes `app_instance.lock_vault()`, zeroing memory and returning to Unlock. |
| **`T`** or **`t`** | Open Settings | Loads `build_settings()` configurations screen. |
| **`Q`** or **`q`** or **`ESC`** | Quit Application | Triggers `app_instance.exit()`, zeroing keys and closing the terminal. |

---

### C. Search Screen
Provides a list-view search matching items in real time as keys are pressed.

| Key / Binding | Action | Interface Reaction |
| :--- | :--- | :--- |
| **`Up Arrow`** / **`Down Arrow`** | Scroll Results | Moves list selection up or down through matched entries. |
| **`Enter`** | Open Detailed View | Opens `build_entry_view(entry)` for the highlighted entry. |
| **`ESC`** | Return to Dashboard | Closes search and returns to `build_dashboard()`. |

---

### D. Entry View Screen
Displays complete decrypted parameters for a chosen entry, including live TOTP token countdown values.

| Key / Binding | Action | Functional Process |
| :--- | :--- | :--- |
| **`U`** or **`u`** | Copy Username | Copies `entry.username` to OS clipboard and schedules a clear event. |
| **`C`** or **`c`** | Copy Password | Copies `entry.password` to OS clipboard and schedules a clear event. |
| **`T`** or **`t`** | Copy TOTP Token | Generates current 6-digit TOTP code and copies it to the clipboard. |
| **`E`** or **`e`** | Edit Entry | Opens `build_entry_edit(entry)` pre-filled with existing parameters. |
| **`D`** or **`d`** | Delete Entry | Removes the entry, calls `save_vault()`, and returns to the Dashboard. |
| **`ESC`** | Return to Search | Cancels detailed view and returns back to the `build_search()` query. |

---

### E. New Entry and Edit Entry Forms
Input grids containing fields for Title, Username, Password, URL, TOTP Key, and Notes.

| Key / Binding | Action | Functional Protocol |
| :--- | :--- | :--- |
| **`Ctrl + S`** | Save Entry | Validates fields, encrypts values, calls `save_vault()`, and returns to Search. |
| **`ESC`** | Cancel | Discards changes and returns to the previous dashboard/search context. |
| **`Tab`** | Next Input | Shifts keyboard cursor down through the field grid inputs. |
| **`Shift + Tab`** | Previous Input | Shifts keyboard cursor up through the field grid inputs. |

---

### F. Password Generator Screen
Utilities for creating random passwords with custom parameters.

| Key / Binding | Action | Application Behavior |
| :--- | :--- | :--- |
| **`Ctrl + G`** or **`Enter`** | Generate Password | Invokes generator logic using the active parameters and updates the view. |
| **`C`** or **`c`** | Copy Password | Copies the generated plaintext password to the clipboard. |
| **`Space`** or **`Enter`** | Toggle Options | Toggles checkbox rules (e.g. Include Uppercase, Include Numbers). |
| **`ESC`** | Return to Dashboard | Returns to the central `build_dashboard()` screen. |

---

### G. Settings Screen
Customizations panel for autolock triggers, database backups, and clipboard timeouts.

| Key / Binding | Action | Application Behavior |
| :--- | :--- | :--- |
| **`Ctrl + S`** | Save Configuration | Commits configurations to `config.json` and updates the app instance state. |
| **`ESC`** | Cancel | Discards setting adjustments and returns to `build_dashboard()`. |

---

## See Also
- [Glossary](glossary.md)
- [File Index](file-index.md)
- [Function Index](function-index.md)
- [Config Reference](config-reference.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*