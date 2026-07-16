"use client";

import { useEffect } from 'react';
import { AdminServiceWorkerConstants } from '@/lib/pwa/admin-service-worker-constants';

/**
 * Registers the admin-console service worker on the client (installability + offline shell). No UI. Silent
 * on failure — a blocked/unsupported SW must never break the app. Domain-agnostic framework capability.
 */
export default function PwaRegister(): null {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register(AdminServiceWorkerConstants.SCRIPT_PATH).catch(() => { /* ignore */ });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
