[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: recovery.py (Vault Recovery and Backups)

## Purpose
The `recovery.py` module manages database backups, vault integrity repair, and emergency JSON exports. In a local-first password manager, safeguarding data against disk corruption, system crashes, or file write interruptions is critical. 

This module implements an automated rotation pool of the last 5 encrypted backups, provides verification checks to validate backup states, attempts to repair corrupted primary vaults using the backup pool, and enables emergency plain-text exports (using the derived Master Password key) for catastrophic recovery.

## Location
`docs/python-app/core/recovery.md` (documenting `localpass/core/recovery.py`)

## Dependencies
- `shutil` — High-level file-system copy operations.
- `json` — Decrypt parser serialization.
- `pathlib` — System path operations.
- `datetime` — Backup timestamps.
- `cryptography.hazmat.primitives.ciphers.aead.AESGCM` — High-speed symmetric decryption.
- `localpass.utils.paths.get_backup_dir`, `get_vault_path`
- `localpass.core.vault.load_vault`, `verify_integrity`

---

## Dataclass: BackupInfo
A container representing an encrypted backup snapshot file on disk.

### Attributes
- `path` (`Path`): Absolute filesystem path to the backup file.
- `index` (`int`): Rotation pool position ($1 = \text{newest}, 5 = \text{oldest}$).
- `size_bytes` (`int`): Backup file size in bytes.
- `modified_at` (`Optional[datetime.datetime]`): Host filesystem modification timestamp.
- `label` (Property) -> `str`: Returns a formatted date string (e.g. `"2026-05-20 11:36:03"`) or a default index label.

---

## Dataclass: RepairResult
Represents the outcome of a vault repair attempt.

### Attributes
- `success` (`bool`): `True` if a valid backup was successfully verified and restored.
- `source` (`str`): The restore source (e.g., `"backup.1"`, `"backup.3"` or `"none"`).
- `message` (`str`): Summary of the operation outcome.

---

## Class: RecoveryManager
The controller managing backups and vault recovery.

### Methods

#### `__init__(max_backups: int = 5)`
*   **Parameters:**
    *   `max_backups` — `int`: Maximum number of backup snapshots to maintain in the rotation pool. Defaults to `5`.

---

#### `list_snapshots(vault_name: str = "vault.nlk") -> List[BackupInfo]`
Scans the backup directory and returns all available encrypted backup files, sorted from newest to oldest.

*   **Parameters:**
    *   `vault_name` — `str`: The name of the primary vault file. Defaults to `"vault.nlk"`.
*   **Returns:** `List[BackupInfo]` — Sorted list of existing backups.
*   **Called by:** Settings menus, diagnostic tools, and repair processes.
*   **Code Example:**
    ```python
    manager = RecoveryManager()
    backups = manager.list_snapshots()
    for b in backups:
        print(f"Position: {b.index} - Modified: {b.label} - Size: {b.size_bytes} bytes")
    ```

---

#### `verify_snapshot(snapshot_path: Path, key: bytes) -> bool`
Checks whether an encrypted backup file is valid and can be decrypted using the derived key.

*   **Parameters:**
    *   `snapshot_path` — `Path`: The target file to test.
    *   `key` — `bytes`: The derived 256-bit AES master key.
*   **Returns:** `bool` — `True` if decryption succeeds and the JSON structure is valid, `False` otherwise.
*   **Calls:** `localpass.core.vault.verify_integrity`

---

#### `restore_snapshot(snapshot_path: Path, dest: Optional[Path] = None, key: Optional[bytes] = None) -> bool`
Restores an encrypted backup file over the primary vault file.

*   **Parameters:**
    *   `snapshot_path` — `Path`: The source backup file to restore.
    *   `dest` — `Optional[Path]`: The destination path (defaults to the primary vault path).
    *   `key` — `Optional[bytes]`: If provided, verifies backup integrity before restoring.
*   **Returns:** `bool` — `True` if successfully copied, `False` on copy errors or if integrity verification fails.
*   **Calls:** `shutil.copy2`
*   **Code Example:**
    ```python
    success = manager.restore_snapshot(
        snapshot_path=Path("C:/Users/North/AppData/Roaming/localpass/backups/vault.nlk.bak.1"),
        key=derived_key
    )
    ```

---

#### `repair_vault(key: bytes, vault_name: str = "vault.nlk") -> RepairResult`
Attempts to automatically repair a corrupted primary vault by finding and restoring the most recent valid backup from the rotation pool.

$$\text{Corrupted vault.nlk} \xleftarrow{\text{Verify / Restore}} \text{Newest valid backup in pool (bak.1 } \rightarrow \text{ bak.5)}$$

*   **Parameters:**
    *   `key` — `bytes`: The derived 256-bit AES master key.
    *   `vault_name` — `str`: The target vault filename.
*   **Returns:** `RepairResult` — Outcome of the repair attempt.
*   **Called by:** TUI startup initialization if vault decryption fails.
*   **Calls:** `RecoveryManager.list_snapshots`, `RecoveryManager.verify_snapshot`, `RecoveryManager.restore_snapshot`
*   **Code Example:**
    ```python
    res = manager.repair_vault(derived_key)
    if res.success:
        print("Success:", res.message)
    else:
        print("Critical Error:", res.message)
    ```

---

#### `export_emergency(key: bytes, dest_path: Path, vault_path: Optional[Path] = None) -> None`
Decrypts the vault directly and exports all stored credentials as a plain-text JSON file. 

> [!WARNING]
> The exported file contains unencrypted credentials, passwords, and secrets. This function should only be used for emergency recovery. The exported file must be stored securely and deleted after use.

*   **Parameters:**
    *   `key` — `bytes`: The derived 256-bit AES master key.
    *   `dest_path` — `Path`: The destination path for the unencrypted JSON file.
    *   `vault_path` — `Optional[Path]`: The source vault path (defaults to the primary vault path).
*   **Returns:** `None`
*   **Called by:** Diagnostic screens, manual CLI export tools.
*   **Calls:** `AESGCM.decrypt`
*   **Code Example:**
    ```python
    manager.export_emergency(
        key=derived_key,
        dest_path=Path("D:/catastrophic_vault_rescue_export.json")
    )
    print("PLAIN-TEXT EXPORT WRITTEN. USE WITH EXTREME CAUTION.")
    ```

---

## See Also
- [Vault](vault.md)
- [Audit](audit.md)
- [Migrations](migrations.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*