import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Provider, token and publish target: fields most sources leave as they are.
 *
 * Collapsed, the toggle row still states all three values, so nothing the source will use is out of
 * sight; it only stops asking for them up front. It opens by itself when reading the repository
 * failed, because the token is then the field the operator has to fill in next.
 */
export class BuildSourceAdvancedFields extends PureReactor {
  declare props: Pick<BuildSourceAdvancedFields, 'open' | 'onToggle' | 'provider' | 'providerOptions' | 'providerPlaceholder' | 'providerDisabled' | 'onProvider' | 'secret' | 'secretPlaceholder' | 'secretHelp' | 'secretSummary' | 'onSecret' | 'onSecretBlur' | 'publishToSite' | 'siteOptions' | 'onPublish'>;

  @prop declare open: boolean;
  @prop declare onToggle: () => void;
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

  /** "Off" is stated, never an empty default. */
  private get summary(): string {
    const provider = this.providerOptions.find((option) => option.value === this.provider)?.label ?? this.provider;
    const publish = this.publishOptions.find((option) => option.value === this.publishToSite)?.label ?? this.publishToSite;
    return [provider, this.secretSummary, publish].filter(Boolean).join(' · ');
  }

  private renderFields(): ReactNode {
    return (
      <div className="grid gap-4 px-4 pb-4">
        {/* One option today. Shown anyway: which provider fetches a source is a property of the source. */}
        <Select label={AdminI18n.t('sources.provider')} value={this.provider} options={this.providerOptions} placeholder={this.providerPlaceholder} disabled={this.providerDisabled} onChange={this.onProvider} />
        <div className="space-y-2">
          <Input label={AdminI18n.t('sources.githubToken')} type="password" autoComplete="new-password" value={this.secret} onChange={this.handleSecret} onBlur={this.onSecretBlur} placeholder={this.secretPlaceholder} />
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{this.secretHelp}</p>
        </div>
        <div className="space-y-1">
          <Select label={AdminI18n.t('sources.publishToSite')} value={this.publishToSite} options={this.publishOptions} onChange={this.onPublish} />
          <p className="text-xs text-slate-500">{AdminI18n.t('sources.publishToSiteHelp')}</p>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800">
        <button type="button" onClick={this.onToggle} aria-expanded={this.open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{AdminI18n.t('sources.advanced')}</span>
            {!this.open ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{this.summary}</span> : null}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${this.open ? 'rotate-180' : ''}`} />
        </button>
        {this.open ? this.renderFields() : null}
      </div>
    );
  }
}
