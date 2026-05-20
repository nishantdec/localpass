from prompt_toolkit.layout.containers import HSplit, VSplit, Window
from prompt_toolkit.widgets import TextArea
from prompt_toolkit.key_binding import KeyBindings
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout
from northlocker.ui.components.entry_list import EntryList

DIV_H = '\u2500'

def build_search():
    def on_select(entry):
        from northlocker.ui.screens.entry_view import build_entry_view
        app_instance.set_screen(build_entry_view(entry))

    entries = (app_instance.vault_data.logins + app_instance.vault_data.notes) if app_instance.vault_data else []
    entry_list = EntryList(entries, on_select)
    
    def on_text_changed(buff):
        query = search_field.text.lower()
        if not query:
            filtered = entries
        else:
            filtered = [e for e in entries if query in e.title.lower() or query in getattr(e, 'username', '').lower()]
        entry_list.update_entries(filtered)
        
    search_field = TextArea(multiline=False, focus_on_click=True)
    search_field.buffer.on_text_changed += on_text_changed
    
    def get_prompt():
        c = "fg:#00afff" if app_instance.layout.has_focus(search_field) else "fg:#626262"
        return [(c, "  > ")]
        
    search_field.window.content.get_line_prefix = lambda x, y: get_prompt()
    search_field.window.style = lambda: "fg:#ffffff" if app_instance.layout.has_focus(search_field) else "fg:#626262"
    
    kb = KeyBindings()
    
    @kb.add('escape')
    def _(event):
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())
        
    @kb.add('tab')
    def _(event):
        if app_instance.layout.has_focus(search_field):
            app_instance.layout.focus(entry_list.control)
        else:
            app_instance.layout.focus(search_field)
            
    from prompt_toolkit.filters import Condition
    
    @kb.add('enter', filter=Condition(lambda: app_instance.layout.has_focus(search_field)))
    def _(event):
        if entry_list.entries:
            app_instance.layout.focus(entry_list.control)

    body = HSplit([
        Window(height=1),
        search_field,
        Window(height=1),
        Window(height=1, char=DIV_H, style="fg:#333333"),
        entry_list.window
    ], key_bindings=kb)
    
    return create_screen_layout(
        title="SEARCH",
        body=body,
        footer_text="Type to filter. Enter:Open   Tab:Select   ESC:Back"
    )
