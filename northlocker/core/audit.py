"""
NorthLocker — audit.py
=======================
Local-only, privacy-preserving audit log with tamper-evident chaining.

Design:
- Stored as line-delimited JSON in %APPDATA%/NorthLocker/audit.log
- No PII: entry IDs only, never passwords / usernames / plaintext secrets
- Each record includes a hash of the previous record (chain integrity)
- Max size enforced (rotate when file exceeds MAX_LOG_BYTES)
- Thread-safe writes via a lock
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import List, Optional

from northlocker.utils.paths import get_audit_log_path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_LOG_BYTES = 512 * 1024   # 512 KB before rotation
MAX_RECORDS_RETURN = 500     # cap for get_recent()
GENESIS_HASH = "0" * 64      # initial prev_hash for the first record


# ---------------------------------------------------------------------------
# Event types
# ---------------------------------------------------------------------------

class AuditEvent(str, Enum):
    VAULT_UNLOCKED        = "vault.unlocked"
    VAULT_LOCKED          = "vault.locked"
    UNLOCK_FAILED         = "vault.unlock_failed"
    VAULT_CREATED         = "vault.created"
    VAULT_EXPORTED        = "vault.exported"
    BACKUP_CREATED        = "backup.created"
    BACKUP_RESTORED       = "backup.restored"
    AUTOFILL_TRIGGERED    = "autofill.triggered"
    CREDENTIAL_COPIED     = "credential.copied"
    ENTRY_CREATED         = "entry.created"
    ENTRY_UPDATED         = "entry.updated"
    ENTRY_DELETED         = "entry.deleted"
    PASSKEY_REGISTERED    = "passkey.registered"
    PASSKEY_USED          = "passkey.used"
    MIGRATION_RAN         = "migration.ran"
    INTEGRITY_CHECK_PASS  = "integrity.pass"
    INTEGRITY_CHECK_FAIL  = "integrity.fail"


# ---------------------------------------------------------------------------
# Record structure
# ---------------------------------------------------------------------------

class AuditRecord:
    __slots__ = ("ts", "event", "meta", "prev_hash", "record_hash")

    def __init__(
        self,
        event: AuditEvent,
        meta: Optional[dict],
        prev_hash: str,
    ):
        self.ts: str = datetime.now(timezone.utc).isoformat()
        self.event: str = str(event)
        self.meta: dict = meta or {}
        self.prev_hash: str = prev_hash
        self.record_hash: str = self._compute_hash()

    def _compute_hash(self) -> str:
        content = json.dumps(
            {"ts": self.ts, "event": self.event, "meta": self.meta, "prev": self.prev_hash},
            sort_keys=True,
        ).encode("utf-8")
        return hashlib.sha256(content).hexdigest()

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "event": self.event,
            "meta": self.meta,
            "prev_hash": self.prev_hash,
            "hash": self.record_hash,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "AuditRecord":
        rec = cls.__new__(cls)
        rec.ts = d.get("ts", "")
        rec.event = d.get("event", "")
        rec.meta = d.get("meta", {})
        rec.prev_hash = d.get("prev_hash", GENESIS_HASH)
        rec.record_hash = d.get("hash", "")
        return rec


# ---------------------------------------------------------------------------
# AuditService
# ---------------------------------------------------------------------------

class AuditService:
    """
    Thread-safe audit logging service.

    Usage:
        audit = AuditService()
        audit.log(AuditEvent.VAULT_UNLOCKED, {"method": "password"})
        recent = audit.get_recent(20)
    """

    def __init__(self, log_path: Optional[Path] = None):
        self._path: Path = log_path or get_audit_log_path()
        self._lock = threading.Lock()
        self._last_hash: Optional[str] = None   # cached for chaining

    # ── Public API ───────────────────────────────────────────────────────────

    def log(self, event: AuditEvent, meta: Optional[dict] = None) -> None:
        """Append an audit record. Thread-safe. Never raises."""
        try:
            with self._lock:
                prev_hash = self._get_last_hash()
                record = AuditRecord(event=event, meta=meta or {}, prev_hash=prev_hash)
                self._append(record)
                self._last_hash = record.record_hash
                self._rotate_if_needed()
        except Exception:
            pass  # Audit failure must never crash the application

    def get_recent(self, limit: int = 50) -> List[dict]:
        """Return the most recent `limit` audit records as dicts."""
        limit = min(limit, MAX_RECORDS_RETURN)
        try:
            with self._lock:
                lines = self._read_lines()
            records = []
            for line in reversed(lines):
                try:
                    records.append(json.loads(line))
                except Exception:
                    continue
                if len(records) >= limit:
                    break
            return list(reversed(records))
        except Exception:
            return []

    def verify_chain(self) -> bool:
        """
        Verify the hash chain integrity of the entire log.
        Returns True if intact, False if tampered.
        """
        try:
            with self._lock:
                lines = self._read_lines()
            prev = GENESIS_HASH
            for line in lines:
                try:
                    d = json.loads(line)
                    if d.get("prev_hash") != prev:
                        return False
                    # Re-compute hash
                    content = json.dumps(
                        {"ts": d["ts"], "event": d["event"],
                         "meta": d["meta"], "prev": d["prev_hash"]},
                        sort_keys=True,
                    ).encode("utf-8")
                    expected = hashlib.sha256(content).hexdigest()
                    if d.get("hash") != expected:
                        return False
                    prev = d["hash"]
                except Exception:
                    return False
            return True
        except Exception:
            return False

    def clear(self) -> None:
        """Erase the audit log. Requires explicit call — not automatic."""
        with self._lock:
            try:
                self._path.write_text("", encoding="utf-8")
                self._last_hash = None
            except Exception:
                pass

    # ── Internal ─────────────────────────────────────────────────────────────

    def _append(self, record: AuditRecord) -> None:
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record.to_dict()) + "\n")

    def _read_lines(self) -> List[str]:
        if not self._path.exists():
            return []
        return [
            line for line in self._path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def _get_last_hash(self) -> str:
        if self._last_hash:
            return self._last_hash
        lines = self._read_lines()
        for line in reversed(lines):
            try:
                d = json.loads(line)
                h = d.get("hash", "")
                if h:
                    self._last_hash = h
                    return h
            except Exception:
                continue
        return GENESIS_HASH

    def _rotate_if_needed(self) -> None:
        """Rotate audit log when it exceeds MAX_LOG_BYTES."""
        try:
            if self._path.stat().st_size <= MAX_LOG_BYTES:
                return
            rotated = self._path.with_suffix(".log.old")
            self._path.replace(rotated)
            self._last_hash = None
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Module-level singleton (lazy-initialised)
# ---------------------------------------------------------------------------

_audit_service: Optional[AuditService] = None


def get_audit_service() -> AuditService:
    global _audit_service
    if _audit_service is None:
        _audit_service = AuditService()
    return _audit_service
