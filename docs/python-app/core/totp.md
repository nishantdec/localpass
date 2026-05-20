[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: totp.py (Time-Based One-Time Password Engine)

## Purpose
The `totp.py` module implements a Time-based One-Time Password (TOTP) generation engine (RFC 6238 compliant). It coordinates multi-step generation, computing the current 6-digit verification code, the next two subsequent codes (for clock drift tolerance or upcoming verification prompts), and calculating the remaining validity duration in seconds.

## Location
`docs/python-app/core/totp.md` (documenting `localpass/core/totp.py`)

## Dependencies
- `pyotp` — RFC 6238 TOTP calculation library.
- `time` — Unix epoch clock synchronization.

---

## Standalone Public Functions

### `get_totp_info(secret: str) -> Optional[Tuple[str, str, str, int]]`
Validates a Base32 seed secret, normalizes it, and returns the current and next two 2FA codes along with the seconds remaining before rotation.

*   **Parameters:**
    *   `secret` — `str`: The Base32 encoded TOTP seed secret. Spaces are allowed and are automatically stripped.
*   **Returns:** `Optional[Tuple[str, str, str, int]]` — A tuple containing:
    1.  `current_code` (`str`): The active 6-digit code formatted with a space spacer (e.g. `"123 456"`).
    2.  `code_in_30s` (`str`): The next 6-digit code, valid 30 seconds from now.
    3.  `code_in_60s` (`str`): The subsequent 6-digit code, valid 60 seconds from now.
    4.  `seconds_remaining` (`int`): Integer seconds ($1$ to $30$) remaining until the current code expires.
    
    Returns `None` if the input secret is empty, has invalid characters, or fails to parse.
*   **Called by:** `VaultAdapter.generate_totp`, TUI `TUITOTPDisplay`, and popup detail card views.
*   **Calls:** `pyotp.TOTP`, `time.time`
*   **Methodology:**
    1.  Cleans the secret string by converting to uppercase and stripping spaces.
    2.  Instantiates a `pyotp.TOTP` instance.
    3.  Fetches current time $t$:
        $$\text{current\_code} = \text{TOTP}(t)$$
        $$\text{next\_code} = \text{TOTP}(t + 30)$$
        $$\text{next\_next\_code} = \text{TOTP}(t + 60)$$
    4.  Calcules the remaining time step expiration:
        $$\text{seconds\_remaining} = 30 - (\text{UnixTime} \bmod 30)$$
    5.  Formats the 6-character strings into `"XXX XXX"` layouts.
*   **Code Example:**
    ```python
    from localpass.core.totp import get_totp_info
    
    seed = "JBSW Y3DP EHPK 3PXP" # Base32 example
    info = get_totp_info(seed)
    
    if info:
        curr, next1, next2, remaining = info
        print(f"Current Code: {curr}")
        print(f"Next Code: {next1}")
        print(f"Rotates in: {remaining} seconds")
    else:
        print("ALERT: Invalid TOTP secret seed!")
    ```
---

---

## See Also
- [Entries](entries.md)
- [Vault](vault.md)
- [Totp Display Component](../ui/components/totp-display.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*