"""
NorthLocker — domain_trust.py
==============================
PSL-aware domain matching for autofill and passkey RP ID validation.

Replaces ad-hoc contains() / base_domain() matching in adapter.py and
local_server.py with a proper, phishing-resistant implementation.

Design:
- Uses tldextract for Public Suffix List (PSL) aware registered domain extraction
- Falls back to simple two-label split if tldextract is unavailable
- Exact registered-domain equality only (no substring / contains matching)
- Passkey RP ID matching uses exact string equality per WebAuthn spec
- Trust scoring provides sortable confidence for multiple matches
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import IntEnum
from typing import Optional
from urllib.parse import urlparse

try:
    import tldextract
    _HAS_TLDEXTRACT = True
except ImportError:
    _HAS_TLDEXTRACT = False


# ---------------------------------------------------------------------------
# Match types & result
# ---------------------------------------------------------------------------

class MatchLevel(IntEnum):
    NONE = 0
    TITLE_FALLBACK = 10        # domain label found in entry title (weakest)
    REGISTERED_DOMAIN = 80     # same eTLD+1 (google.com == accounts.google.com)
    EXACT_HOST = 95            # exact hostname match
    EXACT_RP_ID = 100          # exact WebAuthn RP ID match (passkeys)


@dataclass
class MatchResult:
    matched: bool
    level: MatchLevel
    entry_domain: str = ""
    query_domain: str = ""
    score: int = 0

    @property
    def trust_score(self) -> int:
        return self.score or int(self.level)


# ---------------------------------------------------------------------------
# Domain extraction helpers
# ---------------------------------------------------------------------------

def _extract_registered_domain(hostname: str) -> str:
    """
    Return the eTLD+1 (registered domain) for a hostname.
    e.g. accounts.google.com → google.com, bbc.co.uk → bbc.co.uk

    Uses tldextract when available (PSL-aware).
    Falls back to naive two-label extraction.
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


# ---------------------------------------------------------------------------
# DomainTrustService
# ---------------------------------------------------------------------------

class DomainTrustService:
    """
    Phishing-resistant domain matching for autofill.

    Rules (in order of precedence):
    1. Exact hostname match → EXACT_HOST
    2. Same registered domain (eTLD+1) → REGISTERED_DOMAIN
    3. Title fallback (entry title contains base label) → TITLE_FALLBACK
    4. No match → NONE

    Intentionally NOT implemented (phishing prevention):
    - substring / contains() matching on full URL
    - partial hostname suffix matching without PSL
    """

    def normalize(self, url: str) -> Optional[str]:
        """Return the normalized hostname for a URL or bare domain."""
        return _normalize_hostname(url)

    def registered_domain(self, hostname: str) -> str:
        """Return the eTLD+1 for a hostname."""
        return _extract_registered_domain(hostname)

    def is_match(
        self,
        entry_url: str,
        query: str,
        entry_title: str = "",
    ) -> MatchResult:
        """
        Check whether an entry's URL matches a query domain.

        Args:
            entry_url:   The URL stored in the vault entry.
            query:       The domain/URL from the browser (active tab).
            entry_title: Entry title, used as a last-resort fallback.

        Returns:
            MatchResult with matched=True/False and a trust level.
        """
        query_host = _normalize_hostname(query)
        entry_host = _normalize_hostname(entry_url)

        if not query_host:
            return MatchResult(matched=False, level=MatchLevel.NONE)

        if entry_host:
            # Level 1: Exact hostname equality
            if query_host == entry_host:
                return MatchResult(
                    matched=True,
                    level=MatchLevel.EXACT_HOST,
                    entry_domain=entry_host,
                    query_domain=query_host,
                )

            # Level 2: Same registered domain (eTLD+1)
            query_reg = _extract_registered_domain(query_host)
            entry_reg = _extract_registered_domain(entry_host)
            if query_reg and entry_reg and query_reg == entry_reg:
                return MatchResult(
                    matched=True,
                    level=MatchLevel.REGISTERED_DOMAIN,
                    entry_domain=entry_host,
                    query_domain=query_host,
                )

        # Level 3: Title fallback
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

        return MatchResult(matched=False, level=MatchLevel.NONE)

    def match_rp_id(self, stored_rp_id: str, presented_rp_id: str) -> bool:
        """
        Passkey / WebAuthn RP ID matching.
        Per WebAuthn spec (§ 7.1): MUST be exact string equality.
        No subdomain matching, no suffix matching.
        """
        if not stored_rp_id or not presented_rp_id:
            return False
        return stored_rp_id.lower().strip() == presented_rp_id.lower().strip()

    def calculate_match_score(self, entry: any, query: str) -> MatchResult:
        """
        Calculate trust score for a LoginEntry against a query domain.
        """
        query_host = _normalize_hostname(query)
        if not query_host:
            return MatchResult(matched=False, level=MatchLevel.NONE)

        level = MatchLevel.NONE
        entry_host = _normalize_hostname(entry.url) if getattr(entry, "url", None) else None

        if entry_host and query_host == entry_host:
            level = MatchLevel.EXACT_HOST
        elif getattr(entry, "canonical_domain", None) and _extract_registered_domain(query_host) == entry.canonical_domain:
            match_domains = getattr(entry, "match_domains", [])
            if query_host in match_domains:
                level = MatchLevel.EXACT_HOST if query_host == entry_host else MatchLevel.REGISTERED_DOMAIN
            else:
                level = MatchLevel.REGISTERED_DOMAIN
        elif getattr(entry, "title", None):
            query_reg = _extract_registered_domain(query_host)
            base_label = query_reg.split(".")[0] if query_reg else query_host.split(".")[0]
            if base_label and base_label in entry.title.lower():
                level = MatchLevel.TITLE_FALLBACK

        if level == MatchLevel.NONE:
            return MatchResult(matched=False, level=MatchLevel.NONE)

        score = int(level)

        if getattr(entry, "preferred", False):
            score += 5

        last_used = getattr(entry, "last_used", None)
        if last_used:
            try:
                import datetime
                dt = datetime.datetime.fromisoformat(last_used.replace("Z", "+00:00"))
                delta = datetime.datetime.now(datetime.timezone.utc) - dt
                if delta.days <= 1:
                    score += 3
                elif delta.days <= 7:
                    score += 2
                elif delta.days <= 30:
                    score += 1
            except Exception:
                pass

        usage_count = getattr(entry, "usage_count", 0)
        if usage_count > 50:
            score += 2
        elif usage_count > 10:
            score += 1

        return MatchResult(
            matched=True,
            level=level,
            entry_domain=entry_host or "",
            query_domain=query_host,
            score=score
        )

    def score_matches(self, results: list[MatchResult]) -> list[MatchResult]:
        """Sort a list of MatchResults by trust score, highest first."""
        return sorted(results, key=lambda r: r.trust_score, reverse=True)
