"""
NorthLocker — auth.py
=====================
Key derivation, secure memory management, and session lifecycle.

Design principles:
- SecureBuffer: context manager that zeros memory on __exit__
- SessionManager: token issuance, validation, expiry, rotation, and locking
- zero_bytes: reliable zeroing via ctypes without relying on CPython internals
"""
import os
import time
import hmac
import secrets
import ctypes
from collections import deque
from dataclasses import dataclass, field
from typing import Optional, Deque

import argon2


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TOKEN_BYTES = 32          # 256-bit session token
TOKEN_TTL_SECONDS = 28800  # 8 hours default
NONCE_CACHE_SIZE = 256    # replay protection ring buffer
MAX_FAILED_UNLOCKS = 5


# ---------------------------------------------------------------------------
# Secure memory primitives
# ---------------------------------------------------------------------------

def zero_bytes(buf: bytearray) -> None:
    """Reliably zero a bytearray using ctypes. Works regardless of CPython internals."""
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


class SecureBuffer:
    """
    Context manager for sensitive byte data (passwords, keys).
    Zeroes memory on __exit__ regardless of exceptions.

    Usage:
        with SecureBuffer(raw_key_bytes) as buf:
            # use buf (bytearray)
        # buf is zeroed here
    """
    def __init__(self, data: bytes):
        self._buf = bytearray(data)

    def __enter__(self) -> bytearray:
        return self._buf

    def __exit__(self, *_) -> None:
        zero_bytes(self._buf)

    def __len__(self) -> int:
        return len(self._buf)

    def to_bytes(self) -> bytes:
        return bytes(self._buf)


# ---------------------------------------------------------------------------
# KDF
# ---------------------------------------------------------------------------

def get_default_kdf_params() -> dict:
    return {
        "time_cost": 3,
        "memory_cost": 65536,
        "parallelism": 2,
        "hash_len": 32,
        "type": "Argon2id"
    }


def derive_key(master_password: str, salt: bytes, params: Optional[dict] = None) -> bytes:
    """Derives a 256-bit key from the master password using Argon2id."""
    p = params or get_default_kdf_params()
    return argon2.low_level.hash_secret_raw(
        secret=master_password.encode("utf-8"),
        salt=salt,
        time_cost=p.get("time_cost", 3),
        memory_cost=p.get("memory_cost", 65536),
        parallelism=p.get("parallelism", 2),
        hash_len=p.get("hash_len", 32),
        type=argon2.low_level.Type.ID,
    )


# ---------------------------------------------------------------------------
# Session token
# ---------------------------------------------------------------------------

@dataclass
class _TokenRecord:
    token: str
    issued_at: float
    ttl_seconds: int
    unlock_method: str = "password"

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.issued_at) >= self.ttl_seconds


# ---------------------------------------------------------------------------
# SessionManager
# ---------------------------------------------------------------------------

class SessionManager:
    """
    Manages the vault session: key storage, token issuance, validation,
    rotation, expiry, and replay protection.

    Replaces the original bare Session class.
    """

    def __init__(self, ttl_seconds: int = TOKEN_TTL_SECONDS):
        self._key: Optional[bytearray] = None          # vault key — zeroed on lock
        self._token_record: Optional[_TokenRecord] = None
        self._ttl_seconds = ttl_seconds
        self._nonce_cache: Deque[str] = deque(maxlen=NONCE_CACHE_SIZE)
        self._failed_attempts: int = 0
        self._unlock_method: str = "password"
        self._lock_callbacks: list = []

    # ── Key storage ─────────────────────────────────────────────────────────

    def set_key(self, key: bytes, unlock_method: str = "password") -> None:
        """Store the derived vault key securely. Zeros any previous key."""
        self._zero_key()
        self._key = bytearray(key)
        self._unlock_method = unlock_method
        self._failed_attempts = 0

    def get_key(self) -> Optional[bytes]:
        """Returns the vault key as bytes, or None if locked."""
        if self._key is None:
            return None
        return bytes(self._key)

    @property
    def is_locked(self) -> bool:
        return self._key is None

    @property
    def unlock_method(self) -> str:
        """'password' | 'biometric' | 'pin' — for future unlock types."""
        return self._unlock_method

    # ── Token lifecycle ──────────────────────────────────────────────────────

    def issue_token(self) -> str:
        """Issue a fresh session token. Invalidates any existing token."""
        token = secrets.token_hex(TOKEN_BYTES)
        self._token_record = _TokenRecord(
            token=token,
            issued_at=time.monotonic(),
            ttl_seconds=self._ttl_seconds,
            unlock_method=self._unlock_method,
        )
        return token

    def rotate_token(self) -> str:
        """Issue a new token and invalidate the old one. Returns new token."""
        return self.issue_token()

    def validate_token(self, token: str) -> bool:
        """
        Validate a session token. Returns True only if:
        - Token matches the issued token (constant-time compare)
        - Token has not expired
        - Session is unlocked
        """
        if self.is_locked:
            return False
        if not self._token_record:
            return False
        if self._token_record.is_expired:
            return False
        return hmac.compare_digest(token, self._token_record.token)

    def consume_nonce(self, nonce: str) -> bool:
        """
        Check a request nonce for replay attacks.
        Returns True if nonce is fresh (not seen before).
        """
        if nonce in self._nonce_cache:
            return False
        self._nonce_cache.append(nonce)
        return True

    # ── Lock / unlock ────────────────────────────────────────────────────────

    def lock(self, reason: str = "") -> None:
        """Zero the key and invalidate the session. Fires lock callbacks."""
        self._zero_key()
        self._token_record = None
        for cb in self._lock_callbacks:
            try:
                cb(reason)
            except Exception:
                pass

    def clear(self) -> None:
        """Alias for lock() to support legacy calls."""
        self.lock()

    def record_failed_attempt(self) -> int:
        """Increment and return the failed attempt count."""
        self._failed_attempts += 1
        return self._failed_attempts

    def reset_failed_attempts(self) -> None:
        self._failed_attempts = 0

    @property
    def failed_attempts(self) -> int:
        return self._failed_attempts

    # ── Callbacks ────────────────────────────────────────────────────────────

    def add_lock_callback(self, cb) -> None:
        """Register a callback invoked when the vault locks. cb(reason: str)"""
        self._lock_callbacks.append(cb)

    # ── Internal ─────────────────────────────────────────────────────────────

    def _zero_key(self) -> None:
        if self._key is not None:
            zero_bytes(self._key)
            self._key = None


# ---------------------------------------------------------------------------
# Legacy compatibility shim (kept so existing import sites don't break)
# ---------------------------------------------------------------------------

class Session(SessionManager):
    """
    Backwards-compatible alias for SessionManager.
    Kept so existing code importing Session continues to work.
    Deprecated — prefer SessionManager directly.
    """
    def clear(self) -> None:
        """Legacy method name for lock()."""
        self.lock()
