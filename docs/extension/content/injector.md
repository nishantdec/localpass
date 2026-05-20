[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Lock Indicator & Field Button Injector (`injector.md`)

## 1. Overview
To notify users that localpass can automatically manage and fill credentials for a website, the extension injects a small **Locker Icon Button** inside identified credential fields (passwords, usernames, and email inputs).

The injector runs in a sandboxed content script world, dynamically computing CSS position coordinates to overlay the button cleanly inside the input field, and attaching observers to handle dynamically rendered login forms.

---

## 2. Button Overlay Alignment Calculation
The overlay button is positioned inside the right-hand edge of the target input element:

```
┌───────────────────────────────────────────────┐
│ Input Field                                   │
│ [Enter Text...]                   ┌───┐       │
│                                   │ B │       │ ◄── Overlay Button
│                                   └───┘       │
└───────────────────────────────────────────────┘
                                    ◄───►
                                    32px offset
```

### Positioning Formulas
The script calculates the exact absolute offset coordinates relative to the viewport using the target field's bounding rectangle:
*   **Vertical Center Placement:**
    $$\text{button.style.top} = \text{rect.top} + \left(\frac{\text{rect.height}}{2}\right) - 11 \text{ px}$$
    *(Where 11px represents half of the button's 22px height, ensuring vertical alignment).*
*   **Horizontal Right Placement:**
    $$\text{button.style.left} = \text{rect.right} - 32 \text{ px}$$
    *(Leaves a 32px right margin to prevent the button from overlapping standard browser password reveal indicators or other input elements).*

---

## 3. SPA Compatibility & Dynamic MutationObserver
Modern Single Page Applications (React, Vue, Angular, Svelte) render elements dynamically rather than serving static HTML pages. Traditional page-load injection scripts fail when input forms are drawn after the initial document load.

To resolve this, localpass runs a **Dynamic DOM Mutation Observer** that monitors DOM tree mutations across the entire page body:

```
                  [ DOM Tree Mutation Event ]
                              │
               Has a login-related input element
               (password/email/text) been added?
                              │
               ┌──────────────┴──────────────┐
               ▼ Yes                         ▼ No
     [ Debounce: 400ms ]               [ Ignore Event ]
               │
    Re-scan DOM and Inject
```
*   **Debounced Scanning:** Every time mutations occur, a 400ms debounce timer is queued. This prevents performance bottlenecks during batch DOM updates.
*   **Duplicate Safeguards:** Once a button is injected next to a field, the field is tagged with `data-nl-injected="true"` to prevent multiple buttons from rendering on the same input.

---

## 4. Technical Function Reference

### `injectNLButtons()`
Scans the current DOM tree for login fields, filters out hidden elements, and attaches interactive overlay buttons.
* **Signature:** `function injectNLButtons()`
* **Parameters:** None.
* **Returns:** `void`
* **Called By:**
  - `content.js` -> DOM content loaded event.
  - `content.js` -> `MutationObserver` triggers.
* **Calls:**
  - `isFieldVisible()`
  - `chrome.storage.local.get()`
  - `showInlineDropdown()`
* **Working Example:**
  ```javascript
  // Trigger button scanning programmatically
  injectNLButtons();
  ```

---

## 5. Overlay Button Hover Style Specifications
The injected lock button changes its styling when hovered over:

```css
/* Custom CSS styling rules for the overlay button */
button[data-nl-button="true"] {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  opacity: 0.6;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

button[data-nl-button="true"]:hover {
  opacity: 1;
  color: #3b72e8;
  border-color: #3b72e8;
  transform: scale(1.05);
  box-shadow: 0 0 8px rgba(59, 114, 232, 0.25);
}
```
*   **Standard Mode:** Low opacity (`0.6`) and subtle border color mapping to match light/dark themes without cluttering the page's visual design.
*   **Hover Mode:** High opacity (`1.0`), scaled up slightly (`1.05`), and surrounded by a soft blue glow (`#3b72e8` with `box-shadow`) to encourage user interaction.

---

## See Also
- [Extension Overview](../overview.md)
- [Messages](messages.md)
- [Dropdown](dropdown.md)
- [Observer](observer.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*