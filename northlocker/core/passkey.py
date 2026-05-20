"""
NorthLocker — passkey.py
=========================
WebAuthn / FIDO2 credential lifecycle service (software implementation).

This module provides the PasskeyService interface for creating and asserting
passkey credentials stored inside the encrypted vault.

Architecture:
- Private keys are generated using P-256 (ES256) via the cryptography library
- Keys are serialized as PEM and stored base64-encoded inside PasskeyEntry
- The vault's AES-256-GCM layer encrypts all passkey data at rest
- sign_count is incremented on every assertion (replay detection per WebAuthn spec)
- Future: swap generate_key() internals for hardware-backed key via UnlockProvider
"""
from __future__ import annotations

import base64
import datetime
import os
import struct
import uuid
from dataclasses import dataclass
from typing import List, Optional

from cryptography.hazmat.primitives.asymmetric.ec import (
    ECDSA, EllipticCurvePrivateKey, generate_private_key, SECP256R1,
)
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend

from northlocker.core.entries import PasskeyEntry, VaultPayload
from northlocker.core.audit import AuditEvent, get_audit_service
from northlocker.core.domain_trust import DomainTrustService

_trust = DomainTrustService()


# ---------------------------------------------------------------------------
# Response types
# ---------------------------------------------------------------------------

@dataclass
class CredentialCreationResponse:
    credential_id: str          # base64url
    public_key_cbor: bytes      # COSE-encoded public key (for RP verification)
    aaguid: str                 # all-zeros for software authenticator
    attestation_object: bytes   # minimal packed attestation
    authenticator_data: bytes   # raw authenticatorData


@dataclass
class AssertionResponse:
    credential_id: str
    authenticator_data: bytes
    client_data_hash: bytes
    signature: bytes
    user_handle: str


# ---------------------------------------------------------------------------
# PasskeyService
# ---------------------------------------------------------------------------

class PasskeyService:
    """
    Software passkey authenticator.

    Stores credentials inside the NorthLocker vault (encrypted at rest).
    All operations require an unlocked VaultPayload.
    """

    # Software authenticator AAGUID (all zeros per FIDO spec for software)
    AAGUID = "00000000-0000-0000-0000-000000000000"

    # ── Credential creation ──────────────────────────────────────────────────

    def create_credential(
        self,
        vault: VaultPayload,
        rp_id: str,
        rp_name: str,
        user_id: bytes,
        user_name: str,
        challenge: bytes,
        algorithms: Optional[List[int]] = None,
    ) -> tuple[CredentialCreationResponse, PasskeyEntry]:
        """
        Generate a new P-256 keypair and create a PasskeyEntry.
        Returns (response_for_extension, entry_to_store_in_vault).

        The caller is responsible for appending the entry to vault.passkeys
        and saving the vault.
        """
        # Generate credential ID (random, opaque)
        raw_cred_id = os.urandom(32)
        credential_id = base64.urlsafe_b64encode(raw_cred_id).rstrip(b"=").decode()

        # Generate P-256 private key
        private_key = generate_private_key(SECP256R1(), default_backend())

        # Serialize private key as PEM, base64-encoded for vault storage
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        private_key_b64 = base64.b64encode(pem).decode()

        # Build standard public key in COSE format
        pub = private_key.public_key()
        pub_numbers = pub.public_key().public_numbers() if hasattr(pub, "public_key") else pub.public_numbers()
        x = pub_numbers.x.to_bytes(32, "big")
        y = pub_numbers.y.to_bytes(32, "big")
        
        cose_key = (
            b"\xa5"                 # Map of 5 items
            b"\x01\x02"             # 1 : 2 (kty : EC2)
            b"\x03\x26"             # 3 : -7 (alg : ES256)
            b"\x20\x01"             # -1 : 1 (crv : P-256)
            b"\x21\x58\x20" + x +   # -2 : x (32 bytes)
            b"\x22\x58\x20" + y     # -3 : y (32 bytes)
        )

        user_handle = base64.urlsafe_b64encode(user_id).rstrip(b"=").decode()

        # Build authenticator data (rpIdHash + flags + signCount + attestedCredentialData)
        import hashlib
        rp_id_hash = hashlib.sha256(rp_id.encode()).digest()
        flags = 0x45  # UP (user present) + UV (user verified) + AT (attested credential data present)
        sign_count = b"\x00\x00\x00\x00"
        
        attested_credential_data = (
            b"\x00" * 16 +          # AAGUID (16 bytes of zero)
            b"\x00\x20" +           # Credential ID length (32 bytes -> big endian uint16)
            raw_cred_id +           # Credential ID (32 bytes)
            cose_key                # Credential public key
        )
        
        auth_data = rp_id_hash + bytes([flags]) + sign_count + attested_credential_data
        
        # Build standard CBOR attestation object (none format)
        auth_data_len = len(auth_data)
        if auth_data_len < 256:
            auth_data_cbor = bytes([0x58, auth_data_len]) + auth_data
        else:
            auth_data_cbor = bytes([0x59]) + struct.pack(">H", auth_data_len) + auth_data
            
        attestation_object = (
            b"\xa3" +
            b"\x63fmt" + b"\x64none" +
            b"\x67attStmt" + b"\xa0" +
            b"\x68authData" + auth_data_cbor
        )

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        entry = PasskeyEntry(
            id=str(uuid.uuid4()),
            title=f"{rp_name} ({user_name})",
            type="passkey",
            rp_id=rp_id,
            rp_name=rp_name,
            credential_id=credential_id,
            user_handle=user_handle,
            private_key=private_key_b64,
            algorithm=-7,  # ES256
            sign_count=0,
            aaguid=self.AAGUID,
            transports=["internal"],
            created_at=now,
            updated_at=now,
        )

        response = CredentialCreationResponse(
            credential_id=credential_id,
            public_key_cbor=cose_key,
            aaguid=self.AAGUID,
            attestation_object=attestation_object,
            authenticator_data=auth_data,
        )

        get_audit_service().log(AuditEvent.PASSKEY_REGISTERED, {
            "id": entry.id, "rp_id": rp_id
        })

        return response, entry

    # ── Assertion ────────────────────────────────────────────────────────────

    def get_assertion(
        self,
        vault: VaultPayload,
        rp_id: str,
        challenge: bytes,
        credential_ids: Optional[List[str]] = None,
    ) -> Optional[AssertionResponse]:
        """
        Sign a WebAuthn challenge with the stored private key.
        Returns None if no matching credential found.
        """
        candidates = self.find_credentials(vault, rp_id)
        if not candidates:
            return None

        # If credential_ids filter provided, respect it
        if credential_ids:
            candidates = [c for c in candidates if c.credential_id in credential_ids]
        if not candidates:
            return None

        entry = candidates[0]  # Use first matching credential
        private_key = self._load_private_key(entry.private_key)
        if not private_key:
            return None

        # Build authenticator data (rpIdHash + flags + signCount)
        import hashlib
        rp_id_hash = hashlib.sha256(rp_id.encode()).digest()
        flags = 0x05  # UP (user present) + UV (user verified)
        sign_count = entry.sign_count + 1
        auth_data = rp_id_hash + bytes([flags]) + struct.pack(">I", sign_count)

        # Sign: authenticatorData || clientDataHash
        client_data_hash = hashlib.sha256(challenge).digest()
        signed_data = auth_data + client_data_hash
        signature = private_key.sign(signed_data, ECDSA(hashes.SHA256()))

        # Increment sign_count in vault
        entry.sign_count = sign_count
        entry.last_used = datetime.datetime.now(datetime.timezone.utc).isoformat()
        entry.update_timestamp()

        get_audit_service().log(AuditEvent.PASSKEY_USED, {
            "id": entry.id, "rp_id": rp_id, "sign_count": sign_count
        })

        return AssertionResponse(
            credential_id=entry.credential_id,
            authenticator_data=auth_data,
            client_data_hash=client_data_hash,
            signature=signature,
            user_handle=entry.user_handle,
        )

    # ── Vault operations ─────────────────────────────────────────────────────

    def store_credential(self, vault: VaultPayload, entry: PasskeyEntry) -> None:
        vault.passkeys.append(entry)

    def find_credentials(self, vault: VaultPayload, rp_id: str) -> List[PasskeyEntry]:
        """Find all passkeys for a given RP ID (exact match — WebAuthn spec)."""
        return [
            pk for pk in vault.passkeys
            if _trust.match_rp_id(pk.rp_id, rp_id)
        ]

    def delete_credential(self, vault: VaultPayload, credential_id: str) -> bool:
        before = len(vault.passkeys)
        vault.passkeys = [pk for pk in vault.passkeys if pk.credential_id != credential_id]
        return len(vault.passkeys) < before

    # ── Internal ─────────────────────────────────────────────────────────────

    def _load_private_key(self, private_key_b64: str) -> Optional[EllipticCurvePrivateKey]:
        try:
            pem = base64.b64decode(private_key_b64)
            return serialization.load_pem_private_key(pem, password=None, backend=default_backend())
        except Exception:
            return None


def _cose_kv(key: int, value: bytes) -> bytes:
    """Minimal COSE key-value stub. Replace with cbor2 in production."""
    return bytes([key & 0xFF]) + bytes([len(value)]) + value
