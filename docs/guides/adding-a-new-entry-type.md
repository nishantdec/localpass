[Home](../../README.md) •
[Docs Index](../index.md) •
[Quick Start](../../QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Guide: Adding a New Entry Type

This developer guide provides a step-by-step tutorial on how to extend the localpass codebase to support a new vault entry type. To illustrate the process, we will walk through adding a new **Credit Card** (`credit_card`) entry type, modifying the backend schema, UI screens, adapter layer, and API endpoints.

---

## Step 1: Update the Core Entry Model

First, we define the schema for our new entry type in the core models file.

Open `localpass/core/entries.py` and implement the following additions:

### 1. Define the Dataclass
Create the `CreditCardEntry` class, inheriting from the base `Entry` class:

```python
@dataclass
class CreditCardEntry(Entry):
    cardholder_name: str = ""
    card_number: str = ""
    expiration_date: str = ""  # Format: MM/YYYY
    cvv: str = ""
    billing_address: str = ""

    def to_dict(self) -> dict:
        data = super().to_dict()
        data.update({
            "cardholder_name": self.cardholder_name,
            "card_number": self.card_number,
            "expiration_date": self.expiration_date,
            "cvv": self.cvv,
            "billing_address": self.billing_address
        })
        return data
```

### 2. Update the Payload Container
Add a list of credit cards to the `VaultPayload` dataclass and register the type loader inside the initialization parser:

```python
@dataclass
class VaultPayload:
    logins: List[LoginEntry] = field(default_factory=list)
    passkeys: List[PasskeyEntry] = field(default_factory=list)
    notes: List[SecureNoteEntry] = field(default_factory=list)
    credit_cards: List[CreditCardEntry] = field(default_factory=list) # <-- ADD THIS

    @classmethod
    def from_dict(cls, data: dict) -> "VaultPayload":
        payload = cls()
        # ... existing loaders ...
        
        # Load credit cards safely:
        if "credit_cards" in data:
            for item in data["credit_cards"]:
                payload.credit_cards.append(CreditCardEntry(
                    id=item.get("id"),
                    title=item.get("title", "Credit Card"),
                    cardholder_name=item.get("cardholder_name", ""),
                    card_number=item.get("card_number", ""),
                    expiration_date=item.get("expiration_date", ""),
                    cvv=item.get("cvv", ""),
                    billing_address=item.get("billing_address", ""),
                    created_at=item.get("created_at"),
                    updated_at=item.get("updated_at"),
                    notes=item.get("notes", "")
                ))
        return payload
```

---

## Step 2: Update the Vault Adapter Layer

The `VaultAdapter` abstracts operations like search, creation, and deletion. We need to update it to support the new `credit_card` type.

Open `localpass/core/adapter.py` and modify these key methods:

### 1. Update `get_entry()`
Ensure it searches across credit cards when resolving entries by ID:
```python
def get_entry(self, entry_id: str) -> Optional[Entry]:
    vault = self.get_vault()
    if not vault:
        return None
    for entry in vault.logins + vault.passkeys + vault.notes + vault.credit_cards:
        if entry.id == entry_id:
            return entry
    return None
```

### 2. Update `create_entry()`
Add support for instantiating the new model:
```python
def create_entry(self, entry_type: str, **kwargs) -> str:
    vault = self.get_vault()
    if not vault:
        raise ValueError("Vault is locked")
        
    if entry_type == "credit_card":
        entry = CreditCardEntry(
            id=str(uuid.uuid4()),
            title=kwargs.get("title", "New Credit Card"),
            cardholder_name=kwargs.get("cardholder_name", ""),
            card_number=kwargs.get("card_number", ""),
            expiration_date=kwargs.get("expiration_date", ""),
            cvv=kwargs.get("cvv", ""),
            notes=kwargs.get("notes", "")
        )
        vault.credit_cards.append(entry)
        self.save_vault()
        return entry.id
    # ... handle other types ...
```

---

## Step 3: Implement UI Fields in TUI Screens

We need to add our new entry type to the TUI's creation, edit, and detail screens.

### 1. Creation Screen (`localpass/ui/screens/entry_new.py`)
Add option selection items for the new `credit_card` type. Construct text input controls (e.g. using prompt_toolkit's `TextArea`) for the card fields:
```python
# In build_entry_new()
# Draw inputs for Cardholder Name, Card Number, Expiration (MM/YYYY), and CVV.
# Add a submission hook:
def save_new_card():
    app_instance.vault_data.credit_cards.append(CreditCardEntry(
        id=str(uuid.uuid4()),
        title=title_field.text,
        cardholder_name=cardholder_field.text,
        card_number=number_field.text,
        expiration_date=expiry_field.text,
        cvv=cvv_field.text,
        notes=notes_field.text
    ))
    # Save the updated vault and return to the dashboard
    app_instance._make_adapter().save_vault()
    app_instance.set_screen(build_dashboard())
```

### 2. View Screen (`localpass/ui/screens/entry_view.py`)
Add a custom card view panel inside `build_entry_view()`. For security, obfuscate the card number except for the last 4 digits (e.g., `•••• •••• •••• 4829`) and mask the CVV, adding shortcut keys (e.g. `c` to copy card number, `v` to copy CVV):
```python
# Custom display formatting for Credit Cards
def build_card_display(entry: CreditCardEntry):
    masked_number = f"•••• •••• •••• {entry.card_number[-4:]}" if len(entry.card_number) >= 4 else entry.card_number
    return HSplit([
        Window(content=FormattedTextControl([
            ("class:accent bold", f"  {entry.title.upper()}\n\n"),
            ("", "  Cardholder : "), ("class:success", f"{entry.cardholder_name}\n"),
            ("", "  Card Number: "), ("class:success", f"{masked_number}\n"),
            ("", "  Expires    : "), ("", f"{entry.expiration_date}\n"),
            ("", "  CVV        : "), ("class:danger", "•••\n\n"),
            ("class:muted", "  Press [c] to copy card number | [v] to copy CVV")
        ]))
    ])
```

---

## Step 4: Expose to the Local Server API

To make this data available to the browser extension (e.g. for automatic payment filling), we need to update our API endpoints.

Open `server/local_server.py` and modify the entry details handler:

### 1. Update `/entry` Endpoint
```python
def _handle_entry(self):
    # ... authorization token validation ...
    entry = self.vault.get_entry(eid)
    if isinstance(entry, CreditCardEntry):
        self._send_json(200, {
            "id": entry.id,
            "title": entry.title,
            "type": "credit_card",
            "cardholder_name": entry.cardholder_name,
            "card_number_masked": f"•••• •••• •••• {entry.card_number[-4:]}" if len(entry.card_number) >= 4 else entry.card_number,
            "expiration_date": entry.expiration_date,
            "notes": entry.notes
        })
```

### 2. Update `/fill` Endpoint
Expose the full, unmasked card details strictly when requested for secure form-filling:
```python
def _handle_fill(self):
    # ... authorization token validation ...
    entry = self.vault.get_entry(eid)
    if isinstance(entry, CreditCardEntry):
        self._send_json(200, {
            "cardholder_name": entry.cardholder_name,
            "card_number": entry.card_number,
            "expiration_date": entry.expiration_date,
            "cvv": entry.cvv
        })
```

---

## Step 5: Update the Chrome Extension UI

Finally, we update the extension popup to display and save credit cards.

### 1. Add View Elements (`localpass-extension/popup/popup.html`)
Add a new detailed view tab for displaying cards:
```html
<div id="nl-view-card" class="nl-view hidden">
  <div class="card-details">
    <h3 id="card-title"></h3>
    <p><strong>Cardholder:</strong> <span id="card-holder"></span></p>
    <p><strong>Number:</strong> <span id="card-num"></span> <button id="btn-copy-card">Copy</button></p>
    <p><strong>Expiry:</strong> <span id="card-expiry"></span></p>
    <p><strong>CVV:</strong> <span>•••</span> <button id="btn-copy-cvv">Copy</button></p>
  </div>
</div>
```

### 2. Update Popup Logic (`localpass-extension/popup/popup.js`)
Add routing and filling logic in popup controllers to parse the `"credit_card"` type, rendering the details panel when a user selects a card entry.

---

## See Also
- [Replicating The System](replicating-the-system.md)
- [Debugging](debugging.md)
- [Adding A New View](adding-a-new-view.md)
- [Adding A New Endpoint](adding-a-new-endpoint.md)
- [Building Exe](building-exe.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*