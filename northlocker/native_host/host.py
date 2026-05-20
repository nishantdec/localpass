"""
NorthLocker — native_host/host.py
===================================
Chrome Native Messaging host.

Security advantages over localhost HTTP:
- No open TCP port — communication is via stdin/stdout pipes
- Browser can only launch this host via Chrome-registered native manifest
- Immune to DNS rebinding, SSRF, port scanning
- Session token still required — defence-in-depth

Protocol: Chrome Native Messaging (length-prefixed JSON)
  [4-byte LE uint32 length][JSON bytes]

Usage:
  python -m northlocker.native_host.host

The host reads one JSON message per request and writes one JSON response.
It maintains the vault session for the lifetime of the process.
"""
from __future__ import annotations

import json
import os
import struct
import sys
from typing import Optional


# ---------------------------------------------------------------------------
# Low-level Chrome NativeMessaging I/O
# ---------------------------------------------------------------------------

def _read_message() -> Optional[dict]:
    """Read one length-prefixed JSON message from stdin."""
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack("<I", raw)[0]
    if length == 0 or length > 1_048_576:  # sanity cap: 1MB
        return None
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    try:
        return json.loads(data.decode("utf-8"))
    except Exception:
        return None


def _write_message(data: dict) -> None:
    """Write one length-prefixed JSON message to stdout."""
    encoded = json.dumps(data, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# ---------------------------------------------------------------------------
# Host state
# ---------------------------------------------------------------------------

class _HostState:
    """Holds vault session for the lifetime of the native host process."""

    def __init__(self):
        self._session = None
        self._vault_data = None
        self._adapter = None
        self._token: Optional[str] = None

    def _ensure_loaded(self) -> bool:
        """
        Try to connect to an already-unlocked NorthLocker vault session.
        The native host runs inside the NorthLocker process context when
        launched via the TUI, so it can import app_instance.
        Falls back to standalone mode (requires unlock via native host).
        """
        if self._adapter is not None:
            return True
        try:
            from northlocker.ui.app import app_instance
            if app_instance.vault_data is None:
                return False
            from northlocker.core.adapter import VaultAdapter
            self._session = app_instance.session
            self._adapter = VaultAdapter(
                session=app_instance.session,
                get_vault=lambda: app_instance.vault_data,
            )
            self._token = self._session.issue_token()
            return True
        except Exception:
            return False

    @property
    def locked(self) -> bool:
        return self._adapter is None or self._adapter.is_locked

    def validate_token(self, token: str) -> bool:
        if not self._session:
            return False
        return self._session.validate_token(token)

    def issue_token(self) -> Optional[str]:
        if not self._ensure_loaded():
            return None
        self._token = self._session.issue_token()
        return self._token

    @property
    def adapter(self):
        return self._adapter


_state = _HostState()


# ---------------------------------------------------------------------------
# Message dispatcher
# ---------------------------------------------------------------------------

def _dispatch(msg: dict) -> dict:
    msg_type = msg.get("type", "")
    req_id = msg.get("id")

    def resp(data: dict) -> dict:
        if req_id is not None:
            data["id"] = req_id
        return data

    # Token-free endpoints
    if msg_type == "PING":
        return resp({"ok": True, "locked": _state.locked})

    if msg_type == "HANDSHAKE":
        if _state.locked:
            if not _state._ensure_loaded():
                return resp({"ok": False, "error": "vault_locked"})
        token = _state.issue_token()
        if not token:
            return resp({"ok": False, "error": "vault_locked"})
        return resp({"ok": True, "token": token})

    # All other messages require a valid token
    token = msg.get("token", "")
    if not token or not _state.validate_token(token):
        return resp({"ok": False, "error": "unauthorized"})

    adapter = _state.adapter
    if adapter is None:
        return resp({"ok": False, "error": "vault_locked"})

    if msg_type == "GET_CREDENTIALS":
        entries = adapter.find_by_domain(msg.get("domain", ""))
        return resp({"ok": True, "entries": [
            {"id": e.id, "title": e.title,
             "username": getattr(e, "username", ""),
             "type": e.type,
             "has_totp": bool(getattr(e, "totp_secret", None)),
             "url": getattr(e, "url", ""),
             "preferred": getattr(e, "preferred", False),
             "last_used": getattr(e, "last_used", None)}
            for e in entries
        ]})

    if msg_type == "SEARCH":
        entries = adapter.search(msg.get("query", ""))
        return resp({"ok": True, "entries": [
            {"id": e.id, "title": e.title,
             "username": getattr(e, "username", ""),
             "type": e.type,
             "url": getattr(e, "url", ""),
             "preferred": getattr(e, "preferred", False),
             "last_used": getattr(e, "last_used", None)}
            for e in entries
        ]})

    if msg_type == "GET_FILL":
        entry = adapter.get_entry(msg.get("id", ""))
        if not entry:
            return resp({"ok": False, "error": "entry_not_found"})
        return resp({"ok": True,
                     "username": getattr(entry, "username", ""),
                     "password": getattr(entry, "password", "")})

    if msg_type == "GET_TOTP":
        entry = adapter.get_entry(msg.get("id", ""))
        if not entry or not getattr(entry, "totp_secret", None):
            return resp({"ok": False, "error": "no_totp"})
        code, secs = adapter.generate_totp(entry.totp_secret)
        return resp({"ok": True, "code": code, "seconds_remaining": secs})

    if msg_type == "SAVE_ENTRY":
        e = msg.get("entry", {})
        eid = adapter.create_entry(
            title=e.get("title", ""), username=e.get("username", ""),
            password=e.get("password", ""), url=e.get("url", ""),
            entry_type=e.get("type", "login"), totp_secret=e.get("totp_secret", ""),
        )
        return resp({"ok": True, "id": eid})

    if msg_type == "UPDATE_ENTRY":
        e = msg.get("entry", {})
        ok = adapter.update_entry(
            e.get("id", ""), title=e.get("title"), username=e.get("username"),
            password=e.get("password"), url=e.get("url"),
            entry_type=e.get("type"), totp_secret=e.get("totp_secret"),
            notes=e.get("notes"),
        )
        return resp({"ok": ok})

    if msg_type == "DELETE_ENTRY":
        ok = adapter.delete_entry(msg.get("id", ""))
        return resp({"ok": ok})

    if msg_type == "INCREMENT_USAGE":
        ok = adapter.increment_usage(msg.get("id", ""))
        return resp({"ok": ok})

    if msg_type == "GET_PASSKEYS":
        passkeys = adapter.find_passkeys(msg.get("rp_id", ""))
        return resp({"ok": True, "passkeys": [
            {"id": p.id, "title": p.title, "rp_id": p.rp_id,
             "credential_id": p.credential_id}
            for p in passkeys
        ]})

    if msg_type == "PASSKEY_REGISTER":
        try:
            res = adapter.create_passkey(
                rp_id=msg.get("rp_id", ""),
                rp_name=msg.get("rp_name", ""),
                user_id_b64=msg.get("user_id_b64", ""),
                user_name=msg.get("user_name", ""),
                challenge_b64=msg.get("challenge_b64", ""),
            )
            return resp({"ok": True, "credential": res})
        except Exception as e:
            return resp({"ok": False, "error": str(e)})

    if msg_type == "PASSKEY_SIGN":
        try:
            res = adapter.sign_passkey(
                rp_id=msg.get("rp_id", ""),
                challenge_b64=msg.get("challenge_b64", ""),
                credential_ids=msg.get("credential_ids"),
            )
            if not res:
                return resp({"ok": False, "error": "no_matching_passkey"})
            return resp({"ok": True, "assertion": res})
        except Exception as e:
            return resp({"ok": False, "error": str(e)})

    if msg_type == "COPY":
        entry = adapter.get_entry(msg.get("id", ""))
        if not entry:
            return resp({"ok": False, "error": "entry_not_found"})
        field = msg.get("field", "")
        if field == "password":
            adapter.copy_to_clipboard(getattr(entry, "password", ""))
        elif field == "totp" and getattr(entry, "totp_secret", None):
            code, _ = adapter.generate_totp(entry.totp_secret)
            adapter.copy_to_clipboard(code)
        return resp({"ok": True})

    return resp({"ok": False, "error": "unknown_message_type"})


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run() -> None:
    """Main native messaging host loop. Reads until stdin closes."""
    while True:
        msg = _read_message()
        if msg is None:
            break
        try:
            response = _dispatch(msg)
        except Exception as exc:
            response = {"ok": False, "error": "internal_error", "detail": str(exc)}
            if msg.get("id") is not None:
                response["id"] = msg["id"]
        _write_message(response)


if __name__ == "__main__":
    run()
