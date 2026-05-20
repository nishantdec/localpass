[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# Popup Layout CSS Specifications

## 1. Overview and Purpose
The layout styling for the localpass browser extension popup implements a modern, card-driven, themeable user interface. Relying strictly on vanilla CSS, the styling engine uses dynamic custom properties (CSS variables) to support dark and light modes, fluid transitions, and size classes. It provides a visual hierarchy built on modern typography, harmonize color palettes, and glassmorphic elements to ensure an excellent user experience.

---

## 2. File Location and Core Files
*   **Source Stylesheet:** `localpass-extension/popup/popup.css` (Lines 1–1675)
*   **Target Output File:** `docs/extension/popup/styles/layout-css.md`
*   **Dependencies:**
    *   Google Font API: `Manrope` (weights 500, 600, 700, 800) for standard layout copy.
    *   NPM `@fontsource/geist-mono` (weight 400) for password displays and cryptographic keys.
    *   Phosphor Icons Webfont for icon-driven actions and navigation lists.

---

## 3. Design Tokens & Color Palettes

The styling engine uses CSS custom variables to manage colors, spacing, typography, and shadows. The layout defaults to a dark mode, switching to light mode when the `html` element has the `.light` class.

### 3.1. Typography and Sizing Variables
*   **Standard Layout Font Family (`--font`):** `'Manrope', 'Segoe UI', system-ui, -apple-system, sans-serif`
*   **Monospace Font Family (`--font-mono`):** `'GeistMono', 'GeistMonoVariable', 'Courier New', monospace`
*   **Outer Component Border Radius (`--radius`):** `8px`
*   **Inner Form Element Border Radius (`--radius-sm`):** `5px`

### 3.2. Color Palettes (Light vs. Dark Mode Tokens)

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role / Description |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#ebecf0` | `#0c0d12` | Background of the outer app container and search bars. |
| `--bg-surface` | `#ffffff` | `#161720` | Base color for primary components (header, footer, entries). |
| `--bg-card` | `#f4f5f8` | `#1d1e28` | Background for interactive item cards and details. |
| `--bg-hover` | `#e4e7f3` | `#252736` | Background color for hovered list items or icon buttons. |
| `--bg-active` | `#d3defa` | `#1c2947` | Background color for active navigation states. |
| `--border` | `#c4c9dd` | `#35374a` | Border color for standard card elements and inputs. |
| `--border-light`| `#a3aaba` | `#474a63` | Accent border color for focused states. |
| `--accent` | `#3b72e8` | `#4f8ef7` | Primary color for buttons, links, and active elements. |
| `--accent-hover`| `#2a5fd4` | `#6aa3ff` | Darker/lighter accent for hover states. |
| `--text-primary`| `#0b0c10` | `#ffffff` | High contrast color for body text and headings. |
| `--text-secondary`| `#303548`| `#b5bcce` | Medium contrast color for descriptive labels. |
| `--text-muted` | `#5e637a` | `#7a819c` | Muted text color for timestamps and captions. |
| `--success` | `#16a34a` | `#4ade80` | Accent color for successful actions and secure state indicators. |
| `--warning` | `#b45309` | `#fbbf24` | Warning color for weak passwords or low timers. |
| `--danger` | `#dc2626` | `#f87171` | Accent color for destructive actions. |
| `--shadow` | `rgba(0, 0, 0, 0.08)`| `rgba(0, 0, 0, 0.5)`| Soft shadow for light mode, deep shadow for dark mode. |

---

## 4. Reset & Core Structural Styles

To prevent styling conflicts across different browsers, a global box-sizing reset is applied to all elements:

```css
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

The root document and the parent application wrapper use fixed layout boundaries:

```css
html,
body {
  width: 420px;
  height: 580px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-base);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

#nl-app {
  display: flex;
  flex-direction: column;
  width: 420px;
  height: 580px;
  background: var(--bg-base);
  overflow: hidden; /* Restricts vertical overflowing */
}
```

---

## 5. Responsive Sizing Preset Mappings

To accommodate different monitor resolutions and user preferences, the popup can resize dynamically. This is controlled by applying a class to the `html` element, which updates the width and height of the popup:

```css
/* Compact Preset */
html.size-compact,
html.size-compact body,
html.size-compact #nl-app {
  width: 360px;
  height: 500px;
}

/* Default Preset */
html.size-default,
html.size-default body,
html.size-default #nl-app {
  width: 420px;
  height: 580px;
}

/* Wider Preset */
html.size-wider,
html.size-wider body,
html.size-wider #nl-app {
  width: 480px;
  height: 600px;
}

/* Extra Wide Preset */
html.size-extra-wide,
html.size-extra-wide body,
html.size-extra-wide #nl-app {
  width: 560px;
  height: 600px;
}
```

---

## 6. Structural Component & Block Styles

### 6.1. Header Panel Layout
*   **Selector:** `#nl-header`
*   **Flex Settings:** Flexbox row layout, auto-fitting items.
*   **Header Buttons:**
    *   `.nl-header-btn-primary`: Renders with primary accent fills (`var(--accent)`). Hovering triggers transitions to `var(--accent-hover)`.
    *   `.nl-icon-btn`: Styled with transparent backgrounds. Hovering triggers transitions to `var(--bg-hover)`, changing the icon color from `var(--text-muted)` to `var(--text-primary)`.

### 6.2. Custom Content Scroller
*   **Selector:** `#nl-content`
*   **Overflow Settings:** `overflow-y: auto`, displaying natural scrolls inside list groups.
*   **Webkit Custom Scrollbars:**
    ```css
    #nl-content::-webkit-scrollbar {
      width: 4px;
    }
    #nl-content::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }
    #nl-content::-webkit-scrollbar-thumb:hover {
      background: var(--border-light);
    }
    ```

### 6.3. Entry List Cards
*   **Class:** `.nl-entry-row`
*   **Layout:** Flexbox row layout, containing icons/favicons (`.nl-entry-avatar`), labels (`.nl-entry-name`), subtitles (`.nl-entry-sub`), and action buttons (`.nl-action-btn`).
*   **Interactive Transition:**
    ```css
    .nl-entry-row {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      transition: background 0.12s ease-in-out;
    }
    .nl-entry-row:hover {
      background: var(--bg-hover);
    }
    ```

---

## 7. Form Groups & Interactive Controls

### 7.1. Label & Input Structure
*   **Class:** `.nl-form-group`
*   **Layout:** Flexbox column layout.
*   **Child Label Fields:** Styled in uppercase with a font-size of `10px`, bold weight `700`, and a letter spacing of `0.5px`.
*   **Input Fields:**
    ```css
    .nl-form-group input[type="text"],
    .nl-form-group input[type="password"],
    .nl-form-group input[type="number"],
    .nl-form-group select {
      font-family: var(--font);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-primary);
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      outline: none;
      transition: border-color 0.15s;
    }
    .nl-form-group input:focus {
      border-color: var(--accent);
    }
    ```

### 7.2. Strength Entropy Indicators
*   **Class:** `.nl-strength-bar`
*   **Properties:** Styled with a height of `3px`, rounded border radius of `2px`, and a default background color of `var(--border)`. Changes to `var(--danger)`, `var(--warning)`, `var(--accent)`, or `var(--success)` depending on the computed password entropy.
*   **Transition:** `transition: width 0.3s ease, background 0.3s ease`, enabling smooth visual bar adjustments as the user types.

### 7.3. Slider Selection Switches
Toggles in settings use custom-styled toggle switches built using standard input elements:

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
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--border);
  transition: .2s;
  border-radius: 18px;
}

.nl-slider::before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: var(--bg-surface);
  transition: .2s;
  border-radius: 50%;
}

.nl-switch input:checked + .nl-slider {
  background-color: var(--success);
}

.nl-switch input:checked + .nl-slider::before {
  transform: translateX(14px);
}
```
This enables smooth, animated transitions when toggling preference settings.

---

## See Also
- [Popup](../popup.md)
- [Components Css](components-css.md)
- [Views Css](views-css.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*