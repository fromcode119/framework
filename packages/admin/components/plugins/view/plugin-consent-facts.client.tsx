import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentCopy } from '@/components/plugins/plugin-consent-copy';

/** What else approving the plugin means: where it runs, what it creates, where it shows up. */
export class PluginConsentFacts extends PureReactor {
  /** The consent token for a plugin's own tables (core's `PluginCapability.DATABASE`). */
  static readonly DATABASE = 'database';

  @prop declare summary: IPluginConsentSummary;

  render(): ReactNode {
    const facts = this.facts();
    const { summary } = this;
    return (
      <div className="fc-consent__facts">
        <h4 className="fc-consent__heading">
          {AdminI18n.t('plugins.consent.facts.heading')}
        </h4>
        <ul className="fc-consent__fact-list">
          {facts.map((fact) => (
            <li key={fact} className="fc-consent__text">{fact}</li>
          ))}
        </ul>
        {summary.dropped.length ? (
          <p className="fc-consent__text">
            {AdminI18n.t('plugins.consent.dropped', { entries: summary.dropped.map((entry) => PluginConsentCopy.titleOfEntry(entry)).join('; ') })}
          </p>
        ) : null}
        {summary.invalidHosts.length ? (
          <p className="fc-consent__warning">
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
    // A plugin's collections are known only once its code has run, so before its first approval a plugin
    // that asks for database access lists none. "No tables" is said only when it cannot create any.
    if (summary.collections.length) facts.push(AdminI18n.t('plugins.consent.facts.tables', { tables: summary.collections.join(', ') }));
    else if (!summary.consent.includes(PluginConsentFacts.DATABASE)) facts.push(AdminI18n.t('plugins.consent.facts.noTables'));
    if (summary.adminScreens) facts.push(AdminI18n.t('plugins.consent.facts.adminScreens'));
    if (summary.storefrontCode) facts.push(AdminI18n.t('plugins.consent.facts.storefrontCode'));
    if (summary.storefrontWidgets) facts.push(AdminI18n.t('plugins.consent.facts.storefrontWidgets', { count: summary.storefrontWidgets }));
    if (summary.storefrontHosts?.length) facts.push(AdminI18n.t('plugins.consent.facts.storefrontHosts', { hosts: summary.storefrontHosts.join(', ') }));
    return facts;
  }
}
