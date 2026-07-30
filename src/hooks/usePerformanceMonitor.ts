import { useEffect, useRef, useState } from "react";
import type { PerformanceSample, QualityTier } from "@/lib/desktop-view/types";

const EMPTY: PerformanceSample = {
  fps: 0,
  frameTimeMs: 0,
  worstFrameMs: 0,
  heapMb: null,
  heapLimitMb: null,
  smoothness: 1,
};

interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * requestAnimationFrame-based frame timing monitor.
 *
 * The loop self-suspends when the document is hidden (background throttling
 * would otherwise report misleading numbers and waste battery) and publishes a
 * sample at most twice per second to avoid causing the jank it measures.
 */
export function usePerformanceMonitor(enabled: boolean) {
  const [sample, setSample] = useState<PerformanceSample>(EMPTY);
  const [quality, setQuality] = useState<QualityTier>("high");
  const qualityRef = useRef<QualityTier>("high");

  useEffect(() => {
    if (!enabled) {
      setSample(EMPTY);
      return;
    }

    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let accumulated = 0;
    let worst = 0;
    let dropped = 0;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const delta = now - last;
      last = now;
      frames += 1;
      accumulated += delta;
      if (delta > worst) worst = delta;
      if (delta > 20) dropped += 1;

      if (now - windowStart >= 500) {
        const fps = Math.min(240, Math.round((frames * 1000) / (now - windowStart)));
        const frameTimeMs = accumulated / Math.max(1, frames);
        const smoothness = Math.max(0, 1 - dropped / Math.max(1, frames));
        const memory = (performance as Performance & { memory?: MemoryInfo }).memory;

        setSample({
          fps,
          frameTimeMs: Math.round(frameTimeMs * 100) / 100,
          worstFrameMs: Math.round(worst * 100) / 100,
          heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
          heapLimitMb: memory ? Math.round(memory.jsHeapSizeLimit / 1048576) : null,
          smoothness: Math.round(smoothness * 100) / 100,
        });

        // Adaptive quality: degrade on sustained low FPS, recover when healthy.
        const next: QualityTier = fps < 30 ? "economy" : fps < 48 ? "balanced" : "high";
        if (next !== qualityRef.current) {
          qualityRef.current = next;
          setQuality(next);
        }

        windowStart = now;
        frames = 0;
        accumulated = 0;
        worst = 0;
        dropped = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      windowStart = last;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { sample, quality };
}
