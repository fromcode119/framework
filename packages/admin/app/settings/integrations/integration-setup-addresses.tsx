import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { SiteStorefrontClient } from '@/lib/tenants/site-storefront-client';
import type { IIntegrationSetupAddress } from '@/app/settings/integrations/interfaces/integration-setup-address.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The addresses a provider's own dashboard must be told about (an OAuth redirect URI, a webhook), shown
 * on this site's storefront address with a copy button. Without them an operator had to guess the
 * address the provider would refuse unless it was registered exactly.
 */
export class IntegrationSetupAddresses extends PureReactor {
  @prop declare addresses: IIntegrationSetupAddress[];
  @state private storefrontUrl = '';
  @state private copiedPath = '';

  componentDidMount(): void {
    void SiteStorefrontClient.current().then((url) => { this.storefrontUrl = url.replace(/\/+$/, ''); });
  }

  /** The full address on the bound site; the bare path in the platform scope, where no site is bound. */
  private fullAddress(address: IIntegrationSetupAddress): string {
    return `${this.storefrontUrl}${address.path}`;
  }

  @bound
  private async copy(address: IIntegrationSetupAddress): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.fullAddress(address));
      this.copiedPath = address.path;
    } catch {
      this.copiedPath = '';
    }
  }

  private renderAddress(address: IIntegrationSetupAddress): ReactNode {
    return (
      <div key={address.path} className="space-y-1">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{address.label}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200">
            {this.fullAddress(address)}
          </code>
          <button
            type="button"
            onClick={() => void this.copy(address)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {this.copiedPath === address.path ? <FrameworkIcons.Check size={12} /> : <FrameworkIcons.Copy size={12} />}
            {this.copiedPath === address.path ? AdminI18n.t('settings.integrations.setupAddressCopied') : AdminI18n.t('settings.integrations.setupAddressCopy')}
          </button>
        </div>
        {address.description ? <p className="text-xs text-slate-500">{address.description}</p> : null}
      </div>
    );
  }

  render(): ReactNode {
    if (!this.addresses?.length) return null;
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{AdminI18n.t('settings.integrations.setupAddresses')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {this.storefrontUrl
              ? AdminI18n.t('settings.integrations.setupAddressesHint')
              : AdminI18n.t('settings.integrations.setupAddressesNoSite')}
          </p>
        </div>
        {this.addresses.map((address) => this.renderAddress(address))}
      </div>
    );
  }
}
