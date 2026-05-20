[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Popup SPA Router & Initialization (`popup.md`)

## 1. Overview & Single Page Application (SPA) Architecture
The localpass browser extension popup is designed as a stateless **Single Page Application (SPA)**. To prevent the browser window from redrawing completely when navigating between views (such as moving from the credentials list to the settings menu), the application dynamically clears and updates a single container element (`#nl-content`) in the DOM.

All communication with the local desktop vault is managed asynchronously by sending JSON messages to the background service worker (`background.js`). The popup contains no local storage and does not execute raw cryptographic vault operations directly.

---

## 2. Popup Initialization & Mounting Sequence
When the user clicks the extension icon in the browser toolbar, the popup window opens and executes the following startup sequence:

```
[ Click Extension Icon ]
           │
           ▼
     Mount popup.html
           │
           ▼
       init() Callback
           │
  ┌────────┴──────────────────────────┐
  ▼ Check Server Connectivity         ▼ Load Configuration
  sendBg({type: "PING"})              Read chrome.storage.local
  Is server active/unlocked?          (theme, size, auto-login)
  │                                   │
  └────────┬──────────────────────────┘
           │
           ▼
  Identify Active Tab Origin
  chrome.tabs.query() ──► Extract Base Domain (e.g. google.com)
           │
           ▼
  Populate Filtering Trees
  populateFolderFilterOptions() & initializeFilters()
           │
           ▼
  Mount Primary View
  navigateTo('entries', { domain: "google.com" })
```

---

## 3. Navigation Stack & History Management
To manage navigation flows (including submenus and editor panels), the router utilizes a history array called the `viewStack`:
*   **`viewStack`** (`string[]`): Starts with `['entries']`. 
*   **`navigateTo(name, params)`**: Pushes a new view name onto the stack, clears `#nl-content`, and mounts the new view.
*   **`navigateBack()`**: Pops the top view from the stack and redraws the previous view.

---

## 4. Technical Function Reference

### `init()`
Popup bootstrap function that verifies connectivity, configures visual themes, parses domain values, and mounts the primary view.
* **Signature:** `async function init()`
* **Parameters:** None.
* **Returns:** `Promise<void>`
* **Called By:** 
  - Automated entry point trigger at the bottom of `popup.js`.
* **Calls:**
  - `sendBg()`
  - `chrome.tabs.query()`
  - `getBaseDomain()`
  - `populateFolderFilterOptions()`
  - `initializeFilters()`
  - `navigateTo()`
* **Working Example:**
  ```javascript
  // Triggered automatically on popup DOM load
  document.addEventListener('DOMContentLoaded', init);
  ```

---

### `navigateTo()`
Navigates to a new view, updates the history stack, cleans up the previous view, and updates the layout headers.
* **Signature:** `function navigateTo(name, params = {})`
* **Parameters:**
  - `name` (`string`): The registered view name (e.g. `'settings'`).
  - `params` (`object`): Payload options passed to the target view renderer.
* **Returns:** `void`
* **Called By:**
  - Navigation handlers, bottom bar buttons, and edit triggers.
* **Calls:**
  - `_viewCleanup()` (Clears timers or listeners from the old view).
  - `updateHeaderTitle()`
  - `updateBackBar()`
  - `updateBottomNav()`
* **Working Example:**
  ```javascript
  // Open the password generator panel
  navigateTo('generator', { returnTo: 'entries' });
  ```

---

### `navigateBack()`
Steps back to the previous screen in the navigation stack.
* **Signature:** `function navigateBack()`
* **Parameters:** None.
* **Returns:** `void`
* **Called By:**
  - Back bar click listener.
* **Calls:**
  - `navigateTo()`
* **Working Example:**
  ```javascript
  // Go back to the previous view
  navigateBack();
  ```

---

### `registerView()`
Registers a rendering callback function for a view.
* **Signature:** `function registerView(name, fn)`
* **Parameters:**
  - `name` (`string`): Unique string identifier for the view.
  - `fn` (`function`): Rendering callback function.
* **Returns:** `void`
* **Called By:**
  - View renderer scripts.
* **Working Example:**
  ```javascript
  registerView('custom-view', (params) => {
    $('nl-content').innerHTML = '<h1>My Custom View</h1>';
  });
  ```

---

## 5. Unified Bottom & Form Action Bars
The router manages two footer menus dynamically depending on whether the active view is a standard panel or an entry editor:

```javascript
function updateBottomNav(active) {
  const isFormView = active === 'save' || active === 'edit';
  $('nl-bottom-nav').classList.toggle('hidden', isFormView);
  $('nl-form-actions-bar').classList.toggle('hidden', !isFormView);
}
```
*   **Standard View Footer (`#nl-bottom-nav`):** Shows icons for **Vault** (Entries), **Search**, **Generator**, and **Settings**.
*   **Editor View Footer (`#nl-form-actions-bar`):** Replaces the navigation icons with **Save** and **Cancel** buttons.

---

## See Also
- [Entries View](views/entries.md)
- [Settings View](views/settings.md)
- [Layout Css](styles/layout-css.md)
- [Extension Overview](../overview.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*