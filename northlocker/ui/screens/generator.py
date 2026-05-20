import asyncio
import string
from prompt_toolkit.layout.containers import Window, HSplit, VSplit
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout
from northlocker.core.generator import generate_password_with_minimums
from northlocker.utils.clipboard import copy_to_clipboard

DIV_H = '\u2500'
BOX_TL = '\u2554'
BOX_TR = '\u2557'
BOX_BL = '\u255a'
BOX_BR = '\u255d'
BOX_H  = '\u2550'
BOX_V  = '\u2551'

# Hardcoded defaults
_DEFAULT_LENGTH = 20
_DEFAULT_CLASSES = [
    {'label': 'Uppercase', 'key': 'u', 'chars': string.ascii_uppercase, 'enabled': True,  'minimum': 2},
    {'label': 'Lowercase', 'key': 'l', 'chars': string.ascii_lowercase, 'enabled': True,  'minimum': 2},
    {'label': 'Numbers',   'key': 'n', 'chars': string.digits,          'enabled': True,  'minimum': 2},
    {'label': 'Symbols',   'key': 's', 'chars': string.punctuation,     'enabled': True,  'minimum': 1},
]


def _load_classes_from_config() -> tuple[int, list[dict]]:
    """Load saved generator config if available; return (length, classes)."""
    gd = app_instance.config.generator_defaults
    if not gd or not gd.get('saved'):
        return _DEFAULT_LENGTH, [dict(c) for c in _DEFAULT_CLASSES]

    length = gd.get('length', _DEFAULT_LENGTH)
    key_map = {
        'uppercase': 0, 'lowercase': 1, 'numbers': 2, 'symbols': 3
    }
    classes = [dict(c) for c in _DEFAULT_CLASSES]
    for cfg_key, idx in key_map.items():
        if cfg_key in gd:
            classes[idx]['enabled'] = gd[cfg_key].get('enabled', True)
            classes[idx]['minimum'] = gd[cfg_key].get('minimum', 0)
    return length, classes


def _save_classes_to_config(length: int, classes: list[dict]) -> None:
    """Persist current generator settings to config."""
    app_instance.config.generator_defaults = {
        'saved': True,
        'length': length,
        'uppercase': {'enabled': classes[0]['enabled'], 'minimum': classes[0]['minimum']},
        'lowercase': {'enabled': classes[1]['enabled'], 'minimum': classes[1]['minimum']},
        'numbers':   {'enabled': classes[2]['enabled'], 'minimum': classes[2]['minimum']},
        'symbols':   {'enabled': classes[3]['enabled'], 'minimum': classes[3]['minimum']},
    }
    app_instance.config.save()


def build_generator():
    initial_length, initial_classes = _load_classes_from_config()
    classes = initial_classes

    state = {
        'length':     initial_length,
        'result':     '',
        'msg':        '',
        'capped':     False,
        'focused_row': 0,
        'remember':   bool(app_instance.config.generator_defaults and
                           app_instance.config.generator_defaults.get('saved')),
    }

    # ── Helpers ──────────────────────────────────────────────────────────────

    def total_minimums():
        return sum(c['minimum'] for c in classes if c['enabled'])

    def enforce_caps():
        total = total_minimums()
        if total > state['length']:
            state['capped'] = True
            for c in reversed(classes):
                if c['enabled'] and c['minimum'] > 0:
                    excess = total_minimums() - state['length']
                    if excess <= 0:
                        break
                    c['minimum'] -= min(c['minimum'], excess)
        else:
            state['capped'] = False

    def update_result():
        enforce_caps()
        state['msg'] = ''
        state['result'] = generate_password_with_minimums(state['length'], classes)
        if state['remember']:
            _save_classes_to_config(state['length'], classes)

    update_result()

    # ── Key bindings ─────────────────────────────────────────────────────────

    kb = KeyBindings()

    @kb.add('escape')
    def _(event):
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())

    @kb.add('r')
    @kb.add('R')
    def _(event):
        update_result()

    @kb.add('c')
    @kb.add('C')
    def _(event):
        if state['result']:
            copy_to_clipboard(state['result'], app_instance.config.clipboard_clear_seconds)
            state['msg'] = 'Copied to clipboard!'

    @kb.add('m')
    @kb.add('M')
    def _(event):
        state['remember'] = not state['remember']
        if state['remember']:
            _save_classes_to_config(state['length'], classes)
            state['msg'] = '[+] Generator settings saved.'
        else:
            # Clear saved defaults
            app_instance.config.generator_defaults = None
            app_instance.config.save()
            state['msg'] = 'Settings cleared.'

    @kb.add('c-d')
    def _(event):
        nonlocal classes
        state['length'] = _DEFAULT_LENGTH
        classes = [dict(c) for c in _DEFAULT_CLASSES]
        state['focused_row'] = 0
        if state['remember']:
            _save_classes_to_config(state['length'], classes)
        update_result()
        state['msg'] = 'Reset to defaults.'

    # Length controls
    @kb.add('+')
    @kb.add('=')
    def _(event):
        state['length'] = min(128, state['length'] + 1)
        update_result()

    @kb.add('-')
    @kb.add('_')
    def _(event):
        state['length'] = max(8, state['length'] - 1)
        update_result()

    # Row navigation
    @kb.add('up')
    def _(event):
        state['focused_row'] = (state['focused_row'] - 1) % len(classes)

    @kb.add('down')
    def _(event):
        state['focused_row'] = (state['focused_row'] + 1) % len(classes)

    # Minimum adjust for focused row
    @kb.add('right')
    @kb.add(']')
    def _(event):
        cls = classes[state['focused_row']]
        if cls['enabled']:
            cls['minimum'] = min(9, cls['minimum'] + 1)
            update_result()

    @kb.add('left')
    @kb.add('[')
    def _(event):
        cls = classes[state['focused_row']]
        if cls['enabled'] and cls['minimum'] > 0:
            cls['minimum'] -= 1
            update_result()

    # Class toggles
    def make_toggle(idx):
        def handler(event):
            classes[idx]['enabled'] = not classes[idx]['enabled']
            if not classes[idx]['enabled']:
                classes[idx]['minimum'] = 0
            update_result()
        return handler

    for i, cls in enumerate(classes):
        kb.add(cls['key'])(make_toggle(i))
        kb.add(cls['key'].upper())(make_toggle(i))

    # ── Render helpers ────────────────────────────────────────────────────────

    def render_result_box():
        def get_text():
            pw = state['result']
            display = (pw[:54] if len(pw) > 54 else pw).ljust(54)
            return [
                ("fg:#333333", BOX_TL + (BOX_H * 56) + BOX_TR + "\n"),
                ("fg:#333333", BOX_V),
                ("fg:#888888", "  Generated Password:".ljust(56)),
                ("fg:#333333", BOX_V + "\n"),
                ("fg:#333333", BOX_V),
                ("fg:#00afff bold", f"  {display}"),
                ("fg:#333333", BOX_V + "\n"),
                ("fg:#333333", BOX_BL + (BOX_H * 56) + BOX_BR),
            ]
        return Window(content=FormattedTextControl(get_text), height=4)

    def render_length_row():
        def get_text():
            return [
                ("fg:#626262", "  ["),
                ("fg:#00afff bold", "+/-"),
                ("fg:#626262", "]  "),
                ("fg:#ffffff", "Length".ljust(12)),
                ("fg:#00afff bold", str(state['length']).ljust(6)),
                ("fg:#626262", "  max:128  min:8"),
            ]
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_class_row(idx):
        cls = classes[idx]

        def get_text():
            focused  = (state['focused_row'] == idx)
            row_bg   = "bg:#003040 " if focused else ""
            key_col  = f"{row_bg}fg:#00afff bold"
            lbl_col  = f"{row_bg}fg:#ffffff" if focused else f"{row_bg}fg:#888888"
            tog_col  = f"{row_bg}fg:#5fff87" if cls['enabled'] else f"{row_bg}fg:#444444"
            btn_col  = f"{row_bg}fg:#00afff" if cls['enabled'] else f"{row_bg}fg:#333333"
            zero_col = f"{row_bg}fg:#555555"

            tog_str = "[X]" if cls['enabled'] else "[ ]"
            min_display = (btn_col, f" {cls['minimum']} ") if cls['minimum'] > 0 else (zero_col, " 0 ")

            return [
                (f"{row_bg}fg:#626262", "  ["),
                (key_col, cls['key']),
                (f"{row_bg}fg:#626262", "]  "),
                (lbl_col, cls['label'].ljust(12)),
                (tog_col, tog_str),
                (f"{row_bg}fg:#626262", "    Min: "),
                (btn_col, "[+]"),
                min_display,
                (btn_col, "[-]"),
            ]

        return Window(content=FormattedTextControl(get_text), height=1)

    def render_stats():
        def get_text():
            guaranteed    = total_minimums()
            remaining     = state['length'] - guaranteed
            enabled_count = sum(1 for c in classes if c['enabled'])
            return [
                ("fg:#626262", "  Guaranteed: "),
                ("fg:#ffffff",  f"{guaranteed} of {state['length']}"),
                ("fg:#626262",  " chars assigned\n"),
                ("fg:#626262", "  Remaining:  "),
                ("fg:#00afff",  f"{remaining}"),
                ("fg:#626262",  f" filled randomly from {enabled_count} enabled class(es)"),
            ]
        return Window(content=FormattedTextControl(get_text), height=2)

    def render_remember_row():
        def get_text():
            tog = "[X]" if state['remember'] else "[ ]"
            tog_col = "fg:#5fff87" if state['remember'] else "fg:#626262"
            return [
                ("fg:#626262", "  ["),
                ("fg:#00afff bold", "m"),
                ("fg:#626262", "]  "),
                ("fg:#888888", "Remember these settings  "),
                (tog_col, tog),
            ]
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_status():
        def get_text():
            if state['capped']:
                return [("fg:#ff5f5f", "  ! Minimums exceeded length. Values capped automatically.")]
            elif state['msg']:
                return [("fg:#5fff87", f"  {state['msg']}")]
            return [("", "")]
        return Window(content=FormattedTextControl(get_text), height=1)

    # Focus window — holds ALL keybindings
    focus_window = Window(
        content=FormattedTextControl("", focusable=True, key_bindings=kb),
        height=0
    )

    body = HSplit([
        focus_window,
        Window(height=1),
        render_result_box(),
        Window(height=1),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_length_row(),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_class_row(0),
        render_class_row(1),
        render_class_row(2),
        render_class_row(3),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_stats(),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_remember_row(),
        render_status(),
        Window(),
    ])

    padded_body = VSplit([
        Window(width=1),
        HSplit([body], width=58),
        Window()
    ])

    return create_screen_layout(
        title="GENERATOR",
        body=padded_body,
        right_header="LOCKED: NO",
        footer_text="r:Regen   c:Copy   m:Remember   Ctrl+D:Reset   u/l/n/s:Toggle   Up/Down:Row   [/]:Min   +/-:Len   ESC:Back"
    )
