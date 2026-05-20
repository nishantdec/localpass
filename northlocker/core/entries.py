"""
NorthLocker — entries.py
========================
Vault payload data model.

Schema version 2 → 3 changes:
- PasskeyEntry: added sign_count, last_used, aaguid, transports (WebAuthn spec)
- PasskeyEntry: renamed relying_party_id → rp_id (matches WebAuthn RP ID terminology)
- VaultMetadata: new class for envelope-level metadata (vault_id, device_id, etc.)
- VaultPayload: added metadata field using VaultMetadata
"""
import uuid
import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Literal

EntryType = Literal["login", "totp_only", "note", "passkey"]


# ---------------------------------------------------------------------------
# Base Entry
# ---------------------------------------------------------------------------

@dataclass
class Entry:
    title: str = ""
    type: EntryType = "login"
    notes: str = ""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )

    def update_timestamp(self) -> None:
        self.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Login / TOTP entry
# ---------------------------------------------------------------------------

@dataclass
class LoginEntry(Entry):
    username: str = ""
    password: str = ""
    url: str = ""
    totp_secret: Optional[str] = None
    canonical_domain: Optional[str] = None
    match_domains: List[str] = field(default_factory=list)
    login_urls: List[str] = field(default_factory=list)
    preferred: bool = False
    last_used: Optional[str] = None
    usage_count: int = 0


# ---------------------------------------------------------------------------
# Passkey entry (WebAuthn / FIDO2 compliant schema)
# ---------------------------------------------------------------------------

@dataclass
class PasskeyEntry(Entry):
    # Relying Party — use 'rp_id' per WebAuthn spec (was relying_party_id in v2)
    rp_id: str = ""
    rp_name: str = ""

    # Credential identifiers
    credential_id: str = ""           # base64url-encoded CredentialID
    user_handle: str = ""             # base64url-encoded UserHandle

    # Key material — encrypted at the vault level; never plaintext on disk
    private_key: str = ""             # PEM or COSE CBOR, base64-encoded
    algorithm: int = -7               # COSE algorithm: -7 = ES256, -257 = RS256

    # WebAuthn state — REQUIRED for replay attack prevention
    sign_count: int = 0               # monotonically increasing counter
    last_used: Optional[str] = None   # ISO 8601 timestamp

    # Attestation / metadata
    aaguid: str = ""                  # Authenticator AAGUID (software = all zeros)
    transports: List[str] = field(
        default_factory=lambda: ["internal"]
    )                                 # "internal" | "usb" | "nfc" | "ble"


# ---------------------------------------------------------------------------
# Secure Note entry
# ---------------------------------------------------------------------------

@dataclass
class NoteEntry(Entry):
    pass


# ---------------------------------------------------------------------------
# Vault metadata (stored inside encrypted payload)
# ---------------------------------------------------------------------------

@dataclass
class VaultMetadata:
    """
    Metadata stored inside the encrypted payload (not in the JSON envelope).
    Contains integrity and provenance information.
    """
    vault_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str = ""
    schema_hash: str = ""             # hash of current schema definition version
    last_backup: Optional[str] = None # ISO 8601 timestamp of last successful backup
    integrity_verified_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "vault_id": self.vault_id,
            "device_id": self.device_id,
            "schema_hash": self.schema_hash,
            "last_backup": self.last_backup,
            "integrity_verified_at": self.integrity_verified_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "VaultMetadata":
        return cls(
            vault_id=data.get("vault_id", str(uuid.uuid4())),
            device_id=data.get("device_id", ""),
            schema_hash=data.get("schema_hash", ""),
            last_backup=data.get("last_backup"),
            integrity_verified_at=data.get("integrity_verified_at"),
        )


# ---------------------------------------------------------------------------
# Vault payload (the decrypted contents of the vault)
# ---------------------------------------------------------------------------

@dataclass
class VaultPayload:
    version: int = 3
    logins: List[LoginEntry] = field(default_factory=list)
    passkeys: List[PasskeyEntry] = field(default_factory=list)
    notes: List[NoteEntry] = field(default_factory=list)
    settings: Dict[str, Any] = field(default_factory=dict)
    vault_metadata: VaultMetadata = field(default_factory=VaultMetadata)

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "logins": [asdict(e) for e in self.logins],
            "passkeys": [asdict(e) for e in self.passkeys],
            "notes": [asdict(e) for e in self.notes],
            "settings": self.settings,
            "vault_metadata": self.vault_metadata.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "VaultPayload":
        logins = []
        from northlocker.core.domain_trust import DomainTrustService
        trust = DomainTrustService()
        for e in data.get("logins", []):
            known = {f for f in LoginEntry.__dataclass_fields__}
            filtered = {k: v for k, v in e.items() if k in known}
            url = filtered.get("url", "")
            if url and not filtered.get("canonical_domain"):
                norm = trust.normalize(url)
                if norm:
                    filtered["canonical_domain"] = trust.registered_domain(norm)
                    if norm != filtered["canonical_domain"]:
                        filtered["match_domains"] = [norm, filtered["canonical_domain"]]
                    else:
                        filtered["match_domains"] = [filtered["canonical_domain"]]
                else:
                    filtered["canonical_domain"] = None
                    filtered["match_domains"] = []
            
            # Ensure list defaults
            if "match_domains" in filtered and not filtered["match_domains"]:
                if filtered.get("canonical_domain"):
                    filtered["match_domains"] = [filtered["canonical_domain"]]
            if not filtered.get("login_urls"):
                filtered["login_urls"] = [url] if url else []
            logins.append(LoginEntry(**filtered))

        passkeys = []
        for e in data.get("passkeys", []):
            known = {f for f in PasskeyEntry.__dataclass_fields__}
            passkeys.append(PasskeyEntry(**{k: v for k, v in e.items() if k in known}))

        notes = []
        for e in data.get("notes", []):
            known = {f for f in NoteEntry.__dataclass_fields__}
            notes.append(NoteEntry(**{k: v for k, v in e.items() if k in known}))

        raw_meta = data.get("vault_metadata", {})
        # Legacy: if vault_metadata was stored at top level as 'metadata'
        if not raw_meta:
            raw_meta = data.get("metadata", {})
        vault_metadata = VaultMetadata.from_dict(raw_meta) if raw_meta else VaultMetadata()

        return cls(
            version=data.get("version", 3),
            logins=logins,
            passkeys=passkeys,
            notes=notes,
            settings=data.get("settings", {}),
            vault_metadata=vault_metadata,
        )
