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
      <div key={provider.id} role="button" tabIndex={0}
        onClick={() => this.onOpenProvider(provider.id)}
        onKeyDown={(event) => this.handleRowKey(event, provider.id)}
        className="flex cursor-pointer items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-indigo-500/50">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{provider.name || definition?.label || provider.providerKey}</p>
          {summary ? <p className="mt-0.5 truncate text-[12px] text-slate-500">{summary}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">
          {AdminI18n.t('settings.integrations.edit')}
          <FrameworkIcons.ChevronRight size={14} />
        </span>
        {/* The switch acts on its own; it must not also open the provider. */}
        <span className="shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Switch checked={enabled} disabled={changing} onChange={() => { if (!changing) this.onToggleProvider(provider); }} />
        </span>
      </div>
    );
  }

  render(): ReactNode {
    const integration = this.activeIntegration;
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{integration.label}</h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {[integration.description, AdminI18n.t('settings.integrations.severalProvidersAtOnce')].filter(Boolean).join(' ')}
            </p>
          </div>
          <button type="button" onClick={this.onAddProvider}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800">
            <FrameworkIcons.Plus size={14} />
            {AdminI18n.t('settings.integrations.addProvider')}
          </button>
        </div>

        {this.activeProviders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{AdminI18n.t('settings.integrations.noProvidersConfigured')}</p>
            <p className="mt-1 text-xs text-slate-500">{AdminI18n.t('settings.integrations.noProvidersYetHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">{this.activeProviders.map((provider) => this.renderRow(provider))}</div>
        )}
      </div>
    );
  }
}
