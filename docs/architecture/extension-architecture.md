[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Browser Extension Architecture and Internals

This document details the internal architecture, security designs, form-field detection heuristics, and single-page application (SPA) value injection mechanics of the localpass Manifest V3 browser extension.

---

## 1. WebExtension Components and Sandbox Contexts

The extension is structured around Manifest V3 specifications. It divides execution across three isolated contexts:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              POPUP SPA                                 │
│  - Environment: popup.html / popup.js / popup.css                      │
│  - Lifecycle: Transient (instantiated on click, destroyed on blur).     │
│  - Operations: Renders entries lists, search results, settings UI.      │
│  - Storage: No persistent local data storage. Relies on Background SW.  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ chrome.runtime
                                   │ .sendMessage()
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SERVICE WORKER                         │
│  - Environment: background.js (Service Worker thread).                 │
│  - Lifecycle: Persistent-on-demand (managed by the browser runtime).   │
│  - Operations: Manages API challenge-response handshakes, maintains    │
│    the active session token, routes REST API requests, and executes    │
│    native message exchanges.                                           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ chrome.tabs
                                   │ .sendMessage()
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           CONTENT SCRIPT                               │
│  - Environment: content.js / detector.js / filler.js / observer.js     │
│  - Lifecycle: Injected into every open web page tab DOM context.       │
│  - Operations: Monitors input focus events, scans page forms, injects  │
│    cyan field buttons, and manipulates field values.                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Input Detection and Form-Scanning Heuristics

Form detection is performed by `detector.js` and `injector.js` injected as content scripts. The extension uses heuristics to find username and password fields without relying on specific website IDs.

### A. Element Scanning Strategy
1.  **Password Fields**: Scans the DOM for `<input>` elements where the `type` attribute is strictly set to `"password"`.
2.  **Username/Email Fields**: For every password field identified, the script scans the parent `<form>` (or nearest structural container) for a corresponding login input. It targets `<input>` elements matching these criteria:
    *   `type` is set to `"text"`, `"email"`, or `"number"`.
    *   `name` or `id` attributes contain strings like: `"user"`, `"login"`, `"email"`, `"mail"`, `"acct"`, `"member"`.
    *   Visible input elements positioned directly before the password field in the DOM hierarchy.

### B. Dynamic DOM Monitoring (MutationObserver)
Many modern web applications construct form fields dynamically using JavaScript (e.g. React portals, lazy-loaded overlays). To ensure these fields are captured:
*   **Observer Setup**: `observer.js` initializes a browser `MutationObserver` targeted at `document.body` with `subtree: true` and `childList: true` options.
*   **Re-indexing**: When new nodes are added to the DOM, the observer triggers a re-scan. If newly inserted password inputs are found, it injects the localpass field buttons dynamically.

---

## 3. UI Injection and Dropdown Integration

Once matching input fields are verified, the content script modifies the DOM:

1.  **Field Icon Injection**: An absolute-positioned `div` element representing the cyan localpass button is placed inside or adjacent to the password input field.
2.  **Suggestion Dropdown**:
    *   When the user focuses the field, a `div` element with the ID `nl-autofill-dropdown` is created.
    *   To prevent parent containers with `overflow: hidden` from clipping the dropdown, the element is attached directly to `document.body`.
    *   The dropdown is positioned dynamically using absolute coordinates calculated from the target field's bounding rectangle:
        ```javascript
        const rect = inputField.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        ```

---

## 4. Single-Page Application (SPA) Framework Value Injection

Directly modifying an input's value in a modern single-page application (built with React, Angular, Svelte, or Vue) often fails:
```javascript
// This fails in React / SPA environments:
inputField.value = "decryptedPassword";
```
SPA frameworks intercept DOM changes using virtual DOM engines and prototype getters/setters. Directly altering `.value` updates the screen visually but does not update the framework's internal state. Consequently, the input is cleared the moment the user clicks the "Submit" button.

### The Prototype Override Mechanic
To bypass this limitation, `filler.js` retrieves the browser's native input value setter, executes it directly in the element's context, and dispatches native input events to force state synchronization:

```javascript
function forceInputValue(inputElement, value) {
  // 1. Get the native HTMLInputElement value setter descriptor
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 
    "value"
  ).set;
  
  // 2. Call the native setter bypass wrapper directly
  nativeSetter.call(inputElement, value);
  
  // 3. Dispatch bubbles-up input and change events
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}
```
This forces SPA framework state synchronization engines to recognize the new value, ensuring successful form submission.

---

## 5. Security Properties and Zero-Persistence Policies

*   **Zero Local Storage**: The extension does not store passwords or secrets in `chrome.storage.local` or `chrome.storage.session`. Ground credentials exist only in the transient memory heap of the background service worker or popup context during active transactions, and are zeroed immediately afterward.
*   **Origin Policy Lock**: The content script cannot query `/fill` or `/credentials` directly from the webpage context. Only the background service worker is authorized to make these network requests, protecting the vault from malicious scripts on the web page.
*   **WebAuthn Passkey Interceptor Isolation**: The passkey interceptor runs in the page's "main world" to hook APIs, but delegates private key actions and credential signing securely to the background service worker, keeping the private key isolated from the webpage DOM.

---

## See Also
- [Architecture Overview](overview.md)
- [Security Model](security-model.md)
- [Data Flow](data-flow.md)
- [System Overview Diagram](diagrams/system-overview.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*