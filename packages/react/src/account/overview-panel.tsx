import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { SlotsContext } from '@react/context/slots-context';
import { AccountOverviewContent } from '@react/account/overview-content';
import type { AccountSection } from '@react/account/account-section';
import type { IAccountSectionNavigate } from '@react/account/interfaces/account-section-navigate.interface';

/**
 * Framework Overview/landing section for the AccountShell. The framework names NO plugin here:
 * every stat card comes from the `account.overview.stats` slot, where each installed plugin
 * registers its own contributor via
 * `ContextBridge.registerSlotComponent('account.overview.stats', Contributor, '<slug>', priority)`
 * (a class with a static `loadStats(context)` — see overview.interfaces.ts). This panel only reads
 * the slot and hands the contributor list to {@link AccountOverviewContent}, which fetches each
 * contributor defensively so a missing/erroring plugin simply drops its card. Priority -10 so it is
 * the default section at `/account`.
 *
 * The "manage your account" links come from `sections` — the shell's own resolved section list, built
 * from the registered panels — so the overview can never link to a section that is not installed, and
 * never miss one that is. No section key is written down here.
 */
export class AccountOverviewPanel extends Reactor {
  static readonly accountSection = { key: 'overview', labelKey: 'account.section.overview', priority: -10, descriptionKey: 'account.description.overview' };

  /** Every account section the shell resolved, passed down by {@link AccountShell}. */
  @prop declare sections?: AccountSection[];

  /** The shell's in-shell navigation, so overview links switch section without a document load. */
  @prop declare navigate?: IAccountSectionNavigate;

  private readonly STATS_SLOT = 'account.overview.stats';

  render(): ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => (
          <AccountOverviewContent
            contributors={slots?.[this.STATS_SLOT] || []}
            sections={this.sections || []}
            navigate={this.navigate}
          />
        )}
      </SlotsContext.Context.Consumer>
    );
  }
}
