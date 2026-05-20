[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Secure Random Generator: `docs/extension/utils/generator.md`

This document details the cryptographic specifications, randomness selections, and algorithms of the client-side generator in `localpass-extension/utils/generator.js`. It runs entirely offline using the browser's built-in **Web Crypto API**.

---

## 1. Cryptographic Architecture: Rejection Sampling & Modulo Bias

When selecting random characters from a charset pool (e.g. 26 lowercase characters), a naive approach like `charset[Math.floor(Math.random() * charset.length)]` or `charset[crypto.getRandomValues(array)[0] % charset.length]` introduces **modulo bias**.

### What is Modulo Bias?
A single 32-bit random integer yielded by `crypto.getRandomValues` has $2^{32}$ (4,294,967,296) possible outcomes (ranging from `0` to `4,294,967,295`). 
*   If we map this range to a character pool of length 94 (letters, numbers, and symbols) using the modulo operator (`%`), the charset length does not divide $2^{32}$ evenly.
*   $4,294,967,296 \pmod{94} = 6$.
*   Consequently, the first 6 characters in the pool have a slightly higher probability ($1$ in $45,691,142$ higher) of being chosen than the remaining 88 characters. This compromises the cryptographic entropy of generated passwords.

### Rejection Sampling Solution
To eliminate modulo bias, localpass uses **rejection sampling**:
1.  It determines `maxValid`, the largest multiple of the charset length that is strictly less than $2^{32}$ (`0xFFFFFFFF`).
2.  It requests a random 32-bit unsigned integer via `crypto.getRandomValues`.
3.  If the value falls in the biased remainder zone (i.e. `value >= maxValid`), it is **rejected**, and a new random integer is requested.
4.  Once a value below `maxValid` is successfully acquired, it returns `value % charset.length`.

```text
[0] ─────────────────────────────────────────── [maxValid] ─────────── [0xFFFFFFFF]
                   Unbiased Zone                         │  Biased Zone
             (Value accepted & mapped)                   │   (Value rejected)
```

---

## 2. Character Pools and Constants

### Character Pools
```javascript
const POOLS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};
```

### Wordlist (For Passphrases)
Contains a structured list of highly distinct English terms (e.g. `abandon`, `ability`, `stencil`, `preacher`) to construct memorable but secure passphrases.

---

## 3. Function Specifications

### A. `secureChoice`
Selects a cryptographically random item from a charset, using rejection sampling to eliminate modulo bias.

*   **Signature:** `function secureChoice(charset)`
*   **Parameters:**
    *   `charset` (`string | Array`): The pool of characters or array of words.
*   **Returns:** `string` or `any` - The selected element.
*   **Mathematical Logic:**
    ```javascript
    const arr = new Uint32Array(1);
    const maxValid = Math.floor(0xFFFFFFFF / charset.length) * charset.length;
    let value;
    do {
      crypto.getRandomValues(arr);
      value = arr[0];
    } while (value >= maxValid);
    return charset[value % charset.length];
    ```

---

### B. `generatePassword`
Assembles a secure random password based on configurable complexity options, ensuring minimum character counts are met before shuffling the result.

*   **Signature:** `function generatePassword(config = {})`
*   **Parameters:**
    *   `config` (`Object`): Configuration settings.
*   **Returns:**
    ```json
    {
      "password": "...", 
      "strength": 3, 
      "guaranteed": 5
    }
    ```
*   **Algorithm Steps:**
    1.  Calculates minimum required characters for uppercase, lowercase, numbers, and symbols.
    2.  Pulls guaranteed characters using `secureChoice`.
    3.  Fills remaining spaces to reach the target password length using the active character pool.
    4.  Applies a cryptographically secure **Fisher-Yates shuffle** to randomize character order and prevent predictable pattern boundaries.

---

### C. `generatePassphrase`
Creates a readable word-based passphrase separated by special characters.

*   **Signature:** `function generatePassphrase(config = {})`
*   **Parameters:**
    *   `config` (`Object`): Configuration options (separator, word count, capitalization, and numbers).
*   **Returns:** `string` (e.g. `"Abandon-Stencil-Preacher-8-Brink"`).

---

### D. `generateUsername`
Creates custom random text usernames or readable word-based logins.

*   **Signature:** `function generateUsername(config = {})`
*   **Parameters:**
    *   `config` (`Object`): Settings determining username style.
*   **Returns:** `string` (e.g. `"Preacher83"` or `"xhytrpws29"`).

---

## 4. Configuration Schema

### `DEFAULT_CONFIG`
Stored locally within browser storage using the key `'generator'`.

```json
{
  "length": 36,
  "uppercase": true,
  "lowercase": true,
  "digits": true,
  "symbols": true,
  "minUpper": 2,
  "minLower": 2,
  "minDigits": 0,
  "minSymbols": 0,
  "numWords": 6,
  "separator": "-",
  "capitalize": false,
  "includeNumber": false,
  "usernameType": "word",
  "usernameCapitalize": false,
  "usernameIncludeNumber": false
}
```

---

## 5. Offline Integration Example

This standalone script demonstrates how the password generator operates entirely within the browser sandbox:

```javascript
// Complete Mock Configuration
const mockConfig = {
  length: 24,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  minUpper: 3,
  minLower: 3,
  minDigits: 2,
  minSymbols: 2
};

// Rejection sampling selection helper
function testSecureChoice(charset) {
  const arr = new Uint32Array(1);
  const maxValid = Math.floor(0xFFFFFFFF / charset.length) * charset.length;
  let value;
  do {
    crypto.getRandomValues(arr);
    value = arr[0];
  } while (value >= maxValid);
  return charset[value % charset.length];
}

// Password assembly flow
function testGenerate(config) {
  const pools = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  const result = [];
  
  // Fill minimums
  for (let i = 0; i < config.minUpper; i++) result.push(testSecureChoice(pools.upper));
  for (let i = 0; i < config.minLower; i++) result.push(testSecureChoice(pools.lower));
  for (let i = 0; i < config.minDigits; i++) result.push(testSecureChoice(pools.digits));
  for (let i = 0; i < config.minSymbols; i++) result.push(testSecureChoice(pools.symbols));

  // Build character pool
  let activePool = pools.upper + pools.lower + pools.digits + pools.symbols;

  // Fill remaining length
  for (let i = result.length; i < config.length; i++) {
    result.push(testSecureChoice(activePool));
  }

  // Cryptographically secure Fisher-Yates Shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const randomVal = new Uint32Array(1);
    crypto.getRandomValues(randomVal);
    const j = randomVal[0] % (i + 1);
    
    // Swap elements
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result.join('');
}

console.log("=== Generating Cryptographically Secure Password ===");
const securePassword = testGenerate(mockConfig);
console.log(`Generated Password: ${securePassword}`);
console.log(`Password Length:    ${securePassword.length} characters`);
```

---

## See Also
- [Entries](../../python-app/core/entries.md)
- [Generator Screen](../../python-app/ui/screens/generator.md)
- [Config Reference](../../reference/config-reference.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*