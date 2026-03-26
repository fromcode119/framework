"use client";

import { useState, useEffect } from 'react';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from './api-routes';
import type { SystemStatus } from './use-system-status.types';
import { SystemStatusUtils } from './system-status-utils';

/**
 * React hook to check system status and maintenance mode.
 * 
 * @returns Current system status: 'LOADING' | 'OK' | 'MAINTENANCE'
 */
export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>('LOADING');

  useEffect(() => {
    async function initializeSystem() {
      try {
        const healthPath = SystemConstants.API_PATH.SYSTEM.HEALTH;

        // 1. Check system health and maintenance status (Whitelisted)
        let maintenance = false;
        try {
          const healthRes = await SystemStatusUtils.fetchWithTimeout(
            FrontendApiRoutes.buildFrontendApiUrl(healthPath),
            {
              cache: 'no-store',
              credentials: 'include'
            }
          );
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
