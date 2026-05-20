[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Dynamic DOM Mutation Observer (`observer.md`)

## 1. Overview
Modern Single Page Applications (SPAs) dynamically redraw or insert elements in the Document Object Model (DOM) without triggering page-level reloads. Traditional static scripts that execute once on the `DOMContentLoaded` event fail to bind indicators on dynamically populated forms (such as overlays, dialogs, or multi-step wizards).

To resolve this issue, the localpass browser extension integrates a persistent, high-performance **DOM Mutation Observer** inside `content.js`. This observer dynamically monitors changes to the active tab's DOM tree, traverses added elements, filters out non-login inputs, and triggers overlay buttons for newly rendered login forms.

---

## 2. Observer Workflow
The diagram below details the processing flow from a dynamic DOM event to lock button injection:

```
    [ Page DOM Mutation Event ]
                 │
       traverseAddedNodes()
                 │
   Are there added element nodes?
                 │
       ┌─────────┴─────────┐
       ▼ Yes               ▼ No
  Matches NL input selectors
  (password/email/text)?
       │
       ├───────────────────┐
       ▼ Yes               ▼ No
  [ Debounce: 400ms ]  [ Ignore Mutation ]
       │
  injectNLButtons()
       │
  Mark: field.dataset.nlInjected = 'true'
```

---

## 3. Heuristic Filtering of Dynamic Elements
To avoid performance degradation (such as browser freezing on large dynamic page redraws), the observer filters mutations before running heavy calculations:

1. **Child Node Checks:** The observer only processes mutations of type `"childList"` (nodes added or removed). Property changes (`attributes` or `characterData`) are ignored.
2. **Tag Name Traversals:** It inspects added nodes and recursively queries them using a fast tag check. If an added node does not contain any `input` elements, it is skipped immediately.
3. **Type Scopes:** It specifically targets inputs matching:
   - `input[type="password"]`
   - `input[type="email"]`
   - `input[type="text"]` (specifically those with name/id keywords like "user", "email", or "login").

---

## 4. Technical Reference

### `observer` Instance
A persistent `MutationObserver` created at script initialization to monitor tree mutations.
* **Signature:** `const observer = new MutationObserver((mutations) => { ... })`
* **Parameters:**
  - `mutations` (`MutationRecord[]`): A list of recorded changes to the DOM tree.
* **Called By:** 
  - Automatically triggered by browser engine when child elements are appended or modified.
* **Calls:**
  - `injectNLButtons()` via a debounced timeout wrapper.
* **Working Example:**
  ```javascript
  // Declaring and starting the persistent tree observer
  const observer = new MutationObserver((mutations) => {
    let shouldRecheck = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isInput = node.tagName === 'INPUT';
          const hasInput = node.querySelector && node.querySelector('input');
          if (isInput || hasInput) {
            shouldRecheck = true;
            break;
          }
        }
      }
      if (shouldRecheck) break;
    }
    if (shouldRecheck) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectNLButtons, 400);
    }
  });
  ```

---

### Debounce Mechanisms
To prevent multiple redundant scans when a web application inserts many elements in a short burst, the observer implements a 400ms debounce buffer:
*   **Variable:** `debounceTimer` (Transient handle referencing the scheduled timeout).
*   **Buffer Limit:** `400ms`.
*   **Operation:** Each matching mutation resets the active timer. The TUI lock indicators are only injected once the DOM finishes updating and settles for 400 milliseconds.

---

## 5. Lifecycle Management & Target Mounts
The observer binds to the root document as soon as the DOM body becomes available:

```javascript
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
  injectNLButtons();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      injectNLButtons();
    }
  });
}
```
*   **`childList: true`**: Configures the observer to monitor the addition or removal of child elements.
*   **`subtree: true`**: Extends monitoring to all nested descendant nodes of the `document.body` container.

---

## See Also
- [Extension Overview](../overview.md)
- [Messages](messages.md)
- [Injector](injector.md)
- [Dropdown](dropdown.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*