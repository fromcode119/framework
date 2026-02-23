"use client";

import { useState, useEffect } from 'react';
import { ApiPath } from '@fromcode/sdk';
import { buildFrontendApiUrl } from './api-routes';

export type SystemStatus = 'LOADING' | 'OK' | 'MAINTENANCE';
const REQUEST_TIMEOUT_MS = 5000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>('LOADING');

  useEffect(() => {
    async function initializeSystem() {
      try {
        const healthPath = (ApiPath as any)?.SYSTEM?.HEALTH;

        // 1. Check system health and maintenance status (Whitelisted)
        let maintenance = false;
        try {
          const healthRes = await fetchWithTimeout(buildFrontendApiUrl(healthPath), {
            cache: 'no-store',
            credentials: 'include'
          });
          if (healthRes.ok) {
            const health = await healthRes.json();
            maintenance = Boolean(health?.maintenance && !health?.bypass);
          }
        } catch (healthError) {
          console.warn('[useSystemStatus] health check failed, continuing in normal mode:', healthError);
        }

        // 2. Gate for non-admins if maintenance is ON
        if (maintenance) {
          setStatus('MAINTENANCE');
          return;
        }

        setStatus('OK');
      } catch (err) {
        console.error("[useSystemStatus] Initialization failed:", err);
        setStatus('OK');
      }
    }

    initializeSystem();
  }, []);

  return status;
}
