/**
 * Static build config used by GitHub Pages CI.
 * Skips TanStack Start's SSR/server build and produces a plain
 * client-side SPA that works with GitHub Pages.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "path";

export default defineConfig({
  base: "/deskly/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
