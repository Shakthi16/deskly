/** URL normalisation and proxy helpers. */

/**
 * Turn arbitrary address-bar text into a navigable absolute URL.
 * Anything that is not host-like is treated as a DuckDuckGo search query
 * (DuckDuckGo's HTML endpoint is one of the few search UIs that allows framing).
 */
export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^(https?|about|data):/i.test(value)) return value;

  const looksLikeHost = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$|\?|#)/.test(value);
  if (looksLikeHost) return `https://${value}`;
  if (value.startsWith("localhost")) return `http://${value}`;

  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

/** Extract a short, human-friendly label for a URL. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** True when the URL points at the same origin as the app (framing always allowed). */
export function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * A CORS-safe, credential-free read-only rendering proxy.
 *
 * `r.jina.ai` returns a server-rendered, frame-able representation of a page.
 * It is optional: it changes rendering semantics (no page JS, simplified CSS),
 * so it is only used when the user explicitly enables it, and the UI states
 * clearly that the result is a reader rendering rather than the live site.
 */
export function readerProxyUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}
