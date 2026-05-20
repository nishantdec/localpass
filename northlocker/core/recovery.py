"""
NorthLocker — recovery.py
==========================
Backup rotation, vault repair, and emergency export.
"""
from __future__ import annotations

import base64
import datetime
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from northlocker.utils.paths import get_backup_dir, get_vault_path


@dataclass
class BackupInfo:
    path: Path
    index: int
    size_bytes: int
    modified_at: Optional[datetime.datetime]

    @property
    def label(self) -> str:
        if self.modified_at:
            return self.modified_at.strftime("%Y-%m-%d %H:%M:%S")
        return f"Backup #{self.index}"


@dataclass
class RepairResult:
    success: bool
    source: str       # "backup.1", "backup.2", etc. or "none"
    message: str


class RecoveryManager:
    """
    Manages encrypted backups and vault repair.

    Backup naming: <vault_name>.bak.1 (newest) through .bak.N (oldest)
    All backups are full encrypted copies — same key as primary vault.
    """

    def __init__(self, max_backups: int = 5):
        self.max_backups = max_backups

    # ── Snapshot listing ─────────────────────────────────────────────────────

    def list_snapshots(self, vault_name: str = "vault.nlk") -> List[BackupInfo]:
        """Return all available backups, newest first."""
        backup_dir = get_backup_dir()
        results = []
        for i in range(1, self.max_backups + 1):
            p = backup_dir / f"{vault_name}.bak.{i}"
            if p.exists():
                try:
                    stat = p.stat()
                    modified = datetime.datetime.fromtimestamp(stat.st_mtime)
                    results.append(BackupInfo(
                        path=p, index=i,
                        size_bytes=stat.st_size,
                        modified_at=modified,
                    ))
                except Exception:
                    results.append(BackupInfo(path=p, index=i, size_bytes=0, modified_at=None))
        return results

    # ── Integrity verification ────────────────────────────────────────────────

    def verify_snapshot(self, snapshot_path: Path, key: bytes) -> bool:
        """Verify that a backup can be decrypted with the given key."""
        try:
            from northlocker.core.vault import verify_integrity
            return verify_integrity(str(snapshot_path), key)
        except Exception:
            return False

    # ── Restore ──────────────────────────────────────────────────────────────

    def restore_snapshot(
        self,
        snapshot_path: Path,
        dest: Optional[Path] = None,
        key: Optional[bytes] = None,
    ) -> bool:
        """
        Restore a backup over the primary vault.
        Optionally verifies integrity before restoring.
        """
        dest = dest or get_vault_path()
        if key is not None and not self.verify_snapshot(snapshot_path, key):
            return False
        try:
            shutil.copy2(str(snapshot_path), str(dest))
            return True
        except Exception:
            return False

    # ── Repair ───────────────────────────────────────────────────────────────

    def repair_vault(
        self,
        key: bytes,
        vault_name: str = "vault.nlk",
    ) -> RepairResult:
        """
        Attempt to restore from the most recent valid backup.
        Tries backups in order (1 = newest).
        """
        snapshots = self.list_snapshots(vault_name)
        if not snapshots:
            return RepairResult(success=False, source="none", message="No backups found.")

        for backup in snapshots:
            if self.verify_snapshot(backup.path, key):
                ok = self.restore_snapshot(backup.path, key=None)  # already verified
                if ok:
                    return RepairResult(
                        success=True,
                        source=f"backup.{backup.index}",
                        message=f"Restored from backup #{backup.index} ({backup.label}).",
                    )

        return RepairResult(
            success=False, source="none",
            message="All backups failed integrity check. Manual recovery required.",
        )

    # ── Emergency export ─────────────────────────────────────────────────────

    def export_emergency(
        self,
        key: bytes,
        dest_path: Path,
        vault_path: Optional[Path] = None,
    ) -> None:
        """
        Decrypt the vault and write plaintext JSON to dest_path.
        WARNING: dest_path will contain unencrypted credentials.
        This is for catastrophic recovery only.
        """
        from northlocker.core.vault import load_vault
        from northlocker.core.auth import derive_key, get_default_kdf_params

        src = vault_path or get_vault_path()

        # We need to read the salt from the envelope to re-derive key info
        # But the caller already has the key — use it directly
        with open(str(src), "r", encoding="utf-8") as f:
            envelope = json.load(f)

        import os
        nonce = base64.b64decode(envelope["nonce"])
        ciphertext = base64.b64decode(envelope["payload"])
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        payload_dict = json.loads(plaintext.decode("utf-8"))

        export = {
            "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "warning": "UNENCRYPTED VAULT EXPORT — store securely and delete after use.",
            "vault": payload_dict,
        }

        dest_path.write_text(json.dumps(export, indent=2), encoding="utf-8")
