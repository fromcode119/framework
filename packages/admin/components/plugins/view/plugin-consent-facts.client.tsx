import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What else approving the plugin means: where it runs, what it creates, where it shows up. */
export class PluginConsentFacts extends PureReactor {
  @prop declare summary: IPluginConsentSummary;

  render(): ReactNode {
    const facts = this.facts();
    const { summary } = this;
    return (
      <div className="space-y-3">
        <h4 className="border-b border-slate-200 pb-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {AdminI18n.t('plugins.consent.facts.heading')}
        </h4>
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {facts.map((fact) => (
            <li key={fact} className="text-[13px] leading-snug text-slate-700 dark:text-slate-300 break-words">{fact}</li>
          ))}
        </ul>
        {summary.dropped.length ? (
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            {AdminI18n.t('plugins.consent.dropped', { entries: summary.dropped.join(', ') })}
          </p>
        ) : null}
        {summary.invalidHosts.length ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {AdminI18n.t('plugins.consent.invalidHosts', { hosts: summary.invalidHosts.join(', ') })}
          </p>
        ) : null}
      </div>
    );
  }

  private facts(): string[] {
    const { summary } = this;
    const facts: string[] = [];
    if (!summary.isolated) facts.push(AdminI18n.t('plugins.consent.facts.shared'));
    else if (summary.memoryLimitMb || summary.timeoutMs) {
      facts.push(AdminI18n.t('plugins.consent.facts.isolatedLimits', { memory: summary.memoryLimitMb ?? '-', timeout: summary.timeoutMs ?? '-' }));
    } else facts.push(AdminI18n.t('plugins.consent.facts.isolated'));
    facts.push(summary.collections.length
      ? AdminI18n.t('plugins.consent.facts.tables', { tables: summary.collections.join(', ') })
      : AdminI18n.t('plugins.consent.facts.noTables'));
    if (summary.adminScreens) facts.push(AdminI18n.t('plugins.consent.facts.adminScreens'));
    if (summary.storefrontCode) facts.push(AdminI18n.t('plugins.consent.facts.storefrontCode'));
    if (summary.storefrontWidgets) facts.push(AdminI18n.t('plugins.consent.facts.storefrontWidgets', { count: summary.storefrontWidgets }));
    if (summary.storefrontHosts?.length) facts.push(AdminI18n.t('plugins.consent.facts.storefrontHosts', { hosts: summary.storefrontHosts.join(', ') }));
    return facts;
  }
}
