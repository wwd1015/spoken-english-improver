import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// The Anthropic API key lives in .env (ANTHROPIC_API_KEY, no VITE_ prefix, so
// it is never exposed to client code). The dev server proxies /api/anthropic/*
// to api.anthropic.com and injects the key server-side.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Installable PWA: on iPhone, open the deployed URL in Safari and use
      // Share → "Add to Home Screen" for a full-screen, app-like experience.
      // The service worker precaches the app shell, so Practice (TTS,
      // recording, scheduling — all local) works even offline; only Capture
      // needs the network.
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["apple-touch-icon.png"],
        manifest: {
          name: "Gap Trainer",
          short_name: "Gap Trainer",
          description:
            "Convert words you already understand into words you can say.",
          display: "standalone",
          orientation: "portrait",
          background_color: "#0a0a0a",
          theme_color: "#0a0a0a",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
          },
        },
      },
    },
  };
});
