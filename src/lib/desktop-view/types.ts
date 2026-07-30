/**
 * Shared types for the Desktop View engine.
 *
 * The engine simulates a fixed-size desktop display inside a mobile browser by
 * rendering the target page into an iframe of exact desktop pixel dimensions and
 * applying GPU-composited CSS transforms (scale + translate) to that iframe.
 */

/** A desktop display resolution the virtual viewport can emulate. */
export interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Short description of a real device with this panel size. */
  note: string;
}

/** Pan/zoom state of the virtual desktop canvas. */
export interface TransformState {
  /** Scale factor applied to the virtual display (1 = 100%, CSS pixel parity). */
  scale: number;
  /** Horizontal translation of the display inside the stage, in stage pixels. */
  x: number;
  /** Vertical translation of the display inside the stage, in stage pixels. */
  y: number;
}

/** A navigable history entry inside the virtual browser. */
export interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

/** A saved bookmark. */
export interface Bookmark {
  id: string;
  url: string;
  label: string;
}

/** One independent virtual desktop tab. */
export interface DesktopTab {
  id: string;
  /** URL currently committed to the frame (empty when the tab is blank). */
  url: string;
  /** Text shown in the address bar; may differ from `url` while editing. */
  draftUrl: string;
  title: string;
  /** Monotonic counter used to force a frame reload without changing the URL. */
  reloadToken: number;
  history: string[];
  historyIndex: number;
}

/** Live performance sample produced by the monitor. */
export interface PerformanceSample {
  fps: number;
  /** Rolling average frame time in milliseconds. */
  frameTimeMs: number;
  /** Longest frame observed in the last window, in milliseconds. */
  worstFrameMs: number;
  /** JS heap usage in MB when `performance.memory` exists, otherwise null. */
  heapMb: number | null;
  heapLimitMb: number | null;
  /** 0..1 smoothness score derived from dropped-frame ratio. */
  smoothness: number;
}

/** Quality tier chosen by the adaptive quality controller. */
export type QualityTier = "high" | "balanced" | "economy";

/** Result of a single capability probe. */
export interface CapabilityResult {
  id: string;
  label: string;
  supported: boolean;
  detail: string;
}

/** Grouped platform/browser capability report. */
export interface CapabilityReport {
  engine: string;
  platform: string;
  formFactor: string;
  devicePixelRatio: number;
  standalone: boolean;
  results: CapabilityResult[];
}

/** Severity of a compatibility diagnostic. */
export type DiagnosticLevel = "ok" | "warn" | "blocked";

/** A single explanation of why a page may not render as a desktop experience. */
export interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  title: string;
  detail: string;
  /** Where the limitation originates. */
  origin:
    | "browser-security"
    | "cross-origin"
    | "iframe-policy"
    | "responsive-css"
    | "javascript-detection"
    | "server-side"
    | "unsupported-api";
}

/** Persisted user settings. */
export interface DesktopViewSettings {
  resolutionId: string;
  customWidth: number;
  customHeight: number;
  /** When false, the frame is left at device width (mobile rendering). */
  desktopMode: boolean;
  /** Show the emulated desktop cursor that follows touch. */
  cursorOverlay: boolean;
  /** Long-press on the stage dispatches a hover-style pointer hold. */
  longPressHover: boolean;
  /** Render the performance HUD. */
  showPerformance: boolean;
  /** Show responsive breakpoint rulers over the virtual display. */
  showBreakpoints: boolean;
  /** Side-by-side desktop/mobile comparison. */
  compareMode: boolean;
  /** Cap devicePixelRatio-driven work to protect mid-range hardware. */
  dprCap: number;
  /** Route requests through a public read-only text proxy when framing fails. */
  useReaderProxy: boolean;
  theme: "dark" | "light";
}
