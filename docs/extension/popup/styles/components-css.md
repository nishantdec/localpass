[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Component Styles Reference: `docs/extension/popup/styles/components-css.md`

This document provides a highly detailed reference of the visual component stylesheets designed for the **localpass Chrome Extension**. It maps every utility selector, action item, interactive slider, and modal overlay declared inside `localpass-extension/popup/popup.css`.

---

## 1. Typography & Global Tokens
The layout imports Google Fonts and establishes design tokens in the `:root` pseudo-class. These elements maintain consistency across dark and light configurations.

### Tokens Defined in `:root` (Light / Dark Themes)

| Variable | Light Theme (Default) | Dark Theme (`html:not(.light)`) | Usage Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#ebecf0` | `#0c0d12` | Main page background |
| `--bg-surface` | `#ffffff` | `#161720` | Header, footer, and row backgrounds |
| `--bg-card` | `#f4f5f8` | `#1d1e28` | Form input backgrounds, pills, and containers |
| `--bg-hover` | `#e4e7f3` | `#252736` | Dynamic hover state for rows/buttons |
| `--bg-active` | `#d3defa` | `#1c2947` | Selected elements or button depress |
| `--border` | `#c4c9dd` | `#35374a` | Subtle separating borders |
| `--border-light` | `#a3aaba` | `#474a63` | Accentuated border highlight lines |
| `--accent` | `#3b72e8` | `#4f8ef7` | Primary action coloring (blue) |
| `--accent-hover` | `#2a5fd4` | `#6aa3ff` | Hover state for accent colors |
| `--text-primary`| `#0b0c10` | `#ffffff` | Main reading typography |
| `--text-secondary`| `#303548`| `#b5bcce` | Descriptive labels and subheaders |
| `--text-muted` | `#5e637a` | `#7a819c` | Placeholders, inactive items, and badges |
| `--success` | `#16a34a` | `#44ade80` | Confirmed actions, TOTP copying |
| `--warning` | `#b45309` | `#fbbf24` | Moderate risks, TOTP regeneration warnings |
| `--danger` | `#dc2626` | `#f87171` | Delete buttons, critical validation errors |
| `--radius` | `8px` | `8px` | Card/modal corner rounding |
| `--radius-sm` | `5px` | `5px` | Input/button corner rounding |

---

## 2. Interactive Component Styles

### A. Primary and Icon Action Buttons
These components provide interactive click zones within the headers and forms.

```css
/* Primary Header Button (e.g. "+ New") */
.nl-header-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.nl-header-btn-primary {
  background: var(--accent);
  color: #fff;
}

.nl-header-btn-primary:hover {
  background: var(--accent-hover);
}

/* Icon-Only Buttons */
.nl-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.nl-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

**Implementation Example:**
```html
<button class="nl-header-btn nl-header-btn-primary">
  <i class="ph ph-plus"></i> New
</button>
<button class="nl-icon-btn" id="nl-sync-btn">
  <i class="ph ph-arrows-counter-clockwise"></i>
</button>
```

---

### B. Contextual Dropdown Menus
Used when clicking elements like the "+ New" button to choose between different item creations (Logins vs. Passkeys).

```css
.nl-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  min-width: 160px;
  z-index: 9999;
  overflow: hidden;
  animation: nl-fade-in 0.12s ease;
}

.nl-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.12s;
}

.nl-dropdown-item:hover {
  background: var(--bg-hover);
}

.nl-dropdown-item.danger {
  color: var(--danger);
}

.nl-dropdown-item.danger i {
  color: var(--danger);
}

.nl-dropdown-item.danger:hover {
  background: #dc262610;
}

.nl-dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
```

**Implementation Example:**
```html
<div class="nl-dropdown">
  <div class="nl-dropdown-item" id="add-login"><i class="ph ph-key"></i> Add Login</div>
  <div class="nl-dropdown-item" id="add-passkey"><i class="ph ph-fingerprint"></i> Add Passkey</div>
  <div class="nl-dropdown-divider"></div>
  <div class="nl-dropdown-item danger" id="lock-vault"><i class="ph ph-lock"></i> Lock Vault</div>
</div>
```

---

### C. Password Strength Gauge
Provides interactive, real-time feedback when generating or typing passwords. The dynamic `.nl-strength-bar` adjusts its background and width according to the current strength level.

```css
.nl-strength-bar {
  height: 3px;
  border-radius: 2px;
  margin-top: 5px;
  transition: width 0.3s, background 0.3s;
  background: var(--border);
}

.nl-strength-label {
  font-size: 10px;
  margin-top: 3px;
  font-weight: 500;
}

/* Strength Modifier Levels */
.strength-weak {
  color: var(--danger);
}
.strength-fair {
  color: var(--warning);
}
.strength-strong {
  color: var(--accent);
}
.strength-very-strong {
  color: var(--success);
}
```

**Implementation Example:**
```html
<div class="nl-form-group">
  <label>Password</label>
  <input type="password" id="input-password" value="P@ss1" />
  <div class="nl-strength-bar" id="strength-bar" style="width: 25%; background-color: var(--danger);"></div>
  <span class="nl-strength-label strength-weak" id="strength-text">WEAK</span>
</div>
```

---

### D. Custom Form Switch Toggles
A modern slider switch replacement for checkbox options (such as "Include Numbers" or "Auto-fill").

```css
.nl-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.nl-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.nl-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-light);
  transition: .2s;
  border-radius: 18px;
}

.nl-slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .2s;
  border-radius: 50%;
}

input:checked + .nl-slider {
  background-color: var(--accent);
}

input:checked + .nl-slider:before {
  transform: translateX(14px);
}
```

**Implementation Example:**
```html
<div class="nl-gen-row">
  <label for="chk-numbers">Include Numbers</label>
  <label class="nl-switch">
    <input type="checkbox" id="chk-numbers" checked />
    <span class="nl-slider"></span>
  </label>
</div>
```

---

### E. Premium Modal Overlays
Standardized confirmation dialogs (such as "Confirm Delete" or "Unsaved Changes" notices) rendered with micro-animations and blurred backdrops.

```css
.nl-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: nl-fade-in 0.15s ease-out;
}

.nl-modal-container {
  width: 85%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: nl-modal-zoom 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes nl-modal-zoom {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.nl-modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.nl-modal-warn-icon {
  color: var(--danger);
  font-size: 18px;
}

.nl-modal-body {
  padding: 8px 16px 16px;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.nl-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
}
```

**Implementation Example:**
```html
<div class="nl-modal-overlay" id="delete-modal">
  <div class="nl-modal-container">
    <div class="nl-modal-header">
      <i class="ph ph-warning-circle nl-modal-warn-icon"></i>
      <span>Delete Entry</span>
    </div>
    <div class="nl-modal-body">
      Are you sure you want to permanently delete this credential from your vault? This operation is irreversible.
    </div>
    <div class="nl-modal-footer">
      <button class="nl-btn" id="confirm-cancel">Cancel</button>
      <button class="nl-btn nl-btn-danger" id="confirm-delete">Delete</button>
    </div>
  </div>
</div>
```

---

## 3. Micro-Animations and State Transitions

### Transition Matrix

| Action / Selector | Trigger Event | Animation Style | Expected Response |
| :--- | :--- | :--- | :--- |
| `.nl-entry-row` | Mouse Hover | `background 0.12s` | Subtle fade to `--bg-hover` |
| `.nl-dropdown` | Dynamic mounting | `nl-fade-in 0.12s ease` | Slide down and fade in |
| `.nl-modal-container` | Modal active | `nl-modal-zoom 0.15s cubic-bezier` | Bounce-zoom inward |
| `.nl-nav-item` | Switch tabs | `color 0.15s` | Text & icon transitions smoothly |
| `.nl-filter-select-wrap` | Interactive hover | `background/border-color 0.15s`| Soft highlight frame |
| `.nl-filter-caret` | Open filter | `transform 0.15s` | Rotate 180 degrees |
| `.nl-strength-bar` | Typing character | `width/background 0.3s` | Responsive structural slider movement |

---

## See Also
- [Popup](../popup.md)
- [Layout Css](layout-css.md)
- [Views Css](views-css.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*