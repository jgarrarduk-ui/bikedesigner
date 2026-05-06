# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Creature Cycles Bike Designer is a zero-dependency, single-file browser app for designing bicycle frame geometry. The entire application lives in `index.html` (~3000 lines): CSS, HTML, and JavaScript all in one file. There is no build system, no bundler, no package manager.

**To develop:** open `index.html` directly in a browser. There are no tests, no lint commands, and no server required.

## Architecture

### Single-file structure (in order)

1. **CSS** (lines 8–979) — CSS custom properties drive theming; four themes defined on `[data-theme]` attribute.
2. **HTML** (lines 981–1112) — static scaffold with `#panel-scroll` (param panel, populated by JS), `#canvas` (the drawing surface), and modal overlays.
3. **JavaScript** (lines 1113–2952) — all logic in one `<script>` block, organized into clearly-commented sections (marked with `═══` banners).
4. **Dropdown menus** (lines 2954–3004) — toolbar dropdown HTML lives at the bottom of `<body>` and is positioned via JS.

### Coordinate system

The geometry engine works in millimetres with the **bottom bracket (BB) at the origin (0, 0)**. X increases toward the front of the bike; Y increases upward. `mmToScreen(x, y)` converts to canvas pixel space for rendering.

### Data flow

```
DEFAULTS / PRESETS
      ↓
  params  (mutable global, all parameter values)
      ↓
computeGeometry(params)  → geometry object (all key points: axles, tube junctions, etc.)
      ↓
redraw()  → drawGrid / drawWheels / drawTubes / drawFork / drawCockpit / drawAnnotations
```

Every user interaction (slider move, preset load, import) ends with a call to `redraw()`. `computeGeometry` is pure — it takes params and returns a geometry object with no side effects.

### Key globals

| Name | Purpose |
|---|---|
| `params` | Current parameter values; keys match `DEFAULTS` and `PARAM_RANGES` |
| `vis` | Boolean flags for each visual element (grid, wheels, fork, annotations, etc.) |
| `currentTheme` | Active theme name; `T('key')` looks up `THEMES[currentTheme][key]` |
| `scale`, `offset` | Canvas zoom and pan state |
| `designMeta` | Current design metadata (name, author, version, id, parent_id) |
| `paramInputs` | Map of param key → input element (and `_sld` variants for sliders) |

### Theming

Two separate colour sets exist in parallel:
- **CSS custom properties** on `[data-theme]` — control the UI chrome (panel backgrounds, borders, text).
- **`THEMES` JS object** — control the canvas drawing colours (tubes, wheels, annotations).

`setTheme(name)` updates both. `T('key')` is the accessor for canvas colours. `PRINT_PALETTE` is a third static palette used only during export to produce white-background print output.

### Adding a new parameter

1. Add to `DEFAULTS` with a sensible default value.
2. Add to `PARAM_RANGES` as `[min, max, step]`.
3. Reference it in `computeGeometry(p)` via `p.yourKey`.
4. Add to the appropriate group in `GROUPS` (or a dedicated section in `buildPanel()`) to expose it in the UI.
5. Call `redraw()` after any change — this is automatic if you use `makeParamRow`.

### Export formats

- **JPEG** — renders the canvas with `PRINT_PALETTE` (white background) to a data URL, triggers download (or shows preview for iOS).
- **PDF** — wraps the JPEG in a hand-built minimal PDF blob (no library); A4 landscape.
- **JSON** — saves `{ meta: {...}, params: {...} }`. Import supports both this format and a legacy flat params object.

### Preset system

`PRESETS` is a nested object: `{ category: { size: params } }`. The helper `_p(...)` merges positional geometry args with `DEFAULTS` and resolves wheel size keys to diameters. Adding a new preset category or size only requires extending this object and `buildPresetPanel`/`updatePresetSizes` handle the rest automatically.

### Panel resizing

The left parameter panel is drag-resizable via `#resizer`. Width clamped to 180–500 px; `resizeCanvas()` is called on each drag tick.

### Mobile / touch

- Single-touch drag pans the canvas; two-finger pinch zooms with a pivot at the pinch midpoint.
- `#panel-mobile-hdr` toggles the parameter panel on small screens.
- `#preset-panel` repositions from a canvas overlay to a top bar on screens ≤ 600 px.
- iOS detected via `isIOS()` to provide fallback behaviour for file downloads.
