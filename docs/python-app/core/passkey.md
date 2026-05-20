[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: passkey.py (WebAuthn Passkey Service)

## Purpose
The `passkey.py` module implements a software-based WebAuthn and FIDO2 authenticator lifecycle service. It enables the creation, storage, and assertion signing of passkeys directly within the localpass vault. 

It generates EC P-256 (SECP256R1) keys, serializes private keys using encrypted PKCS#8 PEM formats, packs public key structures in standard CBOR-compliant COSE formats, constructs WebAuthn `authenticatorData` and `attestationObject` streams, and generates ECDSA cryptographic signatures during WebAuthn assertion challenges.

## Location
`docs/python-app/core/passkey.md` (documenting `localpass/core/passkey.py`)

## Dependencies
- `cryptography` — ECDSA key generation, signing, and PEM serialization.
- `struct` — Big-endian byte-packing routines for binary structures.
- `base64` — Base64 and Base64url padding and encoding conversions.
- `localpass.core.entries.PasskeyEntry`, `VaultPayload`
- `localpass.core.audit.AuditEvent`, `get_audit_service`
- `localpass.core.domain_trust.DomainTrustService`

---

## Dataclass: CredentialCreationResponse
Standard response payload returned to the extension popup/dialog during passkey registration.

### Attributes
- `credential_id` (`str`): Base64url-encoded unique credential ID string.
- `public_key_cbor` (`bytes`): COSE-encoded public key bytes for relying party verification.
- `aaguid` (`str`): UUID-style identifier (all zeros for software authenticators).
- `attestation_object` (`bytes`): CBOR attestation object containing `fmt`, `attStmt`, and `authData`.
- `authenticator_data` (`bytes`): Raw byte buffer containing flags, signature count, and credential information.

---

## Dataclass: AssertionResponse
Response payload returned to the extension during passkey authentication (assertion challenge).

### Attributes
- `credential_id` (`str`): The unique credential ID.
- `authenticator_data` (`bytes`): Byte buffer containing flags and signature count.
- `client_data_hash` (`bytes`): SHA-256 hash of the client data challenge.
- `signature` (`bytes`): Cryptographic ECDSA signature bytes.
- `user_handle` (`str`): Base64url-encoded user ID.

---

## Class: PasskeyService
The core authenticator class coordinating FIDO2 operations.

### Constants
- `AAGUID` = `"00000000-0000-0000-0000-000000000000"`: AAGUID string (FIDO spec for software authenticators is all zeros).

### Methods

#### `create_credential(vault: VaultPayload, rp_id: str, rp_name: str, user_id: bytes, user_name: str, challenge: bytes, algorithms: Optional[List[int]] = None) -> tuple[CredentialCreationResponse, PasskeyEntry]`
Generates a new P-256 keypair, builds a `PasskeyEntry` for vault storage, and compiles a FIDO2 `CredentialCreationResponse` for browser registration.

*   **Parameters:**
    *   `vault` — `VaultPayload`: Decrypted vault instance.
    *   `rp_id` — `str`: Relying Party domain identifier (e.g. `"github.com"`).
    *   `rp_name` — `str`: Relying Party descriptive label (e.g. `"GitHub"`).
    *   `user_id` — `bytes`: Raw user identifier.
    *   `user_name` — `str`: User descriptive handle.
    *   `challenge` — `bytes`: Raw registration challenge.
    *   `algorithms` — `Optional[List[int]]`: Allowed signature algorithm IDs. Defaults to `[-7]` (ES256).
*   **Returns:** `tuple[CredentialCreationResponse, PasskeyEntry]` — Response payload and vault storage record.
*   **Called by:** `VaultAdapter.create_passkey`
*   **Calls:** `cryptography.hazmat.primitives.asymmetric.ec.generate_private_key`, `AuditService.log`
*   **Methodology:**
    1.  Generates a secure, 32-byte random credential ID.
    2.  Creates an EC P-256 private key and serializes it to PKCS#8 PEM format (base64-encoded for storage).
    3.  Packs the public key coordinates $x$ and $y$ into a standard 5-item COSE CBOR map:
        $$\text{COSE Map} = \{\text{kty}: \text{EC2}, \text{alg}: \text{ES256}, \text{crv}: \text{P-256}, \text{x}: x\text{-bytes}, \text{y}: y\text{-bytes}\}$$
    4.  Assembles the WebAuthn `authenticatorData` stream:
        $$\text{authData} = \text{SHA-256(rp\_id)} \mathbin{\Vert} \text{Flags (UP+UV+AT)} \mathbin{\Vert} \text{SignCount (0)} \mathbin{\Vert} \text{AAGUID} \mathbin{\Vert} \text{CredIDLen} \mathbin{\Vert} \text{CredID} \mathbin{\Vert} \text{COSE Key}$$
    5.  Builds the CBOR `attestationObject` using standard CBOR `none` formatting rules.
*   **Code Example:**
    ```python
    service = PasskeyService()
    response, entry = service.create_credential(
        vault=active_vault,
        rp_id="github.com",
        rp_name="GitHub",
        user_id=b"user_123",
        user_name="octocat",
        challenge=b"fido_challenge_bytes"
    )
    # The caller must save the entry to vault.passkeys
    active_vault.passkeys.append(entry)
    ```

---

#### `get_assertion(vault: VaultPayload, rp_id: str, challenge: bytes, credential_ids: Optional[List[str]] = None) -> Optional[AssertionResponse]`
Locates the matching credential inside the vault, increments the signature counter, and signs the WebAuthn challenge using the stored private key.

*   **Parameters:**
    *   `vault` — `VaultPayload`: Decrypted vault instance.
    *   `rp_id` — `str`: Relying Party domain identifier.
    *   `challenge` — `bytes`: Raw assertion challenge.
    *   `credential_ids` — `Optional[List[str]]`: Array of permitted credential IDs.
*   **Returns:** `Optional[AssertionResponse]` — Signature response, or `None` if no matching credentials exist.
*   **Called by:** `VaultAdapter.sign_passkey`
*   **Calls:** `PasskeyService._load_private_key`, `AuditService.log`
*   **Methodology:**
    1.  Queries the vault for passkey records matching the `rp_id` (enforcing exact string matching under Section 7.1 of the WebAuthn spec).
    2.  Loads the EC P-256 private key from PEM.
    3.  Increments `sign_count` by `1` and updates timestamps (important for replay attack prevention).
    4.  Assembles the assertion `authenticatorData` byte structure containing `rpIdHash`, flags (UP+UV), and the big-endian `sign_count`.
    5.  Computes the signature by hashing the challenge to get `client_data_hash`, then signs the combined byte buffer using ECDSA with SHA-256:
        $$\text{Signature} = \text{ECDSA-Sign}(\text{authData} \mathbin{\Vert} \text{SHA-256(challenge)})$$
*   **Code Example:**
    ```python
    assertion = service.get_assertion(
        vault=active_vault,
        rp_id="github.com",
        challenge=b"challenge_bytes_from_browser"
    )
    if assertion:
        print("Signature verified successfully:", assertion.signature)
    ```

---

#### `store_credential(vault: VaultPayload, entry: PasskeyEntry) -> None`
Appends a `PasskeyEntry` to the vault's passkeys list.

---

#### `find_credentials(vault: VaultPayload, rp_id: str) -> List[PasskeyEntry]`
Queries the vault for passkeys matching the requested Relying Party domain.
*   **Calls:** `DomainTrustService.match_rp_id`

---

#### `delete_credential(vault: VaultPayload, credential_id: str) -> bool`
Removes a passkey credential from the vault payload.
*   **Returns:** `bool` — `True` if deleted, `False` otherwise.

---

### Internal Helper Methods

#### `_load_private_key(private_key_b64: str) -> Optional[EllipticCurvePrivateKey]`
Deserializes the base64-encoded private key PEM string back into a cryptography EC private key object.

*   **Returns:** `Optional[EllipticCurvePrivateKey]`
*   **Calls:** `cryptography.hazmat.primitives.serialization.load_pem_private_key`

---

## Standalone Helper Functions

### `_cose_kv(key: int, value: bytes) -> bytes`
Helper function to generate basic CBOR/COSE key-value byte pairs.
*   **Parameters:**
    *   `key` — `int`: Target key.
    *   `value` — `bytes`: Target value buffer.
*   **Returns:** `bytes`

---

## See Also
- [Entries](entries.md)
- [Adapter](adapter.md)
- [Extension Architecture](../../architecture/extension-architecture.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*