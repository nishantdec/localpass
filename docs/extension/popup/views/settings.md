[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Settings Views Reference

## 1. Overview and Purpose
The Settings views in the localpass browser extension popup provide a modular dashboard for configuring user preferences and browser integration. Implemented across four sub-views inside `popup.js`, this interface manages visual themes, custom sizing modes, and a robust set of autofill switches. It also facilitates setting localpass as the default system-wide password manager, handling dynamic permissions, disabling standard browser password prompts, and status verification.

---

## 2. File Location and Core Files
*   **Source View Logic:** `localpass-extension/popup/popup.js` (Lines 2096–2486)
*   **Target Output File:** `docs/extension/popup/views/settings.md`
*   **Associated Stylesheet:** `localpass-extension/popup/popup.css` (specifically `.nl-settings-menu`, `.nl-menu-item`, `.nl-settings`, `.nl-switch`, `.nl-slider`, and UI models)

---

## 3. Sub-View Dashboards Architecture

The settings module contains four distinct sub-views accessed via an interactive hierarchy:

```
                  +-----------------------------------------+
                  |           Settings (Main Panel)         |
                  +-----------------------------------------+
                  |  [ Palette ]  Appearance         [ > ]  |
                  |  [ Shield ]   Autofill & Passkey [ > ]  |
                  |  [ Info ]     About Extension    [ > ]  |
                  +-----------------------------------------+
                                       |
        +------------------------------+------------------------------+
        |                              |                              |
        v                              v                              v
+--------------------------+  +--------------------------+  +--------------------------+
|  Appearance Sub-Panel    |  |  Autofill & Passkey Sub  |  |     About Sub-Panel      |
+--------------------------+  +--------------------------+  +--------------------------+
| THEMING                  |  | SYSTEM STATUS            |  | INFO                     |
| Theme Mode: [Dark][Light]|  | Transport: Native / Proxy|  | Version: v0.1.0          |
| Popup Size:              |  | Integration: Active/Warn |  | Server: 127.0.0.1:27432  |
| [Compact] [Default]      |  | Passkey Support: Active  |  | Status: [ Connected ]    |
| [Wider]   [Extra Wide]   |  +--------------------------+  +--------------------------+
+--------------------------+  | Default Manager Onboarding|
                              | [ Make Default Button ]  |
                              | (Invokes modal + prompts) |
                              +--------------------------+
                              | AUTOFILL CONFIG SWITCHES |
                              | [x] Enable Autofill      |
                              | [x] Autofill on Load     |
                              | [x] WebAuthn Passkeys    |
                              | [x] Intelligent Autofill  |
                              | [x] Require Click        |
                              | [x] Native Messaging     |
                              | [x] Trusted Domains      |
                              | [x] Show Suggestions     |
                              | [x] Inline Overlay       |
                              +--------------------------+
```

---

## 4. Sub-View Function Specs

### 4.1. `viewRenderers.settings` (Main Panel)
*   **Signature:** `registerView('settings', () => { ... })`
*   **Purpose:** Renders the parent menu options connecting to appearance, autofill, and about panels.
*   **Called by:** `navigateTo('settings')` from bottom footer navbar.
*   **Example:**
    ```javascript
    navigateTo('settings');
    ```

### 4.2. `viewRenderers['settings-appearance']` (Appearance Sub-Panel)
*   **Signature:** `registerView('settings-appearance', async () => { ... })`
*   **Purpose:** Toggles theme modes (dark/light) and adjusts popup window dimensions.
*   **Called by:** Clicking the **Appearance** row in settings.
*   **Calls:**
    *   `updateThemeIcon(isLight)` (adjusts visual assets).
    *   `updatePopupSizeClass(sizeVal)` (injects width/height parameters into root elements).
    *   `chrome.storage.local.set` to persist selection.
*   **Sizing Configurations Available:**
    *   `compact`: `360px` width × `500px` height.
    *   `default`: `420px` width × `580px` height.
    *   `wider`: `480px` width × `600px` height.
    *   `extra_wide`: `560px` width × `600px` height.

### 4.3. `viewRenderers['settings-autofill']` (Autofill Sub-Panel)
*   **Signature:** `registerView('settings-autofill', async () => { ... })`
*   **Purpose:** Controls browser autofill behavior, displays system health diagnostics, and runs the "Default Password Manager" setup wizard.
*   **Called by:** Clicking the **Autofill & Passkeys** row in settings.
*   **Calls:**
    *   `sendBg({ type: 'CHECK_PRIVACY_STATUS' })`.
    *   `sendBg({ type: 'PING' })`.
    *   `sendBg({ type: 'DISABLE_NATIVE_AUTOFILL' })`.
    *   `chrome.permissions.request`.
*   **Onboarding Modal Flow:**
    When the extension detects that browser autofill settings require onboarding, it displays a modal to help set localpass as default:
    1.  Clicking `#nl-make-default-btn` shows the `#nl-default-modal` overlay.
    2.  User clicks confirm, triggering a request for optional browser extension permissions:
        ```javascript
        chrome.permissions.request({
          permissions: ['privacy', 'webNavigation', 'contextMenus']
        }, async (granted) => { ... });
        ```
    3.  If granted, it sends the `DISABLE_NATIVE_AUTOFILL` action to the local background server to disable the browser's built-in password prompt.
    4.  The extension redirects the active browser tab to the system password management settings to help the user clear competing handlers:
        *   **Chrome/Brave:** `chrome://password-manager/settings`
        *   **Edge:** `edge://settings/passwords`

### 4.4. `viewRenderers['settings-about']` (About Sub-Panel)
*   **Signature:** `registerView('settings-about', async () => { ... })`
*   **Purpose:** Shows metadata, version version (`v0.1.0`), and server socket details (`127.0.0.1:27432`).
*   **Called by:** Clicking the **About Extension** row in settings.
*   **Calls:**
    *   `sendBg({ type: 'PING' })` (verifies connection status to the local server).

---

## 5. Storage Schemas & Persistent Preferences

User settings are saved in local extension storage (`chrome.storage.local`).

### 5.1. Appearance Storage Keys
*   **Key:** `'theme'` (Type: `string`)
    *   `"dark"`: Standard modern dark mode.
    *   `"light"`: Sleek grey-blue light palette.
*   **Key:** `'popup_size'` (Type: `string`)
    *   Values: `"compact"`, `"default"`, `"wider"`, or `"extra_wide"`.

### 5.2. Autofill Integration Storage Keys
The settings panel manages nine binary preferences:

| Storage Key | Value Type | Default | Purpose / Behavior |
| :--- | :--- | :--- | :--- |
| `autofill_enabled` | `boolean` | `true` | Enables dynamic input detection and credential matching in pages. |
| `auto_login` | `boolean` | `false` | Automatically fills matching credentials into login forms on load. |
| `passkey_enabled` | `boolean` | `true` | Intercepts WebAuthn calls to handle passkey registrations and logins. |
| `intelligent_autofill_enabled` | `boolean` | `true` | Uses advanced field heuristic analysis rather than relying solely on matching simple IDs. |
| `require_click_autofill` | `boolean` | `false` | Forces the user to explicitly click a field before autofill values are loaded. |
| `native_messaging_preferred` | `boolean` | `true` | Prefers native host communication tunnels rather than standard HTTP ports. |
| `trusted_domain_matching` | `boolean` | `true` | Restricts autofill matching strictly to verified domain hierarchies. |
| `autofill_suggestions_enabled` | `boolean` | `true` | Shows dropdown suggestions inline when fields are focused. |
| `inline_overlay_enabled` | `boolean` | `true` | Shows quick-action indicator badges inside matching input fields. |

---

## 6. DOM Toggle Bindings and State Syncer

Switches in the settings panel use customized slider elements styled as switches. Checkbox state listeners synchronize user changes back to storage automatically:

```javascript
const bindToggle = (id, key, val) => {
  const el = $(id);
  if (!el) return;
  el.checked = val; // Initialize UI check status based on loaded storage state
  
  el.addEventListener('change', () => {
    try {
      const obj = {};
      obj[key] = el.checked;
      chrome.storage.local.set(obj); // Persist configuration dynamically
    } catch (_) {}
  });
};
```
These listeners ensure configuration changes are immediately persisted without requiring a manual save step.

---

## See Also
- [App](../../../python-app/ui/app.md)
- [Config](../../../python-app/utils/config.md)
- [Config Reference](../../../reference/config-reference.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*