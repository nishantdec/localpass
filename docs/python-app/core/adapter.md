[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: adapter.py (VaultAdapter Service)

## Purpose
The `adapter.py` module defines the `VaultAdapter` class. It acts as a clean, stateless interface layer decoupling the presentation layer (TUI client) and loopback HTTP server from the underlying raw data persistence operations and cryptographic tasks. 

By separating these layers, `VaultAdapter` prevents imports of global application state (like `app_instance`) and ensures all actions verify authentication, sanitise inputs, evaluate domain risks using `DomainTrustService`, and audit sensitive tasks.

## Location
`docs/python-app/core/adapter.md` (documenting `localpass/core/adapter.py`)

## Dependencies
- `localpass.core.entries.Entry`, `LoginEntry`, `NoteEntry`, `PasskeyEntry`, `VaultPayload`
- `localpass.core.domain_trust.DomainTrustService`, `MatchLevel`
- `localpass.core.audit.AuditEvent`, `get_audit_service`
- `localpass.core.totp.get_totp_info`
- `localpass.utils.clipboard.copy_to_clipboard`
- `localpass.utils.paths.get_vault_path`
- `localpass.core.vault.save_vault`

---

## Class: VaultAdapter

### `__init__(session, get_vault: Callable[[], Optional[VaultPayload]])`
Initialises the stateless adapter with a session manager and a callable to fetch the active decrypted vault payload.

*   **Parameters:**
    *   `session` — `SessionManager` (or compatible): The session manager handling the derived Master Password key.
    *   `get_vault` — `Callable[[], Optional[VaultPayload]]`: A zero-argument callable returning the active decrypted payload, or `None` if locked.
*   **Returns:** `None`
*   **Called by:**
    *   `server/local_server.py` during server initialization.
    *   `localpass/ui/app.py` when building the TUI application environment.
*   **Calls:** Internal assignments.
*   **Code Example:**
    ```python
    from localpass.core.adapter import VaultAdapter
    from localpass.core.auth import SessionManager
    
    session = SessionManager()
    def get_vault_callback():
        return active_payload # VaultPayload instance or None
        
    adapter = VaultAdapter(session, get_vault_callback)
    ```

---

### `is_locked` (Property) -> `bool`
Returns whether the vault or session is in a locked state.

*   **Returns:** `bool` — `True` if locked, `False` if unlocked and payload is accessible.
*   **Called by:** Presentation screens (`dashboard.py`, `entry_view.py`), server router.
*   **Code Example:**
    ```python
    if adapter.is_locked:
        print("Vault is locked! Cannot query credentials.")
    ```

---

### `_vault()` -> `Optional[VaultPayload]`
Internal helper that retrieves the decrypted vault payload if the session is unlocked.

*   **Returns:** `Optional[VaultPayload]` — The loaded decrypted payload structure, or `None`.
*   **Called by:** Internal `VaultAdapter` methods.
*   **Code Example:**
    ```python
    payload = adapter._vault()
    if payload is None:
        raise RuntimeError("Vault is locked.")
    ```

---

### `find_by_domain(domain: str) -> List[Entry]`
Retrieves credentials and passkeys that match the query domain, sorted in descending order of phishing trust.

*   **Parameters:**
    *   `domain` — `str`: The target hostname or URL to query (e.g., `"github.com"`).
*   **Returns:** `List[Entry]` — A list of matched login entries or passkey entries, sorted by trust level.
*   **Called by:** `server/local_server.py` (`/credentials` endpoint), `content.js` autofill queries.
*   **Calls:** `DomainTrustService.calculate_match_score`
*   **Code Example:**
    ```python
    matches = adapter.find_by_domain("https://accounts.google.com")
    for entry in matches:
        print(f"Match: {entry.title} - Username: {getattr(entry, 'username', '')}")
    ```

---

### `increment_usage(entry_id: str) -> bool`
Increments the usage frequency metrics and timestamps on logins and passkeys inside the vault.

*   **Parameters:**
    *   `entry_id` — `str`: UUID4 of the targeted entry.
*   **Returns:** `bool` — `True` if the entry was found and updated, `False` otherwise.
*   **Called by:** Loopback server after form fills, TUI views after manual reveal or copying.
*   **Calls:** `VaultAdapter._save`
*   **Code Example:**
    ```python
    success = adapter.increment_usage("a3e5e4d2-7cba-4df3-a123-cd890ab212ef")
    ```

---

### `search(query: str) -> List[Entry]`
Performs a case-insensitive full-text search across all logins, notes, and passkeys inside the vault.

*   **Parameters:**
    *   `query` — `str`: The search string. Matches against title, username, url, and passkey RP ID.
*   **Returns:** `List[Entry]` — Filtered list of matching entries. If query is empty, returns all records.
*   **Called by:** `SearchScreen` in TUI, popup search page in the extension.
*   **Code Example:**
    ```python
    results = adapter.search("github")
    print(f"Found {len(results)} matches for 'github'.")
    ```

---

### `get_entry(entry_id: str) -> Optional[Entry]`
Retrieves a single entry by its unique identifier.

*   **Parameters:**
    *   `entry_id` — `str`: The entry's UUID4 string.
*   **Returns:** `Optional[Entry]` — The requested record or `None` if not found.
*   **Called by:** `/fill` loopback endpoint, `EntryViewScreen`, `EntryEditScreen`.
*   **Code Example:**
    ```python
    entry = adapter.get_entry("b1e2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    if entry:
        print(f"Viewing: {entry.title}")
    ```

---

### `create_entry(title: str, username: str = "", password: str = "", url: str = "", entry_type: str = "login", totp_secret: str = "", notes: str = "") -> str`
Creates a new login, TOTP-only, or secure note entry, normalises URLs, calculates matching domains, audits creation, and saves vault changes.

*   **Parameters:**
    *   `title` — `str`: Human-readable label.
    *   `username` — `str`: Account username (for logins).
    *   `password` — `str`: Plaintext password.
    *   `url` — `str`: Website address (for logins).
    *   `entry_type` — `str`: `"login"`, `"totp_only"`, or `"note"`.
    *   `totp_secret` — `str`: Base32 secret string for 2FA.
    *   `notes` — `str`: Multi-line text commentary.
*   **Returns:** `str` — The UUID4 assigned to the newly created entry.
*   **Called by:** `EntryNewScreen` in TUI, popup save form in extension.
*   **Calls:** `DomainTrustService.normalize`, `DomainTrustService.registered_domain`, `AuditService.log`, `VaultAdapter._save`
*   **Code Example:**
    ```python
    new_id = adapter.create_entry(
        title="GitLab",
        username="dev_user",
        password="superSafePassword123!",
        url="https://gitlab.com",
        entry_type="login",
        totp_secret="JBSWY3DPEHPK3PXP"
    )
    print(f"Created login record with ID: {new_id}")
    ```

---

### `update_entry(entry_id: str, **fields) -> bool`
Modifies an existing login or secure note inside the vault. Performs domain updates if URLs change.

*   **Parameters:**
    *   `entry_id` — `str`: The target record UUID4.
    *   `**fields` — Variable keyword parameters. Allowed keys: `title`, `username`, `password`, `url`, `entry_type`, `totp_secret` (`"__REMOVE__"` to delete), `notes`, `preferred`, `match_domains`, `login_urls`.
*   **Returns:** `bool` — `True` if update was successfully performed, `False` otherwise.
*   **Called by:** `EntryEditScreen` in TUI, extension edit modal.
*   **Calls:** `DomainTrustService.normalize`, `DomainTrustService.registered_domain`, `AuditService.log`, `VaultAdapter._save`
*   **Code Example:**
    ```python
    success = adapter.update_entry(
        entry_id="b1e2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        password="MyBrandNewSecurePassword456!",
        url="https://new-gitlab-domain.com"
    )
    ```

---

### `delete_entry(entry_id: str) -> bool`
Deletes an entry (login, note, or passkey) from the decrypted payload and persists the changes.

*   **Parameters:**
    *   `entry_id` — `str`: The targeted record UUID4.
*   **Returns:** `bool` — `True` if successfully deleted, `False` if not found.
*   **Called by:** `EntryViewScreen` TUI command, extension popup list row context menu.
*   **Calls:** `AuditService.log`, `VaultAdapter._save`
*   **Code Example:**
    ```python
    deleted = adapter.delete_entry("b1e2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    ```

---

### `find_passkeys(rp_id: str) -> List[PasskeyEntry]`
Queries the vault for stored WebAuthn passkey credentials matching the relying party (RP) domain.

*   **Parameters:**
    *   `rp_id` — `str`: Relying Party Identifier hostname (e.g. `"github.com"`).
*   **Returns:** `List[PasskeyEntry]` — Matching passkeys.
*   **Called by:** Extension WebAuthn assertion handlers.
*   **Calls:** `PasskeyService.find_credentials`
*   **Code Example:**
    ```python
    passkeys = adapter.find_passkeys("github.com")
    ```

---

### `create_passkey(rp_id: str, rp_name: str, user_id_b64: str, user_name: str, challenge_b64: str) -> dict`
Generates a secure cryptographic EC P-256 keypair, creates a passkey registration payload, and stores the record.

*   **Parameters:**
    *   `rp_id` — `str`: Relying Party ID.
    *   `rp_name` — `str`: Relying Party descriptive label.
    *   `user_id_b64` — `str`: Base64url-encoded user ID.
    *   `user_name` — `str`: User descriptive handle (email / name).
    *   `challenge_b64` — `str`: Base64url-encoded FIDO challenge.
*   **Returns:** `dict` — Standard WebAuthn creation structure containing `credential_id`, `public_key_cbor` (base64 encoded), `aaguid`, `attestation_object`, and `authenticator_data`.
*   **Called by:** Extension service worker during WebAuthn `navigator.credentials.create` hooks.
*   **Calls:** `PasskeyService.create_credential`, `PasskeyService.store_credential`, `VaultAdapter._save`
*   **Code Example:**
    ```python
    reg_response = adapter.create_passkey(
        rp_id="github.com",
        rp_name="GitHub Inc.",
        user_id_b64="b2N0b2NhdA",
        user_name="octocat",
        challenge_b64="aGFzaF9jaGFsbGVuZ2VfZm9yX2ZpZG8"
    )
    print("Passkey Registered:", reg_response["credential_id"])
    ```

---

### `sign_passkey(rp_id: str, challenge_b64: str, credential_ids: Optional[List[str]] = None) -> Optional[dict]`
Locates an eligible WebAuthn credential in the vault and signs the assertion challenge using the P-256 private key.

*   **Parameters:**
    *   `rp_id` — `str`: Relying Party ID.
    *   `challenge_b64` — `str`: Base64url-encoded challenge bytes.
    *   `credential_ids` — `Optional[List[str]]`: Array of permissible credential IDs.
*   **Returns:** `Optional[dict]` — Signature structure (`credential_id`, `authenticator_data`, `client_data_hash`, `signature`, `user_handle`) or `None`.
*   **Called by:** Extension background worker during `navigator.credentials.get` operations.
*   **Calls:** `PasskeyService.get_assertion`, `VaultAdapter._save`
*   **Code Example:**
    ```python
    assertion = adapter.sign_passkey(
        rp_id="github.com",
        challenge_b64="Y2hhbGxlbmdlX2Fzc2VydGlvbl9kYXRh",
        credential_ids=["a3e5e4d2..."]
    )
    if assertion:
        print("FIDO Assertion Signature:", assertion["signature"])
    ```

---

### `generate_totp(totp_secret: str) -> tuple[str, int]`
Generates a real-time, 6-digit Time-based One-Time Password token.

*   **Parameters:**
    *   `totp_secret` — `str`: Standard base32 encoded seed secret.
*   **Returns:** `tuple[str, int]` — The formatted 6-digit code string (e.g. `"123456"`) and the integer seconds remaining until rotation.
*   **Called by:** TUI `TUITOTPDisplay`, popup detail card interface.
*   **Calls:** `localpass.core.totp.get_totp_info`
*   **Code Example:**
    ```python
    code, seconds_left = adapter.generate_totp("JBSWY3DPEHPK3PXP")
    print(f"Code: {code} (expires in {seconds_left}s)")
    ```

---

### `copy_to_clipboard(value: str, clear_seconds: int = 15) -> None`
Saves plain-text secrets to the operating system's clipboard stack, scheduling a background thread to purge it after timeout.

*   **Parameters:**
    *   `value` — `str`: Plaintext value to write.
    *   `clear_seconds` — `int`: Time in seconds before clearing clipboard. Defaults to `15`.
*   **Returns:** `None`
*   **Called by:** `EntryViewScreen` bindings, popup detail fields.
*   **Calls:** `localpass.utils.clipboard.copy_to_clipboard`, `AuditService.log`
*   **Code Example:**
    ```python
    adapter.copy_to_clipboard("correcthorsebatterystaple", clear_seconds=10)
    print("Copied to clipboard. Will be securely cleared in 10 seconds.")
    ```

---

### `_save(vault: VaultPayload) -> None`
Internal persistence wrapper that securely derives atomic writes to the vault path.

*   **Parameters:**
    *   `vault` — `VaultPayload`: Payload structure to encrypt.
*   **Returns:** `None`
*   **Called by:** Internal write tasks (`create_entry`, `update_entry`, `delete_entry`).
*   **Calls:** `localpass.core.vault.save_vault`
*   **Code Example:**
    ```python
    adapter._save(vault)
    ```

---

## See Also
- [Vault](vault.md)
- [Entries](entries.md)
- [Domain Trust](domain_trust.md)
- [Unlock Providers](unlock_providers.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*