from prompt_toolkit.layout.containers import HSplit, VSplit, Window, DynamicContainer
from prompt_toolkit.widgets import TextArea
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.filters import Condition
from northlocker.ui.app import app_instance
from northlocker.ui.components.layout import create_screen_layout
from northlocker.core.entries import Entry
from northlocker.core.vault import save_vault
from northlocker.utils.paths import get_vault_path
from northlocker.core.generator import generate_password, evaluate_strength

BLOCK_FULL = '\u2588'
BLOCK_LIGHT = '\u2591'

def build_entry_new():
    state = {'show_pass': False}
    
    title_field = TextArea(multiline=False)
    user_field = TextArea(multiline=False)
    pass_field = TextArea(multiline=False, password=Condition(lambda: not state['show_pass']))
    url_field = TextArea(multiline=False)
    totp_field = TextArea(multiline=False)
    notes_field = TextArea()
    
    # Allow TextArea style to be dynamic
    for field in [title_field, user_field, pass_field, url_field, totp_field, notes_field]:
        field.window.style = lambda f=field: "fg:#ffffff" if app_instance.layout.has_focus(f) else "fg:#626262"

    def get_strength_bar(password):
        if not password:
            return BLOCK_LIGHT * 20, "fg:#626262", "NONE"
        strength = evaluate_strength(password)
        if strength == "Weak":
            return (BLOCK_FULL * 5) + (BLOCK_LIGHT * 15), "fg:#ff5f5f", "WEAK"
        elif strength == "Fair":
            return (BLOCK_FULL * 10) + (BLOCK_LIGHT * 10), "fg:#ffff5f", "FAIR"
        elif strength == "Strong":
            return (BLOCK_FULL * 15) + (BLOCK_LIGHT * 5), "fg:#00afff", "STRONG"
        else:
            return (BLOCK_FULL * 20), "fg:#5fff87", "VERY STRONG"

    def render_divider(field_above, field_below=None):
        def get_text():
            c = "fg:#333333"
            if field_above and app_instance.layout.has_focus(field_above):
                c = "fg:#00afff"
            elif field_below and app_instance.layout.has_focus(field_below):
                c = "fg:#00afff"
            return [(c, "+" + ("-" * 56) + "+")]
        return Window(content=FormattedTextControl(get_text), height=1)

    def render_field_body(label, field, is_password=False):
        def get_border_color():
            return "fg:#00afff" if app_instance.layout.has_focus(field) else "fg:#333333"
            
        def get_label_color():
            return "fg:#ffffff bold" if app_instance.layout.has_focus(field) else "fg:#626262"
            
        def label_row():
            def get_text():
                l_color = get_label_color()
                b_color = get_border_color()
                if is_password:
                    hint = "Ctrl+G: Gen  Ctrl+R: Show"
                    spaces = 56 - 4 - len(label) - len(hint)
                    return [
                        (b_color, "|  "), (l_color, label), ("", " " * spaces),
                        ("fg:#626262", hint), (b_color, "  |")
                    ]
                else:
                    return [(b_color, "|  "), (l_color, label.ljust(54)), (b_color, "|")]
            return Window(content=FormattedTextControl(get_text), height=1)
            
        def input_row():
            def get_left():
                b_color = get_border_color()
                p_color = "fg:#00afff" if app_instance.layout.has_focus(field) else "fg:#626262"
                return [(b_color, "|  "), (p_color, "> [")]
                
            def get_right():
                b_color = get_border_color()
                p_color = "fg:#00afff" if app_instance.layout.has_focus(field) else "fg:#626262"
                return [(p_color, "] "), (b_color, "|")]

            return VSplit([
                Window(content=FormattedTextControl(get_left), width=5),
                field,
                Window(content=FormattedTextControl(get_right), width=3)
            ], height=1)
            
        rows = [label_row(), input_row()]
        
        if is_password:
            def strength_row():
                def get_text():
                    b_color = get_border_color()
                    bar_text, style, lbl = get_strength_bar(pass_field.text)
                    lbl_text = f"Strength: {lbl}".ljust(22)
                    spaces = 56 - 4 - len(lbl_text) - 20
                    return [
                        (b_color, "|  "),
                        ("fg:#888888", lbl_text),
                        (style, bar_text),
                        ("", " " * spaces),
                        (b_color, "  |")
                    ]
                return Window(content=FormattedTextControl(get_text), height=1)
            rows.append(DynamicContainer(strength_row))
            
        return HSplit(rows)

    kb = KeyBindings()

    # Ordered list of all fields for indexed navigation
    fields = [title_field, user_field, pass_field, url_field, totp_field, notes_field]

    @kb.add('escape')
    def _(event):
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())
        
    @kb.add('c-s')
    def _(event):
        if not title_field.text.strip():
            return
        from northlocker.core.entries import LoginEntry
        entry = LoginEntry(
            title=title_field.text.strip(),
            username=user_field.text.strip(),
            password=pass_field.text,
            url=url_field.text.strip(),
            totp_secret=totp_field.text.strip() or None,
            notes=notes_field.text.strip(),
            type="login"
        )
        app_instance.vault_data.logins.append(entry)
        save_vault(get_vault_path(), app_instance.session.get_key(), app_instance.vault_data)
        from northlocker.ui.screens.dashboard import build_dashboard
        app_instance.set_screen(build_dashboard())
        
    @kb.add('c-g')
    def _(event):
        if app_instance.layout.has_focus(pass_field):
            pass_field.text = generate_password()
            
    @kb.add('c-r')
    def _(event):
        if app_instance.layout.has_focus(pass_field):
            state['show_pass'] = not state['show_pass']
            
    @kb.add('tab')
    def _(event):
        event.app.layout.focus_next()
        
    @kb.add('s-tab')
    def _(event):
        event.app.layout.focus_previous()

    @kb.add('down')
    def _(event):
        event.app.layout.focus_next()

    @kb.add('up')
    def _(event):
        event.app.layout.focus_previous()

    # Number-key direct field jump — only when a TextArea is NOT currently focused
    def _is_field_focused():
        return any(app_instance.layout.has_focus(f) for f in fields)

    for _idx, _key in enumerate(['1', '2', '3', '4', '5', '6']):
        def _make_jump(idx):
            def _jump(event):
                if not _is_field_focused():
                    app_instance.layout.focus(fields[idx])
            return _jump
        kb.add(_key)(_make_jump(_idx))

    form = HSplit([
        Window(height=1),
        render_divider(None, title_field),
        render_field_body("Title", title_field),
        render_divider(title_field, user_field),
        render_field_body("Username", user_field),
        render_divider(user_field, pass_field),
        render_field_body("Password", pass_field, is_password=True),
        render_divider(pass_field, url_field),
        render_field_body("URL", url_field),
        render_divider(url_field, totp_field),
        render_field_body("TOTP Secret", totp_field),
        render_divider(totp_field, notes_field),
        render_field_body("Notes", notes_field),
        render_divider(notes_field, None),
        Window() # flexible space to push up
    ], key_bindings=kb)
    
    # Outer box padding to make it 58 width (for inner width of 56)
    # The total width is 60, side borders take 1 each. So inner is 58.
    # We want form to be exactly 58. The render_divider and label rows expect 58 width total.
    
    padded_form = VSplit([
        Window(width=1),
        HSplit([form], width=58),
        Window()
    ])
    
    return create_screen_layout(
        title="NEW ENTRY",
        body=padded_form,
        right_header="NEW ENTRY",
        footer_text="Arrows/Tab:Navigate   1-6:Jump to Field   Ctrl+S:Save   Ctrl+G:Gen   Ctrl+R:Show/Hide   ESC:Cancel"
    )
