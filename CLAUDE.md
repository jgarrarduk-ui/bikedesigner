# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BikeDesigner is a **zero-dependency, single-file** (`index.html`) HTML/CSS/JavaScript application for designing bicycle frames. There is no build step, no package manager, no test framework, and no linting toolchain. Open `index.html` directly in a browser to run the app.

## Development Workflow

**Run the app:** Open `index.html` in a browser. Any HTTP server works:
```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

There are no build, lint, or test commands.

## File Structure

The entire application lives in `index.html` (~3,000 lines), organized into clearly marked sections using `// ═══...` banner comments:

| Section | Approx. Lines | Purpose |
|---|---|---|
| CSS | 8–979 | All styling, 4 themes, responsive breakpoints |
| HTML | 981–1112 | DOM structure: toolbar, parameter panel, canvas, modals |
| JS: Math helpers | 1118–1144 | Vector ops (`add`, `sub`, `mul`, `dot`, `norm`, `perp_cw`, `perp_ccw`), `arcPts`, `bez`, `semicap` |
| JS: Design metadata | 1165–1187 | `designMeta` object, ID generation |
| JS: Config/Defaults | 1192–1367 | `DEFAULTS`, `PARAM_RANGES`, `GROUPS`, `WHEEL_SIZES`, `BB_STANDARDS`, `THEMES` |
| JS: Geometry engine | 1372–1499 | `computeGeometry(params)` — all frame math |
| JS: Canvas state | 1500–1601 | Scale, offset, pan/zoom, pinch, mouse/touch handlers |
| JS: Draw functions | 1604–2151 | `drawGrid`, `drawWheels`, `drawTubes`, `drawFork`, `drawCockpit`, `drawAnnotations`, `drawDesignMeta` |
| JS: Redraw loop | 2156–2205 | `redraw()` — orchestrates geometry + all draw calls |
| JS: Export/Import | 2312–2545 | PDF (custom minimal builder), JPEG, JSON |
| JS: UI panel | 2549–2744 | Dynamic slider/input generation, `apply()` |
| JS: Presets | 2816–2890 | 20+ presets across Road, Gravel, MTB XC, MTB Enduro, BMX |

## Architecture

### Data Flow
```
User adjusts slider/input
  → apply() updates params object
  → redraw() is called
  → computeGeometry(params) derives all geometric points
  → draw* functions render to <canvas>
```

### Key Global State
- `params` — active parameter values (Reach, Fork ATC, BB Drop, angles, tube sizes, etc.)
- `vis` — visibility toggles (grid, wheels, fork, annotations, etc.)
- `designMeta` — name, author, version, unique ID, parent_id
- `scale`, `offset` — canvas viewport transform
- `currentTheme` — active theme key

### Geometry Engine (`computeGeometry`)
This is the core of the application. It takes the flat `params` object and returns a geometry object with all derived positions (rear axle, BB, seat cluster, head tube ends, fork crown, front axle, etc.) computed via trigonometry and the vector math helpers. All draw functions consume this output — never compute geometry inside draw functions.

### Themes
Four themes are defined in the `THEMES` object: `dark` (default), `light`, `green`, `orange`. Each theme specifies a complete color palette used by both the CSS variables (set at theme switch time) and the canvas draw functions (read from `THEMES[currentTheme]` at draw time). A separate `printPalette` is used for PDF/JPEG exports.

### Export System
- **PDF**: A custom minimal PDF is generated in pure JS (no library). The builder at ~line 2373 writes raw PDF syntax.
- **JPEG**: Uses `canvas.toDataURL`. iOS requires a workaround (opens in new tab instead of downloading).
- **JSON**: Exports the full `params` + `designMeta` object; import restores both and triggers a redraw.

### Parameter Panel
The panel UI is generated dynamically in JS from the `GROUPS` configuration. Each parameter gets a slider + number input + arrow buttons. The `apply()` function reads all inputs, clamps to `PARAM_RANGES`, updates `params`, and calls `redraw()`.
