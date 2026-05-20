[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# localpass Local HTTP Daemon API Specification

The local Python application exposes a HTTP daemon server running on the localhost loopback address (`127.0.0.1:27432`) to bridge vault operations to the browser extension Service Worker. 

All communications are restricted by custom Origin policies and use a dynamic handshake protocol to authorize transactions.

---

## Connection Security & CORS Policy

To prevent unauthorized local websites from invoking vault commands, the server strictly restricts Cross-Origin Resource Sharing (CORS).
- **Access-Control-Allow-Origin:** Dynamically validated. Only allows `chrome-extension://<EXTENSION_ID>` or `moz-extension://<EXTENSION_ID>` matching the registered extension. If no ID is registered, it allows only `"null"` during initial setup.
- **Access-Control-Allow-Headers:** Strictly limited to `Content-Type` and `X-NL-Token`.
- **Allowed Methods:** `GET, POST, OPTIONS`.
- **Wildcard Policy:** Under no circumstances is `*` accepted as a valid origin.

---

## API Endpoint Catalog

---

### GET /ping

**Purpose:** Health check. Confirms the server is running and the vault is currently unlocked.

**Authentication:** None required.

**Request:** No body.

**Response 200 (Vault Unlocked):**
```json
{
  "status": "ok",
  "locked": false
}
```

**Response 200 (Vault Locked):**
```json
{
  "status": "ok",
  "locked": true
}
```

**curl test command:**
```bash
curl -s http://127.0.0.1:27432/ping
```

**Handler location:** `server/local_server.py` lines 137–138
**Handler function:** `do_GET()`
**Called by:** `background.js` PING case

---

### POST /handshake

**Purpose:** Executes a challenge-response verification exchange to obtain a temporary secure Session Token. Prevents local token theft by forcing the client extension to sign its query using HMAC-SHA256.

**Authentication:** None required (Rate limited to 5 attempts per 60 seconds per IP address).

**Request:**
```json
{
  "challenge": "8f898ab7ce58c281df6bb6fa076c48ee8a89b708cfbe28c89b70e7e4812fce0a"
}
```
*Note: `challenge` must be a cryptographically secure hex string of at least 32 bytes (64 characters).*

**Response 200:**
```json
{
  "token": "d7a42b10f2c45e8b60682fa0761aefee8e12f60ad7bc28c23eef1284cfbe29c0",
  "response": "4a7fb880b91e921d7b00ca32cfb5bc78ea1fbe4d9ee756c8ab7e01d1cfbe29a2"
}
```
*Note: `response` is the hex digest of `HMAC-SHA256(key=token_bytes, msg=challenge_bytes)` proving the server's authenticity before the extension caches the token.*

**Response 400 (Challenge Required/Invalid):**
```json
{
  "error": "challenge_required"
}
```

**Response 400 (Nonce Replayed):**
```json
{
  "error": "nonce_replayed"
}
```

**Response 401 (Vault Locked):**
```json
{
  "error": "vault_locked"
}
```

**Response 429 (Rate Limited):**
```json
{
  "error": "rate_limited"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/handshake \
  -H "Content-Type: application/json" \
  -d '{"challenge":"8f898ab7ce58c281df6bb6fa076c48ee8a89b708cfbe28c89b70e7e4812fce0a"}'
```

**Handler location:** `server/local_server.py` lines 173–208
**Handler function:** `_handle_handshake()`
**Called by:** `background.js` `httpHandshake()`

---

### POST /credentials

**Purpose:** Fetches visual summaries of vault entries matching a requested target domain. Plaintext passwords are **never** returned by this endpoint.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "domain": "github.com"
}
```

**Response 200:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "GitHub",
    "username": "user@email.com",
    "type": "login",
    "has_totp": true,
    "url": "https://github.com",
    "preferred": true,
    "last_used": "2026-05-20T05:30:00Z"
  }
]
```

**Response 400 (Domain Required):**
```json
{
  "error": "domain_required"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/credentials \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"domain": "github.com"}'
```

**Handler location:** `server/local_server.py` lines 212–229
**Handler function:** `_handle_credentials()`
**Called by:** `background.js` GET_CREDENTIALS case

---

### POST /search

**Purpose:** Full-text search across all vault login entries, secure notes, and stored passkeys.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "query": "github"
}
```

**Response 200:** Array of entry descriptors (same schema as `/credentials`).

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/search \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"query": "github"}'
```

**Handler location:** `server/local_server.py` lines 231–245
**Handler function:** `_handle_search()`
**Called by:** `background.js` SEARCH case

---

### POST /entries

**Purpose:** Create a new credential entry (login, totp_only, or note) inside the vault.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "title": "GitHub",
  "username": "user@email.com",
  "password": "hunter2",
  "url": "https://github.com",
  "type": "login",
  "totp_secret": "JBSWY3DPEHPK3PXP"
}
```

**Response 200:**
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/entries \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"title":"GitHub","username":"user@email.com","password":"hunter2","url":"https://github.com","type":"login"}'
```

**Handler location:** `server/local_server.py` lines 247–259
**Handler function:** `_handle_entries_create()`
**Called by:** `background.js` SAVE_ENTRY case

---

### POST /entry

**Purpose:** Retrieves full, descriptive details for a single entry by ID. Does **not** expose plaintext passwords or private keys.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "GitHub",
  "username": "user@email.com",
  "url": "https://github.com",
  "type": "login",
  "has_totp": true,
  "notes": "Work account info",
  "preferred": true,
  "last_used": "2026-05-20T05:30:00Z",
  "usage_count": 12,
  "rp_id": "",
  "rp_name": "",
  "credential_id": "",
  "sign_count": 0
}
```

**Response 400 (ID Required):**
```json
{
  "error": "id_required"
}
```

**Response 404 (Entry Not Found):**
```json
{
  "error": "entry_not_found"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/entry \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Handler location:** `server/local_server.py` lines 261–285
**Handler function:** `_handle_entry()`
**Called by:** `background.js` GET_ENTRY case

---

### POST /entries/update

**Purpose:** Updates fields of an existing login entry or secure note.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "GitHub Updated",
  "notes": "New work account notes"
}
```

**Response 200:**
```json
{
  "success": true
}
```

**Response 404 (Entry Not Found):**
```json
{
  "error": "entry_not_found"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/entries/update \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000", "title": "GitHub Updated"}'
```

**Handler location:** `server/local_server.py` lines 287–301
**Handler function:** `_handle_entry_update()`
**Called by:** `background.js` UPDATE_ENTRY case

---

### POST /entries/delete

**Purpose:** Delete a vault entry by ID.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "success": true
}
```

**Response 404 (Entry Not Found):**
```json
{
  "error": "entry_not_found"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/entries/delete \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Handler location:** `server/local_server.py` lines 303–311
**Handler function:** `_handle_entry_delete()`
**Called by:** `background.js` DELETE_ENTRY case

---

### POST /totp

**Purpose:** Dynamically generate the active TOTP passcode and fetch the remaining validation timeframe for an entry.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "code": "489201",
  "seconds_remaining": 18
}
```

**Response 404 (TOTP Secret Missing/Entry Invalid):**
```json
{
  "error": "entry_not_found_or_no_totp"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/totp \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Handler location:** `server/local_server.py` lines 313–322
**Handler function:** `_handle_totp()`
**Called by:** `background.js` GET_TOTP case

---

### POST /copy

**Purpose:** Fetches the password or TOTP, copies it to the system clipboard, and registers a temporary automated 15-second background wipe worker to protect memory.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "field": "password"
}
```
*Note: `field` must be either `"password"` or `"totp"`.*

**Response 200:**
```json
{
  "success": true
}
```

**Response 400 (Bad request or missing parameters):**
```json
{
  "error": "id_and_field_required"
}
```

**Response 404 (Entry Not Found):**
```json
{
  "error": "entry_not_found"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/copy \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id":"550e8400-e29b-41d4-a716-446655440000", "field":"password"}'
```

**Handler location:** `server/local_server.py` lines 324–342
**Handler function:** `_handle_copy()`
**Called by:** `background.js` COPY case

---

### POST /fill

**Purpose:** Fetches the plaintext credentials (username and password) to perform direct autofilling. Only invoked when the user selects a specific entry to fill on the active page.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "username": "user@email.com",
  "password": "plaintext_password_hunter2"
}
```

**Response 400 (ID Required):**
```json
{
  "error": "id_required"
}
```

**Response 404 (Entry Not Found):**
```json
{
  "error": "entry_not_found"
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "unauthorized"
}
```

**curl test command:**
```bash
curl -s -X POST http://127.0.0.1:27432/fill \
  -H "Content-Type: application/json" \
  -H "X-NL-Token: YOUR_SESSION_TOKEN" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Handler location:** `server/local_server.py` lines 344–357
**Handler function:** `_handle_fill()`
**Called by:** `background.js` GET_FILL case

---

### POST /passkeys

**Purpose:** Fetches a list of passkeys associated with a Relying Party (RP) ID.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "rp_id": "github.com"
}
```

**Response 200:**
```json
{
  "ok": true,
  "passkeys": [
    {
      "id": "passkey-uuid",
      "title": "GitHub Passkey",
      "rp_id": "github.com",
      "credential_id": "base64url-id",
      "last_used": "2026-05-20T05:30:00Z",
      "sign_count": 4
    }
  ]
}
```

**Handler location:** `server/local_server.py` lines 359–374
**Handler function:** `_handle_passkeys()`

---

### POST /passkeys/register

**Purpose:** Registers a new WebAuthn credential in the vault.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "rp_id": "github.com",
  "rp_name": "GitHub",
  "user_id_b64": "base64-user-id",
  "user_name": "user@email.com",
  "challenge_b64": "base64url-challenge"
}
```

**Response 200:**
```json
{
  "success": true,
  "credential": {
    "credential_id": "base64url-id",
    "public_key_cbor": "base64-cbor",
    "aaguid": "00000000-0000-0000-0000-000000000000",
    "attestation_object": "base64-attestation",
    "authenticator_data": "base64-authdata"
  }
}
```

**Handler location:** `server/local_server.py` lines 376–390
**Handler function:** `_handle_passkeys_register()`

---

### POST /passkeys/sign

**Purpose:** Signs a WebAuthn challenge for authentication.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "rp_id": "github.com",
  "challenge_b64": "base64url-challenge",
  "credential_ids": ["base64url-id"]
}
```

**Response 200:**
```json
{
  "success": true,
  "assertion": {
    "credential_id": "base64url-id",
    "authenticator_data": "base64-authdata",
    "client_data_hash": "base64-hash",
    "signature": "base64-sig",
    "user_handle": "base64-handle"
  }
}
```

**Handler location:** `server/local_server.py` lines 392–406
**Handler function:** `_handle_passkeys_sign()`

---

### POST /increment_usage

**Purpose:** Increments the usage metadata count and updates the last used timestamp of a login or passkey entry.

**Authentication:** Requires valid Session Token in `X-NL-Token` header.

**Request:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200:**
```json
{
  "success": true
}
```

**Handler location:** `server/local_server.py` lines 408–414
**Handler function:** `_handle_increment_usage()`

---

## Domain Matching Algorithm

The `DomainTrustService` (`localpass/core/domain_trust.py`) determines if an entry matches the active tab's domain. It strips subdomains (including `www.`), utilizes the Public Suffix List (PSL) via the `tldextract` library, and falls back to a custom two-label parser if unavailable.

### Exact Extraction and Base Stripping Code

```python
def _normalize_hostname(raw_url: str) -> Optional[str]:
    """Extract and normalize the hostname from a URL or bare domain."""
    if not raw_url:
        return None

    raw = raw_url.lower().strip()

    # Strip scheme if missing so urlparse works
    if "://" not in raw:
        raw = "https://" + raw

    try:
        parsed = urlparse(raw)
        hostname = (parsed.hostname or "").strip()
        # Remove www. prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname or None
    except Exception:
        return None
```

```python
def _extract_registered_domain(hostname: str) -> str:
    """
    Return the eTLD+1 (registered domain) for a hostname.
    e.g. accounts.google.com → google.com, bbc.co.uk → bbc.co.uk
    """
    if not hostname:
        return ""

    hostname = hostname.lower().strip()

    if _HAS_TLDEXTRACT:
        try:
            result = tldextract.extract(hostname)
            if result.domain and result.suffix:
                return f"{result.domain}.{result.suffix}"
            return hostname
        except Exception:
            pass

    # Naive fallback: last two labels
    parts = [p for p in hostname.split(".") if p]
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return hostname
```

### Trust Scoring & Title Fallback Matching

If exact host matching (`EXACT_HOST`) or registered domain matching (`REGISTERED_DOMAIN`) do not identify an entry, the server falls back to title matching:

```python
        # Last-resort level: Title fallback
        if entry_title:
            query_reg = _extract_registered_domain(query_host)
            base_label = query_reg.split(".")[0] if query_reg else query_host.split(".")[0]
            if base_label and base_label in entry_title.lower():
                return MatchResult(
                    matched=True,
                    level=MatchLevel.TITLE_FALLBACK,
                    entry_domain=entry_host or "",
                    query_domain=query_host,
                )
```

The trust levels are prioritized as:
1. `EXACT_RP_ID` (100) — Exact WebAuthn RP ID match (for passkeys).
2. `EXACT_HOST` (95) — Exact hostname equality.
3. `REGISTERED_DOMAIN` (80) — eTLD+1 matching (PSL-aware).
4. `TITLE_FALLBACK` (10) — Stored entry title contains the base domain label.

Modifiers are then applied to calculate the final sortable `trust_score`:
- `preferred = True`: Adds **+5** points.
- Recency of usage (`last_used` ISO timestamp):
  - Used within 1 day: Adds **+3** points.
  - Used within 7 days: Adds **+2** points.
  - Used within 30 days: Adds **+1** point.
- Total frequency of usage (`usage_count`):
  - Count > 50: Adds **+2** points.
  - Count > 10: Adds **+1** point.

---

## See Also
- [Message Passing Api](message-passing-api.md)
- [Vault File Format](vault-file-format.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*