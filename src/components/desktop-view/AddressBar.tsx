import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Lock, RotateCw, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddressBarProps {
  value: string;
  committedUrl: string;
  bookmarked: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleBookmark: () => void;
  onCopy: () => void;
}

/** Chrome-style omnibox with history controls. */
export function AddressBar({
  value,
  committedUrl,
  bookmarked,
  canGoBack,
  canGoForward,
  loading,
  onChange,
  onSubmit,
  onBack,
  onForward,
  onReload,
  onToggleBookmark,
  onCopy,
}: AddressBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Keyboard shortcut: Ctrl/Cmd + L focuses the address bar, like a real browser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const secure = committedUrl.startsWith("https://");

  return (
    <form
      className="flex w-full items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
        inputRef.current?.blur();
      }}
      role="search"
      aria-label="Address bar"
    >
      <div className="hidden items-center gap-1 sm:flex">
        <Button
          type="button"
          variant="chrome"
          size="icon-sm"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Go back"
        >
          <ArrowLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="chrome"
          size="icon-sm"
          onClick={onForward}
          disabled={!canGoForward}
          aria-label="Go forward"
        >
          <ArrowRight aria-hidden />
        </Button>
      </div>

      <Button
        type="button"
        variant="chrome"
        size="icon-sm"
        onClick={onReload}
        aria-label="Reload page"
      >
        <RotateCw aria-hidden className={cn(loading && "motion-safe:animate-spin")} />
      </Button>

      <div
        className={cn(
          "flex h-10 flex-1 items-center gap-2 rounded-full border border-border/70 bg-surface-raised px-3 transition-[box-shadow,border-color] duration-200",
          focused && "border-primary/60 shadow-glow",
        )}
      >
        {committedUrl && !focused ? (
          <Lock
            aria-hidden
            className={cn("size-3.5 shrink-0", secure ? "text-success" : "text-muted-foreground")}
          />
        ) : (
          <Search aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="url"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Enter a URL or search the web"
          aria-label="Website address"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear address"
            className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>

      <Button
        type="button"
        variant="chrome"
        size="icon-sm"
        onClick={onCopy}
        disabled={!committedUrl}
        aria-label="Copy current address"
        className="hidden sm:inline-flex"
      >
        <Copy aria-hidden />
      </Button>
      <Button
        type="button"
        variant="chrome"
        size="icon-sm"
        onClick={onToggleBookmark}
        disabled={!committedUrl}
        aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
        aria-pressed={bookmarked}
      >
        <Star aria-hidden className={cn(bookmarked && "fill-warning text-warning")} />
      </Button>
    </form>
  );
}
