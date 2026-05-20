[Home](../../../README.md) •
[Docs Index](../../index.md) •
[Quick Start](../../../QUICKSTART.md) •
[Glossary](../../reference/glossary.md)

---

# Module: domain_trust.py (Phishing-Resistant Domain Engine)

## Purpose
The `domain_trust.py` module implements a Public Suffix List (PSL) aware domain matching and security scoring engine. It is a critical layer for phishing prevention during automated form filling. 

Instead of using unsafe sub-string matches (e.g. searching if `"google.com"` is inside `"google.com.phishingsite.com"`), this module extracts and compares actual registered domains (eTLD+1) using `tldextract` (PSL-aware) or naive fallback systems. It calculates trust scores based on match precision, favorite status, usage frequency, and last-used recency.

## Location
`docs/python-app/core/domain_trust.md` (documenting `localpass/core/domain_trust.py`)

## Dependencies
- `tldextract` — Optional Public Suffix List (PSL) parser.
- `urllib.parse.urlparse` — Standard library URL structure parser.
- `dataclasses.dataclass`
- `enum.IntEnum`

---

## Enumeration: MatchLevel
An integer enum defining the precision of a credential match against an active website tab's domain.

| Enum Constant | Int Value | Semantic Meaning & Trigger |
| :--- | :--- | :--- |
| `NONE` | `0` | No structural relation. Autofill is forbidden. |
| `TITLE_FALLBACK` | `10` | The website base domain matches a keyword in the entry title (weak fallback). |
| `REGISTERED_DOMAIN` | `80` | Same registered domain (eTLD+1) but subdomains differ (e.g., `google.com` vs `accounts.google.com`). |
| `EXACT_HOST` | `95` | Exact match on hostname (e.g. `accounts.google.com` vs `accounts.google.com`). |
| `EXACT_RP_ID` | `100` | Exact WebAuthn Relying Party ID match (required for secure passkeys). |

---

## Class: MatchResult
A dataclass holding the results of a match evaluation.

### Properties
- `matched` (`bool`): `True` if any match criteria were satisfied.
- `level` (`MatchLevel`): The match level.
- `entry_domain` (`str`): Normalized hostname stored in the vault record.
- `query_domain` (`str`): Normalized hostname of the active browser page.
- `score` (`int`): Dynamically computed confidence score.
- `trust_score` (Property) -> `int`: Returns `score` if set, otherwise the integer value of `level`.

---

## Standalone Domain Extraction Helper Functions

### `_extract_registered_domain(hostname: str) -> str`
Extracts the registered domain (eTLD+1) from a raw hostname. Uses `tldextract` (PSL-aware) to identify complex double extensions (e.g., `"co.uk"`, `"com.au"`). Falls back to naive last-two-label extraction if the library is not installed.

$$\text{accounts.google.com} \xrightarrow{\text{PSL extraction}} \text{google.com}$$
$$\text{bbc.co.uk} \xrightarrow{\text{PSL extraction}} \text{bbc.co.uk}$$

*   **Parameters:**
    *   `hostname` — `str`: Raw input domain.
*   **Returns:** `str` — Extracted registered domain.
*   **Code Example:**
    ```python
    from localpass.core.domain_trust import _extract_registered_domain
    domain = _extract_registered_domain("sub.domain.co.uk")
    print(domain) # Output: domain.co.uk
    ```

---

### `_normalize_hostname(raw_url: str) -> Optional[str]`
Strips schemes, port numbers, query strings, and leading `www.` prefixes from raw URLs to return a clean, lowercase hostname.

*   **Parameters:**
    *   `raw_url` — `str`: Input string.
*   **Returns:** `Optional[str]` — Normalized domain, or `None` if invalid.
*   **Code Example:**
    ```python
    from localpass.core.domain_trust import _normalize_hostname
    print(_normalize_hostname("HTTP://WWW.GITHUB.COM/login?redir=true"))
    # Output: github.com
    ```

---

## Class: DomainTrustService

Provides the public interface for domain trust evaluations and WebAuthn validation.

### Methods

#### `normalize(url: str) -> Optional[str]`
*   **Parameters:**
    *   `url` — `str`: Raw input URL.
*   **Returns:** `Optional[str]` — The normalized hostname.

---

#### `registered_domain(hostname: str) -> str`
*   **Parameters:**
    *   `hostname` — `str`: Target hostname.
*   **Returns:** `str` — eTLD+1 domain.

---

#### `is_match(entry_url: str, query: str, entry_title: str = "") -> MatchResult`
Performs a phishing-resistant match check between an entry's URL and a query domain.

*   **Parameters:**
    *   `entry_url` — `str`: The URL stored in the vault entry.
    *   `query` — `str`: The active tab URL.
    *   `entry_title` — `str`: The title of the vault entry.
*   **Returns:** `MatchResult` with matched status and trust level.
*   **Calls:** `_normalize_hostname`, `_extract_registered_domain`
*   **Code Example:**
    ```python
    service = DomainTrustService()
    result = service.is_match(
        entry_url="https://accounts.google.com",
        query="https://google.com",
        entry_title="Google Account"
    )
    print(f"Matched: {result.matched}, Trust Level: {result.level.name}")
    # Matched: True, Trust Level: REGISTERED_DOMAIN
    ```

---

#### `match_rp_id(stored_rp_id: str, presented_rp_id: str) -> bool`
Validates passkey relying party IDs. Under Section 7.1 of the WebAuthn specification, this check **MUST** enforce exact string equality. Subdomain matching and suffix matching are strictly forbidden to prevent credential leakage.

*   **Parameters:**
    *   `stored_rp_id` — `str`: The RP ID saved in the passkey.
    *   `presented_rp_id` — `str`: The RP ID requested by the browser.
*   **Returns:** `bool` — `True` on exact case-insensitive match, `False` otherwise.
*   **Called by:** `PasskeyService.find_credentials`
*   **Code Example:**
    ```python
    ok = service.match_rp_id("github.com", "GITHUB.COM ")
    print("Match RP:", ok) # Output: True
    ```

---

#### `calculate_match_score(entry: any, query: str) -> MatchResult`
Calculates a precise, sortable trust score for a login entry against a query domain. Adjusts scores using security rules:
- **Baseline:** Derived from `MatchLevel` (`NONE=0`, `TITLE=10`, `REGISTERED=80`, `EXACT=95`).
- **Favorite / Preferred Bonus:** Add `+5` points if flagged as preferred.
- **Recency Bonus:** Add `+3` points if used within 24 hours, `+2` within a week, or `+1` within 30 days.
- **Frequency Bonus:** Add `+2` points if used $> 50$ times, or `+1` if used $> 10$ times.

*   **Parameters:**
    *   `entry` — `LoginEntry`: The target credential record.
    *   `query` — `str`: The active browser tab URL.
*   **Returns:** `MatchResult` containing the calculated score.
*   **Called by:** `VaultAdapter.find_by_domain`
*   **Code Example:**
    ```python
    result = service.calculate_match_score(my_login_entry, "github.com")
    print("Computed Trust Score:", result.trust_score)
    ```

---

#### `score_matches(results: list[MatchResult]) -> list[MatchResult]`
Sorts a list of `MatchResult` structures in descending order of their trust scores (highest confidence first).

*   **Parameters:**
    *   `results` — `list[MatchResult]`: List of results.
*   **Returns:** `list[MatchResult]` — Sorted list.
*   **Code Example:**
    ```python
    sorted_results = service.score_matches([res1, res2, res3])
    ```

---

## See Also
- [Adapter](adapter.md)
- [Domain](../../extension/utils/domain.md)
- [Glossary](../../reference/glossary.md)

---
*[Back to Docs Index](../../index.md) •
[Back to Top](#)*