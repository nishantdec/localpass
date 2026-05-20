[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# DOM Form Filling Mechanics: `docs/extension/utils/filler.md`

This document details the mechanics and specifications of the DOM form injector module located at `localpass-extension/utils/filler.js`. It explains how the extension bypasses state-intercepting modern frameworks (e.g. React, Angular, Vue) to reliably populate credentials.

---

## 1. Architectural Challenge: Framework State Interception

When scripting form fills, a naive approach like `inputElement.value = "secret"` will fail on modern single-page applications (SPAs) built with React, Vue, or Angular. 

### Why Standard Form Injection Fails
1.  **State Synchronization:** Modern frameworks override the default `HTMLInputElement` properties to synchronize the input value with their virtual DOM state.
2.  **Property Interception:** When a script assigns a value directly to `element.value`, the framework's custom setter does not register a standard DOM event. This results in the visual field updating while the underlying state remains empty. When the user clicks "Submit", the form submits empty values.

### Bypassing Framework Setters

```text
[Direct Assignment] ──► element.value = "secret" ──► Framework Intercepts ──► Virtual DOM Sync Fails
                                                                                  
[Prototype Bypass]  ──► HTMLInputElement.prototype ──► Get native setter ──► Call on Element ──► Dispatch Bubble Events (input, change)
```

To resolve this, the extension retrieves the *native, unmodified* value setter from `HTMLInputElement.prototype`, invokes it directly in the context of the target element, and dispatches a sequence of bubbling events to trigger framework reactive listeners.

---

## 2. Source Code Reference

```javascript
/**
 * Fill a form field with a value, dispatching all necessary events
 * for React/Vue/Angular compatibility.
 * @param {HTMLInputElement} element - The input element to fill.
 * @param {string} value - The value to set.
 */
function fillField(element, value) {
  if (!element) return;

  // Focus the field first
  element.focus();

  // Use native setter to bypass framework overrides
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputSetter.call(element, value);

  // Dispatch events for framework reactivity
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  fillerDebug(`Filled field with value: ${value.substring(0, 3)}***`);
}
```

---

## 3. Function Specifications

### A. `fillField`
Injects a text value into a specific input element, bypassing framework intercepts and updating the application state.

*   **Signature:** `function fillField(element, value)`
*   **Parameters:**
    *   `element` (`HTMLInputElement`): The target DOM input node.
    *   `value` (`string`): The plain-text credential value to inject.
*   **Returns:** `void`
*   **Dependencies Called:** `Object.getOwnPropertyDescriptor()`, `element.dispatchEvent()`
*   **Invokes:** `window.HTMLInputElement.prototype` setter

---

### B. `fillLoginForm`
Locates active username/password field pairs on the active tab and executes sequential filling.

*   **Signature:** `function fillLoginForm(username, password)`
*   **Parameters:**
    *   `username` (`string`): The plain-text username to fill.
    *   `password` (`string`): The plain-text password to fill.
*   **Returns:** `void`
*   **Invokes:** `findUsernameField()`, `findPasswordField()`, `fillField()`
*   **Invoked By:** Form filling message listeners in `localpass-extension/content.js`.

---

### C. `fillOTPForm`
Locates the active OTP input field on the page and fills it.

*   **Signature:** `function fillOTPForm(code)`
*   **Parameters:**
    *   `code` (`string`): The numeric TOTP 2FA code.
*   **Returns:** `void`
*   **Invokes:** `findOTPField()`, `fillField()`
*   **Invoked By:** Autofill action handlers in `localpass-extension/content.js`.

---

## 4. Framework Bypass Simulation Example

This script simulates a React-like input tracker that overrides standard element property setters, and demonstrates how `fillField` successfully bypasses it:

```javascript
// 1. Construct a mock input element
const mockInput = document.createElement('input');
mockInput.type = "text";
mockInput.id = "framework-input";
document.body.appendChild(mockInput);

// 2. Simulate a framework overriding element property setters to track internal state
let internalState = "";
Object.defineProperty(mockInput, 'value', {
  get() {
    return internalState;
  },
  set(val) {
    console.log(`[Framework Setter Intercepted] Attempting to set: "${val}"`);
    // Simulate validation block: frameworks may discard external script updates
    console.warn("Framework state rejected raw modification.");
  },
  configurable: true
});

// 3. Native Fill Bypass routine
function runBypassSimulation() {
  console.log("=== Bypassing Framework Input Overrides ===");
  
  // Method A: Direct assignment (fails due to framework intercept)
  mockInput.value = "direct_fill_attempt";
  console.log(`Input value is now: "${mockInput.value}" (Expected empty/unchanged due to block)\n`);

  // Method B: Prototype descriptor bypass
  console.log("Locating native property descriptor...");
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  console.log("Invoking native setter bypassing intercept...");
  nativeSetter.call(mockInput, "bypass_success");

  // Dispatch mock events to notify the framework
  mockInput.dispatchEvent(new Event('input', { bubbles: true }));

  console.log(`Input value is now: "${mockInput.value}" (Bypass Success!)`);
  
  // Clean up mock elements
  document.body.removeChild(mockInput);
}

runBypassSimulation();
```

---

## See Also
- [Extension Overview](../overview.md)
- [Bridge](bridge.md)
- [Detector](detector.md)
- [Domain](domain.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*