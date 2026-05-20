/**
 * Detector module - Form and field detection logic.
 * Identifies login, password, and OTP fields on any page.
 * Loaded as a content script before content.js.
 */

/**
 * Check if an element is visible on the page.
 * Walks up the ancestor chain to detect hidden parents.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isFieldVisible(element) {
  if (!element) return false;
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }
    const rect = current.getBoundingClientRect();
    if (
      rect.width === 0 ||
      rect.height === 0 ||
      rect.top > window.innerHeight ||
      rect.left > window.innerWidth
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

/**
 * Find the first visible password input field.
 * @returns {HTMLInputElement|null}
 */
function findPasswordField() {
  const inputs = document.querySelectorAll('input[type="password"]');
  for (const input of inputs) {
    if (isFieldVisible(input)) return input;
  }
  return null;
}

/**
 * Find the first visible username/email input field.
 * Searches in priority order by specificity.
 * @returns {HTMLInputElement|null}
 */
function findUsernameField() {
  const selectors = [
    'input[type="email"]',
    'input[type="text"][autocomplete*="username" i]',
    'input[type="text"][autocomplete*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"]'
  ];
  for (const sel of selectors) {
    const inputs = document.querySelectorAll(sel);
    for (const input of inputs) {
      if (isFieldVisible(input)) return input;
    }
  }
  return null;
}

/**
 * Find the first visible OTP/2FA input field.
 * @returns {HTMLInputElement|null}
 */
function findOTPField() {
  const selectors = [
    'input[autocomplete="one-time-code"]',
    'input[inputmode="numeric"][maxlength="6"]',
    'input[name*="otp" i]',
    'input[name*="totp" i]',
    'input[id*="otp" i]'
  ];
  for (const sel of selectors) {
    const inputs = document.querySelectorAll(sel);
    for (const input of inputs) {
      if (isFieldVisible(input)) return input;
    }
  }
  return null;
}

/**
 * Find both username and password fields as a pair.
 * @returns {{ usernameField: HTMLInputElement|null, passwordField: HTMLInputElement|null }}
 */
function findLoginForm() {
  return {
    usernameField: findUsernameField(),
    passwordField: findPasswordField()
  };
}

/**
 * Get the current page domain, stripping www. prefix.
 * @returns {string}
 */
function getCurrentDomain() {
  return window.location.hostname.replace(/^www\./, '');
}
