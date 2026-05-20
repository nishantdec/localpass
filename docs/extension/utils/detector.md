[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Form Field Detection Heuristics: `docs/extension/utils/detector.md`

This document details the design, algorithm logic, and selectors used by the **Form Field Detector** in `localpass-extension/utils/detector.js`. This module scans target web pages to locate login credentials and multi-factor authentication (OTP/2FA) fields.

---

## 1. Architectural Purpose and Flow
The detector runs inside the browser tab context. When a page triggers an auto-fill request or a DOM change mutation occurs, the detector identifies inputs that are visible to the user and match specific patterns.

### Logic Flow Diagram
```text
[Page Trigger / Mutation]
          │
          ▼
   [Query Selector] ──► Query standard input attributes
          │
          ▼
   [Visibility Scan] ──► Walk up ancestors checking Display, Visibility, Opacity & Rects
          │
          ▼
   [Heuristic Prioritization] ──► Filter input roles (Username vs. Password vs. OTP)
          │
          ▼
   [Return Dom Element Pair] ──► Pass elements to the filling mechanics
```

---

## 2. Dynamic Input Match Selectors
To avoid false positives, the detector queries the DOM using a prioritized array of selectors ordered from most specific to least specific.

### Heuristic Match Matrices

#### A. Username / Email Fields
Matches standard text inputs matching usernames, emails, login identifiers, or general text fallback tags.
1.  `input[type="email"]`
2.  `input[type="text"][autocomplete*="username" i]`
3.  `input[type="text"][autocomplete*="email" i]`
4.  `input[type="text"][name*="user" i]`
5.  `input[type="text"][name*="email" i]`
6.  `input[type="text"][id*="user" i]`
7.  `input[type="text"][id*="email" i]`
8.  `input[type="text"]` *(fallback)*

#### B. Password Fields
Matches secure character inputs.
1.  `input[type="password"]`

#### C. OTP / 2FA Verification Fields
Matches verification digit fields and one-time code containers.
1.  `input[autocomplete="one-time-code"]`
2.  `input[inputmode="numeric"][maxlength="6"]`
3.  `input[name*="otp" i]`
4.  `input[name*="totp" i]`
5.  `input[id*="otp" i]`

---

## 3. Function Specifications

### A. `isFieldVisible`
Ensures that detected elements are actively rendered, have non-zero dimensions, and are not hidden inside styled parent boundaries.

*   **Signature:** `function isFieldVisible(element)`
*   **Parameters:**
    *   `element` (`HTMLElement`): The input field to check.
*   **Returns:** `boolean` - `true` if visible, `false` if hidden or non-existent.
*   **Heuristic Logic:**
    1.  Rejects elements with `display: none`, `visibility: hidden`, or `opacity: 0` computed properties.
    2.  Checks `getBoundingClientRect()` to ensure `width > 0` and `height > 0`.
    3.  Asserts that coordinates are within current window boundaries.
    4.  Recursively walks up the parent element chain (`current.parentElement`) verifying parent node properties.

---

### B. `findPasswordField`
Locates the first visible secure input field on the page.

*   **Signature:** `function findPasswordField()`
*   **Parameters:** None.
*   **Returns:** `HTMLInputElement | null` - The DOM element or null.
*   **Invokes:** `isFieldVisible`

---

### C. `findUsernameField`
Scans the prioritized selector matrix to locate the most relevant username/email element that is visible.

*   **Signature:** `function findUsernameField()`
*   **Parameters:** None.
*   **Returns:** `HTMLInputElement | null` - The DOM element or null.
*   **Invokes:** `isFieldVisible`

---

### D. `findOTPField`
Scans for 2FA one-time passcode fields.

*   **Signature:** `function findOTPField()`
*   **Parameters:** None.
*   **Returns:** `HTMLInputElement | null` - The DOM element or null.
*   **Invokes:** `isFieldVisible`

---

### E. `findLoginForm`
Groups the results of the username and password search routines to return a login form pair.

*   **Signature:** `function findLoginForm()`
*   **Parameters:** None.
*   **Returns:** `Object` in format:
    ```json
    {
      "usernameField": HTMLInputElement,
      "passwordField": HTMLInputElement
    }
    ```
*   **Invokes:** `findUsernameField()`, `findPasswordField()`
*   **Invoked By:** Form automation routines in `localpass-extension/content.js`.

---

### F. `getCurrentDomain`
Extracts the raw domain from the tab location while removing standard prefixes.

*   **Signature:** `function getCurrentDomain()`
*   **Parameters:** None.
*   **Returns:** `string` - Clean host name (e.g. `"github.com"`).
*   **Implementation:**
    ```javascript
    function getCurrentDomain() {
      return window.location.hostname.replace(/^www\./, '');
    }
    ```

---

## 4. DOM Detection Simulation Example
This complete simulation script runs inside a browser console, dynamically constructing a mockup form and executing detector matches.

```javascript
// 1. Injected Mockup login form elements in memory
const mockContainer = document.createElement('div');
mockContainer.style.position = 'absolute';
mockContainer.style.left = '-9999px';
mockContainer.innerHTML = `
  <form id="test-login-form">
    <div style="display: none;">
      <input type="text" id="hidden-user" value="ghost" />
    </div>
    <div>
      <input type="text" name="login_email" id="real-user" placeholder="Email" />
      <input type="password" name="login_password" id="real-pass" placeholder="Password" />
      <input type="text" autocomplete="one-time-code" maxlength="6" id="real-otp" />
    </div>
  </form>
`;
document.body.appendChild(mockContainer);

// 2. Local Mock Implementation of the Visibility Checker
function simulateIsFieldVisible(element) {
  if (!element) return false;
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

// 3. Match Simulation Flow
function runFormDetectionDiagnostics() {
  console.log("Analyzing page inputs...");
  
  // Scans
  const inputs = document.querySelectorAll('input');
  console.log(`Total input fields detected: ${inputs.length}`);

  // Test Username scan
  let usernameTarget = null;
  const usernameSelectors = ['input[type="email"]', 'input[name*="email"]', 'input[type="text"]'];
  for (const selector of usernameSelectors) {
    const matches = document.querySelectorAll(selector);
    for (const match of matches) {
      if (simulateIsFieldVisible(match)) {
        usernameTarget = match;
        break;
      }
    }
    if (usernameTarget) break;
  }

  // Test Password scan
  let passwordTarget = null;
  const passwordMatches = document.querySelectorAll('input[type="password"]');
  for (const match of passwordMatches) {
    if (simulateIsFieldVisible(match)) {
      passwordTarget = match;
      break;
    }
  }

  // Test OTP scan
  let otpTarget = null;
  const otpMatches = document.querySelectorAll('input[autocomplete="one-time-code"]');
  for (const match of otpMatches) {
    if (simulateIsFieldVisible(match)) {
      otpTarget = match;
      break;
    }
  }

  console.log("Detection results:");
  console.log("- Detected Username Field:", usernameTarget ? usernameTarget.id : "None");
  console.log("- Detected Password Field:", passwordTarget ? passwordTarget.id : "None");
  console.log("- Detected OTP Field:", otpTarget ? otpTarget.id : "None");

  // Clean up mock elements
  document.body.removeChild(mockContainer);
}

// Run test
runFormDetectionDiagnostics();
```

---

## See Also
- [Extension Overview](../overview.md)
- [Bridge](bridge.md)
- [Filler](filler.md)
- [Domain](domain.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*