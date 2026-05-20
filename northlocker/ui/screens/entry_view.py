import asyncio
from prompt_toolkit.layout.containers import Window, HSplit, VSplit
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout
from northlocker.ui.components.totp_display import create_totp_display
from northlocker.core.totp import get_totp_info
from northlocker.utils.clipboard import copy_to_clipboard

DIV_H = '\u2500'

def build_entry_view(entry):
    kb = KeyBindings()
    
    state = {'msg': ''}
    
    def cleanup_task():
        if hasattr(app_instance, 'totp_task') and app_instance.totp_task:
            app_instance.totp_task.cancel()
            app_instance.totp_task = None
    
    @kb.add('escape')
    def _(event):
        cleanup_task()
        from northlocker.ui.screens.search import build_search
        app_instance.set_screen(build_search())
        
    @kb.add('c')
    @kb.add('C')
    def _(event):
        if entry.password:
            copy_to_clipboard(entry.password, app_instance.config.clipboard_clear_seconds)
            state['msg'] = 'Password copied!'
            
    @kb.add('t')
    @kb.add('T')
    def _(event):
        if entry.totp_secret:
            data = get_totp_info(entry.totp_secret)
            if data:
                copy_to_clipboard(data[0].replace(" ", ""), app_instance.config.clipboard_clear_seconds)
                state['msg'] = 'TOTP copied!'
                
    @kb.add('u')
    @kb.add('U')
    def _(event):
        if entry.username:
            copy_to_clipboard(entry.username, app_instance.config.clipboard_clear_seconds)
            state['msg'] = 'Username copied!'
                
    @kb.add('e')
    @kb.add('E')
    def _(event):
        cleanup_task()
        from northlocker.ui.screens.entry_edit import build_entry_edit
        app_instance.set_screen(build_entry_edit(entry))
        
    @kb.add('d')
    @kb.add('D')
    def _(event):
        if entry in app_instance.vault_data.logins:
            app_instance.vault_data.logins.remove(entry)
        elif entry in app_instance.vault_data.notes:
            app_instance.vault_data.notes.remove(entry)
        from northlocker.core.vault import save_vault
        from northlocker.utils.paths import get_vault_path
        save_vault(get_vault_path(), app_instance.session.get_key(), app_instance.vault_data)
        cleanup_task()
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())
        
    def render_row(label, value_str, key_hint=""):
        def get_text():
            parts = [
                ("fg:#626262", "  "),
                ("fg:#ffffff", label.ljust(15)),
                ("fg:#00afff bold", value_str.ljust(30))
            ]
            if key_hint:
                parts.append(("fg:#626262", f"[{key_hint}]"))
            return parts
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_msg():
        return Window(content=FormattedTextControl(lambda: [("fg:#5fff87", f"  {state['msg']}") if state['msg'] else ("", "")]), height=1)

    focus_window = Window(
        content=FormattedTextControl("", focusable=True, key_bindings=kb),
        height=1
    )

    rows = [
        focus_window,
        render_row("Username", entry.username, "u" if entry.username else ""),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_row("Password", "*" * len(entry.password) if entry.password else "None", "c" if entry.password else ""),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_row("URL", entry.url),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_row("Notes", entry.notes),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        Window(height=1),
        render_msg()
    ]
    
    if entry.totp_secret:
        rows.extend([
            Window(height=1),
            Window(height=1, char=DIV_H, style="fg:#444444"),
            create_totp_display(lambda: get_totp_info(entry.totp_secret))
        ])
        
        async def update_totp():
            while True:
                await asyncio.sleep(1)
                app_instance.application.invalidate()
                
        app_instance.totp_task = asyncio.create_task(update_totp())
        
    rows.append(Window())
    
    body = HSplit(rows)
    
    padded_body = VSplit([
        Window(width=1),
        HSplit([body], width=58),
        Window()
    ])
    
    return create_screen_layout(
        title=entry.title.upper()[:20],
        body=padded_body,
        right_header="ENTRY VIEW",
        footer_text="e:Edit   d:Delete   c:Copy Pass   t:Copy TOTP   u:Copy User   ESC:Back"
    )
