import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import type { KeyboardEvent, ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
import { IntegrationsPageUtils } from '@/app/settings/integrations/integrations-page-utils';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The saved providers of a type that allows several at once: one bordered row each, with its name, a
 * short summary, Edit and its own on/off switch. The whole row opens the provider in place of this list.
 */
export class IntegrationProviderList extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationProviderList, 'activeIntegration' | 'activeProviders' | 'changingProviderId' | 'onAddProvider' | 'onOpenProvider' | 'onToggleProvider'>;

  @prop declare activeIntegration: IIntegrationRecord;
  @prop declare activeProviders: IStoredProvider[];
  @prop declare changingProviderId: string | null;
  @prop declare onAddProvider: () => void;
  @prop declare onOpenProvider: (providerId: string) => void;
  @prop declare onToggleProvider: (provider: IStoredProvider) => void;

  /** The provider's kind (when renamed), its first plain value, and whether a secret is held. */
  private summary(provider: IStoredProvider): string {
    const definition = this.activeIntegration.providers.find((item) => item.key === provider.providerKey);
    const fields = definition?.fields || [];
    const parts: string[] = [];
    if (definition && provider.name && provider.name !== definition.label) parts.push(definition.label);
    const plain = fields.find((field) =>
      field.type !== IntegrationFieldType.PASSWORD && field.type !== IntegrationFieldType.BOOLEAN && String(provider.config?.[field.name] ?? '').trim());
    if (plain) parts.push(`${plain.label} ${String(provider.config[plain.name]).trim()}`);
    if (Object.values(IntegrationsPageUtils.readPreservedSecretFields(fields, provider.config || {})).some(Boolean)) {
      parts.push(AdminI18n.t('settings.integrations.secretSaved'));
    }
    return parts.join(' · ');
  }

  private handleRowKey(event: KeyboardEvent<HTMLDivElement>, providerId: string): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.onOpenProvider(providerId);
  }

  private renderRow(provider: IStoredProvider): ReactNode {
    const definition = this.activeIntegration.providers.find((item) => item.key === provider.providerKey);
    const enabled = provider.enabled !== false;
    const changing = this.changingProviderId === provider.id;
    const summary = this.summary(provider);
    return (
      <ListRow
        key={provider.id}
        title={<button type="button" className="fc-ext-row__link" onClick={() => this.onOpenProvider(provider.id)}>{provider.name || definition?.label || provider.providerKey}</button>}
        description={summary || undefined}
        actions={<>
          <Button variant={ButtonVariant.GHOST} onClick={() => this.onOpenProvider(provider.id)}>{AdminI18n.t('settings.integrations.edit')}</Button>
          <Switch checked={enabled} disabled={changing} onChange={() => { if (!changing) this.onToggleProvider(provider); }} />
        </>}
      />
    );
  }

  render(): ReactNode {
    const integration = this.activeIntegration;
    return (
      <ListShell title={integration.label} count={this.activeProviders.length}
        subtitle={[integration.description, AdminI18n.t('settings.integrations.severalProvidersAtOnce')].filter(Boolean).join(' ')}
        actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={14} />} onClick={this.onAddProvider}>{AdminI18n.t('settings.integrations.addProvider')}</Button>}>
        {this.activeProviders.length === 0
          ? <EmptyState title={AdminI18n.t('settings.integrations.noProvidersConfigured')} hint={AdminI18n.t('settings.integrations.noProvidersYetHint')} />
          : <div>{this.activeProviders.map((provider) => this.renderRow(provider))}</div>}
      </ListShell>
    );
  }
}
