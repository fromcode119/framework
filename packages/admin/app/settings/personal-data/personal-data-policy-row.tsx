import { ThemeMode } from '@fromcode119/core/client';
import { PersonalDataPolicyClient } from '@/lib/settings/personal-data-policy-client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { Input } from '@/components/ui/view/input.client';
import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';
import type { IPersonalDataPolicyDataset } from '@/app/settings/personal-data/interfaces/personal-data-policy-dataset.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One dataset, and what happens to it when somebody asks to be forgotten.
 *
 * Two editable columns because the answer has two layers — the platform's default across every site,
 * and this site's override of it — and an "in force" column that says which one actually won. An
 * empty cell is not blank: it NAMES what it falls through to, so a fallback is never read as a
 * decision somebody made.
 */
export class PersonalDataPolicyRow extends PureReactor {
  @prop declare dataset: IPersonalDataPolicyDataset;
  @prop declare site: IPersonalDataPolicyChoice | undefined;
  @prop declare platform: IPersonalDataPolicyChoice | undefined;
  @prop declare platformEditable: boolean;
  @prop declare siteEditable: boolean;
  @prop declare onSiteChange: (id: string, choice: IPersonalDataPolicyChoice | undefined) => void;
  @prop declare onPlatformChange: (id: string, choice: IPersonalDataPolicyChoice | undefined) => void;
  @prop declare theme: ThemeMode;

  /** Only what this dataset declared it can honour, plus the explicit "inherit" the blank value means. */
  private get options() {
    return [
      { value: '', label: AdminI18n.t('settings.personalData.useTheLayerBelow') },
      ...this.dataset.strategies.map((strategy) => ({ value: strategy, label: PersonalDataPolicyClient.strategyLabel(strategy) })),
    ];
  }

  private column(
    heading: string,
    choice: IPersonalDataPolicyChoice | undefined,
    editable: boolean,
    inherits: string,
    onChange: (id: string, next: IPersonalDataPolicyChoice | undefined) => void,
  ): ReactNode {
    const strategy = String(choice?.strategy ?? '');
    return (
      <div className="fc-pd__cell">
        <span className="fc-pd__cell-label">{heading}</span>
        <Select
          value={strategy}
          options={this.options}
          disabled={!editable}
          theme={this.theme}
          onChange={(value: string) => onChange(
            this.dataset.id,
            value ? { strategy: value, reason: String(choice?.reason ?? '') } : undefined,
          )}
        />
        {/* A retention nobody justified is indistinguishable from doing nothing, and the basis is the
            one thing the subject is entitled to be told — so the field appears exactly when it is
            required, and the policy refuses the choice until it is filled. */}
        {strategy === 'retain' && (
          <Input
            label={AdminI18n.t('settings.personalData.legalBasis')}
            value={String(choice?.reason ?? '')}
            disabled={!editable}
            placeholder={AdminI18n.t('settings.personalData.whyTheLawRequiresThese')}
            onChange={(event: any) => onChange(this.dataset.id, { strategy, reason: event?.target?.value ?? '' })}
          />
        )}
        {!strategy && (
          <span className="fc-text fc-text--xsmall fc-text--muted">{inherits}</span>
        )}
      </div>
    );
  }

  render(): ReactNode {
    const { dataset } = this;
    return (
      <div className="fc-pd__grid fc-pd__row">
        <div>
          <p className="fc-text fc-text--base fc-text--plus">{dataset.label}</p>
          {dataset.fields.length > 0 && (
            <p className="fc-text fc-text--xsmall fc-text--muted">{dataset.fields.join(', ')}</p>
          )}
        </div>

        {this.column(AdminI18n.t('settings.personalData.platformDefault'), this.platform, this.platformEditable, AdminI18n.t('settings.personalData.inheritsValue', { value: dataset.declaredProvenance }), this.onPlatformChange)}
        {this.column(AdminI18n.t('settings.personalData.thisSite'), this.site, this.siteEditable, AdminI18n.t('settings.personalData.inheritsThePlatformDefault'), this.onSiteChange)}

        <div className="fc-pd__cell fc-pd__cell--tight">
          <span className="fc-pd__cell-label">{AdminI18n.t('settings.personalData.inForceNow')}</span>
          <span className="fc-text fc-text--base fc-text--plus">{PersonalDataPolicyClient.strategyLabel(dataset.strategy)}</span>
          <span className="fc-text fc-text--xsmall fc-text--muted">{dataset.provenance}</span>
          {dataset.reason && (
            <span className="fc-text fc-text--xsmall fc-text--muted">{dataset.reason}</span>
          )}
          {dataset.problem && (
            <span className="fc-text fc-text--xsmall fc-pd__problem">{dataset.problem}</span>
          )}
        </div>
      </div>
    );
  }
}
