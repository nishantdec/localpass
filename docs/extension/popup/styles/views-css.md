[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../../../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../../../reference/glossary.md)

---

# View Layout Styles Reference: `docs/extension/popup/styles/views-css.md`

This document provides a highly detailed reference of the viewport, layout grids, sticky zones, and content panels implemented in the **localpass Chrome Extension**. It explains how the Single-Page Application (SPA) structure of the popup viewport is managed inside `localpass-extension/popup/popup.css`.

---

## 1. Global Viewport Sizing Mappings
To adapt to various screen resolutions, user setups, or popout windows, the popup utilizes sizing classes injected dynamically into the `<html>` root element.

```css
/* Core container properties */
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
  overflow: hidden;
}
```

### Supported Viewport Presets

| CSS Selector | Width | Height | Ideal Use Case |
| :--- | :--- | :--- | :--- |
| `html.size-compact` | `360px` | `500px` | Smaller resolutions / default minimal viewports |
| `html.size-default` | `420px` | `580px` | Standard Chrome extension extension panel (default) |
| `html.size-wider` | `480px` | `600px` | Expanded view with extensive credential labels |
| `html.size-extra-wide`| `560px` | `600px` | Standalone popped-out window / wide view |

---

## 2. Structural Layout Diagram (ASCII Topology)

The popup layout is structured as a vertical flex box layout. Inside the content view, panels are swapped dynamically by modifying classes, while keeping the headers, backbars, and tabs sticky.

```text
+-----------------------------------------------------------+
| [logo] localpass                       [+ New] [Unlock] | <-- #nl-header (Sticky)
+-----------------------------------------------------------+
| < Back     [ Active View Name ]                           | <-- #nl-back-bar (Sticky, optional)
+-----------------------------------------------------------+
| [🔍 Search vault...]                                      | <-- #nl-search-wrap (Sticky, optional)
+-----------------------------------------------------------+
| [ Folder: All v ]                     [ Type: All v ]     | <-- #nl-filter-bar (Sticky, optional)
+===========================================================+
|                                                           |
|  * row 1: Github.com (user@email.com)       [⚡] [🔑] [📋] | <-- .nl-entry-row
|  * row 2: Google.com (another@gmail.com)    [⚡] [🔑] [📋] |
|  * row 3: BankOfAmerica (checking101)       [⚡] [🔑] [📋] | <-- #nl-content (Scrollable area)
|                                                           |
+===========================================================+
| [Save]                                           [Cancel] | <-- #nl-form-actions-bar (Sticky, optional)
+-----------------------------------------------------------+
| [🛡️ Vault]       [🎲 Gen]       [⚙️ Settings]       [📋 Menu] | <-- #nl-bottom-nav (Sticky)
+-----------------------------------------------------------+
```

---

## 3. Structural Container Components

### A. The Shell Header (`#nl-header`)
Maintains the branding logo and quick access primary actions.

```css
#nl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

#nl-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

#nl-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

#nl-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative; /* Essential for dropdown alignment */
}
```

---

### B. Sticky Context Navigation Bar (`#nl-back-bar`)
Appears dynamically in child panels (e.g. Credential Detail or Edit Views) providing back navigation and clear route titles.

```css
#nl-back-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

#nl-back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

#nl-back-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-hover);
}

#nl-view-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-secondary);
}
```

---

### C. Search & Filter Bar (`#nl-search-wrap` & `#nl-filter-bar`)
The search bar isolates the search input, while the filter bar provides grid select menus for organizing vault views.

```css
#nl-search-wrap {
  padding: 10px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

#nl-search-inner {
  display: flex;
  align-items: center;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0 10px;
  gap: 8px;
  transition: border-color 0.15s;
}

#nl-search-inner:focus-within {
  border-color: var(--accent);
}

#nl-global-search {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 8px 0;
}

/* ── Filter Bar ── */
#nl-filter-bar {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  box-sizing: border-box;
}

.nl-filter-select-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
```

---

### D. Scrollable Content viewport (`#nl-content`)
The dynamic body where sub-views are loaded. The custom thin scrollbar avoids horizontal space truncation.

```css
#nl-content {
  flex: 1;
  overflow-y: auto;
  min-height: 100px;
}

#nl-content::-webkit-scrollbar {
  width: 4px;
}

#nl-content::-webkit-scrollbar-track {
  background: transparent;
}

#nl-content::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

#nl-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-light);
}
```

---

### E. Dynamic Grid List Item (`.nl-entry-row`)
Represents an individual vault credential inside the vault dashboard.

```css
.nl-entry-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  transition: background 0.12s;
  cursor: pointer;
}

.nl-entry-row:hover {
  background: var(--bg-hover);
}

.nl-entry-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
  background: transparent;
  border: none;
}

.nl-entry-info {
  flex: 1;
  min-width: 0; /* Critical: allows long names to truncate safely */
}

.nl-entry-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nl-entry-sub {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
```

---

### F. Static Action Bars (`#nl-bottom-nav` & `#nl-form-actions-bar`)
The standard navigation tabs and the editing confirmation override bar are both locked dynamically to the bottom.

```css
/* Standard Navigation Bar */
#nl-bottom-nav {
  display: flex;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.nl-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 4px;
  background: transparent;
  border: none;
  font-family: var(--font);
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  border-top: 2px solid transparent; /* Highlight line container */
  transition: color 0.15s;
}

.nl-nav-item.active {
  color: var(--accent);
  border-top-color: var(--accent); /* Illuminates active tab */
}

/* Sticky Form Actions Override Bar */
#nl-form-actions-bar {
  display: flex;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  height: 56px;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  z-index: 10;
}
```

---

## See Also
- [Popup](../popup.md)
- [Layout Css](layout-css.md)
- [Components Css](components-css.md)

---
*[Back to Docs Index](../../../index.md) •
[Back to Top](#)*