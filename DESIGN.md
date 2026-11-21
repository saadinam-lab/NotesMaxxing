# NotesMaxxing — Warm Editorial Design System (`DESIGN.md`)

> **Aesthetic Direction:** Apple-inspired editorial restraint paired with warm tactile study surfaces. Generous whitespace, razor-sharp typography, zero hover blur, zero click lag, and smooth GPU-accelerated zoom and theme transitions.

---

## 1. Anti-AI-Slop & Performance Rules (Strict)
1. **No blue/purple/cyan slop:** Zero blue (`#5E9EFF`, `#0066CC`, `#38BDF8`), purple, or neon gradients anywhere in the codebase.
2. **Zero hover blur:** Never apply `scale()` or `whileHover={{ scale: ... }}` transforms to toolbar buttons, icons, or text labels. Icons remain crisp at `scale(1)` on hover, using only subtle background pill tint (`150ms ease-out`) and icon color shifts.
3. **Zero click lag or missed clicks:**
   - Never stack nested `backdrop-filter` layers. Keep `backdrop-filter: blur(12px)` strictly on top-level toolbar and panel surfaces.
   - Decorative/animated background pills (`activeModePill`, `activeColorRing`) must use `pointer-events: none` so clicks always land cleanly on native `<button>` elements.
   - Toolbar buttons use native `<button>` elements with generous hitboxes (`min-height: 36px`, `min-width: 36px`), `cursor: pointer`, and no `layout` prop on clickable buttons.
4. **Zero `transition: all`:** Animate only `transform`, `opacity`, `clip-path`, and targeted color properties (`background-color`, `color`, `border-color`, `filter`).
5. **Canvas isolation:** Dark-mode PDF inversion filters apply strictly to `.pdf-canvas-layer`, never to highlights, vector ink, images, or UI overlays.

---

## 2. Typography
- **UI & Notes Font Stack:**
  ```css
  -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif
  ```
- **Monospace / Telemetry Font Stack:**
  ```css
  "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
  ```
- **Tracking & Sizing:**
  - Hero headlines & section titles: tight negative tracking (`-0.025em` on hero, `-0.022em` on headings)
  - Side panel & note body copy: `15px` base size, `1.6` line-height
  - Numeric readouts (page numbers, zoom `%`, note counts): `font-variant-numeric: tabular-nums`

---

## 3. Warm Editorial Dual-Mode Palettes

### Dark Mode — *Editorial & Warm*
| Token | Value | Usage |
| :--- | :--- | :--- |
| `--nm-bg` | `#0C0C0E` | Charcoal Black workspace canvas |
| `--nm-surface` | `#141418` | Elevated cards & panels |
| `--nm-glass` | `rgba(20, 20, 24, 0.80)` | Top-level toolbar & panel glass (`backdrop-filter: blur(12px)`) |
| `--nm-surface-subtle` | `rgba(255, 255, 255, 0.055)` | Recessed capsules, inputs, quote blocks |
| `--nm-border` | `rgba(255, 255, 255, 0.08)` | Hairline borders |
| `--nm-text` | `#F4F4F5` | Alabaster primary icons & text |
| `--nm-text-muted` | `#A1A1AA` | Secondary text |
| `--nm-accent` | `#F59E0B` | Warm Amber — CTAs, active mode, links, focus rings |
| Default Highlight | `rgba(245, 158, 11, 0.28)` / `#F59E0B` underline | Soft Warm Amber text highlight |

### Light Mode — *Warm Editorial*
| Token | Value | Usage |
| :--- | :--- | :--- |
| `--nm-bg` | `#F9F8F6` | Warm Alabaster workspace canvas |
| `--nm-surface` | `#FFFFFF` | Elevated cards & panels |
| `--nm-glass` | `rgba(255, 255, 255, 0.82)` | Top-level toolbar & panel glass (`backdrop-filter: blur(12px)`) |
| `--nm-surface-subtle` | `rgba(28, 25, 23, 0.045)` | Recessed capsules, inputs, quote blocks |
| `--nm-border` | `rgba(28, 25, 23, 0.09)` | Hairline borders |
| `--nm-text` | `#1C1917` | Warm Charcoal primary icons & text |
| `--nm-text-muted` | `#57534E` | Secondary text |
| `--nm-accent` | `#C2410C` | Burnt Terracotta — CTAs, active mode, links, focus rings |
| Default Highlight | `rgba(245, 158, 11, 0.25)` / `#C2410C` underline | Soft Warm Amber/Honey text highlight |

---

## 4. Motion & Smooth Zoom Architecture

### 60fps Circular Ripple Theme Transition
- Powered by the native **View Transitions API** (`document.startViewTransition`) + `flushSync`.
- Expands `clipPath: ['circle(0px at x y)', 'circle(maxRadius at x y)']` on `::view-transition-new(root)` over `480ms` (`cubic-bezier(0.22, 1, 0.36, 1)`) from the exact click `(x, y)` coordinates.
- Gracefully falls back when `startViewTransition` is unavailable or `prefers-reduced-motion` is enabled.

### Two-Stage Smooth Animated PDF Zoom
1. **Instant Visual Zoom:** Maintains `visualScale` alongside `renderScale`. Changing zoom immediately animates the page stack wrapper using `transform: scale(visualScale / renderScale)` with `transform-origin: top center` (`220ms cubic-bezier(0.22, 1, 0.36, 1)`), keeping highlights and vector drawings locked in sync.
2. **Debounced Crisp Redraw (~240ms):** Once zooming settles, visible `pdfjs-dist` canvases render offscreen at `renderScale * window.devicePixelRatio`, swap synchronously in a single frame with zero flicker, adjust scroll position proportionally, and reset the CSS transform ratio to `1`.

### Fluid Shared-Element Springs (Mode Switcher & Color Ring Only)
- `activeModePill` (on Read / Notes / Circle switcher) and `activeColorRing` (on color swatches):
  - `type: "spring", stiffness: 380, damping: 26, mass: 0.75`
  - Always `pointer-events: none` on the animated indicator itself.

---

## 5. Brand Identity & Editorial Homepage
- Custom app icon (`/public/app-icon.png`) featuring the *"Study: Dont Look"* mark on `#0C0C0E` with `#F59E0B` amber accents, used in favicon, PWA manifest, navbar squircle, and homepage hero.
- Apple-inspired spacious hero (`py-20`), bold tight-tracked headline, primary CTA, unobtrusive drag-and-drop cue, and refined Library showcase grid (`gap-6`, subtle `translateY(-2px)` hover elevation, no heavy drop shadows).
