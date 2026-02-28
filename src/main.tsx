import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- One-time stale-cache migration for stuck users ---
const CACHE_VERSION_KEY = "app-cache-version";
const CURRENT_VERSION = "__BUILD_TIMESTAMP__"; // replaced at build time

async function migrateStaleCache() {
  const stored = localStorage.getItem(CACHE_VERSION_KEY);
  if (stored !== CURRENT_VERSION) {
    console.log("[SW] Cache version mismatch – clearing old caches & service workers");
    // Unregister all existing service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    // Delete all caches
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
    // Reload once to start fresh
    window.location.reload();
    return false; // signal: don't continue rendering
  }
  return true; // safe to continue
}

async function bootstrap() {
  const ok = await migrateStaleCache();
  if (!ok) return; // page is reloading

  // Render app
  createRoot(document.getElementById("root")!).render(<App />);

  // --- Register SW with aggressive update strategy ---
  if ("serviceWorker" in navigator) {
    const { registerSW } = await import("virtual:pwa-register");

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[SW] New content available – updating and reloading");
        updateSW(true); // activate waiting SW
      },
      onOfflineReady() {
        console.log("[SW] App ready to work offline");
      },
      onRegisteredSW(swUrl, registration) {
        console.log("[SW] Registered:", swUrl);
        if (registration) {
          // Check for updates immediately
          registration.update();
          // Then check every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.error("[SW] Registration error:", error);
      },
    });
  }
}

bootstrap();
