import {
  Camera,
  Circle,
  Hand,
  Laptop,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Ruler,
  Scan,
  Square,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingDockProps {
  scale: number;
  resolutionId: string;
  displayWidth: number;
  displayHeight: number;
  deviceLabel?: string;
  mode: "navigate" | "interact";
  fullscreen: boolean;
  recording: boolean;
  captureSupported: boolean;
  showBreakpoints: boolean;
  onZoom: (delta: number) => void;
  onFit: () => void;
  onFitWidth: () => void;
  onModeChange: (mode: "navigate" | "interact") => void;
  onResolutionChange: (id: string) => void;
  onToggleFullscreen: () => void;
  onScreenshot: () => void;
  onToggleRecording: () => void;
  onToggleBreakpoints: () => void;
  onOpenDeviceSelector: () => void;
}

/** Floating glass control bar that hovers over the virtual display. */
export function FloatingDock({
  scale,
  resolutionId,
  displayWidth,
  displayHeight,
  deviceLabel,
  mode,
  fullscreen,
  recording,
  captureSupported,
  showBreakpoints,
  onZoom,
  onFit,
  onFitWidth,
  onModeChange,
  onResolutionChange,
  onToggleFullscreen,
  onScreenshot,
  onToggleRecording,
  onToggleBreakpoints,
  onOpenDeviceSelector,
}: FloatingDockProps) {
  return (
    <div
      className="dv-panel pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border/60 px-2 py-2"
      role="toolbar"
      aria-label="Virtual viewport controls"
    >
      <div
        className="flex items-center rounded-full bg-surface-sunken p-0.5"
        role="group"
        aria-label="Input mode"
      >
        <button
          type="button"
          onClick={() => onModeChange("navigate")}
          aria-pressed={mode === "navigate"}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
            mode === "navigate"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Hand aria-hidden className="size-3.5" /> Navigate
        </button>
        <button
          type="button"
          onClick={() => onModeChange("interact")}
          aria-pressed={mode === "interact"}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
            mode === "interact"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MousePointerClick aria-hidden className="size-3.5" /> Interact
        </button>
      </div>

      <div className="flex items-center gap-0.5 rounded-full bg-surface-sunken px-1">
        <Button
          variant="chrome"
          size="icon-sm"
          onClick={() => onZoom(-0.15)}
          aria-label="Zoom out"
        >
          <ZoomOut aria-hidden />
        </Button>
        <span
          className="min-w-14 text-center font-mono text-xs tabular-nums text-foreground"
          aria-live="polite"
        >
          {Math.round(scale * 100)}%
        </span>
        <Button variant="chrome" size="icon-sm" onClick={() => onZoom(0.15)} aria-label="Zoom in">
          <ZoomIn aria-hidden />
        </Button>
      </div>

      <Button variant="dock" size="pill" onClick={onFit} aria-label="Fit whole display on screen">
        <Scan aria-hidden className="size-3.5" /> Fit
      </Button>
      <Button variant="dock" size="pill" onClick={onFitWidth} aria-label="Fit display width">
        Width
      </Button>

      <Button
        variant="dock"
        size="pill"
        onClick={onOpenDeviceSelector}
        aria-label="Choose device preset"
        className="gap-2"
      >
        <Laptop aria-hidden className="size-3.5" />
        {deviceLabel ?? `${displayWidth}×${displayHeight}`}
      </Button>

      <Button
        variant="dock"
        size="icon-sm"
        onClick={onToggleBreakpoints}
        aria-pressed={showBreakpoints}
        aria-label="Toggle responsive breakpoint rulers"
        className={cn(showBreakpoints && "text-primary border-primary/60")}
      >
        <Ruler aria-hidden />
      </Button>

      {captureSupported && (
        <>
          <Button
            variant="dock"
            size="icon-sm"
            onClick={onScreenshot}
            aria-label="Capture a screenshot"
          >
            <Camera aria-hidden />
          </Button>
          <Button
            variant="dock"
            size="icon-sm"
            onClick={onToggleRecording}
            aria-pressed={recording}
            aria-label={recording ? "Stop recording" : "Record the viewport"}
            className={cn(recording && "border-destructive/70 text-destructive")}
          >
            {recording ? <Square aria-hidden /> : <Circle aria-hidden />}
          </Button>
        </>
      )}

      <Button
        variant="dock"
        size="icon-sm"
        onClick={onToggleFullscreen}
        aria-pressed={fullscreen}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      </Button>
    </div>
  );
}
