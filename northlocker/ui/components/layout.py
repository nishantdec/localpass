from prompt_toolkit.layout.containers import HSplit, VSplit, Window, AnyContainer, FloatContainer, Float
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.layout.dimension import Dimension
from typing import List, Tuple, Callable

# Box drawing characters
BOX_TL = '\u2554'
BOX_TR = '\u2557'
BOX_BL = '\u255a'
BOX_BR = '\u255d'
BOX_H  = '\u2550'
BOX_V  = '\u2551'
DIV_L  = '\u255f' # ╟
DIV_R  = '\u2562' # ╢
DIV_H  = '\u2500'

def create_screen_layout(title: str, body: AnyContainer, footer_text: str = "", right_header: str = "") -> AnyContainer:
    """
    Creates a full-screen layout with double-line borders, a header, and a footer.
    """
    
    def side_border():
        return Window(width=1, char=BOX_V, style="fg:#444444")
        
    def top_border():
        return VSplit([
            Window(width=1, char=BOX_TL, style="fg:#444444"),
            Window(char=BOX_H, style="fg:#444444"),
            Window(width=1, char=BOX_TR, style="fg:#444444")
        ], height=1)
        
    def bottom_border():
        return VSplit([
            Window(width=1, char=BOX_BL, style="fg:#444444"),
            Window(char=BOX_H, style="fg:#444444"),
            Window(width=1, char=BOX_BR, style="fg:#444444")
        ], height=1)
        
    def divider():
        return VSplit([
            Window(width=1, char=DIV_L, style="fg:#444444"),
            Window(char=DIV_H, style="fg:#444444"),
            Window(width=1, char=DIV_R, style="fg:#444444")
        ], height=1)

    def header():
        # Header needs NORTHLOCKER on left, status on right
        def get_header_text():
            return [("fg:#00afff bold", f" {title} ")]
            
        def get_right_text():
            nonlocal right_header
            if not right_header:
                from northlocker.ui.app import app_instance
                right_header = "LOCKED: NO" if app_instance.vault_data else "LOCKED: YES"
                
            if "NO" in right_header.upper() or right_header == "SETUP" or "NEW ENTRY" in right_header.upper() or "EDIT ENTRY" in right_header.upper():
                color = "fg:#5fff87" if "NO" in right_header.upper() else "fg:#ffffff"
            else:
                color = "fg:#ff5f5f" # LOCKED: YES -> red
                
            return [(color, f" {right_header} ")]

        return VSplit([
            side_border(),
            Window(content=FormattedTextControl(get_header_text), dont_extend_width=True),
            Window(char=" "), # flexible space
            Window(content=FormattedTextControl(get_right_text), dont_extend_width=True),
            side_border()
        ], height=1)

    def footer():
        if not footer_text:
            return Window(height=0)
            
        # Parse footer text into styled segments
        # "n:New   s:Search" -> 'n' in cyan, ':New' in grey
        # Wait, the footer string is passed in, we can parse it simply.
        def get_footer_text():
            parts = footer_text.split("   ")
            styled = []
            for part in parts:
                if ":" in part:
                    key, desc = part.split(":", 1)
                    styled.append(("fg:#00afff", key))
                    styled.append(("fg:#626262", f":{desc}   "))
                else:
                    styled.append(("fg:#626262", f"{part}   "))
            return styled
            
        return Window(
            content=FormattedTextControl(get_footer_text),
            height=1,
            style="bg:#1a1a1a"
        )

    # Combine everything
    return HSplit([
        top_border(),
        header(),
        divider(),
        VSplit([
            side_border(),
            body,
            side_border()
        ]),
        bottom_border(),
        footer()
    ])
