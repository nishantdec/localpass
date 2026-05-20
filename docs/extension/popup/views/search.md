[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Global Search Panel & Filtering View (`search.md`)

## 1. Overview
The **Global Search Panel** (`'search'`) provides a real-time, fuzzy search interface for the localpass vault database. It allows users to quickly locate credentials by typing queries that match the title, username, or URL of vault entries.

Search queries are matched dynamically. As the user types, the interface updates in real-time, applying folder and credential type filters to refine the results and highlighting matched text within the UI.

---

## 2. Real-Time Search & Highlight Workflow
The sequence below outlines how keystrokes in the search bar trigger database queries and update the UI:

```
                  [ User Types in Search Input ]
                                │
                       [ Debounce Check ]
                                │
                        Is Query Empty?
                                │
               ┌────────────────┴────────────────┐
               ▼ Yes                             ▼ No
      Navigate to 'entries'             Trigger Search:
      (Default Vault View)              sendBg({type: "SEARCH", query: "..."})
                                                 │
                                        Apply Active Filters
                                        (Folders & Credential Types)
                                                 │
                                        Highlight Matched Text
                                                 │
                                       Update #nl-content Container
```

### Text Match Highlighting
To improve readability, search results highlight matching text within the entry's title or username. The script matches the query string using a case-insensitive regular expression and wraps the match in a styled container:
```html
<!-- Example matching query "git" -->
<span class="highlight">Git</span>Hub Profile
```

---

## 3. Visual Search Interface Layout
The search interface overlays the standard entries list, displaying matching results alongside active category filter chips:

```
┌────────────────────────────────────────────────────────┐
│  Search: [ git                       ] [Cancel]        │
├────────────────────────────────────────────────────────┤
│  Filters: ( All Folders ) ( All Types )                │
├────────────────────────────────────────────────────────┤
│  Suggested Matches                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ┌───┐  [Git]Hub - Developer Profile              │  │
│  │ │ G │  north@gmail.com                           │  │
│  │ └───┘                                            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Technical Function Reference

### `'search'` View Renderer
Registers and renders the search panel layout inside the `#nl-content` block.
* **Signature:** `registerView('search', () => { ... })`
* **Parameters:** None.
* **Returns:** `void`
* **Called By:**
  - `popup.js` -> Input event listener on `#nl-search-input`.
* **Calls:**
  - `sendBg()` (using the `SEARCH` action)
  - `renderSearchResults()`

---

### `renderSearchResults()`
Processes the list of search results returned from the database, applies active filters, and renders the matching entry rows.
* **Signature:** `function renderSearchResults(entries, query)`
* **Parameters:**
  - `entries` (`array`): Array of matching credential records returned by the database.
  - `query` (`string`): The search query typed by the user.
* **Returns:** `void`
* **Called By:**
  - `search` view renderer.
* **Calls:**
  - `makeEntryRow()`
* **Working Example:**
  ```javascript
  const entries = [
    { id: "e1", title: "GitHub", username: "north", type: "login" }
  ];
  renderSearchResults(entries, "git");
  ```

---

### Folder & Type Filters
The search results respect the folder and entry type filters selected in the Vault view:
*   **`currentFolderFilter`** (`string`): Filters results to a specific folder UUID (or `'all'` to search the entire vault).
*   **`currentTypeFilter`** (`string`): Filters results by credential type (e.g. `'login'`, `'note'`, or `'passkey'`).

```javascript
// Example filter check applied during search rendering
const filtered = entries.filter(e => {
  const matchesFolder = currentFolderFilter === 'all' || e.folder_id === currentFolderFilter;
  const matchesType = currentTypeFilter === 'all' || e.type === currentTypeFilter;
  return matchesFolder && matchesType;
});
```

---

## See Also
- [App](../../../python-app/ui/app.md)
- [Dashboard Screen](../../../python-app/ui/screens/dashboard.md)
- [Entry View Screen](../../../python-app/ui/screens/entry-view.md)
- [Entry List Component](../../../python-app/ui/components/entry-list.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*