"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Guards the one-per-session storage-full toast. */
let storageWarned = false;

/**
 * Registers the offline service worker in production only.
 * Skipped during `next dev` so hot reloaded assets are never served stale.
 * Also wires up: prompt updates when a new worker takes over, and a
 * user-visible warning when localStorage runs out of room.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = (): void => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration is best-effort; the app works fine without it.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  // Act immediately once a new worker takes over, and expose a reload hook
  // the UI can call (e.g. from a toast) to pick up a freshly deployed shell.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const track = (next: ServiceWorkerRegistration): void => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      registration = next;
      registration.addEventListener("updatefound", onUpdateFound);
    };

    const onUpdateFound = (): void => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller !== null
        ) {
          worker.postMessage({ type: "SKIP_WAITING" });
          window.__strideUpdateReady = () => window.location.reload();
        }
      });
    };

    navigator.serviceWorker
      .getRegistration()
      .then((existing) => {
        if (!existing) return;
        track(existing);
      })
      .catch(() => undefined);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  // Surface quota exhaustion once, instead of dropping writes invisibly.
  useEffect(() => {
    const onStorageFull = (): void => {
      if (storageWarned) return;
      storageWarned = true;
      toast.error("Storage is full", {
        description:
          "Your browser can no longer save changes. Export a backup and free up space.",
        duration: Infinity,
      });
    };

    window.addEventListener("stride:storage-full", onStorageFull);
    return () => window.removeEventListener("stride:storage-full", onStorageFull);
  }, []);

  return null;
}
