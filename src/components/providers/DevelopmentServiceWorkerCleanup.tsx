"use client";

import { useEffect } from "react";

const shouldCleanupServiceWorker =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_SW !== "true";

export function DevelopmentServiceWorkerCleanup() {
  useEffect(() => {
    if (
      !shouldCleanupServiceWorker ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    async function cleanupServiceWorkers() {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (registrations.length === 0) {
        return;
      }

      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );

      if (navigator.serviceWorker.controller) {
        window.location.reload();
      }
    }

    void cleanupServiceWorkers();
  }, []);

  return null;
}
