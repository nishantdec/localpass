[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Vault Core Service Specifications (`vault.py`)

The `vault.py` module defines the absolute foundation of localpass's storage security model. It governs the binary-to-JSON transitions, envelope cryptography, data integrity checks, robust atomic write behaviors, automatic encrypted backups, and error boundary recovery schemes.

---

## 1. Vault Storage Architecture & JSON Envelope Format

localpass persists vault payloads using a zero-knowledge encrypted JSON envelope layout. Plaintext secrets are shielded under standard `AES-256-GCM` encryption, with an HMAC integrity seal verifying the data prior to decryption.

### Envelope JSON Specification
The physical structure stored on disk (typically named `vault.nlk`) adheres to the following specification:

```json
{
  "schema_version": 1,
  "vault_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "version": 3,
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "kdf_params": {
    "time_cost": 2,
    "memory_cost": 65536,
    "parallelism": 4,
    "hash_len": 32
  },
  "device_id": "e2a39281-b541-477d-bb7d-080c353de2b4",
  "created_at": "2026-05-20T11:42:15.390Z",
  "updated_at": "2026-05-20T11:45:00.123Z",
  "nonce": "c3BsaWNlZGFlc25vbmNl",
  "salt": "c2FsdGZvcmFyZ29uMmlk",
  "payload_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f61234",
  "payload": "T3BlblNTTFZhdWx0UGF5bG9hZEJhc2U2NENpcGhlcnRleHQ="
}
```

### Envelope Fields Reference
| JSON Property | Type | Cryptographic Description / Constraints |
| :--- | :--- | :--- |
| `schema_version` | `integer` | Schema configuration of the envelope outer metadata structure. Currently `1`. |
| `vault_id` | `string` | Unique UUIDv4 assigned upon creation, stable across all sequential saves. |
| `version` | `integer` | Schema format version of the unencrypted inner decrypted `VaultPayload` payload. |
| `cipher` | `string` | String matching `"AES-256-GCM"`. Defines symmetric encryption algorithm. |
| `kdf` | `string` | String matching `"Argon2id"`. Defines the Password Key Derivation Function. |
| `kdf_params` | `object` | Configured complexity factors parameters passed directly to the KDF algorithm. |
| `device_id` | `string` | Hexadecimal-encoded machine signature stable fingerprint to detect multi-device configurations. |
| `created_at` | `string` | ISO 8601 UTC timestamp capturing vault birth. |
| `updated_at` | `string` | ISO 8601 UTC timestamp updated on every atomic save event. |
| `nonce` | `string` | Base64-encoded 12-byte initialization vector generated at random for AES-256-GCM. |
| `salt` | `string` | Base64-encoded 16-byte random salt generated for the KDF. |
| `payload_hash` | `string` | Hexadecimal HMAC-SHA256 hash computed over the key and ciphertext payload. |
| `payload` | `string` | Base64-encoded ciphertext string containing the serialized JSON vault entries payload. |

---

## 2. Exceptions & Error Boundaries

`vault.py` registers unique, descriptive exceptions to decouple cryptographic failures, input issues, and payload corruption scenarios:

```python
class InvalidMasterPassword(Exception):
    """
    Raised when the derived symmetric key cannot decrypt the AES-GCM tag.
    Directly corresponds to prompt_toolkit session failures and failed count tracking.
    """
    pass

class VaultError(Exception):
    """
    Generic base exception for all persistent vault errors (missing files, OS issues).
    """
    pass

class VaultCorruptionError(VaultError):
    """
    Raised when the vault decrypts successfully, but parsing the decrypted plaintext 
    as UTF-8 or JSON fails. Preserves the decrypted raw bytes for forensic data extraction.
    """
    def __init__(self, message: str, raw_bytes: Optional[bytes] = None):
        super().__init__(message)
        self.raw_bytes = raw_bytes

class VaultIntegrityError(VaultError):
    """
    Raised when the HMAC-SHA256 signature calculated over the ciphertext does not match
    the `payload_hash` key in the envelope. Indicates disk sector errors or active tampering.
    """
    pass
```

---

## 3. Vault Module Constants

*   `ENVELOPE_SCHEMA_VERSION` (`int`): Statically set to `1`.
*   `LEGACY_MAGIC` (`bytes`): Statically set to `b"NLLK"`. Enables automated conversion of older binary vaults during loading processes.

---

## 4. Architectural Data Flows

### A. Initialization Flow (`init_vault`)
```
[User Password] ──> Generate Salt (16B) ──> derive_key ──> Key (32B)
                                                               │
Create VaultPayload ──> JSON ──> Encrypt (AES-GCM, Nonce 12B) ─┘
                                       │
                                   Ciphertext ──> HMAC-SHA256 ──> payload_hash
                                       │
                                   Assemble Envelope ──> Atomic Write to Disk
```

### B. Decryption & Integrity Verification Flow (`load_vault`)
```
Open File ──> Parse JSON Envelope ──> Decode Salt & Nonce ──> derive_key ──> Key (32B)
                                                                               │
Verify HMAC payload_hash (Constant-Time Compare) <── Compute HMAC ─────────────┤
     │                                                                         │
     ├─ [FAIL] ──> Raise VaultIntegrityError                                  │
     └─ [PASS] ──> AES-GCM Decrypt (using Key & Nonce) <───────────────────────┘
                        │
                  Plaintext Bytes ──> UTF-8 Decode ──> JSON Parse ──> Migration ──> Return
                        │                                  │
                        └─ [FAIL] ────────[FAIL] ──────────┴─> Raise VaultCorruptionError
```

---

## 5. Functional Index Reference

### `_compute_payload_hash`
```python
def _compute_payload_hash(key: bytes, ciphertext: bytes) -> str:
```
*   **Description:** Computes a SHA-256 keyed-hash message authentication code (HMAC) of the raw encrypted ciphertext bytes using the derived symmetric key.
*   **Parameters:**
    *   `key` (`bytes`): Derived 32-byte master vault key.
    *   `ciphertext` (`bytes`): Raw encrypted bytes.
*   **Returns:** `str` representing the hex-encoded message digest signature.
*   **Caller Files:** `localpass/core/vault.py` (internally within `init_vault` and `save_vault`)
*   **Callee Functions:** `hmac.new`, `hashlib.sha256`, `hmac.HMAC.hexdigest`
*   **Working Example:**
    ```python
    key = b"\x01" * 32
    ciphertext = b"encryptedpayloadhere"
    sig = _compute_payload_hash(key, ciphertext)
    print(f"HMAC: {sig}")
    ```

---

### `_verify_payload_hash`
```python
def _verify_payload_hash(key: bytes, ciphertext: bytes, expected_hex: str) -> bool:
```
*   **Description:** Validates a stored payload signature against a calculated signature in constant time to prevent timing attacks.
*   **Parameters:**
    *   `key` (`bytes`): Derived 32-byte vault key.
    *   `ciphertext` (`bytes`): Raw encrypted bytes.
    *   `expected_hex` (`str`): Hexadecimal payload signature stored in the envelope.
*   **Returns:** `bool` - `True` if signature matches exactly, otherwise `False`.
*   **Caller Files:** `localpass/core/vault.py` (internally within `load_vault` and `verify_integrity`)
*   **Callee Functions:** `_compute_payload_hash`, `hmac.compare_digest`
*   **Working Example:**
    ```python
    key = b"\x01" * 32
    ciphertext = b"encryptedpayloadhere"
    expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" # Example hash
    valid = _verify_payload_hash(key, ciphertext, expected)
    ```

---

### `get_vault_key`
```python
def get_vault_key(path: str, master_password: str) -> bytes:
```
*   **Description:** Opens the primary vault file, extracts KDF parameters and salt, and performs synchronous key derivation. Gracefully reads legacy structures if binary signatures are detected.
*   **Parameters:**
    *   `path` (`str`): Absolute string location of the primary vault.
    *   `master_password` (`str`): Master password string supplied by user.
*   **Returns:** `bytes` - Decoded 32-byte cryptographic key.
*   **Caller Files:** `localpass/ui/screens/unlock.py`
*   **Callee Functions:** `derive_key`, `json.load`, `base64.b64decode`, `get_default_kdf_params`
*   **Working Example:**
    ```python
    from localpass.core.vault import get_vault_key
    try:
        derived_key = get_vault_key("C:\\Users\\North\\.localpass\\vault.nlk", "super_secret_pwd")
        print(f"Derived Key Length: {len(derived_key)} bytes")
    except Exception as e:
        print(f"Failed to read parameters: {e}")
    ```

---

### `init_vault`
```python
def init_vault(path: str, master_password: str) -> None:
```
*   **Description:** Creates a brand-new encrypted vault file populated with an empty base payload. Utilizes dynamic cryptographic salt and nonce variables, saves with a new `vault_id`, and writes atomically.
*   **Parameters:**
    *   `path` (`str`): Output file target path.
    *   `master_password` (`str`): Encryption master passphrase.
*   **Returns:** `None`
*   **Caller Files:** `localpass/ui/screens/unlock.py`
*   **Callee Functions:** `os.urandom`, `get_default_kdf_params`, `derive_key`, `VaultPayload`, `json.dumps`, `AESGCM`, `AESGCM.encrypt`, `datetime.datetime.now`, `get_device_id`, `_compute_payload_hash`, `base64.b64encode`, `_write_atomic`
*   **Working Example:**
    ```python
    from localpass.core.vault import init_vault
    # Initializes a fresh vault
    init_vault("./test_vault.nlk", "P@ssw0rd123!")
    ```

---

### `load_vault`
```python
def load_vault(path: str, master_password: str) -> VaultPayload:
```
*   **Description:** Fully decrypts, validates, migrates, and hydrates the object graph representing all logins, notes, and keychains in memory. Handles legacy upgrades automatically.
*   **Parameters:**
    *   `path` (`str`): Source vault file location.
    *   `master_password` (`str`): Decryption master passphrase.
*   **Returns:** `VaultPayload` object model representing decrypted state.
*   **Raises:**
    *   `VaultError`: Missing file or unparseable envelope.
    *   `VaultIntegrityError`: HMAC signature mismatch.
    *   `InvalidMasterPassword`: Invalid password (invalid GCM auth tag).
    *   `VaultCorruptionError`: Decryption successful but plaintext is corrupted.
*   **Caller Files:** `localpass/ui/screens/unlock.py`
*   **Callee Functions:** `_load_legacy_vault`, `json.load`, `base64.b64decode`, `derive_key`, `_verify_payload_hash`, `AESGCM`, `AESGCM.decrypt`, `MigrationManager.migrate`, `VaultPayload.from_dict`
*   **Working Example:**
    ```python
    from localpass.core.vault import load_vault, InvalidMasterPassword
    try:
        payload = load_vault("./vault.nlk", "P@ssw0rd123!")
        print(f"Loaded {len(payload.logins)} login records!")
    except InvalidMasterPassword:
        print("Wrong password entered!")
    ```

---

### `save_vault`
```python
def save_vault(
    path: str,
    key: bytes,
    vault_payload: VaultPayload,
    salt: Optional[bytes] = None,
    kdf_params: Optional[dict] = None,
    max_backups: int = 5,
) -> None:
```
*   **Description:** Securely serializes the `VaultPayload` structure, wraps it in GCM encryption with a fresh random nonce, computes the new HMAC validation seal, and performs atomic rotation writes.
*   **Parameters:**
    *   `path` (`str`): Destination vault filepath.
    *   `key` (`bytes`): Derived 32-byte active session key.
    *   `vault_payload` (`VaultPayload`): Unencrypted data payloads.
    *   `salt` (`Optional[bytes]`): Random salt payload; preserved from current envelope if not provided.
    *   `kdf_params` (`Optional[dict]`): Active KDF settings.
    *   `max_backups` (`int`): Maximum copies to retain in rotation history. Default is `5`.
*   **Returns:** `None`
*   **Caller Files:** `localpass/ui/screens/entry_new.py`, `localpass/ui/screens/entry_edit.py`, `localpass/ui/screens/entry_view.py`, `localpass/core/vault.py` (`_load_legacy_vault`)
*   **Callee Functions:** `json.load`, `uuid.uuid4`, `get_device_id`, `datetime.datetime.now`, `base64.b64encode`, `os.urandom`, `AESGCM`, `AESGCM.encrypt`, `_compute_payload_hash`, `_write_atomic`
*   **Working Example:**
    ```python
    from localpass.core.vault import save_vault
    # Saves modified state back to active vault with full backups active
    save_vault("./vault.nlk", active_session_key, in_memory_payload)
    ```

---

### `verify_integrity`
```python
def verify_integrity(path: str, key: bytes) -> bool:
```
*   **Description:** Performs dynamic verification of the envelope's stored integrity check hash against the derived key, confirming file integrity without risking exposure of decrypted assets.
*   **Parameters:**
    *   `path` (`str`): Target vault path.
    *   `key` (`bytes`): Derived key payload.
*   **Returns:** `bool` - `True` if matches or has no stored hash, `False` if tampered or JSON fails to parse.
*   **Caller Files:** `localpass/core/recovery.py` (`RecoveryManager`)
*   **Callee Functions:** `json.load`, `base64.b64decode`, `_verify_payload_hash`
*   **Working Example:**
    ```python
    from localpass.core.vault import verify_integrity
    if not verify_integrity("./vault.nlk", user_session_key):
        print("CRITICAL: Vault file tampered or corrupted!")
    ```

---

### `_write_atomic`
```python
def _write_atomic(path: str, data: dict, max_backups: int = 5) -> None:
```
*   **Description:** Writes data to disk atomically to prevent partial writes. Writes to `.tmp`, verifies JSON structure, shifts backups, and replaces the target file. Incorporates a retry loop with sleep intervals to bypass OS lock contentions.
*   **Parameters:**
    *   `path` (`str`): Target primary destination path.
    *   `data` (`dict`): The dictionary object to serialize.
    *   `max_backups` (`int`): Maximum copies to retain in rotation history.
*   **Returns:** `None`
*   **Raises:** `VaultError` if write produces malformed JSON structure.
*   **Caller Files:** `localpass/core/vault.py` (internally within `init_vault` and `save_vault`)
*   **Callee Functions:** `json.dump`, `json.load`, `_rotate_backups`, `os.replace`, `os.remove`, `time.sleep`

---

### `_rotate_backups`
```python
def _rotate_backups(vault_path: str, max_backups: int) -> None:
```
*   **Description:** Increments historical rotation numbers on encrypted backup copies, deletes excess, and writes the current primary vault file to `.bak.1`. Failures are swallowed silently to avoid blocking main file updates.
*   **Parameters:**
    *   `vault_path` (`str`): Path to primary vault file.
    *   `max_backups` (`int`): History limitation depth.
*   **Returns:** `None`
*   **Caller Files:** `localpass/core/vault.py` (internally within `_write_atomic`)
*   **Callee Functions:** `get_backup_dir`, `Path.exists`, `Path.unlink`, `shutil.copy2`

---

### `_load_legacy_vault`
```python
def _load_legacy_vault(path: str, master_password: str) -> VaultPayload:
```
*   **Description:** Processes older versions of localpass databases prefixed with the `NLLK` magic signature. Decrypts data using legacy mappings, migrates it, and upgrades the file to JSON immediately.
*   **Parameters:**
    *   `path` (`str`): Path to old binary file.
    *   `master_password` (`str`): Passphrase string.
*   **Returns:** `VaultPayload` converted structure.
*   **Caller Files:** `localpass/core/vault.py` (internally within `load_vault`)
*   **Callee Functions:** `derive_key`, `AESGCM`, `AESGCM.decrypt`, `json.loads`, `MigrationManager.migrate`, `VaultPayload.from_dict`, `save_vault`

---

## See Also
- [Auth](auth.md)
- [Vault File Format](../../api/vault-file-format.md)
- [Vault Encryption Diagram](../../architecture/diagrams/vault-encryption.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*