import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountSummaryStore } from '@react/account/account-summary-store';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { IAccountSummaries } from '@react/account/interfaces/account-summaries.interface';

/**
 * Fills {@link AccountSummaryStore} once per account page. Every `account.overview.stats` contributor
 * may also expose `loadSummaries(context)`; the framework adds its own section, sign-in security, from
 * the two-factor status it owns. Renders nothing. A contributor that fails drops only its summaries.
 */
export class AccountSummaryLoader extends PluginComponent {
  @prop declare contributors: ISlotComponent[];
  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentDidUpdate(prev: { contributors?: ISlotComponent[] }): void {
    // Plugin bundles register late; load again when the contributor set grows.
    if ((prev.contributors || []).length !== (this.contributors || []).length) void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async attempt(fn: () => any): Promise<IAccountSummaries | null> {
    try { return (await fn()) || null; } catch { return null; }
  }

  private async security(): Promise<IAccountSummaries | null> {
    const status: any = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.TWO_FACTOR_STATUS, { silent: true });
    if (status == null) return null;
    const on = Boolean(status?.enabled ?? status?.twoFactorEnabled);
    const text = on
      ? this.t('account.overview.tiles.twoFactorOn', undefined, 'Two-factor sign-in: on')
      : this.t('account.overview.tiles.twoFactorOff', undefined, 'Two-factor sign-in: off');
    return { sections: { security: { text } } };
  }

  private async load(): Promise<void> {
    const context = { namespace: (ns: string) => this.namespace(ns), api: this.api, t: this.t };
    const entries = [...(this.contributors || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const parts = await Promise.all([
      this.attempt(() => this.security()),
      ...entries.map((entry) => this.attempt(() => (entry.component as any)?.loadSummaries?.(context))),
    ]);
    if (this.mounted) AccountSummaryStore.set(parts.filter((part): part is IAccountSummaries => part != null));
  }

  render(): ReactNode {
    return null;
  }
}
