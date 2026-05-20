[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: entries.py (Vault Schema Models)

## Purpose
The `entries.py` module defines the complete, formal data models and schemas for all records stored inside the localpass encrypted vault. By declaring type-safe Python dataclasses, it defines the structure of logins, Time-based One-Time Passwords (TOTP), secure notes, and WebAuthn-compliant FIDO2 passkeys.

It also coordinates schema validation, parses raw dictionary structures, manages database lifecycle timestamps, and handles inner payload serialization to JSON format before encryption.

## Location
`docs/python-app/core/entries.md` (documenting `localpass/core/entries.py`)

## Dependencies
- `uuid` — Automatic generation of unique IDs.
- `datetime` — UTC timestamps for logs and records.
- `dataclasses` — Type-safe data container wrappers.
- `typing` — Structure definitions and type hints.
- `localpass.core.domain_trust.DomainTrustService`

---

## Dataclass: Entry (Base Class)
The common ancestor class for all entry types in the database.

### Attributes
- `id` (`str`): UUID4 unique identifier. Automatically generated on creation.
- `title` (`str`): Human-readable title or label for the entry.
- `type` (`EntryType`): Literal string: `"login"`, `"totp_only"`, `"note"`, or `"passkey"`.
- `notes` (`str`): Multi-line descriptive notes.
- `created_at` (`str`): ISO 8601 UTC timestamp of creation.
- `updated_at` (`str`): ISO 8601 UTC timestamp of the last modification.

### Methods
#### `update_timestamp() -> None`
Resets the `updated_at` property to the current UTC time.

---

## Dataclass: LoginEntry (Inherits from Entry)
Defines the schema for account credentials and TOTP secrets.

### Attributes
- `username` (`str`): The account username.
- `password` (`str`): The unencrypted password (encrypted at rest by the vault envelope).
- `url` (`str`): The website URL.
- `totp_secret` (`Optional[str]`): The Base32-encoded seed secret for 2FA.
- `canonical_domain` (`Optional[str]`): Extracted eTLD+1 registered domain (e.g. `"google.com"`).
- `match_domains` (`List[str]`): Hostnames permitted for autofill checks.
- `login_urls` (`List[str]`): URLs where these credentials are valid.
- `preferred` (`bool`): Boolean flag indicating high priority or favorite status.
- `last_used` (`Optional[str]`): ISO 8601 timestamp of last use.
- `usage_count` (`int`): Usage frequency counter.

---

## Dataclass: PasskeyEntry (Inherits from Entry)
Defines a WebAuthn/FIDO2-compliant software passkey credential record.

### Attributes
- `rp_id` (`str`): Relying Party domain identifier (e.g. `"github.com"`).
- `rp_name` (`str`): Relying Party descriptive label (e.g. `"GitHub"`).
- `credential_id` (`str`): Base64url-encoded unique credential ID.
- `user_handle` (`str`): Base64url-encoded user ID.
- `private_key` (`str`): Cryptographic private key (base64-encoded PEM or CBOR).
- `algorithm` (`int`): COSE signature algorithm number. Default is `-7` (ES256 / ECDSA).
- `sign_count` (`int`): Monotonically increasing signature counter. Used for replay attack prevention under the WebAuthn standard.
- `last_used` (`Optional[str]`): ISO 8601 timestamp of last authentication.
- `aaguid` (`str`): Authenticator AAGUID (software authenticator uses all-zeros: `"00000000-0000-0000-0000-000000000000"`).
- `transports` (`List[str]`): Permitted connection transports. Defaults to `["internal"]`.

---

## Dataclass: NoteEntry (Inherits from Entry)
Represents a secure text note in the vault. Inherits all fields from `Entry` without adding additional attributes.

---

## Dataclass: VaultMetadata
Metadata stored *inside* the encrypted vault payload (distinct from outer JSON envelope metadata) to track vault integrity and provenance.

### Attributes
- `vault_id` (`str`): Stable UUID4 identifier assigned on vault creation.
- `device_id` (`str`): Unique identifier of the host computer.
- `schema_hash` (`str`): SHA-256 fingerprint hash of the database schema structure.
- `last_backup` (`Optional[str]`): ISO 8601 timestamp of the last successful backup.
- `integrity_verified_at` (`Optional[str]`): Timestamp of the last successful integrity check.

### Methods
#### `to_dict() -> dict`
Serializes the metadata object to a dictionary.

#### `from_dict(data: dict) -> VaultMetadata` (Class Method)
Reconstructs a `VaultMetadata` object from a dictionary.

---

## Dataclass: VaultPayload
The master class representing the decrypted contents of the vault.

### Attributes
- `version` (`int`): The active schema version (currently `3`).
- `logins` (`List[LoginEntry]`): Stored accounts and credentials.
- `passkeys` (`List[PasskeyEntry]`): Stored WebAuthn credentials.
- `notes` (`List[NoteEntry]`): Stored secure text notes.
- `settings` (`Dict[str, Any]`): User configuration settings and preferences.
- `vault_metadata` (`VaultMetadata`): Vault provenance and integrity metadata.

### Methods

#### `to_dict() -> dict`
Converts the entire decrypted vault payload into a structured dictionary. This is the exact format used to compile the JSON string before it is encrypted and saved to disk.

*   **Returns:** `dict` — Highly nested serializable structure.
*   **Called by:** `localpass.core.vault.save_vault`

---

#### `from_dict(data: dict) -> VaultPayload` (Class Method)
Reconstructs the `VaultPayload` object from a raw JSON dictionary. During reconstruction, it normalizes URLs, updates domain registers for legacy entries, and sets fallback configurations for older vaults.

*   **Parameters:**
    *   `data` — `dict`: Raw unverified vault dictionary.
*   **Returns:** `VaultPayload` — Strongly typed, validated payload.
*   **Called by:** `localpass.core.vault.load_vault`
*   **Code Example:**
    ```python
    import json
    from localpass.core.entries import VaultPayload
    
    raw_json = '{"version": 3, "logins": [], "passkeys": [], "notes": [], "settings": {}}'
    parsed_dict = json.loads(raw_json)
    
    payload = VaultPayload.from_dict(parsed_dict)
    print("Vault Payload Version:", payload.version)
    ```

---

## Complete Plaintext JSON Schema Spec
When serialized, the plaintext vault payload matches the following schema:

```json
{
  "version": 3,
  "logins": [
    {
      "id": "uuid4-string",
      "title": "GitHub",
      "type": "login",
      "notes": "Work account details",
      "created_at": "ISO-8601-UTC-timestamp",
      "updated_at": "ISO-8601-UTC-timestamp",
      "username": "octocat",
      "password": "unencryptedPlaintextPassword",
      "url": "https://github.com",
      "totp_secret": "JBSWY3DPEHPK3PXP",
      "canonical_domain": "github.com",
      "match_domains": ["github.com"],
      "login_urls": ["https://github.com"],
      "preferred": true,
      "last_used": "ISO-8601-UTC-timestamp",
      "usage_count": 42
    }
  ],
  "passkeys": [
    {
      "id": "uuid4-string",
      "title": "Google (admin@corp.com)",
      "type": "passkey",
      "notes": "Enterprise Passkey",
      "created_at": "ISO-8601-UTC-timestamp",
      "updated_at": "ISO-8601-UTC-timestamp",
      "rp_id": "google.com",
      "rp_name": "Google",
      "credential_id": "base64url-encoded-id",
      "user_handle": "base64url-encoded-handle",
      "private_key": "base64-encoded-pem-data",
      "algorithm": -7,
      "sign_count": 12,
      "last_used": "ISO-8601-UTC-timestamp",
      "aaguid": "00000000-0000-0000-0000-000000000000",
      "transports": ["internal"]
    }
  ],
  "notes": [
    {
      "id": "uuid4-string",
      "title": "Wi-Fi Password",
      "type": "note",
      "notes": "Office network password is: secret123",
      "created_at": "ISO-8601-UTC-timestamp",
      "updated_at": "ISO-8601-UTC-timestamp"
    }
  ],
  "settings": {
    "auto_lock_enabled": false,
    "auto_lock_timeout": 15
  },
  "vault_metadata": {
    "vault_id": "stable-uuid4-string",
    "device_id": "fingerprint-string",
    "schema_hash": "sha256-string",
    "last_backup": "ISO-8601-UTC-timestamp",
    "integrity_verified_at": "ISO-8601-UTC-timestamp"
  }
}
```

---

## See Also
- [Vault](vault.md)
- [Adapter](adapter.md)
- [Totp](totp.md)
- [Config Reference](../../reference/config-reference.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*