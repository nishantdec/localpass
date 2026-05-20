[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# localpass Vault File Format Specification

This document provides a low-level structural reference for the localpass encrypted storage format. It defines the JSON envelope schema, the legacy binary layout, the decryption pipeline, and the schema of the decrypted plaintext JSON payload.

---

## The Modern JSON Envelope Format

Modern versions of localpass (v2 and v3) store the vault as a text-serialized JSON envelope. This design preserves critical metadata in cleartext (such as Argon2id key derivation parameters, nonces, and salts) while keeping the payload entirely encrypted.

### Structure of the Envelope JSON

```json
{
  "schema_version": 1,
  "vault_id": "8f2d59ac-b49d-4e92-a160-cf91b29a28cd",
  "version": 3,
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "kdf_params": {
    "time_cost": 3,
    "memory_cost": 65536,
    "parallelism": 2,
    "hash_len": 32,
    "type": "Argon2id"
  },
  "device_id": "d820fe2a-14d2-4328-98e2-9bca2c29bc90",
  "created_at": "2026-05-20T05:30:00.123456+00:00",
  "updated_at": "2026-05-20T11:15:32.987654+00:00",
  "nonce": "e3JkZjhnbjJkM2hnZDRtNH0=",
  "salt": "aThoMnM4ZDFoNmsyOTNocw==",
  "payload_hash": "4a7fb880b91e921d7b00ca32cfb5bc78ea1fbe4d9ee756c8ab7e01d1cfbe29a2",
  "payload": "TmV2ZXIgZ29ubmEgZ2l2ZSB5b3UgdXAsIG5ldmVyIGdvbm5hIGxldCB5b3UgZG93biwgbmV2ZXIgZ29ubmEgcnVuIGFyb3VuZCBhbmQgZGVzZXJ0IHlvdSE="
}
```

### Envelope Field Definitions

- **`schema_version`** *(integer, required)*: The version of the outer envelope metadata layout itself. Currently fixed at `1`.
- **`vault_id`** *(string/UUID, required)*: A stable, randomly generated UUIDv4 assigned during vault initialization. It remains constant across saves to uniquely identify the vault profile.
- **`version`** *(integer, required)*: The internal schema version of the decrypted plaintext payload. Used to trigger the database migration system (`localpass/core/migrations.py`). Currently `3`.
- **`cipher`** *(string, required)*: The symmetric algorithm and block mode used to encrypt the payload. Fixed to `"AES-256-GCM"`.
- **`kdf`** *(string, required)*: The key derivation function. Fixed to `"Argon2id"`.
- **`kdf_params`** *(object, required)*: Configuration parameters governing the execution complexity of Argon2id KDF:
  - `time_cost` *(integer)*: Number of passes over memory. Default: `3`.
  - `memory_cost` *(integer)*: Memory usage in Kibibytes (KB). Default: `65536` (64 MB).
  - `parallelism` *(integer)*: Maximum execution threads. Default: `2`.
  - `hash_len` *(integer)*: Output byte length of the derived key. Default: `32` (256 bits).
  - `type` *(string)*: Argon2 type descriptor. Fixed to `"Argon2id"`.
- **`device_id`** *(string/UUID, required)*: A persistent UUID linked to the local machine's fingerprint, identifying where the vault was last written.
- **`created_at`** *(string, required)*: ISO 8601 UTC timestamp detailing when the vault profile was initialized.
- **`updated_at`** *(string, required)*: ISO 8601 UTC timestamp detailing when the vault was last modified.
- **`nonce`** *(string/Base64, required)*: A Base64-encoded representation of the 12-byte initialization vector used for this specific encryption pass.
- **`salt`** *(string/Base64, required)*: A Base64-encoded representation of the 16-byte random salt used during KDF key derivation.
- **`payload_hash`** *(string/Hex, required)*: Hex-encoded `HMAC-SHA256` of the binary ciphertext calculated using the derived key. Used as an envelope-level integrity check before triggering decryption.
- **`payload`** *(string/Base64, required)*: Base64-encoded ciphertext payload containing the AES-256-GCM encrypted JSON vault records.

---

## Legacy Binary Format Layout

Legacy versions of localpass utilized a raw binary format rather than a JSON envelope. The server automatically detects, parses, decrypts, and immediately upgrades legacy files to the modern JSON envelope layout upon first successful unlock.

### Binary Layout Structure

```
Offset  Size    Field           Description
──────  ──────  ──────────────  ────────────────────────────
0       4       Magic bytes     Always b'NLLK' (0x4E4C4C4B)
4       1       Version         Currently 1 (0x01)
5       16      Salt            Random bytes for Argon2id KDF
21      12      Nonce           Random bytes for AES-256-GCM initialization
33      N       Ciphertext      AES-256-GCM encrypted JSON payload
33+N    16      GCM Tag         Galois authentication tag
```

---

## Decryption Pipeline

To decrypt either a JSON envelope or legacy binary vault, the following workflow is executed:

```
┌────────────────────────────────────────────────────────────┐
│                    Master Password Input                   │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                  Parse salt & KDF params                   │
│   - Salt (Base64 decoded) or legacy binary offset [5..20]   │
│   - KDF Parameters (Argon2id settings from JSON envelope)   │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│              Derive Key using Argon2id                     │
│  derive_key(password, salt, time_cost, memory_cost, etc)  │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│         HMAC Integrity Verification (If present)           │
│  verify_hmac = HMAC-SHA256(derived_key, binary_ciphertext) │
│  Validate against "payload_hash" via constant-time compare │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                 Decrypt AES-256-GCM                        │
│  plaintext = AES-GCM-Decrypt(derived_key, nonce,           │
│                              ciphertext + GCM Tag)         │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                 Parse UTF-8 Plaintext                      │
│   Parse decrypted bytes as structured JSON. If corrupt,    │
│   throw VaultCorruptionError but preserve forensic bytes.  │
└────────────────────────────────────────────────────────────┘
```

### Steps in the Decryption Pipeline

1. **Read Magic Bytes**: Open the vault file. Check the first 4 bytes.
   - If they match `b'NLLK'` (0x4E4C4C4B), execute the legacy decryption logic:
     - Read the salt at offset 5 (16 bytes).
     - Read the nonce at offset 21 (12 bytes).
     - Read the raw payload starting at offset 33. The final 16 bytes are extracted as the GCM Tag.
     - Derivation uses default KDF parameters.
   - If they do not match `b'NLLK'`, parse the file as a JSON envelope:
     - Base64-decode the `salt`, `nonce`, and `payload` values.
     - Extract `kdf_params` from the JSON.
2. **Derive Key**: Invoke Argon2id key derivation using `cryptography` or `argon2-cffi`:
   ```python
   key = argon2.low_level.hash_secret_raw(
       secret=master_password.encode("utf-8"),
       salt=salt,
       time_cost=time_cost,
       memory_cost=memory_cost,
       parallelism=parallelism,
       hash_len=32,
       type=argon2.low_level.Type.ID
   )
   ```
3. **Verify Integrity**: If the vault is in JSON envelope format, extract the `payload_hash` string. Recompute the HMAC using the derived key and the binary ciphertext:
   ```python
   actual_hash = hmac.new(key, ciphertext, hashlib.sha256).hexdigest()
   if not hmac.compare_digest(actual_hash, stored_hash):
       raise VaultIntegrityError("Tampering or corruption detected")
   ```
4. **AES-GCM Decrypt**: Decrypt the binary ciphertext using the derived 256-bit key and the 12-byte nonce:
   ```python
   aesgcm = AESGCM(key)
   plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
   ```
5. **Parse and Validate**: Convert `plaintext_bytes` to a UTF-8 string and parse as JSON. If parsing fails, raise a `VaultCorruptionError` to preserve the raw decrypted bytes for manual forensic recovery, preventing data loss.

---

## Plaintext JSON Schema Specification

Once successfully decrypted, the plaintext is represented as a structured JSON object.

### Complete Plaintext Schema

```json
{
  "version": 3,
  "logins": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "login",
      "title": "GitHub",
      "username": "user@email.com",
      "password": "plaintext_password_hunter2",
      "url": "https://github.com",
      "totp_secret": "JBSWY3DPEHPK3PXP",
      "canonical_domain": "github.com",
      "match_domains": [
        "github.com"
      ],
      "login_urls": [
        "https://github.com"
      ],
      "preferred": true,
      "last_used": "2026-05-20T05:30:00Z",
      "usage_count": 14,
      "notes": "Work account info",
      "created_at": "2026-05-20T01:15:00Z",
      "updated_at": "2026-05-20T05:30:00Z"
    }
  ],
  "passkeys": [
    {
      "id": "782cd9fa-1234-5678-abcd-ef0123456789",
      "type": "passkey",
      "title": "Google Account Passkey",
      "notes": "Biometric credentials",
      "rp_id": "google.com",
      "rp_name": "Google LLC",
      "credential_id": "Y3JlZGVudGlhbC1pZC1zdHJpbmc=",
      "user_handle": "dXNlci1oYW5kbGUtc3RyaW5n",
      "private_key": "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...",
      "algorithm": -7,
      "sign_count": 8,
      "last_used": "2026-05-20T05:45:00Z",
      "aaguid": "00000000-0000-0000-0000-000000000000",
      "transports": ["internal"],
      "created_at": "2026-05-20T01:30:00Z",
      "updated_at": "2026-05-20T05:45:00Z"
    }
  ],
  "notes": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "note",
      "title": "WiFi Password",
      "notes": "SSID: HomeNet, Pass: 1234567890",
      "created_at": "2026-05-20T01:00:00Z",
      "updated_at": "2026-05-20T01:00:00Z"
    }
  ],
  "settings": {
    "auto_lock_minutes": 15,
    "clipboard_clear_seconds": 15
  },
  "vault_metadata": {
    "vault_id": "8f2d59ac-b49d-4e92-a160-cf91b29a28cd",
    "device_id": "d820fe2a-14d2-4328-98e2-9bca2c29bc90",
    "schema_hash": "2ef7bde608ce9eac2139bc9001f308ce7a8fbc29",
    "last_backup": "2026-05-20T05:30:00Z",
    "integrity_verified_at": "2026-05-20T05:30:00Z"
  }
}
```

---

## Field Specifications

### Core Data Models

#### `version` *(integer, required)*
The schema definition version of this decrypted payload object. Used to apply migrations. Fixed at `3`.

#### `settings` *(object, required)*
Global vault settings object containing user preferences:
- `auto_lock_minutes` *(integer)*: Inactivity timeout duration in minutes before locking.
- `clipboard_clear_seconds` *(integer)*: Duration in seconds before the clipboard is automatically cleared.

---

### `logins` Array Elements

- **`id`** *(string/UUID, required)*: Cryptographically secure UUIDv4 identifying this specific entry.
- **`type`** *(string, required)*: Fixed to `"login"` or `"totp_only"`.
- **`title`** *(string, required)*: User-assigned name for this record.
- **`username`** *(string, optional)*: The user credential login identifier (e.g. email or username).
- **`password`** *(string, optional)*: The plaintext password associated with the entry.
- **`url`** *(string, optional)*: The raw webpage or service URL saved by the user.
- **`totp_secret`** *(string, optional)*: The Base32-encoded private seed used to calculate TOTP codes.
- **`canonical_domain`** *(string, optional)*: The extracted registered domain (e.g. `google.com`) derived from the raw URL. Set to `null` if parsing fails.
- **`match_domains`** *(array of strings, required)*: Domain variations pre-calculated by the normalization engine to match incoming autofill queries (e.g., `["accounts.google.com", "google.com"]`).
- **`login_urls`** *(array of strings, required)*: Deduped list of alternative URLs matching this entry.
- **`preferred`** *(boolean, required)*: If `true`, the entry is boosted in matching score results. Default: `false`.
- **`last_used`** *(string, optional)*: ISO 8601 timestamp indicating when the credential was last filled or copied.
- **`usage_count`** *(integer, required)*: Monotonically increasing count tracking credential usage.
- **`notes`** *(string, optional)*: User-assigned raw notes.
- **`created_at`** *(string, required)*: ISO 8601 creation timestamp.
- **`updated_at`** *(string, required)*: ISO 8601 modification timestamp.

---

### `passkeys` Array Elements

- **`id`** *(string/UUID, required)*: Cryptographically secure UUIDv4 identifying this record.
- **`type`** *(string, required)*: Fixed to `"passkey"`.
- **`title`** *(string, required)*: User-assigned name for this passkey.
- **`notes`** *(string, optional)*: Optional user notes.
- **`rp_id`** *(string, required)*: Relying Party Identifier (matches the domain of the registering service, e.g. `github.com`).
- **`rp_name`** *(string, optional)*: Relying Party Name (human-readable service name, e.g., `GitHub`).
- **`credential_id`** *(string/Base64URL, required)*: Base64url-encoded unique identifier for this public key credential.
- **`user_handle`** *(string/Base64URL, required)*: Base64url-encoded user identifier provided by the Relying Party.
- **`private_key`** *(string/Base64, required)*: Base64-encoded encrypted representation of the private key structure (PEM or COSE CBOR format).
- **`algorithm`** *(integer, required)*: COSE algorithm parameter mapping (e.g. `-7` for ES256, `-257` for RS256).
- **`sign_count`** *(integer, required)*: A monotonically increasing counter representing usage frequency.
- **`last_used`** *(string, optional)*: ISO 8601 timestamp tracking last assertion signature.
- **`aaguid`** *(string/UUID, required)*: Authenticator Attestation Globally Unique Identifier. Software authenticators default to all zeroes.
- **`transports`** *(array of strings, required)*: Supported WebAuthn physical transports (e.g., `["internal"]`, `["usb"]`, etc.).
- **`created_at`** *(string, required)*: ISO 8601 creation timestamp.
- **`updated_at`** *(string, required)*: ISO 8601 modification timestamp.

---

### `notes` Array Elements

- **`id`** *(string/UUID, required)*: Cryptographically secure UUIDv4 identifying this record.
- **`type`** *(string, required)*: Fixed to `"note"`.
- **`title`** *(string, required)*: Human-readable header/title.
- **`notes`** *(string, required)*: The actual encrypted content of the secure note.
- **`created_at`** *(string, required)*: ISO 8601 creation timestamp.
- **`updated_at`** *(string, required)*: ISO 8601 modification timestamp.

---

### `vault_metadata` Schema Elements

- **`vault_id`** *(string/UUID, required)*: UUIDv4 assigned to the vault profiles.
- **`device_id`** *(string, required)*: UUID mapping the vault provenance record to a physical system.
- **`schema_hash`** *(string, required)*: SHA1 hash representing the schema definitions version.
- **`last_backup`** *(string, optional)*: ISO 8601 timestamp of last successful backup.
- **`integrity_verified_at`** *(string, optional)*: ISO 8601 timestamp of the last database integrity check.

---

## See Also
- [Local Server Api](local-server-api.md)
- [Message Passing Api](message-passing-api.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*