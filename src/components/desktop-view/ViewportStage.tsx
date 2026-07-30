import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, MousePointer2, ShieldAlert } from "lucide-react";
import { BREAKPOINTS } from "@/lib/desktop-view/presets";
import { cn } from "@/lib/utils";

export type LoadState = "idle" | "loading" | "slow" | "loaded" | "blocked";

interface ViewportStageProps {
  url: string;
  /** The clean URL to open in the browser (address bar value, not proxy URL). */
  openUrl: string;
  reloadToken: number;
  width: number;
  height: number;
  /** Navigate = gestures captured by the overlay. Interact = input reaches the page. */
  mode: "navigate" | "interact";
  cursorOverlay: boolean;
  longPressHover: boolean;
  showBreakpoints: boolean;
  /** Economy quality removes blur/shadow work from the compositor. */
  economy: boolean;
  loadState: LoadState;
  onLoadStateChange: (state: LoadState) => void;
  /** Fired when a long-press arms single-tap pass-through. */
  onTapThrough?: (armed: boolean) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  layerRef: React.RefObject<HTMLDivElement | null>;
}

export interface ViewportStageHandle {
  /** Reload the embedded frame without changing the URL. */
  reload: () => void;
}

/**
 * The virtual desktop display.
 *
 * The iframe is laid out at exactly `width` × `height` CSS pixels, so the page
 * inside resolves its media queries against a laptop-sized viewport. Everything
 * the user does to make it fit their phone is a compositor transform applied to
 * the wrapping layer, which never re-runs the embedded page's layout.
 */
export const ViewportStage = forwardRef<ViewportStageHandle, ViewportStageProps>(
  function ViewportStage(
    {
      url,
      openUrl,
      reloadToken,
      width,
      height,
      mode,
      cursorOverlay,
      longPressHover,
      showBreakpoints,
      economy,
      loadState,
      onLoadStateChange,
      onTapThrough,
      stageRef,
      layerRef,
    },
    ref,
  ) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const [tapThrough, setTapThrough] = useState(false);
    const longPressTimer = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      reload: () => {
        const frame = frameRef.current;
        if (!frame) return;
        // Re-assigning src is the only cross-origin-safe way to reload a frame.
        const current = frame.src;
        frame.src = "about:blank";
        requestAnimationFrame(() => {
          frame.src = current;
        });
      },
    }));

    const watchdogRef = useRef<number | null>(null);
    const slowRef = useRef<number | null>(null);
    const navStartRef = useRef<number>(0);
    const hasLoadedRef = useRef<boolean>(false);
    const onLoadStateChangeRef = useRef(onLoadStateChange);
    useEffect(() => { onLoadStateChangeRef.current = onLoadStateChange; });

    // Navigation reset & watchdog timer:
    useEffect(() => {
      if (!url) return;
      hasLoadedRef.current = false;
      onLoadStateChangeRef.current("loading");
      navStartRef.current = Date.now();

      if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
      if (slowRef.current) window.clearTimeout(slowRef.current);

      slowRef.current = window.setTimeout(() => {
        if (!hasLoadedRef.current) {
          onLoadStateChangeRef.current("slow");
        }
        slowRef.current = null;
      }, 2500);

      watchdogRef.current = window.setTimeout(() => {
        // Only mark blocked if the frame hasn't fired a valid onLoad event!
        if (!hasLoadedRef.current) {
          onLoadStateChangeRef.current("blocked");
        }
        watchdogRef.current = null;
      }, 10000);

      return () => {
        if (watchdogRef.current) { window.clearTimeout(watchdogRef.current); watchdogRef.current = null; }
        if (slowRef.current) { window.clearTimeout(slowRef.current); slowRef.current = null; }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, reloadToken]); // intentionally excludes onLoadStateChange — use the ref above

    // Cursor + long-press pass-through, only meaningful in navigate mode.
    useEffect(() => {
      const stage = stageRef.current;
      if (!stage || mode !== "navigate") {
        setCursor(null);
        return;
      }

      const track = (e: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      };
      const down = (e: PointerEvent) => {
        track(e);
        if (!longPressHover) return;
        longPressTimer.current = window.setTimeout(() => {
          setTapThrough(true);
          onTapThrough?.(true);
          window.setTimeout(() => {
            setTapThrough(false);
            onTapThrough?.(false);
          }, 2500);
        }, 550);
      };
      const clearLongPress = () => {
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      };

      stage.addEventListener("pointermove", track, { passive: true });
      stage.addEventListener("pointerdown", down, { passive: true });
      stage.addEventListener("pointerup", clearLongPress, { passive: true });
      stage.addEventListener("pointercancel", clearLongPress, { passive: true });
      return () => {
        stage.removeEventListener("pointermove", track);
        stage.removeEventListener("pointerdown", down);
        stage.removeEventListener("pointerup", clearLongPress);
        stage.removeEventListener("pointercancel", clearLongPress);
        clearLongPress();
      };
    }, [longPressHover, mode, onTapThrough, stageRef]);

    const interactive = mode === "interact" || tapThrough;

    return (
      <div
        ref={stageRef}
        className={cn("dv-stage relative h-full w-full overflow-hidden", !url && "dv-grid")}
        role="application"
        aria-label="Virtual desktop display canvas"
        aria-describedby="dv-stage-help"
      >
        <p id="dv-stage-help" className="sr-only">
          Drag with one finger to pan, pinch with two fingers to zoom, double tap to toggle between
          fit and one hundred percent. Switch to interact mode to send taps and typing to the page.
        </p>

        <div
          ref={layerRef}
          className="dv-layer absolute left-0 top-0"
          style={{ width, height }}
          aria-hidden={!url}
        >
          <div
            className={cn(
              "dv-display relative h-full w-full overflow-hidden rounded-lg",
              economy && "shadow-none",
            )}
          >
            {url ? (
              <iframe
                ref={frameRef}
                key={`${url}::${reloadToken}`}
                src={url}
                title="Desktop rendering of the requested website"
                width={width}
                height={height}
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                allow="clipboard-write; fullscreen; autoplay; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation"
                onLoad={() => {
                  if (watchdogRef.current) { window.clearTimeout(watchdogRef.current); watchdogRef.current = null; }
                  if (slowRef.current) { window.clearTimeout(slowRef.current); slowRef.current = null; }

                  const frame = frameRef.current;
                  if (!frame) return;

                  // ── Accurate Blocked Frame Detection ───────────────────────
                  // When a browser (Chrome/Edge/Firefox) blocks an iframe due to
                  // X-Frame-Options or CSP frame-ancestors:
                  // 1. If contentDocument is accessible and has empty/about:blank -> BLOCKED.
                  // 2. Accessing contentWindow.origin returns "null" or "about:blank" -> BLOCKED.
                  // 3. Accessing contentWindow.origin throws SecurityError -> REAL CROSS-ORIGIN SITE LOADED!
                  try {
                    const doc = frame.contentDocument;
                    if (doc !== null && doc !== undefined) {
                      const href = doc.location?.href ?? "";
                      if (!href || href === "about:blank" || doc.body?.innerHTML === "") {
                        hasLoadedRef.current = false;
                        onLoadStateChange("blocked");
                        return;
                      }
                    }

                    const origin = frame.contentWindow?.origin;
                    if (origin === "null" || origin === "about:blank") {
                      hasLoadedRef.current = false;
                      onLoadStateChange("blocked");
                      return;
                    }
                  } catch {
                    // SecurityError thrown: This ONLY occurs when a real, cross-origin
                    // website (like mcassure.com) successfully loaded!
                  }

                  // Successfully loaded
                  hasLoadedRef.current = true;
                  onLoadStateChange("loaded");
                }}
                onError={() => {
                  if (watchdogRef.current) { window.clearTimeout(watchdogRef.current); watchdogRef.current = null; }
                  if (slowRef.current) { window.clearTimeout(slowRef.current); slowRef.current = null; }
                  onLoadStateChange("blocked");
                }}
                className="block h-full w-full border-0 bg-white"
                style={{ pointerEvents: interactive ? "auto" : "none" }}
              />
            ) : null}

            {showBreakpoints && (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {BREAKPOINTS.filter((b) => b.px < width).map((b) => (
                  <div
                    key={b.name}
                    className="absolute top-0 h-full border-l border-dashed border-primary/50"
                    style={{ left: b.px }}
                  >
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 font-mono text-[11px] text-primary-foreground">
                      {b.name} · {b.px}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Emulated desktop cursor. */}
        {cursorOverlay && cursor && url && mode === "navigate" && (
          <MousePointer2
            aria-hidden
            className={cn(
              "pointer-events-none absolute -translate-x-[2px] -translate-y-[2px] size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-colors",
              tapThrough ? "text-warning" : "text-primary",
            )}
            style={{ left: cursor.x, top: cursor.y }}
          />
        )}

        {tapThrough && (
          <div
            role="status"
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-warning px-3 py-1.5 text-xs font-semibold text-background"
          >
            Tap-through armed — your next tap reaches the page
          </div>
        )}

        {url && (loadState === "loading" || loadState === "slow") && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
            <div className={cn(
              "dv-panel flex items-center gap-2 rounded-full px-3 py-1.5 text-xs",
              loadState === "slow" ? "text-warning" : "text-muted-foreground"
            )}>
              <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
              {loadState === "slow"
                ? "Site may not allow embedding…"
                : `Rendering at ${width} × ${height}`}
            </div>
          </div>
        )}

        {url && loadState === "blocked" && (() => {
          const hostname = (() => { try { return new URL(openUrl).hostname; } catch { return openUrl; } })();
          return (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto bg-background/60 backdrop-blur-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div
                className="dv-panel rounded-2xl border border-border/60 p-6 max-w-sm w-full text-center space-y-5 shadow-2xl bg-surface-raised"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Icon */}
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                  <ShieldAlert aria-hidden className="size-7 text-muted-foreground" />
                </div>

                {/* Headline + explanation */}
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    This website can't be embedded
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{hostname}</span> has
                    a security policy that prevents it from being displayed inside
                    another website. This is a deliberate choice by the site owner
                    to protect their users — it's not a bug.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Common examples: Gmail, GitHub, YouTube, banking sites,
                    dashboards, and most login pages.
                  </p>
                </div>

                {/* Interactive CTA button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (openUrl) {
                      window.open(openUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                >
                  Open in your browser <ExternalLink aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {!url && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-sm space-y-2">
              <h2 className="font-display text-lg font-semibold">Virtual display idle</h2>
              <p className="text-sm text-muted-foreground">
                Enter an address above to render it inside a {width} × {height} desktop viewport.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
