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
    { risk: 'high', heading: 'plugins.consent.risk.high' },
    { risk: 'medium', heading: 'plugins.consent.risk.medium' },
    { risk: 'low', heading: 'plugins.consent.risk.low' },
  ] as const;

  render(): ReactNode {
    return (
      <div className="fc-consent__groups">
        {PluginConsentEntries.GROUPS.map((group) => {
          const entries = this.entries.filter((entry) => entry.risk === group.risk);
          if (!entries.length) return null;
          return (
            <section key={group.risk} aria-label={AdminI18n.t(group.heading)}>
              <h4 className="fc-consent__heading" data-risk={group.risk}>
                {AdminI18n.t(group.heading)} ({entries.length})
              </h4>
              <ul className="fc-consent__entries">
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
      <li key={entry.entry} className="fc-consent__entry">
        <div className="min-w-0">
          <p className="fc-consent__title">{copy.title}</p>
          <p className="fc-consent__text">{copy.detail}</p>
        </div>
        {entry.isNew ? <Badge variant={BadgeVariant.INFO} className="shrink-0">{AdminI18n.t('plugins.consent.new')}</Badge> : null}
      </li>
    );
  }
}
