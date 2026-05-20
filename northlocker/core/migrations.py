"""
NorthLocker — migrations.py
============================
Step-based vault payload migration pipeline.
"""
from __future__ import annotations
from typing import Callable

_MIGRATIONS: dict[tuple[int, int], Callable[[dict], dict]] = {}

def _register(from_v: int, to_v: int):
    def decorator(fn):
        _MIGRATIONS[(from_v, to_v)] = fn
        return fn
    return decorator

@_register(1, 2)
def _v1_to_v2(old: dict) -> dict:
    new: dict = {
        "version": 2,
        "logins": [], "passkeys": [], "notes": [],
        "settings": old.get("settings", {}),
        "metadata": old.get("metadata", {}),
    }
    for entry in old.get("entries", []):
        etype = entry.get("type", "login")
        if etype in ("login", "totp_only"):
            new["logins"].append(entry)
        elif etype == "note":
            new["notes"].append(entry)
        elif etype == "passkey":
            new["passkeys"].append(entry)
    return new

@_register(2, 3)
def _v2_to_v3(old: dict) -> dict:
    import uuid
    new = dict(old)
    new["version"] = 3

    # metadata → vault_metadata
    if "metadata" in new and "vault_metadata" not in new:
        raw = new.pop("metadata")
        new["vault_metadata"] = {
            "vault_id": raw.get("vault_id", str(uuid.uuid4())),
            "device_id": raw.get("device_id", ""),
            "schema_hash": raw.get("schema_hash", ""),
            "last_backup": raw.get("last_backup"),
            "integrity_verified_at": raw.get("integrity_verified_at"),
        }
    elif "vault_metadata" not in new:
        new["vault_metadata"] = {
            "vault_id": str(uuid.uuid4()), "device_id": "",
            "schema_hash": "", "last_backup": None, "integrity_verified_at": None,
        }

    # Upgrade LoginEntry: add canonical_domain and match_domains
    from northlocker.core.domain_trust import DomainTrustService
    trust = DomainTrustService()
    
    migrated_logins = []
    for login in new.get("logins", []):
        login = dict(login)
        url = login.get("url", "")
        if url and not login.get("canonical_domain"):
            norm = trust.normalize(url)
            if norm:
                login["canonical_domain"] = trust.registered_domain(norm)
                if norm != login["canonical_domain"]:
                    login["match_domains"] = [norm, login["canonical_domain"]]
                else:
                    login["match_domains"] = [login["canonical_domain"]]
            else:
                login["canonical_domain"] = None
                login["match_domains"] = []
        
        login.setdefault("canonical_domain", None)
        login.setdefault("match_domains", [])
        login.setdefault("login_urls", [url] if url else [])
        login.setdefault("preferred", False)
        login.setdefault("last_used", None)
        login.setdefault("usage_count", 0)
        migrated_logins.append(login)
    new["logins"] = migrated_logins

    # Upgrade PasskeyEntry: relying_party_id → rp_id + new WebAuthn fields
    migrated = []
    for pk in new.get("passkeys", []):
        pk = dict(pk)
        if "relying_party_id" in pk and "rp_id" not in pk:
            pk["rp_id"] = pk.pop("relying_party_id")
        pk.setdefault("rp_id", "")
        pk.setdefault("rp_name", "")
        pk.setdefault("sign_count", 0)
        pk.setdefault("last_used", None)
        pk.setdefault("aaguid", "")
        pk.setdefault("transports", ["internal"])
        migrated.append(pk)
    new["passkeys"] = migrated
    return new


class MigrationManager:
    LATEST_VERSION = 3

    @staticmethod
    def migrate(payload_dict: dict, dry_run: bool = False) -> dict:
        if dry_run:
            import copy
            payload_dict = copy.deepcopy(payload_dict)

        version = payload_dict.get("version", 1)
        while version < MigrationManager.LATEST_VERSION:
            fn = _MIGRATIONS.get((version, version + 1))
            if fn is None:
                raise ValueError(f"No migration from v{version} to v{version + 1}.")
            payload_dict = fn(payload_dict)
            version = payload_dict.get("version", version + 1)
        return payload_dict

    @staticmethod
    def can_migrate(from_version: int, to_version: int) -> bool:
        v = from_version
        while v < to_version:
            if (v, v + 1) not in _MIGRATIONS:
                return False
            v += 1
        return True
