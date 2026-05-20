import os
from prompt_toolkit.layout.containers import HSplit, VSplit, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout
from northlocker.utils.paths import get_vault_path, get_app_dir

DIV_H = '\u2500'

# Idle timeout options (label, minutes)
IDLE_OPTIONS = [
    ("Never", 0),
    ("1 minute", 1),
    ("5 minutes", 5),
    ("15 minutes", 15),
    ("30 minutes", 30),
    ("1 hour", 60),
]

# Clipboard clear options (label, seconds)
CLIPBOARD_OPTIONS = [
    ("5 seconds", 5),
    ("10 seconds", 10),
    ("15 seconds", 15),
    ("30 seconds", 30),
    ("1 minute", 60),
    ("Never", 0),
]

# Settings rows (for Up/Down navigation)
ROWS = [
    "autolock_enabled",
    "autolock_timeout",
    "clipboard_clear",
]


def _find_option_idx(options: list, value) -> int:
    """Return the index of the option matching value, or 0 if not found."""
    for i, (_, v) in enumerate(options):
        if v == value:
            return i
    return 0


def build_settings():
    cfg = app_instance.config

    state = {
        'focused': 0,  # index into ROWS
        'idle_idx': _find_option_idx(IDLE_OPTIONS, cfg.auto_lock_idle_minutes),
        'clip_idx': _find_option_idx(CLIPBOARD_OPTIONS, cfg.clipboard_clear_seconds),
    }

    def save():
        cfg.save()

    # ── Keybindings ───────────────────────────────────────────────────────────

    kb = KeyBindings()

    @kb.add('escape')
    def _(event):
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())

    @kb.add('up')
    def _(event):
        state['focused'] = (state['focused'] - 1) % len(ROWS)

    @kb.add('down')
    @kb.add('tab')
    def _(event):
        state['focused'] = (state['focused'] + 1) % len(ROWS)

    @kb.add('space')
    @kb.add('enter')
    def _(event):
        row = ROWS[state['focused']]
        if row == 'autolock_enabled':
            cfg.auto_lock_enabled = not cfg.auto_lock_enabled
            save()

    @kb.add('right')
    def _(event):
        row = ROWS[state['focused']]
        if row == 'autolock_timeout':
            state['idle_idx'] = (state['idle_idx'] + 1) % len(IDLE_OPTIONS)
            cfg.auto_lock_idle_minutes = IDLE_OPTIONS[state['idle_idx']][1]
            save()
        elif row == 'clipboard_clear':
            state['clip_idx'] = (state['clip_idx'] + 1) % len(CLIPBOARD_OPTIONS)
            cfg.clipboard_clear_seconds = CLIPBOARD_OPTIONS[state['clip_idx']][1]
            save()

    @kb.add('left')
    def _(event):
        row = ROWS[state['focused']]
        if row == 'autolock_timeout':
            state['idle_idx'] = (state['idle_idx'] - 1) % len(IDLE_OPTIONS)
            cfg.auto_lock_idle_minutes = IDLE_OPTIONS[state['idle_idx']][1]
            save()
        elif row == 'clipboard_clear':
            state['clip_idx'] = (state['clip_idx'] - 1) % len(CLIPBOARD_OPTIONS)
            cfg.clipboard_clear_seconds = CLIPBOARD_OPTIONS[state['clip_idx']][1]
            save()

    # ── Render helpers ────────────────────────────────────────────────────────

    def section_header(title: str):
        def get_text():
            return [("fg:#ffffff bold", f"  {title}")]
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_row(row_key: str):
        def get_text():
            focused = (ROWS[state['focused']] == row_key)
            bg = "bg:#003040 " if focused else ""
            lbl_col = f"{bg}fg:#ffffff" if focused else f"{bg}fg:#888888"
            val_col = f"{bg}fg:#00afff bold"
            dim_col = f"{bg}fg:#626262"

            if row_key == 'autolock_enabled':
                tog = "[X]" if cfg.auto_lock_enabled else "[ ]"
                tog_col = f"{bg}fg:#5fff87" if cfg.auto_lock_enabled else f"{bg}fg:#444444"
                return [
                    (lbl_col, "  Enabled".ljust(28)),
                    (tog_col, tog),
                    (dim_col, "  Space/Enter to toggle"),
                ]

            elif row_key == 'autolock_timeout':
                label = IDLE_OPTIONS[state['idle_idx']][0]
                dim = "" if cfg.auto_lock_enabled else "  (enable auto-lock first)"
                v_col = val_col if cfg.auto_lock_enabled else f"{bg}fg:#444444"
                return [
                    (lbl_col, "  Idle timeout".ljust(28)),
                    (v_col, label),
                    (dim_col, dim),
                ]

            elif row_key == 'clipboard_clear':
                label = CLIPBOARD_OPTIONS[state['clip_idx']][0]
                return [
                    (lbl_col, "  Clear clipboard after".ljust(28)),
                    (val_col, label),
                ]

            return [("", "")]

        return Window(content=FormattedTextControl(get_text), height=1)

    def render_vault_info():
        vault_path = get_vault_path()
        num_entries = (len(app_instance.vault_data.logins) + len(app_instance.vault_data.notes)) if app_instance.vault_data else 0
        try:
            size_bytes = os.path.getsize(vault_path)
            if size_bytes < 1024:
                size_str = f"{size_bytes} B"
            else:
                size_str = f"{size_bytes / 1024:.1f} KB"
        except Exception:
            size_str = "Unknown"

        vault_str = str(vault_path)
        if len(vault_str) > 50:
            vault_str = "..." + vault_str[-47:]

        def get_text():
            return [
                ("fg:#888888", f"  Vault location".ljust(28)),
                ("fg:#626262", vault_str + "\n"),
                ("fg:#888888", f"  Vault size".ljust(28)),
                ("fg:#ffffff", size_str + "\n"),
                ("fg:#888888", f"  Total entries".ljust(28)),
                ("fg:#ffffff", str(num_entries)),
            ]
        return Window(content=FormattedTextControl(get_text), height=3)

    # Focus window
    focus_window = Window(
        content=FormattedTextControl("", focusable=True, key_bindings=kb),
        height=0
    )

    body = HSplit([
        focus_window,
        Window(height=1),
        section_header("AUTO-LOCK"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_row('autolock_enabled'),
        render_row('autolock_timeout'),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        Window(height=1),
        section_header("CLIPBOARD"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_row('clipboard_clear'),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        Window(height=1),
        section_header("VAULT"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_vault_info(),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        Window(),
    ])

    padded_body = VSplit([
        Window(width=1),
        HSplit([body], width=58),
        Window()
    ])

    return create_screen_layout(
        title="NORTHLOCKER",
        body=padded_body,
        right_header="SETTINGS",
        footer_text="Up/Down:Navigate   Space/Enter:Toggle   Left/Right:Adjust   ESC:Back"
    )
