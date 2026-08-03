import React from 'react';

import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';
import { Override } from '@fromcode119/react/view/override.client';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { SystemStatus } from '@/components/enums/system-status.enum';
import { SystemStatusUtils } from '@/lib/system-status-utils';
import { MaintenanceScreen } from '@/components/maintenance-screen';

/**
 * Gates the frontend on system status / maintenance mode.
 *
 * Checks system health once on mount: renders {@link MaintenanceScreen} when maintenance is on
 * (and not bypassed), otherwise renders its children through the `frontend.layout.main` override.
 * Status is one of 'LOADING' | 'OK' | 'MAINTENANCE'.
 */
export class SystemGate extends Reactor {
  @prop declare children?: ReactNode;

  @state status: SystemStatus = SystemStatus.LOADING;

  async componentDidMount(): Promise<void> {
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
        console.warn('[SystemGate] health check failed, continuing in normal mode:', healthError);
      }

      // 2. Gate for non-admins if maintenance is ON
      if (maintenance) {
        this.status = SystemStatus.MAINTENANCE;
        return;
      }

      this.status = SystemStatus.OK;
    } catch (err) {
      console.error('[SystemGate] Initialization failed:', err);
      this.status = SystemStatus.OK;
    }
  }

  render(): ReactNode {
    const normalizedChildren = React.Children.toArray(this.children);

    if (this.status === SystemStatus.MAINTENANCE) {
      return <MaintenanceScreen />;
    }

    return (
      <Override name="frontend.layout.main" fallback={normalizedChildren}>
        {normalizedChildren}
      </Override>
    );
  }
}
