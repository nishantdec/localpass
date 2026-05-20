[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Detail (Inspect) View Reference

## 1. Overview and Purpose
The Detail view in the localpass browser extension popup displays the decrypted fields of an individual credential item. Written as a dynamic single-page component inside `popup.js`, the detail view adapts its layout and controls based on the record's underlying schema type (Login, Payment Card, Secure Identity, Secure Note, SSH Keypair, or Passkey). It allows users to view, copy, decrypt, delete, and autofill fields directly in the browser's active tab.

---

## 2. File Location and Core Files
*   **Source View Logic:** `localpass-extension/popup/popup.js` (Lines 982–1665)
*   **Target Output File:** `docs/extension/popup/views/detail.md`
*   **Associated Stylesheet:** `localpass-extension/popup/popup.css` (specifically `.nl-action-btn`, `.nl-btn-danger`, `.nl-entry-avatar`, `.nl-empty`, and layout cards)

---

## 3. Dynamic Visual Layouts

The detail view constructs tailored layouts depending on the credential's `type` field:

### 3.1. Passkey Layout
```
+-------------------------------------------------------------------------+
| [Avatar (Fingerprint)]   Relying Party Name / ID                        |
|                          "Passkey Credential"                           |
+-------------------------------------------------------------------------+
| PASSKEY DETAILS                                                         |
| Relying Party: [ rp.name ]  (e.g. github.com)                           |
| Credential ID: [ Base64URL-encoded ID... ]       [ Copy Button ]        |
| Algorithm:     ECDSA ES256 (P-256)                                      |
| Protection:    Encrypted at Rest (AES-GCM)                              |
| Usage:         Used X times  (Last Used: MM/DD/YYYY HH:MM)              |
+-------------------------------------------------------------------------+
| [ Notes Card (if present) ]                                             |
+-------------------------------------------------------------------------+
| [ Sticky Actions: (Delete Button) ]                                     |
+-------------------------------------------------------------------------+
```

### 3.2. Payment Card Layout
```
+-------------------------------------------------------------------------+
| [Avatar (Card Icon)]     Item Name (e.g. Sapphire Preferred)            |
|                          Card Brand (e.g. Visa / Mastercard)            |
+-------------------------------------------------------------------------+
| CARD DETAILS                                                            |
| Cardholder Name:  [ Name ]                       [ Copy Button ]        |
| Card Number:      ●●●●●●●●●●●● (Encrypted)       [ Eye ]  [ Copy ]      |
| Expiration Date:  MM/YYYY                        [ Copy Button ]        |
| Security Code:    ••• (CVV)                      [ Eye ]  [ Copy ]      |
+-------------------------------------------------------------------------+
| [ Notes Card (if present) ]                                             |
+-------------------------------------------------------------------------+
| [ Sticky Actions: [ Edit ]    [ Delete Button ] ]                       |
+-------------------------------------------------------------------------+
```

### 3.3. Secure Identity Layout
```
+-------------------------------------------------------------------------+
| [Avatar (ID Icon)]       Full Name (Title prefix + First + Mid + Last)  |
|                          "Identity Profile"                             |
+-------------------------------------------------------------------------+
| PROFILE DETAILS                                                         |
| Full Name:        [ Name ]                       [ Copy Button ]        |
| Username/Login:   [ username ]                   [ Copy Button ]        |
| Company:          [ Company Name ]               [ Copy Button ]        |
| SSN:              •••••••••                      [ Eye ]  [ Copy ]      |
| Passport Number:  •••••••••                      [ Eye ]  [ Copy ]      |
+-------------------------------------------------------------------------+
| [ Notes Card (if present) ]                                             |
+-------------------------------------------------------------------------+
| [ Sticky Actions: [ Edit ]    [ Delete Button ] ]                       |
+-------------------------------------------------------------------------+
```

### 3.4. SSH Keypair Layout
```
+-------------------------------------------------------------------------+
| [Avatar (Key Icon)]      Key Label                                      |
|                          "SSH Keypair"                                  |
+-------------------------------------------------------------------------+
| KEYPAIR DETAILS                                                         |
| Public Key:       [ Textarea: ssh-rsa AAAAB3N... ]       [ Copy ]       |
| Private Key:      [ Textarea: (Blurred by Default) ]      [ Eye ] [ Copy ]
+-------------------------------------------------------------------------+
| [ Notes Card (if present) ]                                             |
+-------------------------------------------------------------------------+
| [ Sticky Actions: [ Edit ]    [ Delete Button ] ]                       |
+-------------------------------------------------------------------------+
```

### 3.5. Standard Login Layout
```
+-------------------------------------------------------------------------+
| [Avatar (Favicon)]       Item Title                                     |
|                          Domain Name                                    |
+-------------------------------------------------------------------------+
| LOGIN CREDENTIALS                                                       |
| Username:         [ username ]                   [ Copy Button ]        |
| Password:         ●●●●●●●●●●●● (Encrypted)       [ Eye ]  [ Copy ]      |
| Verification Code: ------ (TOTP 6-digit Code)     [ Countdown ]  [ Copy ]
+-------------------------------------------------------------------------+
| WEBSITE                                                                 |
| URL Target:       [ https://example.com ]                               |
+-------------------------------------------------------------------------+
| [ Notes Card (if present) ]                                             |
+-------------------------------------------------------------------------+
| [ Sticky Actions: [ Edit ]  [ Fill active tab ]    [ Delete Button ] ]  |
+-------------------------------------------------------------------------+
```

---

## 4. Function Specifications

### 4.1. `viewRenderers.detail`
*   **Signature:** `registerView('detail', async ({ id } = {}) => { ... })`
*   **Parameters:**
    *   `id` (type: `string`, required): Unique UUID string of the entry.
*   **Returns:** `Promise<void>` (Renders detail components asynchronously into DOM container `#nl-content`).
*   **Called by:**
    *   Clicking an entry row in `search` or `entries` views.
*   **Calls:**
    *   `sendBg` with payload `{ type: 'GET_ENTRY', id }`
    *   `sendBg` with payload `{ type: 'GET_FILL', id }`
    *   `sendBg` with payload `{ type: 'GET_TOTP', id }`
    *   `getFaviconUrl(url)` (Utility returning a cached icon from the domain).
    *   `escapeHtml(raw)` (Sanitization routine).
    *   `flashGreen(button)` (Momentarily turns a copy button green for visual confirmation).
    *   `navigateTo('edit', { id })`.
    *   `deleteEntry(id)` (Invokes standard deletion modal workflow).
*   **Functional Code Example:**
    ```javascript
    // Render detail dashboard for an item
    navigateTo('detail', { id: 'd2d0b5d9-4835-412e-a342-3081e7d8dca1' });
    ```

### 4.2. `flashGreen`
*   **Signature:** `function flashGreen(btn) { ... }`
*   **Parameters:**
    *   `btn` (type: `HTMLElement`, required): The button element to colorize.
*   **Returns:** `void` (Modifies the button's style dynamically, then restores it after `1500ms`).

### 4.3. `updateTotpDv`
*   **Signature:** `async function updateTotpDv() { ... }`
*   **Parameters:** None
*   **Returns:** `Promise<void>` (Updates live TOTP display timers and text fields on the DOM).
*   **Lifecycle:** Called once on initialization, then scheduled on a `setInterval` loop every `1000ms`. Automatically cleared by `_viewCleanup`.

---

## 5. IPC Messages Exchanged

The Detail view exchanges five structured message formats with the extension background worker (`background.js`):

### 5.1. `GET_ENTRY`
Fetches static metadata, title, type, optional folder settings, and notes.
*   **Outgoing Schema:**
    ```json
    {
      "type": "GET_ENTRY",
      "id": "d2d0b5d9-4835-412e-a342-3081e7d8dca1"
    }
    ```
*   **Response Schema:**
    ```json
    {
      "id": "d2d0b5d9-4835-412e-a342-3081e7d8dca1",
      "type": "login",
      "title": "GitHub Personal",
      "username": "developer_john",
      "url": "https://github.com/login",
      "has_totp": true,
      "notes": "My admin dashboard access."
    }
    ```

### 5.2. `GET_FILL`
Requests dynamic decryption of the credentials (e.g. password or secure card numbers).
*   **Outgoing Schema:**
    ```json
    {
      "type": "GET_FILL",
      "id": "d2d0b5d9-4835-412e-a342-3081e7d8dca1"
    }
    ```
*   **Response Schema:**
    ```json
    {
      "username": "developer_john",
      "password": "SecureDecryptedPasswordHere"
    }
    ```

### 5.3. `GET_TOTP`
Generates a time-based verification code.
*   **Outgoing Schema:**
    ```json
    {
      "type": "GET_TOTP",
      "id": "d2d0b5d9-4835-412e-a342-3081e7d8dca1"
    }
    ```
*   **Response Schema:**
    ```json
    {
      "code": "483920",
      "seconds_remaining": 22
    }
    ```

### 5.4. `COPY`
Notifies the background script to securely copy sensitive strings (e.g. passwords/private keys) to the clipboard. Using a background copy operation helps protect against copy-paste interception and ensures memory can be cleared automatically after a configured timeout.
*   **Outgoing Schema:**
    ```json
    {
      "type": "COPY",
      "id": "d2d0b5d9-4835-412e-a342-3081e7d8dca1",
      "field": "password"
    }
    ```
*   **Response Schema:**
    ```json
    {
      "success": true
    }
    ```

### 5.5. `FILL_TAB`
Requests background orchestration to inject username and password fields into the active browser tab.
*   **Outgoing Schema:**
    ```json
    {
      "type": "FILL_TAB",
      "tabId": 18402,
      "username": "developer_john",
      "password": "SecureDecryptedPasswordHere"
    }
    ```
*   **Response Schema:**
    ```json
    {
      "success": true
    }
    ```

---

## 6. Dynamic View Cleanups and Memory Protection

To prevent memory leaks and background message overhead when navigating between screens in the Single Page Application:
1.  **Garbage Collection Registration:** The detail view hooks active loops into the global `_viewCleanup` closure.
2.  **TOTP Poller Deactivation:** When an active interval timer is registered (for updating dynamic 2FA countdowns), it is bound as follows:
    ```javascript
    const dvTotpInterval = setInterval(updateTotpDv, 1000);
    _viewCleanup = () => clearInterval(dvTotpInterval);
    ```
3.  **Destruction Sweep:** Before navigating to any new panel via `navigateTo` or `navigateBack`, the router checks if `_viewCleanup` is defined and executes it:
    ```javascript
    if (typeof _viewCleanup === 'function') {
      _viewCleanup();
      _viewCleanup = null;
    }
    ```

---

## 7. Autofill Event Bindings & Tab Injections

When viewing a `'login'` type entry, a dynamic **Fill** button (`#dv-fill`) is appended to the bottom action bar.
1.  **Trigger Action:** The user clicks `#dv-fill`.
2.  **Data Decryption:** The popup queries the background worker for active fill credentials (`GET_FILL`).
3.  **Injection Hook:**
    ```javascript
    $('dv-fill').addEventListener('click', async () => {
      const fillData = await sendBg({ type: 'GET_FILL', id });
      if (fillData && currentTab) {
        await sendBg({
          type: 'FILL_TAB',
          tabId: currentTab.id,
          username: fillData.username,
          password: fillData.password
        });
        window.close(); // Automatically dismiss the popup after autofilling
      }
    });
    ```
4.  **Security Measures:** The decrypted password is never stored in popup memory beyond this ephemeral event handler, reducing the surface area for extraction.

---

## See Also
- [Popup](../popup.md)
- [Entries View](entries.md)
- [Settings View](settings.md)
- [Generator View](generator-view.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*