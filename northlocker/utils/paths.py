"""
NorthLocker — paths.py
======================
Centralised path resolution for all app data files.
"""
import os
import uuid
import pathlib


def get_app_dir() -> pathlib.Path:
    """Returns the path to the NorthLocker AppData directory."""
    appdata = os.environ.get("APPDATA")
    if appdata:
        base_dir = pathlib.Path(appdata)
    else:
        # Fallback for non-Windows or if APPDATA is missing
        base_dir = pathlib.Path.home() / ".config"

    app_dir = base_dir / "NorthLocker"
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


def get_vault_path() -> pathlib.Path:
    """Returns the path to the vault.nlk file."""
    return get_app_dir() / "vault.nlk"


def get_config_path() -> pathlib.Path:
    """Returns the path to the config.json file."""
    return get_app_dir() / "config.json"


def get_backup_dir() -> pathlib.Path:
    """Returns (and creates) the backup subdirectory."""
    bak_dir = get_app_dir() / "backups"
    bak_dir.mkdir(parents=True, exist_ok=True)
    return bak_dir


def get_audit_log_path() -> pathlib.Path:
    """Returns the path to the local audit log file."""
    return get_app_dir() / "audit.log"


def get_device_id_path() -> pathlib.Path:
    """Returns the path to the persistent device ID file."""
    return get_app_dir() / "device.id"


def get_device_id() -> str:
    """
    Returns a stable, machine-local device identifier.
    Generated once on first run, stored in plaintext (not sensitive).
    """
    id_path = get_device_id_path()
    if id_path.exists():
        try:
            return id_path.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    device_id = str(uuid.uuid4())
    try:
        id_path.write_text(device_id, encoding="utf-8")
    except Exception:
        pass
    return device_id


def get_native_host_dir() -> pathlib.Path:
    """Returns the directory where native messaging host scripts are placed."""
    host_dir = get_app_dir() / "native_host"
    host_dir.mkdir(parents=True, exist_ok=True)
    return host_dir
