"""
NorthLocker — unlock_providers.py
===================================
Extensible unlock provider abstraction.

Providers return the vault key on success or None on failure.
New providers (Windows Hello, PIN) slot in without touching core logic.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional


class UnlockProvider(ABC):
    @abstractmethod
    def is_available(self) -> bool:
        """Return True if this unlock method is usable on the current device."""

    @abstractmethod
    def authenticate(self, hint: str = "") -> Optional[bytes]:
        """
        Perform authentication and return the vault key, or None on failure.
        hint: optional display string shown to user (e.g. "Unlock NorthLocker")
        """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name for this provider."""


class PasswordUnlockProvider(UnlockProvider):
    """Current standard: Argon2id key derivation from master password."""

    def __init__(self, master_password: str, salt: bytes, kdf_params: dict):
        self._password = master_password
        self._salt = salt
        self._kdf_params = kdf_params

    @property
    def name(self) -> str:
        return "Master Password"

    def is_available(self) -> bool:
        return True

    def authenticate(self, hint: str = "") -> Optional[bytes]:
        try:
            from northlocker.core.auth import derive_key
            return derive_key(self._password, self._salt, self._kdf_params)
        except Exception:
            return None


class PinUnlockProvider(UnlockProvider):
    """
    Quick PIN unlock — wraps the vault key with a PIN-derived key.
    The wrapped key is stored in AppData (still encrypted).

    NOT YET IMPLEMENTED — interface stub only.
    """

    @property
    def name(self) -> str:
        return "Quick PIN"

    def is_available(self) -> bool:
        # Will be True once PIN setup is complete
        return False

    def authenticate(self, hint: str = "") -> Optional[bytes]:
        # TODO: unwrap vault key using PIN-derived HKDF key
        return None


class WindowsHelloProvider(UnlockProvider):
    """
    Windows Hello (fingerprint / face / PIN) via Windows CNG / WebAuthn API.

    NOT YET IMPLEMENTED — returns None until platform API is wired up.
    The vault key would be protected by DPAPI with Windows Hello confirmation.
    """

    @property
    def name(self) -> str:
        return "Windows Hello"

    def is_available(self) -> bool:
        # Future: check if Windows Hello is enrolled via ctypes WinRT API
        return False

    def authenticate(self, hint: str = "") -> Optional[bytes]:
        # Future: call Windows.Security.Credentials.UI.UserConsentVerifier
        return None


class BiometricUnlockProvider(UnlockProvider):
    """
    Cross-platform biometric stub.
    Delegates to the appropriate platform provider.
    """

    @property
    def name(self) -> str:
        return "Biometric"

    def is_available(self) -> bool:
        return self._platform_provider().is_available()

    def authenticate(self, hint: str = "") -> Optional[bytes]:
        return self._platform_provider().authenticate(hint)

    def _platform_provider(self) -> UnlockProvider:
        import platform
        if platform.system() == "Windows":
            return WindowsHelloProvider()
        # macOS: Touch ID via LocalAuthentication (future)
        # Linux: PAM biometric (future)
        return _NullProvider()


class _NullProvider(UnlockProvider):
    @property
    def name(self) -> str:
        return "None"
    def is_available(self) -> bool:
        return False
    def authenticate(self, hint: str = "") -> Optional[bytes]:
        return None
