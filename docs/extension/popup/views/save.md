[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Save & Edit Form Views Reference

## 1. Overview and Purpose
The Save and Edit form views in the localpass browser extension popup provide a dynamic, unified layout engine for capturing and modifying structured vault credentials. Operating inside the Single Page Application (SPA) script (`popup.js`), these views construct context-aware HTML inputs based on the target credentials type (`login`, `card`, `identity`, or `note`), hook up interactive behaviors (e.g., eye toggles for password fields, password generators, and real-time entropy indicators), and compile payload dictionaries to send to the background script via the Chrome messaging API.

---

## 2. File Location and Core Files
*   **Source View Logic:** `localpass-extension/popup/popup.js` (Lines 619–978 for Save; Lines 2490–2924 for Edit)
*   **Target Output File:** `docs/extension/popup/views/save.md`
*   **Associated Stylesheet:** `localpass-extension/popup/popup.css` (specifically `.nl-form-group`, `.nl-password-row`, `.nl-strength-bar`, `.nl-switch`, `.nl-slider`, and buttons)

---

## 3. Architectural Overview & Workflow Sequence

```
+-------------------------------------------------------------------------------+
|                               Popup Header Bar                                |
+-------------------------------------------------------------------------------+
|                                                                               |
|  [Header Title: Login / Cards / Identity / Notes ]                            |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  | Item details                                                            |  |
|  | Label: Title (Required)                                                 |  |
|  | [ Input: Text ]                                                         |  |
|  +-------------------------------------------------------------------------+  |
|  | Type-Specific Schema Panel                                              |  |
|  | (Dynamically injected inputs based on selection)                        |  |
|  |                                                                         |  |
|  | - Login: Username, Password [Eye/Gen], Strength, URL, TOTP Secret      |  |
|  | - Card: Cardholder, Number [Eye], Brand, Expiration [MM/YYYY], CVV      |  |
|  | - Identity: Title, Name [First/Mid/Last], SSN [Eye], Passport [Eye]     |  |
|  | - Note: (Relies on common additional textarea below)                    |  |
|  +-------------------------------------------------------------------------+  |
|  | Additional options                                                      |  |
|  | Label: Folder                                                           |  |
|  | [ Dropdown Selector: -- Select -- / Unassigned / Custom Folders ]       |  |
|  |                                                                         |  |
|  | Label: Notes                                                            |  |
|  | [ Textarea: Optional Notes / Secure Note Content ]                      |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
|  [ Save / Update Entry Button ]        [ Cancel Button ]                      |
+-------------------------------------------------------------------------------+
```

The flow of operations for adding or editing a vault item proceeds as follows:
1.  **Ingress:** The navigation router (`navigateTo`) triggers the view stack. For new entries, `viewRenderers.save({ prefill, type })` is invoked. For modifications, `viewRenderers.edit({ id })` pulls the existing raw schema from the local secure server before launching.
2.  **HTML Generation:** Based on `type`, the engine generates custom form inputs, fetching a list of folders from `chrome.storage.local` to populate the organizational selector.
3.  **UI Interceptors:**
    *   Toggling input visibility between text and password using the `.nl-input-eye-btn`.
    *   Subscribing the password generator button to the background service's randomizer sequence.
    *   Triggering real-time entropy calculation on keyboard inputs using `calculateStrength()`.
4.  **Serialization and Transit:** The form gathers all input values, normalizes them, stringifies extra parameters to JSON (e.g., card and identity fields are packaged into the `notes` column), and dispatches the payload (`SAVE_ENTRY` or `UPDATE_ENTRY`) to `background.js` over the native communication channel.
5.  **Organizational Persistence:** On success, the assigned folder path is written to local browser storage mapped to the entry's UUID. The view then invokes `navigateBack()`.

---

## 4. Detailed Function Specs

### 4.1. `viewRenderers.save`
*   **Signature:** `registerView('save', async ({ prefill, type = 'login' } = {}) => { ... })`
*   **Parameters:**
    *   `prefill` (type: `object`, optional): Pre-populated input properties.
        *   `title` (type: `string`, optional): Initial item label.
        *   `url` (type: `string`, optional): Initial target domain string.
        *   `username` (type: `string`, optional): Pre-filled login identifier.
        *   `password` (type: `string`, optional): Pre-filled password string.
        *   `totp_secret` (type: `string`, optional): Base32 seed for 2FA.
        *   `notes` (type: `string`, optional): Pre-filled description block.
    *   `type` (type: `string`, optional, default: `'login'`): Entry category. Must be one of `'login'`, `'card'`, `'identity'`, or `'note'`.
*   **Returns:** `Promise<void>` (Async operation rendering directly to DOM element `#nl-content`).
*   **Called by:**
    *   `navigateTo('save', { type, prefill })` in `popup.js`
    *   Drop-down menu selectors in the Header panel.
*   **Calls:**
    *   `escapeHtml` (local HTML encoding helper).
    *   `sendBg` with payload `{ type: 'SAVE_ENTRY', entry: object }`.
    *   `calculateStrength(password: string)`.
    *   `getStrengthInfo(strength: number)`.
    *   `loadGeneratorConfig()`.
    *   `generatePassword(config: object)`.
    *   `navigateBack()`.
*   **Functional Code Example:**
    ```javascript
    // Navigate to the Login entry save panel with prefilled browser tab information
    navigateTo('save', {
      type: 'login',
      prefill: {
        title: 'GitHub - localpass Dev',
        url: 'https://github.com/login',
        username: 'north_admin'
      }
    });
    ```

### 4.2. `viewRenderers.edit`
*   **Signature:** `registerView('edit', async ({ id } = {}) => { ... })`
*   **Parameters:**
    *   `id` (type: `string`, required): Unique UUID of the vault record being edited.
*   **Returns:** `Promise<void>` (Async operation pulling data and updating DOM element `#nl-content`).
*   **Called by:**
    *   `navigateTo('edit', { id })` (from the Inspect/Detail view pane).
*   **Calls:**
    *   `sendBg` with payload `{ type: 'GET_ENTRY', id }`
    *   `sendBg` with payload `{ type: 'GET_FILL', id }`
    *   `sendBg` with payload `{ type: 'GET_TOTP', id }` (live verification timer loop, if TOTP exists)
    *   `sendBg` with payload `{ type: 'UPDATE_ENTRY', entry: object }`
    *   `chrome.storage.local.get` to read organizational folders.
    *   `calculateStrength(password: string)`.
    *   `navigateBack()`.
*   **Functional Code Example:**
    ```javascript
    // Trigger edit form for the item with ID '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    navigateTo('edit', { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' });
    ```

---

## 5. Schema Definitions & Serialization Payloads

### 5.1. Save/Update IPC Payloads (`SAVE_ENTRY` and `UPDATE_ENTRY`)
All vault modifications sent to the local server via the browser extension use standard columns in the database. Consequently, complex structures (like Payment Cards or Identities) serialize their auxiliary properties as a JSON string inside the `notes` column.

#### 5.1.1. Login Schema
```json
{
  "type": "login",
  "title": "My Account Label",
  "username": "user@example.com",
  "password": "DecryptedPasswordStringHere",
  "url": "https://example.com/login",
  "totp_secret": "MZXW6YTBOI======",
  "notes": "Optional plaintext notes here."
}
```

#### 5.1.2. Payment Card Schema
```json
{
  "type": "card",
  "title": "Sapphire Preferred",
  "username": "Cardholder Name",
  "password": "1234567890123456",
  "url": "12/2029",
  "totp_secret": "123",
  "notes": "{\"brand\":\"Visa\",\"exp_month\":\"12\",\"exp_year\":\"2029\",\"cvv\":\"123\",\"notes\":\"Billing zip is 90210\"}"
}
```
> [!NOTE]
> *   `username` maps to the **Cardholder Name**.
> *   `password` maps to the encrypted **Card Number**.
> *   `url` stores the card **Expiration Date** in `MM/YYYY` format for legacy table-rendering compatibility.
> *   `totp_secret` stores the encrypted **CVV/CVC** security code.

#### 5.1.3. Secure Identity Schema
```json
{
  "type": "identity",
  "title": "Personal Profile",
  "username": "johndoe12",
  "password": "999-99-9999",
  "url": "A12345678",
  "notes": "{\"title_prefix\":\"Mr.\",\"first_name\":\"John\",\"middle_name\":\"Adam\",\"last_name\":\"Doe\",\"company\":\"Acme Corp\",\"ssn\":\"999-99-9999\",\"passport_number\":\"A12345678\",\"notes\":\"Personal identity profile\"}"
}
```
> [!NOTE]
> *   `username` maps to the custom profile **Username/Login**.
> *   `password` maps to the encrypted **Social Security Number (SSN)**.
> *   `url` maps to the encrypted **Passport Number**.

#### 5.1.4. Secure Note Schema
```json
{
  "type": "note",
  "title": "Server Admin Credentials",
  "notes": "Plaintext secret contents or parameters stored directly inside this field without wrapping."
}
```

---

## 6. Organizational Folders Logic & Local Storage Schema

Folder categorization is managed by the browser extension locally using the `chrome.storage.local` API. The mapping of categories is stored using two separate structures:

### 6.1. Available Folders List (`folders`)
Stored as a flat array of strings representing unique folders defined by the user.
*   **Key:** `'folders'`
*   **Storage Type:** `string[]`
*   **Schema:**
    ```json
    [
      "Personal",
      "Work Projects",
      "Financials"
    ]
    ```

### 6.2. Vault Item Folders Mapping (`entryFolders`)
Stored as an object mapping vault entry UUIDs to folder strings.
*   **Key:** `'entryFolders'`
*   **Storage Type:** `Record<string, string>`
*   **Schema:**
    ```json
    {
      "4a3d463e-32b0-466d-8bc4-c6a6f02888cf": "Personal",
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d": "Work Projects"
    }
    ```

---

## 7. Dynamic Form Event Interceptors & Behavior

Both the `Save` and `Edit` rendering loops bind handlers to elements as they are injected into the DOM:

### 7.1. Field Visibilities (Eye Toggles)
Each password-like input has a companion eye icon button that toggles the input field type between `password` and `text`.
*   **Selectors mapped:**
    *   `#nl-save-pass-toggle` / `#ne-pass-toggle` (Target input: `#nl-save-password` / `#ne-pass`)
    *   `#nl-save-totp-toggle` / `#ne-totp-toggle` (Target input: `#nl-save-totp` / `#ne-totp`)
    *   `#nl-save-ssn-toggle` / `#ne-ssn-toggle` (Target input: `#nl-save-ssn` / `#ne-ssn`)
    *   `#nl-save-passport-toggle` / `#ne-passport-toggle` (Target input: `#nl-save-passport` / `#ne-passport`)

### 7.2. Password Strength Evaluation Hook
For `'login'` items, real-time typing listeners are attached to the password field. The strength is computed on every keystroke:
*   **Target Input Selector:** `#nl-save-password` (for Save) and `#ne-pass` (for Edit)
*   **Callback Routine:**
    ```javascript
    const strength = calculateStrength(password);
    const info = getStrengthInfo(strength);
    const percentWidths = [0, 25, 60, 100];
    const strengthColors = ['var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--success)'];

    const barEl = $('nl-save-strength-bar');
    const labelEl = $('nl-save-strength-label');

    if (barEl) {
      barEl.style.width = percentWidths[strength] + '%';
      barEl.style.background = strengthColors[strength];
    }
    if (labelEl) {
      labelEl.textContent = info.label;
      labelEl.className = 'nl-strength-label ' + info.cls;
    }
    ```

### 7.3. Quick Generator Injection
The "Gen" button (`#nl-save-gen-btn` or `#ne-gen-btn`) fetches the saved configuration from local storage, generates a strong password using the Web Crypto random generator, populates the password input directly, and fires a synthetic input event to update the visual strength meter:
```javascript
$('nl-save-gen-btn')?.addEventListener('click', async () => {
  const cfg = await loadGeneratorConfig();
  const res = generatePassword(cfg);
  const passInput = $('nl-save-password');
  if (passInput) {
    passInput.value = res.password;
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
```

### 7.4. Live Edit TOTP Code Stream
When editing an existing item that has a valid TOTP secret, the edit view dynamically generates a live verification code row directly below the TOTP secret input.
*   **Trigger Condition:** `details.has_totp === true`
*   **DOM Element Appended:**
    ```html
    <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bg-base);border-top:1px solid var(--border)">
      <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;min-width:70px">Live Code</span>
      <span id="ne-live-code" style="font-size:18px;letter-spacing:4px;color:var(--accent);font-family:monospace">------</span>
      <span id="ne-live-timer" style="font-size:10px;color:var(--text-muted)"></span>
      <button type="button" id="ne-copy-live-totp" class="nl-btn nl-btn-sm nl-btn-totp" style="margin-left:auto">Copy</button>
    </div>
    ```
*   **Poller Loop:** Uses a `setInterval` triggering every `1000ms` calling `sendBg({ type: 'GET_TOTP', id })` to query active TOTP sequences, showing a countdown and highlighting in `var(--warning)` when `seconds_remaining <= 5`.
*   **Memory Management:** The interval timer is assigned to the global `_viewCleanup` closure, ensuring it is automatically cleared during routing sweeps when navigating away from the edit view.

---

## See Also
- [Popup](../popup.md)
- [Entries View](entries.md)
- [Settings View](settings.md)
- [Generator View](generator-view.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*