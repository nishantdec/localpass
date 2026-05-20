import secrets
import string


def generate_password(length: int = 20, use_upper: bool = True, use_lower: bool = True, use_digits: bool = True, use_symbols: bool = True) -> str:
    pool = ""
    if use_upper:
        pool += string.ascii_uppercase
    if use_lower:
        pool += string.ascii_lowercase
    if use_digits:
        pool += string.digits
    if use_symbols:
        pool += string.punctuation

    if not pool:
        return ""

    # Guarantee at least one character from each selected class
    result = []
    if use_upper:
        result.append(secrets.choice(string.ascii_uppercase))
    if use_lower:
        result.append(secrets.choice(string.ascii_lowercase))
    if use_digits:
        result.append(secrets.choice(string.digits))
    if use_symbols:
        result.append(secrets.choice(string.punctuation))

    while len(result) < length:
        result.append(secrets.choice(pool))

    # Shuffle using secrets-based Fisher-Yates
    for i in range(len(result) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        result[i], result[j] = result[j], result[i]

    return "".join(result)[:length]


def generate_password_with_minimums(length: int, classes: list[dict]) -> str:
    """
    Generate a password with per-class guaranteed minimums.

    classes: list of dicts with keys:
        chars   : str   — character set for this class
        enabled : bool  — whether this class is active
        minimum : int   — guaranteed minimum count (0-9)

    Steps:
      1. Fill the guaranteed minimums first.
      2. Fill remaining slots from the combined pool of all enabled classes.
      3. Shuffle using secrets-based Fisher-Yates.
    """
    result: list[str] = []

    # Step 1: guarantee minimums
    for cls in classes:
        if cls["enabled"] and cls["minimum"] > 0:
            for _ in range(cls["minimum"]):
                result.append(secrets.choice(cls["chars"]))

    # Step 2: fill remaining from combined enabled pool
    pool = "".join(cls["chars"] for cls in classes if cls["enabled"])
    if not pool:
        return ""

    remaining = length - len(result)
    for _ in range(remaining):
        result.append(secrets.choice(pool))

    # Step 3: Fisher-Yates shuffle via secrets
    for i in range(len(result) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        result[i], result[j] = result[j], result[i]

    return "".join(result)

def evaluate_strength(password: str) -> str:
    """Returns Weak / Fair / Strong / Very Strong based on criteria."""
    length = len(password)
    classes = 0
    if any(c.isupper() for c in password): classes += 1
    if any(c.islower() for c in password): classes += 1
    if any(c.isdigit() for c in password): classes += 1
    if any(c in string.punctuation for c in password): classes += 1
    
    if length < 8 or classes <= 1:
        return "Weak"
    elif 8 <= length <= 11 and classes == 2:
        return "Fair"
    elif 12 <= length <= 15 and classes >= 3:
        return "Strong"
    elif length >= 16 and classes == 4:
        return "Very Strong"
    else:
        # Fallbacks for other combinations
        if length >= 12 and classes >= 3:
            return "Strong"
        elif length >= 8 and classes >= 2:
            return "Fair"
        return "Weak"
