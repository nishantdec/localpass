import pyotp
import time
from typing import Optional, Tuple

def get_totp_info(secret: str) -> Optional[Tuple[str, str, str, int]]:
    """
    Returns (current_code, code_in_30s, code_in_60s, seconds_remaining).
    Codes are formatted as "123 456".
    If secret is invalid, returns None.
    """
    if not secret:
        return None
    try:
        # Strip spaces from secret just in case
        secret = secret.replace(" ", "").upper()
        totp = pyotp.TOTP(secret)
        now = time.time()
        
        current_code = totp.at(now)
        next_code = totp.at(now + 30)
        next_next_code = totp.at(now + 60)
        
        # Calculate seconds remaining
        period = 30
        seconds_remaining = int(period - (now % period))
        if seconds_remaining == 0:
            seconds_remaining = period
            
        def format_code(c):
            return f"{c[:3]} {c[3:]}"
            
        return format_code(current_code), format_code(next_code), format_code(next_next_code), seconds_remaining
    except Exception:
        return None
