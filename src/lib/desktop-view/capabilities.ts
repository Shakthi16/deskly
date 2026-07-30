import type { CapabilityReport, CapabilityResult } from "./types";

function probe(id: string, label: string, test: () => boolean, detail: string): CapabilityResult {
  let supported = false;
  try {
    supported = test();
  } catch {
    supported = false;
  }
  return { id, label, supported, detail };
}

function detectEngine(ua: string): string {
  if (/Edg\//.test(ua)) return "Chromium (Edge)";
  if (/OPR\//.test(ua)) return "Chromium (Opera)";
  if (/SamsungBrowser/.test(ua)) return "Chromium (Samsung Internet)";
  if (/Firefox|FxiOS/.test(ua)) return "Gecko (Firefox)";
  if (/CriOS/.test(ua)) return "WebKit (Chrome on iOS)";
  if (/wv\)/.test(ua)) return "Chromium (Android WebView)";
  if (/Chrome\//.test(ua)) return "Chromium";
  if (/Safari\//.test(ua)) return "WebKit (Safari)";
  return "Unknown engine";
}

function detectPlatform(ua: string): string {
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPadOS";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown platform";
}

function detectFormFactor(): string {
  const w = window.innerWidth;
  const touch = navigator.maxTouchPoints > 0;
  // Foldables expose the Viewport Segments / horizontal-viewport-segments feature.
  const foldable =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(horizontal-viewport-segments: 2)").matches;
  if (foldable) return "Foldable (multi-segment viewport)";
  if (!touch) return "Desktop pointer device";
  if (w < 600) return "Phone";
  if (w < 1024) return "Tablet";
  return "Large touch display";
}

/** Run all capability probes. Must only be called in the browser. */
export function collectCapabilities(): CapabilityReport {
  const ua = navigator.userAgent;

  const results: CapabilityResult[] = [
    probe(
      "pointer-events",
      "Pointer Events",
      () => "PointerEvent" in window,
      "Unified mouse/touch/pen input used for pan, pinch and click targeting.",
    ),
    probe(
      "touch-action",
      "CSS touch-action",
      () => CSS.supports("touch-action", "none"),
      "Required to take over native pinch/scroll gestures on the canvas.",
    ),
    probe(
      "will-change",
      "GPU compositing hints",
      () => CSS.supports("will-change", "transform"),
      "Promotes the virtual display to its own compositor layer.",
    ),
    probe(
      "content-visibility",
      "content-visibility",
      () => CSS.supports("content-visibility", "auto"),
      "Lets the browser skip rendering work for off-screen panels.",
    ),
    probe(
      "resize-observer",
      "ResizeObserver",
      () => "ResizeObserver" in window,
      "Drives fit-to-screen recalculation on rotation and resize.",
    ),
    probe(
      "visual-viewport",
      "VisualViewport API",
      () => "visualViewport" in window,
      "Tracks on-screen keyboard and browser UI insets accurately.",
    ),
    probe(
      "page-visibility",
      "Page Visibility",
      () => "hidden" in document,
      "Pauses the render loop when the tab is backgrounded.",
    ),
    probe(
      "clipboard",
      "Async Clipboard",
      () => !!navigator.clipboard,
      "Copy the current address and share links to the host OS.",
    ),
    probe(
      "share",
      "Web Share",
      () => "share" in navigator,
      "Hands the current URL to native share sheets.",
    ),
    probe(
      "fullscreen",
      "Fullscreen API",
      () => !!document.documentElement.requestFullscreen,
      "Immersive mode that hides host browser chrome.",
    ),
    probe(
      "wake-lock",
      "Screen Wake Lock",
      () => "wakeLock" in navigator,
      "Keeps the display awake during long desktop sessions.",
    ),
    probe(
      "storage",
      "Local persistence",
      () => !!window.localStorage,
      "Stores settings, history and bookmarks on-device.",
    ),
    probe(
      "memory-api",
      "JS heap metrics",
      () => "memory" in performance,
      "Chromium-only heap reporting used by the performance HUD.",
    ),
    probe(
      "hardware-concurrency",
      "CPU core count",
      () => typeof navigator.hardwareConcurrency === "number",
      "Feeds the adaptive quality controller's load estimate.",
    ),
    probe(
      "webgl",
      "WebGL",
      () => {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
      },
      "Indicates the device has a usable GPU rasterisation path.",
    ),
    probe(
      "reduced-motion",
      "prefers-reduced-motion",
      () => typeof window.matchMedia === "function",
      "Disables inertia and UI animation when the user asks for less motion.",
    ),
    probe(
      "service-worker",
      "Service Worker",
      () => "serviceWorker" in navigator,
      "Enables offline resilience for the app shell in installed PWAs.",
    ),
  ];

  return {
    engine: detectEngine(ua),
    platform: detectPlatform(ua),
    formFactor: detectFormFactor(),
    devicePixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true,
    results,
  };
}
