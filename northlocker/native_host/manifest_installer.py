"""
NorthLocker — native_host/manifest_installer.py
================================================
Installs the Chrome Native Messaging host manifest.

Chrome requires a JSON manifest file at a registry key (Windows) or
filesystem path (macOS/Linux) to allow extensions to use native messaging.

Usage:
    python -m northlocker --install-native-host [--extension-id <id>]
"""
from __future__ import annotations

import json
import os
import platform
import sys
from pathlib import Path


NATIVE_HOST_NAME = "com.northlocker.host"


def get_host_script_path() -> Path:
    """Return the path where the native host launcher script should be placed."""
    from northlocker.utils.paths import get_native_host_dir
    return get_native_host_dir() / ("northlocker_host.bat" if platform.system() == "Windows" else "northlocker_host.sh")


def get_manifest_content(extension_id: str, host_script: Path) -> dict:
    """Build the native messaging manifest dict."""
    return {
        "name": NATIVE_HOST_NAME,
        "description": "NorthLocker Native Messaging Host",
        "path": str(host_script),
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{extension_id}/"
        ]
    }


def write_host_script(host_script: Path) -> None:
    """Write the launcher batch/shell script that Chrome will execute."""
    python_exe = sys.executable

    if platform.system() == "Windows":
        content = (
            "@echo off\n"
            f'"{python_exe}" -m northlocker.native_host.host\n'
        )
        host_script.write_text(content, encoding="utf-8")
    else:
        content = (
            "#!/bin/bash\n"
            f'exec "{python_exe}" -m northlocker.native_host.host\n'
        )
        host_script.write_text(content, encoding="utf-8")
        host_script.chmod(0o755)


def install_windows(manifest: dict) -> bool:
    """Write manifest to HKCU registry (Windows)."""
    try:
        import winreg
        from northlocker.utils.paths import get_native_host_dir
        manifest_path = get_native_host_dir() / f"{NATIVE_HOST_NAME}.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        reg_path = rf"Software\Google\Chrome\NativeMessagingHosts\{NATIVE_HOST_NAME}"
        key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path)
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest_path))
        winreg.CloseKey(key)

        # Also register for Chromium-based browsers (Edge, Brave, etc.)
        for browser_reg in [
            rf"Software\Microsoft\Edge\NativeMessagingHosts\{NATIVE_HOST_NAME}",
            rf"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\{NATIVE_HOST_NAME}",
        ]:
            try:
                k = winreg.CreateKey(winreg.HKEY_CURRENT_USER, browser_reg)
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, str(manifest_path))
                winreg.CloseKey(k)
            except Exception:
                pass

        return True
    except Exception as e:
        print(f"[NativeHost] Windows install failed: {e}")
        return False


def install_macos(manifest: dict) -> bool:
    """Write manifest to ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/"""
    try:
        host_dir = Path.home() / "Library/Application Support/Google/Chrome/NativeMessagingHosts"
        host_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = host_dir / f"{NATIVE_HOST_NAME}.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        print(f"[NativeHost] macOS install failed: {e}")
        return False


def install_linux(manifest: dict) -> bool:
    """Write manifest to ~/.config/google-chrome/NativeMessagingHosts/"""
    try:
        host_dir = Path.home() / ".config/google-chrome/NativeMessagingHosts"
        host_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = host_dir / f"{NATIVE_HOST_NAME}.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        print(f"[NativeHost] Linux install failed: {e}")
        return False


def install(extension_id: str) -> bool:
    """
    Install the native messaging host for the given Chrome extension ID.
    Writes launcher script and registers manifest with the OS/browser.

    Returns True on success.
    """
    host_script = get_host_script_path()
    write_host_script(host_script)

    manifest = get_manifest_content(extension_id, host_script)

    system = platform.system()
    if system == "Windows":
        ok = install_windows(manifest)
    elif system == "Darwin":
        ok = install_macos(manifest)
    else:
        ok = install_linux(manifest)

    if ok:
        print(f"[NativeHost] Installed successfully for extension: {extension_id}")
        print(f"[NativeHost] Host script: {host_script}")
    return ok


def uninstall() -> None:
    """Remove the native messaging host registration."""
    try:
        if platform.system() == "Windows":
            import winreg
            reg_path = rf"Software\Google\Chrome\NativeMessagingHosts\{NATIVE_HOST_NAME}"
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, reg_path)
    except Exception:
        pass
    print("[NativeHost] Uninstalled.")
