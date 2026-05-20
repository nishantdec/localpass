[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Password Autofill Sequence Flow

This document details the step-by-step asynchronous messaging pipeline that executes when a user interacts with a password form field, triggers the inline dropdown, matches credentials via local server domain routing, and autofills credentials on a page.

## Complete Autofill Sequence Diagram

```text
USER           WEBPAGE        CONTENT SCRIPTS    BACKGROUND      PYTHON SERVER
│                │                 │                │                │
│  focuses       │                 │                │                │
│  email field ──►                 │                │                │
│                │  focusin event  │                │                │
│                ├────────────────►│                │                │
│                │                 │ sendMessage     │                │
│                │                 │ GET_CREDENTIALS │                │
│                │                 ├───────────────►│                │
│                │                 │                │ POST           │
│                │                 │                │ /credentials   │
│                │                 │                ├───────────────►│
│                │                 │                │                │ match entries
│                │                 │                │                │ by domain
│                │                 │                │◄───────────────┤
│                │                 │                │ [{id,username, │
│                │                 │                │   type,        │
│                │                 │◄───────────────┤   has_totp}]   │
│                │  showDropdown() │                │                │
│                │◄────────────────┤                │                │
│  sees dropdown │                 │                │                │
│◄───────────────┤                 │                │                │
│                │                 │                │                │
│  clicks entry  │                 │                │                │
├───────────────►│                 │                │                │
│                │  mousedown      │                │                │
│                ├────────────────►│                │                │
│                │                 │ sendMessage     │                │
│                │                 │ GET_FILL {id}  │                │
│                │                 ├───────────────►│                │
│                │                 │                │ POST /fill     │
│                │                 │                ├───────────────►│
│                │                 │                │                │ decrypt vault
│                │                 │                │                │ get password
│                │                 │                │◄───────────────┤
│                │                 │                │ {username,     │
│                │                 │◄───────────────┤  password}     │
│                │                 │ fillField()     │                │
│                ◄─────────────────┤                │                │
│  fields filled │                 │                │                │
│◄───────────────┤                 │                │                │
```

---

## Detailed Step-by-Step Breakdown

### Step 1: User Focuses Form Field
*   **Trigger**: The user clicks or tabs into a username, email, or password text input field on the DOM.
*   **Source**: The web page DOM.
*   **File**: `localpass-extension/content.js`
*   **Mechanic**: An event listener catches the standard bubble-up `focusin` event registered on input elements by `injector.js`.

### Step 2: Content Script Extracts Domain & Sends Message
*   **Action**: The content script captures the current webpage's hostname and filters out leading domains (e.g. stripping `www.`).
*   **File**: `localpass-extension/content.js` (inside `handleFocus(event)`)
*   **Message Type**: `GET_CREDENTIALS`
*   **Payload Format**:
    ```javascript
    {
      "type": "GET_CREDENTIALS",
      "domain": "github.com"
    }
    ```
*   **Method**: Called via `chrome.runtime.sendMessage()`.

### Step 3: Service Worker Receives Message & Calls Local Server
*   **Action**: The extension's background script catches the message, injects the active handshaked security session token, and triggers a fetch command targeting the local HTTP API.
*   **File**: `localpass-extension/background.js` (inside `chrome.runtime.onMessage.addListener`)
*   **API Endpoint**: `POST http://127.0.0.1:27432/credentials`
*   **Headers**:
    *   `Content-Type: application/json`
    *   `X-NL-Token: <32-byte-hex-session-token>`
*   **Body**:
    ```json
    { "domain": "github.com" }
    ```

### Step 4: Python Daemon Matches Domain Records
*   **Action**: The thread handler decodes the payload, validates the token in headers, and Queries the vault database entries for matching hosts.
*   **File**: `server/local_server.py` (inside `handle_credentials()`) -> `localpass/core/entries.py`
*   **Domain Matching Rules**:
    *   Strips `www.` from search domains and entries.
    *   Compares input hostname to entry URL fields.
    *   If no exact matches occur, it conducts fallback parsing matching the domain string against entry titles.
*   **Payload Sent Back**: An array of objects excluding plaintext passwords.
    ```json
    [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "GitHub",
        "username": "user@email.com",
        "type": "login",
        "has_totp": true
      }
    ]
    ```

### Step 5: Inline Dropdown Renders Suggestions
*   **Action**: The content script receives the asynchronous message response, constructs a custom absolute-positioned `div` container (avoiding iframe leaks where possible), and attaches it below the focused input element.
*   **File**: `localpass-extension/content.js` (inside `showDropdown()`)
*   **Visual Interface**: Elements styled matching the localpass cyan layout containing matching account options.

### Step 6: User Selects Credential Option
*   **Action**: The user clicks one of the credential items rendered inside the suggestion dropdown.
*   **Event Caught**: `mousedown` event on the selected dropdown row container.
*   **File**: `localpass-extension/content.js` (inside `onSelectEntry(entry_id)`)

### Step 7: Requesting Plaintext Password Decryption
*   **Action**: The script requests the complete decrypted credentials matching the record ID.
*   **File**: `localpass-extension/content.js`
*   **Message Type**: `GET_FILL`
*   **Payload Format**:
    ```javascript
    {
      "type": "GET_FILL",
      "id": "550e8400-e29b-41d4-a716-446655440000"
    }
    ```
*   **Method**: Called via `chrome.runtime.sendMessage()`.

### Step 8: Service Worker fetches Plaintext Credentials
*   **Action**: Background catches `GET_FILL` and hits `/fill` on Python server.
*   **File**: `localpass-extension/background.js`
*   **API Endpoint**: `POST http://127.0.0.1:27432/fill`
*   **Headers**: Includes active session header `X-NL-Token`.
*   **Body**:
    ```json
    { "id": "550e8400-e29b-41d4-a716-446655440000" }
    ```

### Step 9: Vault Plaintext Retrieval in Python
*   **Action**: Server validates token, accesses decrypted entries cached securely in-memory, extracts plaintext strings, and maps them to JSON output.
*   **File**: `server/local_server.py` (inside `handle_fill()`)
*   **Response Payload**:
    ```json
    {
      "username": "user@email.com",
      "password": "decryptedPasswordStringValueHere"
    }
    ```

### Step 10: Injecting Plaintext values safely into form
*   **Action**: The content script receives the credentials and inserts values directly.
*   **File**: `localpass-extension/content.js` (inside `fillField()`)
*   **React & Framework Bypass Mechanic**: High-modern web applications using UI frameworks (like React, Vue, Svelte) hook browser input bindings. Directly assigning `.value = password` fails to update internal framework components. To resolve this, `filler.js` intercepts prototype descriptors:
    ```javascript
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeSetter.call(inputField, value);
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    ```
    This updates the DOM and forces the frontend framework's internal virtual DOM state binding engines to synchronize.
*   **Result**: Inputs are fully populated and form fields appear visually filled with green/cyan feedback indicators.

---

## See Also
- [System Overview Diagram](system-overview.md)
- [Vault Encryption Diagram](vault-encryption.md)
- [Extension Communication Diagram](extension-communication.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*