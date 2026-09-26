import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CertificatesSettingsCard } from '@/app/settings/infrastructure/certificates-settings-card';
import { RestartServicesCard } from '@/app/settings/infrastructure/restart-services-card';
import { DeploymentsCard } from '@/app/settings/infrastructure/deployments-card.client';
import { InfrastructureSettingsPageCards } from '@/app/settings/infrastructure/page-cards.client';

/**
 * Infrastructure & Health.
 *
 * The top of the chain: the lifecycle, the platform-scope gate, and the page's frame. The cards, the
 * saves and the state live in the links below — see `InfrastructureSettingsPageState`.
 */
export class InfrastructureSettingsPage extends InfrastructureSettingsPageCards {
  async componentDidMount() {
    if (!this.canManagePlatform) {
      this.isLoading = false;
      return;
    }
    await this.loadMaintenance();
  }

  render(): ReactNode {
    // WHERE first, then WHO. `canManagePlatform` below answers whether this ACCOUNT may change the
    // server every site runs on; it never asked which site the console is standing in, so a platform
    // admin who had stepped into a customer's site was still shown maintenance mode, the SSR caps and
    // the isolation limits — controls that stop or reshape every OTHER site on the box — under a
    // header naming that one customer. The screen belongs to the platform scope, like Sites and
    // Sources.
    return (
      <PlatformScopeGate what="Infrastructure & Health">
        {this.body()}
      </PlatformScopeGate>
    );
  }

  protected body(): ReactNode {
    const theme = this.theme;

    if (this.isLoading) return <div className="p-12"><Loader label="Loading infrastructure settings..." /></div>;

    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail="Maintenance mode, render capacity and plugin isolation are properties of the server every site on this platform runs on, so only a platform admin can change them. Your own site's settings are under Settings — General, Localization and each plugin's own configuration." />
      );
    }

    return (
      <div className="p-6 animate-in fade-in duration-500 w-full">
         <div className="mb-6">
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
            Infrastructure & Health
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Administrative maintenance for this instance.
          </p>
        </div>

        {this.loadError && (
          <LoadErrorPanel
            title="Infrastructure settings could not be loaded"
            message={this.loadError}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {this.maintenanceCard()}

          {this.serverRenderingCard()}

          {this.pluginIsolationCard()}

          {this.retentionCard()}

          {/* The "Danger Zone" card held two buttons — "Flush Cache Clusters" and "Hard Factory
              Reset" — with no onClick, no href and no endpoint behind either. A destructive-looking
              control that silently does nothing is worse than no control: an operator can believe a
              factory reset was queued. Both were removed; re-add them with a real handler and a
              confirmation dialog when the endpoints exist.

              Restart Services below is what that note asked for: a real endpoint
              (`/system/deploy/restart`, permission `system:deploy:restart`, audited), a confirmation
              dialog, and a disabled button with a stated reason wherever the deployment cannot
              honour it. */}
          <div className="lg:col-span-2"><CertificatesSettingsCard /></div>
          <DeploymentsCard />
          <RestartServicesCard />

          {/* Cache flushing and factory reset still have no endpoint and so still have no button. */}
        </div>
      </div>
    );
  }
}
