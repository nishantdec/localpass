[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: unlock_providers.py (Extensible Authenticator Providers)

## Purpose
The `unlock_providers.py` module implements an extensible, object-oriented abstraction layer for vault unlock authenticators. Instead of hard-coding the unlock logic to only accept master passwords, it defines an abstract base class (`UnlockProvider`) that allows adding new authentication methods—such as Quick PIN codes, biometric triggers (Windows Hello, macOS Touch ID), or hardware security keys (FIDO2/YubiKey)—without modifying the core vault persistence codebase.

## Location
`docs/python-app/core/unlock_providers.md` (documenting `localpass/core/unlock_providers.py`)

## Dependencies
- `abc` — Abstract Base Class declarations.
- `platform` — System detection.
- `localpass.core.auth.derive_key`

---

## Abstract Base Class: UnlockProvider
The base interface for all unlock methods.

### Abstract Properties
- `name` (`str`): Human-readable label for the provider (e.g. `"Master Password"`).

### Abstract Methods

#### `is_available() -> bool`
Checks whether this authentication method is usable and configured on the current host device.

*   **Returns:** `bool`

---

#### `authenticate(hint: str = "") -> Optional[bytes]`
Performs the authentication process. Returns the derived 256-bit AES vault key if successful, or `None` if authentication fails or is cancelled.

*   **Parameters:**
    *   `hint` — `str`: Optional message displayed to the user during the authentication prompt.
*   **Returns:** `Optional[bytes]` — Cryptographic master key bytes, or `None`.

---

## Implementations

### 1. PasswordUnlockProvider (Inherits from UnlockProvider)
The standard authentication provider. It derives the 256-bit AES master key from the user's master password using Argon2id.

#### Methods
- `__init__(master_password: str, salt: bytes, kdf_params: dict)`
- `name` (Property) -> `str`: Returns `"Master Password"`.
- `is_available() -> bool`: Always returns `True`.
- `authenticate(hint: str = "") -> Optional[bytes]`: Computes and returns the key.
  *   **Calls:** `localpass.core.auth.derive_key`

---

### 2. PinUnlockProvider (Inherits from UnlockProvider)
*Currently a stub interface.*
Enables quick PIN unlocks by wrapping the primary vault key with a PIN-derived HKDF key and storing the encrypted wrapped key in local AppData.

#### Methods
- `name` (Property) -> `str`: Returns `"Quick PIN"`.
- `is_available() -> bool`: Currently returns `False` (stub).
- `authenticate(hint: str = "") -> Optional[bytes]`: Currently returns `None`.

---

### 3. WindowsHelloProvider (Inherits from UnlockProvider)
*Currently a stub interface.*
Enables biometric authentication (face, fingerprint, or system PIN) on Windows using the Windows CNG or WebAuthn platform APIs. The vault master key is protected using the Windows Data Protection API (DPAPI) with user consent verification.

#### Methods
- `name` (Property) -> `str`: Returns `"Windows Hello"`.
- `is_available() -> bool`: Currently returns `False` (stub).
- `authenticate(hint: str = "") -> Optional[bytes]`: Currently returns `None`.

---

### 4. BiometricUnlockProvider (Inherits from UnlockProvider)
A cross-platform manager class that detects the host operating system and delegates authentication to the appropriate system provider.

#### Methods
- `name` (Property) -> `str`: Returns `"Biometric"`.
- `is_available() -> bool`: Delegates availability checks to the platform provider.
- `authenticate(hint: str = "") -> Optional[bytes]`: Executes the platform biometric prompt.
- `_platform_provider() -> UnlockProvider` (Internal):
  *   Returns `WindowsHelloProvider` on Windows.
  *   Future expansions can add macOS Touch ID (via LocalAuthentication ctypes) or Linux PAM providers.
  *   Returns `_NullProvider` on unsupported platforms.

---

### 5. _NullProvider (Inherits from UnlockProvider)
An internal fallback provider used when no suitable platform-specific unlock providers are available. Always returns `False` for availability and `None` for authentication.

---

## Architectural Guide: Adding a New Provider
To add a new unlock method, implement a new subclass of `UnlockProvider`:

```python
from localpass.core.unlock_providers import UnlockProvider
from typing import Optional

class YubiKeyUnlockProvider(UnlockProvider):
    """Protects the vault key using a YubiKey HMAC-SHA1 challenge-response."""
    
    def __init__(self, challenge: bytes):
        self._challenge = challenge

    @property
    def name(self) -> str:
        return "YubiKey Hardware Key"

    def is_available(self) -> bool:
        # Check if a YubiKey is connected via USB
        return True 

    def authenticate(self, hint: str = "") -> Optional[bytes]:
        # Send a challenge to the YubiKey and retrieve the response
        # derived_key = compute_hmac_sha1(self._challenge)
        return b"derived_aes_vault_key_bytes..."
```
---

---

## See Also
- [Auth](auth.md)
- [Adapter](adapter.md)
- [Unlock Screen](../ui/screens/unlock.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*