[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: generator.py (Secure Password Generator)

## Purpose
The `generator.py` module implements a cryptographically secure pseudo-random number generator (CSPRNG) for password generation. It utilizes the Python standard library `secrets` module (which taps into operating system entropy sources like `/dev/urandom` or Windows CNG APIs) rather than the standard `random` module, which is predictable.

It provides functions to generate passwords with guaranteed character diversity, enforce per-class character minimum counts, shuffle character arrays using a CSPRNG-backed Fisher-Yates algorithm, and evaluate password strength using criteria like length and entropy pool diversity.

## Location
`docs/python-app/core/generator.md` (documenting `localpass/core/generator.py`)

## Dependencies
- `secrets` — Cryptographically secure pseudo-random number generator (CSPRNG).
- `string` — ASCII alphanumeric character sets.

---

## Standalone Public Functions

### `generate_password(length: int = 20, use_upper: bool = True, use_lower: bool = True, use_digits: bool = True, use_symbols: bool = True) -> str`
Generates a cryptographically secure random password of the specified length. The function guarantees that at least one character from each selected character class is included, then fills the remaining slots randomly.

*   **Parameters:**
    *   `length` — `int`: Total length of the password. Defaults to `20`.
    *   `use_upper` — `bool`: Include uppercase letters (`A-Z`).
    *   `use_lower` — `bool`: Include lowercase letters (`a-z`).
    *   `use_digits` — `bool`: Include numbers (`0-9`).
    *   `use_symbols` — `bool`: Include symbols/punctuation (e.g. `!@#$%^&*()`).
*   **Returns:** `str` — Plaintext generated password. Returns an empty string if all classes are disabled.
*   **Called by:** TUI `GeneratorScreen`, popup generator panel in the extension.
*   **Calls:** `secrets.choice`, `secrets.randbelow`
*   **Methodology:**
    1.  Determines active character pools from the standard `string` module.
    2.  Selects one random character from each active class and appends them to a list (ensuring class representation).
    3.  Fills remaining slots randomly from the combined pool of active classes.
    4.  Performs a cryptographically secure Fisher-Yates shuffle on the list using `secrets.randbelow` to erase the sequential selection pattern.
    5.  Joins and truncates the string to the requested length.
*   **Code Example:**
    ```python
    from localpass.core.generator import generate_password
    
    password = generate_password(
        length=16,
        use_upper=True,
        use_lower=True,
        use_digits=True,
        use_symbols=False
    )
    print("Generated Password:", password)
    # Output: a8Fk9Lp2mQ4s5V8x
    ```

---

### `generate_password_with_minimums(length: int, classes: list[dict]) -> str`
Generates a password with specific, user-configured minimum counts for individual character classes.

*   **Parameters:**
    *   `length` — `int`: Total length of the password.
    *   `classes` — `list[dict]`: List of character class rules. Each dictionary must contain:
        *   `chars` (`str`): The character set pool (e.g. `"0123456789"`).
        *   `enabled` (`bool`): Whether this class is active.
        *   `minimum` (`int`): The minimum number of characters required from this class.
*   **Returns:** `str` — Plaintext generated password.
*   **Called by:** Configuration templates, advanced generation options in extension.
*   **Methodology:**
    1.  Fills the password list with the required minimum number of characters from each active class.
    2.  Fills remaining slots randomly from the combined pool of all enabled character classes.
    3.  Performs a secure Fisher-Yates shuffle on the list using `secrets.randbelow` to prevent predictable character positioning (e.g., preventing the minimum characters from always appearing at the beginning of the password).
*   **Code Example:**
    ```python
    from localpass.core.generator import generate_password_with_minimums
    
    rules = [
        {"chars": "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "enabled": True, "minimum": 3},
        {"chars": "abcdefghijklmnopqrstuvwxyz", "enabled": True, "minimum": 3},
        {"chars": "0123456789", "enabled": True, "minimum": 4},
        {"chars": "!@#$%", "enabled": True, "minimum": 2}
    ]
    
    pwd = generate_password_with_minimums(length=14, classes=rules)
    print("Generated:", pwd)
    ```

---

### `evaluate_strength(password: str) -> str`
Evaluates the complexity of a password based on its length and the diversity of character classes used.

*   **Parameters:**
    *   `password` — `str`: The password to evaluate.
*   **Returns:** `str` — Complexity rating: `"Weak"`, `"Fair"`, `"Strong"`, or `"Very Strong"`.
*   **Called by:** UI forms, password rating meters.
*   **Evaluation Criteria:**

| Strength Rating | Evaluation Rules |
| :--- | :--- |
| **`Weak`** | Password length is $< 8$ characters, or only uses a single character class. |
| **`Fair`** | Password length is between $8$ and $11$ characters and uses at least $2$ character classes. |
| **`Strong`** | Password length is between $12$ and $15$ characters and uses at least $3$ character classes. |
| **`Very Strong`**| Password length is $\ge 16$ characters and uses all $4$ character classes (uppercase, lowercase, digits, and symbols). |

*   **Code Example:**
    ```python
    from localpass.core.generator import evaluate_strength
    
    print("Strength:", evaluate_strength("secret"))       # Output: Weak
    print("Strength:", evaluate_strength("secrET12!"))    # Output: Fair
    print("Strength:", evaluate_strength("secrET12!safe")) # Output: Very Strong
    ```

---

## See Also
- [Entries](entries.md)
- [Generator Screen](../ui/screens/generator.md)
- [Generator Ext](../../extension/utils/generator.md)
- [Config Reference](../../reference/config-reference.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*