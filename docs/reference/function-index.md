[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](glossary.md)

---

# Comprehensive System Function Index

This document provides a highly detailed engineering reference catalog of the core cryptographic, PERSISTENCE, memory-sanitization, and TOTP generation functions within the localpass codebase.

---

## 1. Key Derivation & Cryptography

### `derive_key(master_password: str, salt: bytes, params: Optional[dict] = None) -> bytes`
*   **Location**: `localpass/core/auth.py`
*   **Description**: Derives a secure 256-bit symmetric encryption key from the user's Master Password using the Argon2id memory-hard password hashing algorithm.

#### Parameter Specifications
*   `master_password` (`str`): The plaintext master password string entered by the user. Must be encoded to UTF-8 within the function.
*   `salt` (`bytes`): A high-entropy 16-byte random salt generated via `os.urandom(16)` when the vault was created.
*   `params` (`Optional[dict]`): A dictionary containing Argon2id configurations. If `None`, defaults to:
    ```python
    {
        "time_cost": 3,
        "memory_cost": 65536,
        "parallelism": 2,
        "hash_len": 32,
        "type": "Argon2id"
    }
    ```

#### Return Value
*   **Format**: `bytes` of length 32 representing the derived AES-256 key.

#### Callers & Callees
*   **Called by**:
    *   `get_vault_key(path, master_password)` in `localpass/core/vault.py`
    *   `init_vault(path, master_password)` in `localpass/core/vault.py`
    *   `load_vault(path, master_password)` in `localpass/core/vault.py`
*   **Functions it calls**:
    *   `argon2.low_level.hash_secret_raw` (foreign library binding call)

#### Working Code Example
```python
from localpass.core.auth import derive_key
import os

salt = os.urandom(16)
password = "MasterPassword123!"

derived_key = derive_key(password, salt)
print(f"Derived Key (hex): {derived_key.hex()}")
assert len(derived_key) == 32
```

---

### `zero_bytes(buf: bytearray) -> None`
*   **Location**: `localpass/core/auth.py`
*   **Description**: Overwrites the physical RAM allocated for a mutable bytearray using ctypes. This ensures keys do not remain in virtual memory swap pages or process dumps.

#### Parameter Specifications
*   `buf` (`bytearray`): The mutable buffer of bytes containing sensitive data to overwrite.

#### Return Value
*   **Format**: `None` (modifies buffer in-place).

#### Callers & Callees
*   **Called by**:
    *   `SecureBuffer.__exit__(...)` in `localpass/core/auth.py`
    *   `SessionManager._zero_key()` in `localpass/core/auth.py`
*   **Functions it calls**:
    *   `ctypes.memset()` (system library binding)

#### Working Code Example
```python
from localpass.core.auth import zero_bytes

sensitive_data = bytearray(b"SecretAESKeyMaterial123")
print(f"Before: {sensitive_data}")

# Scrub the memory buffer immediately
zero_bytes(sensitive_data)
print(f"After: {sensitive_data}")
assert all(byte == 0 for byte in sensitive_data)
```

---

## 2. Vault Persistence & Integrity

### `init_vault(path: str, master_password: str) -> None`
*   **Location**: `localpass/core/vault.py`
*   **Description**: Generates an empty vault database structure, derives a primary key from the Master Password, encrypts the payload structure using AES-256-GCM, and commits the JSON envelope structure atomically to disk.

#### Parameter Specifications
*   `path` (`str`): The absolute target file path where the new `.nlk` vault file will be written.
*   `master_password` (`str`): The plaintext password string selected by the user.

#### Return Value
*   **Format**: `None`. Creates the target file on disk.

#### Callers & Callees
*   **Called by**:
    *   `attempt_unlock()` in `localpass/ui/screens/unlock.py`
*   **Functions it calls**:
    *   `derive_key(...)` in `localpass/core/auth.py`
    *   `os.urandom(16)` and `os.urandom(12)`
    *   `_compute_payload_hash(...)` in `localpass/core/vault.py`
    *   `_write_atomic(...)` in `localpass/core/vault.py`

#### Working Code Example
```python
from localpass.core.vault import init_vault
import os

target_path = "test_vault.nlk"
password = "NewSuperSecretVaultPassword1!"

try:
    init_vault(target_path, password)
    print("Vault successfully initialized.")
finally:
    if os.path.exists(target_path):
        os.remove(target_path)
```

---

### `load_vault(path: str, master_password: str) -> VaultPayload`
*   **Location**: `localpass/core/vault.py`
*   **Description**: Reads a vault envelope JSON from disk, validates base64 components, verifies HMAC-SHA256 payload integrity, derives the decryption key, decrypts the AES-256-GCM cipher payload block, and runs required data-schema migrations.

#### Parameter Specifications
*   `path` (`str`): The absolute path to the target encrypted vault file.
*   `master_password` (`str`): The plaintext Master Password string entered by the user.

#### Return Value
*   **Format**: `VaultPayload` object containing list fields for logins, notes, passkeys, and metadata.

#### Callers & Callees
*   **Called by**:
    *   `attempt_unlock()` in `localpass/ui/screens/unlock.py`
*   **Functions it calls**:
    *   `_load_legacy_vault(...)` in `localpass/core/vault.py` (if magic bytes are `NLLK`)
    *   `derive_key(...)` in `localpass/core/auth.py`
    *   `_verify_payload_hash(...)` in `localpass/core/vault.py`
    *   `AESGCM.decrypt(...)` (cryptography package AEAD method)
    *   `MigrationManager.migrate(...)` in `localpass/core/migrations.py`

#### Working Code Example
```python
from localpass.core.vault import load_vault, init_vault
import os

path = "test_run.nlk"
pw = "SecurePass123!"

try:
    init_vault(path, pw)
    vault = load_vault(path, pw)
    print(f"Decrypted payload version: {vault.version}")
    print(f"Logins list count: {len(vault.logins)}")
finally:
    if os.path.exists(path):
        os.remove(path)
```

---

### `save_vault(path: str, key: bytes, vault_payload: VaultPayload, salt: Optional[bytes] = None, kdf_params: Optional[dict] = None, max_backups: int = 5) -> None`
*   **Location**: `localpass/core/vault.py`
*   **Description**: Re-encrypts the entire in-memory `VaultPayload` using a fresh 12-byte initialization vector, re-computes the HMAC integrity payload hash, and updates the JSON envelope, performing safe backups rotations.

#### Parameter Specifications
*   `path` (`str`): Absolute destination path of the target vault file.
*   `key` (`bytes`): The active, derived 256-bit symmetric AES key.
*   `vault_payload` (`VaultPayload`): The complete, updated database payload structure.
*   `salt` (`Optional[bytes]`): Custom salt value. Defaults to extraction from existing envelope.
*   `kdf_params` (`Optional[dict]`): Active KDF settings. Defaults to extraction from existing envelope.
*   `max_backups` (`int`): Maximum count of historical backup copies retained inside the backup subdirectory.

#### Return Value
*   **Format**: `None`.

#### Callers & Callees
*   **Called by**:
    *   `save_entry(...)` (various screens and API components)
*   **Functions it calls**:
    *   `os.urandom(12)`
    *   `AESGCM.encrypt(...)`
    *   `_compute_payload_hash(...)` in `localpass/core/vault.py`
    *   `_write_atomic(...)` in `localpass/core/vault.py`

#### Working Code Example
```python
from localpass.core.vault import init_vault, load_vault, save_vault
from localpass.core.entries import LoginEntry
import os

path = "save_test.nlk"
pw = "SecureMasterPassword1!"

try:
    # 1. Initialize
    init_vault(path, pw)
    
    # 2. Load key & payload
    from localpass.core.vault import get_vault_key
    key = get_vault_key(path, pw)
    payload = load_vault(path, pw)
    
    # 3. Add custom login entry
    login = LoginEntry(title="Test Account", username="user", password="pw")
    payload.logins.append(login)
    
    # 4. Save back to disk
    save_vault(path, key, payload)
    print("Vault updated and saved securely.")
finally:
    if os.path.exists(path):
        os.remove(path)
```

---

## 3. Two-Factor Authentication (TOTP)

### `get_totp_info(secret: str) -> Optional[Tuple[str, int]]`
*   **Location**: `localpass/core/totp.py`
*   **Description**: Generates a standard 6-digit Time-based One-Time Password code corresponding to RFC 6238 using a base32 encoded secret.

#### Parameter Specifications
*   `secret` (`str`): The base32-encoded private string secret key.

#### Return Value
*   **Format**: `Optional[Tuple[str, int]]`
    *   First element: The current 6-digit string token code (e.g. `"481029"`).
    *   Second element: Seconds remaining before the current time window expires (ranges `0` to `30`).
    *   Returns `None` if the provided secret is empty or invalid.

#### Callers & Callees
*   **Called by**:
    *   `render_entry_view(...)` in `localpass/ui/screens/entry_view.py`
    *   `handle_totp(...)` in `server/local_server.py`
*   **Functions it calls**:
    *   `pyotp.TOTP` library constructor and state generators.

#### Working Code Example
```python
from localpass.core.totp import get_totp_info
import time

# Standard base32 secret representation
secret = "JBSWY3DPEHPK3PXP"
totp_data = get_totp_info(secret)

if totp_data:
    code, seconds_left = totp_data
    print(f"Current TOTP Code: {code}")
    print(f"Seconds remaining in step: {seconds_left}s")
```

---

## See Also
- [Glossary](glossary.md)
- [File Index](file-index.md)
- [Config Reference](config-reference.md)
- [Keyboard Shortcuts](keyboard-shortcuts.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*