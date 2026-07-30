import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark as BookmarkIcon,
  Gauge,
  History,
  Monitor,
  Moon,
  Plus,
  Smartphone,
  Sun,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AddressBar } from "./AddressBar";
import { DeviceSelector } from "./DeviceSelector";
import { FloatingDock } from "./FloatingDock";
import { CapabilityPanel, DiagnosticsList, PerformancePanel } from "./InsightPanels";
import { ViewportStage, type LoadState, type ViewportStageHandle } from "./ViewportStage";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useHydrated, useReducedMotion } from "@/hooks/useReducedMotion";
import { useViewportTransform } from "@/hooks/useViewportTransform";

import { canCaptureDisplay, captureScreenshot, startRecording, type RecordingHandle } from "@/lib/desktop-view/capture";
import { collectCapabilities } from "@/lib/desktop-view/capabilities";
import { buildDiagnostics } from "@/lib/desktop-view/diagnostics";
import { MAX_SCALE, MIN_SCALE, clampDimension, resolveResolution } from "@/lib/desktop-view/presets";
import type { Bookmark, CapabilityReport, DesktopViewSettings, HistoryEntry } from "@/lib/desktop-view/types";
import { hostLabel, normalizeUrl, readerProxyUrl } from "@/lib/desktop-view/url";
import { cn } from "@/lib/utils";

const DEFAULT_SETTINGS: DesktopViewSettings = {
  resolutionId: "1440x900",
  customWidth: 1512,
  customHeight: 945,
  desktopMode: true,
  cursorOverlay: true,
  longPressHover: true,
  showPerformance: false,
  showBreakpoints: false,
  compareMode: false,
  dprCap: 2,
  useReaderProxy: false,
  theme: "dark",
};

interface TabState {
  id: string;
  url: string;
  draft: string;
  history: string[];
  historyIndex: number;
  reloadToken: number;
  loadState: LoadState;
}

const newTab = (): TabState => ({
  id: `tab-${Math.random().toString(36).slice(2, 9)}`,
  url: "",
  draft: "",
  history: [],
  historyIndex: -1,
  reloadToken: 0,
  loadState: "idle",
});

/**
 * Desktop View — a virtual laptop display for touch devices.
 *
 * Architecture: state lives here, gesture/transform maths in `useViewportTransform`,
 * frame lifecycle in `ViewportStage`, analysis in `lib/desktop-view/*`. No global
 * store is needed because the tree is shallow and the hot path (dragging) never
 * touches React state.
 */
export function DesktopViewApp() {
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();

  const [settings, setSettings] = usePersistentState<DesktopViewSettings>(
    "desktop-view:settings",
    DEFAULT_SETTINGS,
  );
  const [history, setHistory] = usePersistentState<HistoryEntry[]>("desktop-view:history", []);
  const [bookmarks, setBookmarks] = usePersistentState<Bookmark[]>("desktop-view:bookmarks", []);

  const [tabs, setTabs] = useState<TabState[]>([newTab()]);
  const [activeTabId, setActiveTabId] = useState(() => "");
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const [mode, setMode] = useState<"navigate" | "interact">("navigate");
  const loadState = activeTab?.loadState ?? "idle";
  const [fullscreen, setFullscreen] = useState(false);
  const [capabilities, setCapabilities] = useState<CapabilityReport | null>(null);
  const [recording, setRecording] = useState(false);
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false);
  const recordingRef = useRef<RecordingHandle | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const stageHandle = useRef<ViewportStageHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActiveTabId((id) => id || tabs[0].id), [tabs]);

  // Theme is a class on <html> so tokens resolve for portalled overlays too.
  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.theme === "light");
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  useEffect(() => setCapabilities(collectCapabilities()), []);

  const deviceWidth = hydrated ? Math.max(320, Math.round(window.innerWidth)) : 390;
  const resolution = resolveResolution(
    settings.resolutionId,
    settings.customWidth,
    settings.customHeight,
  );
  const displayWidth = settings.desktopMode ? resolution.width : deviceWidth;
  const displayHeight = settings.desktopMode
    ? resolution.height
    : hydrated
      ? Math.max(480, Math.round(window.innerHeight * 0.82))
      : 780;
  const deviceLabel = resolution.device ? `${resolution.brand ?? ""} ${resolution.device}`.trim() : undefined;

  const { transform, fitToStage, setZoom, panBy } = useViewportTransform({
    stageRef,
    layerRef,
    displayWidth,
    displayHeight,
    reducedMotion,
    active: mode === "navigate",
  });

  const { sample, quality } = usePerformanceMonitor(settings.showPerformance);

  // Fit whenever the virtual display or the stage geometry changes.
  useEffect(() => {
    const id = window.setTimeout(() => fitToStage("contain"), 60);
    return () => window.clearTimeout(id);
  }, [displayWidth, displayHeight, fitToStage, settings.compareMode]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitToStage("contain"));
    });
    ro.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [fitToStage]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Release recorder resources if the component unmounts mid-capture.
  useEffect(() => () => recordingRef.current?.stop(), []);

  const updateTab = useCallback(
    (id: string, patch: Partial<TabState>) =>
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );

  const setLoadState = useCallback(
    (state: LoadState) => {
      if (activeTab) {
        updateTab(activeTab.id, { loadState: state });
      }
    },
    [activeTab, updateTab],
  );

  const navigate = useCallback(
    (raw: string) => {
      if (!activeTab) return;
      const url = normalizeUrl(raw);
      if (!url) return;
      const finalUrl = settings.useReaderProxy ? readerProxyUrl(url) : url;
      const nextHistory = [...activeTab.history.slice(0, activeTab.historyIndex + 1), url];

      updateTab(activeTab.id, {
        url: finalUrl,
        draft: url,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
        reloadToken: activeTab.reloadToken + 1,
        loadState: "loading",
      });
      setHistory((prev) =>
        [{ url, title: hostLabel(url), visitedAt: Date.now() }, ...prev.filter((h) => h.url !== url)].slice(0, 60),
      );
    },
    [activeTab, setHistory, settings.useReaderProxy, updateTab],
  );

  const goto = useCallback(
    (index: number) => {
      if (!activeTab) return;
      const url = activeTab.history[index];
      if (!url) return;
      updateTab(activeTab.id, {
        historyIndex: index,
        url: settings.useReaderProxy ? readerProxyUrl(url) : url,
        draft: url,
        reloadToken: activeTab.reloadToken + 1,
        loadState: "loading",
      });
    },
    [activeTab, settings.useReaderProxy, updateTab],
  );

  const currentUrl = activeTab?.history[activeTab.historyIndex] ?? "";
  const bookmarked = bookmarks.some((b) => b.url === currentUrl);

  const diagnostics = useMemo(
    () =>
      buildDiagnostics({
        url: currentUrl,
        loadState,
        desktopMode: settings.desktopMode,
        scale: transform.scale,
        width: displayWidth,
      }),
    [currentUrl, displayWidth, loadState, settings.desktopMode, transform.scale],
  );

  const blockedCount = diagnostics.filter((d) => d.level !== "ok").length;

  // Keyboard shortcuts for external keyboards / desktop testing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const meta = e.ctrlKey || e.metaKey;

      if (meta && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(Math.min(MAX_SCALE, transform.scale * 1.15));
      } else if (meta && e.key === "-") {
        e.preventDefault();
        setZoom(Math.max(MIN_SCALE, transform.scale / 1.15));
      } else if (meta && e.key === "0") {
        e.preventDefault();
        fitToStage("contain");
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        stageHandle.current?.reload();
      } else if (!meta && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 240 : 80;
        panBy(
          e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0,
          e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitToStage, panBy, setZoom, transform.scale]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen was refused by this browser (iOS Safari does not allow it).");
    }
  }, []);

  const onScreenshot = useCallback(async () => {
    try {
      await captureScreenshot();
      toast.success("Screenshot saved");
    } catch {
      toast.error("Screen capture was cancelled or is unavailable here.");
    }
  }, []);

  const onToggleRecording = useCallback(async () => {
    if (recording) {
      recordingRef.current?.stop();
      recordingRef.current = null;
      setRecording(false);
      return;
    }
    try {
      recordingRef.current = await startRecording(() => setRecording(false));
      setRecording(true);
    } catch {
      toast.error("Recording was cancelled or is unavailable here.");
    }
  }, [recording]);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success("Address copied");
    } catch {
      toast.error("Clipboard access was denied.");
    }
  }, [currentUrl]);

  const set = <K extends keyof DesktopViewSettings>(key: K, value: DesktopViewSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div ref={shellRef} className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-surface-sunken px-2 py-1.5 scrollbar-slim">
        {tabs.map((tab) => {
          const label = tab.history[tab.historyIndex]
            ? hostLabel(tab.history[tab.historyIndex])
            : "New display";
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-xs transition-colors",
                tab.id === activeTabId
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                aria-current={tab.id === activeTabId}
                className="max-w-36 truncate"
              >
                {label}
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${label}`}
                  onClick={() => {
                    setTabs((prev) => prev.filter((t) => t.id !== tab.id));
                    if (tab.id === activeTabId) {
                      const rest = tabs.filter((t) => t.id !== tab.id);
                      setActiveTabId(rest[0]?.id ?? "");
                    }
                  }}
                  className="opacity-60 transition-opacity hover:opacity-100"
                >
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </div>
          );
        })}
        <Button
          variant="chrome"
          size="icon-sm"
          aria-label="New virtual display tab"
          onClick={() => {
            const tab = newTab();
            setTabs((prev) => [...prev, tab]);
            setActiveTabId(tab.id);
          }}
        >
          <Plus aria-hidden />
        </Button>
      </div>

      {/* Chrome */}
      <header className="flex items-center gap-2 border-b border-border/60 bg-surface-raised/70 px-2 py-2 backdrop-blur">
        <AddressBar
          value={activeTab?.draft ?? ""}
          committedUrl={currentUrl}
          bookmarked={bookmarked}
          loading={loadState === "loading" || loadState === "slow"}
          canGoBack={!!activeTab && activeTab.historyIndex > 0}
          canGoForward={!!activeTab && activeTab.historyIndex < activeTab.history.length - 1}
          onChange={(v) => activeTab && updateTab(activeTab.id, { draft: v })}
          onSubmit={navigate}
          onBack={() => activeTab && goto(activeTab.historyIndex - 1)}
          onForward={() => activeTab && goto(activeTab.historyIndex + 1)}
          onReload={() => stageHandle.current?.reload()}
          onCopy={copyAddress}
          onToggleBookmark={() =>
            setBookmarks((prev) =>
              bookmarked
                ? prev.filter((b) => b.url !== currentUrl)
                : [
                    { id: `bm-${Date.now()}`, url: currentUrl, label: hostLabel(currentUrl) },
                    ...prev,
                  ],
            )
          }
        />

        <Button
          variant="chrome"
          size="icon-sm"
          aria-label={settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => set("theme", settings.theme === "dark" ? "light" : "dark")}
        >
          {settings.theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="chrome"
              size="icon-sm"
              aria-label={`Open control centre${blockedCount ? `, ${blockedCount} compatibility notes` : ""}`}
              className="relative"
            >
              <Settings2 aria-hidden />
              {blockedCount > 0 && (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-warning" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-full max-w-md flex-col gap-0 overflow-y-auto bg-background p-0 scrollbar-slim"
          >
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle className="font-display">Control centre</SheetTitle>
            </SheetHeader>

            <Tabs defaultValue="viewport" className="flex-1">
              <TabsList className="m-3 grid w-[calc(100%-1.5rem)] grid-cols-4">
                <TabsTrigger value="viewport">Viewport</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="perf">Perf</TabsTrigger>
                <TabsTrigger value="library">Library</TabsTrigger>
              </TabsList>

              <TabsContent value="viewport" className="space-y-4 p-4 pt-0">
                <SettingRow
                  id="desktop-mode"
                  label="Desktop emulation"
                  hint="Lay the page out at the selected laptop resolution instead of the device width."
                  checked={settings.desktopMode}
                  onChange={(v) => set("desktopMode", v)}
                />
                <SettingRow
                  id="cursor"
                  label="Desktop cursor overlay"
                  hint="Show a pointer that follows your finger while navigating the canvas."
                  checked={settings.cursorOverlay}
                  onChange={(v) => set("cursorOverlay", v)}
                />
                <SettingRow
                  id="hover"
                  label="Long-press tap-through"
                  hint="Hold on the canvas to arm one tap that reaches the page without leaving navigate mode."
                  checked={settings.longPressHover}
                  onChange={(v) => set("longPressHover", v)}
                />
                <SettingRow
                  id="compare"
                  label="Side-by-side comparison"
                  hint="Render a 390 px mobile display next to the desktop display."
                  checked={settings.compareMode}
                  onChange={(v) => set("compareMode", v)}
                />
                <SettingRow
                  id="breakpoints"
                  label="Breakpoint rulers"
                  hint="Overlay sm/md/lg/xl/2xl guides on the virtual display."
                  checked={settings.showBreakpoints}
                  onChange={(v) => set("showBreakpoints", v)}
                />
                <SettingRow
                  id="perf"
                  label="Performance HUD"
                  hint="Run the frame-timing monitor and show live statistics."
                  checked={settings.showPerformance}
                  onChange={(v) => set("showPerformance", v)}
                />
                <SettingRow
                  id="proxy"
                  label="Reader proxy fallback"
                  hint="Route pages through a public read-only renderer when embedding is refused. This returns a simplified server-rendered document, not the live site."
                  checked={settings.useReaderProxy}
                  onChange={(v) => set("useReaderProxy", v)}
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-w">Custom width</Label>
                    <Input
                      id="custom-w"
                      type="number"
                      inputMode="numeric"
                      value={settings.customWidth}
                      onChange={(e) => set("customWidth", clampDimension(Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-h">Custom height</Label>
                    <Input
                      id="custom-h"
                      type="number"
                      inputMode="numeric"
                      value={settings.customHeight}
                      onChange={(e) => set("customHeight", clampDimension(Number(e.target.value)))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dpr">Device pixel ratio cap: {settings.dprCap}×</Label>
                  <input
                    id="dpr"
                    type="range"
                    min={1}
                    max={3}
                    step={0.5}
                    value={settings.dprCap}
                    onChange={(e) => set("dprCap", Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limits how many physical pixels the compositor rasterises for the virtual
                    display. Lower values trade sharpness for frame rate on mid-range hardware.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4 p-4 pt-0">
                <DiagnosticsList diagnostics={diagnostics} />
                <CapabilityPanel report={capabilities} />
              </TabsContent>

              <TabsContent value="perf" className="p-4 pt-0">
                {settings.showPerformance ? (
                  <PerformancePanel
                    sample={sample}
                    quality={quality}
                    displayWidth={displayWidth}
                    displayHeight={displayHeight}
                    scale={transform.scale}
                    dpr={Math.min(settings.dprCap, capabilities?.devicePixelRatio ?? 1)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enable the performance HUD in the Viewport tab to start the frame-timing
                    monitor. It is off by default so it never costs frames you did not ask for.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="library" className="space-y-5 p-4 pt-0">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <BookmarkIcon aria-hidden className="size-4 text-primary" /> Bookmarks
                  </h3>
                  {bookmarks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
                  )}
                  <ul className="space-y-1">
                    {bookmarks.map((b) => (
                      <ListRow
                        key={b.id}
                        label={b.label}
                        sub={b.url}
                        onOpen={() => navigate(b.url)}
                        onRemove={() => setBookmarks((prev) => prev.filter((x) => x.id !== b.id))}
                      />
                    ))}
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <History aria-hidden className="size-4 text-primary" /> History
                  </h3>
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing visited yet.</p>
                  )}
                  <ul className="space-y-1">
                    {history.map((h) => (
                      <ListRow
                        key={h.url}
                        label={h.title}
                        sub={new Date(h.visitedAt).toLocaleString()}
                        onOpen={() => navigate(h.url)}
                        onRemove={() => setHistory((prev) => prev.filter((x) => x.url !== h.url))}
                      />
                    ))}
                  </ul>
                  {history.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setHistory([])}>
                      Clear history
                    </Button>
                  )}
                </section>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>

        {/* Device selector sheet */}
        <Sheet open={deviceSheetOpen} onOpenChange={setDeviceSheetOpen}>
          <SheetContent
            side="left"
            className="flex w-full max-w-xs flex-col gap-0 overflow-y-auto bg-background p-0 scrollbar-slim"
          >
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle className="font-display">Select device</SheetTitle>
            </SheetHeader>
            <div className="flex-1 p-4">
              <DeviceSelector
                resolutionId={settings.resolutionId}
                onSelect={(id) => {
                  set("resolutionId", id);
                  setDeviceSheetOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Stage */}
      <main className="relative min-h-0 flex-1">
        <div className={cn("flex h-full w-full", settings.compareMode && "divide-x divide-border")}>
          <div className="relative min-w-0 flex-1">
            <ViewportStage
              ref={stageHandle}
              stageRef={stageRef}
              layerRef={layerRef}
              url={activeTab?.url ?? ""}
              reloadToken={activeTab?.reloadToken ?? 0}
              width={displayWidth}
              height={displayHeight}
              mode={mode}
              cursorOverlay={settings.cursorOverlay}
              longPressHover={settings.longPressHover}
              showBreakpoints={settings.showBreakpoints}
              economy={quality === "economy"}
              loadState={loadState}
              onLoadStateChange={setLoadState}
            />
          </div>

          {settings.compareMode && (
            <aside
              className="hidden w-[300px] shrink-0 flex-col bg-surface-sunken md:flex"
              aria-label="Mobile comparison view"
            >
              <p className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <Smartphone aria-hidden className="size-3.5" /> Mobile 390 × 844
              </p>
              <div className="flex-1 overflow-hidden p-2">
                {activeTab?.url ? (
                  <iframe
                    key={`compare-${activeTab.url}-${activeTab.reloadToken}`}
                    src={activeTab.url}
                    title="Mobile rendering for comparison"
                    width={390}
                    height={844}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    className="h-[844px] w-[390px] origin-top-left rounded-lg border-0 bg-white"
                    style={{ transform: "scale(0.72)" }}
                  />
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">No page loaded.</p>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Floating controls */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <FloatingDock
            scale={transform.scale}
            resolutionId={settings.resolutionId}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
            deviceLabel={deviceLabel}
            mode={mode}
            fullscreen={fullscreen}
            recording={recording}
            captureSupported={hydrated && canCaptureDisplay()}
            showBreakpoints={settings.showBreakpoints}
            onZoom={(d) => setZoom(transform.scale + d)}
            onFit={() => fitToStage("contain")}
            onFitWidth={() => fitToStage("width")}
            onModeChange={setMode}
            onResolutionChange={(id) => set("resolutionId", id)}
            onToggleFullscreen={toggleFullscreen}
            onScreenshot={onScreenshot}
            onToggleRecording={onToggleRecording}
            onToggleBreakpoints={() => set("showBreakpoints", !settings.showBreakpoints)}
            onOpenDeviceSelector={() => setDeviceSheetOpen(true)}
          />
        </div>

        {/* Performance HUD */}
        {settings.showPerformance && (
          <div
            className="dv-panel pointer-events-none absolute right-3 top-3 rounded-xl border border-border/60 px-3 py-2 font-mono text-[11px] tabular-nums"
            role="status"
            aria-live="off"
          >
            <span className="flex items-center gap-1.5">
              <Gauge aria-hidden className="size-3 text-primary" />
              {sample.fps} fps · {sample.frameTimeMs.toFixed(1)} ms
              {sample.heapMb !== null && ` · ${sample.heapMb} MB`}
            </span>
            <span className="text-muted-foreground">
              {displayWidth}×{displayHeight} @ {Math.round(transform.scale * 100)}% · {quality}
            </span>
          </div>
        )}

        {/* Gesture hint */}
        {mode === "navigate" && activeTab?.url && (
          <div className="pointer-events-none absolute left-3 top-3 hidden rounded-full bg-surface-raised/80 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur sm:block">
            Drag to pan · pinch to zoom · double-tap to fit · switch to Interact to click
          </div>
        )}
      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface-sunken px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Monitor aria-hidden className="size-3.5" />
          {settings.desktopMode
            ? `${deviceLabel ?? `${displayWidth}×${displayHeight}`}`
            : `Device width · ${displayWidth}×${displayHeight}`}
        </span>
        <span className="truncate">
          {capabilities ? `${capabilities.engine} · ${capabilities.formFactor}` : "Detecting…"}
        </span>
      </footer>
    </div>
  );
}

function SettingRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ListRow({
  label,
  sub,
  onOpen,
  onRemove,
}: {
  label: string;
  sub: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </button>
      <Button variant="chrome" size="icon-sm" onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}
