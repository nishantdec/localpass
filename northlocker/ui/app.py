"""
NorthLocker — app.py
=====================
Application host: session, vault data, server lifecycle, idle lock.

Changes from previous version:
- VaultAdapter constructed with DI (session + lambda) — no more global coupling
- NorthLockerServer receives session object directly
- on_lock_callbacks list lets server/extension be notified on lock
- Audit events emitted on unlock and lock
"""
from __future__ import annotations

import time
import threading
from typing import Optional, List, Callable

from prompt_toolkit.application import Application
from prompt_toolkit.layout import Layout
from prompt_toolkit.layout.containers import HSplit, Window
from prompt_toolkit.styles import Style
from prompt_toolkit.key_binding import KeyBindings

from northlocker.core.auth import SessionManager
from northlocker.core.entries import VaultPayload
from northlocker.core.audit import AuditEvent, get_audit_service
from northlocker.utils.config import Config


class NorthLockerApp:
    def __init__(self):
        self.session = SessionManager()
        self.vault_data: Optional[VaultPayload] = None
        self.config = Config.load()
        self._last_activity: float = time.monotonic()
        self._idle_lock_thread: Optional[threading.Thread] = None
        self.server = None

        self.root_container = HSplit([Window()])
        self.layout = Layout(container=self.root_container)

        self.style = Style([
            ("header",       "bg:#00afff fg:#ffffff bold"),
            ("footer",       "bg:#626262 fg:#ffffff"),
            ("danger",       "fg:#ff5f5f"),
            ("success",      "fg:#5fff5f"),
            ("accent",       "fg:#00afff"),
            ("muted",        "fg:#626262"),
            ("border",       "fg:#626262"),
            ("frame.label",  "fg:#00afff bold"),
            ("frame.border", "fg:#626262"),
        ])

        self.global_kb = KeyBindings()
        self.application = Application(
            layout=self.layout,
            style=self.style,
            full_screen=True,
            mouse_support=False,
            key_bindings=self.global_kb,
        )
        self.application.key_processor.before_key_press += self._on_key_activity

        # Register session lock callback so server stops on lock
        self.session.add_lock_callback(self._on_session_locked)

    # ── Activity tracking ────────────────────────────────────────────────────

    def _on_key_activity(self, _sender=None):
        self._last_activity = time.monotonic()

    # ── Screen management ────────────────────────────────────────────────────

    def set_screen(self, screen_container):
        self.root_container.children = [screen_container]
        self.layout.focus(screen_container)
        if hasattr(self, "application") and self.application.is_running:
            self.application.invalidate()

    # ── Server lifecycle ─────────────────────────────────────────────────────

    def _make_adapter(self):
        """Build a VaultAdapter with proper DI — no global references."""
        from northlocker.core.adapter import VaultAdapter
        return VaultAdapter(
            session=self.session,
            get_vault=lambda: self.vault_data,
        )

    def start_server(self):
        """Start the local HTTP bridge for the browser extension."""
        from server.local_server import NorthLockerServer

        if self.server:
            try:
                self.server.stop()
            except Exception:
                pass

        try:
            self.server = NorthLockerServer(
                vault=self._make_adapter(),
                session=self.session,
                port=self.config.server_port,
            )
            self.server.start()
        except Exception:
            self.server = None

    def _on_session_locked(self, reason: str = "") -> None:
        """Called by SessionManager when the vault locks."""
        if self.server:
            try:
                self.server.stop()
            except Exception:
                pass
            self.server = None

    # ── Vault lock/unlock ────────────────────────────────────────────────────

    def lock_vault(self, reason: str = "") -> None:
        """Lock the vault: zero session key, clear data, go to unlock screen."""
        get_audit_service().log(AuditEvent.VAULT_LOCKED, {"reason": reason})
        self.vault_data = None
        self.session.lock(reason)   # triggers _on_session_locked → stops server
        from northlocker.ui.screens.unlock import build_unlock
        self.set_screen(build_unlock(lock_message=reason))

    def exit(self):
        if self.server:
            try:
                self.server.stop()
            except Exception:
                pass
        self.session.lock()
        self.application.exit()

    # ── Idle lock ────────────────────────────────────────────────────────────

    def start_idle_timer(self):
        if self._idle_lock_thread and self._idle_lock_thread.is_alive():
            return
        self._idle_lock_thread = threading.Thread(
            target=self._idle_lock_loop, daemon=True, name="idle-lock"
        )
        self._idle_lock_thread.start()

    def _idle_lock_loop(self):
        while True:
            time.sleep(10)
            if not self.application.is_running:
                break
            if not self.config.auto_lock_enabled:
                continue
            if self.vault_data is None:
                continue
            idle_limit = self.config.auto_lock_idle_minutes * 60
            if idle_limit <= 0:
                continue
            if (time.monotonic() - self._last_activity) >= idle_limit:
                try:
                    self.application.loop.call_soon_threadsafe(self._do_idle_lock)
                except Exception:
                    pass

    def _do_idle_lock(self):
        if self.vault_data is None:
            return
        self.lock_vault("Vault locked due to inactivity.")

    # ── Run ──────────────────────────────────────────────────────────────────

    def run(self):
        self.start_idle_timer()
        return self.application.run()


# Global singleton
app_instance = NorthLockerApp()
