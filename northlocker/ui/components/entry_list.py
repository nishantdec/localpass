from prompt_toolkit.layout.containers import Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.layout.margins import ScrollbarMargin
from typing import List, Callable, Any

class EntryList:
    def __init__(self, entries: List[Any], on_select: Callable[[Any], None]):
        self.entries = entries
        self.on_select = on_select
        self.selected_index = 0
        
        self.control = FormattedTextControl(
            self._get_formatted_text,
            focusable=True,
            key_bindings=self._get_key_bindings()
        )
        
        self.window = Window(
            content=self.control,
            style="class:list",
            right_margins=[ScrollbarMargin(display_arrows=True)],
            cursorline=True,
            wrap_lines=False
        )
        
    def _get_formatted_text(self):
        result = []
        for i, entry in enumerate(self.entries):
            # entry is expected to be an Entry model
            style = "class:list.selected reverse" if i == self.selected_index else "class:list.item"
            
            # Formatting
            title = entry.title.ljust(20)[:20]
            username = entry.username.ljust(25)[:25]
            flags = "[TOTP]" if entry.totp_secret else ""
            
            line = f"  {title}  {username}  {flags}".ljust(60)
            result.append((style, line))
            result.append(("", "\n"))
            
        if not self.entries:
            result.append(("class:muted", "  No entries found."))
            
        return result
        
    def _get_key_bindings(self):
        kb = KeyBindings()
        
        @kb.add("up")
        def _(event):
            self.selected_index = max(0, self.selected_index - 1)
            
        @kb.add("down")
        def _(event):
            self.selected_index = min(max(0, len(self.entries) - 1), self.selected_index + 1)
            
        @kb.add("enter")
        def _(event):
            if self.entries and 0 <= self.selected_index < len(self.entries):
                self.on_select(self.entries[self.selected_index])
                
        return kb

    def update_entries(self, entries: List[Any]):
        self.entries = entries
        self.selected_index = min(self.selected_index, max(0, len(self.entries) - 1))
