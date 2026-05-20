import os
import asyncio
from prompt_toolkit.layout.containers import HSplit, VSplit, Window, DynamicContainer
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.widgets import TextArea
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.filters import Condition, has_focus
from northlocker.ui.app import app_instance
from northlocker.utils.paths import get_vault_path
from northlocker.core.vault import load_vault, init_vault, InvalidMasterPassword, get_vault_key
from northlocker.core.generator import evaluate_strength
from northlocker.ui.components.layout import create_screen_layout
from northlocker.core.audit import AuditEvent, get_audit_service

BLOCK_FULL = '\u2588'
BLOCK_LIGHT = '\u2591'

def build_unlock(lock_message: str = ""):
    vault_path = get_vault_path()
    setup_mode = not os.path.exists(vault_path)
    
    state = {
        'error': lock_message,
        'success': "",
        'show_pass': False,
        'show_confirm': False,
        'processing': False
    }

    def get_strength_bar(password):
        if not password:
            return "Strength: [-] " + (BLOCK_LIGHT * 20), "fg:#626262"
        strength = evaluate_strength(password)
        bars = {
            "Weak": (5, "fg:#ff5f5f"),
            "Fair": (10, "fg:#ffff00"),
            "Strong": (15, "fg:#00afff"),
            "Very Strong": (20, "fg:#5fff87"),
        }
        filled_len, style = bars.get(strength, (0, "fg:#626262"))
        total = 20
        empty_len = total - filled_len
        bar = (BLOCK_FULL * filled_len) + (BLOCK_LIGHT * empty_len)
        return f"Strength: [{strength}] {bar}", style

    password_field = TextArea(password=Condition(lambda: not state['show_pass']), multiline=False)
    confirm_field = TextArea(password=Condition(lambda: not state['show_confirm']), multiline=False) if setup_mode else None

    def get_pass_prompt():
        c = "fg:#00afff" if app_instance.layout.has_focus(password_field) else "fg:#626262"
        return [(c, "  > ")]

    def get_conf_prompt():
        c = "fg:#00afff" if app_instance.layout.has_focus(confirm_field) else "fg:#626262"
        return [(c, "  > ")]

    password_field.window.content.get_line_prefix = lambda x, y: get_pass_prompt()
    password_field.window.style = lambda: "fg:#ffffff" if app_instance.layout.has_focus(password_field) else "fg:#626262"
    
    if confirm_field:
        confirm_field.window.content.get_line_prefix = lambda x, y: get_conf_prompt()
        confirm_field.window.style = lambda: "fg:#ffffff" if app_instance.layout.has_focus(confirm_field) else "fg:#626262"

    async def handle_success(msg):
        state['success'] = msg
        state['error'] = ""
        app_instance.application.invalidate()
        await asyncio.sleep(0.8)
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())

    def _store_session_key(password: str):
        """Read the salt from the vault file, derive the key, and store it in the session."""
        key = get_vault_key(vault_path, password)
        app_instance.session.set_key(key)
        # Best-effort: zero the password string from the TextArea buffer
        try:
            password_field.document = password_field.document.__class__('')
        except Exception:
            pass

    def attempt_unlock():
        if state['processing']: return
        
        password = password_field.text.strip()
        if setup_mode:
            confirm = confirm_field.text.strip()
            if password != confirm:
                state['error'] = "[!] Passwords do not match."
                return
            elif len(password) < 8:
                state['error'] = "[!] Password too short (min 8)."
                return
            else:
                try:
                    state['processing'] = True
                    init_vault(vault_path, password)
                    _store_session_key(password)
                    app_instance.vault_data = load_vault(vault_path, password)
                    app_instance.start_server()
                    get_audit_service().log(AuditEvent.VAULT_CREATED, {"method": "password"})
                    asyncio.create_task(handle_success("[+] Vault created."))
                except Exception as e:
                    state['error'] = f"[!] Error: {e}"
                    state['processing'] = False
        else:
            try:
                state['processing'] = True
                _store_session_key(password)
                app_instance.vault_data = load_vault(vault_path, password)
                app_instance.start_server()
                get_audit_service().log(AuditEvent.VAULT_UNLOCKED, {"method": "password"})
                asyncio.create_task(handle_success("[+] Vault unlocked."))
            except InvalidMasterPassword:
                state['processing'] = False
                app_instance.session.clear()
                attempts_left = app_instance.config.auto_lock_idle_minutes  # fallback
                remaining = 5 - app_instance.session.record_failed_attempt()
                get_audit_service().log(AuditEvent.UNLOCK_FAILED, {"remaining": remaining})
                if remaining <= 0:
                    app_instance.exit()
                else:
                    state['error'] = f"[!] Invalid master password. ({remaining} attempts left)"
            except Exception as e:
                state['processing'] = False
                app_instance.session.clear()
                state['error'] = f"[!] Error: {e}"

    kb = KeyBindings()
    
    @kb.add('enter', filter=has_focus(password_field))
    def _(event):
        if setup_mode:
            app_instance.layout.focus(confirm_field)
        else:
            attempt_unlock()

    if setup_mode:
        @kb.add('enter', filter=has_focus(confirm_field))
        def _(event):
            attempt_unlock()

    @kb.add('escape')
    @kb.add('c-c')
    def _(event):
        app_instance.exit()
        
    @kb.add('tab')
    def _(event):
        event.app.layout.focus_next()
        
    @kb.add('s-tab')
    def _(event):
        event.app.layout.focus_previous()
        
    @kb.add('c-r')
    def _(event):
        if app_instance.layout.has_focus(password_field):
            state['show_pass'] = not state['show_pass']
        elif setup_mode and app_instance.layout.has_focus(confirm_field):
            state['show_confirm'] = not state['show_confirm']

    def render_text(text, color="fg:#888888"):
        return Window(content=FormattedTextControl([(color, text)]), height=1)

    def render_field(label, field):
        def get_label_color():
            return "fg:#ffffff bold" if app_instance.layout.has_focus(field) else "fg:#626262"
        
        def render_label():
            return [(get_label_color(), f"  {label}")]
            
        def render_underline():
            c = "fg:#00afff" if app_instance.layout.has_focus(field) else "fg:#333333"
            return [(c, "    " + ("\u2500" * 46))]
            
        return HSplit([
            Window(content=FormattedTextControl(render_label), height=1),
            VSplit([Window(width=2), field], height=1),
            Window(content=FormattedTextControl(render_underline), height=1)
        ])

    def render_strength_row():
        text, style = get_strength_bar(password_field.text)
        return Window(content=FormattedTextControl([(style, f"    {text}")]), height=1)

    def render_attempts_row():
        remaining = max(0, 5 - app_instance.session.failed_attempts)
        color = "fg:#ff5f5f" if remaining <= 2 else "fg:#888888"
        text = f"    Attempts remaining: {remaining}"
        return Window(content=FormattedTextControl([(color, text)]), height=1)
        
    def render_message_row():
        if state['success']:
            return Window(content=FormattedTextControl([("fg:#5fff87", f"    {state['success']}")]), height=1)
        elif state['error']:
            return Window(content=FormattedTextControl([("fg:#ff5f5f", f"    {state['error']}")]), height=1)
        else:
            return Window(height=1)

    def render_autolock_row():
        label = app_instance.config.auto_lock_label()
        color = "fg:#626262" if label == "Disabled" else "fg:#888888"
        return Window(content=FormattedTextControl([(color, f"    Auto-lock: {label}")]), height=1)

    rows = []
    
    if setup_mode:
        rows.extend([
            render_text("  Create a master password to encrypt your vault."),
            render_text("  This password cannot be recovered if lost."),
            Window(height=2),
            render_field("Password", password_field),
            Window(height=1),
            render_field("Confirm Password", confirm_field),
            Window(height=1),
            DynamicContainer(render_strength_row),
            Window(height=1)
        ])
    else:
        rows.extend([
            render_text("  Enter your master password to unlock the vault."),
            Window(height=2),
            render_field("Password", password_field),
            Window(height=1),
            DynamicContainer(render_attempts_row),
            render_autolock_row(),
            Window(height=1)
        ])
        
    rows.extend([
        DynamicContainer(render_message_row)
    ])

    form_box = HSplit(rows, width=54)
    
    body = HSplit([
        Window(), 
        VSplit([ Window(), form_box, Window() ]),
        Window() 
    ], key_bindings=kb)
    
    if setup_mode:
        footer = "Ctrl+R:Show/Hide   Tab:Next   Enter:Submit   ESC:Quit"
    else:
        footer = "Ctrl+R:Show/Hide   Enter:Unlock   ESC:Quit"
    
    return create_screen_layout(
        title="NORTHLOCKER",
        body=body,
        right_header="SETUP" if setup_mode else "LOCKED: YES",
        footer_text=footer
    )
