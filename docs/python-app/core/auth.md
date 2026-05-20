[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Authentication and Session Core Reference (`auth.py`)

This document provides complete technical specifications, exact API signatures, and architectural details for `localpass/core/auth.py`. This module handles key derivation, secure memory cleaning, session tokens, and TUI locking events.

---

## 1. Design Principles & Primitives

The authentication core prioritizes memory safety and secure state management:
*   **Secure memory buffers**: Overwrites sensitive data (keys, passwords) in physical memory as soon as operations complete.
*   **Decoupled Session Lifecycle**: Manages active key handles, token issuance, rotation, validation, and failed unlock limits.
*   **CPython Memory Safety**: Uses ctypes memory operations to bypass the CPython garbage collector, ensuring byte buffers are zeroed immediately.

---

## 2. Global Constants

| Constant | Value | Description |
| :--- | :--- | :--- |
| `TOKEN_BYTES` | `32` | Size in bytes of the cryptographically secure random session tokens (exchanged as a 64-character hex string). |
| `TOKEN_TTL_SECONDS` | `28800` | Token validity period. Defaults to 8 hours. |
| `NONCE_CACHE_SIZE` | `256` | Size of the tracking deque used to prevent API request replays. |
| `MAX_FAILED_UNLOCKS` | `5` | Maximum number of incorrect password attempts allowed before the TUI forces a process exit. |

---

## 3. Global Functions

### `zero_bytes(buf: bytearray) -> None`
*   **Description**: Overwrites a mutable bytearray in physical memory with null bytes (`0x00`) using low-level ctypes bindings.

#### Parameter Specifications
*   `buf` (`bytearray`): The mutable target buffer to be cleared.

#### Return Value
*   **Format**: `None`. Modifies the buffer in-place.

#### Callers & Callees
*   **Called by**:
    *   `SecureBuffer.__exit__(...)`
    *   `SessionManager._zero_key()`
*   **Functions it calls**:
    *   `ctypes.memset(...)` (foreign function interface wrapper)

#### Working Code Example
```python
from localpass.core.auth import zero_bytes

data = bytearray(b"HighlySensitivePasswordBytes")
zero_bytes(data)

print(f"Data after scrub: {data}")
assert all(b == 0 for b in data)
```

---

### `get_default_kdf_params() -> dict`
*   **Description**: Returns the default parameters for the Argon2id key derivation function.

#### Return Value
*   **Format**: `dict` containing configuration keys:
    ```python
    {
        "time_cost": 3,
        "memory_cost": 65536,
        "parallelism": 2,
        "hash_len": 32,
        "type": "Argon2id"
    }
    ```

#### Callers & Callees
*   **Called by**:
    *   `derive_key(...)`
    *   `init_vault(...)` and `load_vault(...)` in `localpass/core/vault.py`

#### Working Code Example
```python
from localpass.core.auth import get_default_kdf_params

params = get_default_kdf_params()
print(f"Argon2id default memory cost: {params['memory_cost']} KB")
```

---

### `derive_key(master_password: str, salt: bytes, params: Optional[dict] = None) -> bytes`
*   **Description**: Derives a 256-bit symmetric key from a UTF-8 password string and salt bytes using the memory-hard Argon2id algorithm.

#### Parameter Specifications
*   `master_password` (`str`): The plaintext password string.
*   `salt` (`bytes`): A high-entropy 16-byte random salt value.
*   `params` (`Optional[dict]`): Argon2id configurations. If omitted, uses the values from `get_default_kdf_params()`.

#### Return Value
*   **Format**: `bytes` of length 32 representing the derived symmetric AES key.

#### Callers & Callees
*   **Called by**:
    *   `get_vault_key(...)` in `localpass/core/vault.py`
    *   `init_vault(...)` in `localpass/core/vault.py`
    *   `load_vault(...)` in `localpass/core/vault.py`
*   **Functions it calls**:
    *   `argon2.low_level.hash_secret_raw` (third-party low-level library bindings)

#### Working Code Example
```python
from localpass.core.auth import derive_key
import os

salt = os.urandom(16)
pw = "SecureMasterPassword1!"

key = derive_key(pw, salt)
print(f"Derived Key (hex): {key.hex()}")
assert len(key) == 32
```

---

## 4. Classes

### `SecureBuffer`
A context manager that wraps mutable data buffers, ensuring they are zeroed in memory as soon as the block exits.

#### Class Methods

##### `__init__(self, data: bytes)`
*   **Description**: Initializes the secure buffer, converting input bytes into a mutable `bytearray`.
*   **Parameters**: `data` (`bytes`).

##### `__enter__(self) -> bytearray`
*   **Description**: Returns the mutable `bytearray` context reference.
*   **Return Format**: `bytearray`.

##### `__exit__(self, *_) -> None`
*   **Description**: Invokes `zero_bytes(self._buf)` to securely scrub the buffer from physical memory.
*   **Return Format**: `None`.

##### `__len__(self) -> int`
*   **Description**: Returns the size of the wrapped byte buffer.
*   **Return Format**: `int`.

##### `to_bytes(self) -> bytes`
*   **Description**: Returns an immutable copy of the active buffer bytes.
*   **Return Format**: `bytes`.

#### Working Code Example
```python
from localpass.core.auth import SecureBuffer

raw_key = b"A32ByteCryptographicSymmetricKey"

with SecureBuffer(raw_key) as buf:
    print(f"Inside buffer context block: {buf.hex()}")
    # Buffer contains the key bytes here

# Buffer is automatically zeroed here
print("Memory scrubbed.")
```

---

### `SessionManager`
Manages the application's active session state: stores the derived vault key, issues and rotates API session tokens, and validates incoming client requests.

#### Constructor

##### `__init__(self, ttl_seconds: int = TOKEN_TTL_SECONDS)`
*   **Parameters**: `ttl_seconds` (`int`) - Lifespan in seconds for issued tokens.

#### Key Storage Interface

##### `set_key(self, key: bytes, unlock_method: str = "password") -> None`
*   **Description**: Securely stores the derived key in a mutable `bytearray` inside the session manager. Zeroes any previously active key material.
*   **Parameters**:
    *   `key` (`bytes`): The 32-byte derived symmetric key.
    *   `unlock_method` (`str`): The authentication method used (default: `"password"`).
*   **Called by**: `_store_session_key(...)` in `localpass/ui/screens/unlock.py`.
*   **Calls**: `_zero_key()` internally.

##### `get_key(self) -> Optional[bytes]`
*   **Description**: Returns a copy of the active vault key, or `None` if the vault is locked.
*   **Return Format**: `Optional[bytes]`.
*   **Called by**:
    *   `save_vault(...)` in `localpass/core/vault.py`
    *   `local_server.py` handles.

##### `is_locked(self) -> bool` (Property)
*   **Description**: Checks if the session is locked (returns `true` if no active key is stored).
*   **Return Format**: `bool`.

##### `unlock_method(self) -> str` (Property)
*   **Description**: Returns the authentication method string.
*   **Return Format**: `str`.

#### Token Lifecycle Interface

##### `issue_token(self) -> str`
*   **Description**: Issues a new session token, invalidating any previously active token.
*   **Return Format**: `str` (64-character hex string representing 32 random bytes).
*   **Calls**: `secrets.token_hex(32)`.

##### `rotate_token(self) -> str`
*   **Description**: Generates a new session token and invalidates the old one. Alias for `issue_token()`.
*   **Return Format**: `str`.

##### `validate_token(self, token: str) -> bool`
*   **Description**: Validates a session token. Returns `true` if the session is unlocked, the token matches the active record (using constant-time comparison), and the token has not expired.
*   **Parameters**: `token` (`str`) - The incoming token to validate.
*   **Return Format**: `bool`.
*   **Calls**: `hmac.compare_digest(...)`.

##### `consume_nonce(self, nonce: str) -> bool`
*   **Description**: Implements replay attack protection by tracking request nonces.
*   **Parameters**: `nonce` (`str`) - A unique nonce string from a client request.
*   **Return Format**: `bool` (returns `true` if the nonce has not been seen before).

#### Lock & Callbacks Interface

##### `lock(self, reason: str = "") -> None`
*   **Description**: Zeroes key materials in memory, invalidates the active token, and triggers all registered lock callbacks.
*   **Parameters**: `reason` (`str`) - A string explaining why the vault was locked.
*   **Calls**: `_zero_key()` and all functions in `self._lock_callbacks`.

##### `clear(self) -> None`
*   **Description**: Legacy alias for `lock()`.

##### `add_lock_callback(self, cb) -> None`
*   **Description**: Registers a callback function to be invoked when the session is locked.
*   **Parameters**: `cb` (`Callable[[str], None]`).
*   **Called by**: `__init__` in `localpassApp` to stop the background server and navigate back to the unlock screen.

##### `record_failed_attempt(self) -> int`
*   **Description**: Increments and returns the failed password unlock count.
*   **Return Format**: `int`.

##### `reset_failed_attempts(self) -> None`
*   **Description**: Resets the failed unlock attempt counter to `0`.

##### `failed_attempts(self) -> int` (Property)
*   **Description**: Returns the current number of failed unlock attempts.
*   **Return Format**: `int`.

#### Working Code Example
```python
from localpass.core.auth import SessionManager
import time

# 1. Initialize
manager = SessionManager(ttl_seconds=5)

# 2. Store Key
test_key = b"A32ByteCryptographicSymmetricKey"
manager.set_key(test_key)
assert not manager.is_locked

# 3. Issue and Validate Token
token = manager.issue_token()
print(f"Session Token: {token}")
assert manager.validate_token(token)

# 4. Expiry Check
time.sleep(6)  # Wait for TTL to pass
assert not manager.validate_token(token)  # Returns False (token expired)

# 5. Lock
manager.lock("Manual Lock Triggered")
assert manager.is_locked
assert manager.get_key() is None
```

---

## 5. Legacy Compatibility Shim (`Session`)

Inherits from `SessionManager` and acts as a backwards-compatible wrapper so that older import references do not break.

```python
class Session(SessionManager):
    def clear(self) -> None:
        self.lock()
```

---

## See Also
- [Vault](vault.md)
- [Security Model](../../architecture/security-model.md)
- [Unlock Screen](../ui/screens/unlock.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*