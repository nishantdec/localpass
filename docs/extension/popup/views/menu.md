[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Navigation Menu & Vault Filters Reference

## 1. Overview and Purpose
The Navigation Menu and Filters in the localpass browser extension popup provide a central hub for navigating the application and organizing vault entries. Built into the popup SPA architecture, the **Menu View** acts as a routing table, providing navigation shortcuts to primary views. Working alongside it, the **Filter System** handles dynamic, multi-dimensional search queries, grouping entries by type (Logins, Cards, Identities, Notes) or organizational folder. It also includes an onboarding workflow for creating custom folders.

---

## 2. File Location and Core Files
*   **Source View Logic:** `localpass-extension/popup/popup.js` (Lines 3006–3202)
*   **Target Output File:** `docs/extension/popup/views/menu.md`
*   **Associated Stylesheet:** `localpass-extension/popup/popup.css` (specifically `.nl-menu`, `.nl-menu-item`, `.nl-filter-dropdown-item`, and modals)

---

## 3. Dynamic Visual Layouts

### 3.1. Navigation Menu View
Renders when the user clicks the menu button in the navigation bar.
```
+-----------------------------------------------------------------+
|  NAVIGATION DRAWER                                              |
|                                                                 |
|  [#]  All Entries              -->  Routes to Search View       |
|  [G]  Password Generator       -->  Routes to Generator View    |
|  [A]  Auto Login Setup         -->  Routes to Auto-Login Panel  |
|  [=]  Settings                 -->  Routes to Settings Dashboard|
+-----------------------------------------------------------------+
```

### 3.2. Vault Filter Bar (Dynamic Search Header)
Injected at the top of the search and entries dashboards.
```
+-----------------------------------------------------------------+
|  FILTER PANEL HEADER                                            |
|                                                                 |
|  +---------------------------+     +--------------------------+ |
|  | Folders: [ All folders v ] |     | Types:   [ All types v ] | |
|  +---------------------------+     +--------------------------+ |
|               |                                  |              |
|        FOLDER DROPDOWN                    TYPE DROPDOWN         |
|  +---------------------------+     +--------------------------+ |
|  | * All folders             |     | * All types              | |
|  |   Unassigned              |     |   Logins                 | |
|  |   Personal                |     |   Cards                  | |
|  |   Work Projects           |     |   Identities             | |
|  |  -----------------------  |     |   Notes                  | |
|  | + Create folder...        |     +--------------------------+ |
|  +---------------------------+                                  |
+-----------------------------------------------------------------+
```

---

## 4. Detailed Function Specifications

### 4.1. `viewRenderers.menu`
*   **Signature:** `registerView('menu', () => { ... })`
*   **Purpose:** Renders navigation controls directly into the DOM container `#nl-content`.
*   **Called by:** `navigateTo('menu')` from navigation bar button.
*   **Calls:**
    *   `navigateTo('search')`.
    *   `navigateTo('generator')`.
    *   `navigateTo('autologin')`.
    *   `navigateTo('settings')`.
*   **Functional Code Example:**
    ```javascript
    // Render navigation routing drawer
    navigateTo('menu');
    ```

### 4.2. `populateFolderFilterOptions`
*   **Signature:** `async function populateFolderFilterOptions() { ... }`
*   **Purpose:** Assembles option elements for the folder filter dropdown. Clears the previous state, injects default items ("All folders" and "Unassigned"), reads custom folders from storage, and appends a "Create folder..." trigger at the bottom.
*   **Called by:** `initializeFilters()`.
*   **Calls:**
    *   `chrome.storage.local.get('folders')` (queries user-defined lists).
    *   `escapeHtml(raw)`.
*   **Logical Execution Flow:**
    ```mermaid
    graph TD
        A[Start: Populate Folder dropdown] --> B[Clear #nl-folder-filter-dropdown]
        B --> C[Add 'All folders' Option]
        C --> D[Add 'Unassigned' Option]
        D --> E[Query chrome.storage.local for 'folders']
        E --> F{Folders Array exists?}
        F -- Yes --> G[Loop and append custom folders]
        F -- No --> H[Add Divider]
        G --> H
        H --> I[Add '+ Create folder...' trigger Option]
        I --> J[Update #nl-folder-filter-label text]
        J --> K[End]
    ```

### 4.3. `initializeFilters`
*   **Signature:** `function initializeFilters() { ... }`
*   **Purpose:** Binds click listeners and dropdown hooks to the filter bar in the DOM.
*   **Called by:**
    *   `viewRenderers.entries` (vault landing pane initialization).
    *   `viewRenderers.search` (search dashboard initialization).
*   **Behavior:**
    *   Handles opening and closing the folder dropdown, while closing the type dropdown (and vice versa) to avoid visual overlap.
    *   Intercepts folder selections. If **Create folder...** is clicked, it opens the modal overlay (`#nl-folder-modal`). For other options, it updates the search state filter (`currentFolderFilter`) and refreshes the entry list:
        ```javascript
        currentFolderFilter = selectedVal;
        await populateFolderFilterOptions();
        if (viewStack[viewStack.length - 1] === 'entries' && viewRenderers['entries']) {
          viewRenderers['entries']({ domain: currentDomain });
        }
        ```

---

## 5. Storage Schemas & Persistent Preferences

Filters read and write configuration options to `chrome.storage.local`.

### 5.1. Folders Array Schema (`folders`)
Stores the master list of folders defined by the user.
*   **Key:** `'folders'`
*   **Storage Type:** `string[]`
*   **Schema Schema:**
    ```json
    [
      "Personal",
      "Work Projects",
      "Financials"
    ]
    ```

### 5.2. Folder Association Schema (`entryFolders`)
Maps individual vault entry UUIDs to folder names.
*   **Key:** `'entryFolders'`
*   **Storage Type:** `Record<string, string>`
*   **Schema Schema:**
    ```json
    {
      "2a3f5a2e-4cf0-4228-a3bd-2191c95b6cb0": "Personal",
      "d2d0b5d9-4835-412e-a342-3081e7d8dca1": "Work Projects"
    }
    ```

---

## 6. Folder Onboarding Dialog Flow & Action Handlers

When a user selects the **Create folder...** option in the dropdown filter:

```
+-----------------------------------------------------------------------+
|  #nl-folder-modal (Modal Dialog Overlay)                              |
+-----------------------------------------------------------------------+
|  CREATE NEW FOLDER                                                    |
|                                                                       |
|  Folder Name:                                                         |
|  +-----------------------------------------------------------------+  |
|  | [ Input Text: Enter folder name... ]                            |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  [ Cancel Button ]                               [ Create Button ]    |
+-----------------------------------------------------------------------+
```

1.  **Overlay Activation:** The dropdown interceptor removes the `.hidden` class from the `#nl-folder-modal` overlay, focusing the text field `#nl-folder-name-input`.
2.  **Input Submission:** Clicking the create button or pressing Enter fires the form's submit listener:
    ```javascript
    $('nl-folder-save-btn').addEventListener('click', async () => {
      const name = $('nl-folder-name-input').value.trim();
      if (!name) return;

      const { folders = [] } = await new Promise(resolve => {
        chrome.storage.local.get('folders', d => resolve(d || {}));
      });

      if (!folders.includes(name)) {
        folders.push(name);
        await new Promise(resolve => {
          chrome.storage.local.set({ folders }, resolve);
        });
      }

      // Close modal and set active folder filter to the new folder
      $('nl-folder-modal').classList.add('hidden');
      currentFolderFilter = name;
      await populateFolderFilterOptions();
      
      // Refresh active entry list view
      if (viewRenderers['entries']) {
        viewRenderers['entries']({ domain: currentDomain });
      }
    });
    ```
3.  **Cancellation:** Clicking the cancel button hides the modal overlay without saving.

---

## See Also
- [Popup](../popup.md)
- [Entries View](entries.md)
- [Settings View](settings.md)
- [Generator View](generator-view.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*