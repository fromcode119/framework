import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountClass } from '@react/account/account-class';
import { AccountSummaryStore } from '@react/account/account-summary-store';

/**
 * Whose account this is, at the head of the account menu: initials, name and e-mail of the signed-in
 * person, read from the person record, plus the line a contributor offers (see AccountSummaryStore). Nothing is shown until the record answers, so no placeholder
 * name ever appears.
 */
export class AccountWho extends PluginComponent {
  @state person: Record<string, any> | null = null;
  private mounted = false;
  private unsubscribe?: () => void;

  componentDidMount(): void {
    this.mounted = true;
    this.unsubscribe = AccountSummaryStore.subscribe(() => this.forceUpdate());
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.unsubscribe?.();
  }

  private async load(): Promise<void> {
    try {
      const result: any = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      if (this.mounted) this.setState({ person: result?.person ?? result?.data?.person ?? null });
    } catch {
      // The menu stays usable without the name.
    }
  }

  private static initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toLocaleUpperCase()).join('');
  }

  render(): ReactNode {
    const person = this.person;
    const name = String(person?.displayName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '').trim();
    const email = String(person?.email || '').trim();
    if (!name && !email) return null;
    // A contributed line such as "customer since 2023"; the person record's own date is when the
    // record was made, not when the person became a customer, so the framework adds none itself.
    const since = AccountSummaryStore.get().who;
    return (
      <div className={AccountClass.of('who')}>
        <span className={AccountClass.of('avatar')} aria-hidden="true">{AccountWho.initials(name || email)}</span>
        <span className={AccountClass.of('who-text')}>
          {name ? <span className={AccountClass.of('who-name')}>{name}</span> : null}
          {email ? <span className={AccountClass.of('who-email')}>{email}</span> : null}
          {since ? <span className={AccountClass.of('who-since')}>{since}</span> : null}
        </span>
      </div>
    );
  }
}
