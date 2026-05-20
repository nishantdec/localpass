[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: audit.py (Transaction Audit Logging)

## Purpose
The `audit.py` module provides a secure, privacy-preserving, local-only audit logger. It implements a tamper-evident cryptographic hash-chaining mechanism (similar to a block ledger) where each log entry contains the SHA-256 hash of the previous line. This makes any manual modifications, deletion, or insertion of audit lines immediately evident upon verification.

To protect user privacy, the audit log strictly forbids storing Personally Identifiable Information (PII) or secrets. Only opaque entry IDs, event statuses, and metadata sizes are persisted in line-delimited JSON format at `%APPDATA%/localpass/audit.log`.

## Location
`docs/python-app/core/audit.md` (documenting `localpass/core/audit.py`)

## Dependencies
- `hashlib` — SHA-256 record ledgers.
- `json` — Formatting log serialization.
- `threading` — Locking thread concurrency writes.
- `datetime` — ISO 8601 timestamps.
- `localpass.utils.paths.get_audit_log_path`

---

## Enumeration: AuditEvent
A string enum describing all recorded system events:

| Enum Name | Enum Value (String) | Semantic Trigger |
| :--- | :--- | :--- |
| `VAULT_UNLOCKED` | `"vault.unlocked"` | Executed on successful decryption. |
| `VAULT_LOCKED` | `"vault.locked"` | Triggered when locking or session timeouts fire. |
| `UNLOCK_FAILED` | `"vault.unlock_failed"` | Attempt with invalid credentials. |
| `VAULT_CREATED` | `"vault.created"` | Vault setup completed. |
| `VAULT_EXPORTED` | `"vault.exported"` | Plaintext JSON backups compiled. |
| `BACKUP_CREATED` | `"backup.created"` | Snapshot compiled in the rotation pool. |
| `BACKUP_RESTORED` | `"backup.restored"` | Restored a snapshot backup over the primary file. |
| `AUTOFILL_TRIGGERED` | `"autofill.triggered"` | Extension filled a credential set on a page. |
| `CREDENTIAL_COPIED` | `"credential.copied"` | Secret copied to OS clipboard. |
| `ENTRY_CREATED` | `"entry.created"` | New credentials added. |
| `ENTRY_UPDATED` | `"entry.updated"` | Changes committed on a record. |
| `ENTRY_DELETED` | `"entry.deleted"` | Record removed from the vault. |
| `PASSKEY_REGISTERED` | `"passkey.registered"` | Secure WebAuthn credential registered. |
| `PASSKEY_USED` | `"passkey.used"` | Secure WebAuthn assertion signature completed. |
| `MIGRATION_RAN` | `"migration.ran"` | Database envelope schema upgrades committed. |
| `INTEGRITY_CHECK_PASS`| `"integrity.pass"` | Integrity checks completed successfully. |
| `INTEGRITY_CHECK_FAIL`| `"integrity.fail"` | Corruption or tampering detected. |

---

## Class: AuditRecord

Represents a single atomic block inside the tamper-evident ledger. Uses python `__slots__` to minimize memory overhead.

### Properties
- `ts` (`str`): ISO 8601 timestamp in UTC.
- `event` (`str`): Event identifier string.
- `meta` (`dict`): Opaque metadata payload.
- `prev_hash` (`str`): SHA-256 hash string of the previous record.
- `record_hash` (`str`): SHA-256 signature string of the current record.

### Methods

#### `__init__(event: AuditEvent, meta: Optional[dict], prev_hash: str)`
Instantiates and signs a new audit block.

*   **Parameters:**
    *   `event` — `AuditEvent`: The event type.
    *   `meta` — `Optional[dict]`: Event parameters.
    *   `prev_hash` — `str`: SHA-256 hash of the previous line (or Genesis Hash).
*   **Returns:** `None`
*   **Calls:** `AuditRecord._compute_hash`

---

#### `_compute_hash() -> str`
Computes the SHA-256 digest of the record. Sorts metadata keys to guarantee consistent signatures.

$$\text{record\_hash} = \text{SHA-256}(\text{JSON-string}(\text{ts, event, meta, prev\_hash}))$$

*   **Returns:** `str` — 64-character hexadecimal digest.
*   **Code Example:**
    ```python
    record = AuditRecord(AuditEvent.VAULT_UNLOCKED, {"method": "argon2"}, "0"*64)
    print("Hash:", record.record_hash)
    ```

---

#### `to_dict() -> dict`
Converts the block structure to a JSON-compatible python dictionary.

*   **Returns:** `dict` — Data mapped keys.

---

#### `from_dict(d: dict) -> AuditRecord` (Class Method)
Reconstructs an `AuditRecord` object from a dictionary.

*   **Parameters:**
    *   `d` — `dict`: Parsed record structure.
*   **Returns:** `AuditRecord`

---

## Class: AuditService

Thread-safe audit service coordinating reads, writes, validation, and auto-rotation.

### Constants
- `MAX_LOG_BYTES` = `512 * 1024` (512 KB): Threshold size for log file rotation.
- `MAX_RECORDS_RETURN` = `500`: Maximum records returned by `get_recent()`.
- `GENESIS_HASH` = `"0" * 64`: Default previous hash value for the initial log entry.

### Methods

#### `__init__(log_path: Optional[Path] = None)`
*   **Parameters:**
    *   `log_path` — `Optional[Path]`: Explicit file target, or system default location.

---

#### `log(event: AuditEvent, meta: Optional[dict] = None) -> None`
Appends a signed audit block to the log file. Thread-safe using an internal lock. Silently ignores errors so logger failures do not crash the host client.

*   **Parameters:**
    *   `event` — `AuditEvent`: Target event type.
    *   `meta` — `Optional[dict]`: Context flags (no PII).
*   **Returns:** `None`
*   **Called by:** Throughout `VaultAdapter` and database persistence actions.
*   **Calls:** `AuditService._get_last_hash`, `AuditService._append`, `AuditService._rotate_if_needed`
*   **Code Example:**
    ```python
    from localpass.core.audit import get_audit_service, AuditEvent
    
    audit = get_audit_service()
    audit.log(AuditEvent.ENTRY_CREATED, {"id": "c1a2f3b4..."})
    ```

---

#### `get_recent(limit: int = 50) -> List[dict]`
Retrieves the most recent audit logs, starting with the latest records (reverse chronological order).

*   **Parameters:**
    *   `limit` — `int`: Maximum records to return (capped at `MAX_RECORDS_RETURN`).
*   **Returns:** `List[dict]` — List of matching records.
*   **Called by:** TUI diagnostics views, configuration modules.
*   **Code Example:**
    ```python
    logs = audit.get_recent(5)
    for entry in logs:
        print(f"[{entry['ts']}] {entry['event']} - Metadata: {entry['meta']}")
    ```

---

#### `verify_chain() -> bool`
Validates the cryptographic hash chain for the entire log file from genesis to the last entry.

*   **Returns:** `bool` — `True` if the log is secure and intact, `False` if any line has been tampered with or modified.
*   **Called by:** Security diagnostics, TUI integrity checking commands.
*   **Code Example:**
    ```python
    if audit.verify_chain():
        print("Audit chain integrity verified. Log is intact.")
    else:
        print("ALERT: Audit log tampering detected!")
    ```

---

#### `clear() -> None`
Erases all entries inside the log file. Requires explicit execution.

*   **Returns:** `None`

---

### Internal Helper Methods

#### `_append(record: AuditRecord) -> None`
Appends the serialized block representation as a new line in the audit log file.

---

#### `_read_lines() -> List[str]`
Reads all non-empty lines from the active log path.

---

#### `_get_last_hash() -> str`
Fetches the `hash` value from the last line of the log file to chain the next entry. Returns `GENESIS_HASH` if the log file is empty.

---

#### `_rotate_if_needed() -> None`
Checks the log file size. If it exceeds `512 KB` (`MAX_LOG_BYTES`), it renames the file to `audit.log.old`, rotating the old logs out and starting a new clean log chain.

---

## Function: `get_audit_service() -> AuditService`
Lazy-initialized module-level singleton function to retrieve the active `AuditService` instance.

*   **Returns:** `AuditService` singleton instance.
*   **Code Example:**
    ```python
    from localpass.core.audit import get_audit_service
    audit_service = get_audit_service()
    ```

---

## See Also
- [Vault](vault.md)
- [Auth](auth.md)
- [Recovery](recovery.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*