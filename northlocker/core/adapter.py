"""
NorthLocker — adapter.py
=========================
VaultAdapter: clean interface between the server/UI and vault data.

Changes from previous version:
- Removed global app_instance coupling — receives SessionManager + vault getter via DI
- Uses DomainTrustService for phishing-resistant domain matching
- Emits AuditEvents for sensitive operations
"""
from __future__ import annotations

import base64
from typing import List, Optional, Callable

from northlocker.core.entries import Entry, LoginEntry, NoteEntry, PasskeyEntry, VaultPayload
from northlocker.core.domain_trust import DomainTrustService, MatchLevel
from northlocker.core.audit import AuditEvent, get_audit_service
from northlocker.core.totp import get_totp_info
from northlocker.utils.clipboard import copy_to_clipboard
from northlocker.utils.paths import get_vault_path
from northlocker.core.vault import save_vault


_trust = DomainTrustService()


class VaultAdapter:
    """
    Stateless adapter. Receives a SessionManager and a vault-data getter.
    The server and UI call methods here; this layer never imports app_instance.
    """

    def __init__(self, session, get_vault: Callable[[], Optional[VaultPayload]]):
        """
        Args:
            session:    SessionManager instance (or compatible object)
            get_vault:  Zero-arg callable returning the current VaultPayload or None
        """
        self._session = session
        self._get_vault = get_vault

    @property
    def is_locked(self) -> bool:
        return self._session.is_locked or self._get_vault() is None

    def _vault(self) -> Optional[VaultPayload]:
        if self.is_locked:
            return None
        return self._get_vault()

    # ── Domain search ────────────────────────────────────────────────────────

    def find_by_domain(self, domain: str) -> List[Entry]:
        vault = self._vault()
        if not vault or not domain:
            return []

        results = []
        seen = set()
        for entry in vault.logins:
            if entry.id in seen:
                continue
            match = _trust.calculate_match_score(entry, domain)
            if match.matched:
                results.append((match.trust_score, entry))
                seen.add(entry.id)

        for entry in vault.passkeys:
            if entry.id in seen:
                continue
            if entry.rp_id and (domain == entry.rp_id or domain.endswith("." + entry.rp_id)):
                results.append((100, entry))
                seen.add(entry.id)

        # Return sorted by trust score descending
        results.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in results]

    def increment_usage(self, entry_id: str) -> bool:
        import datetime
        vault = self._vault()
        if not vault or not entry_id:
            return False
        for entry in vault.logins:
            if entry.id == entry_id:
                entry.usage_count = getattr(entry, "usage_count", 0) + 1
                entry.last_used = datetime.datetime.now(datetime.timezone.utc).isoformat()
                self._save(vault)
                return True
        for entry in vault.passkeys:
            if entry.id == entry_id:
                entry.sign_count = getattr(entry, "sign_count", 0) + 1
                entry.last_used = datetime.datetime.now(datetime.timezone.utc).isoformat()
                self._save(vault)
                return True
        return False

    # ── Full-text search ─────────────────────────────────────────────────────

    def search(self, query: str) -> List[Entry]:
        vault = self._vault()
        if not vault:
            return []
        all_entries = list(vault.logins) + list(vault.notes) + list(vault.passkeys)
        if not query:
            return all_entries
        q = query.lower().strip()
        return [
            e for e in all_entries
            if (e.title and q in e.title.lower())
            or (getattr(e, "username", None) and q in e.username.lower())
            or (getattr(e, "url", None) and q in e.url.lower())
            or (getattr(e, "rp_id", None) and q in e.rp_id.lower())
        ]

    # ── Single entry ─────────────────────────────────────────────────────────

    def get_entry(self, entry_id: str) -> Optional[Entry]:
        vault = self._vault()
        if not vault or not entry_id:
            return None
        for e in list(vault.logins) + list(vault.notes) + list(vault.passkeys):
            if e.id == entry_id:
                return e
        return None

    # ── Create ───────────────────────────────────────────────────────────────

    def create_entry(
        self,
        title: str,
        username: str = "",
        password: str = "",
        url: str = "",
        entry_type: str = "login",
        totp_secret: str = "",
        notes: str = "",
    ) -> str:
        vault = self._vault()
        if not vault:
            raise RuntimeError("Vault is locked.")

        t = entry_type if entry_type in ("login", "totp_only", "note") else "login"

        if t in ("login", "totp_only"):
            u = url.strip()
            norm = _trust.normalize(u)
            if norm:
                canonical = _trust.registered_domain(norm)
                match_domains = [norm, canonical] if norm != canonical else [canonical]
            else:
                canonical = None
                match_domains = []
            
            ts = (totp_secret or "").strip()
            entry = LoginEntry(
                title=title.strip(), username=username.strip(),
                password=password, url=u, type=t,
                totp_secret=ts or None, notes=notes,
                canonical_domain=canonical, match_domains=match_domains,
                login_urls=[u] if u else []
            )
            vault.logins.append(entry)
        else:
            entry = NoteEntry(title=title.strip(), notes=notes, type=t)
            vault.notes.append(entry)

        self._save(vault)
        get_audit_service().log(AuditEvent.ENTRY_CREATED, {"id": entry.id, "type": t})
        return entry.id

    # ── Update ───────────────────────────────────────────────────────────────

    def update_entry(self, entry_id: str, **fields) -> bool:
        vault = self._vault()
        if not vault or not entry_id:
            return False

        for entry in list(vault.logins) + list(vault.notes):
            if entry.id != entry_id:
                continue
            if "title" in fields and fields["title"] is not None:
                entry.title = fields["title"].strip()
            if "username" in fields and fields["username"] is not None:
                entry.username = fields["username"].strip()
            if "password" in fields and fields["password"]:
                entry.password = fields["password"]
            if "url" in fields and fields["url"] is not None:
                entry.url = fields["url"].strip()
                if hasattr(entry, "canonical_domain"):
                    norm = _trust.normalize(entry.url)
                    if norm:
                        entry.canonical_domain = _trust.registered_domain(norm)
                        if norm != entry.canonical_domain:
                            entry.match_domains = [norm, entry.canonical_domain]
                        else:
                            entry.match_domains = [entry.canonical_domain]
                    else:
                        entry.canonical_domain = None
                        entry.match_domains = []
            if "entry_type" in fields and fields["entry_type"] in ("login", "totp_only", "note"):
                entry.type = fields["entry_type"]
            if "totp_secret" in fields and fields["totp_secret"] is not None:
                ts = fields["totp_secret"].strip()
                if ts == "__REMOVE__":
                    entry.totp_secret = None
                elif ts:
                    entry.totp_secret = ts
            if "notes" in fields and fields["notes"] is not None:
                entry.notes = fields["notes"]
            if "preferred" in fields and fields["preferred"] is not None:
                entry.preferred = bool(fields["preferred"])
            if "match_domains" in fields and fields["match_domains"] is not None:
                entry.match_domains = fields["match_domains"]
            if "login_urls" in fields and fields["login_urls"] is not None:
                entry.login_urls = fields["login_urls"]
            entry.update_timestamp()
            self._save(vault)
            get_audit_service().log(AuditEvent.ENTRY_UPDATED, {"id": entry_id})
            return True
        return False

    # ── Delete ───────────────────────────────────────────────────────────────

    def delete_entry(self, entry_id: str) -> bool:
        vault = self._vault()
        if not vault or not entry_id:
            return False
        original = len(vault.logins) + len(vault.notes) + len(vault.passkeys)
        vault.logins = [e for e in vault.logins if e.id != entry_id]
        vault.notes = [e for e in vault.notes if e.id != entry_id]
        vault.passkeys = [e for e in vault.passkeys if e.id != entry_id]
        if len(vault.logins) + len(vault.notes) + len(vault.passkeys) == original:
            return False
        self._save(vault)
        get_audit_service().log(AuditEvent.ENTRY_DELETED, {"id": entry_id})
        return True

    # ── Passkeys ─────────────────────────────────────────────────────────────

    def find_passkeys(self, rp_id: str) -> List[PasskeyEntry]:
        vault = self._vault()
        if not vault or not rp_id:
            return []
        from northlocker.core.passkey import PasskeyService
        return PasskeyService().find_credentials(vault, rp_id)

    def create_passkey(
        self,
        rp_id: str,
        rp_name: str,
        user_id_b64: str,
        user_name: str,
        challenge_b64: str,
    ) -> dict:
        vault = self._vault()
        if not vault:
            raise RuntimeError("Vault is locked.")
        
        # Pad base64url if needed
        def _pad(s: str) -> str:
            return s + "=" * ((4 - len(s) % 4) % 4)
        
        user_id = base64.urlsafe_b64decode(_pad(user_id_b64))
        challenge = base64.urlsafe_b64decode(_pad(challenge_b64))
        
        from northlocker.core.passkey import PasskeyService
        service = PasskeyService()
        response, entry = service.create_credential(
            vault=vault,
            rp_id=rp_id,
            rp_name=rp_name,
            user_id=user_id,
            user_name=user_name,
            challenge=challenge,
        )
        service.store_credential(vault, entry)
        self._save(vault)
        
        return {
            "credential_id": response.credential_id,
            "public_key_cbor": base64.b64encode(response.public_key_cbor).decode(),
            "aaguid": response.aaguid,
            "attestation_object": base64.b64encode(response.attestation_object).decode(),
            "authenticator_data": base64.b64encode(response.authenticator_data).decode(),
        }

    def sign_passkey(
        self,
        rp_id: str,
        challenge_b64: str,
        credential_ids: Optional[List[str]] = None,
    ) -> Optional[dict]:
        vault = self._vault()
        if not vault:
            raise RuntimeError("Vault is locked.")
            
        def _pad(s: str) -> str:
            return s + "=" * ((4 - len(s) % 4) % 4)
            
        challenge = base64.urlsafe_b64decode(_pad(challenge_b64))
        from northlocker.core.passkey import PasskeyService
        service = PasskeyService()
        resp = service.get_assertion(
            vault=vault,
            rp_id=rp_id,
            challenge=challenge,
            credential_ids=credential_ids,
        )
        if not resp:
            return None
            
        self._save(vault)
        
        return {
            "credential_id": resp.credential_id,
            "authenticator_data": base64.b64encode(resp.authenticator_data).decode(),
            "client_data_hash": base64.b64encode(resp.client_data_hash).decode(),
            "signature": base64.b64encode(resp.signature).decode(),
            "user_handle": resp.user_handle,
        }

    # ── TOTP ─────────────────────────────────────────────────────────────────

    def generate_totp(self, totp_secret: str) -> tuple[str, int]:
        if not totp_secret:
            return "", 30
        info = get_totp_info(totp_secret)
        if not info:
            return "", 30
        return info[0].replace(" ", ""), info[3]

    # ── Clipboard ────────────────────────────────────────────────────────────

    def copy_to_clipboard(self, value: str, clear_seconds: int = 15) -> None:
        if not value:
            return
        copy_to_clipboard(value, clear_seconds)
        get_audit_service().log(AuditEvent.CREDENTIAL_COPIED, {})

    # ── Internal ─────────────────────────────────────────────────────────────

    def _save(self, vault: VaultPayload) -> None:
        save_vault(
            str(get_vault_path()),
            self._session.get_key(),
            vault,
        )
