import { createFileRoute } from "@tanstack/react-router";
import { DesktopViewApp } from "@/components/desktop-view/DesktopViewApp";

const TITLE = "Deskly — Virtual Desktop Display for Mobile Browsers";
const DESCRIPTION =
  "Deskly lets you render websites inside a fixed 1366×768 to 1920×1080 virtual desktop display on your phone or tablet.";

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
      <h1 className="sr-only">Deskly — a virtual desktop display for mobile browsers</h1>
      <DesktopViewApp />
    </>
  );
}
