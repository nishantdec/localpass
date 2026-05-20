[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: migrations.py (Schema Upgrades Pipeline)

## Purpose
The `migrations.py` module implements a step-based database schema migration pipeline. As the features of localpass evolve, the JSON schema representation of the encrypted vault may change. Rather than performing complex, fragile updates, this module defines incremental, testable transitions (e.g. `v1 -> v2`, `v2 -> v3`) that execute sequentially to upgrade older vaults to the latest format.

This system is executed inside the memory thread *after* decryption and *before* deserializing the data into strong Python dataclasses, guaranteeing backward compatibility.

## Location
`docs/python-app/core/migrations.md` (documenting `localpass/core/migrations.py`)

## Dependencies
- `uuid` — Stable UUID assignment.
- `copy` — Payload deep-copy operations during dry runs.
- `localpass.core.domain_trust.DomainTrustService`

---

## Standalone Helper Variables and Decorators

### `_MIGRATIONS`
A dictionary that acts as the registry for all defined step migrations.
*   **Type:** `dict[tuple[int, int], Callable[[dict], dict]]`
*   **Keys:** `(from_version, to_version)` integer tuples.
*   **Values:** Transition functions that accept a payload dictionary and return the upgraded dictionary.

### `_register(from_v: int, to_v: int)`
An internal decorator function used to register a schema transition function in the `_MIGRATIONS` registry.
*   **Parameters:**
    *   `from_v` — `int`: Source version number.
    *   `to_v` — `int`: Target version number.
*   **Code Example:**
    ```python
    @_register(1, 2)
    def my_upgrade_function(old: dict) -> dict:
        # Transformation steps...
        return upgraded_dict
    ```

---

## Defined Migration Steps

### 1. Migration `1 -> 2` (`_v1_to_v2`)
Upgrades database envelopes from the legacy `v1` structure to the `v2` structure.
*   **Modifications:**
    *   Creates separate empty lists for `logins`, `passkeys`, and `notes`.
    *   Iterates through the legacy unified `entries` array, routing records to their respective category lists based on their `type` field value.

---

### 2. Migration `2 -> 3` (`_v2_to_v3`)
Upgrades database envelopes from `v2` to the modern `v3` structure.
*   **Modifications:**
    *   **Metadata Upgrade:** Renames `metadata` to `vault_metadata` and ensures it contains stable `vault_id` UUID4, `device_id`, `schema_hash`, `last_backup` and `integrity_verified_at` fields.
    *   **Login Domain Normalization:** Iterates through `logins` and uses `DomainTrustService` to automatically populate `canonical_domain` and `match_domains` fields based on the URL value to enable phishing-resistant checks.
    *   **Passkey Field Normalization:** Renames the legacy `relying_party_id` field to `rp_id` to match the official WebAuthn terminology. Sets default parameters for `rp_name`, `sign_count` (`0`), `last_used`, `aaguid`, and `transports` (`["internal"]`).

---

## Class: MigrationManager
The controller class responsible for evaluating and executing required migrations.

### Constants
- `LATEST_VERSION` = `3`: The current target schema version of the codebase.

### Static Methods

#### `migrate(payload_dict: dict, dry_run: bool = False) -> dict`
Evaluates the version of a decrypted vault dictionary and applies all necessary step migrations sequentially until it reaches `LATEST_VERSION`.

$$\text{v1 Vault} \xrightarrow{\text{_v1_to_v2}} \text{v2 Vault} \xrightarrow{\text{_v2_to_v3}} \text{v3 Vault (Latest)}$$

*   **Parameters:**
    *   `payload_dict` — `dict`: Raw decrypted vault payload to evaluate.
    *   `dry_run` — `bool`: If `True`, performs a deep copy of the dictionary and processes the migration in memory without modifying the original object.
*   **Returns:** `dict` — The fully upgraded vault payload matching `LATEST_VERSION` specifications.
*   **Raises:** `ValueError` if a required step transition is missing from the registry.
*   **Called by:** `localpass.core.vault.load_vault`
*   **Calls:** Registered step migration functions.
*   **Code Example:**
    ```python
    from localpass.core.migrations import MigrationManager
    
    legacy_vault_data = {
        "version": 1,
        "entries": [
            {"title": "My Account", "type": "login", "url": "https://github.com"}
        ]
    }
    
    # Run in-memory dry-run upgrade
    upgraded = MigrationManager.migrate(legacy_vault_data, dry_run=True)
    print("New version:", upgraded["version"]) # Output: 3
    print("Logins:", upgraded["logins"]) # Legacy entries are now correctly routed
    ```

---

#### `can_migrate(from_version: int, to_version: int) -> bool`
Checks if a continuous migration path exists between two versions.

*   **Parameters:**
    *   `from_version` — `int`: Starting version.
    *   `to_version` — `int`: Target version.
*   **Returns:** `bool` — `True` if a valid chain of transition functions exists in the registry, `False` otherwise.
*   **Code Example:**
    ```python
    if MigrationManager.can_migrate(1, 3):
        print("Migration path exists.")
    else:
        print("ALERT: Unsupported vault version transition!")
    ```

---

## See Also
- [Vault](vault.md)
- [Recovery](recovery.md)
- [Vault File Format](../../api/vault-file-format.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*