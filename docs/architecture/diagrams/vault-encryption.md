[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Cryptographic Key Derivation and Vault Encryption Pipeline

This document details the cryptographic pipeline utilized by localpass to derive symmetric keys from user master credentials and package decrypted vault databases into authenticated, encrypted envelopes.

---

## 1. Complete Cryptographic Data Flow

The following ASCII diagram illustrates the two distinct processes: **Key Derivation Flow** and **Symmetric Encryption/Packaging Flow**.

```text
========================================================================================
PART A: KEY DERIVATION FLOW (Argon2id KDF)
========================================================================================

  Master Password ("hunter2") [UTF-8 String]
       │
       ▼
  .encode("utf-8")
       │
       ▼
  [Plaintext Bytes] ──┐
                      ▼
  Argon2id low-level KDF Hash Engine <─── Salt (16 Cryptographically Random Bytes)
       │ (Low-level C Bindings)
       ├─────────────────────────────── KDF Parameters (3 Iterations, 64MB RAM, 2 Lanes)
       ▼
  Derived Master Key (256-bit / 32-bytes) ──> Loaded into in-memory SecureBuffer
                                                  │
                                                  ▼
                                            [Derived Key]
                                                  │
                                                  ▼
========================================================================================
PART B: ENCRYPTION AND PACKAGING FLOW (AES-256-GCM + HMAC-SHA256 Integrity Verification)
========================================================================================
                                                  │
  Plaintext JSON Payload                          │
  (Logins, Notes, Passkeys)                       │
       │                                          │
       ▼                                          │
  .encode("utf-8")                                │
       │                                          │
       ▼                                          │
  [Plaintext Bytes]                               │
       │                                          │
       ▼                                          │
  AES-256-GCM Encryption Engine <─────────────────┼─ [Derived Key]
       │                                          │
       ├──────────────────────────────────────────┼─ Nonce (12 Random Bytes per save)
       ▼                                          │
  ┌───────────────────────────────────────┐       │
  │ Ciphertext Bytes + 16-byte GCM Tag    │       │
  └──────────────────┬────────────────────┘       │
                     │                            │
                     ├──────────> HMAC-SHA256 <───┘ (Integrity Signature)
                     │                 │
                     ▼                 ▼
             b64encode(Cipher)    HexDigest(HMAC)
                     │                 │
                     ▼                 ▼
               [payload]        [payload_hash]
                     │                 │
                     ▼                 ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                        JSON ENVELOPE (On Disk)                         │
  │  - "schema_version": 1                                                 │
  │  - "vault_id": UUID4                                                   │
  │  - "cipher": "AES-256-GCM"                                             │
  │  - "kdf": "Argon2id"                                                   │
  │  - "nonce": Base64String (12-byte Nonce)                               │
  │  - "salt": Base64String (16-byte Salt)                                 │
  │  - "payload": Base64String (Ciphertext + 16-byte Tag)                  │
  │  - "payload_hash": HexString (HMAC Integrity Tag)                      │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decryption and Verification Flow

When loading a vault, the reverse flow is executed with multiple validation checks to ensure integrity:

```text
                       ┌─────────────────────────┐
                       │ Read JSON Envelope File │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │ Extract Salt and Nonce  │
                       │   (base64 decode)       │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │   Derive 32-byte Key    │
                       │ via Argon2id using salt │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │   Payload Hash Match    │
                       │ (HMAC-SHA256 Match)?    ├─[NO]─> Raise VaultIntegrityError
                       └────────────┬────────────┘
                                    │ [YES]
                                    ▼
                       ┌─────────────────────────┐
                       │  AES-256-GCM Decrypt    │
                       │   (Check Tag Integrity) ├─[NO]─> Raise InvalidMasterPassword
                       └────────────┬────────────┘
                                    │ [YES]
                                    ▼
                       ┌─────────────────────────┐
                       │ Parse Plaintext UTF-8   │
                       │      JSON Payload       ├─[NO]─> Raise VaultCorruptionError
                       └────────────┬────────────┘
                                    │ [YES]
                                    ▼
                       ┌─────────────────────────┐
                       │ Execute DB Migrations   │
                       │ (Upgrade schema version)│
                       └────────────┬────────────┘
                                    │
                                    ▼
                        [VaultPayload Object Ready]
```

---

## 3. Cryptographic Step Details

### A. Integrity Validation via HMAC-SHA256
Before passing ciphertext to the AES decryption interface, localpass computes a secondary integrity signature of the raw ciphertext bytes using the derived master key:
$$\text{payload\_hash} = \text{HMAC-SHA256}(\text{Key} = \text{DerivedKey}, \text{Message} = \text{CiphertextBytes})$$
*   **Tamper Resistance**: By performing a constant-time comparison (`hmac.compare_digest`) between the calculated hash and the `payload_hash` in the envelope, the client can detect disk-level corruption or active unauthorized payload manipulation *before* executing CPU-intensive decryption.

### B. AES-256-GCM AEAD Mode
localpass implements authenticated encryption using Galois/Counter Mode:
*   **Confidentiality**: The data is encrypted using standard AES counter mode.
*   **Authenticity**: An internal 16-byte Galois GHASH tag is computed during encryption. During decryption, the cryptographic hardware/driver recomputes this tag and compares it to the appended 16-byte tag.
*   **Behavior**: If even a single bit of the ciphertext, nonce, or salt is altered, tag verification fails and raises an `InvalidTag` exception. In localpass, this is caught and mapped to `InvalidMasterPassword`, as a wrong password derives a wrong key, resulting in a tag mismatch.

### C. Atomic Write Protocol (`_write_atomic`)
To prevent vault corruption from power failures or crashes mid-save:
1.  **Temporary File**: The updated JSON envelope is written to a temporary file in the same directory (`vault.nlk.tmp`).
2.  **Force Flush**: The OS is commanded to flush physical disks (`os.replace` or `f.flush()` + `os.fsync()`).
3.  **Atomic Rename**: The system atomic file swap replaces the old `vault.nlk` with the temp file in a single file-system clock cycle.

---

## See Also
- [System Overview Diagram](system-overview.md)
- [Autofill Flow Diagram](autofill-flow.md)
- [Extension Communication Diagram](extension-communication.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*