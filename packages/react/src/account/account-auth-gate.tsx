import type { IAccountAuthGateState } from '@react/account/interfaces/account-auth-gate-state.interface';
import { AuthGateState } from '@react/account/enums/auth-gate-state.enum';
import type { ReactNode } from 'react';
import { Platform, prop, state } from '@fromcode119/react-class-components';
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
  private static readonly UNAUTHORIZED = 401;
  private mounted = false;
  private checking = false;

  componentDidMount(): void {
    this.mounted = true;
    AccountTranslations.register();
    void this.check();
  }

  /** The runtime context can arrive after mount; the check starts the moment there is an api to ask. */
  componentDidUpdate(): void {
    if (this.status === AuthGateState.CHECKING) void this.check();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async check(): Promise<void> {
    // No api means the plugin runtime has not arrived yet, NOT that the visitor is a guest. The storefront
    // paints its first frame with no provider (`StorefrontRuntimeGate`) and then remounts the page inside
    // the runtime. Deciding here sent every signed-in customer to /login: this copy's request threw for
    // want of an api, and its redirect fired after the remounted gate had already shown the account.
    // Staying undecided costs nothing — the server guard has already turned guests away.
    if (!this.api || this.checking) return;
    this.checking = true;
    try {
      // `/auth/me/person` returns the signed-in person (200) and 401s for guests — the authoritative
      // session probe (`/auth/me` does not exist; `/auth/status` only reports install state).
      // A guest is refused with 401 (thrown); any answer is a session, with or without a person record —
      // an account that has none yet (an administrator created in the console) is still signed in.
      const res = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      const ok = Boolean(res && typeof res === 'object' && 'person' in res);
      if (this.mounted) this.setState({ status: ok ? AuthGateState.AUTHED : AuthGateState.GUEST });
      if (!ok) this.redirectToLogin();
    } catch (error) {
      // Only a 401 says "not signed in". A 429, a 5xx or a dropped connection says nothing about the
      // session: sending that customer to /login told a signed-in person they were signed out (and the
      // login page then answered "already signed in"). They get a retry instead; no content is shown.
      const guest = (error as { statusCode?: number } | null)?.statusCode === AccountAuthGate.UNAUTHORIZED;
      if (this.mounted) this.setState({ status: guest ? AuthGateState.GUEST : AuthGateState.UNAVAILABLE });
      if (guest) this.redirectToLogin();
    } finally {
      this.checking = false;
    }
  }

  private retry = (): void => {
    this.setState({ status: AuthGateState.CHECKING });
  };

  private redirectToLogin(): void {
    // A gate that has been unmounted no longer speaks for the page: a remounted twin owns the decision.
    if (!Platform.isBrowser || !this.mounted) return;
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
    if (this.status === AuthGateState.UNAVAILABLE) {
      return (
        <div className={`${AccountClass.ROOT} ${AccountClass.of('gate')}`} role="alert">
          <h2 className={AccountClass.of('gate-title')}>{this.t('account.gate.unavailableTitle', undefined, 'We could not check your sign-in')}</h2>
          <p className={AccountClass.of('gate-body')}>{this.t('account.gate.unavailableBody', undefined, 'This is usually brief. Please try again in a moment.')}</p>
          <button type="button" className={AccountClass.of('btn', 'link')} onClick={this.retry}>
            {this.t('account.gate.retry', undefined, 'Try again')}
          </button>
        </div>
      );
    }
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
