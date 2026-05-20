[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Inline Autofill Dropdown UI Injector (`dropdown.md`)

## 1. Overview
The **Inline Autofill Dropdown** is a key user experience feature of the localpass browser extension. It dynamically injects a custom suggestions panel into the webpage's DOM, positioned relative to active login and password input fields.

To avoid interference from host webpage CSS rules, the dropdown container is rendered with explicit inline CSS overrides and responds to theme updates, focus adjustments, and dynamic input filtering.

---

## 2. Injected UI Layout Structure
The dropdown container is injected as a top-level `div` element inside the document `body`. The mock structure below outlines its elements and layout:

```
┌────────────────────────────────────────────────────────┐
│  google.com                                            │ ◄── Input Field
└────────────────────────────────────────────────────────┘
  ▼
┌────────────────────────────────────────────────────────┐
│  Suggested Logins (localpass)                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ┌───┐  Google Login                                │ │
│ │ │ G │  north@gmail.com                     [Fill]  │ │
│ │ └───┘                                              │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ ┌───┐  Google Admin                                │ │
│ │ │ G │  admin@gmail.com             [Passkey] [Fill]│ │
│ │ └───┘                                              │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 3. Dynamic Field Filtering Logic
Suggestions are filtered dynamically based on the input field type and user input:

```
                  [ Input Event Triggered ]
                              │
                      Check Field Type
                              │
         ┌────────────────────┴────────────────────┐
         ▼ Username/Email Field                    ▼ Password Field
  Filter entries matching                  Are there any typed values
  what has been typed.                     in the username field?
                                                   │
                                         ┌─────────┴─────────┐
                                         ▼ Yes               ▼ No
                                  Filter entries      Display all
                                  matching that       matching domain
                                  username only.      credentials.
```

---

## 4. CSS Theme Options
The dropdown query settings checks the user's selected configuration (`chrome.storage.local.get(['theme'])`) and renders styles accordingly:

| CSS Attribute | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| **Background Color** | `#ffffff` | `#161720` |
| **Border Color** | `#e1e3eb` | `#2a2c3a` |
| **Text Color** | `#1e1e24` | `#ffffff` |
| **Hover Color** | `#f4f6fa` | `#1e202e` |
| **Box Shadow** | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.5)` |

---

## 5. Technical Function Reference

### `showInlineDropdown()`
Generates and inserts the suggestions dropdown beneath the active input field.
* **Signature:** `async function showInlineDropdown(field, entries)`
* **Parameters:**
  - `field` (`HTMLInputElement`): The focused username or password input element.
  - `entries` (`array`): Array of matching credential records retrieved from the vault.
* **Returns:** `Promise<void>`
* **Called By:**
  - `content.js` -> input focus, button click, and keystroke events.
* **Calls:**
  - `removeDropdown()`
  - `sendBg()` (using the `GET_FILL` action)
  - `fillField()`
* **Working Example:**
  ```javascript
  // Inject inline suggestions for a password field
  const entries = [
    { id: "e1", title: "Gitlab", username: "north", type: "login" }
  ];
  const pwdField = document.querySelector('input[type="password"]');
  await showInlineDropdown(pwdField, entries);
  ```

---

### `removeDropdown()`
Removes all active dropdown instances from the DOM tree.
* **Signature:** `function removeDropdown()`
* **Parameters:** None.
* **Returns:** `void`
* **Called By:**
  - `content.js` -> document click listeners, blur handlers, and fill selection events.
* **Working Example:**
  ```javascript
  // Clear any existing dropdowns
  removeDropdown();
  ```

---

## 6. Dynamic DOM Positioning Calculation
The dropdown element utilizes absolute coordinates calculated relative to the target field's bounding rectangle (`field.getBoundingClientRect()`):

```javascript
const rect = field.getBoundingClientRect();
dropdown.style.cssText = `
  position: fixed;
  top: ${rect.bottom + 6}px;
  left: ${rect.left}px;
  min-width: ${Math.max(rect.width, 280)}px;
`;
```
To keep the dropdown aligned with the input field when the page is scrolled or resized, the script hooks page-level event listeners:
```javascript
window.addEventListener('scroll', positionBtn, { passive: true });
window.addEventListener('resize', positionBtn, { passive: true });
```
*Note: A global single-use document click listener is set up using `{ once: true }` to dismiss the dropdown when the user clicks anywhere outside of it.*

---

## See Also
- [Extension Overview](../overview.md)
- [Messages](messages.md)
- [Injector](injector.md)
- [Observer](observer.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*