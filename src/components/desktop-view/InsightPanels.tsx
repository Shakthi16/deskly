import { AlertTriangle, CheckCircle2, Gauge, Info, ShieldAlert, XCircle } from "lucide-react";
import type {
  CapabilityReport,
  Diagnostic,
  PerformanceSample,
  QualityTier,
} from "@/lib/desktop-view/types";
import { cn } from "@/lib/utils";

const ORIGIN_LABELS: Record<Diagnostic["origin"], string> = {
  "browser-security": "Browser security policy",
  "cross-origin": "Cross-origin restriction",
  "iframe-policy": "Iframe embedding policy",
  "responsive-css": "Responsive CSS",
  "javascript-detection": "JavaScript feature detection",
  "server-side": "Server-side rendering",
  "unsupported-api": "Unsupported browser API",
};

function LevelIcon({ level }: { level: Diagnostic["level"] }) {
  if (level === "ok") return <CheckCircle2 aria-hidden className="mt-0.5 size-4 text-success" />;
  if (level === "warn") return <AlertTriangle aria-hidden className="mt-0.5 size-4 text-warning" />;
  return <ShieldAlert aria-hidden className="mt-0.5 size-4 text-destructive" />;
}

/** Compatibility analysis: why the page does or does not look like a desktop. */
export function DiagnosticsList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (!diagnostics.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="size-4" /> Load a page to run the compatibility analysis.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {diagnostics.map((d) => (
        <li
          key={d.id}
          className="rounded-lg border border-border/60 bg-surface-sunken/60 p-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <LevelIcon level={d.level} />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold leading-snug text-foreground">{d.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{d.detail}</p>
              <p className="font-mono text-[11px] uppercase tracking-wide text-primary/80">
                {ORIGIN_LABELS[d.origin]}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface PerfProps {
  sample: PerformanceSample;
  quality: QualityTier;
  displayWidth: number;
  displayHeight: number;
  scale: number;
  dpr: number;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-sunken/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Live rendering statistics for the virtual display. */
export function PerformancePanel({
  sample,
  quality,
  displayWidth,
  displayHeight,
  scale,
  dpr,
}: PerfProps) {
  const rasterPixels = Math.round(displayWidth * displayHeight * scale * scale * dpr * dpr);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Gauge aria-hidden className="size-4 text-primary" />
        <span className="text-muted-foreground">Adaptive quality tier:</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-xs",
            quality === "high" && "bg-success/15 text-success",
            quality === "balanced" && "bg-warning/15 text-warning",
            quality === "economy" && "bg-destructive/15 text-destructive",
          )}
        >
          {quality}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Frames / second" value={`${sample.fps}`} hint="Rolling 500 ms window" />
        <Metric label="Frame time" value={`${sample.frameTimeMs.toFixed(1)} ms`} hint="Average" />
        <Metric label="Worst frame" value={`${sample.worstFrameMs.toFixed(1)} ms`} hint="Peak jank" />
        <Metric
          label="Smoothness"
          value={`${Math.round(sample.smoothness * 100)}%`}
          hint="Frames under 20 ms"
        />
        <Metric
          label="JS heap"
          value={sample.heapMb === null ? "n/a" : `${sample.heapMb} MB`}
          hint={sample.heapLimitMb ? `limit ${sample.heapLimitMb} MB` : "Chromium only"}
        />
        <Metric
          label="Raster pixels"
          value={`${(rasterPixels / 1_000_000).toFixed(1)} MP`}
          hint={`${displayWidth}×${displayHeight} @ ${Math.round(scale * 100)}% · DPR ${dpr}`}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        GPU memory and CPU utilisation are not exposed to web pages by any browser. The figures
        above are measured from real frame timings and the JS heap; the raster estimate is derived
        from the composited surface area rather than read from the GPU.
      </p>
    </div>
  );
}

/** Platform and browser capability report. */
export function CapabilityPanel({ report }: { report: CapabilityReport | null }) {
  if (!report) return <p className="text-sm text-muted-foreground">Detecting platform…</p>;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {[
          ["Engine", report.engine],
          ["Platform", report.platform],
          ["Form factor", report.formFactor],
          ["Device pixel ratio", `${report.devicePixelRatio}`],
          ["Installed PWA", report.standalone ? "Yes" : "No"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border/60 bg-surface-sunken/60 p-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="truncate text-sm text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-1.5">
        {report.results.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-sm">
            {r.supported ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="text-foreground">{r.label}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
