import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- One-time stale-cache migration for stuck users ---
const CACHE_VERSION_KEY = "app-cache-version";
const CURRENT_VERSION = __BUILD_TIMESTAMP__; // Vite replaces the bare identifier at build time

function isPreviewHost() {
  const h = location.hostname;
  return h.includes('preview--') || h.includes('lovableproject') || h === 'localhost';
}

async function migrateStaleCache() {
  const stored = localStorage.getItem(CACHE_VERSION_KEY);
  // Treat the broken literal string as a legacy stale value
  const isLegacy = stored === "__BUILD_TIMESTAMP__";
  if (isLegacy || stored !== CURRENT_VERSION) {
    console.log("[SW] Cache version mismatch – clearing old caches & service workers");
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
    // Cache-busting reload to bypass stale index.html
    const url = new URL(location.href);
    url.searchParams.set('_v', CURRENT_VERSION);
    location.replace(url.toString());
    return false;
  }
  // Clean up the version query param if present
  if (location.search.includes('_v=')) {
    const url = new URL(location.href);
    url.searchParams.delete('_v');
    history.replaceState(null, '', url.toString());
  }
  return true;
}

async function bootstrap() {
  const ok = await migrateStaleCache();
  if (!ok) return; // page is reloading

  // Render app
  createRoot(document.getElementById("root")!).render(<App />);

  // --- Register SW only on production (not preview) ---
  if ("serviceWorker" in navigator && !isPreviewHost()) {
    const { registerSW } = await import("virtual:pwa-register");

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[SW] New content available – updating and reloading");
        updateSW(true);
      },
      onOfflineReady() {
        console.log("[SW] App ready to work offline");
      },
      onRegisteredSW(swUrl, registration) {
        console.log("[SW] Registered:", swUrl);
        if (registration) {
          registration.update();
          setInterval(() => { registration.update(); }, 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.error("[SW] Registration error:", error);
      },
    });
  } else if (isPreviewHost() && "serviceWorker" in navigator) {
    // Ensure no leftover SW on preview hosts
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
}

bootstrap();
