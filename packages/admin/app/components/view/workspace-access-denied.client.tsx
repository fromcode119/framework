import type { ReactElement } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AuthUtils } from '@/lib/auth-utils';
import { WorkspaceAppearanceLock } from '@/lib/appearance/workspace-appearance-lock';

/**
 * "You are signed in, but not here."
 *
 * A workspace tenant's domain IS its console, and the host names the tenant — the session's claim
 * gets no say, so membership decides. An account without one is refused by the server on every
 * request, which is correct; what was wrong is what the operator saw. The readable user cookie is
 * scoped to the whole cookie domain, so it travels to every tenant host and painted a complete
 * console — sidebar, the operator's own name in the header, zero rows behind all of it — for a
 * session that could not read a single thing.
 *
 * A login form would be the wrong answer too: the account can sign in perfectly well and still not
 * be a member. So this says which workspace refused it, and offers the two moves that exist — sign
 * out to try another account, or go back to a console this account can actually reach.
 */
export class WorkspaceAccessDenied extends AdminComponent {
  /** Set by the AppearanceRuntimeLoader from the public host lookup; empty until that answers. */
  private get workspaceName(): string {
    return WorkspaceAppearanceLock.slug;
  }

  /**
   * One action, not two. "Sign out" and "sign in as someone else" are the same move here — this
   * domain's login is where both land — and offering them as separate buttons would be two controls
   * doing one thing.
   */
  @bound
  private signOut(): void {
    AuthUtils.purgeAuth();
    window.location.href = AdminConstants.ROUTES.AUTH.LOGIN;
  }

  render(): ReactElement {
    const name = this.workspaceName;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-[#020617]">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-xl shadow-amber-500/10">
            <FrameworkIcons.Lock size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">No access to this workspace</h1>
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              {name
                ? <>Your account is not a member of <span className="font-bold text-indigo-500">{name}</span>, so there is nothing here for it to administer.</>
                : <>Your account is not a member of the workspace this domain serves, so there is nothing here for it to administer.</>}
              {' '}Someone who administers it can add you.
            </p>
          </div>
          <button
            type="button"
            onClick={this.signOut}
            className="w-full cursor-pointer rounded-lg bg-slate-900 py-4 text-[11px] font-semibold tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
          >
            Sign out and use another account
          </button>
        </div>
      </div>
    );
  }
}
