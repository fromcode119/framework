import React from 'react';
import { SlotsContext } from '../context/slots-context';
import { AccountOverviewContent } from './overview-content';

/**
 * Framework Overview/landing section for the AccountShell. The framework names NO plugin here:
 * every stat card comes from the `account.overview.stats` slot, where each installed plugin
 * registers its own contributor via
 * `ContextBridge.registerSlotComponent('account.overview.stats', Contributor, '<slug>', priority)`
 * (a class with a static `loadStats(context)` — see overview.interfaces.ts). This panel only reads
 * the slot and hands the contributor list to {@link AccountOverviewContent}, which fetches each
 * contributor defensively so a missing/erroring plugin simply drops its card. Priority -10 so it is
 * the default section at `/account`.
 */
export class AccountOverviewPanel extends React.Component<Record<string, unknown>> {
  static readonly accountSection = { key: 'overview', labelKey: 'account.section.overview', priority: -10 };

  private readonly SLOT_NAME = 'account.overview.stats';

  render(): React.ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => <AccountOverviewContent contributors={slots?.[this.SLOT_NAME] || []} />}
      </SlotsContext.Context.Consumer>
    );
  }
}
