import type { Diagnostic } from "./types";
import { isSameOrigin } from "./url";

/** Hosts that are known to refuse framing via X-Frame-Options / CSP frame-ancestors. */
const KNOWN_FRAME_BLOCKERS = [
  "google.com",
  "www.google.com",
  "accounts.google.com",
  "youtube.com",
  "www.youtube.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "amazon.com",
  "github.com",
  "reddit.com",
  "netflix.com",
  "chatgpt.com",
];

interface DiagnosticInput {
  url: string;
  loadState: "idle" | "loading" | "slow" | "loaded" | "blocked";
  desktopMode: boolean;
  scale: number;
  width: number;
}

/**
 * Build the compatibility report for the current page.
 *
 * Every statement here is derived from observable facts (load state, origin,
 * URL, scale) — the engine never claims to inspect cross-origin DOM, because
 * the same-origin policy makes that impossible from a web page.
 */
export function buildDiagnostics(input: DiagnosticInput): Diagnostic[] {
  const { url, loadState, desktopMode, scale, width } = input;
  const out: Diagnostic[] = [];
  if (!url) return out;

  const sameOrigin = isSameOrigin(url);
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  if (loadState === "blocked") {
    out.push({
      id: "frame-blocked",
      level: "blocked",
      title: "The site refuses to be embedded",
      detail:
        "The response carried X-Frame-Options: DENY/SAMEORIGIN or a Content-Security-Policy frame-ancestors directive. This is enforced by the browser itself and cannot be bypassed from page JavaScript. Open the site in a new tab, or enable the reader proxy for a simplified server-rendered view.",
      origin: "browser-security",
    });
  } else if (KNOWN_FRAME_BLOCKERS.some((b) => host === b || host.endsWith(`.${b}`))) {
    out.push({
      id: "frame-likely-blocked",
      level: "warn",
      title: "This host usually blocks embedding",
      detail: `${host} is known to send frame-ancestors restrictions. If the display stays blank, the block came from the server response, not from this app.`,
      origin: "iframe-policy",
    });
  }

  if (!sameOrigin && url) {
    out.push({
      id: "cross-origin",
      level: "warn",
      title: "Cross-origin document — limited introspection",
      detail:
        "The same-origin policy prevents reading the embedded document's DOM, viewport meta tag, media-query state, or scroll position. Title detection, in-page scroll sync and script injection are therefore unavailable for this page.",
      origin: "cross-origin",
    });
    out.push({
      id: "ua-override",
      level: "warn",
      title: "User-agent override is not possible in-page",
      detail:
        "A web page cannot change the User-Agent header, navigator.userAgent, navigator.userAgentData, or Client Hints for a cross-origin subresource. Sites doing server-side UA sniffing will still return their mobile HTML. Only a native shell (Electron/Tauri/CEF/WebView) can override request headers.",
      origin: "server-side",
    });
    out.push({
      id: "media-queries",
      level: "ok",
      title: "Media queries evaluate against the virtual display",
      detail: `The frame element is laid out at exactly ${width}px CSS width, so width-based media queries and container breakpoints inside the page resolve as they would on a laptop. The visual scale of ${Math.round(
        scale * 100,
      )}% is a compositor transform applied after layout, so it does not re-trigger breakpoints.`,
      origin: "responsive-css",
    });
    out.push({
      id: "pointer-media",
      level: "warn",
      title: "pointer / hover media features remain touch-typed",
      detail:
        "(hover: hover) and (pointer: fine) are resolved by the browser from real hardware. Pages that gate desktop navigation on those features may keep their touch layout. Overriding them requires renderer-level flags, which no web API exposes.",
      origin: "javascript-detection",
    });
    out.push({
      id: "dpr",
      level: "warn",
      title: "devicePixelRatio cannot be spoofed for the embedded page",
      detail:
        "window.devicePixelRatio inside the frame reflects the physical screen. Scaling the frame changes its effective raster density but not the reported value, so DPR-conditional asset loading inside the page is unaffected.",
      origin: "unsupported-api",
    });
  }

  if (!desktopMode) {
    out.push({
      id: "mobile-mode",
      level: "warn",
      title: "Desktop emulation is off",
      detail:
        "The display is sized to the device width, so the page renders its mobile layout. Turn Desktop mode back on to restore the fixed virtual viewport.",
      origin: "responsive-css",
    });
  }

  if (loadState === "loaded" && !out.some((d) => d.level === "blocked")) {
    out.unshift({
      id: "loaded",
      level: "ok",
      title: "Rendered inside the virtual desktop display",
      detail: `The document is laid out at ${width}px and composited onto the canvas with a GPU transform. Layout fidelity matches a laptop of the selected resolution.`,
      origin: "responsive-css",
    });
  }

  return out;
}
