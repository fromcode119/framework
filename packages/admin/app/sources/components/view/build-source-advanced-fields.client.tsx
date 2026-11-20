import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Provider, token and publish target: fields most sources leave as they are.
 *
 * They stand on the form, named as a group. They used to sit behind a fold called "Advanced" with a
 * line of summary standing in for them, which opened by itself when reading the repository failed —
 * an arrangement that needed a rule for when to open because a control nobody opens is a control
 * nobody sets.
 */
export class BuildSourceAdvancedFields extends PureReactor {
  declare props: Pick<BuildSourceAdvancedFields, 'provider' | 'providerOptions' | 'providerPlaceholder' | 'providerDisabled' | 'onProvider' | 'secret' | 'secretPlaceholder' | 'secretHelp' | 'secretSummary' | 'onSecret' | 'onSecretBlur' | 'publishToSite' | 'siteOptions' | 'onPublish'>;

  @prop declare provider: string;
  @prop declare providerOptions: { label: string; value: string }[];
  @prop declare providerPlaceholder: string;
  @prop declare providerDisabled: boolean;
  @prop declare onProvider: (value: string) => void;
  @prop declare secret: string;
  @prop declare secretPlaceholder: string;
  @prop declare secretHelp: string;
  /** The token's state in a word or two, for the collapsed row. */
  @prop declare secretSummary: string;
  @prop declare onSecret: (value: string) => void;
  @prop declare onSecretBlur: () => void;
  @prop declare publishToSite: string;
  @prop declare siteOptions: { label: string; value: string }[];
  @prop declare onPublish: (value: string) => void;

  @bound private handleSecret(event: ChangeEvent<HTMLInputElement>): void {
    this.onSecret(event.target.value);
  }

  private get publishOptions(): { label: string; value: string }[] {
    return [{ label: AdminI18n.t('sources.publishToSiteOff'), value: '' }, ...this.siteOptions];
  }

  private renderFields(): ReactNode {
    return (
      <div className="grid gap-8">
        {/* One option today. Shown anyway: which provider fetches a source is a property of the source. */}
        <Select label={AdminI18n.t('sources.provider')} value={this.provider} options={this.providerOptions} placeholder={this.providerPlaceholder} disabled={this.providerDisabled} onChange={this.onProvider} />
        <div className="space-y-2">
          <Input label={AdminI18n.t('sources.githubToken')} type="password" autoComplete="new-password" value={this.secret} onChange={this.handleSecret} onBlur={this.onSecretBlur} placeholder={this.secretPlaceholder} />
          <p className="text-xs leading-5 fc-tone-muted">{this.secretHelp}</p>
        </div>
        <div className="space-y-1">
          <Select label={AdminI18n.t('sources.publishToSite')} value={this.publishToSite} options={this.publishOptions} onChange={this.onPublish} />
          <p className="text-xs fc-tone-muted">{AdminI18n.t('sources.publishToSiteHelp')}</p>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      /* The settings are ON the form. They used to sit behind a fold called "Advanced", with a line of
         summary standing in for them — a control nobody opens is a control nobody sets, and a summary
         of a setting is not the setting. A group with a name is enough. */
      <div className="fc-surface p-4">
        <h3 className="mb-4 fc-size-lg font-medium leading-6 fc-tone-text">{AdminI18n.t('sources.advanced')}</h3>
        {this.renderFields()}
      </div>
    );
  }
}
