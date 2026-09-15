import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Select } from '@/components/ui/view/select.client';
import { Input } from '@/components/ui/view/input.client';
import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';
import type { IPersonalDataPolicyDataset } from '@/app/settings/personal-data/interfaces/personal-data-policy-dataset.interface';

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

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  /** Only what this dataset declared it can honour, plus the explicit "inherit" the blank value means. */
  private get options() {
    return [
      { value: '', label: 'Use the layer below' },
      ...this.dataset.strategies.map((strategy) => ({ value: strategy, label: strategy })),
    ];
  }

  private column(
    choice: IPersonalDataPolicyChoice | undefined,
    editable: boolean,
    inherits: string,
    onChange: (id: string, next: IPersonalDataPolicyChoice | undefined) => void,
  ): ReactNode {
    const strategy = String(choice?.strategy ?? '');
    return (
      <div className="flex flex-col gap-2">
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
            value={String(choice?.reason ?? '')}
            disabled={!editable}
            placeholder="Why the law requires these records to be kept"
            onChange={(event: any) => onChange(this.dataset.id, { strategy, reason: event?.target?.value ?? '' })}
          />
        )}
        {!strategy && (
          <span className={`text-[12px] ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>{inherits}</span>
        )}
      </div>
    );
  }

  render(): ReactNode {
    const { dataset } = this;
    return (
      <div className={`py-4 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b last:border-0 ${this.isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div>
          <h3 className={`text-sm font-semibold tracking-tight ${this.isDark ? 'text-slate-200' : 'text-slate-900'}`}>{dataset.label}</h3>
          <p className={`text-[12px] font-mono mt-0.5 ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>{dataset.id}</p>
          {dataset.fields.length > 0 && (
            <p className={`text-[12px] mt-1 leading-relaxed ${this.isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dataset.fields.join(', ')}</p>
          )}
        </div>

        {this.column(this.platform, this.platformEditable, `inherits: ${dataset.declaredProvenance}`, this.onPlatformChange)}
        {this.column(this.site, this.siteEditable, 'inherits: the platform default', this.onSiteChange)}

        <div className="flex flex-col gap-1">
          <span className={`text-sm font-medium ${this.isDark ? 'text-slate-200' : 'text-slate-900'}`}>{dataset.strategy}</span>
          <span className={`text-[12px] ${this.isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dataset.provenance}</span>
          {dataset.reason && (
            <span className={`text-[12px] italic ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>{dataset.reason}</span>
          )}
          {dataset.problem && (
            <span className="text-[12px] text-amber-600 leading-relaxed">{dataset.problem}</span>
          )}
        </div>
      </div>
    );
  }
}
