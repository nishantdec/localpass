[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Password Generator View Reference

## 1. Overview and Purpose
The Generator view inside the localpass browser extension popup is a comprehensive, client-side cryptographic utility. It enables users to generate strong, secure passwords, readable multi-word passphrases, and custom usernames. The utility handles complex character rules (e.g., minimum special character counts), tracks generation history, saves user configuration options in local storage, and allows generated values to be filled directly back into login forms.

---

## 2. File Location and Core Files
*   **Source View Logic:** `localpass-extension/popup/popup.js` (Lines 1670–2092)
*   **Target Output File:** `docs/extension/popup/views/generator-view.md`
*   **Associated Stylesheet:** `localpass-extension/popup/popup.css` (specifically `.nl-generator-view`, `.nl-gen-tabs-container`, `.nl-gen-output-card`, and `.nl-history-row`)

---

## 3. Dynamic Visual Layouts

The Generator interface uses tabbed menus to toggle between three visual states:

```
+-------------------------------------------------------------------------------+
|  [ Tab: Password ]           [ Tab: Passphrase ]           [ Tab: Username ]  |
+-------------------------------------------------------------------------------+
|  GENERATED OUTPUT CARD                                                        |
|  +-------------------------------------------------------------------------+  |
|  | h5P#9!xK$Lm28QZwsRtvYuP41@9aBcDfGh                                      |  |
|  | (Characters colored dynamically: numbers accent, symbols danger/red)     |  |
|  |                                                                         |  |
|  |                            [ Regenerate Icon ]      [ Copy Icon ]       |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
|  CONFIGURABLE OPTIONS PANEL                                                   |
|                                                                               |
|  If Tab = Password:                                                           |
|  - Length Input: [ 36 ] (Range: 20-128)                                       |
|  - Include Characters Grid: [x] A-Z   [x] a-z   [x] 0-9   [x] !@#$^*          |
|  - Minimum counts: Numbers: [ 2 ]    Special: [ 2 ]                           |
|                                                                               |
|  If Tab = Passphrase:                                                         |
|  - Number of words: [ 6 ] (Range: 3-20)                                       |
|  - Word separator:  [ - ]                                                     |
|  - Toggles: [x] Capitalize words   [x] Include random number                  |
|                                                                               |
|  If Tab = Username:                                                           |
|  - Username Type: [ Random word / Random characters ]                         |
|  - Toggles: [x] Capitalize   [x] Include numbers                              |
|  - History Accordion:                                                         |
|    +---------------------------------------------------------------------+    |
|    | Generator history                              [ Caret Indicator ]  |    |
|    +---------------------------------------------------------------------+    |
+-------------------------------------------------------------------------------+
|                                                                               |
|  [ Remember Settings Button ]                  [ Use This Button (optional) ] |
+-------------------------------------------------------------------------------+
```

---

## 4. Detailed Function Specifications

### 4.1. `viewRenderers.generator`
*   **Signature:** `registerView('generator', async ({ returnTo } = {}) => { ... })`
*   **Parameters:**
    *   `returnTo` (type: `string`, optional): Remembers which view spawned the generator (e.g. `'save'` or `'edit'`). If present, a **Use this** action button is displayed, which fills the generated password or username directly back into the originating form.
*   **Returns:** `Promise<void>` (Renders generator widgets into DOM element `#nl-content`).
*   **Called by:**
    *   Clicking the **Gen** button on any save or edit form.
    *   Clicking **Password Generator** in the popup menu list.
*   **Calls:**
    *   `loadGeneratorConfig()` (fetches saved parameters from storage).
    *   `generatePassword(config)` (cryptographically derives password strings).
    *   `generatePassphrase(config)` (assembles readable multi-word secrets).
    *   `generateUsername(config)` (creates random word or char usernames).
    *   `colorizePassword(password)` / `colorizePassphrase(phrase, separator)`.
    *   `addToHistory(val, type)` / `renderHistoryList()`.
    *   `saveGeneratorConfig(config)` (commits current parameters to storage).
    *   `navigateBack()`.
*   **Functional Code Example:**
    ```javascript
    // Render generator and display "Use this" button to return data back to edit form
    navigateTo('generator', { returnTo: 'edit' });
    ```

### 4.2. `regen`
*   **Signature:** `function regen() { ... }`
*   **Parameters:** None
*   **Returns:** `void` (Directly updates DOM element `#nl-gen-out` with the generated value).
*   **Behavior:** Reads inputs from active panel fields, computes passwords using the secure generator libraries, and invokes colorization formatters.

### 4.3. `colorizePassword`
*   **Signature:** `function colorizePassword(password) { ... }`
*   **Parameters:**
    *   `password` (type: `string`, required): The generated password string.
*   **Returns:** `string` (HTML string with span containers colorizing numeric digits and special symbols).
*   **Logic:**
    *   Numeric digits (`0-9`) are wrapped in `color: var(--accent); font-weight: 700`.
    *   Special symbols (`[^A-Za-z0-9]`) are wrapped in `color: var(--danger); font-weight: 700`.
    *   Letters (`a-z`, `A-Z`) are wrapped in plain tags.

### 4.4. `colorizePassphrase`
*   **Signature:** `function colorizePassphrase(phrase, separator) { ... }`
*   **Parameters:**
    *   `phrase` (type: `string`, required): The space/separator joined passphrase.
    *   `separator` (type: `string`, required): Separation character (e.g. `"-"`).
*   **Returns:** `string` (HTML string highlighting separators in `var(--danger)` color for readability).

### 4.5. `addToHistory`
*   **Signature:** `async function addToHistory(val, type) { ... }`
*   **Parameters:**
    *   `val` (type: `string`, required): The generated credential value to remember.
    *   `type` (type: `string`, required): Generator type (`"password"`, `"passphrase"`, or `"username"`).
*   **Returns:** `Promise<void>` (Saves value in `generator_history` array, capped at 10 items).

### 4.6. `renderHistoryList`
*   **Signature:** `function renderHistoryList() { ... }`
*   **Parameters:** None
*   **Returns:** `void` (Renders the history items list to the DOM element `#nl-gen-history-list` and binds copy/insertion click actions).

---

## 5. Storage Schemas & Persistent Structures

The Generator writes configurations and history directly to browser storage (`chrome.storage.local`).

### 5.1. Generator Settings Schema (`generator_config`)
Saves configuration values when the user clicks **Remember settings**.
*   **Key:** `'generator_config'`
*   **Storage Type:** `object`
*   **Schema Schema:**
    ```json
    {
      "length": 36,
      "uppercase": true,
      "lowercase": true,
      "digits": true,
      "symbols": true,
      "minUpper": 2,
      "minLower": 2,
      "minDigits": 2,
      "minSymbols": 2,
      "numWords": 6,
      "separator": "-",
      "capitalize": true,
      "includeNumber": true,
      "usernameType": "word",
      "usernameCapitalize": false,
      "usernameIncludeNumber": true
    }
    ```

### 5.2. Generator History Schema (`generator_history`)
Saves a rolling list of generated credentials. Items are only added to this list when the user copies them to the clipboard, preventing the list from filling up with unused values.
*   **Key:** `'generator_history'`
*   **Storage Type:** `array` (limited to 10 entries)
*   **Schema Schema:**
    ```json
    [
      {
        "value": "correct-horse-battery-staple-8",
        "type": "passphrase",
        "timestamp": 1716200293021
      },
      {
        "value": "7z#xM@9Lp$2A&1q9*8Wd_qY!",
        "type": "password",
        "timestamp": 1716200192842
      }
    ]
    ```

---

## 6. Autofill Re-Entry & Callback Event Handlers

When returning to an active entry form (Save or Edit) after generating a new password:
1.  **Selection Flag:** The popup sets `returnTo` on navigation (`save` or `edit`).
2.  **Use This Event:** Clicking `#nl-gen-use` captures the current `generatedValue`, sets a temporary global property `window._nlGeneratedPassword`, and calls `navigateBack()`.
3.  **Target Injection Callback:**
    ```javascript
    $('nl-gen-use').addEventListener('click', () => {
      window._nlGeneratedPassword = generatedValue;
      navigateBack();
      setTimeout(() => {
        if (activeTab === 'username') {
          // Identify target login/edit username element
          const uf = returnTo === 'edit' ? $('ne-user') : $('nl-save-username');
          if (uf) {
            uf.value = window._nlGeneratedPassword;
            uf.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          // Identify target login/edit password element
          const pf = returnTo === 'edit' ? $('ne-pass') : $('nl-save-password');
          if (pf) {
            pf.value = window._nlGeneratedPassword;
            pf.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        delete window._nlGeneratedPassword; // Clear memory variable
      }, 50);
    });
    ```
4.  **UI Syncing:** Firing the synthetic `input` event triggers the corresponding password strength indicators, ensuring the interface matches the strength of the newly generated password.

---

## See Also
- [Popup](../popup.md)
- [Generator Ext](../../utils/generator.md)
- [Strength](../../utils/strength.md)
- [Settings View](settings.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*