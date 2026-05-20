[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: local_server.py

The `local_server.py` module implements a local loopback HTTP server bridge that enables the browser extension to interact with the decrypted vault. It implements strict CORS validations, a challenge-response handshake sequence, rate limiting, and session token checks to safeguard credentials from unauthorized access.

> [!WARNING]
> **DEPRECATION NOTICE:** The HTTP loopback server bridge is deprecated. New installations should use Chrome Native Messaging (`com.localpass.host`). This server remains active for backward compatibility and legacy transport fallback.

## Location
`server/local_server.py`

---

## Security Architecture & API Transactions

```text
  Browser Extension                 local_server.py (HTTP)
        │                                    │
        ├───[1. POST /handshake (challenge)]─► Rate Limit Check (Passed)
        │                                    │ Consume Nonce
        │                                    │ Compute HMAC Signature
        ◄───[2. Response (token + response)]─┤
        │                                    │
        │====[ Subsequent Requests with X-NL-Token ]====
        │                                    │
        ├───[3. POST /credentials (domain)]──► Validate X-NL-Token
        │                                    │ Fetch Matching Entry
        ◄───[4. Response (credential list)]──┤
```

### CORS Protection Rules
CORS headers are restricted to validated browser extension origins:
*   Only schemes matching `chrome-extension://` or `moz-extension://` are allowed.
*   No wildcard (`*`) origin is ever returned.
*   If no specific extension ID is registered during setup, the server falls back to returning `"null"` to support initial developer connections, before tightening to the verified extension ID.

### Challenge-Response Handshake
To prevent cross-site request forgery (CSRF) or unauthenticated token theft, the `/handshake` route requires a challenge exchange:
1.  The extension POSTs a unique 32-byte hexadecimal `challenge`.
2.  The server consumes this challenge nonce in the `SessionManager` to prevent replay attacks.
3.  The server generates an API `token` and signs the `challenge` using HMAC-SHA256 with the token as the signing key:
    $$\text{response} = \text{HMAC-SHA256}_{\text{token}}(\text{challenge})$$
4.  The server returns the `token` and `response` signature. The extension verifies the signature to confirm the server's authenticity before saving the session token.

### Rate Limiting
Handshake exchanges are throttled to mitigate denial-of-service (DoS) or brute-force attacks:
*   **Capacity:** Max 5 handshake attempts per 60-second sliding window per unique IP address.
*   **Failure Behavior:** Returns HTTP status `429 Too Many Requests` when limits are exceeded.

---

## Endpoints Catalog

All POST endpoints (except `/handshake`) must supply a valid authentication token in the request headers:
```text
X-NL-Token: <session_token_hex>
```

### 1. GET `/ping`
Checks health and vault lock status.
*   **Response (200 OK):**
```json
{
  "status": "ok",
  "locked": false
}
```

### 2. POST `/handshake`
Challenge-response authentication exchange to authenticate the extension and exchange session keys.
*   **Request Payload:**
```json
{
  "challenge": "0123456789abcdef0123456789abcdef"
}
```
*   **Response (200 OK):**
```json
{
  "token": "a0b1c2d3...",
  "response": "e4f5g6h7..."
}
```
*   **Common Errors:** `401 Unauthorized` (vault locked), `400 Bad Request` (replayed nonce), `429 Too Many Requests` (rate limited).

### 3. POST `/credentials`
Queries the vault for logins matching the active tab's domain. Uses public suffix list (PSL) domain matching to prevent phishing attacks.
*   **Request Payload:**
```json
{
  "domain": "github.com"
}
```
*   **Response (200 OK):**
```json
[
  {
    "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140",
    "title": "GitHub",
    "username": "octocat",
    "type": "login",
    "has_totp": true,
    "url": "https://github.com/login",
    "preferred": true,
    "last_used": 1716183894.204
  }
]
```

### 4. POST `/search`
Performs a global search query across the unlocked vault.
*   **Request Payload:**
```json
{
  "query": "git"
}
```
*   **Response (200 OK):** Array of matching entry summaries (similar to `/credentials` structure).

### 5. POST `/entries`
Creates a new login entry in the vault.
*   **Request Payload:**
```json
{
  "title": "GitHub Profile",
  "username": "octocat",
  "password": "correcthorsebatterystaple",
  "url": "https://github.com",
  "type": "login",
  "totp_secret": "JBSWY3DPEHPK3PXP"
}
```
*   **Response (200 OK):**
```json
{
  "success": true,
  "id": "8f830a3b-285c-4be5-9f5b-11884cd9c011"
}
```

### 6. POST `/entry`
Retrieves full details of a specific vault entry (excluding the decrypted password and TOTP secret).
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140"
}
```
*   **Response (200 OK):**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140",
  "title": "GitHub",
  "username": "octocat",
  "url": "https://github.com/login",
  "type": "login",
  "has_totp": true,
  "notes": "Developer account notes.",
  "preferred": true,
  "last_used": 1716183894.204,
  "usage_count": 14
}
```

### 7. POST `/entries/update`
Updates an existing vault entry.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140",
  "title": "GitHub Updated",
  "username": "new_octocat"
}
```
*   **Response (200 OK):** `{"success": true}` or `{"error": "entry_not_found"}` (404).

### 8. POST `/entries/delete`
Permanently deletes an entry from the vault.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140"
}
```
*   **Response (200 OK):** `{"success": true}` or `{"error": "entry_not_found"}` (404).

### 9. POST `/totp`
Generates the current 6-digit TOTP code and returns the remaining validity duration.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140"
}
```
*   **Response (200 OK):**
```json
{
  "code": "520194",
  "seconds_remaining": 14
}
```

### 10. POST `/copy`
Copies a password or TOTP code directly to the host system clipboard. The clipboard is automatically cleared after a delay (default 15 seconds) to prevent credential exposure.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140",
  "field": "password" // Or "totp"
}
```
*   **Response (200 OK):**
```json
{
  "success": true
}
```

### 11. POST `/fill`
Retrieves plaintext username and password credentials for form-filling.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140"
}
```
*   **Response (200 OK):**
```json
{
  "username": "octocat",
  "password": "correcthorsebatterystaple"
}
```

### 12. POST `/passkeys`
Lists FIDO2 passkeys matching the requested Relying Party ID.
*   **Request Payload:**
```json
{
  "rp_id": "github.com"
}
```
*   **Response (200 OK):**
```json
{
  "ok": true,
  "passkeys": [
    {
      "id": "a0e1c2...",
      "title": "GitHub Passkey",
      "rp_id": "github.com",
      "credential_id": "base64_credential_id",
      "last_used": 1716183894.204,
      "sign_count": 3
    }
  ]
}
```

### 13. POST `/passkeys/register`
Saves a new WebAuthn credential in the vault.
*   **Request Payload:**
```json
{
  "rp_id": "github.com",
  "rp_name": "GitHub Inc",
  "user_id_b64": "base64_user_id",
  "user_name": "octocat",
  "challenge_b64": "base64_challenge"
}
```
*   **Response (200 OK):**
```json
{
  "success": true,
  "credential": {
    "credential_id": "base64_id",
    "public_key": "base64_pem",
    "aaguid": "0000..."
  }
}
```

### 14. POST `/passkeys/sign`
Signs an assertion challenge using a matching passkey.
*   **Request Payload:**
```json
{
  "rp_id": "github.com",
  "challenge_b64": "base64_challenge",
  "credential_ids": ["base64_id_1", "base64_id_2"]
}
```
*   **Response (200 OK):**
```json
{
  "success": true,
  "assertion": {
    "credential_id": "base64_id",
    "signature": "base64_sig",
    "authenticator_data": "base64_auth_data",
    "client_data_json": "base64_client_data"
  }
}
```

### 15. POST `/increment_usage`
Increments the usage frequency count for an entry.
*   **Request Payload:**
```json
{
  "id": "c2b578c2-40ff-4e78-9502-4fb34e12c140"
}
```
*   **Response (200 OK):** `{"success": true}` or `{"error": "entry_not_found"}` (404).

---

## Dependencies
*   `http.server` — Standard Python `HTTPServer` and `BaseHTTPRequestHandler` framework.
*   `hmac` and `hashlib` — Generates and verifies challenge-response HMACs.
*   `threading` — Spawns the HTTP listener on an isolated background thread.
*   `json` — Encodes and decodes JSON request and response payloads.
*   `localpass.core.adapter.VaultAdapter` — Decoupled interface to query vault data.
*   `localpass.core.auth.SessionManager` — Manages keys, nonces, and tokens.

---

## Working Code Example

Below is a complete test script using the `requests` library to demonstrate authentication and query operations against the local HTTP server:

```python
import hmac
import hashlib
import requests

SERVER_URL = "http://127.0.0.1:27432"

def test_api_handshake():
    print("=== Testing Local Server API Handshake ===")
    
    # 1. Generate challenge
    challenge_nonce = "0123456789abcdef0123456789abcdef"
    
    # 2. POST challenge to /handshake
    try:
        res = requests.post(
            f"{SERVER_URL}/handshake",
            json={"challenge": challenge_nonce},
            timeout=3
        )
        if res.status_code == 429:
            print("Status: Throttled by rate limiter (429).")
            return
        elif res.status_code == 401:
            print("Status: Handshake failed. Vault is locked.")
            return
        
        data = res.json()
        token = data["token"]
        signature = data["response"]
        
        # 3. Verify server authenticity
        expected_sig = hmac.new(
            token.encode("utf-8"),
            challenge_nonce.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if hmac.compare_digest(signature, expected_sig):
            print("Verification Success: Server authenticity verified!")
            print(f"Session Token: {token}")
        else:
            print("Verification FAILED: Signature mismatch!")
            
    except requests.exceptions.ConnectionError:
        print("Status: Server is offline. Start the server from the TUI to test.")

if __name__ == "__main__":
    test_api_handshake()
```

---

## See Also
- [Local Server Api](../../api/local-server-api.md)
- [Host](../native-host/host.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*