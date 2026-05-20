/**
 * Filler module - Field filling logic.
 * Compatible with React, Vue, Angular, and vanilla JS frameworks.
 */

const FILLER_DEBUG = false;

function fillerDebug(...args) {
  if (FILLER_DEBUG) console.log('[NL Filler]', ...args);
}

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

/**
 * Fill both username and password fields on a login form.
 * @param {string} username - The username to fill.
 * @param {string} password - The password to fill.
 */
function fillLoginForm(username, password) {
  const usernameField = findUsernameField();
  const passwordField = findPasswordField();

  if (usernameField && username) {
    fillField(usernameField, username);
  }

  if (passwordField && password) {
    fillField(passwordField, password);
  }
}

/**
 * Fill an OTP/2FA code field.
 * @param {string} code - The TOTP code to fill.
 */
function fillOTPForm(code) {
  const otpField = findOTPField();
  if (otpField && code) {
    fillField(otpField, code);
  }
}
