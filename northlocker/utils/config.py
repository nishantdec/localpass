"""
NorthLocker — config.py
========================
User-facing configuration. Persisted to config.json in AppData.
"""
import json
from dataclasses import dataclass, field, asdict
from typing import Optional

from northlocker.utils.paths import get_config_path


@dataclass
class Config:
    # Clipboard
    clipboard_clear_seconds: int = 15

    # UI
    theme: str = "dark"

    # Auto-lock
    auto_lock_enabled: bool = False
    auto_lock_idle_minutes: int = 5

    # Session token expiry (in seconds). 0 = never expires (not recommended).
    session_token_ttl_hours: int = 8

    # Browser extension integration
    # "native_messaging" = preferred (no open port, Chrome NativeMessaging)
    # "localhost_http"   = legacy fallback
    extension_transport: str = "localhost_http"

    # Localhost HTTP server port (legacy transport only)
    server_port: int = 27432

    # Recovery & backup
    max_backups: int = 5
    auto_backup_on_save: bool = True

    # Password generator defaults
    generator_defaults: Optional[dict] = None

    @classmethod
    def load(cls) -> "Config":
        path = get_config_path()
        if not path.exists():
            return cls()
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            scalar_keys = {
                "clipboard_clear_seconds",
                "theme",
                "auto_lock_enabled",
                "auto_lock_idle_minutes",
                "session_token_ttl_hours",
                "extension_transport",
                "server_port",
                "max_backups",
                "auto_backup_on_save",
            }
            kwargs = {k: v for k, v in data.items() if k in scalar_keys}
            instance = cls(**kwargs)
            if "generator_defaults" in data and isinstance(data["generator_defaults"], dict):
                instance.generator_defaults = data["generator_defaults"]
            return instance
        except Exception:
            return cls()

    def save(self) -> None:
        path = get_config_path()
        d = asdict(self)
        if d.get("generator_defaults") is None:
            d.pop("generator_defaults", None)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, indent=2)

    def auto_lock_label(self) -> str:
        if not self.auto_lock_enabled or self.auto_lock_idle_minutes <= 0:
            return "Disabled"
        m = self.auto_lock_idle_minutes
        if m < 60:
            return f"Locks after {m} min idle"
        h = m // 60
        return f"Locks after {h}h idle"

    @property
    def session_token_ttl_seconds(self) -> int:
        return self.session_token_ttl_hours * 3600
