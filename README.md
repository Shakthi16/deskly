# Desktop View — a virtual laptop display for mobile browsers

Renders any embeddable website inside a fixed desktop-sized viewport (1366×768 → 2560×1440 or
custom) on a phone or tablet, then lets you pinch, pan and inertia-scroll that virtual display
without ever reflowing the page.

## Launch

```bash
bun install     # or npm install
bun run dev     # http://localhost:8080
bun run build   # production build
```

No backend, account, extension or proxy is required. The optional reader proxy is a public
read-only endpoint and is off by default.

## Architecture

```
src/
  routes/index.tsx                     route + SEO head
  components/desktop-view/
    DesktopViewApp.tsx                 state, tabs, shortcuts, lifecycle
    AddressBar.tsx                     omnibox + history controls
    ViewportStage.tsx                  the virtual display + frame lifecycle
    FloatingDock.tsx                   glass control bar
    InsightPanels.tsx                  diagnostics / performance / capabilities
  hooks/
    useViewportTransform.ts            pinch, pan, inertia, double-tap, constraints
    usePerformanceMonitor.ts           rAF frame timing + adaptive quality tier
    usePersistentState.ts              hydration-safe localStorage state
    useReducedMotion.ts                motion + hydration signals
  lib/desktop-view/
    types.ts presets.ts url.ts capabilities.ts diagnostics.ts capture.ts
  styles.css                           design tokens (dark default, `.light` variant)
```

**Rendering model.** The iframe is laid out at exactly the chosen CSS pixel size, so the embedded
page evaluates its media queries against a laptop viewport. Fitting it to the phone is a
`translate3d + scale` on a `will-change: transform` layer — a compositor-only operation that never
re-runs layout inside the page. The transform lives in a ref and is written inside a single
`requestAnimationFrame` loop, so dragging causes zero React renders; the zoom read-out is published
at most every 120 ms. The loop suspends on `visibilitychange`, and the stage uses `contain: strict`
plus `touch-action: none` to keep host-browser gestures out.

**Input.** *Navigate* mode captures pointer events on the stage overlay (pan, pinch, kinetic
inertia, double-tap zoom, wheel/ctrl-wheel). *Interact* mode passes input to the page. A long press
arms a single tap-through so you can click without switching modes. Keyboard: `⌘/Ctrl + L` focus
address, `+ / - / 0` zoom, `⌘/Ctrl + R` reload, arrows pan (shift = fast).

**Accessibility.** Semantic landmarks, one H1, ARIA labels on every control, `aria-pressed` on
toggles, visible focus rings, live regions for zoom and status, reduced-motion honoured in both CSS
and the inertia integrator, and forced-colors fallbacks.

## Platform limits imposed by browser security (not by this app)

These are stated honestly rather than faked:

- **X-Frame-Options / CSP `frame-ancestors`.** Sites such as Google, YouTube, X and Instagram refuse
  embedding. No web page can override this; the app detects it and offers "open in a new tab" or the
  reader proxy.
- **User-Agent, Client Hints and request headers** cannot be changed for a cross-origin subresource,
  so server-side UA sniffing still returns mobile HTML. Only a native shell (Electron/Tauri/CEF or
  an Android WebView) can rewrite headers — that is the correct home for true UA emulation.
- **`devicePixelRatio`, `(hover: hover)` and `(pointer: fine)`** are resolved by the renderer from
  real hardware and are not scriptable.
- **Cross-origin DOM, scroll position and title** are unreadable under the same-origin policy, so no
  script injection or in-page scroll sync is attempted.
- **Pixel capture of a cross-origin frame is impossible.** Screenshot and recording use the standard
  Screen Capture API with an explicit permission prompt; the buttons are hidden where it is
  unsupported (iOS Safari, most Android browsers).
- **GPU memory and CPU utilisation** are not exposed to web pages. The HUD reports measured frame
  timings, JS heap (Chromium) and a derived raster-pixel estimate, and says so.

## Browser support

Chromium desktop/Android, Edge, Samsung Internet, Firefox, Safari 16.4+ and iOS WebKit. Features
degrade individually via the capability report (Analysis tab) — fullscreen and screen capture are
unavailable on iOS, `performance.memory` is Chromium-only.
