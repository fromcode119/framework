import type { IAccountAuthGateState } from '@react/account/interfaces/account-auth-gate-state.interface';
import { AuthGateState } from '@react/account/enums/auth-gate-state.enum';
import type { ReactNode } from 'react';
import { Platform, prop, state } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountTranslations } from '@react/account/account-translations';
import { AccountShellPlaceholder } from '@react/account/account-shell-placeholder';
import { AccountClass } from '@react/account/account-class';

/**
 * Auth gate for the framework AccountShell. The account renders client-side, so without this the full
 * shell (and every panel's data) is reachable by an unauthenticated visitor. The gate verifies the
 * session via `auth/me` on mount and ONLY renders its children when a real user is returned; otherwise
 * it shows a sign-in prompt and redirects to `/login?next=<path>` — failing CLOSED on any error so no
 * account content ever leaks to a guest.
 */
export class AccountAuthGate extends PluginComponent {
  @prop declare children?: ReactNode;
  @state status: AuthGateState = AuthGateState.CHECKING;
  private mounted = false;
  
  componentDidMount(): void {
    this.mounted = true;
    AccountTranslations.register();
    void this.check();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async check(): Promise<void> {
    try {
      // `/auth/me/person` returns the signed-in person (200) and 401s for guests — the authoritative
      // session probe (`/auth/me` does not exist; `/auth/status` only reports install state).
      const res = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      const person = res?.person ?? res?.data?.person ?? null;
      const ok = Boolean(person && typeof person === 'object' && (person.id || person.userId || person.email));
      if (this.mounted) this.setState({ status: ok ? AuthGateState.AUTHED : AuthGateState.GUEST });
      if (!ok) this.redirectToLogin();
    } catch {
      if (this.mounted) this.setState({ status: AuthGateState.GUEST });
      this.redirectToLogin();
    }
  }

  private redirectToLogin(): void {
    if (!Platform.isBrowser) return;
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // Framework-owned login path (RouteConstants), not a hardcoded literal.
    window.location.replace(`${RouteConstants.SEGMENTS.LOGIN}?next=${next}`);
  }

  render(): ReactNode {
    if (this.status === AuthGateState.AUTHED) return this.children;
    // Still deciding — which is the state of every SERVER render and every first client paint. Showing
    // "please sign in" here told signed-in visitors they were signed out for a beat, and rendering
    // nothing left the account URL opening to a hole. The shell's shape stands in until the answer
    // arrives; only a CONFIRMED guest sees the prompt.
    if (this.status === AuthGateState.CHECKING) return <AccountShellPlaceholder />;
    return (
      <div className={`${AccountClass.ROOT} ${AccountClass.of('gate')}`}>
        <h2 className={AccountClass.of('gate-title')}>{this.t('account.gate.title', undefined, 'Please sign in')}</h2>
        <p className={AccountClass.of('gate-body')}>{this.t('account.gate.body', undefined, 'You need to be signed in to view your account.')}</p>
        {/* Framework-owned login path (RouteConstants), not a hardcoded literal. */}
        <a className={AccountClass.of('btn', 'link')} href={RouteConstants.SEGMENTS.LOGIN}>
          {this.t('account.gate.login', undefined, 'Sign in')}
        </a>
      </div>
    );
  }
}
