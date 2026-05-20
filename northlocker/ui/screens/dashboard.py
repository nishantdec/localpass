from prompt_toolkit.layout.containers import Window, HSplit
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout

DIV_H = '\u2500'

def build_dashboard():
    kb = KeyBindings()
    
    @kb.add('n')
    @kb.add('N')
    def _(event):
        from northlocker.ui.screens.entry_new import build_entry_new
        app_instance.set_screen(build_entry_new())
        
    @kb.add('s')
    @kb.add('S')
    def _(event):
        from northlocker.ui.screens.search import build_search
        app_instance.set_screen(build_search())
        
    @kb.add('g')
    @kb.add('G')
    def _(event):
        from northlocker.ui.screens.generator import build_generator
        app_instance.set_screen(build_generator())
        
    @kb.add('l')
    @kb.add('L')
    def _(event):
        from northlocker.ui.screens.unlock import build_unlock
        app_instance.vault_data = None
        app_instance.session.clear()
        app_instance.set_screen(build_unlock())

    @kb.add('t')
    @kb.add('T')
    def _(event):
        from northlocker.ui.screens.settings import build_settings
        app_instance.set_screen(build_settings())
        
    @kb.add('q')
    @kb.add('Q')
    @kb.add('escape')
    def _(event):
        app_instance.exit()


    def render_menu_row(key, action, desc):
        def get_text():
            return [
                ("fg:#626262", "  ["),
                ("fg:#00afff bold", key),
                ("fg:#626262", "]  "),
                ("fg:#ffffff bold", action.ljust(15)),
                ("fg:#626262", desc)
            ]
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_stat_row(label, value_func):
        def get_text():
            return [
                ("fg:#626262", f"  {label.ljust(18)}: "),
                ("fg:#ffffff", str(value_func()))
            ]
        return Window(content=FormattedTextControl(get_text), height=1)

    def get_num_entries():
        return (len(app_instance.vault_data.logins) + len(app_instance.vault_data.notes)) if app_instance.vault_data else 0

    # The focusable window must have height > 0 to actually be focusable,
    # and keybindings must be on the control, not the HSplit container.
    focus_window = Window(
        content=FormattedTextControl("", focusable=True, key_bindings=kb),
        height=1
    )

    body = HSplit([
        focus_window,
        render_menu_row("N", "New Entry", "Add a new login, note or TOTP"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_menu_row("S", "Search", "Find and view saved entries"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_menu_row("G", "Generate", "Generate a secure password"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_menu_row("L", "Lock", "Lock the vault and clear session"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_menu_row("T", "Settings", "Configure auto-lock and clipboard"),
        Window(char=DIV_H, height=1, style="fg:#333333"),
        render_menu_row("Q", "Quit", "Exit NorthLocker"),
        
        Window(height=2),
        Window(char=DIV_H, height=1, style="fg:#444444"),
        Window(height=1),
        
        render_stat_row("Vault entries", get_num_entries),
        render_stat_row("Last unlocked", lambda: "Just now"),
        render_stat_row("Auto-backup", lambda: "Disabled"),
        Window()
    ])
    
    return create_screen_layout(
        title="NORTHLOCKER",
        body=body,
        right_header="LOCKED: NO",
        footer_text="n:New   s:Search   g:Generate   t:Settings   l:Lock   q:Quit"
    )

