import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SCALE, MIN_SCALE } from "@/lib/desktop-view/presets";
import type { TransformState } from "@/lib/desktop-view/types";

interface Options {
  /** The clipping stage element that receives pointer input. */
  stageRef: React.RefObject<HTMLElement | null>;
  /** The transformed layer holding the virtual display. */
  layerRef: React.RefObject<HTMLElement | null>;
  displayWidth: number;
  displayHeight: number;
  /** Disable inertia when the user prefers reduced motion. */
  reducedMotion: boolean;
  /** Gestures are only captured while the canvas is in navigate mode. */
  active: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Viewport virtualisation: pinch-zoom, pan, kinetic inertia and double-tap zoom
 * over a fixed-size virtual display.
 *
 * The transform lives in a ref and is written straight to `layerRef.style`
 * inside a single rAF loop, so dragging never triggers a React render. React
 * state is only updated for the zoom read-out, at most every 120 ms.
 */
export function useViewportTransform({
  stageRef,
  layerRef,
  displayWidth,
  displayHeight,
  reducedMotion,
  active,
}: Options) {
  const transform = useRef<TransformState>({ scale: 1, x: 0, y: 0 });
  const [readout, setReadout] = useState<TransformState>({ scale: 1, x: 0, y: 0 });
  const frame = useRef(0);
  const dirty = useRef(true);
  const lastPublish = useRef(0);
  const velocity = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "none" | "pan" | "pinch";
    startDistance: number;
    startScale: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    moved: boolean;
  }>({
    mode: "none",
    startDistance: 0,
    startScale: 1,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    moved: false,
  });
  const lastTap = useRef(0);

  /** Keep the display reachable: never let it drift fully off-stage. */
  const constrain = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const t = transform.current;
    const w = displayWidth * t.scale;
    const h = displayHeight * t.scale;
    const marginX = Math.min(rect.width * 0.5, 160);
    const marginY = Math.min(rect.height * 0.5, 160);

    const minX = w <= rect.width ? (rect.width - w) / 2 : rect.width - w - marginX;
    const maxX = w <= rect.width ? (rect.width - w) / 2 : marginX;
    const minY = h <= rect.height ? (rect.height - h) / 2 : rect.height - h - marginY;
    const maxY = h <= rect.height ? (rect.height - h) / 2 : marginY;

    t.x = clamp(t.x, minX, maxX);
    t.y = clamp(t.y, minY, maxY);
  }, [displayHeight, displayWidth, stageRef]);

  /** Single render loop: applies the transform and decays inertia. */
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;
      const t = transform.current;

      if (gesture.current.mode === "none" && !reducedMotion) {
        const v = velocity.current;
        if (Math.abs(v.x) > 0.05 || Math.abs(v.y) > 0.05) {
          t.x += v.x;
          t.y += v.y;
          v.x *= 0.94;
          v.y *= 0.94;
          constrain();
          dirty.current = true;
        } else if (v.x !== 0 || v.y !== 0) {
          v.x = 0;
          v.y = 0;
        }
      }

      if (dirty.current && layerRef.current) {
        layerRef.current.style.transform = `translate3d(${t.x.toFixed(2)}px, ${t.y.toFixed(
          2,
        )}px, 0) scale(${t.scale.toFixed(4)})`;
        dirty.current = false;

        const now = performance.now();
        if (now - lastPublish.current > 120) {
          lastPublish.current = now;
          setReadout({ ...t });
        }
      }

      frame.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!frame.current) frame.current = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [constrain, layerRef, reducedMotion]);

  const commit = useCallback(() => {
    dirty.current = true;
    setReadout({ ...transform.current });
  }, []);

  /** Zoom around a point expressed in stage coordinates. */
  const zoomAt = useCallback(
    (nextScale: number, pointX: number, pointY: number) => {
      const t = transform.current;
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = scale / t.scale;
      t.x = pointX - (pointX - t.x) * ratio;
      t.y = pointY - (pointY - t.y) * ratio;
      t.scale = scale;
      constrain();
      dirty.current = true;
    },
    [constrain],
  );

  /** Fit the whole virtual display inside the stage. */
  const fitToStage = useCallback(
    (mode: "contain" | "width" = "contain") => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale =
        mode === "width"
          ? rect.width / displayWidth
          : Math.min(rect.width / displayWidth, rect.height / displayHeight);
      const t = transform.current;
      t.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
      t.x = (rect.width - displayWidth * t.scale) / 2;
      t.y =
        mode === "width"
          ? Math.min(0, (rect.height - displayHeight * t.scale) / 2)
          : (rect.height - displayHeight * t.scale) / 2;
      constrain();
      commit();
    },
    [commit, constrain, displayHeight, displayWidth, stageRef],
  );

  /** Set an absolute zoom level, anchored at the stage centre. */
  const setZoom = useCallback(
    (scale: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      zoomAt(scale, rect.width / 2, rect.height / 2);
      commit();
    },
    [commit, stageRef, zoomAt],
  );

  /** Scroll the canvas by a delta in stage pixels (used by keyboard nav). */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const t = transform.current;
      t.x += dx;
      t.y += dy;
      constrain();
      commit();
    },
    [commit, constrain],
  );

  // Pointer handling on the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !active) return;

    const local = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      stage.setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, local(e));
      velocity.current = { x: 0, y: 0 };
      const g = gesture.current;
      g.moved = false;

      if (pointers.current.size === 1) {
        const p = local(e);
        g.mode = "pan";
        g.lastX = p.x;
        g.lastY = p.y;
        g.lastTime = performance.now();
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        g.mode = "pinch";
        g.startDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        g.startScale = transform.current.scale;
        g.originX = (a.x + b.x) / 2;
        g.originY = (a.y + b.y) / 2;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = local(e);
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;

      if (g.mode === "pan" && pointers.current.size === 1) {
        const dx = p.x - g.lastX;
        const dy = p.y - g.lastY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) g.moved = true;
        const now = performance.now();
        const dt = Math.max(1, now - g.lastTime);
        velocity.current = { x: (dx / dt) * 16, y: (dy / dt) * 16 };
        g.lastX = p.x;
        g.lastY = p.y;
        g.lastTime = now;
        const t = transform.current;
        t.x += dx;
        t.y += dy;
        constrain();
        dirty.current = true;
      } else if (g.mode === "pinch" && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        zoomAt((distance / g.startDistance) * g.startScale, midX, midY);
        // Let the midpoint drag the canvas too, so pinch and pan combine.
        const t = transform.current;
        t.x += midX - g.originX;
        t.y += midY - g.originY;
        g.originX = midX;
        g.originY = midY;
        g.moved = true;
        constrain();
        dirty.current = true;
      }
    };

    const endPointer = (e: PointerEvent) => {
      const g = gesture.current;
      const wasSingleTap = g.mode === "pan" && !g.moved && pointers.current.size === 1;
      pointers.current.delete(e.pointerId);

      if (pointers.current.size === 0) {
        g.mode = "none";
        if (wasSingleTap) {
          const now = performance.now();
          if (now - lastTap.current < 300) {
            const p = local(e);
            const target = transform.current.scale < 0.99 ? 1 : 0.5;
            zoomAt(target, p.x, p.y);
            commit();
            lastTap.current = 0;
          } else {
            lastTap.current = now;
          }
        }
        commit();
      } else if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        g.mode = "pan";
        g.lastX = p.x;
        g.lastY = p.y;
        g.lastTime = performance.now();
      }
    };

    const onWheel = (e: WheelEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(transform.current.scale * (1 - e.deltaY / 400), x, y);
        commit();
      } else {
        e.preventDefault();
        const t = transform.current;
        t.x -= e.deltaX;
        t.y -= e.deltaY;
        constrain();
        commit();
      }
    };

    stage.addEventListener("pointerdown", onPointerDown, { passive: true });
    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerup", endPointer, { passive: true });
    // Touch interruption recovery: a cancelled pointer must not strand the gesture.
    stage.addEventListener("pointercancel", endPointer, { passive: true });
    stage.addEventListener("pointerleave", endPointer, { passive: true });
    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", endPointer);
      stage.removeEventListener("pointercancel", endPointer);
      stage.removeEventListener("pointerleave", endPointer);
      stage.removeEventListener("wheel", onWheel);
      pointers.current.clear();
      gesture.current.mode = "none";
    };
  }, [active, commit, constrain, stageRef, zoomAt]);

  return { transform: readout, fitToStage, setZoom, panBy, zoomAt, commit };
}
