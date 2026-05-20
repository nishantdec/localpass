"""
NorthLocker — vault.py
=======================
Encrypted vault persistence layer.

Envelope format (JSON, on disk):
{
  "schema_version": 1,         ← envelope schema (not payload version)
  "vault_id": "uuid4",         ← stable across saves
  "version": 3,                ← payload schema version
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "kdf_params": {...},
  "device_id": "uuid4",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "nonce": "base64",
  "salt": "base64",
  "payload_hash": "hex",       ← HMAC-SHA256(key, ciphertext) for integrity
  "payload": "base64"          ← AES-256-GCM ciphertext
}

Security properties:
- payload_hash: detects accidental corruption AND tampering
- vault_id: stable provenance across saves
- Backup rotation: keep last N encrypted copies (default 5)
- read-only recovery mode: if JSON parse fails post-decrypt, raise VaultCorruptionError
  with raw bytes preserved for forensic recovery
"""
from __future__ import annotations

import base64
import datetime
import hashlib
import hmac
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from northlocker.core.auth import derive_key, get_default_kdf_params
from northlocker.core.entries import VaultPayload
from northlocker.core.migrations import MigrationManager
from northlocker.utils.paths import get_device_id, get_backup_dir


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidMasterPassword(Exception):
    pass


class VaultError(Exception):
    pass


class VaultCorruptionError(VaultError):
    """
    Raised when the vault file can be decrypted but the plaintext is not
    valid JSON. Raw bytes are preserved for forensic recovery.
    """
    def __init__(self, message: str, raw_bytes: Optional[bytes] = None):
        super().__init__(message)
        self.raw_bytes = raw_bytes


class VaultIntegrityError(VaultError):
    """Raised when payload_hash verification fails (file tampered or corrupted)."""
    pass


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ENVELOPE_SCHEMA_VERSION = 1
LEGACY_MAGIC = b"NLLK"


# ---------------------------------------------------------------------------
# Integrity helpers
# ---------------------------------------------------------------------------

def _compute_payload_hash(key: bytes, ciphertext: bytes) -> str:
    """HMAC-SHA256 of ciphertext using the derived key. Returns hex digest."""
    return hmac.new(key, ciphertext, hashlib.sha256).hexdigest()


def _verify_payload_hash(key: bytes, ciphertext: bytes, expected_hex: str) -> bool:
    """Constant-time comparison of expected vs actual payload hash."""
    actual = _compute_payload_hash(key, ciphertext)
    return hmac.compare_digest(actual, expected_hex)


# ---------------------------------------------------------------------------
# Key derivation (public helper kept for unlock screen)
# ---------------------------------------------------------------------------

def get_vault_key(path: str, master_password: str) -> bytes:
    """Read salt + KDF params from vault file and return the derived key."""
    path = str(path)

    # Legacy binary vault
    with open(path, "rb") as f:
        magic = f.read(4)
        if magic == LEGACY_MAGIC:
            f.seek(5)  # skip magic + version byte
            salt = f.read(16)
            return derive_key(master_password, salt, None)

    with open(path, "r", encoding="utf-8") as f:
        envelope = json.load(f)

    salt = base64.b64decode(envelope["salt"])
    kdf_params = envelope.get("kdf_params", get_default_kdf_params())
    return derive_key(master_password, salt, kdf_params)


# ---------------------------------------------------------------------------
# Vault initialisation
# ---------------------------------------------------------------------------

def init_vault(path: str, master_password: str) -> None:
    """Create a new, empty, encrypted vault at `path`."""
    path = str(path)
    salt = os.urandom(16)
    kdf_params = get_default_kdf_params()
    key = derive_key(master_password, salt, kdf_params)

    vault_payload = VaultPayload()
    payload_json = json.dumps(vault_payload.to_dict()).encode("utf-8")

    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, payload_json, None)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    envelope = {
        "schema_version": ENVELOPE_SCHEMA_VERSION,
        "vault_id": str(uuid.uuid4()),
        "version": vault_payload.version,
        "cipher": "AES-256-GCM",
        "kdf": "Argon2id",
        "kdf_params": kdf_params,
        "device_id": get_device_id(),
        "created_at": now,
        "updated_at": now,
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "salt": base64.b64encode(salt).decode("utf-8"),
        "payload_hash": _compute_payload_hash(key, ciphertext),
        "payload": base64.b64encode(ciphertext).decode("utf-8"),
    }

    _write_atomic(path, envelope, max_backups=0)  # no backup on first create


# ---------------------------------------------------------------------------
# Vault loading
# ---------------------------------------------------------------------------

def load_vault(path: str, master_password: str) -> VaultPayload:
    """Decrypt and load the vault. Raises InvalidMasterPassword or VaultError."""
    path = str(path)

    if not os.path.exists(path):
        raise VaultError("Vault file does not exist.")

    # Handle legacy binary vault
    with open(path, "rb") as f:
        magic = f.read(4)
        is_legacy = (magic == LEGACY_MAGIC)

    if is_legacy:
        return _load_legacy_vault(path, master_password)

    with open(path, "r", encoding="utf-8") as f:
        try:
            envelope = json.load(f)
        except json.JSONDecodeError:
            raise VaultError("Invalid vault file: could not parse JSON envelope.")

    try:
        salt = base64.b64decode(envelope["salt"])
        nonce = base64.b64decode(envelope["nonce"])
        ciphertext = base64.b64decode(envelope["payload"])
        kdf_params = envelope.get("kdf_params", get_default_kdf_params())
    except KeyError as e:
        raise VaultError(f"Missing required envelope field: {e}")

    key = derive_key(master_password, salt, kdf_params)

    # Integrity check (only if hash is present — older vaults may not have it)
    stored_hash = envelope.get("payload_hash", "")
    if stored_hash:
        if not _verify_payload_hash(key, ciphertext, stored_hash):
            raise VaultIntegrityError(
                "Vault integrity check failed. The file may be corrupted or tampered."
            )

    aesgcm = AESGCM(key)
    try:
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    except InvalidTag:
        raise InvalidMasterPassword()

    try:
        payload_dict = json.loads(plaintext.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise VaultCorruptionError(
            "Vault decrypted but payload is not valid JSON. "
            "Use recovery tools to inspect the raw bytes.",
            raw_bytes=plaintext,
        ) from exc

    payload_dict = MigrationManager.migrate(payload_dict)
    return VaultPayload.from_dict(payload_dict)


# ---------------------------------------------------------------------------
# Vault saving
# ---------------------------------------------------------------------------

def save_vault(
    path: str,
    key: bytes,
    vault_payload: VaultPayload,
    salt: Optional[bytes] = None,
    kdf_params: Optional[dict] = None,
    max_backups: int = 5,
) -> None:
    """Encrypt and atomically write the vault. Rotates encrypted backups."""
    path = str(path)

    if not os.path.exists(path):
        raise VaultError("Vault file does not exist; use init_vault() first.")

    # Load existing envelope to preserve vault_id and other stable fields
    envelope: Optional[dict] = None
    try:
        with open(path, "r", encoding="utf-8") as f:
            envelope = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        pass

    if not envelope:
        if salt is None:
            raise VaultError("Cannot save vault: missing salt for new envelope.")
        envelope = {
            "schema_version": ENVELOPE_SCHEMA_VERSION,
            "vault_id": str(uuid.uuid4()),
            "cipher": "AES-256-GCM",
            "kdf": "Argon2id",
            "kdf_params": kdf_params or get_default_kdf_params(),
            "device_id": get_device_id(),
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "salt": base64.b64encode(salt).decode("utf-8"),
        }
    else:
        # Preserve vault_id across saves
        if "vault_id" not in envelope:
            envelope["vault_id"] = str(uuid.uuid4())
        if "schema_version" not in envelope:
            envelope["schema_version"] = ENVELOPE_SCHEMA_VERSION
        if "device_id" not in envelope:
            envelope["device_id"] = get_device_id()
        if salt is not None:
            envelope["salt"] = base64.b64encode(salt).decode("utf-8")
        if kdf_params is not None:
            envelope["kdf_params"] = kdf_params

    raw_salt = base64.b64decode(envelope["salt"])
    raw_kdf_params = envelope.get("kdf_params", get_default_kdf_params())

    payload_json = json.dumps(vault_payload.to_dict()).encode("utf-8")
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, payload_json, None)

    envelope["version"] = vault_payload.version
    envelope["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    envelope["nonce"] = base64.b64encode(nonce).decode("utf-8")
    envelope["payload_hash"] = _compute_payload_hash(key, ciphertext)
    envelope["payload"] = base64.b64encode(ciphertext).decode("utf-8")

    _write_atomic(path, envelope, max_backups=max_backups)


# ---------------------------------------------------------------------------
# Integrity verification (public API for RecoveryManager)
# ---------------------------------------------------------------------------

def verify_integrity(path: str, key: bytes) -> bool:
    """
    Verify the payload_hash without fully decrypting the vault.
    Returns True if intact, False if corrupted / tampered.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            envelope = json.load(f)
        ciphertext = base64.b64decode(envelope["payload"])
        stored_hash = envelope.get("payload_hash", "")
        if not stored_hash:
            return True  # No hash present — legacy vault, skip
        return _verify_payload_hash(key, ciphertext, stored_hash)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Atomic write with backup rotation
# ---------------------------------------------------------------------------

def _write_atomic(path: str, data: dict, max_backups: int = 5) -> None:
    """
    Write vault data atomically:
    1. Write to .tmp
    2. Verify .tmp parses as valid JSON
    3. Rotate existing backups (vault.nlk.bak.1 → vault.nlk.bak.2 etc.)
    4. os.replace(.tmp → path)
    """
    import time as _time

    path = str(path)
    tmp_path = path + ".tmp"

    # 1. Write to temporary file
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())

    # 2. Verify temp file
    with open(tmp_path, "r", encoding="utf-8") as f:
        try:
            json.load(f)
        except json.JSONDecodeError:
            os.remove(tmp_path)
            raise VaultError("Temp vault write produced invalid JSON — aborting.")

    # 3. Rotate backups before overwriting primary
    if os.path.exists(path) and max_backups > 0:
        _rotate_backups(path, max_backups)

    # 4. Atomic replace
    for attempt in range(10):
        try:
            os.replace(tmp_path, path)
            return
        except PermissionError:
            if attempt == 9:
                raise
            _time.sleep(0.1)


def _rotate_backups(vault_path: str, max_backups: int) -> None:
    """
    Rotate encrypted backup files in the backup directory.
    vault.nlk.bak.5 → deleted
    vault.nlk.bak.4 → vault.nlk.bak.5
    ...
    vault.nlk       → vault.nlk.bak.1
    """
    try:
        backup_dir = get_backup_dir()
        vault_name = Path(vault_path).name  # e.g. "vault.nlk"

        # Shift existing backups
        for i in range(max_backups, 1, -1):
            older = backup_dir / f"{vault_name}.bak.{i}"
            newer = backup_dir / f"{vault_name}.bak.{i - 1}"
            if newer.exists():
                if older.exists():
                    older.unlink()
                shutil.copy2(str(newer), str(older))

        # Copy current primary to .bak.1
        bak1 = backup_dir / f"{vault_name}.bak.1"
        shutil.copy2(vault_path, str(bak1))
    except Exception:
        pass  # Backup rotation failure must never block the primary write


# ---------------------------------------------------------------------------
# Legacy binary vault loader
# ---------------------------------------------------------------------------

def _load_legacy_vault(path: str, master_password: str) -> VaultPayload:
    path = str(path)
    with open(path, "rb") as f:
        f.read(4)            # skip magic NLLK
        f.read(1)            # skip version byte
        salt = f.read(16)
        nonce = f.read(12)
        ciphertext = f.read()

    key = derive_key(master_password, salt, None)
    aesgcm = AESGCM(key)

    try:
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    except InvalidTag:
        raise InvalidMasterPassword()

    try:
        payload_dict = json.loads(plaintext.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise VaultCorruptionError("Legacy vault decrypted but payload is corrupt.", plaintext) from exc

    payload_dict = MigrationManager.migrate(payload_dict)
    payload = VaultPayload.from_dict(payload_dict)

    # Upgrade to current JSON envelope format immediately
    save_vault(path, key, payload, salt=salt)
    return payload
