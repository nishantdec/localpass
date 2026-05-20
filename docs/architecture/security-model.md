[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Comprehensive Security Model and Threat Analysis

This document details the security architecture, cryptographic parameter constraints, memory sanitization protocols, network isolation barriers, and threat modeling assessments for localpass.

---

## 1. Cryptographic Design and Parameter Specifications

localpass uses authenticated encryption to guarantee the confidentiality, integrity, and authenticity of credential data stored on disk and in transit.

### A. Key Derivation Function (KDF): Argon2id
To prevent offline hardware-accelerated brute-force attacks (such as those using custom ASICs or high-end GPUs), localpass implements the memory-hard **Argon2id** algorithm (conforming to RFC 9106):
*   **Hash Algorithm**: `Argon2id` (v=19)
*   **Time Cost (Iterations)**: `3`
*   **Memory Cost**: `65536` KB (64 MB)
*   **Parallelism**: `2` independent lanes
*   **Derived Key Length**: `32` bytes (256 bits)
*   **Salt Source**: `16` cryptographically secure random bytes generated per-vault via `os.urandom()`.

#### Brute-Force Feasibility
Because Argon2id requires memory-hard operations, brute-forcing attempts on standard modern GPU clusters are heavily constrained. A single verification iteration occupies exactly 64 MB of RAM and takes roughly ~300ms on server-grade hardware, meaning massive parallel execution (e.g. millions of hashes per second) is financially and physically infeasible.

### B. Authenticated Symmetric Encryption: AES-256-GCM
Credential storage and REST API message payloads are encrypted using **AES-256-GCM** (Advanced Encryption Standard in Galois/Counter Mode). This provides both confidentiality and authenticated integrity (AEAD), ensuring any alteration to the encrypted file or API payload is detected before decryption:
*   **Algorithm**: `AES-256-GCM`
*   **Key Size**: `256` bits (`32` bytes)
*   **Initialization Vector (Nonce)**: `12` bytes, generated per-encryption transaction using high-entropy system calls (`os.urandom()`). Nonces are never reused for a given key, eliminating replay vector risks.
*   **Authentication Tag**: `16` bytes (128 bits) proving that the ciphertext, nonce, and associated metadata were not tampered with since creation.

---

## 2. In-Memory Security and Sanitization Primitives

Garbage collection in high-level managed environments like CPython does not immediately overwrite discarded memory blocks. Deallocated string variables containing master keys or plaintext passwords can linger indefinitely in system RAM, exposing them to memory extraction attacks.

### A. SecureBuffer Context Management
To force the immediate destruction of sensitive key arrays, localpass encapsulates cryptographic variables within a custom Python class: `SecureBuffer`.

```python
class SecureBuffer:
    def __init__(self, data: bytes):
        self._buf = bytearray(data)

    def __enter__(self) -> bytearray:
        return self._buf

    def __exit__(self, *_) -> None:
        zero_bytes(self._buf)
```

### B. In-Place Zeroing via ctypes
The `zero_bytes()` utility bypasses Python’s internal memory manager by calling `ctypes.memset()` to overwrite the underlying buffer memory space directly with NULL bytes.

```python
def zero_bytes(buf: bytearray) -> None:
    if not buf:
        return
    try:
        ctypes.memset(
            (ctypes.c_char * len(buf)).from_buffer(buf),
            0,
            len(buf)
        )
    except Exception:
        # Last-resort fallback
        for i in range(len(buf)):
            buf[i] = 0
```
When `SessionManager.lock()` or `_zero_key()` is called, all key variables are immediately scrubbed, leaving no trace of the derived AES key in memory.

---

## 3. Network Isolation and Daemon Security Boundaries

The background daemon operates as a local HTTP API to handle credential filling. Security constraints are applied to prevent external processes from accessing the credentials.

### A. Loopback Binding Constraint
The local HTTP server strictly binds to the loopback interface IP `127.0.0.1` at port `27432`. It does not listen on `0.0.0.0` or other network interfaces. Consequently, the socket interface rejects all connections originating outside the local machine.

### B. Dynamic CORS and Origin Validation
To prevent unauthorized web pages from querying the API, the HTTP server dynamically validates the `Origin` header of every incoming request against a strict allowlist matching the Chrome/Edge extension identifier:
```python
# Server-side validation check
origin = headers.get('Origin', '')
if not origin.startswith('chrome-extension://'):
    return 403_Forbidden
```

### C. Handshake & Header-Based Token Authorization
All data-sensitive endpoints (`/credentials`, `/fill`, `/entries`) enforce session-token verification. 
1. **Initial Handshake**: The extension calls `POST /handshake` during launch. If the vault is unlocked, the server returns a cryptographically secure, random 32-byte hexadecimal session token.
2. **Subsequent API Requests**: The extension must supply this session token in the `X-NL-Token` header. The server compares this token using constant-time evaluation (`hmac.compare_digest`), rejecting any request that does not present a valid, active session token.

---

## 4. Threat Model and Risk Assessment

This threat model outlines the security guarantees of localpass and documents its known architectural limitations.

### A. Protected Against (Guaranteed Protections)

| Threat Vector | Attack Scenario | Mitigation Strategy |
|:---|:---|:---|
| **Stolen Vault File** | An attacker steals the physical `vault.nlk` file from disk. | The vault is encrypted with AES-256-GCM. Brute-forcing the master key is thwarted by Argon2id iterations, which require 64MB of RAM per attempt. |
| **Memory Scraping after Lock** | Malware reads the RAM of the Python process after the TUI has been locked by the user. | During locking, `SessionManager` invokes `ctypes.memset` to immediately zero the key bytes. No plaintext key material remains in memory. |
| **LAN Network Interception** | An attacker on the same local network attempts to intercept server traffic or send malicious commands. | The server binds to `127.0.0.1` only. Network cards block local loopback sockets from external routing. No network traffic leaves the machine. |
| **Malicious Extension Scans** | A separate untrusted browser extension attempts to read all passwords via the API. | The local server restricts CORS origins to the specific localpass extension ID. Furthermore, requests must present the active 32-byte session token. |
| **Browser Form Poisoning** | A malicious website attempts to scrape all stored credentials by requesting the full database. | Plaintext passwords are never exposed via `/credentials` or popup views. Decrypted passwords are only fetched one-by-one via POST `/fill` when specifically clicked by the user. |

### B. NOT Protected Against (Known Architectural Boundaries)

The following threat vectors cannot be mitigated by localpass and represent risks that the host environment must secure:

*   **OS Keyloggers**: If malware with keyboard hook permissions is active on the host machine, it can log the Master Password as it is entered into the console during unlock.
*   **In-Memory Malware (During Unlock)**: If malware with root/Administrator permissions is running concurrently with an active, unlocked localpass session, it can inspect the process memory heap of the running Python application to extract plaintext credentials.
*   **Compromised Browser Extension Sandbox**: If an attacker installs a malicious extension that compromises the browser's extension storage or hooks the `chrome.runtime` message interface, they can intercept credentials or spoof autofill inputs.
*   **Weak Master Password**: If the user configures a simple or dictionary-based master password, the vault is vulnerable to offline dictionary/rule-based brute-force attacks on the stolen `.nlk` database.
*   **Unsecured Backups**: If the user configures settings to export unencrypted vault backups to external shared drives or public cloud storage directories, the confidentiality of the credentials relies entirely on the security of those target directories.

---

## See Also
- [Architecture Overview](overview.md)
- [Data Flow](data-flow.md)
- [Extension Architecture](extension-architecture.md)
- [System Overview Diagram](diagrams/system-overview.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*