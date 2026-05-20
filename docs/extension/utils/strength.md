[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Password Strength & Entropy Gauge: `docs/extension/utils/strength.md`

This document details the algorithm, metrics, and classification classes used by **localpass** to calculate password strength and entropy, located inside `localpass-extension/utils/generator.js`.

---

## 1. Architectural Strategy

The extension evaluates password complexity locally on the user's machine to avoid transmitting clear-text inputs to remote servers. The goal of the evaluation framework is to balance:
1.  **Complexity Requirements:** Rewarding character diversity (numbers, uppercase, symbols).
2.  **Entropy Scale:** Encouraging password length, which exponentially increases resistance to offline dictionary and brute-force attacks.

---

## 2. The Assessment Algorithm

The strength score is generated on a scale of `0` to `3` (mapping to four visual tiers: *Weak*, *Fair*, *Strong*, *Very Strong*) based on an accumulated complexity score.

### Rule Evaluation Flow
```text
[Input Password]
       │
       ▼
[Is length < 8?] ──► Yes ──► [Score: 0 - WEAK]
       │
       No
       ▼
[Accumulate Points (Max 5)]
  * Is length >= 12?       (+1 point)
  * Is length >= 16?       (+1 point)
  * Contains Mixed Case?   (+1 point)
  * Contains Digits?       (+1 point)
  * Contains Symbols?      (+1 point)
       │
       ▼
[Map Points to Rating (0 to 3)]
  * Points <= 1 ──► Level 0 (WEAK)
  * Points == 2 ──► Level 1 (FAIR)
  * Points == 3 ──► Level 2 (STRONG)
  * Points >= 4 ──► Level 3 (VERY STRONG)
```

---

## 3. Function Specifications

### A. `calculateStrength`
Evaluates the password's character diversity and length, returning a numeric rating score between `0` and `3`.

*   **Signature:** `function calculateStrength(password)`
*   **Parameters:**
    *   `password` (`string`): The plain-text password to evaluate.
*   **Returns:** `number` - Rating index: `0` (Weak), `1` (Fair), `2` (Strong), `3` (Very Strong).
*   **Source Code:**
    ```javascript
    function calculateStrength(password) {
      if (!password || password.length < 8) return 0;
      let score = 0;
      if (password.length >= 12) score++;
      if (password.length >= 16) score++;
      if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
      if (/\d/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      if (score <= 1) return 0;
      if (score === 2) return 1;
      if (score === 3) return 2;
      return 3;
    }
    ```
*   **Invokes:** Standard RegExp prototype testing (`RegExp.prototype.test`)
*   **Invoked By:** Password generation routines and live forms inside `popup.js`.

---

### B. `getStrengthInfo`
Maps numeric strength ratings to user-facing labels and corresponding CSS theme classes.

*   **Signature:** `function getStrengthInfo(score)`
*   **Parameters:**
    *   `score` (`number`): The rating value returned by `calculateStrength` (0–3).
*   **Returns:** `Object` in format:
    ```json
    {
      "label": "WEAK | FAIR | STRONG | VERY STRONG",
      "cls": "strength-weak | strength-fair | strength-strong | strength-very-strong"
    }
    ```
*   **Source Code:**
    ```javascript
    function getStrengthInfo(score) {
      const levels = [
        { label: 'WEAK', cls: 'strength-weak' },
        { label: 'FAIR', cls: 'strength-fair' },
        { label: 'STRONG', cls: 'strength-strong' },
        { label: 'VERY STRONG', cls: 'strength-very-strong' },
      ];
      return levels[Math.min(score, 3)];
    }
    ```

---

## 4. Evaluation Matrix Reference

This matrix details how various password configurations are classified by the algorithm:

| Password Scenario | Length | Character Classes | Accumulated Points | Final Rating | Label | CSS Class |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `short` | 5 | Lowercase only | 0 (Fails length threshold) | `0` | WEAK | `strength-weak` |
| `12345678` | 8 | Digits only | 1 (Digit present) | `0` | WEAK | `strength-weak` |
| `p@ssword` | 8 | Lowercase, symbol | 1 (Symbol present) | `0` | WEAK | `strength-weak` |
| `Password12` | 10 | Mixed case, digits | 2 (Mixed case + Digits) | `1` | FAIR | `strength-fair` |
| `SecurePass12` | 12 | Mixed case, digits | 3 (Length >= 12 + Mixed + Digits) | `2` | STRONG | `strength-strong` |
| `SecuredPass12!` | 13 | Mixed case, digits, symbol | 4 (Length >= 12 + Mixed + Digits + Symbol)| `3` | VERY STRONG| `strength-very-strong` |
| `SuperCrypticSecretWord2026!`| 28 | Mixed case, digits, symbol | 5 (All conditions met) | `3` | VERY STRONG| `strength-very-strong` |

---

## 5. Live Strength Evaluator Script

This interactive script demonstrates the password evaluator, processing multiple test passwords and logging their complexity metrics:

```javascript
// Standalone Algorithm implementation
function evaluatePassword(password) {
  if (!password || password.length < 8) return { rating: 0, label: "WEAK", points: 0 };
  
  let points = 0;
  const metrics = [];
  
  if (password.length >= 12) { points++; metrics.push("Length >= 12"); }
  if (password.length >= 16) { points++; metrics.push("Length >= 16"); }
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) { points++; metrics.push("Mixed Case"); }
  if (/\d/.test(password)) { points++; metrics.push("Digits"); }
  if (/[^A-Za-z0-9]/.test(password)) { points++; metrics.push("Symbols"); }

  let rating;
  let label;
  if (points <= 1) { rating = 0; label = "WEAK"; }
  else if (points === 2) { rating = 1; label = "FAIR"; }
  else if (points === 3) { rating = 2; label = "STRONG"; }
  else { rating = 3; label = "VERY STRONG"; }

  return { rating, label, points, metrics };
}

// Test Array
const passwordsToTest = [
  "pwd",
  "12345678",
  "SecretPassword",
  "SecretPassword123",
  "SecretPassword123!",
  "vErY-LoNg-AnD-SeCuRe-P@ssword-2026!"
];

console.log("=== Running Password Strength Analysis ===");
passwordsToTest.forEach(pw => {
  const result = evaluatePassword(pw);
  console.log(`Password: "${pw}"`);
  console.log(`- Length:      ${pw.length} characters`);
  console.log(`- Points:      ${result.points}/5`);
  console.log(`- Level:       ${result.rating} (${result.label})`);
  console.log(`- Match Rules: [${result.metrics.join(", ") || "None"}]`);
  console.log("-----------------------------------------");
});
```

---

## See Also
- [Extension Overview](../overview.md)
- [Bridge](bridge.md)
- [Detector](detector.md)
- [Filler](filler.md)
- [Domain](domain.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*