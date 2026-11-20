import { Hint } from '@/components/ui/view/hint.client';
import { Label } from '@/components/ui/view/label.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { Heading } from '@/components/ui/view/heading.client';
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

  componentDidMount(): void {
    void SiteStorefrontClient.current().then((url) => { this.storefrontUrl = url.replace(/\/+$/, ''); });
  }

  /** The full address on the bound site; the bare path in the platform scope, where no site is bound. */
  private fullAddress(address: IIntegrationSetupAddress): string {
    return `${this.storefrontUrl}${address.path}`;
  }

  private renderAddress(address: IIntegrationSetupAddress): ReactNode {
    return (
      <div key={address.path} className="fc-field-stack">
        <Label>{address.label}</Label>
        <CopyValue value={this.fullAddress(address)} />
        {address.description ? <Hint>{address.description}</Hint> : null}
      </div>
    );
  }

  render(): ReactNode {
    if (!this.addresses?.length) return null;
    return (
      <div className="fc-form-stack">
        <div className="fc-field-stack">
          <Heading level="h3">{AdminI18n.t('settings.integrations.setupAddresses')}</Heading>
          <Hint>{this.storefrontUrl ? AdminI18n.t('settings.integrations.setupAddressesHint') : AdminI18n.t('settings.integrations.setupAddressesNoSite')}</Hint>
        </div>
        {this.addresses.map((address) => this.renderAddress(address))}
      </div>
    );
  }
}
