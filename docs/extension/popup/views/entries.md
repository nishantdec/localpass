[Home](../../../../README.md) •
[Docs Index](../../../index.md) •
[Quick Start](../../../../QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Vault Entries View & Row Renderer (`entries.md`)

## 1. Overview
The **Vault Entries View** (`'entries'`) serves as the primary dashboard of the localpass browser extension popup. When opened, it queries the active web tab's domain, retrieves matching credential entries from the local vault, and presents them in an interactive list.

It supports contextual domain sorting (displaying **Suggested Logins** matching the active site at the top), search filtering, inline auto-filling, and a detailed context menu for advanced credential operations.

---

## 2. Injected Entry Row Layout
Each credential entry is rendered inside a structured row container. The layout diagram below maps the placement of text, icons, badges, and action triggers:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌───┐  Google Login                                    ┌────┐  ┌───┐  │
│  │ G │  north@gmail.com                     [Passkey]   │Fill│  │ • │  │
│  └───┘                                                  └────┘  │ • │  │
└─────────────────────────────────────────────────────────────────┴───┴──┘
 Favicon  Title & Username                       Type Tag   Fill   Options
                                                           Button  Dropdown
```

### Element Properties
*   **Favicon:** Fetches the site's icon using Google's Favicon API (`https://www.google.com/s2/favicons?domain=<url>&sz=32`). If the fetch fails, it falls back to a placeholder containing the first letter of the credential title.
*   **Text details:** Renders the customized title in bold, alongside the associated username on a secondary row.
*   **Passkey Badge:** If the entry contains an associated WebAuthn credential, a blue `"Passkey"` tag is rendered.
*   **Quick Actions:** A primary `"Fill"` button for fast auto-fill, and an options button (`"• • •"`) to open the context dropdown.

---

## 3. Row Option Dropdown Context Menu
Clicking the options button generates a custom floating context dropdown (`#nl-row-dropdown`) absolute-positioned relative to the clicked row element.

### Context Options & API Mappings
*   **Autofill:** Calls `/fill` to fetch plaintext passwords and dispatches the data to the active browser tab.
*   **Copy Username / Copy Password:** Sends a `COPY` command to the backend worker, writing the text directly to the system clipboard and clearing it after the configured timeout.
*   **Favorite:** Updates the entry's favorite status (`favorite: true | false`) and saves it using `UPDATE_ENTRY`.
*   **Archive:** Sets the entry's archived status and saves it using `UPDATE_ENTRY`.
*   **Clone:** Fetches the entry data, strips the UUID, and saves it as a new credential using `SAVE_ENTRY`.
*   **Delete:** Displays a confirmation prompt, then calls `DELETE_ENTRY` to remove the item from the vault.

---

## 4. Technical Function Reference

### `'entries'` View Renderer
Registers and handles the entries panel creation inside the `#nl-content` block.
* **Signature:** `registerView('entries', async ({ domain } = {}) => { ... })`
* **Parameters:**
  - `domain` (`string`): The active tab domain (retrieved during popup initialization).
* **Returns:** `Promise<void>`
* **Called By:** 
  - `popup.js` -> `init()`, `navigateBack()`, and click listeners.
* **Calls:**
  - `sendBg()` (using `GET_CREDENTIALS`)
  - `makeEntryRow()`
  - `showRowDropdown()`

---

### `makeEntryRow()`
Assembles the HTML row element structure for a credential entry.
* **Signature:** `function makeEntryRow(entry)`
* **Parameters:**
  - `entry` (`object`): The raw credential data record from the database.
* **Returns:** `HTMLElement` (The assembled list row).
* **Called By:**
  - `entries` view renderer.
  - `search` view renderer.
* **Working Example:**
  ```javascript
  const entry = { id: "12", title: "GitLab", username: "north", type: "login" };
  const rowNode = makeEntryRow(entry);
  document.getElementById("list-container").appendChild(rowNode);
  ```

---

### `showRowDropdown()`
Generates and displays the options dropdown menu relative to the clicked button.
* **Signature:** `async function showRowDropdown(btn, id, row)`
* **Parameters:**
  - `btn` (`HTMLElement`): The clicked options button node.
  - `id` (`string`): The target credential's unique UUID.
  - `row` (`HTMLElement`): The parent entry row element.
* **Returns:** `Promise<void>`
* **Called By:**
  - Click listener on row options button.
* **Calls:**
  - `sendBg()` (with `GET_ENTRY`, `COPY`, `DELETE_ENTRY`, or `UPDATE_ENTRY` actions).
* **Working Example:**
  ```javascript
  optionsBtn.addEventListener('click', (e) => {
    showRowDropdown(optionsBtn, "entry-uuid", parentRow);
  });
  ```

---

### `toggleFavorite()` / `toggleArchive()`
Updates the favorite or archived status of an entry and saves the changes back to the vault.
* **Signature:** `async function toggleFavorite(id)` / `async function toggleArchive(id)`
* **Parameters:**
  - `id` (`string`): The target credential's unique UUID.
* **Returns:** `Promise<void>`
* **Called By:**
  - Option dropdown selection.
* **Calls:**
  - `sendBg()` (using `GET_ENTRY` and `UPDATE_ENTRY` actions).

---

## See Also
- [Vault](../../../python-app/core/vault.md)
- [Adapter](../../../python-app/core/adapter.md)
- [Totp](../../../python-app/core/totp.md)
- [Config Reference](../../../reference/config-reference.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*