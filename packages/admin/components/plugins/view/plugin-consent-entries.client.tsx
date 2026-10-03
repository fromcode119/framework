import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { IPluginConsentEntry } from '@/components/plugins/interfaces/plugin-consent-entry.interface';
import { PluginConsentCopy } from '@/components/plugins/plugin-consent-copy';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The entries of a consent summary, grouped by risk, the riskiest group first. */
export class PluginConsentEntries extends PureReactor {
  @prop declare entries: IPluginConsentEntry[];
  @prop declare anyHostReason: string;

  private static readonly GROUPS = [
    { risk: 'high', heading: 'plugins.consent.risk.high', tone: 'text-rose-700 dark:text-rose-300', rule: 'border-rose-200 dark:border-rose-500/30' },
    { risk: 'medium', heading: 'plugins.consent.risk.medium', tone: 'text-amber-700 dark:text-amber-300', rule: 'border-amber-200 dark:border-amber-500/30' },
    { risk: 'low', heading: 'plugins.consent.risk.low', tone: 'text-slate-600 dark:text-slate-300', rule: 'border-slate-200 dark:border-slate-700' },
  ] as const;

  render(): ReactNode {
    return (
      <div className="space-y-5">
        {PluginConsentEntries.GROUPS.map((group) => {
          const entries = this.entries.filter((entry) => entry.risk === group.risk);
          if (!entries.length) return null;
          return (
            <section key={group.risk} aria-label={AdminI18n.t(group.heading)}>
              <h4 className={`border-b pb-1.5 text-xs font-semibold ${group.tone} ${group.rule}`}>
                {AdminI18n.t(group.heading)} ({entries.length})
              </h4>
              <ul className="mt-2 space-y-2.5">
                {entries.map((entry) => this.renderEntry(entry))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  private renderEntry(entry: IPluginConsentEntry): ReactNode {
    const copy = PluginConsentCopy.of(entry, this.anyHostReason, this.entries.some((candidate) => candidate.kind === 'anyHost'));
    return (
      <li key={entry.entry} className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">{copy.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-600 dark:text-slate-400 break-words">{copy.detail}</p>
        </div>
        {entry.isNew ? <Badge variant={BadgeVariant.BLUE} className="shrink-0">{AdminI18n.t('plugins.consent.new')}</Badge> : null}
      </li>
    );
  }
}
