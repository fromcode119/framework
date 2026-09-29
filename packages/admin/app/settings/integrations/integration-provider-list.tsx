import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IIntegrationRecord } from '@/app/settings/integrations/interfaces/integration-record.interface';
import type { IProviderEditorState } from '@/app/settings/integrations/interfaces/provider-editor-state.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class IntegrationProviderList extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationProviderList, 'activeIntegration' | 'activeProviders' | 'selectedProviderId' | 'editor' | 'removeCandidateId' | 'changingProviderId' | 'runtimeProviderId' | 'onAddProvider' | 'onSelectProvider' | 'onToggleProvider' | 'onRequestRemove' | 'onCancelRemove' | 'onConfirmRemove'>;

  @prop declare activeIntegration: IIntegrationRecord | null;
  @prop declare activeProviders: IStoredProvider[];
  @prop declare selectedProviderId: string;
  @prop declare editor: IProviderEditorState | null;
  @prop declare removeCandidateId: string | null;
  @prop declare changingProviderId: string | null;
  @prop declare runtimeProviderId: string;
  @prop declare onAddProvider: () => void;
  @prop declare onSelectProvider: (providerId: string) => void;
  @prop declare onToggleProvider: (provider: IStoredProvider) => void;
  @prop declare onRequestRemove: (providerId: string) => void;
  @prop declare onCancelRemove: () => void;
  @prop declare onConfirmRemove: (provider: IStoredProvider) => void;

  render(): ReactNode {
    return (
      <Card className="xl:col-span-4" noPadding>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{AdminI18n.t('settings.integrations.providerInstances')}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {AdminI18n.t('settings.integrations.multipleProvidersAreSupportedIncluding')}
            </p>
          </div>
          <Button
            variant={ButtonVariant.SECONDARY}
            size={FieldSize.SM}
            icon={<FrameworkIcons.Plus size={14} />}
            onClick={this.onAddProvider}
          >
            {AdminI18n.t('settings.integrations.add')}
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {this.activeProviders.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{AdminI18n.t('settings.integrations.noProvidersConfigured')}</p>
              <p className="text-xs text-slate-500 mt-1">{AdminI18n.t('settings.integrations.addYourFirstProviderInstance')}</p>
            </div>
          )}

          {this.activeProviders.map((provider) => {
            const providerMeta = this.activeIntegration?.providers.find((item) => item.key === provider.providerKey);
            const selected = this.selectedProviderId === provider.id && !this.editor?.isNew;
            const enabled = provider.enabled !== false;
            const pendingRemove = this.removeCandidateId === provider.id;
            const isChanging = this.changingProviderId === provider.id;

            return (
              <div
                key={provider.id}
                className={`rounded-xl border transition-all ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => this.onSelectProvider(provider.id)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                        {provider.name || providerMeta?.label || provider.providerKey.toUpperCase()}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate mt-1">
                        {provider.providerKey}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {this.runtimeProviderId === provider.id && <Badge variant={BadgeVariant.INFO}>{AdminI18n.t('settings.integrations.runtime')}</Badge>}
                      <Badge variant={enabled ? 'green' : 'gray'}>{enabled ? AdminI18n.t('settings.integrations.enabled') : AdminI18n.t('settings.integrations.disabled')}</Badge>
                    </div>
                  </div>
                </button>

                <div className="px-4 pb-3 flex items-center justify-between gap-3">
                  <Switch
                    checked={enabled}
                    onChange={() => {
                      if (!isChanging) this.onToggleProvider(provider);
                    }}
                    disabled={isChanging}
                  />
                  {!pendingRemove ? (
                    <Button
                      variant={ButtonVariant.GHOST}
                      size={FieldSize.SM}
                      icon={<FrameworkIcons.Trash size={14} />}
                      onClick={() => this.onRequestRemove(provider.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      {AdminI18n.t('settings.integrations.remove')}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant={ButtonVariant.DANGER}
                        size={FieldSize.SM}
                        onClick={() => this.onConfirmRemove(provider)}
                        isLoading={isChanging}
                      >
                        {AdminI18n.t('settings.integrations.confirm')}
                      </Button>
                      <Button variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={this.onCancelRemove}>
                        {AdminI18n.t('settings.integrations.cancel')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
}
