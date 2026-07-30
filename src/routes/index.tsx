import { createFileRoute } from "@tanstack/react-router";
import { DesktopViewApp } from "@/components/desktop-view/DesktopViewApp";

const TITLE = "Desktop View — Browse Any Site in a Laptop Viewport";
const DESCRIPTION =
  "Render websites inside a fixed 1366×768 to 1920×1080 virtual laptop display on your phone, with pinch-zoom, pan, breakpoint rulers and live compatibility analysis.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <h1 className="sr-only">Desktop View — a virtual laptop display for mobile browsers</h1>
      <DesktopViewApp />
    </>
  );
}
